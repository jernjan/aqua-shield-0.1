"""
Data quality assessment and confidence scoring for risk assessments.

Confidence score indicates how much we trust a risk assessment:
- 90-100: Official sources (BarentsWatch zones, Mattilsynet)
- 70-89: Complete data (AIS coverage + recent reports)
- 50-69: Partial data (some AIS gaps or older reports)
- < 50: Low data quality (incomplete AIS, no recent reports)
"""

from datetime import datetime, timedelta
import math

def calculate_confidence_score(
    source: str,
    data_freshness_hours: float,
    ais_coverage_pct: float = 100.0,
    has_recent_lice_report: bool = False,
    lice_report_age_hours: float = None,
    facility_data: dict = None,
) -> dict:
    """
    Calculate confidence score (0-100) for a risk assessment.
    
    Args:
        source: One of 'barentswatch_official', 'barentswatch_lice', 'database', 'calculated'
        data_freshness_hours: How fresh the assessment data is
        ais_coverage_pct: Percentage of expected AIS data available (0-100)
        has_recent_lice_report: Whether facility has recent lice report
        lice_report_age_hours: Age of most recent lice report in hours
        facility_data: Additional facility context dict
    
    Returns:
        dict with keys: score, factors, interpretation
    """
    
    factors = {}
    
    # 1. SOURCE CREDIBILITY (40 points max)
    source_score = 0.0
    if source == 'barentswatch_official':
        source_score = 40.0
        factors['source'] = {'value': 40, 'reason': 'Official BarentsWatch quarantine zones (Mattilsynet)'}
    elif source == 'barentswatch_lice':
        source_score = 35.0
        factors['source'] = {'value': 35, 'reason': 'BarentsWatch official lice data'}
    elif source == 'database':
        source_score = 20.0
        factors['source'] = {'value': 20, 'reason': 'Historical database record'}
    else:  # calculated
        source_score = 25.0
        factors['source'] = {'value': 25, 'reason': 'Calculated from exposure data'}
    
    # 2. DATA FRESHNESS (30 points max)
    # Fresh data (< 1 hour): 30 pts
    # Recent (1-6 hours): 25 pts
    # Yesterday (6-24 hours): 20 pts
    # This week (1-7 days): 10 pts
    # Older: 5 pts
    freshness_score = 0.0
    if data_freshness_hours < 1:
        freshness_score = 30.0
        freshness_desc = "< 1 hour ago"
    elif data_freshness_hours < 6:
        freshness_score = 25.0
        freshness_desc = f"{int(data_freshness_hours)} hours ago"
    elif data_freshness_hours < 24:
        freshness_score = 20.0
        freshness_desc = "< 1 day ago"
    elif data_freshness_hours < 7 * 24:
        freshness_score = 10.0
        freshness_desc = f"{int(data_freshness_hours / 24)} days ago"
    else:
        freshness_score = 5.0
        freshness_desc = f">{int(data_freshness_hours / 24)} days ago"
    
    factors['freshness'] = {
        'value': freshness_score,
        'reason': f'Assessment {freshness_desc}'
    }
    
    # 3. AIS COVERAGE (20 points max)
    # 100%: 20 pts, 75%: 15 pts, 50%: 10 pts, < 50%: 5 pts
    ais_score = 0.0
    if ais_coverage_pct >= 95:
        ais_score = 20.0
        ais_desc = "Complete AIS coverage"
    elif ais_coverage_pct >= 75:
        ais_score = 15.0
        ais_desc = f"Good AIS coverage ({int(ais_coverage_pct)}%)"
    elif ais_coverage_pct >= 50:
        ais_score = 10.0
        ais_desc = f"Limited AIS coverage ({int(ais_coverage_pct)}%)"
    else:
        ais_score = 5.0
        ais_desc = f"Poor AIS coverage ({int(ais_coverage_pct)}%)"
    
    factors['ais_coverage'] = {
        'value': ais_score,
        'reason': ais_desc
    }
    
    # 4. LICE REPORT STATUS (10 points max)
    # Recent report (< 2 weeks): 10 pts
    # Older report: 5 pts
    # No report: 0 pts
    lice_score = 0.0
    if has_recent_lice_report:
        if lice_report_age_hours and lice_report_age_hours < 14 * 24:
            lice_score = 10.0
            factors['lice_status'] = {
                'value': 10,
                'reason': f'Recent lice report ({int(lice_report_age_hours / 24)} days old)'
            }
        else:
            lice_score = 5.0
            factors['lice_status'] = {
                'value': 5,
                'reason': f'Older lice report ({int((lice_report_age_hours or 9999) / 24)} days old)'
            }
    else:
        factors['lice_status'] = {
            'value': 0,
            'reason': 'No recent lice report'
        }
    
    total_score = source_score + freshness_score + ais_score + lice_score
    
    # Cap at 100
    total_score = min(100.0, max(0.0, total_score))
    
    # Interpretation
    if total_score >= 90:
        interpretation = "Very High - Trust this assessment"
        level = "Very High"
    elif total_score >= 75:
        interpretation = "High - Generally reliable"
        level = "High"
    elif total_score >= 60:
        interpretation = "Medium - Use with caution"
        level = "Medium"
    elif total_score >= 45:
        interpretation = "Low - Consider additional sources"
        level = "Low"
    else:
        interpretation = "Very Low - Highly uncertain"
        level = "Very Low"
    
    return {
        'confidence_score': round(total_score, 1),
        'confidence_level': level,
        'interpretation': interpretation,
        'factors': factors,
        'max_possible': 100
    }


def detect_data_quality_issues(facility: dict, assessment_time: datetime = None) -> list:
    """
    Detect data quality issues in facility assessment.
    
    Returns list of quality issues found, e.g.:
    - "No AIS position in 48 hours"
    - "Lice report is > 30 days old"
    - "Missing FDIR metadata"
    - "Conflicting disease reports"
    """
    
    if assessment_time is None:
        assessment_time = datetime.now()
    
    issues = []
    
    # Check position freshness
    if 'last_ais_position_time' in facility:
        try:
            last_pos_time = datetime.fromisoformat(facility['last_ais_position_time'])
            hours_since = (assessment_time - last_pos_time).total_seconds() / 3600
            if hours_since > 48:
                issues.append(f"No AIS data in {int(hours_since / 24)} days")
        except Exception:
            pass
    
    # Check lice report age
    if 'lice' in facility and facility['lice']:
        lice = facility['lice']
        if 'last_report_time' in lice:
            try:
                last_report_time = datetime.fromisoformat(lice['last_report_time'])
                days_old = (assessment_time - last_report_time).total_seconds() / (3600 * 24)
                if days_old > 30:
                    issues.append(f"Lice report is {int(days_old)} days old")
            except Exception:
                pass
    
    # Check FDIR metadata
    if 'fdir_metadata' not in facility or not facility.get('fdir_metadata'):
        issues.append("Missing FDIR metadata")
    
    # Check for missing coordinates
    if not facility.get('position') or not facility['position'].get('latitude'):
        issues.append("Missing geographic position")
    
    return issues


def calculate_recency_decay(
    event_age_hours: float,
    half_life_days: float = 7.0,
) -> float:
    """
    Calculate exponential decay for event relevance over time.
    
    Formula: weight = exp(-ln(2) * age_hours / (half_life_days * 24))
    
    At half-life: weight = 0.5
    At 2x half-life: weight = 0.25
    At 3x half-life: weight = 0.125
    
    Args:
        event_age_hours: How old the event is in hours
        half_life_days: At what age the weight should be 0.5 (default 7 days)
    
    Returns:
        Weight factor 0.0-1.0, where 1.0 = fresh event
    """
    
    if event_age_hours < 0:
        return 1.0
    
    half_life_hours = half_life_days * 24
    decay = math.exp(-math.log(2) * event_age_hours / half_life_hours)
    return min(1.0, max(0.0, decay))


def get_data_age_hours(timestamp_string: str) -> float:
    """
    Parse ISO timestamp and return age in hours.
    
    Args:
        timestamp_string: ISO format datetime string
    
    Returns:
        Age in hours, or None if parse fails
    """
    try:
        event_time = datetime.fromisoformat(timestamp_string.replace('Z', '+00:00'))
        age = (datetime.now(event_time.tzinfo) - event_time).total_seconds() / 3600
        return max(0.0, age)
    except Exception:
        return None


def format_time_ago(hours: float) -> str:
    """Format age in hours as human-readable 'X time ago'."""
    if hours < 1:
        return f"{int(hours * 60)} minutes ago"
    elif hours < 24:
        return f"{int(hours)} hours ago"
    elif hours < 7 * 24:
        return f"{int(hours / 24)} days ago"
    else:
        return f"{int(hours / (7 * 24))} weeks ago"
