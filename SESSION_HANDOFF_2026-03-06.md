# Session handoff – 2026-03-06

## Current stable state
- API and dashboards can now be controlled with one command pair:
  - ./start-all.ps1
  - ./stop-all.ps1
- Verified listening ports when started:
  - 8000 (API)
  - 8080 (Admin)
  - 8081 (Facility)
  - 8082 (Vessel)
- Process metadata/logs are written to:
  - .run/processes.json
  - .run/*.log

## Important functional fixes already in place
- AIS tracking is integrated into scheduler and runs every 15 minutes.
- Vessel visit categories fixed in API output:
  - infected_facility
  - risk_zone_facility
  - near_infected_10km
- Notes-based category preservation and duration handling fixes applied.
- Test/mock vessel cleanup behavior tightened.

## Files changed in this phase
- start-all.ps1
- stop-all.ps1
- README.md (single-command start/stop section)
- .vscode/settings.json (performance excludes)

## How to continue in a fresh chat (minimal context)
Use this exact starter prompt:

"Continue from SESSION_HANDOFF_2026-03-06.md. 
Priority now: keep only essential terminals/processes, verify API + 3 dashboards are healthy, and proceed with next feature/fix request."

## Optional quick cleanup before new chat
1) Run: ./stop-all.ps1
2) In VS Code Terminal panel: Kill All Terminals
3) Reload window (Developer: Reload Window)
4) Start new chat and reference this handoff file

## If services should be up immediately
1) Run: ./start-all.ps1
2) Open:
   - http://127.0.0.1:8000/health
   - http://127.0.0.1:8080
   - http://127.0.0.1:8081
   - http://127.0.0.1:8082
