"""
Data Quality Validation Script
Checks exposure_events.db and quarantine_registry.json for data quality issues
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict

def validate_exposure_events():
    """Validate vessel_exposure_events table"""
    print("\n" + "="*80, flush=True)
    print("VALIDATING EXPOSURE EVENTS DATABASE", flush=True)
    print("="*80, flush=True)
    
    db_path = Path("EKTE_API/src/api/data/exposure_events.db")
    if not db_path.exists():
        print(f"[ERROR] Database not found: {db_path}", flush=True)
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get total count
    cursor.execute("SELECT COUNT(*) FROM vessel_exposure_events")
    total_records = cursor.fetchone()[0]
    print(f"\n[INFO] Total records: {total_records}", flush=True)
    
    # 1. Check for duplicates (same MMSI + facility + timestamp)
    print("\n[CHECK] Checking for duplicate records...", flush=True)
    cursor.execute("""
        SELECT vessel_mmsi, facility_id, facility_name, timestamp, COUNT(*) as count
        FROM vessel_exposure_events
        GROUP BY vessel_mmsi, facility_id, timestamp
        HAVING count > 1
        ORDER BY count DESC
        LIMIT 10
    """)
    duplicates = cursor.fetchall()
    if duplicates:
        print(f"[WARNING] Found {len(duplicates)} duplicate groups:", flush=True)
        for dup in duplicates[:5]:
            print(f"   MMSI {dup[0]} -> {dup[2]} at {dup[3]}: {dup[4]} copies", flush=True)
    else:
        print("[OK] No duplicates found", flush=True)
    
    # 2. Check timestamps
    print("\n[CHECK] Checking timestamp validity...", flush=True)
    now = datetime.now()
    future_cutoff = (now + timedelta(days=1)).isoformat()
    cursor.execute("""
        SELECT COUNT(*) FROM vessel_exposure_events 
        WHERE timestamp > ?
    """, (future_cutoff,))
    future_count = cursor.fetchone()[0]
    
    if future_count > 0:
        print(f"[WARNING] Found {future_count} records with future timestamps", flush=True)
        cursor.execute("""
            SELECT vessel_mmsi, facility_name, timestamp 
            FROM vessel_exposure_events 
            WHERE timestamp > ?
            LIMIT 5
        """, (future_cutoff,))
        for row in cursor.fetchall():
            print(f"   MMSI {row[0]} -> {row[1]}: {row[2]}", flush=True)
    else:
        print("[OK] No future timestamps found", flush=True)
    
    # Check for very old timestamps (before 2020)
    cursor.execute("""
        SELECT COUNT(*) FROM vessel_exposure_events 
        WHERE timestamp < '2020-01-01'
    """)
    old_count = cursor.fetchone()[0]
    if old_count > 0:
        print(f"[WARNING] Found {old_count} records before 2020", flush=True)
    else:
        print("[OK] No suspiciously old timestamps", flush=True)
    
    # 3. Distance validation
    print("\n[CHECK] Checking distance consistency...", flush=True)
    cursor.execute("""
        SELECT COUNT(*) FROM vessel_exposure_events 
        WHERE distance_km > 1.0
    """)
    far_distance_count = cursor.fetchone()[0]
    
    print(f"[INFO] Records with distance > 1 km: {far_distance_count}", flush=True)
    if far_distance_count > 0:
        print("   Note: These should only be cluster context visits (>1km but <=10km)", flush=True)
        cursor.execute("""
            SELECT vessel_mmsi, facility_name, distance_km, timestamp
            FROM vessel_exposure_events 
            WHERE distance_km > 10.0
            LIMIT 5
        """)
        over_10km = cursor.fetchall()
        if over_10km:
            print(f"[WARNING] Found {len(over_10km)} records > 10 km (should not exist):", flush=True)
            for row in over_10km:
                print(f"   MMSI {row[0]} -> {row[1]}: {row[2]:.2f} km at {row[3]}", flush=True)
        else:
            print("[OK] No records exceed 10 km threshold", flush=True)
    
    # 4. Check for missing critical fields
    print("\n[CHECK] Checking for missing critical fields...", flush=True)
    cursor.execute("""
        SELECT COUNT(*) FROM vessel_exposure_events 
        WHERE vessel_mmsi IS NULL OR vessel_mmsi = ''
    """)
    missing_mmsi = cursor.fetchone()[0]
    
    cursor.execute("""
        SELECT COUNT(*) FROM vessel_exposure_events 
        WHERE facility_id IS NULL OR facility_id = ''
    """)
    missing_facility = cursor.fetchone()[0]
    
    cursor.execute("""
        SELECT COUNT(*) FROM vessel_exposure_events 
        WHERE timestamp IS NULL OR timestamp = ''
    """)
    missing_timestamp = cursor.fetchone()[0]
    
    if missing_mmsi > 0:
        print(f"[WARNING] {missing_mmsi} records missing vessel_mmsi", flush=True)
    else:
        print("[OK] All records have vessel_mmsi", flush=True)
    
    if missing_facility > 0:
        print(f"[WARNING] {missing_facility} records missing facility_id", flush=True)
    else:
        print("[OK] All records have facility_id", flush=True)
    
    if missing_timestamp > 0:
        print(f"[WARNING] {missing_timestamp} records missing timestamp", flush=True)
    else:
        print("[OK] All records have timestamp", flush=True)
    
    # 5. Disease status distribution
    print("\n[INFO] Disease status distribution:", flush=True)
    cursor.execute("""
        SELECT disease_status, COUNT(*) as count
        FROM vessel_exposure_events
        GROUP BY disease_status
        ORDER BY count DESC
    """)
    for status, count in cursor.fetchall():
        percentage = (count / total_records) * 100
        print(f"   {status}: {count} ({percentage:.1f}%)", flush=True)
    
    # 6. Check vessel distribution
    print("\n[INFO] Vessel activity distribution:", flush=True)
    cursor.execute("""
        SELECT vessel_mmsi, COUNT(*) as visit_count
        FROM vessel_exposure_events
        GROUP BY vessel_mmsi
        HAVING visit_count > 20
        ORDER BY visit_count DESC
        LIMIT 10
    """)
    active_vessels = cursor.fetchall()
    if active_vessels:
        print(f"   Top 10 most active vessels:", flush=True)
        for mmsi, count in active_vessels:
            print(f"   MMSI {mmsi}: {count} visits", flush=True)
    
    conn.close()


def validate_quarantine_registry():
    """Validate quarantine_registry.json"""
    print("\n" + "="*80, flush=True)
    print("VALIDATING QUARANTINE REGISTRY", flush=True)
    print("="*80, flush=True)
    
    registry_path = Path("EKTE_API/data/quarantine_registry.json")
    if not registry_path.exists():
        print(f"[ERROR] Registry not found: {registry_path}", flush=True)
        return
    
    with open(registry_path, 'r', encoding='utf-8') as f:
        registry = json.load(f)
    
    auto_registered = registry.get('auto_registered', [])
    print(f"\n[INFO] Total quarantine entries: {len(auto_registered)}", flush=True)
    
    # 1. Check source names
    print("\n[CHECK] Checking source names...", flush=True)
    unknown_sources = [
        e for e in auto_registered 
        if not e.get('source_name') or 
        e['source_name'] in ['', 'unknown', 'Infected facility (quarantine source)']
    ]
    known_sources = len(auto_registered) - len(unknown_sources)
    
    print(f"[OK] Known sources: {known_sources} ({(known_sources/len(auto_registered)*100):.1f}%)", flush=True)
    print(f"[WARNING] Unknown sources: {len(unknown_sources)} ({(len(unknown_sources)/len(auto_registered)*100):.1f}%)", flush=True)
    
    if len(unknown_sources) > 0:
        print(f"\n   Sample vessels with unknown sources:", flush=True)
        for entry in unknown_sources[:5]:
            print(f"   MMSI {entry.get('vessel_mmsi')} - registered {entry.get('registered_date')}", flush=True)
    
    # 2. Check timestamp validity
    print("\n[CHECK] Checking quarantine timestamps...", flush=True)
    now = datetime.now()
    future_entries = []
    very_old_entries = []
    
    for entry in auto_registered:
        reg_date = entry.get('registered_date', '')
        try:
            reg_dt = datetime.fromisoformat(reg_date.replace('Z', '+00:00'))
            if reg_dt > now + timedelta(days=1):
                future_entries.append(entry)
            elif reg_dt < datetime(2020, 1, 1):
                very_old_entries.append(entry)
        except:
            pass
    
    if future_entries:
        print(f"[WARNING] {len(future_entries)} entries with future timestamps", flush=True)
    else:
        print("[OK] No future timestamps", flush=True)
    
    if very_old_entries:
        print(f"[WARNING] {len(very_old_entries)} entries before 2020", flush=True)
    else:
        print("[OK] No suspiciously old entries", flush=True)
    
    # 3. Check for duplicate vessels
    print("\n[CHECK] Checking for duplicate vessel registrations...", flush=True)
    mmsi_counts = defaultdict(int)
    for entry in auto_registered:
        mmsi = entry.get('vessel_mmsi')
        if mmsi:
            mmsi_counts[mmsi] += 1
    
    duplicates = {mmsi: count for mmsi, count in mmsi_counts.items() if count > 1}
    if duplicates:
        print(f"[WARNING] Found {len(duplicates)} vessels with multiple registrations:", flush=True)
        for mmsi, count in list(duplicates.items())[:5]:
            print(f"   MMSI {mmsi}: {count} registrations", flush=True)
    else:
        print("[OK] No duplicate vessel registrations", flush=True)
    
    # 4. Check visits_logged integrity
    print("\n[CHECK] Checking visits_logged data...", flush=True)
    entries_with_visits = [e for e in auto_registered if e.get('visits_logged')]
    entries_without_visits = len(auto_registered) - len(entries_with_visits)
    
    print(f"[OK] Entries with visits_logged: {len(entries_with_visits)}", flush=True)
    print(f"[WARNING] Entries without visits_logged: {entries_without_visits}", flush=True)
    
    # 5. Check registry status distribution
    print("\n[INFO] Registry status distribution:", flush=True)
    status_counts = defaultdict(int)
    for entry in auto_registered:
        visits = entry.get('visits_logged', [])
        if visits:
            # Count by most recent status
            most_recent = max(visits, key=lambda v: v.get('timestamp', ''))
            status_counts[most_recent.get('facility_status', 'unknown')] += 1
        else:
            status_counts['no_visits'] += 1
    
    for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"   {status}: {count}", flush=True)


def cross_reference_validation():
    """Cross-reference exposure_events with quarantine_registry"""
    print("\n" + "="*80, flush=True)
    print("CROSS-REFERENCE VALIDATION", flush=True)
    print("="*80, flush=True)
    
    # Load quarantine registry
    registry_path = Path("EKTE_API/data/quarantine_registry.json")
    if not registry_path.exists():
        print("[ERROR] Cannot perform cross-reference: registry not found", flush=True)
        return
    
    with open(registry_path, 'r', encoding='utf-8') as f:
        registry = json.load(f)
    
    auto_registered = registry.get('auto_registered', [])
    registry_mmsis = {e.get('vessel_mmsi') for e in auto_registered if e.get('vessel_mmsi')}
    
    # Load exposure events
    db_path = Path("EKTE_API/src/api/data/exposure_events.db")
    if not db_path.exists():
        print("[ERROR] Cannot perform cross-reference: database not found", flush=True)
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get vessels with infected visits
    cursor.execute("""
        SELECT DISTINCT vessel_mmsi 
        FROM vessel_exposure_events 
        WHERE disease_status = 'infected'
    """)
    infected_mmsis = {row[0] for row in cursor.fetchall()}
    
    print(f"\n[INFO] Vessels with infected visits in DB: {len(infected_mmsis)}", flush=True)
    print(f"[INFO] Vessels in quarantine registry: {len(registry_mmsis)}", flush=True)
    
    # Check for vessels with infected visits NOT in registry
    missing_from_registry = infected_mmsis - registry_mmsis
    if missing_from_registry:
        print(f"\n[WARNING] {len(missing_from_registry)} vessels with infected visits NOT in quarantine registry:", flush=True)
        for mmsi in list(missing_from_registry)[:5]:
            cursor.execute("""
                SELECT facility_name, timestamp 
                FROM vessel_exposure_events 
                WHERE vessel_mmsi = ? AND disease_status = 'infected'
                ORDER BY timestamp DESC
                LIMIT 1
            """, (mmsi,))
            row = cursor.fetchone()
            if row:
                print(f"   MMSI {mmsi}: visited {row[0]} at {row[1]}", flush=True)
    else:
        print("[OK] All vessels with infected visits are in quarantine registry", flush=True)
    
    # Check for vessels in registry WITHOUT infected visits
    orphaned_in_registry = registry_mmsis - infected_mmsis
    if orphaned_in_registry:
        print(f"\n[WARNING] {len(orphaned_in_registry)} vessels in registry WITHOUT infected visits in DB", flush=True)
        print("   (This might be expected if events were cleaned or expired)", flush=True)
    
    conn.close()


def main():
    print("\n" + "="*80, flush=True)
    print("AQUASHIELD DATA QUALITY VALIDATION", flush=True)
    print("="*80, flush=True)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    
    try:
        validate_exposure_events()
    except Exception as e:
        print(f"\n[ERROR] Error validating exposure events: {e}", flush=True)
    
    try:
        validate_quarantine_registry()
    except Exception as e:
        print(f"\n[ERROR] Error validating quarantine registry: {e}", flush=True)
    
    try:
        cross_reference_validation()
    except Exception as e:
        print(f"\n[ERROR] Error in cross-reference validation: {e}", flush=True)
    
    print("\n" + "="*80, flush=True)
    print("VALIDATION COMPLETE", flush=True)
    print("="*80, flush=True)


if __name__ == "__main__":
    main()
