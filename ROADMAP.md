# Roadmap - Šachy Jablonec

Plán budoucího vývoje webu sachyjablonec.cz.

---

## 🎯 Priorita 1: Refaktoring ukládání partií

**Cíl:** Změnit způsob ukládání šachových partií tak, aby je bylo možné používat napříč všemi sekcemi webu.

### Současný stav
- Partie jsou vázány na konkrétní reporty/články
- Nelze je sdílet mezi sekcemi (mládež, družstva, novinky)
- Duplicita při zobrazení stejné partie na více místech

### Plánované změny
- [ ] Nový databázový model `Game` oddělený od článků
- [ ] Vazební tabulky pro přiřazení partií k různým entitám
- [ ] API endpoint pro CRUD operace s partiemi
- [ ] Univerzální přehrávač partií použitelný v libovolné sekci
- [ ] Import PGN souborů do centrální databáze
- [ ] Tagování partií (hráč, turnaj, datum, výsledek)

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

*Poslední aktualizace: 11. 12. 2025*
