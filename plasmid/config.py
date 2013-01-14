# configuration

DEFAULT = object()

hub = None
port = 8880

permission_defaults = {
    'CreateGuest': 'Ne',
    'GuestDatabasePrefix': 'guest_',
    'GuestDatabaseQuota': 1024 * 1024,
    'CreateDatabase': 'No',
    'ReadDatabase': 'No',
    'WriteDatabase': 'No',
    'SetSecret': 'No',
}


def configure(**params):
    for key in params:
        if params[key] is not DEFAULT:
            globals()[key] = params[key]
