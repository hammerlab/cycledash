import datetime
import decimal
import json

from cycledash import db



class Run(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    variant_caller_name = db.Column(db.Text(), nullable=False)
    variant_caller_SHA1 = db.Column(db.String(40))
    submitted_at = db.Column(db.Date(), default=datetime.datetime.now())

    f1score = db.Column(db.Float(asdecimal=True))
    precision = db.Column(db.Float(asdecimal=True))
    recall = db.Column(db.Float(asdecimal=True))

    notes = db.Column(db.Text())

    vcf_path = db.Column(db.Text())
    reference_path = db.Column(db.Text())
    tumor_path = db.Column(db.Text())
    normal_path = db.Column(db.Text())
    params = db.Column(db.Text())

    def __init__(self, variant_caller_name, SHA1, f1score, precision, recall,
                 notes=None, vcf_path=None, reference_path=None, tumor_path=None,
                 normal_path=None, params=None):
        self.variant_caller_name = variant_caller_name
        self.variant_caller_SHA1 = SHA1
        self.f1score = f1score
        self.precision = precision
        self.recall = recall
        self.notes = notes
        self.vcf_path = vcf_path
        self.reference_path = reference_path
        self.tumor_path = tumor_path
        self.normal_path = normal_path
        self.params = params

    def __repr__(self):
        return '<Run id={} {} {} {} {} {}>'.format(self.id, self.variant_caller_name, self.variant_caller_SHA1,
                                             self.f1score, self.precision, self.recall)

    def json(self):
        return {col.name: jsonable(getattr(self, col.name))
                for col in self.__table__.columns}


def jsonable(val):
    if type(val) == decimal.Decimal:
        return float(val)
    if type(val) == datetime.date:
        return str(val)
    if type(val) in [int, float, str, bool] or val == None:
        return val
    raise TypeError("Unexpected Type: "+str(type(val)))
