# AquaShield Farmer MVP - Tilgjengelig Data & Mulige Features

## 📊 Anlegg Data

### Grunninfo
- ✅ Navn, region, ID
- ✅ Koordinater (lat/lng), havstrøm-retning
- ✅ Kapasitet, art (laks/ørret/piggvar), type (merd/kar/innland)
- ✅ Eier, email, telefon, lisens

### Operasjonell Helse
- ✅ **Dødeligheit** - denne uke, denne måned, trend
- ✅ Vanntemperatur (aktuell, sist målt)
- ✅ Risiko-score (0-100%)
- ✅ Downstream/upstream risiko (smitte fra nærliggende)

### Kontroll & Compliance
- ✅ Inspeksjonshistorikk (dato, inspektor, funn, status)
- ✅ Lisenser (type, utløper, status)
- ✅ Compliance logs (actions, riskPoints)

---

## 🚨 Varsler (Alerts)

- ✅ Lus-risiko (BarentsWatch)
- ✅ Alger (Met.no)
- ✅ Temperatur (Kystvarsling)
- ✅ Båtkontakt (AIS)
- ✅ Dødeligheit
- ✅ Inspeksjon
- ✅ Alvorlighetsgrad (risikofylt/høy/moderat/lav)
- ✅ Les/ulest status
- ✅ Dato/tid

---

## 🚢 Besøkende Båter

- ✅ Navn, type (brønnbåt/trawler/etc)
- ✅ MMSI, IMO, kallsign
- ✅ Sist kjent posisjon (lat/lng, tid)
- ✅ Sertifikat status
- ✅ Dager siden desinfeksjon
- ✅ Karantene status

---

## 💡 Foreslåtte Features (Prioritert)

### 🔴 **TIER 1 - Kritisk informasjon**
1. **Risiko-oversikt**
   - Dagens høyeste risiko
   - Varsler sortert etter alvorlighet
   - Status: grønn/gul/rød for rask scanning

2. **Varsler - Actionable**
   - Alle varsler for anlegget
   - Gruppert etter type (lus, alger, båt, etc)
   - Markér som "behandlet"
   - Datoer/kilder tydelig

3. **Dødeligheit Trend**
   - Denne uke vs forrige uke
   - Visualisering (opp/ned)
   - Sammenligning mot region?

4. **Båter - Risk Assessment**
   - Hvilke båter var her?
   - Når og hvor lenge?
   - Karantene-status

### 🟡 **TIER 2 - Planlegging**
1. **Kommende Inspeksjoner**
   - Når skal neste inspeksjon være?
   - Basert på hvor lenge siden sist

2. **Lisens-varsel**
   - Hvilken lisens utløper snart?
   - Dager til utløp

3. **Smitte-risiko fra nærliggende**
   - Hvilken retning kommer smitte fra (strøm)?
   - Oppstrøms/nedstrøms anlegg

### 🟢 **TIER 3 - Detaljer & Export**
1. **Data export**
   - CSV med alle varsler
   - Inspeksjonshistorikk
   - Båt-besøk liste

2. **Komplianse-logg**
   - Alle actions med dato
   - Risk points akkumulert

3. **Historikk & Trender**
   - Dødeligheit over tid
   - Lus-tilfeller per season
   - Alge-påstander historikk

---

## 📋 Foreslått Layout

```
┌─────────────────────────────────────────┐
│ VARSLER (TOP - alltid synlig)           │
│ - Kritiske varsler i rødt               │
│ - Sorterbar/filterbar                   │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ RISIKO STATUS (4 kort)                  │
│ - Dagens risiko %                       │
│ - Dødeligheit denne uke                 │
│ - Aktive varsler                        │
│ - Båter som var her                     │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ DØDELIGHEIT TREND                       │
│ - Tall + pil (opp/ned)                  │
│ - Sammenligning forrige uke             │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ SMITTE-RISIKO (downstream/upstream)     │
│ - Retning på strøm                      │
│ - Nærliggende anlegg risk               │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ BÅTER SOM VAR HER (past 7 days)         │
│ - Navn, type, dato                      │
│ - Karantene status                      │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ INSPEKSJONER & LISENSER                 │
│ - Sist inspeksjon                       │
│ - Lisenser som utløper                  │
└─────────────────────────────────────────┘
```

---

## ❓ Spørsmål for bruker

1. **Prioritering**: Hva er viktigste å se først?
2. **Eksport**: Hvordan vil du bruke data (kalender, rapport, annet)?
3. **Varsler**: Skal de være sortert/filtrerbar etter type?
4. **Trend**: Interessa i dødeligheit/lus-historikk?
