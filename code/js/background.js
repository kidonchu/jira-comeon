/*global
	chrome
*/
;(function() {
	chrome.runtime.onMessage.addListener(
		function(request, sender, sendResponse) {
			if (request.url !== null) {
				chrome.tabs.query({
					active: true
				}, function(tabs) {
					var index = tabs[0].index;
					chrome.tabs.create({
						"url": request.url,
						"index": index + 1
					});
				});
			}
		}
	);
})();
