"""Index BAM Index (BAI) files

This accepts a BAM HDFS path. If there's no BAM Index Index (.bam.bai.json)
file already available, it will generate one and put it on HDFS.
"""

import json
import sys
import bai_indexer
from StringIO import StringIO

from workers.shared import (getContentsFromHdfs, worker, putNewFileToHdfs,
                            doesHdfsFileExist, HdfsFileAlreadyExistsError)

@worker.task
def index(hdfs_bam_path):
    if '.bam' not in hdfs_bam_path:
        raise ValueError('Expected path to BAM file, got %s' % hdfs_bam_path)

    bai_path = hdfs_bam_path.replace('.bam', '.bam.bai')
    bai_json_path = hdfs_bam_path.replace('.bam', '.bam.bai.json')
    sys.stderr.write('Indexing %s --> %s\n' % (bai_path, bai_json_path))

    if doesHdfsFileExist(bai_json_path):
        sys.stderr.write('Nothing to do, %s already exists\n' % bai_json_path)
        return  # nothing to do -- it's already been created

    contents = getContentsFromHdfs(bai_path)
    sys.stderr.write('Read %d bytes from %s\n' % (len(contents), bai_path))
    index_json = bai_indexer.index_stream(StringIO(contents))
    index_json_str = json.dumps(index_json)
    sys.stderr.write('Generated index: %s\n' % index_json_str)

    try:
        putNewFileToHdfs(bai_json_path, index_json)
        sys.stderr.write('Wrote BAI.json!\n')
    except HdfsFileAlreadyExistsError:
        sys.stderr.write('Lost a race\n')
        pass  # we lost the race!
