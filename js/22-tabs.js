// ═══════════════════════════════════════════════════════════════════════════
// 22-tabs.js — switchTab, toggleSidebar, district-layer visibility on tab change
// ═══════════════════════════════════════════════════════════════════════════

function switchTab(tab,btn){
  $$('.tab').forEach(b=>b.classList.remove('on'))
  $$('.panel').forEach(p=>p.classList.remove('on'))
  if(btn)btn.classList.add('on')
  const panel=$('tab-'+tab);if(panel)panel.classList.add('on')

  const inGroups=tab==='groups'
  if(mapReady){
    // Show/hide district polygon layers
    ;['district-fill','district-glow','district-line','district-selected'].forEach(function(id){
      if(map.getLayer(id))map.setLayoutProperty(id,'visibility',inGroups?'visible':'none')
    })
    // District dots only when a district is selected
    ;['district-locs','district-locs-cleared'].forEach(function(id){
      if(map.getLayer(id))map.setLayoutProperty(id,'visibility',inGroups&&selectedDistrictCode?'visible':'none')
    })
  }

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
