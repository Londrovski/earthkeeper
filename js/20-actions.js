// ═══════════════════════════════════════════════════════════════════════════
// 20-actions.js — markCleared / unmarkCleared / markGroupCleared / unmarkGroupCleared
// ═══════════════════════════════════════════════════════════════════════════

async function markCleared(id,tool,ew){
  if(window.dbgLog)window.dbgLog('markCleared('+id+', '+tool+')','info')
  const loc=locations.find(l=>l.id===id)
  if(!loc){if(window.dbgLog)window.dbgLog('  loc not in locations[]','err');return}
  const t=tool||currentTool
  const ewVal=ew||null
  progress[id]={tool:t,ew:ewVal,date:new Date().toISOString().slice(0,10),user:currentUser,name:loc.name}
  safe('refreshMapData',refreshMapData)
  safe('renderDetail',()=>renderDetail(loc,{mobile:false}))
  safe('renderList',renderList)
  safe('updateStats',updateStats)
  safe('renderLog',renderLog)
  await saveProgress();queueSave()
}

async function markClearedMobile(id,tool,ew){
  if(window.dbgLog)window.dbgLog('markClearedMobile('+id+', '+tool+')','info')
  const loc=locations.find(l=>l.id===id)
  if(!loc){if(window.dbgLog)window.dbgLog('  loc not in locations[]','err');return}
  const t=tool||currentTool
  const ewVal=ew||null
  progress[id]={tool:t,ew:ewVal,date:new Date().toISOString().slice(0,10),user:currentUser,name:loc.name}
  safe('refreshMapData',refreshMapData)
  safe('renderMobileDetail',()=>renderDetail(loc,{mobile:true}))
  safe('renderList',renderList)
  safe('updateStats',updateStats)
  safe('renderLog',renderLog)
  await saveProgress();queueSave()
}

async function unmarkCleared(id){
  const loc=locations.find(l=>l.id===id);if(!loc)return
  delete progress[id]
  safe('refreshMapData',refreshMapData)
  safe('renderDetail',()=>renderDetail(loc,{mobile:false}))
  safe('renderList',renderList)
  safe('updateStats',updateStats)
  safe('renderLog',renderLog)
  await saveProgress();queueSave()
}

async function unmarkClearedMobile(id){
  const loc=locations.find(l=>l.id===id);if(!loc)return
  delete progress[id]
  safe('refreshMapData',refreshMapData)
  safe('renderMobileDetail',()=>renderDetail(loc,{mobile:true}))
  safe('renderList',renderList)
  safe('updateStats',updateStats)
  safe('renderLog',renderLog)
  await saveProgress();queueSave()
}

async function markGroupCleared(code,gtype,tool){
  const gt=gtype||[...groupTypes][0]
  const d=districtMap[code]
  const t=tool||currentTool
  groupProgress[code+':'+gt]={tool:t,date:new Date().toISOString().slice(0,10),user:currentUser,name:d?d.name:code}
  updateDistrictStates()
  if(selectedDistrictCode===code)selectDistrict(code);else refreshMapData()
  renderDistrictDetail(code);renderDistrictList();updateDistrictStats(code);renderLog()
  await saveGroupProgress()
}

async function unmarkGroupCleared(code,gtype){
  const gt=gtype||[...groupTypes][0]
  delete groupProgress[code+':'+gt]
  updateDistrictStates()
  if(selectedDistrictCode===code)selectDistrict(code);else refreshMapData()
  renderDistrictDetail(code);renderDistrictList();updateDistrictStats(code);renderLog()
  await saveGroupProgress()
}

// Helper: wrap a call so a throw in one rendering step doesn't kill the save flow
function safe(name,fn){
  try{fn()}
  catch(e){if(window.dbgLog)window.dbgLog('  '+name+' threw: '+e.message,'err')}
}
