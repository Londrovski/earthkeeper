// ═══════════════════════════════════════════════════════════════════════════
// 05-auth.js — login, logout, localStorage restore
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
  $('h-username').textContent=name
  err.textContent=''
  if(window.dbgLog)window.dbgLog('Login OK: '+name+' tool='+tool,'ok')
  bootApp()
}

function logout(){
  try{localStorage.removeItem('ek_user')}catch(e){}
  currentUser=null
  $('login-name').value=''
  $('login-pw').value=''
  $('login-screen').style.display='flex'
  $('app').style.display='none'
}

// Auto-login on page load if we have a saved user
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
    $('h-username').textContent=savedUser
    if(window.dbgLog)window.dbgLog('Auto-login: '+savedUser,'ok')
    bootApp()
    return true
  }catch(err){
    try{localStorage.clear()}catch(e){}
    return false
  }
}
