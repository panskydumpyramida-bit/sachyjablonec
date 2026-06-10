# Mapa Extra funkcí a plán vylepšení — sachyjablonec

Klubový web Bižuterie Jablonec, ~50–70 členů vč. mládeže. Dokument mapuje stav „šachových" funkcí (menu Extra, členská sekce, admin), porovnává s velkými/výukovými weby a navrhuje TOP 10 kroků.

---

# 1. MAPA SOUČASNÉHO STAVU

## 1.1 Diagramy (editor, hádanky, knihy diagramů v článcích, viewer)

**Co dělá:** Člen v Editoru (`/game-recorder?mode=diagram`) sestaví pozici (paleta figur, FEN, rošády, strana na tahu), nakreslí anotace (šipky 4 barev, zvýrazněná pole, odznaky !/!!/?/??/!?/?!) a na tabu Hádanky nahraje vícetahové řešení (Správný/Alternativa/Chyba s komentáři). Admin pak ve WYSIWYG vloží do článku „knihu diagramů" — listovací karusel interaktivních šachovnic; čtenář řeší hádanky přímo v článku (zelený/modrý/červený feedback).

**Tok:** model `Diagram` (prisma/schema.prisma:540, `fen` + `annotations` Json + `solution` Json) → API `src/routes/api-diagrams.js` (CRUD, jen authMiddleware) → editor `js/diagram-editor.js` (SVG overlay nad chessboard.js, `saveDiagramToCloud`:1099) → WYSIWYG selektor `js/admin/admin-wysiwyg.js:907` vloží `<div class="diagram-book" data-diagrams='…'>` (snapshot dat) → v článku `article.html:331` `initDiagramBooks` vytvoří `DiagramViewer` (js/diagram-viewer.js:16, `attemptMove`:588 validuje proti solution).

**Hotovo:** editor pozice s validací legálnosti, kompletní anotace, hádankový solver s liniemi, uložení/update do DB, PNG export, WYSIWYG selektor s multi-select knihou a živým náhledem, atomic blok s edit modalem, plně interaktivní viewer v článku (drag i klik, listování, reset, responsive), admin správa, stránka training.html (funkční, ale osiřelá).

**Nedodělané:**

| Co | Závažnost | Kde |
|---|---|---|
| Přepnutí tabu Diagramy↔Hádanky volá `clearDiagram()` → smaže anotace/řešení a resetuje `currentDiagramId` → editace vytvoří duplikát místo update; workflow „postav pozici → nahraj řešení" je rozbitý | **blokuje** | game-recorder.html:1892, js/diagram-editor.js:217 |
| PUT/DELETE diagramů bez kontroly vlastnictví — libovolný přihlášený přepíše/smaže cizí | omezuje | src/routes/api-diagrams.js:84 |
| training.html nikam nelinkovaná, vyřešení se neukládá (žádný model progress) | omezuje | training.html, components/header.html:33 |
| Generátor článku „Úloha týdne" = placeholder alert (F2 chybí) — hlavní konzument pipeline | omezuje | js/admin/admin-weekly-puzzles.js:306 |
| `toMove` se neukládá → admin náhled i selektor ukazují vždy „Černý na tahu" | omezuje | js/admin/admin-wysiwyg.js:1312, js/admin/admin-games.js:351 |
| `initDiagramBooks()` se nevolá z news-loaderu → knihy na homepage (full content) neinteraktivní | omezuje | js/news-loader.js:322 |
| `take:50` bez stránkování — starší diagramy v UI nedosažitelné | omezuje | src/routes/api-diagrams.js:37 |
| PNG export čte stranu na tahu z partie místo `diagramTurn` | kosmetika | js/diagram-editor.js:689 |
| Viewer bez „ukázat řešení"/nápovědy; proměna natvrdo dáma; řešení čitelné ve zdrojáku | kosmetika | js/diagram-viewer.js:588 |
| Mrtvý kód (`executeMove`, `ensureMarkers`, deprecated modal), figury z CDN chessboardjs.com | kosmetika | js/diagram-viewer.js:708 |

## 1.2 Hádanky — Úloha týdne (admin) + Hádanka dne (homepage)

**Co dělá:** a) Admin tab „Úloha týdne": Stockfish projde partie z publikovaných článků, najde taktické kombinace (uniqueness gate, motivy z lichess-puzzler portu, skóre 0–100), admin hlasuje 👍/⭐/👎, slučuje duplicity a vybírá 3 úlohy — tlačítko „Vygenerovat článek" ale nic negeneruje. b) Hádanka dne: veřejná hero dlaždice na homepage otevře modal s interaktivní šachovnicí, návštěvník hledá první tah, listuje 13 dní zpět; admin může konkrétní hádanku připnout.

**Tok:** POST `/api/weekly-puzzles/scan` (src/routes/weekly-puzzles.js:63) → `runScan` (src/services/weeklyPuzzlesService.js:274) přes `stockfishEngine.js` (lokální binárka) → `findTacticsInGame` (service:188) → upsert `PuzzleCandidate` (schema.prisma:176) → hlasování `PuzzleVote` → veřejné GET `/daily` (`getDailyPuzzle` service:508, pool top 14, pin přes SystemSetting `daily_puzzle_pinned`) → modal `js/hero-tiles.js:110`.

**Hotovo:** sken na pozadí s progress pollingem, detekce kombinací s motivy/obtížností/SAN linií, inkrementální sken (`Game.puzzleScannedAt`), deduplikace s přesunem hlasů, hlasování v gridu, Hádanka dne s rotací/pinem/historií, homepage modal vč. mobilního scroll-locku.

**Nedodělané:**

| Co | Závažnost | Kde |
|---|---|---|
| Úloha týdne nemá ŽÁDNÝ veřejný/členský výstup — F2 generátor je alert, endpoint `/generate` neexistuje; výběr 3 úloh nikam nevede | **blokuje** | js/admin/admin-weekly-puzzles.js:305-311 |
| `dismissed` se nikde nezapisuje — admin nemůže špatnou hádanku vyřadit z rotace | omezuje | src/services/weeklyPuzzlesService.js:346 |
| Členské hlasování nedosažitelné (GET /candidates je ADMIN-only), source `solver` se nesbírá — žádná zpětná vazba od řešitelů | omezuje | src/routes/weekly-puzzles.js:38 |
| Sken závisí na lokální Stockfish binárce; scanState in-memory (restart = ztráta progresu) | omezuje | src/services/stockfishEngine.js:15 |
| `usedInNewsId` mrtvé pole; GET `/insights` bez konzumenta | kosmetika | src/services/weeklyPuzzlesService.js:384, src/routes/weekly-puzzles.js:53 |
| `/daily` posílá řešení v public JSON; rotace nestabilní (hlasy/scan změní „dnešní" úlohu uprostřed dne, nic se nepersistuje) | kosmetika | src/services/weeklyPuzzlesService.js:508-554 |
| Pin select jen z top 30 — pin mimo top 30 se tiše přepíše | kosmetika | js/admin/admin-home-tiles.js:121 |
| WEEKLY-PUZZLES-PLAN.md neodpovídá implementaci (hlavička stále „NÁVRH") | kosmetika | WEEKLY-PUZZLES-PLAN.md:3 |

## 1.3 Blunder Grid (blunder-grid.html, v5.0)

**Co dělá:** Vyhledání hráče z klubové PGN databáze (ŠSČR 2003–2025) → mřížka karet s pozicemi těsně před hrubkou. Trénink mód = hádej nejlepší tah (nápověda, Hráno/Řešení), Galerie = zahraná chyba s ?? badge, slider prahu Win%, tab Partie (stav analýzy, výběr ke skenu), tab Oblíbené. Sken jen MEMBER, limit 10 partií/den, „God Mode" easter egg ruší limit; čtení veřejné.

**Tok:** GET `/api/chess/players` → `selectPlayer()` → GET `/api/blunder/:playerName` (cache z `BlunderAnalysis`, schema.prisma:573) → sken POST `/scan` (src/routes/blunder.js:116) → `blunderService.js` `analyzeGame()`: depth 8 plošně → depth 14 na skoky, eval přes Lichess Cloud API + chess-api.com fallback (žádný lokální Stockfish), pravidlo `matchesBlunderRule` (24 unit testů).

**Hotovo:** autocomplete + deep-link `?player=`, server pipeline s DB cache a denním limitem, dvoustupňová evaluace s dual-source enginem, position-based pravidlo, trénink mód s drag&drop, tab Partie s per-game rescanem, featured flag, auth gating, god mode.

**Nedodělané:**

| Co | Závažnost | Kde |
|---|---|---|
| Miss detekce dvojnásobně rozbitá: obrácené znaménko (`probDrop <= -MISS_THRESHOLD` z perspektivy soupeře) + `fenBefore` o ply vedle → `bestMoveLAN` v uloženém FEN často nelegální, miss karty nejdou vyřešit | **blokuje** | src/services/blunderService.js:278-296 |
| Rescan neposílá Authorization u POST /scan → 401; adminovi se analýza smaže a nová nevznikne, UI lže „0 situací" | **blokuje** | js/blunder-grid.js:1227-1242 |
| Galerie volá neexistující `drawMoveArrow` → ReferenceError, ?? badge se při prvním renderu nevykreslí | omezuje | js/blunder-grid.js:887 |
| Slider thresholdu sám nic nedělá (#filter-btn je `display:none`) | omezuje | js/blunder-grid.js:82, blunder-grid.html:362 |
| Matové blundery se uloží s null evalem a pak navždy odfiltrují (nejcennější typ chyby) | omezuje | src/services/blunderService.js:268 vs 481 |
| Barva hráče exact-match vs. sken contains → částečné jméno otočí evaly | omezuje | src/services/blunderService.js:484 |
| Hvězdička pro všechny, endpoint ADMIN-only → tichý fail | omezuje | js/blunder-grid.js:1342, src/routes/blunder.js:167 |
| God mode = neomezený sken (~80+ requestů na 3. strany/partie) pro libovolného MEMBERa | omezuje | blunder-grid.html:343, src/services/blunderService.js:322 |
| Žádné ukládání postupu, hráč nesvázaný s účtem (User⇄ChessGame vazba chybí) | omezuje | js/blunder-grid.js:920, prisma/schema.prisma |
| Tab Oblíbené nestylovaný (`grid-card` neexistuje), CDN pieceTheme | kosmetika | js/blunder-grid.js:1311 |
| ~370 řádků mrtvého kódu (starý klientský skener, localStorage cache, generate-blunders.js) | kosmetika | js/blunder-grid.js:363-726 |
| Chybí v menu Extra; stránka bez společného headeru | kosmetika | components/header.html:33-41 |

## 1.4 Zbytek menu Extra + členská sekce + admin

**Co dělá:** Extra = Puzzle Racer (lichess puzzly na čas, žebříček, síň slávy), Partie (archiv + přehrávač), Databáze (ŠSČR partie, opening tree, Stockfish worker), Editor, Galerie. Members hub (Google OAuth) = Nástěnka, Kniha Přání, Galerie členů, Skener přihlášek, Blundercheck. Admin = 13 tabů.

**Hotovo:** všech 5 Extra položek funkčních; members hub s rolí gate; Nástěnka (oznámení/dokumenty/cesťáky/vzkazovník); Kniha Přání; skener; account.html; admin taby Přehled–Facebook vč. Úlohy týdne F1.

**Nedodělané:**

| Co | Závažnost | Kde |
|---|---|---|
| Admin tab „Členové" trvale skrytý (RBAC ho neodkrývá), přitom `loadMembers` funguje | omezuje | admin.html:133, js/admin/admin-members.js:8 |
| „Správa vzkazovníku" bez nav-tabu — jen přes URL hash | omezuje | admin.html:740 |
| Cesťáky: backend schvalování existuje, admin UI ne — podání věčně „Čeká na schválení" | omezuje | src/routes/api-travel-reports.js:15 |
| training.html osiřelá (viz 1.1) | omezuje | training.html |
| Fórum: kompletní backend + modely bez jediné stránky | kosmetika | src/routes/api-forum.js, schema.prisma:508 |
| member-games.html osiřelý duplikát Partií — kandidát na smazání | kosmetika | member-games.html |
| Členská galerie `slice(0,30)` bez paginace + zbylé TODO v error hlášce | kosmetika | js/member-gallery.js:24 |
| settingsView bez nav-tabu (jen quick-action) | kosmetika | admin.html:221 |
| Zastaralá roadmap karta „Kniha Přání" (už existuje, neoznačeno DONE) | kosmetika | admin.html:1610 |
| form-scanner.html veřejně přístupný (nekonzistence, ne riziko) | kosmetika | form-scanner.html:328 |

---

# 2. GAP ANALÝZA

Co mají chess.com / lichess / Chessable / ChessKid / ChessTempo / My-Chess a my ne. Seřazeno podle **(hodnota pro klub × malá náročnost)** — nahoře nejlepší poměr:

| # | Funkce (vzor) | Co nám chybí | Náročnost | Proč to pro nás sedí |
|---|---|---|---|---|
| 1 | **Persistence vyřešených úloh + streak** (chess.com Streaks, Chessable streak) | Hádanka dne, training.html i Blunder Grid po refreshi vše zapomenou. Žádný model `SolvedDiagram`/`BlunderSolve`. | malá | Jeden model + inkrement; infrastruktura (auth, Prisma) hotová. Loss aversion = denní návratnost — u 50–70 členů největší páka za nejmíň kódu. |
| 2 | **Daily puzzle jako rituál s „kdo dnes vyřešil"** (chess.com Daily) | Hádanka dne existuje, ale je anonymní jednorázovka — žádný záznam řešení, žádná tabulka dne, nestabilní rotace. | malá | Modal i pipeline stojí; chybí jen persist „dnešní úlohy" + POST výsledku (source `solver` ve schema už je!). |
| 3 | **Opakování vlastních chyb** (lichess Learn from your mistakes, ChessTempo failed sets) | Blunder Grid je naše verze — ale bez „vyřešeno", bez návratu nevyřešených, miss karty rozbité. | malá | 80 % práce hotovo, jádro featury jen dodělat. Osobní chyby motivují víc než anonymní úlohy. |
| 4 | **Odznaky/achievementy** (chess.com 144 achievementů, ChessKid hvězdy) | Žádný systém odměn; máme jen Puzzle Racer leaderboard. | malá | 10–20 odznaků (první úloha, 7denní streak, účast na turnaji — část ručně adminem, to velké weby neumí). Tabulka + ikonky u jména. |
| 5 | **Týdenní reset žebříčku + „skokan týdne"** (chess.com weekly leaderboards) | Puzzle Racer leaderboard je věčný — noví členové nemají šanci. | malá | `PuzzleRaceResult` má timestampy, jde o jeden WHERE + view. Už v plánu jako Krok 5. |
| 6 | **Puzzle Streak mód** (lichess) | Jen časovkový Racer; chybí klidný režim „jedna chyba a konec". | malá | Žádný timer, jen řazení úloh dle ratingu (lichess batch API už používáme) + max streak. Sedne starším členům. |
| 7 | **Tematické sady úloh** (ChessTempo, lichess themes) | Motivy už TAGUJEME (`puzzleMotifs.js`!), ale nikde se nedají filtrovat/trénovat. | malá | Data v `PuzzleCandidate.motifs` (CSV) leží ladem; stačí filtr v training.html. Doplnit lze importem Lichess CSV (CC0). |
| 8 | **Nápověda + ukázat řešení ve vieweru** (všechny weby) | Dítě, které hádanku nevyřeší, se řešení nedozví. | malá | `solution` JSON má vše, jen UI tlačítka v DiagramViewer. |
| 9 | **Hádej-tah režim pro lekce** (Chessable MoveTrainer, My-Chess lekce) | Viewer umí přehrávat a řešit hádanky, ale ne „projdi komentovanou linii a hádej tahy". | střední | Trenér nahraje komentovaný PGN; rozšíření existujícího game-vieweru, ne nová stránka. Obsah je dražší než kód. |
| 10 | **Spaced repetition** (Chessable, Listudy) | Chybné úlohy se nevrací po 1/3/7/14 dnech. | střední | Jeden sloupec `nextReviewAt` + primitivní SM-2; navazuje na #1/#3. |
| 11 | **Dashboard slabin per téma** (lichess Puzzle Dashboard, Aimchess) | Žádná statistika „vidličky 80 %, vazby 45 %". | střední | Potřebuje nejdřív sbírat data (#1); pak Chart.js radar. Druhý krok, ne první. |
| 12 | **Strukturovaná cesta / úrovně** (ChessKid Pěšec→Král, My-Chess plány) | Žádná mapa postupu pro kroužek. | střední | Začít statickou stránkou „Cesta mladého šachisty"; plné odemykání nestavět — na to je My-Chess Premium (150 Kč/rok přes ŠSČR). |
| 13 | **Avatary pro mládež** (ChessKid) | Děti v žebříčcích pod reálnými jmény. | střední | Řeší i GDPR; ale až bude co žebříčkovat. |
| 14 | **Realtime duel/battle** (Puzzle Battle, ChessKid Duel) | Nic 1v1. | velká | U 50–70 členů málokdy 2 online — nestavět; pro klubové večery stačí tlačítko generující privátní lichess.org/racer odkaz (nulový vývoj). |
| 15 | **Game Review s accuracy** (chess.com) | Jen blunder detekce, žádná slovní analýza. | velká | Mimo dosah; jádro (retry chyb) pokrývá Blunder Grid. |

---

# 3. PLÁN — TOP 10 doporučení

## A) Dodělat rozdělané (quick wins)

**A1. Opravit ztrátu dat při přepínání tabů v diagram editoru** *(náročnost: malá, ~hodiny)*
`switchPageTab` nesmí volat `clearDiagram()` při každém vstupu do tabu — stav (anotace, solver, `currentDiagramId`) zachovat mezi Diagramy↔Hádanky, resetovat jen explicitním „Nový diagram". Odblokuje zamýšlený workflow i editaci z adminu.
Soubory: `game-recorder.html:1892`, `js/diagram-editor.js:217+298`.

**A2. Opravit Blunder Grid rescan + miss detekci + matové blundery** *(malá–střední, ~1 den)*
Tři chirurgické fixy: (1) přidat Bearer hlavičku do POST /scan v `rescanGame()`; (2) opravit znaménko a FEN/ply offset miss detekce podle správné logiky z mrtvého klientského kódu (js/blunder-grid.js:661-695); (3) nezahazovat záznamy s null evalem (mate) v `getPlayerBlunders`. Bonus: smazat ~370 řádků mrtvého kódu.
Soubory: `js/blunder-grid.js:1227`, `src/services/blunderService.js:278-296, 268 vs 481`.

**A3. Dokončit F2 — generátor článku „Úloha týdne"** *(střední, ~2–3 dny)*
Nový POST `/api/weekly-puzzles/generate`: z max 3 vybraných `PuzzleCandidate` vytvořit `Diagram` záznamy (FEN + solution z `solutionLine`) a draft `News` s `diagram-book` blokem — HTML šablona už existuje v `insertDiagramBookToEditor` (admin-wysiwyg.js:1399), stačí ji zavolat server-side/při otevření draftu. Zapsat `usedInNewsId` (oživí mrtvé pole). Tím dostane celá pipeline poprvé veřejný výstup.
Soubory: `src/routes/weekly-puzzles.js`, `js/admin/admin-weekly-puzzles.js:305`, `js/admin/admin-wysiwyg.js:1399`.

**A4. Oživit training.html jako „Tréninkový koutek"** *(malá, ~hodiny)*
Přidat odkaz do menu Extra (`components/header.html:33-43`) a dlaždici do members hubu; doplnit filtr hádanky/diagramy a počítadlo X/Y (zatím localStorage, po B1 server). Zároveň přidat odkaz na Blunder Grid do Extra menu — dvě hotové stránky zdarma zviditelněné.
Soubory: `components/header.html`, `training.html`, `members.html:91`.

## B) Zábavnost / gamifikace

**B1. Persistence řešení + denní streak Hádanky dne** *(střední, ~2–3 dny)*
Nový model `PuzzleSolve` (userId?, candidateId/diagramId, solved, date) + POST výsledku z modalu Hádanky dne (source `solver` v `PuzzleVote.source` na to už čeká). Persistovat „úlohu dne" do SystemSetting (stabilní rotace), zobrazit plamínek se streakem (tolerance 1–2 dny) a tabulku „dnes vyřešili". Nepřihlášení: localStorage streak.
Soubory: `prisma/schema.prisma`, `src/services/weeklyPuzzlesService.js:508`, `js/hero-tiles.js:110`, `src/routes/weekly-puzzles.js`.

**B2. Týdenní žebříček + odznaky** *(střední, ~2–3 dny)*
Puzzle Racer: týdenní reset žebříčku + „skokan týdne" (WHERE nad `PuzzleRaceResult.createdAt`, pending Krok 5). K tomu model `Achievement`/`UserAchievement` s ~12 odznaky (první vyřešená úloha, 7denní streak, 50 úloh, výhra v lize — turnajové uděluje admin ručně v tabu Uživatelé). Ikonky u jména v žebříčcích.
Soubory: `src/routes/racer.js`, `js/puzzle-racer.js`, `prisma/schema.prisma`, `js/admin/admin-users.js`.

**B3. „Blunder týdne" na homepage + lovec blunderů** *(malá, ~1 den)*
Veřejný widget z `isFeatured` záznamů `BlunderAnalysis` (flag i PUT endpoint už existují — jen povolit MEMBER místo ADMIN, nebo hvězdičku neadminům skrýt, viz nález 1.3). Žebříček „kdo vyřešil nejvíc featured chyb" navazuje na `BlunderSolve` z C1.
Soubory: `src/routes/blunder.js:167`, `js/hero-tiles.js`, `js/blunder-grid.js:777`.

## C) Edukativnost

**C1. Blunder Grid: ukládání postupu + opakování chyb** *(střední, ~2–3 dny)*
Model `BlunderSolve` (userId, blunderId, solved, attempts, nextReviewAt) — odznak „vyřešeno" na kartě, tab „Moje nevyřešené" a primitivní spaced repetition (1/3/7 dní; jeden sloupec s datem). Mění Blunder Grid z jednorázovky v dlouhodobý trénink vlastních chyb — největší pedagogická hodnota webu (lichess „Learn from your mistakes" princip).
Soubory: `prisma/schema.prisma`, `src/routes/blunder.js`, `js/blunder-grid.js:920-942`.

**C2. Tematické sady: zužitkovat motivy + nápověda ve vieweru** *(malá–střední, ~1–2 dny)*
`PuzzleCandidate.motifs` (z `puzzleMotifs.js`) už nese tagy — přidat filtr „Dnes trénuju: vidličky" do training.html s českými názvy motivů; volitelně doplnit zásobu importem Lichess puzzle CSV (CC0, rating + themes zdarma). Do `DiagramViewer` přidat tlačítka „Nápověda" (zvýraznit figuru, pak pole) a „Ukázat řešení" (přehrát linii) — `solution` JSON má vše potřebné.
Soubory: `training.html`, `js/diagram-viewer.js:588+1065`, `src/services/puzzleMotifs.js`, `src/routes/weekly-puzzles.js`.

**C3. Režim „hádej tah" pro lekce trenéra** *(střední, ~3–4 dny)*
Rozšířit game-viewer/DiagramViewer o mód MoveTrainer: trenér nahraje komentovaný PGN (repertoár, vzorová partie) přes existující Editor, dítě místo přehrávání tahy hádá — správně pokračuje, špatně červené bliknutí + správný tah. Publikovat jako „Lekce" v Tréninkovém koutku (A4); 1 lekce měsíčně stačí, obsah je dražší než kód.
Soubory: `js/game-viewer2.js` nebo `js/diagram-viewer.js`, `training.html`, `src/routes/api-games.js`.

---

**Doporučené pořadí:** A1 → A2 → A4 (týden oprav, vše odblokované) → B1 (streak = největší motivační páka) → A3 (Úloha týdne konečně vidět) → C1 → C2 → B2 → B3 → C3. Mimo TOP 10, ale levné: vyřadit `dismissed` UI pro Hádanku dne (weeklyPuzzlesService.js:346), odkrýt admin tab Členové (admin.html:133), cesťáky schvalovací UI (api-travel-reports.js:15), smazat fórum backend nebo member-games.html.