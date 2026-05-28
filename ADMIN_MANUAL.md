# Administrátorský Manuál - Šachy Jablonec

Kompletní průvodce správou webu sachyjablonec.cz.

*Verze: v32 | Poslední aktualizace: 12. 4. 2026*

---

## 📋 Obsah

1. [Role a oprávnění](#role-a-opravneni)
2. [Přístup do administrace](#pristup-do-administrace)
3. [Správa článků](#sprava-clanku)
4. [Galerie obrázků](#galerie-obrazku)
5. [Správa partií](#sprava-partii)
6. [Soutěže a tabulky](#souteze-a-tabulky)
7. [Uživatelé a komentáře](#uzivatele-a-komentare)
8. [Puzzle Racer nastavení](#puzzle-racer)
9. [Členská sekce](#clenska-sekce)
10. [Blicák turnaj](#blicak-turnaj)
11. [Události / Kalendář](#udalosti)
12. [Šachová databáze](#sach-databaze)
13. [Diagramy a fragmenty](#diagramy)
14. [Komentování partií](#komentovani-partii)
15. [API Reference](#api-reference)

---

## 🔐 Role a oprávnění {#role-a-opravneni}

### Hierarchie rolí

| Role | Popis | Oprávnění |
|------|-------|-----------|
| **USER** | Registrovaný uživatel | Psát komentáře, hrát Puzzle Racer |
| **MEMBER** | Člen oddílu | Vše co USER + přístup do členské sekce |
| **ADMIN** | Administrátor | Vše co MEMBER + správa obsahu, moderace |
| **SUPERADMIN** | Superadministrátor | Vše + správa uživatelů, systémová nastavení |

### Co může která role

#### USER (Registrovaný uživatel)
- ✅ Psát komentáře pod články
- ✅ Hrát Puzzle Racer (výsledky se ukládají do žebříčku)
- ✅ Upravit svůj profil (jméno, oddíl)
- ❌ Přístup do členské sekce
- ❌ Přístup do administrace

#### MEMBER (Člen oddílu)
- ✅ Vše co USER
- ✅ Přístup do členské sekce (`/members.html`)
- ✅ Nahrávání fotek do galerie
- ✅ Záznamník partií

#### ADMIN (Administrátor)
- ✅ Vše co MEMBER
- ✅ Přístup do admin panelu (`/admin.html`)
- ✅ Správa článků (vytváření, editace, mazání)
- ✅ Správa galerie (kategorizace, mazání)
- ✅ Moderace komentářů
- ✅ Správa soutěží a tabulek
- ✅ Nastavení Puzzle Racer

#### SUPERADMIN (Superadministrátor)
- ✅ Vše co ADMIN
- ✅ Správa uživatelů (změna rolí)
- ✅ Systémová nastavení

---

## 🖥️ Přístup do administrace {#pristup-do-administrace}

### Jak se přihlásit

1. Klikněte na **"Přihlásit"** v pravém horním rohu
2. Zadejte uživatelské jméno a heslo
3. Po přihlášení se v menu zobrazí možnost **"Administrace"**

### Google přihlášení
- Uživatelé se mohou přihlásit také přes Google účet
- Při prvním přihlášení musí zadat přezdívku
- Google účet se propojí s existujícím účtem podle emailu

### Admin panel URL
```
https://www.sachyjablonec.cz/admin.html
```

---

## 📰 Správa článků {#sprava-clanku}

### Vytvoření nového článku

1. V admin panelu zvolte tab **"Novinky"**
2. Klikněte na **"Přidat článek"**
3. Vyplňte:
   - **Titulek** - název článku
   - **Obsah** - hlavní text (podporuje HTML)
   - **Úvodní obrázek** - klikněte pro výběr z galerie
   - **Galerie** - přidejte další obrázky
   - **Partie** - přidejte šachové partie (PGN nebo Chess.com odkaz)

### Formátování obsahu

Editor podporuje základní HTML:
```html
<h3>Podnadpis</h3>
<p>Odstavec textu</p>
<strong>Tučný text</strong>
<em>Kurzíva</em>
<a href="https://...">Odkaz</a>
<ul><li>Odrážky</li></ul>
```

### Lomítkové šablony (Slash commands)

Při úpravě nebo psaní nového článku můžete na nový řádek (nebo za mezeru) napsat lomítko `/` pro otevření rychlého menu se šablonami:
- **/vitezove** – Zlatý box vítězů pro aktuality i archivy turnajů.
- **/karty** – Dvousloupcové karty pro zvýraznění stupňů vítězů ve dvou kategoriích.
- **/cta** – Závěrečné tlačítko (Call To Action) s odkazem (např. na výsledky na Chess-Results).

Po výběru šablony se otevře vyskakovací okno, kde vyplníte požadované údaje (nadpis, počty atd.). Šablona se poté automaticky vloží do textu. Pokud například u CTA tlačítka chcete později upravit URL adresu, stačí na tlačítko v editoru **dvakrát kliknout**.

### Automatický převod textu na tabulku

V editoru najdete tlačítko 📊 (Tabulka). Pokud označíte surová data (například výsledky turnaje překopírované z Wordu či webu) a kliknete na tlačítko tabulky, systém se pokusí (pomocí AI) převést text na reprezentativní a responzivní tabulku.

### Přidání partií do článku

#### Způsob 1: PGN formát
```
[Event "Krajský přebor"]
[White "Novák, Jan"]
[Black "Svoboda, Petr"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 ...
```

#### Způsob 2: Chess.com odkaz
1. Zkopírujte URL partie z Chess.com
2. Vložte do pole "Chess.com odkaz"
3. Systém automaticky stáhne PGN a vytvoří náhled

### Publikování

- **Uložit jako koncept** - článek nebude veřejný
- **Publikovat** - článek se zobrazí na hlavní stránce
- **Naplánovat** - článek se publikuje automaticky v budoucnu (pokud nastavíte datum v budoucnosti, změní se tlačítko i barva automaticky)

### ⌨️ Klávesové zkratky editoru {#klavesove-zkratky}

Pro zrychlení práce v panelu a editoru článků můžete využít tyto zkratky:

| Zkratka | Akce |
|---------|------|
| <kbd>N</kbd> | Nový článek |
| <kbd>D</kbd> | Nový diagram |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>B</kbd> | Tučně |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>I</kbd> | Kurzíva |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>U</kbd> | Podtržení |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>K</kbd> | Vložit odkaz |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>X</kbd> | Přeškrtnutí |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> | AI Pravopis |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> | Odrážkový seznam |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd> | Vložit jako čistý text |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>1</kbd> | Rychlý nadpis H2 |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>2</kbd> | Rychlý nadpis H3 |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd> | Zvýrazněný Info Block |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Y</kbd> | Zpět / Vpřed |

---

## 🖼️ Galerie obrázků {#galerie-obrazku}

### Nahrávání obrázků

1. V admin panelu zvolte tab **"Galerie"**
2. Klikněte **"Nahrát obrázky"**
3. Vyberte soubory (max 10 MB na obrázek)
4. Obrázky se automaticky:
   - Konvertují do WebP formátu
   - Vytvoří se náhledy (thumbnails)
   - Optimalizují se pro web

### Kategorie obrázků

| Kategorie | Použití |
|-----------|---------|
| `Obecné` | Výchozí kategorie |
| `Mládež` | Fotky z mládežnických akcí |
| `Dospělí` | Fotky z akcí dospělých |
| `Blicák` | Fotky z Blicák turnajů |
| `Archiv` | Historické fotky |

### Hromadné operace

- **Hromadné mazání**: Zaškrtněte obrázky → "Smazat vybrané"
- **Změna kategorie**: Klikněte na obrázek → vyberte novou kategorii

---

## ♟️ Správa partií {#sprava-partii}

### Kde se partie zobrazují

1. **V článcích** - přidané při editaci článku
2. **Stránka /partie** - všechny partie podle kategorií
3. **Soutěže** - partie z turnajů

### Kategorie partií

- `Mládež` - partie z mládežnických soutěží
- `Dospělí` - partie z dospělých soutěží
- `Blicák` - partie z bleskových turnajů
- `Výuka` - komentované partie pro studium

### Skin přehrávače partií

V adminu v sekci **Nastavení** je karta **Skin přehrávače partií**:

- **Nový skin** - výchozí kompaktní vzhled podle prototypu, lepší pro články a mobil.
- **Klasický skin** - návrat k původnímu vzhledu, pokud nový skin někde nesedí.

Přepnutí je globální a projeví se ve veřejných přehrávačích partií v článcích i na stránkách webu.

### Formát PGN

Správný PGN formát:
```pgn
[Event "Název turnaje"]
[Site "Místo konání"]
[Date "2025.12.22"]
[Round "1"]
[White "Příjmení, Jméno"]
[Black "Příjmení, Jméno"]
[Result "1-0"]
[WhiteElo "1850"]
[BlackElo "1720"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 ...
```

---

## 🏆 Soutěže a tabulky {#souteze-a-tabulky}

### Automatické aktualizace

Tabulky se automaticky aktualizují z Chess-Results.com:
- Při startu serveru
- Každých 6 hodin (produkce)

### Přidání nové soutěže

1. V admin panelu zvolte tab **"Soutěže"**
2. Klikněte **"Přidat soutěž"**
3. Vyplňte:
   - **Název** - např. "Krajský přebor 2025"
   - **Typ** - `Družstva` nebo `Jednotlivci`
   - **Chess-Results URL** - odkaz na turnaj
   - **Kategorie** - Mládež/Dospělí

### Ruční aktualizace tabulek

1. Klikněte na **"Aktualizovat tabulky"** v admin panelu
2. Nebo použijte API:
```bash
curl -X GET "https://www.sachyjablonec.cz/api/scraping/standings"
```

---

## 👥 Uživatelé a komentáře {#uzivatele-a-komentare}

### Správa uživatelů (SUPERADMIN)

1. V admin panelu zvolte tab **"Uživatelé"**
2. Můžete:
   - Změnit roli uživatele
   - Deaktivovat účet
   - Zobrazit aktivitu

### Moderace komentářů

Komentáře se zobrazují pod články. Admin může:
- **Skrýt komentář** - komentář zmizí, ale zůstane v DB
- **Smazat komentář** - trvalé odstranění
- **Upozornit uživatele** - (🚧 připravuje se)

### Pravidla pro komentáře

- Minimálně 3 znaky
- Bez vulgarismů a urážek
- Relevantní k tématu článku

---

## 🧩 Puzzle Racer {#puzzle-racer}

### Herní módy

| Mód | Popis |
|-----|-------|
| **Vanilla** | Klasické náhodné puzzly, fixní nastavení |
| **Thematic** | Téma podle nastavení admina |



### Nastavení (Admin)

1. V admin panelu zvolte tab **"Puzzle Racer"**
2. Nastavte:
   - **Téma** - např. `mateIn2`, `fork`, `pin`
   - **Čas** - 60-300 sekund
   - **Životy** - 1-5
   - **Penalizace** - sekundy za chybu
   - **Přeskočit** - povolit přeskočení puzzlu

### Témata puzzlů

```
mateIn1, mateIn2, mateIn3, mateIn4, mateIn5,
fork, pin, skewer, discoveredAttack, 
doubleCheck, deflection, interference,
hangingPiece, trappedPiece, attraction,
clearance, sacrifice, zugzwang,
quietMove, defensiveMove, xRayAttack
```

---

## 🏠 Členská sekce {#clenska-sekce}

### Přístup

Dostupná pouze pro role MEMBER, ADMIN, SUPERADMIN.

### Funkce

| Oprávnění |
|--------|-------|
| **Galerie** | Nahrávání a prohlížení fotek |
| **Puzzle Racer** | Trénink taktiky |
| **Blunder Grid** | Trénink na vlastních chybách a přehledech |
| **Záznamník partií** | Záznam vlastních partií |
| **Zprávy** | Interní komunikace |

### Blunder Grid (Trénink chyb)

Členové si mohou procházet hrubky z lokálně uložených partií nebo turnajů ("Guess the move" koncept) a učit se z vlastních (či týmových) chyb.

**Jak generovat a aktualizovat data pro Blunder Grid (Admin):**
1. Otevřete terminál na doménovém serveru nebo localhostu v kořenovém adresáři.
2. Spusťte příkaz: `npm run generate-blunders` (interně to spouští backendový skript `scripts/generate-blunders.js`).
3. Tento proces zanalyzuje posledních několik neuložených partií z lokální databáze `GameRecorded` (využívá hybridní stažení posudků přes Lichess API nebo lokální chess-api jako fallback). Tím zjistí propady v šanci na výhru (Win Probability drop).
4. Data jsou bezpečně zapsána do statického souboru `public/data/duda-blunders.json`.
5. Frontend si z něj žije sám a členové si přes interaktivní UI nebo Galerii mohou filtrovat a hádat správné tahy.
6. Tip: Tento krok je vhodné jednorázově spustit po každém víkendovém návalu nových nahraných partií od dětí!

---

## ⚡ Blicák turnaj {#blicak-turnaj}

### Stránka Blicák

URL: `/blicak.html`

Zobrazuje:
- Informace o turnaji
- Výsledky z Chess-Results
- Fotogalerie z turnajů

### Aktualizace výsledků

Výsledky se automaticky stahují z Chess-Results URL nastaveného v databázi.

### Fotky Blicák

1. Nahrajte fotky do galerie s kategorií **"Blicák"**
2. Automaticky se zobrazí na stránce Blicák

---

## 📅 Události / Kalendář {#udalosti}

Správa kalendáře akcí a turnajů. Tab **Události** v admin panelu.

### Vytvoření události

1. Klikněte na **Události** tab
2. Vyplňte formulář:
   - **Název** — povinný
   - **Datum začátku/konce** — datetime picker
   - **Místo** — s autocomplete (Nominatim geocoding)
   - **Kategorie** — turnaj, trénink, kemp, schůzka, jiné
   - **Věková skupina** — mládež, dospělí, open
   - **Typ** — individuální / týmový
   - **Tempo** — blitz, rapid, classical
   - **Přihlášky do** — deadline pro registraci
   - **Startovné, Kontakt, URL** — volitelné
3. **Interní události** — viditelné pouze členům (MEMBER+)
4. **iCal export** — události lze exportovat do kalendáře (`/api/events/ical`)

### API endpointy

| Metoda | Cesta | Popis | Auth |
|--------|-------|-------|------|
| GET | `/api/events` | Veřejné události | Ne |
| GET | `/api/events/internal` | Interní (členské) události | MEMBER+ |
| GET | `/api/events/ical` | iCal export | Ne |
| POST | `/api/events` | Vytvoření události | ADMIN+ |
| PUT | `/api/events/:id` | Editace události | ADMIN+ |
| DELETE | `/api/events/:id` | Smazání události | ADMIN+ |

---

## 🗄️ Šachová databáze {#sach-databaze}

Tab **Databáze** v admin panelu. Správa historické databáze partií (ŠSČR 2003-2025).

### Funkce

- **Import PGN** — hromadný import partií ze souboru PGN
- **Statistiky** — počet her, hráčů, otevření (ECO kódy)
- **Detekce duplikátů** — při importu se přeskočí existující partie
- **Vyhledávání** — podle hráče, ECO kódu, data

### API endpointy

| Metoda | Cesta | Popis | Auth |
|--------|-------|-------|------|
| GET | `/api/chess/games` | Vyhledávání partií | Ne |
| GET | `/api/chess/games/:id` | Detail partie | Ne |
| POST | `/api/chess/import` | Import PGN souboru | ADMIN+ |
| GET | `/api/chess/players` | Seznam hráčů | Ne |
| GET | `/api/chess/stats` | Statistiky databáze | Ne |

---

## 📐 Diagramy a fragmenty {#diagramy}

Správa šachových diagramů a fragmentů partií. Tab **Partie** → sub-tab **Diagramy** / **Fragmenty**.

### Diagramy

Šachové pozice s anotacemi (šipky, zvýrazněná pole). Mohou obsahovat **řešení** (interaktivní hádanka).

- **Vytvoření** — přes Game Recorder (`/game-recorder?mode=diagram`)
- **Vkládání do článků** — v WYSIWYG editoru přes tlačítko "Diagramy"
- **Kniha diagramů** — seskupení více diagramů do interaktivní série

### Fragmenty

Výstřižky z partií (rozsah tahů od-do) s vlastním PGN.

- **Vytvoření** — v editoru článku, tlačítko ✂️ u partie
- **Vkládání do článků** — přes tlačítko "Fragmenty" v WYSIWYG

### API endpointy

| Metoda | Cesta | Popis | Auth |
|--------|-------|-------|------|
| GET | `/api/diagrams` | Seznam diagramů | Ne |
| POST | `/api/diagrams` | Vytvoření diagramu | MEMBER+ |
| PUT | `/api/diagrams/:id` | Editace | MEMBER+ |
| DELETE | `/api/diagrams/:id` | Smazání | MEMBER+ |
| GET | `/api/fragments` | Seznam fragmentů | Ne |
| POST | `/api/fragments` | Vytvoření fragmentu | MEMBER+ |
| DELETE | `/api/fragments/:id` | Smazání | MEMBER+ |

---

## 💬 Komentování partií {#komentovani-partii}

**Nové ve v32.** Partie v článcích lze nyní komentovat — přidat verbální komentáře k tahům, varianty a anotace.

### Postup

1. V editoru článku najděte partii v seznamu her
2. Klikněte na tlačítko 💬 **Komentovat** u partie
3. Otevře se **Game Recorder** s načteným PGN
4. Přidejte komentáře k tahům (klikněte na tah → napište komentář)
5. Přidejte varianty, NAG značky ($1, $2 atd.)
6. Klikněte **"Uložit do článku"**
7. PGN s komentáři se automaticky vrátí do editoru článku
8. Uložte článek — komentáře se zobrazí v GameViewer2

### Sub-taby v sekci Partie

Tab **Partie** v admin panelu má dva sub-taby:

- **Nahrané** — partie nahrané přes Game Recorder (tabulka `GameRecorded`)
- **Z článků** — partie vložené do článků (z `News.gamesJson`)

---

## 📡 API Reference {#api-reference}

Kompletní seznam API endpointů. Všechny endpointy jsou na `/api/...`.

### Autentizace

| Metoda | Cesta | Popis |
|--------|-------|-------|
| POST | `/api/auth/register` | Registrace nového uživatele |
| POST | `/api/auth/login` | Přihlášení (vrací JWT token) |
| GET | `/api/auth/me` | Info o přihlášeném uživateli |
| POST | `/api/auth/google` | Google OAuth přihlášení |

### Články (News)

| Metoda | Cesta | Popis | Auth |
|--------|-------|-------|------|
| GET | `/api/news` | Seznam článků (filtry: `published`, `category`, `page`, `limit`) | Ne |
| GET | `/api/news/:id` | Detail článku | Ne |
| POST | `/api/news` | Vytvoření článku | ADMIN+ |
| PUT | `/api/news/:id` | Editace článku | ADMIN+ |
| DELETE | `/api/news/:id` | Smazání článku | ADMIN+ |

### Komentáře

| Metoda | Cesta | Popis | Auth |
|--------|-------|-------|------|
| GET | `/api/comments/:newsId` | Komentáře k článku | Ne |
| GET | `/api/comments/latest` | Poslední komentář (homepage) | Ne |
| POST | `/api/comments` | Přidání komentáře | USER+ |
| PUT | `/api/comments/:id` | Editace komentáře | Autor/ADMIN |
| DELETE | `/api/comments/:id` | Smazání komentáře | Autor/ADMIN |
| PUT | `/api/comments/:id/hide` | Skrytí komentáře | ADMIN+ |

### Partie

| Metoda | Cesta | Popis | Auth |
|--------|-------|-------|------|
| GET | `/api/games` | Nahrané partie | Ne |
| GET | `/api/games/:id` | Detail partie | Ne |
| POST | `/api/games` | Nahrání partie | MEMBER+ |
| PUT | `/api/games/:id` | Editace partie | MEMBER+ |
| DELETE | `/api/games/:id` | Smazání partie | MEMBER+ |
| GET | `/api/viewer-games?category=X` | Partie z článků podle kategorie | Ne |

### Obrázky a galerie

| Metoda | Cesta | Popis | Auth |
|--------|-------|-------|------|
| GET | `/api/images` | Seznam obrázků | Ne |
| POST | `/api/images/upload` | Upload obrázku | ADMIN+ |
| DELETE | `/api/images/:id` | Smazání obrázku | ADMIN+ |

### Uživatelé

| Metoda | Cesta | Popis | Auth |
|--------|-------|-------|------|
| GET | `/api/users` | Seznam uživatelů | ADMIN+ |
| PUT | `/api/users/:id/role` | Změna role | SUPERADMIN |

### Členská sekce

| Metoda | Cesta | Popis | Auth |
|--------|-------|-------|------|
| GET | `/api/announcements` | Oznámení | MEMBER+ |
| POST | `/api/announcements` | Vytvoření oznámení | ADMIN+ |
| GET | `/api/documents` | Dokumenty pro členy | MEMBER+ |
| POST | `/api/documents` | Upload dokumentu | ADMIN+ |
| GET | `/api/messages` | Klubové zprávy | Club password |
| POST | `/api/messages` | Odeslání zprávy | Club password |
| GET | `/api/travel-reports/my` | Moje cestovné | MEMBER+ |
| POST | `/api/travel-reports` | Nový cestovný report | MEMBER+ |

### Fórum

| Metoda | Cesta | Popis | Auth |
|--------|-------|-------|------|
| GET | `/api/forum` | Seznam témat | MEMBER+ |
| GET | `/api/forum/:id` | Detail tématu s příspěvky | MEMBER+ |
| POST | `/api/forum` | Nové téma | MEMBER+ |
| POST | `/api/forum/:id/posts` | Odpověď v tématu | MEMBER+ |
| PUT | `/api/forum/:id/pin` | Připnout téma | ADMIN+ |
| PUT | `/api/forum/:id/lock` | Zamknout téma | ADMIN+ |
| DELETE | `/api/forum/:id` | Smazat téma | ADMIN+ |

### AI nástroje

| Metoda | Cesta | Popis | Auth |
|--------|-------|-------|------|
| POST | `/api/ai/spellcheck` | Kontrola pravopisu textu | ADMIN+ |
| POST | `/api/ai/text-to-table` | Konverze textu na HTML tabulku | ADMIN+ |

### Soutěže

| Metoda | Cesta | Popis | Auth |
|--------|-------|-------|------|
| GET | `/api/scraping/standings` | Aktuální tabulky soutěží | Ne |
| POST | `/api/scraping/refresh` | Aktualizace tabulek z chess-results.com | ADMIN+ |

### Puzzle Racer

| Metoda | Cesta | Popis | Auth |
|--------|-------|-------|------|
| GET | `/api/racer/puzzles` | Série hádanek | Ne |
| POST | `/api/racer/result` | Odeslání výsledku | USER+ |
| GET | `/api/racer/leaderboard` | Žebříček | Ne |

### Systém

| Metoda | Cesta | Popis | Auth |
|--------|-------|-------|------|
| GET | `/health` | Healthcheck | Ne |
| GET/POST | `/api/settings` | Systémová nastavení | ADMIN+ |

---

## 🔧 Technické informace

### Struktura URL

| URL | Popis |
|-----|-------|
| `/` | Hlavní stránka |
| `/article.html?id=X` | Detail článku |
| `/partie.html` | Přehrávač partií |
| `/teams.html` | Týmy a tabulky |
| `/members.html` | Členská sekce |
| `/account.html` | Nastavení účtu |
| `/admin.html` | Admin panel |

### API Endpoints (pro pokročilé)

```
GET  /api/news           - Seznam článků
POST /api/news           - Vytvořit článek (auth)
GET  /api/news/:id       - Detail článku
PUT  /api/news/:id       - Upravit článek (auth)
DEL  /api/news/:id       - Smazat článek (auth)

GET  /api/images         - Seznam obrázků
POST /api/images/upload  - Nahrát obrázek (auth)

GET  /api/comments/:newsId - Komentáře k článku
POST /api/comments       - Přidat komentář (auth)
```

### Kontakt pro technickou podporu

V případě problémů kontaktujte technickou správu webu.
info@sachyjablonec.cz

### Lokální vývoj a Dockerizace
Pro naprosto přesné zrcadlení produkčního prostředí (včetně izolované databáze) využijte Docker:
```bash
# Spuštění kompletního stacku (Postgres DB + Node.js nodemon hot-reload)
docker compose up
```
*Tento příkaz nabootuje izolovanou lokalní databázi a připojí vaši aktuální složku do pracovního běhu. Odstraní se tak riziko selhání ignorovaných souborů (Fáze 2: Zvýšení efektivity)*

---

*Tento manuál je součástí dokumentace projektu Šachy Jablonec.*
