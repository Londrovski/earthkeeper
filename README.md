# 🌍 Earthkeeper

Energy healing location tracker for the UK. Maps every hospital, school and university — mark each one as cleared as you go.

## Stack

- **Frontend** — single `index.html`, hosted on Netlify
- **Database** — Supabase (Postgres): `locations` table + `progress` table
- **Data sync** — Node.js script (`sync/sync.js`) run weekly via GitHub Actions
- **Data sources** — DfE GIAS (schools), CQC register (hospitals), HESA (universities)
- **Geocoding** — postcodes.io (free, no key needed)

## Setup

### 1. Supabase
Create a project at supabase.com and run the SQL in `supabase/schema.sql`.

### 2. GitHub Secrets
Add these in repo Settings → Secrets → Actions:
- `SUPABASE_URL` — your project URL
- `SUPABASE_SERVICE_KEY` — your service role key (not the anon key — this one can write)

### 3. Netlify
Connect this repo to Netlify. Set build command to blank, publish directory to `/`. Add environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### 4. Run first sync
Go to Actions → Earthkeeper Data Sync → Run workflow. This populates the database.

## Regions

Currently syncing:
- **London** (all boroughs)
- **Somerset** (incl. Bath & Bristol)
- **Hertfordshire**

Expand to full UK by removing the region filter in `sync/sync.js`.

## Data freshness

The sync script runs every Sunday at 3am. It adds new locations, marks closed ones inactive, and never touches your progress data.
