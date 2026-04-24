// ═══════════════════════════════════════════════════════════════════════════
// 04-debug.js — debug panel, error capture, dbgLog. Active from page load.
// Only visible to James Morris.
// ═══════════════════════════════════════════════════════════════════════════

(function(){
  const MAX_LINES=600
  const ADMIN_NAME='James Morris'
  const lines=[]
  let panelOpen=false
  let statusPollHandle=null

  function ts(){
    const d=new Date()
    return d.toTimeString().slice(0,8)+'.'+String(d.getMilliseconds()).padStart(3,'0')
  }

  function render(){
    const el=document.getElementById('dbg-log')
    if(!el||!panelOpen)return
    el.innerHTML=lines.join('\n')
    el.scrollTop=el.scrollHeight
  }

  function dbgLog(msg,level){
    const cls=level||'info'
    const line='<span class="dim">['+ts()+']</span> <span class="'+cls+'">'+escape(String(msg))+'</span>'
    lines.push(line)
    if(lines.length>MAX_LINES)lines.shift()
    render()
  }
  function escape(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

  function clearLog(){lines.length=0;render()}

  // ── Admin-only visibility ──────────────────────────────────────────────
  function isAdmin(){
    try{
      if(typeof currentUser!=='undefined'&&currentUser===ADMIN_NAME)return true
      const saved=localStorage.getItem('ek_user')
      return saved===ADMIN_NAME
    }catch(e){return false}
  }
  function updateVisibility(){
    const btn=document.getElementById('dbg-btn')
    const panel=document.getElementById('dbg-panel')
    const show=isAdmin()
    if(btn)btn.style.display=show?'flex':'none'
    if(!show&&panel)panel.classList.remove('on')
  }

  // ── Panel construction ─────────────────────────────────────────────────────
  function buildPanel(){
    if(document.getElementById('dbg-btn'))return
    const btn=document.createElement('button')
    btn.id='dbg-btn';btn.type='button';btn.title='Debug'
    btn.textContent='\uD83D\uDC1B'
    btn.onclick=function(){openPanel()}
    document.body.appendChild(btn)

    const panel=document.createElement('div')
    panel.id='dbg-panel'
    panel.innerHTML=
      '<div id="dbg-title">Debug</div>'+
      '<button id="dbg-close" type="button">\u00D7</button>'+
      '<div id="dbg-status" style="padding:4px 8px;font-size:11px;color:#E8D5A0;margin-bottom:6px;border:1px solid rgba(201,168,76,.2);border-radius:4px;background:rgba(0,0,0,.4)">status loading…</div>'+
      '<div id="dbg-actions">'+
        '<button class="dbg-action" data-act="state">State</button>'+
        '<button class="dbg-action" data-act="ids">Check IDs</button>'+
        '<button class="dbg-action" data-act="dump">Dump progress</button>'+
        '<button class="dbg-action" data-act="audit">View audit log</button>'+
        '<button class="dbg-action" data-act="sb-ping">Supabase ping</button>'+
        '<button class="dbg-action" data-act="sb-select">SB select all</button>'+
        '<button class="dbg-action" data-act="sb-upsert">SB test upsert</button>'+
        '<button class="dbg-action" data-act="sb-delete">SB test delete</button>'+
        '<button class="dbg-action" data-act="rt-status">Realtime status</button>'+
        '<button class="dbg-action" data-act="rt-reconnect">Realtime reconnect</button>'+
        '<button class="dbg-action" data-act="reload">Reload from SB</button>'+
        '<button class="dbg-action danger" data-act="clear">Clear log</button>'+
      '</div>'+
      '<div id="dbg-log"></div>'
    document.body.appendChild(panel)

    document.getElementById('dbg-close').onclick=closePanel
    panel.addEventListener('click',function(e){
      const a=e.target&&e.target.closest&&e.target.closest('[data-act]')
      if(!a)return
      const act=a.getAttribute('data-act')
      const handlers={
        'state':actCheckState,
        'ids':actCheckIds,
        'dump':actDumpProgress,
        'audit':actAuditLog,
        'sb-ping':actSbPing,
        'sb-select':actSbSelect,
        'sb-upsert':actSbUpsert,
        'sb-delete':actSbDelete,
        'rt-status':actRealtimeStatus,
        'rt-reconnect':actRealtimeReconnect,
        'reload':actReload,
        'clear':clearLog
      }
      if(handlers[act])handlers[act]()
    })
    updateVisibility()
  }

  function openPanel(){
    panelOpen=true
    document.getElementById('dbg-panel').classList.add('on')
    document.getElementById('dbg-btn').classList.add('active')
    render()
    updateStatusBar()
    if(!statusPollHandle)statusPollHandle=setInterval(updateStatusBar,1500)
  }
  function closePanel(){
    panelOpen=false
    document.getElementById('dbg-panel').classList.remove('on')
    document.getElementById('dbg-btn').classList.remove('active')
    if(statusPollHandle){clearInterval(statusPollHandle);statusPollHandle=null}
  }

  // ── Live status bar (refreshes while panel is open) ──────────────────────
  function rtStateLabel(){
    if(typeof _sbSocket==='undefined'||!_sbSocket)return 'no socket'
    const s=_sbSocket.readyState
    return s===0?'CONNECTING':s===1?'OPEN':s===2?'CLOSING':s===3?'CLOSED':('state='+s)
  }
  function updateStatusBar(){
    const el=document.getElementById('dbg-status');if(!el)return
    const pKeys=(typeof progress!=='undefined')?Object.keys(progress).length:'?'
    const gKeys=(typeof groupProgress!=='undefined')?Object.keys(groupProgress).length:'?'
    const user=(typeof currentUser!=='undefined')?(currentUser||'—'):'—'
    const rt=rtStateLabel()
    const rtColor=rt==='OPEN'?'#80d080':rt==='CONNECTING'?'#ffc080':'#ff9090'
    el.innerHTML=
      '<strong>User:</strong> '+escape(user)+
      ' &nbsp; <strong>progress:</strong> '+pKeys+
      ' &nbsp; <strong>groups:</strong> '+gKeys+
      ' &nbsp; <strong>RT:</strong> <span style="color:'+rtColor+'">'+rt+'</span>'
  }

  // ── Existing checks ───────────────────────────────────────────────────
  function actCheckState(){
    dbgLog('── State ──','hdr')
    try{
      dbgLog('locations.length = '+(typeof locations!=='undefined'?locations.length:'UNDEFINED'),'info')
      dbgLog('progress keys = '+(typeof progress!=='undefined'?Object.keys(progress).length:'UNDEFINED'),'info')
      dbgLog('groupProgress keys = '+(typeof groupProgress!=='undefined'?Object.keys(groupProgress).length:'UNDEFINED'),'info')
      dbgLog('currentUser = '+(typeof currentUser!=='undefined'?currentUser:'UNDEFINED'),'info')
      dbgLog('currentTool = '+(typeof currentTool!=='undefined'?currentTool:'UNDEFINED'),'info')
      dbgLog('mapReady = '+(typeof mapReady!=='undefined'?mapReady:'UNDEFINED'),'info')
      dbgLog('schoolsGpsLoaded = '+(typeof schoolsGpsLoaded!=='undefined'?schoolsGpsLoaded:'UNDEFINED'),'info')
      dbgLog('Supabase URL = '+(typeof SUPABASE_URL!=='undefined'?SUPABASE_URL:'UNDEFINED'),'info')
      dbgLog('Realtime socket = '+rtStateLabel(),'info')
      if(typeof locations!=='undefined'&&locations.length){
        const by={}
        locations.forEach(function(l){by[l.type]=(by[l.type]||0)+1})
        dbgLog('  by type: '+JSON.stringify(by),'dim')
      }
    }catch(e){dbgLog('actCheckState failed: '+e.message,'err')}
  }

  function actCheckIds(){
    dbgLog('── Check progress IDs vs locations ──','hdr')
    try{
      if(typeof progress==='undefined'||typeof locations==='undefined'){dbgLog('progress or locations undefined','err');return}
      const keys=Object.keys(progress)
      if(!keys.length){dbgLog('progress is empty','warn');return}
      dbgLog('progress has '+keys.length+' entries, locations has '+locations.length,'dim')
      let hit=0,miss=0
      keys.forEach(function(id){
        const l=locations.find(function(x){return x.id===id})
        if(l){hit++;dbgLog('  \u2713 '+id+' \u2192 '+l.name+' ('+l.type+')','ok')}
        else{miss++;dbgLog('  \u2717 '+id+' NOT FOUND in locations','err')}
      })
      dbgLog('Result: '+hit+' matched, '+miss+' missing','info')
    }catch(e){dbgLog('actCheckIds failed: '+e.message,'err')}
  }

  function actDumpProgress(){
    dbgLog('── Dump progress ──','hdr')
    try{
      if(typeof progress==='undefined'){dbgLog('progress undefined','err');return}
      dbgLog(JSON.stringify(progress,null,2),'dim')
    }catch(e){dbgLog('actDumpProgress failed: '+e.message,'err')}
  }

  // ── Audit log view ────────────────────────────────────────────────────
  async function actAuditLog(){
    dbgLog('── Audit log (most recent 100) ──','hdr')
    try{
      if(typeof fetchRecentAuditLog!=='function'){dbgLog('fetchRecentAuditLog not defined','err');return}
      const rows=await fetchRecentAuditLog(100)
      if(!rows.length){dbgLog('(audit log is empty)','dim');return}
      dbgLog(rows.length+' entries:','info')
      rows.forEach(function(r){
        const when=new Date(r.created_at).toLocaleString('en-GB')
        const who=r.user||'—'
        const action=r.action.padEnd(14,' ')
        const name=r.target_name||r.target_id
        let detail=''
        if(r.action==='clear'||r.action==='group_clear'){
          detail=(r.tool||'?')+(r.ew?' + '+r.ew:'')
          if(r.previous_tool&&r.previous_tool!==r.tool)detail+=' (was '+r.previous_tool+')'
        }else{
          detail='(was '+(r.previous_tool||'?')+')'
        }
        dbgLog(when+'  '+action+'  '+name+'  ·  '+detail+'  ·  '+who,'info')
      })
    }catch(e){dbgLog('audit log threw: '+e.message,'err')}
  }

  // ── Supabase-specific actions ──────────────────────────────────────────────

  async function actSbPing(){
    dbgLog('── Supabase ping ──','hdr')
    try{
      const t0=performance.now()
      const res=await fetch(SB_REST+'/progress?select=id&limit=1',{headers:SB_HEADERS,cache:'no-store'})
      const ms=Math.round(performance.now()-t0)
      const txt=await res.text()
      if(res.ok){dbgLog('  \u2713 '+res.status+' in '+ms+'ms. Response: '+txt.slice(0,200),'ok')}
      else{dbgLog('  \u2717 '+res.status+' in '+ms+'ms: '+txt.slice(0,200),'err')}
    }catch(e){dbgLog('  \u2717 ping threw: '+e.message,'err')}
  }

  async function actSbSelect(){
    dbgLog('── Supabase SELECT * ──','hdr')
    try{
      const t0=performance.now()
      const p=await sbSelectAll('progress')
      dbgLog('  progress: '+p.length+' rows in '+Math.round(performance.now()-t0)+'ms','ok')
      p.slice(0,5).forEach(function(r){dbgLog('    '+r.id+' ('+r.tool+') '+r.name,'dim')})
      if(p.length>5)dbgLog('    ... and '+(p.length-5)+' more','dim')
      const t1=performance.now()
      const g=await sbSelectAll('group_progress')
      dbgLog('  group_progress: '+g.length+' rows in '+Math.round(performance.now()-t1)+'ms','ok')
      g.slice(0,5).forEach(function(r){dbgLog('    '+r.id+' ('+r.tool+')','dim')})
    }catch(e){dbgLog('  \u2717 select threw: '+e.message,'err')}
  }

  async function actSbUpsert(){
    dbgLog('── Supabase test upsert ──','hdr')
    const testId='_debug_test_'+Date.now()
    const row={id:testId,tool:'O',ew:null,date:new Date().toISOString().slice(0,10),user:(currentUser||'debug'),name:'DEBUG TEST ROW'}
    dbgLog('  upserting '+testId,'dim')
    try{
      const ok=await sbUpsertRow('progress',row)
      if(ok){dbgLog('  \u2713 upsert returned true. Check Table Editor to confirm.','ok')
        dbgLog('  Use "SB test delete" to clean up '+testId,'dim')}
      else{dbgLog('  \u2717 upsert returned false','err')}
    }catch(e){dbgLog('  \u2717 upsert threw: '+e.message,'err')}
  }

  async function actSbDelete(){
    dbgLog('── Supabase test delete (any rows starting with _debug_test_) ──','hdr')
    try{
      const rows=await sbSelectAll('progress')
      const testRows=rows.filter(function(r){return r.id.indexOf('_debug_test_')===0})
      if(!testRows.length){dbgLog('  no test rows to delete','info');return}
      for(const r of testRows){
        const ok=await sbDeleteRow('progress',r.id)
        dbgLog('  '+(ok?'\u2713':'\u2717')+' deleted '+r.id,ok?'ok':'err')
      }
    }catch(e){dbgLog('  \u2717 delete threw: '+e.message,'err')}
  }

  function actRealtimeStatus(){
    dbgLog('── Realtime status ──','hdr')
    dbgLog('  socket: '+rtStateLabel(),'info')
    if(typeof _sbSocket!=='undefined'&&_sbSocket){
      dbgLog('  URL: '+_sbSocket.url,'dim')
      dbgLog('  bufferedAmount: '+_sbSocket.bufferedAmount,'dim')
    }
  }

  function actRealtimeReconnect(){
    dbgLog('── Realtime reconnect ──','hdr')
    try{
      if(typeof startRealtime==='function'){
        startRealtime()
        dbgLog('  startRealtime() called','ok')
      }else{
        dbgLog('  startRealtime not defined','err')
      }
    }catch(e){dbgLog('  threw: '+e.message,'err')}
  }

  async function actReload(){
    dbgLog('── Reload from Supabase ──','hdr')
    try{
      if(typeof loadProgress==='undefined'){dbgLog('loadProgress() not defined','err');return}
      const t0=performance.now()
      await loadProgress()
      dbgLog('  progress: '+Object.keys(progress).length+' entries in '+Math.round(performance.now()-t0)+'ms','ok')
      const t1=performance.now()
      await loadGroupProgress()
      dbgLog('  group_progress: '+Object.keys(groupProgress).length+' entries in '+Math.round(performance.now()-t1)+'ms','ok')
      if(typeof refreshMapData!=='undefined')refreshMapData()
      if(typeof renderLog!=='undefined')renderLog()
      if(typeof updateStats!=='undefined')updateStats()
    }catch(e){dbgLog('Reload threw: '+e.message,'err')}
  }

  // ── Error capture ─────────────────────────────────────────────────────
  window.addEventListener('error',function(e){
    dbgLog('window.onerror: '+(e.message||'?')+' @ '+(e.filename||'?')+':'+(e.lineno||'?'),'err')
  })
  window.addEventListener('unhandledrejection',function(e){
    dbgLog('unhandledrejection: '+((e.reason&&(e.reason.message||e.reason))||'?'),'err')
  })

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',buildPanel)
  }else{
    buildPanel()
  }

  // Re-check admin status every second so the button appears/disappears on login/logout.
  setInterval(updateVisibility,1000)

  window.dbgLog=dbgLog
  window.dbgClearLog=clearLog
  window.dbgUpdateVisibility=updateVisibility
})()
