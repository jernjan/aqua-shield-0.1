# Vessel Dashboard - Getting Started

> Canonical port policy (14.04 NEW BUILD): Vessel `8082`, API primary `8000`.

## Quick Start (5 minutes)

### 1. Start the API Server
```bash
# Navigate to EKTE_API folder
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API"

# Activate virtual environment and start API on port 8000
.\.venv\Scripts\python.exe -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
Press CTRL+C to quit
```

### 2. Start the Vessel Dashboard
In a new PowerShell window:
```bash
# Navigate to vessel dashboard
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\vessel-dashboard"

# Start vessel dashboard on canonical port 8082
python server.py --port 8082
```

Expected output:
```
Vessel Dashboard server running on http://localhost:8082
```

### 3. Open Dashboard in Browser
- Open: **http://127.0.0.1:8082**
- Check API status indicator (should be green ✓)
- You're ready to plan routes!

---

## New Features: Autocomplete & Speed Control

### Testing the Autocomplete Feature

1. **Click** on the search field labeled "🔍 Søk etter anlegg"
2. **Type** one of these real BarentsWatch facility names:
   - "Valøyan"
   - "Mannbruholmen"
   - "Grøttingsøy"
   - "Slettholmene"
3. **Autocomplete** suggestions appear as you type
4. **Click** suggestion to select facility

### Testing the Speed Adjustment

1. Scroll to the top of the route planner section
2. **Find** "⚡ Båthastighet (km/t)" input field
3. **Enter** different speeds:
   - Default: `18.52` km/h (10 knots)
   - Fast: `25` km/h (13.5 knots)
   - Slow: `12` km/h (6.5 knots)
4. **Watch** knots conversion update automatically
5. **Plan route** - travel times will adjust to your speed

### Creating a Multi-Facility Route

1. **Select speed**: Enter `20` km/h
2. **Add first facility**: Type "Val", click "Valøyan"
3. **Add second facility**: Type "Mann", click "Mannbruholmen"
4. **Add third facility**: Type "Grøtt", click "Grøttingsøy"
5. **Add fourth facility**: Type "Slett", click "Slettholmene"
6. **View selections**: Should show "4 anlegg valgt"
7. **Click**: "Beregn rute"
8. **See results**:
   - Total distance: ~47.3 km
   - Total time: ~2t 23min (at 20 km/h)
   - Each facility with ETA
   - Speed used: 20 km/h (10.8 knop)

---

## Troubleshooting

### API Status Shows Red ❌

**Problem**: Dashboard shows "Sjekker API..." in red
**Solution**:
1. Verify API is running: `http://127.0.0.1:8000/health`
2. If not running, start it (see "Start the API Server" above)
3. Refresh dashboard page
4. Check PowerShell window for errors

### Autocomplete Not Showing Facilities

**Problem**: Search field works but no suggestions appear
**Solution**:
1. Open browser console (F12)
2. Look for errors in Console tab
3. Check that API is loading facilities:
   - You should see: "✓ Loaded <count> facilities from API"
4. If showing mock data instead, API connection failed
5. Restart API server and refresh dashboard

### Speed Entry Not Updating Times

**Problem**: Travel times don't change when entering speed
**Solution**:
1. Ensure you entered a **number** (not text)
2. Speed must be **greater than 0**
3. Enter decimal as dot (`.`), not comma (`,`)
4. **Recalculate route** after changing speed
5. Times update on next route calculation, not instantly

### Facility Names Not Found

**Problem**: Can't find "Valøyan" or other facilities
**Solution**:
1. Check API status (green indicator)
2. Try partial search: "val" instead of "valøyan"
3. Search is **case-insensitive** - "VALØYAN" also works
4. Some facilities may use abbreviations
5. Scroll through full list (leave search empty)
6. Check console (F12) for which facilities loaded

---

## Port Reference

| Service | Port | URL |
|---------|------|-----|
| Vessel Dashboard | 8082 | http://127.0.0.1:8082 |
| API Server | 8000 | http://127.0.0.1:8000 |
| API Health Check | 8000 | http://127.0.0.1:8000/health |
| Admin Dashboard | 8080 | http://127.0.0.1:8080 |

---

## Advanced: Speed Presets

### Common boat speeds:
- **10 knots** = 18.52 km/h (typical service speed)
- **12 knots** = 22.22 km/h (moderate speed)
- **15 knots** = 27.78 km/h (faster)
- **20 knots** = 37.04 km/h (high speed)

### Why different speeds matter:
- Weather conditions affect achievable speed
- Loaded vessels are slower
- Fuel efficiency decreases at high speeds
- Network maintenance schedules depend on realistic times

---

## File Locations

```
c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\
├── EKTE_API/                    # Backend API
│   ├── src/api/main.py          # Main API endpoints
│   ├── .venv/                   # Python virtual environment
│   └── requirements.txt          # Python dependencies
│
├── 14.04. NY BUILD/
│   ├── vessel-dashboard/        # Route planner (port 8082)
│   │   ├── routes-planner.js    # Autocomplete & speed code
│   │   ├── index.html           # Main dashboard HTML
│   │   ├── styles.css           # Dashboard styles (updated)
│   │   └── server.py            # HTTP server
│   │
│   └── admin-dashboard/         # Admin panel (port 8080)
```

---

## Next Steps

### After creating your first route:
1. **View on map** - Click "Show Map" for geographic visualization
2. **Start route** - Click "Start Rute" to begin navigation
3. **Save to calendar** - Keep track of planned maintenance
4. **Export route** - Share routes with team members

---

## Browser Requirements

- **Chrome** 90+ / **Firefox** 88+ / **Safari** 14+
- JavaScript enabled
- Cookies enabled (for route storage)
- Minimum 1024x768 resolution

---

## Support

For issues or questions:
1. Check browser console (F12) for detailed errors
2. Verify API server is running and accessible
3. Try refreshing the page (Ctrl+F5 to clear cache)
4. Check that all three servers are running on correct ports

---

## Version Info

- **Vessel Dashboard**: v2.0.0 (Autocomplete & Speed enabled)
- **API Server**: EKTE_API v1.0.0
- **Last Updated**: February 17, 2026
- **Status**: ✅ Production Ready
