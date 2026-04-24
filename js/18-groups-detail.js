// ═══════════════════════════════════════════════════════════════════════════
// 18-groups-detail.js — big district detail panel (per-type section + dropdown + list)
// ═══════════════════════════════════════════════════════════════════════════

function renderDistrictDetail(code){
  const d=districtMap[code];if(!d)return
  const typeEl=$('dd-type');if(typeEl)typeEl.textContent=''
  const nameEl=$('dd-name');if(nameEl)nameEl.textContent=d.name
  const body=$('dd-body');if(!body)return
  body.innerHTML=''
  updateDistrictStats(code)

  const activeTypes=[...groupTypes].filter(t=>(t==='school'?d.schools:d.gps).length>0)
  if(!activeTypes.length){
    const msg=document.createElement('div');msg.className='empty'
    msg.textContent='No data yet — schools/GPs still loading'
    body.appendChild(msg)
  }

  activeTypes.forEach(function(gtype){
    buildDistrictSection(body,d,code,gtype)
  })

  $('district-detail').classList.add('on')

  if(isMobile()&&selectedDistrictCode){
    setTimeout(function(){
      const{bottomOffset}=getVisibleMapBounds()
      const pad={top:60,bottom:bottomOffset+80,left:40,right:40}
      const d2=districtMap[selectedDistrictCode]
      const locs2=d2?[...(groupTypes.has('school')?d2.schools:[]),...(groupTypes.has('gp')?d2.gps:[])]:[]
      if(locs2.length){fitBounds(locs2,pad)}
      else{
        const feat=districts.find(f=>f.properties.code===selectedDistrictCode)
        if(feat&&mapReady){
          try{
            const co=feat.geometry.type==='Polygon'?feat.geometry.coordinates[0]:feat.geometry.coordinates.flat()
            map.fitBounds(
              [[Math.min(...co.map(p=>p[0])),Math.min(...co.map(p=>p[1]))],[Math.max(...co.map(p=>p[0])),Math.max(...co.map(p=>p[1]))]],
              {padding:pad,maxZoom:11,duration:600}
            )
          }catch(e){}
        }
      }
    },300)
  }
}

function buildDistrictSection(body,d,code,gtype){
  const locs=gtype==='school'?d.schools:d.gps
  const total=locs.length
  const indCleared=locs.filter(l=>progress[l.id]).length
  const grp=groupProgress[code+':'+gtype]
  const typeCol=gtype==='school'?'var(--blue)':'var(--green)'
  const typeShort=gtype==='school'?'Schools':'GPs'
  const dot='<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+typeCol+';margin-right:6px;flex-shrink:0"></span>'

  const section=document.createElement('div')
  section.style.cssText='border-top:1px solid var(--bd);padding:8px 0'

  if(grp){
    const dt=new Date(grp.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})
    const col=toolColor(grp.tool)
    const row=document.createElement('div')
    row.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap'
    const label=document.createElement('div')
    label.style.cssText='display:flex;align-items:center;flex:1;min-width:0;font-size:13px'
    label.innerHTML=
      dot+'<strong style="color:'+typeCol+'">'+typeShort+'</strong>'+
      '<span style="margin:0 6px;color:var(--soft);font-size:11px">·</span>'+
      '<span style="color:'+col+';font-size:11px;background:'+col+'15;border:1px solid '+col+'40;border-radius:10px;padding:1px 7px">'+grp.tool+'</span>'+
      '<span style="color:var(--soft);font-size:11px;margin-left:6px">'+dt+'</span>'
    const rmBtn=document.createElement('button')
    rmBtn.style.cssText='background:rgba(255,80,80,.1);border:1px solid rgba(255,80,80,.3);color:rgba(255,120,120,.9);border-radius:10px;padding:3px 10px;font-size:11px;cursor:pointer;white-space:nowrap;flex-shrink:0'
    rmBtn.textContent='Remove'
    rmBtn.onclick=function(){unmarkGroupCleared(code,gtype)}
    row.appendChild(label);row.appendChild(rmBtn)
    section.appendChild(row)
  }else{
    const row=document.createElement('div')
    row.style.cssText='display:flex;align-items:center;gap:8px'
    const label=document.createElement('div')
    label.style.cssText='display:flex;align-items:center;flex:1;font-size:13px'
    label.innerHTML=
      dot+'<strong style="color:'+typeCol+'">'+typeShort+'</strong>'+
      '<span style="color:var(--soft);font-size:11px;margin-left:6px">'+indCleared+'/'+total+'</span>'
    const clearBtn=document.createElement('button')
    clearBtn.style.cssText='background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.35);color:#C9A84C;border-radius:10px;padding:4px 10px;font-size:11px;cursor:pointer;white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:4px'
    clearBtn.innerHTML='Clear <span style="color:rgba(201,168,76,.6);font-size:10px">('+currentTool+')</span> <span style="font-size:9px">▾</span>'
    row.appendChild(label);row.appendChild(clearBtn)
    section.appendChild(row)

    const dropRow=document.createElement('div')
    dropRow.style.cssText='display:none;margin-top:6px'
    const gDrop=buildToolDropdown(currentTool)
    gDrop.style.cssText='flex:1;padding:6px 8px;border:1px solid var(--bd);border-radius:8px;color:var(--gold);font-size:13px;color-scheme:dark;background:#0a1c11'
    const confirmBtn=document.createElement('button')
    confirmBtn.style.cssText='background:rgba(201,168,76,.2);border:1px solid rgba(201,168,76,.5);color:#C9A84C;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;white-space:nowrap;margin-left:6px'
    confirmBtn.textContent='✓ Confirm'
    const dropInner=document.createElement('div')
    dropInner.style.cssText='display:flex;align-items:center;gap:6px;padding:4px 0'
    dropInner.appendChild(gDrop);dropInner.appendChild(confirmBtn)
    dropRow.appendChild(dropInner)
    section.appendChild(dropRow)

    let dropOpen=false
    clearBtn.onclick=function(){dropOpen=!dropOpen;dropRow.style.display=dropOpen?'block':'none'}
    confirmBtn.onclick=function(){markGroupCleared(code,gtype,gDrop.value)}
  }

  // Expandable location list
  const listWrap=document.createElement('div');listWrap.style.marginTop='4px'
  const arrowId='lt-arrow-'+gtype+'-'+code
  const listToggle=document.createElement('button')
  listToggle.style.cssText='width:100%;text-align:left;background:none;border:none;border-top:1px solid rgba(201,168,76,.08);padding:5px 0 2px;font-family:Jost,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--soft);cursor:pointer;display:flex;justify-content:space-between;align-items:center'
  listToggle.innerHTML='<span>View list ('+total+')</span><span id="'+arrowId+'">+</span>'
  const listContainer=document.createElement('div')
  listContainer.style.cssText='display:none;max-height:180px;overflow-y:auto'
  let listOpen=false
  listToggle.onclick=function(){
    listOpen=!listOpen
    const arr=document.getElementById(arrowId);if(arr)arr.textContent=listOpen?'-':'+'
    if(listOpen&&!listContainer.children.length){
      locs.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(function(loc){
        const p=progress[loc.id],grpC=!!groupProgress[code+':'+gtype]
        const isCleared=!!(p||grpC)
        const row2=document.createElement('div')
        row2.style.cssText='padding:4px 2px;border-bottom:1px solid rgba(201,168,76,.06);display:flex;align-items:center;gap:6px;cursor:pointer'
        row2.onclick=function(){switchTab('locs',$('tab-btn-locs'));setTimeout(function(){selectLoc(loc.id)},150)}
        const dot2=document.createElement('div')
        dot2.style.cssText='width:6px;height:6px;border-radius:50%;flex-shrink:0;background:'+(isCleared?GOLD:typeColor(loc.type))
        const nm=document.createElement('div')
        nm.style.cssText='font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:'+(isCleared?'var(--gold)':'var(--ink)')+(isCleared?';opacity:.6':'')
        nm.textContent=loc.name
        row2.appendChild(dot2);row2.appendChild(nm);listContainer.appendChild(row2)
      })
    }
    listContainer.style.display=listOpen?'block':'none'
  }
  listWrap.appendChild(listToggle);listWrap.appendChild(listContainer)
  section.appendChild(listWrap)
  body.appendChild(section)
}
