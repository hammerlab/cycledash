from collections import defaultdict
from sqlalchemy import select, desc, func, or_

import config
from cycledash import db
from cycledash import validations
from cycledash import genotypes

from common.helpers import tables, CRUDError
from workers.shared import update_tasks_table, worker
import workers.runner


class CollisionError(Exception):
    pass


def get_runs():
    """Return a tuple of:
        - a list of all runs
        - the last 5 comments
        - an object with lists of potential completions for the run upload form
          typeahead fields.
        """
    with tables(db, 'vcfs', 'user_comments') as (con, vcfs, user_comments):
        joined = vcfs.outerjoin(user_comments, vcfs.c.id == user_comments.c.vcf_id)
        num_comments = func.count(user_comments.c.vcf_id).label('num_comments')
        q = select(vcfs.c + [num_comments]).select_from(joined).group_by(
            vcfs.c.id).order_by(desc(vcfs.c.id))
        vcfs = [dict(v) for v in con.execute(q).fetchall()]
        completions = _extract_completions(vcfs)

        q = select(user_comments.c).order_by(
            desc(user_comments.c.last_modified)).limit(5)
        last_comments = [dict(c) for c in con.execute(q).fetchall()]
        _join_task_states(vcfs)

        return vcfs, last_comments, completions


def get_run(run_id):
    """Return a run with a given ID, and the spec and list of contigs for that
    run for use by the /examine page."""
    with tables(db, 'vcfs') as (con, vcfs):
        q = select(vcfs.c).where(vcfs.c.id == run_id)
        run = dict(con.execute(q).fetchone())
    run['spec'] = genotypes.spec(run_id)
    run['contigs'] = genotypes.contigs(run_id)
    return run


def create_run(request):
    """Create a new run, inserting it into the vcfs table and starting workers.

    This raises an exception if anything goes wrong.

    Args:
        request: validations.CreateRunSchema
    """
    run = validations.CreateRunSchema(request)  # throws on error

    with tables(db, 'vcfs') as (con, vcfs_table):
        _ensure_no_existing_vcf(vcfs_table, run['vcf_path'])

        vcfs = [{'uri': run['vcf_path'], 'is_validation': False}]
        if run.get('truth_vcf_path'):
            vcfs.append({'uri': run['truth_vcf_path'], 'is_validation': True})

        # Insert VCFs which aren't already in the database.
        # (the _ensure_no_existing_vcf check only checks the Run VCF, not truth)
        vcf_ids = [_insert_vcf(vcf, run, vcfs_table, con) for vcf in vcfs]
        vcf_ids = [x for x in vcf_ids if x]  # filter out `None`s

    # Kick off Celery workers for each new VCF.
    for vcf_id in vcf_ids:
        workers.runner.start_workers_for_vcf_id(vcf_id, run)


def _ensure_no_existing_vcf(vcfs_table, vcf_path):
    """Ensures no other VCFs with the same path. Raises if this isn't so."""
    if not _vcf_exists(vcfs_table, vcf_path):
        return
    if config.ALLOW_VCF_OVERWRITES:
        was_deleted = _delete_vcf(vcfs_table, vcf_path)
        if not was_deleted:
            raise CRUDError('Rows should have been deleted if we are '
                            'deleting a VCF that exists')
    else:
        raise CollisionError(
            'VCF already exists with URI {}'.format(vcf_path))


def _insert_vcf(vcf, run, vcfs_table, connection):
    """Insert a new row in the vcfs table, if it's not there already."""
    uri = vcf['uri']
    if _vcf_exists(vcfs_table, uri):
        return None
    record = {
        'uri': uri,
        'dataset_name': run.get('dataset'),
        'caller_name': run.get('variant_caller_name'),
        'normal_bam_uri': run.get('normal_path'),
        'tumor_bam_uri': run.get('tumor_path'),
        'notes': run.get('params'),
        'project_name': run.get('project_name'),
        'vcf_header': '(pending)',
        'validation_vcf': vcf['is_validation']
    }
    vcfs_table.insert(record).execute()
    return _get_vcf_id(connection, uri)


def _get_vcf_id(connection, uri):
    """Return id from vcfs table for the vcf corresponding to the given run."""
    query = "SELECT * FROM vcfs WHERE uri = '" + uri + "'"
    return connection.execute(query).first().id


def _delete_vcf(vcfs_table, uri):
    """Delete VCFs with this URI, and return True if rows were deleted."""
    result = vcfs_table.delete().where(vcfs_table.c.uri == uri).execute()
    return result.rowcount > 0


def _vcf_exists(vcfs_table, uri):
    """Return True if the VCF exists in the vcfs table, else return False."""
    q = select([vcfs_table.c.id]).where(vcfs_table.c.uri == uri)
    result = q.execute()
    return True if result.rowcount > 0 else False


def _simplify_type(typ):
    """Simplifies worker names, e.g. workers.gene_annotations.annotate."""
    return '.'.join(typ.split('.')[1:-1])


def get_tasks(run_id):
    """Returns a list of all tasks associated with a run."""
    with tables(db, 'task_states') as (con, tasks):
        q = (select([tasks.c.task_id, tasks.c.type, tasks.c.state])
            .where(tasks.c.vcf_id == run_id))
        return [{
                    'type': _simplify_type(typ),
                    'state': state,
                    # pylint: disable=too-many-function-args
                    'traceback': worker.AsyncResult(task_id).traceback
                }
                for task_id, typ, state in con.execute(q).fetchall()]


def delete_tasks(run_id):
    """Delete all tasks associated with a run."""
    with tables(db, 'task_states') as (con, tasks):
        stmt = tasks.delete(tasks.c.vcf_id == run_id)
        result = con.execute(stmt)
        if result.rowcount == 0:
            raise CRUDError('No Rows', 'No tasks were deleted')


def _extract_completions(vcfs):
    def pluck_unique(objs, attr):
        vals = {obj[attr] for obj in objs if obj.get(attr)}
        return list(vals)
    return {
        'variantCallerNames': pluck_unique(vcfs, 'caller_name'),
        'datasetNames': pluck_unique(vcfs, 'dataset_name'),
        'projectNames': pluck_unique(vcfs, 'project_name'),
        'normalBamPaths': pluck_unique(vcfs, 'normal_bam_uri'),
        'tumorBamPaths': pluck_unique(vcfs, 'tumor_bam_uri')
    }


def _join_task_states(vcfs):
    """Add a task_states field to each VCF in a list of VCFs."""
    update_tasks_table()
    ts = _get_running_failed_task_vcfs()

    for vcf in vcfs:
        vcf['task_states'] = list(set(ts.get(vcf['id'], [])))


def _get_running_failed_task_vcfs():
    """Returns a map from (id|path) -> [list of unique states of tasks]."""
    with tables(db, 'task_states') as (con, tasks):
        q = (select([tasks.c.vcf_id, tasks.c.vcf_path, tasks.c.state])
                .where(tasks.c.state != 'SUCCESS')
                .distinct())

        # maps either vcf_path or vcf_id to current states
        ids_to_states = defaultdict(set)
        for vcf_id, vcf_path, state in con.execute(q).fetchall():
            if vcf_id:
                ids_to_states[vcf_id].add(state)
            if vcf_path:
                ids_to_states[vcf_path].add(state)
        return {k: list(v) for k, v in ids_to_states.iteritems()}
