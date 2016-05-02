.. PlasmidDB documentation master file, created by
   sphinx-quickstart on Sun Mar 27 12:37:06 2016.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Welcome to PlasmidDB's documentation!
=====================================

Contents:

.. toctree::
   :maxdepth: 1

   plasmidjs_api


Intoduction
===========

PlasmidDB is an IndexedDB wrapper which makes working with its nuances more pleasant, helps manage
stores and indices, and adds much needed easier-to-understand APIs to this powerful storage
mechanism.

PlasmidDB also works in tandem with PlasmidDB Sync, a small server-side tool which can enable
synchronization of IndexedDB storage between multiple browsers and devices.

Getting Started
===============

Creating a new PlasmidDB Database requires a database name and a simple schema with at least one
store created. You may create many databases with different names, but they are all isolated to
the origin domain from which your webpage is served.

.. sourcecode:: javascript

   import PlasmidDB from 'PlasmidDB';

   var database = new Database({
      name: "my_database",
      schema: {
         version: 1,
         stores: {
            "objects": {}
         }
      }
   })

If the database does not exist, it will be created. When the database is ready to use, it will
emit a ``opensuccess`` event. When the Database has been opened, you can start saving objects
into the store you defined in the schema.

.. sourcecode:: javascript

   database.on('opensuccess', function() {
      database.stores["objects"].put({
         "todo": "Learn how to use PlasmidDB",
         "done": false,
      })
   })

But, you'll probably want to know when the object has been stored successfully, because all
operations are asynchronous. When the object is stored, it will have a randomized ID associated.

.. sourcecode:: javascript

   database.on('opensuccess', function() {
      database.stores["objects"].put({
         "todo": "Learn how to use PlasmidDB",
         "done": false,
      }).then(function(object) {
         console.log("Stored object with ID: " + object._id)
      })
   })

After you've saved a few objects, you'll likely want to get them back out. The store provides easy
mechanisms to fetch the objects back out.

.. sourcecode:: javascript

   database.stores["objects"].fetch().then(function(results) {
      for (var i=0; i < results.length; i++) {
         let checkbox = results[i].done ? "☑" : "☐"
         console.log(checkbox + " " + results[i].todo)
      }
   })

If you have a considerably large number of results, you might want to walk over them individually
instead of waiting for the entire results to be collected for you in an arrar.

.. sourcecode:: javascript

   database.stores["objects"].walk().on('each', function(result) {
      let checkbox = result.done ? "☑" : "☐"
      console.log(checkbox + " " + result.todo)
   })

Of course, data doesn't stay stagnant and you'll want to update objects from time to time.

   function markTodoDone(todo) {
      item.done = true
      return database.stores["objects"].put(item)
   }


Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
