// ═══════════════════════════════════════════════════════════════════════════
// 27-search.js — Locations search: location matches + "jump to area".
//
// One unified list (no overlay): when you type, the list shows JUMP-TO-AREA
// rows on top (major towns/cities + postcodes via postcodes.io), then matching
// LOCATIONS beneath. Picking an area flies the map there and switches the list
// to AREA VIEW (loaded locations within the map view, respecting the chips).
// ═══════════════════════════════════════════════════════════════════════════

window.areaView={active:false}
window.searchAreasResult={q:'',areas:[]}

const _PC_RE=/^[A-Za-z]{1,2}\d[A-Za-z\d]?(\s*\d[A-Za-z]{2})?$/
function _isMajorPlace(p){const t=(p.local_type||'').toLowerCase();return t.indexOf('city')>-1||t.indexOf('town')>-1}

// Resolve a query to candidate areas via postcodes.io (UK, free, no key).
// Major settlements only (cities/towns) — no suburbs/villages/hamlets.
async function searchAreas(q){
  q=(q||'').trim()
  if(q.length<2)return []
  try{
    if(_PC_RE.test(q)&&/\d/.test(q)){
      let res=await fetch('https://api.postcodes.io/postcodes/'+encodeURIComponent(q),{cache:'no-store'})
      if(res.ok){const d=(await res.json()).result;return[{label:d.postcode,sub:d.admin_district||d.region||'UK',lat:d.latitude,lng:d.longitude,zoom:12}]}
      res=await fetch('https://api.postcodes.io/outcodes/'+encodeURIComponent(q.split(' ')[0]),{cache:'no-store'})
      if(res.ok){const d=(await res.json()).result;if(d)return[{label:d.outcode,sub:(d.admin_district&&d.admin_district[0])||'UK',lat:d.latitude,lng:d.longitude,zoom:11}]}
      return []
    }
    const res=await fetch('https://api.postcodes.io/places?q='+encodeURIComponent(q)+'&limit=20',{cache:'no-store'})
    if(!res.ok)return []
    const rows=(((await res.json()).result)||[]).filter(_isMajorPlace)
    const seen=new Set(),out=[]
    for(const p of rows){
      const k=(p.name_1+'|'+(p.county_unitary||'')).toLowerCase()
      if(seen.has(k))continue
      seen.add(k)
      out.push({label:p.name_1,sub:p.county_unitary||'',lat:p.latitude,lng:p.longitude,zoom:10})
    }
    return out.slice(0,5)
  }catch(e){return []}
}

let _searchTimer=null
function onSearchInput(){
  if(window.areaView)window.areaView.active=false
  const q=($('search').value||'').trim()
  renderList()                         // location matches immediately
  clearTimeout(_searchTimer)
  if(q.length<2){window.searchAreasResult={q:'',areas:[]};return}
  _searchTimer=setTimeout(async function(){
    const areas=await searchAreas(q)
    if((($('search').value||'').trim())!==q)return  // query moved on
    window.searchAreasResult={q:q,areas:areas}
    renderList()                       // re-render with area rows on top
  },260)
}

function gotoAreaByIndex(i){
  const r=window.searchAreasResult
  if(r&&r.areas&&r.areas[i])gotoArea(r.areas[i])
}

function gotoArea(a){
  if(!a)return
  const s=$('search');if(s)s.value=a.label
  window.searchAreasResult={q:'',areas:[]}
  window.areaView={active:true,label:a.label}
  try{if(typeof closeDetail==='function')closeDetail()}catch(e){}
  try{if(typeof setSelectedId==='function')setSelectedId(null)}catch(e){}
  if(mapReady&&typeof map!=='undefined'&&map)map.flyTo({center:[a.lng,a.lat],zoom:a.zoom||10,duration:800})
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
  s.removeAttribute('oninput')         // we drive input ourselves now
  s.setAttribute('autocomplete','off')
  s.addEventListener('input',onSearchInput)
  _wireAreaMoveEnd()
}

if(document.readyState!=='loading')initLocationSearch()
else document.addEventListener('DOMContentLoaded',initLocationSearch)
