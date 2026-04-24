// ═══════════════════════════════════════════════════════════════════════════
// 16-locations-detail.js — unified desktop + mobile detail panel.
//
// Three render targets supported via opts:
//   default            — desktop Locations tab sidebar panel (#detail)
//   { mobile: true }   — body-level mobile bottom sheet (#mobile-detail)
//   { logTab: true }   — desktop Log tab sidebar panel (#log-detail)
// ═══════════════════════════════════════════════════════════════════════════

function renderDetail(loc,opts){
  opts=opts||{}
  const isMob=!!opts.mobile
  const isLog=!!opts.logTab
  let prefix,panelId
  if(isLog){prefix='ld-';panelId='log-detail'}
  else if(isMob){prefix='md-';panelId='mobile-detail'}
  else{prefix='d-';panelId='detail'}
  const panelEl=$(panelId)
  const p=progress[loc.id]
  const cleared=!!p

  const typeEl=$(prefix+'type')
  if(typeEl){typeEl.textContent=loc.type;typeEl.className='detail-type '+loc.type}
  const nameEl=$(prefix+'name');if(nameEl)nameEl.textContent=loc.name
  const addrEl=$(prefix+'addr');if(addrEl)addrEl.textContent=loc.address||loc.postcode||''
  const gmEl=$(prefix+'gmaps');if(gmEl)gmEl.href=gmapsUrl(loc)

  const body=$(prefix+'body')
  if(!body)return

  if(cleared){
    const d=new Date(p.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
    const col=toolColor(p.tool)
    const who=p.user?' - '+p.user:''
    // Mobile unmark uses its own flow so the mobile sheet re-renders correctly.
    // Log-tab panel just uses the desktop unmark path.
    const unmarkFn=isMob?'unmarkClearedMobile':'unmarkCleared'
    body.innerHTML=
      '<div class="detail-cleared" style="background:'+col+'18;border:1px solid '+col+'44;color:'+col+'">'+
        'Cleared with <strong>'+(TOOL_NAMES_FULL[p.tool]||p.tool)+(p.ew?' + '+p.ew:'')+'</strong> - '+d+who+
      '</div>'+
      '<button class="btn-unmark" onclick="'+unmarkFn+'(\''+loc.id+'\')">Mark as not cleared</button>'
  }else{
    body.innerHTML=''
    buildMarkForm(body,loc,isMob)
  }

  if(panelEl)panelEl.classList.add('on')
  if(isMob){
    requestAnimationFrame(function(){
      const detailH=panelEl.offsetHeight||0
      if(detailH>0&&loc.lat&&loc.lng){
        map.easeTo({center:[loc.lng,loc.lat],offset:[0,Math.round(detailH/2)],duration:250})
      }
      updateLocateBtnPosition()
    })
  }
}

function buildMarkForm(body,loc,isMob){
  const markFn=isMob?markClearedMobile:markCleared

  const defaultDiv=document.createElement('div');defaultDiv.style.cssText='margin-bottom:10px'
  const defaultLbl=document.createElement('div')
  defaultLbl.style.cssText='font-size:12px;color:var(--soft);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px'
  defaultLbl.textContent='Clearing tool'
  const defaultTool=document.createElement('div')
  defaultTool.style.cssText='font-size:15px;color:var(--gold);font-weight:500'
  defaultTool.textContent=TOOL_NAMES_FULL[currentTool]||currentTool
  defaultDiv.appendChild(defaultLbl);defaultDiv.appendChild(defaultTool)

  const changeLink=document.createElement('button')
  changeLink.className='btn-change-tool'
  changeLink.textContent='Use a different tool'
  changeLink.style.cssText='background:none;border:none;color:var(--soft);font-size:12px;text-decoration:underline;cursor:pointer;padding:2px 0 10px'

  const toolDropWrap=document.createElement('div');toolDropWrap.style.display='none'
  const toolDrop=buildToolDropdown(currentTool,'tool-override-select')
  toolDrop.style.cssText='width:100%;padding:8px 10px;border:1px solid var(--bd);border-radius:8px;color:var(--gold);font-size:14px;margin-bottom:8px'
  toolDropWrap.appendChild(toolDrop)
  changeLink.onclick=function(){toolDropWrap.style.display=(toolDropWrap.style.display==='none'?'block':'none')}

  let ewSelect=null
  if(userHasEarthworks){
    const ewWrap=document.createElement('div');ewWrap.style.cssText='margin-bottom:10px'
    const ewLbl=document.createElement('div')
    ewLbl.style.cssText='font-size:12px;color:var(--soft);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px'
    ewLbl.textContent='Earthworks (optional)'
    ewSelect=document.createElement('select')
    ewSelect.className='tool-ew-select'
    ewSelect.style.cssText='width:100%;padding:8px 10px;font-size:14px;color:var(--gold)'
    const noneOpt=document.createElement('option');noneOpt.value='';noneOpt.textContent='None'
    ewSelect.appendChild(noneOpt)
    EW_LEVELS.forEach(function(ew){const o=document.createElement('option');o.value=ew;o.textContent=ew;ewSelect.appendChild(o)})
    ewWrap.appendChild(ewLbl);ewWrap.appendChild(ewSelect);body.appendChild(ewWrap)
  }

  const markBtn=document.createElement('button')
  markBtn.className='btn-mark'
  markBtn.textContent='Mark cleared with '+(TOOL_NAMES_FULL[currentTool]||currentTool)
  markBtn.onclick=function(){
    const tool=toolDropWrap.style.display!=='none'?toolDrop.value:currentTool
    const ew=ewSelect?ewSelect.value||null:null
    markFn(loc.id,tool,ew)
  }

  function labelFor(){
    const tool=toolDropWrap.style.display!=='none'?toolDrop.value:currentTool
    return 'Mark cleared with '+(TOOL_NAMES_FULL[tool]||tool)+(ewSelect&&ewSelect.value?' + '+ewSelect.value:'')
  }
  toolDrop.onchange=function(){markBtn.textContent=labelFor()}
  if(ewSelect)ewSelect.onchange=function(){markBtn.textContent=labelFor()}

  body.appendChild(defaultDiv)
  body.appendChild(changeLink)
  body.appendChild(toolDropWrap)
  body.appendChild(markBtn)
}

function closeDetail(){
  if(selectedId&&!isMobile())setSelectedId(null)
  const el=$('detail');if(el)el.classList.remove('on')
  renderList()
}

function closeMobileDetail(){
  if(selectedId)setSelectedId(null)
  const el=$('mobile-detail');if(el)el.classList.remove('on')
  renderList();updateLocateBtnPosition()
}

function closeLogDetail(){
  if(selectedId)setSelectedId(null)
  const el=$('log-detail');if(el)el.classList.remove('on')
}
