var MAX_NUM_ROWS = 100;
var MAX_NUM_SEATS_PER_ROW = 1000;
var CATEGORY_WHITELIST = new Set(['ORCHESTRA', 'LOGE']);

var seatsio_public_key = null;
var token = null;
var event_id = null;

// An example to access seat:
//   var seat = seatInfo['ADA LOGE'][1][101];
// An example of seat object:
//   {uuid: "uuid30027", rowLabel: "B", x: 2120.26, y: 2018.62, availability: "held"}
var seatInfo = {};

// uuid => Availability
var seatAvailability = {};

var NumberOfSeats = 2;

function onMessage(data, sender, sendResponse) {
    console.log(data);
    if (data.msg === 'selectSeats') {
        // TODO: Remove some of the selected seats if we need to book more
        // XXX: DO NOT click CANCEL RESERVATION, we may lose position in the queue
        selectSeats(false, NumberOfSeats);
        response = {
            msg: "SeatsSelected",
            url: document.location.toString(),
            title: document.title,
        };
        sendResponse(response);
    } else {
        console.error('Unknown message received from background: ' + data.msg);
    }
}

chrome.runtime.onMessage.addListener(onMessage);

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

var uuid2row = {};
var uuid2seat = {};
var uuid2category = {};

function letterToNum(letter) {
    var num = letter.charCodeAt(0);
    if (65 <= num && num <= 72) { // A-H
        num = num - 65;
    } else if (74 <= num && num <= 79) { // J-N
        num = num - 66;
    } else if (80 <= num && num <= 90) { // P-Z
        num = num - 67;
    } else {
        num = -1;
    }
    return num;
}

// Returns -1 if unable to parse.
function rowToNum(category, row) {
    if (category == 'ORCHESTRA') { // A-H,J-N,P-Z,AA-HH,JJ-NN,PP-ZZ
        var num = letterToNum(row.charAt(0));
        if (row.length == 1) {
            return num;
        } else if (row.length == 2 && num >= 0) {
            return num - 2 + 26;
        }
    } else if (category == 'LOGE') { // LOGE A-LOGE H,LOGE J-LOGE N,LOGE P-LOGE Z. Unable to parse row label 'T', I cannot find where it is.
        return letterToNum(row.charAt(5));
    }
    return -1;
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
            var seats = row.seats;
            var category = null;
            if (seats.length > 0) {
                category = seats[0].categoryLabel;
            }
            if (!CATEGORY_WHITELIST.has(category)) {
                continue;

            }
            var rowNum = rowToNum(category, row.label);
            if (rowNum < 0) {
                console.log('Unable to parse row number (' + category + ',' + row.label + ')');
                continue;
            }
            for (var j = 0; j < seats.length; j++) {
                var seat = seats[j];
                if (!seatInfo[category]) {
                    seatInfo[category] = new Array(MAX_NUM_ROWS);
                }
                if (!seatInfo[category][rowNum]) {
                    seatInfo[category][rowNum] = new Array(MAX_NUM_SEATS_PER_ROW);
                }
                seatInfo[category][rowNum][parseInt(seat.label)] = {
                    uuid: seat.uuid,
                    rowLabel: row.label,
                    x: seat.x,
                    y: seat.y,
                    availability: seatAvailability[seat.uuid]
                };
                uuid2category[seat.uuid] = category;
                uuid2row[seat.uuid] = row.label;
                uuid2seat[seat.uuid] = seat.label;
            }
        }
        //console.log(seatInfo);
        // XXX: We need to return something as a promise
        return seatInfo;
    });
}

function parseSeats() {
    var row2seats = cat2row2seats['ORCHESTRA'];
    for (var row in row2seats) {
        var seats = row2seats[row];
        for (var i = 0; i < seats.length; i++) {
            var seat = seats[i];
            for (var column in seat) {
                var uuid = seat[column];
                uuid2row[uuid] = row;
                uuid2seat[uuid] = column;
            }
        }
    }
}

//parseSeats();
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
        getSeatInfo().then(function (data) {
            // XXX: We might need to call this after the iFrame has loaded
            //selectSeats(true, 1);
        });

        var iframe_load_count = 0;
        var iframe_interval = window.setInterval(function () {
            iframe_load_count++;
            var iframe = document.querySelector("#seatsio-seating-chart > iframe");
            if (iframe) {
                selectSeats(false, NumberOfSeats);

                //var innerDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframe.addEventListener("load", function () {
                    // XXX: Only reserve after the iframe has been loaded
                    //reserveSeats(["uuid43073", "uuid43074"]);
                });
                window.clearInterval(iframe_interval);
            }
            // Reload page after 5 seconds
            else if (iframe_load_count > 5) {
                reloadPage();
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
    return fetch(hold_tokens_url, {
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
            }).then(function () {
                return seatsUuid;
            }).catch(function (error) {
                console.error('Error: reserve seat ' + seatsUuid + ' failed, ', error);
            })
        }))
    }).then(function (results) {
        console.log("reserve success: ", results);
        $("#js-continue").show();
        var iframe = document.querySelector("#seatsio-seating-chart > iframe");
        // Uncomment to reload iframe
        iframe.src = iframe.src;

        results = results.filter(result => result != undefined || result != null);
        $("#order_details_table > tbody").innerHTML = "";
        var total = 0;
        results.forEach(function(uuid) {
            var tid = "test"; // TODO: Get ticket id
            var category = uuid2category[uuid];
            var row = uuid2row[uuid];
            var seat = uuid2seat[uuid];
            var rowHTML = '<tr id = "ticket-' + tid + '"><td class="left">' + category + '</td>';
            rowHTML += '<td>' + row + '</td><td>' + seat + '</td><td class="left" style="width:150px"></td>';
            var price = 60.00;
            var fee = 3.00;
            if (category == "ORCHESTRA") {
                price = 85.00;
                fee = 4.13;
            }
            total += price;
            total += fee;
            rowHTML += '<td><span class="monetary">$' + price + '</span></td><td class="monetary">$' + fee + '</td>';
            rowHTML += '<td><a href="#" class="remove-btn">Remove Reservation</a></td></tr>'
            $("#order_details_table > tbody").append(rowHTML);
        });
        $("#seat_selected > header > div > span")[0].innerText = results.length;
        $("#seat_selected > footer > div > div > h2 > strong")[0].innerText = "$"+total;

        return results;
    })
}

function sortRow(a,b) {
    a = parseInt(a);
    b = parseInt(b);
    return a-b;
}

function sortColumnInSameRow(a,b) {
    a = parseInt(a);
    b = parseInt(b);
    a_f = Math.floor(a/100);
    b_f = Math.floor(b/100);

    result = Math.abs(a_f - 3) - Math.abs(b_f - 3);
    if (result == 0) {
        if (a_f == 3) {
            // TODO: Slect the central or isle seats?
            // How do you know the central seat without knowing the row?
            return a - b;
        }
        else {
            return a - b;
        }
    }
    else {
        // XXX: 2XX == 4XX !!!
        return result;
    }
}

function sortColumnInSameRowAndBlock(a,b) {
    a = parseInt(a);
    b = parseInt(b);
    return a - b;
}

function sortBlock(a,b) {
    a = parseInt(a);
    b = parseInt(b);
    a_f = Math.floor(a/100);
    b_f = Math.floor(b/100);

    // XXX: 2XX == 4XX !!!
    result = Math.abs(a_f - 3) - Math.abs(b_f - 3);
    return result;

    if (result == 0) {
        return a_f - b_f;
    }
    return result;
}

function sortSeat(a,b) {
    sort_by_block = sortBlock(parseInt(a.seat), parseInt(b.seat));
    if (sort_by_block == 0) {
        sort_by_row = sortRow(parseInt(a.row), parseInt(b.row));
        if (sort_by_row == 0) {
            return sortColumnInSameRowAndBlock(parseInt(a.seat), parseInt(b.seat));
        }
        return sort_by_row;
    }
    return sort_by_block;
}

function selectSeats(first_time = false, N=2) {
    getSeatAvailability().then(function () {
        removeSelection(true);
        console.log(seatInfo);

        //var selected_uuids = selectSeatsStrategy1(N);

        var selected_uuids = selectSeatsStrategy2(N);

        console.log("Selected: " + selected_uuids);

        if (first_time == false) {
            //reserveSeats(["uuid43073", "uuid43074"]);
            reserveSeats(selected_uuids);
        }
    });
}

function selectSeatsStrategy1(N) {
    var selected_uuids = [];
    var row2seats = seatInfo["ORCHESTRA"];
    var sorted_rows = [];
    for (var row in row2seats) {
        sorted_rows.push(parseInt(row));
    }
    sorted_rows.sort((a, b) => a - b);
    console.log(sorted_rows);
    for (var i = 0; i < sorted_rows.length; i++) {
        if (selected_uuids.length > 0) {
            break;
        }
        var row = sorted_rows[i];
        var seats = row2seats[row];
        var sorted_seats = [];
        for (var seat in seats) {
            sorted_seats.push(seat);
        }
        // TODO: Sort by block, e.g., 3XX > 2XX = 4XX > 1XX = 5XX
        // Sort by distance to central stage, e.g.,
        // Block 1XX: 101 > 128, 201 > 208, 301 > 308, 401 > 408
        // Block 3XX: 301 = 328 > 302 = 327 > ...
        // XXX: Some rows may have less than 28 seats!!!

        sorted_seats.sort(sortColumnInSameRow);
        //console.log(sorted_seats);
        for (var j = 0; j < sorted_seats.length-N+1; j++) {
            var seat = sorted_seats[j]; // The column number

            // Comment if you want to select from non central blocks
            //if (seat < 300 || seat >= 400) {
                //continue;
            var uuid = seats[seat].uuid;
            var seat_status = seatAvailability[uuid];
            //console.log(row, seat, uuid, seat_status);
            if (seat_status != "free") {
                continue;
            }

            var flag = true;
            for (var k = 1; k < N; k++) {
                var seat_ = sorted_seats[j+k]; // The column number
                var uuid_ = seats[seat_].uuid;
                var seat_status_ = seatAvailability[uuid_];
                console.log(row, s, uuid_, seat_status_);
                if ((seat_status_ != "free") || (Math.floor(seat/100) != Math.floor(seat_/100))) {
                    flag = false;
                    break;
                }
            }
            if (flag == true) {
                for (var k = 0; k < N; k++) {
                    var s = sorted_seats[j+k];
                    var uuid_ = seats[s].uuid;
                    selected_uuids.push(uuid_);
                }
                break;
            }
        }
    }
    return selected_uuids;
}

function selectSeatsStrategy2(N) {
    var selected_uuids = [];
    var row2seats = seatInfo["ORCHESTRA"];
    var all_seats = [];
    for (var row in row2seats) {
        var seats = row2seats[row];
        for (var seat in seats) {
            var s = {
                row: row,
                seat: seat,
                uuid: seats[seat].uuid,
                status: seatAvailability[seats[seat].uuid]
            };
            all_seats.push(s);
        }
    }
    all_seats.sort(sortSeat);

    for (var j = 0; j < all_seats.length-N+1; j++) {
        var s = all_seats[j]; // The "seat" object
        var uuid = s.uuid;
        var seat_status = seatAvailability[uuid];
        //console.log(row, seat, uuid, seat_status);
        if (seat_status != "free") {
            continue;
        }
        console.log("Start:", s, seat_status, "Seats:", all_seats.slice(Math.max(0, j-5), Math.min(all_seats.length, j+5)));

        var flag = true;
        for (var k = 1; k < N; k++) {
            var s_ = all_seats[j+k]; // The "seat" object
            var uuid_ = s_.uuid;
            var seat_status_ = seatAvailability[uuid_];
            console.log(s_, seat_status_);
            if ((seat_status_ != "free") || (Math.floor(s.seat/100) != Math.floor(s_.seat/100)) || s.row != s_.row) {
                flag = false;
                break;
            }
        }
        if (flag == true) {
            for (var k = 0; k < N; k++) {
                var s = all_seats[j+k];
                var uuid_ = s.uuid;
                selected_uuids.push(uuid_);
            }
            break;
        }
    }
    return selected_uuids;
}



// XXX: This method is not reliable as it tries to click multiple buttons.
// However, this can trigger a bug of showclix allowing us to select more than 4 seats.
// In the checkout page, all the seats will be canceled if there are more than 4 seats that are selected!!!
function removeSelection(all=true) {
    // We need to click more than once to remove one reserved seat
    var a = $("#order_details_table > tbody > tr > td:nth-child(7) > a");
    if (a[0]) {
        a[0].click();
    }

    if (all) {
        $("#order_details_table > tbody > tr > td:nth-child(7) > a").each(function (index) {
            console.log("Removing: ", index, $(this));
            $(this).click();
        });
        $("#order_details_table > tbody > tr > td:nth-child(7) > a").each(function (index) {
            console.log("Removing: ", index, $(this));
            $(this).click();
        });
    }
    else {
        var a = $("#order_details_table > tbody > tr > td:nth-child(7) > a");
        if (a[0]) {
            a[0].click();
            console.log("Removing: ", a);
        }
    }
    var iframe = document.querySelector("#seatsio-seating-chart > iframe");
    // Uncomment to reload iframe
    iframe.src = iframe.src;
}
