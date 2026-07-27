# Deployment Checklist

> [!IMPORTANT]
> **Database Structure Changes**: This deployment includes 3 critical database migrations (`Image` model: sortOrder, category, default visibility). These MUST be applied to the production database for the gallery to work.

## 1. Deploy Code
- [x] Code Changes Pushed to Repository
- [ ] Verify Railway Auto-Deploy (Check Railway Dashboard)

## 2. Apply Database Migrations (CRITICAL)
Since you are using Railway, the safest way is to use their CLI or your local setup pointed to their connection string.

**Option A: Using Railway CLI (Recommended)**
Open your terminal and run:
```bash
railway run npx prisma migrate deploy
```

**Option B: Local Machine with Env Var**
1. Get the **Production** Database URL from Railway Dashboard.
2. Run this command locally (replace YOUR_PROD_URL):
```bash
DATABASE_URL="postgres://..." npx prisma migrate deploy
```

## 3. Verify Deployment
After deployment and migration:
1. **Gallery**: Visit `/gallery`. Check if images load.
2. **Admin**: Log in to `/admin.html`. Go to **Galerie** tab.
    - [ ] Check if `Sort Order`, `Kategorie`, and `Skryté` columns appear.
    - [ ] Try to hide/unhide an image.
3. **Game Viewer**:
    - [ ] Visit Article `/article.html?id=54` on Mobile (or resize browser).
    - [ ] Verify Chess Board height and Notation visibility.
    - [ ] Verify 'Pouze komentované' filter checkbox behavior.

> [!WARNING]
> If you skip Step 2, the Admin Panel Gallery tab will crash or fail to load images because it expects columns `sortOrder` and `category` which won't exist yet properly.

## 4. Configuration Reference
**Production Database URL** (For future migrations):

> ⚠️ Nikdy necommituj připojovací řetězec sem ani do žádného souboru v repu.
> Najdeš ho v **Railway → projekt → Postgres → Connect / Variables** (`DATABASE_URL`).
> Backend ho čte z env proměnné `DATABASE_URL`.

### Upozornění na nový los (WhatsApp)

Dashboard `/pardubice` pozná, že je na chess-results venku los dalšího kola.
Kromě web push umí zprávu poslat na WhatsApp **jednomu člověku**, který ji
přepošle do rodičovské skupiny — WhatsApp API neumí psát do skupin přímo.

Bránou je [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/).
Je zdarma a bez schvalování, ale jde o neoficiální službu třetí strany, takže
**web push zůstává hlavním kanálem** a WhatsApp je jen navíc.

**Aktivace (musí udělat příjemce na svém telefonu):**
1. Na stránce CallMeBotu si opsat aktuální číslo bota — *číslo se čas od času mění,
   ber ho vždy z webu, ne z téhle dokumentace*.
2. Uložit ho do kontaktů a poslat mu ve WhatsAppu přesně: `I allow callmebot to send me messages`
3. Bot odpoví API klíčem. Ten klíč předat správci webu (ne e-mailem do sdílené schránky).

**Nastavení v Railway → Variables** (hodnoty nikdy nepiš do repa — je veřejný):

| Proměnná | Význam |
|---|---|
| `WHATSAPP_ENABLED` | `true` zapne odesílání, cokoli jiného vypne |
| `WHATSAPP_PROVIDER` | zatím jen `callmebot` |
| `CALLMEBOT_PHONE` | telefon příjemce v mezinárodním tvaru |
| `CALLMEBOT_APIKEY` | klíč od bota |
| `WHATSAPP_MAX_PER_DAY` | strop zpráv za 24 h (výchozí 12) |

**Ověření po nasazení:** jako admin zavolat `POST /api/camp/pardubice/test-whatsapp`
a nechat si od příjemce potvrdit, že zpráva dorazila.

**Když brána nefunguje:** `GET /api/camp/pardubice/wa-link` (admin) vrátí `wa.me` odkaz
s předvyplněným losem — otevřít, odeslat ručně. Vypnout jde kdykoliv nastavením
`WHATSAPP_ENABLED=false`, na zbytku webu to nic nezmění.

**Když příjemce skončí:** změnit `CALLMEBOT_PHONE` a `CALLMEBOT_APIKEY`, nástupce
projde aktivací výše. V kódu ani v gitu není žádné číslo — proto to jsou env proměnné.

## 5. URL Aliases
- `/bleskovy_report` -> `/article.html?id=54`
