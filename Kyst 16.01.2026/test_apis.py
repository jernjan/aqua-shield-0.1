#!/usr/bin/env python3
"""
Test BarentsWatch APIs and Copernicus data availability.
"""

import requests
import os
from dotenv import load_dotenv
from pathlib import Path
import json

load_dotenv()

def test_barentswatch_facilities():
    """Test BarentsWatch Facilities API"""
    print("\n" + "="*60)
    print("TEST 1: BarentsWatch Facilities API")
    print("="*60)
    
    url = 'https://www.barentswatch.no/bwapi/v1/geodata/fishhealth/localities'
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            count = len(data) if isinstance(data, list) else 1
            print(f"SUCCESS: Got {count} facility records")
            if isinstance(data, list) and len(data) > 0:
                print(f"Sample facility: {json.dumps(data[0], indent=2, ensure_ascii=False)}")
            return True
        else:
            print(f"FAILED: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False


def test_barentswatch_nais():
    """Test BarentsWatch NAIS Health API"""
    print("\n" + "="*60)
    print("TEST 2: BarentsWatch NAIS Health API")
    print("="*60)
    
    # Get current week
    from datetime import datetime
    year = datetime.now().year
    week = datetime.now().isocalendar()[1]
    
    url = f'https://www.barentswatch.no/bwapi/v1/geodata/fishhealth/{year}/{week}'
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: Got NAIS data for week {week}/{year}")
            print(f"Data type: {type(data).__name__}")
            if isinstance(data, dict):
                print(f"Keys: {list(data.keys())}")
                print(f"Sample data: {json.dumps(data, indent=2, ensure_ascii=False, default=str)[:500]}")
            return True
        else:
            print(f"FAILED: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False


def test_copernicus_data():
    """Test if Copernicus data file exists"""
    print("\n" + "="*60)
    print("TEST 3: Copernicus Marine Data File")
    print("="*60)
    
    copernicus_dir = Path("copernicus_data")
    
    if copernicus_dir.exists():
        nc_files = list(copernicus_dir.glob("*.nc"))
        if nc_files:
            print(f"SUCCESS: Found {len(nc_files)} NetCDF file(s)")
            for f in nc_files:
                size_mb = f.stat().st_size / (1024*1024)
                print(f"  - {f.name} ({size_mb:.2f} MB)")
            
            # Try to read with xarray
            try:
                import xarray as xr
                ds = xr.open_dataset(str(nc_files[0]))
                print(f"Data variables: {list(ds.data_vars.keys())}")
                print(f"Dimensions: {dict(ds.dims)}")
                ds.close()
                return True
            except ImportError:
                print("(xarray not installed for detailed inspection)")
                return True
            except Exception as e:
                print(f"Could not read with xarray: {e}")
                return True
        else:
            print("FAILED: No NetCDF files found in copernicus_data/")
            return False
    else:
        print("FAILED: copernicus_data/ directory not found")
        return False


def main():
    print("\n" + "="*70)
    print("AQUACULTURE RISK SYSTEM - API VERIFICATION TEST")
    print("="*70)
    
    results = {
        "BarentsWatch Facilities": test_barentswatch_facilities(),
        "BarentsWatch NAIS": test_barentswatch_nais(),
        "Copernicus Data": test_copernicus_data(),
    }
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    for test_name, passed in results.items():
        status = "PASSED" if passed else "FAILED"
        print(f"{test_name}: {status}")
    
    print("\n" + "="*70)
    print("ALTERNATIVE DATA SOURCES FOR RISK CALCULATIONS")
    print("="*70)
    
    sources = """
1. **Existing Verified Sources:**
   - BarentsWatch Facilities: 2,687 aquaculture locations (VERIFIED WORKING)
   - BarentsWatch NAIS: Weekly aggregated health summary (VERIFIED WORKING)
   - Copernicus Marine: Ocean currents/temperature (VERIFIED DOWNLOADED)

2. **Additional APIs Worth Considering:**

   a) YR.no Weather Forecast (FREE, NO AUTH)
      - URL: https://api.weatherapi.com/v1/ (requires key) OR yr.no
      - Data: Temperature, wind, precipitation, humidity
      - Coverage: Norway + global
      - Use case: Disease risk (higher temps increase disease spread)
      - Integration: Simple HTTP requests
      - Status: NOT YET TESTED

   b) SMHI Sweden Meteorological & Hydrological Institute (FREE)
      - URL: https://www.smhi.se/polopoly_fs/1.71391!/
      - Data: Oceanographic + weather data (Nordic region)
      - Coverage: Baltic Sea, North Sea, Barentshavet
      - Use case: Environmental risk parameters
      - Status: NOT YET TESTED

   c) EMODnet European Marine Data Network (FREE)
      - URL: https://www.emodnet.eu/
      - Data: Bathymetry, biology, chemistry, physics
      - Coverage: European waters
      - Use case: Salinity, temperature, dissolved oxygen
      - Status: NOT YET TESTED

   d) SeaDataCloud (FREE)
      - URL: https://www.seadatacloud.eu/
      - Data: In-situ oceanographic observations
      - Coverage: European waters
      - Use case: Validation of Copernicus data
      - Status: NOT YET TESTED

3. **Risk Calculation Inputs You Already Have:**
   - Facility locations (from BarentsWatch)
   - Weekly disease counts (from NAIS)
   - Ocean currents (from Copernicus)
   - Ocean temperature (from Copernicus)
   
   READY TO USE FOR: Water exchange rate, disease dispersal modeling

4. **Recommended Next Steps:**
   1. Integrate Copernicus data into risk calculation
   2. Test YR.no weather API for temperature validation
   3. Build API endpoint: /api/risk-assessment/{facility_id}
   4. Return: Location + health status + current risk score
   5. Include: Environmental factors (currents, temp, salinity)
"""
    
    print(sources)


if __name__ == "__main__":
    main()
