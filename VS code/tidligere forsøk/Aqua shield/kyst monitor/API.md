# API Documentation

## Overview

AquaShield provides a RESTful API for managing aquaculture farms, risk assessments, and alerts. All endpoints require JWT authentication except for registration and login.

## Authentication

### Registration

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "farmer1",
  "email": "farmer@example.com",
  "password": "SecurePassword123!"
}
```

Response:
```json
{
  "id": 1,
  "username": "farmer1",
  "email": "farmer@example.com",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00",
  "updated_at": "2024-01-15T10:30:00"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "farmer1",
  "password": "SecurePassword123!"
}
```

Response:
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer"
}
```

### Get Current User

```http
GET /api/auth/me
Authorization: Bearer {access_token}
```

## Farm Management

### Create Farm

```http
POST /api/farms
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "Salmon Farm Alpha",
  "latitude": 60.5,
  "longitude": 5.5,
  "description": "Northern coastal farm"
}
```

### List Farms

```http
GET /api/farms
Authorization: Bearer {access_token}
```

Response:
```json
[
  {
    "id": 1,
    "owner_id": 1,
    "name": "Salmon Farm Alpha",
    "latitude": 60.5,
    "longitude": 5.5,
    "description": "Northern coastal farm",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00",
    "updated_at": "2024-01-15T10:30:00"
  }
]
```

### Get Farm Details

```http
GET /api/farms/{farm_id}
Authorization: Bearer {access_token}
```

### Update Farm

```http
PUT /api/farms/{farm_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "Updated Farm Name",
  "latitude": 60.6,
  "longitude": 5.6
}
```

### Delete Farm

```http
DELETE /api/farms/{farm_id}
Authorization: Bearer {access_token}
```

## Risk Assessment

### Assess Farm Risk

```http
POST /api/risk/assess/{farm_id}
Authorization: Bearer {access_token}
```

Response:
```json
{
  "id": 1,
  "farm_id": 1,
  "risk_level": "HIGH",
  "disease_risk": 0.45,
  "escape_risk": 0.65,
  "water_quality_risk": 0.30,
  "sea_lice_risk": 0.55,
  "details": null,
  "assessed_at": "2024-01-15T10:30:00",
  "created_at": "2024-01-15T10:30:00"
}
```

### Get Assessment History

```http
GET /api/risk/history/{farm_id}?limit=30
Authorization: Bearer {access_token}
```

### Get Latest Assessment

```http
GET /api/risk/latest/{farm_id}
Authorization: Bearer {access_token}
```

## Alerts

### Get Alerts

```http
GET /api/alerts?unread_only=false&farm_id=1
Authorization: Bearer {access_token}
```

Response:
```json
[
  {
    "id": 1,
    "user_id": 1,
    "farm_id": 1,
    "alert_type": "HIGH_RISK_DETECTED",
    "severity": "HIGH",
    "title": "HIGH Risk Level for Salmon Farm Alpha",
    "message": "Risk assessment shows HIGH risk...",
    "is_read": false,
    "created_at": "2024-01-15T10:30:00",
    "updated_at": "2024-01-15T10:30:00"
  }
]
```

### Mark Alert as Read

```http
PATCH /api/alerts/{alert_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "is_read": true
}
```

### Delete Alert

```http
DELETE /api/alerts/{alert_id}
Authorization: Bearer {access_token}
```

### Alert Summary

```http
GET /api/alerts/stats/summary
Authorization: Bearer {access_token}
```

Response:
```json
{
  "critical": 2,
  "high": 5,
  "medium": 8,
  "total_unread": 15
}
```

## Dashboard

### Get Dashboard Data

```http
GET /api/dashboard
Authorization: Bearer {access_token}
```

Response:
```json
{
  "farms": [
    {
      "farm_id": 1,
      "farm_name": "Salmon Farm Alpha",
      "latitude": 60.5,
      "longitude": 5.5,
      "latest_risk_assessment": {
        "id": 1,
        "farm_id": 1,
        "risk_level": "HIGH",
        "disease_risk": 0.45,
        "escape_risk": 0.65,
        "water_quality_risk": 0.30,
        "sea_lice_risk": 0.55,
        "assessed_at": "2024-01-15T10:30:00",
        "created_at": "2024-01-15T10:30:00"
      },
      "active_alerts": []
    }
  ],
  "total_critical_alerts": 2,
  "total_high_alerts": 5,
  "last_analysis": "2024-01-15T23:00:00"
}
```

## Health Check

```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "environment": "development",
  "version": "1.0.0"
}
```

## Error Responses

### Validation Error

```json
{
  "detail": [
    {
      "loc": ["body", "latitude"],
      "msg": "ensure this value is greater than or equal to -90",
      "type": "value_error.number.not_ge"
    }
  ]
}
```

### Authentication Error

```json
{
  "detail": "Invalid credentials"
}
```

### Not Found Error

```json
{
  "detail": "Farm not found"
}
```

### Server Error

```json
{
  "detail": "Internal server error"
}
```

## Rate Limiting

Current rate limiting:
- 100 requests per minute per IP
- 1000 requests per hour per user

## Pagination

List endpoints support pagination:

```
GET /api/alerts?skip=0&limit=10
```

## Filtering

Alerts can be filtered by:
- `unread_only`: boolean
- `farm_id`: integer
- `severity`: string (CRITICAL, HIGH, MEDIUM, LOW)

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Validation Error |
| 500 | Server Error |

---

For interactive API documentation, visit `/docs` (Swagger UI) or `/redoc` (ReDoc) endpoints.
