from os.path import join, exists
from os import stat
import json
import sqlite3


class QuotaExceeded(Exception):
    pass


class Hub(object):

    def __init__(self, path):
        self.path = path

    def get_hub_database(self):
        storage = Storage(self, 'plasmid_hub_meta')
        storage.create()
        return storage


class Storage(object):

    def __init__(self, hub, name):
        self.hub = hub
        self.name = name

    def size(self, unit='b'):
        size = stat(join(self.hub.path, self.name + '.sqlite')).st_size
        if unit == 'M':
            return size / 1024.0 / 1024.0
        elif unit == 'b':
            return size
        raise TypeError('Unit must be M or b')

    def exists(self):
        return exists(join(self.hub.path, self.name + '.sqlite'))

    def conn(self):
        return sqlite3.connect(join(self.hub.path, self.name + '.sqlite'))

    def cursor(self):
        conn = self.conn()
        return conn, conn.cursor()

    def create(self):
        conn, cur = self.cursor()
        if not self._table_exists('data'):
            cur.execute('''
                CREATE TABLE data (
                    store text,
                    key text,
                    revision integer,
                    value text,

                    UNIQUE (store, key) ON CONFLICT REPLACE
                );
            ''')
        if not self._table_exists('meta'):
            print('creating meta table...')
            cur.execute('''
                CREATE TABLE meta (
                    property text unique,
                    value 
                );
            ''')
            self.set_meta('revision', 1)
        if not self._table_exists('permission'):
            cur.execute('''
                CREATE TABLE permission (
                    access text,
                    resource text,
                    permission text,
                    active bool,

                    UNIQUE (access, resource, permission) ON CONFLICT REPLACE
                );
            ''')
        conn.commit()

    def _table_exists(self, table_name):
        conn, cur = self.cursor()
        query = "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
        cur.execute(query, (table_name,))
        return bool(cur.fetchall())

    def set_meta(self, name, value):
        conn, cur = self.cursor()
        cur.execute('INSERT OR REPLACE INTO meta (property, value) VALUES (?, ?)', (name, value))
        conn.commit()

    def get_meta(self, name):
        conn, cur = self.cursor()
        cur.execute('SELECT value FROM meta WHERE property = ?', (name,))
        try:
            return cur.fetchone()[0]
        except TypeError:
            return None

    def get_meta_prefix(self, prefix):
        conn, cur = self.cursor()
        cur.execute('SELECT proprety, value FROM meta WHERE property like ?', (prefix+'%',))
        return cur.fetchall()

    def set_data(self, data, quota=None):
        conn, cur = self.cursor()
        db_size = self.size()
        with conn:
            if data:
                revision = self.get_meta('revision') + 1
                self.set_meta('revision', revision)
            for store in data:
                for (name, value) in data[store].items():
                    value = json.dumps(value)

                    if quota is not None:
                        value_size = len(value)
                        cur.execute('SELECT length(value) FROM data WHERE store = ? AND key = ?', (store, name))
                        cur_size = cur.fetchone()[0]
                        new_size = db_size - cur_size + value_size
                        if new_size > quota:
                            raise QuotaExceeded()

                    cur.execute('INSERT OR REPLACE INTO data (store, key, revision, value) VALUES (?, ?, ?, ?)',
                        (store, name, revision, value))

    def get_data(self, name=None, revision=None):
        conn, cur = self.cursor()
        if name:
            cur.execute('SELECT value FROM data WHERE value = ?', (name,))
            try:
                return cur.fetchone()[0]
            except TypeError:
                return None
        elif revision:
            cur.execute('SELECT store, key, revision, value FROM data WHERE revision > ?', (revision,))
        else:
            cur.execute('SELECT store, key, revision, value FROM data')
        data = {}
        for (store, key, rev, value) in cur.fetchall():
            data.setdefault(store, {})[key] = [rev, json.loads(value)]
        return data

