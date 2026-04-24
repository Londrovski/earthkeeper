// ═══════════════════════════════════════════════════════════════════════════
// 06-api.js — Supabase read/write for progress + group_progress + audit_log.
//
// Every save is a single HTTP request that returns immediately. No SHA
// juggling. No base64. No CDN cache. Real-time subscriptions keep every open
// tab in sync within ~1 second. audit_log is append-only and records every
// clear/unclear/group action with previous_tool for traceability.
// ═══════════════════════════════════════════════════════════════════════════

// ── Location data reads (hospitals, schools, etc.) still come from GitHub ─────────────
async function ghGet(path){
  const res=await fetch(RAW_BASE+'/'+path)
  if(!res.ok)throw new Error('Fetch '+res.status)
  return await res.json()
}
async function ghGetOptional(path){try{return await ghGet(path)}catch(e){return[]}}

// ── Supabase: load all rows ───────────────────────────────────────────────────────
async function sbSelectAll(table){
  const res=await fetch(SB_REST+'/'+table+'?select=*',{headers:SB_HEADERS,cache:'no-store'})
  if(!res.ok){
    const txt=await res.text()
    throw new Error('Supabase select '+table+' '+res.status+': '+txt.slice(0,200))
  }
  return await res.json()
}

async function loadProgress(){
  try{
    const rows=await sbSelectAll('progress')
    progress={}
    rows.forEach(function(r){
      progress[r.id]={tool:r.tool,ew:r.ew,date:r.date,user:r.user,name:r.name}
    })
    if(window.dbgLog)window.dbgLog('loadProgress: '+rows.length+' entries','ok')
  }catch(e){
    progress={}
    if(window.dbgLog)window.dbgLog('loadProgress failed: '+e.message,'err')
  }
}

async function loadGroupProgress(){
  try{
    const rows=await sbSelectAll('group_progress')
    groupProgress={}
    rows.forEach(function(r){
      groupProgress[r.id]={tool:r.tool,date:r.date,user:r.user,name:r.name}
    })
    if(window.dbgLog)window.dbgLog('loadGroupProgress: '+rows.length+' entries','ok')
  }catch(e){
    groupProgress={}
    if(window.dbgLog)window.dbgLog('loadGroupProgress failed: '+e.message,'err')
  }
}

// ── Supabase: upsert / delete individual rows ──────────────────────────────────────
async function sbUpsertRow(table,row){
  if(window.dbgLog)window.dbgLog('upsert '+table+' id='+row.id,'info')
  showSaving('Saving...')
  try{
    const res=await fetch(SB_REST+'/'+table,{
      method:'POST',
      headers:{...SB_HEADERS,'Prefer':'resolution=merge-duplicates,return=representation'},
      body:JSON.stringify(row)
    })
    if(res.ok){
      showSaving('Saved')
      if(window.dbgLog)window.dbgLog('  ✓ upsert OK','ok')
      return true
    }else{
      const txt=await res.text()
      showSaving('ERR '+res.status)
      if(window.dbgLog)window.dbgLog('  ✗ upsert '+res.status+': '+txt.slice(0,200),'err')
      return false
    }
  }catch(e){
    showSaving('Error saving')
    if(window.dbgLog)window.dbgLog('  ✗ upsert threw: '+e.message,'err')
    return false
  }finally{
    setTimeout(function(){const el=$('saving');if(el)el.style.opacity='0'},4000)
  }
}

async function sbDeleteRow(table,id){
  if(window.dbgLog)window.dbgLog('delete '+table+' id='+id,'info')
  showSaving('Saving...')
  try{
    const res=await fetch(SB_REST+'/'+table+'?id=eq.'+encodeURIComponent(id),{
      method:'DELETE',
      headers:SB_HEADERS
    })
    if(res.ok){
      showSaving('Saved')
      if(window.dbgLog)window.dbgLog('  ✓ delete OK','ok')
      return true
    }else{
      const txt=await res.text()
      showSaving('ERR '+res.status)
      if(window.dbgLog)window.dbgLog('  ✗ delete '+res.status+': '+txt.slice(0,200),'err')
      return false
    }
  }catch(e){
    showSaving('Error saving')
    if(window.dbgLog)window.dbgLog('  ✗ delete threw: '+e.message,'err')
    return false
  }finally{
    setTimeout(function(){const el=$('saving');if(el)el.style.opacity='0'},4000)
  }
}

// ── Audit log: fire-and-forget append ───────────────────────────────────────────
// Every clear/unclear/group action calls this after the main write. Failures
// are logged but never thrown — audit writes must not block the user's action.
async function sbLogAudit(entry){
  try{
    const body={
      action:entry.action,
      target_id:entry.target_id,
      target_name:entry.target_name||null,
      target_type:entry.target_type||null,
      tool:entry.tool||null,
      ew:entry.ew||null,
      previous_tool:entry.previous_tool||null,
      user:entry.user||null
    }
    const res=await fetch(SB_REST+'/audit_log',{
      method:'POST',
      headers:{...SB_HEADERS,'Prefer':'return=minimal'},
      body:JSON.stringify(body)
    })
    if(!res.ok){
      const txt=await res.text()
      if(window.dbgLog)window.dbgLog('  audit_log '+res.status+': '+txt.slice(0,200),'warn')
      return false
    }
    if(window.dbgLog)window.dbgLog('  audit: '+entry.action+' '+entry.target_id+(entry.tool?' ('+entry.tool+')':''),'dim')
    return true
  }catch(e){
    if(window.dbgLog)window.dbgLog('  audit threw: '+e.message,'warn')
    return false
  }
}

// Fetch recent audit rows for the debug panel.
async function fetchRecentAuditLog(limit){
  limit=limit||100
  const url=SB_REST+'/audit_log?select=*&order=created_at.desc&limit='+limit
  const res=await fetch(url,{headers:SB_HEADERS,cache:'no-store'})
  if(!res.ok){
    const txt=await res.text()
    throw new Error('audit_log fetch '+res.status+': '+txt.slice(0,200))
  }
  return await res.json()
}

// ── Save-a-single-entry helpers (called by 20-actions.js) ──────────────────────────
async function saveProgressEntry(id){
  const p=progress[id];if(!p)return false
  return await sbUpsertRow('progress',{id:id,tool:p.tool,ew:p.ew||null,date:p.date,user:p.user,name:p.name||null})
}
async function deleteProgressEntry(id){return await sbDeleteRow('progress',id)}
async function saveGroupProgressEntry(key){
  const g=groupProgress[key];if(!g)return false
  return await sbUpsertRow('group_progress',{id:key,tool:g.tool,date:g.date,user:g.user,name:g.name||null})
}
async function deleteGroupProgressEntry(key){return await sbDeleteRow('group_progress',key)}

// ── Legacy compat wrappers (so any leftover callers to saveProgress don't crash) ────────
async function saveProgress(){if(window.dbgLog)window.dbgLog('(noop) bulk saveProgress called — actions now save single rows','dim')}
async function saveGroupProgress(){if(window.dbgLog)window.dbgLog('(noop) bulk saveGroupProgress called','dim')}
function queueSave(){/* noop: every action saves immediately */}

// ── Real-time subscription: other tabs/devices push changes to us ─────────────────────
let _sbSocket=null
let _sbRefCounter=0

function startRealtime(){
  if(_sbSocket){try{_sbSocket.close()}catch(e){}}
  const url=SB_REALTIME+'?apikey='+encodeURIComponent(SUPABASE_ANON_KEY)+'&vsn=1.0.0'
  const ws=new WebSocket(url)
  _sbSocket=ws

  ws.onopen=function(){
    if(window.dbgLog)window.dbgLog('realtime: connected','ok')
    joinChannel('realtime:public:progress','progress')
    joinChannel('realtime:public:group_progress','group_progress')
    setInterval(function(){
      if(ws.readyState===1){
        ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:(++_sbRefCounter).toString()}))
      }
    },25000)
  }

  ws.onmessage=function(ev){
    let msg;try{msg=JSON.parse(ev.data)}catch(e){return}
    if(!msg||!msg.event)return
    if(msg.event==='postgres_changes'&&msg.payload){
      handleRealtimeChange(msg.payload)
    }
  }

  ws.onclose=function(){
    if(window.dbgLog)window.dbgLog('realtime: socket closed, reconnecting in 3s','warn')
    setTimeout(startRealtime,3000)
  }
  ws.onerror=function(e){
    if(window.dbgLog)window.dbgLog('realtime: socket error','err')
  }
}

function joinChannel(topic,table){
  _sbSocket.send(JSON.stringify({
    topic:topic,
    event:'phx_join',
    payload:{
      config:{
        postgres_changes:[{event:'*',schema:'public',table:table}]
      }
    },
    ref:(++_sbRefCounter).toString()
  }))
}

function handleRealtimeChange(payload){
  const data=payload.data;if(!data)return
  const table=data.table
  const type=data.type
  const rec=data.record||data.old_record
  if(!rec)return

  if(table==='progress'){
    if(type==='DELETE'){
      delete progress[data.old_record.id]
      if(window.dbgLog)window.dbgLog('realtime: progress DELETE '+data.old_record.id,'info')
    }else{
      progress[rec.id]={tool:rec.tool,ew:rec.ew,date:rec.date,user:rec.user,name:rec.name}
      if(window.dbgLog)window.dbgLog('realtime: progress '+type+' '+rec.id,'info')
    }
  }else if(table==='group_progress'){
    if(type==='DELETE'){
      delete groupProgress[data.old_record.id]
      if(window.dbgLog)window.dbgLog('realtime: group_progress DELETE '+data.old_record.id,'info')
    }else{
      groupProgress[rec.id]={tool:rec.tool,date:rec.date,user:rec.user,name:rec.name}
      if(window.dbgLog)window.dbgLog('realtime: group_progress '+type+' '+rec.id,'info')
    }
  }

  try{refreshMapData()}catch(e){}
  try{if(typeof updateStats!=='undefined')updateStats()}catch(e){}
  try{if(typeof renderLog!=='undefined')renderLog()}catch(e){}
  try{if(typeof updateDistrictStates!=='undefined')updateDistrictStates()}catch(e){}
}
