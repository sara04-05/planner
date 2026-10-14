/* The bell in the top bar: a dropdown with your notifications (on every page). */
(function(){
const btn=document.getElementById('bellBtn'),pop=document.getElementById('bellPop');
if(!btn||!pop)return;
const CSRF=(document.querySelector('meta[name="csrf-token"]')||{}).content||'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge=document.getElementById('bellBadge');
let notes=[],unread=Number(badge&&badge.textContent)||0;
function call(a){return fetch('api.php?action='+a,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':CSRF},body:'{}'}).then(r=>r.json().then(b=>{if(!r.ok)throw new Error(b.error||'Something went wrong.');return b}))}
function paintBadge(){if(badge){badge.textContent=unread;badge.hidden=!unread}}
function paint(){
  const rows=notes.map(n=>`<div class="note-row${n.read?'':' new'}"><span class="ic">${n.kind==='like'?'♥':'👤'}</span><div class="tx" translate="no">${esc(n.text)}<small>${esc(String(n.at).slice(0,16))}</small></div>${n.link?`<a class="btn sm" href="${esc(n.link)}">View</a>`:''}</div>`).join('');
  pop.innerHTML=`<div class="bellpop-h"><b>Notifications</b>${notes.length?'<button class="linkbtn" data-clear>Clear all</button>':''}</div><div class="bellpop-b">${rows||'<p class="empty">Nothing new. When someone likes one of your posts, you will see it here.</p>'}</div>`;
}
function close(){pop.hidden=true;btn.setAttribute('aria-expanded','false')}
async function open(){
  pop.hidden=false;btn.setAttribute('aria-expanded','true');pop.innerHTML='<p class="empty">Loading…</p>';
  try{
    const d=await call('x.notes');notes=d.notes;unread=d.unread;paint();
    if(unread){setTimeout(()=>{call('x.notes.read').then(()=>{unread=0;paintBadge();if(window.SPLX&&window.SPLX.setUnread)window.SPLX.setUnread(0)}).catch(()=>{})},1200)}
  }catch(e){pop.innerHTML='<p class="empty">'+esc(e.message)+'</p>'}
}
btn.addEventListener('click',e=>{e.stopPropagation();pop.hidden?open():close()});
pop.addEventListener('click',e=>{
  e.stopPropagation();
  if(e.target.closest('[data-clear]'))call('x.notes.clear').then(()=>{notes=[];unread=0;paintBadge();paint()}).catch(()=>{});
});
document.addEventListener('click',close);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden){close();btn.focus()}});
})();
