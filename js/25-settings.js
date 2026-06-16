// ═══════════════════════════════════════════════════════════════════════════
// 25-settings.js — design tokens from Supabase app_settings.
//
// Fetches the app_settings table at boot and applies values as CSS custom
// properties on :root, and exposes window.SETTINGS for JS that needs them.
// base.css :root holds the same values as fallback defaults, so there is no
// flash and the site still works if this fetch fails. Loaded right after
// 01-config.js (needs SB_REST / SB_HEADERS).
//
// To change a colour etc: edit the row in Supabase app_settings — no code edit,
// no redeploy. Refresh the site and the new value applies.
// ═══════════════════════════════════════════════════════════════════════════

window.SETTINGS={}

const SETTINGS_CSS_MAP={
  colors:{forest:'--forest',forestM:'--forest-m',gold:'--gold',goldL:'--gold-l',goldD:'--gold-d',
    red:'--red',blue:'--blue',violet:'--violet',teal:'--teal',amber:'--amber',green:'--green'},
  tools:{omega:'--omega',jewel:'--jewel',mg:'--mg'}
}

function applySettingsCssVars(S){
  const root=document.documentElement
  for(const group in SETTINGS_CSS_MAP){
    const vals=S[group]; if(!vals)continue
    const m=SETTINGS_CSS_MAP[group]
    for(const k in m){ if(vals[k]!=null) root.style.setProperty(m[k],vals[k]) }
  }
}

async function loadSettings(){
  try{
    const res=await fetch(SB_REST+'/app_settings?select=key,value',{headers:SB_HEADERS,cache:'no-store'})
    if(!res.ok){if(window.dbgLog)window.dbgLog('loadSettings HTTP '+res.status,'warn');return}
    const rows=await res.json()
    const S={}; rows.forEach(r=>S[r.key]=r.value)
    window.SETTINGS=S
    applySettingsCssVars(S)
    if(window.dbgLog)window.dbgLog('settings loaded: '+rows.length+' keys','ok')
  }catch(e){ if(window.dbgLog)window.dbgLog('loadSettings failed: '+e.message,'warn') }
}

loadSettings()
