// ==========================================================================
// 25-settings.js — design tokens from Supabase app_settings.
// ==========================================================================

window.SETTINGS={}

const SETTINGS_CSS_MAP={
  colors:{forest:'--forest',forestM:'--forest-m',gold:'--gold',goldL:'--gold-l',goldD:'--gold-d',
    red:'--red',blue:'--blue',violet:'--violet',teal:'--teal',amber:'--amber',green:'--green',massacre:'--massacre'},
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
    refreshColorTokens()
    restyleMap()
    try{ if(typeof refreshMapData==='function')refreshMapData() }catch(e){}
    try{ if(typeof renderList==='function')renderList() }catch(e){}
    if(window.dbgLog)window.dbgLog('settings loaded: '+rows.length+' keys','ok')
  }catch(e){ if(window.dbgLog)window.dbgLog('loadSettings failed: '+e.message,'warn') }
}

function refreshColorTokens(){
  if(typeof cssVar!=='function')return
  GOLD=cssVar('--gold',GOLD)
  if(typeof TYPE_COLORS==='object'){
    TYPE_COLORS.hospital=cssVar('--red',TYPE_COLORS.hospital)
    TYPE_COLORS.school=cssVar('--blue',TYPE_COLORS.school)
    TYPE_COLORS.hospice=cssVar('--teal',TYPE_COLORS.hospice)
    TYPE_COLORS.prison=cssVar('--amber',TYPE_COLORS.prison)
    TYPE_COLORS.nursery=cssVar('--amber',TYPE_COLORS.nursery)
    TYPE_COLORS.university=cssVar('--violet',TYPE_COLORS.university)
    TYPE_COLORS.gp=cssVar('--green',TYPE_COLORS.gp)
    TYPE_COLORS.massacre=cssVar('--massacre',TYPE_COLORS.massacre)
  }
  if(typeof TOOL_COLORS==='object'){
    TOOL_COLORS.omega=cssVar('--omega',TOOL_COLORS.omega)
    TOOL_COLORS.jewel=cssVar('--jewel',TOOL_COLORS.jewel)
    TOOL_COLORS.mg=cssVar('--mg',TOOL_COLORS.mg)
  }
}

function restyleMap(){
  try{
    if(typeof map==='undefined'||!map||typeof map.getLayer!=='function')return
    const setGold=['dots-cleared','cleared-glow','district-locs-cleared']
    setGold.forEach(id=>{ if(map.getLayer(id))map.setPaintProperty(id,'circle-color',GOLD) })
    if(map.getLayer('district-glow'))map.setPaintProperty('district-glow','line-color',GOLD)
    if(map.getLayer('dots-uncleared'))map.setPaintProperty('dots-uncleared','circle-color',
      ['case',
       ['==',['get','type'],'hospital'],TYPE_COLORS.hospital,
       ['==',['get','type'],'school'],TYPE_COLORS.school,
       ['==',['get','type'],'hospice'],TYPE_COLORS.hospice,
       ['==',['get','type'],'prison'],TYPE_COLORS.prison,
       ['==',['get','type'],'nursery'],TYPE_COLORS.nursery,
       ['==',['get','type'],'gp'],TYPE_COLORS.gp,
       ['==',['get','type'],'massacre'],TYPE_COLORS.massacre,
       TYPE_COLORS.university])
    const toolStroke=['case',
      ['==',['get','tool'],'omega'],TOOL_COLORS.omega,
      ['==',['get','tool'],'jewel'],TOOL_COLORS.jewel,
      ['==',['get','tool'],'mg'],TOOL_COLORS.mg,
      'rgba(255,255,255,0.6)']
    if(map.getLayer('dots-cleared'))map.setPaintProperty('dots-cleared','circle-stroke-color',toolStroke)
    if(map.getLayer('district-locs-cleared'))map.setPaintProperty('district-locs-cleared','circle-stroke-color',toolStroke)
  }catch(e){ if(window.dbgLog)window.dbgLog('restyleMap failed: '+e.message,'warn') }
}

loadSettings()
