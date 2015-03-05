"""Index BAM Index (BAI) files

This accepts a BAM HDFS path. If there's no BAM Index Index (.bam.bai.json)
file already available, it will generate one and put it on HDFS.
"""

import json

import bai_indexer
from StringIO import StringIO

from workers.shared import (get_contents_from_hdfs, worker, put_new_file_to_hdfs,
                            does_hdfs_file_exist, HdfsFileAlreadyExistsError,
                            register_running_task)

@worker.task(bind=True)
def index(self, vcf_id, hdfs_bam_path):
    register_running_task(self, vcf_id)
    if '.bam' not in hdfs_bam_path:
        raise ValueError('Expected path to BAM file, got %s' % hdfs_bam_path)

    bai_path = hdfs_bam_path.replace('.bam', '.bam.bai')
    bai_json_path = hdfs_bam_path.replace('.bam', '.bam.bai.json')

    if does_hdfs_file_exist(bai_json_path):
        return  # nothing to do -- it's already been created

    contents = get_contents_from_hdfs(bai_path)
    index_json = bai_indexer.index_stream(StringIO(contents))
    index_json_str = json.dumps(index_json)

    try:
        put_new_file_to_hdfs(bai_json_path, index_json_str)
    except HdfsFileAlreadyExistsError:
        pass  # we lost the race! (e.g. two runs were submitted simultaneously)
