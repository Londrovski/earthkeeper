// ═══════════════════════════════════════════════════════════════════════════
// 07-data-loader.js — fetchRegion, loadAll, loadRegion, loadSchoolsGps, loadDistricts, buildDistrictMap
//
// Locations come from the Supabase `locations` table. Which types load eagerly
// (base) vs on-demand (lazy) is driven by the per-country `place_types` config
// (is_lazy). Lazy types (schools, and in AU the ~18k nurseries) are only fetched
// on first enable / background pass, so the initial boot stays light.
// ═══════════════════════════════════════════════════════════════════════════

// Pull locations for one region from Supabase, paginated (PostgREST caps pages).
// Maps DB columns back to the legacy object shape the app expects.
async function sbLocations(region,types){
  const sel='id,type,name,address,postcode,lat,lng,district_code,meta'
  const out=[],page=1000
  let offset=0
  while(true){
    const url=SB_REST+'/'+TABLES.locations+'?select='+sel
      +'&region=eq.'+region
      +'&type=in.('+types.join(',')+')'
      +'&order=id.asc&limit='+page+'&offset='+offset
    const res=await fetch(url,{headers:SB_HEADERS,cache:'no-store'})
    if(!res.ok)throw new Error('locations '+region+' '+res.status)
    const batch=await res.json()
    for(const r of batch){
      const o={id:r.id,type:r.type,name:r.name,address:r.address,postcode:r.postcode,lat:r.lat,lng:r.lng}
      if(r.district_code)o.districtCode=r.district_code
      if(r.meta&&typeof r.meta==='object')Object.assign(o,r.meta)
      out.push(o)
    }
    if(batch.length<page)break
    offset+=page
  }
  return out
}

// Base = non-lazy types (eager, on boot); lazy = is_lazy types (schools/nurseries/GPs).
// Derived from the loaded place_types config, with a per-country fallback.
function baseTypes(){
  if(window.PLACE_TYPES&&PLACE_TYPES.length)return PLACE_TYPES.filter(r=>!r.is_lazy).map(r=>r.type)
  return getCountry()==='AU'?['hospital','university','hospice','massacre']:['hospital','university','hospice','prison','massacre']
}
function lazyTypes(){
  if(window.PLACE_TYPES&&PLACE_TYPES.length)return PLACE_TYPES.filter(r=>r.is_lazy).map(r=>r.type)
  return getCountry()==='AU'?['school','nursery']:['school','gp']
}

async function fetchRegion(region,includeLazy){
  const types=includeLazy?[...baseTypes(),...lazyTypes()]:baseTypes()
  if(!types.length)return []
  try{
    return await sbLocations(region,types)
  }catch(e){
    if(window.dbgLog)window.dbgLog('fetchRegion '+region+' failed: '+e.message,'err')
    return []
  }
}

async function loadAll(){
  closeMobileDetail();closeDetail();setSelectedId(null)
  setMsg('Loading all regions...');$('mload').style.display='flex'
  if(window.dbgLog)window.dbgLog('loadAll() starting','info')
  try{
    const batchSize=3,results=[]
    const REGIONS=getRegions()
    for(let i=0;i<REGIONS.length;i+=batchSize){
      const batch=await Promise.all(REGIONS.slice(i,i+batchSize).map(r=>fetchRegion(r,false)))
      results.push(...batch)
    }
    locations=results.flat()
    // Re-enable primary (non-lazy, default-on) types if they got toggled off before a reload
    ;(window.PLACE_TYPES||[]).forEach(function(r){ if(r.default_on&&!placesFilter[r.type])placesFilter[r.type]=true })
    hideLoader();refreshMapData();renderList();updateStats()
    fitBounds(locations.filter(l=>placesFilter[l.type]))
    if(window.dbgLog)window.dbgLog('loadAll() OK, '+locations.length+' locations','ok')
    // loadAll() only fetches base types, so it drops lazy types from `locations`.
    // If they were already loaded, re-load them so cleared lazy-type dots (e.g.
    // another user's) don't vanish on Home / switching to "all regions".
    if(schoolsGpsLoaded){schoolsGpsLoaded=false;loadSchoolsGps()}
  }catch(e){
    setMsg('Error loading data');setTimeout(hideLoader,3000);locations=[];renderList()
    if(window.dbgLog)window.dbgLog('loadAll failed: '+e.message,'err')
  }
}

async function loadRegion(value){
  if(value==='all'){await loadAll();return}
  closeMobileDetail();closeDetail();setSelectedId(null)
  setMsg('Loading '+value+'...');$('mload').style.display='flex'
  try{
    locations=await fetchRegion(value,false)
    hideLoader();refreshMapData();renderList();updateStats()
    if(locations.filter(l=>l.lat&&l.lng).length)fitBounds(locations)
    else{setMsg('No data for "'+value+'" yet');setTimeout(hideLoader,3000)}
  }catch(e){setMsg('Error loading '+value);setTimeout(hideLoader,3000);locations=[];renderList()}
}

async function loadSchoolsGps(){
  if(schoolsGpsLoaded)return
  if(!lazyTypes().length){schoolsGpsLoaded=true;return}
  schoolsGpsLoaded=true
  setMsg('Loading schools and nurseries...')
  try{
    const batchSize=3,allFetched=[]
    const REGIONS=getRegions()
    for(let i=0;i<REGIONS.length;i+=batchSize){
      const batch=await Promise.all(REGIONS.slice(i,i+batchSize).map(r=>fetchRegion(r,true)))
      allFetched.push(...batch)
    }
    const existingIds=new Set(locations.map(l=>l.id))
    const newLocs=allFetched.flat().filter(l=>!existingIds.has(l.id))
    locations=[...locations,...newLocs]
    buildDistrictMap()
    refreshMapData();renderList();updateStats()
    setMsg('')
    if(window.dbgLog)window.dbgLog('loadSchoolsGps OK, total locations='+locations.length,'ok')
  }catch(e){
    console.warn('Lazy types load failed',e)
    schoolsGpsLoaded=false
    setMsg('Some data failed to load')
    setTimeout(()=>setMsg(''),3000)
    if(window.dbgLog)window.dbgLog('loadSchoolsGps failed: '+e.message,'err')
  }
}

async function loadDistricts(){
  try{
    const res=await fetch(SB_REST+'/'+TABLES.districts+'?select=code,name,geometry&order=code.asc',{headers:SB_HEADERS,cache:'no-store'})
    if(!res.ok){console.warn('Districts fetch failed',res.status);return}
    const rows=await res.json()
    const geojson={type:'FeatureCollection',features:rows.map((r,i)=>({type:'Feature',id:i+1,properties:{code:r.code,name:r.name},geometry:r.geometry}))}
    districts=geojson.features
    function pushDistrictData(attempts){
      if(mapReady&&map.getSource('districts-src')){
        map.getSource('districts-src').setData(geojson)
        buildDistrictMap();renderDistrictList();updateDistrictStates()
      }else if(attempts>0){
        setTimeout(function(){pushDistrictData(attempts-1)},300)
      }
    }
    pushDistrictData(8)
  }catch(e){console.warn('Districts load failed',e);if(window.dbgLog)window.dbgLog('loadDistricts failed: '+e.message,'err')}
}

function buildDistrictMap(){
  districtMap={}
  // Bucket by every configured group type, not just school/gp. `groupTypes`
  // (the on/off toggles) is deliberately NOT used here — the map holds all of
  // them and the renderers filter on display.
  const gTypes=districtGroupTypes()
  districts.forEach(f=>{
    const d={name:f.properties.name,code:f.properties.code,fid:f.id,byType:{}}
    gTypes.forEach(t=>{d.byType[t]=[]})
    districtMap[f.properties.code]=d
  })
  locations.forEach(loc=>{
    if(!loc.districtCode)return
    const d=districtMap[loc.districtCode]
    if(d&&d.byType[loc.type])d.byType[loc.type].push(loc)
  })
}
