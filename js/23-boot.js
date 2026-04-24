// ═══════════════════════════════════════════════════════════════════════════
// 23-boot.js — DOMContentLoaded auto-login, bootApp orchestration
// ═══════════════════════════════════════════════════════════════════════════

async function bootApp(){
  if(window.dbgLog)window.dbgLog('bootApp() starting','info')
  initMap()
  setMsg('Loading progress...')
  await Promise.all([loadProgress(),loadGroupProgress()])
  await loadAll()
  await loadDistricts()
  loadSchoolsGps()
  renderLog()
  // Wire swipe-down-to-dismiss on mobile bottom sheets
  try{if(typeof initSwipeToClose==='function')initSwipeToClose()}catch(e){if(window.dbgLog)window.dbgLog('initSwipeToClose threw: '+e.message,'err')}
  // Kick off real-time subscription so saves from other devices appear live
  try{startRealtime()}catch(e){if(window.dbgLog)window.dbgLog('startRealtime threw: '+e.message,'err')}
  if(window.dbgLog)window.dbgLog('bootApp() done','ok')
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',tryAutoLogin)
}else{
  tryAutoLogin()
}
