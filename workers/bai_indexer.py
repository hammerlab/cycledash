"""Index BAM Index (BAI) files

This accepts a BAM HDFS path. If there's no BAM Index Index (.bam.bai.json)
file already available, it will generate one and put it on HDFS.
"""

import requests
import bai_indexer
from StringIO import StringIO

from workers.shared import getContentsFromHdfs, worker

@worker.task
def index(hdfs_bam_path):
    if '.bam' not in hdfs_bam_path:
        raise ValueError('Expected path to BAM file, got %s' % hdfs_bam_path)

    bai_path = hdfs_bam_path.replace('.bam', '.bam.bai')
    contents = getContentsFromHdfs(bai_path)

    index_json = bai_indexer.index_stream(StringIO(contents))
