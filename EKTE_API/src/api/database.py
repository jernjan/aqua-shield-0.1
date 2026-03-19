"""
SQLite database for permanent exposure logging.
Creates a data moat of all vessel-facility interactions.
"""
import sqlite3
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path

# Database path
DB_DIR = Path(__file__).parent / "data"
DB_PATH = DB_DIR / "exposure_events.db"


def init_database():
    """Initialize the SQLite database with required tables."""
    DB_DIR.mkdir(exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Main exposure events table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vessel_exposure_events (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            vessel_mmsi TEXT NOT NULL,
            vessel_name TEXT,
            facility_id TEXT NOT NULL,
            facility_name TEXT,
            distance_km REAL NOT NULL,
            duration_min INTEGER,
            disease_status TEXT,
            quarantine_end_time TEXT,
            risk_triggered BOOLEAN DEFAULT 0,
            risk_level TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create indices separately
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vessel_mmsi ON vessel_exposure_events(vessel_mmsi)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_facility_id ON vessel_exposure_events(facility_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON vessel_exposure_events(timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_risk_triggered ON vessel_exposure_events(risk_triggered)")
    
    # Facility timeline cache for fast queries
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS facility_timeline_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            facility_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            event_data TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            severity TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create timeline cache index separately
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_facility_timeline ON facility_timeline_cache(facility_id, timestamp)")
    
    # SMITTESPREDNING EVENTS: Tracks infection paths (boat from infected facility to clean facility)
    # This is the core operational table for biosecurity
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS smittespredning_events (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp_start TEXT NOT NULL,
            timestamp_end TEXT,
            vessel_mmsi TEXT NOT NULL,
            vessel_name TEXT,
            facility_start_id TEXT NOT NULL,
            facility_start_name TEXT,
            facility_start_disease TEXT,
            facility_end_id TEXT,
            facility_end_name TEXT,
            distance_km REAL,
            path_risk_status TEXT DEFAULT 'DETECTED',
            detected_via TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create indices for smittespredning table
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_smitte_vessel ON smittespredning_events(vessel_mmsi)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_smitte_facility_start ON smittespredning_events(facility_start_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_smitte_facility_end ON smittespredning_events(facility_end_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_smitte_timestamp ON smittespredning_events(timestamp_start)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_smitte_status ON smittespredning_events(path_risk_status)")

    # Vessel position snapshots — own historical record built by the 2-hour scan
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vessel_positions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            vessel_mmsi TEXT NOT NULL,
            vessel_name TEXT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            speed_knots REAL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vpos_mmsi_ts ON vessel_positions(vessel_mmsi, timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vpos_timestamp ON vessel_positions(timestamp)")

    conn.commit()
    conn.close()
    print(f"[DB] Database initialized at {DB_PATH}")


def log_vessel_positions_batch(positions: List[Dict[str, Any]]) -> int:
    """Bulk-insert vessel position snapshots. Returns number of rows saved."""
    if not positions:
        return 0
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    rows = [
        (
            p.get("timestamp") or datetime.utcnow().isoformat(),
            str(p["mmsi"]),
            p.get("name"),
            float(p["latitude"]),
            float(p["longitude"]),
            p.get("speed_knots"),
        )
        for p in positions
        if p.get("mmsi") and p.get("latitude") is not None and p.get("longitude") is not None
    ]
    cursor.executemany(
        "INSERT INTO vessel_positions (timestamp, vessel_mmsi, vessel_name, latitude, longitude, speed_knots) "
        "VALUES (?,?,?,?,?,?)",
        rows,
    )
    # Keep only last 7 days to avoid unbounded growth
    cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()
    cursor.execute("DELETE FROM vessel_positions WHERE timestamp < ?", (cutoff,))
    conn.commit()
    conn.close()
    return len(rows)


def get_recent_positions_for_mmsis(
    mmsi_set: set,
    since_iso: str,
) -> Dict[str, List[Dict[str, Any]]]:
    """Return recent stored positions keyed by mmsi for a set of vessels."""
    if not mmsi_set:
        return {}
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    placeholders = ",".join("?" * len(mmsi_set))
    cursor.execute(
        f"SELECT vessel_mmsi, vessel_name, latitude, longitude, timestamp "
        f"FROM vessel_positions "
        f"WHERE vessel_mmsi IN ({placeholders}) AND timestamp >= ? "
        f"ORDER BY timestamp ASC",
        (*sorted(mmsi_set), since_iso),
    )
    result: Dict[str, List[Dict[str, Any]]] = {}
    for row in cursor.fetchall():
        mmsi = row["vessel_mmsi"]
        result.setdefault(mmsi, []).append({
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "timestamp": row["timestamp"],
            "name": row["vessel_name"],
        })
    conn.close()
    return result


def log_exposure_event(
    vessel_mmsi: str,
    facility_id: str,
    distance_km: float,
    vessel_name: Optional[str] = None,
    facility_name: Optional[str] = None,
    duration_min: Optional[int] = None,
    disease_status: Optional[str] = None,
    quarantine_end_time: Optional[str] = None,
    risk_triggered: bool = False,
    risk_level: Optional[str] = None,
    notes: Optional[str] = None,
    timestamp: Optional[str] = None,
    skip_distance_check: bool = False,
) -> int:
    """
    Log a vessel exposure event to the database.
    Only logs visits where vessel is within 1 km of facility,
    unless skip_distance_check=True (used for BW-sourced backfill data).

    Args:
        timestamp: ISO timestamp of the visit. Defaults to utcnow().
        skip_distance_check: If True, bypass the 1 km distance filter (for BW official visit data).

    Returns:
        event_id: The ID of the created event, or -1 if visit rejected.
    """
    # VALIDATE: Only log visits where vessel is within 1 km of facility
    if not skip_distance_check and distance_km > 1.0:
        return -1

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    timestamp = timestamp or datetime.utcnow().isoformat()
    
    cursor.execute("""
        INSERT INTO vessel_exposure_events (
            timestamp, vessel_mmsi, vessel_name, facility_id, facility_name,
            distance_km, duration_min, disease_status, quarantine_end_time,
            risk_triggered, risk_level, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        timestamp, vessel_mmsi, vessel_name, facility_id, facility_name,
        distance_km, duration_min, disease_status, quarantine_end_time,
        int(risk_triggered), risk_level, notes
    ))
    
    event_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return event_id


def get_facility_timeline(
    facility_id: str,
    limit: int = 100,
    include_planned: bool = True
) -> List[Dict[str, Any]]:
    """
    Get chronological timeline for a facility.
    
    Returns list of events sorted by timestamp DESC:
    - Vessel visits (exposure events)
    - Planned routes
    - Risk changes
    - Quarantine events
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get exposure events
    cursor.execute("""
        SELECT 
            event_id,
            timestamp,
            vessel_mmsi,
            vessel_name,
            distance_km,
            duration_min,
            disease_status,
            quarantine_end_time,
            risk_triggered,
            risk_level,
            notes
        FROM vessel_exposure_events
        WHERE facility_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
    """, (facility_id, limit))
    
    raw_events = []
    for row in cursor.fetchall():
        raw_events.append({
            "event_type": "vessel_visit",
            "event_id": row["event_id"],
            "timestamp": row["timestamp"],
            "vessel_mmsi": row["vessel_mmsi"],
            "vessel_name": row["vessel_name"],
            "distance_km": row["distance_km"],
            "duration_min": row["duration_min"],
            "disease_status": row["disease_status"],
            "quarantine_end_time": row["quarantine_end_time"],
            "risk_triggered": bool(row["risk_triggered"]),
            "risk_level": row["risk_level"],
            "notes": row["notes"]
        })

    def parse_iso(ts: str):
        if not ts:
            return None
        try:
            return datetime.fromisoformat(str(ts).replace('Z', '+00:00'))
        except Exception:
            return None

    # Merge repeated stationary detections for same vessel+facility within 60 minutes
    # to avoid one timeline item every ~25 min for continuous presence.
    merge_window_minutes = 60
    events = []
    chronological = sorted(raw_events, key=lambda item: item.get("timestamp") or "")
    for event in chronological:
        curr_time = parse_iso(event.get("timestamp"))

        if not events:
            event["merged_event_count"] = 1
            event["_merge_group_start_time"] = curr_time
            events.append(event)
            continue

        prev = events[-1]
        same_vessel = str(prev.get("vessel_mmsi") or "") == str(event.get("vessel_mmsi") or "")

        group_start = prev.get("_merge_group_start_time") or parse_iso(prev.get("timestamp"))
        within_window = False
        if group_start and curr_time:
            time_diff_minutes = (curr_time - group_start).total_seconds() / 60
            within_window = 0 <= time_diff_minutes <= merge_window_minutes

        if same_vessel and within_window:
            merged_count = int(prev.get("merged_event_count") or 1) + 1
            prev["merged_event_count"] = merged_count

            prev_duration = int(prev.get("duration_min") or 0)
            curr_duration = int(event.get("duration_min") or 0)
            prev["duration_min"] = prev_duration + curr_duration

            prev_distance = prev.get("distance_km")
            curr_distance = event.get("distance_km")
            if isinstance(prev_distance, (int, float)) and isinstance(curr_distance, (int, float)):
                prev["distance_km"] = round((prev_distance + curr_distance) / 2, 3)
            elif curr_distance is not None:
                prev["distance_km"] = curr_distance

            # Keep latest timestamp and latest event id/notes/status for display freshness
            prev["timestamp"] = event.get("timestamp")
            prev["event_id"] = event.get("event_id")
            prev["notes"] = event.get("notes") or prev.get("notes")
            prev["risk_level"] = event.get("risk_level") or prev.get("risk_level")
            prev["risk_triggered"] = bool(event.get("risk_triggered") or prev.get("risk_triggered"))
            prev["disease_status"] = event.get("disease_status") or prev.get("disease_status")
        else:
            event["merged_event_count"] = 1
            event["_merge_group_start_time"] = curr_time
            events.append(event)

    # Enrich each event with latest infected-facility source within 48 hours for same vessel.
    for event in events:
        vessel_mmsi = event.get("vessel_mmsi")
        event_time = parse_iso(event.get("timestamp"))
        if not vessel_mmsi or not event_time:
            continue

        window_start = (event_time - timedelta(hours=48)).isoformat()
        window_end = event_time.isoformat()

        cursor.execute(
            """
            SELECT facility_id, facility_name, timestamp
            FROM vessel_exposure_events
            WHERE vessel_mmsi = ?
              AND lower(coalesce(disease_status, '')) = 'infected'
              AND timestamp BETWEEN ? AND ?
            ORDER BY timestamp DESC
            LIMIT 1
            """,
            (str(vessel_mmsi), window_start, window_end)
        )
        infected_row = cursor.fetchone()
        if not infected_row:
            event["within_48h_infected_rule"] = False
            continue

        infected_ts = infected_row["timestamp"]
        infected_time = parse_iso(infected_ts)
        hours_ago = None
        if infected_time:
            hours_ago = round((event_time - infected_time).total_seconds() / 3600, 1)

        event["within_48h_infected_rule"] = True
        event["infected_source_facility_id"] = infected_row["facility_id"]
        event["infected_source_facility_name"] = infected_row["facility_name"]
        event["infected_source_timestamp"] = infected_ts
        event["infected_source_hours_ago"] = hours_ago

    for event in events:
        event.pop("_merge_group_start_time", None)

    conn.close()
    
    # Sort by timestamp
    events.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return events


def get_vessel_exposure_history(
    vessel_mmsi: str,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """Get exposure history for a specific vessel."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            event_id,
            timestamp,
            facility_id,
            facility_name,
            distance_km,
            duration_min,
            disease_status,
            risk_triggered,
            risk_level
        FROM vessel_exposure_events
        WHERE vessel_mmsi = ?
        ORDER BY timestamp DESC
        LIMIT ?
    """, (vessel_mmsi, limit))
    
    history = []
    for row in cursor.fetchall():
        history.append({
            "event_id": row["event_id"],
            "timestamp": row["timestamp"],
            "facility_id": row["facility_id"],
            "facility_name": row["facility_name"],
            "distance_km": row["distance_km"],
            "duration_min": row["duration_min"],
            "disease_status": row["disease_status"],
            "risk_triggered": bool(row["risk_triggered"]),
            "risk_level": row["risk_level"]
        })
    
    conn.close()
    return history


def get_vessel_exposure_events(
    start_time: str,
    end_time: str
) -> List[Dict[str, Any]]:
    """Get all vessel exposure events within a time range."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            event_id,
            timestamp,
            vessel_mmsi,
            vessel_name,
            facility_id,
            facility_name,
            distance_km,
            duration_min,
            disease_status,
            risk_triggered,
            risk_level,
            notes
        FROM vessel_exposure_events
        WHERE timestamp BETWEEN ? AND ?
        ORDER BY timestamp DESC
    """, (start_time, end_time))
    
    events = []
    for row in cursor.fetchall():
        events.append({
            "event_id": row["event_id"],
            "timestamp": row["timestamp"],
            "vessel_mmsi": row["vessel_mmsi"],
            "vessel_name": row["vessel_name"],
            "facility_id": row["facility_id"],
            "facility_name": row["facility_name"],
            "distance_meters": int(row["distance_km"] * 1000),  # Convert km to meters
            "duration_minutes": row["duration_min"],
            "disease_status": row["disease_status"],
            "risk_triggered": bool(row["risk_triggered"]),
            "risk_level": row["risk_level"],
            "notes": row["notes"]
        })
    
    conn.close()
    return events


def get_exposure_stats() -> Dict[str, Any]:
    """Get statistics about logged exposure events."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as total FROM vessel_exposure_events")
    total = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) as risk_events FROM vessel_exposure_events WHERE risk_triggered = 1")
    risk_events = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(DISTINCT vessel_mmsi) as unique_vessels FROM vessel_exposure_events")
    unique_vessels = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(DISTINCT facility_id) as unique_facilities FROM vessel_exposure_events")
    unique_facilities = cursor.fetchone()[0]
    
    conn.close()
    
    return {
        "total_events": total,
        "risk_events": risk_events,
        "unique_vessels": unique_vessels,
        "unique_facilities": unique_facilities
    }


# ============================================================================
# SMITTESPREDNING EVENT FUNCTIONS
# ============================================================================

def log_smittespredning_event(
    vessel_mmsi: str,
    facility_start_id: str,
    facility_start_disease: str,
    vessel_name: Optional[str] = None,
    facility_start_name: Optional[str] = None,
    facility_end_id: Optional[str] = None,
    facility_end_name: Optional[str] = None,
    distance_km: Optional[float] = None,
    detected_via: str = "AIS",
    notes: Optional[str] = None,
    timestamp_start: Optional[str] = None
) -> int:
    """
    Log a smittespredning event (infection path: boat from infected facility to other facilities).
    
    Args:
        vessel_mmsi: MMSI of vessel
        facility_start_id: ID of facility with confirmed/suspected disease
        facility_start_disease: Disease type (PD, ILA, etc.)
        vessel_name: Name of vessel (optional)
        facility_start_name: Name of origin facility (optional)
        facility_end_id: ID of receiving facility (optional, can be added later)
        facility_end_name: Name of receiving facility (optional)
        distance_km: Distance traveled (optional)
        detected_via: How detected - 'AIS', 'planned_route', 'manual' (default: AIS)
        notes: Additional notes
        timestamp_start: Start timestamp (default: now)
    
    Returns:
        event_id: The ID of the created event
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    if timestamp_start is None:
        timestamp_start = datetime.utcnow().isoformat()
    
    cursor.execute("""
        INSERT INTO smittespredning_events (
            timestamp_start, vessel_mmsi, vessel_name, 
            facility_start_id, facility_start_name, facility_start_disease,
            facility_end_id, facility_end_name, distance_km,
            path_risk_status, detected_via, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        timestamp_start, vessel_mmsi, vessel_name,
        facility_start_id, facility_start_name, facility_start_disease,
        facility_end_id, facility_end_name, distance_km,
        "DETECTED", detected_via, notes
    ))
    
    event_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return event_id


def upsert_smittespredning_transition_event(
    vessel_mmsi: str,
    facility_start_id: str,
    facility_start_disease: str,
    vessel_name: Optional[str] = None,
    facility_start_name: Optional[str] = None,
    facility_end_id: Optional[str] = None,
    facility_end_name: Optional[str] = None,
    distance_km: Optional[float] = None,
    detected_via: str = "AIS_VISIT_ANALYSIS",
    notes: Optional[str] = None,
    timestamp_start: Optional[str] = None,
    timestamp_end: Optional[str] = None,
    path_risk_status: str = "DETECTED"
) -> int:
    """
    Insert or update a smittespredning transition event with simple deduplication.

    Deduplication key:
    - vessel_mmsi
    - facility_start_id
    - facility_end_id
    - timestamp_start

    If the event already exists, update end timestamp/status/notes instead of inserting again.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    timestamp_start = timestamp_start or datetime.utcnow().isoformat()
    facility_end_lookup = facility_end_id or ""

    cursor.execute(
        """
        SELECT event_id FROM smittespredning_events
        WHERE vessel_mmsi = ?
          AND facility_start_id = ?
          AND COALESCE(facility_end_id, '') = ?
          AND timestamp_start = ?
        ORDER BY event_id DESC
        LIMIT 1
        """,
        (vessel_mmsi, facility_start_id, facility_end_lookup, timestamp_start)
    )
    row = cursor.fetchone()

    if row:
        event_id = row[0]
        updates = [
            "updated_at = ?",
            "path_risk_status = ?",
            "detected_via = ?"
        ]
        params = [datetime.utcnow().isoformat(), path_risk_status, detected_via]

        if timestamp_end is not None:
            updates.append("timestamp_end = ?")
            params.append(timestamp_end)
        if facility_end_id is not None:
            updates.append("facility_end_id = ?")
            params.append(facility_end_id)
        if facility_end_name is not None:
            updates.append("facility_end_name = ?")
            params.append(facility_end_name)
        if distance_km is not None:
            updates.append("distance_km = ?")
            params.append(distance_km)
        if notes is not None:
            updates.append("notes = ?")
            params.append(notes)

        params.append(event_id)
        cursor.execute(
            f"UPDATE smittespredning_events SET {', '.join(updates)} WHERE event_id = ?",
            params
        )
        conn.commit()
        conn.close()
        return event_id

    cursor.execute(
        """
        INSERT INTO smittespredning_events (
            timestamp_start, timestamp_end, vessel_mmsi, vessel_name,
            facility_start_id, facility_start_name, facility_start_disease,
            facility_end_id, facility_end_name, distance_km,
            path_risk_status, detected_via, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            timestamp_start, timestamp_end, vessel_mmsi, vessel_name,
            facility_start_id, facility_start_name, facility_start_disease,
            facility_end_id, facility_end_name, distance_km,
            path_risk_status, detected_via, notes
        )
    )

    event_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return event_id


def update_smittespredning_event(
    event_id: int,
    timestamp_end: Optional[str] = None,
    facility_end_id: Optional[str] = None,
    facility_end_name: Optional[str] = None,
    distance_km: Optional[float] = None,
    path_risk_status: Optional[str] = None,
    notes: Optional[str] = None
) -> bool:
    """
    Update a smittespredning event with more information (e.g., when it arrives at destination).
    
    Args:
        event_id: ID of event to update
        timestamp_end: Arrival timestamp at second facility
        facility_end_id: ID of receiving facility
        facility_end_name: Name of receiving facility
        distance_km: Distance traveled
        path_risk_status: Risk status (DETECTED, CONFIRMED_HEALTHY, CONFIRMED_INFECTED, UNCERTAIN)
        notes: Additional notes
    
    Returns:
        True if updated successfully
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Build dynamic update query
    updates = ["updated_at = ?"]
    params = [datetime.utcnow().isoformat()]
    
    if timestamp_end is not None:
        updates.append("timestamp_end = ?")
        params.append(timestamp_end)
    if facility_end_id is not None:
        updates.append("facility_end_id = ?")
        params.append(facility_end_id)
    if facility_end_name is not None:
        updates.append("facility_end_name = ?")
        params.append(facility_end_name)
    if distance_km is not None:
        updates.append("distance_km = ?")
        params.append(distance_km)
    if path_risk_status is not None:
        updates.append("path_risk_status = ?")
        params.append(path_risk_status)
    if notes is not None:
        updates.append("notes = ?")
        params.append(notes)
    
    params.append(event_id)
    
    query = f"UPDATE smittespredning_events SET {', '.join(updates)} WHERE event_id = ?"
    cursor.execute(query, params)
    
    conn.commit()
    conn.close()
    
    return cursor.rowcount > 0


def get_smittespredning_events(
    limit: int = 100,
    status_filter: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Get all smittespredning events, optionally filtered by status.
    
    Args:
        limit: Maximum number of events to return
        status_filter: Filter by path_risk_status (e.g., 'DETECTED', 'CONFIRMED_INFECTED')
    
    Returns:
        List of smittespredning events sorted by timestamp_start DESC
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if status_filter:
        query = """
            SELECT * FROM smittespredning_events
            WHERE path_risk_status = ?
            ORDER BY timestamp_start DESC
            LIMIT ?
        """
        cursor.execute(query, (status_filter, limit))
    else:
        query = """
            SELECT * FROM smittespredning_events
            ORDER BY timestamp_start DESC
            LIMIT ?
        """
        cursor.execute(query, (limit,))
    
    events = []
    for row in cursor.fetchall():
        events.append({
            "event_id": row["event_id"],
            "timestamp_start": row["timestamp_start"],
            "timestamp_end": row["timestamp_end"],
            "vessel_mmsi": row["vessel_mmsi"],
            "vessel_name": row["vessel_name"],
            "facility_start_id": row["facility_start_id"],
            "facility_start_name": row["facility_start_name"],
            "facility_start_disease": row["facility_start_disease"],
            "facility_end_id": row["facility_end_id"],
            "facility_end_name": row["facility_end_name"],
            "distance_km": row["distance_km"],
            "path_risk_status": row["path_risk_status"],
            "detected_via": row["detected_via"],
            "notes": row["notes"],
            "created_at": row["created_at"]
        })
    
    conn.close()
    return events


def get_smittespredning_by_facility(
    facility_id: str,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Get all smittespredning events involving a specific facility (as source or destination).
    
    Args:
        facility_id: Facility code/ID
        limit: Maximum number of events
    
    Returns:
        List of events where facility is start or end point
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM smittespredning_events
        WHERE facility_start_id = ? OR facility_end_id = ?
        ORDER BY timestamp_start DESC
        LIMIT ?
    """, (facility_id, facility_id, limit))
    
    events = []
    for row in cursor.fetchall():
        events.append({
            "event_id": row["event_id"],
            "timestamp_start": row["timestamp_start"],
            "timestamp_end": row["timestamp_end"],
            "vessel_mmsi": row["vessel_mmsi"],
            "vessel_name": row["vessel_name"],
            "facility_start_id": row["facility_start_id"],
            "facility_start_name": row["facility_start_name"],
            "facility_start_disease": row["facility_start_disease"],
            "facility_end_id": row["facility_end_id"],
            "facility_end_name": row["facility_end_name"],
            "distance_km": row["distance_km"],
            "path_risk_status": row["path_risk_status"],
            "detected_via": row["detected_via"],
            "notes": row["notes"],
            "created_at": row["created_at"],
            "is_origin": facility_id == row["facility_start_id"]
        })
    
    conn.close()
    return events


def get_smittespredning_by_vessel(
    vessel_mmsi: str,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Get all smittespredning events for a specific vessel.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM smittespredning_events
        WHERE vessel_mmsi = ?
        ORDER BY timestamp_start DESC
        LIMIT ?
    """, (vessel_mmsi, limit))
    
    events = []
    for row in cursor.fetchall():
        events.append({
            "event_id": row["event_id"],
            "timestamp_start": row["timestamp_start"],
            "timestamp_end": row["timestamp_end"],
            "vessel_mmsi": row["vessel_mmsi"],
            "vessel_name": row["vessel_name"],
            "facility_start_id": row["facility_start_id"],
            "facility_start_name": row["facility_start_name"],
            "facility_start_disease": row["facility_start_disease"],
            "facility_end_id": row["facility_end_id"],
            "facility_end_name": row["facility_end_name"],
            "distance_km": row["distance_km"],
            "path_risk_status": row["path_risk_status"],
            "detected_via": row["detected_via"],
            "notes": row["notes"],
            "created_at": row["created_at"]
        })
    
    conn.close()
    return events


# Initialize database on module import
if not DB_PATH.exists():
    init_database()
