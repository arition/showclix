function deleteCookie() {
    chrome.cookies.getAll({
        domain: "www.showclix.com"
    }, function (cookies) {
        for (var i = 0; i < cookies.length; i++) {
            chrome.cookies.remove({
                url: "https://www.showclix.com" + cookies[i].path,
                name: cookies[i].name
            });
            console.log('removed ' + cookies[i].name + ' in ' + "www.showclix.com" + cookies[i].path)
        }
    });
    chrome.cookies.getAll({
        domain: ".showclix.com"
    }, function (cookies) {
        for (var i = 0; i < cookies.length; i++) {
            chrome.cookies.remove({
                url: "https://www.showclix.com" + cookies[i].path,
                name: cookies[i].name
            });
            console.log('removed ' + cookies[i].name + ' in ' + ".showclix.com" + cookies[i].path)
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