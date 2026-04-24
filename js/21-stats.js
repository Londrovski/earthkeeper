// ═══════════════════════════════════════════════════════════════════════════
// 21-stats.js — header + progress bar + mobile stats
// ═══════════════════════════════════════════════════════════════════════════

function setText(id,v){const e=$(id);if(e)e.textContent=v}
function setDisplay(id,v){const e=$(id);if(e)e.style.display=v}

function setLogStatsVisible(show){
  setDisplay('s-pct',show?'none':'')
  setDisplay('s-log-div',show?'flex':'none')
  setDisplay('s-log-all',show?'flex':'none')
  setDisplay('s-log-allpct',show?'flex':'none')
}

function updateMobileInnerStats(elId,html){
  const el=$(elId);if(el)el.innerHTML=html
}
function statLine(total,totalLabel,cleared,clearedLabel,pct){
  return '<strong>'+total+'</strong><span> '+totalLabel+'</span><span class="ms-sep">·</span><strong>'+cleared+'</strong><span> '+clearedLabel+'</span><span class="ms-sep">·</span><strong>'+pct+'</strong><span> done</span>'
}

function updateStats(){
  const visLocs=locations.filter(l=>placesFilter[l.type])
  const total=visLocs.length
  const cleared=visLocs.filter(l=>isEffectivelyCleared(l)).length
  const pct=total?Math.round(cleared/total*100):0
  setText('s-total',total.toLocaleString())
  setText('s-label-total','locations')
  setText('s-cleared',cleared)
  setText('s-label-cleared','cleared')
  setText('s-pct',pct+'%')
  setLogStatsVisible(false)
  if(isMobile())updateMobileInnerStats('locs-mob-stats',statLine(total.toLocaleString(),'locations',cleared,'cleared',pct+'%'))

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
}

function updateGroupsStats(){
  const codes=Object.keys(districtMap).filter(code=>{
    const d=districtMap[code];return d.schools.length>0||d.gps.length>0
  })
  const totalDistricts=codes.length
  const clearedDistricts=codes.filter(code=>{
    const d=districtMap[code]
    const hasSchools=d.schools.length>0,hasGps=d.gps.length>0
    const schoolDone=!hasSchools||!!groupProgress[code+':school']
    const gpDone=!hasGps||!!groupProgress[code+':gp']
    return schoolDone&&gpDone
  }).length
  const allGroupLocs=Object.values(districtMap).flatMap(d=>[
    ...(groupTypes.has('school')?d.schools:[]),
    ...(groupTypes.has('gp')?d.gps:[])
  ])
  const clearedLocs=allGroupLocs.filter(l=>isEffectivelyCleared(l)).length
  const pct=totalDistricts?Math.round(clearedDistricts/totalDistricts*100):0
  setText('s-total',clearedDistricts+'/'+totalDistricts)
  setText('s-label-total','districts cleared')
  setText('s-cleared',clearedLocs.toLocaleString())
  setText('s-label-cleared','locations cleared')
  setText('s-pct',pct+'%')
  setLogStatsVisible(false)
  if(isMobile())updateMobileInnerStats('groups-mob-stats',statLine(clearedDistricts+'/'+totalDistricts,'districts',clearedLocs.toLocaleString(),'locations',pct+'%'))
}

function updateDistrictStats(code){
  // Reserved for future detail-level stats; currently a no-op
}

function updateLogStats(){
  const indivTypes=['hospital','hospice','university','prison']
  const indivLocs=locations.filter(l=>indivTypes.includes(l.type))
  const indivTotal=indivLocs.length
  const indivCleared=indivLocs.filter(l=>isEffectivelyCleared(l)).length
  const indivPct=indivTotal?Math.round(indivCleared/indivTotal*100):0
  const allTotal=locations.length
  const allCleared=locations.filter(l=>isEffectivelyCleared(l)).length
  const allPct=allTotal?Math.round(allCleared/allTotal*100):0
  setText('s-total',indivCleared+'/'+indivTotal)
  setText('s-label-total','individual cleared')
  setText('s-cleared',indivPct+'%')
  setText('s-label-cleared','done')
  setLogStatsVisible(true)
  setText('s-total-all',allCleared+'/'+allTotal)
  setText('s-pct-all',allPct+'%')
  if(isMobile())updateMobileInnerStats('log-mob-stats',
    '<strong>'+indivCleared+'/'+indivTotal+'</strong><span> individual</span><span class="ms-sep">·</span><strong>'+indivPct+'%</strong><span> done</span><span class="ms-sep">|</span><strong>'+allCleared+'/'+allTotal+'</strong><span> total</span><span class="ms-sep">·</span><strong>'+allPct+'%</strong><span> done</span>'
  )
}
