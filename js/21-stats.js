// ═══════════════════════════════════════════════════════════════════════════
// 21-stats.js — header + progress bar + mobile stats
//
// Each tab has its own header stats layout. Per-tab stats functions guard
// against running when their tab isn't active so background renders
// (triggered by realtime events or post-action UI refreshes) don't stomp
// on the currently-visible tab's header.
// ═══════════════════════════════════════════════════════════════════════════

function setText(id,v){const e=$(id);if(e)e.textContent=v}
function setDisplay(id,v){const e=$(id);if(e)e.style.display=v}

// Returns 'locs' | 'groups' | 'log' | null — whichever tab panel has .on
function currentTab(){
  if($('tab-locs')&&$('tab-locs').classList.contains('on'))return 'locs'
  if($('tab-groups')&&$('tab-groups').classList.contains('on'))return 'groups'
  if($('tab-log')&&$('tab-log').classList.contains('on'))return 'log'
  return null
}

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
  // Always compute progress bars (visible on map overlay across tabs).
  // Header writes guarded by tab below.
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

  // Locations-tab mobile bar: always safe to compute, only visible on the locs tab anyway
  const visLocs=locations.filter(l=>placesFilter[l.type])
  const total=visLocs.length
  const cleared=visLocs.filter(l=>isEffectivelyCleared(l)).length
  const pct=total?Math.round(cleared/total*100):0
  if(isMobile())updateMobileInnerStats('locs-mob-stats',statLine(total.toLocaleString(),'locations',cleared,'cleared',pct+'%'))

  // Header: only if we're actually on the Locations tab.
  if(currentTab()!=='locs')return
  setText('s-total',total.toLocaleString())
  setText('s-label-total','locations')
  setText('s-cleared',cleared)
  setText('s-label-cleared','cleared')
  setText('s-pct',pct+'%')
  setLogStatsVisible(false)
}

function updateGroupsStats(){
  // Mobile bar always safe to compute; header guarded.
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
  if(isMobile())updateMobileInnerStats('groups-mob-stats',statLine(clearedDistricts+'/'+totalDistricts,'districts',clearedLocs.toLocaleString(),'locations',pct+'%'))

  if(currentTab()!=='groups')return
  setText('s-total',clearedDistricts+'/'+totalDistricts)
  setText('s-label-total','districts cleared')
  setText('s-cleared',clearedLocs.toLocaleString())
  setText('s-label-cleared','locations cleared')
  setText('s-pct',pct+'%')
  setLogStatsVisible(false)
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

  // Mobile bar: only shown on the log tab anyway, but guard for good measure.
  if(isMobile()&&currentTab()==='log')updateMobileInnerStats('log-mob-stats',
    '<strong>'+indivCleared+'/'+indivTotal+'</strong><span> individual</span><span class="ms-sep">·</span><strong>'+indivPct+'%</strong><span> done</span><span class="ms-sep">|</span><strong>'+allCleared+'/'+allTotal+'</strong><span> total</span><span class="ms-sep">·</span><strong>'+allPct+'%</strong><span> done</span>'
  )

  // Header: only when actually on the Log tab.
  if(currentTab()!=='log')return
  setText('s-total',indivCleared+'/'+indivTotal)
  setText('s-label-total','individual cleared')
  setText('s-cleared',indivPct+'%')
  setText('s-label-cleared','done')
  setLogStatsVisible(true)
  setText('s-total-all',allCleared+'/'+allTotal)
  setText('s-pct-all',allPct+'%')
}
