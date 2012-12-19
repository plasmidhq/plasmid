from os.path import join, exists
import json
import sqlite3


class Hub(object):

    def __init__(self, path):
        self.path = path

    def get_hub_database(self):
        return Storage(self, 'plasmid_hub_meta')


class Storage(object):

    def __init__(self, hub, name):
        self.hub = hub
        self.name = name
        self.create()

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
            self.set_meta('iteration', 1)
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

    def set_data(self, data):
        conn, cur = self.cursor()
        with conn:
            iteration = self.get_meta('iteration') + 1
            self.set_meta('iteration', iteration)
            for store in data:
                for (name, value) in data[store].items():
                    value = json.dumps(value)
                    cur.execute('INSERT OR REPLACE INTO data (store, key, revision, value) VALUES (?, ?, ?, ?)',
                        (store, name, iteration, value))

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

