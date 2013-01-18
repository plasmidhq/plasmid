define(function(require, exports, module) {
    plasmid = require('plasmid');
    Promise = plasmid.Promise;

    appname = "Quotes";
    plasmid_api = window.location.protocol + '//' + window.location.host + '/v1/';
    credentials = new plasmid.Credentials({api: plasmid_api});

    bootstrap_credentials = new plasmid.Credentials({
        access: "guest-creator",
        secret: "knock-knock"
    });

    quotedb = new plasmid.Database({
        name: appname,
        api: plasmid_api,
        schema: {
            version: 1,
            stores: {
                quotes: {sync: true},
            }
        },
        credentials: credentials
    });

    quotedb.countQuotes = function() {
        return this.stores.quotes.count();
    };

    quotedb.addQuote = function(quote) {
        this.stores.quotes.put(null, {quote: quote});
    };

    quotedb.randomQuote = function() {
        var quotes = this.stores.quotes;
        var index, i=0;
        var promise = new Promise();
        this.countQuotes().then(set_index);
        return promise;

        function set_index(total) {
            index = parseInt(Math.random() * total);
            quotes.walk().on('each', function(item) {
                if (i === index) {
                    promise.ok(item.value);
                }
                i++;
            });
        };
    };

    exports.cred = credentials;
    exports.bootcred = bootstrap_credentials;
    exports.db = quotedb;

    $pairing = $('#pairing');
    $pairing_inputs = $pairing.find('input');
    
    quotedb.on('opensuccess', function() {
        // Do we already have credentials?
        var self = this;
        this.meta.get('credentials').then(function(saved_cred){
            credentials.access = saved_cred.access;
            credentials.secret = saved_cred.secret;

            quotedb.trigger('credentialsready', credentials);
        }).on('missing', function(){
            // Use the bootstrap creds to create new tokens
            credentials.credentials = bootstrap_credentials;
            credentials.create('guest').then(function(){
                self.meta.put('credentials', {
                    access: this.access,
                    secret: this.secret,
                });
                quotedb.trigger('credentialsready', credentials);
            });
        });

        showRandomQuote();
    });

    quotedb.on('credentialsready', function(cred){
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
        quotedb.drop().then(function(){
            var access = $pairing_inputs.eq(0).val() + $pairing_inputs.eq(1).val();
            var secret = $pairing_inputs.eq(2).val() + $pairing_inputs.eq(3).val();
            quotedb.forgetPushed()
            .then(function() {
                quotedb.meta('credentials', {
                    access: access, secret: secret
                })
            });
        });
    });

    function showRandomQuote() {
        quotedb.randomQuote().then(function(item){
            $('#quote').text(item.quote);
        });
    }

    $('#quote').click(showRandomQuote);
});
