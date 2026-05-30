# 📋 Changelog

## 30. května 2026 (v36)

### ♟️ Vyčištění hlavičky přehrávače partií
- **Hlavička bez přetékání:** Z hlavičky Game Vieweru 2 zmizel dlouhý podtitul s názvem turnaje, který natahoval prostřední sloupec a přeléval layout. Hlavička drží kompaktní mřížku bílý · výsledek · černý.
- **Konec duplicit:** Boční panel už neopakuje jména hráčů a výsledek (jsou v hlavičce). Zůstal jen jeden řádek s turnajem, kolem a datem.
- **Pryč s nesmyslným skóre:** U seznamu partií zmizel chip „X : Y skóre" — sčítal výhry bílých přes nesouvisející partie, což u sady různých partií nedávalo smysl.
- **Vycentrovaná hlavička:** Bílý · výsledek · černý se seskupují doprostřed jako banner místo roztažení do krajů, takže se layout nerozpadá v mezilehlých šířkách a dlouhá jména se plynule zkracují.
- **Čistší pozadí hlavičky:** Z hlavičky zmizel tmavý gradientový pruh, který tvořil viditelný šev proti šachovnici.
- **Konec duplicit u variant:** Při přehrávání odbočky už spodní posuvník neopakuje celou větu „po … · tah varianty: …" — ukazuje jen aktuální tah, plný kontext zůstává v pruhu nad šachovnicí.

---

## 28. května 2026 (v35)

### ♟️ Game Viewer 2 a výsledky v článcích
- **Nový skin přehrávače:** Do Game Vieweru 2 byl přidán nový kompaktnější skin podle prototypu z `Downloads/Sachy animace`. Je zapnutý jako výchozí pro veřejné přehrávače partií.
- **Rollback v adminu:** V Nastavení je přepínač **Skin přehrávače partií** s volbami Nový skin / Klasický skin. Klasická volba vrací původní vzhled bez zásahu do článků.
- **Figurky:** Přehrávač zůstává na čitelných PNG figurkách z lokálního Wikipedia setu místo prototypových glyphů.
- **Responzivita:** Nový skin zmenšuje mezery na mobilu, zahušťuje ovládání a drží výběr variant přímo u šachovnice.
- **Mini partie v textu:** WYSIWYG umí vložit jednu PGN partii přímo doprostřed článku jako kompaktní interaktivní přehrávač se šachovnicí, tahy a komentáři.
- **Mini partie jako výstřižek:** Inline přehrávač má nově posuvník pro rychlé projetí partie, vypnuté krajní ovladače a komentář aktuálního tahu nad notací.
- **Mobilní ovládání:** V plném i inline přehrávači lze na šachovnici swipnout doleva/doprava pro další nebo předchozí tah bez zásahu do scrollování článku.
- **Scrubber v plném vieweru:** Game Viewer 2 má pod ovládáním posuvník pro rychlý skok na libovolný tah hlavní linie.
- **Redesign zápasového vieweru:** Moderní skin dostal hráčskou hlavičku ve stylu prototypu, spodní komentářový pruh a přehlednější karty partií pro zápasy o více deskách.
- **Subvarianty:** Viewer rozlišuje hlavní linii, varianty a vnořené subvarianty; modal už nenabízí tahy o úroveň níže.
- **CH-R tabulky:** Editor umí k tabulce z Chess-Results přidat žluté tlačítko „🔗 Kompletní výsledky".

---

## 24. dubna 2026 (v34)

### 🛠️ Admin UX: mobilní editor a sidebar layout
- **Layout admin sekcí:** Všechny view mimo `.admin-container` se nově řídí stejným odsazením jako dashboard/editor, takže na desktopu neleží pod levým sidebar menu a reagují i na sbalený sidebar.
- **Mobilní publikace:** Publikační karta v editoru je na telefonu dostupná jako spodní sheet přes tlačítko Publikace; Uložit/Zrušit je tím zpět v publikačním kontextu.
- **Toolbar článku:** Nejčastější akce zůstávají viditelné v základním řádku, pokročilé nástroje jsou v druhém scrollovatelném řádku „Další nástroje”.
- **Kompaktní panely:** Tlačítka v panelech Partií/Galerie se na mobilu neroztahují zbytečně přes celou šířku.
- **Cache bust:** Navýšené query verze admin CSS/JS pro spolehlivé načtení změn po deployi.

---

## 24. dubna 2026 (v33)

### 🎨 Hero redesign (úvodní stránka + O nás)
- **Nový hero v `index.html`:** Varianta "Partie" z prototypu — animovaná šachovnice s Caro-Kann miniaturou (1.e4 c6 až 6.Nd6#), lineRise animace titulku "Šachový oddíl TJ Bižuterie Jablonec nad Nisou", CTA tlačítka a subtitle.
- **Vanilla implementace:** React+Babel prototyp převeden na čistý HTML/CSS/JS — žádný framework v produkci. Nové soubory `css/hero-v2.css` a `js/hero-v2.js`.
- **Dynamické PGN:** Admin může nastavit vlastní PGN partie pro hero animaci přes nastavení webu (výchozí fallback = Caro-Kann miniatura).
- **Figurky přes FontAwesome:** Unicode chess glyphy nahrazeny FA ikonami (`fa-chess-pawn/knight/bishop/rook/queen/king`) — uniform velikost napříč iOS/Android/desktop (Unicode rendering se lišil per-glyph).
- **About hero intro:** Stejný vizuální styl bez šachovnice (varianta `.hero-v2--about`). Titulek "Klub, kde se tradice potkává s novou generací", stats (70+ členů, 4 družstva, 50+ let tradice).
- **Tréninky opraveny:** Úterní řádek smazán, zbyl jen čtvrtek (16:00–17:30 mládež, 17:30–20:00 dospělí).
- **"Novinky" CTA:** Tlačítko "Rozpis zápasů" nahrazeno "Novinky" s anchor na `#news` (smooth scroll).

### 🕰️ Timeline klubu v about.html + admin správa
- **Reálné milníky:** 1991 Založení TJ Bižuterie, 2006 Přestěhování z věže Sokolovny, 2025 Postup do 1. ligy mládeže, 2030 (cíl) Postup do Extraligy ČR.
- **Budoucí cíl vizuálně odlišený:** Dashed border, transparent background, italic text (`.tl-item--future`). Gold linka timeliny končí před posledním milníkem — king stojí sám, visuálně oddělený od dokončené historie.
- **Admin sekce Timeline:** Nový tab v administraci s CRUD formulářem (rok, událost, ikona — šachová figurka / pohár / vlajka / hvězda, pořadí, checkbox "budoucí cíl").
- **API `/api/timeline`:** GET public, POST/PUT/DELETE pro ADMIN+. Prisma model `TimelineEntry`, migrace + seed počátečních 4 milníků.
- **Dynamický loader:** `js/timeline-loader.js` fetchuje z API a přepisuje `.tl-items` v about.html. Statické HTML slouží jako SSR fallback. XSS escaping na user-generated obsah.

### 🗺️ Stráž pod Ralskem + turnaje
- **Event Strážský rapid 2026:** Extrakce z PDF propozic, vloženo do DB přes `/api/events` (kat. rapid, 3. 5. 2026, KP ŠSLK).
- **Mapa turnajů:** Stráž pod Ralskem přidán do `cityToCoords` v `js/tournaments.js` (region LI) — turnaj se zobrazí na mapě v Libereckém kraji.

### 🛠️ Admin redesign (Claude Design handoff)
- **Sidebar místo horizontálních tabů:** Fixovaný levý panel 260px (desktop), seskupená navigace "Obsah / Komunita / Nástroje", footer s Nastavení a Odhlásit.
- **Sbalitelný sidebar:** Toggle tlačítko v topbaru (ikona outdent) + Ctrl+B / Cmd+B zkratka. Stav persistovaný v localStorage. Sbaleno = 64px icon-only s tooltipem.
- **Edge-tab chevron + footer collapse button:** Zlatý chevron na pravém okraji sidebaru + explicitní textové tlačítko "Sbalit menu · Ctrl+B" v patě.
- **First-run onboarding popover:** Ukáže se jednou při prvním otevření admina, vysvětluje collapse + Ctrl+B. Dismissnutelný tlačítkem nebo auto za 12s.
- **Mobile hamburger:** Off-canvas drawer s overlay, tap mimo zavírá.
- **Topbar s breadcrumbem:** Sticky pod globálním headerem — ukazuje aktivní sekci (Playfair font) + uživatele.
- **Dedupikace navigace:** Manuál / API / Web / Odhlásit odebrány z globálního headeru (byly duplicitní se sidebar footerem). Header teď jen logo + build info.

### 📊 Admin dashboard cleanup
- **Nastavení přesunuto ze dashboardu** do vlastního `#settingsView` (admin sidebar → Nastavení). Přesunuto: Nastavení webu (maintenance, info panel) + Nastavení titulní stránky (PGN animace partie).
- **Dashboard slim mode (`.is-slim`):** Quick actions v horizontálním stripu (desktop) / 2 sloupce wrap (mobile), activity feed collapsible kliknutím na titulek.
- **Quick actions rozšířené:** Přidáno tlačítko Timeline (přímý odkaz) a Nastavení místo duplicitního "Zobrazit web".
- **Mobile dashboard denser:** Stats cards 2 sloupce i pod 600px, overflow-x hidden jako safety net proti širokým tabulkám.
- **Články & přehled:** Sidebar "Články" teď jde na dashboard (tabulka článků), ne rovnou na blank WYSIWYG. Přejmenováno z "Přehled" → "Články & přehled".

### ✏️ WYSIWYG editor vylepšení
- **Chess-results promoted:** "Tabulka z chess-results" posunuta z Bloky dropdownu na top-level toolbar. Custom textový badge "CH-R" v zeleném outline boxu (fa-ranking-star neexistuje v FA 6.0.0 na CDN).
- **Modal chess-results s presety:**
  - **Počet hráčů:** 🥇 Vítěz / Top 3 / **Top 10** (default) / Všichni — naši hráči (match keyword "Bižuterie") jsou vždy zahrnuti navíc.
  - **Column picker:** Presety Kompaktní (Rk + Jméno + Body) / **Standardní** (+ Rtg + Klub + FED, default) / Plná (všechny sloupce) + ruční zaškrtnutí.
  - Re-render bez nové fetch při změně topN / sloupců / keyword.
  - Separator ⋯ mezi top N a našimi hráči pokud jsou skoky v pořadí.
- **Rendered tabulka responsivní:** Non-essential sloupce dostávají `class="hide-mobile"` → v publikovaném článku se na mobilu zbydou jen 3 sloupce (Rk + Jméno + Body).
- **Editor publish drawer responsive (3 stavy):**
  - ≥1400px: docked panel (default)
  - 1024–1399px: off-canvas drawer s "PUBLIKACE" rail na pravém okraji
  - <1024px: stackovaný pod obsahem
- **Toolbar compact na mobilu:** 22+ tlačítek vejde do ~4 řádků — icon-only přes `font-size: 0` na button + normal na `<i>`. Texty "Jméno/Skóre/Auto/AI/Tabulka/Bloky ▾" skryty.

### 🧪 Admin preview mode
- **`admin-preview.html`:** Read-only klon admina pro design review (Claude Design, externí designéři). Bypass auth (fake token + mocked fetch), PREVIEW banner nahoře, zamknuté form submity, noindex meta tag.
- **Mock data:** 5 ukázkových článků, 3 akce, 4 timeline milníky, dashboard stats, settings.

### 📱 Hotjar tracking
- Hotjar skript přidán do `js/layout-loader.js` (hjid 6694683). CSP whitelist rozšířen o `*.hotjar.com` / `*.hotjar.io` (script-src, connect-src včetně WebSocket, frame-src).

---

## 12. dubna 2026 (v32)

### 🔒 Bezpečnostní zpevnění
- **Helmet middleware:** Přidány bezpečnostní HTTP hlavičky (CSP, X-Frame-Options, HSTS, X-Content-Type-Options) s whitelistem povolených CDN zdrojů.
- **Oprava CORS:** Odstraněna duplicitní konfigurace CORS (`origin: true` nahrazeno `ALLOWED_ORIGINS` z env vars). Odstraněny duplicitní `express.json()` a `express.urlencoded()` middleware.
- **Sanitace vstupů (backend):** Nový `sanitize-html` modul. Komentáře, forum posty a zprávy se nyní sanitizují při ukládání do DB (`sanitizeUserContent()`).
- **Sanitace HTML (frontend):** Nová `sanitizeHtml()` utility v `utils.js` (DOMParser + whitelist tagů/atributů). Aplikováno na zobrazení článků (`article.html`, `news-loader.js`). Opravena chybějící escape na `item.excerpt`.
- **Hardcoded hesla:** Odstraněno plaintext heslo `sachy2025` ze `seed.js` — nahrazeno `process.env.SEED_PASSWORD` s fallbackem na náhodně generované heslo.
- **Rate limiting:** Globální API limiter (100 req/min) pro všechny `/api` endpointy.

### 🧪 Kvalita kódu
- **Testy:** Přidán Vitest + Supertest. 33 unit testů pro auth middleware, RBAC hierarchii a sanitizační funkce.
- **Linting:** Přidán ESLint (flat config) + Prettier pro backend i frontend. Scripty `lint`, `lint:fix`, `format`.
- **Race condition fix:** Auth inicializace přepsána z `3x setTimeout` na `CustomEvent('auth:ready')` — eliminuje blikání UI.

### ⚡ Performance
- **DB indexy:** Přidány chybějící indexy na `Comment` (newsId, authorId, parentId), `News` (isPublished+publishedDate, category) a `ForumPost` (topicId).
- **Batch zápis standings:** `standing.create` v cyklu nahrazen za `standing.createMany` — jedno SQL místo N.
- **Optimalizace obrázků:** Nový skript `scripts/optimize-images.mjs` (sharp) pro konverzi PNG→WebP + kompresi. Dry run: 30+ souborů, odhadovaná úspora ~70%.

### ♿ Přístupnost (A11y)
- **Keyboard navigace dropdown:** Menu nyní funguje s klávesnicí — Enter/Space otevře, ArrowDown/Up naviguje, Escape zavře. Přidány `aria-haspopup`, `aria-expanded` atributy. CSS `:focus-within` na `.dropdown`.
- **Kontrast textu:** `--text-muted` zvýšen z `#a0a0a0` (4.26:1) na `#b0b0b0` (5.57:1) — splňuje WCAG AA.
- **Smooth scroll:** Přidán `scroll-behavior: smooth` a `scroll-padding-top: 80px`.

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
