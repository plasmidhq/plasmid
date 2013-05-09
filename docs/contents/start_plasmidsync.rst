About Sync
##########

Browser-side data storage is amazing, but we can't escape that these are web applications
we're building. With Plasmid Sync, *users can keep their offline-first data syncronized
across all their devices*. You run a small service and Plasmid.js coordinates everything
on the frontend.

Plasmid Sync runs on your server and manages the updates from all the devices your users
load your app on. It is not a backend data server, but only serves to syncronize the data
between these devices, while the application continues to work completely on the device.

Getting Started
###############

In this early stage, the setup procedure is not really present. Simply checkout a copy of
from Plasmid's git repository on Github and run the `plasmidctl.py` script to begin the
process. Of course, you'll want to setup an account on the server to actually utilize it.

To experiment with Plasmid Sync, setup a pair of test credentials to use.

.. sourcecode:: bash

    ./plasmidctl.py --set-secret test secret123
    ./plasmidctl.py --grant-permission test "*" "*"

The test credentials now have unlimited access to all databases created in this instance
of the service. Run the Plasmid Sync server and it will create a "hub" directory to
contain your databases and run the service at `localhost:8880/plasmid/`

.. sourcecode:: bash

    ./plasmidctl.py

A directory named `hub` will be created in the current directory, containing any databases
created.

From Plasmid.js, you may create a `Database` with an `api` value in its options, pointing
to the location of the running Plasmid Sync server, and a `credentials` value as an instance
of the Plasmid.js `Credentials` type. This database instance will have `pull()` and `push()`
methods to update the local database from the Sync server and to push new changes back to it,
respectively.

.. sourcecode:: javascript

    plasmid_api = window.location.protocol + '//' + window.location.host + '/v1/';

    credentials = new plasmid.Credentials({
        api: plasmid_api,
        access: "playground-user",
        secret: "playground-secret"
    });

    playground = new plasmid.Database({
        name: "playground-db",
        remotename: "playground-db",
        api: plasmid_api,
        schema: {
            version: 1,
            stores: {
                things: {sync: true},
                private: {sync: false}
            }
        },
        credentials: credentials
    });

    playground.on('opensuccess', function() {
        
        playground.pull(); // Update from the server

        playground.push(); // Push local updates to the server

        playground.sync(); // Pull, then push
    
    });

Plasmid.js will periodically request updates for a database from the Sync server, sending
the updates that have
been made since the last update that was made. When the user has made changes in the browser
side which need to be syncronized with the server, the new objects will be pushed back to the
server and *only accepted if there are no un-pulled changes.* 

The server is, essentially, designed to be afraid. No conflicts in the data happen on the
backend. Instead, conflicts are only possible inside the application itself, inside the browser,
where the application can deal with these conflicts as is appropriate for its own data, and
with the opportunity to involve the user in resolutions which cannot be safely automated.
