import hashlib

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
from plasmid import signal
from plasmid import config


class UnauthorizedResource(Resource):
    isLeaf = True

    def render(self, request):
        request.setResponseCode(500)
        return '{"authorized":false}'


class APIAuthSessionWrapper(object):
    implements(IResource)
    isLeaf = False

    def __init__(self, hub, factory, log_extra):
        portal = Portal(PlasmidRealm(hub, factory), [PlasmidCredChecker(hub)])
        self._portal = portal
        self.log = log_extra

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
        self.credentials = credentials
        d = self._portal.login(credentials, None, IResource)
        d.addCallbacks(self._loginSucceeded, self._loginFailed)
        return d

    def _loginSucceeded(self, (interface, avatar, logout)):
        self.log("auth=%s" % (avatar.avatarId[1]))
        return avatar

    def _loginFailed(self, result):
        self.log("auth fail %s" % (self.credentials.access,), result.getTraceback())
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
        match = CredentialBackend().check_secret(access, secret)
        if match:
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


class CredentialBackend(object):
    """Manages creation, verification, and modification of access keys and permissions."""

    def _hash_secret(self, secret):
        secret_hash = hashlib.sha1()
        secret_hash.update(config.hub.get_hub_database().get_meta('secret_salt'))
        secret_hash.update(secret)
        return secret_hash.hexdigest()

    def create_pair(self, access, secret):
        self.set_secret(access, secret, force=True)

    def set_secret(self, access, secret, force=False):
        """Change a secret token associated with an access token.

        Raises ValueError on unknown access token.
        """

        assert access
        assert secret

        secret_hash = self._hash_secret(secret)
        db = config.hub.get_hub_database()
        k = 'access_' + access
        if db.get_meta(k) is None and not force:
            raise ValueError("Unknown access token: %s" % (access,))
        else:
            db.set_meta(k, secret_hash)


    def list_access_tokens(self):
        db = config.hub.get_hub_database()
        conn, cur = db.cursor()
        query = "SELECT property FROM meta WHERE property LIKE 'access_%'"
        cur.execute(query)

        return cur.fetchall()

    def check_secret(self, access, secret):
        """Verify a pair of access and secret keys match."""

        try:
            secret_hash = self._hash_secret(secret)
        except TypeError:
            return False
        return secret_hash == config.hub.get_hub_database().get_meta('access_' + access)

    def get_permission(self, access, permission, resource='*'):
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

        return self.default(permission)

    def default(self, permission):
        defaults = getattr(config, 'permission_defaults', {})
        return defaults.get(permission)

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

