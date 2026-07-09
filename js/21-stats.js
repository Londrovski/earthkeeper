// ==========================================================================
// 21-stats.js — header + progress bar + mobile stats
// ==========================================================================

function setText(id,v){const e=$(id);if(e)e.textContent=v}
function setDisplay(id,v){const e=$(id);if(e)e.style.display=v}

function currentTab(){
  if($('tab-locs')&&$('tab-locs').classList.contains('on'))return 'locs'
  if($('tab-groups')&&$('tab-groups').classList.contains('on'))return 'groups'
  if($('tab-log')&&$('tab-log').classList.contains('on'))return 'log'
  return null
}

function setExtraStatVisible(show){
  setDisplay('s-log-div',show?'flex':'none')
  setDisplay('s-log-all',show?'flex':'none')
  setDisplay('s-log-allpct','none')
}

function updateMobileInnerStats(elId,html){
  const el=$(elId);if(el)el.innerHTML=html
}
function statLine(total,totalLabel,cleared,clearedLabel,pct){
  return '<strong>'+total+'</strong><span> '+totalLabel+'</span><span class="ms-sep">&middot;</span><strong>'+cleared+'</strong><span> '+clearedLabel+'</span><span class="ms-sep">&middot;</span><strong>'+pct+'</strong><span> done</span>'
}

function updateStats(){
  // Progress rows are rendered per-country from place_types (28-place-types.js),
  // each with ids pg-<type> (fill) and pg-<type>t (count).
  ;(window.PLACE_TYPES||[]).forEach(function(r){
    const pgEl=$('pg-'+r.type),pgTxtEl=$('pg-'+r.type+'t')
    if(!pgEl||!pgTxtEl)return
    const tot=locations.filter(l=>l.type===r.type).length
    const cl=locations.filter(l=>l.type===r.type&&isEffectivelyCleared(l)).length
    pgEl.style.width=(tot?Math.round(cl/tot*100):0)+'%'
    pgTxtEl.textContent=tot?cl+'/'+tot:'-'
  })

  const visLocs=locations.filter(l=>placesFilter[l.type])
  const total=visLocs.length
  const cleared=visLocs.filter(l=>isEffectivelyCleared(l)).length
  const pct=total?Math.round(cleared/total*100):0
  if(isMobile())updateMobileInnerStats('locs-mob-stats',statLine(total.toLocaleString(),'locations',cleared,'cleared',pct+'%'))

  if(currentTab()!=='locs')return
  setText('s-total',total.toLocaleString())
  setText('s-label-total','locations')
  setText('s-cleared',cleared)
  setText('s-label-cleared','cleared')
  setText('s-pct',pct+'%')
  setDisplay('s-pct','')
  setExtraStatVisible(false)
}

function updateGroupsStats(){
  const gTypes=districtGroupTypes()
  const allGroupLocs=Object.values(districtMap).flatMap(d=>gTypes.flatMap(t=>dLocs(d,t)))
  const totalLocs=allGroupLocs.length
  const clearedLocs=allGroupLocs.filter(l=>isEffectivelyCleared(l)).length
  const pct=totalLocs?Math.round(clearedLocs/totalLocs*100):0

  const relevantCodes=Object.keys(districtMap).filter(code=>{
    const d=districtMap[code];return gTypes.some(t=>dLocs(d,t).length>0)
  })
  const totalDistricts=relevantCodes.length
  // A district counts as cleared when every group type it actually holds is cleared.
  const clearedDistricts=relevantCodes.filter(code=>{
    const d=districtMap[code]
    return gTypes.every(t=>!dLocs(d,t).length||!!groupProgress[code+':'+t])
  }).length

  if(isMobile())updateMobileInnerStats('groups-mob-stats',
    statLine(totalLocs.toLocaleString(),'locations',clearedLocs.toLocaleString(),'cleared',pct+'%')+
    '<span class="ms-sep">&middot;</span><strong>'+clearedDistricts+'/'+totalDistricts+'</strong><span> districts</span>'
  )

  if(currentTab()!=='groups')return
  setText('s-total',totalLocs.toLocaleString())
  setText('s-label-total','locations')
  setText('s-cleared',clearedLocs.toLocaleString())
  setText('s-label-cleared','cleared')
  setText('s-pct',pct+'%')
  setDisplay('s-pct','')
  setExtraStatVisible(true)
  setText('s-total-all',clearedDistricts+'/'+totalDistricts)
  const lbl=$('s-log-all')&&$('s-log-all').querySelector('span')
  if(lbl)lbl.textContent='districts'
}

function updateDistrictStats(code){}

function updateLogStats(){
  const total=locations.length
  const matches=function(loc){
    if(!isEffectivelyCleared(loc))return false
    if(logScope==='my'){
      const p=progress[loc.id]
      return !!(p&&currentUser&&p.user===currentUser)
    }
    return true
  }
  const cleared=locations.filter(matches).length
  const pct=total?Math.round(cleared/total*100):0
  const clearedLbl=logScope==='my'?'cleared by you':'cleared'

  if(isMobile()&&currentTab()==='log')updateMobileInnerStats('log-mob-stats',
    statLine(total.toLocaleString(),'locations',cleared.toLocaleString(),clearedLbl,pct+'%')
  )

  if(currentTab()!=='log')return
  setText('s-total',total.toLocaleString())
  setText('s-label-total','locations')
  setText('s-cleared',cleared.toLocaleString())
  setText('s-label-cleared',clearedLbl)
  setText('s-pct',pct+'%')
  setDisplay('s-pct','')
  setExtraStatVisible(false)
}
