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
  if(window.dbgLog)window.dbgLog('bootApp() done','ok')
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',tryAutoLogin)
}else{
  tryAutoLogin()
}
