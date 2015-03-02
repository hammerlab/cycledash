import nose

import StringIO

import vcf, csv
from common.relational_vcf import vcf_to_csv, genotypes_to_records


def test_vcf_to_csv():
    vcfreader = vcf.Reader(open('tests/data/snv.vcf'))
    columns = ['contig', 'position', 'sample:DP', 'info:VAF', 'info:DP', 'something']
    filename = vcf_to_csv(vcfreader, columns, None,
                          default_values={'something': 'Something!'})

    with open(filename) as f:
        rows = list(csv.reader(f))

    # first two are from the same sample
    assert rows[0] == ['20', '61795', '44', '', '81', 'Something!']
    assert rows[1] == ['20', '61795', '37', '', '81', 'Something!']
    # this is the last sample
    assert rows[-1] == ['20', '75254', '40', '', '74', 'Something!']
    assert len(rows) == 20  # 10 records, 2 samples each = 20 rows


def test_csv_to_vcf():
    # Here we just write the VCF to a CSV like we did above, and then read it
    # and compare it to the original VCF to make sure we haven't lost any data
    # in the conversation.
    vcfreader = vcf.Reader(open('tests/data/one-sample.vcf'))
    columns = ['contig', 'position', 'id', 'reference', 'alternates',
               'quality', 'filters', 'info:DP', 'info:SS',
               'info:SSC', 'info:GPV', 'info:SPV', 'info:SOMATIC',
               'sample:GT','sample:GQ','sample:DP','sample:RD',
               'sample:AD','sample:FREQ','sample:DP4',
               'sample_name']
    filename = vcf_to_csv(vcfreader, columns, None)

    # Now we convert the rows in this CSV into dict (converting the position as
    # well), which is what it would look like select from Postgres.
    with open(filename) as f:
        rows = list(csv.reader(f))
        relations = []
        for row in rows:
            relation = {
                col: val if val != '' else None
                for col, val in zip(columns, row)
            }
            relation['position'] = int(relation['position'])
            relations.append(relation)

    text = open('tests/data/one-sample.vcf').readlines()
    header = (line for line in text if line.startswith('#'))
    template = vcf.Reader(header)

    # Here we convert those dicts to vcf.Records, for later writing.
    records = genotypes_to_records(relations, template, columns)

    # Now we write the output of those to a string buffer...
    vcf_sb = StringIO.StringIO()
    writer = vcf.Writer(vcf_sb, template)
    for record in records:
        writer.write_record(record)

    # And see if we get the same VCF.
    #
    # We can't just e.g. test that the text of
    # both files is equal, as pyVCF will e.g. emit header lines in different
    # orders, or e.g. include fields in the INFO field which may be blank and
    # thus omitted in the original VCF. Scientific notation, for example, also
    # can change, e.g.  1.05 can become 0.105e-1.
    #
    # So, instead, we test that the same number of records, exists, that they
    # all have the correct CHROM, POS, REF, ALT and select sample and info
    # fields.
    original_vcf = list(vcf.Reader(open('tests/data/one-sample.vcf')))
    vcf_sb.seek(0)
    saved_vcf = list(vcf.Reader(vcf_sb))
    for o, s in zip(original_vcf, saved_vcf):
        assert o.CHROM == s.CHROM
        assert o.POS == s.POS
        assert o.REF == s.REF
        assert o.ALT == s.ALT
        assert o.samples[0].data.DP == s.samples[0].data.DP
        assert o.samples[0].data.GT == s.samples[0].data.GT
        assert o.samples[0].data.DP4 == s.samples[0].data.DP4
        assert o.INFO['DP'] == s.INFO['DP']
        assert o.INFO['SS'] == s.INFO['SS']

