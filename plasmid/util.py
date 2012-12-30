import json

from twisted.web.resource import Resource, IResource


def endpoint(func):
    def _(self, request, *args, **kwargs):
        request.setHeader('Content-Type', 'application/json')
        return json.dumps(func(self, request, *args, **kwargs))
    return _

class StringResource(Resource):
    def __init__(self, s):
        Resource.__init__(self)
        self.s = s
    def render_GET(self, request):
        return self.s