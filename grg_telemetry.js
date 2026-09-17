/* ═══════════════════════════════════════════════════════════════════════════
 * GRG Booking System — Enhanced Client Telemetry
 *
 * Purpose:
 *   Collect comprehensive browser, device, network, performance, and UX
 *   metrics for testing, troubleshooting, and understanding user experience.
 *
 * Metrics Tracked:
 *   - Device & browser information
 *   - Page performance (initial load, interaction timing)
 *   - API/webhook call performance (slots request)
 *   - User engagement (time on page, idle time)
 *   - UI interaction metrics (card renders, clicks)
 *   - Network quality indicators
 *   - Error tracking
 *
 * Usage:
 *   Call getTelemetry() to retrieve complete telemetry snapshot at submission time.
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

var GRG_TELEMETRY = {
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

  timeOnPageMs: null,                     // Total seconds from page load to submission
  lastUserInteractionTime: null,          // Timestamp of last click/input
  idleTimeMs: null,                       // Time since last interaction
  isPageVisible: null,                    // Page currently visible (not minimized)
  focusLossCount: null,                   // How many times user left the page

  // ─────────────────────────────────────────────────────────────────────────
  // WEBHOOK / SLOTS REQUEST METRICS
  // ─────────────────────────────────────────────────────────────────────────

  slotsRequestStartTime: null,            // When slots request began
  slotsRequestMs: null,                   // Duration of slots fetch (ms)
  slotsRequestStatus: null,               // HTTP status (200, 404, 500, etc)
  slotsRequestError: null,                // Error message if failed
  slotsRequestRetries: 0,                 // Number of retry attempts
  appScriptDataLoadTimeMs: null,          // Apps Script backend call duration (from grg_script)

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

  slotClickCount: 0,                      // Total times user clicked slots
  slotSelectCount: 0,                     // Slots currently selected
  cardRenderCount: 0,                     // How many day cards rendered
  monthChangeCount: 0,                    // Times user changed month
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

GRG_TELEMETRY.pageStartTime = Date.now();


/* ═══════════════════════════════════════════════════════════════════════════
 * HELPER FUNCTIONS
 * ═══════════════════════════════════════════════════════════════════════════ */

function telemetrySafe(fn, fallback) {

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


function telemetryRound(value) {

  if (
    typeof value !== 'number' ||
    !isFinite(value)
  ) {
    return null;
  }

  return Math.round(value);
}


function recordTelemetry(key, value) {

  try {

    GRG_TELEMETRY[key] = value;

  } catch (err) {

    console.warn('Telemetry record failed:', key, err);
  }
}


function recordTelemetryEvent(arrayKey, eventData) {

  try {

    if (
      GRG_TELEMETRY[arrayKey] &&
      Array.isArray(GRG_TELEMETRY[arrayKey])
    ) {

      GRG_TELEMETRY[arrayKey].push(eventData);
    }

  } catch (err) {

    console.warn('Telemetry event record failed:', arrayKey, err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * PAGE LOAD & VISIBILITY TRACKING
 * ═══════════════════════════════════════════════════════════════════════════ */

function initPageLoadTracking() {

  try {

    // Track when DOM is interactive
    if (document.readyState === 'loading') {

      document.addEventListener(
        'DOMContentLoaded',
        function () {

          recordTelemetry(
            'pageReadyTime',
            Date.now() - GRG_TELEMETRY.pageStartTime
          );
        }
      );

    } else {

      recordTelemetry(
        'pageReadyTime',
        Date.now() - GRG_TELEMETRY.pageStartTime
      );
    }

    // Track page visibility changes (tab switching, minimizing)
    recordTelemetry(
      'isPageVisible',
      document.visibilityState === 'visible'
    );

    document.addEventListener('visibilitychange', function () {

      recordTelemetry(
        'isPageVisible',
        document.visibilityState === 'visible'
      );

      if (document.visibilityState === 'hidden') {

        GRG_TELEMETRY.focusLossCount =
          (GRG_TELEMETRY.focusLossCount || 0) + 1;
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

                recordTelemetry(
                  'firstPaintTime',
                  telemetryRound(entry.startTime)
                );

              } else if (
                entry.name === 'first-contentful-paint'
              ) {

                recordTelemetry(
                  'firstContentfulPaintTime',
                  telemetryRound(entry.startTime)
                );
              }
            });
          }
        );

        paintObserver.observe({ entryTypes: ['paint'] });

      } catch (err) {

        console.warn('Paint observer failed:', err);
      }
    }

  } catch (err) {

    console.warn('Page load tracking failed:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * USER INTERACTION TRACKING
 * ═══════════════════════════════════════════════════════════════════════════ */

function initInteractionTracking() {

  try {

    document.addEventListener(
      'click',
      function (e) {

        recordTelemetry(
          'lastUserInteractionTime',
          Date.now()
        );

        // Track slot clicks
        if (
          e.target &&
          e.target.classList.contains('slot-btn')
        ) {

          GRG_TELEMETRY.slotClickCount =
            (GRG_TELEMETRY.slotClickCount || 0) + 1;
        }
      },
      true
    );

    document.addEventListener(
      'input',
      function (e) {

        recordTelemetry(
          'lastUserInteractionTime',
          Date.now()
        );

        // Track comment field interaction
        if (
          e.target &&
          e.target.id === 'volComment'
        ) {

          recordTelemetry(
            'commentFieldInteracted',
            true
          );

          recordTelemetry(
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

        recordTelemetry(
          'commentFieldFocusStartTime',
          Date.now()
        );

        recordTelemetry(
          'commentFieldInteracted',
          true
        );
      });

      commentField.addEventListener('blur', function () {

        var focusStartTime =
          GRG_TELEMETRY.commentFieldFocusStartTime;

        if (focusStartTime) {

          var focusDuration =
            Date.now() - focusStartTime;

          recordTelemetry(
            'commentFieldFocusTimeMs',
            GRG_TELEMETRY.commentFieldFocusTimeMs +
              focusDuration
          );

          recordTelemetry(
            'commentFieldFocusStartTime',
            null
          );
        }

        recordTelemetry(
          'commentLength',
          commentField.value.length
        );
      });
    }

    // Track focus loss
    window.addEventListener('blur', function () {

      GRG_TELEMETRY.focusLossCount =
        (GRG_TELEMETRY.focusLossCount || 0) + 1;
    });

  } catch (err) {

    console.warn('Interaction tracking failed:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * NETWORK TRACKING
 * ═══════════════════════════════════════════════════════════════════════════ */

function initNetworkTracking() {

  try {

    var nav = window.navigator;
    var connection =
      nav.connection ||
      nav.mozConnection ||
      nav.webkitConnection;

    if (connection) {

      recordTelemetry(
        'initialConnectionType',
        connection.type
      );

      recordTelemetry(
        'initialEffectiveType',
        connection.effectiveType
      );

      connection.addEventListener('change', function () {

        recordTelemetryEvent(
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

    recordTelemetry('isOnline', isOnline);

    window.addEventListener('offline', function () {

      recordTelemetry('isOnline', false);
      lastOnlineTime = Date.now();
    });

    window.addEventListener('online', function () {

      var offlineDuration =
        Date.now() - lastOnlineTime;

      recordTelemetry('isOnline', true);
      recordTelemetry(
        'offlineDuration',
        GRG_TELEMETRY.offlineDuration + offlineDuration
      );

      GRG_TELEMETRY.offlineEventCount =
        (GRG_TELEMETRY.offlineEventCount || 0) + 1;
    });

  } catch (err) {

    console.warn('Network tracking failed:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * PERFORMANCE OBSERVER — LONG TASKS & SLOW RENDERS
 * ═══════════════════════════════════════════════════════════════════════════ */

function initPerformanceObservers() {

  try {

    // Long Task API — detects JS tasks exceeding 50ms
    if (
      window.PerformanceObserver &&
      PerformanceLongTaskTiming
    ) {

      try {

        var longTaskObserver = new PerformanceObserver(
          function (list) {

            list.getEntries().forEach(function (entry) {

              GRG_TELEMETRY.longTaskCount =
                (GRG_TELEMETRY.longTaskCount || 0) + 1;

              recordTelemetryEvent(
                'slowRenderEvents',
                {
                  type: 'long-task',
                  duration: telemetryRound(entry.duration),
                  timestamp: Date.now()
                }
              );
            });
          }
        );

        longTaskObserver.observe({ entryTypes: ['longtask'] });

      } catch (err) {

        // Long Task API not supported in all browsers
        console.warn('Long task observer not available:', err);
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

                recordTelemetryEvent(
                  'slowRenderEvents',
                  {
                    type: 'slow-resource',
                    name: entry.name,
                    duration: telemetryRound(entry.duration),
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

        console.warn('Resource observer failed:', err);
      }
    }

  } catch (err) {

    console.warn('Performance observers failed:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * MEMORY MONITORING (if available)
 * ═══════════════════════════════════════════════════════════════════════════ */

function initMemoryTracking() {

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

            recordTelemetryEvent(
              'memoryWarnings',
              {
                timestamp: Date.now(),
                heapUsedMB: telemetryRound(heapUsed / 1048576),
                heapLimitMB: telemetryRound(heapLimit / 1048576),
                usagePercent: telemetryRound(usagePercent)
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

    console.warn('Memory tracking failed:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * API REQUEST TRACKING (Slots Loading)
 *
 * To be called by grg_script.js when making the slots request:
 *
 *   recordSlotsRequestStart()
 *   // ... fetch happens ...
 *   recordSlotsRequestEnd(status, error)
 * ═══════════════════════════════════════════════════════════════════════════ */

function recordSlotsRequestStart() {

  try {

    recordTelemetry(
      'slotsRequestStartTime',
      Date.now()
    );

  } catch (err) {

    console.warn('Failed to record slots request start:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * CAPTURE APPS SCRIPT PERFORMANCE FROM LOCALSTORAGE
 *
 * grg_script.js stores the Apps Script call duration in localStorage
 * under 'evg_booking_grg_call_duration'. This function extracts it.
 *
 * Call this in getTelemetry() to capture the backend performance data.
 * ═══════════════════════════════════════════════════════════════════════════ */

function captureAppScriptDuration() {

  try {

    var stored = localStorage.getItem(
      'evg_booking_grg_call_duration'
    );

    if (stored) {

      var data = JSON.parse(stored);

      if (
        data &&
        typeof data.duration_ms === 'number'
      ) {

        recordTelemetry(
          'appScriptDataLoadTimeMs',
          data.duration_ms
        );
      }
    }

  } catch (err) {

    console.warn(
      'Failed to capture Apps Script duration:',
      err
    );
  }
}


function recordSlotsRequestEnd(status, errorMessage) {

  try {

    var startTime = GRG_TELEMETRY.slotsRequestStartTime;

    if (startTime) {

      var duration = Date.now() - startTime;

      recordTelemetry('slotsRequestMs', duration);
      recordTelemetry('slotsRequestStatus', status);

      // Only record error if status indicates failure (not 200-299)
      if (
        errorMessage &&
        (status < 200 || status >= 300)
      ) {

        recordTelemetry('slotsRequestError', errorMessage);

      } else {

        // Clear any previous error if this request succeeded
        recordTelemetry('slotsRequestError', null);
      }
    }

  } catch (err) {

    console.warn('Failed to record slots request end:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * BOOKING SUBMISSION TRACKING
 *
 * Called by grg_script.js:
 *   recordBookingInitiate()     // When user clicks "Review & Send"
 *   recordBookingSubmit()       // When form is actually submitted
 * ═══════════════════════════════════════════════════════════════════════════ */

function recordBookingInitiate() {

  try {

    recordTelemetry(
      'bookingInitiateTime',
      Date.now()
    );

  } catch (err) {

    console.warn('Failed to record booking initiate:', err);
  }
}


function recordBookingSubmit() {

  try {

    var initiateTime = GRG_TELEMETRY.bookingInitiateTime;

    recordTelemetry(
      'bookingSubmitTime',
      Date.now()
    );

    if (initiateTime) {

      recordTelemetry(
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
 * Called by grg_script.js when user clicks the WhatsApp button:
 *
 *   recordWhatsappClick()
 * ═══════════════════════════════════════════════════════════════════════════ */

function recordWhatsappClick() {

  try {

    var initiateTime = GRG_TELEMETRY.bookingInitiateTime;

    recordTelemetry(
      'whatsappClickTime',
      Date.now()
    );

    if (initiateTime) {

      recordTelemetry(
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
 * To be called by grg_script.js when rendering day cards:
 *   recordCardRender()          // Called once per day card
 *   recordSlotSelection(count)  // Called with total selected slots
 *   recordMonthChange()         // Called when month dropdown changes
 * ═══════════════════════════════════════════════════════════════════════════ */

function recordCardRender() {

  try {

    GRG_TELEMETRY.cardRenderCount =
      (GRG_TELEMETRY.cardRenderCount || 0) + 1;

  } catch (err) {

    console.warn('Failed to record card render:', err);
  }
}


function recordSlotSelection(count) {

  try {

    recordTelemetry('slotSelectCount', count);

  } catch (err) {

    console.warn('Failed to record slot selection:', err);
  }
}


function recordMonthChange() {

  try {

    GRG_TELEMETRY.monthChangeCount =
      (GRG_TELEMETRY.monthChangeCount || 0) + 1;

  } catch (err) {

    console.warn('Failed to record month change:', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * DEVICE INFORMATION
 * ═══════════════════════════════════════════════════════════════════════════ */

function getDeviceTelemetry() {

  var nav = window.navigator;
  var screenObj = window.screen;

  var touchPoints =
    telemetrySafe(
      function () {
        return nav.maxTouchPoints;
      },
      0
    );

  var width =
    telemetrySafe(
      function () {
        return screenObj.width;
      },
      null
    );

  var height =
    telemetrySafe(
      function () {
        return screenObj.height;
      },
      null
    );

  var devicePixelRatio =
    telemetrySafe(
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
      telemetrySafe(
        function () {
          return window.innerWidth;
        },
        null
      ),

    viewportHeight:
      telemetrySafe(
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

function getBrowserTelemetry() {

  var nav = window.navigator;

  var userAgent =
    telemetrySafe(
      function () {
        return nav.userAgent;
      },
      ''
    );

  var platform =
    telemetrySafe(
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

function getLocaleTelemetry() {

  var nav = window.navigator;

  return {

    language:
      telemetrySafe(
        function () {
          return nav.language;
        },
        ''
      ),

    languages:
      telemetrySafe(
        function () {
          return nav.languages
            ? nav.languages.join(',')
            : '';
        },
        ''
      ),

    timezone:
      telemetrySafe(
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

function getNetworkTelemetry() {

  var nav = window.navigator;

  var connection =
    telemetrySafe(
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
      telemetrySafe(
        function () {
          return nav.onLine;
        },
        null
      ),

    connectionType:
      connection
        ? telemetrySafe(
            function () {
              return connection.type;
            },
            null
          )
        : null,

    effectiveConnectionType:
      connection
        ? telemetrySafe(
            function () {
              return connection.effectiveType;
            },
            null
          )
        : null,

    downlinkMbps:
      connection
        ? telemetrySafe(
            function () {
              return connection.downlink;
            },
            null
          )
        : null,

    rttMs:
      connection
        ? telemetrySafe(
            function () {
              return connection.rtt;
            },
            null
          )
        : null,

    saveData:
      connection
        ? telemetrySafe(
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

function getHardwareTelemetry() {

  var nav = window.navigator;

  return {

    hardwareConcurrency:
      telemetrySafe(
        function () {
          return nav.hardwareConcurrency;
        },
        null
      ),

    deviceMemoryGB:
      telemetrySafe(
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

function getPerformanceTelemetry() {

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
          telemetryRound(navigation.loadEventEnd);

        result.domContentLoadedMs =
          telemetryRound(
            navigation.domContentLoadedEventEnd
          );

        result.windowLoadMs =
          telemetryRound(navigation.loadEventEnd);
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

function getPageTelemetry() {

  return {

    pageUrl:
      telemetrySafe(
        function () {
          return window.location.href;
        },
        ''
      ),

    referrer:
      telemetrySafe(
        function () {
          return document.referrer;
        },
        ''
      ),

    visibilityState:
      telemetrySafe(
        function () {
          return document.visibilityState;
        },
        ''
      ),

    orientation:
      telemetrySafe(
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
    captureAppScriptDuration();

    // Calculate time on page at submission time
    if (GRG_TELEMETRY.pageStartTime) {

      recordTelemetry(
        'timeOnPageMs',
        Date.now() - GRG_TELEMETRY.pageStartTime
      );
    }

    // Calculate idle time (time since last interaction)
    if (GRG_TELEMETRY.lastUserInteractionTime) {

      recordTelemetry(
        'idleTimeMs',
        Date.now() - GRG_TELEMETRY.lastUserInteractionTime
      );

    } else {

      // No interaction yet = all time is idle
      recordTelemetry(
        'idleTimeMs',
        GRG_TELEMETRY.timeOnPageMs
      );
    }

  } catch (err) {

    console.warn('Error calculating derived metrics:', err);
  }

  var device = getDeviceTelemetry();
  var browser = getBrowserTelemetry();
  var locale = getLocaleTelemetry();
  var network = getNetworkTelemetry();
  var hardware = getHardwareTelemetry();
  var performanceData = getPerformanceTelemetry();
  var page = getPageTelemetry();

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
    offlineDuration: GRG_TELEMETRY.offlineDuration,
    offlineEventCount: GRG_TELEMETRY.offlineEventCount,
    connectionChanges: GRG_TELEMETRY.connectionChanges,

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
    firstPaintTime: GRG_TELEMETRY.firstPaintTime,
    firstContentfulPaintTime:
      GRG_TELEMETRY.firstContentfulPaintTime,

    // ─────────────────────────────────────────────────────────────────────
    // USER ENGAGEMENT & TIME METRICS
    // ─────────────────────────────────────────────────────────────────────

    timeOnPageMs: GRG_TELEMETRY.timeOnPageMs,
    idleTimeMs: GRG_TELEMETRY.idleTimeMs,
    isPageVisible: GRG_TELEMETRY.isPageVisible,
    focusLossCount: GRG_TELEMETRY.focusLossCount,

    // ─────────────────────────────────────────────────────────────────────
    // API & WEBHOOK PERFORMANCE
    // ─────────────────────────────────────────────────────────────────────

    slotsRequestMs: GRG_TELEMETRY.slotsRequestMs,
    slotsRequestStatus: GRG_TELEMETRY.slotsRequestStatus,
    slotsRequestError: GRG_TELEMETRY.slotsRequestError,
    slotsRequestRetries: GRG_TELEMETRY.slotsRequestRetries,
    appScriptDataLoadTimeMs: GRG_TELEMETRY.appScriptDataLoadTimeMs,

    // ─────────────────────────────────────────────────────────────────────
    // BOOKING SUBMISSION METRICS
    // ─────────────────────────────────────────────────────────────────────

    bookingSubmitMs: GRG_TELEMETRY.bookingSubmitMs,
    reviewToWhatsappMs: GRG_TELEMETRY.reviewToWhatsappMs,

    // ─────────────────────────────────────────────────────────────────────
    // UI INTERACTION METRICS
    // ─────────────────────────────────────────────────────────────────────

    slotClickCount: GRG_TELEMETRY.slotClickCount,
    slotSelectCount: GRG_TELEMETRY.slotSelectCount,
    cardRenderCount: GRG_TELEMETRY.cardRenderCount,
    monthChangeCount: GRG_TELEMETRY.monthChangeCount,
    commentFieldInteracted:
      GRG_TELEMETRY.commentFieldInteracted,
    commentLength: GRG_TELEMETRY.commentLength,
    commentFieldFocusTimeMs:
      GRG_TELEMETRY.commentFieldFocusTimeMs,

    // ─────────────────────────────────────────────────────────────────────
    // PERFORMANCE WARNINGS & EVENTS
    // ─────────────────────────────────────────────────────────────────────

    longTaskCount: GRG_TELEMETRY.longTaskCount,
    slowRenderEvents: GRG_TELEMETRY.slowRenderEvents,
    memoryWarnings: GRG_TELEMETRY.memoryWarnings,

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

  initPageLoadTracking();
  initInteractionTracking();
  initNetworkTracking();
  initPerformanceObservers();
  initMemoryTracking();

} catch (err) {

  console.error(
    'Telemetry initialization failed (booking will still work):',
    err
  );
}