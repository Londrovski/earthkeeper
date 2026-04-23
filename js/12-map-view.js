// ═══════════════════════════════════════════════════════════════════════════
// 12-map-view.js — map viewport helpers: fitBounds, panToVisible, locateMe, goHome
// ═══════════════════════════════════════════════════════════════════════════

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
  const yOff=isMobile()?Math.round(bottomOffset/2):0
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

function locateMe(){
  if(!navigator.geolocation){alert('Geolocation not supported');return}
  navigator.geolocation.getCurrentPosition(function(pos){
    const{latitude:lat,longitude:lng}=pos.coords
    if(locationMarker)locationMarker.remove()
    const el=document.createElement('div')
    el.style.cssText='width:14px;height:14px;border-radius:50%;background:#C9A84C;border:2.5px solid #0F2818;box-shadow:0 0 0 3px rgba(201,168,76,.35)'
    locationMarker=new maplibregl.Marker({element:el}).setLngLat([lng,lat]).addTo(map)
    panToVisible(lat,lng,11)
  },function(err){
    alert(err.code===1?'Location permission denied':'Could not get location')
  },{enableHighAccuracy:true,timeout:10000})
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
