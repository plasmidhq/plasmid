About This Reference
####################

This is a complete reference for the public API of Plasmid.js, and may be in flux
as development continues. It only includes aspects of the API, however, that are
considered stable. Anything that is likely to be removed or significantly changed,
and is not essential to utilizing Plasmid.js, will not be completed until it has
been stabilized.

Plasmid includes a number of important types with their own APIs, by which this
document is organized.

EventListener_

Promise_

Database_

Transaction_

LocalStore_

Credentials_

SyncStore_

EventListener
#############

Almost every object in Plasmid is an EventListener_, so this section is important
to understand the base of all the other types.

EventListener.on(`eventname`, `handler`)
----------------------------------------

    Registers `handler` to be called when `eventname` is triggered on this object.
    It will be called bound to this object.

    As a side effect, if this is the first handler registered for the event type,
    it will be called with all previous triggers for this event. This allows event
    triggers to be queued before they are registered, as a convenience.

EventListener.trigger(`eventname`, `arguments ...`)
---------------------------------------------------

    Calls all handlers for `eventname` in the order they were registered, bound to
    this object and passing all the provided `arguments`.

EventListener.error(`handler`)
------------------------------

    As a convenience, binds the `handler` to the `"error"` event.

Promise
#######

Promise is based on an EventListener_.

Promise.then(`success`, `error`)
--------------------------------

    Binds the `success` handler to the `"success"` event and the `error` handler to
    the `"error"` event. These events are fired to signal the fulfillment of the promise.

Promise.ok(`result`)
--------------------

    Fulfills te promise with `result`.

Promise.chain(`promises`)
-------------------------

    This is a helper on the constructor object to wait on the result of multiple
    promises. When all `promises` are fulfilled, the chain promise is fulfilled with an
    array of all the results in the same order as the promises were given.

    It is called like this:

    .. sourcecode:: javascript

        var wait - Promise.chain(promise1, promise2);
        wait.then(function(results) {
            var result1 - results[0]
            ,   result2 - results[1]
            ;

            ...
        });

Database
########

Database is based on an EventListener_.

The database, of course, is the first thing you're going to be working with. It acts
primarily as a container of stores and our interface to initiating transactions, but
otherwise is used very little directly.

.. _transaction:

Database.transaction(`stores`, `[mode]`)
----------------------------------------

    Begins a transaction involving one or more stores. `stores` is the name of a single
    store or an array of store names. `mode` is optional, defaulting to `"readonly"`.

    Passing a mode of `"readwrite"` will create a transaction capable of creating or
    updating data in the contained stores.

    If you do not need to group multiple operations in a transaction, the database will
    automatically create and commit appropriate single-operation transactions.

    The Transaction_ API defines a `Transaction.abort()`_ method, and otherwise inherits
    the rest of the Database API defined here.

Database.setRemote(`remotename`)
--------------------------------

    Defines the name of the remote database used for syncronization with Plasmid Sync.

Database.autoSync(`interval`)
-----------------------------

    Defines an interval in milliseconds for automatic syncronization.

Database.sync()
---------------

    Initializes a pull_ followed by a push_.


.. _pull:

Database.pull()
---------------

    *Important* details on conflict resolution are described here. Read carefully.

    If a remote API and database name are configured, fetch all new updates from the Sync
    server and apply them locally.

    In the event of a conflict between an unsynced local change and a remote change being
    pulled, the `"conflict"` event will be triggered on the store containing the object.

    The conflict event is given a `put()` callback, `key`, `local value`, and
    `remote value`, in that order. The conflict handler is responsible for saving any altered
    values or new keys as a result of the conflict, exclusively through the `put()` callback
    it receives.

    If the handler saves any objects, these objects will be the sole results of the conflict
    and may not even include the original objects or keys at all. For example, two objects
    conflicting could result in a new merged object. If this is the case, you should push_
    to share the results with the sync server.

    If the handler does *not* save any objects, the default behavior is used and only the
    remote version is kept.

.. _push:

Database.push()
---------------

    If a remote APi and database name are configured, send all unsubmitted changes to the
    Sync server. The remote server will reject the changes if a pull_ is required first,
    triggering an error.

Database.drop()
---------------

    *Important* this is not reversable! This removes all local data!

    Removes the local database entirely.

Database.reset()
----------------

    *Important* this is not reversable! This removes all local data!

    Removes the local database entirely, then recreates it with the current schema and no
    data.


Transaction
###########

    The transaction is created by the transaction_ method on the Database_.

    Transaction inherits from its own Database_ and inherits all of its methods.

    The transaction will commit when it is garbage collected, if it was not aborted.

Transaction.abort()
-------------------

    Rejects all changes made in this transaction.

Transaction.commit()
--------------------

    Removes local references to the internal transaction object, which allows the
    automatic commit behavior to trigger.

LocalStore
##########

    The Database_ contains one or more stores, where you place your data. The
    LocalStore_ makes working with these IndexedDB constructs easier, and they are the
    primary interface you'll use.

LocalStore.count()
------------------

    Request the total number of objects currently saved in the store.

LocalStore.by(`indexname`)
--------------------------

    Access a named index, where query operations can be done against the indexed property.

    The index is a version of the key using the indexed property as te key to identify stored
    objects by.

    The indexed are defined as part of the schema during Database_ creation,
    can only be created or changed in schema upgrades, and they are only way to
    filter store contents by anything other than the `key`.

LocalStore.walk(`filter`)
-------------------------

    Request objects from the store, triggering an 'each' event on the promise for every
    object found. Does not collect the objects into any array. This method is memory efficient.

    The `filter` parameter controls which objects are returned. The follow keys are allowed,
    including combinations.

    gt
        Only find keys greater than a given value
    gte
        Only find keys greater or equal to a given value
    lt
        Only find keys less than a given value
    lte
        Only find keys less than or equal to a given value
    start
        An index into the results to begin
    stop
        An index into the results to stop. The given index will not be included.

    A non-object value for `filter` will find all objects with a key exactly equal to it.

LocalStore.fetch(`filter`)
--------------------------

    Request an array of all objects in the store, accepting the same `filter` parameter
    as the `walk()` method above.

    The result is an array of objects with `key` and `value` properties.

LocalStore.add(`key`, `value`)
------------------------------

    Saves a value in the store, and fails if a value with the same key exists.

    The new value is queued for the next push_.

LocalStore.put(`key`, `value`)
------------------------------

    Saves a value in the store, and replaces any value currently stored at the
    same key.

    The new value is queued for the next push_.

LocalStore.putmany(`many`)
--------------------------

    If you need to update many objects together, this method is helpful. It
    takes an array of objects with `key` and `value` properties, and puts all of
    them into the store in a single transaction.

    There is no varient to "add many", however.


SyncStore
#########

    The SyncStore offers no special API for public use, but implements some internal
    pieces to coordinate push_ and pull_ requests with the Database_.

Credentials
###########

    Access and secret token pairs are housed in a Credentials_ object.

Credentials.self_cred()
-----------------------

    The credentials will from this point forward authenticate API requests with themselves.

    Credentials are used for all interactions with the Plasmid Sync service, including
    API calls to inspect the permissions a particular set of credentials has. For this
    reason, it may be common to make credential requests authenticated with another pair.

    For example, an initial account is created for a user by creating their new Device
    Credentials with a pair of Bootstrap Credentials.

    Self Credentials are both the actor and target of their own API calls.

Credentials.complete()
----------------------

    Identifies the credentials as including a secret token, or only an access token.

    Returns `true` or `false`.

Credentials.list()
------------------

    Fetches a list of permissions granted to these credentials.

Credentials.grant(`resource`, `permission`, `value`)
----------------------------------------------------

    Grant new permissions to these credentials.

    This method is obviously useless for Self-authenticating Credentials, as they can only
    grant permissions they already have.

    Any credentials may be grant any of their own permissions to another credentials pair.

    Full explaination of permissions will be added in a separate document.

Credentials.create(`type`)
--------------------------

    Creates a new set of credentials, and populates this object with the new access and secret.

    For example, this would create a new Device Credential Pair, authenticated with Bootstrap
    Credentials capable only of creating new accounts.

    .. sourcecode:: javascript

        bootstrap_credentials = new plasmid.Credentials({
            access: "guest-creator",
            secret: "knock-knock"
        });
        my_credentials = new Credentials({
            credentials: bootstrap_credentials,
        });
        my_credentials.create('guest')
        .then(function(data) {
            console.log("I have a new access token: " + data.access);
            console.log("And a new remote database to sync with: " + data.dbname);
            console.log("But, I'm not telling you the value of data.secret");

            // Remember the credentials to re-use later, and set the new remote name

            self.meta.put('credentials', {
                access: data.access,
                secret: data.secret,
                dbname: data.dbname,
            });
            database.setRemote(data.dbname);
        })

