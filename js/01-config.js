// ═══════════════════════════════════════════════════════════════════════════
// 01-config.js — constants only, no mutable state
// ═══════════════════════════════════════════════════════════════════════════

// ── Supabase (progress + group_progress live here) ───────────────────────────────────────
const SUPABASE_URL='https://wxdqncumgfarehwlsbuo.supabase.co'
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZHFuY3VtZ2ZhcmVod2xzYnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjM2MTgsImV4cCI6MjA5MjU5OTYxOH0.OIiDeC2eLtpSEiIcVnPxYhWw4PvaG3Ajr6Q6t_wJvxo'
const SB_REST=SUPABASE_URL+'/rest/v1'
const SB_REALTIME=SUPABASE_URL.replace('https://','wss://')+'/realtime/v1/websocket'
const SB_HEADERS={apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,'Content-Type':'application/json'}

// ── Country selection (UK live now; AU coming). Persisted in localStorage. ───────────────
// Each country maps the logical table set to its physical Supabase table names,
// plus its region set (drives data loading) and home map view (centre/zoom).
// UK tables were renamed with a _uk suffix (June 2026) ahead of the AU rollout.
const EK_COUNTRIES={
  UK:{label:'United Kingdom',flag:'🇬🇧',
      tables:{progress:'progress_uk',group_progress:'group_progress_uk',audit_log:'audit_log_uk',locations:'locations_uk',districts:'districts_uk'},
      regions:['london','southeast','southwest','eastengland','eastmidlands','westmidlands','yorkshire','northwest','northeast','wales','scotland','northernireland'],
      home:{center:[-2.5,54.3],zoom:5.0}},
  AU:{label:'Australia',flag:'🇦🇺',
      tables:{progress:'progress_au',group_progress:'group_progress_au',audit_log:'audit_log_au',locations:'locations_au',districts:'districts_au'},
      regions:['nsw','vic','qld','sa','wa','tas','nt','act'],
      home:{center:[134.0,-25.0],zoom:3.6}}
}
function getCountry(){try{const c=localStorage.getItem('ek_country');return (c&&EK_COUNTRIES[c])?c:'UK'}catch(e){return 'UK'}}
function setCountry(c){try{if(EK_COUNTRIES[c])localStorage.setItem('ek_country',c)}catch(e){}}
// TABLES.progress etc. → physical table name for the active country.
const TABLES=new Proxy({},{get:(_,k)=>EK_COUNTRIES[getCountry()].tables[k]})

// ── GitHub (location data + the app itself still live on GitHub Pages) ──────────────────
const PASSWORD_HASH='74e6fbb572af72246abf610d8e268ae53e6599972c571117503dc4537b982b69'
const REPO_OWNER='Londrovski'
const REPO_NAME='earthkeeper'
const DATA_BRANCH='main'
const RAW_BASE=`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/data`
// API_BASE + GH_HEADERS kept for any future admin tooling but unused by the runtime app now.
const API_BASE=`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/data`

// Region set + home map view resolve from the active country (see EK_COUNTRIES).
function getRegions(){return (EK_COUNTRIES[getCountry()]||EK_COUNTRIES.UK).regions}
function getHomeView(){return (EK_COUNTRIES[getCountry()]||EK_COUNTRIES.UK).home}
// Back-compat: existing code reads ALL_REGIONS; keep it as the active country's regions.
Object.defineProperty(window,'ALL_REGIONS',{get:getRegions,configurable:true})

// Colours come from CSS variables (base.css defaults, overridden at boot from
// Supabase app_settings by 25-settings.js). These JS copies are read once here,
// then refreshed by refreshColorTokens() after settings load. Hex args are
// last-ditch fallbacks only used if a CSS var is somehow empty.
function cssVar(n,fb){try{const v=getComputedStyle(document.documentElement).getPropertyValue(n).trim();return v||fb}catch(e){return fb}}
let GOLD=cssVar('--gold','#C9A84C')
const TYPE_COLORS={hospital:cssVar('--red','#E07050'),school:cssVar('--blue','#5B9BD5'),hospice:cssVar('--teal','#3DBFA8'),prison:cssVar('--amber','#C4722A'),university:cssVar('--violet','#9B78C8'),gp:cssVar('--green','#4A9B6F')}
const TOOL_COLORS={omega:cssVar('--omega','#9B5ED4'),jewel:cssVar('--jewel','#E07050'),mg:cssVar('--mg','#4A85C9')}

const TOOLS=['MS','MF','O','J','MG','AP','MI','MJ','DM']
const TOOL_ORDER=TOOLS
const EW_LEVELS=['EW1','EW2','EW3','EW4','EW5']
const TOOL_NAMES={MS:'MS',MF:'MF',O:'O',J:'J',MG:'MG',AP:'AP',MI:'MI',MJ:'MJ',DM:'DM'}
const TOOL_NAMES_FULL={
  MS:'Magical Structures (MS)',
  MF:'Multifrequency (MF)',
  O:'Omega (O)',
  J:'Jewel (J)',
  MG:"Merlin's Grace (MG)",
  AP:'Universal AP (AP)',
  MI:'Manifesting Intention (MI)',
  MJ:'Magical Jewel (MJ)',
  DM:'Divine Magic (DM)'
}
