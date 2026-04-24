// ═══════════════════════════════════════════════════════════════════════════
// 22-tabs.js — switchTab, toggleSidebar, map-layer visibility on tab change
// ═══════════════════════════════════════════════════════════════════════════

const LOC_ALL_LAYERS=['dots-uncleared','cleared-glow','dots-cleared','selected-ring']
const LOC_CLEARED_LAYERS=['cleared-glow','dots-cleared']
const DISTRICT_LAYERS=['district-fill','district-glow','district-line','district-selected']
const DISTRICT_DOT_LAYERS=['district-locs','district-locs-cleared']

function setLayerVisibility(ids,visible){
  if(!mapReady)return
  ids.forEach(function(id){
    if(map.getLayer(id))map.setLayoutProperty(id,'visibility',visible?'visible':'none')
  })
}

function switchTab(tab,btn){
  $$('.tab').forEach(b=>b.classList.remove('on'))
  $$('.panel').forEach(p=>p.classList.remove('on'))
  if(btn)btn.classList.add('on')
  const panel=$('tab-'+tab);if(panel)panel.classList.add('on')

  if(mapReady){
    if(tab==='groups'){
      setLayerVisibility(LOC_ALL_LAYERS,false)
      setLayerVisibility(DISTRICT_LAYERS,true)
      setLayerVisibility(DISTRICT_DOT_LAYERS,!!selectedDistrictCode)
    }else if(tab==='log'){
      setLayerVisibility(['dots-uncleared'],false)
      setLayerVisibility(LOC_CLEARED_LAYERS,true)
      setLayerVisibility(['selected-ring'],true)
      setLayerVisibility(DISTRICT_LAYERS,false)
      setLayerVisibility(DISTRICT_DOT_LAYERS,false)
    }else{
      setLayerVisibility(LOC_ALL_LAYERS,true)
      setLayerVisibility(DISTRICT_LAYERS,false)
      setLayerVisibility(DISTRICT_DOT_LAYERS,false)
    }
  }

  if(tab==='groups'){
    if(!schoolsGpsLoaded)loadSchoolsGps().then(()=>{buildDistrictMap();renderDistrictList();updateDistrictStates();updateGroupsStats()})
    updateGroupsStats()
    renderDistrictList()
  }else if(tab==='log'){
    updateLogStats()
    renderLog()
    // Log tab filters cleared dots by logScope — refresh source now.
    if(typeof refreshMapData==='function')refreshMapData()
  }else{
    updateStats()
    // Leaving Log tab — restore full cleared-dots source.
    if(typeof refreshMapData==='function')refreshMapData()
  }
}

function toggleSidebar(){
  const sb=$('sidebar'),tog=$('tog')
  if(!sb)return
  sb.classList.toggle('collapsed')
  if(tog)tog.innerHTML=sb.classList.contains('collapsed')?'\u203A':'\u2039'
}
