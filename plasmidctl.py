#!/usr/bin/env python
# plasmidctl.py

from plasmid import *

def main(argv):
    parser = argparse.ArgumentParser()

    parser.add_argument('-c', nargs='?')
    parser.add_argument('--set-secret', dest='set_secret', nargs=2)
    parser.add_argument('--check-permission', dest='check_permission', nargs=3)
    parser.add_argument('--grant-permission', dest='grant_permission', nargs=3)
    parser.add_argument('--revoke-permission', dest='revoke_permission', nargs=3)
    parser.add_argument('-p', '--hub-path', dest='hub_path', default='hub')
    ns = parser.parse_args(argv)

    configure(hub=Hub(ns.hub_path))

    credbackend = CredentialBackend()

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
        resource = ServiceRoot(hub)
        factory = Site(resource)

        reactor.listenTCP(8880, factory)
        reactor.run()

if __name__ == '__main__':
    main(sys.argv)
