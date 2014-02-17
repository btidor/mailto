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
import re
import socket
import telnetlib

from bottle import get, put, delete, abort, request
from bottle_webathena import *
from datetime import datetime

APP_ROOT = os.path.abspath(os.path.dirname(__file__))

CN = "mailto-session" # name of the credentials cookie
MN = "mailto" # this application's name, for Moira modwith


def moira_get_poboxes(user):
    """Return the poboxes for a given user as a list of strings."""
    try:
        boxinfo = moira.query("get_pobox", user)[0]
    except moira.MoiraException as e:
        if len(e.args) >= 2 and e[1].lower() == 'no such user':
            abort(404, e[1])
        raise e
    return boxinfo["address"].split(", ")


@get("/<user>/poboxes")
@webathena(CN)
@moira_auth(MN)
@json_api
def get_poboxes(user):
    # Search Moira
    moira_addresses = moira_get_poboxes(user)
    exchange = []
    imap = []
    external = []
    for address in moira_addresses:
        # Categorize as Exchange, IMAP or External
        if re.search("@EXCHANGE.MIT.EDU$", address, re.IGNORECASE):
            exchange.append(address)
        elif re.search("@PO\d+.MIT.EDU$", address, re.IGNORECASE):
            imap.append(address)
        else:
            external.append(address)

    # After checking Moira, we're now looking for accounts that aren't active
    # but that users might want to re-enable, for example a defunct Exchange
    # inbox.

    # Check DNS for $user.mail.mit.edu. For users who have ever had an IMAP
    # account, this should point to a PO## server; exchange-only users are
    # pointed at IMAP.EXCHANGE.MIT.EDU.
    dynamichost = socket.getfqdn("%s.mail.mit.edu" % user)
    m = re.search("^IMAP.EXCHANGE.MIT.EDU$", dynamichost, re.IGNORECASE)
    if not exchange and m:
        exchange.append("%s@EXCHANGE.MIT.EDU" % user)
    m = re.search("^PO(\d+).MAIL.MIT.EDU$", dynamichost, re.IGNORECASE)
    if not imap and m:
        imap.append("%s@PO%s.MIT.EDU" % (user, m.group(1)))

    # If the user shows no indication of having an Exchange account, there's one
    # more test we can run: go to the mail servers and ask.
    if not exchange:
        tn = telnetlib.Telnet("mailsec-scanner-2.mit.edu", 25)
        tn.write("EHLO mailto.mit.edu\r\n")
        tn.write("MAIL FROM:<mailto@mit.edu>\r\n")
        tn.read_very_eager()
        tn.write("RCPT TO:<%s@exchange.mit.edu>\r\n" % user)
        if "accepted" in tn.read_very_eager():
            # Success: "250 2.0.0 RCPT TO accepted\r\n"
            # Failure: "550 5.1.1 Recipient address rejected: User unknown\r\n"
            exchange.append("%@EXCHANGE.MIT.EDU" % user)
        tn.write("RSET\r\nQUIT\r\n")
        tn.close()

    all_addresses = exchange + imap + external
    return [(a, (a in moira_addresses)) for a in all_addresses]

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
    try:
        boxinfo = moira.query("get_pobox", user)[0]
    except moira.MoiraException as e:
        if len(e.args) >= 2 and e[1].lower() == 'no such user':
            abort(404, e[1])
        raise e
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
