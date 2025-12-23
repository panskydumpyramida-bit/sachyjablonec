# Roadmap - Šachy Jablonec

Plán budoucího vývoje webu sachyjablonec.cz.

*Poslední aktualizace: 22. 12. 2025*

---

## ✅ Dokončeno (22. 12. 2025)

### Google OAuth Přihlášení
- [x] Passport.js konfigurace s Google OAuth 2.0
- [x] Backend OAuth routes (`/api/auth/google`, callback, set-username)
- [x] Frontend tlačítko "Přihlásit přes Google" v login modalu
- [x] Username setup modal pro nové Google uživatele
- [x] Propojení existujících účtů s Google

### Uživatelský Systém
- [x] Nová role MEMBER (hierarchie: USER < MEMBER < ADMIN < SUPERADMIN)
- [x] Stránka nastavení účtu (`/account.html`)
- [x] Editovatelná pole: jméno, oddíl
- [x] Přepínátko pro zobrazení jména/přezdívky v komentářích
- [x] Role badges v user menu (Superadmin, Admin, Člen)
- [x] User dropdown menu: Nastavení účtu, Členská sekce, Administrace

### Komentáře pod články
- [x] Databázový model Comment s vnořenými odpověďmi
- [x] CRUD API endpoints s autentizací
- [x] Dark theme UI inspirovaný chess.cz
- [x] Odpovídání na komentáře (neomezená hloubka)
- [x] Moderace (skrytí komentářů)

### Auth na všech stránkách
- [x] Dynamické načítání auth.js přes layout-loader.js
- [x] User menu funkční na všech stránkách

---

## 🔧 V Práci / Plánováno

### Priorita 1: Email Služba
> **Blokováno:** Potřebujeme nastavit email službu (SendGrid, Resend, apod.)

- [ ] Integrace email poskytovatele
- [ ] "Zapomenuté heslo" - reset link přes email
- [ ] Email notifikace (volitelné)

### Priorita 2: Game Viewer Responsivita
- [x] Základní CSS úpravy pro menší přetékání
- [ ] Plně responsivní šachovnice v článcích
- [ ] Chess.com iframe alternativa s vlastním parserem

### Priorita 3: Backend Refaktoring
- [ ] Rozdělit `server.js` (1470+ řádků) do modulů:
  - `src/services/scrapingService.js`
  - `src/services/standingsService.js`
- [ ] Centralizovat helper funkce

### Priorita 4: Admin Panel Dokončení
- [ ] Plná migrace `admin-core.js` (auth, routing)
- [ ] Odstranění veškerého inline JS z `admin.html`

---

## 🔒 Bezpečnost (Vyřešeno)

- [x] Endpoint `/api/auth/fix-admins` odstraněn/zabezpečen
- [x] Default role změněna na `USER`
- [x] Role hierarchie: USER < MEMBER < ADMIN < SUPERADMIN
- [x] RBAC middleware implementován
- [x] Rate limiting na auth endpointy

---

## 📝 Backlog (Nízká Priorita)

### Funkce
- [ ] Mobilní verze admin panelu
- [ ] Změna hesla v nastavení účtu
- [ ] Notifikace o nových komentářích
- [ ] Hledání v partiích

### Technické
- [ ] Rate limiting na Lichess API proxy
- [ ] Přesunout debug/test soubory do `/scripts`
- [ ] Stránka `/partie` - tab "Z článků" prázdný (migrace gamesJson)

---

## 🚀 Railway Deployment

### Konfigurace
```toml
[build]
buildCommand = "npm install && npx prisma generate"

[deploy]
startCommand = "./start.sh"
healthcheckPath = "/health"
healthcheckTimeout = 200
```

### Pravidla pro Prisma migrace:
1. `prisma generate` → v **build** fázi
2. `prisma migrate deploy` → v **start** fázi
3. NIKDY nedávat `prisma migrate deploy` do `buildCommand`

### Přidání nové tabulky:
1. Přidat model do `prisma/schema.prisma`
2. Lokálně: `npx prisma migrate dev --name nazev`
3. Push: `git add -f prisma/migrations/ && git commit && git push`

---

## 🗓️ Historie změn

### 22. 12. 2025
- Google OAuth přihlášení
- Uživatelský profil (jméno, oddíl, přepínátko zobrazení)
- MEMBER role
- Komentáře pod články
- Auth na všech stránkách

### 17. 12. 2025
- Mobilní optimalizace tabulek
- Stabilita serveru (timeout, trust proxy)

### 12. 12. 2025
- Puzzle Racer admin nastavení
- Members Hub redesign
- Admin panel modularizace
