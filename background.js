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

var currentTab = null;
var showclix_re = new RegExp('^https?://www.showclix.com/');
var event_re = new RegExp('^https?://www.showclix.com/event/[^/]+(/$|$|/listing$)');
var pyos_re = new RegExp('^https?://www.showclix.com/event/[^/]+/pyos$');

function selectSeats(tab) {
  var current_url = tab.url;
  currentTab = tab;

  chrome.tabs.sendMessage(tab.id, {
    msg: "selectSeats"
  }, function (response) {
    console.log(tab.id + " " + current_url);
    console.log(response);
  });
}

chrome.browserAction.onClicked.addListener(function(tab) {
    //if (tab.url != null && pyos_re.exec(tab.url) && tab == currentTab) {
    if (tab.url != null && pyos_re.exec(tab.url)) {
        currentTab = tab;
        selectSeats(tab);
    }
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    //console.log("Tab updated: " + tabId + ", status: " + changeInfo.status);
    if (changeInfo.status === "complete" && tab.active && tab.url) {
        currentTab = tab;
        /*if (tab.url != null && showclix_re.exec(tab.url) && tab != currentTab) {*/
            //chrome.tabs.executeScript(tab.id, {
                //file: 'jquery-3.3.1.min.js'
            //}, function() {
                //chrome.tabs.executeScript(tab.id, {
                    //file: 'inject.js'
                //}, function() {
                    //currentTab = tab;
                    //console.log("Content Script has been injected into " + tab.url);
                //});
            //});
        /*}*/
    }
});

