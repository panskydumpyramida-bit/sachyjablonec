# 📋 Changelog

## 1. dubna 2026 (v31)

### 🎯 Členská sekce: Blunder Grid
- **Nový tréninkový nástroj:** V členské sekci spuštěn **Blunder Grid**, inspirovaný funkcemi známými z Chess.com a Lichess. Jde o personalizovanou galerii hrubek (blunder) a promarněných šancí (miss) pocházejících přímo ze zápasů členů v lokální databázi.
- **Pokročilá evaluace:** Systém přešel ze zaměření na centipěšce na sledování **Pravděpodobnosti výhry (Win %)**, což efektivněji filtruje nevýznamné chyby v totálně prohraných/vyhraných pozicích a soustředí trénink jen na zlomy v partii.
- **Trénink vs. Galerie:** Dva režimy prohlížení. Trénink („Hádej tah“) pro aktivní řešení vlastních přehlédnutí s plnou kontrolou figur, nebo Galerie („Prohlížení chyb“) pro rychlou vizuální rekapitulaci osudných momentů před spaním s obřím ??.
- **Slider Threshold:** Možnost naživo posuvníkem odfiltrovat drobné chyby podle požadovaného prahu ztráty šance na výhru (např. >20%).
- **API Fallback:** Analytický backend v `generate-blunders.js` nyní používá jak cloudové statistiky Lichessu, tak bezchybný fallback na lokální Stockfish 17 (přes chess-api) s ohledem na API rate-limity.

## 27. března 2026 (v30)

### 📝 Editor Článků (WYSIWYG)
- **Bohaté HTML šablony:** Přidána podpora pro tři nové hotové bloky do článků: Zlatý box vítězů (`/vitezove`), Karty medailistů (`/karty`) a Závěrečné tlačítko s odkazem na výsledky (`/cta`).
- **Slash příkazy s modály:** Zefektivněn systém rychlého vkládání bloků přes lomítko. Šablony nyní otevírají konfigurační modály pro pohodlnější zadání obsahu (např. nadpisů, počtu řádků). Opravena logika spouštění (lomítko funguje pouze na novém řádku nebo po mezeře).
- **Nová tlačítka v liště:** Šablony lze vkládat i manuálně z nového rozbalovacího menu "Šablony" v panelu nástrojů editoru. Tlačítka dostala nové relevantní ikony.
- **Admin Manuál:** Aktualizován a doplněn `ADMIN_MANUAL.md` i webový `admin-manual.html` o nové funkce. Proklik na manuál přidán do hlavního navigačního menu administrace.

### ♟️ Zobrazování šachových partií
- **Zarovnání vložených fragmentů:** Opraven `margin` u inline fragmentů partií. Odstraněno nesymetrické horní odsazení, horní okraj šachovnice nyní perfektně navazuje na výšku okolního textu.


## 14. února 2026 (v16)

### 🎮 Game Viewer 2 – Oprava variant
- **Oprava navigace variant:** Kliknutí na variantní tah (vedlejší linie) nyní správně zobrazí pozici na šachovnici
- **Root cause:** `parentPly` se v `tokenizePgn()` ukládal příliš pozdě – variace odkazovaly na nesprávný bod v hlavní linii
- **Fix:** `parentPly` se nyní zachycuje v okamžiku parsování a obnovuje se před renderováním variace
- **Variační modál:** Opraveno zobrazení modálu výběru tahu na rozcestí při krokování vpřed

---

## 4. února 2026 (v25)

### 🏆 Soutěže jednotlivců – Nová sekce
- **Nová stránka:** `individual-competitions.html` pro přehled individuálních turnajů
- **Featured Tournament Banner:** Zvýrazněný turnaj v horní části stránky
- **Kategorie v Editoru:** Do admin editoru přidána kategorie "Soutěže jednotlivců"
- **Navigace:** Přidán odkaz "Soutěže jednotlivců" do hlavního menu
- **Propojení stránek:** Tlačítka pro přepínání mezi `tournaments.html` a `individual-competitions.html`

### ⭐ Featured Turnaje
- **Nový příznak `isFeatured`:** Možnost označit turnaj jako doporučený
- **Vizuální zvýraznění:** Featured turnaje mají zlatý okraj na stránce turnajů
- **Import PICF 2026:** Skript pro import Prague International Chess Festival (Masters, Challengers, Open)

### 🏠 Homepage – Redesign dlaždic zápasů
- **Nový layout:** Kompaktnější zobrazení s menšími fonty
- **Lepší čitelnost:** Úprava paddingu a velikostí pro lepší responsivitu
- **3D rotace:** Zachována animace rotujících dlaždic

### 🛠️ Administrace
- **Kategorie editoru:** Přidána možnost "Soutěže jednotlivců" v dropdown menu

### 🐛 Opravy
- **News Loader:** Opraveno načítání aktualit na stránce Soutěží jednotlivců (chybějící `news-loader.js`)
- **Deployment Script:** Vytvořen `scripts/deploy.sh` pro automatizaci nasazení

### 📦 Databáze
- **Migrace:** Přidán sloupec `is_featured` do tabulky `events`

---

## 22. ledna 2026 (v24)

### 🧩 Knihy diagramů – Velká aktualizace
- **Vlastní popisky:** U každého diagramu lze zadat text, který se zobrazuje pod šachovnicí
- **Grafické anotace:** Šipky a značky tahů (!, ?) se nyní zobrazují i v editoru
- **Panel řazení:** Vybraný seznam diagramů s možností měnit pořadí (↑↓)
- **Editace dvojklikem:** Dvojklik na knihu otevře modal pro správu obsahu

### 🛠️ Administrace & Editor
- **Klávesové zkratky:** `N` nový článek, `D` diagram, `?` nápověda
- **Tabulky zápasů:** Tlačítko 🏆 pro vkládání výsledkových tabulek
- **Admin Manuál:** Dokumentace v `/docs/ADMIN_MANUAL.md`
- **Plovoucí pozice:** Tlačítka pro zarovnání knihy (vlevo/střed/vpravo)

### 🐛 Opravy
- Chybějící navigační šipka (→) u knihy diagramů
- Indikace "Bílý/Černý na tahu" (nyní z FEN)
- Chybějící skripty na frontend (`article.html`, `index.html`)
- Bug "frame-in-frame" při opakované editaci knihy
- Odstraněny rušivé tooltipy
- **Rychlé kliky:** Lichess-style click handling - okamžitá odezva bez časových zpoždění

# Sat Jan 17 2026

### Game Viewer Enhancements & Stockfish Integration ♟️🤖
- **Oprava analýzy:** Opraveno formátování PV linie (česká notace, čísla tahů) a zobrazení analýzy i po tahu bílého.
- **Stockfish Integrace:** Přidána podpora pro Stockfish 17 analýzu v prohlížeči partií.
- **UI:** Redesign panelu analýzy (styl Lichess).
- **Stockfish Integration**: Added Stockfish 17 (NNUE) analysis to the game viewer via Chess-API.com REST API.
  - **Eval Bar**: Visual advantage indicator on the left side of the board.
  - **Analysis Panel**: Lichess-style 2-row layout showing:
    - Row 1: Evaluation (e.g., `+1.5`, `M3`), engine name, and analysis depth.
    - Row 2: Principal Variation (PV) showing the best continuation line (up to 6 moves).
  - **Toggle**: New microchip icon button to enable/disable analysis on demand.
- **Improved PGN Parser**: Switched from `pgn-parser` to `chess.js` for more robust PGN handling and multi-game support.
- **Autoplay Handling**: Improved autoplay logic for variations – now pauses with a 3-second countdown modal before auto-selecting the main line.
- **Animation Fixes**: Resolved chess piece "teleporting" issues and z-index conflicts (NAG markers now correctly overlay pieces).

# Sun Dec 29 2025

### Admin Panel UX Improvements
- **Auth Race Condition Fix**: Fixed timing issue where `currentUser` was null on page refresh, breaking author selection and user-dependent features.
- **Relaxed Validation**: Backend now only requires article title; category defaults to "Novinky", date defaults to today.
- **Safe Navigation**: Added unsaved changes modal when leaving editor with dirty state.
- **Auto-resize Textareas**: Title and excerpt fields now auto-expand as you type.
- **Image Editing**: Click images in content to edit (size, alt text, link).
- **Image Resizing Options**: 100%, 75%, 50%, 33%, 25% size presets in image modal.

### Smart Formatting ✨ (NEW)
- **Auto-Suggest Results**: When typing `1-0`, `0-1`, or `1/2`, a tooltip appears offering to format as highlighted score. Press Tab/Enter to accept.
- **Auto Button**: New "Auto" toolbar button that intelligently detects and formats selected text (names → blue, scores → green).
- **Result Template**: Insert pre-formatted result template "Bílý – Černý 1-0" via slash commands (coming soon).

### AI Integrace 🤖 (NEW)
- **AI Oprava pravopisu**: Nové tlačítko v editoru automaticky opraví překlepy a gramatiku v článku (využívá GPT-4o-mini).
- **AI Tabulky**: Tlačítko pro převod označeného textu na HTML tabulku.
- **Table Tools Widget**: Plovoucí panel nástrojů, který se objeví při kliknutí do tabulky. Umožňuje přidávat/mazat řádky a sloupce (`+R`, `-R`, `+C`, `-C`) a aplikovat prémiový styl (🎨).
- **Backend**: Implementovány endpointy `/api/ai/*` a integrace OpenAI API.

### Mobile Responsiveness
- **Scrollable Navigation**: Admin nav tabs now scroll horizontally instead of wrapping.
- **Card-based Tables**: News list converts to cards on mobile for better readability.
- **Editor Layout**: Sidebar stacks below content on mobile.
- **Mutual Menu Exclusion**: Fixed bug where both burger menus could be open simultaneously.

### Code Quality
- **Function Naming**: Renamed conflicting `loadUsers` functions to avoid global scope collision.
- **Global State**: Added `window.currentUser` for cross-module access.
- **Event System**: Added `authChecked` event for proper initialization timing.
- **Prepared Slash Commands**: Module ready for future activation (`admin-slash-commands.js`).

---

# Tue Dec 26 2025

- **Admin Panel Refactoring**: Reduced `admin-news.js` size by ~43%, moved WYSIWYG, Image, and Thumbnail logic to separate modules.
- **Blicák Gallery**: Added gallery for "Vánoční blicák" (ID 54) with 61 new photos (WEBP optimized) from David Šafařík.
- **Pagination**: Implemented pagination for article galleries to improve load times and UX.
- **Bug Fixes**: Resolved Admin Login overlay issue, Prisma image sync error, and Tournaments page links.
