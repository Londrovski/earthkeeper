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

// Place filter + group types are seeded per active country by loadPlaceTypes()
// (28-place-types.js) from the Supabase `place_types` config table, on each boot.
let placesFilter={}
let showFilter='all'
let activeTools=new Set()
let groupTypes=new Set()
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
