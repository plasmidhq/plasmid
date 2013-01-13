define(function(require, exports, module) {

    var plasmid = require('plasmid');

    var appname = "APPNAME";
    var plasmid_api = window.location.protocol + '//' + window.location.host + '/v1/';
    var credentials = new plasmid.Credentials({api: plasmid_api});

    var bootstrap_credentials = new plasmid.Credentials({
        access: "guest-creator",
        secret: "knock-knock"
    });

    var appdb = new plasmid.Database({
        name: appname,
        api: plasmid_api,
        schema: {
            version: 1,
            stores: {
                // define stores here
            }
        },
        credentials: credentials
    });

    exports.cred = credentials;
    exports.bootcred = bootstrap_credentials;
    exports.db = appdb;
    
    appdb.on('opensuccess', function() {
        // Do we already have credentials?
        this.meta.get('credentials').then(function(saved_cred){
            credentials.access = saved_cred.access;
            credentials.secret = saved_cred.secret;

            appdb.trigger('credentialsraedy', credentials);
        }).on('missing', function(){
            // Use the bootstrap creds to create new tokens
            credentials.credentials = bootstrap_credentials;
            credentials.create('guest').then(function(){
                appdb.trigger('credentialsready', credentials);
            });
        });
    });

    appdb.on('credentialsready', function (saved_cred) {
        console.log('cred', saved_cred);
    });

});
