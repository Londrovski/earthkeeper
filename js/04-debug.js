// ═══════════════════════════════════════════════════════════════════════════
// 04-debug.js — debug panel, error capture, dbgLog. Active from page load.
// ═══════════════════════════════════════════════════════════════════════════

(function(){
  const MAX_LINES=400
  const lines=[]
  let panelOpen=false

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
      '<div id="dbg-actions">'+
        '<button class="dbg-action" data-act="state">Check state</button>'+
        '<button class="dbg-action" data-act="ids">Check IDs</button>'+
        '<button class="dbg-action" data-act="dump">Dump progress</button>'+
        '<button class="dbg-action" data-act="save">Test save</button>'+
        '<button class="dbg-action" data-act="reload">Reload data</button>'+
        '<button class="dbg-action danger" data-act="clear">Clear log</button>'+
      '</div>'+
      '<div id="dbg-log"></div>'
    document.body.appendChild(panel)

    document.getElementById('dbg-close').onclick=closePanel
    panel.addEventListener('click',function(e){
      const a=e.target&&e.target.closest&&e.target.closest('[data-act]')
      if(!a)return
      const act=a.getAttribute('data-act')
      if(act==='state')actCheckState()
      else if(act==='ids')actCheckIds()
      else if(act==='dump')actDumpProgress()
      else if(act==='save')actTestSave()
      else if(act==='reload')actReload()
      else if(act==='clear')clearLog()
    })
  }

  function openPanel(){panelOpen=true;document.getElementById('dbg-panel').classList.add('on');document.getElementById('dbg-btn').classList.add('active');render()}
  function closePanel(){panelOpen=false;document.getElementById('dbg-panel').classList.remove('on');document.getElementById('dbg-btn').classList.remove('active')}

  // ── Debug actions ────────────────────────────────────────────────────────

  function actCheckState(){
    dbgLog('── Check state ──','hdr')
    try{
      dbgLog('locations.length = '+(typeof locations!=='undefined'?locations.length:'UNDEFINED'),'info')
      dbgLog('progress keys = '+(typeof progress!=='undefined'?Object.keys(progress).length:'UNDEFINED'),'info')
      dbgLog('groupProgress keys = '+(typeof groupProgress!=='undefined'?Object.keys(groupProgress).length:'UNDEFINED'),'info')
      dbgLog('currentUser = '+(typeof currentUser!=='undefined'?currentUser:'UNDEFINED'),'info')
      dbgLog('currentTool = '+(typeof currentTool!=='undefined'?currentTool:'UNDEFINED'),'info')
      dbgLog('mapReady = '+(typeof mapReady!=='undefined'?mapReady:'UNDEFINED'),'info')
      dbgLog('schoolsGpsLoaded = '+(typeof schoolsGpsLoaded!=='undefined'?schoolsGpsLoaded:'UNDEFINED'),'info')
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

  async function actTestSave(){
    dbgLog('── Test save ──','hdr')
    try{
      if(typeof saveProgress==='undefined'){dbgLog('saveProgress() not defined yet','err');return}
      dbgLog('Calling saveProgress()...','info')
      await saveProgress()
      dbgLog('saveProgress() resolved','info')
    }catch(e){dbgLog('Test save threw: '+e.message,'err')}
  }

  async function actReload(){
    dbgLog('── Reload data ──','hdr')
    try{
      if(typeof loadProgress==='undefined'){dbgLog('loadProgress() not defined','err');return}
      await loadProgress()
      dbgLog('Progress reloaded, '+Object.keys(progress).length+' entries','ok')
      if(typeof renderLog!=='undefined')renderLog()
    }catch(e){dbgLog('Reload threw: '+e.message,'err')}
  }

  // ── Error capture ────────────────────────────────────────────────────────

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

  window.dbgLog=dbgLog
  window.dbgClearLog=clearLog
})()
