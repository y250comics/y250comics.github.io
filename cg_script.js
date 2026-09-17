// ════════════════════════════════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════════════════════════════════

const GAS_DEPLOYMENT_ID =
    "AKfycbxdvhMN2FQDrhvK8i-uktv3EEglqqvb_Y9oNvfHCqOmHvixrr3JNZ-GA6SZUO1mR7fu_g"

const APPS_SCRIPT_URL =
    `https://script.google.com/macros/s/${GAS_DEPLOYMENT_ID}/exec`;

// ════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════

var allEvents  = [];
var selections = {};
var lastAction = null;
var toastTimer = null;
var loadingMessageInterval = null;

// ════════════════════════════════════════════════════════════════
// WITTY LOADING MESSAGES
// ════════════════════════════════════════════════════════════════

var LOADING_MESSAGES = [
  'Gathering the best courses & guidings...',
  'Consulting the event crystal ball...',
  'Asking guides nicely to share their schedules...',
  'Loading your adventure awaits...',
  'Brewing coffee and checking calendars...',
  'Decoding the course matrix...',
  'Summoning the event spirits...',
  'This is taking longer than expected, but we\'re on it...',
  'Your patience is admirable. Still loading...',
  'Almost there! The hamsters are running faster now...',
  'Refreshing event data (silently, in the background)...',
  'Updating from the latest schedule...',
  'Just another moment while we sync everything...',
  'Checking if any last-minute events opened up...',
  'Loading with extra freshness...',
  'The event gods are pleased with your wait...',
  'Preparing the perfect learning experience...',
  'Checking if there\'s room for one more guide...',
  'Making sure every event is exactly right...',
  'Loading tomorrow\'s adventures...'
];

function getRandomLoadingMessage() {
  return LOADING_MESSAGES[
    Math.floor(Math.random() * LOADING_MESSAGES.length)
  ];
}

function rotateLoadingMessage() {
  var msgElement = document.querySelector('.loading-message');
  if (!msgElement) {
    clearInterval(loadingMessageInterval);
    return;
  }
  msgElement.textContent = getRandomLoadingMessage();
}

function showLoading() {
  var body = document.getElementById('appBody');
  if (!body) return;

  var message = getRandomLoadingMessage();

  body.innerHTML =
    '<div class="state-screen loading">' +
      '<div class="loading-spinner"></div>' +
      '<div class="loading-message">' + message + '</div>' +
      '<div class="loading-subtext">Syncing fresh event data...</div>' +
    '</div>';

  // body.classList.add('loading');

  clearInterval(loadingMessageInterval);
  loadingMessageInterval = setInterval(rotateLoadingMessage, 2000);
}

// ════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════

function init() {
    var nameInput = document.getElementById('volName');

    nameInput.value = localStorage.getItem('evg_name') || '';

    nameInput.addEventListener('input', function () {
        localStorage.setItem('evg_name', this.value.trim());
    });

    document.getElementById('hdrValid').textContent = 'Loading upcoming events...';
    loadEvents();
}

// ════════════════════════════════════════════════════════════════
// DATA LOADING WITH CACHING & CORS FIX
// ════════════════════════════════════════════════════════════════

function loadEvents() {
    showLoading();

    var url = APPS_SCRIPT_URL + '?action=cglist';

    // ✅ CORS FIX: Use proxy for local development only
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        var urlWithoutProtocol = url.replace('https://', '').replace('http://', '');
        url = 'https://cors-anywhere.herokuapp.com/' + urlWithoutProtocol;
    }

    const startTime = performance.now();
    const startTimestamp = new Date().toISOString();

    if (typeof recordEventsRequestStart === 'function') {
        recordEventsRequestStart();
    }

    fetch(url)

        .then(function(res) {

            const duration = Math.round(
                performance.now() - startTime
            );

            localStorage.setItem(
                "evg_booking_cg_call_duration",
                JSON.stringify({
                    start: startTimestamp,
                    end: new Date().toISOString(),
                    duration_ms: duration
                })
            );

            console.log(
                "EVG Booking CG deployment call duration:",
                duration + "ms"
            );

            if (!res.ok) {
                if (typeof recordEventsRequestEnd === 'function') {
                    recordEventsRequestEnd(res.status, "HTTP " + res.status);
                }
                throw new Error("HTTP " + res.status);
            }

            if (typeof recordEventsRequestEnd === 'function') {
                recordEventsRequestEnd(200, null);
            }

            return res.json();
        })

        .then(function(json) {

            if (json.error) {
                showError(json.error);
                return;
            }

            allEvents = json.events;

            document.getElementById('hdrValid').textContent =
                allEvents.length + ' upcoming event' +
                (allEvents.length !== 1 ? 's' : '');

            renderList();

        })

        .catch(function(err) {

            const duration = Math.round(
                performance.now() - startTime
            );

            localStorage.setItem(
                "evg_booking_cg_call_duration",
                JSON.stringify({
                    start: startTimestamp,
                    end: new Date().toISOString(),
                    duration_ms: duration,
                    error: err.message
                })
            );

            if (typeof recordEventsRequestEnd === 'function') {
                recordEventsRequestEnd(0, err.message);
            }

            showError(
                'Could not load events. Check your connection and try again.'
            );

            console.error(err);
        });
}

// ════════════════════════════════════════════════════════════════
// RENDERING
// ════════════════════════════════════════════════════════════════

function renderList() {
    var body = document.getElementById('appBody');
    clearInterval(loadingMessageInterval);

    if (allEvents.length === 0) {
        body.innerHTML =
            '<div class="state-screen">' +
                '<div class="state-title">No upcoming events</div>' +
                '<div class="state-sub">There are no courses or guidings scheduled from today onwards.</div>' +
            '</div>';
        return;
    }

    body.innerHTML = '<div class="list" id="eventList"></div>';
    var list = document.getElementById('eventList');

    allEvents.forEach(function(ev) {
        var subParts = [];
        if (ev.grade)    subParts.push('Grade ' + ev.grade);
        if (ev.learners) subParts.push(ev.learners + ' learners');

        var metaParts = [];
        if (ev.facilitator)  metaParts.push('<strong>Facilitator:</strong> ' + ev.facilitator);
        if (ev.guidesBooked) metaParts.push('<strong>Booked:</strong> ' + ev.guidesBooked);
        if (ev.shadowing)    metaParts.push('<strong>Shadowing:</strong> ' + ev.shadowing);

        var card = document.createElement('div');
        card.className = 'event-card ' + ev.type;
        card.id = 'card-' + ev.rowIndex;
        card.innerHTML =
            '<div class="event-header">' +
                '<div>' +
                    '<div class="event-date">' + ev.dateFmt + '</div>' +
                    '<div class="event-time">' + ev.time + '</div>' +
                '</div>' +
                '<span class="type-tag ' + ev.type + '">' + ev.type + '</span>' +
            '</div>' +
            '<div class="event-body">' +
                '<div class="event-school">' + ev.school + '</div>' +
                (subParts.length ? '<div class="event-sub">' + subParts.join(' &middot; ') + '</div>' : '') +
                '<div class="event-detail">' + ev.typeDetail + '</div>' +
                (metaParts.length
                    ? '<div class="event-meta">' +
                        metaParts.map(function(m) { return '<div class="meta-item">' + m + '</div>'; }).join('') +
                      '</div>'
                    : '') +
            '</div>' +
            '<div class="book-row" id="bookrow-' + ev.rowIndex + '"></div>';

        list.appendChild(card);
        renderBookBtn(ev);

        if (typeof recordCardRender === 'function') {
            recordCardRender();
        }
    });
}

function renderBookBtn(ev) {
    var container = document.getElementById('bookrow-' + ev.rowIndex);
    if (!container) return;
    container.innerHTML = '';

    var isSel  = !!selections[ev.rowIndex];
    var spots  = ev.spotsLeft;
    var isFull = spots <= 0;

    var cls, label, icon;
    if      (isSel && isFull) { cls = 'selfull'; label = 'your booking - full'; icon = '&#10003;'; }
    else if (isSel)           { cls = 'sel';     label = 'your booking';        icon = '&#10003;'; }
    else if (isFull)          { cls = 'full';    label = 'no guides needed';    icon = '&#8211;'; }
    else if (spots === 1)     { cls = 'partial'; label = '1 guide needed';      icon = '+'; }
    else                      { cls = 'avail';   label = spots + ' guides needed'; icon = '+'; }

    var btn = document.createElement('button');
    btn.className = 'book-btn ' + cls;
    btn.innerHTML =
        '<span>' + (isSel ? 'Booked' : 'Book this') + '</span>' +
        '<span style="display:flex;align-items:center;gap:8px">' +
            '<span class="book-label">' + label + '</span>' +
            '<span class="book-icon">' + icon + '</span>' +
        '</span>';

    if (cls !== 'full') {
        btn.addEventListener('click', (function(e) {
            return function() { handleBook(e); };
        })(ev));
    }

    container.appendChild(btn);
}

// ════════════════════════════════════════════════════════════════
// INTERACTION
// ════════════════════════════════════════════════════════════════

function handleBook(ev) {
    var isSel = !!selections[ev.rowIndex];

    if (isSel) {
        delete selections[ev.rowIndex];
        ev.spotsLeft++;
        showToast('Removed ' + ev.school, ev.rowIndex, ev, 'removed');
    } else {
        if (ev.spotsLeft <= 0) return;
        selections[ev.rowIndex] = ev;
        ev.spotsLeft--;
        showToast('Booked ' + ev.school, ev.rowIndex, ev, 'booked');
    }

    renderBookBtn(ev);
    updateBadge();

    if (typeof recordBookClickCount === 'function') {
        var totalClicks = Object.keys(selections).length;
        recordBookClickCount(totalClicks);
    }
}

function updateBadge() {
    var total = Object.keys(selections).length;
    document.getElementById('badge').textContent = total + ' selected';
    document.getElementById('bottomBar').classList.toggle('show', total > 0);

    if (typeof recordSelectionCount === 'function') {
        recordSelectionCount(total);
    }
}

// ════════════════════════════════════════════════════════════════
// CLEAR ALL
// ════════════════════════════════════════════════════════════════

document.getElementById('clearBtn').addEventListener('click', function() {
    Object.keys(selections).forEach(function(idx) {
        var ev = selections[idx];
        ev.spotsLeft++;
        renderBookBtn(ev);
    });
    selections = {};
    lastAction = null;
    document.getElementById('volComment').value = '';
    updateBadge();
});

// ════════════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════════════

function showToast(msg, idx, ev, type) {
    lastAction = { idx: idx, ev: ev, type: type };

    var toastLabel = document.getElementById('toastLabel');
    var toast = document.getElementById('toast');

    if (toastLabel) {
        toastLabel.textContent = msg;
    }

    if (!toast) return;

    toast.classList.add('show');
    clearTimeout(toastTimer);

    toastTimer = setTimeout(
        function () {
            toast.classList.remove('show');
        },
        3500
    );
}

document.getElementById('toastUndo').addEventListener('click', function() {
    if (!lastAction) return;

    var idx = lastAction.idx;
    var ev = lastAction.ev;
    var type = lastAction.type;

    if (type === 'booked') {
        delete selections[idx];
        ev.spotsLeft++;
    } else {
        selections[idx] = ev;
        ev.spotsLeft--;
    }

    lastAction = null;
    var toast = document.getElementById('toast');
    if (toast) {
        toast.classList.remove('show');
    }

    renderBookBtn(ev);
    updateBadge();
});

// ════════════════════════════════════════════════════════════════
// SEND FLOW
// ════════════════════════════════════════════════════════════════

document.getElementById('sendBtn').addEventListener('click', function() {
    var nameInput = document.getElementById('volName');
    var name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        if (nameInput) {
            nameInput.classList.add('error');
            nameInput.focus();
            setTimeout(function() {
                nameInput.classList.remove('error');
            }, 2000);
        }
        return;
    }

    var msg = buildMessage(name);
    if (!msg) return;

    document.getElementById('msgBox').textContent = msg;
    document.getElementById('copyFb').textContent = '';

    var waBtn = document.getElementById('waBtn');
    if (waBtn) {
        waBtn.href = 'https://wa.me/?text=' + encodeURIComponent(msg);
    }

    if (typeof recordBookingInitiate === 'function') {
        recordBookingInitiate();
    }

    document.getElementById('overlay').classList.add('open');
});

document.getElementById('waBtn').addEventListener('click', function(e) {
    e.preventDefault();

    var href = document.getElementById('waBtn').href;
    var nameInput = document.getElementById('volName');
    var name = nameInput ? nameInput.value.trim() : '';

    if (typeof recordWhatsappClick === 'function') {
        recordWhatsappClick();
    }

    submitToSheet(name);

    var comment = document.getElementById('volComment');
    if (comment) {
        comment.value = '';
    }

    document.getElementById('overlay').classList.remove('open');
    window.open(href, '_blank');
});

// ════════════════════════════════════════════════════════════════
// SUBMISSION
// ════════════════════════════════════════════════════════════════

function submitToSheet(name) {
    var selectedEvents = Object.values(selections);

    if (selectedEvents.length === 0) {
        return;
    }

    var comment = document.getElementById('volComment').value.trim();

    var bookings = selectedEvents.map(function(ev) {
        return {
            dateStored: ev.dateStored,
            dayName:    ev.dayName,
            school:     ev.school,
            grade:      ev.grade,
            typeDetail: ev.typeDetail,
            type:       ev.type,
            time:       ev.time
        };
    });

    var telemetry = {};

    try {
        if (typeof getTelemetry === 'function') {
            telemetry = getTelemetry();
        }
    } catch (telemetryError) {
        console.warn('Telemetry collection failed; booking will still be submitted.', telemetryError);
        telemetry = {};
    }

    var payload = JSON.stringify({
        name: name,
        comment: comment,
        bookings: bookings,
        telemetry: telemetry
    });

    submitPayload(payload);
}

function submitPayload(payload) {
    var iframe = document.createElement('iframe');
    iframe.name = 'cg_iframe';
    iframe.style.display = 'none';

    var form = document.createElement('form');
    form.method = 'POST';
    form.action = APPS_SCRIPT_URL;
    form.target = 'cg_iframe';
    form.style.display = 'none';

    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'payload';
    input.value = payload;

    form.appendChild(input);
    document.body.appendChild(iframe);
    document.body.appendChild(form);

    form.submit();

    setTimeout(function() {
        if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
        }
        if (form.parentNode) {
            form.parentNode.removeChild(form);
        }
    }, 5000);
}

// ════════════════════════════════════════════════════════════════
// MESSAGE BUILDING
// ════════════════════════════════════════════════════════════════

function buildMessage(name) {
    var selectedEvents = Object.values(selections);

    if (selectedEvents.length === 0) {
        return null;
    }

    var comment = document.getElementById('volComment').value.trim();

    var lines = [
        '🎓 *Courses & Guidings Booking*',
        '',
        '👋 Name: ' + name,
        ''
    ];

    selectedEvents.forEach(function(ev) {
        lines.push(
            '📅 ' + ev.dateFmt + ' — ' + ev.time +
            ' | ' + ev.typeDetail
        );
    });

    lines.push('');
    lines.push(
        '📋 Total: ' + selectedEvents.length +
        ' event' + (selectedEvents.length !== 1 ? 's' : '')
    );

    if (comment) {
        lines.push('💬 Comment: ' + comment);
    }

    return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════
// MODAL CONTROLS
// ════════════════════════════════════════════════════════════════

document.getElementById('closeModal').addEventListener('click', function() {
    document.getElementById('overlay').classList.remove('open');
});

document.getElementById('overlay').addEventListener('click', function(e) {
    if (e.target === this) {
        this.classList.remove('open');
    }
});

document.getElementById('copyBtn').addEventListener('click', function() {
    var text = document.getElementById('msgBox').textContent;

    navigator.clipboard
        .writeText(text)
        .then(function() {
            document.getElementById('copyFb').textContent = 'Copied to clipboard';

            setTimeout(function() {
                document.getElementById('copyFb').textContent = '';
            }, 2500);
        });
});

document.getElementById('commentToggle').addEventListener('click', function() {
    var wrap = document.getElementById('commentWrap');

    if (!wrap) return;

    if (wrap.classList.contains('collapsed')) {
        wrap.classList.remove('collapsed');
        wrap.classList.add('expanded');
    } else {
        wrap.classList.add('collapsed');
        wrap.classList.remove('expanded');
    }
});

// ════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════

init();
