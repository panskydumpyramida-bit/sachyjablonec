# Souhrn změn - 9. 12. 2025

## 1. Web a URL
- **Čisté URL**: Implementována podpora pro adresy bez přípony `.html` (např. `/blicak` místo `/blicak.html`).
- **Blicák**: 
    - Aktualizace textů (ELO LOK BLESK, malé "ela").
    - Zmenšení písma poznámky o zápočtu.

## 2. Propozice turnaje (PDF Export)
Vytvořeny 4 grafické verze propozic pro tisk do PDF:
1. **Dark verze**: `blicak-propozice.html` (pro digitální sdílení)
2. **Print verze**: `blicak-propozice-print.html` (bílé pozadí pro tisk, úsporný layout)
3. **Dark s fotkou**: `blicak-propozice-foto.html` (obsahuje fotku Č. Drobníka)
4. **Print s fotkou**: `blicak-propozice-print-foto.html`

*Všechny verze jsou optimalizovány pro formát A4 na výšku.*

## 3. Opravy Soutěží družstev (Teams)
- **Oprava zobrazení A/B týmu**: 
    - Upraven `teams.html` pro přesné rozlišení týmů "A" a "B" (dříve se překrývaly).
    - Opravena scraping logika na serveru (`server.js`), aby správně přiřazovala zápasy týmům s jednopísmenným označením (A, B, C...).
- **Výsledek**: Karty pro A tým a B tým nyní zobrazují správné a odlišné údaje o zápasech.
