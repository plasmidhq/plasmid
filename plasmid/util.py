import json


def endpoint(func):
    def _(*args, **kwargs):
        return json.dumps(func(*args, **kwargs))
    return _
