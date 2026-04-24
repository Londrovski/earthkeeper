// ═══════════════════════════════════════════════════════════════════════════
// 20-actions.js — markCleared / unmarkCleared / markGroupCleared / unmarkGroupCleared
//
// Every action:
//   1. Captures prior state (for audit previous_tool)
//   2. Mutates local progress/groupProgress
//   3. Repaints UI
//   4. Writes the row change to Supabase
//   5. Writes an audit_log entry (fire-and-forget)
// ═══════════════════════════════════════════════════════════════════════════

async function markCleared(id,tool,ew){
  if(window.dbgLog)window.dbgLog('markCleared('+id+', '+tool+')','info')
  const loc=locations.find(l=>l.id===id)
  if(!loc){if(window.dbgLog)window.dbgLog('  loc not in locations[]','err');return}
  const t=tool||currentTool
  const ewVal=ew||null
  const prior=progress[id]?progress[id].tool:null
  progress[id]={tool:t,ew:ewVal,date:new Date().toISOString().slice(0,10),user:currentUser,name:loc.name}
  safe('refreshMapData',refreshMapData)
  safe('renderDetail',()=>renderDetail(loc,{mobile:false}))
  safe('renderList',renderList)
  safe('updateStats',updateStats)
  safe('renderLog',renderLog)
  const ok=await saveProgressEntry(id)
  if(ok)sbLogAudit({action:'clear',target_id:id,target_name:loc.name,target_type:loc.type,tool:t,ew:ewVal,previous_tool:prior,user:currentUser})
}

async function markClearedMobile(id,tool,ew){
  if(window.dbgLog)window.dbgLog('markClearedMobile('+id+', '+tool+')','info')
  const loc=locations.find(l=>l.id===id)
  if(!loc){if(window.dbgLog)window.dbgLog('  loc not in locations[]','err');return}
  const t=tool||currentTool
  const ewVal=ew||null
  const prior=progress[id]?progress[id].tool:null
  progress[id]={tool:t,ew:ewVal,date:new Date().toISOString().slice(0,10),user:currentUser,name:loc.name}
  safe('refreshMapData',refreshMapData)
  safe('renderMobileDetail',()=>renderDetail(loc,{mobile:true}))
  safe('renderList',renderList)
  safe('updateStats',updateStats)
  safe('renderLog',renderLog)
  const ok=await saveProgressEntry(id)
  if(ok)sbLogAudit({action:'clear',target_id:id,target_name:loc.name,target_type:loc.type,tool:t,ew:ewVal,previous_tool:prior,user:currentUser})
}

async function unmarkCleared(id){
  const loc=locations.find(l=>l.id===id);if(!loc)return
  const prior=progress[id]?progress[id].tool:null
  delete progress[id]
  safe('refreshMapData',refreshMapData)
  safe('renderDetail',()=>renderDetail(loc,{mobile:false}))
  safe('renderList',renderList)
  safe('updateStats',updateStats)
  safe('renderLog',renderLog)
  const ok=await deleteProgressEntry(id)
  if(ok)sbLogAudit({action:'unclear',target_id:id,target_name:loc.name,target_type:loc.type,previous_tool:prior,user:currentUser})
}

async function unmarkClearedMobile(id){
  const loc=locations.find(l=>l.id===id);if(!loc)return
  const prior=progress[id]?progress[id].tool:null
  delete progress[id]
  safe('refreshMapData',refreshMapData)
  safe('renderMobileDetail',()=>renderDetail(loc,{mobile:true}))
  safe('renderList',renderList)
  safe('updateStats',updateStats)
  safe('renderLog',renderLog)
  const ok=await deleteProgressEntry(id)
  if(ok)sbLogAudit({action:'unclear',target_id:id,target_name:loc.name,target_type:loc.type,previous_tool:prior,user:currentUser})
}

async function markGroupCleared(code,gtype,tool){
  const gt=gtype||[...groupTypes][0]
  const d=districtMap[code]
  const t=tool||currentTool
  const key=code+':'+gt
  const prior=groupProgress[key]?groupProgress[key].tool:null
  groupProgress[key]={tool:t,date:new Date().toISOString().slice(0,10),user:currentUser,name:d?d.name:code}
  updateDistrictStates()
  if(selectedDistrictCode===code)selectDistrict(code);else refreshMapData()
  renderDistrictDetail(code);renderDistrictList();updateDistrictStats(code);renderLog()
  const ok=await saveGroupProgressEntry(key)
  if(ok)sbLogAudit({action:'group_clear',target_id:key,target_name:d?d.name:code,target_type:gt,tool:t,previous_tool:prior,user:currentUser})
}

async function unmarkGroupCleared(code,gtype){
  const gt=gtype||[...groupTypes][0]
  const key=code+':'+gt
  const d=districtMap[code]
  const prior=groupProgress[key]?groupProgress[key].tool:null
  delete groupProgress[key]
  updateDistrictStates()
  if(selectedDistrictCode===code)selectDistrict(code);else refreshMapData()
  renderDistrictDetail(code);renderDistrictList();updateDistrictStats(code);renderLog()
  const ok=await deleteGroupProgressEntry(key)
  if(ok)sbLogAudit({action:'group_unclear',target_id:key,target_name:d?d.name:code,target_type:gt,previous_tool:prior,user:currentUser})
}

// Helper: wrap a call so a throw in one rendering step doesn't kill the save flow
function safe(name,fn){
  try{fn()}
  catch(e){if(window.dbgLog)window.dbgLog('  '+name+' threw: '+e.message,'err')}
}
