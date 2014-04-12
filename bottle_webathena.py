"""Utility functions for writing Webathena-based APIs in Bottle"""

import base64
import ccaches
import json
import moira
import os
import tempfile

from bottle import request

MOIRA_TIME_FORMAT = "%d-%b-%Y %H:%M:%S"

def webathena(function):
    """
    A decorator that loads a Kerberos ticket from the base64 encoded "webathena"
    url paramater and stores it in a ccache for the duration of request
    processing. This allows programs and libraries such as python-moira to
    autheticate.

    Selected code borrowed from davidben's shellinabox example in the Webathena
    source tree. https://github.com/davidben/webathena.
    """
    def wrapped(*args, **kwargs):
        # Extract credential from request
        ticket_data = request.query["webathena"]
        if not ticket_data:
            raise KeyError("Missing Webathena ticket!")
        credential = json.loads(base64.b64decode(ticket_data))

        with tempfile.NamedTemporaryFile(prefix="webathena_ccache_") as ccache:
            # Write credentials to a temporary krb5 ccache
            ccache.write(ccaches.make_ccache(credential))
            ccache.flush()
            os.environ["KRB5CCNAME"] = ccache.name

                # Run the inner function while in the with..as; return
            return function(*args, **kwargs)
    return wrapped

def moira_auth(client_name):
    """
    A decorator that opens an authenticated Moira session before the wrapped
    function is executed. Goes well with @webathena, above.
    """
    def wrapper(function):
        def wrapped(*args, **kwargs):
            moira.connect()
            moira.auth(client_name)
            return function(*args, **kwargs)
        return wrapped
    return wrapper

def json_api(function):
    """
    A decorator that automatically JSON-encodes output.
    """
    def wrapped(*args, **kwargs):
        result = function(*args, **kwargs)
        return json.dumps(result)
    return wrapped
