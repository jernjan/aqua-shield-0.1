import json

# Check what data we have from AIS
with open("EKTE_API/src/api/data/vessel_tracks.json") as f:
    tracks = json.load(f)
    if tracks:
        first_mmsi = list(tracks.keys())[0]
        print(f"Sample vessel track (MMSI {first_mmsi}):")
        positions = tracks[first_mmsi][:3]
        for pos in positions:
            print(f"  {pos}")
    else:
        print("No vessel tracks recorded yet")

# Check facility data
with open("EKTE_API/src/api/data/exposure_events.db") as f:
    pass

# Try BarentsWatch facilities API to see what fields are available
print("\nChecking what BarentsWatch facilities API provides...")
print("Fields needed:")
print("  - facility_code (we have)")
print("  - facility_name (we have)") 
print("  - latitude/longitude (NOT in exposure_events)")
print("  - risk_level (we have as 'High/Medium/Critical')")
print("\nFor vessels from AIS:")
print("  - mmsi (we have)")
print("  - latitude/longitude (AIS provides)")
print("  - vessel_name (we have)")
print("  - vessel_type/ship_type (AIS SHOULD provide!)")
