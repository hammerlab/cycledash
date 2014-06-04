from flask import Response



def plaintext(string):
    return Response(string, mimetype='text/plain')


def json(string):
    return Response(string, mimetype='application/json')
