// ═══════════════════════════════════════════════════════════════════════════
// 15-locations-list.js — Locations tab search results list + selectLoc
//
// Order of operations in selectLoc is important on mobile: we open the popup
// FIRST so that panToVisible can measure its height and bias the map so the
// selected point sits in the visible region above the popup.
// ═══════════════════════════════════════════════════════════════════════════

function renderLitem(l){
  const p=progress[l.id]
  const dotBg=p?GOLD:typeColor(l.type)
  const dotBorder=p?'border:2px solid '+toolColor(p.tool):'border:2px solid transparent'
  const badge=p?'<div class="lbadge" style="color:'+toolColor(p.tool)+';border-color:'+toolColor(p.tool)+'66;background:'+toolColor(p.tool)+'14">'+TOOL_NAMES[p.tool]+'</div>':''
  return '<div class="litem '+(p?'done':'')+' '+(selectedId===l.id?'sel':'')+'" onclick="selectLoc(\''+l.id+'\')"><div class="ldot" style="background:'+dotBg+';'+dotBorder+'"></div><div class="linfo"><div class="lname">'+l.name+'</div><div class="lmeta">'+l.type+' - '+(l.address||l.postcode||'')+'</div></div>'+badge+'</div>'
}

function renderList(){
  const el=$('llist'),sEl=$('search')
  if(!el||!sEl)return
  // Area view: list mirrors the map — loaded locations within the current map
  // bounds, respecting the Places/Show chips (locVisible). Driven by 27-search.js.
  if(window.areaView&&window.areaView.active&&mapReady&&typeof map!=='undefined'&&map.getBounds){
    el.classList.add('active')
    const b=map.getBounds()
    const inView=locations.filter(l=>l.lat&&l.lng&&locVisible(l)&&b.contains([l.lng,l.lat]))
    if(!inView.length){el.innerHTML='<div class="empty">No clearable places in view</div>';return}
    const cap=inView.slice(0,300)
    el.innerHTML=cap.map(renderLitem).join('')+(inView.length>cap.length?'<div class="empty">+'+(inView.length-cap.length)+' more — zoom in</div>':'')
    return
  }
  const q=sEl.value.toLowerCase().trim()
  el.classList.toggle('active',!!q)
  if(!q){el.innerHTML='';return}
  let html=''
  // "Jump to area" rows on top (from 27-search.js, async for this query)
  const ar=window.searchAreasResult
  if(ar&&ar.q&&ar.q.toLowerCase()===q&&ar.areas&&ar.areas.length){
    html+='<div class="lsec">Jump to area</div>'
    html+=ar.areas.map(function(a,i){
      return '<div class="larea" onclick="gotoAreaByIndex('+i+')"><span class="larea-pin">📍</span><span class="larea-name">'+a.label+'</span><span class="larea-sub">'+(a.sub||'')+'</span></div>'
    }).join('')
  }
  // Matching locations beneath
  const vis=locations.filter(function(l){
    if(!locVisible(l))return false
    return l.name.toLowerCase().includes(q)||(l.address||'').toLowerCase().includes(q)||(l.postcode||'').toLowerCase().includes(q)
  })
  if(vis.length){
    if(html)html+='<div class="lsec">Locations</div>'
    const cap=vis.slice(0,300)
    html+=cap.map(renderLitem).join('')
    if(vis.length>cap.length)html+='<div class="empty">+'+(vis.length-cap.length)+' more — refine search</div>'
  }else if(!(ar&&ar.areas&&ar.areas.length)){
    html='<div class="empty">No matches for "'+sEl.value.trim()+'"</div>'
  }
  el.innerHTML=html
}

function selectLoc(id){
  setSelectedId(id)
  const loc=locations.find(l=>l.id===id);if(!loc)return
  renderList()
  if(isMobile()){
    const s=$('search');if(s)s.value=''
    renderList()
    renderDetail(loc,{mobile:true})
    // Pan AFTER the panel has a chance to size, so bottomOffset is accurate.
    requestAnimationFrame(function(){
      if(loc.lat&&loc.lng)flyToLoc(loc.lat,loc.lng)
    })
  }else{
    renderDetail(loc,{mobile:false})
    if(loc.lat&&loc.lng)flyToLoc(loc.lat,loc.lng)
  }
}
