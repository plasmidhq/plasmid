import json


def endpoint(func):
    def _(self, request, *args, **kwargs):
        request.setHeader('Content-Type', 'application/json')
        return json.dumps(func(self, request, *args, **kwargs))
    return _
