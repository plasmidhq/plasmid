from collections import defaultdict
from functools import partial
import logging


class Signal(object):

    def __init__(self, name=None):
        self._name = name
        self._listeners = []

    @property
    def name(self):
        name = self._name
        if name is None:
            for (key, value) in globals().items():
                if value is self:
                    name = key
                    break
        return name

    def send(self, *args, **kwargs):
        fmtargs = ', '.join(repr(a) for a in args)
        fmtkwargs = ', '.join("%s: %r" % (k, v) for (k, v) in kwargs.items())
        logging.info("%s: %s %s", self.name or 'unnamed signal', fmtargs, fmtkwargs)
        for func in self._listeners:
            func(*args, **kwargs)
    __call__ = send

    def register(self, func, *args, **kwargs):
        self._listeners.append(partial(func, *args, **kwargs))


auth = Signal()
auth_ok = Signal()
auth_fail = Signal()

db_create = Signal()
db_read = Signal()
db_write = Signal()

db_pull = Signal()
db_push = Signal()

cred_create = Signal()
cred_guest_setup = Signal()

