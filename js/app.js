(function() {
    var WEBATHENA_HOST = "https://webathena.mit.edu";
    var REALM = "ATHENA.MIT.EDU";
    var PRINCIPAL = [ "moira", "moira7.mit.edu" ];

    var SESSION_COOKIE = "mailto-session";

    var LOGIN_ACTION = "Log In with Webathena";
    var LOGIN_ONGOING = "Logging In...";

    // Automatically JSON-encode/decode objects into cookies
    $.cookie.json = true;

    // Activate timeago plugin
    $( ".timeago" ).timeago();

    /*
     * Display a visual alert to the user.
     *
     * @param title text to prefix the message in bold, or empty
     * @param message the message to display; text only
     * @param type one of "danger", "warning", "info", "success"; controls the
     *        color of the alert
     * @param an optional tag, added as a class, to allow for batch dismissal
     *        via $( ".tag" ).alert( "close" );
     */
    function alert( title, message, type, tag ) {
        var element = $( "#alert" ).clone();

        element.prop( "id", "" );
        element.find( ".error-title" ).text( title );
        element.find( ".error-text" ).text( message );

	if ( typeof( tag ) !== "undefined" ) element.addClass( tag );
        element.addClass( "alert-" + type );
        element.removeClass( "hidden" );
        $( "#alert" ).after( element );
    }

    /*
     * Refresh the UI with a de-stringified (dictionary) response from the
     * server.
     */
    function updateui( response ) {
	console.log( response );
        $( "#lastmod-time" ).timeago( "update", response.modtime );
        $( "#lastmod-user" ).text( response.modby );

        var exchange = null;
        var imap = null;
        var smtp = null;
        for ( var i = 0; i < response.boxes.length; i++ ) {
            if ( response.boxes[i].type == "EXCHANGE" )
                exchange = response.boxes[i];
            else if ( response.boxes[i].type == "IMAP" )
                imap = response.boxes[i];
            else if ( response.boxes[i].type == "SMTP" )
                smtp = response.boxes[i];
        }

        var multiHosted = ( imap != null && exchange != null );

        if ( exchange == null ) {
            $( "#exchange" ).addClass( "hidden" );
        } else {
            $( "#exchange" ).removeClass( "hidden" );
            $( "#exchange-address" ).text( exchange.address );
            if ( multiHosted ) {
                if ( exchange.enabled ) {
                    $( "#exchange-selected" ).removeClass( "hidden" );
                    $( "#exchange-select" ).addClass( "hidden" );
                } else {
                    $( "#exchange-selected" ).addClass( "hidden" );
                    $( "#exchange-select" ).removeClass( "hidden" );
                }
            } else {
                $( "#exchange-selected" ).addClass( "hidden" );
                $( "#exchange-select" ).addClass( "hidden" );
            }
        }

        if ( imap == null ) {
            $( "#imap" ).addClass( "hidden" );
        } else {
            $( "#imap" ).removeClass( "hidden" );
            $( "#imap-address" ).text( imap.address );
            if ( multiHosted ) {
                if ( imap.enabled ) {
                    $( "#imap-selected" ).removeClass( "hidden" );
                    $( "#imap-select" ).addClass( "hidden" );
                } else {
                    $( "#imap-selected" ).addClass( "hidden" );
                    $( "#imap-select" ).removeClass( "hidden" );
                }
            } else {
                $( "#imap-selected" ).addClass( "hidden" );
                $( "#imap-select" ).addClass( "hidden" );
            }
        }

        if ( ( exchange == null || !exchange.enabled ) &&
             ( imap == null || !imap.enabled ) ) {
            $( "#hosted-toggle" ).text( "Enable" );
            $( "#hosted-panel" ).addClass( "panel-disabled" );
        } else {
            $( "#hosted-toggle" ).text( "Disable" );
            $( "#hosted-panel" ).removeClass( "panel-disabled" );
        }

        if ( smtp == null ) {
            $( "#external-toggle" ).text( "Enable" );
            $( "#external-panel" ).addClass( "panel-disabled" );
            $( "#external" ).addClass( "hidden" );
        } else {
            $( "#external-toggle" ).text( "Disable" );
            $( "#external-panel" ).removeClass( "panel-disabled" );
            $( "#external" ).removeClass( "hidden" );
            $( "#external-prefix" ).text( smtp.address.split( "@" )[0] );
            $( "#external-domain" ).text( "@" + smtp.address.split( "@" )[1] );
        }
        console.log( "Exchange: " + exchange );
        console.log( "IMAP: " + imap );
        console.log( "SMTP: " + smtp );
    }

    /*
     * Update the UI to reflect that the user is logged in.
     *
     * @param session r.session returned by Webathena
     */
    function logmein( session ) {
	var username = session.cname.nameString[0];

	// Dismiss earlier login errors
	$( ".alert-login" ).alert( "close" );

	// Put username into relevant divs
	$( ".username" ).text( username );

	// Hide previous view, show next view
	$( "#landing" ).addClass( "hidden" );
	$( "#app" ).removeClass( "hidden" );

	// Disable login button, just in case
	$( "#login" ).attr( "disabled", true);
	$( "#login" ).text( LOGIN_ONGOING );
	
	// Query to load results from API
	$.ajax({
	    type: "GET",
	    url: "./api/v1/" + username,
	}).done( function( response ) {
	    updateui( JSON.parse(response) );
	}).fail( function ( jqXHR ) {
	    alert( "API Error", jqXHR.statusText, "danger" );
	    console.log( "Request to API failed:" );
	    console.log( jqXHR );
	});
    }

    /* Reset Page on Load */
    var login = $( "#login" );
    login.attr( "disabled", false );
    login.text( LOGIN_ACTION );
    $( "#landing" ).removeClass( "hidden" );

    var session = $.cookie( SESSION_COOKIE );
    if ( session !== undefined ) {
	console.log( "Loading session from cookie..." );
	logmein( session );
    }

    /* Button Handlers */
    login.click(function( event ) {
        event.preventDefault();
	login.attr( "disabled", true );
        login.text( LOGIN_ONGOING );

        WinChan.open({
            url: WEBATHENA_HOST + "/#!request_ticket_v1",
            relay_url: WEBATHENA_HOST + "/relay.html",
            params: {
                realm: REALM,
                principal: PRINCIPAL
            }
        }, function( err, r ) {
            if ( err ) {
                login.attr( "disabled", false );
                login.text( LOGIN_ACTION );

                console.log( "Webathena returned err: " + err );
                if ( err.indexOf( "closed window" ) != -1 ) {
                    // User closed Webathena window. Take no action.
                } else {
                    alert( "Achtung!",
                           "An error occurred while communicating with Webathena.",
                           "danger", "alert-login" );
                }
                return;
            }
            if ( r.status !== "OK" ) {
                login.attr( "disabled", false );
                login.text( LOGIN_ACTION );

                console.log( "Webathena returned r (" + r.status + "}:");
                console.log( r );
                if ( r.status == "DENIED" ) {
                    alert( "Login Failed.",
                           "I need \"mailing lists and groups\" access in order " +
                           "to change your forwarding settings.",
                           "warning", "alert-login");
                } else {
                    alert( "Achtung!",
                           "An error occurred while communicating with Webathena.",
                           "danger", "alert-login" );
                }
                return;
            }

            // Success! Put session information into a cookie and update UI
            console.log( "Login succeeded." );
            $.cookie( SESSION_COOKIE , r.session, {
                secure: true
            });
            logmein( r.session );
        });
    });
})();
