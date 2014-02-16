(function() {
    var WEBATHENA_HOST = "https://webathena.mit.edu";
    var REALM = "ATHENA.MIT.EDU";
    var PRINCIPAL = [ "moira", "moira7.mit.edu" ];

    var SESSION_COOKIE = "mailto-session";

    var LOGIN_ACTION = "Log In with Webathena";
    var LOGIN_ONGOING = "Logging In...";

    // Automatically JSON-encode/decode objects into cookies
    $.cookie.json = true;

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
	    type: "POST",
	    url: "./api/list",
	    data: { session: $.cookie( SESSION_COOKIE ) },
	}).done( function( msg ) {
	    alert( "Success!", msg, "success" );
	}).fail( function ( jqXHR ) {
	    alert( "API Error", jqXHR.statusText, "danger" );
	    console.log("Request to ./api/list failed:")
	    console.log(jqXHR);
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
