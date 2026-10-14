/* The sharing side of the planner: Blog, Interests, Profile (privacy + design) and Alerts tabs.
   app.js asks window.SPLX.html(tab) for each tab's HTML; everything here talks to api.php (x.* actions) and upload.php. */
(function(){
const CSRF=(document.querySelector('meta[name="csrf-token"]')||{}).content||'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const hdr=(eyebrow,title,right='')=>`<div class="vh"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div><div class="nav">${right}</div></div>`;

const COVERS={dusk:'linear-gradient(135deg,#6A4DC4,#E0609A)',peach:'linear-gradient(135deg,#F9A826,#F36B7F)',ocean:'linear-gradient(135deg,#1F77C9,#3FC1C9)',mint:'linear-gradient(135deg,#4FA36B,#B6E3C9)',berry:'linear-gradient(135deg,#8E2DE2,#C2185B)',sunny:'linear-gradient(135deg,#FFD452,#FF9966)',night:'linear-gradient(135deg,#1B1740,#4B3A8F)',cloud:'linear-gradient(135deg,#BFD7F5,#E8DDF8)'};
const PAPER_COLORS={white:'#FFFFFF',cream:'#FFF8E8',blush:'#FFF0F3',mint:'#EEF9F2',sky:'#EEF5FD',lilac:'#F4EFFC'};
const ACCENTS={violet:'#6A4DC4',rose:'#C93A72',ocean:'#1F77C9',forest:'#2B8A5B',sunset:'#D2661E',graphite:'#4A4F5C'};
const PAPERS=[['lined','Lined'],['grid','Grid'],['dots','Dots'],['plain','Plain']];
const FONTS=[['modern','Modern',''],['hand','Handwritten','Caveat,cursive'],['serif','Classic','Lora,Georgia,serif'],['mono','Typewriter','ui-monospace,Menlo,monospace']];
const STICKERS=['⭐','💜','🌸','🎀','🦋','☁️','🌙','✨','🍓','🎧','📚','☕','🐱','🌈','🔥','🍒','🎬','🎵','👗','👠','🧸','🌷','🍀','💌','📌','✏️','🎨','🪩','💫','🍑','🌻','🧿'];
const LIST_EMOJI=['🎬','🎤','👗','📚','🍕','🎮','🎧','✈️','🐾','💄','🎨','⭐'];
const QUICK=[['🎬','Favourite movies','list'],['🎤','Favourite singers','list'],['👗','My clothes and style','grid'],['📚','Books I love','list'],['🍕','Favourite food','list'],['✈️','Places I want to visit','list']];
const SHARE=[['blog','Blog posts','Posts you marked as public.'],['interests','Interest lists','Lists you marked as public.'],['timetable','Weekly timetable','Your repeating weekly hours (the ↻ ones).'],['subjects','Study subjects','Subject names and how far you are, never your notes.']];

let S=null,loading=false,loadErr='';
const ui={post:null,pics:{},dd:null,dirty:false,sel:-1,newList:false,marked:false};

async function api(action,data={}){
  const res=await fetch('api.php?action='+encodeURIComponent(action),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':CSRF},body:JSON.stringify(data)});
  let body={};try{body=await res.json()}catch(e){}
  if(res.status===401){location.href='login.php';throw new Error('Please log in again.')}
  if(!res.ok)throw Object.assign(new Error(body.error||'Something went wrong. Try again.'),{status:res.status});
  return body;
}
async function upload(file,kind){
  const fd=new FormData();fd.append('file',file);fd.append('kind',kind);
  const res=await fetch('upload.php',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':CSRF},body:fd});
  let body={};try{body=await res.json()}catch(e){}
  if(!res.ok)throw new Error(body.error||'The picture did not upload. Try again.');
  return body;
}
const toast=m=>{const t=$('toast');if(!t)return;t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{t.hidden=true},4500)};
const redraw=id=>window.SPL_RENDER&&window.SPL_RENDER(id);
const clone=o=>JSON.parse(JSON.stringify(o));

function load(){
  if(loading)return;loading=true;loadErr='';
  api('x.load').then(d=>{S=d;ui.dd=clone(d.design);ui.dd.cover_url=d.cover_url;ui.dirty=false;loading=false;paintBadges();redraw()})
    .catch(e=>{loading=false;loadErr=e.message;redraw()});
}
function paintBadges(){
  const n=S?S.unread:0;
  const b=$('bellBadge');if(b){b.textContent=n;b.hidden=!n}
  const t=$('tabBadge');if(t){if(n)t.textContent=n;else t.remove()}
  else if(n){const tab=document.querySelector('.tab[data-tab="alerts"]');if(tab){tab.insertAdjacentHTML('beforeend',` <span class="badge" id="tabBadge">${n}</span>`)}}
}

/* ---------- small building blocks ---------- */
const sw=(label,sub,on,attr,dis=false)=>`<label class="sw"><span class="t"><b>${label}</b><span>${sub}</span></span><input type="checkbox" ${on?'checked':''} ${dis?'disabled':''} ${attr}><span class="tg"></span></label>`;
const miniSw=(label,on,attr)=>`<label class="mini-sw"><input type="checkbox" ${on?'checked':''} ${attr}><span class="tg"></span>${label}</label>`;
function picInner(key){
  const p=ui.pics[key];
  return `<label class="btn sm"><input type="file" accept="image/*" data-xfile="${key}" data-kind="photo">📎 ${p?'Change picture':'Attach a picture'}</label>`+
    (p?`<img class="thumb" src="${esc(p.url)}" alt=""><button type="button" class="btn sm ghost" data-x="pic-rm" data-key="${key}">Remove</button>`:'')+`<span class="hint2" data-pic-msg></span>`;
}
const picPick=key=>`<div class="pic-pick" data-pic="${key}">${picInner(key)}</div>`;
const armed=b=>{if(b.dataset.armed)return true;b.dataset.armed='1';b.textContent='Sure?';return false};

/* ---------- BLOG ---------- */
function postForm(){
  const f=ui.post;if(!f)return '';
  return `<form class="xcard xform" data-xform="post" autocomplete="off" style="margin-bottom:16px">
    <h3>${f.id?'Edit post':'New post'}</h3>
    <label class="l" for="px-title">Title</label><input type="text" id="px-title" name="title" maxlength="150" value="${esc(f.title)}" data-draft required>
    <label class="l" for="px-body">Write something</label><textarea id="px-body" name="body" maxlength="20000" data-draft required placeholder="What's on your mind today?">${esc(f.body)}</textarea>
    ${picPick('post')}
    ${miniSw('Show this post on my public notebook',f.public,'name="public"')}
    <div class="xrow"><button class="btn primary">${f.id?'Save changes':'Publish post'}</button><button type="button" class="btn ghost" data-x="post-cancel">Cancel</button></div>
  </form>`;
}
function blogHtml(){
  const pub=S.profile.public;
  const posts=S.posts.map(p=>`<article class="post">
    ${p.image?`<img class="pimg" src="${esc(p.image)}" alt="">`:''}
    <div class="pb"><h3 translate="no">${esc(p.title)}</h3>
      <div class="meta2"><span>${esc(p.date)}</span><span class="tag2 ${p.public?'':'priv'}">${p.public?'Public':'Only me'}</span><span>♥ ${p.likes}</span></div>
      <div class="txt" translate="no">${esc(p.body)}</div>
      <div class="acts"><button class="btn sm" data-x="post-edit" data-id="${p.id}">Edit</button>
        <button class="btn sm" data-x="post-vis" data-id="${p.id}">${p.public?'Make private':'Make public'}</button>
        <button class="btn sm danger" data-x="post-del" data-id="${p.id}">Delete</button></div></div></article>`).join('');
  return hdr('Your notebook','Blog',ui.post?'':'<button class="btn primary" data-x="post-new">+ New post</button>')+
    (pub?'':'<p class="hint2" style="margin:-6px 0 14px;font-size:13px">Posts marked public show on your notebook once you turn on <b>Public profile</b> in the Profile tab.</p>')+
    postForm()+(posts||(ui.post?'':'<p class="empty">No posts yet. Write about your day, a book you finished, a trip — whatever you like. Each post can be private or public.</p>'));
}

/* ---------- INTERESTS ---------- */
function listCard(l){
  const items=l.layout==='grid'
    ?`<div class="igrid">${l.items.map(it=>`<div class="gi">${it.image?`<img src="${esc(it.image)}" alt="" loading="lazy">`:'<div class="noimg">🖼️</div>'}<span class="cap" translate="no">${esc(it.text)}</span><button class="x" data-x="item-del" data-id="${it.id}" aria-label="Delete ${esc(it.text)}">×</button></div>`).join('')}</div>`
    :`<ul>${l.items.map(it=>`<li>${it.image?`<img src="${esc(it.image)}" alt="" loading="lazy">`:''}<div class="tx" translate="no">${esc(it.text)}${it.note?`<small>${esc(it.note)}</small>`:''}</div><button class="x sm" data-x="item-del" data-id="${it.id}" aria-label="Delete ${esc(it.text)}">×</button></li>`).join('')}</ul>`;
  const k='item-'+l.id;
  return `<div class="ilist"><div class="ih"><span class="em">${esc(l.emoji)}</span><h3 translate="no">${esc(l.title)}</h3><button class="x" data-x="list-del" data-id="${l.id}" aria-label="Delete list ${esc(l.title)}">×</button></div>
    <div class="xrow sp" style="margin-bottom:8px">${miniSw('Public',l.public,`data-xsw="list-public" data-id="${l.id}"`)}
      <span class="pilltabs"><button type="button" data-x="list-layout" data-id="${l.id}" data-v="list" aria-pressed="${l.layout==='list'}">List</button><button type="button" data-x="list-layout" data-id="${l.id}" data-v="grid" aria-pressed="${l.layout==='grid'}">Pictures</button></span></div>
    ${l.items.length?items:'<p class="hint2">Nothing here yet.</p>'}
    <form class="addi xform" data-xform="item" data-id="${l.id}" autocomplete="off">
      <div class="xrow"><input type="text" id="ix-text-${l.id}" name="text" maxlength="150" placeholder="${l.layout==='grid'?'Name it, e.g. Black blazer':'Add something you love'}" data-draft required aria-label="New item"><button class="btn primary sm">Add</button></div>
      ${l.layout==='list'?`<input type="text" id="ix-note-${l.id}" name="note" maxlength="300" placeholder="A note (optional)" data-draft aria-label="Note">`:''}
      ${picPick(k)}
    </form></div>`;
}
function interestsHtml(){
  const quick=QUICK.map((q,i)=>`<button class="chipbtn" data-x="list-quick" data-i="${i}">${q[0]} ${q[1]}</button>`).join('')+`<button class="chipbtn${ui.newList?' on':''}" data-x="list-new">+ My own list</button>`;
  const form=ui.newList?`<form class="xcard xform" data-xform="list" autocomplete="off" style="margin-bottom:16px"><h3>New list</h3>
      <label class="l" for="lx-title">Name</label><input type="text" id="lx-title" name="title" maxlength="80" placeholder="e.g. Perfumes I want" data-draft required>
      <label class="l" for="lx-emoji">Icon</label><select id="lx-emoji" name="emoji">${LIST_EMOJI.map(e=>`<option>${e}</option>`).join('')}</select>
      <label class="l" for="lx-layout">Show it as</label><select id="lx-layout" name="layout"><option value="list">A list</option><option value="grid">A grid of pictures</option></select>
      <div class="xrow"><button class="btn primary">Create list</button><button type="button" class="btn ghost" data-x="list-new">Cancel</button></div></form>`:'';
  return hdr('Your notebook','Interests')+
    '<p class="hint2" style="margin:-6px 0 12px;font-size:13px">Lists of the things you love: movies, singers, fashion, anything. Add pictures of your clothes or favourites. Each list is private until you switch it to public.</p>'+
    `<div class="quick">${quick}</div>${form}`+
    (S.lists.length?`<div class="ilists">${S.lists.map(listCard).join('')}</div>`:'<p class="empty">No lists yet. Pick one of the ideas above to start.</p>');
}

/* ---------- PROFILE: privacy + design + live preview ---------- */
const stkImg=id=>{const u=S.stickers_up.find(s=>s.id===id);return u?u.url:''};
function bannerInner(d,edit){
  return d.stickers.map((s,i)=>{
    const css=`--x:${s.x}%;--y:${s.y}%;--s:${s.s};--r:${s.r}deg`;
    const cls='stk'+(edit&&i===ui.sel?' sel':'');
    if(String(s.k).startsWith('up:')){const u=stkImg(+s.k.slice(3));return u?`<img class="${cls}" data-i="${i}" alt="" src="${esc(u)}" style="${css}" draggable="false">`:''}
    return `<span class="${cls}" data-i="${i}" style="${css}">${esc(s.k)}</span>`;
  }).join('');
}
function pvHtml(){
  const d=ui.dd,name=document.querySelector('.hello span:last-child')?document.querySelector('.hello span:last-child').textContent.replace(/^Hi,\s*/,''):'You';
  const attrs=(d.paper!=='lined'?` data-paper="${d.paper}"`:'')+(d.paper_color!=='white'?` data-pcolor="${d.paper_color}"`:'')+(d.font!=='modern'?` data-font="${d.font}"`:'');
  return `<p class="pv-l">Live preview · this is how your notebook will look</p>
    <div data-accent="${d.accent}">
      <div class="nb-banner edit${d.cover_url?' has-img':''}" id="pvBanner" data-cover="${d.cover}" ${d.cover_url?`style="--img:url('${esc(d.cover_url)}')"`:''}>${bannerInner(d,true)}</div>
      <div class="nb-page"${attrs}>
        <div class="who"><div class="av" aria-hidden="true">${esc((name[0]||'S').toUpperCase())}</div><div><h2 translate="no">${esc(name)}</h2><div class="bio" translate="no">${esc(S.profile.bio||'Your bio shows up here.')}</div></div></div>
        <div class="sample"><span class="hl">Today's plan</span> · finish the lab report, read chapter 4,<br>buy a notebook 📓 and call mum.</div>
        <div class="acc-row"><span class="btn primary">Follow</span><span class="tag2">Blog</span><span class="tag2">Interests</span></div>
      </div></div>
    <p class="pv-note">Drag the stickers on the cover to place them. Nothing changes for others until you press <b>Save design</b>.</p>`;
}
function refreshPv(){const el=$('pv');if(el)el.innerHTML=pvHtml();syncDesignControls()}
function syncDesignControls(){
  const d=ui.dd;
  document.querySelectorAll('[data-x="cover"]').forEach(b=>b.setAttribute('aria-pressed',String(!d.cover_url&&b.dataset.v===d.cover)));
  document.querySelectorAll('[data-x="paper"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===d.paper)));
  document.querySelectorAll('[data-x="pcolor"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===d.paper_color)));
  document.querySelectorAll('[data-x="accent"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===d.accent)));
  document.querySelectorAll('[data-x="font"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===d.font)));
  const sc=$('stkCtl');if(sc)sc.innerHTML=stkCtl();
  const sv=$('saveDesign');if(sv)sv.disabled=!ui.dirty;
  const rm=$('coverRm');if(rm)rm.hidden=!d.cover_url;
}
function stkCtl(){
  const s=ui.dd.stickers[ui.sel];
  if(!s)return `<span>${ui.dd.stickers.length?'Click a sticker on the cover to resize it.':'Pick a sticker above to put it on your cover.'}</span>`;
  return `<span>Selected:</span><button class="btn sm" data-x="stk-size" data-v="-0.2" aria-label="Smaller">−</button><button class="btn sm" data-x="stk-size" data-v="0.2" aria-label="Bigger">+</button><button class="btn sm" data-x="stk-rot" data-v="-15" aria-label="Turn left">↺</button><button class="btn sm" data-x="stk-rot" data-v="15" aria-label="Turn right">↻</button><button class="btn sm danger" data-x="stk-del">Remove</button>`;
}
function profileHtml(){
  const p=S.profile,d=ui.dd;
  const link=`${location.origin}${location.pathname.replace(/[^/]*$/,'')}u.php?u=${p.slug}`;
  const sec1=`<section class="xcard"><h3>Your page</h3><p class="sub">The name and bio people see on your notebook.</p>
    <form class="xform" data-xform="profile" autocomplete="off">
      <label class="l" for="pf-slug">Page name</label><div class="xrow" style="flex-wrap:nowrap"><span class="hint2">@</span><input type="text" id="pf-slug" name="slug" value="${esc(p.slug)}" maxlength="30" pattern="[A-Za-z0-9_]{3,30}" data-draft required></div>
      <label class="l" for="pf-bio">Bio</label><textarea id="pf-bio" name="bio" maxlength="300" style="min-height:70px" data-draft placeholder="A few words about you and your notebook">${esc(p.bio)}</textarea>
      <div class="xrow"><button class="btn primary">Save</button><a class="btn" href="u.php?u=${esc(p.slug)}" target="_blank" rel="noopener">Open my page ↗</a><button type="button" class="btn ghost" data-x="copy-link" data-link="${esc(link)}">Copy link</button></div>
      <p class="hint2">${p.followers} follower${p.followers===1?'':'s'}</p></form></section>`;
  const sec2=`<section class="xcard"><h3>Who can see your notebook</h3><p class="sub">Your planner itself always stays private. Only what you switch on below is ever shown.</p>
    ${sw('Public profile','Listed in People. Anyone with an account can open your notebook and follow you.',p.public,'data-xsw="public"')}
    ${sw('Visible without logging in','Also show it to visitors who have no account. Needs a public profile.',p.guest,'data-xsw="guest"',!p.public)}
    <p class="opt-h" style="margin-top:12px">What to show</p>
    ${SHARE.map(s=>sw(s[1],s[2],p.share[s[0]],`data-xsw="share" data-k="${s[0]}"`)).join('')}</section>`;
  const sec3=`<section class="xcard"><h3>Design your notebook</h3><p class="sub">Pick how your notebook looks. You see it on the right straight away.</p>
    <p class="opt-h">Cover</p><div class="swatches">${Object.keys(COVERS).map(c=>`<button type="button" class="swatch sq" style="background:${COVERS[c]}" data-x="cover" data-v="${c}" aria-label="Cover ${c}" aria-pressed="false"></button>`).join('')}</div>
    <div class="pic-pick" style="margin-top:10px"><label class="btn sm"><input type="file" accept="image/*" data-xfile="cover" data-kind="cover">🖼️ Use my own cover</label><button type="button" class="btn sm ghost" id="coverRm" data-x="cover-rm" ${d.cover_url?'':'hidden'}>Remove my cover</button><span class="hint2" data-pic-msg></span></div>
    <p class="opt-h">Paper</p><div class="pilltabs">${PAPERS.map(x=>`<button type="button" data-x="paper" data-v="${x[0]}" aria-pressed="false">${x[1]}</button>`).join('')}</div>
    <p class="opt-h">Paper colour</p><div class="swatches">${Object.keys(PAPER_COLORS).map(c=>`<button type="button" class="swatch" style="background:${PAPER_COLORS[c]}" data-x="pcolor" data-v="${c}" aria-label="Paper ${c}" aria-pressed="false"></button>`).join('')}</div>
    <p class="opt-h">Accent colour</p><div class="swatches">${Object.keys(ACCENTS).map(c=>`<button type="button" class="swatch" style="background:${ACCENTS[c]}" data-x="accent" data-v="${c}" aria-label="Accent ${c}" aria-pressed="false"></button>`).join('')}</div>
    <p class="opt-h">Writing</p><div class="pilltabs">${FONTS.map(f=>`<button type="button" data-x="font" data-v="${f[0]}" style="${f[2]?`font-family:${f[2]};font-size:15px`:''}" aria-pressed="false">${f[1]}</button>`).join('')}</div>
    <p class="opt-h">Stickers</p>
    <div class="stk-lib">${STICKERS.map(s=>`<button type="button" data-x="stk-add" data-k="${s}" aria-label="Add sticker ${s}">${s}</button>`).join('')}${S.stickers_up.map(u=>`<button type="button" data-x="stk-add" data-k="up:${u.id}" aria-label="Add my sticker"><img src="${esc(u.url)}" alt=""></button>`).join('')}</div>
    <div class="pic-pick" style="margin-top:8px"><label class="btn sm"><input type="file" accept="image/*" data-xfile="sticker" data-kind="sticker">➕ Make a sticker from my picture</label><span class="hint2" data-pic-msg></span></div>
    <div class="stk-bar" id="stkCtl">${stkCtl()}</div>
    <div class="xrow" style="margin-top:16px"><button class="btn primary" id="saveDesign" data-x="design-save" ${ui.dirty?'':'disabled'}>Save design</button><button class="btn ghost" data-x="design-reset">Undo changes</button></div></section>`;
  return hdr('Your notebook','Profile')+`<div class="xcols"><div>${sec1}${sec2}${sec3}</div><div><div class="pv" id="pv">${pvHtml()}</div></div></div>`;
}

/* ---------- ALERTS ---------- */
function alertsHtml(){
  const ic={follow:'👤',like:'♥'};
  const rows=S.notes.map(n=>`<div class="note-row${n.read?'':' new'}"><span class="ic">${ic[n.kind]||'🔔'}</span><div class="tx" translate="no">${esc(n.text)}<small>${esc(n.at.slice(0,16))}</small></div>${n.link?`<a class="btn sm" href="${esc(n.link)}">View</a>`:''}</div>`).join('');
  const prefs=`<section class="xcard" style="margin-top:20px"><h3>Tell me when…</h3><p class="sub">Choose which alerts you get.</p>
    ${sw('Someone follows me','A new follower on your public notebook.',S.profile.notify.follow,'data-xsw="notify" data-k="follow"')}
    ${sw('Someone likes my post','A like on one of your public blog posts.',S.profile.notify.like,'data-xsw="notify" data-k="like"')}</section>`;
  return hdr('Your notebook','Alerts',S.notes.length?'<button class="btn sm" data-x="notes-clear">Clear all</button>':'')+
    (rows||'<p class="empty">No alerts yet. When someone follows you or likes a post, you will see it here.</p>')+prefs;
}

/* ---------- entry point for app.js ---------- */
function html(tab){
  if(!S){
    if(loadErr)return `<p class="empty">Couldn't load this page: ${esc(loadErr)} <button class="linkbtn" data-x="retry">Try again</button></p>`;
    load();return '<p class="empty">Loading…</p>';
  }
  const keep=[...document.querySelectorAll('#view [data-draft]')].map(e=>[e.id,e.value]);
  let out='';
  if(tab==='blog')out=blogHtml();
  else if(tab==='interests')out=interestsHtml();
  else if(tab==='profile')out=profileHtml();
  else out=alertsHtml();
  queueMicrotask(()=>{
    keep.forEach(([id,v])=>{const e=document.getElementById(id);if(e&&!e.value&&!e.dataset.cleared)e.value=v});
    if(tab==='profile'){syncDesignControls()}
    if(tab==='alerts'&&S.unread>0&&!ui.marked){ui.marked=true;setTimeout(()=>{api('x.notes.read').then(()=>{S.unread=0;S.notes.forEach(n=>n.read=true);paintBadges();ui.marked=false}).catch(()=>{ui.marked=false})},1500)}
  });
  return out;
}
window.SPLX={html};

/* ---------- design helpers ---------- */
function markDirty(){ui.dirty=true;const sv=$('saveDesign');if(sv)sv.disabled=false}
function applyDesign(d){
  const r=document.documentElement;
  if(d.accent&&d.accent!=='violet')r.setAttribute('data-accent',d.accent);else r.removeAttribute('data-accent');
  const v=$('view');if(!v)return;
  [['paper','data-paper','lined'],['paper_color','data-pcolor','white'],['font','data-font','modern']].forEach(([k,a,def])=>{if(d[k]&&d[k]!==def)v.setAttribute(a,d[k]);else v.removeAttribute(a)});
}
const designOut=()=>{const d=clone(ui.dd);delete d.cover_url;return d};

/* ---------- clicks ---------- */
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-x]');if(!b)return;
  const a=b.dataset.x,id=+b.dataset.id;
  try{
    switch(a){
      case 'retry':loadErr='';S=null;redraw();return;
      case 'post-new':ui.post={id:0,title:'',body:'',public:false};ui.pics.post=null;redraw('px-title');return;
      case 'post-edit':{const p=S.posts.find(x=>x.id===id);if(!p)return;ui.post={id:p.id,title:p.title,body:p.body,public:p.public};ui.pics.post=p.image?{id:p.image_id,url:p.image}:null;redraw('px-title');return}
      case 'post-cancel':ui.post=null;redraw();return;
      case 'post-vis':{const p=S.posts.find(x=>x.id===id);if(!p)return;p.public=!p.public;redraw();await api('x.post.public',{id,public:p.public});return}
      case 'post-del':{if(!armed(b))return;S.posts=S.posts.filter(x=>x.id!==id);redraw();await api('x.post.delete',{id});return}
      case 'list-new':ui.newList=!ui.newList;redraw(ui.newList?'lx-title':'');return;
      case 'list-quick':{const q=QUICK[+b.dataset.i];const r=await api('x.list.add',{title:q[1],emoji:q[0],layout:q[2]});S.lists.push({id:r.id,title:q[1],emoji:q[0],layout:q[2],public:false,items:[]});redraw('ix-text-'+r.id);return}
      case 'list-del':{if(!armed(b))return;S.lists=S.lists.filter(x=>x.id!==id);redraw();await api('x.list.delete',{id});return}
      case 'list-layout':{const l=S.lists.find(x=>x.id===id);if(!l||l.layout===b.dataset.v)return;l.layout=b.dataset.v;redraw();await api('x.list.update',{id,layout:l.layout});return}
      case 'item-del':{const l=S.lists.find(x=>x.items.some(i=>i.id===id));if(l)l.items=l.items.filter(i=>i.id!==id);redraw();await api('x.item.delete',{id});return}
      case 'pic-rm':ui.pics[b.dataset.key]=null;{const w=b.closest('.pic-pick');if(w)w.innerHTML=picInner(b.dataset.key)}return;
      case 'copy-link':{try{await navigator.clipboard.writeText(b.dataset.link);toast('Link copied.')}catch(err){toast(b.dataset.link)}return}
      case 'notes-clear':await api('x.notes.clear');S.notes=[];S.unread=0;paintBadges();redraw();return;
      // design
      case 'cover':ui.dd.cover=b.dataset.v;ui.dd.cover_img=0;ui.dd.cover_url='';break;
      case 'cover-rm':ui.dd.cover_img=0;ui.dd.cover_url='';break;
      case 'paper':ui.dd.paper=b.dataset.v;break;
      case 'pcolor':ui.dd.paper_color=b.dataset.v;break;
      case 'accent':ui.dd.accent=b.dataset.v;break;
      case 'font':ui.dd.font=b.dataset.v;break;
      case 'stk-add':if(ui.dd.stickers.length>=24){toast('That is plenty of stickers!');return}ui.dd.stickers.push({k:b.dataset.k,x:20+Math.random()*60,y:25+Math.random()*50,s:1,r:0});ui.sel=ui.dd.stickers.length-1;break;
      case 'stk-size':{const s=ui.dd.stickers[ui.sel];if(!s)return;s.s=Math.max(0.5,Math.min(3,Math.round((s.s+ +b.dataset.v)*10)/10));break}
      case 'stk-rot':{const s=ui.dd.stickers[ui.sel];if(!s)return;s.r=Math.max(-180,Math.min(180,s.r+ +b.dataset.v));break}
      case 'stk-del':ui.dd.stickers.splice(ui.sel,1);ui.sel=-1;break;
      case 'design-reset':ui.dd=clone(S.design);ui.dd.cover_url=S.cover_url;ui.dirty=false;ui.sel=-1;refreshPv();return;
      case 'design-save':{
        b.disabled=true;
        const r=await api('x.design.save',{design:designOut()});
        S.design=r.design;S.cover_url=r.cover_url;ui.dd=clone(r.design);ui.dd.cover_url=r.cover_url;ui.dirty=false;
        applyDesign(S.design);refreshPv();toast('Design saved. This is now your notebook.');return}
      default:return;
    }
  }catch(err){toast(err.message);if(S&&a!=='retry')load2()}
  if(['cover','cover-rm','paper','pcolor','accent','font','stk-add','stk-size','stk-rot','stk-del'].includes(a)){markDirty();refreshPv()}
});
function load2(){S=null;loading=false;loadErr='';redraw()}

/* ---------- forms ---------- */
document.addEventListener('submit',async e=>{
  const f=e.target.closest('form[data-xform]');if(!f)return;
  e.preventDefault();if(f.dataset.busy)return;
  const d=Object.fromEntries(new FormData(f));const btn=f.querySelector('button:not([type])');
  f.dataset.busy='1';if(btn)btn.disabled=true;
  const clear=ids=>ids.forEach(i=>{const el=$(i);if(el){el.value='';el.dataset.cleared='1'}});
  try{
    if(f.dataset.xform==='post'){
      const pic=ui.pics.post,pub=f.querySelector('[name=public]').checked;
      const r=await api('x.post.save',{id:ui.post.id,title:d.title,body:d.body,public:pub,image_id:pic?pic.id:0});
      ui.post=null;ui.pics.post=null;
      const x=await api('x.load');S=Object.assign(S,{posts:x.posts});toast(pub?'Published.':'Saved as private.');redraw();
    }else if(f.dataset.xform==='list'){
      const r=await api('x.list.add',{title:d.title,emoji:d.emoji,layout:d.layout});
      S.lists.push({id:r.id,title:d.title.trim(),emoji:d.emoji,layout:d.layout,public:false,items:[]});ui.newList=false;redraw('ix-text-'+r.id);
    }else if(f.dataset.xform==='item'){
      const lid=+f.dataset.id,k='item-'+lid,pic=ui.pics[k];
      const r=await api('x.item.add',{list_id:lid,text:d.text,note:d.note||'',image_id:pic?pic.id:0});
      const l=S.lists.find(x=>x.id===lid);l.items.push({id:r.id,text:d.text.trim(),note:(d.note||'').trim(),image:pic?pic.url:'',image_id:pic?pic.id:0});
      ui.pics[k]=null;clear(['ix-text-'+lid,'ix-note-'+lid]);redraw('ix-text-'+lid);
      document.querySelectorAll('[data-cleared]').forEach(el=>delete el.dataset.cleared);
    }else if(f.dataset.xform==='profile'){
      await api('x.profile.save',{slug:d.slug,bio:d.bio});
      S.profile.slug=d.slug.toLowerCase();S.profile.bio=d.bio.trim();toast('Saved.');redraw();
    }
  }catch(err){toast(err.message)}
  finally{delete f.dataset.busy;if(btn&&btn.isConnected)btn.disabled=false}
});

/* ---------- switches + uploads ---------- */
document.addEventListener('change',async e=>{
  const t=e.target;
  if(t.dataset&&t.dataset.xsw){
    const k=t.dataset.xsw,on=t.checked;
    try{
      if(k==='public'||k==='guest'){
        S.profile[k]=on;if(k==='public'&&!on){S.profile.guest=false}
        const body={public:S.profile.public};if(k==='guest'||!on)body.guest=S.profile.guest;
        if(k==='guest')body.guest=on;
        await api('x.profile.save',body);redraw();
      }else if(k==='share'){S.profile.share[t.dataset.k]=on;await api('x.profile.save',{share:{[t.dataset.k]:on}})}
      else if(k==='notify'){S.profile.notify[t.dataset.k]=on;await api('x.profile.save',{notify:{[t.dataset.k]:on}})}
      else if(k==='list-public'){const l=S.lists.find(x=>x.id===+t.dataset.id);if(l)l.public=on;await api('x.list.update',{id:+t.dataset.id,public:on})}
    }catch(err){t.checked=!on;toast(err.message)}
    return;
  }
  if(t.dataset&&t.dataset.xfile){
    const f=t.files&&t.files[0];t.value='';if(!f)return;
    const key=t.dataset.xfile,kind=t.dataset.kind,wrap=t.closest('.pic-pick'),msg=wrap&&wrap.querySelector('[data-pic-msg]');
    if(msg)msg.textContent='Uploading…';
    try{
      const r=await upload(f,kind);
      if(kind==='photo'){ui.pics[key]={id:r.id,url:r.url};if(wrap)wrap.innerHTML=picInner(key)}
      else if(kind==='cover'){ui.dd.cover_img=r.id;ui.dd.cover_url=r.url;markDirty();refreshPv();if(msg)msg.textContent=''}
      else{S.stickers_up.unshift({id:r.id,url:r.url});ui.dd.stickers.push({k:'up:'+r.id,x:50,y:50,s:1,r:0});ui.sel=ui.dd.stickers.length-1;markDirty();redraw()}
    }catch(err){if(msg)msg.textContent='';toast(err.message)}
  }
});

/* ---------- dragging stickers on the preview cover ---------- */
let drag=null;
document.addEventListener('pointerdown',e=>{
  const s=e.target.closest('#pvBanner .stk');if(!s||!ui.dd)return;
  const i=+s.dataset.i;ui.sel=i;
  const box=s.parentElement.getBoundingClientRect();
  drag={i,box,el:s};s.setPointerCapture&&s.setPointerCapture(e.pointerId);e.preventDefault();
  document.querySelectorAll('#pvBanner .stk').forEach(x=>x.classList.toggle('sel',+x.dataset.i===i));
  const c=$('stkCtl');if(c)c.innerHTML=stkCtl();
});
document.addEventListener('pointermove',e=>{
  if(!drag)return;
  const s=ui.dd.stickers[drag.i];if(!s)return;
  s.x=Math.max(0,Math.min(100,Math.round((e.clientX-drag.box.left)/drag.box.width*1000)/10));
  s.y=Math.max(0,Math.min(100,Math.round((e.clientY-drag.box.top)/drag.box.height*1000)/10));
  drag.el.style.setProperty('--x',s.x+'%');drag.el.style.setProperty('--y',s.y+'%');
});
const endDrag=()=>{if(drag){drag=null;markDirty()}};
document.addEventListener('pointerup',endDrag);document.addEventListener('pointercancel',endDrag);

// Apply the saved look to the planner right away (the server also sets it before the page draws)
})();
