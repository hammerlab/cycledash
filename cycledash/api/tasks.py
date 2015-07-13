"""Methods for working with Celery task states."""
from collections import defaultdict
from sqlalchemy import select
from flask.ext.restful import abort, fields
from voluptuous import Schema, Any

from common.helpers import tables
from cycledash import db
from cycledash.validations import Doc
from workers.shared import update_tasks_table, worker
import workers.runner

from . import Resource, marshal_with, validate_with


# Private API
TaskFields = Schema({
    Doc('state', 'Current state of the task. PENDING, RUNNING, FAILED.'): basestring,
    Doc('traceback', 'Traceback in case of failure.'): Any(basestring, None),
    Doc('type', 'Task/worker name.'): basestring
})


class TaskList(Resource):
    require_auth = True
    @marshal_with(TaskFields, envelope='tasks')
    def get(self, run_id):
        with tables(db.engine, 'task_states') as (con, tasks):
            q = (select([tasks.c.task_id, tasks.c.type, tasks.c.state])
                 .where(tasks.c.vcf_id == run_id))
            return [{'type': _simplify_type(typ),
                     'state': state,
                     # pylint: disable=too-many-function-args
                     'traceback': worker.AsyncResult(task_id).traceback}
                    for task_id, typ, state in con.execute(q).fetchall()]

    @marshal_with(TaskFields, envelope='tasks')
    def delete(self, run_id):
        with tables(db.engine, 'tasks') as (con, tasks):
            q = tasks.delete(tasks.c.vcf_id == run_id).returning(*tasks.c)
            return [dict(t) for t in q.execute().fetchall()]


class TasksRestart(Resource):
    require_auth = True
    def post(self, run_id):
        restart_failed_tasks_for(run_id)
        return {'message': 'Restarting failed tasks (run_id={})'.format(run_id)}


def _simplify_type(typ):
    """Simplifies worker names, e.g. workers.gene_annotations.annotate."""
    return '.'.join(typ.split('.')[1:-1])


def restart_failed_tasks_for(vcf_id):
    with tables(db.engine, 'task_states') as (con, tasks):
        q = (tasks.delete()
             .where(tasks.c.vcf_id == vcf_id)
             .where(tasks.c.state == 'FAILURE')
             .returning(tasks.c.type))
        names = [r[0] for r in q.execute().fetchall()]
        print 'NAMES:'
        print names
        print 'NAMES ^^^'
    workers.runner.restart_failed_tasks(names, vcf_id)


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
