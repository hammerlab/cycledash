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

    notes = db.Column(db.Text())

    vcf_path = db.Column(db.Text())
    reference_path = db.Column(db.Text())
    dataset = db.Column(db.Text())
    tumor_path = db.Column(db.Text())
    normal_path = db.Column(db.Text())
    params = db.Column(db.Text())

    def __init__(self, variant_caller_name, SHA1, f1score, precision, recall,
                 notes=None, vcf_path=None, reference_path=None,
                 tumor_path=None, normal_path=None, params=None, dataset=None):
        self.variant_caller_name = variant_caller_name
        self.SHA1 = SHA1
        self.f1score = f1score
        self.precision = precision
        self.recall = recall
        self.notes = notes
        self.vcf_path = vcf_path
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
