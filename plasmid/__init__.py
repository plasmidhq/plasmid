import time
import json
from os.path import abspath, join, dirname

from twisted.internet import reactor
from twisted.web.server import Site
from twisted.web.resource import Resource
from twisted.web.static import File

from plasmid.util import endpoint
from plasmid.storage import Hub, Storage


hub = Hub('hub')


class Plasmid(Resource):

    def __init__(self):
        Resource.__init__(self)
        self.databases = {}

    def getChild(self, name, request):
        if name:
            try:
                return self.databases[name]
            except KeyError:
                s = Storage(hub, name)
                s.create()
                self.databases[name] = db = Database(name, s)
                return db
        else:
            return StringResource(json.dumps({
                "databases": self.databases.keys(),
            }))


class Database(Resource):

    def __init__(self, name, storage):
        Resource.__init__(self)
        self.name = name
        self.storage = storage

    @property
    def iteration(self):
        return self.storage.get_meta('iteration')

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
        data = self.storage.get_data()
        return {
            "data": data,
            "iteration": self.iteration,
        }

    @endpoint
    def get_update(self, request, last_iteration):
        last_iteration = int(last_iteration)
        updates = []
        data = self.storage.get_data(revision=last_iteration)
        for k, (i, v) in data.items():
            updates.append((i, k, v))
        print 'UPDATES', updates
        return {
            "since": last_iteration,
            "until": self.iteration,
            "updates": updates,
        }

    def post_update(self, request):
        body = json.load(request.content)
        last_iteration = body['last_iteration']
        data = body['data']

        assert self.iteration

        if self.iteration > last_iteration:
            return {
                'error': "Cannot update. Master has changed. %s > %s" % (self.iteration, last_iteration),
                'saved': 0,
            }

        else:
            self.storage.set_data(data)
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
static_path = abspath(join(dirname(__file__), '..', 'static'))
print "Static at", static_path
resource.putChild('static', File(static_path))
factory = Site(resource)
reactor.listenTCP(8880, factory)
reactor.run()
