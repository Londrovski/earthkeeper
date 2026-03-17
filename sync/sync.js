/**
 * Earthkeeper Data Sync v2
 * Each source runs independently — one failure won't stop the others.
 * Verbose logging so you can see exactly what's happening in Actions.
 */

import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import fetch from 'node-fetch'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars')
  process.exit(1)
}

console.log('Connecting to Supabase:', SUPABASE_URL)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── REGION CONFIG ──────────────────────────────────────────────
const REGION_MAP = {
  london: [
    'E','EC','N','NW','SE','SW','W','WC',
    'BR','CR','DA','EN','HA','IG','KT','RM','SM','TW','UB','WD'
  ],
  somerset: ['BA','BS','TA','DT'],
  hertfordshire: ['AL','HP','LU','SG','WD']
}

const ACTIVE_REGIONS = process.env.REGIONS
  ? process.env.REGIONS.split(',').map(r => r.trim().toLowerCase())
  : ['london', 'somerset', 'hertfordshire']

console.log('Active regions:', ACTIVE_REGIONS.join(', '))

function regionForPostcode(postcode) {
  if (!postcode) return null
  const outcode = postcode.trim().toUpperCase().split(' ')[0]
  for (const [region, prefixes] of Object.entries(REGION_MAP)) {
    for (const prefix of prefixes) {
      if (outcode.startsWith(prefix)) return region
    }
  }
  return null
}

function inActiveRegion(postcode) {
  if (ACTIVE_REGIONS.length === 0) return true
  const region = regionForPostcode(postcode)
  return !!region && ACTIVE_REGIONS.includes(region)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── GEOCODING ─────────────────────────────────────────────────
async function geocodeBatch(postcodes) {
  const unique = [...new Set(postcodes.filter(p => p && p.trim()))]
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
      if (data.result) {
        for (const item of data.result) {
          if (item.result) {
            results[item.query] = { lat: item.result.latitude, lng: item.result.longitude }
            geocoded++
          }
        }
      }
    } catch (e) {
      console.warn(`  Geocode batch error: ${e.message}`)
    }
    if (i + 100 < unique.length) await sleep(250)
  }
  console.log(`  Geocoded ${geocoded}/${unique.length} postcodes`)
  return results
}

// ── UPSERT ────────────────────────────────────────────────────
async function upsertLocations(rows) {
  if (!rows.length) { console.log('  No rows to upsert'); return }
  let total = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase
      .from('locations')
      .upsert(chunk, { onConflict: 'source,source_id' })
    if (error) {
      console.error(`  Upsert error (rows ${i}–${i+500}):`, error.message)
    } else {
      total += chunk.length
      console.log(`  Saved ${total}/${rows.length} rows`)
    }
  }
}

// ── SOURCE 1: SCHOOLS (DfE GIAS) ──────────────────────────────
async function syncSchools() {
  console.log('\n━━ Schools (DfE GIAS) ━━')

  // Try today, then yesterday, then 2 days ago
  let rows = null
  for (let daysBack = 0; daysBack <= 3; daysBack++) {
    const d = new Date(Date.now() - daysBack * 86400000)
    const ds = d.toISOString().slice(0,10).replace(/-/g,'')
    const url = `https://ea-edubase-api-prod.azurewebsites.net/edubase/edubasealldata${ds}.csv`
    console.log(`  Trying: ${url}`)
    try {
      const res = await fetch(url, { timeout: 60000 })
      if (!res.ok) { console.log(`  HTTP ${res.status} — trying previous day`); continue }
      const text = await res.text()
      if (text.length < 1000) { console.log('  Response too small, trying previous day'); continue }
      rows = parse(text, { columns: true, skip_empty_lines: true, trim: true, relax_quotes: true, bom: true })
      console.log(`  Got ${rows.length} rows from ${ds}`)
      break
    } catch (e) {
      console.log(`  Fetch error: ${e.message}`)
    }
  }

  if (!rows) { console.error('  GIAS: Could not fetch data after 4 attempts'); return }

  const filtered = rows.filter(r => {
    const status = (r['EstablishmentStatus (name)'] || r['EstablishmentStatus'] || '').toLowerCase()
    if (status.includes('closed') || status.includes('proposed to open')) return false
    return inActiveRegion(r['Postcode'] || r['postcode'] || '')
  })
  console.log(`  After filter: ${filtered.length} schools in target regions`)

  const postcodes = filtered.map(r => (r['Postcode'] || r['postcode'] || '').trim())
  const geo = await geocodeBatch(postcodes)

  const locations = filtered.map(r => {
    const postcode = (r['Postcode'] || r['postcode'] || '').trim()
    const coords = geo[postcode] || {}
    const urn = r['URN'] || r['Urn'] || r['urn']
    return {
      id: `gias_${urn}`,
      name: r['EstablishmentName'] || r['establishmentName'] || 'Unknown',
      type: 'school',
      sub_type: r['TypeOfEstablishment (name)'] || r['TypeOfEstablishment'] || null,
      address: [r['Street'], r['Town']].filter(Boolean).join(', '),
      postcode,
      lat: coords.lat || null,
      lng: coords.lng || null,
      region: regionForPostcode(postcode),
      nation: 'england',
      source: 'gias',
      source_id: String(urn),
      active: true
    }
  })

  await upsertLocations(locations)
  console.log('  Schools sync complete')
}

// ── SOURCE 2: HOSPITALS (CQC API) ─────────────────────────────
async function syncHospitals() {
  console.log('\n━━ Hospitals (CQC) ━━')

  // CQC public API v1 — no key needed for basic location list
  const collected = []
  const PAGE = 500

  // Fetch all locations that are NOT care homes (hospitals, clinics, hospices etc)
  let page = 1
  let hasMore = true
  let attempts = 0

  while (hasMore && attempts < 100) {
    attempts++
    const url = `https://api.service.cqc.org.uk/public/v1/locations?careHomeService=N&perPage=${PAGE}&page=${page}`
    try {
      const res = await fetch(url, { timeout: 30000 })
      if (!res.ok) {
        console.warn(`  CQC page ${page}: HTTP ${res.status}`)
        break
      }
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

      console.log(`  CQC page ${page}: ${locs.length} locs, ${collected.length} in region so far`)
      if (locs.length < PAGE) { hasMore = false } else { page++ }
      await sleep(150)
    } catch (e) {
      console.warn(`  CQC error page ${page}: ${e.message}`)
      break
    }
  }

  console.log(`  Total hospitals in region: ${collected.length}`)
  if (!collected.length) { console.log('  No hospital data — skipping'); return }

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

  await upsertLocations(rows)
  console.log('  Hospitals sync complete')
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
    console.log(`  HESA: ${rows.length} providers`)
  } catch (e) {
    console.warn(`  HESA fetch failed: ${e.message}`)
    return
  }

  // Log column names to help debug
  if (rows.length > 0) console.log('  HESA columns:', Object.keys(rows[0]).join(', '))

  const out = rows.map(r => {
    // HESA column names vary — try several possibilities
    const name = r['name'] || r['Name'] || r['provider_name'] || r['PROVIDER_NAME'] || 'Unknown'
    const instid = r['instid'] || r['INSTID'] || r['inst_id'] || ''
    const ukprn = r['ukprn'] || r['UKPRN'] || ''
    const sourceId = instid || ukprn || name
    return {
      id: `hesa_${sourceId.replace(/\s+/g,'_')}`,
      name,
      type: 'university',
      sub_type: r['category_name'] || r['Category'] || 'HE Provider',
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
  }).filter(r => r.source_id && r.name !== 'Unknown')

  console.log(`  Upserting ${out.length} universities`)
  await upsertLocations(out)
  console.log('  Universities sync complete')
}

// ── SUMMARY ───────────────────────────────────────────────────
async function printSummary() {
  console.log('\n━━ Summary ━━')
  for (const type of ['school', 'hospital', 'university']) {
    const { count } = await supabase
      .from('locations')
      .select('*', { count: 'exact', head: true })
      .eq('type', type)
      .eq('active', true)
    console.log(`  ${type}s: ${count ?? '?'}`)
  }
}

// ── MAIN ──────────────────────────────────────────────────────
async function main() {
  console.log('Earthkeeper sync starting —', new Date().toISOString())

  try { await syncSchools() }    catch(e) { console.error('Schools failed:', e.message) }
  try { await syncHospitals() }  catch(e) { console.error('Hospitals failed:', e.message) }
  try { await syncUniversities() } catch(e) { console.error('Universities failed:', e.message) }
  await printSummary()

  console.log('\nSync complete —', new Date().toISOString())
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
