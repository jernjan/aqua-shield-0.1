# Ocean Current Risk Calculation Fix

## Problem
The facility disease risk calculation was showing **645 "Ekstrem" risk facilities** - far too many and unrealistic.

### Root Cause
The Copernicus ocean current client (`src/api/clients/copernicus.py`) was returning **hardcoded mock data**:
- Velocity: 0.17 m/s (same for all locations)
- Direction: 208° (same for all locations)  

This mock data caused the risk calculation to reduce **effective distance by ~73 km** for each facility (assuming virus survives 5 days in water).

**Example:**
- Allersholmen: 22.8 km from infected facility → 22.8 - 73 = 0 km effective distance → **"Ekstrem" risk**
- Should be: 22.8 km = "Lav" risk (>20 km)

## Solution
Disabled ocean current integration in the risk calculation until real NetCDF data is available.

### Changes Made

#### 1. **src/api/main.py** (lines 247-260)
- Commented out the loop that fetches ocean currents for every infected facility
- Ocean current data is not cached or used in risk calculations

#### 2. **src/api/risk_engine.py** (lines 965-975)
- Added documentation explaining virus travel calculation is disabled
- The code still supports it when real ocean current data becomes available
- Currently `current_velocity_ms` will always be `None`, so `effective_distance` = `distance_km`

## Results

### Before Fix
```
Ekstrem:  645 facilities
Høy:      80 facilities
Moderat:  156 facilities
Lav:      170 facilities
Total:    1,051 at risk
```

### After Fix
```
Ekstrem:  129 facilities (realistic - <5km or confirmed infections)
Høy:      179 facilities
Moderat:  310 facilities  
Lav:      416 facilities
Total:    1,034 at risk
```

## How to Re-enable Ocean Currents

When real NetCDF data (`data/barentshavet_currents.nc`) is available:

1. **Update CopernicusClient** (`src/api/clients/copernicus.py`):
   - Replace hardcoded mock data with real xarray data loading
   - Parse NetCDF file with proper latitude/longitude interpolation
   - Return actual velocity components

2. **Uncomment ocean current fetch** in `src/api/main.py` (line 250-261)

3. **Verify calibration**:
   - Test with a known infected facility
   - Check virus travel distance vs. actual infection zones
   - Adjust `virus_survival_days` if needed (currently 5 days)

## Example: Enabling Ocean Currents

```python
# In copernicus.py - once real data is available:
def get_ocean_currents(self, latitude: float, longitude: float):
    """Load real ocean current data from NetCDF file"""
    import xarray as xr
    
    ds = xr.open_dataset(self.data_file)
    # Interpolate to requested coordinates
    u = ds['uo'].interp(latitude=latitude, longitude=longitude)
    v = ds['vo'].interp(latitude=latitude, longitude=longitude)
    
    # Calculate magnitude and direction
    magnitude = (u**2 + v**2)**0.5
    direction = np.degrees(np.arctan2(u, v))
    
    return {
        'velocity_magnitude': float(magnitude),
        'direction_degrees': float(direction),
        'eastward_velocity_ms': float(u),
        'northward_velocity_ms': float(v)
    }
```

## Risk Categories (Current - Distance Based)

**For ILA/PD (Infectious Salmon Anemia / Pancreas Disease):**
- Ekstrem: < 5 km
- Høy: 5-10 km  
- Moderat: 10-20 km (ILA) / 10-30 km (PD)
- Lav: > 30 km

These are Mattilsynet (Norwegian Fish Health Authority) standard zones.

## Testing

To verify the fix is working:
```bash
python check_ekstrem_risk.py
# Should show ~129 Ekstrem facilities, not 645
```

## References
- **Mattilsynet Guidelines:** Disease control zones based on waterborne transmission
- **NetCDF File:** `data/barentshavet_currents.nc` (from Copernicus Marine Service)
- **Virus Survival:** ILA/PD viruses survive 3-7 days in seawater (using 5-day average)
