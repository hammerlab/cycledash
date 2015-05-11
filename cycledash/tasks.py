"""Methods for working with Celery task states."""

from sqlalchemy import select
from collections import defaultdict

from common.helpers import tables, CRUDError
from cycledash import db
from workers.shared import update_tasks_table, worker


def get_tasks(run_id):
    """Returns a list of all tasks associated with a run."""
    with tables(db.engine, 'task_states') as (con, tasks):
        q = (select([tasks.c.task_id, tasks.c.type, tasks.c.state])
            .where(tasks.c.vcf_id == run_id))
        return [{'type': _simplify_type(typ),
                 'state': state,
                 # pylint: disable=too-many-function-args
                 'traceback': worker.AsyncResult(task_id).traceback}
                for task_id, typ, state in con.execute(q).fetchall()]


def _simplify_type(typ):
    """Simplifies worker names, e.g. workers.gene_annotations.annotate."""
    return '.'.join(typ.split('.')[1:-1])


def delete_tasks(run_id):
    """Delete all tasks associated with a run."""
    with tables(db.engine, 'task_states') as (con, tasks):
        stmt = tasks.delete(tasks.c.vcf_id == run_id)
        result = con.execute(stmt)
        if result.rowcount == 0:
            raise CRUDError('No Rows', 'No tasks were deleted')


def all_non_success_tasks():
    """Returns a map from vcf_id -> [list of unique states of its tasks]."""
    update_tasks_table()
    with tables(db.engine, 'task_states') as (con, tasks):
        q = (select([tasks.c.vcf_id, tasks.c.state])
                .where(tasks.c.state != 'SUCCESS')
                .distinct())

        # maps vcf_id to current states
        ids_to_states = defaultdict(set)
        for vcf_id, state in con.execute(q).fetchall():
            ids_to_states[vcf_id].add(state)
        return {k: list(v) for k, v in ids_to_states.iteritems()}
