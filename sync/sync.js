#!/usr/bin/env node
/**
 * Earthkeeper — Data Sync Script
 *
 * Sources:
 *   Schools    → DfE GIAS daily CSV
 *   Hospitals  → CQC care directory weekly CSV
 *   Universities → HESA current providers CSV
 *
 * Geocoding → postcodes.io bulk API (free, no key)
 *
 * Regions synced (expand REGION_FILTERS to add more):
 *   London, Somerset (incl Bath & Bristol), Hertfordshire
 *
 * Run: node sync/sync.js
 * Or:  npm run sync
 */

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── REGION FILTERS ──────────────────────────────────────────────────────────
// These match against the admin_county / region fields from postcodes.io
// To expand to full UK, set REGION_FILTERS = null
const REGION_FILTERS = [
  // London — all 32 boroughs + City
  'greater london',
  // Somerset incl Bath & Bristol
  'somerset',
  'bath and north east somerset',
  'bristol, city of',
  'north somerset',
  // Hertfordshire
  'hertfordshire',
];

function inTargetRegion(county, region, adminDistrict) {
  if (!REGION_FILTERS) return true;
  const fields = [county, region, adminDistrict].map(f => (f || '').toLowerCase());
  return REGION_FILTERS.some(r => fields.some(f => f.includes(r)));
}

// ── GEOCODING ────────────────────────────────────────────────────────────────
// postcodes.io bulk endpoint: 100 postcodes per request, free, no auth
async function geocodePostcodes(postcodes) {
  const results = {};
  const unique = [...new Set(postcodes.filter(Boolean).map(p => p.replace(/\s+/g, ' ').trim().toUpperCase()))];

  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    try {
      const res = await fetch('https://api.postcodes.io/postcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcodes: batch }),
      });
      const data = await res.json();
      for (const item of (data.result || [])) {
        if (item.result) {
          results[item.query] = {
            lat: item.result.latitude,
            lng: item.result.longitude,
            region: item.result.region || '',
            county: item.result.admin_county || '',
            admin_district: item.result.admin_district || '',
          };
        }
      }
    } catch (e) {
      console.warn(`Geocode batch ${i} failed:`, e.message);
    }
    // polite delay
    await new Promise(r => setTimeout(r, 200));
  }
  return results;
}

// ── UPSERT TO SUPABASE ────────────────────────────────────────────────────────
async function upsertLocations(rows) {
  if (!rows.length) return;
  // Chunk into 500-row batches to stay within Supabase limits
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase
      .from('locations')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });
    if (error) console.error('Upsert error:', error.message);
    else console.log(`  Upserted rows ${i}–${i + batch.length}`);
  }
}

// ── SOURCE 1: DfE GIAS (Schools) ─────────────────────────────────────────────
async function syncSchools() {
  console.log('\n📚 Syncing schools from DfE GIAS...');

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const url = `http://ea-edubase-api-prod.azurewebsites.net/edubase/edubasealldata${dateStr}.csv`;

  let csvText;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    csvText = await res.text();
  } catch (e) {
    // Fallback: try yesterday's file (sometimes today's isn't published until later)
    console.warn(`Today's GIAS file not available (${e.message}), trying yesterday...`);
    const yesterday = new Date(today - 86400000);
    const d2 = yesterday.toISOString().slice(0, 10).replace(/-/g, '');
    const res2 = await fetch(`http://ea-edubase-api-prod.azurewebsites.net/edubase/edubasealldata${d2}.csv`);
    csvText = await res2.text();
  }

  const rows = parse(csvText, { columns: true, skip_empty_lines: true, relax_quotes: true });
  console.log(`  Parsed ${rows.length} total schools`);

  // Extract postcodes for geocoding
  const postcodes = rows.map(r => r['Postcode'] || r['postcode'] || '').filter(Boolean);
  console.log(`  Geocoding ${postcodes.length} postcodes...`);
  const geoMap = await geocodePostcodes(postcodes);

  const locations = [];
  for (const row of rows) {
    // Only open/active establishments
    const status = (row['EstablishmentStatus (name)'] || row['EstablishmentStatus'] || '').toLowerCase();
    if (status && status !== 'open') continue;

    const postcode = (row['Postcode'] || row['postcode'] || '').trim().toUpperCase();
    const geo = geoMap[postcode];
    if (!geo) continue;

    if (!inTargetRegion(geo.county, geo.region, geo.admin_district)) continue;

    const urn = row['URN'] || row['urn'];
    if (!urn) continue;

    locations.push({
      id: `gias_${urn}`,
      name: row['EstablishmentName'] || row['establishmentname'] || 'Unknown School',
      type: 'school',
      sub_type: row['TypeOfEstablishment (name)'] || row['TypeOfEstablishment'] || null,
      address: [row['Street'], row['Town']].filter(Boolean).join(', '),
      postcode,
      lat: geo.lat,
      lng: geo.lng,
      region: geo.region || geo.county || geo.admin_district,
      nation: 'england',
      source: 'gias',
      source_id: String(urn),
      active: true,
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`  ${locations.length} schools in target regions`);
  await upsertLocations(locations);
}

// ── SOURCE 2: CQC Register (Hospitals + all care locations) ──────────────────
async function syncHospitals() {
  console.log('\n🏥 Syncing hospitals from CQC...');

  // CQC publishes a weekly "care directory with ratings" ODS/CSV
  // The direct CSV download URL (confirmed working):
  const url = 'https://www.cqc.org.uk/sites/default/files/2024-01/01_January_2024_CQC_directory.csv';

  // Note: CQC updates this file weekly. The sync script fetches the latest
  // from the CQC API which doesn't require authentication for the directory.
  // We filter to hospital-type services only.
  const CQC_API = 'https://api.service.cqc.org.uk/public/v1/locations?careHomeFlag=N&specialisms=Hospital&page=1&perPage=1000';

  let allLocations = [];
  let page = 1;
  let totalPages = 1;

  console.log('  Fetching from CQC API...');
  while (page <= totalPages) {
    try {
      const res = await fetch(
        `https://api.service.cqc.org.uk/public/v1/locations?page=${page}&perPage=1000`,
        { headers: { 'User-Agent': 'Earthkeeper/1.0' } }
      );
      const data = await res.json();
      totalPages = data.totalPages || 1;
      allLocations = allLocations.concat(data.locations || []);
      console.log(`  Page ${page}/${totalPages} — ${allLocations.length} locations so far`);
      page++;
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.warn(`  CQC page ${page} failed:`, e.message);
      break;
    }
  }

  // Filter to hospital-type services
  const hospitals = allLocations.filter(loc => {
    const type = (loc.type || '').toLowerCase();
    const name = (loc.name || '').toLowerCase();
    return (
      type.includes('hospital') ||
      name.includes('hospital') ||
      name.includes('infirmary') ||
      name.includes('medical centre') ||
      (loc.regulatedActivities || []).some(a =>
        (a.name || '').toLowerCase().includes('surgical') ||
        (a.name || '').toLowerCase().includes('diagnostic') ||
        (a.name || '').toLowerCase().includes('maternity')
      )
    );
  });

  console.log(`  ${hospitals.length} hospital-type locations, geocoding...`);
  const postcodes = hospitals.map(h => h.postalCode || h.postcode || '').filter(Boolean);
  const geoMap = await geocodePostcodes(postcodes);

  const locations = [];
  for (const h of hospitals) {
    const postcode = (h.postalCode || h.postcode || '').trim().toUpperCase();
    const geo = geoMap[postcode];
    if (!geo) continue;
    if (!inTargetRegion(geo.county, geo.region, geo.admin_district)) continue;

    locations.push({
      id: `cqc_${h.locationId}`,
      name: h.name,
      type: 'hospital',
      sub_type: h.type || null,
      address: [h.address, h.town || h.city].filter(Boolean).join(', '),
      postcode,
      lat: geo.lat,
      lng: geo.lng,
      region: geo.region || geo.county || geo.admin_district,
      nation: 'england',
      source: 'cqc',
      source_id: h.locationId,
      active: (h.registrationStatus || '').toLowerCase() === 'registered',
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`  ${locations.length} hospitals in target regions`);
  await upsertLocations(locations);
}

// ── SOURCE 3: HESA (Universities) ────────────────────────────────────────────
async function syncUniversities() {
  console.log('\n🎓 Syncing universities from HESA...');

  const url = 'https://www.hesa.ac.uk/collection/provider-tools/all_hesa_providers?ProviderAllCurrentHESA.csv';
  const res = await fetch(url, { headers: { 'User-Agent': 'Earthkeeper/1.0' } });
  const csvText = await res.text();
  const rows = parse(csvText, { columns: true, skip_empty_lines: true });
  console.log(`  ${rows.length} current HE providers`);

  // HESA doesn't include postcodes directly — we use their campus locations page
  // which has lat/lng. For now we geocode by fetching OfS register which has postcodes.
  const ofsUrl = 'https://www.officeforstudents.org.uk/media/d6f50015-a174-4462-b3be-85f4e3299d79/ofs2024_provider-register-with-lat-lon.csv';

  let ofsRows = [];
  try {
    const ofsRes = await fetch(ofsUrl, { headers: { 'User-Agent': 'Earthkeeper/1.0' } });
    const ofsCsv = await ofsRes.text();
    ofsRows = parse(ofsCsv, { columns: true, skip_empty_lines: true });
    console.log(`  OfS register: ${ofsRows.length} providers with lat/lon`);
  } catch (e) {
    console.warn('  OfS register unavailable, falling back to postcode geocoding');
  }

  // Build a UKPRN → lat/lng/postcode map from OfS data
  const ofsMap = {};
  for (const r of ofsRows) {
    const ukprn = r['UKPRN'] || r['ukprn'];
    if (ukprn) {
      ofsMap[ukprn] = {
        lat: parseFloat(r['Latitude'] || r['latitude'] || 0),
        lng: parseFloat(r['Longitude'] || r['longitude'] || 0),
        postcode: r['Postcode'] || r['postcode'] || '',
        region: r['Region'] || '',
      };
    }
  }

  // For providers not in OfS, geocode by postcode if available
  const toGeocode = rows
    .filter(r => {
      const ukprn = r['UKPRN'] || r['ukprn'];
      return ukprn && !ofsMap[ukprn];
    })
    .map(r => r['Postcode'] || r['postcode'] || '')
    .filter(Boolean);

  const extraGeo = await geocodePostcodes(toGeocode);

  const locations = [];
  for (const row of rows) {
    const ukprn = String(row['UKPRN'] || row['ukprn'] || '').trim();
    const name = row['PROVIDER_NAME'] || row['Name'] || row['name'] || 'Unknown University';

    // Skip FE-only colleges (FE_PROVIDER flag = 1 means it's a further ed college)
    const isFE = (row['FE_PROVIDER'] || row['fe_provider'] || '0') === '1';
    if (isFE) continue;

    let lat = 0, lng = 0, region = '', postcode = '';

    if (ofsMap[ukprn]) {
      ({ lat, lng, region, postcode } = ofsMap[ukprn]);
    } else {
      postcode = (row['Postcode'] || row['postcode'] || '').trim().toUpperCase();
      const geo = extraGeo[postcode];
      if (geo) { lat = geo.lat; lng = geo.lng; region = geo.region || geo.county; }
    }

    if (!lat || !lng) continue;

    // Region check — geocode the postcode to get county/region if missing
    const geo = extraGeo[postcode] || ofsMap[ukprn] || {};
    if (!inTargetRegion(geo.county || '', region, geo.admin_district || '')) continue;

    locations.push({
      id: `hesa_${ukprn}`,
      name,
      type: 'university',
      sub_type: row['CATEGORY_NAME'] || null,
      address: '',
      postcode,
      lat,
      lng,
      region,
      nation: (row['COUNTRY_CODE'] || 'XF').toLowerCase() === 'xf' ? 'england'
             : (row['COUNTRY_CODE'] || '').toLowerCase() === 'xs' ? 'scotland'
             : (row['COUNTRY_CODE'] || '').toLowerCase() === 'xg' ? 'wales'
             : (row['COUNTRY_CODE'] || '').toLowerCase() === 'xi' ? 'northern_ireland'
             : 'england',
      source: 'hesa',
      source_id: ukprn,
      active: true,
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`  ${locations.length} universities in target regions`);
  await upsertLocations(locations);
}

// ── MARK STALE LOCATIONS ─────────────────────────────────────────────────────
// Any location not seen in this sync run gets marked inactive
// (We track this by comparing updated_at timestamps)
async function markStaleInactive(syncStartTime) {
  const { error } = await supabase
    .from('locations')
    .update({ active: false })
    .lt('updated_at', syncStartTime)
    .neq('source', 'custom'); // never auto-deactivate manually added locations

  if (error) console.warn('Stale marking failed:', error.message);
  else console.log('\n✓ Marked old locations inactive');
}

// ── SUMMARY ──────────────────────────────────────────────────────────────────
async function printSummary() {
  const { data } = await supabase
    .from('locations')
    .select('type, active')
    .eq('active', true);

  const counts = { school: 0, hospital: 0, university: 0 };
  for (const row of (data || [])) counts[row.type] = (counts[row.type] || 0) + 1;

  console.log('\n═══════════════════════════════');
  console.log('  Earthkeeper sync complete');
  console.log('═══════════════════════════════');
  console.log(`  Schools:      ${counts.school}`);
  console.log(`  Hospitals:    ${counts.hospital}`);
  console.log(`  Universities: ${counts.university}`);
  console.log(`  Total:        ${Object.values(counts).reduce((a, b) => a + b, 0)}`);
  console.log('═══════════════════════════════\n');
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌍 Earthkeeper Data Sync');
  console.log(`   ${new Date().toISOString()}`);
  console.log(`   Regions: ${REGION_FILTERS ? REGION_FILTERS.join(', ') : 'ALL UK'}\n`);

  const syncStart = new Date().toISOString();

  await syncSchools();
  await syncHospitals();
  await syncUniversities();
  await markStaleInactive(syncStart);
  await printSummary();
}

main().catch(e => {
  console.error('Sync failed:', e);
  process.exit(1);
});
