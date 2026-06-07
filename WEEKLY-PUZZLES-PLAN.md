# Úloha týdne — technický návrh

> Stav: NÁVRH (před implementací). Inspirace: sachy-bakov.cz (1 statická úloha, řešení textem).
> Náš cíl: **3 interaktivní úlohy z našich vlastních partií**, auto-navržené, admin jen vybere a publikuje.

## Rozhodnutí (zadáno)
- **Řešení: interaktivní + skryté.** Hráč řeší tahem na šachovnici (DiagramViewer). Řešení se neukazuje, dokud ho nenajde.
- **Automatizace: ručně „Vygeneruj teď".** Žádný cron. Admin si v dashboardu kdykoliv vybere 3 a klikne generovat.
- **Bez Prisma migrace.** Diagram už má `solution`, článek diagram embeduje do `content`. Nic se nemění ve schématu.

## Proč je to lepší než Bakov
| | Bakov | My |
|---|---|---|
| Počet úloh | 1 | 3 |
| Řešení | statický text „1. Jf6+…" | **interaktivní na desce**, skryté |
| Zdroj | redakční výběr | **automaticky z našich partií** (BlunderAnalysis) |
| Obtížnost | — | odstupňovaná (z evalu/probDrop) |
| Práce admina | napsat celé | vybrat 3 → publikovat |

---

## 1. Architektura / datový tok

```
ChessGame (naše partie)
   │  [Blunder Grid scan — UŽ EXISTUJE, Stockfish/Lichess]
   ▼
BlunderAnalysis  (fenBefore, bestMoveLAN, probDrop, evalBefore/After, type, white/black, gameId)
   │  [NOVÉ: skórování kandidátů]
   ▼
GET /api/weekly-puzzles/candidates  →  Admin dashboard „Úloha týdne"
   │  (mini-diagramy + skóre + obtížnost + zdroj partie; admin zaškrtne 3)
   ▼
POST /api/weekly-puzzles/generate  { positions: [3×] }
   │  ├─ pro každou pozici: vytvoř Diagram záznam (fen + solution z bestMoveLAN)
   │  └─ vytvoř draft News článek s vloženým <div class="diagram-book">
   ▼
Draft článek (isPublished:false, kategorie „Úlohy")  →  admin doladí v editoru → publikuje
```

Klíčová myšlenka: **BlunderAnalysis JE generátor kandidátů.** Každý záznam = pozice s jasně nejlepším tahem a velkým eval-swingem = ideální „najdi nejlepší tah" úloha. Detekovali jsme to jako chybu/přehlédnutí, ale úlohu rámujeme **neutrálně** (jako Bakov), ne „náš hráč to přehlédl".

---

## 2. Reuse existující infry (soubor:řádek)

| Komponenta | Soubor | Co používáme |
|---|---|---|
| Kandidáti | `prisma/schema.prisma:516–539` (BlunderAnalysis) | fenBefore, bestMoveLAN, probDrop, evalBefore/After, type, white/black/result, gameId, createdAt |
| Eval/scan | `src/services/blunderService.js` | už generuje záznamy; Lichess cloud-eval vrací i celou PV (`pvs[0].moves`) — dnes se zahazuje |
| Blunder API | `src/routes/blunder.js:14–183` | vzor RBAC (`requireRole`), GET `/:player`, `/:player/featured` |
| Interaktivní diagram | `prisma/schema.prisma:483–496` (Diagram) | fen, annotations, solution, name, description |
| Solver | `js/diagram-viewer.js:588–706` (`attemptMove`) | `moveKey = "from-to"`, `solution[moveKey]`, `onSolve` |
| Render v článku | `js/diagram-book.js:455–546` (`initDiagramBooks`) | čte `.diagram-book` `data-diagrams`, instancuje DiagramViewer |
| Diagram CRUD | `src/routes/api-diagrams.js:9–100` | POST `/api/diagrams` { fen, annotations, solution, name, description } |
| Vkládání do článku | `js/admin/admin-wysiwyg.js:1441–1519` (`insertDiagramBookToEditor`) | přesný HTML blok |
| News API | `src/controllers/newsController.js:307–430` | POST/PUT, `isPublished:false` = draft |
| Admin sekce vzor | `js/admin/admin-members.js`, navigace `admin-core.js switchTab`, `admin-sidebar.js` | kam přidat tab |

---

## 3. Detekce KOMBINACE (ne jen blunderu) — ověřený algoritmus

> Podloženo deep-research (2026-06): lichess-puzzler `generator/`, Play Magnus PuzzleGenerator, DeepMind arXiv 2510.23881, Chess-Tactic-Finder, chess-chiller, pgn-tactics-generator. Všechny prahy ověřeny verbatim proti zdrojovému kódu.

**Klíčový rozdíl, na který se ptáš:**
- **Blunder** = spadl eval (to už BlunderAnalysis najde).
- **Kombinace** = v té pozici existuje **jediné úzké řešení** (uniqueness / only-move) vedoucí k **rozhodující výhodě**, ideálně přes **oběť/forcing**.

BlunderAnalysis je jen **1. síto** (našlo pozice, kde taktika reálně byla — eval se ostře změnil a tah byl v partii přehlédnut). Aby z kandidáta byla **úloha**, musí projít **2. sítem = uniqueness gate**. To je přesně to, co Blunder Grid sám neumí.

> **Výhoda našich dat:** každý BlunderAnalysis záznam je z definice pozice, kde **silný tah byl přehlédnut** (`bestMoveLAN ≠ zahraný tah`). Play Magnus tuhle podmínku („tah byl skutečně přehlédnut") musí složitě dopočítávat — my ji máme zadarmo.

### Win-chance škála (základ všech prahů)
Všechny lichess-derivované nástroje počítají prahy na **win-chance**, ne na surových centipawnech:
```js
// rozsah [-1, +1] z pohledu strany na tahu; mat = ±1
const wc = cp => 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;
```
Prahy `0.5–0.7` níže jsou **delty na téhle [-1,+1] škále**, NE procentní body.

### Algoritmus pro náš modul (per kandidát z BlunderAnalysis)
Řešitel = strana na tahu ve `fenBefore`. Evaly přepočítat na **pohled řešitele**.

```
KROK 0 — předfiltr zadarmo (z dat, co máme):
  ✗ zahoď, pokud řešitel už drtivě vyhrával PŘED tahem:  evalBefore_řešitel > +2.5
       (lichess: reject při prev_score > Cp(300) / is_up_in_material;
        Chess-Tactic-Finder strop +10.0 — volíme přísnější +2.5)
  ✗ zahoď, pokud řešení nevede k rozhodující výhodě:      evalAfter_best_řešitel < +2.0  (a není mat)
       (lichess advantage práh cp≥200; crushing cp≥600)

KROK 1 — UNIQUENESS GATE (1 dotaz multiPV=2 na fenBefore — viz §9 o zdroji):
  best = pv[0].score, second = pv[1].score   (z pohledu řešitele)
  unique =  (second neexistuje)
         || (best je mat && second není mat)
         || (wc(best) - wc(second) >= 0.55)     // mezi DeepMind 0.5 a lichess 0.7
  // ekvivalentní jednodušší varianta bez sigmoidu (Chess-Tactic-Finder):
  //   best - second >= 150 cp
  ✗ NOT unique → zahoď (víc dobrých tahů = není to „najdi TEN tah")

KROK 2 — odliš KOMBINACI od mechanického braní (chess.js na fenBefore + bestMove):
  see = staticExchangeEval(fenBefore, bestMove)   // dopočítat (chess.js nemá nativně)
  ✗ zahoď triviality:  mat-v-1, promoce na dámu jako jediná pointa, en passant,
                        strana na tahu je v šachu (vynucená odpověď, ne kombinace)
  ✓ silný kandidát:    see < 0  → OBĚŤ (pravá kombinace)
  ~ slabší:            see > 0 a velký zisk → „jen sebral zavěšenou figuru" → penalizovat
                        (u nás vždy platí „bylo přehlédnuto" → nezahazovat úplně, jen nižší skóre)
  → MAT řeš ZVLÁŠŤ od cp prahů (lichess `Mate(15)`): vynucený mat do ~5 tahů = top úloha
```

### Skóre kvality (řazení v dashboardu, 0–100)
```
uniqMargin  = clamp((wc(best) - wc(second)) / 0.9, 0, 1)   // čistota „only-move" — hlavní váha
sacrifice   = see < 0 ? 1 : 0                              // pravá kombinace
decisive    = clamp(wc(best) / 0.95, 0, 1)                 // jak moc vyhrává
forcingLite = bestMove je šach/braní ? 0.6 : 1.0           // POZOR: tiché tahy bonus (DeepMind
                                                          //   penalizuje mělká braní/šachy)
freshness   = novější createdAt → blíž 1 (~180 dní)

score = 100 * (0.35*uniqMargin + 0.25*sacrifice + 0.20*decisive
             + 0.10*forcingLite + 0.10*freshness)
```

**Obtížnost:** malý `uniqMargin` + tichý tah (ne braní/ne šach) = **těžká**; velký margin + oběť s braním/šachem = **lehká**; zbytek **střední**.

**Dedup & diverzita** (výběr top-N): shodný `fenBefore` jen jednou; max 1 úloha z jednoho `gameId`; ideálně různí hráči.

### Ověřené prahy napříč nástroji (referenční tabulka)
| Nástroj | Uniqueness test | Rozhodující výhoda | Triviality |
|---|---|---|---|
| **lichess-puzzler** | `wc(best) − wc(second) > 0.7` | `cp≥200 && wc(score) > wc(prev)+0.6`; mat `Mate(15)` | oběť přes materiál `d−initial ≤ −2` |
| **DeepMind 2510.23881** | `wc(best) − wc(second) ≥ 0.5` | mat do 15 → jinak win-chance gap | penalty braní (val/9), šach (0.4), mat-1 |
| **Play Magnus** | MultiPV=2: `best>280cp && all(second…)<100cp` | `iswon`=280 cp | `SEE>0` zahoď, `SEE<0` oběť, mat-1/promoce-D/en-passant/šach pryč |
| **Chess-Tactic-Finder** | `best − second > 150 cp` | `0 ≤ eval ≤ 1000 cp` | startovní tah nesmí být vynucený |
| **chess-chiller** | MultiPV=2 tiery `best/second`: 2000/300, 1000/200, 500/100 | viz tiery | mat `bs1≥30000` |

Endpoint vrátí top ~30 kandidátů, admin si z nich vybere 3.

---

## 4. Konverze pozice → interaktivní Diagram

`bestMoveLAN` je **UCI** (`e2e4`, promoce `e7e8q`). Solver klíč je `from-to` (`e2-e4`) a promuje vždy na dámu → promoční znak zahodíme.

```js
function uciToKey(uci) {                 // "e2e4" → "e2-e4" ; "e7e8q" → "e7-e8"
  return uci.slice(0, 2) + '-' + uci.slice(2, 4);
}

function buildSolution(fenBefore, bestMoveUci, comment) {
  const key = uciToKey(bestMoveUci);
  return { [key]: { type: 'correct', comment: comment || 'Správně!', line: [key] } };
  // line s 1 prvkem → solver po zahrání hned vyhodnotí jako vyřešeno (onSolve)
}

// orientace + kdo je na tahu z FEN
const toMove = fenBefore.split(' ')[1];                  // 'w' | 'b'
const orientation = toMove === 'b' ? 'black' : 'white';

// Diagram záznam:
POST /api/diagrams {
  fen: fenBefore,
  annotations: { squares: [], arrows: [], badges: [] },  // volitelně šipka na klíčové pole
  solution: buildSolution(fenBefore, bestMoveLAN, 'Správně! Nejlepší tah.'),
  name: `Úloha — ${toMove === 'w' ? 'bílý' : 'černý'} na tahu`,
  description: `Z partie ${white} – ${black}`             // neutrální, bez „kdo přehlédl"
}
```

### Volitelně (F3): víc-tahové řešení přes Lichess cloud-eval
`GET https://lichess.org/api/cloud-eval?fen=<fenBefore>&multiPv=1` → `pvs[0].moves` = `"e2e4 e7e5 g1f3"`.
Konverze na `line = ["e2-e4","e7-e5","g1-f3"]` (hráč–soupeř–hráč; poslední musí být hráčův). Solver pak nechá soupeře odpovědět. **Fallback** na 1 tah, když Lichess pozici nemá v cache (cloud-eval nepokrývá vše).

---

## 5. Generátor článku

Vytvoří **draft** News článek s jedním `.diagram-book` blokem obsahujícím 3 diagramy (knihu lze listovat), nebo 3 samostatné bloky pod sebou. HTML blok přesně podle `admin-wysiwyg.js:1474`:

```html
<div class="diagram-book" id="book_<ts>" data-diagrams='<JSON>' data-current="0"
     contenteditable="false" style="max-width:320px;margin:0.75rem auto;overflow:visible;">
  <div class="book-board-container"></div>
  <div class="book-nav" ...>
    <button class="book-prev" onclick="bookNav('book_<ts>',-1)">‹</button>
    <span class="book-to-move">Bílý na tahu</span>
    <span class="book-counter">1 / 3</span>
    <button class="book-next" onclick="bookNav('book_<ts>',1)">›</button>
  </div>
  <div class="book-description"></div>
</div>
```

`data-diagrams` = JSON pole objektů `{id, fen, name, title, toMove, annotations, solution, description, orientation}` (klíče, které čte `initDiagramBooks`).

Tělo článku (auto, admin dotáhne):
```
<perex> Tři pozice z našich partií. Bílý/černý je na tahu — najdi nejlepší tah přímo na šachovnici.
[diagram-book se 3 úlohami]
<patička> Řešení se ti potvrdí, jakmile zahraješ správný tah. Partie: …
```

News POST:
```js
POST /api/news {
  title: `Úloha týdne — ${datum}`,
  category: 'Úlohy',          // nová kategorie (viz §7)
  excerpt: 'Tři úlohy z našich partií — najdi nejlepší tah.',
  content: <HTML výše>,
  isPublished: false          // DRAFT
}
```

---

## 6. Admin dashboard „Úloha týdne"

Nová sekce v adminu (klasické script tagy, ne ES moduly; auth `window.authToken`):

1. **`admin.html`** — nový `<div id="weeklyPuzzleView" class="hidden">`: grid mini-diagramů, u každého: náhled pozice (`generateMiniBoard(fen)`), „Bílý/Černý na tahu", obtížnost, skóre, zdroj partie (white–black, datum), checkbox. Nahoře tlačítko **„Vygenerovat článek (vybrané: 0/3)"**.
2. **`js/admin/admin-weekly-puzzles.js`** (nový):
   - `loadCandidates()` → `GET /api/weekly-puzzles/candidates` (Bearer `authToken`) → `renderGrid()`.
   - výběr max 3 (checkbox), `generateArticle()` → `POST /api/weekly-puzzles/generate` → po úspěchu otevři draft v editoru (`switchTab('editor')` + načti newsId).
   - export `window.loadWeeklyPuzzles = loadCandidates`.
3. **`admin-sidebar.js`** — položka do skupiny `tools` (nebo `content`): `{ tab:'weeklyPuzzle', label:'Úloha týdne', icon:'fa-lightbulb' }`.
4. **`admin-core.js`** — `switchTab`: `else if (tab==='weeklyPuzzle' && window.loadWeeklyPuzzles) loadWeeklyPuzzles();` + přidat `'weeklyPuzzle'` do seznamu view (~ř. 231).
5. **`admin.html`** — `<script src="js/admin/admin-weekly-puzzles.js?v=1"></script>` (po admin-core.js).

---

## 7. Nové backend endpointy

Nový soubor `src/routes/weekly-puzzles.js` (mount v `server.js` pod `authMiddleware`):

```
GET  /api/weekly-puzzles/candidates   [ADMIN]
     → 1) načte BlunderAnalysis (1. síto), předfiltr §3-KROK0
       2) pro top ~40 dotáhne multiPV=2 na fenBefore → UNIQUENESS GATE (§3-KROK1)
       3) SEE + triviality (§3-KROK2), skóre kvality, dedup+diverzita
       → vrátí top ~30 KOMBINACÍ (ne jen blunderů):
       [{ id, fenBefore, bestMoveLAN, toMove, score, difficulty,
          uniqMargin, sacrifice, evalBefore, evalAfter, secondBestCp,
          type, white, black, result, gameId, createdAt }]

POST /api/weekly-puzzles/generate     [ADMIN]
     body: { positions: [ {fenBefore, bestMoveLAN, white, black, ...} × ≤3 ],
             title?, intro? }
     → 1) (volitelně) dotáhni PV přes cloud-eval
       2) vytvoř N× Diagram (fen + solution)
       3) vytvoř draft News s diagram-book blokem
     → { newsId, slug, diagramIds }
```

RBAC: `requireRole('ADMIN')` (vzor `src/routes/blunder.js`).

### Zdroj multiPV=2 (klíčové — uniqueness gate na tom stojí)
`fenBefore` potřebuje skóre **2. nejlepšího tahu**, které BlunderAnalysis neukládá. Možnosti (sestupně dle kvality):
- **A) Vlastní Stockfish MultiPV=2** na kandidátní pozice — máme Stockfish 17 přes chess-api. Jen ~40 pozic (ne celé partie) → levné, deterministické, vždy dostupné. **Doporučeno.**
- **B) Lichess cloud-eval `?multiPv=2`** — zdarma, ale **nepokrývá každou pozici** (jen co je v cloudu); amatérské pozice z našich partií tam často nebudou.
- **C) Hybrid:** zkus Lichess (B), fallback Stockfish (A).
Pozice bez 2. tahu (cloud miss + bez vlastního SF) označit `uniqMargin=null` → „jedinečnost neověřena", v dashboardu řadit níž / vizuálně odlišit.

---

## 8. Fáze implementace

- **F1 — Dashboard kandidátů** (read-only nad existujícími daty)
  - `GET /api/weekly-puzzles/candidates`: BlunderAnalysis → předfiltr → **uniqueness gate (multiPV=2)** → SEE/triviality → skóre (§3).
  - admin sekce `weeklyPuzzle` s gridem a výběrem (ukázat `uniqMargin`, oběť, skóre, obtížnost).
  - *Výstup:* vidíme, jestli **kombinace** (ne blundery) dávají smysl na reálných datech. Nic se nezapisuje. Tady se pozná, jestli je práh uniqueness dobře nastavený.
- **F2 — Generátor článku**
  - `POST /api/weekly-puzzles/generate` (Diagram + draft News).
  - tlačítko „Vygenerovat" → otevře draft v editoru.
  - *Výstup:* celý flow výběr → hotový koncept se 3 interaktivními úlohami.
- **F3 — Vychytávky** (volitelné)
  - víc-tahové řešení (cloud-eval PV), tlačítko „Ukázat řešení" v DiagramVieweru, témata (mat/vidlička/vazba), šipka na klíčové pole, výběr orientace.

---

## 9. Otevřené detaily k rozhodnutí

1. **Pool kandidátů = jen naskenované partie.** Dashboard ukáže pozice jen od hráčů, co prošli Blunder Grid scanem. Chceme do dashboardu i tlačítko „doskenovat hráče X", nebo stačí pracovat s tím, co je naskenované? *(Doporučení: F1 jen s existujícími daty; scan necháváme v Blunder Gridu.)*
2. **1 tah vs. víc-tahové řešení.** MVP = „najdi 1 nejlepší tah" (čisté, funguje bez externí závislosti). Víc-tahové (soupeř odpoví) až F3 přes Lichess cloud-eval. *(Doporučení: ano, MVP 1 tah.)*
3. **„Ukázat řešení" tlačítko.** Dnes solver řešení neodhalí — musíš ho zahrát. Přidat tlačítko (přehraje správný tah)? *(Doporučení: F3, malé rozšíření DiagramVieweru.)*
4. **Kategorie článku.** Přidat novou „Úlohy" do selectu (`admin.html:459`), nebo dát pod stávající? *(Doporučení: nová „Úlohy".)*
5. **Forma:** jedna „kniha" se 3 úlohami (listování), nebo 3 samostatné bloky pod sebou s textem mezi? *(Doporučení: 3 samostatné bloky — lepší pro čtení a SEO.)*
6. **Zdroj multiPV=2** (uniqueness gate): vlastní Stockfish přes chess-api vs. Lichess cloud-eval vs. hybrid (§7). *(Doporučení: A — vlastní Stockfish MultiPV=2; spolehlivé i pro naše amatérské pozice, jen ~40 dotazů.)*
7. **Práh uniqueness:** `wc(best)−wc(second) ≥ 0.55` (sigmoid) vs. jednodušší `best−second ≥ 150 cp`. Na amatérských partiích možná povolit volněji (0.5 / 120 cp), ať je dost kandidátů — doladí se podle F1 výstupu. *(Doporučení: start 0.55, kalibrovat na reálných datech.)*
