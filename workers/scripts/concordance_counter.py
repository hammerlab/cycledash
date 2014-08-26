# coding: utf-8
"""Script to compare VCF files to each other and return concordance data.
"""
import collections

import vcf


# In PyVCF, a [] for FILTER means the filter was PASS.
# c.f. https://github.com/jamescasbon/PyVCF/issues/153
PASS = []


### Utility ###

def _open_vcfs(vcfs):
    return {name: vcf.Reader(open(filename))
            for name, filename in vcfs.iteritems()}

### VCF-specific ###

def _record_key(record):
    return (record.CHROM + "-" + str(record.POS) + ':' +
            record.REF + "->" + str(record.ALT))


def _variants_to_caller_mapper(vcfname_to_records_dict):
    """Return a mapping from passing variants (identified by CHROM-POS) in the
    provided VCFs to a set of the names of the VCFs in which the variants were
    called.

    e.g. {'2-5712387': {'mutect', 'varscan'}, ...}

    vcf_dct -- mapping of VCF names to vcf.Reader instances of the VCF,
               from _open_vcfs (e.g. {'vcfname': vcf.Reader, ...}).
    """
    mapping = collections.defaultdict(set)
    for vcf_name, records in vcfname_to_records_dict.iteritems():
        for record in records:
            mapping[_record_key(record)].add(vcf_name)
    return mapping


def _vcf_to_concordance(variants_to_vcfs_dict):
    """Return a mapping from each VCF caller to a mapping of the number of
    VCFs in concordance to the number of calls they concord on.
    """
    concordance_counts = collections.defaultdict(lambda: collections.defaultdict(int))
    for vcfs in variants_to_vcfs_dict.itervalues():
        for vcf in vcfs:
            concordance_counts[vcf][len(vcfs)] += 1
    return concordance_counts


def concordance(vcfs):
    """Return map of concordances.

    c.f. vcf_to_concordance

    vcfs -- {vcf_name: vcf_filename ... } mapping of VCFs to be examined
    """
    vcf_readers = _open_vcfs(vcfs)

    passing_records = {}  # Look at only calls that PASS the filters.
    for vcf, records in vcf_readers.iteritems():
        # Important to reify the generator, as we'll be reusing it.
        passing_records[vcf] = [r for r in records
                                if r.FILTER == PASS or not r.FILTER]

    variants_to_callers = _variants_to_caller_mapper(passing_records)
    concordance_counts  = _vcf_to_concordance(variants_to_callers)

    return concordance_counts
