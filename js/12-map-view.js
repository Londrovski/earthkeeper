// ════════════════════════════════════════════════════════════════════════════════
// 12-map-view.js — map viewport helpers: fitBounds, panToVisible, flyToLoc, locateMe, goHome
// ════════════════════════════════════════════════════════════════════════════════

function getVisibleMapBounds(){
  if(!isMobile())return{bottomOffset:0}
  for(const id of['mobile-detail','district-detail']){
    const el=$(id)
    if(el&&el.classList.contains('on')){
      const h=el.getBoundingClientRect().height||200
      return{bottomOffset:Math.min(h,window.innerHeight*0.6)}
    }
  }
  return{bottomOffset:0}
}

function panToVisible(lat,lng,zoom){
  if(!map)return
  const{bottomOffset}=getVisibleMapBounds()
  const yOff=isMobile()?-Math.round(bottomOffset/2):0
  if(zoom){map.flyTo({center:[lng,lat],zoom,offset:[0,yOff],duration:600});return}
  map.easeTo({center:[lng,lat],offset:[0,yOff],duration:400})
}

// Fly to a clicked location. If the map is zoomed out (a lot of area visible),
// zoom in to a comfortable regional level (~3 zoom-button clicks from Home);
// if already closer in, keep the current zoom and just pan. Never zooms out.
const LOC_ZOOM=8.5
function flyToLoc(lat,lng){
  if(!map||lat==null||lng==null)return
  const cur=(typeof map.getZoom==='function')?map.getZoom():0
  panToVisible(lat,lng,cur<LOC_ZOOM?LOC_ZOOM:null)
}

function fitBounds(locs,padding){
  const pts=locs.filter(l=>l.lat&&l.lng);if(!pts.length)return
  const lngs=pts.map(l=>l.lng),lats=pts.map(l=>l.lat)
  const pad=padding||{top:100,bottom:100,left:100,right:100}
  map.fitBounds(
    [[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]],
    {padding:pad,maxZoom:10,duration:800}
  )
}

function kmBetween(lat1,lng1,lat2,lng2){
  const R=6371,toRad=d=>d*Math.PI/180
  const dLat=toRad(lat2-lat1),dLng=toRad(lng2-lng1)
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2
  return 2*R*Math.asin(Math.sqrt(a))
}

// ── "Are you here?" proximity prompt ─────────────────────────────────────
// When Find Me puts you within AT_LOCATION_M of a clearable location, dropping
// the user ring straight on top of it hides the dot. Instead we ring the
// LOCATION itself with a blue glow and pop a card asking if you're there —
// tapping "Yes" opens that location exactly like clicking its map dot.
// (Threshold is generous because urban GPS is only ~20–50m accurate.)
const AT_LOCATION_M=150

function findNearestLocation(lat,lng){
  const pool=Array.isArray(locations)?locations:[]
  let best=null
  for(const l of pool){
    if(!l||l.lat==null||l.lng==null)continue
    const d=kmBetween(lat,lng,l.lat,l.lng)
    if(!best||d<best.d)best={l,d}
  }
  return best
}

function clearAtLocationGlow(){
  if(window._atLocMarker){try{window._atLocMarker.remove()}catch(e){}window._atLocMarker=null}
}

// A larger hollow blue halo centred ON the location, behind the user dot, so
// "you're here" reads clearly even though the two markers overlap.
function showAtLocationGlow(loc){
  clearAtLocationGlow()
  if(!map||!loc||loc.lat==null||loc.lng==null)return
  const el=document.createElement('div')
  el.style.cssText='width:54px;height:54px;border-radius:50%;pointer-events:none;background:rgba(64,156,255,.20);border:2px solid rgba(64,156,255,.85);box-shadow:0 0 16px 5px rgba(64,156,255,.45);animation:ekUserPulse 2s ease-in-out infinite'
  try{window._atLocMarker=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([loc.lng,loc.lat]).addTo(map)}catch(e){}
}

function hideAtLocationCard(){const c=$('at-loc-card');if(c)c.remove()}

function showAtLocationCard(loc,distM){
  hideAtLocationCard()
  const card=document.createElement('div')
  card.id='at-loc-card';card.className='at-loc-card'
  const dist=distM<1000?Math.round(distM)+'m':(distM/1000).toFixed(1)+'km'
  card.innerHTML=
    '<div class="at-loc-card-pin">&#128205;</div>'+
    '<div class="at-loc-card-body">'+
      '<div class="at-loc-card-q">Are you here?</div>'+
      '<div class="at-loc-card-name"></div>'+
      '<div class="at-loc-card-dist">about '+dist+' away</div>'+
    '</div>'+
    '<div class="at-loc-card-btns">'+
      '<button type="button" class="at-loc-yes">Yes, open</button>'+
      '<button type="button" class="at-loc-no">Not now</button>'+
    '</div>'
  card.querySelector('.at-loc-card-name').textContent=loc.name||'this location'
  card.querySelector('.at-loc-yes').onclick=function(){hideAtLocationCard();handleMapLocClick(loc.id)}
  card.querySelector('.at-loc-no').onclick=function(){hideAtLocationCard()}
  document.body.appendChild(card)
}

// User-location marker: a hollow sky-blue ring with a small centre dot.
// Designed to SIT OVER a location dot without covering it — the hollow
// interior lets the underlying location colour show through. Blue is the
// universal "this is you" colour (Google Maps, Apple Maps) so it won't be
// confused with the gold "cleared" colour scheme.
function buildUserMarkerElement(){
  const el=document.createElement('div')
  el.style.cssText='position:relative;width:38px;height:38px;pointer-events:none;transform:translateZ(0)'
  el.innerHTML=
    '<div style="position:absolute;inset:0;border-radius:50%;background:rgba(64,156,255,.18);border:2px solid rgba(64,156,255,.9);box-shadow:0 0 0 1px rgba(255,255,255,.4),0 2px 6px rgba(0,0,0,.35);animation:ekUserPulse 2s ease-in-out infinite"></div>'+
    '<div style="position:absolute;left:50%;top:50%;width:10px;height:10px;margin-left:-5px;margin-top:-5px;border-radius:50%;background:#409CFF;border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.4)"></div>'
  return el
}

// Find Me:
//  - high-accuracy: desktop Chrome often fails silently without it
//  - maximumAge 5 min: re-use any recent fix so repeat taps are instant
//  - 8s timeout: fail visibly rather than hang the button
//  - on success: if you're AT a location, ring it + ask; otherwise fit to the
//    15 nearest non-school/non-GP locations + user (district-scale view)
function locateMe(){
  if(!navigator.geolocation){alert('Geolocation not supported');return}
  if(window.dbgLog)window.dbgLog('locateMe: requesting position','info')
  const btn=$('locate-btn'),originalLabel=btn?btn.textContent:null
  if(btn)btn.style.opacity='0.6'
  const restoreBtn=function(){if(btn){btn.style.opacity='';if(originalLabel!=null&&btn.textContent!==originalLabel)btn.textContent=originalLabel}}
  const opts={enableHighAccuracy:true,timeout:8000,maximumAge:300000}
  navigator.geolocation.getCurrentPosition(function(pos){
    restoreBtn()
    const{latitude:lat,longitude:lng}=pos.coords
    if(window.dbgLog)window.dbgLog('locateMe: got '+lat.toFixed(4)+','+lng.toFixed(4),'info')
    if(locationMarker)locationMarker.remove()
    try{
      // pointer-events:none on the element means clicks fall through to the
      // underlying MapLibre canvas, so tapping a location dot still works
      // even when the user ring overlaps it.
      locationMarker=new maplibregl.Marker({element:buildUserMarkerElement(),anchor:'center'}).setLngLat([lng,lat]).addTo(map)
    }catch(e){if(window.dbgLog)window.dbgLog('marker failed: '+e.message,'err')}

    // Are you standing AT a clearable location? Ring it + ask, then zoom in so
    // the glow is visible. Tapping Yes opens it like a map-dot click.
    try{
      const near=findNearestLocation(lat,lng)
      if(near&&near.d*1000<=AT_LOCATION_M){
        showAtLocationGlow(near.l)
        showAtLocationCard(near.l,near.d*1000)
        panToVisible(near.l.lat,near.l.lng,14)
        return
      }
    }catch(e){if(window.dbgLog)window.dbgLog('proximity check failed: '+e.message,'err')}
    clearAtLocationGlow();hideAtLocationCard()

    // Otherwise fit to nearest 15 hospitals/hospices/unis/prisons + user.
    try{
      const categories=['hospital','hospice','university','prison']
      const pool=(Array.isArray(locations)?locations:[]).filter(l=>l&&l.lat&&l.lng&&categories.includes(l.type))
      if(!pool.length){panToVisible(lat,lng,11);return}
      const nearest=pool
        .map(l=>({l,d:kmBetween(lat,lng,l.lat,l.lng)}))
        .sort((a,b)=>a.d-b.d)
        .slice(0,15)
        .map(x=>x.l)
      const withSelf=[{lat,lng},...nearest]
      const{bottomOffset}=getVisibleMapBounds()
      const pad=isMobile()
        ?{top:60,bottom:bottomOffset+80,left:40,right:40}
        :{top:80,bottom:80,left:80,right:80}
      fitBounds(withSelf,pad)
    }catch(e){
      if(window.dbgLog)window.dbgLog('locateMe fit failed: '+e.message,'err')
      // Fallback — at least pan to the user.
      panToVisible(lat,lng,11)
    }
  },function(err){
    restoreBtn()
    const msg=err.code===1?'Location permission denied'
      :err.code===2?'Location unavailable (GPS/Wi-Fi)'
      :err.code===3?'Location timed out'
      :'Could not get location'
    if(window.dbgLog)window.dbgLog('locateMe error '+err.code+': '+err.message,'err')
    alert(msg)
  },opts)
}

function goHome(){
  clearAtLocationGlow();hideAtLocationCard()
  if(window.areaView)window.areaView.active=false
  const _sh=$('search');if(_sh)_sh.value=''
  const _ss=$('search-suggest');if(_ss){_ss.classList.remove('on');_ss.innerHTML=''}
  selectedDistrictCode=null
  updateDistrictStats(null)
  $('district-detail').classList.remove('on')
  if($('tab-groups').classList.contains('on')){
    if(mapReady){
      ;['district-locs','district-locs-cleared'].forEach(function(id){
        if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none')
      })
      if(map.getSource('district-locs-src'))map.getSource('district-locs-src').setData({type:'FeatureCollection',features:[]})
      map.flyTo({center:[-1.5,53.5],zoom:5.5,duration:800})
    }
    renderDistrictList();updateDistrictStates()
  }else{
    const _rs=$('region-select');if(_rs)_rs.value='all'
    loadAll()
    if(mapReady)map.flyTo({center:[-1.5,53.5],zoom:5.5,duration:800})
  }
}

function updateLocateBtnPosition(){
  if(!isMobile())return
  const btn=$('locate-btn'),panel=$('mobile-detail')
  if(!btn||!panel)return
  const panelH=panel.classList.contains('on')?(panel.offsetHeight||0):0
  btn.style.bottom=(11+panelH+(panelH>0?10:0))+'px'
}
