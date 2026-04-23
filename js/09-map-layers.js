// ═══════════════════════════════════════════════════════════════════════════
// 09-map-layers.js — all sources + layer definitions. Pure declaration.
// ═══════════════════════════════════════════════════════════════════════════

function addAllSources(){
  map.addSource('locations',{type:'geojson',data:emptyFC()})
  map.addSource('locations-cleared',{type:'geojson',data:emptyFC()})
  map.addSource('selected',{type:'geojson',data:emptyFC()})
  map.addSource('districts-src',{type:'geojson',data:emptyFC()})
  map.addSource('district-locs-src',{type:'geojson',data:emptyFC()})
}

function addAllLayers(){
  // ── District polygons ─────────────────────────────────────────────────────────
  map.addLayer({id:'district-fill',type:'fill',source:'districts-src',layout:{visibility:'none'},paint:{
    'fill-color':['case',
      ['==',['feature-state','cleared'],2],'rgba(201,168,76,0.18)',
      ['==',['feature-state','cleared'],1],'rgba(201,168,76,0.09)',
      'rgba(255,255,255,0.01)']
  }})
  map.addLayer({id:'district-glow',type:'line',source:'districts-src',layout:{visibility:'none'},paint:{
    'line-color':GOLD,
    'line-width':['case',['==',['feature-state','cleared'],2],8,['==',['feature-state','cleared'],1],4,0],
    'line-blur':6,
    'line-opacity':['case',['==',['feature-state','cleared'],2],0.6,['==',['feature-state','cleared'],1],0.3,0]
  }})
  map.addLayer({id:'district-line',type:'line',source:'districts-src',layout:{visibility:'none'},paint:{
    'line-color':['case',['>=',['coalesce',['feature-state','cleared'],0],1],GOLD,'rgba(201,168,76,0.25)'],
    'line-width':['case',['>=',['coalesce',['feature-state','cleared'],0],1],1.5,0.6]
  }})
  map.addLayer({id:'district-selected',type:'line',source:'districts-src',layout:{visibility:'none'},paint:{
    'line-color':'rgba(255,255,255,0.75)',
    'line-width':['case',['boolean',['feature-state','selected'],false],2.5,0]
  }})

  // ── Per-location dots inside a selected district (schools/gps) ────────────────────────────
  map.addLayer({id:'district-locs',type:'circle',source:'district-locs-src',layout:{visibility:'none'},paint:{
    'circle-radius':['interpolate',['linear'],['zoom'],7,4,10,7,13,10],
    'circle-color':['case',['==',['get','type'],'school'],'#5B9BD5','#4A9B6F'],
    'circle-opacity':0.9,
    'circle-stroke-width':1.5,
    'circle-stroke-color':'rgba(255,255,255,0.35)',
    'circle-pitch-alignment':'map'
  }})
  map.addLayer({id:'district-locs-cleared',type:'circle',source:'district-locs-src',filter:['==',['get','cleared'],true],layout:{visibility:'none'},paint:{
    'circle-radius':['interpolate',['linear'],['zoom'],7,5,10,8,13,11],
    'circle-color':GOLD,
    'circle-opacity':1,
    'circle-stroke-width':2,
    'circle-stroke-color':['case',
      ['==',['get','tool'],'omega'],'#9B5ED4',
      ['==',['get','tool'],'jewel'],'#E07050',
      ['==',['get','tool'],'mg'],'#4A85C9',
      'rgba(255,255,255,0.5)'],
    'circle-pitch-alignment':'map'
  }})

  // ── Main location dots (uncleared + cleared + selected ring) ─────────────────────────────
  map.addLayer({id:'dots-uncleared',type:'circle',source:'locations',filter:['==',['get','cleared'],false],paint:{
    'circle-radius':['interpolate',['linear'],['zoom'],5,isMobile()?3:4,9,isMobile()?5:7,13,isMobile()?7:9],
    'circle-color':['case',
      ['==',['get','type'],'hospital'],'#E07050',
      ['==',['get','type'],'school'],'#5B9BD5',
      ['==',['get','type'],'hospice'],'#3DBFA8',
      ['==',['get','type'],'prison'],'#C4722A',
      ['==',['get','type'],'gp'],'#4A9B6F',
      '#9B78C8'],
    'circle-opacity':0.55,
    'circle-stroke-width':1,
    'circle-stroke-color':'rgba(255,255,255,0.2)',
    'circle-pitch-alignment':'map'
  }})
  map.addLayer({id:'cleared-glow',type:'circle',source:'locations-cleared',paint:{
    'circle-radius':['interpolate',['linear'],['zoom'],5,9,9,14,13,20],
    'circle-color':GOLD,
    'circle-opacity':0.12,
    'circle-blur':0.7,
    'circle-pitch-alignment':'map'
  }})
  map.addLayer({id:'dots-cleared',type:'circle',source:'locations-cleared',paint:{
    'circle-radius':['interpolate',['linear'],['zoom'],5,isMobile()?5:6,9,isMobile()?8:10,13,isMobile()?10:13],
    'circle-color':GOLD,
    'circle-opacity':1,
    'circle-stroke-width':2,
    'circle-stroke-color':['case',
      ['==',['get','tool'],'omega'],'#9B5ED4',
      ['==',['get','tool'],'jewel'],'#E07050',
      ['==',['get','tool'],'mg'],'#4A85C9',
      'rgba(255,255,255,0.6)'],
    'circle-pitch-alignment':'map'
  }})
  map.addLayer({id:'selected-ring',type:'circle',source:'selected',paint:{
    'circle-radius':['interpolate',['linear'],['zoom'],5,11,9,16,13,22],
    'circle-color':'transparent',
    'circle-stroke-width':2.5,
    'circle-stroke-color':'rgba(255,255,255,0.85)',
    'circle-opacity':0,
    'circle-stroke-opacity':1,
    'circle-pitch-alignment':'map'
  }})
}
