define(function(require, exports, module) {
    plasmid = require('plasmid');

    appname = "APPNAME";
    plasmid_api = window.location.protocol + '//' + window.location.host + '/v1/';
    credentials = new plasmid.Credentials({api: plasmid_api});

    bootstrap_credentials = new plasmid.Credentials({
        access: "guest-creator",
        secret: "knock-knock"
    });

    appdb = new plasmid.Database({
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

    $pairing = $('#pairing');
    $pairing_inputs = $pairing.find('input');
    
    appdb.on('opensuccess', function() {
        // Do we already have credentials?
        var self = this;
        this.meta.get('credentials').then(function(saved_cred){
            credentials.access = saved_cred.access;
            credentials.secret = saved_cred.secret;

            appdb.trigger('credentialsready', credentials);
        }).on('missing', function(){
            // Use the bootstrap creds to create new tokens
            credentials.credentials = bootstrap_credentials;
            credentials.create('guest').then(function(){
                self.meta.put('credentials', {
                    access: this.access,
                    secret: this.secret,
                });
                appdb.trigger('credentialsready', credentials);
            });
        });
    });

    appdb.on('credentialsready', function(cred){
        var parts = [];
        parts.push(cred.access.slice(0, 4));
        parts.push(cred.access.slice(4, 8));
        parts.push(cred.secret.slice(0, 4));
        parts.push(cred.secret.slice(4, 8));
        
        for (var i=0; i < parts.length; i++) {
            $pairing.find('input').eq(i).val(parts[i]);
        }
    });

    $('#pairing-close').click(function() {
        $pairing.hide();
    });
    $('#pairing-clear-and-pair').click(function() {
        $pairing_inputs.val('');
        $pairing_inputs.eq(0).focus();
        $('#pairing-new-code').show();
    });
    $('#pairing-new-code').click(function() {
        appdb.drop().then(function(){
            var access = $pairing_inputs.eq(0).val() + $pairing_inputs.eq(1).val();
            var secret = $pairing_inputs.eq(2).val() + $pairing_inputs.eq(3).val();
            appdb.forgetPushed()
            .then(function() {
                appdb.meta('credentials', {
                    access: access, secret: secret
                })
            });
        });
    });
});
