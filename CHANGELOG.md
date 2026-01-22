# Thu Jan 22 2026

### Administrace & UX 🛠️
- **Klávesové zkratky:** Přidána podpora pro klávesové zkratky v admin editoru (`N` - nový článek, `D` - nový diagram, `?` - nápověda, `Ctrl+B/I/U` formátování).
- **Nápověda editoru:** Nový modal s přehledem všech zkratek a odkazem na manuál (ikona klávesnice v toolbaru).
- **Tabulky zápasů:** Nová funkce pro vkládání tabulky výsledků ze soutěží (tlačítko 🏆). Obsahuje možnost mazání a interaktivní zvýraznění řádků.
- **Editor Diagramů:** Přidána možnost vkládat značky tahů (!, ?, !? atd.) přímo do diagramu jako grafické anotace.
- **Knihy diagramů:** Nový panel pro **řazení diagramů** v editoru (drag & drop fronta).
- **Náhled:** Živý náhled diagramu v editoru včetně anotací a badges.
- **Popisky:** Pod diagramem v knize se nyní zobrazuje popisek (description) nebo název diagramu.
- **Admin Manuál:** Vytvořena kompletní dokumentace pro administrátory (`/docs/ADMIN_MANUAL.md`) přístupná z nápovědy.

### Diagramy & Editor 🧩
- **Vylepšená kniha diagramů:**
  - **Plovoucí pozice:** Přidána tlačítka pro zarovnání knihy (vlevo/střed/vpravo) s obtékáním textu.
  - **Rychlá editace:** Dvojklikem na knihu se otevře modal pro správu diagramů (přidání/odebrání/řazení).
  - **Vizuální styling:** Odznak hádanky (puzzle badge) nyní vyčnívá z šachovnice pro lepší viditelnost (z-index fix).
  - **Konzistence:** WYSIWYG editor nyní přesně odpovídá vzhledu na webu (šířka 400px, badge, barvy).
- **Oprava interakce:** Kliknutí na diagram v editoru již neotevírá editor obrázků, ale zobrazí toolbar diagramu.
- **Vylepšená tolerance tahu:** Implementována "Lichess-style" detekce (pixel threshold + time check), která zabraňuje nechtěnému odznačení figurky při mikro-posunu myší.

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
