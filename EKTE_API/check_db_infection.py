import sqlite3

conn = sqlite3.connect('aquashield.db')
cursor = conn.cursor()

# Check infected facilities
cursor.execute("SELECT COUNT(*) FROM facility_master WHERE is_infected = 1")
infected_count = cursor.fetchone()[0]
print(f"Infected facilities: {infected_count}")

# Check risk zone facilities  
cursor.execute("SELECT COUNT(*) FROM facility_master WHERE in_risk_zone = 1")
risk_count = cursor.fetchone()[0]
print(f"Risk zone facilities: {risk_count}")

# Check vessels
cursor.execute("SELECT COUNT(*) FROM vessel_visits")
visits_count = cursor.fetchone()[0]
print(f"Total visits: {visits_count}")

# Check some facilities with coordinates
cursor.execute("SELECT COUNT(*) FROM facility_master WHERE latitude IS NOT NULL AND longitude IS NOT NULL")
coord_count = cursor.fetchone()[0]
print(f"Facilities with coordinates: {coord_count}")

# Check actual infected facility
cursor.execute("SELECT facility_code, facility_name, is_infected, latitude, longitude FROM facility_master WHERE is_infected = 1 LIMIT 1")
result = cursor.fetchone()
if result:
    print(f"\nSample infected facility: {result}")

conn.close()
