// ═══════════════════════════════════════════════════════════════════════════
// 05-auth.js — login, logout, localStorage restore, header menu
// ═══════════════════════════════════════════════════════════════════════════

async function doLogin(){
  const name=$('login-name').value.trim()
  const pw=$('login-pw').value
  const err=$('login-err')
  if(!name){err.textContent='Please enter your name';return}
  if(!pw){err.textContent='Please enter the password';return}
  const tool=$('login-tool').value
  if(!tool){err.textContent='Please select your default clearing tool';return}
  err.textContent='Checking...'
  const hash=await sha256(pw)
  if(hash!==PASSWORD_HASH){err.textContent='Incorrect password';$('login-pw').value='';return}
  currentUser=name
  currentTool=tool
  userHasEarthworks=$('login-ew').checked
  currentEW=null
  try{localStorage.setItem('ek_user',name);localStorage.setItem('ek_tool',tool);localStorage.setItem('ek_ew',userHasEarthworks?'1':'0')}catch(e){}
  $('login-screen').style.display='none'
  $('app').style.display='flex'
  updateHeaderMenu()
  err.textContent=''
  if(window.dbgLog)window.dbgLog('Login OK: '+name+' tool='+tool,'ok')
  bootApp()
}

function logout(){
  try{localStorage.removeItem('ek_user')}catch(e){}
  currentUser=null
  closeAccountMenu()
  $('login-name').value=''
  $('login-pw').value=''
  $('login-screen').style.display='flex'
  $('app').style.display='none'
}

function tryAutoLogin(){
  try{
    const savedUser=localStorage.getItem('ek_user')
    if(!savedUser)return false
    currentUser=savedUser
    const storedTool=localStorage.getItem('ek_tool')
    if(storedTool&&TOOLS.includes(storedTool))currentTool=storedTool
    userHasEarthworks=localStorage.getItem('ek_ew')==='1'
    $('login-screen').style.display='none'
    $('app').style.display='flex'
    updateHeaderMenu()
    if(window.dbgLog)window.dbgLog('Auto-login: '+savedUser,'ok')
    bootApp()
    return true
  }catch(err){
    try{localStorage.clear()}catch(e){}
    return false
  }
}

// ─── Header account menu ──────────────────────────────────────────────────────────────
// Replaces the old plain "Sign out" button. Button face shows the user's
// first name; clicking opens a dropdown with name/tool editing, protocol
// and instruction links, and sign out.

function updateHeaderMenu(){
  const face=$('acct-face-name')
  if(face)face.textContent=currentUser?currentUser.split(' ')[0]:'Account'
  const ddName=$('acct-current-name');if(ddName)ddName.textContent=currentUser||'—'
  const ddTool=$('acct-current-tool');if(ddTool)ddTool.textContent=TOOL_NAMES_FULL[currentTool]||currentTool
  const ddEw=$('acct-current-ew');if(ddEw)ddEw.textContent=userHasEarthworks?'Yes':'No'
}

function toggleAccountMenu(){
  const dd=$('acct-dropdown');if(!dd)return
  if(dd.classList.contains('on'))closeAccountMenu()
  else openAccountMenu()
}

function openAccountMenu(){
  const dd=$('acct-dropdown');if(!dd)return
  // Start in view (non-edit) mode each time.
  setAccountEditMode(false)
  updateHeaderMenu()
  dd.classList.add('on')
  // Click-away to close
  setTimeout(function(){document.addEventListener('click',_acctOutsideClick,{once:true})},0)
}

function closeAccountMenu(){
  const dd=$('acct-dropdown');if(!dd)return
  dd.classList.remove('on')
  setAccountEditMode(false)
}

function _acctOutsideClick(e){
  const dd=$('acct-dropdown'),btn=$('acct-btn')
  if(!dd)return
  if(dd.contains(e.target)||(btn&&btn.contains(e.target))){
    // Click was inside — reattach listener for next time
    setTimeout(function(){document.addEventListener('click',_acctOutsideClick,{once:true})},0)
    return
  }
  closeAccountMenu()
}

function setAccountEditMode(edit){
  const view=$('acct-view-mode'),editEl=$('acct-edit-mode')
  if(view)view.style.display=edit?'none':''
  if(editEl)editEl.style.display=edit?'':'none'
  if(edit){
    const n=$('acct-edit-name');if(n)n.value=currentUser||''
    const t=$('acct-edit-tool');if(t)t.value=currentTool||'O'
    const ew=$('acct-edit-ew');if(ew)ew.checked=!!userHasEarthworks
  }
}

function saveAccountChanges(){
  const newName=($('acct-edit-name')?.value||'').trim()
  const newTool=$('acct-edit-tool')?.value
  const newEw=!!$('acct-edit-ew')?.checked
  if(!newName){alert('Please enter a name');return}
  if(!newTool||!TOOLS.includes(newTool)){alert('Please pick a tool');return}
  currentUser=newName
  currentTool=newTool
  userHasEarthworks=newEw
  try{
    localStorage.setItem('ek_user',newName)
    localStorage.setItem('ek_tool',newTool)
    localStorage.setItem('ek_ew',newEw?'1':'0')
  }catch(e){}
  updateHeaderMenu()
  setAccountEditMode(false)
  // Re-render anything that depends on user or tool
  if(typeof renderLog==='function')renderLog()
  if(typeof renderList==='function')renderList()
  if(typeof refreshMapData==='function')refreshMapData()
  if(typeof updateLogStats==='function')updateLogStats()
  if(window.dbgLog)window.dbgLog('Account updated: '+newName+' / '+newTool+' / EW='+newEw,'ok')
}

function openProtocolPage(){
  window.open('protocol.html','_blank')
}
function openInstructionsPage(){
  window.open('instructions.html','_blank')
}
