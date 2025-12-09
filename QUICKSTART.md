# 🚀 QUICK START

AquaShield MVP 0.1 – Varsling for norsk akvakultur. Kjør lokalt i 5 minutter.

## Install & Run

```bash
# Terminal 1 – API server
cd aqua-shield-0.1/server
npm install
npm run dev

# Terminal 2 – Frontend
cd aqua-shield-0.1/client
npm install
npm run dev
```

Open browser: **http://localhost:5173**

## Test det

1. **Registrer bruker:** test@example.com / 123456
2. **Velg anlegg:** Mock anlegg A, B, C + båter
3. **Dashboard:** Klikk "🧪 Send test-varsel"
4. **Server konsoll:** Se varsel-logg

## Deploy på Render (5 min)

1. Push til GitHub
2. https://render.com → **New Service**
3. Upload `aqua-shield-0.1` repo
4. Render bygger automatically fra `render.yaml`
5. Set env vars (JWT_SECRET, Twilio/SMTP optional)

See **DEPLOY.md** for detaljer.

## API endpoints (for testing)

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123","name":"Test"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123"}'

# Health check
curl http://localhost:3001/api/health
```

## Next steps

- See **README.md** for full documentation
- See **NOTES.md** for future improvements
- Contact BarentsWatch for API documentation

---

Lykke til! 🐟
