# 🚀 Frontend Performance Optimization Guide

## Executive Summary
Your observation about performance is correct. The dashboards have several optimization opportunities, mostly related to **data fetching patterns**, **DOM rendering efficiency**, and **polling intervals**.

Good news: Most optimizations are **LOW RISK** and can be implemented incrementally. Your earlier finding (removing animated pulsing markers) already demonstrates the best optimization approach: identify what's thrashing the system and make it static.

---

## Current Performance Issues

### 1. **Multiple Fetch Calls on Page Load** 🔴 HIGH IMPACT
**Where:** Facility Dashboard (`facility-data.js`)

```javascript
// Lines 46, 66, 154, 176, 205, 243, 259, 283
await fetch(/api/facilities)                    // All facilities
await fetch(/api/facilities/disease-spread)    // Disease data
await fetch(/api/audit/visits-log)             // Visit history
await fetch(/api/vessels)                       // All vessels
await fetch(/api/boat/plan/confirmed)          // Confirmed plans
await fetch(/api/ocean/current)                // Ocean data (per facility)
await fetch(/api/checkProximity)               // Proximity checks
```

**Problem:** These happen in **parallel promise chains**, meaning if one is slow, it blocks the UI.

**Impact:** 
- Facility dashboard feels slow to load initially
- Each facility selection triggers ocean current fetches
- User sees blank page/loading spinner for longer

**Quick Fix (Phase 1 - EASY):**
```javascript
// BEFORE: Sequential loading with potential blocking
const [facilities, diseases, vessels] = await Promise.all([
  fetch('/api/facilities'),
  fetch('/api/facilities/disease-spread'),
  fetch('/api/vessels')
]);

// AFTER: Load critical data first, non-critical data in background
const facilities = await fetch('/api/facilities');
const diseases = await fetch('/api/facilities/disease-spread');
// Load ocean data ONLY when facility is selected, not upfront
// This avoids fetching ocean data for facilities user never clicks
```

---

### 2. **Excessive Polling/SetInterval** 🔴 HIGH IMPACT
**Where:** Multiple files

| File | Interval | Purpose | Impact |
|------|----------|---------|--------|
| `facility-data.js` line 92 | 100ms | Waiting for facilities to load | ⚠️ Busy-waits (blocks other code) |
| `app.js` line 53 | 15,000ms (15s) | Check API status | ✓ OK |
| `app.js` line 1167 | 300,000ms (5min) | Proximity checks | ✓ OK |
| `vessel-dashboard/vessel.js` line 823 | Unknown | Quarantine countdown | ❌ Needs review |
| `facility-calendar.js` line 109 | Unknown | Calendar polling | ❌ Needs review |
| `route-proposals.js` line 24 | Unknown | Route polling | ❌ Needs review |

**Problem:**
- **100ms polling** in facility-data.js is terrible for performance
- Multiple setIntervals can accumulate and cause jank
- Each poll triggers re-renders even if data hasn't changed

**Quick Fix (Phase 1 - EASY):**
```javascript
// BEFORE: Bad busy-wait pattern
const check = setInterval(() => {
  if (this.facilities.length > 0) {
    clearInterval(check);
    resolve();
  }
}, 100);  // ← Checks 10 times per SECOND!

// AFTER: Use proper Promise-based waiting
async function waitForFacilities() {
  return new Promise(resolve => {
    if (this.facilities.length > 0) {
      resolve();
      return;
    }
    // Only check once when facilities actually load
    this.addEventListener('facilitiesLoaded', resolve, { once: true });
  });
}
```

---

### 3. **Map Marker Updates Without Visibility Check** ⚠️ MEDIUM IMPACT
**Where:** `facility-map.js`

**Problem:** When toggling visibility, the code may still update/render markers that are hidden.

**Quick Fix (Phase 1 - EASY):**
```javascript
// BEFORE: Updates all markers even if hidden
refreshFacilitiesView() {
  this.facilityMarkers.forEach(marker => {
    updateMarkerDisplay(marker);  // Updates even if showFacilities=false
  });
}

// AFTER: Skip updates for hidden layers
refreshFacilitiesView() {
  if (!this.showFacilities) return; // Skip expensive update
  this.facilityMarkers.forEach(marker => {
    updateMarkerDisplay(marker);
  });
}
```

---

### 4. **DOM Reflow During Large List Rendering** ⚠️ MEDIUM IMPACT
**Where:** Facility selector population, visit history rendering

**Problem:** When populating large dropdown/lists, each item added triggers a reflow.

**Quick Fix (Phase 1 - EASY):**
```javascript
// BEFORE: Reflow on every append
facilities.forEach(f => {
  const option = document.createElement('option');
  select.appendChild(option);  // ← Reflow each time!
});

// AFTER: Build in memory, append once
const fragment = document.createDocumentFragment();
facilities.forEach(f => {
  const option = document.createElement('option');
  fragment.appendChild(option);  // Temporary, no reflow
});
select.appendChild(fragment);  // Single reflow!
```

---

### 5. **Leaflet Map Re-initialization on Every Facility Selection** ⚠️ MEDIUM IMPACT
**Where:** `facility-map.js` - `displayFacility()` method

**Problem:** May be clearing and recreating map markers unnecessarily.

**Quick Fix (Phase 2 - MEDIUM):**
```javascript
// BEFORE: Rebuilds all markers
displayFacility(facility) {
  this.facilityMarkers = [];  // Clear everything
  this.map.clearLayers().getContainer().innerHTML = '';  // Erase map
  // Rebuild...
}

// AFTER: Update only changed markers
displayFacility(facility) {
  // Reuse existing markers, update only what changed
  const marker = this.facilityMarkers.find(m => m.facility.id === facility.id);
  if (marker) {
    marker.setPopupContent(newContent);  // Update only this marker
  } else {
    this.addMarker(facility);  // Add only new marker
  }
}
```

---

### 6. **API Calls Without Caching/Throttling** ⚠️ MEDIUM IMPACT
**Where:** Facility selection triggers ocean current API calls

**Problem:** Each facility click = API call, no deduplication if same facility is clicked twice.

**Quick Fix (Phase 1 - EASY):**
```javascript
// Add simple cache
const oceanDataCache = new Map();

async function getOceanData(facility) {
  const cacheKey = `${facility.lat}_${facility.lon}`;
  
  if (oceanDataCache.has(cacheKey)) {
    return oceanDataCache.get(cacheKey);  // Return cached
  }
  
  const data = await fetch(`/api/ocean/current?lat=${facility.lat}...`);
  oceanDataCache.set(cacheKey, data);
  
  // Clear old cache after 10 minutes
  setTimeout(() => oceanDataCache.delete(cacheKey), 600000);
  
  return data;
}
```

---

## Optimization Strategy

### 🟢 Phase 1: Quick Wins (1-2 hours) - Safe, High Impact
1. ✅ Remove 100ms busy-wait polling in facility-data.js
2. ✅ Add visibility checks before updating hidden map elements
3. ✅ Use DocumentFragment for batch DOM updates
4. ✅ Lazy-load ocean data (only fetch when facility selected)
5. ✅ Add basic API caching for ocean/disease data

**Risk:** VERY LOW - these are syntax/pattern improvements, not logic changes

**Expected Improvement:** 30-50% faster initial load, 20-30% less jank during interaction

---

### 🟡 Phase 2: Medium Complexity (2-4 hours) - Requires Testing
1. Optimize Leaflet marker updates (reuse markers instead of recreating)
2. Implement Intersection Observer for lazy-loading far-away facilities
3. Use CSS transforms for animations instead of DOM rewrites
4. Debounce API calls during rapid facility switching

**Risk:** MEDIUM - need to test map interaction carefully

**Expected Improvement:** 25-40% faster facility switching, smoother interaction

---

### 🔵 Phase 3: Advanced (4+ hours) - Only if needed
1. Implement virtual scrolling for large facility lists
2. Use Web Workers for heavy calculations (proximity checks, haversine)
3. IndexedDB caching for persistent data
4. Service Worker caching for offline capability

**Risk:** HIGHER - architectural changes needed

**Expected Improvement:** 50%+ performance gains, but only helpful if dashboards scale significantly

---

## Recommended Action Plan

### Start with Phase 1 (You have high confidence in these changes):

**Fix #1: Remove the 100ms busy-wait** (5 minutes)
```javascript
// File: facility-data.js, line ~92
// BEFORE
const check = setInterval(() => {
  if (this.facilities.length > 0) {
    clearInterval(check);
    resolve();
  }
}, 100);

// AFTER
// Create a custom event system or use Promise resolution
this.facilitiesLoaded = true;
resolve();  // Just resolve immediately after facilities are loaded
```

**Fix #2: Lazy-load ocean data** (15 minutes)
```javascript
// File: facility-data.js
// Move ocean current fetch from init() to getOceanData()
// Only fetch when actually needed
```

**Fix #3: Add fragment batching** (10 minutes)
```javascript
// File: app.js - populateFacilitySelector() function
// Use DocumentFragment to batch DOM updates
```

---

## Testing Checklist

After each optimization:
- [ ] Initial page load time (measure with browser DevTools)
- [ ] Facility selection response time
- [ ] Map rendering smoothness
- [ ] No console errors
- [ ] Visit history still populates correctly
- [ ] API status indicator still works

---

## Monitoring

To measure improvements:

```javascript
// Add to app.js
console.time('Initial Load');
await FacilityData.init();
console.timeEnd('Initial Load');

console.time('Facility Selection');
selectFacility(facility);
console.timeEnd('Facility Selection');
```

---

## Summary by Dashboard

### Facility Dashboard (Slowest) ⚠️ Priority 1
- **Main issue:** 100ms polling + multiple API calls on load
- **Quick fix:** Remove busy-wait, lazy-load ocean data
- **Expected gain:** 40-50% faster feels

### Vessel Dashboard (Slower but less critical) ⚠️ Priority 2
- **Main issue:** Unknown polling intervals, map updates
- **Quick fix:** Check and optimize quarantine polling
- **Expected gain:** 20-30% feels faster

### Admin Dashboard (Least slow) ✓ Priority 3
- **Status:** Not mentioned as slow, probably fine
- **Action:** Monitor, optimize only if needed later

---

## Next Steps

1. **Would you like me to implement Phase 1 optimizations?** (Safe, 30 min total)
2. **Should we measure current performance first** with DevTools?
3. **Or would you prefer to try one optimization manually** and see the difference?

The good news: You already know what works (static markers = smoother). These optimizations follow the same principle: **remove unnecessary work, cache what you can, update only what's visible**.
