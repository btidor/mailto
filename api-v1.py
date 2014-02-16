#!/usr/bin/env python2
#
# Webathena-Moira Post Office Box interface, a mostly-RESTful API.
#
# Background:
#
# All actions are authenticated. Every request must include a cookie (in this
# case, named "mailto-session") containing the JSON-encoded value of the
# "session" attribute returned by Webathena. Inside of this credential should
# reside a Moira ticket (moira/moira7.mit.edu@ATHENA.MIT.EDU).
#
# Endpoints:
#
# GET /<user>/poboxes
# List <user>'s post office boxes, including both current ones and disabled ones
# that we can find out about. Returns a list of dictionaries, each containing:
#  - address: the pobox represented as an email address
#  - enabled: a boolean value, true iff mail is being sent to this pobox
#
# PUT /<user>/poboxes/<address>
# Add or enable <address> as a post office box. May disable one existing pobox
# in the process. Returns the updated list of poboxes in the same format as the
# GET call.
#
# DELETE /<user>/<poboxes>/<address>
# Disable mail forwarding to <address>. Returns the updated list of poboxes in
# the same format as the GET call.
#
# GET /<user>/lastmod
# Look up the last modification of <user>'s post office box settings. Returns
# a dictionary containing three key-value pairs:
#  - modtime: the time of the last modification, in ISO 8601 format
#  - modby: the username of the person who performed the modification
#  - modwith: the tool used to modify the settings
#

import moira
import os

from bottle import get, put, delete, abort, request
from bottle_webathena import *
from datetime import datetime

APP_ROOT = os.path.abspath(os.path.dirname(__file__))

CN = "mailto-session" # name of the credentials cookie
MN = "mailto" # this application's name, for Moira modwith


@get("/<user>/poboxes")
def get_poboxes(user):
    raise NotImplementedError()

@put("/<user>/poboxes/<address>")
def put_address(user, address):
    raise NotImplementedError()

@delete("/<user>/poboxes/<address>")
def delete_address(user, address):
    raise NotImplementedError()

@get("/<user>/lastmod")
@webathena(CN)
@moira_auth(MN)
@json_api
def get_lastmod(user):
    boxinfo = moira.query("get_pobox", user)[0]
    isotime = datetime.strptime(boxinfo["modtime"], MOIRA_TIME_FORMAT) \
        .isoformat()
    return {"modtime": isotime,
            "modwith": boxinfo["modwith"],
            "modby": boxinfo["modby"]}


if __name__ == "__main__":
    import bottle
    from flup.server.fcgi import WSGIServer
    bottle.debug(True) # TODO: disable this
    app = bottle.default_app()
    WSGIServer(app).run()
