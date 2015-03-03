#!/usr/bin/env python
"""Convert coverage.xml data to LCOV data.

Usage:
    xml_to_lcov.py path/to/coverage.xml > path/to/coverage.lcov
"""

import json
import sys
from bs4 import BeautifulSoup

def read_coverage_xml(path):
    """Read coverage.xml data into a Dict."""
    soup = BeautifulSoup(open(path))
    files = soup.select('class')
    path_to_cov = {}

    for classTag in files:
        path = classTag['filename']
        lines = classTag.select('lines line')
        path_to_cov[path] = [
                {'hits': line['hits'], 'number': line['number']} for line in lines]
    
    return path_to_cov


def write_lcov(coverage_data):
    """Write out LCOV data based on a coverage Dict."""
    for path, coverage in coverage_data.iteritems():
        line_hits = [(int(line['number']), int(line['hits'])) for line in coverage]
        line_hits.sort()
        print 'SF:%s' % path
        for line, hit in line_hits:
            print 'DA:%d,%d' % (line, hit)
        print 'end_of_record'


if __name__ == '__main__':
    write_lcov(read_coverage_xml(sys.argv[1]))
