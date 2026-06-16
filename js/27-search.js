// ════════════════════════════════════════════════════════════════════════════════
// 27-search.js — Locations search: location matches + "jump to area".
//
// One unified list (no overlay): when you type, the list shows JUMP-TO-AREA
// rows on top (London boroughs + NI districts + major towns/cities + postcodes),
// then matching LOCATIONS beneath. Picking an area flies the map there and
// switches the list to AREA VIEW (loaded locations within the map view).
// ════════════════════════════════════════════════════════════════════════════════

window.areaView={active:false}
window.searchAreasResult={q:'',areas:[]}

const _PC_RE=/^[A-Za-z]{1,2}\d[A-Za-z\d]?(\s*\d[A-Za-z]{2})?$/
function _isMajorPlace(p){const t=(p.local_type||'').toLowerCase();return t.indexOf('city')>-1||t.indexOf('town')>-1}

// Bounding box [minLng,minLat,maxLng,maxLat] from a (Multi)Polygon geometry.
function _geomBbox(geom){
  let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity
  ;(function walk(x){ if(typeof x[0]==='number'){if(x[0]<a)a=x[0];if(x[1]<b)b=x[1];if(x[0]>c)c=x[0];if(x[1]>d)d=x[1]} else x.forEach(walk) })(geom.coordinates)
  return [a,b,c,d]
}

// District-level areas from the loaded districts table. Two cases postcodes.io
// /places can't serve well:
//   • London boroughs (LAD code E09xxxxxxx) — London is too big for one pin, so
//     boroughs ("Camden") are the useful unit.
//   • Northern Ireland districts (LAD code N09xxxxxxx) — postcodes.io /places has
//     NO NI coverage at all, so Belfast/Derry/Lisburn etc. only come from here.
// Both fit the map to the district boundary.
function searchBoroughs(q){
  if(typeof districts==='undefined'||!Array.isArray(districts))return []
  const ql=q.toLowerCase(),out=[]
  for(const f of districts){
    const code=(f.properties&&f.properties.code)||'',name=(f.properties&&f.properties.name)||''
    const pre=code.slice(0,3)
    if((pre==='E09'||pre==='N09')&&name.toLowerCase().indexOf(ql)>-1&&f.geometry){
      const bb=_geomBbox(f.geometry)
      out.push({label:name,sub:pre==='E09'?'London borough':'NI district',bbox:bb,lat:(bb[1]+bb[3])/2,lng:(bb[0]+bb[2])/2,zoom:12})
      if(out.length>=5)break
    }
  }
  return out
}

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
    const boroughs=searchBoroughs(q)
    const res=await fetch('https://api.postcodes.io/places?q='+encodeURIComponent(q)+'&limit=20',{cache:'no-store'})
    let places=[]
    if(res.ok){
      const rows=(((await res.json()).result)||[]).filter(_isMajorPlace)
      const seen=new Set()
      for(const p of rows){
        const k=(p.name_1+'|'+(p.county_unitary||'')).toLowerCase()
        if(seen.has(k))continue
        seen.add(k)
        places.push({label:p.name_1,sub:p.county_unitary||'',lat:p.latitude,lng:p.longitude,zoom:10})
      }
    }
    return [...boroughs,...places].slice(0,6)
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
  if(mapReady&&typeof map!=='undefined'&&map){
    if(a.bbox)map.fitBounds([[a.bbox[0],a.bbox[1]],[a.bbox[2],a.bbox[3]]],{padding:{top:60,bottom:60,left:60,right:60},maxZoom:13,duration:800})
    else map.flyTo({center:[a.lng,a.lat],zoom:a.zoom||10,duration:800})
  }
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
