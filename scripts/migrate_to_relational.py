"""Module for migrating our runs table & associated VCFs to our new, shiny,
relational DB.

This is basically a one-time, throwaway script.
"""
import os
import uuid

from sqlalchemy import create_engine, MetaData
import requests
import vcf as pyvcf

import relational_vcfs as relvcf


# RUNS_DB_URI = os.environ['RUNS_DB_URI']
# REL_DB_URI = os.environ['REL_DB_URI']
# WEBHDFS_ENDPOINT = os.environ['WEBHDFS_URL'] + '/webhdfs/v1/'
# WEBHDFS_OPEN_OP = '?user.name=hodesi01&op=OPEN'
RUNS_DB_URI = 'sqlite:////Users/isaachodes/cycledash.db'
REL_DB_URI = 'postgres://isaachodes:isaachodes@localhost/cycledash'
WEBHDFS_ENDPOINT = "http://demeter.hpc.mssm.edu:14000" + '/webhdfs/v1'
WEBHDFS_OPEN_OP = '?user.name=hodesi01&op=OPEN'


def find(lst, pred):
    """Return first element in list for which pred is true."""
    filtered = [i for i in lst if pred(i)]
    if filtered:
        return filtered[0]
    else:
        return None


def uniq_on(lst, key):
    """Return a list of items unique on key function."""
    seen = set()
    results = []
    for i, k in ((i, key(i)) for i in lst):
        if k not in seen:
            results.append(i)
            seen.add(k)
    return results


def hdfs_to_vcf(hdfs_vcf_path):
    """Return a vcf.Reader, header text for the given VCF residing on HDFS."""
    url = WEBHDFS_ENDPOINT + hdfs_vcf_path + WEBHDFS_OPEN_OP
    response = requests.get(url)
    if response.status_code != 200:
        raise ValueError('VCF at "' + hdfs_vcf_path + '" cannot be retrieved.')
    text = response.text

    # Have to store VCF in a file because vcf.Reader can only read from a file.
    filename = '/tmp/' + uuid.uuid4().get_hex() + '.vcf'
    with open(filename, 'w') as fsock:
        fsock.write(text)

    header = '\n'.join(l for l in text.split('\n') if l.startswith('#'))

    return pyvcf.Reader(open(filename)), header


def migrate():
    # Our connection to the new DB we'll be inserting into:
    rel_db_engine = create_engine(REL_DB_URI)
    rel_con = rel_db_engine.connect()
    # This loads the schema of the underlying database's tables
    rel_md = MetaData(bind=rel_con)
    rel_md.reflect()
    # Tables we'll be inserting into:
    vcfs_table = rel_md.tables.get('vcfs')
    genotypes_table = rel_md.tables.get('genotypes')

    # Our connection to the old SQLite DB:
    run_db_engine = create_engine(RUNS_DB_URI)
    run_con = run_db_engine.connect()

    # This is all (modulo the concordance table, which we don't care about)
    # existing data from cycledash.
    for run in [dict(run) for run in run_con.execute("select * from run")]:
        print 'Processing run: ' + run['vcf_path']
        query = "select * from vcfs where uri = '" + run['vcf_path']  + "'"
        vcfq = rel_con.execute(query).first()
        if vcfq:
            print '- already processed, skipping...'
            continue
        print '  getting & parsing VCF from HDFS...'
        try:
            reader, header = hdfs_to_vcf(run['vcf_path'])
        except ValueError, e:
            print e
            continue
        records = list(reader)
        print '  ...got ' + str(len(records)) + ' records from HDFS, saving in CSV...'

        ## Add the run itself to runs
        vcfs_table.insert({
            'caller_name': run['variant_caller_name'],
            'dataset_name': run['dataset'],
            'normal_bam_uri': run['normal_path'],
            'tumor_bam_uri': run['tumor_path'],
            'uri': run['vcf_path'],
            'vcf_header': header
        }).execute()
        query = "select * from vcfs where uri = '" + run['vcf_path'] + "'"
        vcf_id = rel_con.execute(query).first().id

        ## Insert the actual genotypes (cf. relational_vcfs.py#insert_vcf)
        # This basically flattens/explodes all the samples in the VCF and
        # inserts them into the specified table: we make sure to set the run_id
        # with default_values.
        fn = relvcf.vcf_to_csv(records, genotypes_table, None,
                               default_values={'vcf_id': vcf_id})

        print '  inserting genotypes from ' + fn
        relvcf.insert_csv(fn, 'genotypes', rel_db_engine)
        print '  ...done.'

        ## Add the truth vcf to run, if it exists
        if run['truth_vcf_path']:
            ## stop if the truth VCF is already in here:
            query = "select * from vcfs where uri = '" + run['truth_vcf_path']  + "'"
            truth_vcf = rel_con.execute(query).first()
            if truth_vcf is None: # then we haven't already inserted it
                print 'Processing run (truth): ' + run['truth_vcf_path']
                print '  getting & parsing VCF from HDFS...'
                reader, header = hdfs_to_vcf(run['truth_vcf_path'])
                records = list(reader)
                print '  ...got ' + str(len(records)) + ' records from HDFS, saving in CSV...'

                vcfs_table.insert({
                    'caller_name': run['variant_caller_name'],
                    'dataset_name': run['dataset'],
                    'uri': run['truth_vcf_path'],
                    'vcf_header': header,
                    'validation_vcf': True
                }).execute()
                query = "select * from vcfs where uri = '" + run['truth_vcf_path'] + "'"
                truth_vcf_id = rel_con.execute(query).first().id

                ## Insert truth vcfs, if any exist for this run.
                fn = relvcf.vcf_to_csv(records, genotypes_table, None,
                                       default_values={'vcf_id': truth_vcf_id, relvcf.SAMPLE_NAME_KEY: 'truth'})

                print '  inserting validated genotypes from ' + fn
                relvcf.insert_csv(fn, 'genotypes', rel_db_engine)
                print '  ...done.'


if __name__ == '__main__':
    migrate()
