function deleteCookie() {
    chrome.cookies.getAll({
        domain: "www.showclix.com"
    }, function (cookies) {
        for (var i = 0; i < cookies.length; i++) {
            chrome.cookies.remove({
                url: "http://www.showclix.com" + cookies[i].path,
                name: cookies[i].name
            });
        }
    });
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action == "deleteCookie") {
        deleteCookie();
        sendResponse({
            result: "success"
        });
    }
});