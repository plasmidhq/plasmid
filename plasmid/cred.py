from zope.interface import implements

from twisted.internet import defer
from twisted.web.resource import Resource, IResource
from twisted.web.guard import HTTPAuthSessionWrapper, BasicCredentialFactory
from twisted.web._auth.wrapper import UnauthorizedResource
from twisted.web import util
from twisted.cred.portal import IRealm, Portal
from twisted.cred.checkers import ICredentialsChecker
from twisted.cred.credentials import ICredentials
from twisted.cred import error

from plasmid.util import endpoint
from plasmid import config


class UnauthorizedResource(Resource):
    isLeaf = True

    def render(self, request):
        request.setResponseCode(500)
        return '{"authorized":false}'


class APIAuthSessionWrapper(object):
    implements(IResource)
    isLeaf = False

    def __init__(self, hub, factory):
        portal = Portal(PlasmidRealm(hub, factory), [PlasmidCredChecker(hub)])
        self._portal = portal

    def getChildWithDefault(self, path, request):
        request.postpath.insert(0, request.prepath.pop())
        return self._authorizationResource(request)

    def render(self, request):
        return self._authorizedResource(request).render(request)

    def _authorizationResource(self, request):
        auth_header = request.getHeader('authorization')
        if not auth_header:
            return self._anonymous(request)

        auth_type, auth_string = auth_header.split(' ', 1)
        if auth_type == 'Basic':
            access, secret = auth_string.decode('base64').split(':', 1)
            credentials = PlasmidCredentials(access, secret)
            return util.DeferredResource(self._login(credentials))
        else:
            return self._error(request, "Unknown authentication method")

    def _login(self, credentials):
        d = self._portal.login(credentials, None, IResource)
        d.addCallbacks(self._loginSucceeded, self._loginFailed)
        return d

    def _loginSucceeded(self, (interface, avatar, logout)):
        return avatar

    def _loginFailed(self, result):
        return UnauthorizedResource()


class IPlasmidCredentials(ICredentials):
    def checkSecret(self, hub, access, secret):
        pass

class PlasmidCredentials(object):
    implements(IPlasmidCredentials)

    def __init__(self, access, secret):
        self.access = access
        self.secret = secret

    def checkSecret(self, hub, access, secret):
        hub_db = hub.get_hub_database()
        known_secret = hub_db.get_meta('access_' + access)
        if known_secret == secret:
            return (IResource, access, lambda x: None)
        else:
            return defer.fail(error.UnauthorizedLogin())


class PlasmidCredChecker(object):

    implements(ICredentialsChecker)

    credentialInterfaces = (
        IPlasmidCredentials,
    )

    def __init__(self, hub):
        self.hub = hub

    def requestAvatarId(self, c):
        return c.checkSecret(self.hub, c.access, c.secret)


class PlasmidRealm(object):
    implements(IRealm)

    def __init__(self, hub, factory):
        self.hub = hub
        self.factory = factory

    def requestAvatar(self, avatarId, mind, *interfaces):
        if IResource in interfaces:
            resource = self.factory(self.hub, avatarId)
            return (IResource, resource, lambda: None)
        raise NotImplementedError()


PERMISSIONS = (
    'ReadDatabase',
    'WriteDatabase',
    'DeleteDatabase',
    'CreateDatabase',
    'ReadAccessToken'
    'GrantAccessToken',
    'DeleteAccessToken',
)

class CredentialBackend(object):

    def set_secret(self, access, secret):
        config.hub.get_hub_database().set_meta('access_' + access, secret)

    def get_secret(self, access):
        config.hub.get_hub_database().get_meta('access_' + access)

    def get_permission(self, access, permission, resource):
        """Determine if the access token has the permission on the resource."""

        db = config.hub.get_hub_database()
        conn, cur = db.cursor()
        query = "SELECT resource, active FROM permission WHERE access = ? AND permission = ?"
        cur.execute(query, (access, permission))

        for for_resource, active in cur.fetchall():
            if not active:
                continue
            else:
                if for_resource == resource:
                    return active
                elif for_resource.endswith('*'):
                    if resource.startswith(resource[:-1]):
                        return active

        return None

    def list_permissions(self, access):
        db = config.hub.get_hub_database()
        conn, cur = db.cursor()
        query = "SELECT permission, resource, active FROM permission WHERE access = ?"
        cur.execute(query, (access,))

        for permission, resource, active in cur.fetchall():
            if active:
                yield resource, permission, active

    def set_permission(self, access, permission, resource, status):
        
        db = config.hub.get_hub_database()
        db.create()
        conn, cur = db.cursor()
        query = 'INSERT INTO permission (access, permission, resource, active) VALUES (?, ?, ?, ?)'
        with conn:
            cur.execute(query, (access, permission, resource, status))
