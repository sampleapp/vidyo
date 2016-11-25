#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import base64
import binascii
from datetime import datetime, timezone
import hashlib
import hmac
import sys
import getopt

def read_file(path):
    try:
        f = open(path, "r+b")
        return f.read()
    except e:
        print("Could not read file: %s error %s  ", path, e)
        exit(3)

def to_bytes(o):
    return str(o).encode("utf-8")

class Token:
    def __init__(self, key, appID, userName, vCardFile, expires):
        self.type    = 'provision'
        self.key     = key
        self.jid     = userName + "@" + appID
        if (vCardFile):
            self.vCard   = read_file(vCardFile).decode("utf-8").strip()
        else:
            self.vCard   = ""
        self.expires = expires

    def __str__(self):
        return "Token" + {'type'    : self.type,
                          'key'     : self.key,
                          'jid'     : self.jid,
                          'vCard'   : self.vCard[:10] + "...",
                          'expires' : self.expires}.__str__()

    def serialize(self):
        sep = b"\0" # Separator is a NULL character
        body = to_bytes(self.type) + sep + to_bytes(self.jid) + sep + to_bytes(self.expires) + sep + to_bytes(self.vCard)
        mac = hmac.new(bytearray(self.key, 'utf8'), msg=body, digestmod=hashlib.sha384).digest()
        ## Uncomment to debug
        ##sys.stderr.buffer.write( b"key : " + base64.b64encode(bytearray(self.key, 'utf8')) + b"\n" )print("bodyFull: " + self.type + "_" + self.jid + "_" + str(self.expires) + "_" + self.vCard);
        ##sys.stderr.buffer.write(b"bodyString: " + ("%s_%s_%s_%s" % (self.type, self.jid, str(self.expires), self.vCard)).encode("utf-8") + b"\n");
        ##sys.stderr.buffer.write( b"body: " + ("%s" % [b for b in body]).encode("utf-8") + b"\n" )
        ##sys.stderr.buffer.write( b"mac : " + base64.b64encode(mac) + b"\n" )
        ##sys.stderr.flush()
        ## Combine the body with the hex version of the mac
        serialized = body + sep + binascii.hexlify(mac)
        return serialized

def printHelp():
    print("\nThis script will generate a provision login token from a developer key"
      "\nOptions:"
      "\n\t--key           Developer key supplied with the developer account"
      "\n\t--appID         ApplicationID supplied with the developer account"
      "\n\t--userName      Username to generate a token for"
      "\n\t--vCardFile     Path to the XML file containing a vCard for the user"
      "\n\t--expiresInSecs Number of seconds the token will be valid can be used instead of expiresAt"
      "\n\t--expiresAt     Time at which the token will expire ex: (2055-10-27T10:54:22Z) can be used instead of expiresInSecs"
      "\n")

try:
  opts, args = getopt.getopt(sys.argv[1:], 'h', ['h', 'key=', 'appID=', 'userName=', 'vCardFile=', 'expiresInSecs=', 'expiresAt='])
except getopt.GetoptError:
    printHelp()
    sys.exit(2)

EPOCH_SECONDS = 62167219200
key           = None
appID         = None
userName      = None
vCardFile     = None
expiresInSecs = None
expiresAt     = None
expires       = 0

for o, a in opts:
    if ((o == '-h') or (o == "--h")):
        printHelp()
        sys.exit(2)
    if (o == "--key"):
        #print("Setting key           : ", a)
        key = a
    if (o == "--appID"):
        #print("Setting appID         : ", a)
        appID = a
    if (o == "--userName"):
        #print("Setting userName      : ", a)
        userName = a
    if (o == "--vCardFile"):
        #print("Setting vCardFile     : ", a)
        vCardFile = a
    if (o == "--expiresInSecs"):
        #print("Setting expiresInSecs : ", a)
        expiresInSecs = a
    if (o == "--expiresAt"):
        #print("Setting expiresAt     : ", a)
        expiresAt = a

if (key == None):
    print("key not set")
    printHelp()
    sys.exit(2)
if (appID == None):
    print("appID not set")
    printHelp()
    sys.exit(2)
if (userName == None):
    print("userName not set")
    printHelp()
    sys.exit(2)
if (vCardFile == None):
    #print("vCardFile not set")
    pass
    
## datetime.timestamp() by default subtracts datetime(1970, 1, 1) from the datetime
## on which we call it, therefore the number of seconds is smaller
## by (pseudocode!) seconds("1970-01-01").
## In Erlang, on the other hand, we get the actual number of seconds,
## hence we adjust for this difference here.
## IMPORTANT! A 64bit architecture is assumed! Otherwise, the timestamp
## might be stored as a 32bit integer, therefore limiting the "capacity"
## to 2038 (see https://en.wikipedia.org/wiki/Year_2038_problem).
if (expiresInSecs != None):
    expires = EPOCH_SECONDS + int(datetime.now().timestamp()) + int(expiresInSecs)
elif (expiresAt != None):
    expires = EPOCH_SECONDS + int((datetime.strptime(expiresAt, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)).timestamp())
else:
    print("expiresInSecs or expiresAt not set")
    printHelp()
    sys.exit(2)

#print("Generating Token...")
token = Token(key, appID, userName, vCardFile, expires)
serialized = token.serialize()
sys.stdout.buffer.write( base64.b64encode ( serialized ) )
print("")
