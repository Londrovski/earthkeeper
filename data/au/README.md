# Australia source data — districts (LGAs)

## districts_au (loaded to Supabase)

- **Source:** Geoscape/PSMA LGA boundaries GeoJSON (uploaded by James, June 2026). Property fields: `lga_pid` (stable id), `lga_name`, `abb_name`, `state`.
- **Raw:** 195 MB, 2,210 polygons (multi-part LGAs split into separate features).
- **Processing (mapshaper):** dissolved by `lga_pid` (2,210 -> 564 LGAs), simplified to 1.2% Visvalingam-weighted with `keep-shapes`, cleaned slivers, coordinate precision trimmed to 3 dp (~110 m). Result ~2.5 MB.
- **ACT added manually:** the Geoscape LGA layer has **no ACT polygon** (the ACT has no local councils). One zone `act-territory` ("Australian Capital Territory") was added so Canberra gets a group rollup like every other zone. Total: **565 zones.**
- **Loaded into** `public.districts_au` as `code` = `lga_pid`, `name` = `lga_name`, `geometry` = simplified polygon (jsonb). Read-only to anon (RLS), same as `districts_uk`.

## State -> region slug mapping (for locations_au.region)

`NSW->nsw, VIC->vic, QLD->qld, SA->sa, WA->wa, TAS->tas, NT->nt, ACT->act, OT->ot`
(OT = Other Territories: Christmas Island, Cocos Islands — 2 zones.)

## Next: location datasets

`locations_au` still empty. To load (per type): hospitals (AIHW/MyHospitals), hospices (Palliative Care Australia), universities (TEQSA), schools (ACARA), GP/medical centres (Healthdirect/RACGP), day nurseries (ACECQA). Each row needs `region` (state slug) + `district_code` (the `lga_pid` it falls in, for schools/GPs Groups rollup) via point-in-polygon against `districts_au`.
