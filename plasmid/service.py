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

from plasmid.util import endpoint, StringResource, random_token
from plasmid.storage import Hub, Storage, QuotaExceeded
from plasmid.cred import APIAuthSessionWrapper, PlasmidCredChecker, PlasmidRealm
from plasmid.cred import CredentialBackend


static_path = abspath(join(dirname(__file__), '..', 'static'))


class ServiceRoot(Resource):
    """Serves up static resources and authorized API handlers."""

    def __init__(self, hub):
        Resource.__init__(self)
        self.hub = hub
        logging.info("Service ready at '%s'" % (hub.path))

    def getChild(self, name, request):
        if name == 'static':
            return File(static_path)
        elif name == 'v1':
            return APIAuthSessionWrapper(self.hub, Plasmid)
        else:
            request.setResponseCode(404)
            "nothing here"


class Plasmid(Resource):
    """The Plasmid sync service for a given access token on a hub.

    d/DATABASE - A database resource
    a/ACCESS - An access token resource
    """

    def __init__(self, hub, avatarId):
        Resource.__init__(self)
        self.hub = hub
        self.avatarId = avatarId

        self.resource_factories = {
            'd': PlasmidDatabaseDispatch,
            'a': PlasmidAccessDispatch,
        }

    def getChild(self, name, request):
        """Dispatch to resource type."""

        return self.resource_factories[name](self.hub, self.avatarId)


class PlasmidAccessDispatch(Resource):
    """

    GET a/TOKEN
        Report the known permissions
    GET a/TOKEN/R-NAME
        Report the permissions of one resource
    PUT a/TOKEN/R-NAME/PERMISSION
    DELETE a/TOKEN/R-NAME/PERMISSION
    """

    def __init__(self, hub, avatarId, token=None, resourceLabel=None, permission=None):
        Resource.__init__(self)
        self.hub = hub
        self.avatarId = avatarId
        self.access = avatarId[1]

        self.token = token
        if resourceLabel:
            self.resourceType, self.resourceId = resourceLabel.split('-')
        else:
            self.resourceType, self.resourceId = None, None
        self.resourceLabel = resourceLabel
        self.permission = permission

    def getChild(self, name, request):
        if name:
            if not self.token:
                return self.__class__(self.hub, self.avatarId, name)
            if not self.resourceId:
                return self.__class__(self.hub, self.avatarId, self.token, name)
            if not self.permission:
                return self.__class__(self.hub, self.avatarId, self.token, self.resourceLabel, name)
        return self

    @endpoint
    def render_GET(self, request):
        cred = CredentialBackend()
        if self.resourceId and self.permission:
            have = cred.get_permission(self.access, self.permission, self.resourceId)
            return {
                "permission": self.permission,
                "resource": self.resourceType + '-' + self.resourceId,
                "access": self.access,
                "active": have,
            }
        elif self.token:
            return {
                "permissions": [
                    {
                        "resource": resource,
                        "permission": permission,
                        "value": value,
                    }
                    for (resource, permission, value) in
                    cred.list_permissions(self.token)
                ]
            }

    @endpoint
    def render_POST(self, request):
        cred = CredentialBackend()
        body = json.load(request.content)
        db = self.hub.get_hub_database()
        # Post to /a/
        # Create a token
        if not self.token:
            access = body.get('access')
            secret = body.get('secret')
            if not access:
                if secret:
                    return {'error': "Can only specify secret with token"}
                access = random_token()
                secret = random_token()
                existing = bool(db.get_meta('access_' + access))
            else:
                existing = bool(db.get_meta('access_' + access))

            # TODO: Fix race condition
            if existing:
                change = cred.get_permission(self.access, 'SetSecret', access)
                same = access == self.access
                if not (change or same):
                    return {'error': "Access token already exists"}

            db.set_meta('access_' + access, secret)

            if not existing:
                cred.set_permission(self.access, 'SetSecret', access, "Yes")

            return {'success': {
                'access': access,
                'secret': secret,
            }}
        # Post to /a/TOKEN
        # Add permission
        else:
            permission = body['permission']
            resource = body['resource']
            value = body['value']

            if value is None:
                return {'error': "Permission must have a value"}

            god = cred.get_permission(self.access, '*', '*') == '*'
            perm = cred.get_permission(self.access, permission, resource)
            if perm is None and not god:
                return {'error': "Must have a permission to grant it."}
            else:
                cred.set_permission(self.token, permission, resource, value)
                return {'success': {
                    'access': self.token,
                    'permission': permission,
                    'resource': resource,
                    'value': value,
                }}


class PlasmidDatabaseDispatch(Resource):

    def __init__(self, hub, avatarId):
        Resource.__init__(self)
        self.hub = hub
        self.avatarId = avatarId
        self.access = avatarId[1]

    def getChild(self, name, request):
        if name:
            s = Storage(self.hub, name)
            if not s.exists():
                if CredentialBackend().get_permission(self.access, 'CreateDatabase', name):
                    s.create()
                else:
                    raise error.UnauthorizedLogin()                    
            db = Database(self.hub, self.access, name, s)
            return db
        else:
            return {}


class Database(Resource):
    """API endpoints for a given database."""

    def __init__(self, hub, access, name, storage):
        Resource.__init__(self)
        self.hub = hub
        self.access = access
        self.name = name
        self.storage = storage
        if CredentialBackend().get_permission(self.access, 'ReadDatabase', self.name):
            self.can_read = True
        else:
            self.can_read = False

    def info(self, msg):
        logging.info("%s/%s %s" % (self.name, self.access, msg))

    @property
    def revision(self):
        if self.can_read:
            return self.storage.get_meta('revision')

    @endpoint
    def render_GET(self, request):
        if self.can_read:
            return {
                "name": self.name,
                "revision": self.revision,
            }

    def getChild(self, name, request):
        return DatabaseMethod(self, name)

    @endpoint
    def get_clone(self, request):
        if self.can_read:
            data = self.storage.get_data()
            return {
                "data": data,
                "revision": self.revision,
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
            self.info("Client pulled %d updates." % (len(updates)))
            return {
                "since": last_revision,
                "until": self.revision,
                "updates": updates,
            }

    @endpoint
    def post_update(self, request, x):
        cred = CredentialBackend()
        if cred.get_permission(self.access, 'WriteDatabase', self.name):
            body = json.load(request.content)
            last_revision = body['last_revision']
            data = body['data']

            if self.revision > last_revision:
                self.info("Client tried to push from out of date clone.")
                return {
                    'error': "Cannot update. Master has changed. %s > %s" % (self.revision, last_revision),
                    'saved': 0,
                    'reason': 'outofdate',
                }

            else:
                quota = cred.get_permission(self.access, "DatabaseQuota", self.name)
                try:
                    self.storage.set_data(data, quota=quota)
                except QuotaExceeded:
                    return {
                        'error': "quota exceeded",
                        'reason': "quota",
                    }
                else:
                    self.info("Client sent %s updates." % (len(data),))
                    return {
                        'saved': len(data),
                        'revision': self.storage.get_meta('revision'),
                    }
        request.setResponseCode(500)
        return {'authorized': False, 'permission': 'WriteDatabase'}


class DatabaseMethod(Resource):
    """Helper for dispatching requests to REST verbs of a database."""

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
