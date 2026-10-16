/* Snap boxes (panels, cards) to whole ruled lines (32px) so the writing that follows them stays on the lines. */
(function(){
  var LH=32,SEL='.page .panel,.page .subj,.page .safe-card,.page .wd,.page .xcard,.page .ilist,.page .post .pb,.page .gcal,.page .onboard,.page .soon,.page .sec-h,.page .filters,.page .addform';
  var busy=false;
  function snap(){
    if(busy)return;busy=true;
    document.querySelectorAll(SEL).forEach(function(el){el.style.minHeight=''});
    document.querySelectorAll(SEL).forEach(function(el){
      var h=el.getBoundingClientRect().height;
      if(h>0)el.style.minHeight=Math.ceil(h/LH-0.01)*LH+'px';
    });
    busy=false;
  }
  var t=null;
  function later(){clearTimeout(t);t=setTimeout(snap,30)}
  var page=document.querySelector('.page');
  if(!page)return;
  new MutationObserver(function(m){if(!busy)later()}).observe(page,{childList:true,subtree:true,characterData:true});
  window.addEventListener('resize',later);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(later);
  later();
})();
