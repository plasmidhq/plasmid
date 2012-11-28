from twisted.internet import reactor
from twisted.web.server import Site
from twisted.web.resource import Resource

import time
import json

from plasmid.util import endpoint


class Plasmid(Resource):

    def __init__(self):
        Resource.__init__(self)
        self.databases = {}

    def getChild(self, name, request):
        if name:
            try:
                return self.databases[name]
            except KeyError:
                self.databases[name] = db = Database(name)
                return db
        else:
            return StringResource(json.dumps({
                "databases": self.databases.keys(),
            }))


class Database(Resource):

    def __init__(self, name):
        Resource.__init__(self)
        self.name = name
        self.data = {}
        self.iteration = 1

    @endpoint
    def render_GET(self, request):
        return {
            "name": self.name,
            "iteration": self.iteration,
        }

    def getChild(self, name, request):
        return DatabaseMethod(self, name)

    @endpoint
    def get_clone(self, request):
        return {
            "data": self.data,
            "iteration": self.iteration,
        }

    @endpoint
    def get_update(self, request, last_iteration):
        last_iteration = int(last_iteration)
        updates = {}
        for k, (i, v) in self.data.items():
            if i > last_iteration:
                updates[k] = (i, v)
        return {
            "since": last_iteration,
            "until": self.iteration,
            "updates": updates,
        }

    def post_update(self, request):
        body = json.load(request.content)
        last_iteration = body['last_iteration']
        data = body['data']

        if self.iteration > last_iteration:
            return {
                'error': "Cannot update. Master has changed.",
                'saved': 0,
            }

        else:
            self.iteration += 1
            for k, v in data.items():
                self.data[k] = (self.iteration, v)
            return json.dumps({'saved': len(data)})


class DatabaseMethod(Resource):

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


class StringResource(Resource):
    def __init__(self, s):
        Resource.__init__(self)
        self.s = s
    def render_GET(self, request):
        return self.s


resource = Plasmid()
factory = Site(resource)
reactor.listenTCP(8880, factory)
reactor.run()
