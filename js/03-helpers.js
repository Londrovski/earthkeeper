// ═══════════════════════════════════════════════════════════════════════════
// 03-helpers.js — tiny utilities used everywhere. Pure functions, no state writes.
// ═══════════════════════════════════════════════════════════════════════════

function $(id){return document.getElementById(id)}
function $$(sel){return document.querySelectorAll(sel)}

function isMobile(){return window.innerWidth<=700}

function typeColor(t){return TYPE_COLORS[t]||'#9B78C8'}
function toolColor(t){return TOOL_COLORS[t]||GOLD}

function toolLevel(t){const i=TOOL_ORDER.indexOf(t);return i<0?-1:i}
function higherTool(a,b){return toolLevel(a)>=toolLevel(b)?a:b}

function emptyFC(){return{type:'FeatureCollection',features:[]}}

function gmapsUrl(loc){
  return 'https://www.google.com/maps/search/?api=1&query='+
    encodeURIComponent(loc.name+(loc.address?', '+loc.address:''))
}

function effectiveTool(loc){
  const ind=progress[loc.id]
  const grp=groupProgress[(loc.districtCode||'')+':'+loc.type]
  if(!ind&&!grp)return null
  if(ind&&!grp)return ind.tool
  if(!ind&&grp)return grp.tool
  return higherTool(ind.tool,grp.tool)
}

function isEffectivelyCleared(loc){
  return !!(progress[loc.id]||groupProgress[(loc.districtCode||'')+':'+loc.type])
}

async function sha256(str){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')
}

// Build a <select> with all clearing tools. Returns the element.
function buildToolDropdown(selectedTool,cls){
  const s=document.createElement('select')
  if(cls)s.className=cls
  TOOLS.forEach(function(t){
    const o=document.createElement('option')
    o.value=t
    o.textContent=TOOL_NAMES_FULL[t]||t
    if(t===selectedTool)o.selected=true
    s.appendChild(o)
  })
  return s
}

function setMsg(m){const el=$('mload-msg');if(el)el.textContent=m}
function hideLoader(){const el=$('mload');if(el)el.style.display='none'}
function showSaving(msg){const e=$('saving');if(!e)return;e.textContent=msg;e.style.opacity='1'}
