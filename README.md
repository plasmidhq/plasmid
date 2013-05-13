# Plasmid

Plasmid is a Client/Server storage solution for offline-first web applications,
offering consistent master/slave updates to keep multiple browser instances
up to do between a single server.

Plasmid is focused on uses with small, per user databases. Such as task and
todo lists, note management, writing tools, and other uses.

Plasmid is a VERY EARLY project. Today, it functions, but is lacking in a lot
of crucial functions, unit tests, and stability. Please try Plasmid and give
feedback, but don't rely on it just yet!

See more details at the Plasmid website

http://ironfroggy.github.io/plasmid/

## Usage

To connect to and synchronize with a Plasmid database, you'll need to source the required
Javascript files, and setup the needed configuration.

    var api = window.location.protocol + '//' + window.location.host + '/api/';
    var access = "ACCESS";
    var secret = "SECRET";

    var database = new plasmid.Database({
        name: 'todo',
        remote_name: 'todo_' + access;
        api: api,

Defining a database is a simple matter of spelling out the stores available to place objects
into, and what indexes they might have on their properties.

        schema: {
            version: 1,
            stores: {
                todo: {
                    sync: true,
                    indexes: {
                        todo: {key: "completed", unique: false, multi: false}
                    }
                },
            },
        },
        access: access,
        secret: secret
    });

Stores are easily accessable

    var todos = database.stores.todo;
    todos.put(null, {
        text: "Learn how to use Plasmid.js!",
        completed: false
    })

And data is easily updated

    todos.get(key)
    .then(function(todo) {
        todo.completed = true;
        todos.put(key, todo);
    });

You can read a lot more at the [API Reference](http://ironfroggy.github.io/plasmid/).
