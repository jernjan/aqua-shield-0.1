# Frontend - React + Vite Setup Guide

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables (if needed)

Create `.env` in frontend folder:
```
VITE_API_URL=http://localhost:8000/api
```

This is handled by the Vite proxy in `vite.config.js` for development.

## Running Development Server

```bash
npm run dev
```

**Access:** http://localhost:5173

The app automatically proxies API calls to `http://localhost:8000`.

## Build for Production

```bash
npm run build
```

Output: `dist/` folder

## Project Structure

```
src/
├── main.jsx              # App entry point
├── App.jsx               # Router
├── App.css
├── index.css             # Global styles
├── pages/
│   ├── Login.jsx         # Login/Register
│   └── Dashboard.jsx     # Main dashboard
├── components/           # Reusable components (to be added)
├── services/
│   └── api.js           # Axios instance & API calls
├── utils/               # Helper functions (to be added)
└── styles/
    ├── Login.css
    └── Dashboard.css
```

## API Integration

All API calls go through `services/api.js`:

```javascript
import { authService, facilitiesService, alertsService } from '@/services/api'

// Login
const { data } = await authService.login(email, password)
localStorage.setItem('token', data.access_token)

// Get facilities
const { data: facilities } = await facilitiesService.list()

// Update alert
await alertsService.update(alertId, { is_read: true })
```

Token is automatically added to all requests via axios interceptor.

## Key Pages

### Login (`pages/Login.jsx`)
- Register new user
- Login with email/password
- Stores JWT token in localStorage

### Dashboard (`pages/Dashboard.jsx`)
- Shows facilities and alerts
- Mark alerts as read
- Logout button

## Styling

Global styles in `index.css`, page-specific in `styles/` folder.

### CSS Classes

Use provided utility classes:
- `.btn-primary` / `.btn-secondary` / `.btn-danger`
- `.alert-success` / `.alert-error` / `.alert-warning` / `.alert-info`
- `.badge-green` / `.badge-yellow` / `.badge-red`
- `.card` / `.container`

## Development Tips

### Fast Refresh
Vite has instant HMR (Hot Module Replacement) – edits appear immediately

### Browser DevTools
React DevTools extension helpful for debugging component state

### API Debugging
Open browser Console (F12) to see all API calls and responses

## Next Steps

1. ✅ Basic login/dashboard structure
2. 🔲 Add facility search/filter
3. 🔲 Add alert filters
4. 🔲 Real-time updates (WebSocket)
5. 🔲 Export data (CSV)
6. 🔲 Mobile responsive polish
7. 🔲 Dark mode
8. 🔲 Component testing

## Troubleshooting

### "Cannot find module"
Run `npm install` to ensure all dependencies are installed

### API calls failing (CORS)
Check that backend is running on `http://localhost:8000`

### Port 5173 already in use
```bash
# Change port in vite.config.js or kill process
```

### Slow reloads
Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

**Node:** 16+  
**React:** 18.2+  
**Vite:** 5.0+
