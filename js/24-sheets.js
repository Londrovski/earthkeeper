// ═══════════════════════════════════════════════════════════════════════════
// 24-sheets.js — swipe-down-to-dismiss for mobile bottom sheets
//
// Two sheets behave as bottom sheets on mobile:
//   - #mobile-detail   (Locations + Log selected point)
//   - #district-detail (Groups selected district)
//
// Both open with class `.on`. We attach touchstart/touchmove/touchend to each.
// Rules:
//   - Touchstart in the drag-grabber or head: immediately arm a drag.
//   - Touchstart in the body: only arm if the body is scrolled to the top,
//     so normal scroll-through-long-content still works.
//   - Downward drags translate the sheet by the drag delta.
//   - Release past 80px OR velocity > 0.5 px/ms downward → close().
//   - Otherwise snap back.
//   - Ignores drags that start on interactive controls (buttons/selects/inputs).
// ═══════════════════════════════════════════════════════════════════════════

function initSwipeToClose(){
  const CLOSE_DISTANCE=80
  const CLOSE_VELOCITY=0.5 // px per ms

  const sheets=[
    {id:'mobile-detail',headSel:'.detail-head',bodySel:'.detail-body',close:function(){if(typeof closeMobileDetail==='function')closeMobileDetail()}},
    {id:'district-detail',headSel:'.district-detail-head',bodySel:'.district-detail-body',close:function(){if(typeof closeDistrictDetail==='function')closeDistrictDetail()}}
  ]

  sheets.forEach(function(cfg){
    const el=document.getElementById(cfg.id)
    if(!el||el.dataset.swipeWired)return
    el.dataset.swipeWired='1'

    // Inject a visual grabber at the top of the sheet if one isn't there yet.
    if(!el.querySelector('.sheet-grabber')){
      const grab=document.createElement('div')
      grab.className='sheet-grabber'
      grab.setAttribute('aria-hidden','true')
      el.insertBefore(grab,el.firstChild)
    }

    let startY=0,startT=0,dragging=false,currentDy=0,startedInBody=false

    function onStart(e){
      if(!isMobile())return
      if(!el.classList.contains('on'))return
      const t=e.touches?e.touches[0]:e
      const target=e.target
      // Don't intercept drags that start on interactive controls
      if(target.closest&&target.closest('button, select, input, textarea, a'))return

      const head=el.querySelector(cfg.headSel)
      const body=el.querySelector(cfg.bodySel)
      const grabber=el.querySelector('.sheet-grabber')
      const inHead=!!(head&&head.contains(target))||!!(grabber&&grabber.contains(target))
      const inBody=!!(body&&body.contains(target))

      if(inHead){
        startedInBody=false
      }else if(inBody&&body.scrollTop<=0){
        startedInBody=true
      }else{
        return
      }

      startY=t.clientY
      startT=Date.now()
      dragging=true
      currentDy=0
      el.style.transition='none'
    }

    function onMove(e){
      if(!dragging)return
      const t=e.touches?e.touches[0]:e
      const dy=t.clientY-startY
      if(startedInBody){
        // Only hijack once they've pulled down a bit AND body is still at top
        if(dy<8)return
        const body=el.querySelector(cfg.bodySel)
        if(body&&body.scrollTop>0){
          dragging=false
          el.style.transform=''
          el.style.transition=''
          return
        }
      }
      currentDy=Math.max(0,dy)
      el.style.transform='translateY('+currentDy+'px)'
      // Prevent the page from scrolling while we're dragging the sheet
      if(e.cancelable)e.preventDefault()
    }

    function onEnd(){
      if(!dragging)return
      dragging=false
      const dt=Date.now()-startT
      const velocity=dt>0?currentDy/dt:0
      el.style.transition='transform .22s ease'
      if(currentDy>CLOSE_DISTANCE||velocity>CLOSE_VELOCITY){
        const height=el.offsetHeight||400
        el.style.transform='translateY('+height+'px)'
        setTimeout(function(){
          el.style.transition=''
          el.style.transform=''
          cfg.close()
        },200)
      }else{
        el.style.transform=''
        setTimeout(function(){el.style.transition=''},250)
      }
      currentDy=0
    }

    el.addEventListener('touchstart',onStart,{passive:true})
    el.addEventListener('touchmove',onMove,{passive:false})
    el.addEventListener('touchend',onEnd)
    el.addEventListener('touchcancel',onEnd)
  })
}
