// ═══════════════════════════════════════════════════════════════════════════
// 24-sheets.js — swipe-down-to-dismiss for mobile bottom sheets
//
// Two sheets behave as bottom sheets on mobile:
//   - #mobile-detail   (Locations + Log selected point)
//   - #district-detail (Groups selected district)
//
// Both open with class `.on`. We attach touchstart/touchmove/touchend to each.
// Rules:
//   - Only activate on touchstart inside the drag handle OR the head element
//     (so users can still scroll long content in the body without dismissing).
//   - If start was in the body AND the body is scrolled to the top, a downward
//     drag past a small threshold takes over and starts dragging the sheet.
//   - Downward drags translate the sheet by the drag delta.
//   - Release past 80px OR velocity > 0.5 px/ms downward → close().
//   - Otherwise snap back.
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

    let startY=0,startT=0,dragging=false,currentDy=0
    let startedInBody=false,bodyStartScrollTop=0

    function onStart(e){
      if(!isMobile())return
      if(!el.classList.contains('on'))return
      const t=e.touches?e.touches[0]:e
      const target=e.target
      const head=el.querySelector(cfg.headSel)
      const body=el.querySelector(cfg.bodySel)
      const grabber=el.querySelector('.sheet-grabber')

      const inHead=!!(head&&head.contains(target))||!!(grabber&&grabber.contains(target))
      const inBody=!!(body&&body.contains(target))

      // Don't intercept drags that start on interactive controls (buttons, selects, inputs)
      if(target.closest&&target.closest('button, select, input, textarea, a'))return

      if(inHead){
        startedInBody=false
      }else if(inBody&&body.scrollTop<=0){
        // Body is scrolled to top — allow the downward swipe to convert into a dismiss.
        startedInBody=true
        bodyStartScrollTop=body.scrollTop
      }else{
        return
      }

      startY=t.clientY
      startT=Date.now()
      dragging=true
      currentDy=0
      // Kill any in-progress transition
      el.style.transition='none'
    }

    function onMove(e){
      if(!dragging)return
      const t=e.touches?e.touches[0]:e
      const dy=t.clientY-startY
      if(startedInBody){
        // Only hijack once they've pulled down a bit AND body is still at top
        const body=el.querySelector(cfg.bodySel)
        if(dy<8)return
        if(body&&body.scrollTop>0){
          // User scrolled content back — abandon the drag
          dragging=false
          el.style.transform=''
          el.style.transition=''
          return
        }
      }
      if(dy<0)dy*=0.25 // rubber band a tiny bit on upward pulls, but mostly ignore
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
        // Animate off-screen, then reset transform and close
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
