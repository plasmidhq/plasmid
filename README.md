# Plasmid

Plasmid is a Client/Server storage solution for client-heavy web applicaitons,
offering consistent master/slave updates to keep multiple browser instances
up to do between a single server.

Plasmid is focused on uses with small, per user databases. Such# as task and
todo lists, note management, writing tools, and other uses.

Plasmid is a VERY EARLY project. Today, it functions, but is lacking in a lot
of crucial functions, unit tests, and stability. Please try Plasmid and give
feedback, but don't rely on it just yet!

## Setup

To try Plasmid, checkout the resposiotry and run the plasmid package. Plasmid
requires Twisted to run.

	python -m plasmid

You can visit the demonstration todo application by viewing http://localhost:8880/
in your browser. If you visit it from multiple browsers, the todo list will be synced,
even during disconnected periods.

## Management

If you'd like to use Plasmid, against my advice, you'll want some moderate security
so create a set of user credentials and grant them access to the appropriate resources.

	python -m plasmid --set-secret ACCESS_TOKEN SECRET
	python -m plasmid --grant-permission ACCESS_TOKEN CreateDatabase DATABASE
	python -m plasmid --grant-permission ACCESS_TOKEN ReadDatabase DATABASE
	python -m plasmid --grant-permission ACCESS_TOKEN WriteDatabase DATABASE

And pass the access and secret tokens as appropriate options to the Database configuration
in your client code. (see below)

## Usage

To connect to and synchronize with a Plasmid database, you'll need to source the required
Javascript files, and setup the needed configuration.

	<script type="text/javascript" src="base64.js"></script>
	<script type="text/javascript" src="plasmid.js"></script>
	<script type="text/javascript">
	    var api = window.location.protocol + '//' + window.location.host + '/api/';
	    var access = "ACCESS";
	    var secret = "SECRET";

	    var database = new plasmid.Database({
	        name: 'todo',
	        api: api,
	        schema: {
	            version: 1,
	            stores: {
	                todo: {
	                    sync: true,
	                    indexes: {
	                        todo: {key: "todo", unique: false, multi: false}
	                    }
	                },
	            },
	        },
	        autoSync: false,
	        access: access,
	        secret: secret
	    });

Once created, you should begin your interactions with the database only when
it is ready.

	database.on('opensuccess', function() {
		// Use the database now.
	});

### Database API

*database.put(key, value)* Put the value at the given key
*database.get(key)* Get the value for the given key
*database.get(key).then(do)* Pass the value for the given key to the callback function `do`
*database.get(key).on('error', onerror)* Try to get the value at the given key, but call the error handler if the attempt fails
*database.sync()* Push new changes back upstream and pull changes down