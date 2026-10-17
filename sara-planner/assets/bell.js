/* The "!" button in the top bar: report a problem with the website to the admins, in a popup (no separate page). */
(function(){
const rb=document.getElementById('reportBtn');
if(!rb)return;
const CSRF=(document.querySelector('meta[name="csrf-token"]')||{}).content||'';
let bg=null;
function close(){if(bg){bg.remove();bg=null;document.removeEventListener('keydown',onKey);rb.focus()}}
function onKey(e){if(e.key==='Escape')close()}
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(a,data){
  const r=await fetch('api.php?action='+a,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':CSRF},body:JSON.stringify(data||{})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Something went wrong.');
  return d;
}
// admins and sub admins: the same button lists what people reported (no separate page)
function openList(){
  if(bg)return;
  bg=document.createElement('div');bg.className='modal-bg';
  bg.innerHTML='<div class="modal reportmodal reportlist" role="dialog" aria-modal="true" aria-labelledby="rlTitle"><h3 id="rlTitle">Reported problems</h3><div class="rlbody"><p class="rpdone">Loading…</p></div><div class="reportfoot"><span></span><span class="acts"><button type="button" class="btn primary" data-rp-cancel>Close</button></span></div></div>';
  document.body.appendChild(bg);
  document.addEventListener('keydown',onKey);
  bg.addEventListener('click',e=>{if(e.target===bg||e.target.closest('[data-rp-cancel]'))close()});
  const body=bg.querySelector('.rlbody');
  let canEdit=false,rows=[];
  const paint=()=>{
    body.innerHTML=rows.length?rows.map(r=>'<div class="rlrow'+(r.resolved?' done':'')+'"><div class="rlhead"><b>'+esc(r.name)+'</b><span class="rlmail">'+esc(r.email)+'</span><span class="rlwhen">'+esc(r.when)+'</span></div><p>'+esc(r.details)+'</p>'+(canEdit?'<button type="button" class="btn sm" data-rl="'+r.id+'" data-on="'+(r.resolved?0:1)+'">'+(r.resolved?'Reopen':'Done')+'</button>':'')+'</div>').join(''):'<p class="rpdone">No problems reported.</p>';
  };
  body.addEventListener('click',async e=>{
    const b=e.target.closest('[data-rl]');if(!b)return;
    b.disabled=true;
    try{await api('x.report.resolve',{id:+b.dataset.rl,on:+b.dataset.on});const r=rows.find(x=>x.id===+b.dataset.rl);if(r)r.resolved=+b.dataset.on;rows.sort((x,y)=>x.resolved-y.resolved||y.id-x.id);paint()}catch(err){b.disabled=false;alert(err.message)}
  });
  api('x.reports').then(d=>{rows=d.reports;canEdit=d.can_edit;paint()}).catch(err=>{body.innerHTML='<p class="rpmsg">'+esc(err.message)+'</p>'});
}
function open(){
  if(rb.dataset.admin)return openList();
  if(bg)return;
  bg=document.createElement('div');bg.className='modal-bg';
  bg.innerHTML='<div class="modal reportmodal" role="dialog" aria-modal="true" aria-labelledby="rpTitle"><h3 id="rpTitle">Report a problem</h3><form class="reportbox" autocomplete="off"><label for="rpText">What went wrong?</label><textarea id="rpText" rows="5" maxlength="1000" placeholder="Which page were you on, and what happened?" required></textarea><p class="rpmsg" role="alert" hidden></p><div class="reportfoot"><span class="count" id="rpCount">0 / 1000</span><span class="acts"><button type="button" class="btn ghost" data-rp-cancel>Cancel</button><button class="btn primary">Send to the admins</button></span></div></form></div>';
  document.body.appendChild(bg);
  const f=bg.querySelector('form'),t=bg.querySelector('#rpText'),m=bg.querySelector('.rpmsg'),c=bg.querySelector('#rpCount');
  t.addEventListener('input',()=>{c.textContent=t.value.length+' / 1000'});
  bg.addEventListener('click',e=>{if(e.target===bg||e.target.closest('[data-rp-cancel]'))close()});
  document.addEventListener('keydown',onKey);
  f.addEventListener('submit',async e=>{
    e.preventDefault();
    const b=f.querySelector('.primary');b.disabled=true;m.hidden=true;
    try{
      const r=await fetch('api.php?action=x.report',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':CSRF},body:JSON.stringify({details:t.value})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Something went wrong.');
      bg.querySelector('.modal').innerHTML='<h3>Thank you</h3><p class="rpdone">Your report was sent to the admins.</p><div class="reportfoot"><span></span><span class="acts"><button type="button" class="btn primary" data-rp-cancel>Close</button></span></div>';
    }catch(err){m.textContent=err.message;m.hidden=false;b.disabled=false}
  });
  t.focus();
}
rb.addEventListener('click',open);
})();

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
  const rows=notes.map(n=>`<div class="note-row${n.read?'':' new'}"><span class="ic">${{like:'♥',friend:'👤',accepted:'🤝',msg:'💬'}[n.kind]||'🔔'}</span><div class="tx" translate="no">${esc(window.SPL_T?window.SPL_T(n.text):n.text)}<small>${esc(String(n.at).slice(0,16))}</small></div>${n.link?`<a class="btn sm" href="${esc(n.link)}">View</a>`:''}</div>`).join('');
  pop.innerHTML=`<div class="bellpop-h"><b>Notifications</b>${notes.length?'<button class="linkbtn" data-clear>Clear all</button>':''}</div><div class="bellpop-b">${rows||'<p class="empty">Nothing new. Friend requests, messages and likes show up here.</p>'}</div>`;
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
// new notifications appear without reloading: check every 30 seconds while the page is visible and the list is closed
// A new one also slides in at the top of the window, so it shows even when you have scrolled down and the top bar is out of view.
let seenId=-1,toastEl=null,toastTimer=0;
function hideToast(){if(toastEl){toastEl.remove();toastEl=null}clearTimeout(toastTimer)}
function showToast(fresh){
  hideToast();
  const n=fresh[0],t=window.SPL_T?window.SPL_T(n.text):n.text,more=fresh.length-1;
  toastEl=document.createElement('div');toastEl.className='notetoast';toastEl.setAttribute('role','status');
  toastEl.innerHTML=`<button type="button" class="nt-go" translate="no"><span class="ic">${{like:'♥',friend:'👤',accepted:'🤝',msg:'💬'}[n.kind]||'🔔'}</span><span class="tx">${esc(t)}${more>0?` <small>+${more} more</small>`:''}</span></button><button type="button" class="nt-x" aria-label="Dismiss">✕</button>`;
  document.body.appendChild(toastEl);
  toastEl.addEventListener('click',e=>{
    e.stopPropagation();
    if(e.target.closest('.nt-x')){hideToast();return}
    hideToast();window.scrollTo({top:0,behavior:'smooth'});if(pop.hidden)open();
  });
  toastTimer=setTimeout(hideToast,8000);
}
function check(){
  if(document.hidden||!pop.hidden)return;
  call('x.notes').then(d=>{
    notes=d.notes;unread=d.unread;paintBadge();
    const top=d.notes.reduce((m,n)=>Math.max(m,n.id),0);
    if(seenId>=0){const fresh=d.notes.filter(n=>!n.read&&n.id>seenId);if(fresh.length)showToast(fresh)}
    seenId=Math.max(seenId,top);
  }).catch(()=>{});
}
check();   // the first look only sets what counts as already seen
setInterval(check,30000);
document.addEventListener('click',close);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden){close();btn.focus()}});
})();
