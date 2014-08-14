import os
import sys
import argparse

import vcf

'''
Submission evaluation code for TCGA/ICGC/DREAM SMC
Adam Ewing, ewingad@soe.ucsc.edu
Requires PyVCF (https://github.com/jamescasbon/PyVCF)
'''

# (Edited slightly for inclusion in this repository.)



def match(subrec, trurec, vtype='SNV'):
    assert vtype in ('SNV', 'SV', 'INDEL')

    if vtype == 'SNV' and subrec.is_snp and trurec.is_snp:
        if subrec.POS == trurec.POS and subrec.REF == trurec.REF and subrec.ALT == trurec.ALT:
            return True

    if vtype == 'INDEL' and subrec.is_indel and trurec.is_indel:
        if subrec.POS == trurec.POS and subrec.REF == trurec.REF and subrec.ALT == trurec.ALT:
            return True

    if vtype == 'SV' and subrec.is_sv and trurec.is_sv:
        trustart, truend = expand_sv_ends(trurec)
        substart, subend = expand_sv_ends(subrec)

        # check for overlap
        if min(truend, subend) - max(trustart, substart) > 0:
            return True

    return False


def expand_sv_ends(rec):
    ''' assign start and end positions to SV calls using conf. intervals if present '''
    startpos, endpos = rec.start, rec.end
    assert rec.is_sv

    try:
        endpos = int(rec.INFO.get('END')[0])

        if rec.INFO.get('CIPOS'):
            ci = map(int, rec.INFO.get('CIPOS'))
            if ci[0] < 0:
                startpos += ci[0]

        if rec.INFO.get('CIEND'):
            ci = map(int, rec.INFO.get('CIEND'))
            if ci[0] > 0:
                endpos += ci[0]

    except TypeError as e:
        sys.stderr.write("error expanding sv interval: " + str(e) + " for record: " + str(rec) + "\n")

    if startpos > endpos:
        endpos, startpos = startpos, endpos

    return startpos, endpos


def relevant(rec, vtype, ignorechroms):
    ''' Return true if a record matches the type of variant being investigated '''
    rel = (rec.is_snp and vtype == 'SNV') or (rec.is_sv and vtype == 'SV') or (rec.is_indel and vtype == 'INDEL')
    return rel and (ignorechroms is None or rec.CHROM not in ignorechroms)


def passfilter(rec, disabled=False):
    ''' Return true if a record is unfiltered or has 'PASS' in the filter field
(pyvcf sets FILTER to None)'''
    if disabled:
        return True
    if rec.FILTER is None or rec.FILTER == '.' or not rec.FILTER:
        return True
    return False


def svmask(rec, vcfh, truchroms):
    ''' mask snv calls in sv regions '''
    if rec.is_snp and rec.CHROM in truchroms:
        for overlap_rec in vcfh.fetch(rec.CHROM, rec.POS-1, rec.POS):
            if overlap_rec.is_sv:
                    return True
    return False


def evaluate(submission_path, truth_path, vtype='SNV', ignorechroms=None,
             ignorepass=False, printfp=False):
    ''' Return stats on sensitivity, specificity, balanced accuracy. '''

    assert vtype in ('SNV', 'SV', 'INDEL')
    subvcfh = vcf.Reader(open(submission_path))
    truvcfh = vcf.Reader(open(truth_path))

    tpcount = 0
    fpcount = 0
    subrecs = 0
    trurecs = 0

    truchroms = {}

    ''' count records in truth vcf, track contigs/chromosomes '''
    for trurec in truvcfh:
        if relevant(trurec, vtype, ignorechroms):
            trurecs += 1
            truchroms[trurec.CHROM] = True

    # Keep track of 'truth' sites used, they should only be usable once.
    used_truth = {}

    ''' parse submission vcf, compare to truth '''
    for subrec in subvcfh:
        if passfilter(subrec, disabled=ignorepass):
            if subrec.is_snp and vtype == 'SNV':
                if not svmask(subrec, truvcfh, truchroms):
                    subrecs += 1
            if subrec.is_sv and vtype == 'SV':
                subrecs += 1
            if subrec.is_indel and vtype == 'INDEL':
                subrecs += 1

        matched = False

        startpos, endpos = subrec.start, subrec.end

        if vtype == 'SV' and subrec.is_sv:
            startpos, endpos = expand_sv_ends(subrec)
        try:
            if relevant(subrec, vtype, ignorechroms) and passfilter(subrec, disabled=ignorepass) and subrec.CHROM in truchroms:
                for trurec in truvcfh.fetch(subrec.CHROM, startpos, end=endpos):
                    if match(subrec, trurec, vtype=vtype) and str(trurec) not in used_truth:
                        matched = True
                        used_truth[str(trurec)] = True

        except ValueError as e:
            sys.stderr.write("Warning: " + str(e) + "\n")

        if matched:
            tpcount += 1
        else:
            if relevant(subrec, vtype, ignorechroms) and passfilter(subrec, disabled=ignorepass) and not svmask(subrec, truvcfh, truchroms):
                fpcount += 1 # FP counting method needs to change for real tumors
                if printfp:
                    print "FP:", subrec

    recall    = float(tpcount) / float(trurecs)
    precision = float(tpcount) / float(tpcount + fpcount)
    fdr       = 1.0 - float(fpcount) / float(subrecs)
    f1score   = 0.0 if tpcount == 0 else 2.0*(precision*recall)/(precision+recall)

    return {'precision': precision, 'recall': recall, 'f1score': f1score,
            'truePositive': tpcount, 'falsePositive': fpcount}
