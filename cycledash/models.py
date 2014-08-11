import datetime
import decimal
import json

from cycledash import db



class Run(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    variant_caller_name = db.Column(db.Text(), nullable=False)
    SHA1 = db.Column(db.String(40))
    submitted_at = db.Column(db.DateTime(), default=datetime.datetime.now)

    f1score = db.Column(db.Float(asdecimal=True))
    precision = db.Column(db.Float(asdecimal=True))
    recall = db.Column(db.Float(asdecimal=True))
    true_positive = db.Column(db.Integer())
    false_positive = db.Column(db.Integer())

    notes = db.Column(db.Text())

    vcf_path = db.Column(db.Text())
    truth_vcf_path = db.Column(db.Text())

    reference_path = db.Column(db.Text())
    dataset = db.Column(db.Text())
    tumor_path = db.Column(db.Text())
    normal_path = db.Column(db.Text())

    params = db.Column(db.Text())

    def __init__(self, variant_caller_name=None, sha1=None, f1score=None,
                 precision=None, recall=None, notes=None, vcf_path=None,
                 truth_vcf_path=None, reference_path=None, tumor_path=None,
                 normal_path=None, params=None, dataset=None):
        self.variant_caller_name = variant_caller_name
        self.SHA1 = sha1
        self.f1score = f1score
        self.precision = precision
        self.recall = recall
        self.notes = notes
        self.vcf_path = vcf_path
        self.truth_vcf_path = truth_vcf_path
        self.reference_path = reference_path
        self.tumor_path = tumor_path
        self.normal_path = normal_path
        self.params = params
        self.dataset = dataset

    def __repr__(self):
        return '<Run id={} {} {} {} {} {} {}>'.format(self.id,
                                                      self.variant_caller_name,
                                                      self.SHA1,
                                                      self.dataset,
                                                      self.f1score,
                                                      self.precision,
                                                      self.recall)

    def to_camel_dict(self):
        return {camelcase(col.name): jsonnit(getattr(self, col.name))
                for col in self.__table__.columns}


class Concordance(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    # comma-separated, numerically sorted list of Run IDs.
    run_ids_key = db.Column(db.Text(), unique=True, nullable=False)

    # JSON blob of concordance data.
    concordance_json = db.Column(db.Text())

    # FSM: pending -> complete | failed
    # Used to see if the concordance background processing has started or
    # completed (or failed).
    state = db.Column(db.Text(), default="pending")

    def __init__(self, run_ids_key=None, concordance_json=None):
        self.run_ids_key = run_ids_key
        self.concordance_json = concordance_json

    def __repr__(self):
        return '<Concordance id={} runs={}>'.format(self.id, self.run_ids_key)

    def to_camel_dict(self):
        return {camelcase(col.name): jsonnit(getattr(self, col.name))
                for col in self.__table__.columns}


def camelcase(string):
    return ''.join([c.upper() if p == '_' else c
                    for p, c in zip(' '+string, string) if c != '_'])

def jsonnit(val):
    if type(val) == decimal.Decimal:
        return float(val)
    if type(val) in [datetime.date, datetime.datetime]:
        return str(val)
    if type(val) in [int, float, str, bool, unicode] or val == None:
        return val
    raise TypeError("Unexpected Type: "+str(type(val)))
