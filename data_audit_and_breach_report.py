#!/usr/bin/env python3
"""
Data Quality Audit + Quarantine Breach Report Generator
Scans API for inconsistencies and generates regulatory compliance report
"""

import json
from datetime import datetime
from pathlib import Path

def run_audit():
    print("\n" + "="*80)
    print("KYST MONITOR - DATA QUALITY AUDIT + BREACH REPORT")
    print("="*80)
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # ============================================================================
    # 1. DATA QUALITY AUDIT (via API)
    # ============================================================================
    print("\n📋 PART 1: DATA QUALITY AUDIT")
    print("-"*80)
    
    try:
        import urllib.request
        
        # Fetch data from API with no filters to see all vessels
        URL = "http://127.0.0.1:8000/api/vessels/at-risk-facilities?min_duration_minutes=0&include_test_vessels=false&lookback_days=30"
        
        with urllib.request.urlopen(URL, timeout=30) as response:
            data = json.loads(response.read().decode())
        
        vessels = data.get('vessels', [])
        
        # Check for data inconsistencies
        inconsistencies = []
        for vessel in vessels:
            visits = vessel.get('visits', [])
            for visit in visits:
                # Check infected_facility with infected=false
                if visit.get('visit_category') == 'infected_facility' and visit.get('infected') == False:
                    inconsistencies.append({
                        'vessel': vessel.get('vessel_name'),
                        'mmsi': vessel.get('mmsi'),
                        'facility': visit.get('facility_name'),
                        'category': visit.get('visit_category'),
                        'infected_flag': visit.get('infected')
                    })
        
        print(f"\n1.1 Data Inconsistency Check")
        print(f"    Scanned {len(vessels)} vessels")
        print(f"    Found infected_facility records with infected=false: {len(inconsistencies)}")
        
        if inconsistencies:
            print(f"    ⚠️  Examples (first 5):")
            for i, inc in enumerate(inconsistencies[:5], 1):
                print(f"       {i}. {inc['vessel']} (MMSI:{inc['mmsi']}) → {inc['facility']}")
                print(f"          Category: {inc['category']}, Infected flag: {inc['infected_flag']}")
        else:
            print("    ✓ No inconsistencies found")
        
        # Count visits by category
        category_counts = {}
        for vessel in vessels:
            for visit in vessel.get('visits', []):
                cat = visit.get('visit_category', 'unknown')
                category_counts[cat] = category_counts.get(cat, 0) + 1
        
        print(f"\n1.2 Visit Category Distribution")
        for cat, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"    {cat}: {count}")
        
        # Count by infected facility
        infected_vessels = set()
        for vessel in vessels:
            for visit in vessel.get('visits', []):
                if visit.get('visit_category') in ['infected_facility', 'infected_facility_cluster']:
                    infected_vessels.add(vessel.get('mmsi'))
        
        print(f"\n1.3 Overall Dataset Statistics")
        print(f"    Total vessels analyzed: {len(vessels)}")
        print(f"    Total visits recorded: {sum(len(v.get('visits', [])) for v in vessels)}")
        print(f"    Vessels with infected facility visits: {len(infected_vessels)}")
        print(f"    Percentage: {(len(infected_vessels)/len(vessels)*100):.1f}%" if vessels else "    Percentage: N/A")
        
    except Exception as e:
        print(f"    ❌ Error in audit: {e}")
        return
    
    # ============================================================================
    # 2. QUARANTINE BREACH REPORT
    # ============================================================================
    print("\n\n📊 PART 2: QUARANTINE BREACH ANALYSIS")
    print("-"*80)
    
    try:
        URL = "http://127.0.0.1:8000/api/vessels/at-risk-facilities?min_duration_minutes=20&include_test_vessels=false&lookback_days=7"
        
        with urllib.request.urlopen(URL, timeout=30) as response:
            breach_data = json.loads(response.read().decode())
        
        breach_vessels = breach_data.get('vessels', [])
        breakdown = breach_data.get('quarantine_breakdown', {})
        
        print(f"\n2.1 Quarantine Status Summary")
        print(f"    Total at-risk vessels: {breach_data.get('total_vessels', 0)}")
        print(f"    Breakdown:")
        for status, count in sorted(breakdown.items(), key=lambda x: x[1], reverse=True):
            print(f"      - {status}: {count}")
        
        # Find breach vessels
        breaches = [v for v in breach_vessels if v.get('quarantine_analysis', {}).get('has_quarantine_breach')]
        
        print(f"\n2.2 🚨 QUARANTINE BREACH VIOLATIONS: {len(breaches)}")
        print(f"    (Vessels violating Transportforskriften §20a - 48 hour rule)")
        
        if breaches:
            for vessel in sorted(breaches, key=lambda x: x.get('vessel_name', ''))[:20]:
                mmsi = vessel.get('mmsi')
                name = vessel.get('vessel_name', 'Unknown')
                qa = vessel.get('quarantine_analysis', {})
                breach_details = qa.get('breach_details', {})
                
                print(f"\n    ⚠️  {name}")
                print(f"        MMSI: {mmsi}")
                print(f"        Violation: {breach_details.get('infected_source', '?')} → {breach_details.get('facility_name', '?')}")
                print(f"        Hours apart: {breach_details.get('hours_after_infection', '?'):.1f}h (Rule: max 48h)")
                print(f"        Rule: {breach_details.get('rule_basis', '?')}")
        else:
            print("    ✓ No vessels in quarantine breach status")
        
        # Active quarantine summary
        active_vessels = [v for v in breach_vessels if v.get('quarantine_analysis', {}).get('has_active_quarantine') and not v.get('quarantine_analysis', {}).get('has_quarantine_breach')]
        
        print(f"\n2.3 Active Quarantine (Compliant): {len(active_vessels)}")
        if active_vessels:
            for vessel in sorted(active_vessels, key=lambda x: x.get('vessel_name', ''))[:10]:
                name = vessel.get('vessel_name', 'Unknown')
                qa = vessel.get('quarantine_analysis', {})
                hours_left = qa.get('hours_until_clear', 0)
                mmsi = vessel.get('mmsi')
                
                print(f"    • {name} (MMSI: {mmsi}) - {hours_left:.0f}h remaining")
        
        print(f"\n2.4 🏛️  REGULATORY COMPLIANCE STATUS")
        print(f"    Regulation: Transportforskriften §20a")
        print(f"    Rule: Vessels may not visit different infected facilities within 48 hours")
        if len(breaches) == 0:
            print(f"    Status: ✓ COMPLIANT - All vessels adhere to quarantine rules")
        else:
            print(f"    Status: ⚠️  NON-COMPLIANT - {len(breaches)} vessel(s) violating regulations")
            print(f"    Action: Review movements and coordinate with authorities")
        
    except Exception as e:
        print(f"    ❌ API Error: {e}")
        print("    Ensure backend is running at http://127.0.0.1:8000")
    
    # ============================================================================
    # 3. EXPORT RESULTS
    # ============================================================================
    print("\n\n📁 PART 3: DETAILED EXPORT")
    print("-"*80)
    
    try:
        # Export breaches to JSON for regulatory submission
        if 'breach_data' in locals():
            breach_vessels_list = [v for v in breach_data.get('vessels', []) if v.get('quarantine_analysis', {}).get('has_quarantine_breach')]
            
            if len(breach_vessels_list) > 0:
                export_data = {
                    'report_date': datetime.now().isoformat(),
                    'regulation': 'Transportforskriften §20a',
                    'total_breaches': len(breach_vessels_list),
                    'breaches': []
                }
                
                for vessel in breach_vessels_list:
                    qa = vessel.get('quarantine_analysis', {})
                    breach_details = qa.get('breach_details', {})
                    
                    export_data['breaches'].append({
                        'mmsi': vessel.get('mmsi'),
                        'vessel_name': vessel.get('vessel_name'),
                        'status': qa.get('quarantine_status'),
                        'infected_source': breach_details.get('infected_source'),
                        'destination_facility': breach_details.get('facility_name'),
                        'hours_between_visits': breach_details.get('hours_after_infection'),
                        'rule_violated': breach_details.get('rule_basis'),
                        'infected_facility_count': qa.get('infected_facility_count')
                    })
                
                export_path = Path("quarantine_breach_report.json")
                with open(export_path, 'w') as f:
                    json.dump(export_data, f, indent=2)
                
                print(f"    ✓ Breach report exported to: {export_path}") 
                print(f"       ({len(breach_vessels_list)} breaches documented)")
            else:
                print(f"    ✓ No breaches to report")
    except Exception as e:
        print(f"    ⚠️  Export note: {e}")
    
    print("\n" + "="*80)
    print("AUDIT COMPLETE")
    print("="*80 + "\n")

if __name__ == "__main__":
    run_audit()
