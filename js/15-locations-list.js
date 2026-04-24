// ═══════════════════════════════════════════════════════════════════════════
// 15-locations-list.js — Locations tab search results list + selectLoc
// ═══════════════════════════════════════════════════════════════════════════

function renderList(){
  const el=$('llist'),sEl=$('search')
  if(!el||!sEl)return
  const q=sEl.value.toLowerCase().trim()
  el.classList.toggle('active',!!q)
  if(!q){el.innerHTML='';return}
  const vis=locations.filter(function(l){
    if(!locVisible(l))return false
    return l.name.toLowerCase().includes(q)||(l.address||'').toLowerCase().includes(q)||(l.postcode||'').toLowerCase().includes(q)
  })
  if(!vis.length){el.innerHTML='<div class="empty">No matches for "'+q+'"</div>';return}
  el.innerHTML=vis.map(function(l){
    const p=progress[l.id]
    const dotBg=p?GOLD:typeColor(l.type)
    const dotBorder=p?'border:2px solid '+toolColor(p.tool):'border:2px solid transparent'
    const badge=p?'<div class="lbadge" style="color:'+toolColor(p.tool)+';border-color:'+toolColor(p.tool)+'66;background:'+toolColor(p.tool)+'14">'+TOOL_NAMES[p.tool]+'</div>':''
    return '<div class="litem '+(p?'done':'')+' '+(selectedId===l.id?'sel':'')+'" onclick="selectLoc(\''+l.id+'\')"><div class="ldot" style="background:'+dotBg+';'+dotBorder+'"></div><div class="linfo"><div class="lname">'+l.name+'</div><div class="lmeta">'+l.type+' - '+(l.address||l.postcode||'')+'</div></div>'+badge+'</div>'
  }).join('')
}

function selectLoc(id){
  setSelectedId(id)
  const loc=locations.find(l=>l.id===id);if(!loc)return
  renderList()
  if(loc.lat&&loc.lng)panToVisible(loc.lat,loc.lng,null)
  if(isMobile()){
    const s=$('search');if(s)s.value=''
    renderList()
    renderDetail(loc,{mobile:true})
  }else{
    renderDetail(loc,{mobile:false})
  }
}
