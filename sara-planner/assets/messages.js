/* Messages page (messages.php). Free hosting can't push messages to the browser, so the page asks the server
   for new ones every 20 seconds while it's open, and stops while the tab is in the background. */
(function(){
const box=document.getElementById('chat');if(!box)return;
const CSRF=box.dataset.csrf, T=s=>(window.SPL_T?window.SPL_T(s):s);
const people=document.getElementById('chatPeople'), main=document.getElementById('chatMain');
let current=null, lastId=0, timer=null, listTimer=null, busy=false;

async function api(action,data={}){
  const r=await fetch('api.php?action='+encodeURIComponent(action),{method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json','X-CSRF-Token':CSRF},body:JSON.stringify(data)});
  let j={};try{j=await r.json()}catch(e){}
  if(!r.ok||j.error)throw new Error(j.error||'Something went wrong. Try again.');
  return j;
}
function tick(){const t=el('span','vbadge','✓');t.title=T('Verified account');return t}
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
function when(ts){
  const d=new Date(ts*1000),now=new Date(),hm=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  return d.toDateString()===now.toDateString()?hm:d.toLocaleDateString([],{day:'numeric',month:'short'})+' '+hm;
}
function setUnread(n){
  document.title=(n?'('+n+') ':'')+T('Messages')+' · Splanner';
  // keep the number on the Messages button in the top bar in step with what has been read
  const btn=document.getElementById('msgBtn');if(!btn)return;
  let b=btn.querySelector('.badge');
  if(!n){if(b)b.remove();return}
  if(!b){b=el('span','badge');btn.append(b)}
  b.textContent=String(n);
}

/* ---------- list of chats ---------- */
async function loadList(){
  let r;try{r=await api('msg.list')}catch(e){return}
  setUnread(r.unread);
  people.replaceChildren();
  if(!r.people.length&&!current){people.append(el('li','chat-empty',"No messages yet. Type someone's email above to start."));return}
  const list=r.people.slice();
  if(current&&!list.some(p=>p.id===current.id))list.unshift({id:current.id,name:current.name,tag:current.tag,last:'',unread:0});
  for(const p of list){
    const li=el('li'),b=el('button','chat-person'+(current&&current.id===p.id?' on':''));
    b.type='button';b.onclick=()=>open(p.id);
    const top=el('span','chat-pname',p.name);
    if(p.verified)top.append(tick());
    if(p.unread)top.append(el('span','badge',String(p.unread)));
    b.append(top);
    if(p.tag)b.append(el('span','chat-plast',p.tag));
    if(p.last)b.append(el('span','chat-plast',(p.mine?T('You:')+' ':'')+T(p.last)));
    li.append(b);people.append(li);
  }
}

/* ---------- one chat ---------- */
function bubble(m){
  const d=el('div','msg'+(m.mine?' mine':'')+(m.deleted?' gone':''));d.dataset.id=m.id;
  const body=el('div','msg-body',m.deleted?T('This message was deleted'):m.body);d.append(body);
  const at=el('div','msg-at',when(m.at)+(m.edited?' · '+T('edited'):''));
  const more=el('button','msg-more','⋯');more.type='button';more.title=T('Message options');more.setAttribute('aria-label',T('Message options'));
  at.append(more);d.append(at);
  more.onclick=e=>{e.stopPropagation();toggleMenu(d,m)};
  return d;
}
function closeMenus(){document.querySelectorAll('.msg-menu').forEach(x=>x.remove())}
function toggleMenu(d,m){
  const had=d.querySelector('.msg-menu');closeMenus();if(had)return;
  const menu=el('div','msg-menu');
  const add=(label,fn,cls)=>{const b=el('button',cls||'',T(label));b.type='button';b.onclick=e=>{e.stopPropagation();closeMenus();fn()};menu.append(b)};
  if(m.mine&&!m.deleted)add('Edit message',()=>editMsg(d,m));
  add('Delete for me',async()=>{if(!confirm(T('Delete this message for you? The other person will still see it.')))return;
    try{await api('msg.delete',{id:m.id,scope:'me'});d.remove();loadList()}catch(err){alert(T(err.message))}});
  if(m.mine&&!m.deleted)add('Delete for everyone',async()=>{if(!confirm(T('Delete this message for everyone?')))return;
    try{await api('msg.delete',{id:m.id,scope:'all'});await refresh();loadList()}catch(err){alert(T(err.message))}},'danger');
  d.append(menu);
  // keep the whole menu in view: scroll the chat up just enough
  requestAnimationFrame(()=>menu.scrollIntoView({block:'nearest',behavior:'smooth'}));
}
function editMsg(d,m){
  const body=d.querySelector('.msg-body'),old=body.textContent;
  const ta=el('textarea','msg-edit');ta.value=old;ta.maxLength=2000;ta.rows=2;ta.setAttribute('aria-label',T('Edit message'));
  const save=el('button','btn sm primary',T('Save')),cancel=el('button','btn sm ghost',T('Cancel'));save.type=cancel.type='button';
  const row=el('div','msg-edit-row');row.append(save,cancel);
  body.replaceChildren(ta);body.append(row);ta.focus();ta.scrollIntoView({block:'nearest'});
  cancel.onclick=()=>{body.textContent=old};
  save.onclick=async()=>{const t=ta.value.trim();if(!t)return;
    try{await api('msg.edit',{id:m.id,message:t});await refresh();loadList()}catch(err){alert(T(err.message))}};
}
document.addEventListener('click',closeMenus);
async function open(id){
  clearInterval(timer);current=null;lastId=0;
  main.replaceChildren(el('p','chat-empty','Loading…'));
  let r;try{r=await api('msg.messages',{with:id})}catch(e){main.replaceChildren(el('p','chat-empty',e.message));return}
  current=r.person;
  history.replaceState(null,'','messages.php?with='+id);
  const head=el('div','chat-head');const h2=el('h2');const nameLink=el('a','chat-name',current.name);nameLink.href='u.php?id='+current.id;nameLink.title=T('View profile');h2.append(nameLink);if(current.verified)h2.append(tick());head.append(h2);
  if(current.tag)head.append(el('div','pmail',current.tag));
  const tools=el('div','chat-tools');
  const ren=el('button','btn sm ghost'),del=el('button','btn sm ghost del');ren.type=del.type='button';
  ren.insertAdjacentHTML('afterbegin',ico('pencil'));ren.append(T('Contact name'));del.insertAdjacentHTML('afterbegin',ico('trash'));del.append(T('Delete chat'));
  ren.onclick=async()=>{
    const n=prompt(T('A name only you will see for this contact (leave empty to use their own name):'),current.nick||'');if(n===null)return;
    try{await api('msg.rename',{with:current.id,name:n});await open(current.id);loadList()}catch(err){alert(T(err.message))}};
  del.onclick=async()=>{
    if(!confirm(T('Delete this whole conversation for you? The other person keeps their copy.')))return;
    try{await api('msg.clear',{with:current.id});clearInterval(timer);current=null;lastId=0;history.replaceState(null,'','messages.php');
      main.replaceChildren(el('p','chat-empty chat-pick',T('Pick a conversation, or start one with someone\'s email.')));loadList()}catch(err){alert(T(err.message))}};
  tools.append(ren,del);head.append(tools);
  const log=el('div','chat-log');log.id='chatLog';log.setAttribute('aria-live','polite');log.translate=false;
  if(!r.messages.length)log.append(el('p','chat-empty chat-first','Say hi! Your messages are only seen by the two of you.'));
  r.messages.forEach(m=>log.append(bubble(m)));
  lastId=r.messages.length?r.messages[r.messages.length-1].id:0;sig=signature(r.messages);
  const form=el('form','chat-send'),ta=el('textarea');
  ta.placeholder='Write a message…';ta.rows=2;ta.maxLength=2000;ta.setAttribute('aria-label','Message');
  const send=el('button','btn primary','Send');
  form.append(ta,send);
  ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit()}});
  form.onsubmit=async e=>{
    e.preventDefault();const text=ta.value.trim();if(!text||busy)return;
    busy=true;send.disabled=true;
    try{
      const s=await api('msg.send',{to:current.id,message:text});
      ta.value='';add([s.message]);await refresh().catch(()=>{});loadList();
    }catch(err){alert(T(err.message))}
    busy=false;send.disabled=false;ta.focus();
  };
  main.replaceChildren(head,log,form);
  log.scrollTop=log.scrollHeight;ta.focus();
  setUnread(r.unread);loadList();
  timer=setInterval(poll,20000);
}
function add(msgs){
  const log=document.getElementById('chatLog');if(!log||!msgs.length)return;
  const atEnd=log.scrollHeight-log.scrollTop-log.clientHeight<60;
  const first=log.querySelector('.chat-first');if(first)first.remove();
  for(const m of msgs){if(log.querySelector('[data-id="'+m.id+'"]'))continue;log.append(bubble(m));lastId=Math.max(lastId,m.id)}
  if(atEnd||msgs.some(m=>m.mine))log.scrollTop=log.scrollHeight;
}
let sig='';
const signature=ms=>ms.map(x=>x.id+':'+(x.deleted?'d':'')+(x.edited?'e':'')+':'+x.body.length).join(',');
/** Redraw the open chat from the server (also shows edits and deletions made by the other person). */
async function refresh(){
  if(!current)return;
  const r=await api('msg.messages',{with:current.id}),log=document.getElementById('chatLog');if(!log)return;
  const s=signature(r.messages);if(s===sig)return;sig=s;
  const atEnd=log.scrollHeight-log.scrollTop-log.clientHeight<60;
  log.replaceChildren();
  if(!r.messages.length)log.append(el('p','chat-empty chat-first',T('Say hi! Your messages are only seen by the two of you.')));
  r.messages.forEach(x=>log.append(bubble(x)));
  lastId=r.messages.length?r.messages[r.messages.length-1].id:0;
  if(atEnd)log.scrollTop=log.scrollHeight;setUnread(r.unread);
}
async function poll(){
  if(!current||document.hidden||busy)return;
  try{const before=sig;await refresh();if(sig!==before)loadList()}catch(e){}
}

/* ---------- start a chat by email ---------- */
document.getElementById('chatFind').onsubmit=async e=>{
  e.preventDefault();const inp=document.getElementById('chatEmail');
  try{const r=await api('msg.find',{email:inp.value});inp.value='';open(r.person.id)}
  catch(err){alert(T(err.message))}
};

loadList();
if(+box.dataset.with)open(+box.dataset.with);
listTimer=setInterval(()=>{if(!document.hidden)loadList()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){poll();loadList()}});
})();
