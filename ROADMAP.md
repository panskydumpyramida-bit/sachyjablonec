¨# Roadmap – Šachy Jablonec

> **Poslední aktualizace:** 25. 12. 2025

Plán budoucího vývoje webu [sachyjablonec.cz](https://www.sachyjablonec.cz).

---

## 📋 Obsah

1. [Aktuální práce](#-aktuální-práce)
2. [Plánované funkce](#-plánované-funkce)
3. [Technický dluh](#-technický-dluh)
4. [Backlog](#-backlog)
5. [Testování](#-testování)
6. [Dokončeno](#-dokončeno)
7. [Technické poznámky](#-technické-poznámky)

---

## 🚀 Aktuální práce

> Právě rozpracované úkoly s vysokou prioritou.

| Úkol | Stav | Poznámka |
|------|------|----------|
| Kalendář událostí | ✅ Hotovo | Backend + Admin + Frontend implementováno |
| Členská sekce – rozšíření | 🟡 Plánováno | Dokumenty, fórum, interní oznámení |
| Admin panel – redesign | 🟡 Plánováno | Modularizace, dashboard, lepší UX |
| Email služba (reset hesla) | 🔴 Blokováno | Čeká na výběr poskytovatele |

---

## 📌 Plánované funkce

### ✅ Priorita 1: Kalendář událostí (HOTOVO)
> Implementováno 25. 12. 2025

- [x] **Veřejný kalendář** – turnaje, zápasy, akce oddílu
- [x] **Interní kalendář** – tréninky, schůze (pouze MEMBER+)
- [x] Export do Google Calendar (iCal)
- [x] Filtry podle kategorie (mládež/dospělí) a typu (turnaj/trénink)
- [x] Admin CRUD pro správu událostí


### Priorita 2: Rozšíření členské sekce 🆕
> Inspirace: NSS.cz Klub, Chess.com club features

- [ ] **Interní oznámení** – důležité zprávy pro členy
- [ ] **Dokumenty** – zápisy ze schůzí, stanovy, formuláře
- [ ] **Diskuzní fórum** – místo pro interní diskuze
- [ ] Sekce "Turnaje a Akce" (neveřejné propozice, termíny)

### Priorita 3: Admin panel – redesign 🆕
> Řešení bottlenecku: `admin-news.js` (78 KB)

- [ ] **Dashboard** – přehled klíčových metrik na úvodní stránce
- [ ] **Sidebar navigace** – místo tabů pro lepší orientaci
- [ ] **Rychlé akce** – frequently used actions na jeden klik
- [ ] Modularizace `admin-news.js` do menších souborů
- [ ] Odstranit veškerý inline JavaScript z `admin.html`

### Priorita 4: Email služba
> Integrace emailového poskytovatele pro notifikace a reset hesla.

- [ ] Integrace poskytovatele (SendGrid / Resend / Mailgun)
- [ ] "Zapomenuté heslo" – reset link přes email
- [ ] Volitelné email notifikace (nový komentář, odpověď)

### Priorita 5: Game Viewer
> Zlepšení responsivity prohlížeče šachových partií.

- [x] Základní CSS úpravy pro menší přetékání
- [ ] Plně responsivní šachovnice v článcích
- [ ] Vlastní PGN parser jako alternativa k Chess.com iframe
- [ ] **🐛 BUG (střední priorita):** Animace figurek nefungují v `article.html`, přestože v `teams.html` fungují správně. Možné příčiny: rozdílné pořadí načítání skriptů, `defer` atribut, nebo timing inicializace `GameViewer2.create()`. Vyžaduje hlubší debugging.

---

## 🔧 Technický dluh

> Identifikované bottlenecks vyžadující refaktoring.

### Vysoká priorita

| Problém | Soubor | Detail |
|---------|--------|--------|
| ~~Monolitický server~~ | `src/server.js` | ✅ Sníženo z 1546 → 667 řádků (-57%) |
| Obří admin modul | `js/admin/admin-news.js` | 43 KB (1163 řádků) - částečně refaktorováno |
| ~~Inline CSS/JS~~ | `admin.html` | ✅ Sníženo z 1720 → 1455 řádků, CSS extrahováno |
| Žádné testy | – | Riziko regrese |

### Plánované řešení

- [x] Rozdělit `server.js` do modulů:
  - ✅ `src/services/scrapingService.js` (~300 řádků)
  - ✅ `src/services/standingsService.js` (~200 řádků)
- [ ] Centralizovat helper funkce
- [x] ~~Přesunout seeding do `src/utils/seed.js`~~ → Přidány exporty do existujícího souboru
- [x] ~~Sjednotit `game-viewer.js` a `game-viewer2.js`~~ → `game-viewer.js` označen jako deprecated (nepoužívaný)



---

## 📝 Backlog

> Nižší priorita, bude řešeno později.

### Funkce
- [ ] Mobilní verze admin panelu
- [ ] Notifikace o nových komentářích (in-app)
- [ ] Fulltextové hledání v partiích
- [ ] Fulltextové hledání v článcích
- [ ] ELO tracker – sledování vývoje ELO hráčů

### Technické
- [ ] Rate limiting na Lichess API proxy
- [ ] Přesunout debug/test soubory do `/scripts`
- [ ] Opravit prázdný tab "Z článků" na stránce `/partie`
- [ ] TypeScript migrace (dlouhodobě)

---

## 🧪 Testování

> Plán pro ověření funkčnosti klíčových částí aplikace.

### Manuální testy
| Oblast | Co testovat | Stav |
|--------|-------------|------|
| Přihlášení | Login jménem/heslem, Google OAuth | ⬜ |
| Registrace | Nový uživatel, validace polí | ⬜ |
| Komentáře | Přidání, odpověď, moderace | ⬜ |
| Galerie | Upload, kategorizace, hromadné mazání | ⬜ |
| Články | CRUD v admin panelu, zobrazení na webu | ⬜ |
| Puzzle Racer | Vanilla a Thematic módy | ⬜ |
| Mobilní zobrazení | Responsivita hlavních stránek | ⬜ |

### Automatizované testy (plánováno)
- [ ] Setup test frameworku (Vitest nebo Jest)
- [ ] API testy – auth endpointy
- [ ] API testy – CRUD pro články a komentáře
- [ ] E2E testy – základní user flow (Playwright)

---

## ✅ Dokončeno

<details open>
<summary><strong>Prosinec 2025</strong></summary>

#### 27. 12. 2025 – Homepage & Kalendář
**Homepage**
- ✅ 3D rotující dlaždice pro rozpis zápasů (A/B/C/D)
- ✅ Obnovení 2x2 navigační mřížky (šachovnicový vzor)
- ✅ Zalomení nadpisu "TJ Bižuterie Jablonec" na dva řádky
- ✅ Tmavší dlaždice (dřevěný styl)
- ✅ Fixní widget prostor (bez poskakování)

**Kalendář zápasů**
- ✅ Refactoring JS do `js/calendar.js` (oprava Unexpected EOF)
- ✅ Deep linking – auto-scroll a zvýraznění zápasu
- ✅ Auto-expand detailu zápasu při deep linku
- ✅ Oprava escapování uvozovek v názvech týmů ("B", "C")
- ✅ "Volno" zápasy nejsou klikatelné
- ✅ Zmenšení tlačítka "Turnaje" pro mobilní zobrazení

**Soupisky**
- ✅ Přidána mapování pro mládežnické týmy (1. liga mládeže A, KPM)
- ✅ Oprava escapování pro správné zobrazení soupisek

#### 26. 12. 2025 – Admin & Blicák
- ✅ Admin panel – modularizace `admin-news.js`
- ✅ Blicák fotogalerie s paginací (WEBP)

#### 23. 12. 2025 – Opravy
- ✅ Google Account Linking
- ✅ Graceful shutdown serveru
- ✅ Cache busting (`?v=4`)
- ✅ Game Viewer sjednocení

#### 22. 12. 2025 – Auth & Komentáře
- ✅ Google OAuth 2.0 (Passport.js)
- ✅ Komentáře pod články (CRUD, odpovědi, moderace)
- ✅ Role MEMBER a účet nastavení
- ✅ RBAC middleware, rate limiting

</details>

<details>
<summary><strong>Starší změny</strong></summary>

#### 17. 12. 2025
- ✅ Mobilní optimalizace tabulek
- ✅ Stabilita serveru (timeout, trust proxy)

#### 12. 12. 2025
- ✅ Puzzle Racer admin nastavení
- ✅ Members Hub redesign
- ✅ Admin panel modularizace

</details>

---

## 🔧 Technické poznámky

<details>
<summary><strong>Railway Deployment</strong></summary>

### Konfigurace (`railway.toml`)
```toml
[build]
buildCommand = "npm install && npx prisma generate"

[deploy]
startCommand = "./start.sh"
healthcheckPath = "/health"
healthcheckTimeout = 200
```

### Pravidla pro Prisma migrace
1. `prisma generate` → v **build** fázi
2. `prisma migrate deploy` → v **start** fázi
3. ⚠️ NIKDY nedávat `prisma migrate deploy` do `buildCommand`

### Přidání nové tabulky
```bash
# 1. Přidat model do prisma/schema.prisma
# 2. Lokálně vytvořit migraci
npx prisma migrate dev --name nazev_migrace

# 3. Commitnout a pushnout
git add -f prisma/migrations/
git commit -m "feat: Add new table"
git push
```

</details>

<details>
<summary><strong>Konkurenční inspirace</strong></summary>

### NSS.cz
- Kalendář turnajů s filtry
- ELO tracker
- Akademie (tréninkové skupiny)
- Klub sekce pro členy

### Chess.com
- Role hierarchy (Coordinator → Admin → Super Admin)
- Club tournaments a Team Matches
- Diskuzní fóra a chat
- Audit log pro akce adminů

</details>

---

*Tento dokument je živý a bude průběžně aktualizován.*
