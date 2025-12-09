# 🚀 PUSH TO GITHUB & RENDER

## Steg 1: Opprett repo på GitHub

1. Gå til https://github.com/new
2. Repository name: `aqua-shield-0.1`
3. Description: "AquaShield MVP 0.1 - Varsling for norsk akvakultur"
4. Public (so Render can access)
5. Create repository (DON'T initialize with README)

## Steg 2: Push lokal kode til GitHub

```bash
cd c:\Users\janin\OneDrive\Skrivebord\Aqua\ shield\aqua-shield-0.1

git remote add origin https://github.com/YOUR_USERNAME/aqua-shield-0.1.git
git branch -M main
git push -u origin main
```

(Bytt `YOUR_USERNAME` med din GitHub-brukernavn)

## Steg 3: Deploy på Render

1. Gå til https://render.com
2. Login med GitHub
3. **New +** → **Web Service**
4. Connect GitHub → velg `aqua-shield-0.1` repo
5. Konfigurer:
   - **Name:** `aqua-shield-api`
   - **Runtime:** Node
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && npm start`
   - **Instance Type:** Free (eller Starter $7/month)

6. Under **Environment**, legg til:
   ```
   PORT=3001
   JWT_SECRET=super-secret-random-string-here-change-in-production
   ```

7. Click **Create Web Service**
8. Vent 5-10 min mens Render bygger

9. Når bygget er ferdig:
   - Kopier URL (f.eks. `https://aqua-shield-api.onrender.com`)
   - Test: `https://aqua-shield-api.onrender.com/api/health`

## Steg 4: Deploy Frontend

1. **New +** → **Static Site**
2. Koble samme repo
3. Konfigurer:
   - **Name:** `aqua-shield-web`
   - **Build Command:** `cd client && npm install && npm run build`
   - **Publish directory:** `client/dist`

4. Under **Environment:**
   ```
   VITE_API_URL=https://aqua-shield-api.onrender.com
   ```

5. Click **Create Static Site**
6. Vent 3-5 min

7. Når ferdig:
   - Frontend URL: f.eks. `https://aqua-shield-web.onrender.com`
   - Åpne i nettleser → Du skal se login-siden!

## Step 5: Test

1. Register bruker: `test@example.com` / `password123`
2. Velg 2-3 mock anlegg
3. Go to Dashboard
4. Click "🧪 Send test-varsel"
5. Skulle se varsel i inbox
6. Check server logs i Render dashboard → see the alert log

## Troubleshooting

**Frontend blank page?**
- Check browser console (F12) for errors
- Check Render logs

**API 502 error?**
- Check Render API logs
- Verify `PORT=3001` is set in Environment

**Build failed?**
- Check build logs in Render
- Verify `npm install` works locally first

---

All done! 🐟 You're live on the internet!
