# Admin Agent - KystMonitor Phase 2

## Overview

The **Admin Agent** is the second specialized agent in the KystMonitor 4-agent architecture. It provides persistent data storage, logging, alerting, and data quality monitoring.

## Architecture

```
┌─────────────────────────────────────────────┐
│       KYSTMONITOR 4-AGENT ARCHITECTURE      │
├─────────────────────────────────────────────┤
│  1️⃣ API Agent (Complete)                    │
│     ├─ Ocean current data (Copernicus)      │
│     ├─ Vessel tracking (Historic AIS)       │
│     └─ Disease exposure analysis            │
├─────────────────────────────────────────────┤
│  2️⃣ ADMIN AGENT (Complete)                  │
│     ├─ Database persistence                 │
│     ├─ Historical tracking                  │
│     ├─ Alert management                     │
│     └─ System logging                       │
├─────────────────────────────────────────────┤
│  3️⃣ Frontend Agent (Next)                   │
│     ├─ Dashboard visualization              │
│     └─ User interface                       │
├─────────────────────────────────────────────┤
│  4️⃣ ML Agent (Future)                       │
│     ├─ Predictive analytics                 │
│     └─ Pattern recognition                  │
└─────────────────────────────────────────────┘
```

## Database Schema

### 10 Tables for Complete Data Persistence

#### 1. **facilities** - Aquaculture farm registry
```sql
facility_id (PK)
locality_id
facility_name
latitude, longitude
production_status
municipality
created_at
```

#### 2. **risk_assessments** - Time-series risk tracking
```sql
assessment_id (PK)
facility_id (FK)
risk_score
risk_level
factors (JSON)
assessment_date
created_at
```
Index: `(facility_id, assessment_date)`

#### 3. **disease_data** - Disease occurrence tracking
```sql
disease_id (PK)
facility_id (FK)
disease_type (ILA/PD)
detected_date
lice_count
adult_female_lice
mobile_lice
disease_status
created_at
```
Index: `(facility_id, disease_type)`

#### 4. **vessel_positions** - AIS vessel locations
```sql
position_id (PK)
mmsi
vessel_name
latitude, longitude
heading, speed_knots
position_time
created_at
```
Indexes: `(mmsi, position_time)`, `(latitude, longitude)`

#### 5. **vessel_facility_exposure** - Vessel-farm interactions
```sql
exposure_id (PK)
facility_id (FK)
mmsi
vessel_name
visit_date
distance_km
exposure_risk_score
exposure_type
created_at
```
Index: `(facility_id, mmsi)`

#### 6. **ocean_currents** - Oceanographic measurements
```sql
current_id (PK)
latitude, longitude
magnitude
u_velocity, v_velocity
measurement_date
data_source
created_at
```
Index: `(latitude, longitude, measurement_date)`

#### 7. **alerts** - System alerts and notifications
```sql
alert_id (PK)
facility_id (FK)
alert_type (DISEASE/EXPOSURE/QUALITY)
alert_severity (LOW/MEDIUM/HIGH/CRITICAL)
alert_message
alert_date
resolved
resolved_date
created_at
```
Index: `(facility_id, alert_severity)`

#### 8. **system_logs** - Application logging
```sql
log_id (PK)
log_level (INFO/WARNING/ERROR/CRITICAL)
log_category
log_message
facility_id
mmsi
error_details
created_at
```
Indexes: `(log_level, created_at)`, `(facility_id)`

#### 9. **data_quality** - API health monitoring
```sql
quality_id (PK)
data_source (BarentsWatch/Copernicus/HistoricAIS)
check_date
api_available
last_successful_fetch
error_count
average_response_time_ms
created_at
```
Index: `(data_source, check_date)`

#### 10. **backup_log** - Backup operation tracking
```sql
backup_id (PK)
backup_type
backup_date
backup_file_path
backup_size_bytes
status
created_at
```
Index: `(backup_date)`

## Core Components

### 1. DatabaseManager (`src/db/database_manager.py`)

Central database management class handling all SQLite operations.

**Key Methods:**
- `initialize_schema()` - Create/initialize all 10 tables
- `add_facility()` - Register aquaculture facilities
- `add_risk_assessment()` - Store risk scores
- `add_disease_data()` - Track disease occurrences
- `add_vessel_position()` - Store AIS tracking data
- `add_alert()` - Create system alerts
- `log_system_event()` - Centralized logging
- `backup_database()` - Create database backups
- `get_database_stats()` - Retrieve statistics

### 2. Persistence Layer (`src/db/persistence_layer.py`)

Specialized storage classes for different data types.

#### **RiskAssessmentStorage**
```python
risk_storage = RiskAssessmentStorage(db_manager)

# Save risk assessment
risk_storage.save_assessment(
    facility_id=1,
    risk_score=72.5,
    risk_level="HIGH",
    factors={...},
    assessment_date="2026-01-20T10:00:00"
)

# Get latest assessment
assessment = risk_storage.get_latest_assessment(facility_id=1)

# Get trend data
trend = risk_storage.get_trend(facility_id=1, days=30)
```

#### **DiseaseDataStorage**
```python
disease_storage = DiseaseDataStorage(db_manager)

# Save lice monitoring data
disease_storage.save_lice_data(
    facility_id=1,
    adult_female_lice=15.2,
    mobile_lice=8.5
)

# Record disease outbreak
disease_storage.save_outbreak(
    facility_id=1,
    disease_type="ILA",
    detected_date="2026-01-20T10:00:00"
)
```

#### **VesselTrackingStorage**
```python
vessel_storage = VesselTrackingStorage(db_manager)

# Store AIS position
vessel_storage.save_position(
    mmsi=258007500,
    vessel_name="COASTAL CHALLENGER",
    latitude=69.2,
    longitude=17.5,
    heading=180,
    speed_knots=12.5
)

# Record vessel-facility exposure
vessel_storage.save_exposure(
    facility_id=1,
    mmsi=258007500,
    distance_km=2.5,
    risk_score=45.0
)
```

#### **OceanDataStorage**
```python
ocean_storage = OceanDataStorage(db_manager)

# Save ocean current data
ocean_storage.save_current_data(
    latitude=69.2,
    longitude=17.5,
    magnitude=0.15,
    u_velocity=0.12,
    v_velocity=0.08
)
```

#### **AlertingSystem**
```python
alert_system = AlertingSystem(db_manager)

# Create alert
alert_system.create_alert(
    facility_id=1,
    alert_type="DISEASE",
    alert_severity="HIGH",
    alert_message="ILA detected at facility"
)

# Get active alerts
active_alerts = alert_system.get_active_alerts()

# Resolve alert
alert_system.resolve_alert(alert_id=1)
```

#### **SystemLogging**
```python
sys_logger = SystemLogging(db_manager)

sys_logger.info("Risk assessment completed", facility_id=1)
sys_logger.warning("API response delayed", category="API_HEALTH")
sys_logger.error("Database connection failed", error_details="...")
sys_logger.critical("System failure detected", category="CRITICAL")
```

#### **DataQualityMonitor**
```python
data_quality = DataQualityMonitor(db_manager)

# Record API check
data_quality.record_api_check(
    data_source="BarentsWatch",
    api_available=True,
    response_time_ms=245.5,
    error_count=0
)

# Get health status
health = data_quality.get_health_summary()
```

## Integration with API Agent

The Admin Agent is automatically integrated with the API Agent. When `/api/risk/assess` is called:

1. **Risk Assessment** is calculated by RiskEngine
2. **Data is persisted**:
   - Facility information saved to `facilities` table
   - Risk score saved to `risk_assessments` table
   - Disease data saved to `disease_data` table
   - Alerts created if diseases detected
   - Operations logged to `system_logs` table

3. **Example Flow**:
```python
@app.get("/api/risk/assess")
async def assess_risk():
    # Fetch data
    facilities = client.get_lice_data_v2()
    assessments = engine.assess_all()
    
    # Save to database for each assessment
    for assessment in assessments:
        facility_id = db_manager.add_facility(...)
        risk_storage.save_assessment(facility_id, assessment.risk_score, ...)
        disease_storage.save_lice_data(facility_id, ...)
        if assessment.has_ila:
            alert_system.create_alert(..., "ILA detected")
    
    return {"assessments": assessments}
```

## Usage Examples

### Initialize Admin Agent
```python
from src.db.database_manager import DatabaseManager
from src.db.persistence_layer import RiskAssessmentStorage, AlertingSystem

db_manager = DatabaseManager()
risk_storage = RiskAssessmentStorage(db_manager)
alert_system = AlertingSystem(db_manager)
```

### Save Risk Assessment
```python
facility_id = db_manager.add_facility(
    locality_id=12345,
    facility_name="Salmon Farm A",
    latitude=69.2,
    longitude=17.5
)

risk_storage.save_assessment(
    facility_id=facility_id,
    risk_score=72.5,
    risk_level="HIGH",
    factors={
        "disease_proximity": 85.0,
        "disease_prevalence": 60.0,
        "farm_density": 55.0,
        "water_exchange": 40.0,
        "lice_level": 50.0
    }
)
```

### Create Alerts
```python
alert_system.create_alert(
    facility_id=facility_id,
    alert_type="DISEASE",
    alert_severity="HIGH",
    alert_message="ILA detected in risk assessment"
)

# View active alerts
alerts = alert_system.get_active_alerts()
for alert in alerts:
    print(f"[{alert['alert_severity']}] {alert['alert_message']}")
```

### Backup Database
```python
backup_path = db_manager.backup_database()
print(f"Database backed up to: {backup_path}")

# Get backup statistics
stats = db_manager.get_database_stats()
print(f"Database size: {stats['database_size_mb']} MB")
```

## Testing

Comprehensive test suite included in `test_admin_agent.py`:

```bash
python test_admin_agent.py
```

Test coverage:
- ✅ Database initialization
- ✅ Facility management
- ✅ Risk assessment storage
- ✅ Disease data tracking
- ✅ Vessel exposure tracking
- ✅ Alert management
- ✅ System logging
- ✅ Data quality monitoring
- ✅ Backup functionality
- ✅ Database statistics

## File Locations

```
src/db/
├── __init__.py              # Module exports
├── database_manager.py      # Core database class
└── persistence_layer.py     # Specialized storage classes

docs/
└── ADMIN_AGENT.md          # This documentation

test_admin_agent.py         # Test suite (450+ lines)
```

## Performance Characteristics

- **Database Type**: SQLite (file-based, portable)
- **Connection Pool**: Per-operation connections for safety
- **Indexes**: 11 optimized indexes for query performance
- **Batch Operations**: Supported for bulk inserts
- **Backup Speed**: ~0.1-1 MB/second depending on data volume

## Future Enhancements

1. **Database Synchronization**
   - Sync with cloud storage
   - Distributed database replication

2. **Advanced Analytics**
   - Trend analysis
   - Anomaly detection
   - Time-series forecasting

3. **Performance Optimization**
   - Query caching
   - Connection pooling
   - Sharding for large datasets

4. **Integration**
   - Frontend Agent dashboard queries
   - ML Agent data pipelines
   - Export APIs

## Next Steps

→ **Frontend Agent** (Phase 3)
- Dashboard visualization
- Real-time alerts display
- Risk trend charts
- Data export functionality

