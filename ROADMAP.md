# Roadmap - Šachy Jablonec

Plán budoucího vývoje webu sachyjablonec.cz.

---

## 🚨 KRITICKÉ: Bezpečnostní opravy

**Tyto problémy by měly být vyřešeny co nejdříve.**

### Nalezené problémy

1. **`/api/auth/fix-admins` - Exposed bez autentizace**
   - Endpoint obsahuje hardcoded hesla (`sachy2025`)
   - Kdokoliv může vytvořit admin účty
   - **Řešení:** Odstranit nebo chránit auth middleware

2. **Registrace vytváří adminy automaticky**
   - `role: 'admin'` je default při registraci
   - **Řešení:** Změnit default na `'user'`, admin práva pouze přes superadmina

3. **Chybí role superadmin**
   - Všichni admini mají stejná práva
1.  **`/api/auth/fix-admins` - Exposed bez autentizace**
    -   Endpoint obsahuje hardcoded hesla (`sachy2025`)
    -   Kdokoliv může vytvořit admin účty
    -   **Řešení:** Odstranit nebo chránit auth middleware

2.  **Registrace vytváří adminy automaticky**
    -   `role: 'admin'` je default při registraci
    -   **Řešení:** Změnit default na `'user'`, admin práva pouze přes superadmina

3.  **Chybí role superadmin**
    -   Všichni admini mají stejná práva
    -   **Řešení:** Přidat hierarchii: `user` → `admin` → `superadmin`

4.  **Rate limiting**
    -   Žádná ochrana proti brute-force útokům na login
    -   **Řešení:** Přidat `express-rate-limit` na auth endpointy

### Plánované změny
- [x] Odstranit nebo zabezpečit `/fix-admins` endpoint
- [x] Změnit default role na `'user'`
- [x] Přidat role `superadmin` do DB schématu
- [x] Implementovat role-based access control (RBAC)
- [x] Přidat rate limiting na `/api/auth/*`
- [ ] Přidat rate limiting na Lichess API proxy

---

## 🧹 Priorita 0: Čištění kódu a Refaktoring

**Aktuální technický dluh a probíhající práce na architektuře.**

### Admin Panel Modularizace (Probíhá)
Refaktoring monolitického `admin.html` (3800+ řádků) na JS moduly.
- [x] **Fáze 1:** Extrakce, nezávislých modulů
  - Vytvořena struktura `js/admin/`
  - Hotové moduly: `admin-gallery.js`, `admin-members.js`, `admin-messages.js`
  - Odstraněno ~400 řádků legacy kódu
- [x] **Fáze 2:** Migrace hlavních komponent
  - [x] News Editor (`admin-news.js`)
  - [x] Competitions & Standings (`admin-competitions.js`)
- [ ] **Fáze 3:** Shared Core & Cleanup
  - [ ] Plná migrace `admin-core.js` (auth, routing)
  - [ ] Odstranění veškerého JS z `admin.html`

### Backend Refaktoring
- [ ] Rozdělit `server.js` (1470 řádků) do modulů:
  - `src/services/scrapingService.js`
  - `src/services/standingsService.js`
  - `src/utils/helpers.js`
- [ ] Přesunout debug/test soubory do `/scripts` nebo odstranit
- [ ] Centralizovat helper funkce

---

## 🎯 Priorita 1: Refaktoring ukládání partií

**Cíl:** Změnit způsob ukládání šachových partií tak, aby je bylo možné používat napříč všemi sekcemi webu.

### Plánované změny
- [ ] Nový nezávislý model `Game`:
  ```prisma
  model Game {
    id          Int      @id
    pgn         String   // PGN zápis
    whitePlayer String
    blackPlayer String
    result      String   // "1-0", "0-1", "1/2-1/2"
    event       String?  // Turnaj/soutěž
    date        DateTime?
    tags        String[] // Pro filtrování
  }
  ```
- [ ] Vazební tabulky pro přiřazení partií k entitám
- [ ] API endpoint `/api/games` pro CRUD operace
- [ ] Univerzální přehrávač partií
- [ ] Import PGN souborů do centrální databáze

---

## ✅ Priorita 2: Puzzle Racer - Admin nastavení (HOTOVO)

**Implementováno 12. 12. 2025:**
- [x] Databázový model `PuzzleRacerSettings`
- [x] Admin UI formulář s nastavením (téma, čas, životy, penalizace, přeskakování)
- [x] API endpoint GET/PUT `/api/racer/settings`
- [x] Dva herní módy: Vanilla (fixní nastavení) a Thematic (z admin panelu)

---

## ✅ Priorita 3: Mobilní optimalizace (HOTOVO)

### Vyřešené problémy (17. 12. 2025)
- [x] Audit stránek youth.html a teams.html na mobilu
- [x] Oprava tabulek standings - plná šířka na mobilu
- [x] Odstranění `display: block` z tabulek v CSS
- [x] Sjednocení paddingů v tabulkách
- [x] Opraven RBAC v admin panelu (case-insensitive role check)
- [x] Opraveno načítání tabů pro SUPERADMIN

### Budoucí funkce (Backlog)
- [ ] Mobilní verze admin panelu (nebo alespoň čtení)
- [ ] **Diskuzní fórum pod články**
  - **Fáze 1:** Anonymní příspěvky (s moderací)
  - **Fáze 2:** Přihlášení uživatelů a pokročilá správa (vyžaduje auth systém)

---

## ✅ Dokončeno (11. 12. 2025)

### Členská sekce (Members Hub)
- [x] **Nový Design:** Implementován 2x2 grid "hub" pro lepší navigaci na mobilech i desktopu.
- [x] **Galerie:** Přidána možnost nahrávat fotky přímo z členské sekce.
- [x] **Opravy UI:** Opravena chybějící ikona u Puzzle Racer dlaždice (`fa-puzzle-piece`).
- [x] **Konzistence:** Sjednocen vzhled sekcí (tlačítka zpět, hlavičky).

### Admin Panel & Systém
- [x] **News Editor Refaktoring:** Kompletní extrakce editoru novinek do modulu `js/admin/admin-news.js`.
- [x] **Hromadné Mazání:** Implementováno hromadné mazání obrázků v galerii.
- [x] **Modularizace:** Vytvořeny moduly `admin-gallery.js`, `admin-members.js`, `admin-messages.js`.
- [x] **Gallery Picker:** Modální okno pro výběr obrázků z galerie (použito v Editoru i Members).
- [x] **API Auth:** Sjednocena autentizace (`X-Club-Password` i `Bearer Token` pro API obrázků).
- [x] **Cleanup:** Odstraněno cca 1000+ řádků legacy kódu z admin.html.

### Puzzle Racer (Ranní update)
- [x] Oprava logiky (načítání bufferu, čekací stavy)
- [x] Indikátor obtížnosti v UI
- [x] Oprava načítání žebříčku

### Editor Partií (Ranní update)
- [x] Responzivní design pro mobily
- [x] Export partie do PGN
- [x] Načítání partie přes URL ID
- [x] **Click-to-Move** ovládání a nápověda tahů
- [x] **Touch optimalizace**

---

## 🚀 Railway Deployment Notes

### Důležité informace o Railway + Prisma

**Konfigurace:** `railway.toml`
```toml
[build]
buildCommand = "npm install && npx prisma generate"

[deploy]
startCommand = "./start.sh" # Custom script handling migrations
healthcheckPath = "/health"
healthcheckTimeout = 200
restartPolicyType = "on_failure"
```

### Pravidla pro Prisma migrace na Railway:

1. **`prisma generate`** → v **build** fázi (OK, nepotřebuje DB)
2. **`prisma migrate deploy`** → v **start** fázi (potřebuje DATABASE_URL, který je dostupný až za běhu!)
3. **NIKDY** nedávat `prisma migrate deploy` do `buildCommand` - DATABASE_URL není dostupný během buildu
4. Railway používá **Railpack** (ne nixpacks) - konfigurace přes `railway.toml`, ne `nixpacks.toml`

### Jak přidat novou tabulku:

1. Přidat model do `prisma/schema.prisma`
2. Lokálně: `npx prisma migrate dev --name nazev_migrace`
3. Commit a push: `git add -f prisma/migrations/ && git commit -m "..." && git push`
4. Railway automaticky při startu spustí `prisma migrate deploy`

---

## ✅ Dokončeno (17. 12. 2025)

### Stabilita serveru
- [x] Přidán 30s timeout na fetch požadavky scraperu
- [x] Přidán `trust proxy` pro správné rate-limiting za Railway proxy
- [x] Opraven startup scraping s ochranou proti timeoutům

### Mobilní tabulky
- [x] Odstranění `display: block` z CSS tabulek
- [x] Sjednocení paddingů v th/td na 0.4rem
- [x] Oprava `width: 100%` pro standings tabulky

### Admin Panel
- [x] Opraveny duplicitní script tagy v admin.html
- [x] Opravena case-insensitive kontrola rolí
- [x] Obnovené CSS pro `.highlight-name` a `.highlight-score`

---

*Poslední aktualizace: 17. 12. 2025 (09:15)*
