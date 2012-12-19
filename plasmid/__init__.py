import argparse
import json
import sys
import time
from os.path import abspath, join, dirname

from zope.interface import implements

from twisted.internet import reactor
from twisted.web.server import Site
from twisted.web.resource import Resource, IResource
from twisted.web.static import File
from twisted.cred.portal import IRealm, Portal

from plasmid.util import endpoint
from plasmid.storage import Hub, Storage
from plasmid.cred import APIAuthSessionWrapper, PlasmidCredChecker, PlasmidRealm
from plasmid.cred import CredentialBackend


hub = Hub('hub')
credbackend = CredentialBackend(hub)


class ServiceRoot(Resource):

    def getChild(self, name, request):
        if name == 'static':
            return File(static_path)
        elif name == 'api':
            return APIAuthSessionWrapper(portal, [PlasmidCredChecker(hub)])
        else:
            "nothing here"


class Plasmid(Resource):

    def __init__(self, avatarId):
        Resource.__init__(self)
        self.databases = {}
        self.avatarId = avatarId

    def getChild(self, name, request):
        if name:
            try:
                return self.databases[name]
            except KeyError:
                s = Storage(hub, name)
                self.databases[name] = db = Database(self.avatarId, name, s)
                return db
        else:
            return StringResource(json.dumps({
                "databases": self.databases.keys(),
            }))


class Database(Resource):

    def __init__(self, access, name, storage):
        Resource.__init__(self)
        self.access = access
        self.name = name
        self.storage = storage
        if credbackend.get_permission(self.access, 'ReadDatabase', self.name):
            self.can_read = True
        else:
            self.can_read = False

    @property
    def iteration(self):
        if self.can_read:
            return self.storage.get_meta('iteration')

    @endpoint
    def render_GET(self, request):
        if self.can_read:
            return {
                "name": self.name,
                "iteration": self.iteration,
            }

    def getChild(self, name, request):
        return DatabaseMethod(self, name)

    @endpoint
    def get_clone(self, request):
        if self.can_read:
            data = self.storage.get_data()
            return {
                "data": data,
                "iteration": self.iteration,
            }

    @endpoint
    def get_update(self, request, last_revision):
        if self.can_read:
            last_revision = int(last_revision)
            updates = []
            data = self.storage.get_data(revision=last_revision)
            for store in data:
                for k, (i, v) in data[store].items():
                    updates.append((store, i, k, v))
            print 'UPDATES', updates
            return {
                "since": last_revision,
                "until": self.iteration,
                "updates": updates,
            }

    @endpoint
    def post_update(self, request, x):
        if credbackend.get_permission(self.access, 'WriteDatabase', self.name):
            body = json.load(request.content)
            last_revision = body['last_revision']
            data = body['data']

            assert self.iteration

            if self.iteration > last_revision:
                return {
                    'error': "Cannot update. Master has changed. %s > %s" % (self.iteration, last_revision),
                    'saved': 0,
                    'reason': 'outofdate',
                }

            else:
                self.storage.set_data(data)
                return json.dumps({'saved': len(data)})


class DatabaseMethod(Resource):

    def __init__(self, database, name, args=None):
        Resource.__init__(self)
        self.database = database
        self.name = name
        self.args = args or []

    def getChild(self, name, request):
        return DatabaseMethod(self.database, self.name, self.args + [name])

    def render_GET(self, request):
        method = getattr(self.database, 'get_' + self.name)
        return method(request, *self.args)

    def render_POST(self, request):
        method = getattr(self.database, 'post_' + self.name)
        return method(request, *self.args)


class StringResource(Resource):
    def __init__(self, s):
        Resource.__init__(self)
        self.s = s
    def render_GET(self, request):
        return self.s

portal = Portal(PlasmidRealm(Plasmid), [PlasmidCredChecker(hub)])

resource = ServiceRoot()
static_path = abspath(join(dirname(__file__), '..', 'static'))
factory = Site(resource)

def main(argv):
    parser = argparse.ArgumentParser()

    parser.add_argument('-c', nargs='?')
    parser.add_argument('--set-secret', dest='set_secret', nargs=2)
    parser.add_argument('--check-permission', dest='check_permission', nargs=3)
    parser.add_argument('--grant-permission', dest='grant_permission', nargs=3)
    parser.add_argument('--revoke-permission', dest='revoke_permission', nargs=3)
    ns = parser.parse_args(argv)

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
        reactor.listenTCP(8880, factory)
        reactor.run()

main(sys.argv)
