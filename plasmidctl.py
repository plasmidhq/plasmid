#!/usr/bin/env python2

from plasmid import *


def main(argv):
    parser = argparse.ArgumentParser()

    parser.add_argument('-c', nargs='?')
    parser.add_argument('--set-secret', dest='set_secret', nargs=2)
    parser.add_argument('--check-permission', dest='check_permission', nargs=3)
    parser.add_argument('--grant-permission', dest='grant_permission', nargs=4)
    parser.add_argument('--revoke-permission', dest='revoke_permission', nargs=3)
    parser.add_argument('-p', '--hub-path', dest='hub_path', default='hub')
    parser.add_argument('--port', dest='port', default=DEFAULT)
    ns = parser.parse_args(argv[1:])

    configure(
        hub=Hub(ns.hub_path),
        port=ns.port,
    )

    credbackend = CredentialBackend()

    if ns.set_secret:
        access, secret = ns.set_secret
        hub_db = config.hub.get_hub_database()
        hub_db.set_meta('access_' + access, secret)
    elif ns.check_permission:
        access, permission, resource = ns.check_permission
        print access, permission, resource, credbackend.get_permission(access, permission, resource)
    elif ns.grant_permission:
        access, permission, resource, value = ns.grant_permission
        credbackend.set_permission(access, permission, resource, value)
    elif ns.revoke_permission:
        access, permission, resource = ns.revoke_permission
        credbackend.set_permission(access, permission, resource, "No")
    else: 
        resource = ServiceRoot(config.hub)
        factory = Site(resource)

        reactor.listenTCP(config.port, factory)
        reactor.run()

if __name__ == '__main__':
    main(sys.argv)
