# 🌊 Aqua Shield API Documentation

Complete API reference for all 58+ endpoints organized by functionality.

---

## 📋 Table of Contents
1. [Health & Admin](#health--admin)
2. [MVP - Farmers (Anlegg)](#mvp---farmers-anlegg)
3. [MVP - Vessels (Brønnbåter)](#mvp---vessels-brønnbåter)
4. [MVP - Professional Fishers (Yrkesfiskere)](#mvp---professional-fishers-yrkesfiskere)
5. [MVP - Admin & Regulators](#mvp---admin--regulators)
6. [MVP - Public Data](#mvp---public-data)
7. [Disease Monitoring](#disease-monitoring)
8. [BarentsWatch Integration](#barentswatch-integration)
9. [Data Logging](#data-logging)
10. [Alerts & Notifications](#alerts--notifications)

---

## Health & Admin

### GET `/api/health`
Health check endpoint
- **Response**: `{ status: 'ok' }`

### POST `/api/admin/run-cron`
Manually trigger scheduled tasks (retraining, alerts)
- **Body**: (optional) `{ task: 'retrain' | 'check-risks' }`
- **Response**: `{ ok: true, results: {...} }`

### POST `/api/alerts/test`
Send test alert notification
- **Body**: `{ facilityName?: string }`
- **Response**: `{ ok: true, alert: {...} }`

---

## MVP - Farmers (Anlegg)

### GET `/api/mvp/farmer/:farmId?`
Get all farms or specific farm
- **Params**: `farmId` (optional)
- **Query**: `userId` (optional - filter by user)
- **Response**: Farm object(s) with licenses, inspections, compliance logs

### GET `/api/mvp/farm/:farmId/nearby`
Get nearby farms (within disease risk zone)
- **Response**: Array of nearby farms with distance

### GET `/api/mvp/farm/:farmId/algae-alerts`
Get algae/water condition alerts for farm
- **Response**: Array of algae alerts with severity

### GET `/api/mvp/farm/:farmId/current-conditions`
Get current sea/water conditions
- **Response**: Water temp, salinity, current direction, etc.

### GET `/api/mvp/farm/:farmId/visiting-vessels`
Get vessels that have visited this farm
- **Response**: Array of vessel visits with timestamps

### GET `/api/mvp/farm/:farmId/disease-risks`
Get disease risk assessment for farm
- **Response**: Risk scores for ILA, PD, other diseases

---

## MVP - Vessels (Brønnbåter)

### GET `/api/mvp/vessel/:vesselId?`
Get all vessels or specific vessel
- **Params**: `vesselId` (optional)
- **Response**: Vessel data with AIS, certificates, compliance

### GET `/api/mvp/vessel/:vesselId/tasks`
Get vessel maintenance/quarantine tasks
- **Response**: Array of tasks with status

### POST `/api/mvp/vessel/:vesselId/task`
Add new quarantine/maintenance task
- **Body**: `{ name, dueDate, duration?, type? }`
- **Response**: `{ ok: true, task: {...} }`

### PATCH `/api/mvp/vessel/:vesselId/task/:taskId`
Update task status (mark complete)
- **Body**: `{ completed?: boolean, status?: string }`
- **Response**: Updated task object

### GET `/api/mvp/vessel/:vesselId/disinfections`
Get disinfection history
- **Response**: Array of disinfection records

### POST `/api/mvp/vessel/:vesselId/disinfection`
Record disinfection event
- **Body**: `{ date, chemical, operator, comment? }`
- **Response**: `{ ok: true, disinfection: {...} }`

---

## MVP - Professional Fishers (Yrkesfiskere)

### GET `/api/mvp/fisher/:fisherId?`
Get all fishers or specific fisher
- **Params**: `fisherId` (optional)
- **Response**: Fisher data with permits, catches, home port

### GET `/api/mvp/fisher/:fisherId/tasks`
Get fisher tasks
- **Response**: `{ fisherId, tasks: [...] }`

### POST `/api/mvp/fisher/:fisherId/task`
Add fisher task (inspection, maintenance, quarantine)
- **Body**: `{ name, dueDate, duration?, type? }`
- **Response**: `{ ok: true, task: {...} }`

### PATCH `/api/mvp/fisher/:fisherId/task/:taskId`
Update fisher task
- **Body**: `{ completed?: boolean }`
- **Response**: `{ ok: true, task: {...} }`

### GET `/api/mvp/fisher/:fisherId/zone-avoidances`
Get fisher's recorded zone avoidances (ML training data)
- **Response**: `{ fisherId, avoidances: [...] }`

### POST `/api/mvp/fisher/:fisherId/zone-avoidance`
Record zone avoidance (fisher reported avoiding disease zone)
- **Body**: `{ zoneName, disease, lat?, lon?, reason?, timestamp? }`
- **Response**: `{ ok: true, avoidance: {...} }`

---

## MVP - Admin & Regulators

### GET `/api/mvp/admin/stats`
Get aggregated statistics (farms, vessels, alerts)
- **Response**: `{ farmCount, vesselCount, alertCount, ... }`

### GET `/api/mvp/admin/alerts`
Get all active alerts
- **Response**: Array of alerts with severity

### GET `/api/mvp/admin/vessels`
Get all vessels with compliance status
- **Response**: Array of vessels

### GET `/api/mvp/admin/vessel/:vesselId`
Get detailed vessel compliance report
- **Response**: Vessel with inspection history, certificates

### GET `/api/mvp/admin/quarantine-recommendations`
Get AI-recommended quarantine facilities
- **Response**: Array of recommendations with risk scores

### POST `/api/mvp/admin/quarantine-trigger`
Manually trigger quarantine alert
- **Body**: `{ facilityId, reason, duration }`
- **Response**: `{ ok: true, quarantine: {...} }`

### GET `/api/mvp/admin/quarantines`
Get active quarantines
- **Response**: Array of quarantine records

### GET `/api/mvp/admin/infection-chain`
Get disease transmission chain analysis
- **Response**: Graph of infection paths between facilities

---

## MVP - Public Data

### GET `/api/mvp/public`
Get public/anonymous disease summary
- **Response**: Regional statistics without identifiable info

### GET `/api/mvp/public/vessels`
Get public vessel movement data
- **Response**: Anonymized AIS data

---

## Disease Monitoring

### GET `/api/disease-zones/all`
Get all active disease zones (ILA, PD, etc.)
- **Response**: 
  ```json
  {
    "zones": [...],
    "stats": { "ilaZones": 5, "pdZones": 3, ... }
  }
  ```

### GET `/api/disease-zones/:disease`
Get specific disease zones
- **Params**: `disease` (ILA, PD, etc.)
- **Response**: Array of zone objects with boundaries

---

## BarentsWatch Integration

### GET `/api/barentswatch/outbreaks`
Get outbreak history from BarentsWatch
- **Response**: Array of disease outbreaks with dates, locations

### GET `/api/barentswatch/facility/:facilityNo/lice`
Get sea lice (lus) data for specific facility from BarentsWatch
- **Params**: `facilityNo` (facility ID)
- **Response**: Lice count, treatment history, etc.

### GET `/api/barentswatch/stats`
Get aggregated BarentsWatch statistics
- **Response**: Disease trends, facility statistics

---

## Data Logging

### POST `/api/datalog/alert`
Log alert event
- **Body**: `{ type, severity, message, facilityId?, data? }`
- **Response**: `{ ok: true }`

### GET `/api/datalog/alerts`
Get logged alerts
- **Query**: `limit?`, `offset?`, `facilityId?`
- **Response**: Array of logged alerts

### POST `/api/datalog/vessel-position`
Log vessel position (AIS data)
- **Body**: `{ vesselId, lat, lon, speed, heading, timestamp }`
- **Response**: `{ ok: true }`

### GET `/api/datalog/vessel-movements`
Get vessel movement history
- **Query**: `vesselId?`, `days?`
- **Response**: Array of position logs

---

## Alerts & Notifications

### GET `/api/alerts`
Get all system alerts
- **Response**: Array of alert objects

### POST `/api/alerts/test`
Send test alert (see Health & Admin section)

---

## 🔄 ML Risk Model Integration

The following endpoints use the trained ML model for risk prediction:

- **Risk Prediction**: Used by `/api/mvp/admin/stats` and `/api/mvp/farm/:farmId/disease-risks`
- **Model Retraining**: Automatically triggered daily at 02:00 UTC
- **Training Data**: Fisher zone-avoidances + vessel positions + disease outbreak history
- **Output**: Risk scores (0-100) for each facility

---

## 📊 Scheduler Jobs

Running automatically:

1. **Daily ML Retraining** (02:00 UTC)
   - Retrains risk model on latest data
   - Saves updated model to `server/data/risk-model.json`

2. **4-Hourly Risk Monitoring**
   - Checks all facilities for risk increases
   - Triggers alerts if risk exceeds thresholds

3. **Weekly Report Generation**
   - Aggregates statistics for regulators
   - Sends email summaries

---

## 🔐 Authentication

All endpoints support optional JWT authentication via header:
```
Authorization: Bearer <token>
```

Some endpoints (public data) don't require auth.
Other endpoints require specific user roles (farmer, vessel_operator, fisher, admin).

---

## 📝 TODO - Features to Build

### High Priority
- [ ] **Export API**: `/api/export/report` - Generate PDF reports
- [ ] **Batch Operations**: `/api/mvp/vessel/batch-task` - Add task to multiple vessels
- [ ] **Search API**: `/api/search` - Global search across all facilities
- [ ] **Statistics API**: `/api/stats/facility-trends` - Historical risk trends

### Medium Priority
- [ ] **API Webhooks**: Notify external systems of important events
- [ ] **Map API**: `/api/map/facilities` - GeoJSON for mapping
- [ ] **Risk Forecasting**: `/api/forecast/next-7-days` - Predict risks
- [ ] **Compliance Check**: `/api/compliance/vessel/:id` - Detailed audit trail

### Nice to Have
- [ ] **Analytics Dashboard Data**: `/api/analytics/*` - Pre-computed stats
- [ ] **ML Model Endpoints**: `/api/ml/predict` - Direct model access
- [ ] **Integration Webhooks**: Two-way sync with external systems
- [ ] **Batch Reporting**: Schedule automated reports

---

## 📞 Support

For API issues or to request new endpoints, contact the development team.

Last Updated: 2026-01-11
API Version: v1.0
Total Endpoints: 58+
