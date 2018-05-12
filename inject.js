if(document.querySelector("body").innerHTML.includes("Tickets go on sale soon.")){
    location.reload();
}
if(document.querySelector("body").innerHTML.includes("You are unable to access the checkout process. In most cases, this happens due to one of the following actions:")){
    chrome.runtime.sendMessage({action: "deleteCookie"}, function(response) {
        console.log("delete Cookie success.");
        location.reload();
      });
}