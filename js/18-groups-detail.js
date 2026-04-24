// ═══════════════════════════════════════════════════════════════════════════
// 18-groups-detail.js — district clearing panel. Inline panel at the bottom of
// the Groups tab sidebar (same pattern as the Locations detail panel). Not a
// modal — no backdrop, no ESC, no focus trap.
//
// Content (top→bottom):
//   1. Stats summary    — per-type mini progress bars
//   2. Type chips       — multi-select; 'done' state when fully cleared
//   3. Tool selector    — dropdown + optional EW chips
//   4. Confirm summary + primary button ("Mark cleared")
//   5. Unmark + inline slide-down confirm
// ═══════════════════════════════════════════════════════════════════════════

let _ddState=null
const DD_TOOLS=['MS','MF','O','J','MG','AP','MI','MJ','DM']

function renderDistrictDetail(code){
  const d=districtMap[code];if(!d)return
  const body=$('dd-body');if(!body)return

  const nameEl=$('dd-name');if(nameEl)nameEl.textContent=d.name
  const typeEl=$('dd-type');if(typeEl)typeEl.textContent=code
  updateDistrictStats(code)

  const availableTypes=['school','gp'].filter(function(t){
    const list=t==='school'?d.schools:d.gps
    return list.length>0
  })

  _ddState={
    code:code,
    availableTypes:availableTypes,
    selectedTypes:availableTypes.length===1?new Set(availableTypes):new Set(),
    tool:currentTool||'O',
    ew:null,
    saveState:'idle',
    errorMsg:null,
    unmarkConfirm:null
  }

  body.innerHTML=''
  body.appendChild(buildDdContent(d,code))

  $('district-detail').classList.add('on')

  if(isMobile()&&selectedDistrictCode){
    setTimeout(function(){fitMapToDistrict(code)},300)
  }
}

function fitMapToDistrict(code){
  const{bottomOffset}=getVisibleMapBounds()
  const pad={top:60,bottom:bottomOffset+80,left:40,right:40}
  const d=districtMap[code]
  const locs=d?[...(groupTypes.has('school')?d.schools:[]),...(groupTypes.has('gp')?d.gps:[])]:[]
  if(locs.length){fitBounds(locs,pad);return}
  const feat=districts.find(f=>f.properties.code===code)
  if(!feat||!mapReady)return
  try{
    const co=feat.geometry.type==='Polygon'?feat.geometry.coordinates[0]:feat.geometry.coordinates.flat()
    map.fitBounds(
      [[Math.min(...co.map(p=>p[0])),Math.min(...co.map(p=>p[1]))],[Math.max(...co.map(p=>p[0])),Math.max(...co.map(p=>p[1]))]],
      {padding:pad,maxZoom:11,duration:600}
    )
  }catch(e){}
}

function buildDdContent(d,code){
  const wrap=document.createElement('div')
  wrap.style.cssText='display:flex;flex-direction:column;gap:12px'

  const st=_ddState
  const fullyCleared=st.availableTypes.length>0 && st.availableTypes.every(function(t){
    return !!groupProgress[code+':'+t]
  })

  if(fullyCleared){
    wrap.appendChild(buildDdFullyClearedView(d,code))
    wrap.appendChild(buildDdUnmarkSection(d,code))
    return wrap
  }

  if(!st.availableTypes.length){
    const empty=document.createElement('div')
    empty.className='empty'
    empty.textContent='No schools or GPs loaded for this district yet.'
    wrap.appendChild(empty)
    return wrap
  }

  wrap.appendChild(buildDdStats(d,code))
  wrap.appendChild(buildDdSectionLabel('Clear'))
  wrap.appendChild(buildDdTypeChips(d,code))
  wrap.appendChild(buildDdSectionLabel('Tool'))
  wrap.appendChild(buildDdToolSelector())
  wrap.appendChild(buildDdConfirmSummary(d,code))
  wrap.appendChild(buildDdMarkButton(d,code))
  if(st.errorMsg)wrap.appendChild(buildDdError(st.errorMsg))

  const hasAnyCleared=st.availableTypes.some(function(t){return !!groupProgress[code+':'+t]})
  if(hasAnyCleared)wrap.appendChild(buildDdUnmarkSection(d,code))

  return wrap
}

function buildDdSectionLabel(text){
  const el=document.createElement('div')
  el.className='dd-section-label'
  el.textContent=text
  return el
}

function buildDdStats(d,code){
  const wrap=document.createElement('div')
  wrap.className='dd-stats'
  _ddState.availableTypes.forEach(function(t){
    const list=t==='school'?d.schools:d.gps
    const tot=list.length
    const grp=groupProgress[code+':'+t]
    const eff=grp?tot:list.filter(l=>progress[l.id]).length
    const pct=tot?Math.round(eff/tot*100):0
    const col=t==='school'?'var(--blue)':'var(--green)'
    const label=t==='school'?'Schools':'GPs'
    const row=document.createElement('div')
    row.className='dd-stat-row'
    row.innerHTML=
      '<div class="dd-stat-head">'+
        '<span class="dd-stat-label" style="color:'+col+'">'+label+'</span>'+
        '<span class="dd-stat-count"><strong>'+eff+'</strong> / '+tot+' cleared</span>'+
      '</div>'+
      '<div class="dd-stat-bar"><div class="dd-stat-fill" style="background:'+col+';width:'+pct+'%"></div></div>'
    row.onclick=function(){toggleDdType(t)}
    wrap.appendChild(row)
  })
  return wrap
}

function buildDdTypeChips(d,code){
  const wrap=document.createElement('div')
  wrap.className='dd-type-chips'
  _ddState.availableTypes.forEach(function(t){
    const list=t==='school'?d.schools:d.gps
    const tot=list.length
    const grp=groupProgress[code+':'+t]
    const done=!!grp
    const remaining=done?0:(tot-list.filter(l=>progress[l.id]).length)
    const chip=document.createElement('button')
    chip.type='button'
    chip.className='dd-type-chip '+t+(done?' done':'')+(_ddState.selectedTypes.has(t)?' on':'')
    chip.innerHTML=
      (t==='school'?'Schools':'GPs')+
      (done
        ?' <span class="dd-type-chip-count">✓ done</span>'
        :' <span class="dd-type-chip-count">('+remaining+' left)</span>')
    if(done){chip.disabled=true}
    else{chip.onclick=function(){toggleDdType(t)}}
    wrap.appendChild(chip)
  })
  return wrap
}

function toggleDdType(t){
  if(!_ddState)return
  const d=districtMap[_ddState.code];if(!d)return
  if(groupProgress[_ddState.code+':'+t])return
  if(_ddState.selectedTypes.has(t))_ddState.selectedTypes.delete(t)
  else _ddState.selectedTypes.add(t)
  reRenderDd()
}

function buildDdToolSelector(){
  const wrap=document.createElement('div')
  wrap.className='dd-tool-wrap'
  const sel=document.createElement('select')
  sel.className='dd-tool-select'
  DD_TOOLS.forEach(function(code){
    const opt=document.createElement('option')
    opt.value=code
    opt.textContent=code+' — '+(TOOL_NAMES[code]||code)
    if(code===_ddState.tool)opt.selected=true
    sel.appendChild(opt)
  })
  sel.onchange=function(){_ddState.tool=sel.value;reRenderDd()}
  wrap.appendChild(sel)
  if(localStorage.getItem('ek_ew')==='1'){
    const ewRow=document.createElement('div')
    ewRow.className='dd-ew-row'
    const noneBtn=document.createElement('button')
    noneBtn.type='button'
    noneBtn.className='dd-ew-chip'+(!_ddState.ew?' on':'')
    noneBtn.textContent='No EW'
    noneBtn.onclick=function(){_ddState.ew=null;reRenderDd()}
    ewRow.appendChild(noneBtn)
    ;['EW1','EW2','EW3','EW4','EW5'].forEach(function(ew){
      const b=document.createElement('button')
      b.type='button'
      b.className='dd-ew-chip'+(_ddState.ew===ew?' on':'')
      b.textContent=ew
      b.onclick=function(){_ddState.ew=ew;reRenderDd()}
      ewRow.appendChild(b)
    })
    wrap.appendChild(ewRow)
  }
  return wrap
}

function buildDdConfirmSummary(d,code){
  const st=_ddState
  const parts=[]
  const counts={school:d.schools.length,gp:d.gps.length}
  st.selectedTypes.forEach(function(t){
    parts.push(counts[t]+' '+(t==='school'?(counts[t]===1?'school':'schools'):(counts[t]===1?'GP':'GPs')))
  })
  const el=document.createElement('div')
  el.className='dd-confirm-summary'
  if(!parts.length){
    el.classList.add('muted')
    el.textContent='Select Schools or GPs above to continue'
    return el
  }
  const toolName=TOOL_NAMES[st.tool]||st.tool
  const ewBit=st.ew?' + '+st.ew:''
  el.innerHTML='Clear <em>'+parts.join(' and ')+'</em> in <em>'+d.name+'</em> using <em>'+toolName+ewBit+'</em>'
  return el
}

function buildDdMarkButton(d,code){
  const st=_ddState
  const btn=document.createElement('button')
  btn.type='button'
  btn.className='dd-btn-mark'
  const label=st.saveState==='saving'?'Marking…':st.saveState==='success'?'Marked ✓':'Mark cleared'
  if(st.saveState==='saving')btn.classList.add('saving')
  if(st.saveState==='success')btn.classList.add('success')
  btn.textContent=label
  const disabled=!st.selectedTypes.size||!st.tool||st.saveState==='saving'||st.saveState==='success'
  btn.disabled=disabled
  btn.onclick=function(){doDdMark(d,code)}
  return btn
}

function buildDdError(msg){
  const el=document.createElement('div')
  el.className='dd-error'
  el.textContent=msg
  return el
}

function buildDdUnmarkSection(d,code){
  const wrap=document.createElement('div')
  wrap.className='dd-unmark-wrap'
  const clearedTypes=_ddState.availableTypes.filter(function(t){return !!groupProgress[code+':'+t]})
  if(!clearedTypes.length)return wrap
  if(_ddState.unmarkConfirm&&clearedTypes.indexOf(_ddState.unmarkConfirm)>=0){
    const gtype=_ddState.unmarkConfirm
    const typeLabel=gtype==='school'?'schools':'GPs'
    const count=(gtype==='school'?d.schools.length:d.gps.length)
    const confirm=document.createElement('div')
    confirm.className='dd-inline-confirm'
    confirm.innerHTML=
      '<div class="dd-inline-confirm-text">Remove your group clearing for <strong>'+count+' '+typeLabel+'</strong> in '+d.name+'?</div>'+
      '<div class="dd-inline-confirm-btns">'+
        '<button type="button" class="dd-inline-confirm-no" data-act="no">Cancel</button>'+
        '<button type="button" class="dd-inline-confirm-yes" data-act="yes">Remove</button>'+
      '</div>'
    confirm.querySelector('[data-act="no"]').onclick=function(){_ddState.unmarkConfirm=null;reRenderDd()}
    confirm.querySelector('[data-act="yes"]').onclick=function(){doDdUnmark(code,gtype)}
    wrap.appendChild(confirm)
    return wrap
  }
  clearedTypes.forEach(function(t){
    const btn=document.createElement('button')
    btn.type='button'
    btn.className='dd-btn-unmark'
    btn.textContent='Unmark '+(t==='school'?'Schools':'GPs')
    btn.onclick=function(){_ddState.unmarkConfirm=t;reRenderDd()}
    wrap.appendChild(btn)
  })
  return wrap
}

function buildDdFullyClearedView(d,code){
  const wrap=document.createElement('div')
  wrap.className='dd-full-cleared'
  const lines=_ddState.availableTypes.map(function(t){
    const g=groupProgress[code+':'+t]
    const dt=g?new Date(g.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):''
    const label=t==='school'?'Schools':'GPs'
    return label+' · <strong>'+(TOOL_NAMES[g.tool]||g.tool)+'</strong> · '+dt+(g.user?' · '+g.user:'')
  }).join('<br>')
  wrap.innerHTML=
    '<div class="dd-full-cleared-icon">✨</div>'+
    '<div class="dd-full-cleared-title">Fully cleared</div>'+
    '<div class="dd-full-cleared-meta">'+lines+'</div>'
  return wrap
}

async function doDdMark(d,code){
  const st=_ddState
  if(!st.selectedTypes.size||!st.tool)return
  st.saveState='saving';st.errorMsg=null
  reRenderDd()
  const selected=[...st.selectedTypes]
  try{
    for(const t of selected){
      await markGroupCleared(code,t,st.tool)
    }
    st.saveState='success';reRenderDd()
    setTimeout(function(){
      // Reset to idle so the panel stays open and usable with the updated cleared state.
      if(_ddState&&_ddState.code===code){st.saveState='idle';st.selectedTypes=new Set();reRenderDd()}
    },1200)
  }catch(e){
    st.saveState='error'
    st.errorMsg="Couldn't save — check connection"
    reRenderDd()
    if(window.dbgLog)window.dbgLog('doDdMark failed: '+e.message,'err')
  }
}

async function doDdUnmark(code,gtype){
  try{
    await unmarkGroupCleared(code,gtype)
    _ddState.unmarkConfirm=null
    reRenderDd()
  }catch(e){
    _ddState.unmarkConfirm=null
    _ddState.errorMsg="Couldn't remove — check connection"
    reRenderDd()
  }
}

function reRenderDd(){
  if(!_ddState)return
  const body=$('dd-body');if(!body)return
  const d=districtMap[_ddState.code];if(!d)return
  body.innerHTML=''
  body.appendChild(buildDdContent(d,_ddState.code))
}

window.reRenderDistrictDetailIfOpen=function(code){
  if(!_ddState||_ddState.code!==code)return
  if(!$('district-detail')||!$('district-detail').classList.contains('on'))return
  reRenderDd()
}
