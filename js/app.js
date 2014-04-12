(function() {
    var WEBATHENA_HOST = "https://webathena.mit.edu";
    var REALM = "ATHENA.MIT.EDU";
    var PRINCIPAL = [ "moira", "moira7.mit.edu" ];

    var SESSION_COOKIE = "mailto-session";

    var LOGIN_ACTION = "Log In with Webathena";
    var LOGIN_ONGOING = "Logging In...";

    var SPLIT_TEXT_NO = "Instead";
    var SPLIT_TEXT_YES = "In addition";

    var SPLIT_TIP_ENABLED = "click to change option";
    var SPLIT_TIP_DISABLED = "unfortunately, only one external forwarder is " +
        "supported";

    var splitting; // false if address should replace previous
    var splittable; // if another external address can be added
    var internaladdr; // the internal address, if any, or null
    var externaladdr; // the external address, if any, or null
    var username; // of current user

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
     * Helper function to show or hide the entry for a single mailbox.
     *
     * @param selector jQuery selector for the mailbox's line
     * @param mailbox object describing mailbox, from server response
     * @param split true iff mail is being split
     */
    function mailboxentry( selector, mailbox, split ) {
        if ( mailbox == null ) {
            $( selector ).hide();
            return;
        }

        $( selector ).show();
        $( selector ).find( ".fwdaddr" ).text( mailbox.address );
        if ( split )
            $( selector ).find( ".del" ).show();
        else
            $( selector ).find( ".del" ).hide();
    }

    /*
     * Helper function to guess URL of email provider given an email address.
     *
     * @param address address to examine
     */
    function guessprovider( address ) {
        var suffix = address.split("@")[1];
        return "https://www." + suffix + "/";
    }

    /*
     * Refresh the UI with a de-stringified (dictionary) response from the
     * server.
     *
     * @param response data from server
     */
    function updateui( response ) {
	console.log( response );
        $( "#lastmod-time" ).timeago( "update", response.modtime );
        $( "#lastmod-user" ).text( response.modby );

        var exchange = null;
        var imap = null;
        var smtp = null;
        for ( var i = 0; i < response.boxes.length; i++ ) {
            if ( !response.boxes[i].enabled )
                continue;

            if ( response.boxes[i].type == "EXCHANGE" )
                exchange = response.boxes[i];
            else if ( response.boxes[i].type == "IMAP" )
                imap = response.boxes[i];
            else if ( response.boxes[i].type == "SMTP" )
                smtp = response.boxes[i];
        }

        internaladdr = null;
        if ( exchange != null )
            internaladdr = exchange.address;
        else if ( imap != null )
            internaladdr = imap.address;

        externaladdr = null;
        if ( smtp != null)
            externaladdr = smtp.address;

        var split = ( smtp != null ) && ( internaladdr != null );

        mailboxentry( "#exchange", exchange, split );
        mailboxentry( "#imap", imap, split );
        mailboxentry( "#external", smtp, split );

        $( "#split-option" ).text( SPLIT_TEXT_NO );
        splitting = false;

        if ( smtp != null ) {
            $( "#external-link" ).attr( "href", guessprovider(
                smtp.address ) );
            $( "#split-option" ).data("bs.tooltip").options.title =
                SPLIT_TIP_DISABLED;
            splittable = false;
        } else {
            $( "#split-option" ).data("bs.tooltip").options.title =
                SPLIT_TIP_ENABLED;
            splittable = true;
        }

        if (split)
            $( "#editor" ).hide();
        else
            $( "#editor" ).show();

        $( "#new-address" ).val("");
    }

    /*
     * Update the UI to reflect that the user is logged in.
     *
     * @param session r.session returned by Webathena
     */
    function logmein( session ) {
	username = session.cname.nameString[0];

	// Dismiss earlier login errors
	$( ".alert-login" ).alert( "close" );

	// Put email address into relevant divs
	$( ".thisuser" ).text( username + "@mit.edu" );

	// Disable login button, just in case
	$( "#login" ).attr( "disabled", true);
	$( "#login" ).text( LOGIN_ONGOING );

	// Query to load results from API
	$.ajax({
	    type: "GET",
	    url: "./api/v1/" + username,
	}).done( function( response ) {
	    updateui( JSON.parse(response) );
	    $( "#landing" ).addClass( "hidden" );
	    $( "#app" ).removeClass( "hidden" );
	}).fail( function ( jqXHR ) {
	    alert( "API Error", jqXHR.statusText, "danger" );
	    console.log( "Request to API failed:" );
	    console.log( jqXHR );
	});
    }

    /* Reset Page on Load */
    $( ".timeago" ).timeago();
    $( "#split-option" ).tooltip();

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
    login.click( function( event ) {
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

    $( "#split-option" ).click( function( event ) {
        event.preventDefault();
        if ( !splittable )
            return;

        if ( splitting ) {
            $( "#split-option" ).text( SPLIT_TEXT_NO );
            splitting = false;
        } else {
            $( "#split-option" ).text( SPLIT_TEXT_YES );
            splitting = true;
        }
    });

    $( "#restore-default" ).click( function( event ) {
        event.preventDefault();
        $.ajax({
            type: "PUT",
            url: "./api/v1/" + username + "/reset",
        }).done( function( response ) {
            updateui( JSON.parse(response) );
        }).fail( function ( jqXHR ) {
            alert( "API Error", jqXHR.statusText, "danger" );
            console.log( "Request to API failed:" );
            console.log( jqXHR );
        });
    });

    $( "#update-form" ).submit( function( event ) {
        event.preventDefault();
        
        var update = $( "#new-address" ).val();
        if ( splitting )
            update = internaladdr + "/" + update

        $.ajax({
            type: "PUT",
            url: "./api/v1/" + username + "/" + update,
        }).done( function( response ) {
            updateui( JSON.parse(response) );
        }).fail( function ( jqXHR ) {
            alert( "API Error", jqXHR.statusText, "danger" );
            console.log( "Request to API failed:" );
            console.log( jqXHR );
        });
    });

    var delExternal = function( event ) {
        event.preventDefault();

        $.ajax({
            type: "PUT",
            url: "./api/v1/" + username + "/" + externaladdr,
        }).done( function( response ) {
            updateui( JSON.parse(response) );
        }).fail( function ( jqXHR ) {
            alert( "API Error", jqXHR.statusText, "danger" );
            console.log( "Request to API failed:" );
            console.log( jqXHR );
        });
    };
    $( "#exchange" ).find( ".del" ).click( delExternal );
    $( "#imap" ).find( ".del" ).click( delExternal );
    $( "#external" ).find( ".del" ).click( function( event ) {
        event.preventDefault();

        $.ajax({
            type: "PUT",
            url: "./api/v1/" + username + "/" + internaladdr,
        }).done( function( response ) {
            updateui( JSON.parse(response) );
        }).fail( function ( jqXHR ) {
            alert( "API Error", jqXHR.statusText, "danger" );
            console.log( "Request to API failed:" );
            console.log( jqXHR );
        });
    });
})();
