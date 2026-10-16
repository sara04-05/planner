/* Write on the lines. The page paper is ruled every 32px. After every redraw this puts every piece of text that sits directly on the
   paper onto those lines: text blocks get a 32px line height and are moved down to the next line if they start between two lines,
   and boxes (cards, panels) end on a line. Things inside a box (it has its own background) are left alone, the rules don't show there. */
(function(){
  var LH=32,busy=false,timer=null;
  var SKIP_TAG=/^(INPUT|SELECT|TEXTAREA|IMG|SVG|BR|OPTION|SCRIPT|STYLE|CANVAS)$/;
  // how see-through a computed colour is (0 = clear, 1 = solid); handles rgb(), rgba() and color(srgb … / a) from color-mix()
  function alphaOf(c){
    if(!c||c==='transparent')return 0;
    var m=/\/\s*([\d.]+%?)\s*\)/.exec(c);
    if(m){var v=parseFloat(m[1]);return m[1].slice(-1)==='%'?v/100:v}
    m=/^rgba?\(([^)]+)\)/.exec(c);
    if(m){var p=m[1].split(/[,\s]+/).filter(Boolean);return p.length>=4?parseFloat(p[3]):1}
    return 1;
  }
  function opaque(cs){return alphaOf(cs.backgroundColor)>0.4}
  function visibleBorder(cs){return parseFloat(cs.borderTopWidth)>0&&cs.borderTopStyle!=='none'&&cs.borderTopStyle!=='hidden'||parseFloat(cs.borderLeftWidth)>=2&&cs.borderLeftStyle!=='none'}
  function hasOwnText(el){for(var n=el.firstChild;n;n=n.nextSibling)if(n.nodeType===3&&n.nodeValue.trim())return true;return false}
  function snap(){
    if(busy)return;busy=true;
    try{document.querySelectorAll('.page').forEach(snapPage)}finally{busy=false}
  }
  function snapPage(page){
    {
      // undo the last pass
      page.querySelectorAll('[data-snap]').forEach(function(e){
        e.style.marginTop=e.dataset.mt0||'';e.style.lineHeight=e.dataset.lh0||'';e.style.minHeight=e.dataset.mh0||'';
        delete e.dataset.snap;delete e.dataset.mt0;delete e.dataset.lh0;delete e.dataset.mh0;
      });
      var boxes=new Set(),done=new Set(),all=Array.prototype.filter.call(page.querySelectorAll('*'),function(e){return e.closest('.page')===page});
      var pageTop=function(){return page.getBoundingClientRect().top};
      for(var i=0;i<all.length;i++){
        var el=all[i];
        if(SKIP_TAG.test(el.tagName)||el.closest('.stk-layer,.tabs,.coil,nav.tabs,.tour-note,[hidden]')||el.matches('.x,.pill,.tag,.badge')||el.closest('.hr'))continue;   // small controls inside a row keep their own height, or the row grows past one line
        var cs=getComputedStyle(el),disp=cs.display;
        if(!/^(block|flex|grid|list-item|table|flow-root)$/.test(disp)||cs.position==='absolute'||cs.position==='fixed'||cs.float!=='none')continue;
        // inside a box that has its own background? then the rules are hidden there: leave it
        var inBox=false;for(var a=el.parentElement;a&&a!==page;a=a.parentElement){if(boxes.has(a)){inBox=true;break}}
        if(inBox)continue;
        var isBox=opaque(cs)||visibleBorder(cs)&&(el.children.length||hasOwnText(el));
        var isText=hasOwnText(el);
        if(!isBox&&!isText)continue;
        var r0=el.getBoundingClientRect();if(!r0.height)continue;
        // little things (colour dots, swatches, icons) and chips / pills with a tinted background are never stretched: a chip moves with its row
        if(isBox&&!isText&&(r0.height<24||r0.width<24))continue;
        if(isBox&&(parseFloat(cs.borderTopLeftRadius)>=Math.min(r0.width,r0.height)/2-1||Math.abs(r0.width-r0.height)<6&&r0.width<200))continue;   // circles and squares (avatars, swatches) keep their shape
        if(isText&&!opaque(cs)&&alphaOf(cs.backgroundColor)>0.02)continue;
        if(isText&&visibleBorder(cs)&&parseFloat(cs.borderTopLeftRadius)>=8&&r0.height<40&&!el.children.length)continue;
        if(isBox&&opaque(cs))boxes.add(el);
        // something laid out side by side (a flex row / grid) moves as one piece
        var t=el,unit=el.closest('.nbtile,.nb,.person,.nb-new');if(unit&&unit!==page&&page.contains(unit))t=unit;
        for(var p=t.parentElement;p&&p!==page;p=p.parentElement){
          var pc=getComputedStyle(p);
          if((pc.display==='flex'||pc.display==='inline-flex')&&pc.flexDirection.indexOf('row')===0&&p.children.length>1||pc.display==='grid'&&p.children.length>1)t=p;else break;
        }
        if(done.has(t))continue;done.add(t);
        t.dataset.snap='1';t.dataset.mt0=t.style.marginTop;t.dataset.lh0=t.style.lineHeight;t.dataset.mh0=t.style.minHeight;
        var tcs=getComputedStyle(t);
        if(isText&&!isBox&&parseFloat(getComputedStyle(el).fontSize)<=20&&!el.dataset.snap){el.dataset.snap='1';el.dataset.mt0=el.style.marginTop;el.dataset.lh0=el.style.lineHeight;el.dataset.mh0=el.style.minHeight;el.style.lineHeight=LH+'px'}
        if(isBox&&opaque(cs)&&t===el&&r0.width>=160&&r0.height>=48){var h=t.getBoundingClientRect().height;t.style.minHeight=Math.ceil(h/LH-0.02)*LH+'px'}
        for(var k=0;k<3;k++){
          var y=t.getBoundingClientRect().top-pageTop(),rem=((y%LH)+LH)%LH;
          if(rem<0.6||LH-rem<0.6)break;
          t.style.marginTop=(parseFloat(getComputedStyle(t).marginTop)+(LH-rem))+'px';
        }
      }
    }
  }
  function later(){clearTimeout(timer);timer=setTimeout(snap,40)}
  var page=document.querySelector('.page');if(!page)return;
  new MutationObserver(function(){if(!busy)later()}).observe(page,{childList:true,subtree:true,characterData:true});
  window.addEventListener('resize',later);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(later);
  window.addEventListener('load',later);
  later();
})();
