// ═══════════════════════════════════════════════════════════════════════════
// 13-filters.js — place/tool/show filter logic + locVisible
// ═══════════════════════════════════════════════════════════════════════════

function locVisible(loc){
  const multiFilter=showFilter==='tool-multi'
  const toolOrEwFilter=multiFilter||TOOLS.includes(showFilter)||EW_LEVELS.includes(showFilter)
  if(!toolOrEwFilter&&!placesFilter[loc.type])return false
  if(showFilter==='all')return true
  if(showFilter==='cleared')return isEffectivelyCleared(loc)
  if(multiFilter){
    const etool=effectiveTool(loc)
    const p=progress[loc.id]
    for(const t of activeTools){
      if(TOOLS.includes(t)&&etool===t)return true
      if(EW_LEVELS.includes(t)&&p&&p.ew===t)return true
    }
    return false
  }
  const etool=effectiveTool(loc)
  if(TOOLS.includes(showFilter))return etool===showFilter
  if(EW_LEVELS.includes(showFilter)){
    const p=progress[loc.id];return !!(p&&p.ew===showFilter)
  }
  return true
}

function togglePlace(type,el){
  placesFilter[type]=!placesFilter[type]
  el.classList.toggle('on',placesFilter[type])
  if((type==='school'||type==='gp')&&placesFilter[type]&&!schoolsGpsLoaded){
    loadSchoolsGps().then(()=>{refreshMapData();renderList();updateStats()})
  }else{
    refreshMapData();renderList();updateStats()
  }
}

function setToolFromSelect(val){
  activeTools.clear()
  $$('.chip.show-tool').forEach(el=>el.classList.remove('on'))
  $$('.chip.show-all,.chip.show-cleared').forEach(el=>el.classList.remove('on'))
  if(!val){
    showFilter='all'
    const c=$('chip-all');if(c)c.classList.add('on')
  }else{
    showFilter='tool-multi'
    activeTools.add(val)
    const c=$('chip-'+val);if(c)c.classList.add('on')
  }
  refreshMapData();renderList();updateStats()
}

function setShow(mode,el){
  showFilter=mode
  activeTools.clear()
  const ts=$('tool-select-inline');if(ts)ts.value=''
  const ts2=$('tool-select');if(ts2)ts2.value=''
  $$('.chip.show-all,.chip.show-cleared,.chip.show-tool').forEach(c=>c.classList.remove('on'))
  el.classList.add('on')
  refreshMapData();renderList();updateStats()
}

function toggleTool(tool,el){
  $$('.chip.show-all,.chip.show-cleared').forEach(c=>c.classList.remove('on'))
  showFilter='tool-multi'
  if(activeTools.has(tool)){activeTools.delete(tool);el.classList.remove('on')}
  else{activeTools.add(tool);el.classList.add('on')}
  if(activeTools.size===0){
    showFilter='all'
    const c=$('chip-all');if(c)c.classList.add('on')
  }
  refreshMapData();renderList()
}

function toggleToolKey(){const k=$('tool-key');if(k)k.classList.toggle('open')}

function toggleGroupType(type,el){
  if(groupTypes.has(type)){if(groupTypes.size>1)groupTypes.delete(type)}
  else{groupTypes.add(type)}
  el.classList.toggle('on',groupTypes.has(type))
  renderDistrictList();updateDistrictStates()
  if(selectedDistrictCode){
    selectDistrict(selectedDistrictCode)
    renderDistrictDetail(selectedDistrictCode)
  }
}
