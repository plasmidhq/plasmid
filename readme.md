# Plasmid

Plasmid is a storage solution for offline-first web applications,
offering consistent master/slave updates to keep multiple browser instances
up to do between a single server.

Plasmid is focused on uses with per-user databases. Such as task and
todo lists, note management, writing tools, and other uses.

MVC frameworks are very easy to integrate with Plasmid, especially when using
data binding libraries with your client-side templates. Results from Plasmid
database queries can be bound to in your templates, and the results can automatically
update when new data is created or updated underneath, creating a very
smooth experience.

See more details at the Plasmid website

http://plasmidhq.github.io/plasmid/

## Installation

PlasmidDB is now hosted on NPM. To use it in your web applications, Browserify or WebPack
are recommended. *Note: PlasmidDB is a browser-only package and will not work in NodeJS.*

If you use PlasmidDB via the NPM package, simple `require("plasmiddb")`.

If you'd like to use PlasmidDB without NPM, the website has distributions available that
will package PlasmidDB up for use in a web application available as a global variable `plasmid`.

## Usage

To connect to a Plasmid database, you'll need to source the required
Javascript files, and setup the needed configuration.

    var database = new plasmid.Database({
        name: 'todo',

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
        }
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

You can read a lot more at the [API Reference](http://plasmidhq.github.io/plasmid/plasmid_api.html).
