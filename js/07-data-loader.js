// ═══════════════════════════════════════════════════════════════════════════
// 07-data-loader.js — fetchRegion, loadAll, loadRegion, loadSchoolsGps, loadDistricts, buildDistrictMap
//
// Locations now come from the Supabase `locations` table (was static /data JSON).
// fetchRegion keeps the same return shape — an array of location objects with
// id/type/name/address/postcode/lat/lng and (schools/gps) districtCode — so the
// rest of the app is unchanged. Districts also load from Supabase now (was static geojson).
// ═══════════════════════════════════════════════════════════════════════════

// Pull locations for one region from Supabase, paginated (PostgREST caps pages).
// Maps DB columns back to the legacy object shape the app expects.
async function sbLocations(region,types){
  const sel='id,type,name,address,postcode,lat,lng,district_code,meta'
  const out=[],page=1000
  let offset=0
  while(true){
    const url=SB_REST+'/locations?select='+sel
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

async function fetchRegion(region,includeSchoolsGps){
  const types=includeSchoolsGps
    ?['hospital','university','hospice','prison','school','gp']
    :['hospital','university','hospice','prison']
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
    for(let i=0;i<ALL_REGIONS.length;i+=batchSize){
      const batch=await Promise.all(ALL_REGIONS.slice(i,i+batchSize).map(r=>fetchRegion(r,false)))
      results.push(...batch)
    }
    locations=results.flat()
    if(!placesFilter.hospital)placesFilter.hospital=true
    if(!placesFilter.hospice)placesFilter.hospice=true
    if(!placesFilter.university)placesFilter.university=true
    if(!placesFilter.prison)placesFilter.prison=true
    hideLoader();refreshMapData();renderList();updateStats()
    fitBounds(locations.filter(l=>placesFilter[l.type]))
    if(window.dbgLog)window.dbgLog('loadAll() OK, '+locations.length+' locations','ok')
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
  schoolsGpsLoaded=true
  setMsg('Loading schools and GPs...')
  try{
    const batchSize=3,allFetched=[]
    for(let i=0;i<ALL_REGIONS.length;i+=batchSize){
      const batch=await Promise.all(ALL_REGIONS.slice(i,i+batchSize).map(r=>fetchRegion(r,true)))
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
    console.warn('Schools/GPs load failed',e)
    schoolsGpsLoaded=false
    setMsg('Some data failed to load')
    setTimeout(()=>setMsg(''),3000)
    if(window.dbgLog)window.dbgLog('loadSchoolsGps failed: '+e.message,'err')
  }
}

async function loadDistricts(){
  try{
    const res=await fetch(SB_REST+'/districts?select=code,name,geometry&order=code.asc',{headers:SB_HEADERS,cache:'no-store'})
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
  districts.forEach(f=>{districtMap[f.properties.code]={name:f.properties.name,code:f.properties.code,fid:f.id,schools:[],gps:[]}})
  locations.forEach(loc=>{
    if(!loc.districtCode||!districtMap[loc.districtCode])return
    if(loc.type==='school')districtMap[loc.districtCode].schools.push(loc)
    if(loc.type==='gp')districtMap[loc.districtCode].gps.push(loc)
  })
}
