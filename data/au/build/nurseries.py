"""
build_nurseries.py — Earthkeeper AU
Transforms the Algolia nurseries crawl data into locations_au rows.
Reads: nurseries_all.pkl (pre-crawled via state-by-state Algolia quadtree)
       districts_au.geojson (for point-in-polygon LGA assignment)
Writes: out/nurseries_au.csv  (final schema, ready to load into locations_au)

Run from data/au/:
    python build/nurseries.py
"""
import pickle, json, csv
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

GEOJSON  = r'C:\Users\james\LocalDrive\3. Projects\3. Earthkeeper\James\data\au\districts_au.geojson'
CRAWL    = r'C:\Users\james\AppData\Local\Temp\nurseries_all.pkl'
OUT_CSV  = r'C:\Users\james\LocalDrive\3. Projects\3. Earthkeeper\James\data\au\out\nurseries_au.csv'

print("=== Earthkeeper AU — Build nurseries_au.csv ===\n", flush=True)

# --- 1. Load districts ---
print("Loading districts...", flush=True)
with open(GEOJSON) as f:
    gj = json.load(f)
features = gj['features']
geoms = [shape(feat['geometry']) for feat in features]
pids  = [feat['properties']['lga_pid'] for feat in features]
tree  = STRtree(geoms)
print(f"  {len(features)} LGA polygons indexed.", flush=True)

FALLBACK_DEG = 500 / 111320  # ~500m in degrees

def find_district(lat, lng):
    pt = Point(lng, lat)
    for i in tree.query(pt):
        if geoms[i].contains(pt):
            return pids[i]
    # Boundary fallback: nearest polygon within ~500m
    best_d, best_pid = FALLBACK_DEG, None
    for i in tree.query(pt.buffer(FALLBACK_DEG)):
        d = geoms[i].boundary.distance(pt)
        if d < best_d:
            best_d, best_pid = d, pids[i]
    return best_pid

# --- 2. Load crawl data ---
print("Loading crawl data...", flush=True)
with open(CRAWL, 'rb') as f:
    unique = pickle.load(f)
print(f"  {len(unique)} unique records.", flush=True)

# --- 3. Transform + point-in-polygon ---
STATE_SLUG = {
    'NSW': 'nsw', 'VIC': 'vic', 'QLD': 'qld', 'SA': 'sa',
    'WA': 'wa', 'TAS': 'tas', 'NT': 'nt', 'ACT': 'act',
}

rows = []
dropped = 0
no_district = 0

print("Transforming + point-in-polygon...", flush=True)
for idx, h in enumerate(unique):
    if idx % 2000 == 0:
        print(f"  {idx}/{len(unique)}...", flush=True)

    geo = h.get('_geoloc', {})
    lat = geo.get('lat')
    lng = geo.get('lng')
    if lat is None or lng is None:
        dropped += 1
        continue

    addr = h.get('address', {}) or {}
    a1       = (addr.get('address1', '') or '').strip()
    a2       = (addr.get('address2', '') or '').strip()
    suburb   = (addr.get('suburbTown', '') or '').strip()
    postcode = str(addr.get('postcode', '') or '').strip()
    state_raw = (addr.get('stateTerritory', '') or '').upper()
    region = STATE_SLUG.get(state_raw, 'ot')

    parts = [p for p in [a1, a2, suburb] if p]
    address_str = ', '.join(parts) if parts else None

    raw_id = h.get('publicId') or h.get('serviceId') or h.get('objectID', '')
    loc_id = f"nursery-{raw_id}"

    svc_type = h.get('type', [])
    if isinstance(svc_type, str):
        svc_type = [svc_type]

    district_code = find_district(lat, lng)
    if district_code is None:
        no_district += 1

    meta = json.dumps({
        'source':       'ACECQA/StartingBlocks',
        'service_id':   h.get('serviceId'),
        'provider_id':  h.get('providerId'),
        'service_type': svc_type,
        'rating':       h.get('rating'),
    })

    rows.append({
        'id':            loc_id,
        'type':          'nursery',
        'name':          (h.get('name', '') or '').replace('\n', ' '),
        'address':       address_str,
        'postcode':      postcode if postcode else None,
        'lat':           lat,
        'lng':           lng,
        'district_code': district_code,
        'region':        region,
        'nation':        'australia',
        'meta':          meta,
        'active':        'true',
    })

print(f"\nDropped (no coords): {dropped}", flush=True)
print(f"No district_code:    {no_district} ({no_district/len(rows)*100:.1f}%)", flush=True)
print(f"Total rows:          {len(rows)}", flush=True)

# --- 4. Write CSV ---
COLS = ['id','type','name','address','postcode','lat','lng','district_code','region','nation','meta','active']
with open(OUT_CSV, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=COLS)
    w.writeheader()
    w.writerows(rows)

print(f"\nCSV written: {OUT_CSV}", flush=True)

# --- 5. Stats ---
from collections import Counter
region_dist = Counter(r['region'] for r in rows)
print("\nRegion breakdown:")
for reg, cnt in region_dist.most_common():
    print(f"  {reg}: {cnt}")

ids = [r['id'] for r in rows]
print(f"\nID uniqueness: {len(set(ids))} unique / {len(ids)} total")
if len(set(ids)) < len(ids):
    dupes = [id_ for id_ in set(ids) if ids.count(id_) > 1]
    print(f"  DUPLICATE IDs: {dupes[:5]}")

print("\nDone.")
