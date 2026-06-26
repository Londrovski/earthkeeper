// ═══════════════════════════════════════════════════════════════════════════
// 26-users.js — lightweight name memory + login autocomplete.
//
// A `users` table (name, tool, ew) caches each practitioner's last tool/EW so
// the login screen can suggest names and one-tap restore their settings.
// NOT real auth — the shared Merlin password is still required to enter.
// anon read + insert/update (consistent with the shared-group model).
// ═══════════════════════════════════════════════════════════════════════════

async function usersSearch(q){
  if(!q||!q.trim())return []
  const url=SB_REST+'/users?select=name,tool,ew,country&name=ilike.*'+encodeURIComponent(q.trim())+'*&order=name.asc&limit=8'
  try{
    const res=await fetch(url,{headers:SB_HEADERS,cache:'no-store'})
    if(!res.ok)return []
    return await res.json()
  }catch(e){return []}
}

// Fire-and-forget: remember this person's name + tool + EW. Never blocks login.
async function usersUpsert(name,tool,ew,country){
  if(!name||!name.trim())return
  const row={name:name.trim(),tool:tool||null,ew:!!ew,updated_at:new Date().toISOString()}
  if(country)row.country=country
  try{
    await fetch(SB_REST+'/users',{
      method:'POST',
      headers:{...SB_HEADERS,'Prefer':'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(row)
    })
  }catch(e){ if(window.dbgLog)window.dbgLog('usersUpsert failed: '+e.message,'warn') }
}

// Look up one user's saved country (exact, case-insensitive). Returns 'UK'/'AU' or null.
async function usersGetCountry(name){
  if(!name||!name.trim())return null
  try{
    const url=SB_REST+'/users?select=country&name=eq.'+encodeURIComponent(name.trim())+'&limit=1'
    const res=await fetch(url,{headers:SB_HEADERS,cache:'no-store'})
    if(!res.ok)return null
    const rows=await res.json()
    return (rows[0]&&rows[0].country)||null
  }catch(e){return null}
}

// ── Login name autocomplete ──────────────────────────────────────────────
let _userSuggestTimer=null
function initNameAutocomplete(){
  const input=$('login-name')
  if(!input)return
  let box=$('login-name-suggest')
  if(!box){
    box=document.createElement('div')
    box.id='login-name-suggest'
    box.className='login-suggest'
    input.insertAdjacentElement('afterend',box)
  }
  input.setAttribute('autocomplete','off')
  input.addEventListener('input',function(){
    const q=input.value.trim()
    clearTimeout(_userSuggestTimer)
    if(q.length<1){box.innerHTML='';box.classList.remove('on');return}
    _userSuggestTimer=setTimeout(async function(){
      const rows=await usersSearch(q)
      if(!rows.length){box.innerHTML='';box.classList.remove('on');return}
      box.innerHTML=''
      rows.forEach(function(r){
        const item=document.createElement('div')
        item.className='login-suggest-item'
        const nm=document.createElement('span');nm.className='ls-name';nm.textContent=r.name
        const meta=document.createElement('span');meta.className='ls-meta'
        meta.textContent=r.tool?(r.tool+(r.ew?' +EW':'')):''
        item.appendChild(nm);item.appendChild(meta)
        // mousedown (not click) so it fires before the input's blur
        item.addEventListener('mousedown',function(e){e.preventDefault();pickUser(r)})
        box.appendChild(item)
      })
      box.classList.add('on')
    },180)
  })
  input.addEventListener('blur',function(){ setTimeout(function(){box.classList.remove('on')},150) })
}

function pickUser(r){
  const input=$('login-name'); if(input)input.value=r.name
  if(r.tool){ const t=$('login-tool'); if(t&&[...t.options].some(o=>o.value===r.tool))t.value=r.tool }
  const ew=$('login-ew'); if(ew)ew.checked=!!r.ew
  if(r.country){ const c=$('login-country'); if(c&&[...c.options].some(o=>o.value===r.country))c.value=r.country }
  const box=$('login-name-suggest'); if(box){box.innerHTML='';box.classList.remove('on')}
  const pw=$('login-pw'); if(pw)pw.focus()
}

if(document.readyState!=='loading')initNameAutocomplete()
else document.addEventListener('DOMContentLoaded',initNameAutocomplete)
