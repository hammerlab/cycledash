from collections import defaultdict
from sqlalchemy import select, desc, func, or_

from cycledash import db
import cycledash.genotypes as genotypes

from common.helpers import tables, CRUDError
from workers.shared import update_tasks_table, worker


def get_runs():
    """Return a tuple of a list of all runs, the last 5 comments, and an object with
    lists of potential completions for the run upload form typeahead fields."""
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
        orphan_tasks = _join_task_states(vcfs)

        return vcfs, last_comments, completions, orphan_tasks


def get_run(run_id):
    """Return a run with a given ID, and the spec and list of contigs for that
    run for use by the /examine page."""
    with tables(db, 'vcfs') as (con, vcfs):
        q = select(vcfs.c).where(vcfs.c.id == run_id)
        run = dict(con.execute(q).fetchone())
    run['spec'] = genotypes.spec(run_id)
    run['contigs'] = genotypes.contigs(run_id)
    return run


def _run_id_and_path(run_id_or_path):
    """Converts an ID _or_ path into an ID _and_ a path."""
    if isinstance(run_id_or_path, int) or '/' not in run_id_or_path:
        run = get_run(run_id_or_path)
        return int(run_id_or_path), run['uri']
    else:
        return -1, run_id_or_path


def get_tasks(run_id_or_path):
    run_id, vcf_path = _run_id_and_path(run_id_or_path)

    with tables(db, 'task_states') as (con, tasks):
        q = (select([tasks.c.task_id, tasks.c.type, tasks.c.state])
            .where(or_(tasks.c.vcf_id == run_id,
                       tasks.c.vcf_path == vcf_path)))
        return [{
                    'type': _simplify_type(typ),
                    'state': state,
                    # pylint: disable=too-many-function-args
                    'traceback': worker.AsyncResult(task_id).traceback
                }
                for task_id, typ, state in con.execute(q).fetchall()]


def delete_tasks(run_id_or_path):
    run_id, vcf_path = _run_id_and_path(run_id_or_path)
    with tables(db, 'task_states') as (con, tasks):
        stmt = tasks.delete(or_(tasks.c.vcf_id == run_id,
                                tasks.c.vcf_path == vcf_path))
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


def _simplify_type(typ):
    """Simplifies worker names, e.g. workers.gene_annotations.annotate."""
    return '.'.join(typ.split('.')[1:-1])


def _join_task_states(vcfs):
    update_tasks_table()
    ts = _get_running_failed_task_vcfs()

    for vcf in vcfs:
        id_ = vcf['id']
        uri = vcf['uri']
        states = ts.get(id_, []) + ts.get(uri, [])
        vcf['task_states'] = list(set(states))
        if id_ in ts: del ts[id_]
        if uri in ts: del ts[uri]

    # the remaining tasks are orphans -- possibly recently submitted runs which
    # haven't been fully indexed.
    return ts


def _get_running_failed_task_vcfs():
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
