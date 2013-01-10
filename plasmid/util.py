import json
import random
import string

from twisted.web.resource import Resource, IResource


def endpoint(func):
    def _(self, request, *args, **kwargs):
        request.setHeader('Content-Type', 'application/json')
        return json.dumps(func(self, request, *args, **kwargs))
    return _


TOKEN_CHARS = string.ascii_lowercase + string.digits
def random_token(size=8):
    return ''.join(random.choice(TOKEN_CHARS) for i in range(size))


class StringResource(Resource):
    def __init__(self, s):
        Resource.__init__(self)
        self.s = s
    def render_GET(self, request):
        return self.s
