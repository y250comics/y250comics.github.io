/* ═══════════════════════════════════════════════════════════════════════════
 * Courses & Guidings Booking System — Enhanced Client Telemetry
 *
 * Purpose:
 *   Collect comprehensive browser, device, network, performance, and UX
 *   metrics for testing, troubleshooting, and understanding user experience.
 *
 *   This is the C&G counterpart to the GRG telemetry module. The overall
 *   shape and field names are kept as close as possible to the GRG version
 *   so the two telemetry sheets can be compared, but a few things are
 *   adapted to how this page actually works:
 *     - There is no month selector on this page, so month-change tracking
 *       is dropped.
 *     - The "slot" concept is replaced with "book" (the book-btn buttons
 *       on each event card).
 *     - The backend call is the cglist request (loadEvents), not a slots
 *       request, so those fields are named accordingly.
 *
 * Metrics Tracked:
 *   - Device & browser information
 *   - Page performance (initial load, interaction timing)
 *   - API call performance (cglist request via loadEvents)
 *   - User engagement (time on page, idle time)
 *   - UI interaction metrics (card renders, book clicks, selections)
 *   - Network quality indicators
 *   - Error tracking
 *
 * Usage:
 *   Call getTelemetry() to retrieve complete telemetry snapshot at
 *   submission time.
 *
 * Key Design Principles:
 *   - Never interferes with booking workflow
 *   - All failures caught and logged, not thrown
 *   - Data collection is continuous (events recorded as they happen)
 *   - Graceful degradation (missing data = null, not errors)
 * ═══════════════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════════════
 * TELEMETRY STATE CONTAINER
 * ═══════════════════════════════════════════════════════════════════════════ */

var CG_TELEMETRY = {
  // ─────────────────────────────────────────────────────────────────────────
  // PAGE LOAD TIMING
  // ─────────────────────────────────────────────────────────────────────────

  pageStartTime: null,                    // When script initialized (ms timestamp)
  pageReadyTime: null,                    // DOM ready (ms from page start)
  firstPaintTime: null,                   // First visual paint (ms from start)
  firstContentfulPaintTime: null,         // First meaningful content (ms from start)

  // ─────────────────────────────────────────────────────────────────────────
  // USER PRESENCE & ENGAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  timeOnPageMs: null,                     // Total ms from page load to submission
  lastUserInteractionTime: null,          // Timestamp of last click/input
  idleTimeMs: null,                       // Time since last interaction
  isPageVisible: null,                    // Page currently visible (not minimized)
  focusLossCount: null,                   // How many times user left the page

  // ─────────────────────────────────────────────────────────────────────────
  // EVENTS REQUEST METRICS (?action=cglist via loadEvents)
  // ─────────────────────────────────────────────────────────────────────────

  eventsRequestStartTime: null,           // When the cglist request began
  eventsRequestMs: null,                  // Duration of the cglist fetch (ms)
  eventsRequestStatus: null,              // HTTP status (200, 404, 500, etc)
  eventsRequestError: null,               // Error message if failed
  eventsRequestRetries: 0,                // Number of retry attempts
  appScriptDataLoadTimeMs: null,          // Apps Script backend call duration (from cg_script.js)

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMISSION METRICS
  // ─────────────────────────────────────────────────────────────────────────

  bookingInitiateTime: null,              // When user clicked "Review & Send"
  bookingSubmitTime: null,                // When booking actually submitted
  bookingSubmitMs: null,                  // Time from initiate to submit (ms)
  whatsappClickTime: null,                // When user clicked WhatsApp button
  reviewToWhatsappMs: null,               // Time from review modal open to WhatsApp click (ms)

  // ─────────────────────────────────────────────────────────────────────────
  // UI INTERACTION METRICS
  // ─────────────────────────────────────────────────────────────────────────

  bookClickCount: 0,                      // Total times user clicked a "Book this" button
  selectionCount: 0,                      // Bookings currently selected
  cardRenderCount: 0,                     // How many event cards rendered
  commentFieldInteracted: false,          // Did user open comment box
  commentLength: 0,                       // Characters in comment (at submit)
  commentFieldFocusTimeMs: 0,             // Total time comment field was in focus (ms)
  commentFieldFocusStartTime: null,       // When user focused on comment field

  // ─────────────────────────────────────────────────────────────────────────
  // NETWORK & CONNECTIVITY
  // ─────────────────────────────────────────────────────────────────────────

  connectionChanges: [],                  // Array of {time, type} when connection changed
  offlineDuration: 0,                     // Total time spent offline (ms)
  offlineEventCount: 0,                   // Number of offline/online transitions

  // ─────────────────────────────────────────────────────────────────────────
  // MEMORY & PERFORMANCE WARNINGS
  // ─────────────────────────────────────────────────────────────────────────

  memoryWarnings: [],                     // High memory usage events
  slowRenderEvents: [],                   // DOM operations taking >100ms
  longTaskCount: 0                        // JavaScript tasks > 50ms
};


/* ═══════════════════════════════════════════════════════════════════════════
 * INITIALIZATION — CAPTURE PAGE START TIME
 * ═══════════════════════════════════════════════════════════════════════════ */

CG_TELEMETRY.pageStartTime = Date.now();


/* ═══════════════════════════════════════════════════════════════════════════
 * HELPER FUNCTIONS
 * ═══════════════════════════════════════════════════════════════════════════ */

function cgTelemetrySafe(fn, fallback) {

  try {

    var value = fn();

    return (
      value === undefined ||
      value === null ||
      value === ''
    )
      ? fallback
      : value;

  } catch (err) {

    return fallback;
  }
}


function cgTelemetryRound(value) {

  if (
    typeof value !== 'number' ||
    !isFinite(value)
  ) {
    return null;
  }

  return Math.round(value);
}


function recordCgTelemetry(key, value) {

  try {

    CG_TELEMETRY[key] = value;

  } catch (err) {

    console.warn('CG telemetry record failed:', key, err);
  }
}


function recordCgTelemetryEvent(arrayKey, eventData) {

  try {

    if (
      CG_TELEMETRY[arrayKey] &&
      Array.isArray(CG_TELEMETRY[arrayKey])
    ) {

      CG_TELEMETRY[arrayKey].push(eventData);
    }

  } catch (err) {

    console.warn('CG telemetry event record failed:', arrayKey, err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * PAGE LOAD & VISIBILITY TRACKING
 * ═══════════════════════════════════════════════════════════════════════════ */

function cgInitPageLoadTracking() {

  try {

    // Track when DOM is interactive
    if (document.readyState === 'loading') {

      document.addEventListener(
        'DOMContentLoaded',
        function () {

          recordCgTelemetry(
            'pageReadyTime',
            Date.now() - CG_TELEMETRY.pageStartTime
          );
        }
      );

    } else {

      recordCgTelemetry(
        'pageReadyTime',
        Date.now() - CG_TELEMETRY.pageStartTime
      );
    }

    // Track page visibility changes (tab switching, minimizing)
    recordCgTelemetry(
      'isPageVisible',
      document.visibilityState === 'visible'
    );

    document.addEventListener('visibilitychange', function () {

      recordCgTelemetry(
        'isPageVisible',
        document.visibilityState === 'visible'
      );

      if (document.visibilityState === 'hidden') {

        CG_TELEMETRY.focusLossCount =
          (CG_TELEMETRY.focusLossCount || 0) + 1;
      }
    });

    // Detect First Paint and First Contentful Paint using PerformanceObserver
    if (
      window.PerformanceObserver &&
      performance.getEntriesByType
    ) {

      try {

        var paintObserver = new PerformanceObserver(
          function (list) {

            list.getEntries().forEach(function (entry) {

              if (entry.name === 'first-paint') {

                recordCgTelemetry(
                  'firstPaintTime',
                  cgTelemetryRound(entry.startTime)
                );

              } else if (
                entry.name === 'first-contentful-paint'
              ) {

                recordCgTelemetry(
                  'firstContentfulPaintTime',
                  cgTelemetryRound(entry.startTime)
                );
              }
            });
          }
        );

        paintObserver.observe({ entryTypes: ['paint'] });

      } catch (err) {

        console.warn('CG paint observer failed:', err);
      }
    }

  } catch (err) {

    console.warn('CG page load tracking failed:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * USER INTERACTION TRACKING
 * ═══════════════════════════════════════════════════════════════════════════ */

function cgInitInteractionTracking() {

  try {

    document.addEventListener(
      'click',
      function (e) {

        recordCgTelemetry(
          'lastUserInteractionTime',
          Date.now()
        );

        // Track "Book this" button clicks
        if (
          e.target &&
          e.target.closest &&
          e.target.closest('.book-btn')
        ) {

          CG_TELEMETRY.bookClickCount =
            (CG_TELEMETRY.bookClickCount || 0) + 1;
        }
      },
      true
    );

    document.addEventListener(
      'input',
      function (e) {

        recordCgTelemetry(
          'lastUserInteractionTime',
          Date.now()
        );

        // Track comment field interaction
        if (
          e.target &&
          e.target.id === 'volComment'
        ) {

          recordCgTelemetry(
            'commentFieldInteracted',
            true
          );

          recordCgTelemetry(
            'commentLength',
            e.target.value.length
          );
        }
      },
      true
    );

    // Track comment field focus time
    var commentField = document.getElementById('volComment');

    if (commentField) {

      commentField.addEventListener('focus', function () {

        recordCgTelemetry(
          'commentFieldFocusStartTime',
          Date.now()
        );

        recordCgTelemetry(
          'commentFieldInteracted',
          true
        );
      });

      commentField.addEventListener('blur', function () {

        var focusStartTime =
          CG_TELEMETRY.commentFieldFocusStartTime;

        if (focusStartTime) {

          var focusDuration =
            Date.now() - focusStartTime;

          recordCgTelemetry(
            'commentFieldFocusTimeMs',
            CG_TELEMETRY.commentFieldFocusTimeMs +
              focusDuration
          );

          recordCgTelemetry(
            'commentFieldFocusStartTime',
            null
          );
        }

        recordCgTelemetry(
          'commentLength',
          commentField.value.length
        );
      });
    }

    // Track focus loss
    window.addEventListener('blur', function () {

      CG_TELEMETRY.focusLossCount =
        (CG_TELEMETRY.focusLossCount || 0) + 1;
    });

  } catch (err) {

    console.warn('CG interaction tracking failed:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * NETWORK TRACKING
 * ═══════════════════════════════════════════════════════════════════════════ */

function cgInitNetworkTracking() {

  try {

    var nav = window.navigator;
    var connection =
      nav.connection ||
      nav.mozConnection ||
      nav.webkitConnection;

    if (connection) {

      recordCgTelemetry(
        'initialConnectionType',
        connection.type
      );

      recordCgTelemetry(
        'initialEffectiveType',
        connection.effectiveType
      );

      connection.addEventListener('change', function () {

        recordCgTelemetryEvent(
          'connectionChanges',
          {
            timestamp: Date.now(),
            type: connection.type,
            effectiveType: connection.effectiveType
          }
        );
      });
    }

    // Track offline/online status
    var isOnline = nav.onLine;
    var lastOnlineTime = Date.now();

    recordCgTelemetry('isOnline', isOnline);

    window.addEventListener('offline', function () {

      recordCgTelemetry('isOnline', false);
      lastOnlineTime = Date.now();
    });

    window.addEventListener('online', function () {

      var offlineDuration =
        Date.now() - lastOnlineTime;

      recordCgTelemetry('isOnline', true);
      recordCgTelemetry(
        'offlineDuration',
        CG_TELEMETRY.offlineDuration + offlineDuration
      );

      CG_TELEMETRY.offlineEventCount =
        (CG_TELEMETRY.offlineEventCount || 0) + 1;
    });

  } catch (err) {

    console.warn('CG network tracking failed:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * PERFORMANCE OBSERVER — LONG TASKS & SLOW RENDERS
 * ═══════════════════════════════════════════════════════════════════════════ */

function cgInitPerformanceObservers() {

  try {

    // Long Task API — detects JS tasks exceeding 50ms
    if (
      window.PerformanceObserver &&
      typeof PerformanceLongTaskTiming !== 'undefined'
    ) {

      try {

        var longTaskObserver = new PerformanceObserver(
          function (list) {

            list.getEntries().forEach(function (entry) {

              CG_TELEMETRY.longTaskCount =
                (CG_TELEMETRY.longTaskCount || 0) + 1;

              recordCgTelemetryEvent(
                'slowRenderEvents',
                {
                  type: 'long-task',
                  duration: cgTelemetryRound(entry.duration),
                  timestamp: Date.now()
                }
              );
            });
          }
        );

        longTaskObserver.observe({ entryTypes: ['longtask'] });

      } catch (err) {

        // Long Task API not supported in all browsers
        console.warn('CG long task observer not available:', err);
      }
    }

    // Resource timing — track individual fetch/API calls
    if (
      window.PerformanceObserver &&
      performance.getEntriesByType
    ) {

      try {

        var resourceObserver = new PerformanceObserver(
          function (list) {

            list.getEntries().forEach(function (entry) {

              if (entry.duration > 100) {

                recordCgTelemetryEvent(
                  'slowRenderEvents',
                  {
                    type: 'slow-resource',
                    name: entry.name,
                    duration: cgTelemetryRound(entry.duration),
                    timestamp: Date.now()
                  }
                );
              }
            });
          }
        );

        resourceObserver.observe({
          entryTypes: ['resource', 'measure']
        });

      } catch (err) {

        console.warn('CG resource observer failed:', err);
      }
    }

  } catch (err) {

    console.warn('CG performance observers failed:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * MEMORY MONITORING (if available)
 * ═══════════════════════════════════════════════════════════════════════════ */

function cgInitMemoryTracking() {

  try {

    if (
      performance.memory &&
      typeof performance.memory.usedJSHeapSize === 'number'
    ) {

      var checkMemory = function () {

        try {

          var heapUsed = performance.memory.usedJSHeapSize;
          var heapLimit = performance.memory.jsHeapSizeLimit;
          var usagePercent = (heapUsed / heapLimit) * 100;

          if (usagePercent > 90) {

            recordCgTelemetryEvent(
              'memoryWarnings',
              {
                timestamp: Date.now(),
                heapUsedMB: cgTelemetryRound(heapUsed / 1048576),
                heapLimitMB: cgTelemetryRound(heapLimit / 1048576),
                usagePercent: cgTelemetryRound(usagePercent)
              }
            );
          }

        } catch (err) {

          // Memory API may not be available
        }
      };

      // Check every 5 seconds
      setInterval(checkMemory, 5000);

    }

  } catch (err) {

    console.warn('CG memory tracking failed:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * API REQUEST TRACKING (Events Loading — ?action=cglist)
 *
 * To be called by cg_script.js when making the events request:
 *
 *   recordEventsRequestStart()
 *   // ... fetch happens ...
 *   recordEventsRequestEnd(status, error)
 * ═══════════════════════════════════════════════════════════════════════════ */

function recordEventsRequestStart() {

  try {

    recordCgTelemetry(
      'eventsRequestStartTime',
      Date.now()
    );

  } catch (err) {

    console.warn('Failed to record events request start:', err);
  }
}


function recordEventsRequestEnd(status, errorMessage) {

  try {

    var startTime = CG_TELEMETRY.eventsRequestStartTime;

    if (startTime) {

      var duration = Date.now() - startTime;

      recordCgTelemetry('eventsRequestMs', duration);
      recordCgTelemetry('eventsRequestStatus', status);

      // Only record error if status indicates failure (not 200-299)
      if (
        errorMessage &&
        (status < 200 || status >= 300)
      ) {

        recordCgTelemetry('eventsRequestError', errorMessage);

      } else {

        // Clear any previous error if this request succeeded
        recordCgTelemetry('eventsRequestError', null);
      }
    }

  } catch (err) {

    console.warn('Failed to record events request end:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * CAPTURE APPS SCRIPT PERFORMANCE FROM LOCALSTORAGE
 *
 * cg_script.js stores the Apps Script call duration in localStorage
 * under 'evg_booking_cg_call_duration'. This function extracts it.
 *
 * Call this in getTelemetry() to capture the backend performance data.
 * ═══════════════════════════════════════════════════════════════════════════ */

function captureCgAppScriptDuration() {

  try {

    var stored = localStorage.getItem(
      'evg_booking_cg_call_duration'
    );

    if (stored) {

      var data = JSON.parse(stored);

      if (
        data &&
        typeof data.duration_ms === 'number'
      ) {

        recordCgTelemetry(
          'appScriptDataLoadTimeMs',
          data.duration_ms
        );
      }
    }

  } catch (err) {

    console.warn(
      'Failed to capture CG Apps Script duration:',
      err
    );
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * BOOKING SUBMISSION TRACKING
 *
 * Called by cg_script.js:
 *   recordBookingInitiate()     // When user clicks "Review & Send"
 *   recordBookingSubmit()       // When form is actually submitted
 * ═══════════════════════════════════════════════════════════════════════════ */

function recordBookingInitiate() {

  try {

    recordCgTelemetry(
      'bookingInitiateTime',
      Date.now()
    );

  } catch (err) {

    console.warn('Failed to record booking initiate:', err);
  }
}


function recordBookingSubmit() {

  try {

    var initiateTime = CG_TELEMETRY.bookingInitiateTime;

    recordCgTelemetry(
      'bookingSubmitTime',
      Date.now()
    );

    if (initiateTime) {

      recordCgTelemetry(
        'bookingSubmitMs',
        Date.now() - initiateTime
      );
    }

  } catch (err) {

    console.warn('Failed to record booking submit:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * WHATSAPP CLICK TRACKING
 *
 * Called by cg_script.js when user clicks the WhatsApp button:
 *
 *   recordWhatsappClick()
 * ═══════════════════════════════════════════════════════════════════════════ */

function recordWhatsappClick() {

  try {

    var initiateTime = CG_TELEMETRY.bookingInitiateTime;

    recordCgTelemetry(
      'whatsappClickTime',
      Date.now()
    );

    if (initiateTime) {

      recordCgTelemetry(
        'reviewToWhatsappMs',
        Date.now() - initiateTime
      );
    }

  } catch (err) {

    console.warn('Failed to record WhatsApp click:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * PUBLIC API — RECORDING CARD RENDERS & SELECTIONS
 *
 * To be called by cg_script.js:
 *   recordCardRender()            // Called once per event card rendered
 *   recordSelectionCount(count)   // Called with total selected bookings
 * ═══════════════════════════════════════════════════════════════════════════ */

function recordCardRender() {

  try {

    CG_TELEMETRY.cardRenderCount =
      (CG_TELEMETRY.cardRenderCount || 0) + 1;

  } catch (err) {

    console.warn('Failed to record card render:', err);
  }
}


function recordSelectionCount(count) {

  try {

    recordCgTelemetry('selectionCount', count);

  } catch (err) {

    console.warn('Failed to record selection count:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * DEVICE INFORMATION
 * ═══════════════════════════════════════════════════════════════════════════ */

function getCgDeviceTelemetry() {

  var nav = window.navigator;
  var screenObj = window.screen;

  var touchPoints =
    cgTelemetrySafe(
      function () {
        return nav.maxTouchPoints;
      },
      0
    );

  var width =
    cgTelemetrySafe(
      function () {
        return screenObj.width;
      },
      null
    );

  var height =
    cgTelemetrySafe(
      function () {
        return screenObj.height;
      },
      null
    );

  var devicePixelRatio =
    cgTelemetrySafe(
      function () {
        return window.devicePixelRatio;
      },
      null
    );

  var deviceType = 'desktop';

  if (touchPoints > 0) {

    if (
      Math.min(
        width || 9999,
        height || 9999
      ) <= 600
    ) {

      deviceType = 'mobile';

    } else {

      deviceType = 'tablet';
    }
  }

  return {

    screenWidth: width,
    screenHeight: height,

    viewportWidth:
      cgTelemetrySafe(
        function () {
          return window.innerWidth;
        },
        null
      ),

    viewportHeight:
      cgTelemetrySafe(
        function () {
          return window.innerHeight;
        },
        null
      ),

    devicePixelRatio: devicePixelRatio,
    touchPoints: touchPoints,
    deviceType: deviceType
  };
}


/* ═══════════════════════════════════════════════════════════════════════════
 * BROWSER / OS INFORMATION
 * ═══════════════════════════════════════════════════════════════════════════ */

function getCgBrowserTelemetry() {

  var nav = window.navigator;

  var userAgent =
    cgTelemetrySafe(
      function () {
        return nav.userAgent;
      },
      ''
    );

  var platform =
    cgTelemetrySafe(
      function () {
        return nav.platform;
      },
      ''
    );

  var browser = 'Unknown';
  var browserVersion = 'Unknown';
  var operatingSystem = 'Unknown';

  var match;

  /* EDGE */
  match = userAgent.match(/Edg\/([\d.]+)/i);
  if (match) {
    browser = 'Edge';
    browserVersion = match[1];
  } else {

    /* OPERA */
    match = userAgent.match(/OPR\/([\d.]+)/i);
    if (match) {
      browser = 'Opera';
      browserVersion = match[1];
    } else {

      /* SAMSUNG INTERNET */
      match = userAgent.match(/SamsungBrowser\/([\d.]+)/i);
      if (match) {
        browser = 'Samsung Internet';
        browserVersion = match[1];
      } else {

        /* CHROME */
        match = userAgent.match(/Chrome\/([\d.]+)/i);
        if (match) {
          browser = 'Chrome';
          browserVersion = match[1];
        } else {

          /* FIREFOX */
          match = userAgent.match(/Firefox\/([\d.]+)/i);
          if (match) {
            browser = 'Firefox';
            browserVersion = match[1];
          } else {

            /* SAFARI */
            match = userAgent.match(/Version\/([\d.]+).*Safari/i);
            if (match) {
              browser = 'Safari';
              browserVersion = match[1];
            }
          }
        }
      }
    }
  }

  /* OPERATING SYSTEM */
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    operatingSystem = 'iOS';
  } else if (/Android/i.test(userAgent)) {
    operatingSystem = 'Android';
  } else if (/Windows/i.test(userAgent)) {
    operatingSystem = 'Windows';
  } else if (/Mac OS X|Macintosh/i.test(userAgent)) {
    operatingSystem = 'macOS';
  } else if (/CrOS/i.test(userAgent)) {
    operatingSystem = 'ChromeOS';
  } else if (/Linux/i.test(userAgent)) {
    operatingSystem = 'Linux';
  } else if (platform) {
    operatingSystem = platform;
  }

  return {
    browser: browser,
    browserVersion: browserVersion,
    operatingSystem: operatingSystem,
    userAgent: userAgent,
    platform: platform
  };
}


/* ═══════════════════════════════════════════════════════════════════════════
 * LANGUAGE / TIMEZONE
 * ═══════════════════════════════════════════════════════════════════════════ */

function getCgLocaleTelemetry() {

  var nav = window.navigator;

  return {

    language:
      cgTelemetrySafe(
        function () {
          return nav.language;
        },
        ''
      ),

    languages:
      cgTelemetrySafe(
        function () {
          return nav.languages
            ? nav.languages.join(',')
            : '';
        },
        ''
      ),

    timezone:
      cgTelemetrySafe(
        function () {
          return Intl.DateTimeFormat()
            .resolvedOptions()
            .timeZone;
        },
        ''
      )
  };
}


/* ═══════════════════════════════════════════════════════════════════════════
 * NETWORK INFORMATION (Connection API)
 * ═══════════════════════════════════════════════════════════════════════════ */

function getCgNetworkTelemetry() {

  var nav = window.navigator;

  var connection =
    cgTelemetrySafe(
      function () {
        return (
          nav.connection ||
          nav.mozConnection ||
          nav.webkitConnection ||
          null
        );
      },
      null
    );

  return {

    online:
      cgTelemetrySafe(
        function () {
          return nav.onLine;
        },
        null
      ),

    connectionType:
      connection
        ? cgTelemetrySafe(
            function () {
              return connection.type;
            },
            null
          )
        : null,

    effectiveConnectionType:
      connection
        ? cgTelemetrySafe(
            function () {
              return connection.effectiveType;
            },
            null
          )
        : null,

    downlinkMbps:
      connection
        ? cgTelemetrySafe(
            function () {
              return connection.downlink;
            },
            null
          )
        : null,

    rttMs:
      connection
        ? cgTelemetrySafe(
            function () {
              return connection.rtt;
            },
            null
          )
        : null,

    saveData:
      connection
        ? cgTelemetrySafe(
            function () {
              return connection.saveData;
            },
            null
          )
        : null
  };
}


/* ═══════════════════════════════════════════════════════════════════════════
 * HARDWARE INFORMATION
 * ═══════════════════════════════════════════════════════════════════════════ */

function getCgHardwareTelemetry() {

  var nav = window.navigator;

  return {

    hardwareConcurrency:
      cgTelemetrySafe(
        function () {
          return nav.hardwareConcurrency;
        },
        null
      ),

    deviceMemoryGB:
      cgTelemetrySafe(
        function () {
          return nav.deviceMemory;
        },
        null
      )
  };
}


/* ═══════════════════════════════════════════════════════════════════════════
 * PAGE PERFORMANCE (Core Web Vitals & Timing)
 * ═══════════════════════════════════════════════════════════════════════════ */

function getCgPerformanceTelemetry() {

  var result = {
    pageLoadMs: null,
    domContentLoadedMs: null,
    windowLoadMs: null
  };

  /* MODERN PERFORMANCE API */
  try {

    if (
      window.performance &&
      performance.getEntriesByType
    ) {

      var navigation =
        performance.getEntriesByType('navigation')[0];

      if (navigation) {

        result.pageLoadMs =
          cgTelemetryRound(navigation.loadEventEnd);

        result.domContentLoadedMs =
          cgTelemetryRound(
            navigation.domContentLoadedEventEnd
          );

        result.windowLoadMs =
          cgTelemetryRound(navigation.loadEventEnd);
      }
    }

  } catch (err) {
    // Ignore
  }

  /* FALLBACK FOR OLDER BROWSERS */
  if (
    result.pageLoadMs === null &&
    window.performance &&
    performance.timing
  ) {

    try {

      var timing = performance.timing;

      if (
        timing.navigationStart &&
        timing.loadEventEnd
      ) {

        result.pageLoadMs =
          timing.loadEventEnd - timing.navigationStart;
      }

      if (
        timing.navigationStart &&
        timing.domContentLoadedEventEnd
      ) {

        result.domContentLoadedMs =
          timing.domContentLoadedEventEnd -
          timing.navigationStart;
      }

      if (
        timing.navigationStart &&
        timing.loadEventEnd
      ) {

        result.windowLoadMs =
          timing.loadEventEnd - timing.navigationStart;
      }

    } catch (err2) {
      // Ignore
    }
  }

  return result;
}


/* ═══════════════════════════════════════════════════════════════════════════
 * PAGE STATE INFORMATION
 * ═══════════════════════════════════════════════════════════════════════════ */

function getCgPageTelemetry() {

  return {

    pageUrl:
      cgTelemetrySafe(
        function () {
          return window.location.href;
        },
        ''
      ),

    referrer:
      cgTelemetrySafe(
        function () {
          return document.referrer;
        },
        ''
      ),

    visibilityState:
      cgTelemetrySafe(
        function () {
          return document.visibilityState;
        },
        ''
      ),

    orientation:
      cgTelemetrySafe(
        function () {

          if (
            screen.orientation &&
            screen.orientation.type
          ) {

            return screen.orientation.type;
          }

          return '';

        },
        ''
      )
  };
}


/* ═══════════════════════════════════════════════════════════════════════════
 * MAIN TELEMETRY FUNCTION — CALL THIS AT SUBMISSION TIME
 * ═══════════════════════════════════════════════════════════════════════════ */

function getTelemetry() {

  try {

    // Capture Apps Script backend performance from localStorage
    captureCgAppScriptDuration();

    // Calculate time on page at submission time
    if (CG_TELEMETRY.pageStartTime) {

      recordCgTelemetry(
        'timeOnPageMs',
        Date.now() - CG_TELEMETRY.pageStartTime
      );
    }

    // Calculate idle time (time since last interaction)
    if (CG_TELEMETRY.lastUserInteractionTime) {

      recordCgTelemetry(
        'idleTimeMs',
        Date.now() - CG_TELEMETRY.lastUserInteractionTime
      );

    } else {

      // No interaction yet = all time is idle
      recordCgTelemetry(
        'idleTimeMs',
        CG_TELEMETRY.timeOnPageMs
      );
    }

  } catch (err) {

    console.warn('Error calculating derived CG metrics:', err);
  }

  var device = getCgDeviceTelemetry();
  var browser = getCgBrowserTelemetry();
  var locale = getCgLocaleTelemetry();
  var network = getCgNetworkTelemetry();
  var hardware = getCgHardwareTelemetry();
  var performanceData = getCgPerformanceTelemetry();
  var page = getCgPageTelemetry();

  return {

    // ─────────────────────────────────────────────────────────────────────
    // DEVICE METRICS
    // ─────────────────────────────────────────────────────────────────────

    screenWidth: device.screenWidth,
    screenHeight: device.screenHeight,
    viewportWidth: device.viewportWidth,
    viewportHeight: device.viewportHeight,
    devicePixelRatio: device.devicePixelRatio,
    touchPoints: device.touchPoints,
    deviceType: device.deviceType,

    // ─────────────────────────────────────────────────────────────────────
    // BROWSER / OS
    // ─────────────────────────────────────────────────────────────────────

    browser: browser.browser,
    browserVersion: browser.browserVersion,
    operatingSystem: browser.operatingSystem,
    userAgent: browser.userAgent,
    platform: browser.platform,

    // ─────────────────────────────────────────────────────────────────────
    // LOCALE
    // ─────────────────────────────────────────────────────────────────────

    language: locale.language,
    languages: locale.languages,
    timezone: locale.timezone,

    // ─────────────────────────────────────────────────────────────────────
    // NETWORK
    // ─────────────────────────────────────────────────────────────────────

    online: network.online,
    connectionType: network.connectionType,
    effectiveConnectionType: network.effectiveConnectionType,
    downlinkMbps: network.downlinkMbps,
    rttMs: network.rttMs,
    saveData: network.saveData,
    offlineDuration: CG_TELEMETRY.offlineDuration,
    offlineEventCount: CG_TELEMETRY.offlineEventCount,
    connectionChanges: CG_TELEMETRY.connectionChanges,

    // ─────────────────────────────────────────────────────────────────────
    // HARDWARE
    // ─────────────────────────────────────────────────────────────────────

    hardwareConcurrency: hardware.hardwareConcurrency,
    deviceMemoryGB: hardware.deviceMemoryGB,

    // ─────────────────────────────────────────────────────────────────────
    // PAGE PERFORMANCE & TIMING
    // ─────────────────────────────────────────────────────────────────────

    pageLoadMs: performanceData.pageLoadMs,
    domContentLoadedMs: performanceData.domContentLoadedMs,
    windowLoadMs: performanceData.windowLoadMs,
    firstPaintTime: CG_TELEMETRY.firstPaintTime,
    firstContentfulPaintTime:
      CG_TELEMETRY.firstContentfulPaintTime,

    // ─────────────────────────────────────────────────────────────────────
    // USER ENGAGEMENT & TIME METRICS
    // ─────────────────────────────────────────────────────────────────────

    timeOnPageMs: CG_TELEMETRY.timeOnPageMs,
    idleTimeMs: CG_TELEMETRY.idleTimeMs,
    isPageVisible: CG_TELEMETRY.isPageVisible,
    focusLossCount: CG_TELEMETRY.focusLossCount,

    // ─────────────────────────────────────────────────────────────────────
    // API PERFORMANCE (cglist request via loadEvents)
    // ─────────────────────────────────────────────────────────────────────

    eventsRequestMs: CG_TELEMETRY.eventsRequestMs,
    eventsRequestStatus: CG_TELEMETRY.eventsRequestStatus,
    eventsRequestError: CG_TELEMETRY.eventsRequestError,
    eventsRequestRetries: CG_TELEMETRY.eventsRequestRetries,
    appScriptDataLoadTimeMs: CG_TELEMETRY.appScriptDataLoadTimeMs,

    // ─────────────────────────────────────────────────────────────────────
    // BOOKING SUBMISSION METRICS
    // ─────────────────────────────────────────────────────────────────────

    bookingSubmitMs: CG_TELEMETRY.bookingSubmitMs,
    reviewToWhatsappMs: CG_TELEMETRY.reviewToWhatsappMs,

    // ─────────────────────────────────────────────────────────────────────
    // UI INTERACTION METRICS
    // ─────────────────────────────────────────────────────────────────────

    bookClickCount: CG_TELEMETRY.bookClickCount,
    selectionCount: CG_TELEMETRY.selectionCount,
    cardRenderCount: CG_TELEMETRY.cardRenderCount,
    commentFieldInteracted:
      CG_TELEMETRY.commentFieldInteracted,
    commentLength: CG_TELEMETRY.commentLength,
    commentFieldFocusTimeMs:
      CG_TELEMETRY.commentFieldFocusTimeMs,

    // ─────────────────────────────────────────────────────────────────────
    // PERFORMANCE WARNINGS & EVENTS
    // ─────────────────────────────────────────────────────────────────────

    longTaskCount: CG_TELEMETRY.longTaskCount,
    slowRenderEvents: CG_TELEMETRY.slowRenderEvents,
    memoryWarnings: CG_TELEMETRY.memoryWarnings,

    // ─────────────────────────────────────────────────────────────────────
    // PAGE STATE
    // ─────────────────────────────────────────────────────────────────────

    visibilityState: page.visibilityState,
    orientation: page.orientation,
    pageUrl: page.pageUrl,
    referrer: page.referrer
  };
}


/* ═══════════════════════════════════════════════════════════════════════════
 * INITIALIZATION — START ALL TRACKING
 * ═══════════════════════════════════════════════════════════════════════════ */

try {

  cgInitPageLoadTracking();
  cgInitInteractionTracking();
  cgInitNetworkTracking();
  cgInitPerformanceObservers();
  cgInitMemoryTracking();

} catch (err) {

  console.error(
    'CG telemetry initialization failed (booking will still work):',
    err
  );
}
