# AquaShield 0.1 – Minimal MVP Architecture

## 📁 Project Structure

```
aqua-shield-0.1/                    Root folder
├── README.md                        Main documentation
├── QUICKSTART.md                    5-minute setup guide
├── DEPLOY.md                        Render deployment guide
├── NOTES.md                         Future improvements
├── render.yaml                      Render infrastructure config
├── .env.example                     Template for secrets
├── .gitignore                       Git excludes
│
├── server/                          Node/Express API
│   ├── index.js                     Entry point, app setup
│   ├── db.js                        JSON-file database wrapper
│   ├── package.json
│   ├── .env.example
│   ├── .gitignore
│   │
│   ├── routes/
│   │   ├── auth.js                  Login/Register (JWT)
│   │   ├── user.js                  Profile, select sites
│   │   └── alerts.js                Get/mark alerts, test alert
│   │
│   ├── cron/
│   │   └── nightly.js               03:00 analysis job
│   │
│   └── utils/
│       ├── barentswatch.js          Fetch facilities (BarentsWatch API)
│       ├── ais.js                   Fetch vessels (Kystverket AIS)
│       ├── risk.js                  Risk calculation engine (0-100)
│       └── notify.js                SMS/Email templates (not sending yet)
│
└── client/                          React + Vite frontend
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── .gitignore
    │
    └── src/
        ├── main.jsx                 React entry point
        ├── App.jsx                  Router/state management
        ├── index.css                Global styles
        │
        ├── pages/
        │   ├── Login.jsx            Register/Login form
        │   ├── SelectSites.jsx      Choose facilities/vessels
        │   └── Dashboard.jsx        Alerts inbox
        │
        └── components/
            └── Toast.jsx            Toast notifications
```

---

## 🔧 Technology Stack

| Layer | Tech | Version |
|-------|------|---------|
| **Frontend** | React | 18.2.0 |
| **Build** | Vite | 4.3.9+ |
| **Backend** | Node/Express | 16+/4.18.2 |
| **Database** | JSON-file | (MVP), later Postgres |
| **Auth** | JWT + bcryptjs | 9.0.0/2.4.3 |
| **API Calls** | axios | 1.4.0 |
| **SMS** | Twilio SDK | 3.73.0 (stub) |
| **Email** | Nodemailer | 6.9.3 (stub) |

---

## 🔄 Data Flow

```
1. User registers/logs in
   └─> server/routes/auth.js → JWT token → stored in localStorage

2. User selects facilities + vessels
   └─> server/routes/user.js → saves to db.json

3. Nightly at 03:00 UTC+1:
   ├─> server/cron/nightly.js starts
   ├─> Fetches ALL facilities from BarentsWatch (utils/barentswatch.js)
   ├─> Fetches ALL vessels from Kystverket AIS (utils/ais.js)
   ├─> For each user's selected facilities/vessels:
   │   ├─> Calculates risk score (utils/risk.js)
   │   ├─> Determines if alert needed (score >= 60 or status change)
   │   └─> Creates alert in db.json
   └─> (Future: sends SMS/Email via utils/notify.js)

4. User opens Dashboard
   └─> Fetches their alerts via server/routes/alerts.js
   └─> Displays in inbox format (red/yellow/green)

5. User clicks "Mark as read" or test alert
   └─> server/routes/alerts.js updates alert status
   └─> Frontend reflects change
```

---

## 🎯 MVP Features

✅ **Working:**
- User registration + JWT auth
- Select facilities + vessels (from BarentsWatch/AIS)
- Nightly analysis (distance-weighted risk calculation)
- Alert creation + storage (db.json)
- Dashboard inbox with alerts
- Test alert button
- Toast notifications

⚠️ **Stubbed (ready for implementation):**
- Real SMS sending (Twilio code exists, needs API key)
- Real email sending (SMTP code exists, needs Gmail setup)
- Temperature data (mock, needs NorKyst-800 or weather API)
- Current/water flow data (mock, needs NorKyst-800)
- Algae data (not implemented, needs Copernicus)

---

## 🚀 Deployment

**Local:**
```bash
cd server && npm install && npm run dev   # Terminal 1
cd client && npm install && npm run dev   # Terminal 2
# Open http://localhost:5173
```

**Render:**
See `DEPLOY.md` for step-by-step instructions.

**Requirements:**
- GitHub account + push code
- Render account (free tier OK for MVP)
- (Optional) Twilio account for SMS
- (Optional) Gmail account for email

---

## 📊 Database (db.json)

```json
{
  "users": [
    {
      "id": "user_1234567890",
      "email": "user@example.com",
      "name": "Jon Farmer",
      "phone": "+47123456789",
      "selectedFacilities": ["1234", "5678"],
      "selectedVessels": ["123456789"],
      "createdAt": "2025-12-09T10:00:00.000Z"
    }
  ],
  "alerts": [
    {
      "id": "alert_1234567890",
      "userId": "user_1234567890",
      "type": "facility",
      "title": "🔴 KRITISK: Smitterisiko på Anlegg A",
      "message": "...",
      "riskLevel": "kritisk",
      "riskScore": 75,
      "isRead": false,
      "createdAt": "2025-12-09T03:00:00.000Z"
    }
  ],
  "facilities": [],
  "vessels": []
}
```

---

## 🔐 Security

- **Passwords:** bcryptjs hashing, never stored plain-text
- **Auth:** JWT tokens, 30-day expiry, verify on each protected route
- **CORS:** Enabled for localhost dev, restrict in production
- **Secrets:** All keys in `.env`, not in code

---

## 🐛 Known Limitations

1. **Database:** JSON-file not suitable for 50+ concurrent users
   - Solution: Migrate to PostgreSQL (Render, Railway, Heroku)

2. **Data accuracy:** BarentsWatch coordinates can be off by 1–2 km
   - Solution: User feedback loop, manual facility offset adjustments

3. **Notifications:** SMS/Email not sending yet (stub only)
   - Solution: Configure Twilio + SMTP in production

4. **Analysis speed:** Analyzing 1000+ facilities takes 5+ minutes
   - Solution: Batch processing, async queues, offload to background job

5. **Real-time:** No live updates (pull-based every 24h)
   - Solution: WebSockets, webhook from BarentsWatch (when available)

---

## 📈 Roadmap

**Season 1 (now–Jan 2026):** Real SMS/Email, PostgreSQL, user feedback
**Season 2 (Jan–Apr 2026):** Admin panel, real weather/current data, PDF export
**Season 3 (Apr–Jul 2026):** Analytics, mobile app, webhook integration

See `NOTES.md` for full improvement backlog.

---

## 📞 Support

Questions? See `README.md` for overview, `DEPLOY.md` for setup help, `NOTES.md` for improvements.

**Main contacts:**
- BarentsWatch API docs: https://www.barentswatch.no/
- Kystverket AIS: https://www.barentswatch.no/
- Render docs: https://render.com/docs

---

**Created:** Dec 9, 2025  
**Version:** 0.1 MVP  
**Status:** Ready for pilot launch

Good luck! 🐟
