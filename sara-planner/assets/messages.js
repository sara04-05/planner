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
    if(p.unread)top.append(el('span','badge',String(p.unread)));
    b.append(top);
    if(p.tag)b.append(el('span','chat-plast',p.tag));
    if(p.last)b.append(el('span','chat-plast',(p.mine?T('You:')+' ':'')+p.last));
    li.append(b);people.append(li);
  }
}

/* ---------- one chat ---------- */
function bubble(m){
  const d=el('div','msg'+(m.mine?' mine':''));d.dataset.id=m.id;
  d.append(el('div','msg-body',m.body),el('div','msg-at',when(m.at)));
  return d;
}
async function open(id){
  clearInterval(timer);current=null;lastId=0;
  main.replaceChildren(el('p','chat-empty','Loading…'));
  let r;try{r=await api('msg.messages',{with:id})}catch(e){main.replaceChildren(el('p','chat-empty',e.message));return}
  current=r.person;
  history.replaceState(null,'','messages.php?with='+id);
  const head=el('div','chat-head');head.append(el('h2',null,current.name));
  if(current.tag)head.append(el('div','pmail',current.tag));
  const log=el('div','chat-log');log.id='chatLog';log.setAttribute('aria-live','polite');log.translate=false;
  if(!r.messages.length)log.append(el('p','chat-empty chat-first','Say hi! Your messages are only seen by the two of you.'));
  r.messages.forEach(m=>log.append(bubble(m)));
  lastId=r.messages.length?r.messages[r.messages.length-1].id:0;
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
      ta.value='';add([s.message]);loadList();
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
async function poll(){
  if(!current||document.hidden||busy)return;
  try{
    const r=await api('msg.messages',{with:current.id,after:lastId});
    if(r.messages.length){add(r.messages);loadList()}
  }catch(e){}
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
