// ═══════════════════════════════════════════════════════════════════════════
// 11-map-render.js — feeds data into map sources and maintains district feature-state
// ═══════════════════════════════════════════════════════════════════════════

function locToFeature(loc){
  const tool=effectiveTool(loc),cleared=isEffectivelyCleared(loc)
  return{
    type:'Feature',
    geometry:{type:'Point',coordinates:[loc.lng,loc.lat]},
    properties:{id:loc.id,type:loc.type,cleared,tool:tool||null}
  }
}

function refreshMapData(){
  if(!mapReady)return
  const visible=locations.filter(l=>l.lat&&l.lng&&locVisible(l))
  const cleared=visible.filter(l=>isEffectivelyCleared(l))
  const sel=selectedId?locations.filter(l=>l.id===selectedId&&l.lat&&l.lng):[]
  map.getSource('locations').setData({type:'FeatureCollection',features:visible.map(locToFeature)})
  map.getSource('locations-cleared').setData({type:'FeatureCollection',features:cleared.map(locToFeature)})
  map.getSource('selected').setData({type:'FeatureCollection',features:sel.map(locToFeature)})
  _lastVisibleCount=visible.length
  _lastClearedCount=cleared.length
}

function setSelectedId(id){selectedId=id;refreshMapData()}

function updateDistrictStates(){
  if(!mapReady||!districts.length||!map.getSource('districts-src'))return
  districts.forEach(function(f){
    const code=f.properties.code
    const hasSchools=districtMap[code]&&districtMap[code].schools.length>0
    const hasGps=districtMap[code]&&districtMap[code].gps.length>0
    const hasAny=hasSchools||hasGps
    const selected=code===selectedDistrictCode
    if(!hasAny){try{map.setFeatureState({source:'districts-src',id:f.id},{cleared:0,selected})}catch(e){};return}
    const schoolDone=!hasSchools||!!groupProgress[code+':school']
    const gpDone=!hasGps||!!groupProgress[code+':gp']
    const cleared=schoolDone&&gpDone?2:((!!groupProgress[code+':school']||!!groupProgress[code+':gp'])?1:0)
    try{map.setFeatureState({source:'districts-src',id:f.id},{cleared,selected})}catch(e){}
  })
}

function pushDistrictDataNow(){
  if(!mapReady||!map.getSource('districts-src'))return
  const geojson={type:'FeatureCollection',features:districts}
  map.getSource('districts-src').setData(geojson)
  updateDistrictStates()
}
