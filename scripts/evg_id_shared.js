/**
 * ========================================
 * EVG Shared Device Identity & Tracking
 * ========================================
 *
 * Shared utilities for device identity management and last-accessed tracking
 * across the EVG Portal. Include this on every page (portal, GRG, courses,
 * notes, etc.) and call ensureDeviceIdentity() early in that page's
 * initialization.
 *
 * Provides:
 * - Persistent device ID generation & retrieval
 * - Last access timestamp tracking
 * - Volunteer name storage & retrieval
 */

/* ========================================
   CONFIGURATION: localStorage Key Names
   ======================================== */
var EVG_KEYS = {
    NAME: 'evg_name',                      // Volunteer's first/known name
    DEVICE: 'evg_device_id',               // Unique device identifier
    LAST: 'evg_last_accessed_date'         // Last visit timestamp (ISO 8601)
};

/* ========================================
   UTILITY: Generate Device ID
   Creates a UUID for device identification
   ======================================== */
/**
 * Generates a unique device identifier.
 *
 * Strategy:
 * 1. Uses crypto.randomUUID() when available (requires secure context:
 *    https://, or http://localhost / 127.0.0.1)
 * 2. Falls back to timestamp-based ID on plain-http origins (e.g., LAN IP)
 *    where crypto.randomUUID is not available
 *
 * Returns: UUID string (v4 cryptographic) or fallback ID string
 */
function evgMakeId() {
    if (window.crypto && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback: combine timestamp + random number for uniqueness
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

/* ========================================
   INITIALIZATION: Ensure Device Identity
   Creates device ID if missing, timestamps access
   ======================================== */
/**
 * Initializes device identity on page load.
 *
 * Behavior:
 * - Checks if evg_device_id exists in localStorage
 * - If missing: generates a new UUID and stores it (never overwrites)
 * - If exists: leaves it unchanged
 * - Updates evg_last_accessed_date to current timestamp (always)
 *
 * Safe to call on every page load, regardless of entry point or navigation.
 *
 * Usage: Call in your page's load/init function:
 *   function load() {
 *       ensureDeviceIdentity();
 *       const name = evgGetName();
 *       // ... rest of init
 *   }
 */
function ensureDeviceIdentity() {
    // Create device ID only once (idempotent)
    if (!localStorage.getItem(EVG_KEYS.DEVICE)) {
        localStorage.setItem(EVG_KEYS.DEVICE, evgMakeId());
    }

    // Always update last access time (tracks when device last visited)
    localStorage.setItem(EVG_KEYS.LAST, new Date().toISOString());
}

/* ========================================
   GETTERS: Convenience Accessors
   Retrieve stored values without knowing key names
   ======================================== */
/**
 * Retrieves the volunteer's name from localStorage.
 * Returns: Name string, or empty string if not set
 * Usage: const name = evgGetName();
 */
function evgGetName() {
    return localStorage.getItem(EVG_KEYS.NAME) || '';
}

/**
 * Retrieves this device's unique identifier.
 * Returns: Device ID string (UUID), or empty string if not set
 * Usage: const deviceId = evgGetDevice();
 */
function evgGetDevice() {
    return localStorage.getItem(EVG_KEYS.DEVICE) || '';
}

/**
 * Retrieves the timestamp of last device access.
 * Returns: ISO 8601 timestamp string, or empty string if not set
 * Usage: const lastVisit = evgGetLast();
 */
function evgGetLast() {
    return localStorage.getItem(EVG_KEYS.LAST) || '';
}
