from sqlalchemy import select, desc, func

from cycledash import db
import cycledash.genotypes as genotypes

from common.helpers import tables



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
