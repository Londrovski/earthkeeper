// ═══════════════════════════════════════════════════════════════════════════
// 19-log.js — Log tab: scope toggle (All/My), search, entries, openFromLog
// ═══════════════════════════════════════════════════════════════════════════

function setLogScope(mode,btn){
  if(mode!=='all'&&mode!=='my')mode='all'
  logScope=mode
  const allBtn=$('log-scope-all'),myBtn=$('log-scope-my')
  if(allBtn)allBtn.classList.toggle('on',mode==='all')
  if(myBtn)myBtn.classList.toggle('on',mode==='my')
  renderLog()
  updateLogStats()
  if(typeof refreshMapData==='function')refreshMapData()
}

function renderLog(){
  const el=$('log-list');if(!el)return
  const searchEl=$('log-search')
  const q=(searchEl&&searchEl.value||'').toLowerCase().trim()

  updateLogStats()

  let entries=Object.entries(progress).map(function(kv){
    const id=kv[0],p=kv[1]
    const l=locations.find(x=>x.id===id)
    return{id:id,kind:'loc',name:l?l.name:(p.name||id),type:l?l.type:null,tool:p.tool,ew:p.ew,date:p.date,user:p.user||''}
  })

  Object.entries(groupProgress).forEach(function(kv){
    const key=kv[0],p=kv[1]
    const parts=key.split(':'),code=parts[0],gtype=parts[1]
    const dName=(districtMap[code]&&districtMap[code].name)||p.name||code
    entries.push({id:key,kind:'group',name:dName+' — '+(gtype==='school'?'Schools':'GPs'),type:gtype,tool:p.tool,ew:null,date:p.date,user:p.user||'',isGroup:true})
  })

  if(logScope==='my'&&currentUser){
    entries=entries.filter(e=>e.user===currentUser)
  }
  if(q)entries=entries.filter(e=>e.name.toLowerCase().includes(q))

  entries.sort((a,b)=>b.date.localeCompare(a.date))

  if(!entries.length){
    el.innerHTML='<div class="empty">'+(logScope==='my'?'You haven\u2019t cleared anything yet':'No clearings logged yet')+'</div>'
    return
  }

  el.innerHTML=entries.map(function(e){
    const col=toolColor(e.tool)
    const d=new Date(e.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
    const tag=e.isGroup?'<span style="font-size:9px;background:rgba(201,168,76,.2);border:1px solid rgba(201,168,76,.4);color:var(--gold);padding:1px 6px;border-radius:8px;margin-left:6px">GROUP</span>':''
    return '<div class="log-entry" onclick="openFromLog(\''+e.id+'\',\''+e.kind+'\')" style="padding:10px 20px;border-bottom:1px solid var(--bd);cursor:pointer;display:flex;gap:10px;align-items:flex-start">'+
      '<div style="width:10px;height:10px;border-radius:50%;background:'+GOLD+';border:2px solid '+col+';flex-shrink:0;margin-top:5px"></div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:14px;color:var(--ink-d);font-weight:500">'+e.name+tag+'</div>'+
        '<div style="font-size:12px;color:var(--soft);margin-top:2px">'+(e.user||'—')+' · '+d+' · '+(TOOL_NAMES_FULL[e.tool]||e.tool)+(e.ew?' + '+e.ew:'')+'</div>'+
      '</div>'+
    '</div>'
  }).join('')
}

function openFromLog(id,kind){
  if(kind==='group'){
    const code=id.split(':')[0]
    switchTab('groups',$('tab-btn-groups'))
    setTimeout(function(){selectDistrict(code)},120)
    return
  }
  const loc=locations.find(l=>l.id===id);if(!loc)return
  setSelectedId(id)
  if(isMobile()){
    renderDetail(loc,{mobile:true})
  }else{
    renderDetail(loc,{logTab:true})
  }
  requestAnimationFrame(function(){
    if(loc.lat&&loc.lng)panToVisible(loc.lat,loc.lng,null)
  })
}
