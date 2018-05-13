var MAX_NUM_SEATS_PER_ROW = 1000;

var seatsio_public_key = null;
var token = null;
var event_id = null;

// An example to access seat:
//   var seat = seatInfo['ADA LOGE']['LOGE U'][101];
// An example of seat object:
//   {uuid: "uuid41775", x: 419.74, y: 536.64}
var seatInfo = {};

// uuid => Availability
var seatAvailability = {};

function getSeatAvailability() {
    var OBJECT_STATUSES_URL = "https://api.seats.io/system/public/" + seatsio_public_key + "/events/object-statuses?event_key=" + event_id;
    return fetch(OBJECT_STATUSES_URL, {
        credentials: 'include'
    }).then(function (response) {
        return response.json();
    }).then(function (data) {
        for (var i = 0; i < data.length; i++) {
            var seat = data[i];
            seatAvailability[seat.objectLabelOrUuid] = seat.status;
        }
    })
}

function getSeatInfo() {
    var CHART_AND_RENDERING_INFO_URL = "https://api.seats.io/system/public/" + seatsio_public_key + "/chart-and-rendering-info?event_key=" + event_id;
    return fetch(CHART_AND_RENDERING_INFO_URL, {
        credentials: 'include'
    }).then(function (response) {
        return response.json();
    }).then(function (data) {
        var rows = data.chart.subChart.rows;
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var rowLabel = row.label;
            var seats = row.seats;
            for (var j = 0; j < seats.length; j++) {
                var seat = seats[j];
                if (!seatInfo[seat.categoryLabel]) {
                    seatInfo[seat.categoryLabel] = {};
                }
                if (!seatInfo[seat.categoryLabel][rowLabel]) {
                    seatInfo[seat.categoryLabel][rowLabel] = new Array(MAX_NUM_SEATS_PER_ROW);
                }
                seatInfo[seat.categoryLabel][rowLabel][parseInt(seat.label)] = {
                    uuid: seat.uuid,
                    x: seat.x,
                    y: seat.y,
                    availability: seatAvailability[seat.uuid]
                };
            }
        }
        console.log(seatInfo);
    })
}

var uuid2row = {};
var uuid2column = {};

function parseSeats() {
    var row2seats = cat2row2seats['ORCHESTRA'];
    for (var row in row2seats) {
        var seats = row2seats[row];
        for (var i = 0; i < seats.length; i++) {
            var seat = seats[i];
            for (var column in seat) {
                var uuid = seat[column];
                uuid2row[uuid] = row;
                uuid2column[uuid] = column;
            }
        }
    }
}

parseSeats();
//console.log(uuid2row);

window.addEventListener("load", function () {
    var match = null;

    var event_re = new RegExp('^/event/[^/]+($|/listing$)');
    match = event_re.exec(window.location.pathname);
    if (match) {
        // We are in event page now
        try_reload_event_page();
        fastPoll();
        var click_interval = window.setInterval(function () {
            if (click_select_seats()) {
                window.clearInterval(click_interval);
            }
        }, 1000);
    }

    var pyos_re = new RegExp('^/event/[^/]+/pyos$');
    match = pyos_re.exec(window.location.pathname);
    if (match) {
        getBasicVars();
        getSeatAvailability().then(getSeatInfo());
        //reserveSeats(["uuid43073", "uuid43074"]);

        var iframe_interval = window.setInterval(function () {
            var iframe = document.querySelector("#seatsio-seating-chart > iframe");
            if (iframe) {
                // TODO: We need to insert code into the iframe
                // Maybe we can write a separate content script
                //var innerDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframe.addEventListener("load", function () {
                    //var canvas = innerDoc.querySelector("#chartContainer > canvas");
                    //console.log(canvas);
                });
                window.clearInterval(iframe_interval);
            }
        }, 1000);
    }
});

function try_reload_event_page() {
    if (document.querySelector("body").innerHTML.includes("Tickets go on sale soon.") ||
        document.querySelector("body").innerHTML.includes("You can access this event page multiple times")) {
        location.reload();
    }
    if (document.querySelector("body").innerHTML.includes("You are unable to access the checkout process. In most cases, this happens due to one of the following actions:")) {
        chrome.runtime.sendMessage({
            action: "deleteCookie"
        }, function (response) {
            console.log("delete Cookie success.");
            location.reload();
        });
    }
}

function click_select_seats() {
    var submit = document.querySelector("#submit_pyos_request_2");
    if (submit != null) {
        console.log("click_select_seats");
        submit.click();
        return true;
        /*if (document.querySelector("#pyos_request") != null) {*/
        //document.querySelector("#pyos_request").remove();
        //}
        //document.querySelector("#ticket-form").insertAdjacentHTML('beforeend', '<input type="hidden" name="pyos_request" id="pyos_request" value="1" />');
        /*document.querySelector("#ticket-form").submit();*/
    }
    return false;
}

function fastPoll() {
    var user_token = null;
    var re = new RegExp('var user_token = "([^"]*)";');
    var scripts = document.querySelectorAll("script");
    for (var i = 0; i < scripts.length; i++) {
        var s = scripts[i];
        var html = s.innerHTML;
        var match = re.exec(html);
        if (match !== null) {
            user_token = match[1];
            console.log(user_token);
            break;
        }
    }

    var event_url = window.location.pathname;
    var poll_url = event_url + '/poll.php';
    var pollTime = 1E3;
    if (user_token !== null) {
        window.setInterval(function () {
            pollServer(poll_url, user_token);
        }, pollTime);
        var s = document.createElement("script");
        s.innerHTML = "function pollServer() { console.log(\"customPollServer()!\"); }";
        document.head.appendChild(s);
    }
}

function pollServer(url, user_token) {
    $.get(url, {
        token: user_token,
        tag: undefined
    }, function (a) {
        a = jQuery.parseJSON(a);
        if (a.status === 1) reloadPage();
        var b = $("#alert").text().length;
        if (a.message.length === 0) $("#alert").fadeOut("slow");
        else if (a.message.length !== 0 && a.message !== $("#alert").text()) {
            if (b > 0) $("#alert").fadeOut("slow", function () {
                $("#alert").fadeIn("slow").text(a.message);
            });
            else {
                $("#alert").fadeIn("slow");
            }
        }
    })
}

function reloadPage() {
    window.location.reload(true)
}

function getBasicVars() {
    var re_seatsio_public_key = new RegExp('seatsio_public_key *: *\'(.*?)\'');
    var re_token = new RegExp('var token *= *\'(.*?)\';');
    var re_event_id = new RegExp('var event_id *= *(.*?);');
    var scripts = document.querySelectorAll("script");
    for (var i = 0; i < scripts.length; i++) {
        var s = scripts[i];
        var html = s.innerHTML;
        var match = re_seatsio_public_key.exec(html);
        if (match !== null) {
            seatsio_public_key = match[1];
            console.log("seatsio_public_key: " + seatsio_public_key);
            match = re_token.exec(html);
            token = match[1];
            console.log("token: " + token);
            match = re_event_id.exec(html);
            event_id = match[1];
            console.log("event_id: " + event_id);
            break;
        }
    }
}

function reserveSeats(seatsUuidArray) {
    var hold_tokens_url = "https://api.seats.io/system/public/" + seatsio_public_key + "/hold-tokens";
    var ticket_url = "https://www.showclix.com/areservation/" + token + "/tickets?captured_via=online";
    var select_seat_url = "https://api.seats.io/system/public/" + seatsio_public_key + "/seasons/actions/hold-objects";
    fetch(hold_tokens_url, {
        method: 'POST',
        credentials: 'include'
    }).then(function (response) {
        return response.json();
    }).then(function (json) {
        var holdToken = json.holdToken;
        console.log("holdToken: " + holdToken);
        return Promise.all(seatsUuidArray.map(function (seatsUuid) {
            return fetch(ticket_url, {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({
                    "tickets": [{
                        "event_id": event_id,
                        "event_seat_ids": [seatsUuid],
                        "data": {
                            "reserve_type": "Seat"
                        }
                    }],
                    "seatsioReservationToken": holdToken,
                    "category": "ORCHESTRA"
                })
            }).then(function (response) {
                if (!response.ok) {
                    throw Error(response.statusText);
                }
                return response;
            }).then(function (response) {
                return response.json();
            }).then(function () {
                return fetch(select_seat_url, {
                    method: 'POST',
                    credentials: 'include',
                    body: JSON.stringify({
                        "events": [event_id],
                        "holdToken": holdToken,
                        "objects": [{
                            "objectId": seatsUuid
                        }]
                    })
                })
            }).then(function (response) {
                // ignore error from seatio
                /*if (!response.ok) {
                    throw Error(response.statusText);
                }
                return response;*/
            }).catch(function (error) {
                console.error('Error: reserve seat ' + seatsUuid + ' failed, ', error);
            })
        }))
    }).then(function () {
        console.log("reserve success.");
    })
}