# Texas Stores Management

Daily profit dashboard for Chillers POS. Stores your spreadsheet data (ingredients, BOMs, pricing, mixes) in Postgres so you can edit everything here instead of Google Sheets.

## What it does

- **Daily Profits**: pulls sales from the POS (`/api/sales`), matches each sold item to its BOM, and shows per-item profit (revenue − ingredient/packaging cost) plus the day's net profit after a flat **$200/day overhead** (editable in Settings).
- **History**: net profit per day over a date range.
- **Products & BOM**: edit recipes and sell prices; costs update automatically.
- **Ingredients**: the Main tab of your sheet — edit cost per unit and every BOM updates.
- **Mixes**: your prepared mixes; one click applies a mix's $/oz to its linked ingredient.
- **POS Mapping**: connects POS item names ("Elote Chico") to products ("4001 Vaso chico"). New POS items show up flagged as unmapped until you map them.

All spreadsheet data is pre-loaded on first boot (seeded once into the database).

## Deploy on Railway

1. Push this code to `mariodelcid/texas-stores-management-test`:
   ```
   git init
   git add .
   git commit -m "Management app"
   git remote add origin https://github.com/mariodelcid/texas-stores-management-test.git
   git push -u origin main --force
   ```
2. In your Railway project, add a **PostgreSQL** database (right-click canvas → Database → PostgreSQL).
3. On the app service → **Variables**, add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference the Postgres service)
   - `POS_URL` = `https://texasstores.up.railway.app` (optional, this is the default)
4. Railway builds and runs `npm start`, which creates the tables, seeds the spreadsheet data (first boot only), and starts the server.
5. On the service → Settings → Networking → **Generate Domain** to get a URL.

## Notes

- Revenue always uses the actual POS sale price, so price changes in the POS are reflected automatically.
- "Elote Entero" is intentionally unmapped (it has no BOM in the sheet). Create a product + BOM for it, then map it in POS Mapping.
- "Toppings" and "Discount" are mapped as *no cost* — their full amount counts as profit (discounts subtract, since they're negative).
- Days are grouped in America/Chicago time (override with `TZ_NAME`).
