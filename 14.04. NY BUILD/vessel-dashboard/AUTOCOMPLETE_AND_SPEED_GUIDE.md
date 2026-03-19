# Vessel Dashboard - Route Planner Enhancements

## New Features

### 1. 🔍 Autocomplete Facility Search
When searching for aquaculture facilities by name, the system now provides **real-time autocomplete suggestions** as you type.

**How to use:**
- Click on the search field under "🔍 Søk etter anlegg"
- Start typing the facility name (e.g., "Valøyan", "Mannbruholmen", "Grøttingsøy", "Slettholmene")
- A dropdown list will appear with matching facilities
- Click on any suggestion to automatically:
  - Select the facility (checkbox is checked)
  - Populate the search field with the full name
  - Scroll to the facility in the list

**Features:**
- Case-insensitive search
- Partial matching (search for "val" will find "Valøyan")
- Shows facility names with location municipality
- Displays top 8 suggestions to avoid overwhelming the interface
- Automatically hides autocomplete when clicking outside

### 2. ⚡ Boat Speed Adjustment
The system now allows you to set your boat's speed to get **more accurate travel time estimates** for your route.

**How to use:**
- At the top of the route planner, enter your boat speed in km/h
- Default speed: 18.52 km/h (10 knots)
- The system instantly converts to knots (nautical units)
- Travel times will automatically recalculate based on your speed

**Speed conversion reference:**
- 10 knots = 18.52 km/h (default, typical service speed)
- 15 knots = 27.78 km/h
- 20 knots = 37.04 km/h
- 25 knots = 46.30 km/h

**Why this matters:**
- Different boats have different maximum speeds
- Weather conditions affect actual speed
- Network maintenance vessels typically operate at 10-15 knots
- Get precise ETA estimates for your specific boat

### 3. Enhanced Route Display
All route estimates now show:
- **Total distance** in kilometers
- **Total travel time** in hours and minutes (e.g., "2t 15min")
- **Boat speed** used for calculations (km/h and knots)
- **Estimated time of arrival** from current time
- Individual segment times for each facility

## Example Workflow

### Creating a route with the new features:

1. **Speed Setup**
   - Enter your boat speed: "25" km/h
   - See conversion: "13.5 knops"

2. **Search and Add Facilities**
   - Click search field
   - Type "Val"
   - See "Valøyan" appear in suggestions
   - Click suggestion to select it

3. **Add More Facilities**
   - Continue searching for "Mann"
   - Select "Mannbruholmen"
   - Search "Grøtt"
   - Select "Grøttingsøy"
   - Search "Slett"
   - Select "Slettholmene"

4. **Calculate Route**
   - Click "Beregn rute"
   - See complete route with:
     - Total: 47.3 km | 2t 15min | Hastighet: 25.0 km/h (13.5 knop)
     - Each stop showing expected arrival time
     - Accurate times based on YOUR boat speed

## Technical Details

### Files Modified

1. **routes-planner.js**
   - Added `getBoatSpeed()` function to read speed from input
   - Added `facilitiesList` cache for faster autocomplete
   - Enhanced `setupFacilitySelector()` with:
     - Speed control HTML
     - Autocomplete dropdown
     - Real-time search with dropdown suggestions
     - `selectFacilityFromAutocomplete()` function for selection
   - Updated `buildRoute()` to use dynamic speed
   - Enhanced `displayPlannedRoute()` to show speed and formatted times
   - Added `formatTimeFromMinutes()` helper function

2. **styles.css**
   - Added `.autocomplete` styling for dropdown
   - Added input focus states
   - Added hover effects for suggestions
   - Responsive design for autocomplete dropdown

3. **index.html**
   - No changes needed - uses existing `#facilitySelector` div
   - Autocomplete and speed controls are injected via JavaScript

## API Integration

The system loads real BarentsWatch facility data from:
```
http://127.0.0.1:8002/api/facilities?limit=500
```

The route planner supports:
- **Real facility names** from the API (not mock data)
- **Actual coordinates** for distance calculations
- **Disease status** (infected/uninfected/proximity risk)
- **Risk-aware routing** that avoids disease hotspots

## Troubleshooting

### Autocomplete not showing facilities
- Ensure the API is running: `http://127.0.0.1:8002/health`
- Check that facilities are loading (should see ✓ facilities loaded in console)
- Verify facility names contain your search term

### Speed not updating times
- Ensure you enter a numeric value (not letters)
- Speed must be greater than 0 km/h
- Changes take effect immediately on next route calculation

### Can't find a specific facility
- Try different spellings or partial names
- Some facilities may use abbreviations
- Check the full facility list by leaving search empty
- Type slowly to see suggestions appear

## Keyboard Shortcuts

- **Tab** - Navigate between search and checkbox list
- **Escape** - Close autocomplete dropdown (when implemented)
- **Enter** - on checkbox - Toggle facility selection

## Future Enhancements

Potential improvements for next version:
- [ ] Keyboard navigation in autocomplete (arrow keys, enter to select)
- [ ] Save favorite boat speeds for different vessels
- [ ] Route history and replay previous routes
- [ ] Real-time speed adjustment during active route
- [ ] Weather-adjusted speed suggestions
- [ ] Estimated fuel consumption based on speed and distance
- [ ] Multi-language support for facility names

---

**Version:** 2.0.0  
**Last Updated:** February 17, 2026  
**Status:** Production Ready ✓
