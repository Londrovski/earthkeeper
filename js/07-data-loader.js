// ═══════════════════════════════════════════════════════════════════════════
// 07-data-loader.js — fetchRegion, loadAll, loadRegion, loadSchoolsGps, loadDistricts, buildDistrictMap
// ═══════════════════════════════════════════════════════════════════════════

async function fetchRegion(region,includeSchoolsGps){
  const base=[
    ghGetOptional('hospitals-'+region+'.json'),
    ghGetOptional('universities-'+region+'.json'),
    ghGetOptional('hospices-'+region+'.json'),
    ghGetOptional('prisons-'+region+'.json')
  ]
  const extra=includeSchoolsGps?[
    ghGetOptional('schools-'+region+'.json'),
    ghGetOptional('gps-'+region+'.json')
  ]:[Promise.resolve([]),Promise.resolve([])]
  const[hospitals,universities,hospices,prisons,schools,gps]=await Promise.all([...base,...extra])
  return[...hospitals,...schools,...universities,...hospices,...prisons,...gps]
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
    const res=await fetch(RAW_BASE+'/districts.geojson')
    if(!res.ok){console.warn('Districts fetch failed',res.status);return}
    const geojson=await res.json()
    geojson.features=geojson.features.map((f,i)=>({...f,id:i+1}))
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
