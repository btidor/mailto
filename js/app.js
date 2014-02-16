(function() {
    var WEBATHENA_HOST = "https://webathena.mit.edu";
    var REALM = "ATHENA.MIT.EDU";
    var PRINCIPAL = [ "moira", "moira7.mit.edu" ];
    
    var LOGIN_ACTION = "Log In with Webathena";
    var LOGIN_ONGOING = "Logging In...";
    
    var login = $( "#login" );
    login.attr( "disabled", false );
    login.text( LOGIN_ACTION );
    $( "#landing" ).removeClass( "hidden" );

    /*
     * Display a visual alert to the user.
     *
     * @param title text to prefix the message in bold, or empty
     * @param message the message to display
     * @param type one of 'danger', 'warning', 'info', 'success'; controls the
     *        color of the alert
     * @param an optional tag, added as a class, to allow for batch dismissal
     *        via $( ".tag" ).close( "alert" );
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
            login.attr( "disabled", false );
            login.text( LOGIN_ACTION );
            
            if ( err ) {
                console.log( "Webathena returned err: " + err );
                if ( err == "unknown closed window" ) {
                    // User closed Webathena window. Take no action.
                } else {
                    alert( "Achtung!",
			   "An error occurred while communicating with Webathena.",
			   "danger", "alert-login" );
                }
                return;
            }
            if ( r.status !== "OK" ) {
                console.log( "Webathena returned r (" + r.status + "}:");
		console.log( r );
		if ( r.status == "DENIED" ) {
		    alert( "Login Failed.",
			   "I need \"mailing lists and groups\" access to change " +
			   "your forwarding settings.",
			   "warning", "alert-login");
		} else {
                    alert( "Achtung!",
			   "An error occurred while communicating with Webathena.",
			   "danger", "alert-login" );
		}
                return;
            }
	    $( ".alert-login" ).alert( "close" ); // dismiss earlier login errors
	    alert( "Success!", "", "success" );
        });
    });
})();