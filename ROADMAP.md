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
   - **Řešení:** Přidat hierarchii: `user` → `admin` → `superadmin`

4. **Rate limiting**
   - Žádná ochrana proti brute-force útokům na login
   - **Řešení:** Přidat `express-rate-limit` na auth endpointy

### Plánované změny
- [x] Odstranit nebo zabezpečit `/fix-admins` endpoint
- [x] Změnit default role na `'user'`
- [ ] Přidat role `superadmin` do DB schématu
- [ ] Implementovat role-based access control (RBAC)
- [x] Přidat rate limiting na `/api/auth/*`
- [ ] Přidat rate limiting na Lichess API proxy

---

## 🧹 Priorita 0: Čištění kódu

**Aktuální technický dluh, který zpomaluje další vývoj.**

### Nalezené problémy

1. **`server.js` má 1470 řádků**
   - Obsahuje scraping logiku, API routes, helpers
   - Obtížná údržba a testování

2. **Debug/test soubory v produkci**
   - `debug-scraper.js`, `debug-scraping.js`, `test-*.js`
   - `debug_*.html`, `dump_html.js`
   - Potenciální bezpečnostní riziko

3. **Duplicitní helper funkce**
   - `clean()`, `simplify()`, `isMatch()` definovány vícekrát

### Plánované změny
- [ ] Rozdělit `server.js` do modulů:
  - `src/services/scrapingService.js`
  - `src/services/standingsService.js`
  - `src/utils/helpers.js`
- [ ] Přesunout debug/test soubory do `/scripts` nebo odstranit
- [ ] Přidat `.gitignore` pravidla pro debug soubory
- [ ] Centralizovat helper funkce

---

## 🎯 Priorita 1: Refaktoring ukládání partií

**Cíl:** Změnit způsob ukládání šachových partií tak, aby je bylo možné používat napříč všemi sekcemi webu.

### Současný stav
- Model `Game` je vázaný na `MatchReport` (přes `reportId`)
- Partie nelze sdílet mezi sekcemi (mládež, družstva, novinky)
- Duplicita při zobrazení stejné partie na více místech

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
- [ ] Tagování a vyhledávání partií

---

## 🎮 Priorita 2: Puzzle Racer - Admin nastavení

**Cíl:** Umožnit superadminovi konfigurovat parametry hry.

### Plánované změny
- [ ] Databázový model `PuzzleRacerSettings`
- [ ] Admin UI formulář:
  - Počet puzzlů na úroveň obtížnosti (default: 6)
  - Počet puzzlů na fetch (default: 3)
  - Zapnutí/vypnutí systému životů
  - Penalizace za špatný tah (sekund)
  - Časový limit hry (default: 180s)
- [ ] API endpoint GET/PUT `/api/admin/puzzle-racer/settings`
- [ ] Frontend: načítat nastavení z API místo hardcoded hodnot

---

## 🖥️ Priorita 3: Přehrávač partií - Vylepšení

**Cíl:** Modernizovat a rozšířit funkcionalitu přehrávače.

### Plánované změny
- [ ] Responzivní design pro mobily
- [ ] Klávesové zkratky pro navigaci (← → šipky)
- [ ] Zobrazení hodnocení motorů (engine evaluation)
- [ ] Export partie do PGN formátu
- [ ] Podpora komentářů k tahům
- [ ] Podpora variant (odbočky v analýze)

---

## 📱 Priorita 4: Mobilní optimalizace

### Nalezené problémy
- Některé stránky nejsou plně responzivní
- Admin panel není použitelný na mobilu
- Kalkulačka/tabulky se špatně renderují na malých obrazovkách

### Plánované změny
- [ ] Audit všech stránek na mobilu (< 768px)
- [ ] Oprava kritických UI problémů
- [ ] Mobilní verze admin panelu (nebo alespoň čtení)
- [ ] Touch-friendly ovládací prvky

---

## 🔄 Priorita 5: Automatizace a CI/CD

### Plánované změny
- [ ] Automatické testy (Jest/Vitest)
- [ ] GitHub Actions pro CI/CD
- [ ] Automatické aktualizace standings (cron job)
- [ ] Monitorování chyb (Sentry nebo podobné)
- [ ] Automatické zálohování databáze

---

## ✅ Dokončeno (11. 12. 2025)

### Puzzle Racer
- [x] Oprava logiky (načítání bufferu, čekací stavy)
- [x] Indikátor obtížnosti v UI
- [x] Oprava načítání žebříčku

### Editor Partií
- [x] Responzivní design pro mobily (výška sidebaru)
- [x] Export partie do PGN (tlačítka pro stažení/kopírování)
- [x] Načítání partie přes URL ID (`?id=123`)
- [x] Zabezpečené stahování (auth fallback)

### Systém
- [x] Oprava `ReferenceError` v `server.js` (racer routes)
- [x] CORS povolení pro `X-Club-Password`
- [x] Docker build optimalizace (`.dockerignore`)

---

## 📊 Další návrhy

### Admin panel
- [ ] Dashboard s metrikami (návštěvnost, aktivita)
- [ ] Log změn (audit trail)
- [ ] Bulk operace (mazání, publikování)

### Uživatelská zkušenost
- [ ] Dark/Light mode přepínač
- [ ] Notifikace o nových článcích
- [ ] RSS feed pro novinky

### Výkon
- [ ] Lazy loading obrázků
- [ ] Caching API odpovědí
- [ ] CDN pro statické soubory

---

*Poslední aktualizace: 11. 12. 2025*
