// ═══════════════════════════════════════════════════════════════════════════
// 27-search.js — Locations search: filter the list AND jump to a town/postcode.
//
// The Locations search box does two things:
//   1. Filters the list by name / address / postcode (renderList, unchanged).
//   2. Offers "jump to area" suggestions (towns + postcodes via postcodes.io).
//      Picking one flies the map there and switches the list to AREA VIEW — the
//      list then shows the loaded locations within the current map view,
//      respecting the Places/Show chips, updating as you pan/zoom.
// ═══════════════════════════════════════════════════════════════════════════

window.areaView={active:false}

// rough UK postcode / outcode test (must contain a digit)
const _PC_RE=/^[A-Za-z]{1,2}\d[A-Za-z\d]?(\s*\d[A-Za-z]{2})?$/

function _placeRank(p){
  const t=(p.local_type||'').toLowerCase()
  if(t.indexOf('city')>-1)return 0
  if(t.indexOf('town')>-1)return 1
  if(t==='suburban area')return 3
  if(t.indexOf('village')>-1)return 4
  if(t.indexOf('hamlet')>-1)return 5
  return 2
}

// Resolve a query to candidate areas via postcodes.io (UK, free, no key).
async function searchAreas(q){
  q=(q||'').trim()
  if(q.length<2)return []
  try{
    if(_PC_RE.test(q)&&/\d/.test(q)){
      let res=await fetch('https://api.postcodes.io/postcodes/'+encodeURIComponent(q),{cache:'no-store'})
      if(res.ok){const d=(await res.json()).result;return[{label:d.postcode,sub:d.admin_district||d.region||'UK',lat:d.latitude,lng:d.longitude,zoom:14}]}
      res=await fetch('https://api.postcodes.io/outcodes/'+encodeURIComponent(q.split(' ')[0]),{cache:'no-store'})
      if(res.ok){const d=(await res.json()).result;if(d)return[{label:d.outcode,sub:(d.admin_district&&d.admin_district[0])||'UK',lat:d.latitude,lng:d.longitude,zoom:12}]}
      return []
    }
    const res=await fetch('https://api.postcodes.io/places?q='+encodeURIComponent(q)+'&limit=10',{cache:'no-store'})
    if(!res.ok)return []
    const rows=((await res.json()).result)||[]
    rows.sort((a,b)=>_placeRank(a)-_placeRank(b))
    return rows.slice(0,5).map(p=>({label:p.name_1,sub:[p.local_type,p.county_unitary].filter(Boolean).join(', '),lat:p.latitude,lng:p.longitude,zoom:12}))
  }catch(e){return []}
}

let _searchSuggestTimer=null
function onSearchInput(){
  if(window.areaView)window.areaView.active=false
  renderList()
  const sEl=$('search'),q=sEl?sEl.value:''
  const box=$('search-suggest')
  clearTimeout(_searchSuggestTimer)
  if(!box)return
  if(!q||q.trim().length<2){box.classList.remove('on');box.innerHTML='';return}
  _searchSuggestTimer=setTimeout(async function(){
    const areas=await searchAreas(q)
    if(($('search').value||'')!==q)return  // query moved on
    if(!areas.length){box.classList.remove('on');box.innerHTML='';return}
    box._areas=areas
    box.innerHTML='<div class="search-suggest-head">Jump to area</div>'+areas.map(function(a,i){
      return '<div class="search-suggest-item" data-i="'+i+'"><span class="ss-pin">📍</span><span class="ss-name">'+a.label+'</span><span class="ss-sub">'+(a.sub||'')+'</span></div>'
    }).join('')
    box.querySelectorAll('.search-suggest-item').forEach(function(it){
      it.addEventListener('mousedown',function(e){e.preventDefault();gotoArea(box._areas[+it.getAttribute('data-i')])})
    })
    box.classList.add('on')
  },220)
}

function gotoArea(a){
  if(!a)return
  const box=$('search-suggest');if(box){box.classList.remove('on');box.innerHTML=''}
  const s=$('search');if(s)s.value=a.label
  window.areaView={active:true,label:a.label}
  try{if(typeof closeDetail==='function')closeDetail()}catch(e){}
  try{if(typeof setSelectedId==='function')setSelectedId(null)}catch(e){}
  if(mapReady&&typeof map!=='undefined'&&map)map.flyTo({center:[a.lng,a.lat],zoom:a.zoom||12,duration:800})
  renderList()
}

// Re-render the in-view list whenever the map settles, while area view is on.
function _wireAreaMoveEnd(){
  if(!mapReady||typeof map==='undefined'||!map.on){setTimeout(_wireAreaMoveEnd,400);return}
  if(map.__areaWired)return
  map.__areaWired=true
  map.on('moveend',function(){
    if(window.areaView&&window.areaView.active&&$('tab-locs')&&$('tab-locs').classList.contains('on'))renderList()
  })
}

function initLocationSearch(){
  const s=$('search');if(!s)return
  if(!$('search-suggest')){
    const box=document.createElement('div');box.id='search-suggest';box.className='search-suggest'
    s.insertAdjacentElement('afterend',box)
  }
  s.removeAttribute('oninput')         // we drive input ourselves now
  s.setAttribute('autocomplete','off')
  s.addEventListener('input',onSearchInput)
  s.addEventListener('blur',function(){setTimeout(function(){const b=$('search-suggest');if(b)b.classList.remove('on')},150)})
  _wireAreaMoveEnd()
}

if(document.readyState!=='loading')initLocationSearch()
else document.addEventListener('DOMContentLoaded',initLocationSearch)
