// ==========================================================================
// 02-state.js — all global mutable state lives here. One source of truth.
// ==========================================================================

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

// Primary (auto-on): hospital, hospice, university, massacre, prison(UK)
// Secondary (auto-off): school, nursery, gp — these move to Groups tab later
let placesFilter={hospital:true,school:false,university:true,hospice:true,prison:true,nursery:false,gp:false,massacre:true}
let showFilter='all'
let activeTools=new Set()
let groupTypes=new Set(['school','gp'])
let schoolsGpsLoaded=false

let logSavedPlaces=null
let logSavedFilter=null

let logScope='all'

let currentTool='MG'
let currentUser=null
let userHasEarthworks=false
let currentEW=null

let saveQueued=false

let _lastVisibleCount=-1
let _lastClearedCount=-1
