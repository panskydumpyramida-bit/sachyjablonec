# Database Management Guide

## Lokální PostgreSQL Setup

### Předpoklady
- Homebrew nainstalovaný
- PostgreSQL 16 a 17 (17 pro kompatibilitu s Railway)

### Instalace (jednorázově)
```bash
brew install postgresql@16 postgresql@17
brew services start postgresql@16
/opt/homebrew/opt/postgresql@16/bin/createdb sachyjablonec
```

### Spuštění/Zastavení služby
```bash
# Spustit
brew services start postgresql@16

# Zastavit
brew services stop postgresql@16

# Status
brew services list
```

---

## Konfigurace

### Lokální prostředí (.env)
```env
DATABASE_URL="postgresql://antoninduda@localhost:5432/sachyjablonec"
```

### Production (Railway)
```env
DATABASE_URL="postgresql://postgres:xxx@ballast.proxy.rlwy.net:53432/railway"
```

> ⚠️ **DŮLEŽITÉ:** Nikdy necommituj `.env` soubor!  
> Schema v `prisma/schema.prisma` MUSÍ mít `provider = "postgresql"`.  
> SQLite (`provider = "sqlite"`) způsobí selhání deploy na Railway.

---

## Synchronizace dat z Railway

### 1. Stáhni dump z Railway
```bash
/opt/homebrew/opt/postgresql@17/bin/pg_dump \
  "postgresql://postgres:OtipCqePUylBIvIqGxGBNJNpeDYDMHfc@ballast.proxy.rlwy.net:53432/railway" \
  --no-owner --no-acl > railway_dump.sql
```

### 2. Importuj do lokální DB
```bash
# Vymaž existující schéma a vytvoř nové
/opt/homebrew/opt/postgresql@16/bin/psql sachyjablonec \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Importuj data
/opt/homebrew/opt/postgresql@16/bin/psql sachyjablonec < railway_dump.sql
```

### Jednořádkový příkaz
```bash
/opt/homebrew/opt/postgresql@17/bin/pg_dump "postgresql://postgres:OtipCqePUylBIvIqGxGBNJNpeDYDMHfc@ballast.proxy.rlwy.net:53432/railway" --no-owner --no-acl > railway_dump.sql && \
/opt/homebrew/opt/postgresql@16/bin/psql sachyjablonec -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" && \
/opt/homebrew/opt/postgresql@16/bin/psql sachyjablonec < railway_dump.sql
```

---

## Prisma Příkazy

```bash
# Synchronizuj schéma s databází (vytvoří/upraví tabulky)
npx prisma db push

# Vygeneruj Prisma Client
npx prisma generate

# Otevři Prisma Studio (GUI pro prohlížení dat)
npx prisma studio

# Reset databáze (POZOR: smaže všechna data!)
npx prisma migrate reset
```

---

## Best Practices

### ✅ Dodržuj
1. **Vždy používej PostgreSQL** - lokálně i v produkci
2. **Kontroluj schéma před commitem** - `provider = "postgresql"`
3. **Pravidelně synchronizuj data** z produkce pro testování
4. **Zálohuj před destruktivními operacemi** (DROP, migrate reset)

### ❌ Neděj
1. **Necommituj `.env`** - obsahuje citlivé údaje
2. **Neměň provider na sqlite** - způsobí deploy failure
3. **Nepouštěj migrate reset na produkci** - smaže všechna data

---

## Troubleshooting

### Port 3001 je obsazený
```bash
lsof -ti:3001 | xargs kill -9
```

### Prisma client je out of sync
```bash
npx prisma generate
```

### pg_dump version mismatch
Použij pg_dump ze stejné verze jako vzdálený server:
```bash
# Railway má PostgreSQL 17
/opt/homebrew/opt/postgresql@17/bin/pg_dump ...
```

### Připojení k lokální databázi
```bash
/opt/homebrew/opt/postgresql@16/bin/psql sachyjablonec
```
