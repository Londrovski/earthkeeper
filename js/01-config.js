// ═══════════════════════════════════════════════════════════════════════════
// 01-config.js — constants only, no mutable state
// ═══════════════════════════════════════════════════════════════════════════

// ── Supabase (progress + group_progress live here) ─────────────────────────────────────
const SUPABASE_URL='https://wxdqncumgfarehwlsbuo.supabase.co'
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZHFuY3VtZ2ZhcmVod2xzYnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjM2MTgsImV4cCI6MjA5MjU5OTYxOH0.OIiDeC2eLtpSEiIcVnPxYhWw4PvaG3Ajr6Q6t_wJvxo'
const SB_REST=SUPABASE_URL+'/rest/v1'
const SB_REALTIME=SUPABASE_URL.replace('https://','wss://')+'/realtime/v1/websocket'
const SB_HEADERS={apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY,'Content-Type':'application/json'}

// ── GitHub (location data + the app itself still live on GitHub Pages) ──────────────
const PASSWORD_HASH='74e6fbb572af72246abf610d8e268ae53e6599972c571117503dc4537b982b69'
const REPO_OWNER='Londrovski'
const REPO_NAME='earthkeeper'
const DATA_BRANCH='main'
const RAW_BASE=`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/data`
// API_BASE + GH_HEADERS kept for any future admin tooling but unused by the runtime app now.
const API_BASE=`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/data`

const ALL_REGIONS=['london','southeast','southwest','eastengland','eastmidlands','westmidlands','yorkshire','northwest','northeast','wales','scotland','northernireland']

const GOLD='#C9A84C'
const TYPE_COLORS={hospital:'#E07050',school:'#5B9BD5',hospice:'#3DBFA8',prison:'#C4722A',university:'#9B78C8',gp:'#4A9B6F'}
const TOOL_COLORS={omega:'#9B5ED4',jewel:'#E07050',mg:'#4A85C9'}

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
