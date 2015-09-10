"""A subset of the GA4GH API for use in Cycledash."""

import os.path

from common.helpers import tables
from cycledash.helpers import abort_if_none_for
from cycledash import db
from sqlalchemy import select

import ga4gh.backend as backend
import ga4gh.datamodel.datasets as datasets
import ga4gh.datamodel.reads as reads


class DirectBamBackend(backend.AbstractBackend):
    """Barebones GA4GH backend which supports the /reads/search API."""

    def __init__(self, root_path):
        self._root_path = root_path
        super(DirectBamBackend, self).__init__()

    def readsGenerator(self, request):
        """Returns an iterator of reads which match the request criteria.

        The "readGroupIds" field of the request should be the ID of a BAM.

        The data hierarchy in the GA4GH server is

            dataset -> read group set -> read group

        A "read group" is equivalent to a BAM file. In Cycledash, we just want
        to serve BAM files, so the first two layers of the hierarchy are
        irrelevant. The GA4GH server requires them, though, so we have to
        create a fake dataset and a fake read group set to contain the read
        group.
        """
        bam_id = int(request.readGroupIds[0])
        bam = None
        with tables(db.engine, 'bams') as (con, bams):
            q = select(bams.c).where(bams.c.id == bam_id)
            bam = dict(abort_if_none_for('bam')(q.execute().fetchone(), bam_id))

        bam_path = self._root_path + bam['uri']

        # The strings are meaningless dummy values. They could be anything.
        dataset = datasets.AbstractDataset('dataset1')
        local_id = 'readGroupSetId'

        read_group_set = reads.AbstractReadGroupSet(dataset, local_id)

        # TODO: cache read_group? It might be re-reading the index on every request.
        read_group = reads.HtslibReadGroup(read_group_set, local_id, bam_path)

        read_group_set.addReadGroup(read_group)
        dataset.addReadGroupSet(read_group_set)

        return backend.ReadsIntervalIterator(request, read_group)
