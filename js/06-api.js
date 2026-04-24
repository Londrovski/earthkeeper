// ═══════════════════════════════════════════════════════════════════════════
// 06-api.js — GitHub read/write for progress + group-progress. One generic saveJson.
// ═══════════════════════════════════════════════════════════════════════════

async function ghGet(path){
  // Uses raw.githubusercontent.com — fine for data files that change infrequently.
  // For things we write (progress.json, group-progress.json), use loadJsonFresh.
  const res=await fetch(RAW_BASE+'/'+path)
  if(!res.ok)throw new Error('Fetch '+res.status)
  return await res.json()
}
async function ghGetOptional(path){try{return await ghGet(path)}catch(e){return[]}}

// Loads JSON directly via Contents API — never cached. Also returns SHA.
// Falls back to raw URL if Contents API fails for any reason.
async function loadJsonFresh(filename){
  try{
    const res=await fetch(API_BASE+'/'+filename,{headers:{...GH_HEADERS,'Cache-Control':'no-cache'}})
    if(!res.ok){
      if(window.dbgLog)window.dbgLog('  Contents API '+filename+' '+res.status+', falling back to raw','warn')
      const raw=await fetch(RAW_BASE+'/'+filename+'?t='+Date.now(),{cache:'no-store'})
      if(!raw.ok)throw new Error('raw fallback '+raw.status)
      return{data:await raw.json(),sha:null}
    }
    const meta=await res.json()
    // meta.content is base64-encoded; GitHub splits long content with \n, so strip.
    const decoded=decodeURIComponent(escape(atob((meta.content||'').replace(/\n/g,''))))
    const data=JSON.parse(decoded)
    return{data,sha:meta.sha}
  }catch(e){
    if(window.dbgLog)window.dbgLog('  loadJsonFresh('+filename+') threw: '+e.message,'err')
    throw e
  }
}

async function loadProgress(){
  try{
    const{data,sha}=await loadJsonFresh('progress.json')
    progress=data||{}
    progressSha=sha
    if(window.dbgLog)window.dbgLog('loadProgress: '+Object.keys(progress).length+' entries, sha='+(progressSha||'?').slice(0,8),'ok')
  }catch(e){
    progress={}
    if(window.dbgLog)window.dbgLog('loadProgress failed: '+e.message,'err')
  }
}

async function loadGroupProgress(){
  try{
    const{data,sha}=await loadJsonFresh('group-progress.json')
    groupProgress=data||{}
    groupProgressSha=sha
    if(window.dbgLog)window.dbgLog('loadGroupProgress: '+Object.keys(groupProgress).length+' entries','ok')
  }catch(e){
    groupProgress={}
    if(window.dbgLog)window.dbgLog('loadGroupProgress failed: '+e.message,'err')
  }
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
