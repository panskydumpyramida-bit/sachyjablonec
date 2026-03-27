# Zlepšení Slash příkazů a Editoru

Cílem tohoto plánu je zpřesnit fungování „Slash (lomítko)“ příkazů, přidat konfigurační modály pro generované bloky (aby se daly vyplnit ještě před vložením) a pročistit panel nástrojů editoru.

## Proposed Changes

### 1. Oprava spouštění Slash příkazů (`/`)
Aktuálně vyskakuje menu i při napsání textu jako `1/2`.
**Řešení:** Úprava regulárního výrazu (Regex) v `handleSlashInput` v souboru `admin-slash-commands.js`. Příkaz se aktivuje POUZE pokud je `/` na začátku řádku nebo mu bezprostředně předchází mezera. 

### 2. Konfigurační modály pro šablony
Univerzální "hranaté závorky" sice fungují lépe, ale stále je nepohodlné je přepisovat textem.
Místo přímého vložení HTML ukážeme modál, kde uživatel zadá potřebná data, a až po kliknutí na "Vložit" se vygeneruje čistý HTML blok.
- **Box Vítězů:** Zadá se Nadpis boxu (předvyplněno: Přehled vítězů). Lze rovnou přidat dynamický formulář pro řádky (Rok: Jméno | Jméno | Jméno), nebo vložit jen prázdnou tabulku s jedním chytře předvyplněným řádkem. Opravdu bych navrhoval jen *Zadat Nadpis boxu* a *Počet řádků k vygenerování*.
- **Karty medailistů:** Zadá se Název 1. kategorie a Název 2. kategorie.
- **CTA tlačítko:** Zadá se Text nadpisu, Text samotného tlačítka a cílové URL. (A volitelný podtitulek).

Tyto modály napojíme klasicky do stejného systému jako má editor pro vkládání odkazů a obrázků.

### 3. Analýza tlačítek v liště a re-design
Máme v liště spoustu tlačítek a **duplicitní ikony**. Zde je návrh na pročištění:

- `Skóre` (Zvýrazňovač skóre) momentálně používá ikonku poháru (🏆 `fa-trophy`). Změníme ho na terč nebo šachovou figurku, případně čísla, aby se nepletlo s Boxem Vítězů (kde pohár dává větší smysl). Např: `fa-bullseye` nebo `fa-hashtag`.
- `Závěrečné tlačítko (CTA)` momentálně ukazuje ikonku odkazu (🔗 `fa-link`). Koliduje s normálním vložením odkazu (Ctrl+K). Změníme na ikonu megafonu (`fa-bullhorn`) nebo bloku tlačítka (`fa-square-up-right`), nebo ikonu kurzoru (`fa-arrow-pointer`).
- `Lomítko / šablony` můžou zůstat v liště pro případ, že zapomenete zkratku, ale pro běžnou práci bude lepší mít lištu čistší. Navrhuji tlačítka "Box Vítězů", "Karty", "CTA", "Sloupce", "Rozbalovací" skrýt do jednoho drop-down menu nazvaného **"Šablony (+)"** s ikonkou `fa-plus-square` nebo `fa-puzzle-piece`, čímž se prostor krásně provzdušní. Nebo je nechat viditelné, ale dát jim vlastní barvené pozadí či oddělovač.

---

> [!IMPORTANT]
> **User Review Required**
> 1. Chceš u ikonek nechat všechny šablony volně (tedy jen změním duplicitní ikony skóre/odkazu), nebo je raději sloučíme do jednoho rozbalovacího "Plus" menu v liště editoru, čímž se to ohromně zjednoduší?
> 2. Pro konfigurační modály: Má u "Boxu Vítězů" vyskočit reálný formulář, kam vypíšeš Jména přímo a my to za tebe složíme, NEBO stačí jen zadat "Nadpis" a "Počet ročníků" a zbytek dovyplníš na obrazovce (což je možná rychlejší)?

## Verification Plan
Obejitím automatických testů si v lokálním prostředí ručně vyzkouším:
1. Funkčnost `1/2` nedokáže aktivovat slash příkaz.
2. Vytvoření všech tří prvků přes Slash modul vyvolá Modal.
3. Kontrola UI panelu nástrojů, zda vypadá profesionálněji a čistěji.
