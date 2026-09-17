// ════════════════════════════════════════════════════════════════════════════
// API CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

const GAS_DEPLOYMENT_ID =
  "AKfycbz-vj7FoO24w22zVPoWczaR-4tmcHJcRGgS6hIxnFaxHkkCWOzG870apNPawsvnZp7q";

const APPS_SCRIPT_URL =
  `https://script.google.com/macros/s/${GAS_DEPLOYMENT_ID}/exec`;

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

var SLOT_KEYS = ['09-13', '10-14', '11-15', '12-16', '13-17'];

var SLOT_LABELS = {
  '09-13': '09:00-13:00',
  '10-14': '10:00-14:00',
  '11-15': '11:00-15:00',
  '12-16': '12:00-16:00',
  '13-17': '13:00-17:00'
};

var MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

var MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

var MONTH_IDX = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
};

var DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

var DAY_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

// ════════════════════════════════════════════════════════════════════════════
// STATE VARIABLES
// ════════════════════════════════════════════════════════════════════════════

var masterData = {};
var selections = {};
var lastAction = null;
var toastTimer = null;
var currentMonthTab = '';
var currentMonthLabel = '';
var currentYear = 0;
var currentMonthIdx = 0;

// ════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════════════════

function getMonthTab(d) {
  return MONTH_ABBR[d.getMonth()] + '_' + String(d.getFullYear()).slice(2);
}

function getMonthLabel(d) {
  return MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
}

function getYesterday() {
  var d = new Date();
  d.setDate(d.getDate() - 1);

  return d.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function init() {
  var now = new Date();
  var next = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  var select = document.getElementById('monthSelect');

  if (!select) {
    console.error('monthSelect element not found');
    return;
  }

  select.innerHTML = '';

  var optCurrent = document.createElement('option');
  optCurrent.value = getMonthTab(now);
  optCurrent.textContent = getMonthLabel(now);
  select.appendChild(optCurrent);

  var optNext = document.createElement('option');
  optNext.value = getMonthTab(next);
  optNext.textContent = getMonthLabel(next);
  select.appendChild(optNext);

  // Restore volunteer name
  var nameInput = document.getElementById('volName');

  if (nameInput) {
    nameInput.value = localStorage.getItem('evg_name') || '';

    nameInput.addEventListener('input', function () {
      localStorage.setItem('evg_name', this.value.trim());
    });
  }

  select.addEventListener('change', function () {
    // ✅ TELEMETRY: Track month changes
    recordMonthChange();

    selections = {};
    lastAction = null;

    Object.keys(masterData).forEach(function (dateStr) {
      refreshCard(dateStr);
    });

    updateBadge();

    applyMonth(select.value);
    loadSlots();
  });

  applyMonth(select.value);
  loadSlots();
}

function applyMonth(tab) {
  var parts = tab.split('_');
  var abbr = parts[0];

  currentMonthTab = tab;
  currentMonthIdx = MONTH_IDX[abbr];
  currentYear = 2000 + parseInt(parts[1], 10);

  currentMonthLabel =
    MONTH_NAMES[currentMonthIdx] + ' ' + currentYear;

  var hdrTitle = document.getElementById('hdrTitle');
  var hdrValid = document.getElementById('hdrValid');

  if (hdrTitle) {
    hdrTitle.textContent =
      'GRG Duties - ' + currentMonthLabel;
  }

  if (hdrValid) {
    hdrValid.textContent =
      'Availability valid as of ' + getYesterday();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SLOT LOADING
// ════════════════════════════════════════════════════════════════════════════

function loadSlots() {
  showLoading();

  var url =
    APPS_SCRIPT_URL +
    '?action=slots&month=' +
    encodeURIComponent(currentMonthTab);

  // ✅ CORS FIX: Use proxy for local development only
  // Automatically detects localhost and routes through CORS proxy
  // In production (when deployed), this condition is false and uses direct URL
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Extract just the domain part (remove https://)
    var urlWithoutProtocol = url.replace('https://', '').replace('http://', '');
    url = 'https://cors-anywhere.herokuapp.com/' + urlWithoutProtocol;
  }

  /*
   * Telemetry file handles collection of browser/device information.
   *
   * We continue measuring the actual user-perceived availability load
   * here because this timing belongs to this specific operation.
   */
  var startTime = performance.now();
  var startTimestamp = new Date().toISOString();

  // ✅ TELEMETRY: Record API request start
  recordSlotsRequestStart();

  fetch(url)
    .then(function (res) {

      var duration = Math.round(
        performance.now() - startTime
      );

      /*
       * Keep the existing local timing information.
       *
       * This is useful to the telemetry module if you want to inspect
       * it locally, but the booking payload gets the telemetry snapshot
       * later when submitToSheet() runs.
       */
      localStorage.setItem(
        'evg_booking_grg_call_duration',
        JSON.stringify({
          start: startTimestamp,
          end: new Date().toISOString(),
          duration_ms: duration
        })
      );

      console.log(
        'EVG Booking GRG deployment call duration:',
        duration + 'ms'
      );

      if (!res.ok) {
        // ✅ TELEMETRY: Record API error
        recordSlotsRequestEnd(res.status, 'HTTP ' + res.status);
        throw new Error('HTTP ' + res.status);
      }

      // ✅ TELEMETRY: Record API success
      recordSlotsRequestEnd(200, null);

      return res.json();
    })

    .then(function (json) {

      if (json.error) {

        if (
          json.error.indexOf('not found') >= 0 ||
          json.error.indexOf('no data') >= 0
        ) {
          showNotAvailable(currentMonthLabel);
        } else {
          showError(json.error);
        }

        return;
      }

      if (!json.slots || !Array.isArray(json.slots)) {
        throw new Error('Invalid slots response');
      }

      buildMaster(json.slots);
      renderList();
    })

    .catch(function (err) {

      var duration = Math.round(
        performance.now() - startTime
      );

      localStorage.setItem(
        'evg_booking_grg_call_duration',
        JSON.stringify({
          start: startTimestamp,
          end: new Date().toISOString(),
          duration_ms: duration,
          error: err.message
        })
      );

      // ✅ TELEMETRY: Record API error
      recordSlotsRequestEnd(0, err.message);

      showError(
        'Could not load availability. Check your connection and try again.'
      );

      console.error(err);
    });
}

// ════════════════════════════════════════════════════════════════════════════
// BUILD MASTER DATA
// ════════════════════════════════════════════════════════════════════════════

function buildMaster(rows) {
  masterData = {};
  selections = {};

  rows.forEach(function (row) {

    if (!row.dateStr) {
      return;
    }

    masterData[row.dateStr] = {
      dayName: row.dayName || '',
      supervisor: row.supervisor || '',
      original: JSON.parse(
        JSON.stringify(row.slots || {})
      ),
      current: row.slots || {}
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// RENDERING
// ════════════════════════════════════════════════════════════════════════════

function renderList() {

  var body = document.getElementById('appBody');

  if (!body) {
    console.error('appBody element not found');
    return;
  }

  body.innerHTML = '';

  var list = document.createElement('div');
  list.id = 'dayList';
  body.appendChild(list);

  Object.keys(masterData).forEach(function (dateStr) {

    var dayNum =
      parseInt(dateStr.split('-')[0], 10);

    var d = new Date(
      currentYear,
      currentMonthIdx,
      dayNum
    );

    // Don't show past dates
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    if (d < today) {
      return;
    }

    var wdShort = DAY_SHORT[d.getDay()];
    var data = masterData[dateStr];

    var card = document.createElement('div');

    var isWeekend =
      d.getDay() === 0 || d.getDay() === 6;

    card.className =
      'day-card' +
      (isWeekend ? ' weekend' : '');

    card.id = 'card-' + dateStr;

    card.innerHTML =
      '<div class="day-header">' +

        '<div class="day-left">' +

          '<div class="day-num">' +
            String(dayNum).padStart(2, '0') +
          '</div>' +

          '<div class="day-weekday">' +
            wdShort +

            (
              data.supervisor
                ? '<span class="supervisor' +
                    (
                      data.supervisor
                        .toLowerCase()
                        .includes('meeting')
                        ? ' meeting'
                        : ''
                    ) +
                  '">' +
                    data.supervisor +
                  '</span>'
                : ''
            ) +

          '</div>' +

        '</div>' +

        '<div class="day-pill" id="pill-' +
          dateStr +
        '"></div>' +

      '</div>' +

      '<div class="slots" id="slots-' +
        dateStr +
      '"></div>';

    list.appendChild(card);

    renderSlots(dateStr);

    // ✅ TELEMETRY: Track card render
    recordCardRender();
  });

  updateBadge();
}

function renderSlots(dateStr) {

  var container =
    document.getElementById('slots-' + dateStr);

  if (!container) {
    return;
  }

  container.innerHTML = '';

  var data = masterData[dateStr];

  if (!data) {
    return;
  }

  var hasAny = SLOT_KEYS.some(function (key) {
    return data.original[key] !== null &&
           data.original[key] !== undefined;
  });

  if (!hasAny) {
    container.innerHTML =
      '<div class="no-duties">No duties scheduled</div>';

    return;
  }

  SLOT_KEYS.forEach(function (key) {

    var orig = data.original[key];

    if (orig === null || orig === undefined) {
      return;
    }

    var curr = data.current[key];

    var isSel =
      (selections[dateStr] || []).indexOf(key) >= 0;

    var hasSelection =
      (selections[dateStr] || []).length > 0;

    var disabled =
      hasSelection && !isSel;

    var isFull =
      curr !== null &&
      curr !== undefined &&
      curr <= 0;

    var cls;
    var label;
    var icon;

    if (disabled) {

      cls = 'disabled';

      label =
        curr +
        ' spot' +
        (curr !== 1 ? 's' : '') +
        ' open';

      icon = '';

    } else if (isSel && isFull) {

      cls = 'selfull';
      label = 'your booking - full';
      icon = '&#10003;';

    } else if (isSel) {

      cls = 'sel';
      label = 'your booking';
      icon = '&#10003;';

    } else if (isFull) {

      cls = 'full';
      label = 'full';
      icon = '&#8211;';

    } else if (curr < orig) {

      cls = 'partial';

      label =
        curr +
        ' spot' +
        (curr !== 1 ? 's' : '') +
        ' left';

      icon = '+';

    } else {

      cls = 'avail';

      label =
        curr +
        ' spot' +
        (curr !== 1 ? 's' : '') +
        ' open';

      icon = '+';
    }

    var btn = document.createElement('button');

    btn.type = 'button';
    btn.className = 'slot-btn ' + cls;

    btn.innerHTML =
      '<span class="slot-time">' +
        SLOT_LABELS[key] +
      '</span>' +

      '<span class="slot-right">' +

        '<span class="slot-label">' +
          label +
        '</span>' +

        '<span class="slot-icon">' +
          icon +
        '</span>' +

      '</span>';

    if (cls !== 'full' && cls !== 'disabled') {

      btn.addEventListener(
        'click',
        (function (ds, k) {
          return function () {
            handleSlot(ds, k);
          };
        })(dateStr, key)
      );
    }

    container.appendChild(btn);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// INTERACTION
// ════════════════════════════════════════════════════════════════════════════

function handleSlot(dateStr, key) {

  if (!selections[dateStr]) {
    selections[dateStr] = [];
  }

  var idx =
    selections[dateStr].indexOf(key);

  var isSel = idx >= 0;

  if (isSel) {

    selections[dateStr].splice(idx, 1);

    masterData[dateStr].current[key]++;

    showToast(
      'Removed ' + SLOT_LABELS[key],
      dateStr,
      key,
      'removed'
    );

  } else {

    var curr =
      masterData[dateStr].current[key];

    if (
      curr === null ||
      curr === undefined ||
      curr <= 0
    ) {
      return;
    }

    if (selections[dateStr].length > 0) {
      return;
    }

    selections[dateStr].push(key);

    masterData[dateStr].current[key] =
      Math.max(0, curr - 1);

    showToast(
      'Booked ' + SLOT_LABELS[key],
      dateStr,
      key,
      'booked'
    );
  }

  refreshCard(dateStr);
  updateBadge();

  // ✅ TELEMETRY: Track slot selection
  var totalSelected = 0;
  Object.keys(selections).forEach(function (ds) {
    totalSelected += (selections[ds] || []).length;
  });
  recordSlotSelection(totalSelected);
}

function refreshCard(dateStr) {

  renderSlots(dateStr);

  var pill =
    document.getElementById('pill-' + dateStr);

  var count =
    (selections[dateStr] || []).length;

  if (pill) {

    pill.textContent =
      count + ' picked';

    pill.classList.toggle(
      'on',
      count > 0
    );
  }
}

function updateBadge() {

  var total =
    Object.values(selections).reduce(
      function (a, b) {
        return a + b.length;
      },
      0
    );

  var badge =
    document.getElementById('badge');

  var bottomBar =
    document.getElementById('bottomBar');

  if (badge) {

    badge.textContent =
      total +
      ' slot' +
      (total !== 1 ? 's' : '');
  }

  if (bottomBar) {

    bottomBar.classList.toggle(
      'show',
      total > 0
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CLEAR ALL
// ════════════════════════════════════════════════════════════════════════════

var clearBtn =
  document.getElementById('clearBtn');

if (clearBtn) {

  clearBtn.addEventListener(
    'click',
    function () {

      Object.keys(selections).forEach(
        function (dateStr) {

          (selections[dateStr] || [])
            .forEach(function (key) {

              masterData[dateStr]
                .current[key]++;
            });

          selections[dateStr] = [];

          refreshCard(dateStr);
        }
      );

      selections = {};
      lastAction = null;

      var comment =
        document.getElementById('volComment');

      if (comment) {
        comment.value = '';
      }

      updateBadge();
    }
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════════════════════════

function showToast(msg, dateStr, key, type) {

  lastAction = {
    dateStr: dateStr,
    key: key,
    type: type
  };

  var toastLabel =
    document.getElementById('toastLabel');

  var toast =
    document.getElementById('toast');

  if (toastLabel) {
    toastLabel.textContent = msg;
  }

  if (!toast) {
    return;
  }

  toast.classList.add('show');

  clearTimeout(toastTimer);

  toastTimer = setTimeout(
    function () {
      toast.classList.remove('show');
    },
    3500
  );
}

var toastUndo =
  document.getElementById('toastUndo');

if (toastUndo) {

  toastUndo.addEventListener(
    'click',
    function () {

      if (!lastAction) {
        return;
      }

      var dateStr =
        lastAction.dateStr;

      var key =
        lastAction.key;

      var type =
        lastAction.type;

      if (type === 'booked') {

        var idx =
          (selections[dateStr] || [])
            .indexOf(key);

        if (idx >= 0) {

          selections[dateStr]
            .splice(idx, 1);

          masterData[dateStr]
            .current[key]++;
        }

      } else {

        if (!selections[dateStr]) {
          selections[dateStr] = [];
        }

        var orig =
          masterData[dateStr]
            .original[key];

        var curr =
          masterData[dateStr]
            .current[key];

        if (curr < orig) {

          selections[dateStr]
            .push(key);

          masterData[dateStr]
            .current[key]--;
        }
      }

      lastAction = null;

      var toast =
        document.getElementById('toast');

      if (toast) {
        toast.classList.remove('show');
      }

      refreshCard(dateStr);
      updateBadge();
    }
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SEND FLOW
// ════════════════════════════════════════════════════════════════════════════

var sendBtn =
  document.getElementById('sendBtn');

if (sendBtn) {

  sendBtn.addEventListener(
    'click',
    function () {

      // ✅ TELEMETRY: Record booking initiate (when Review & Send clicked)
      recordBookingInitiate();

      var nameInput =
        document.getElementById('volName');

      var name =
        nameInput
          ? nameInput.value.trim()
          : '';

      if (!name) {

        if (nameInput) {

          nameInput.classList.add('error');
          nameInput.focus();

          setTimeout(
            function () {
              nameInput.classList.remove('error');
            },
            2000
          );
        }

        return;
      }

      var msg =
        buildMessage(name);

      if (!msg) {
        return;
      }

      document.getElementById('msgBox')
        .textContent = msg;

      document.getElementById('copyFb')
        .textContent = '';

      var waBtn =
        document.getElementById('waBtn');

      if (waBtn) {

        waBtn.href =
          'https://wa.me/?text=' +
          encodeURIComponent(msg);
      }

      document.getElementById('overlay')
        .classList.add('open');
    }
  );
}

var waBtn =
  document.getElementById('waBtn');

if (waBtn) {

  waBtn.addEventListener(
    'click',
    function (e) {

      e.preventDefault();

      var href = waBtn.href;

      var nameInput =
        document.getElementById('volName');

      var name =
        nameInput
          ? nameInput.value.trim()
          : '';

      /*
       * Fire-and-forget booking submission.
       *
       * submitToSheet() obtains the telemetry snapshot immediately
       * before building the payload.
       */
      submitToSheet(name);

      // ✅ TELEMETRY: Record WhatsApp button click
      recordWhatsappClick();

      var comment =
        document.getElementById('volComment');

      if (comment) {
        comment.value = '';
      }

      document.getElementById('overlay')
        .classList.remove('open');

      window.open(href, '_blank');
    }
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LOCAL BOOKING STORAGE
// ════════════════════════════════════════════════════════════════════════════

const LOCAL_BOOKINGS_KEY =
  'evg_grg_bookings';

function saveLocalBooking(
  name,
  comment,
  bookings
) {

  var saved = {
    name: name,
    comment: comment,
    created: new Date().toISOString(),
    bookings: bookings
  };

  var existing =
    JSON.parse(
      localStorage.getItem(
        LOCAL_BOOKINGS_KEY
      ) || '[]'
    );

  existing.push(saved);

  localStorage.setItem(
    LOCAL_BOOKINGS_KEY,
    JSON.stringify(existing)
  );
}

function getLocalBookings() {

  return JSON.parse(
    localStorage.getItem(
      LOCAL_BOOKINGS_KEY
    ) || '[]'
  );
}

function clearLocalBookings() {

  localStorage.removeItem(
    LOCAL_BOOKINGS_KEY
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DATA SUBMISSION
// ════════════════════════════════════════════════════════════════════════════

function submitToSheet(name) {

  var entries =
    buildEntries();

  if (!entries.length) {
    return;
  }

  var comment =
    document.getElementById('volComment')
      .value.trim();

  var bookings =
    entries.map(function (en) {

      return {
        date: en.dateRaw,
        day: en.dayFull,
        slot: SLOT_LABELS[en.key]
      };
    });

  // Save a copy on this device
  saveLocalBooking(
    name,
    comment,
    bookings
  );

  // ════════════════════════════════════════════════════════════════════════
  // TELEMETRY
  // ════════════════════════════════════════════════════════════════════════
  //
  // The separate grg_telemetry.js file exposes:
  //
  //     getTelemetry()
  //
  // It returns an ordinary JavaScript object containing the browser/device
  // information, user engagement metrics, and performance data collected
  // so far.
  //
  // The telemetry function is deliberately wrapped in try/catch so that
  // telemetry can NEVER prevent a booking from being submitted.
  //
  // ════════════════════════════════════════════════════════════════════════

  var telemetry = {};

  try {

    if (
      typeof getTelemetry === 'function'
    ) {

      telemetry =
        getTelemetry();

    } else {

      console.warn(
        'Telemetry module not loaded; submitting booking without telemetry.'
      );
    }

  } catch (telemetryError) {

    console.warn(
      'Telemetry collection failed; booking will still be submitted.',
      telemetryError
    );

    telemetry = {};
  }

  // ════════════════════════════════════════════════════════════════════════
  // BUILD PAYLOAD
  // ════════════════════════════════════════════════════════════════════════

  var payload =
    JSON.stringify({

      name: name,
      comment: comment,

      evg_name:
        localStorage.getItem(
          'evg_name'
        ),

      evg_device_id:
        localStorage.getItem(
          'evg_device_id'
        ),

      evg_last_accessed_date:
        localStorage.getItem(
          'evg_last_accessed_date'
        ),

      bookings: bookings,

      /*
       * Everything below this property is telemetry-only.
       *
       * Apps Script can use the booking information to create the booking
       * ID first, then write this telemetry object to the telemetry sheet
       * using that same booking ID.
       */

      telemetry: telemetry
    });

  // ════════════════════════════════════════════════════════════════════════
  // FIRE-AND-FORGET SUBMISSION
  // ════════════════════════════════════════════════════════════════════════

  // ✅ TELEMETRY: Record booking submit
  recordBookingSubmit();

  submitPayload(payload);
}

function submitPayload(payload) {

  var iframe =
    document.createElement('iframe');

  iframe.name = 'grg_iframe';
  iframe.style.display = 'none';

  var form =
    document.createElement('form');

  form.method = 'POST';
  form.action = APPS_SCRIPT_URL;
  form.target = 'grg_iframe';
  form.style.display = 'none';

  var input =
    document.createElement('input');

  input.type = 'hidden';
  input.name = 'payload';
  input.value = payload;

  form.appendChild(input);

  document.body.appendChild(iframe);
  document.body.appendChild(form);

  form.submit();

  setTimeout(
    function () {

      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }

      if (form.parentNode) {
        form.parentNode.removeChild(form);
      }

    },
    5000
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MESSAGE BUILDING
// ════════════════════════════════════════════════════════════════════════════

function buildEntries() {

  var entries = [];

  Object.keys(selections)
    .forEach(function (dateStr) {

      (selections[dateStr] || [])
        .forEach(function (key) {

          var dayNum =
            parseInt(
              dateStr.split('-')[0],
              10
            );

          var d =
            new Date(
              currentYear,
              currentMonthIdx,
              dayNum
            );

          var dateRaw =
            currentYear +
            '/' +
            String(
              currentMonthIdx + 1
            ).padStart(2, '0') +
            '/' +
            String(dayNum)
              .padStart(2, '0');

          entries.push({

            d: d,

            key: key,

            dayFull:
              DAY_FULL[d.getDay()],

            dayNum: dayNum,

            dateRaw: dateRaw,

            dateStr: dateStr
          });
        });
    });

  return entries.sort(
    function (a, b) {
      return a.d - b.d;
    }
  );
}

function buildMessage(name) {

  var entries =
    buildEntries();

  if (!entries.length) {
    return null;
  }

  var comment =
    document.getElementById('volComment')
      .value.trim();

  var lines = [

    '\uD83D\uDCE3 *GRG Booking Request \u2013 ' +
      currentMonthLabel +
      '*',

    '',

    '\uD83D\uDE4B Name: ' +
      name,

    ''
  ];

  entries.forEach(
    function (en) {

      var d = en.d;

      var dayShort =
        DAY_SHORT[d.getDay()];

      var dateDisplay =
        dayShort +
        ', ' +
        String(en.dayNum)
          .padStart(2, '0') +
        ' ' +
        MONTH_ABBR[currentMonthIdx] +
        ' ' +
        currentYear;

      lines.push(
        '\uD83D\uDCC5 ' +
        dateDisplay +
        ' \u2014 ' +
        SLOT_LABELS[en.key]
      );
    }
  );

  lines.push('');

  lines.push(
    '\uD83D\uDDD3\uFE0F Total: ' +
      entries.length +
      ' slot' +
      (entries.length !== 1 ? 's' : '')
  );

  if (comment) {

    lines.push(
      '\uD83D\uDCAC Comment: ' +
      comment
    );
  }

  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL CONTROLS
// ════════════════════════════════════════════════════════════════════════════

var closeModal =
  document.getElementById('closeModal');

if (closeModal) {

  closeModal.addEventListener(
    'click',
    function () {

      document.getElementById('overlay')
        .classList.remove('open');
    }
  );
}

var overlay =
  document.getElementById('overlay');

if (overlay) {

  overlay.addEventListener(
    'click',
    function (e) {

      if (e.target === overlay) {

        overlay.classList.remove('open');
      }
    }
  );
}

var copyBtn =
  document.getElementById('copyBtn');

if (copyBtn) {

  copyBtn.addEventListener(
    'click',
    function () {

      var text =
        document.getElementById('msgBox')
          .textContent;

      navigator.clipboard
        .writeText(text)
        .then(function () {

          document.getElementById('copyFb')
            .textContent =
            'Copied to clipboard';

          setTimeout(
            function () {

              document.getElementById('copyFb')
                .textContent = '';
            },
            2500
          );
        });
    }
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STATE SCREENS
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// MESSAGES
// ════════════════════════════════════════════════════════════════════════════

var LOADING_MESSAGES = [
  'Checking the GRG crystal ball...',
  'Convincing the duty scheduler to share their secrets...',
  'Loading your destiny (one slot at a time)...',
  'Consulting the ancient GRG scrolls...',
  'Asking really nicely for slot availability...',
  'Brewing coffee and checking rosters...',
  'Searching for the perfect slot...',
  'Loading your heroic volunteer moment...',
  'Decoding the duty matrix...',
  'Summoning the scheduling spirits...',
  'This is taking longer than we expected, but we\'re on it...',
  'Your patience is admirable. Still loading...',
  'Almost there! The hamsters are running faster now...',
  'Refreshing availability data (silently, in the background)...',
  'Updating from the latest roster...',
  'Just another moment while we sync everything...',
  'Checking if any last-minute slots opened up...',
  'Loading with extra freshness...',
  'Validating your volunteer credentials...',
  'The GRG duty gods are pleased with your wait...'
];

var loadingMessageInterval = null;

function getRandomLoadingMessage() {
  return LOADING_MESSAGES[
    Math.floor(Math.random() * LOADING_MESSAGES.length)
  ];
}

function rotateLoadingMessage() {

  var msgElement =
    document.querySelector('.loading-message');

  if (!msgElement) {
    clearInterval(loadingMessageInterval);
    return;
  }

  msgElement.textContent =
    getRandomLoadingMessage();
}

function showLoading() {

  var body =
    document.getElementById('appBody');

  if (!body) {
    return;
  }

  var message = getRandomLoadingMessage();

  body.innerHTML =
    '<div class="state-screen loading">' +

      '<div class="loading-spinner"></div>' +

      '<div class="loading-message">' +
        message +
      '</div>' +

      '<div class="loading-subtext">' +
        'Getting latest availability data...' +
      '</div>' +

    '</div>';

  body.classList.add('loading');

  // Rotate messages every 2 seconds
  clearInterval(loadingMessageInterval);

  loadingMessageInterval = setInterval(
    rotateLoadingMessage,
    2000
  );
}


function showNotAvailable(monthLabel) {

  var body =
    document.getElementById('appBody');

  if (!body) {
    return;
  }

  body.innerHTML =
    '<div class="state-screen">' +

      '<h3>' +
        monthLabel +
        ' not available yet' +
      '</h3>' +

      '<p>' +
        'The duty schedule for this month has not been set up. ' +
        'Check back soon or contact the coordinator.' +
      '</p>' +

    '</div>';
}

function showError(msg) {

  var body =
    document.getElementById('appBody');

  if (body) {

    body.innerHTML =
      '<div class="state-screen">' +

        '<h3>Could not load slots</h3>' +

        '<p>' +
          msg +
        '</p>' +

        '<button type="button" onclick="loadSlots()">' +
          'Try again' +
        '</button>' +

      '</div>';
  }

  var hdrValid =
    document.getElementById('hdrValid');

  if (hdrValid) {
    hdrValid.textContent =
      'Unable to load';
  }
}

// ════════════════════════════════════════════════════════════════════════════
// COMMENT TOGGLE
// ════════════════════════════════════════════════════════════════════════════

var commentToggle =
  document.getElementById('commentToggle');

if (commentToggle) {

  commentToggle.addEventListener(
    'click',
    function () {

      var wrap =
        document.getElementById('commentWrap');

      if (!wrap) {
        return;
      }

      if (
        wrap.classList.contains('collapsed')
      ) {

        wrap.classList.remove('collapsed');
        wrap.classList.add('expanded');

      } else {

        wrap.classList.add('collapsed');
        wrap.classList.remove('expanded');
      }
    }
  );
}

// ════════════════════════════════════════════════════════════════════════════
// APP INITIALIZATION
// ════════════════════════════════════════════════════════════════════════════

init();
