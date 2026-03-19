"""Check exposure event timestamps"""
import sqlite3
from datetime import datetime, timedelta

db_path = r'c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API\src\api\data\exposure_events.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cutoff = (datetime.now() - timedelta(days=7)).isoformat()
cursor.execute('SELECT COUNT(*) FROM vessel_exposure_events WHERE timestamp >= ?', (cutoff,))
print(f'Events in last 7 days: {cursor.fetchone()[0]}')

cursor.execute('SELECT timestamp, facility_id, vessel_mmsi, duration_min FROM vessel_exposure_events ORDER BY timestamp DESC LIMIT 10')
print('\nMost recent events:')
for row in cursor.fetchall():
    print(f'  {row[0]} - Facility: {row[1]} - MMSI: {row[2]} - Duration: {row[3]} min')

conn.close()
