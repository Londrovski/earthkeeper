// ═══════════════════════════════════════════════════════════════════════════
// 14-tool-modal.js — mobile tool-filter modal open/close + sync helpers
// ═══════════════════════════════════════════════════════════════════════════

function openToolModal(){const m=$('tool-modal');if(!m)return;syncModalState();m.style.display='flex'}
function closeToolModal(){const m=$('tool-modal');if(m)m.style.display='none'}

function syncModalState(){
  const a=$('tm-chip-all');if(a)a.classList.toggle('on',showFilter==='all')
  const c=$('tm-chip-cleared');if(c)c.classList.toggle('on',showFilter==='cleared')
  ;['MS','MF','O','J','MG','AP','MI','MJ','DM','EW1','EW2','EW3','EW4','EW5'].forEach(function(t){
    const e=$('tm-'+t);if(e)e.classList.toggle('on',activeTools.has(t)||showFilter===t)
  })
}

function syncModalToMain(){
  $$('.chip.show-all').forEach(el=>el.classList.toggle('on',showFilter==='all'))
  $$('.chip.show-cleared').forEach(el=>el.classList.toggle('on',showFilter==='cleared'))
}
