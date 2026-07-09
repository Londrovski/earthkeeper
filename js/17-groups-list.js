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
  const gTypes=districtGroupTypes().filter(t=>groupTypes.has(t))
  el.innerHTML=entries.map(function(d){
    const isSel=d.code===selectedDistrictCode
    let bars='',badges=''
    gTypes.forEach(function(t,i){
      const list=dLocs(d,t)
      if(!list.length)return
      const grp=groupProgress[d.code+':'+t],tot=list.length
      const eff=grp?tot:list.filter(l=>progress[l.id]).length
      const col=ptColor(t)
      bars+='<div'+(i<gTypes.length-1?' style="margin-bottom:3px"':'')+'>'
        +'<div class="ditem-bar-label"><span style="color:'+col+'">'+ptLabel(t)+'</span><span>'+eff+' / '+tot+'</span></div>'
        +'<div class="ditem-bar-track"><div class="ditem-bar-fill" style="background:'+col+';width:'+Math.round(eff/tot*100)+'%"></div></div>'
        +'</div>'
      if(grp){
        const tc=toolColor(grp.tool)
        badges+='<span class="dbadge" style="color:'+tc+';border-color:'+tc+'66;background:'+tc+'14;margin-left:4px">'
          +ptBadge(t)+':'+TOOL_NAMES[grp.tool]+'</span>'
      }
    })
    if(!bars)return ''
    return '<div class="ditem '+(isSel?'sel':'')+'" data-code="'+d.code+'" onclick="selectDistrict(this.dataset.code)"><div class="ditem-name"><span>'+d.name+'</span><span>'+badges+'</span></div>'+bars+'</div>'
  }).filter(Boolean).join('')
}

// Locations in a district for the currently-enabled group types.
function districtActiveLocs(d){
  if(!d)return []
  return districtGroupTypes().filter(t=>groupTypes.has(t)).reduce(function(acc,t){return acc.concat(dLocs(d,t))},[])
}

function selectDistrict(code){
  selectedDistrictCode=code
  renderDistrictList();updateDistrictStates();updateDistrictStats(code)
  const d=districtMap[code];if(!d)return
  const allLocs=districtActiveLocs(d)
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
