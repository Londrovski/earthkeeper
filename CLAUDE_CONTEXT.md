# Earthkeeper — Claude Context

Read this first when starting work on Earthkeeper. It's the quick-start for a fresh
session: what the app is, how it's built, and the runbooks for the things we actually
do — chiefly **adding locations** and **deploying**.

---

## What it is

A single-page web app for a small group of UK energy-healing practitioners. They record
energetic "clearings" of locations (hospitals, hospices, prisons, universities, schools,
GP surgeries) across the UK, plus district-level group clearings. Every action is written
to an append-only audit trail.

- **Live:** https://londrovski.github.io/earthkeeper/ (GitHub Pages; moving to Cloudflare — see Hosting)
- **Repo:** https://github.com/Londrovski/earthkeeper (public)
- **Supabase project:** `wxdqncumgfarehwlsbuo` ("Earthkeeper", eu-west-1)
- **Backups:** https://github.com/Londrovski/Backup (private)

---

## Architecture

No build step, no framework, no bundler. `index.html` is a thin shell that loads **7 CSS +
23 JS files** in numbered order via `defer`, each cache-busted with `?v=N`.

- `js/01-config.js` … `js/23-boot.js` (load order matters)
- `css/base, layout, components, map, mobile, desktop, debug`
- Map: MapLibre GL JS. Theme: dark green `#0D2416` + gold `#C9A84C`.
- Auth: client-side SHA-256 of a shared group password, persisted in `localStorage`.

(Files are small now — the old 124KB monolith was split in April 2026. Normal
`github:create_or_update_file` / `push_files` work fine; the old "push via urllib to avoid
unicode corruption" advice is obsolete.)

---

## Data — where everything lives (two stores, deliberately split)

**Supabase** (`wxdqncumgfarehwlsbuo`) holds all dynamic + catalogue data — 4 tables:

- `progress` — individual clearings. `id` = a location id, plus `tool, ew, date, user, name`.
- `group_progress` — district group clearings. `id` like `"E09000030:school"`.
- `audit_log` — append-only trail of every clear/unclear.
- `locations` — the location catalogue, **38,385 rows**. Migrated here June 2026 (was static JSON).

**GitHub static files** (served from `raw.githubusercontent.com`) hold only:

- `data/districts.geojson` — 361 LAD boundary polygons (Groups tab). Kept static on purpose
  (polygons want PostGIS for no real benefit here). **Must stay.**
- the app code itself.

The browser reads `locations` / `progress` / etc. with the **public anon key** (in
`01-config.js`; safe — RLS-governed). A realtime WebSocket keeps open tabs in sync.

> The old `data/hospitals-*.json`, `schools-*.json`, `gps-*.json`, etc. are now **unused**
> (superseded by the `locations` table) and can be deleted. `data/districts.geojson` stays.

---

## `locations` table schema

```
id            text  primary key   -- MUST follow the id scheme below
type          text                -- hospital|hospice|prison|university|school|gp
name          text
address       text
postcode      text
lat, lng      double precision    -- required to appear on the map
district_code text                -- LAD code; REQUIRED for school/gp to roll up in Groups tab
region        text                -- one of the 12 regions (drives region loading)
nation        text                -- england|wales|scotland|northernireland
meta          jsonb               -- type-specific extras, e.g. {"independent": false}, {"place_id": "..."}
active        boolean
```

**RLS: anon `SELECT` only — read-only to the public.** Writes need elevated access
(Supabase MCP `execute_sql`, the Supabase dashboard, or a service key) — **never** the anon
key, and never make this table anon-writable.

---

## RUNBOOK — adding location(s)  ← the main recurring task

The catalogue is read-only to the public, so **Claude adds rows directly via the Supabase
MCP** (`execute_sql`, project `wxdqncumgfarehwlsbuo`). No code change, no redeploy.

For each new place, assemble:

1. **type** — one of `hospital|hospice|prison|university|school|gp`.
2. **id** — follow the existing prefix scheme (so it's unique and consistent):
   - hospital → `hosp-<slug>` · hospice → `hospice-<slug>` · prison → `prison-<slug>`
   - university → `uni-<slug>` · school → `school-<URN>` · gp → `gp-<code>`
   - For a manual add with no natural source id, use a stable lowercase-hyphenated slug with
     the right prefix. **ids must be unique and must never collide with an existing one** —
     `progress` rows reference location ids, so a clash/mismatch corrupts clearing state.
3. **region** — which of the 12: `london, southeast, southwest, eastengland, eastmidlands,
   westmidlands, yorkshire, northwest, northeast, wales, scotland, northernireland`. Decides
   which region-load surfaces it.
4. **lat / lng** — required. If you only have a postcode, geocode free via postcodes.io:
   `POST https://api.postcodes.io/postcodes` body `{"postcodes":[...]}` → `result[].result.latitude/longitude`.
5. **district_code** (schools & GPs only) — the LAD code, e.g. `E09000030`. **Required** for the
   place to appear under its district in the Groups tab. postcodes.io returns it as
   `codes.admin_district`. Leave `null` for hospital/hospice/prison/university.
6. **nation** — `england` unless the region is wales / scotland / northernireland.
7. **meta** — optional jsonb (`{"independent": false}` etc.) or `null`.

Insert with an upsert so re-runs are safe:

```sql
insert into public.locations
  (id, type, name, address, postcode, lat, lng, district_code, region, nation, meta, active)
values
  ('hosp-new-example','hospital','New Example Hospital','1 High St, Town','AB1 2CD',
   51.5,-0.1,null,'london','england',null,true)
on conflict (id) do update set
  type=excluded.type, name=excluded.name, address=excluded.address, postcode=excluded.postcode,
  lat=excluded.lat, lng=excluded.lng, district_code=excluded.district_code,
  region=excluded.region, nation=excluded.nation, meta=excluded.meta, active=excluded.active;
```

Then verify: `select * from public.locations where id = '…';` — confirm `lat/lng` set and
(for schools/GPs) `district_code` populated. The app picks it up on the next region load.

---

## Deploy / cache-bust

- Push code to a **branch** → Cloudflare gives a **preview URL** for it → test there → merge
  to `main` for production.
- On **any** change to a JS/CSS file, bump its `?v=N` in `index.html` (or the global N) so
  browsers don't serve stale code. **Current: `v=25`.**
- `node --check` changed JS before pushing — cheap insurance; one syntax error blanks the app.

---

## Hosting (migrating GitHub Pages → Cloudflare)

- `wrangler.jsonc` (repo root) declares the site as **static assets** — no build, no Worker
  script (`assets.directory: "."`). `.assetsignore` keeps repo internals out of the upload.
- Branch builds: `npx wrangler versions upload` → preview URL. Production (main):
  `npx wrangler deploy`.
- Cloudflare project's `name` must match `wrangler.jsonc`'s `name`.
- **If we ever add a self-serve "add location" form**, it becomes a Worker route holding
  `SUPABASE_SERVICE_ROLE_KEY` as a Cloudflare **encrypted Secret** (server-side only — a
  service key must never reach the browser). Decided June 2026 **not** to build this yet;
  Claude adds locations on request instead (see runbook).

---

## Backups

- **Real backup:** `Londrovski/Backup` → `.github/workflows/supabase-nightly.yml` (00:05 UTC).
  Daily snapshots of `progress`/`group_progress` + `audit_log` (rolling daily + monthly
  rollup, self-healing). Healthy. Doubles as Supabase keep-alive.
- **Code backup:** git history + manual freezes in `Backup/snapshots/`. We keep iterations on
  backup branches and don't ship `main` until confirmed working.
- **Removed June 2026:** the old `sync.yml` + `sync/` (abandoned auto-import experiment) and
  `daily-backup.yml` (redundant static-data copy) — both only ever emailed failures.

---

## Security invariants

- `01-config.js` holds only the **public anon key** (safe; RLS enforces policy).
- `audit_log` is append-only: anon `select` + `insert`, **no** update/delete policy. Don't add one.
- `locations` is anon read-only. Don't make it anon-writable; don't put a service key in client JS.
- A real GitHub PAT was once committed in `data/config.json` — revoked + scrubbed June 2026.
  `config.json` now holds only the (client-side, intentionally public) password hash.

---

## Known pitfalls

- **Location `id` scheme is load-bearing** — `progress` references location ids; keep them consistent.
- **`backdrop-filter` on `.sidebar`** creates a containing block for `position:fixed` children
  (caused the mobile bottom-sheet mis-position). Disabled on mobile.
- **MapLibre `easeTo` offset sign** for mobile bottom sheets: negative `y` pushes the target
  up into the visible region above the sheet.

*Last updated: 16 June 2026.*
