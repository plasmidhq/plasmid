import argparse
import json
import logging
import sys
import time
from os.path import abspath, join, dirname

from zope.interface import implements

from twisted.internet import reactor
from twisted.web.server import Site
from twisted.web.resource import Resource, IResource
from twisted.web.static import File
from twisted.cred.portal import IRealm, Portal
from twisted.cred import error

from plasmid.util import endpoint
from plasmid.storage import Hub, Storage
from plasmid.cred import APIAuthSessionWrapper, PlasmidCredChecker, PlasmidRealm
from plasmid.cred import CredentialBackend
from plasmid.service import Plasmid, ServiceRoot


logging.basicConfig(level=logging.INFO)


def main(argv):
    parser = argparse.ArgumentParser()

    parser.add_argument('-c', nargs='?')
    parser.add_argument('--set-secret', dest='set_secret', nargs=2)
    parser.add_argument('--check-permission', dest='check_permission', nargs=3)
    parser.add_argument('--grant-permission', dest='grant_permission', nargs=3)
    parser.add_argument('--revoke-permission', dest='revoke_permission', nargs=3)
    parser.add_argument('-p', '--hub-path', dest='hub_path', default='hub')
    ns = parser.parse_args(argv)

    hub = Hub(ns.hub_path)
    credbackend = CredentialBackend(hub)


    if ns.set_secret:
        access, secret = ns.set_secret
        hub_db = hub.get_hub_database()
        hub_db.set_meta('access_' + access, secret)
    elif ns.check_permission:
        access, permission, resource = ns.check_permission
        credbackend = CredentialBackend(hub)
        print access, permission, resource, credbackend.get_permission(access, permission, resource)
    elif ns.grant_permission:
        access, permission, resource = ns.grant_permission
        credbackend = CredentialBackend(hub)
        credbackend.set_permission(access, permission, resource, "Yes")
    elif ns.revoke_permission:
        access, permission, resource = ns.revoke_permission
        credbackend = CredentialBackend(hub)
        credbackend.set_permission(access, permission, resource, "No")
    else:
        portal = Portal(PlasmidRealm(hub, Plasmid), [PlasmidCredChecker(hub)])
        resource = ServiceRoot(portal, hub)
        factory = Site(resource)

        reactor.listenTCP(8880, factory)
        reactor.run()

main(sys.argv)
