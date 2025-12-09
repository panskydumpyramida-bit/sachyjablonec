# Cloudflare Worker Setup - Maintenance Mode

## Co to dělá?

Cloudflare Worker funguje jako proxy před Railway:
- ✅ Kontroluje health check endpoint na Railway
- ✅ Pokud Railway běží → proxy všechny requesty
- ✅ Pokud Railway nereaguje → zobrazí maintenance.html
- ✅ Funguje i když Railway úplně spadne

---

## Příprava

### 1. Přidej Health Check Endpoint do Express

Otevři `src/server.js` a přidej na začátek (před ostatní routes):

```javascript
// Health check endpoint for Cloudflare Worker
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});
```

Commitni a pushni na Railway:
```bash
git add src/server.js
git commit -m "feat: Add health check endpoint for Cloudflare Worker"
git push origin main
```

### 2. Zjisti Railway URL

V Railway dashboard najdi URL tvé aplikace, např:
```
https://sachyjablonec-production.up.railway.app
```

Aktualizuj v `cloudflare/worker.js` na řádku 11:
```javascript
const RAILWAY_URL = 'https://TVOJE-RAILWAY-URL.up.railway.app';
```

---

## Nasazení

### Možnost A: Přes Cloudflare Dashboard (jednodušší)

1. **Přihlaš se do Cloudflare**
   - Jdi na https://dash.cloudflare.com
   - Vyber svou doménu `sachyjablonec.cz`

2. **Vytvoř Worker**
   - V levém menu: **Workers & Pages**
   - Klikni **Create Application**
   - Vyber **Create Worker**
   - Pojmenuj ho např. `sachyjablonec-proxy`

3. **Zkopíruj kód**
   - Otevři `cloudflare/worker.js`
   - Zkopíruj celý obsah
   - Vlož do Cloudflare editoru
   - Klikni **Save and Deploy**

4. **Nastav Route**
   - V Worker nastavení jdi na **Triggers**
   - Klikni **Add Route**
   - Pattern: `sachyjablonec.cz/*`
   - Zone: `sachyjablonec.cz`
   - Klikni **Add Route**
   - Opakuj pro `www.sachyjablonec.cz/*`

### Možnost B: Přes Wrangler CLI (pokročilé)

1. **Instalace Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **Přihlášení**
   ```bash
   wrangler login
   ```

3. **Deploy**
   ```bash
   cd cloudflare
   wrangler deploy
   ```

4. **Nastav Routes v Dashboard**
   - Jdi do Cloudflare Dashboard → Workers & Pages
   - Vyber worker `sachyjablonec-proxy`
   - Triggers → Add Route (viz výše)

---

## Testování

### 1. Test Health Check
```bash
curl https://sachyjablonec-production.up.railway.app/health
```
Mělo by vrátit:
```json
{"status":"ok","timestamp":"2024-12-09T..."}
```

### 2. Test Worker
Po nasazení:
```bash
curl -I https://sachyjablonec.cz
```

### 3. Simulace výpadku
V Railway dočasně zastav službu a zkontroluj že se zobrazí maintenance page.

---

## Konfigurace

### Změna timeout pro health check
V `worker.js` řádek 12:
```javascript
const HEALTH_CHECK_TIMEOUT = 5000; // 5 sekund
```

### Vlastní maintenance HTML
Můžeš upravit `MAINTENANCE_HTML` v `worker.js` (řádek 16-62) nebo načítat z externího zdroje.

---

## Monitoring

### Cloudflare Analytics
- Dashboard → Workers & Pages → tvůj worker
- Metrics tab - vidíš:
  - Počet requestů
  - Chyby
  - CPU time

### Logy
V Worker editoru klikni **Logs** pro real-time debugging.

---

## Troubleshooting

### Worker vrací 503 i když Railway běží
- Zkontroluj že Railway URL je správná
- Zkontroluj že `/health` endpoint funguje
- Zvyš `HEALTH_CHECK_TIMEOUT`

### CORS chyby
Worker automaticky přidává CORS headers, ale pokud potřebuješ specifické:
```javascript
modifiedResponse.headers.set('Access-Control-Allow-Origin', 'https://sachyjablonec.cz');
```

### Worker se nenasazuje
- Zkontroluj že máš správné zone_name v `wrangler.toml`
- Zkontroluj že doména je aktivní v Cloudflare

---

## Best Practices

✅ **Testuj před nasazením** - zkontroluj health endpoint  
✅ **Monitoruj logy** - sleduj Cloudflare analytics  
✅ **Verzuj změny** - commituj změny v worker.js  
✅ **Backup** - ulož původní DNS nastavení před změnou routes  

❌ **Neměň** Railway URL bez aktualizace worker kódu  
❌ **Nezapomeň** přidat health endpoint do Express  
❌ **Neodstraňuj** maintenance.html z projektu  

---

## Rollback

Pokud něco nefunguje:

1. **Odstranit Routes**
   - Cloudflare Dashboard → Workers → Triggers
   - Smaž routes pro sachyjablonec.cz

2. **Smazat Worker**
   - Workers & Pages → tvůj worker → Settings → Delete

DNS se vrátí na původní nastavení (přímé směrování na Railway).
