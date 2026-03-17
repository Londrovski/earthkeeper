/**
 * Earthkeeper Data Sync v3
 *
 * Sources:
 *   Schools    — DfE GIAS public API (SOAP/XML) — no key needed
 *   Hospitals  — CQC public REST API — no key needed
 *   Unis       — HESA current providers CSV — no key needed
 *   Geocoding  — postcodes.io bulk API — free, no key
 *
 * Each source is fully independent. One failure never stops the others.
 */

import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import fetch from 'node-fetch'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
console.log('Supabase connected:', SUPABASE_URL)

// ── REGION CONFIG ──────────────────────────────────────────────
// Postcode prefixes that belong to each region.
// Longer prefixes are checked first to avoid NW matching N.
const REGION_MAP = {
  london: [
    'EC1','EC2','EC3','EC4','WC1','WC2',
    'NW1','NW2','NW3','NW4','NW5','NW6','NW7','NW8','NW9','NW10','NW11',
    'SW1','SW2','SW3','SW4','SW5','SW6','SW7','SW8','SW9','SW10','SW11','SW12','SW13','SW14','SW15','SW16','SW17','SW18','SW19','SW20',
    'SE1','SE2','SE3','SE4','SE5','SE6','SE7','SE8','SE9','SE10','SE11','SE12','SE13','SE14','SE15','SE16','SE17','SE18','SE19','SE20','SE21','SE22','SE23','SE24','SE25','SE26','SE27','SE28',
    'E1','E2','E3','E4','E5','E6','E7','E8','E9','E10','E11','E12','E13','E14','E15','E16','E17','E18',
    'N1','N2','N3','N4','N5','N6','N7','N8','N9','N10','N11','N12','N13','N14','N15','N16','N17','N18','N19','N20','N21','N22',
    'W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','W12','W13','W14',
    'BR','CR','DA','EN','HA','IG','KT','RM','SM','TW','UB','WD'
  ],
  somerset: ['BA','BS','TA','DT'],
  hertfordshire: ['AL','HP','LU','SG','WD']
}

const ACTIVE_REGIONS = process.env.REGIONS
  ? process.env.REGIONS.split(',').map(r => r.trim().toLowerCase())
  : ['london', 'somerset', 'hertfordshire']

console.log('Regions:', ACTIVE_REGIONS.join(', '))

function regionForPostcode(postcode) {
  if (!postcode) return null
  const outcode = postcode.trim().toUpperCase().split(' ')[0]
  // Check longer prefixes first
  for (const [region, prefixes] of Object.entries(REGION_MAP)) {
    const sorted = [...prefixes].sort((a, b) => b.length - a.length)
    for (const prefix of sorted) {
      if (outcode === prefix || outcode.startsWith(prefix) && /\d/.test(outcode[prefix.length] || '')) {
        return region
      }
    }
  }
  // Fallback: simple startsWith
  for (const [region, prefixes] of Object.entries(REGION_MAP)) {
    for (const prefix of prefixes) {
      if (outcode.startsWith(prefix)) return region
    }
  }
  return null
}

function inActiveRegion(postcode) {
  if (!ACTIVE_REGIONS.length) return true
  return !!regionForPostcode(postcode) && ACTIVE_REGIONS.includes(regionForPostcode(postcode))
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── GEOCODING ─────────────────────────────────────────────────
async function geocodeBatch(postcodes) {
  const unique = [...new Set(postcodes.filter(p => p?.trim()))]
  if (!unique.length) return {}
  const results = {}
  let geocoded = 0
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100)
    try {
      const res = await fetch('https://api.postcodes.io/postcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcodes: batch })
      })
      if (!res.ok) { console.warn(`  Geocode HTTP ${res.status}`); continue }
      const data = await res.json()
      for (const item of (data.result || [])) {
        if (item.result) {
          results[item.query] = { lat: item.result.latitude, lng: item.result.longitude }
          geocoded++
        }
      }
    } catch (e) {
      console.warn(`  Geocode error: ${e.message}`)
    }
    if (i + 100 < unique.length) await sleep(300)
  }
  console.log(`  Geocoded ${geocoded}/${unique.length}`)
  return results
}

// ── UPSERT ────────────────────────────────────────────────────
async function upsertLocations(rows) {
  if (!rows.length) { console.log('  Nothing to upsert'); return 0 }
  let saved = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase
      .from('locations')
      .upsert(chunk, { onConflict: 'source,source_id' })
    if (error) console.error(`  Upsert error: ${error.message}`)
    else { saved += chunk.length; console.log(`  Saved ${saved}/${rows.length}`) }
  }
  return saved
}

// ── SOURCE 1: SCHOOLS via GIAS SOAP API ───────────────────────
// The GIAS public SOAP API returns establishment data in XML.
// Endpoint: https://ea-edubase-api-prod.azurewebsites.net/edubase/api/...
// Since the CSV endpoint is dead, we use their public search API
// which accepts a postcode/LA filter and returns JSON.
async function syncSchools() {
  console.log('\n━━ Schools (GIAS API) ━━')

  // GIAS search API — filter by open establishments
  // We query by local authority area using known LA codes for our regions
  // London: LAs 201–213, 301–320 (inner/outer London boroughs)
  // Somerset: LA 933 (Somerset), 800 (Bath & NE Somerset), 801 (Bristol)
  // Hertfordshire: LA 919

  const LA_CODES = {
    london: [
      '201','202','203','204','205','206','207','208','209','210','211','212','213',
      '301','302','303','304','305','306','307','308','309','310','311','312','313','314','315','316','317','318','319','320'
    ],
    somerset: ['933','800','801','834'],
    hertfordshire: ['919']
  }

  const allRows = []

  for (const region of ACTIVE_REGIONS) {
    const laCodes = LA_CODES[region] || []
    if (!laCodes.length) { console.log(`  No LA codes for ${region}`); continue }
    console.log(`  Fetching ${region} (${laCodes.length} LAs)...`)

    for (const la of laCodes) {
      // GIAS search endpoint — returns JSON list of establishments
      const url = `https://get-information-schools.service.gov.uk/api/schools?la=${la}&statusCode=1&format=json`
      try {
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          timeout: 20000
        })
        if (!res.ok) {
          console.log(`  LA ${la}: HTTP ${res.status}`)
          continue
        }
        const data = await res.json()
        const establishments = data.establishments || data.Establishments || data || []
        if (Array.isArray(establishments)) {
          allRows.push(...establishments.map(e => ({ ...e, _region: region })))
          console.log(`  LA ${la}: ${establishments.length} schools`)
        }
      } catch (e) {
        console.log(`  LA ${la}: ${e.message}`)
      }
      await sleep(100)
    }
  }

  console.log(`  Total raw: ${allRows.length}`)

  if (!allRows.length) {
    console.log('  GIAS API returned no data — trying fallback CSV approach')
    return await syncSchoolsCSVFallback()
  }

  const postcodes = allRows.map(r => r.Postcode || r.postcode || '')
  const geo = await geocodeBatch(postcodes)

  const locations = allRows.map(r => {
    const postcode = (r.Postcode || r.postcode || '').trim()
    const urn = String(r.URN || r.Urn || r.urn || '')
    const coords = geo[postcode] || {}
    return {
      id: `gias_${urn}`,
      name: r.EstablishmentName || r.Name || r.name || 'Unknown',
      type: 'school',
      sub_type: r.TypeOfEstablishment?.Name || r.TypeOfEstablishment || null,
      address: [r.Street, r.Town].filter(Boolean).join(', '),
      postcode,
      lat: coords.lat || null,
      lng: coords.lng || null,
      region: r._region,
      nation: 'england',
      source: 'gias',
      source_id: urn,
      active: true
    }
  }).filter(r => r.source_id)

  const saved = await upsertLocations(locations)
  console.log(`  Schools done: ${saved} saved`)
}

// Fallback: use the GIAS OData API which is also public
async function syncSchoolsCSVFallback() {
  console.log('  Trying GIAS OData API...')

  // GIAS OData feed — publicly accessible, paginated
  const allRows = []
  let skip = 0
  const top = 1000

  while (true) {
    const url = `https://ea-edubase-api-prod.azurewebsites.net/edubase/api/schoolsearch?StatusCode=1&$top=${top}&$skip=${skip}&$format=json`
    try {
      const res = await fetch(url, { timeout: 30000 })
      if (!res.ok) { console.log(`  OData HTTP ${res.status} — stopping`); break }
      const data = await res.json()
      const rows = data.value || data.Establishments || []
      if (!rows.length) break
      allRows.push(...rows)
      console.log(`  OData skip=${skip}: ${rows.length} rows, total ${allRows.length}`)
      if (rows.length < top) break
      skip += top
      await sleep(500)
    } catch (e) {
      console.log(`  OData error: ${e.message} — stopping`)
      break
    }
  }

  if (!allRows.length) {
    console.log('  Both GIAS approaches failed — schools not synced this run')
    return
  }

  // Filter to active regions by postcode
  const filtered = allRows.filter(r => inActiveRegion(r.Postcode || r.postcode || ''))
  console.log(`  After region filter: ${filtered.length}`)

  const postcodes = filtered.map(r => (r.Postcode || r.postcode || '').trim())
  const geo = await geocodeBatch(postcodes)

  const locations = filtered.map(r => {
    const postcode = (r.Postcode || r.postcode || '').trim()
    const urn = String(r.URN || r.Urn || '')
    const coords = geo[postcode] || {}
    return {
      id: `gias_${urn}`,
      name: r.EstablishmentName || r.Name || 'Unknown',
      type: 'school',
      sub_type: r.TypeOfEstablishment?.Name || null,
      address: [r.Street, r.Town].filter(Boolean).join(', '),
      postcode,
      lat: coords.lat || null,
      lng: coords.lng || null,
      region: regionForPostcode(postcode),
      nation: 'england',
      source: 'gias',
      source_id: urn,
      active: true
    }
  }).filter(r => r.source_id)

  await upsertLocations(locations)
}

// ── SOURCE 2: HOSPITALS (CQC) ─────────────────────────────────
async function syncHospitals() {
  console.log('\n━━ Hospitals (CQC API) ━━')

  const collected = []
  const PAGE = 500
  let page = 1
  let hasMore = true

  while (hasMore && page <= 200) {
    const url = `https://api.service.cqc.org.uk/public/v1/locations?careHomeService=N&perPage=${PAGE}&page=${page}`
    try {
      const res = await fetch(url, { timeout: 30000 })
      if (!res.ok) { console.warn(`  CQC page ${page}: HTTP ${res.status}`); break }
      const data = await res.json()
      const locs = data.locations || []
      if (!locs.length) { hasMore = false; break }

      for (const loc of locs) {
        const postcode = (loc.postalCode || '').trim()
        if (!inActiveRegion(postcode)) continue
        collected.push({
          _id: loc.locationId,
          _name: loc.locationName,
          _postcode: postcode,
          _address: [loc.addressLine1, loc.townCity].filter(Boolean).join(', '),
          _type: loc.type || 'Hospital',
          _active: (loc.registrationStatus || '').toLowerCase() === 'registered'
        })
      }

      console.log(`  CQC page ${page}: ${locs.length} fetched, ${collected.length} in region`)
      if (locs.length < PAGE) hasMore = false
      else page++
      await sleep(150)
    } catch (e) {
      console.warn(`  CQC error: ${e.message}`)
      break
    }
  }

  if (!collected.length) { console.log('  No hospitals found'); return }

  const postcodes = [...new Set(collected.map(l => l._postcode))]
  const geo = await geocodeBatch(postcodes)

  const rows = collected.map(l => {
    const coords = geo[l._postcode] || {}
    return {
      id: `cqc_${l._id}`,
      name: l._name,
      type: 'hospital',
      sub_type: l._type,
      address: l._address,
      postcode: l._postcode,
      lat: coords.lat || null,
      lng: coords.lng || null,
      region: regionForPostcode(l._postcode),
      nation: 'england',
      source: 'cqc',
      source_id: l._id,
      active: l._active
    }
  })

  const saved = await upsertLocations(rows)
  console.log(`  Hospitals done: ${saved} saved`)
}

// ── SOURCE 3: UNIVERSITIES (HESA) ─────────────────────────────
async function syncUniversities() {
  console.log('\n━━ Universities (HESA) ━━')

  const url = 'https://www.hesa.ac.uk/collection/provider-tools/all_hesa_providers?ProviderAllCurrentHESA.csv'
  let rows
  try {
    const res = await fetch(url, { timeout: 30000 })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    rows = parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true })
    console.log(`  HESA rows: ${rows.length}`)
    if (rows.length > 0) console.log('  Columns:', Object.keys(rows[0]).slice(0,8).join(', '))
  } catch (e) {
    console.warn(`  HESA failed: ${e.message}`)
    return
  }

  const out = rows.map(r => {
    const name = r['name'] || r['Name'] || r['provider_name'] || ''
    const instid = r['instid'] || r['INSTID'] || ''
    const ukprn = r['ukprn'] || r['UKPRN'] || ''
    const sourceId = instid || ukprn
    if (!sourceId || !name) return null
    return {
      id: `hesa_${sourceId}`,
      name,
      type: 'university',
      sub_type: r['category_name'] || 'HE Provider',
      address: null,
      postcode: null,
      lat: null,
      lng: null,
      region: null,
      nation: 'uk',
      source: 'hesa',
      source_id: sourceId,
      active: true
    }
  }).filter(Boolean)

  const saved = await upsertLocations(out)
  console.log(`  Universities done: ${saved} saved`)
}

// ── SUMMARY ───────────────────────────────────────────────────
async function printSummary() {
  console.log('\n━━ Database summary ━━')
  for (const type of ['school', 'hospital', 'university']) {
    const { count } = await supabase
      .from('locations')
      .select('*', { count: 'exact', head: true })
      .eq('type', type)
      .eq('active', true)
    console.log(`  ${type}s: ${count ?? 'error'}`)
  }
}

// ── MAIN ──────────────────────────────────────────────────────
async function main() {
  console.log('\nEarthkeeper sync v3 —', new Date().toISOString())
  try { await syncSchools() }      catch (e) { console.error('Schools error:', e.message) }
  try { await syncHospitals() }    catch (e) { console.error('Hospitals error:', e.message) }
  try { await syncUniversities() } catch (e) { console.error('Universities error:', e.message) }
  await printSummary()
  console.log('\nDone —', new Date().toISOString())
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
