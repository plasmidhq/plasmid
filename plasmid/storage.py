from os.path import join
import sqlite3


class Hub(object):

    def __init__(self, path):
        self.path = path


class Storage(object):

    def __init__(self, hub, name):
        self.hub = hub
        self.name = name
        self.create()

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
            for (name, value) in data.items():
                cur.execute('INSERT OR REPLACE INTO data (key, revision, value) VALUES (?, ?, ?)',
                    (name, iteration, value))

    def get_data(self, name=None, revision=None):
        conn, cur = self.cursor()
        if name:
            cur.execute('SELECT value FROM data WHERE value = ?', (name,))
            try:
                return cur.fetchone()[0]
            except TypeError:
                return None
        elif revision:
            cur.execute('SELECT key, revision, value FROM data WHERE revision > ?', (revision,))
        else:
            cur.execute('SELECT key, revision, value FROM data')
        return dict((k, (r, v)) for (k, r, v) in cur.fetchall())
