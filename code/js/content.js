/*global
	chrome
*/
;(function() {

	var $ = require('./libs/jquery');
	// here we use SHARED message handlers, so all the contexts support the same
	// commands. but this is NOT typical messaging system usage, since you usually
	// want each context to handle different commands. for this you don't need
	// handlers factory as used below. simply create individual `handlers` object
	// for each context and pass it to msg.init() call. in case you don't need the
	// context to support any commands, but want the context to cooperate with the
	// rest of the extension via messaging system (you want to know when new
	// instance of given context is created / destroyed, or you want to be able to
	// issue command requests from this context), you may simply omit the
	// `handlers` parameter for good when invoking msg.init()
	var handlers = require('./modules/handlers').create('ct');
	require('./modules/msg').init('ct', handlers);

	$('body').on('click', 'a.lozenge,a.external-link,.link-title,.pullrequest-link', function(e) {
		//if the user is holding down a meta key, they probably want a specific action
		//for example, command + click opens a tab in the background
		if(e.metaKey || e.ctrlKey) {
			return;
		}
		var url = e.currentTarget.href;
		chrome.runtime.sendMessage({url: url}, function(){});
		return false;
	});
})();
