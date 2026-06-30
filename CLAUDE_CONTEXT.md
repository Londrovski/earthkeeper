# Earthkeeper — Claude Context

Read this first when starting work on Earthkeeper. It's the quick-start for a fresh
session: what the app is, how it's built, and the runbooks for the things we actually
do — chiefly **adding locations** and **deploying**.

---

## What it is

A single-page web app for a small group of energy-healing practitioners. They record
energetic "clearings" of locations (hospitals, hospices, prisons, universities, schools,
GP surgeries), plus district-level group clearings. Every action is written to an
append-only audit trail.

**Going multi-country (June 2026).** UK is live; Australia is the first expansion (test
case for worldwide). Per-country data lives in **per-country tables** (`_uk` live, `_au`
pending); the active country is chosen **per account** and the front-end resolves the right
tables at runtime. See "Country model" and "Data" below.

- **Live:** https://londrovski.github.io/earthkeeper/ (GitHub Pages; moving to Cloudflare — see Hosting)
- **Repo:** https://github.com/Londrovski/earthkeeper (public)
- **Supabase project:** `wxdqncumgfarehwlsbuo` ("Earthkeeper", eu-west-1)
- **Backups:** https://github.com/Londrovski/Backup (private)

---

## Architecture

No build step, no framework, no bundler. `index.html` is a thin shell that loads **7 CSS +
25 JS files** in numbered order via `defer`, each cache-busted with `?v=N`.

- `js/01-config.js` … `js/26-users.js` (load order matters)
- `css/base, layout, components, map, mobile, desktop, debug`
- Map: MapLibre GL JS. Theme: dark green `#0D2416` + gold `#C9A84C`.
- Auth: client-side SHA-256 of a shared group password, persisted in `localStorage`.

---

## Country model (how multi-country works)

`01-config.js` defines `EK_COUNTRIES` (UK + AU), each mapping the logical table set to
physical names (UK → `_uk`, AU → `_au`). `getCountry()`/`setCountry()` read/write the active
country (cached in `localStorage` as `ek_country`, synced from the logged-in account's
`users.country`). **`TABLES` is a Proxy** — `TABLES.progress`, `TABLES.locations`, etc.
resolve to the active country's physical table name at access time.

**Every DB reference goes through `TABLES.*`, never a literal table name** — `06-api`
(progress/group_progress/audit_log reads, writes, **and realtime channel joins**),
`07-data-loader` (locations/districts), `04-debug`. NOTE: MapLibre source names like
`'locations'` in `09-map-layers`/`11-map-render` are **client-side map sources, not DB
tables** — don't rename those.

**Per-account country:** `users.country` (`'UK'`|`'AU'`, default UK). The login screen and
account menu have a country select; `doLogin`/`saveAccountChanges` persist it via
`usersUpsert(...,country)`; `usersGetCountry` restores it on auto-login; `pickUser` prefills
it from the name autocomplete. Switching country re-boots the app to load that dataset.

---

## Data — where everything lives (Supabase)

**Supabase** (`wxdqncumgfarehwlsbuo`) holds all dynamic + catalogue data. Per-country tables
(`_uk` live; `_au` siblings pending), plus two shared tables:

- `progress_uk` — individual clearings. `id` = a location id, plus `tool, ew, date, user, name`.
- `group_progress_uk` — district group clearings. `id` like `"E09000030:school"`.
- `audit_log_uk` — append-only trail of every clear/unclear.
- `locations_uk` — the location catalogue, **38,386 rows**. (Renamed from `locations` June 2026.)
- `districts_uk` — 361 LAD boundary polygons (`code`, `name`, `geometry` jsonb).
- `app_settings` — design tokens (`key` → `jsonb`): `colors`, `tools`, etc. **Shared** (no suffix).
- `users` — login memory (`name` pk, `tool`, `ew`, **`country`**, `updated_at`). **Shared** (no suffix).

**GitHub static files** now hold only the app code itself. The entire `/data` folder was
removed June 2026 — locations and districts both live in Supabase now.

The browser reads with the **public anon key** (in `01-config.js`; safe — RLS-governed). A
realtime WebSocket keeps open tabs in sync.

---

## `locations_uk` table schema

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
**Target the UK table `locations_uk`** (swap to `_au` once those exist).

For each new place, assemble:

1. **type** — one of `hospital|hospice|prison|university|school|gp`.
2. **id** — follow the existing prefix scheme (so it's unique and consistent):
   - hospital → `hosp-<slug>` · hospice → `hospice-<slug>` · prison → `prison-<slug>`
   - university → `uni-<slug>` · school → `school-<URN>` · gp → `gp-<code>`
   - For a manual add with no natural source id, use a stable lowercase-hyphenated slug with
     the right prefix. **ids must be unique and must never collide with an existing one** —
     `progress_uk` rows reference location ids, so a clash/mismatch corrupts clearing state.
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
insert into public.locations_uk
  (id, type, name, address, postcode, lat, lng, district_code, region, nation, meta, active)
values
  ('hosp-new-example','hospital','New Example Hospital','1 High St, Town','AB1 2CD',
   51.5,-0.1,null,'london','england',null,true)
on conflict (id) do update set
  type=excluded.type, name=excluded.name, address=excluded.address, postcode=excluded.postcode,
  lat=excluded.lat, lng=excluded.lng, district_code=excluded.district_code,
  region=excluded.region, nation=excluded.nation, meta=excluded.meta, active=excluded.active;
```

Then verify: `select * from public.locations_uk where id = '…';` — confirm `lat/lng` set and
(for schools/GPs) `district_code` populated. The app picks it up on the next region load.

---

## RUNBOOK — marking a location cleared

A clearing = one row in `progress_uk` (+ a matching `audit_log_uk` row, as the app writes).
Insert via the Supabase MCP. Fields:

- **id** — the `locations_uk.id` being cleared (e.g. `hosp-practice_plus_emersons_green`).
- **tool** — the tool **code**, NOT the name: `MS, MF, O, J, MG, AP, MI, MJ, DM`
  (Omega=`O`, Jewel=`J`, Merlin's Grace=`MG`, …). `progress_uk.tool` holds the code.
- **ew** — `EW1`…`EW5` if an Earthworks add-on was used, else `null`.
- **date** — the clearing date `YYYY-MM-DD`.
- **"user"** — the practitioner's full name, e.g. `James Morris` (note: reserved word, quote it).
- **name** — the **location's** name (used for the Log display), not the user's.

```sql
insert into public.progress_uk (id, tool, ew, date, "user", name)
values ('hosp-practice_plus_emersons_green','O',null,'2026-05-06','James Morris','Practice Plus Group Hospital, Emersons Green')
on conflict (id) do update set tool=excluded.tool, ew=excluded.ew, date=excluded.date, "user"=excluded."user", name=excluded.name;

insert into public.audit_log_uk (action, target_id, target_name, target_type, tool, ew, previous_tool, "user", created_at)
values ('clear','hosp-practice_plus_emersons_green','Practice Plus Group Hospital, Emersons Green','hospital','O',null,null,'James Morris','2026-05-06T09:00:00Z');
```

(Group/district clearings go in `group_progress_uk` instead, id `"DISTRICTCODE:school"` / `":gp"`.)
No redeploy — appears gold on the map on the next region load.

Tip: from a Google Maps link, the redirect URL contains the place name + full address +
postcode; geocode the postcode via postcodes.io (above) for lat/lng.

## Design tokens (app_settings)

Colours and other design knobs live in the Supabase `app_settings` table (`key` → `jsonb`,
anon read-only, **shared across countries**). `js/25-settings.js` fetches it at boot, applies
values as CSS custom properties on `:root`, refreshes the JS colour constants (`GOLD` /
`TYPE_COLORS` / `TOOL_COLORS` in `01-config.js`, which read from CSS vars), and re-styles the
live map. So the palette has **one source**: `app_settings` (with `base.css` `:root` as
fail-safe fallback).

**To change a colour** (or any token): edit the row in Supabase — no code edit, no redeploy.
Example: `update app_settings set value = jsonb_set(value,'{gold}','"#D4AF37"') where key='colors';`
then refresh. It propagates to chips, panels, map dots, badges — everywhere.

Current keys: `colors` (forest, gold, red/blue/violet/teal/amber/green…), `tools` (omega, jewel, mg).

## Deploy / cache-bust

- Push code to a **branch** → Cloudflare gives a **preview URL** for it → test there → merge
  to `main` for production. (Recent country/rename work went straight to `main` at James's request.)
- On **any** change to a JS/CSS file, bump its `?v=N` in `index.html` (or the global N) so
  browsers don't serve stale code. **Current: `v=32`.**
- `node --check` changed JS before pushing — cheap insurance; one syntax error blanks the app.

### Pushing files safely (learned the hard way, June 2026)

Hand-typing file contents into a GitHub MCP push **can corrupt non-ASCII bytes** — a real
incident replaced an ASCII char in the base64 anon key with a Cyrillic look-alike, which
broke all Supabase calls until caught. So:

- Prefer feeding **exact bytes**; if you must paste, first make the file **pure ASCII**
  (escape non-ASCII in JS as `\uXXXX`; use HTML numeric entities in HTML) so transcription
  can't corrupt it.
- **Always verify after pushing**: re-fetch the live file and `md5sum` / `node --check` it
  against your source. Don't trust the push blindly.

(This supersedes the earlier "unicode corruption advice is obsolete" note — it is NOT obsolete
for hand-pasted MCP pushes.)

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
  rollup, self-healing). Healthy. Doubles as Supabase keep-alive. Also snapshots
  `locations` / `districts` / `app_settings` (latest-only, in `earthkeeper/reference/`).
  **NOTE:** the backup workflow still references the **old (pre-`_uk`) table names** — update
  it to the `_uk` tables (and add `_au` when live) so backups don't silently target missing
  tables. (Flagged June 2026; not yet done.)
- **Code backup:** git history + manual freezes in `Backup/snapshots/`. We keep iterations on
  backup branches and don't ship `main` until confirmed working.
- **Removed June 2026:** the old `sync.yml` + `sync/` (abandoned auto-import experiment) and
  `daily-backup.yml` (redundant static-data copy) — both only ever emailed failures.

---

## Security invariants

- `01-config.js` holds only the **public anon key** (safe; RLS enforces policy).
- `audit_log_uk` is append-only: anon `select` + `insert`, **no** update/delete policy. Don't add one.
- `locations_uk`, `districts_uk`, `app_settings` are all anon **read-only**. Don't make them anon-writable; don't put a service key in client JS.
- `users` is anon select/insert/update (no delete) — login self-maintains it incl. `country`.
- AU `_au` tables, when created, must mirror these exact policies.
- A real GitHub PAT was once committed in `data/config.json` — revoked + scrubbed June 2026.
  `config.json` now holds only the (client-side, intentionally public) password hash.

---

## Known pitfalls

- **All DB access via `TABLES.*`** — never hardcode a table name; that's how country-switching
  works. But **don't** touch MapLibre source names (`'locations'` in `09`/`11`) — not DB tables.
- **Location `id` scheme is load-bearing** — `progress_uk` references location ids; keep them consistent.
- **`backdrop-filter` on `.sidebar`** creates a containing block for `position:fixed` children
  (caused the mobile bottom-sheet mis-position). Disabled on mobile.
- **MapLibre `easeTo` offset sign** for mobile bottom sheets: negative `y` pushes the target
  up into the visible region above the sheet.

*Last updated: 30 June 2026 (tables renamed `_uk`; per-account country + `TABLES` resolver; cache-bust v=32).*
