// ═══════════════════════════════════════════════════════════════════════════
// 02-state.js — all global mutable state lives here. One source of truth.
// ═══════════════════════════════════════════════════════════════════════════

let locations=[]
let progress={}
let progressSha=null
let groupProgress={}
let groupProgressSha=null

let selectedId=null
let selectedDistrictCode=null
let districts=[]
let districtMap={}

let map=null
let mapReady=false
let locationMarker=null

let placesFilter={hospital:true,school:false,university:true,hospice:true,prison:true,gp:false}
let showFilter='all'
let activeTools=new Set()
let groupTypes=new Set(['school','gp'])
let schoolsGpsLoaded=false

let logSavedPlaces=null
let logSavedFilter=null

// 'all' — every clearing by anyone
// 'my'  — only clearings whose user matches currentUser
let logScope='all'

let currentTool='MG'
let currentUser=null
let userHasEarthworks=false
let currentEW=null

let saveQueued=false

// For refreshMapData diagnostics
let _lastVisibleCount=-1
let _lastClearedCount=-1
