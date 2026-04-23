// ═══════════════════════════════════════════════════════════════════════════
// 06-api.js — GitHub read/write for progress + group-progress. One generic saveJson.
// ═══════════════════════════════════════════════════════════════════════════

async function ghGet(path){
  const res=await fetch(RAW_BASE+'/'+path)
  if(!res.ok)throw new Error('Fetch '+res.status)
  return await res.json()
}
async function ghGetOptional(path){try{return await ghGet(path)}catch(e){return[]}}

async function loadProgress(){
  try{
    const res=await fetch(RAW_BASE+'/progress.json?t='+Date.now())
    if(res.ok)progress=await res.json()
    const sha=await fetch(API_BASE+'/progress.json',{headers:GH_HEADERS})
    if(sha.ok){const m=await sha.json();progressSha=m.sha}
    if(window.dbgLog)window.dbgLog('loadProgress: '+Object.keys(progress).length+' entries, sha='+(progressSha||'?').slice(0,8),'ok')
  }catch(e){progress={};if(window.dbgLog)window.dbgLog('loadProgress failed: '+e.message,'err')}
}

async function loadGroupProgress(){
  try{
    const res=await fetch(RAW_BASE+'/group-progress.json?t='+Date.now())
    if(res.ok)groupProgress=await res.json()
    const sha=await fetch(API_BASE+'/group-progress.json',{headers:GH_HEADERS})
    if(sha.ok){const m=await sha.json();groupProgressSha=m.sha}
    if(window.dbgLog)window.dbgLog('loadGroupProgress: '+Object.keys(groupProgress).length+' entries','ok')
  }catch(e){groupProgress={};if(window.dbgLog)window.dbgLog('loadGroupProgress failed: '+e.message,'err')}
}

// Generic GitHub PUT. Fetches fresh SHA right before PUT to avoid conflicts.
async function saveJson(filename,dataObj,messagePrefix){
  if(window.dbgLog)window.dbgLog('saveJson('+filename+') keys='+Object.keys(dataObj).length,'info')
  showSaving('Saving...')
  let liveSha=null
  try{
    const shaRes=await fetch(API_BASE+'/'+filename,{headers:GH_HEADERS})
    if(shaRes.ok){const m=await shaRes.json();liveSha=m.sha;if(window.dbgLog)window.dbgLog('  fresh sha='+liveSha.slice(0,8),'dim')}
    else if(window.dbgLog)window.dbgLog('  sha fetch '+shaRes.status,'warn')
  }catch(e){if(window.dbgLog)window.dbgLog('  sha fetch threw: '+e.message,'err')}

  const body={
    message:(currentUser||'user')+' '+(messagePrefix||'')+' - '+new Date().toISOString().slice(0,10),
    content:btoa(unescape(encodeURIComponent(JSON.stringify(dataObj,null,2)))),
    branch:DATA_BRANCH
  }
  if(liveSha)body.sha=liveSha

  try{
    const res=await fetch(API_BASE+'/'+filename,{
      method:'PUT',
      headers:{...GH_HEADERS,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    })
    if(res.ok){
      const j=await res.json()
      showSaving('Saved')
      if(window.dbgLog)window.dbgLog('  ✓ PUT OK, new sha='+j.content.sha.slice(0,8),'ok')
      return j.content.sha
    }else{
      const txt=await res.text()
      showSaving('ERR '+res.status+': '+txt.slice(0,100))
      if(window.dbgLog)window.dbgLog('  ✗ PUT '+res.status+': '+txt.slice(0,200),'err')
      return null
    }
  }catch(e){
    showSaving('Error saving')
    if(window.dbgLog)window.dbgLog('  ✗ PUT threw: '+e.message,'err')
    return null
  }finally{
    setTimeout(function(){const el=$('saving');if(el)el.style.opacity='0'},10000)
  }
}

async function saveProgress(){
  const newSha=await saveJson('progress.json',progress,'')
  if(newSha)progressSha=newSha
}

async function saveGroupProgress(){
  const newSha=await saveJson('group-progress.json',groupProgress,'groups')
  if(newSha)groupProgressSha=newSha
}

function queueSave(){saveQueued=true}

document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden'&&saveQueued){saveProgress();saveQueued=false}
})
window.addEventListener('pagehide',function(){if(saveQueued)saveProgress()})
