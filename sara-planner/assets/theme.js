/* Light/dark toggle for the public pages (landing, login, sign-up). The planner has its own copy in app.js. */
(function(){
  var root=document.documentElement,mq=window.matchMedia('(prefers-color-scheme: dark)');
  var SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  function eff(){return root.getAttribute('data-theme')||(mq.matches?'dark':'light')}
  function paint(){
    var d=eff()==='dark';
    document.querySelectorAll('[data-theme-btn]').forEach(function(b){b.innerHTML=d?SUN+'<span class="lbl">Light</span>':MOON+'<span class="lbl">Dark</span>'});
  }
  document.addEventListener('click',function(e){
    if(!e.target.closest('[data-theme-btn]'))return;
    var n=eff()==='dark'?'light':'dark';
    root.setAttribute('data-theme',n);
    try{localStorage.setItem('sara-theme',n)}catch(err){}
    paint();
  });
  mq.addEventListener&&mq.addEventListener('change',paint);
  new MutationObserver(paint).observe(root,{attributes:true,attributeFilter:['data-theme']});
  paint();
})();
