/**
 * Earthkeeper Data Sync
 * Pulls schools (GIAS), hospitals (CQC), universities (HESA)
 * into Supabase. Safe to re-run — upserts only, never deletes progress.
 *
 * Sources:
 *   Schools    — DfE GIAS daily CSV
 *   Hospitals  — CQC care directory (weekly ODS/CSV)
 *   Unis       — HESA current providers CSV
 *   Geocoding  — postcodes.io bulk API (free, no key)
 *
 * Region filter: set REGIONS env var or edit ACTIVE_REGIONS below.
 * To sync all UK: set ACTIVE_REGIONS = [] (empty = no filter)
 */

import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import fetch from 'node-fetch'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── REGION CONFIG ──────────────────────────────────────────────
// Postcodes / county names that map to each region.
// To expand to full UK, set ACTIVE_REGIONS = []
const REGION_MAP = {
  london: [
    'E1','E2','E3','E4','E5','E6','E7','E8','E9','E10','E11','E12','E13','E14','E15','E16','E17','E18',
    'EC1','EC2','EC3','EC4',
    'N1','N2','N3','N4','N5','N6','N7','N8','N9','N10','N11','N12','N13','N14','N15','N16','N17','N18','N19','N20','N21','N22',
    'NW1','NW2','NW3','NW4','NW5','NW6','NW7','NW8','NW9','NW10','NW11',
    'SE1','SE2','SE3','SE4','SE5','SE6','SE7','SE8','SE9','SE10','SE11','SE12','SE13','SE14','SE15','SE16','SE17','SE18','SE19','SE20','SE21','SE22','SE23','SE24','SE25','SE26','SE27','SE28',
    'SW1','SW2','SW3','SW4','SW5','SW6','SW7','SW8','SW9','SW10','SW11','SW12','SW13','SW14','SW15','SW16','SW17','SW18','SW19','SW20',
    'W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','W12','W13','W14',
    'WC1','WC2',
    'BR','CR','DA','EN','HA','IG','KT','RM','SM','TW','UB','WD'
  ],
  somerset: ['BA','BS','TA','DT'],
  hertfordshire: ['AL','EN','HP','LU','SG','WD']
}

const ACTIVE_REGIONS_ENV = process.env.REGIONS
const ACTIVE_REGIONS = ACTIVE_REGIONS_ENV
  ? ACTIVE_REGIONS_ENV.split(',').map(r => r.trim().toLowerCase())
  : ['london', 'somerset', 'hertfordshire']

console.log(`Syncing regions: ${ACTIVE_REGIONS.length ? ACTIVE_REGIONS.join(', ') : 'ALL UK'}`)

// ── HELPERS ────────────────────────────────────────────────────

function outcodeFromPostcode(postcode) {
  if (!postcode) return null
  return postcode.trim().toUpperCase().split(' ')[0]
}

function regionForPostcode(postcode) {
  if (!postcode) return null
  const outcode = outcodeFromPostcode(postcode)
  if (!outcode) return null

  // Strip trailing digits to get letter prefix (e.g. SW1A -> SW1 -> SW)
  for (const [region, outcodes] of Object.entries(REGION_MAP)) {
    for (const code of outcodes) {
      if (outcode.startsWith(code)) return region
    }
  }
  return null
}

function inActiveRegion(postcode) {
  if (ACTIVE_REGIONS.length === 0) return true // no filter = all UK
  const region = regionForPostcode(postcode)
  return region && ACTIVE_REGIONS.includes(region)
}

async function geocodeBatch(postcodes) {
  // postcodes.io bulk endpoint: up to 100 at a time
  const unique = [...new Set(postcodes.filter(Boolean))]
  const results = {}
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100)
    try {
      const res = await fetch('https://api.postcodes.io/postcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcodes: batch })
      })
      const data = await res.json()
      if (data.result) {
        for (const item of data.result) {
          if (item.result) {
            results[item.query] = {
              lat: item.result.latitude,
              lng: item.result.longitude
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Geocoding batch failed: ${e.message}`)
    }
    // polite delay between batches
    if (i + 100 < unique.length) await sleep(300)
  }
  return results
}

async function upsertLocations(rows) {
  if (!rows.length) return
  // Batch inserts in chunks of 500
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase
      .from('locations')
      .upsert(chunk, { onConflict: 'source,source_id', ignoreDuplicates: false })
    if (error) console.error('Upsert error:', error.message)
    else console.log(`  Upserted rows ${i + 1}–${Math.min(i + 500, rows.length)}`)
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchCSV(url) {
  console.log(`  Fetching: ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  const text = await res.text()
  return parse(text, { columns: true, skip_empty_lines: true, trim: true, relax_quotes: true })
}

// ── SOURCE 1: SCHOOLS (DfE GIAS) ──────────────────────────────
async function syncSchools() {
  console.log('\n── Schools (DfE GIAS) ──')

  // GIAS publishes a fresh CSV each day at this URL
  const today = new Date()
  const dateStr = today.toISOString().slice(0,10).replace(/-/g,'')
  const url = `http://ea-edubase-api-prod.azurewebsites.net/edubase/edubasealldata${dateStr}.csv`

  let rows
  try {
    rows = await fetchCSV(url)
  } catch(e) {
    // Try yesterday if today's not published yet
    const yesterday = new Date(today - 86400000)
    const ds2 = yesterday.toISOString().slice(0,10).replace(/-/g,'')
    console.log(`  Today's file not ready, trying yesterday (${ds2})...`)
    rows = await fetchCSV(
      `http://ea-edubase-api-prod.azurewebsites.net/edubase/edubasealldata${ds2}.csv`
    )
  }

  console.log(`  Total GIAS rows: ${rows.length}`)

  // Filter to open establishments in our regions
  const filtered = rows.filter(r => {
    const status = (r['EstablishmentStatus (name)'] || '').toLowerCase()
    if (status === 'closed' || status === 'proposed to open') return false
    const postcode = r['Postcode'] || ''
    return inActiveRegion(postcode)
  })

  console.log(`  After region filter: ${filtered.length}`)

  // Geocode
  const postcodes = filtered.map(r => r['Postcode'])
  console.log(`  Geocoding ${postcodes.length} postcodes...`)
  const geo = await geocodeBatch(postcodes)

  const locations = filtered.map(r => {
    const postcode = (r['Postcode'] || '').trim()
    const coords = geo[postcode] || {}
    return {
      id: `gias_${r['URN']}`,
      name: r['EstablishmentName'] || 'Unknown School',
      type: 'school',
      sub_type: r['TypeOfEstablishment (name)'] || null,
      address: [r['Street'], r['Town']].filter(Boolean).join(', '),
      postcode,
      lat: coords.lat || null,
      lng: coords.lng || null,
      region: regionForPostcode(postcode),
      nation: 'england',
      source: 'gias',
      source_id: r['URN'],
      active: true
    }
  })

  console.log(`  Upserting ${locations.length} schools...`)
  await upsertLocations(locations)
  console.log(`  Schools done.`)
}

// ── SOURCE 2: HOSPITALS (CQC care directory) ───────────────────
async function syncHospitals() {
  console.log('\n── Hospitals (CQC) ──')

  // CQC publishes a weekly care directory. We fetch the stable URL.
  // This includes NHS hospitals, private hospitals, clinics, hospices.
  const url = 'https://www.cqc.org.uk/sites/default/files/2024-01/01_January_2024_Latest_ratings.xlsx'

  // CQC also offers a direct CSV. The most reliable approach is their
  // /api endpoint for locations by service type.
  // Service types for hospitals: Acute, Mental Health, Community
  const serviceTypes = [
    { code: 'Acute', label: 'Acute hospital' },
    { code: 'Mental%20health', label: 'Mental health' },
    { code: 'Community', label: 'Community hospital' },
    { code: 'Hospice', label: 'Hospice' }
  ]

  const locations = []
  const PAGE = 1000

  for (const stype of serviceTypes) {
    let start = 1
    let total = null

    while (true) {
      const url = `https://api.service.cqc.org.uk/public/v1/locations?careHomeService=N&serviceTypes=${stype.code}&perPage=${PAGE}&page=${Math.ceil(start/PAGE)}`
      try {
        const res = await fetch(url, {
          headers: { 'Ocp-Apim-Subscription-Key': '' }
        })
        if (!res.ok) {
          console.warn(`  CQC ${stype.label}: HTTP ${res.status}`)
          break
        }
        const data = await res.json()
        if (total === null) total = data.total || 0

        const locs = data.locations || []
        if (!locs.length) break

        for (const loc of locs) {
          const postcode = loc.postalCode || ''
          if (!inActiveRegion(postcode)) continue
          locations.push({
            _postcode: postcode,
            _id: loc.locationId,
            _name: loc.locationName,
            _subtype: stype.label,
            _address: [loc.addressLine1, loc.townCity].filter(Boolean).join(', '),
            _active: loc.registrationStatus === 'Registered'
          })
        }

        start += locs.length
        if (start > total) break
        await sleep(200)
      } catch(e) {
        console.warn(`  CQC fetch error: ${e.message}`)
        break
      }
    }
    console.log(`  ${stype.label}: collected ${locations.filter(l => l._subtype === stype.label).length} in region`)
  }

  // Geocode
  const postcodes = [...new Set(locations.map(l => l._postcode))]
  console.log(`  Geocoding ${postcodes.length} hospital postcodes...`)
  const geo = await geocodeBatch(postcodes)

  const rows = locations.map(l => {
    const coords = geo[l._postcode] || {}
    return {
      id: `cqc_${l._id}`,
      name: l._name,
      type: 'hospital',
      sub_type: l._subtype,
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

  console.log(`  Upserting ${rows.length} hospital locations...`)
  await upsertLocations(rows)
  console.log(`  Hospitals done.`)
}

// ── SOURCE 3: UNIVERSITIES (HESA) ─────────────────────────────
async function syncUniversities() {
  console.log('\n── Universities (HESA) ──')

  // HESA publishes a static CSV of all current providers
  const url = 'https://www.hesa.ac.uk/collection/provider-tools/all_hesa_providers?ProviderAllCurrentHESA.csv'

  let rows
  try {
    rows = await fetchCSV(url)
  } catch(e) {
    console.warn(`  HESA CSV fetch failed: ${e.message}`)
    return
  }

  console.log(`  Total HESA providers: ${rows.length}`)

  // HESA doesn't include postcodes — we need to geocode by institution name
  // They do publish campus data separately. For now we use known postcodes
  // from the campus locations page. We'll geocode what we can.
  // Filter to England/Wales/Scotland institutions only (exclude overseas)
  const filtered = rows.filter(r => {
    const country = (r['country_code'] || r['Country'] || '').toUpperCase()
    return !country || ['XF','XH','XI','XG','XK',''].includes(country) // UK country codes in HESA
  })

  // For universities we don't filter by region — there are only ~400 total
  // so we load all UK universities regardless of region setting
  console.log(`  UK providers: ${filtered.length}`)

  // We need to look up postcodes for these. HESA campus data has them.
  const campusUrl = 'https://www.hesa.ac.uk/support/providers/campus-locations'
  // Campus CSV isn't directly downloadable, so we use known major postcodes
  // and geocode by institution name via postcodes.io name search as fallback.
  // In practice the sync will load unis without coords first, then a separate
  // geocoding pass can fill them in.

  const rows_out = filtered.map(r => {
    const name = r['name'] || r['Provider'] || r['INSTID'] || 'Unknown'
    const ukprn = r['ukprn'] || r['UKPRN'] || ''
    const instid = r['instid'] || r['INSTID'] || ''
    return {
      id: `hesa_${instid || ukprn}`,
      name,
      type: 'university',
      sub_type: r['category_name'] || 'Higher Education Provider',
      address: null,
      postcode: null,
      lat: null,
      lng: null,
      region: null,  // filled in geocoding pass
      nation: 'uk',
      source: 'hesa',
      source_id: instid || ukprn,
      active: true
    }
  })

  console.log(`  Upserting ${rows_out.length} universities...`)
  await upsertLocations(rows_out)
  console.log(`  Universities done (postcodes/coords will be null — see README for geocoding pass).`)
}

// ── MARK CLOSED ───────────────────────────────────────────────
async function markClosed() {
  // Any location not seen in this sync that was previously active
  // gets marked inactive. We do this per-source to avoid cross-source conflicts.
  // For now we just ensure upsert sets active=true for everything we saw —
  // a separate cleanup job can mark missing ones inactive.
  console.log('\n── Marking closed locations inactive (TODO: implement delta check) ──')
}

// ── SUMMARY ───────────────────────────────────────────────────
async function printSummary() {
  const { data, error } = await supabase
    .from('locations')
    .select('type, active')

  if (error || !data) return

  const counts = {}
  for (const row of data) {
    const key = `${row.type}_${row.active ? 'active' : 'inactive'}`
    counts[key] = (counts[key] || 0) + 1
  }

  console.log('\n── Summary ──────────────────────────────')
  console.log(`  Schools:      ${counts['school_active'] || 0} active`)
  console.log(`  Hospitals:    ${counts['hospital_active'] || 0} active`)
  console.log(`  Universities: ${counts['university_active'] || 0} active`)
  console.log(`  Total:        ${Object.values(counts).reduce((a,b) => a+b, 0)}`)
  console.log('─────────────────────────────────────────')
}

// ── MAIN ──────────────────────────────────────────────────────
async function main() {
  console.log('Earthkeeper sync starting...')
  console.log(new Date().toISOString())

  await syncSchools()
  await syncHospitals()
  await syncUniversities()
  await markClosed()
  await printSummary()

  console.log('\nSync complete.')
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
