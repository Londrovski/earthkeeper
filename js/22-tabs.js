// ═══════════════════════════════════════════════════════════════════════════
// 22-tabs.js — switchTab, toggleSidebar, map-layer visibility on tab change
// ═══════════════════════════════════════════════════════════════════════════

// Layer groups — Locations tab shows dots/rings, Groups tab shows districts.
const LOC_LAYERS=['dots-uncleared','cleared-glow','dots-cleared','selected-ring']
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

  const inGroups=tab==='groups'

  // Locations + Log share the individual-location layers. Groups hides them.
  setLayerVisibility(LOC_LAYERS,!inGroups)
  setLayerVisibility(DISTRICT_LAYERS,inGroups)
  setLayerVisibility(DISTRICT_DOT_LAYERS,inGroups&&!!selectedDistrictCode)

  if(tab==='groups'){
    if(!schoolsGpsLoaded)loadSchoolsGps().then(()=>{buildDistrictMap();renderDistrictList();updateDistrictStates();updateGroupsStats()})
    updateGroupsStats()
    renderDistrictList()
  }else if(tab==='log'){
    updateLogStats()
    renderLog()
  }else{
    updateStats()
  }
}

function toggleSidebar(){
  const sb=$('sidebar'),tog=$('tog')
  if(!sb)return
  sb.classList.toggle('collapsed')
  if(tog)tog.innerHTML=sb.classList.contains('collapsed')?'\u203A':'\u2039'
}
