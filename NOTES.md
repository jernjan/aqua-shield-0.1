# 💡 NOTES.md – Forbedringer og ideer

Her er en liste over forbedringer som kan implementeres etter MVP-lanseringen. Prioritert etter impact.

---

## 🔴 Kritisk (sesong 1)

### 1. Real SMS/Email sending
- [ ] Implementer Twilio SMS (se `utils/notify.js`)
- [ ] Implementer Gmail/SMTP email med templates
- [ ] Test med 2–3 pilot-kunder først
- **Impact:** Varsler kommer ikke frem uten dette
- **Estimate:** 2–3 timer

### 2. Natt-analyse-optimering
- [ ] `runNightlyAnalysis()` kan ta 5+ minutter ved 1000+ anlegg
- [ ] Legg til async batching, max 100 anlegg per batch
- [ ] Legg til progress logging
- **Impact:** Reduserer load/timeout ved stor skalering
- **Estimate:** 3–4 timer

### 3. Database til PostgreSQL
- [ ] JSON-fil blir bottleneck ved 50+ users
- [ ] Migrer til Render PostgreSQL eller Railway
- [ ] Bruk `pg` library eller Prisma ORM
- **Impact:** Stabilitet ved vekst
- **Estimate:** 4–6 timer

### 4. Bruker-feedback-loop
- [ ] Lag form: "War this alert correct?" (ja/nei) → lagre for kalibrering
- [ ] Dashboard viser % accuracy per risiko-type
- [ ] Adjust thresholds basert på feedback hver uke
- **Impact:** Reduserer false positives (kritisk for trust)
- **Estimate:** 4–5 timer

---

## 🟡 Viktig (sesong 2)

### 5. Admin-panel
- [ ] Logg inn som admin
- [ ] Juster risiko-terskler (60 → 55) live
- [ ] Se alle varsler, alle brukere, statistikk
- [ ] Manuelt trigger analyse for testing
- **Impact:** Itererer raskere på algoritmen
- **Estimate:** 5–6 timer

### 6. Ekte temperatur-data
- [ ] Integrer NorKyst-800 (norske havmodell, open source)
- [ ] Eller NOAA GFS weather API
- [ ] Hent daily temp for hver anlegget, not mock
- **Impact:** Mye mer presise varnsler
- **Estimate:** 3–4 timer

### 7. Ekte vannstrøm-data
- [ ] Hent fra NorKyst-800 eller Copernicus
- [ ] Kalkuler utbredelse basert på strøm retning
- [ ] Vis på dashboard (valgfritt)
- **Impact:** Bedre direksjonell smitte-prediksjon
- **Estimate:** 4–5 timer

### 8. Algae-data (Copernicus Sentinel-5P)
- [ ] Hent klorofyll-a, NO3, PH fra åpne kilder
- [ ] Flag når algae > 10 µg/L within 20km
- [ ] +5 points til risk score
- **Impact:** Detekterer algae-assosierte sykdommer (VER)
- **Estimate:** 3–4 timer

### 9. PDF export
- [ ] Bruk jsPDF til å lag detaljert risk-rapport
- [ ] Inkluder: facility list, risk trend, nearby outbreaks, boat visits
- [ ] Knapp i dashboard: "Download weekly PDF"
- **Impact:** Gir farmers PDF de kan dele med Mattilsynet
- **Estimate:** 3–4 timer

---

## 🟢 Fin-tuning (sesong 3)

### 10. Error logging (Sentry)
- [ ] Integrer Sentry for backend error tracking
- [ ] Alert on 5+ errors in 1 hour
- [ ] See which endpoints fail most
- **Impact:** Mindre downtime
- **Estimate:** 2 timer

### 11. Analytics dashboard
- [ ] Hvem bruker systemet? Hvor ofte logg de inn?
- [ ] Hvor mange varsler per bruker per uke?
- [ ] Hvilke risk-tipe oppstår mest?
- [ ] Heat-map av which facilities/regions are riskiest
- **Impact:** Insight for product strategy
- **Estimate:** 4–5 timer

### 12. Webhook for BarentsWatch updates
- [ ] Når BarentsWatch har ny data → trigger analyse immediately (not wait for 03:00)
- [ ] WebSocket for real-time alerts (push, not pull)
- **Impact:** Varsler kommer tidligere
- **Estimate:** 6+ timer

### 13. Multi-language (English)
- [ ] Translate all UI + email/SMS templates to English
- [ ] Internationalization (i18n) setup
- **Impact:** Mulig å skappe globalt
- **Estimate:** 3–4 timer

### 14. Mobile app (React Native)
- [ ] Expo-based iOS/Android app
- [ ] Push notifications (FCM/APNs)
- [ ] Offline alerts cache
- **Impact:** Farmer får varsel selv uten web access
- **Estimate:** 10+ timer (sesong 4)

### 15. Offline mode (PWA)
- [ ] Service worker for client
- [ ] Cache alerts locally
- [ ] Sync when online again
- **Impact:** Works without internet
- **Estimate:** 3–4 timer

---

## 🎯 Strategi

**Sesong 1 (nå - jan 2026):**
- Item 1-4: Real SMS, better nightly, PostgreSQL, user feedback
- Goal: 10–20 pilot kunder, 70%+ alert accuracy

**Sesong 2 (jan–apr 2026):**
- Item 5-9: Admin panel, real temp/current/algae, PDF export
- Goal: 30–50 betalende kunder, 80%+ accuracy

**Sesong 3 (apr–jul 2026):**
- Item 10-15: Analytics, webhook, i18n, mobile
- Goal: 100+ kunder, enterprise integrations

---

## Code examples

### Rapid feedback loop (item 4)

```javascript
// routes/alerts.js - legg til
router.post('/:alertId/feedback', authMiddleware, async (req, res) => {
  const { wasAccurate } = req.body; // true/false
  await updateAlert(req.params.alertId, { userFeedback: wasAccurate });
  res.json({ message: 'Feedback recorded' });
});

// Dashboard.jsx - legg til knapper
{!alert.userFeedback && (
  <div style={{ marginTop: '8px' }}>
    <button onClick={() => handleFeedback(alert.id, true)}>✓ Korrekt</button>
    <button onClick={() => handleFeedback(alert.id, false)}>✗ Feil varsel</button>
  </div>
)}
```

### Admin panel (item 5)

```javascript
// routes/admin.js
router.get('/stats', adminAuthMiddleware, async (req, res) => {
  const db = await readDB();
  const totalAlerts = db.alerts.length;
  const accurateAlerts = db.alerts.filter(a => a.userFeedback === true).length;
  res.json({
    totalUsers: db.users.length,
    totalAlerts,
    accuracy: (accurateAlerts / totalAlerts * 100).toFixed(1) + '%'
  });
});
```

---

## Budsjett (inkl. cloud)

| Sesong | Estimate | Cloud cost | Team |
|--------|----------|-----------|------|
| 1 | 6-8 uker | $20–50/month | 1 dev full-time |
| 2 | 8-10 uker | $50–100/month | 1–2 dev |
| 3 | 10-12 uker | $100–300/month | 2 dev + 1 ML engineer |

---

## Konklusjon

Start med sesong 1 (kritisk items). Ved sesong 3 vil AquaShield være konkurranse-dyktig mot Aquabyte/Manolin.

**Key metric:** Hit rate (varsler som resulterer i ekte smitteutbrudd). Mål: 70% sesong 1, 80% sesong 2, 85%+ sesong 3.

---

God lykke! 🐟
