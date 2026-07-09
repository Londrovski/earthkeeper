// ═══════════════════════════════════════════════════════════════════════════
// 11-map-render.js — feeds data into map sources and maintains district
//                    feature-state. On the Log tab, the cleared-dot layer can
//                    be scoped to "my clearings only" via logScope.
// ═══════════════════════════════════════════════════════════════════════════

function locToFeature(loc){
  const tool=effectiveTool(loc),cleared=isEffectivelyCleared(loc)
  return{
    type:'Feature',
    geometry:{type:'Point',coordinates:[loc.lng,loc.lat]},
    properties:{id:loc.id,type:loc.type,cleared,tool:tool||null}
  }
}

// A clearing belongs to the current user if the progress row has user===currentUser.
// Group clearings don't map to individual locations here, so they're considered
// not-mine for the purpose of the cleared-dots layer.
function isMyClearing(loc){
  const p=progress[loc.id]
  return !!(p&&currentUser&&p.user===currentUser)
}

function refreshMapData(){
  if(!mapReady)return
  const onLog=$('tab-log')&&$('tab-log').classList.contains('on')
  const scopedToMe=onLog&&logScope==='my'
  const visible=locations.filter(l=>l.lat&&l.lng&&locVisible(l))
  // Cleared-dots layer. On the Log tab it mirrors the Log list: every cleared
  // location of ANY type (ignoring the place-type filter), scoped to the current
  // user in 'my' mode. Group/district clearings aren't individual dots and are
  // excluded by isMyClearing. On other tabs the cleared layer respects filters.
  const clearedAll=(onLog?locations.filter(l=>l.lat&&l.lng):visible).filter(l=>isEffectivelyCleared(l))
  const cleared=scopedToMe?clearedAll.filter(isMyClearing):clearedAll
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
    const d=districtMap[code]
    const selected=code===selectedDistrictCode
    // Only types that actually have locations here count toward the fill state.
    const present=districtGroupTypes().filter(function(t){return dLocs(d,t).length>0})
    if(!present.length){try{map.setFeatureState({source:'districts-src',id:f.id},{cleared:0,selected})}catch(e){};return}
    const done=present.filter(function(t){return !!groupProgress[code+':'+t]}).length
    const cleared=done===present.length?2:(done>0?1:0)
    try{map.setFeatureState({source:'districts-src',id:f.id},{cleared,selected})}catch(e){}
  })
}

function pushDistrictDataNow(){
  if(!mapReady||!map.getSource('districts-src'))return
  const geojson={type:'FeatureCollection',features:districts}
  map.getSource('districts-src').setData(geojson)
  updateDistrictStates()
}
