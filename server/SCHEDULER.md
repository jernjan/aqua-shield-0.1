# Scheduled Maintenance & ML Retraining

**Kyst Monitor** uses automated scheduled jobs for continuous ML model improvement and facility risk monitoring.

## Overview

Three recurring jobs run automatically:

| Job | Schedule | Purpose |
|-----|----------|---------|
| **ML Retraining** | Daily at 02:00 UTC | Fetch new outbreak data, retrain model |
| **Risk Monitoring** | Every 4 hours | Check all facilities, create alerts |
| **Report Generation** | Weekly (Sunday 03:00 UTC) | Generate alert statistics report |

## ML Retraining (`scheduleMLRetraining`)

**When:** Daily at 02:00 UTC (03:00 CET in winter)

**What it does:**
1. Runs `node server/ml/pipeline.js` in background process
2. Fetches latest disease outbreak data from BarentsWatch API
3. Generates synthetic training data (150 outbreaks + 434 vessel movements)
4. Trains new risk prediction model on disease patterns
5. Saves updated model to `server/data/risk-model.json`
6. Reloads model in main process

**Benefits:**
- Model improves as new data arrives
- Adapts to seasonal patterns (winter = more disease risk)
- No interruption to running API

**Example log output:**
```
🤖 [SCHEDULER] Starting ML model retraining...
[ML Pipeline] Fetching outbreak history...
[ML Pipeline] Generating 150 synthetic outbreaks...
[ML Pipeline] Training model on 150 examples...
✓ [SCHEDULER] ML retraining completed in 76.21s
📊 [SCHEDULER] Model updated with latest training data
```

## Risk Monitoring (`scheduleRiskMonitoring`)

**When:** Every 4 hours (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)

**What it does:**
1. Iterates through all monitored facilities
2. For each facility × disease combination:
   - Gets current vessel contact count (from AIS data in production)
   - Calls ML model to predict risk score
   - Checks if risk increased significantly
   - Creates alert if `riskScore >= 50` (HØY or KRITISK)
3. Stores alerts in `server/data/alerts-history.json`

**Prevents spam by:**
- Only alerting when risk increases to HIGH or higher
- Not re-alerting for same facility/disease without change
- Tracking previous risk level per facility

**Example alert flow:**
```
Facility: Anlegg Nord-Trøndelag
Disease: ISA
Current vessels nearby: 3
ML prediction: 78/100 (KRITISK)
Previous risk: 35/100 (MODERAT)
Decision: ALERT (risk increased from MODERAT to KRITISK)
Status: PENDING → Admin will mark as SENT once notified
```

## Report Generation (`scheduleReportGeneration`)

**When:** Every Sunday at 03:00 UTC

**What it does:**
1. Collects alert statistics:
   - Total alerts created
   - Active (unresolved) alerts
   - Critical alerts (70+)
   - Acknowledged alerts
   - Resolved alerts
2. Generates weekly summary report
3. Can be extended to send email summary to admins

**Example report:**
```
Period: Week 2, 2026
Alerts generated: 47
Active: 12
Critical: 3
Acknowledged: 28
Resolved: 4
Model status: 150 training examples, 4 diseases
```

## Manual Triggers (API)

### Check Scheduler Status

```bash
GET /api/scheduler/status
```

Response:
```json
{
  "ok": true,
  "scheduler": {
    "running": true,
    "jobs": [
      "ML Retraining (02:00 UTC)",
      "Risk Monitoring (every 4h)",
      "Report Generation (03:00 Sundays)"
    ],
    "isRetraining": false,
    "timestamp": "2026-01-11T12:34:56.000Z"
  }
}
```

### Manually Trigger ML Retraining

```bash
POST /api/scheduler/run-retraining
Content-Type: application/json
```

Response:
```json
{
  "ok": true,
  "message": "ML retraining started",
  "timestamp": "2026-01-11T12:34:56.000Z"
}
```

### Manually Trigger Risk Monitoring

```bash
POST /api/scheduler/run-risk-check
Content-Type: application/json
```

Response:
```json
{
  "ok": true,
  "message": "Risk monitoring completed",
  "alertsCreated": 3,
  "alerts": [
    {
      "facilityId": "FARM-001",
      "facilityName": "Anlegg Nord-Trøndelag",
      "disease": "ISA",
      "riskLevel": "KRITISK",
      "riskScore": 78
    }
  ],
  "timestamp": "2026-01-11T12:34:56.000Z"
}
```

## How It Integrates

### With Alert Service

```javascript
// When risk increases, scheduler automatically creates alerts
const alert = alertService.checkAndCreateAlert(
  facilityId,
  riskScore,      // 0-100
  diseaseCode,    // ISA, PD, PRV, SRS
  metadata        // facilityName, vesselContacts, etc
);

// Alert now available via:
// GET /api/alerts/facility/{facilityId}
// GET /api/alerts/active
// GET /api/alerts/stats
```

### With Notification Service

Future enhancement: Scheduler can call notifier service to email facilities:

```javascript
await notifier.sendAlertEmail(
  facility.contactEmail,
  alert,
  facility.name
);
```

## Configuration

**Development mode:** Scheduler runs all jobs as scheduled

**Production (Render):** Jobs run on UTC schedule, which means:
- 02:00 UTC = 03:00 CET (winter) or 04:00 CEST (summer)
- 04:00 UTC = 05:00 CET (winter) or 06:00 CEST (summer)

To change schedules, edit `server/scheduler.js`:

```javascript
// Current: Daily at 02:00 UTC
cron.schedule('0 2 * * *', async () => {
  // Change second 0 = minute, first 2 = hour
  // '0 3 * * *' = 03:00 UTC
  // '0 */4 * * *' = every 4 hours
  // '0 0 * * 0' = Sunday at 00:00 UTC
});
```

## Cron Expression Format

```
Minute (0-59)
│ Hour (0-23)
│ │ Day of month (1-31)
│ │ │ Month (1-12)
│ │ │ │ Day of week (0-6, 0=Sunday)
│ │ │ │ │
0 2 * * *  ← Daily at 02:00
0 */4 * * * ← Every 4 hours
0 3 * * 0  ← Sunday at 03:00
```

## Monitoring

Check Render logs to verify jobs are running:

```bash
# View recent jobs
tail -100 /var/log/scheduler.log

# Look for:
# ✓ ML retraining completed
# ✓ Risk monitoring completed  
# ✓ Weekly report generated
```

## Future Enhancements

- [ ] Database persistence (currently JSON files)
- [ ] SMS alerts via Twilio
- [ ] Email facility contacts when risk critical
- [ ] Admin dashboard widget showing last job status
- [ ] Ability to pause/resume individual jobs
- [ ] Job execution history and timing analytics
- [ ] Webhook notifications to external systems
