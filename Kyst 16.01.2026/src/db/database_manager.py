"""
KystMonitor Database Schema & Initialization
SQLite database for persistent storage of risk assessments and vessel data
"""

import sqlite3
import os
from pathlib import Path
from datetime import datetime
import json

class DatabaseManager:
    """Manages KystMonitor SQLite database."""
    
    def __init__(self, db_path: str = "kyst_monitor.db"):
        """Initialize database manager.
        
        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path
        self.ensure_database_exists()
    
    def get_connection(self):
        """Get database connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Return rows as dictionaries
        return conn
    
    def ensure_database_exists(self):
        """Create database and all tables if they don't exist."""
        if not os.path.exists(self.db_path):
            print(f"Creating database: {self.db_path}")
            self.initialize_schema()
        else:
            # Check if tables exist, create if missing
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            conn.close()
            
            if not tables:
                print("Database exists but empty - initializing schema...")
                self.initialize_schema()
    
    def initialize_schema(self):
        """Create all database tables."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # 1. FACILITIES - Core facility data
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS facilities (
                facility_id INTEGER PRIMARY KEY AUTOINCREMENT,
                locality_id INTEGER UNIQUE NOT NULL,
                facility_name TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                production_status TEXT,
                municipality TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 2. RISK_ASSESSMENTS - Time-series risk scores
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS risk_assessments (
                assessment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                facility_id INTEGER NOT NULL,
                assessment_date TIMESTAMP NOT NULL,
                risk_score REAL NOT NULL,
                risk_level TEXT NOT NULL,
                disease_proximity_score REAL,
                disease_prevalence_score REAL,
                water_exchange_score REAL,
                farm_density_score REAL,
                lice_level_score REAL,
                biggest_risk_factor TEXT,
                data_quality TEXT DEFAULT 'complete',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (facility_id) REFERENCES facilities(facility_id)
            )
        """)
        
        # 3. DISEASE_DATA - Disease occurrences and tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS disease_data (
                disease_id INTEGER PRIMARY KEY AUTOINCREMENT,
                facility_id INTEGER NOT NULL,
                disease_type TEXT NOT NULL,
                detected_date TIMESTAMP NOT NULL,
                lice_count REAL,
                adult_female_lice REAL,
                mobile_lice REAL,
                disease_status TEXT,
                notes TEXT,
                data_source TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (facility_id) REFERENCES facilities(facility_id)
            )
        """)
        
        # 4. VESSEL_POSITIONS - AIS vessel tracking data
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vessel_positions (
                position_id INTEGER PRIMARY KEY AUTOINCREMENT,
                mmsi INTEGER NOT NULL,
                vessel_name TEXT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                heading REAL,
                speed_knots REAL,
                position_time TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 5. VESSEL_FACILITY_EXPOSURE - Link between vessels and facility visits
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vessel_facility_exposure (
                exposure_id INTEGER PRIMARY KEY AUTOINCREMENT,
                facility_id INTEGER NOT NULL,
                mmsi INTEGER NOT NULL,
                vessel_name TEXT,
                visit_date TIMESTAMP NOT NULL,
                distance_km REAL,
                exposure_risk_score REAL,
                exposure_type TEXT,
                data_source TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (facility_id) REFERENCES facilities(facility_id)
            )
        """)
        
        # 6. OCEAN_CURRENTS - Historical ocean data
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ocean_currents (
                current_id INTEGER PRIMARY KEY AUTOINCREMENT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                magnitude REAL NOT NULL,
                u_velocity REAL,
                v_velocity REAL,
                measurement_date TIMESTAMP NOT NULL,
                data_source TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 7. ALERTS - System alerts and notifications
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
                facility_id INTEGER NOT NULL,
                alert_type TEXT NOT NULL,
                alert_severity TEXT NOT NULL,
                alert_message TEXT,
                alert_date TIMESTAMP NOT NULL,
                resolved INTEGER DEFAULT 0,
                resolved_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (facility_id) REFERENCES facilities(facility_id)
            )
        """)
        
        # 8. SYSTEM_LOGS - Application logging
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_logs (
                log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                log_level TEXT NOT NULL,
                log_category TEXT,
                log_message TEXT,
                facility_id INTEGER,
                mmsi INTEGER,
                error_details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 9. DATA_QUALITY - Track data freshness and source reliability
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS data_quality (
                quality_id INTEGER PRIMARY KEY AUTOINCREMENT,
                data_source TEXT NOT NULL,
                check_date TIMESTAMP NOT NULL,
                api_available INTEGER,
                last_successful_fetch TIMESTAMP,
                error_count INTEGER DEFAULT 0,
                average_response_time_ms REAL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 10. BACKUP_LOG - Track backup operations
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS backup_log (
                backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
                backup_type TEXT NOT NULL,
                backup_date TIMESTAMP NOT NULL,
                backup_file_path TEXT,
                backup_size_bytes INTEGER,
                status TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create indexes (SQLite requires these after table creation)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_facility_date ON risk_assessments(facility_id, assessment_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_facility_disease ON disease_data(facility_id, disease_type)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_mmsi_time ON vessel_positions(mmsi, position_time)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_location ON vessel_positions(latitude, longitude)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_facility_vessel ON vessel_facility_exposure(facility_id, mmsi)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_location_date ON ocean_currents(latitude, longitude, measurement_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_facility_severity ON alerts(facility_id, alert_severity)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_level_date ON system_logs(log_level, created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_facility ON system_logs(facility_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_source_date ON data_quality(data_source, check_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_backup_date ON backup_log(backup_date)")
        
        conn.commit()
        conn.close()
        print("✅ Database schema initialized successfully")
    
    def add_facility(self, locality_id: int, facility_name: str, 
                    latitude: float, longitude: float, 
                    production_status: str = None, 
                    municipality: str = None) -> int:
        """Add a facility to the database.
        
        Returns: facility_id
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO facilities 
                (locality_id, facility_name, latitude, longitude, production_status, municipality)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (locality_id, facility_name, latitude, longitude, production_status, municipality))
            
            conn.commit()
            facility_id = cursor.lastrowid
            return facility_id
        except sqlite3.IntegrityError:
            # Facility already exists
            cursor.execute("SELECT facility_id FROM facilities WHERE locality_id = ?", (locality_id,))
            return cursor.fetchone()[0]
        finally:
            conn.close()
    
    def add_risk_assessment(self, facility_id: int, risk_score: float, 
                           risk_level: str, factors: dict = None) -> int:
        """Store a risk assessment for a facility.
        
        Args:
            facility_id: Facility ID
            risk_score: Overall risk score (0-100)
            risk_level: Risk level (LOW, MODERATE, HIGH)
            factors: Dict with individual factor scores
            
        Returns: assessment_id
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        factors = factors or {}
        
        cursor.execute("""
            INSERT INTO risk_assessments
            (facility_id, assessment_date, risk_score, risk_level, 
             disease_proximity_score, disease_prevalence_score, water_exchange_score,
             farm_density_score, lice_level_score, biggest_risk_factor)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            facility_id,
            datetime.now().isoformat(),
            risk_score,
            risk_level,
            factors.get('disease_proximity'),
            factors.get('disease_prevalence'),
            factors.get('water_exchange'),
            factors.get('farm_density'),
            factors.get('lice_level'),
            factors.get('biggest_risk_factor')
        ))
        
        conn.commit()
        assessment_id = cursor.lastrowid
        conn.close()
        
        return assessment_id
    
    def add_disease_data(self, facility_id: int, disease_type: str,
                        adult_female_lice: float = None,
                        mobile_lice: float = None) -> int:
        """Store disease data for a facility.
        
        Returns: disease_id
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO disease_data
            (facility_id, disease_type, detected_date, adult_female_lice, 
             mobile_lice, disease_status, data_source)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            facility_id,
            disease_type,
            datetime.now().isoformat(),
            adult_female_lice,
            mobile_lice,
            'detected',
            'BarentsWatch'
        ))
        
        conn.commit()
        disease_id = cursor.lastrowid
        conn.close()
        
        return disease_id
    
    def add_vessel_position(self, mmsi: int, latitude: float, longitude: float,
                           heading: float = None, speed_knots: float = None,
                           vessel_name: str = None) -> int:
        """Store a vessel AIS position.
        
        Returns: position_id
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO vessel_positions
            (mmsi, vessel_name, latitude, longitude, heading, speed_knots, position_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            mmsi,
            vessel_name,
            latitude,
            longitude,
            heading,
            speed_knots,
            datetime.now().isoformat()
        ))
        
        conn.commit()
        position_id = cursor.lastrowid
        conn.close()
        
        return position_id
    
    def add_alert(self, facility_id: int, alert_type: str, 
                 alert_severity: str, alert_message: str) -> int:
        """Create a system alert.
        
        Args:
            facility_id: Facility ID
            alert_type: Type of alert (DISEASE, EXPOSURE, QUALITY)
            alert_severity: Severity level (LOW, MEDIUM, HIGH, CRITICAL)
            alert_message: Alert message text
            
        Returns: alert_id
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO alerts
            (facility_id, alert_type, alert_severity, alert_message, alert_date)
            VALUES (?, ?, ?, ?, ?)
        """, (facility_id, alert_type, alert_severity, alert_message, 
              datetime.now().isoformat()))
        
        conn.commit()
        alert_id = cursor.lastrowid
        conn.close()
        
        return alert_id
    
    def log_system_event(self, log_level: str, log_category: str, 
                        log_message: str, facility_id: int = None,
                        error_details: str = None):
        """Log a system event.
        
        Args:
            log_level: INFO, WARNING, ERROR, CRITICAL
            log_category: Category (API, DATABASE, AIS, etc.)
            log_message: Log message
            facility_id: Optional facility ID
            error_details: Optional error details
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO system_logs
            (log_level, log_category, log_message, facility_id, error_details)
            VALUES (?, ?, ?, ?, ?)
        """, (log_level, log_category, log_message, facility_id, error_details))
        
        conn.commit()
        conn.close()
    
    def get_facility_risk_history(self, facility_id: int, days: int = 30):
        """Get risk assessment history for a facility.
        
        Returns: List of risk assessments in chronological order
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM risk_assessments
            WHERE facility_id = ? 
            AND assessment_date >= datetime('now', '-' || ? || ' days')
            ORDER BY assessment_date DESC
        """, (facility_id, days))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def get_recent_alerts(self, facility_id: int = None, 
                         alert_severity: str = None) -> list:
        """Get recent unresolved alerts.
        
        Returns: List of alerts
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        query = "SELECT * FROM alerts WHERE resolved = 0"
        params = []
        
        if facility_id:
            query += " AND facility_id = ?"
            params.append(facility_id)
        
        if alert_severity:
            query += " AND alert_severity = ?"
            params.append(alert_severity)
        
        query += " ORDER BY alert_date DESC LIMIT 100"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def backup_database(self, backup_dir: str = "backups") -> str:
        """Create a backup of the database.
        
        Returns: Path to backup file
        """
        os.makedirs(backup_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = f"{backup_dir}/kyst_monitor_backup_{timestamp}.db"
        
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Get backup size
            cursor.execute("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()")
            db_size = cursor.fetchone()[0]
            
            conn.close()
            
            # Create backup
            import shutil
            shutil.copy2(self.db_path, backup_file)
            
            # Log backup
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO backup_log
                (backup_type, backup_date, backup_file_path, backup_size_bytes, status)
                VALUES (?, ?, ?, ?, ?)
            """, ('manual', datetime.now().isoformat(), backup_file, db_size, 'success'))
            conn.commit()
            conn.close()
            
            print(f"✅ Backup created: {backup_file}")
            return backup_file
            
        except Exception as e:
            print(f"❌ Backup failed: {e}")
            return None
    
    def get_database_stats(self) -> dict:
        """Get database statistics.
        
        Returns: Dict with various statistics
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        stats = {}
        
        # Count records in each table
        for table in ['facilities', 'risk_assessments', 'disease_data', 
                     'vessel_positions', 'alerts', 'system_logs']:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            stats[table] = cursor.fetchone()[0]
        
        # Database file size
        db_size = os.path.getsize(self.db_path)
        stats['database_size_bytes'] = db_size
        stats['database_size_mb'] = db_size / (1024 * 1024)
        
        conn.close()
        
        return stats
    
    def get_disease_history(self, facility_id: int, days: int = 60):
        """Get disease/lice history for a facility.
        
        Returns: List of disease records
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM disease_data
            WHERE facility_id = ? 
            AND detected_date >= datetime('now', '-' || ? || ' days')
            ORDER BY detected_date DESC
        """, (facility_id, days))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def get_vessel_facility_exposures(self, facility_id: int, days: int = 30):
        """Get vessel exposures for a facility in recent days.
        
        Returns: List of exposure records
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM vessel_facility_exposure
            WHERE facility_id = ? 
            AND visit_date >= datetime('now', '-' || ? || ' days')
            ORDER BY visit_date DESC
        """, (facility_id, days))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
