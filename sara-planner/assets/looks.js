/* Colour looks: the button in the top bar opens a picker; setup.php mounts the same picker. The choice is saved in the browser (localStorage)
   and, for a signed-in person, on their account through look.php. The colours themselves are in assets/looks.css (built from assets/looks.json). */
(function(){
  var root=document.documentElement,KEY='sara-look',DEFAULT='graphite',list=null,loading=null;
  var csrf=function(){var m=document.querySelector('meta[name="csrf-token"]');return m?m.content:''};
  var current=function(){return root.getAttribute('data-look')||DEFAULT};
  function load(){
    if(list)return Promise.resolve(list);
    return loading||(loading=fetch('assets/looks.json').then(function(r){return r.json()}).then(function(j){list=j;return j}));
  }
  function apply(slug){
    root.setAttribute('data-look',slug);
    try{localStorage.setItem(KEY,slug)}catch(e){}
    var t=csrf();
    if(t)fetch('look.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':t},body:JSON.stringify({look:slug})}).catch(function(){});
  }
  var GROUPS=[['main','The classic'],['unisex','Calm and neutral'],['soft','Softer']];
  var tr=function(s){return window.SPL_T?window.SPL_T(s):s};
  function tile(l,on){
    var b=document.createElement('button');b.type='button';b.className='lk-tile';b.dataset.look=l.slug;b.setAttribute('aria-pressed',on?'true':'false');
    var dark=(root.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'))==='dark',v=dark?l.dark:l.light;
    b.innerHTML='<span class="lk-sw" style="background:'+v.bg+'"><i style="background:'+v.paper+';border-color:'+v.line+'"></i><i class="a" style="background:'+v.accent+'"></i></span><span class="lk-n"></span>';
    b.lastChild.textContent=l.name;b.title=l.mood;
    return b;
  }
  /** Fill `box` with the looks, grouped. onPick(slug) runs after a look is chosen. */
  function mount(box,onPick){
    load().then(function(all){
      box.replaceChildren();
      GROUPS.forEach(function(g){
        var items=all.filter(function(l){return l.group===g[0]});if(!items.length)return;
        var h=document.createElement('p');h.className='lk-h';h.textContent=tr(g[1]);box.append(h);
        var grid=document.createElement('div');grid.className='lk-grid';
        items.forEach(function(l){grid.append(tile(l,l.slug===current()))});box.append(grid);
      });
      box.onclick=function(e){
        var b=e.target.closest('.lk-tile');if(!b)return;
        apply(b.dataset.look);
        box.querySelectorAll('.lk-tile').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
        if(onPick)onPick(b.dataset.look);
      };
    });
  }
  window.SPL_LOOKS={mount:mount,current:current,apply:apply};

  /* the top-bar button */
  var pop=null;
  function close(){if(pop){pop.remove();pop=null;document.removeEventListener('keydown',key)}}
  function key(e){if(e.key==='Escape')close()}
  document.addEventListener('click',function(e){
    var btn=e.target.closest('[data-look-btn]');
    if(!btn){if(pop&&!e.target.closest('.lk-pop'))close();return}
    if(pop){close();return}
    pop=document.createElement('div');pop.className='lk-pop';pop.setAttribute('role','dialog');pop.setAttribute('aria-label',tr('Colour theme'));
    var h=document.createElement('p');h.className='lk-title';h.textContent=tr('Colour theme');
    var box=document.createElement('div');pop.append(h,box);
    btn.parentElement.append(pop);mount(box);
    document.addEventListener('keydown',key);
  });
})();
