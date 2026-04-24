// ═══════════════════════════════════════════════════════════════════════════
// 21-stats.js — header + progress bar + mobile stats
//
// Each tab has its own header stats layout. Per-tab stats functions guard
// against running when their tab isn't active so background renders (realtime
// updates, post-action refreshes) don't stomp on the currently-visible tab's
// header.
//
// Layouts:
//   Locations tab  — 3 tiles: locations, cleared, pct
//   Groups tab     — 4 tiles: locations, cleared, pct, districts-fully-cleared
//   Log tab        — 3 tiles: locations (all), cleared, pct
// ═══════════════════════════════════════════════════════════════════════════

function setText(id,v){const e=$(id);if(e)e.textContent=v}
function setDisplay(id,v){const e=$(id);if(e)e.style.display=v}

function currentTab(){
  if($('tab-locs')&&$('tab-locs').classList.contains('on'))return 'locs'
  if($('tab-groups')&&$('tab-groups').classList.contains('on'))return 'groups'
  if($('tab-log')&&$('tab-log').classList.contains('on'))return 'log'
  return null
}

// Show/hide the 4th extra header tile (#s-log-div + #s-log-all).
// Used by Groups tab to surface the districts-cleared count.
function setExtraStatVisible(show,label){
  setDisplay('s-log-div',show?'flex':'none')
  setDisplay('s-log-all',show?'flex':'none')
  setDisplay('s-log-allpct','none') // unused now; all tabs at most use one extra tile
  if(show&&label){
    const lbl=$('s-log-all')&&$('s-log-all').querySelector('span')
    if(lbl)lbl.textContent=label
  }
}

function updateMobileInnerStats(elId,html){
  const el=$(elId);if(el)el.innerHTML=html
}
function statLine(total,totalLabel,cleared,clearedLabel,pct){
  return '<strong>'+total+'</strong><span> '+totalLabel+'</span><span class="ms-sep">·</span><strong>'+cleared+'</strong><span> '+clearedLabel+'</span><span class="ms-sep">·</span><strong>'+pct+'</strong><span> done</span>'
}

function updateStats(){
  // Always compute progress bars (shown on map overlay across tabs).
  const rows=[
    ['hospital','pg-h','pg-ht'],
    ['hospice','pg-ho','pg-hot'],
    ['prison','pg-pr','pg-prt'],
    ['university','pg-u','pg-ut'],
    ['school','pg-s','pg-st'],
    ['gp','pg-gp','pg-gpt']
  ]
  for(const[type,pgId,pgTxt]of rows){
    const pgEl=$(pgId),pgTxtEl=$(pgTxt)
    if(!pgEl||!pgTxtEl)continue
    const tot=locations.filter(l=>l.type===type).length
    const cl=locations.filter(l=>l.type===type&&isEffectivelyCleared(l)).length
    pgEl.style.width=(tot?Math.round(cl/tot*100):0)+'%'
    pgTxtEl.textContent=tot?cl+'/'+tot:'-'
  }

  // Locations tab mobile bar
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
  // Compute across ALL schools + GPs regardless of gtype toggle, so the header
  // reflects actual totals rather than what's currently filtered in the list.
  const allGroupLocs=Object.values(districtMap).flatMap(d=>[...d.schools,...d.gps])
  const totalLocs=allGroupLocs.length
  const clearedLocs=allGroupLocs.filter(l=>isEffectivelyCleared(l)).length
  const pct=totalLocs?Math.round(clearedLocs/totalLocs*100):0

  // Districts fully cleared: a district counts when every type it contains has
  // been group-cleared. Districts with no schools AND no GPs are ignored.
  const relevantCodes=Object.keys(districtMap).filter(code=>{
    const d=districtMap[code];return d.schools.length>0||d.gps.length>0
  })
  const totalDistricts=relevantCodes.length
  const clearedDistricts=relevantCodes.filter(code=>{
    const d=districtMap[code]
    const hasSchools=d.schools.length>0,hasGps=d.gps.length>0
    const schoolDone=!hasSchools||!!groupProgress[code+':school']
    const gpDone=!hasGps||!!groupProgress[code+':gp']
    return schoolDone&&gpDone
  }).length

  if(isMobile())updateMobileInnerStats('groups-mob-stats',
    statLine(totalLocs.toLocaleString(),'locations',clearedLocs.toLocaleString(),'cleared',pct+'%')+
    '<span class="ms-sep">·</span><strong>'+clearedDistricts+'/'+totalDistricts+'</strong><span> districts</span>'
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

function updateDistrictStats(code){
  // Reserved for future detail-level stats; currently a no-op.
}

function updateLogStats(){
  const total=locations.length
  const cleared=locations.filter(l=>isEffectivelyCleared(l)).length
  const pct=total?Math.round(cleared/total*100):0

  if(isMobile()&&currentTab()==='log')updateMobileInnerStats('log-mob-stats',
    statLine(total.toLocaleString(),'locations',cleared.toLocaleString(),'cleared',pct+'%')
  )

  if(currentTab()!=='log')return
  setText('s-total',total.toLocaleString())
  setText('s-label-total','locations')
  setText('s-cleared',cleared.toLocaleString())
  setText('s-label-cleared','cleared')
  setText('s-pct',pct+'%')
  setDisplay('s-pct','')
  setExtraStatVisible(false)
}
