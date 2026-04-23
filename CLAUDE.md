# Šachy Jablonec (Bižuterie) — Projektový kontext

## Co to je
Web šachového klubu **Bižuterie Jablonec**. Obsahuje články, výsledky turnajů, členskou sekci s tréninkovými nástroji a administraci.

## Spuštění
```bash
# Backend API (localhost:3001)
npm install && npm run dev

# Frontend — statické HTML, otevřít přímo nebo přes live server
```
DB: SQLite (`dev.db`) přes Prisma. Prod: PostgreSQL na Railway.

## Architektura

```
sachy_jablonec_export/
├── *.html               # 29 stránek frontendu (vanilla HTML/CSS/JS)
│   ├── index.html, about.html, calendar.html
│   ├── admin.html       # Administrace (JWT auth)
│   ├── blicak.html      # Blic turnaj
│   ├── blunder-grid.html# Trénink chyb (Blunder Grid)
│   ├── chess-database.html
│   └── ...
├── components/          # Sdílené HTML komponenty (header, footer)
├── cloudflare/          # Cloudflare Workers/Pages konfigurace
├── CHANGELOG.md         # ← Zde se píše changelog (markdown, ne JS)
├── ADMIN_MANUAL.md      # Manuál pro adminy
├── DEPLOYMENT.md        # Deploy instrukce
└── ROADMAP.md           # Plánované featury
```

## Stack
- **Frontend**: Vanilla HTML + CSS + JavaScript (žádný framework)
- **Backend**: Node.js + Express + Prisma ORM
- **DB**: SQLite (dev) / PostgreSQL (prod na Railway)
- **Auth**: JWT
- **Šachový engine**: Stockfish 17 (přes chess-api), fallback na Lichess API
- **Deploy**: Railway (backend) + Netlify/Cloudflare (frontend)
- **Aktuální verze**: v31

## Klíčové featury
- **Blunder Grid**: trénink vlastních chyb z partií, Win% threshold slider, Stockfish evaluace
- **Šachový viewer**: PGN parser s podporou variant, navigace tahů
- **WYSIWYG editor článků**: slash příkazy (`/vitezove`, `/karty`, `/cta`), šablonové bloky
- **Admin panel**: správa článků, členů, turnajů (JWT auth)
- **Lichess + local DB**: dual source pro partie

## Changelog konvence
- Soubor: `CHANGELOG.md` (markdown, ne JS jako u ReviewSight)
- Formát: `## DD. měsíce YYYY (vXX)` + sekce s emoji a bullet listy
- Verze: číslo `vXX` (ne semver)

## Deploy
- Backend env vars v Railway dashboard
- `ALLOWED_ORIGINS` musí obsahovat frontend URL
- `DATABASE_URL` pro PostgreSQL na Railway
