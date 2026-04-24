// ═══════════════════════════════════════════════════════════════════════════
// 10-map-handlers.js — click and hover handlers for all map layers
// ═══════════════════════════════════════════════════════════════════════════

// Clicking a map dot is tab-sensitive: on the Log tab we route through
// openFromLog so the detail opens in the Log sidebar panel rather than the
// (hidden) Locations panel. Otherwise behave as before.
function handleMapLocClick(id){
  const logActive=$('tab-log')&&$('tab-log').classList.contains('on')
  if(logActive&&typeof openFromLog==='function'){
    openFromLog(id,'loc')
  }else{
    selectLoc(id)
  }
}

function wireAllMapHandlers(){
  const locClickLayers=['dots-cleared','dots-uncleared']
  const districtDotLayers=['district-locs','district-locs-cleared']

  locClickLayers.concat(districtDotLayers).forEach(function(lyr){
    map.on('click',lyr,function(e){if(e.features.length)handleMapLocClick(e.features[0].properties.id)})
    map.on('mouseenter',lyr,function(){map.getCanvas().style.cursor='pointer'})
    map.on('mouseleave',lyr,function(){map.getCanvas().style.cursor=''})
  })

  map.on('click','district-fill',function(e){if(e.features.length)selectDistrict(e.features[0].properties.code)})
  map.on('mouseenter','district-fill',function(){map.getCanvas().style.cursor='pointer'})
  map.on('mouseleave','district-fill',function(){map.getCanvas().style.cursor=''})

  // Empty-map click: deselect loc / district
  map.on('click',function(e){
    const inGroups=$('tab-groups').classList.contains('on')
    const inLog=$('tab-log').classList.contains('on')
    const layers=[...locClickLayers,...(inGroups?['district-fill','district-locs','district-locs-cleared']:[])]
    if(!map.queryRenderedFeatures(e.point,{layers}).length){
      setSelectedId(null);closeDetail();closeMobileDetail()
      if(typeof closeLogDetail==='function')closeLogDetail()
      if(inGroups&&selectedDistrictCode){goHome()}
    }
  })
}
