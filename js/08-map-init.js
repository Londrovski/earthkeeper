// ═══════════════════════════════════════════════════════════════════════════
// 08-map-init.js — MapLibre construction + controls. Hands off to addAllLayers() + wireAllMapHandlers() on load.
// ═══════════════════════════════════════════════════════════════════════════

function initMap(){
  map=new maplibregl.Map({
    container:'map',
    style:{
      version:8,
      sources:{carto:{type:'raster',
        tiles:[
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
        ],
        tileSize:256,
        attribution:'(c) OpenStreetMap contributors (c) CARTO'
      }},
      layers:[{id:'carto-tiles',type:'raster',source:'carto'}]
    },
    center:[-1.5,53.5],
    zoom:5.5,
    attributionControl:false
  })
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-left')

  map.on('load',function(){
    mapReady=true
    if(window.dbgLog)window.dbgLog('map loaded','ok')

    // If districts were fetched before the map finished loading, push them now
    if(districts.length&&map.getSource('districts-src')){
      const fc={type:'FeatureCollection',features:districts}
      map.getSource('districts-src').setData(fc)
      updateDistrictStates()
    }

    addAllSources()
    addAllLayers()
    wireAllMapHandlers()
    refreshMapData()
  })
}
