// ═══════════════════════════════════════════════════════════════════════════
// 17-groups-list.js — district list + select flow, close district detail
// ═══════════════════════════════════════════════════════════════════════════

function renderDistrictList(){
  const el=$('district-list');if(!el)return
  const searchEl=$('group-search')
  const hasQuery=(searchEl&&searchEl.value||'').trim().length>0
  if(isMobile())el.style.display=hasQuery?'':'none'
  const q=(searchEl&&searchEl.value||'').toLowerCase().trim()
  let entries=Object.values(districtMap).filter(d=>d.name&&(!q||d.name.toLowerCase().includes(q)))
  if(isMobile())el.style.display=entries.length&&hasQuery?'':'none'
  if(!entries.length){
    el.innerHTML='<div class="empty">'+(Object.keys(districtMap).length?'No matches':'Loading...')+'</div>'
    return
  }
  entries.sort((a,b)=>a.name.localeCompare(b.name))
  el.innerHTML=entries.map(function(d){
    const isSel=d.code===selectedDistrictCode
    let bars=''
    if(groupTypes.has('school')&&d.schools.length){
      const grp=groupProgress[d.code+':school'],tot=d.schools.length
      const eff=grp?tot:d.schools.filter(l=>progress[l.id]).length
      bars+='<div style="margin-bottom:3px"><div class="ditem-bar-label"><span style="color:var(--blue)">Schools</span><span>'+eff+' / '+tot+'</span></div><div class="ditem-bar-track"><div class="ditem-bar-fill" style="background:var(--blue);width:'+Math.round(eff/tot*100)+'%"></div></div></div>'
    }
    if(groupTypes.has('gp')&&d.gps.length){
      const grp=groupProgress[d.code+':gp'],tot=d.gps.length
      const eff=grp?tot:d.gps.filter(l=>progress[l.id]).length
      bars+='<div><div class="ditem-bar-label"><span style="color:var(--green)">GPs</span><span>'+eff+' / '+tot+'</span></div><div class="ditem-bar-track"><div class="ditem-bar-fill" style="background:var(--green);width:'+Math.round(eff/tot*100)+'%"></div></div></div>'
    }
    if(!bars)return ''
    const sg=groupProgress[d.code+':school'],gg=groupProgress[d.code+':gp']
    const badges=
      (sg?'<span class="dbadge" style="color:'+toolColor(sg.tool)+';border-color:'+toolColor(sg.tool)+'66;background:'+toolColor(sg.tool)+'14;margin-left:4px">S:'+TOOL_NAMES[sg.tool]+'</span>':'')+
      (gg?'<span class="dbadge" style="color:'+toolColor(gg.tool)+';border-color:'+toolColor(gg.tool)+'66;background:'+toolColor(gg.tool)+'14;margin-left:4px">GP:'+TOOL_NAMES[gg.tool]+'</span>':'')
    return '<div class="ditem '+(isSel?'sel':'')+'" data-code="'+d.code+'" onclick="selectDistrict(this.dataset.code)"><div class="ditem-name"><span>'+d.name+'</span><span>'+badges+'</span></div>'+bars+'</div>'
  }).filter(Boolean).join('')
}

function selectDistrict(code){
  selectedDistrictCode=code
  renderDistrictList();updateDistrictStates();updateDistrictStats(code)
  const d=districtMap[code];if(!d)return
  const allLocs=[...(groupTypes.has('school')?d.schools:[]),...(groupTypes.has('gp')?d.gps:[])]
  const{bottomOffset}=getVisibleMapBounds()
  const fitPad=isMobile()?{top:60,bottom:bottomOffset+80,left:40,right:40}:null
  if(allLocs.length){
    fitBounds(allLocs,fitPad)
  }else{
    const feat=districts.find(f=>f.properties.code===code)
    if(feat&&mapReady){
      try{
        const coords=feat.geometry.type==='Polygon'?feat.geometry.coordinates[0]:feat.geometry.coordinates.flat()
        const lngs=coords.map(p=>p[0]),lats=coords.map(p=>p[1])
        const pad=fitPad||{top:80,bottom:80,left:60,right:60}
        map.fitBounds([[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]],{padding:pad,maxZoom:11,duration:800})
      }catch(e){}
    }
  }
  if(mapReady&&map.getSource('district-locs-src')){
    map.getSource('district-locs-src').setData({type:'FeatureCollection',features:allLocs.filter(l=>l.lat&&l.lng).map(function(l){
      const p=progress[l.id],grpC=groupProgress[code+':'+l.type]
      const cleared=!!(p||grpC),tool=p?p.tool:(grpC?grpC.tool:null)
      return{type:'Feature',geometry:{type:'Point',coordinates:[l.lng,l.lat]},properties:{id:l.id,type:l.type,cleared,tool}}
    })})
    ;['district-locs','district-locs-cleared'].forEach(function(id){if(map.getLayer(id))map.setLayoutProperty(id,'visibility','visible')})
  }
  renderDistrictDetail(code)
}

function closeDistrictDetail(){
  const dd=$('district-detail');if(dd)dd.classList.remove('on')
  selectedDistrictCode=null
  renderDistrictList();updateDistrictStates();updateDistrictStats(null)
  if(mapReady){
    ;['district-locs','district-locs-cleared'].forEach(function(id){
      if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none')
    })
  }
}
