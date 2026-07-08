// ═══════════════════════════════════════════════════════════════════════════
// 28-place-types.js — per-country place set (chips, legend, progress rows,
// group buttons) rendered from the Supabase `place_types` config table.
// Falls back to a baked-in copy if the fetch fails, so the UI never breaks.
// ═══════════════════════════════════════════════════════════════════════════

window.PLACE_TYPES=[]
window.PT_BY_TYPE={}

// [type,label,singular,color_var,sort_order,default_on,is_lazy,is_group]
const PLACE_TYPES_FALLBACK={
  UK:[
    ['hospital','Hospitals','Hospital','--red',1,1,0,0],
    ['hospice','Hospices','Hospice','--teal',2,1,0,0],
    ['university','Unis','University','--violet',3,1,0,0],
    ['prison','Prisons','Prison','--amber',4,1,0,0],
    ['school','Schools','School','--blue',5,0,1,1],
    ['gp','GPs','GP Surgery','--green',6,0,1,1]
  ],
  AU:[
    ['hospital','Hospitals','Hospital','--red',1,1,0,0],
    ['hospice','Hospices','Hospice','--teal',2,1,0,0],
    ['massacre','Massacres','Massacre','--massacre',3,1,0,0],
    ['university','Unis','University','--violet',4,1,0,0],
    ['school','Schools','School','--blue',5,0,1,1],
    ['nursery','Nurseries','Nursery','--amber',6,0,0,0]
  ]
}

function _ptNormalise(rows){
  return rows.map(function(r){
    if(Array.isArray(r))return {type:r[0],label:r[1],singular:r[2],color_var:r[3],sort_order:r[4],default_on:!!r[5],is_lazy:!!r[6],is_group:!!r[7]}
    return {type:r.type,label:r.label,singular:r.singular,color_var:r.color_var,sort_order:r.sort_order,default_on:!!r.default_on,is_lazy:!!r.is_lazy,is_group:!!r.is_group}
  })
}

async function loadPlaceTypes(){
  const country=getCountry()
  let rows=null
  try{
    const url=SB_REST+'/place_types?select=type,label,singular,color_var,sort_order,default_on,is_lazy,is_group'
      +'&country=eq.'+country+'&active=eq.true&order=sort_order.asc'
    const res=await fetch(url,{headers:SB_HEADERS,cache:'no-store'})
    if(res.ok)rows=await res.json()
  }catch(e){ if(window.dbgLog)window.dbgLog('loadPlaceTypes fetch failed: '+e.message,'warn') }
  if(!rows||!rows.length)rows=PLACE_TYPES_FALLBACK[country]||PLACE_TYPES_FALLBACK.UK

  window.PLACE_TYPES=_ptNormalise(rows)
  window.PT_BY_TYPE={}
  PLACE_TYPES.forEach(function(r){PT_BY_TYPE[r.type]=r})

  // Seed filter + group state fresh for this country's set.
  placesFilter={}
  PLACE_TYPES.forEach(function(r){placesFilter[r.type]=!!r.default_on})
  groupTypes=new Set(PLACE_TYPES.filter(function(r){return r.is_group}).map(function(r){return r.type}))

  // Keep type colours in sync with the config (map + legend read TYPE_COLORS / CSS vars).
  if(typeof TYPE_COLORS==='object'){
    PLACE_TYPES.forEach(function(r){TYPE_COLORS[r.type]=cssVar(r.color_var,TYPE_COLORS[r.type])})
  }

  buildPlaceChips()
  buildLegend()
  buildProgressRows()
  buildGroupButtons()
  if(window.dbgLog)window.dbgLog('place_types loaded ('+country+'): '+PLACE_TYPES.map(function(r){return r.type}).join(','),'ok')
}

function buildPlaceChips(){
  const el=$('place-chips');if(!el)return
  el.innerHTML=PLACE_TYPES.map(function(r){
    return '<div class="chip '+r.type+(r.default_on?' on':'')+'" onclick="togglePlace(\''+r.type+'\',this)">'+r.label+'</div>'
  }).join('')
}

function buildLegend(){
  const el=$('legend-rows');if(!el)return
  el.innerHTML=PLACE_TYPES.map(function(r){
    return '<div class="leg-item"><div class="leg-dot" style="background:var('+r.color_var+')"></div>'+r.singular+'</div>'
  }).join('')
}

function buildProgressRows(){
  const el=$('prog-rows');if(!el)return
  el.innerHTML=PLACE_TYPES.map(function(r){
    return '<div class="prog-row"><div class="prog-label">'+r.label+'</div>'
      +'<div class="prog-track"><div class="prog-fill" id="pg-'+r.type+'" style="background:var('+r.color_var+');width:0%"></div></div>'
      +'<div class="prog-count" id="pg-'+r.type+'t">-</div></div>'
  }).join('')
}

function buildGroupButtons(){
  const el=$('gtype-row');if(!el)return
  el.innerHTML=PLACE_TYPES.filter(function(r){return r.is_group}).map(function(r){
    return '<button class="gtype-btn '+r.type+' on" id="gtype-'+r.type+'" onclick="toggleGroupType(\''+r.type+'\',this)">'
      +'<span class="chip-dot" style="background:var('+r.color_var+');display:inline-block;margin-right:4px"></span>'+r.label+'</button>'
  }).join('')
}
