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
  if (tab.url != null && tab.url.includes("showclix.com")) {
    selectSeats(tab);
  }
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  //console.log("Tab updated: " + tabId + ", status: " + changeInfo.status);
  if (changeInfo.status === "complete" && tab.active && tab.url) {
    currentTab = tab;
    /*chrome.tabs.executeScript(tab.id, {*/
      //file: 'inject.js'
    //}, function() {
      //console.log("Content Script has been injected into " + tab.url);
    /*});*/
  }
});

