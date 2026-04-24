// ═══════════════════════════════════════════════════════════════════════════
// 12-map-view.js — map viewport helpers: fitBounds, panToVisible, locateMe, goHome
// ═══════════════════════════════════════════════════════════════════════════

// On mobile we need to know how much of the map is obscured by a fixed popup
// so we can bias the map centre into the still-visible area.
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

// Centre the target in the visible portion of the map, i.e. the area above
// any open popup. MapLibre's `offset` in easeTo/flyTo is "shift the target
// away from the viewport centre by this many pixels". To put the target in
// the centre of the upper region (height = mapH - popupH), the target should
// sit popupH/2 pixels ABOVE the viewport centre — which is offset [0,-popupH/2].
function panToVisible(lat,lng,zoom){
  if(!map)return
  const{bottomOffset}=getVisibleMapBounds()
  const yOff=isMobile()?-Math.round(bottomOffset/2):0
  if(zoom){map.flyTo({center:[lng,lat],zoom,offset:[0,yOff],duration:600});return}
  map.easeTo({center:[lng,lat],offset:[0,yOff],duration:400})
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

// Haversine distance in km — good enough for ordering the 15 nearest POIs.
function kmBetween(lat1,lng1,lat2,lng2){
  const R=6371,toRad=d=>d*Math.PI/180
  const dLat=toRad(lat2-lat1),dLng=toRad(lng2-lng1)
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2
  return 2*R*Math.asin(Math.sqrt(a))
}

// Find Me:
//  — Low-accuracy first for speed; high-accuracy would be 5-30s on cold start
//  — Cache up to 60s old so repeated taps are instant
//  — Fit to the 15 nearest non-school/non-GP locations around the user so the
//    viewport is at a useful district-ish scale rather than a fixed zoom level
function locateMe(){
  if(!navigator.geolocation){alert('Geolocation not supported');return}
  const opts={enableHighAccuracy:false,timeout:6000,maximumAge:60000}
  navigator.geolocation.getCurrentPosition(function(pos){
    const{latitude:lat,longitude:lng}=pos.coords
    if(locationMarker)locationMarker.remove()
    const el=document.createElement('div')
    el.style.cssText='width:14px;height:14px;border-radius:50%;background:#C9A84C;border:2.5px solid #0F2818;box-shadow:0 0 0 3px rgba(201,168,76,.35)'
    locationMarker=new maplibregl.Marker({element:el}).setLngLat([lng,lat]).addTo(map)

    const categories=['hospital','hospice','university','prison']
    const pool=locations.filter(l=>l.lat&&l.lng&&categories.includes(l.type))
    if(!pool.length){panToVisible(lat,lng,11);return}
    const nearest=pool
      .map(l=>({l,d:kmBetween(lat,lng,l.lat,l.lng)}))
      .sort((a,b)=>a.d-b.d)
      .slice(0,15)
      .map(x=>x.l)
    // Include the user location as a bound point so they're always in frame.
    const withSelf=[{lat,lng},...nearest]
    const{bottomOffset}=getVisibleMapBounds()
    const pad=isMobile()
      ?{top:60,bottom:bottomOffset+80,left:40,right:40}
      :{top:80,bottom:80,left:80,right:80}
    fitBounds(withSelf,pad)
  },function(err){
    alert(err.code===1?'Location permission denied':'Could not get location')
  },opts)
}

function goHome(){
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
    $('region-select').value='all'
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
