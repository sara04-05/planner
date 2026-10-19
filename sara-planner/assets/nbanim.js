/* Notebook animations for shared notebooks (u.php): the cover swings open and pages turn, like on your own Profile page.
   Phones and tablets only; none on a laptop or with reduced motion (the CSS hides the leaf there too). */
(function(){
  var calm=function(){return window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce), (min-width: 901px)').matches};
  function flipLeaf(front,cls){
    var bk=document.querySelector('.nbook'),R=bk&&bk.querySelector('.nbp-right'),L=bk&&bk.querySelector('.nbp-left'),G=bk&&bk.querySelector('.nbp-gutter');
    if(!bk||!R||!L||!G||calm())return;
    var b=bk.getBoundingClientRect(),r=R.getBoundingClientRect(),l=L.getBoundingClientRect(),g=G.getBoundingClientRect();
    if(r.left<l.right-4)return;   // phone layout: pages are stacked, nothing to turn
    var hx=g.left+g.width/2,w=r.right-hx,leaf=document.createElement('div');
    leaf.className='nbleaf '+cls;
    leaf.style.cssText='left:'+(hx-b.left)+'px;top:'+(r.top-b.top)+'px;width:'+w+'px;height:'+r.height+'px;--sx:'+((hx-l.left)/w).toFixed(3);
    var f=document.createElement('div');f.className='nbleaf-f';
    if(front==='cover'){f.setAttribute('style',bk.getAttribute('style')||'');f.classList.add('isCover')}
    else if(front){front.removeAttribute('id');front.classList.add('nbleaf-pg');f.appendChild(front)}
    var k=document.createElement('div');k.className='nbleaf-b';
    var back=L.cloneNode(false);back.removeAttribute('id');back.className=L.className+' nbleaf-pg';k.appendChild(back);
    leaf.appendChild(f);leaf.appendChild(k);bk.appendChild(leaf);
    leaf.addEventListener('animationend',function(e){if(e.target===leaf)leaf.remove()});
    setTimeout(function(){leaf.remove()},1800);
  }
  window.NBANIM={calm:calm,flip:flipLeaf};
})();
