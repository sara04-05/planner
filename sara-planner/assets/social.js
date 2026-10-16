/* The sharing side of the planner: the Profile tab (your notebooks: pages, blog, interests, design, stickers) and Alerts.
   app.js asks window.SPLX.html(tab) for each tab's HTML; everything here talks to api.php (x.* actions) and upload.php.
   A profile is just your notebooks. Each notebook picks its pages, has its own look and stickers, and holds its own blog posts and interest lists. */
(function(){
const CSRF=(document.querySelector('meta[name="csrf-token"]')||{}).content||'';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const hdr=(eyebrow,title,right='')=>`<div class="vh"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div><div class="nav">${right}</div></div>`;

const COVERS={dusk:['#6A4DC4','#E0609A'],peach:['#F9A826','#F36B7F'],ocean:['#1F77C9','#3FC1C9'],mint:['#4FA36B','#B6E3C9'],berry:['#8E2DE2','#C2185B'],sunny:['#FFD452','#FF9966'],night:['#1B1740','#4B3A8F'],cloud:['#BFD7F5','#E8DDF8']};
const PAPER_COLORS={white:'#FFFFFF',cream:'#FFF8E8',blush:'#FFF0F3',mint:'#EEF9F2',sky:'#EEF5FD',lilac:'#F4EFFC'};
const ACCENTS={violet:'#6A4DC4',rose:'#C93A72',ocean:'#1F77C9',forest:'#2B8A5B',sunset:'#D2661E',graphite:'#4A4F5C'};
const PAPERS=[['lined','Lined'],['grid','Grid'],['dots','Dots'],['plain','Plain']];
const FONTS=[['modern','Modern',''],['hand','Handwritten','Caveat,cursive'],['serif','Classic','Lora,Georgia,serif'],['mono','Typewriter','ui-monospace,Menlo,monospace']];
const BINDINGS=[['coil','Spiral'],['stitch','Stitched'],['none','Plain edge']];
const STICKERS=['⭐','💜','🌸','🎀','🦋','☁️','🌙','✨','🍓','🎧','📚','☕','🐱','🌈','🔥','🍒','🎬','🎵','👗','👠','🧸','🌷','🍀','💌','📌','✏️','🎨','🪩','💫','🍑','🌻','🧿'];
const LIST_EMOJI=['🎬','🎤','👗','📚','🍕','🎮','🎧','✈️','🐾','💄','🎨','⭐'];
const QUICK=[['🎬','Favourite movies','list'],['🎤','Favourite singers','list'],['👗','My clothes and style','grid'],['📚','Books I love','list'],['🍕','Favourite food','list'],['✈️','Places I want to visit','list']];
const SECS=[['interests','⭐','Interests','Lists of things you love, with pictures.'],['blog','✍️','Blog','Posts you write.'],['timetable','🗓️','Timetable','Your repeating weekly hours (the ↻ ones).'],['subjects','📚','Studying','Subject names and how far you are, never your notes.']];
const SECNAME=Object.fromEntries([['cover','Cover']].concat(SECS.map(s=>[s[0],s[2]])));
const BASE={cover:'dusk',cover_img:0,cover_c1:'',cover_c2:'',paper:'lined',paper_color:'white',paper_hex:'',accent:'violet',accent_hex:'',font:'modern',binding:'coil'};
// ready-made looks (the user can also save their own)
const PRESETS=[
  ['Dreamy lilac',{cover:'dusk',paper:'dots',paper_color:'lilac',accent:'violet',font:'hand'}],
  ['Cozy cream',{cover:'peach',paper:'lined',paper_color:'cream',accent:'sunset',font:'serif',binding:'stitch'}],
  ['Midnight',{cover:'night',paper:'dots',paper_color:'custom',paper_hex:'#1f1b2e',accent:'custom',accent_hex:'#a98ff6'}],
  ['Cherry blossom',{cover:'berry',paper:'plain',paper_color:'blush',accent:'rose',font:'hand'}],
  ['Mint garden',{cover:'mint',paper:'grid',paper_color:'mint',accent:'forest'}],
  ['Clean graphite',{cover:'cloud',paper:'grid',paper_color:'white',accent:'graphite',font:'mono',binding:'none'}],
];
const SHARE_MSG='Only what you mark public ever shows.';

let S=null,loading=false,loadErr='';
const ui={ptab:'notebooks',aud:'friend',nb:0,pg:'cover',panel:'',dd:null,dirty:false,sel:-1,post:null,pics:{},newList:false,newNb:false,marked:false};

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
const mediaUrl=id=>id?'media.php?id='+id:'';

function load(){
  if(loading)return;loading=true;loadErr='';
  api('x.load').then(d=>{S=d;loading=false;pick(ui.nb&&S.notebooks.some(n=>n.id===ui.nb)?ui.nb:(S.notebooks[0]?S.notebooks[0].id:0),true);paintBadges();redraw()})
    .catch(e=>{loading=false;loadErr=e.message;redraw()});
}
function paintBadges(){
  const n=S?S.unread:0;
  const b=$('bellBadge');if(b){b.textContent=n;b.hidden=!n}
}
const cur=()=>S&&S.notebooks.find(n=>n.id===ui.nb)||null;
/** Open a notebook in the editor (its saved design becomes the draft you edit). */
function pick(id,keepPage){
  ui.nb=id;const nb=cur();
  ui.dd=nb?Object.assign(clone(BASE),clone(nb.design)):null;
  if(ui.dd){ui.dd.cover_url=nb.cover_url;ui.dd.stickers=ui.dd.stickers||[]}
  ui.dirty=false;ui.sel=-1;ui.post=null;ui.newList=false;
  if(!keepPage||!nb||(ui.pg!=='cover'&&!nb.sections.includes(ui.pg)))ui.pg='cover';
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

/* ---------- design: how a draft turns into attributes, colours and a cover ---------- */
const lum=hex=>{const c=[1,3,5].map(i=>{const v=parseInt(hex.slice(i,i+2),16)/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
function wrapAttrs(d){   // goes on the notebook wrapper: accent colour + the colours the user picked
  let a='',v='';
  if(d.accent&&d.accent!=='violet')a+=` data-accent="${d.accent}"`;
  if(d.accent==='custom'&&d.accent_hex)v+=`--c-accent:${d.accent_hex};--c-on:${lum(d.accent_hex)>.55?'#17121F':'#FFFFFF'};`;
  if(d.paper_color==='custom'&&d.paper_hex)v+=`--c-paper:${d.paper_hex};`;
  return a+(v?` style="${v}"`:'');
}
function pageAttrs(d){
  let a='';
  if(d.paper&&d.paper!=='lined')a+=` data-paper="${d.paper}"`;
  if(d.paper_color&&d.paper_color!=='white')a+=` data-pcolor="${d.paper_color}"`;
  if(d.font&&d.font!=='modern')a+=` data-font="${d.font}"`;
  if(d.paper_color==='custom'&&d.paper_hex&&lum(d.paper_hex)<.4)a+=' data-ptone="dark"';
  return a;
}
function coverCss(d){
  if(d.cover_url)return `background:url('${esc(d.cover_url)}') center/cover`;
  if(d.cover==='custom'&&d.cover_c1&&d.cover_c2)return `background:linear-gradient(135deg,${d.cover_c1},${d.cover_c2})`;
  const g=COVERS[d.cover]||COVERS.dusk;return `background:linear-gradient(135deg,${g[0]},${g[1]})`;
}
const stkImg=id=>{const u=S.stickers_up.find(s=>s.id===id);return u?u.url:mediaUrl(id)};
function stkLayer(d,pg){
  return `<div class="stk-layer" id="stkLayer">`+d.stickers.map((s,i)=>{
    if((s.p||'cover')!==pg)return '';
    const css=`--x:${s.x}%;--y:${s.y}%;--s:${s.s};--r:${s.r}deg`,cls='stk'+(i===ui.sel?' sel':'');
    if(String(s.k).startsWith('up:'))return `<img class="${cls}" data-i="${i}" alt="" src="${esc(stkImg(+s.k.slice(3)))}" style="${css}" draggable="false">`;
    return `<span class="${cls}" data-i="${i}" style="${css}">${esc(s.k)}</span>`;
  }).join('')+`</div>`;
}

/* ---------- pages of a notebook (what you edit) ---------- */
function postForm(){
  const f=ui.post;if(!f)return '';
  return `<form class="xcard xform" data-xform="post" autocomplete="off" style="margin-bottom:16px">
    <h3>${f.id?'Edit post':'New post'}</h3>
    <label class="l" for="px-title">Title</label><input type="text" id="px-title" name="title" maxlength="150" value="${esc(f.title)}" data-draft required>
    <label class="l" for="px-body">Write something</label><textarea id="px-body" name="body" maxlength="20000" data-draft required placeholder="What's on your mind today?">${esc(f.body)}</textarea>
    ${picPick('post')}
    ${miniSw('Show this post when the notebook is shared',f.public,'name="public"')}
    <div class="xrow"><button class="btn primary">${f.id?'Save changes':'Publish post'}</button><button type="button" class="btn ghost" data-x="post-cancel">Cancel</button></div>
  </form>`;
}
function blogPage(){
  const posts=S.posts.filter(p=>p.nb===ui.nb).map(p=>`<article class="post">
    ${p.image?`<img class="pimg" src="${esc(p.image)}" alt="">`:''}
    <div class="pb"><h3 translate="no">${esc(p.title)}</h3>
      <div class="meta2"><span>${esc(p.date)}</span><span class="tag2 ${p.public?'':'priv'}">${p.public?'Public':'Only me'}</span><span>♥ ${p.likes}</span></div>
      <div class="txt" translate="no">${esc(p.body)}</div>
      <div class="acts"><button class="btn sm" data-x="post-edit" data-id="${p.id}">Edit</button>
        <button class="btn sm" data-x="post-vis" data-id="${p.id}">${p.public?'Make private':'Make public'}</button>
        <button class="btn sm danger" data-x="post-del" data-id="${p.id}">Delete</button></div></div></article>`).join('');
  return `<div class="xrow sp" style="margin-bottom:14px">${ui.post?'<span></span>':'<button class="btn primary" data-x="post-new">+ New post</button>'}<span class="hint2">${SHARE_MSG}</span></div>`+
    postForm()+(posts||(ui.post?'':'<p class="empty">No posts yet. Write about your day, a book you finished, a trip — whatever you like. Each post can be private or public.</p>'));
}
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
function interestsPage(){
  const quick=QUICK.map((q,i)=>`<button class="chipbtn" data-x="list-quick" data-i="${i}">${q[0]} ${q[1]}</button>`).join('')+`<button class="chipbtn${ui.newList?' on':''}" data-x="list-new">+ My own list</button>`;
  const form=ui.newList?`<form class="xcard xform" data-xform="list" autocomplete="off" style="margin-bottom:16px"><h3>New list</h3>
      <label class="l" for="lx-title">Name</label><input type="text" id="lx-title" name="title" maxlength="80" placeholder="e.g. Perfumes I want" data-draft required>
      <label class="l" for="lx-emoji">Icon</label><select id="lx-emoji" name="emoji">${LIST_EMOJI.map(e=>`<option>${e}</option>`).join('')}</select>
      <label class="l" for="lx-layout">Show it as</label><select id="lx-layout" name="layout"><option value="list">A list</option><option value="grid">A grid of pictures</option></select>
      <div class="xrow"><button class="btn primary">Create list</button><button type="button" class="btn ghost" data-x="list-new">Cancel</button></div></form>`:'';
  const lists=S.lists.filter(l=>l.nb===ui.nb);
  return '<p class="hint2" style="margin:-6px 0 12px;font-size:13px">Lists of the things you love: movies, singers, fashion, anything. Add pictures of your clothes or favourites. Each list is private until you switch it to public.</p>'+
    `<div class="quick">${quick}</div>${form}`+
    (lists.length?`<div class="ilists">${lists.map(listCard).join('')}</div>`:'<p class="empty">No lists yet. Pick one of the ideas above to start.</p>');
}
const WD=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function timetablePage(){
  const t=S.timetable||{},any=Object.keys(t).length;
  return `<p class="hint2" style="margin:-6px 0 12px;font-size:13px">This page shows your repeating weekly hours from the Week tab. Change them there.</p>`+
    (any?`<div style="overflow:auto"><table class="tt"><thead><tr>${WD.map(w=>`<th>${w}</th>`).join('')}</tr></thead><tbody><tr>${WD.map((w,i)=>`<td translate="no">${(t[i]||[]).map(esc).join('<br>')}</td>`).join('')}</tr></tbody></table></div>`:'<p class="empty">No weekly plan yet. Add repeating hours (↻) in the Week tab.</p>');
}
function subjectsPage(){
  const s=S.subjects||[];
  return `<p class="hint2" style="margin:-6px 0 12px;font-size:13px">Shows each subject and how far you are. Never your notes.</p>`+
    (s.length?`<div class="xcard">${s.map(x=>`<div class="subj-row"><b style="min-width:120px" translate="no">${esc(x.name)}</b><div class="bar"><i style="width:${x.pct}%"></i></div><span class="hint2">${x.pct}% of ${x.n} chapter${x.n===1?'':'s'}</span></div>`).join('')}</div>`:'<p class="empty">No subjects yet. Add them in the Study tab.</p>');
}
function coverPage(nb,d){
  const name=(document.querySelector('.hello span:last-child')||{textContent:'You'}).textContent.replace(/^Hi,\s*/,'');
  return `<div class="nbcover" id="pvCover" style="${coverCss(d)}"><div class="nbcover-in"><span class="avatar xl letter" aria-hidden="true">${esc((name[0]||'S').toUpperCase())}</span><h2 translate="no">${esc(nb.title)}</h2><p class="by" translate="no">by ${esc(name)} · @${esc(S.profile.slug)}</p></div></div>`+
    (nb.intro?`<p class="nb-intro" translate="no">${esc(nb.intro)}</p>`:'<p class="hint2" style="margin-top:12px">Add a few words about this notebook in <b>Settings</b>.</p>')+
    (nb.sections.length?'':'<p class="hint2">This notebook has no pages yet. Add some in <b>Settings</b>.</p>');
}

/* ---------- the notebook itself (cover, pages as side tabs, stickers inside) ---------- */
function notebookHtml(nb){
  const d=ui.dd,tabs=['cover'].concat(nb.sections);
  const body=ui.pg==='cover'?coverPage(nb,d):ui.pg==='blog'?blogPage():ui.pg==='interests'?interestsPage():ui.pg==='timetable'?timetablePage():subjectsPage();
  return `<div class="nbv${ui.panel==='deco'?' deco':''}" id="nbv"${wrapAttrs(d)}>
    <div class="binder" id="nbBinder"${d.binding&&d.binding!=='coil'?` data-binding="${d.binding}"`:''}>
      <div class="coil" aria-hidden="true">${'<span></span>'.repeat(70)}</div>
      <div class="page" id="nbPage"${pageAttrs(d)}>
        <div class="vh"><div><p class="eyebrow">${esc(nb.title)}</p><h1>${esc(SECNAME[ui.pg])}</h1></div></div>
        ${body}${stkLayer(d,ui.pg)}
      </div>
      <nav class="tabs" role="tablist">${tabs.map(k=>`<button class="tab" role="tab" data-x="pg" data-v="${k}" data-tab="${k}" aria-selected="${k===ui.pg}">${SECNAME[k]}</button>`).join('')}</nav>
    </div></div>`;
}

/* ---------- panels: settings + decorate ---------- */
function settingsPanel(nb){
  return `<section class="xcard"><h3>Notebook settings</h3><p class="sub">The name, intro and pages of this notebook.</p>
    <form class="xform" data-xform="nb" autocomplete="off">
      <label class="l" for="nb-title">Name</label><input type="text" id="nb-title" name="title" maxlength="80" value="${esc(nb.title)}" required>
      <label class="l" for="nb-intro">Intro on the cover</label><textarea id="nb-intro" name="intro" maxlength="300" style="min-height:70px" placeholder="What is this notebook about?">${esc(nb.intro)}</textarea>
      <p class="opt-h">Pages</p>
      <div class="secpick">${SECS.map(s=>`<label><input type="checkbox" name="sections" value="${s[0]}" ${nb.sections.includes(s[0])?'checked':''}><span><b>${s[1]} ${s[2]}</b><small>${s[3]}</small></span></label>`).join('')}</div>
      <div class="xrow"><button class="btn primary">Save</button></div></form>
    <div style="margin-top:10px">${sw('Show this notebook on my profile','People who may open your profile can read it. Items you keep private stay hidden.',nb.public,`data-xsw="nb-public"`)}</div>
    ${S.profile.public?'':'<p class="hint2">Your profile itself is private right now. Turn on <b>Public profile</b> in <b>Edit profile &amp; settings</b> for others to see your shared notebooks.</p>'}
    <div class="xrow" style="margin-top:12px"><button class="btn danger sm" data-x="nb-del">Delete this notebook</button><span class="hint2">Also deletes its posts and lists.</span></div></section>`;
}
const swatch=(act,v,bg,label)=>`<button type="button" class="swatch${act==='cover'?' sq':''}" style="background:${bg}" data-x="${act}" data-v="${v}" aria-label="${label}" aria-pressed="false"></button>`;
function decoPanel(nb){
  const d=ui.dd;
  const styles=S.styles.map(s=>`<div class="row"><button class="btn sm apply" data-x="style-apply" data-id="${s.id}">🎨 ${esc(s.name)}</button><button class="btn sm ghost" data-x="style-del" data-id="${s.id}" aria-label="Delete style ${esc(s.name)}">×</button></div>`).join('');
  return `<section class="xcard xdesign"><h3>Decorate this notebook</h3><p class="sub">Pick a look, make your own colours, and put stickers on its pages. You see it on the left straight away.</p>
    <p class="opt-h">Ready-made looks</p><div class="quick">${PRESETS.map((p,i)=>`<button class="chipbtn" data-x="preset" data-i="${i}">${p[0]}</button>`).join('')}</div>
    <p class="opt-h">My styles</p><div class="stylelist">${styles||'<span class="hint2">Styles you save show up here, ready to use on any notebook.</span>'}</div>
    <form class="xrow" data-xform="style" style="margin-top:8px" autocomplete="off"><input type="text" name="name" maxlength="60" placeholder="Name this look" aria-label="Style name" required style="flex:1;min-width:0"><button class="btn sm">Save as my style</button></form>
    <p class="opt-h">Cover</p><div class="swatches">${Object.keys(COVERS).map(c=>swatch('cover',c,`linear-gradient(135deg,${COVERS[c][0]},${COVERS[c][1]})`,'Cover '+c)).join('')}</div>
    <div class="colorrow"><span>Your own colours</span><input type="color" data-xcolor="cover_c1" value="${d.cover_c1||'#6a4dc4'}" aria-label="Cover colour 1"><input type="color" data-xcolor="cover_c2" value="${d.cover_c2||'#e0609a'}" aria-label="Cover colour 2"></div>
    <div class="pic-pick" style="margin-top:10px"><label class="btn sm"><input type="file" accept="image/*" data-xfile="cover" data-kind="cover">🖼️ Use my own cover picture</label><button type="button" class="btn sm ghost" id="coverRm" data-x="cover-rm" ${d.cover_url?'':'hidden'}>Remove my picture</button><span class="hint2" data-pic-msg></span></div>
    <p class="opt-h">Paper</p><div class="pilltabs">${PAPERS.map(x=>`<button type="button" data-x="paper" data-v="${x[0]}" aria-pressed="false">${x[1]}</button>`).join('')}</div>
    <p class="opt-h">Paper colour</p><div class="swatches">${Object.keys(PAPER_COLORS).map(c=>swatch('pcolor',c,PAPER_COLORS[c],'Paper '+c)).join('')}<input type="color" class="colorpick" data-xcolor="paper_hex" value="${d.paper_hex||'#ffffff'}" aria-label="Your own paper colour"></div>
    <p class="opt-h">Accent colour</p><div class="swatches">${Object.keys(ACCENTS).map(c=>swatch('accent',c,ACCENTS[c],'Accent '+c)).join('')}<input type="color" class="colorpick" data-xcolor="accent_hex" value="${d.accent_hex||'#6a4dc4'}" aria-label="Your own accent colour"></div>
    <p class="opt-h">Writing</p><div class="pilltabs">${FONTS.map(f=>`<button type="button" data-x="font" data-v="${f[0]}" style="${f[2]?`font-family:${f[2]};font-size:15px`:''}" aria-pressed="false">${f[1]}</button>`).join('')}</div>
    <p class="opt-h">Binding</p><div class="pilltabs">${BINDINGS.map(b=>`<button type="button" data-x="binding" data-v="${b[0]}" aria-pressed="false">${b[1]}</button>`).join('')}</div>
    <p class="opt-h">Stickers on the page “<span id="stkPg">${esc(SECNAME[ui.pg])}</span>”</p>
    <div class="stk-lib">${STICKERS.map(s=>`<button type="button" data-x="stk-add" data-k="${s}" aria-label="Add sticker ${s}">${s}</button>`).join('')}${S.stickers_up.map(u=>`<button type="button" data-x="stk-add" data-k="up:${u.id}" aria-label="Add my sticker"><img src="${esc(u.url)}" alt=""></button>`).join('')}</div>
    <div class="pic-pick" style="margin-top:8px"><label class="btn sm"><input type="file" accept="image/*" data-xfile="sticker" data-kind="sticker">➕ Make a sticker from my picture</label><span class="hint2" data-pic-msg></span></div>
    <div class="stk-bar" id="stkCtl">${stkCtl()}</div>
    <p class="hint2" style="margin-top:6px">Stickers go on the page you have open. Use the tabs on the right of the notebook to move between pages, and drag a sticker to place it.</p>
    <div class="xrow" style="margin-top:16px"><button class="btn primary" id="saveDesign" data-x="design-save" ${ui.dirty?'':'disabled'}>Save design</button><button class="btn ghost" data-x="design-reset">Undo changes</button><button class="btn sm" data-x="use-planner" title="Use this paper, colours and writing for your planner too">Use for my planner</button></div></section>`;
}
function stkCtl(){
  const s=ui.dd&&ui.dd.stickers[ui.sel];
  const here=ui.dd?ui.dd.stickers.filter(x=>(x.p||'cover')===ui.pg).length:0;
  if(!s)return `<span>${here?'Click a sticker on the page to resize it.':'Pick a sticker above to put it on this page.'}</span>`;
  return `<span>Selected:</span><button class="btn sm" data-x="stk-size" data-v="-0.2" aria-label="Smaller">−</button><button class="btn sm" data-x="stk-size" data-v="0.2" aria-label="Bigger">+</button><button class="btn sm" data-x="stk-rot" data-v="-15" aria-label="Turn left">↺</button><button class="btn sm" data-x="stk-rot" data-v="15" aria-label="Turn right">↻</button><button class="btn sm danger" data-x="stk-del">Remove</button>`;
}
/** Update the live notebook and the controls without redrawing the panel (so a colour picker stays open). */
function paintPreview(){
  const d=ui.dd,w=$('nbv'),pg=$('nbPage'),bd=$('nbBinder');if(!w||!d)return;
  [...w.attributes].forEach(a=>{if(a.name==='data-accent'||a.name==='style')w.removeAttribute(a.name)});
  const t=document.createElement('div');t.innerHTML=`<i${wrapAttrs(d)}></i>`;[...t.firstChild.attributes].forEach(a=>w.setAttribute(a.name,a.value));
  ['data-paper','data-pcolor','data-font','data-ptone'].forEach(a=>pg.removeAttribute(a));
  const p=document.createElement('div');p.innerHTML=`<i${pageAttrs(d)}></i>`;[...p.firstChild.attributes].forEach(a=>pg.setAttribute(a.name,a.value));
  if(d.binding&&d.binding!=='coil')bd.setAttribute('data-binding',d.binding);else bd.removeAttribute('data-binding');
  const cv=$('pvCover');if(cv)cv.style.cssText=coverCss(d).replace(/&#39;/g,"'");
  const sl=$('stkLayer');if(sl)sl.outerHTML=stkLayer(d,ui.pg);
  syncControls();
}
function syncControls(){
  const d=ui.dd;if(!d)return;
  const on=(sel,fn)=>document.querySelectorAll(sel).forEach(b=>b.setAttribute('aria-pressed',String(fn(b))));
  on('[data-x="cover"]',b=>!d.cover_url&&b.dataset.v===d.cover);
  on('[data-x="paper"]',b=>b.dataset.v===d.paper);
  on('[data-x="pcolor"]',b=>b.dataset.v===d.paper_color);
  on('[data-x="accent"]',b=>b.dataset.v===d.accent);
  on('[data-x="font"]',b=>b.dataset.v===d.font);
  on('[data-x="binding"]',b=>b.dataset.v===(d.binding||'coil'));
  const sc=$('stkCtl');if(sc)sc.innerHTML=stkCtl();
  const sv=$('saveDesign');if(sv)sv.disabled=!ui.dirty;
  const rm=$('coverRm');if(rm)rm.hidden=!d.cover_url;
}

/* ---------- PROFILE: like an Instagram profile (header, stats, tabs). Editing lives in profile.php; "What others see" shows everything public ---------- */
const hm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const avatarHtml=(p,cls='xl')=>p.avatar?`<img class="avatar ${cls}" src="${esc(p.avatar)}" alt="">`:`<span class="avatar ${cls} letter" aria-hidden="true">${esc(((p.name||'S')[0]||'S').toUpperCase())}</span>`;
const AUD=[['visitor','🌐','Visitor','Someone with no account'],['user','👤','Signed-in person','Someone with an account, not a friend'],['friend','🤝','Friend','Someone you accepted']];
const PTABS=[['notebooks','📓','Notebooks'],['posts','🖼️','Posts'],['friends','👥','Friends'],['preview','👁️','What others see']];

function profileHead(){
  const p=S.profile,likes=S.posts.reduce((n,x)=>n+x.likes,0);
  const link=`${location.origin}${location.pathname.replace(/[^/]*$/,'')}u.php?u=${p.slug}`;
  const stat=(n,l,t)=>`<button class="pstat" data-x="ptab" data-v="${t}"><b>${n}</b><span>${l}</span></button>`;
  return `<header class="phead">
    <div class="phead-av">${avatarHtml(p)}</div>
    <div class="phead-main">
      <div class="phead-top"><h2 translate="no">@${esc(p.slug)}</h2><span class="tag2 ${p.public?'':'priv'}">${p.public?'Public':'Private'}</span></div>
      <div class="pstats">${stat(S.notebooks.length,S.notebooks.length===1?'notebook':'notebooks','notebooks')}${stat(S.posts.length,S.posts.length===1?'post':'posts','posts')}${stat(p.friends,p.friends===1?'friend':'friends','friends')}<span class="pstat"><b>${likes}</b><span>likes</span></span></div>
      <p class="pname2" translate="no">${esc(p.name)}</p>
      ${p.bio?`<p class="pbio2" translate="no">${esc(p.bio)}</p>`:'<p class="hint2">No bio yet. Add one in Edit profile.</p>'}
    </div>
    <div class="phead-btns"><a class="btn primary" href="profile.php">✎ Edit profile &amp; settings</a><button class="btn" data-x="ptab" data-v="preview">👁️ See what others see</button><button type="button" class="btn ghost" data-x="copy-link" data-link="${esc(link)}">Copy link</button></div>
  </header>
  <nav class="ptabs" role="tablist">${PTABS.map(t=>`<button role="tab" data-x="ptab" data-v="${t[0]}" aria-selected="${ui.ptab===t[0]}">${t[1]} ${t[2]}</button>`).join('')}</nav>`;
}
function notebooksTab(){
  const nb=cur();
  const tiles=`<div class="nbtiles">${S.notebooks.map(n=>`<button class="nbtile${nb&&n.id===nb.id?' on':''}" data-x="nb-pick" data-id="${n.id}"${n.design.accent&&n.design.accent!=='violet'?` data-accent="${n.design.accent}"`:''}><i style="${coverCss({...n.design,cover_url:n.cover_url})}"></i><span translate="no">${esc(n.title)}</span><small>${n.public?'🌍 Shown':'🔒 Private'}</small></button>`).join('')}<button class="nbtile add${ui.newNb?' on':''}" data-x="nb-new"><b>+</b><span>New notebook</span></button></div>`;
  const secs=SECS.map((s,i)=>`<label><input type="checkbox" name="sections" value="${s[0]}" ${i<2?'checked':''}><span><b>${s[1]} ${s[2]}</b><small>${s[3]}</small></span></label>`).join('');
  const newForm=ui.newNb?`<form class="xcard xform" data-xform="nbnew" autocomplete="off" style="margin:12px 0"><h3>New notebook</h3><p class="sub">One for your interests, one for your plans, one for your blog… make as many as you like.</p>
      <label class="l" for="nn-title">Name</label><input type="text" id="nn-title" name="title" maxlength="80" placeholder="e.g. Things I love" required>
      <p class="opt-h">Pages</p><div class="secpick">${secs}</div>
      <label class="l" for="nn-look">Look</label><select id="nn-look" name="look"><option value="">Plain to start (you can decorate it next)</option>${PRESETS.map((x,i)=>`<option value="${i}">${x[0]}</option>`).join('')}</select>
      <div class="xrow"><button class="btn primary">Create notebook</button><button type="button" class="btn ghost" data-x="nb-new">Cancel</button></div></form>`:'';
  let editor='';
  if(nb){
    const open=ui.panel?' panel-open':'';
    editor=`<div class="nbe-bar"><button class="btn${ui.panel==='settings'?' on':''}" data-x="panel" data-v="settings">⚙️ Settings</button><button class="btn${ui.panel==='deco'?' on':''}" data-x="panel" data-v="deco">🎨 Decorate</button><a class="btn" href="u.php?u=${esc(S.profile.slug)}&amp;nb=${nb.id}" target="_blank" rel="noopener">👁️ Open as a visitor ↗</a><span class="hint2">${nb.public?'Shown on your profile':'Private: only you can see it'}</span></div>
      <div class="nbe${open}"><div>${notebookHtml(nb)}</div>${ui.panel?`<div class="nbe-side">${ui.panel==='settings'?settingsPanel(nb):decoPanel(nb)}</div>`:''}</div>`;
  }else editor='<p class="empty">You have no notebooks yet. Press <b>+ New notebook</b> to make your first one.</p>';
  return tiles+newForm+editor;
}
function postsTab(){
  if(!S.posts.length)return '<p class="empty">No posts yet. Open a notebook with a Blog page and press <b>+ New post</b>.</p>';
  const nbName=id=>(S.notebooks.find(n=>n.id===id)||{title:''}).title;
  return `<div class="pgrid">${S.posts.map(p=>`<button class="ptile" data-x="post-open" data-id="${p.id}">${p.image?`<img src="${esc(p.image)}" alt="" loading="lazy">`:`<span class="ptxt" translate="no"><b>${esc(p.title)}</b>${esc(p.body.slice(0,120))}</span>`}<span class="pov"><span>♥ ${p.likes}</span><span>${p.public?'🌍':'🔒'}</span></span><small translate="no">${esc(nbName(p.nb))}</small></button>`).join('')}</div>`;
}
function friendsTab(){
  const f=S.friends||[];
  if(!f.length)return '<p class="empty">No friends yet. Find people in <a href="explore.php">Explore</a> and send a friend request.</p>';
  return `<ul class="userlist">${f.map(x=>`<li><a class="ulink" href="friend.php?id=${x.id}">${avatarHtml(x,'')}<span class="un" translate="no">${esc(x.name)}</span></a></li>`).join('')}</ul>`;
}
/** Everything one kind of person can see, with a switch next to each thing so you decide what to show. */
function previewTab(){
  const p=S.profile,aud=ui.aud;
  const canOpen=aud==='friend'||(p.public&&(aud==='user'||p.guest));
  const row=(label,sub,on,sw,seen)=>`<div class="vrow${seen?'':' off'}"><span class="vdot" aria-hidden="true">${seen?'👁️':'🚫'}</span><span class="vt"><b>${label}</b><small>${sub}</small></span>${sw}</div>`;
  const tog=(on,attr,dis)=>`<label class="sw-mini"><input type="checkbox" ${on?'checked':''} ${dis?'disabled':''} ${attr}><span class="tg"></span></label>`;
  const seg=`<div class="pilltabs aud">${AUD.map(a=>`<button type="button" data-x="aud" data-v="${a[0]}" aria-pressed="${aud===a[0]}">${a[1]} ${a[2]}</button>`).join('')}</div><p class="hint2">${AUD.find(a=>a[0]===aud)[3]}. Switch the toggles to decide what they get to see.</p>`;
  let out=`<section class="xcard"><h3>Who can open my profile</h3>${seg}
    ${row('My profile page',canOpen?'They can open it, see your name, bio'+(aud==='visitor'?'':' and picture')+'.':aud==='visitor'?(p.public?'Visitors without an account are blocked.':'Your profile is private.'):'Your profile is private, they only see your name, picture and bio.',p.public,tog(p.public,'data-xsw="public"'),canOpen)}
    ${row('Visitors without an account',p.guest&&p.public?'Anyone with the link can look.':'Only people who log in can look.',p.guest,tog(p.guest,'data-xsw="guest"',!p.public),aud==='visitor'?p.public&&p.guest:true)}
    <p class="hint2" style="margin-top:6px">Friends can always open your shared notebooks, even if your profile is private.</p></section>`;
  // my day: friends only
  const dayOn=aud==='friend'&&p.day;
  out+=`<section class="xcard"><h3>My day (today)</h3>
    ${row('Hour-by-hour plan for today',aud==='friend'?(p.day?'Your friends see this. Nothing else of your planner.':'Hidden. Friends see "keeps their day private".'):'Only friends can ever see this. Nobody else.',p.day,tog(p.day,'data-xsw="day"'),dayOn)}
    ${dayOn?dayList():''}${aud==='friend'?`<p class="hint2"><a href="friend.php?id=${S.me_id||''}">Open the full friend view ↗</a></p>`:''}</section>`;
  // notebooks
  out+=`<section class="xcard"><h3>Notebooks</h3>`+(S.notebooks.length?S.notebooks.map(n=>{
    const seen=canOpen&&n.public;
    const pg=seen?previewPages(n):'';
    return `<div class="vnb">${row(`<span translate="no">${esc(n.title)}</span>`,n.public?`Shown to people who can open your profile`:'Private, only you',n.public,tog(n.public,'data-xsw="nb-public" data-id="'+n.id+'"'),seen)}${pg}</div>`;
  }).join(''):'<p class="hint2">No notebooks yet.</p>')+`</section>`;
  out+=`<p class="xrow"><a class="btn primary" href="u.php?u=${esc(p.slug)}" target="_blank" rel="noopener">Open my real profile as it looks to others ↗</a></p>`;
  return out;
}
function dayList(){
  const pl=S.plan||{items:[]};
  return pl.items.length?`<ol class="nb-plan vday">${pl.items.map(e=>`<li class="${pl.now>=e.from&&pl.now<e.to?'now':pl.now>=e.to?'past':''}" style="--hc:var(--c-${esc(e.color)})"><span class="nb-time">${hm(e.from)}–${hm(e.to)}</span><span class="nb-mark"></span><span class="nb-what" translate="no">${esc(e.text)}</span><span class="nb-type">${esc(e.label)}</span></li>`).join('')}</ol>`:'<p class="hint2">Nothing planned today.</p>';
}
function previewPages(n){
  const bits=[];
  const tog=(on,attr)=>`<label class="sw-mini"><input type="checkbox" ${on?'checked':''} ${attr}><span class="tg"></span></label>`;
  const item=(ic,label,on,attr,sub='')=>`<div class="vitem${on?'':' off'}"><span>${ic}</span><span class="vt"><b translate="no">${label}</b>${sub?`<small>${sub}</small>`:''}</span>${attr?tog(on,attr):''}</div>`;
  bits.push(item('📕','Cover and intro',true,''));
  if(n.sections.includes('blog')){
    const ps=S.posts.filter(x=>x.nb===n.id);
    bits.push(`<p class="opt-h">✍️ Blog</p>`+(ps.length?ps.map(x=>item(x.public?'📝':'🔒',esc(x.title),x.public,`data-xsw="post-public" data-id="${x.id}"`,x.public?`♥ ${x.likes} · shown`:'hidden')).join(''):'<p class="hint2">No posts.</p>'));
  }
  if(n.sections.includes('interests')){
    const ls=S.lists.filter(x=>x.nb===n.id);
    bits.push(`<p class="opt-h">⭐ Interests</p>`+(ls.length?ls.map(x=>item(esc(x.emoji)||'⭐',esc(x.title),x.public,`data-xsw="list-public" data-id="${x.id}"`,`${x.items.length} item${x.items.length===1?'':'s'} · ${x.public?'shown':'hidden'}`)).join(''):'<p class="hint2">No lists.</p>'));
  }
  if(n.sections.includes('timetable'))bits.push(`<p class="opt-h">🗓️ Timetable</p>`+item('🗓️','Your repeating weekly hours',true,'','Remove the page in notebook Settings to hide it'));
  if(n.sections.includes('subjects'))bits.push(`<p class="opt-h">📚 Studying</p>`+item('📚','Subject names and progress (never notes)',true,'','Remove the page in notebook Settings to hide it'));
  return `<div class="vpages">${bits.join('')}</div>`;
}
function profileHtml(){
  const body=ui.ptab==='posts'?postsTab():ui.ptab==='friends'?friendsTab():ui.ptab==='preview'?previewTab():notebooksTab();
  return hdr('Your notebook','Profile','')+profileHead()+`<div class="ptab-body">${body}</div>`;
}

/* ---------- entry point for app.js ---------- */
function html(tab){
  if(!S){
    if(loadErr)return `<p class="empty">Couldn't load this page: ${esc(loadErr)} <button class="linkbtn" data-x="retry">Try again</button></p>`;
    load();return '<p class="empty">Loading…</p>';
  }
  const keep=[...document.querySelectorAll('#view [data-draft]')].map(e=>[e.id,e.value]);
  const out=profileHtml();
  queueMicrotask(()=>{
    keep.forEach(([id,v])=>{const e=document.getElementById(id);if(e&&!e.value&&!e.dataset.cleared)e.value=v});
    syncControls();
  });
  return out;
}
window.SPLX={html,setUnread:n=>{if(S){S.unread=n;S.notes.forEach(x=>x.read=true)}}};

const markDirty=()=>{ui.dirty=true;const sv=$('saveDesign');if(sv)sv.disabled=false};
const designOut=()=>{const d=clone(ui.dd);delete d.cover_url;return d};
const DESIGN_ACTS=['cover','cover-rm','paper','pcolor','accent','font','binding','stk-add','stk-size','stk-rot','stk-del','preset','style-apply'];
function applyLook(look){   // a ready-made or saved look: replaces colours/paper/font/binding/cover, keeps your stickers
  const keep=ui.dd.stickers;
  ui.dd=Object.assign(clone(BASE),clone(look),{stickers:keep});
  ui.dd.cover_url=ui.dd.cover_img?mediaUrl(ui.dd.cover_img):'';
}

/* ---------- clicks ---------- */
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-x]');if(!b)return;
  const a=b.dataset.x,id=+b.dataset.id,nb=S&&cur();
  try{
    switch(a){
      case 'retry':loadErr='';S=null;redraw();return;
      // notebooks
      case 'nb-pick':if(ui.dirty)toast('Unsaved design changes were dropped.');pick(id);redraw();return;
      case 'ptab':ui.ptab=b.dataset.v;redraw();return;
      case 'aud':ui.aud=b.dataset.v;redraw();return;
      case 'post-open':{const p=S.posts.find(x=>x.id===id);if(!p)return;pick(p.nb);ui.pg='blog';ui.ptab='notebooks';redraw();return}
      case 'nb-new':ui.newNb=!ui.newNb;redraw(ui.newNb?'nn-title':'');return;
      case 'panel':ui.panel=ui.panel===b.dataset.v?'':b.dataset.v;ui.sel=-1;redraw();return;
      case 'pg':ui.pg=b.dataset.v;ui.sel=-1;ui.post=null;ui.newList=false;redraw();return;
      case 'nb-del':{if(!armed(b))return;await api('x.nb.delete',{id:nb.id});S.notebooks=S.notebooks.filter(n=>n.id!==nb.id);S.posts=S.posts.filter(p=>p.nb!==nb.id);S.lists=S.lists.filter(l=>l.nb!==nb.id);ui.panel='';pick(S.notebooks[0]?S.notebooks[0].id:0);toast('Notebook deleted.');redraw();return}
      case 'use-planner':{await api('x.nb.planner',{id:nb.id});toast('Your planner will use this look from the next time you open it.');return}
      // blog + interests
      case 'post-new':ui.post={id:0,title:'',body:'',public:false};ui.pics.post=null;redraw('px-title');return;
      case 'post-edit':{const p=S.posts.find(x=>x.id===id);if(!p)return;ui.post={id:p.id,title:p.title,body:p.body,public:p.public};ui.pics.post=p.image?{id:p.image_id,url:p.image}:null;redraw('px-title');return}
      case 'post-cancel':ui.post=null;redraw();return;
      case 'post-vis':{const p=S.posts.find(x=>x.id===id);if(!p)return;p.public=!p.public;redraw();await api('x.post.public',{id,public:p.public});return}
      case 'post-del':{if(!armed(b))return;S.posts=S.posts.filter(x=>x.id!==id);redraw();await api('x.post.delete',{id});return}
      case 'list-new':ui.newList=!ui.newList;redraw(ui.newList?'lx-title':'');return;
      case 'list-quick':{const q=QUICK[+b.dataset.i];const r=await api('x.list.add',{notebook_id:ui.nb,title:q[1],emoji:q[0],layout:q[2]});S.lists.push({id:r.id,nb:ui.nb,title:q[1],emoji:q[0],layout:q[2],public:false,items:[]});redraw('ix-text-'+r.id);return}
      case 'list-del':{if(!armed(b))return;S.lists=S.lists.filter(x=>x.id!==id);redraw();await api('x.list.delete',{id});return}
      case 'list-layout':{const l=S.lists.find(x=>x.id===id);if(!l||l.layout===b.dataset.v)return;l.layout=b.dataset.v;redraw();await api('x.list.update',{id,layout:l.layout});return}
      case 'item-del':{const l=S.lists.find(x=>x.items.some(i=>i.id===id));if(l)l.items=l.items.filter(i=>i.id!==id);redraw();await api('x.item.delete',{id});return}
      case 'pic-rm':ui.pics[b.dataset.key]=null;{const w=b.closest('.pic-pick');if(w)w.innerHTML=picInner(b.dataset.key)}return;
      case 'copy-link':{try{await navigator.clipboard.writeText(b.dataset.link);toast('Link copied.')}catch(err){toast(b.dataset.link)}return}
      // my styles
      case 'style-del':{const r=await api('x.style.delete',{id});S.styles=r.styles;redraw();return}
      // design
      case 'cover':ui.dd.cover=b.dataset.v;ui.dd.cover_img=0;ui.dd.cover_url='';break;
      case 'cover-rm':ui.dd.cover_img=0;ui.dd.cover_url='';break;
      case 'paper':ui.dd.paper=b.dataset.v;break;
      case 'pcolor':ui.dd.paper_color=b.dataset.v;break;
      case 'accent':ui.dd.accent=b.dataset.v;break;
      case 'font':ui.dd.font=b.dataset.v;break;
      case 'binding':ui.dd.binding=b.dataset.v;break;
      case 'preset':applyLook(PRESETS[+b.dataset.i][1]);break;
      case 'style-apply':{const s=S.styles.find(x=>x.id===id);if(!s)return;applyLook(s.design);break}
      case 'stk-add':if(ui.dd.stickers.length>=30){toast('That is plenty of stickers!');return}ui.dd.stickers.push({k:b.dataset.k,p:ui.pg,x:20+Math.random()*60,y:25+Math.random()*50,s:1,r:0});ui.sel=ui.dd.stickers.length-1;break;
      case 'stk-size':{const s=ui.dd.stickers[ui.sel];if(!s)return;s.s=Math.max(0.5,Math.min(3,Math.round((s.s+ +b.dataset.v)*10)/10));break}
      case 'stk-rot':{const s=ui.dd.stickers[ui.sel];if(!s)return;s.r=Math.max(-180,Math.min(180,s.r+ +b.dataset.v));break}
      case 'stk-del':ui.dd.stickers.splice(ui.sel,1);ui.sel=-1;break;
      case 'design-reset':pick(ui.nb,true);redraw();return;
      case 'design-save':{
        b.disabled=true;
        const r=await api('x.nb.design',{id:nb.id,design:designOut()});
        nb.design=r.design;nb.cover_url=r.cover_url;ui.dd=Object.assign(clone(BASE),clone(r.design));ui.dd.cover_url=r.cover_url;ui.dirty=false;
        toast('Design saved.');redraw();return}
      default:return;
    }
  }catch(err){toast(err.message);if(S&&a!=='retry')load2()}
  if(DESIGN_ACTS.includes(a)){markDirty();
    if(a==='preset'||a==='style-apply'){redraw()}   // colour pickers hold the new values
    else paintPreview()}
});
function load2(){S=null;loading=false;loadErr='';redraw()}

/* sticker clicks on the live page + colour pickers */
document.addEventListener('input',e=>{
  const t=e.target;if(!t.dataset||!t.dataset.xcolor||!ui.dd)return;
  const k=t.dataset.xcolor;ui.dd[k]=t.value;
  if(k==='cover_c1'||k==='cover_c2'){ui.dd.cover='custom';ui.dd.cover_img=0;ui.dd.cover_url='';if(!ui.dd.cover_c1)ui.dd.cover_c1='#6a4dc4';if(!ui.dd.cover_c2)ui.dd.cover_c2='#e0609a'}
  if(k==='paper_hex')ui.dd.paper_color='custom';
  if(k==='accent_hex')ui.dd.accent='custom';
  markDirty();paintPreview();
});

/* ---------- forms ---------- */
document.addEventListener('submit',async e=>{
  const f=e.target.closest('form[data-xform]');if(!f)return;
  e.preventDefault();if(f.dataset.busy)return;
  const d=Object.fromEntries(new FormData(f));const btn=f.querySelector('button:not([type])');
  f.dataset.busy='1';if(btn)btn.disabled=true;
  const clear=ids=>ids.forEach(i=>{const el=$(i);if(el){el.value='';el.dataset.cleared='1'}});
  try{
    const x=f.dataset.xform;
    if(x==='post'){
      const pic=ui.pics.post,pub=f.querySelector('[name=public]').checked;
      await api('x.post.save',{id:ui.post.id,notebook_id:ui.nb,title:d.title,body:d.body,public:pub,image_id:pic?pic.id:0});
      ui.post=null;ui.pics.post=null;
      const r=await api('x.load');S=Object.assign(S,{posts:r.posts});toast(pub?'Published.':'Saved as private.');redraw();
    }else if(x==='list'){
      const r=await api('x.list.add',{notebook_id:ui.nb,title:d.title,emoji:d.emoji,layout:d.layout});
      S.lists.push({id:r.id,nb:ui.nb,title:d.title.trim(),emoji:d.emoji,layout:d.layout,public:false,items:[]});ui.newList=false;redraw('ix-text-'+r.id);
    }else if(x==='item'){
      const lid=+f.dataset.id,k='item-'+lid,pic=ui.pics[k];
      const r=await api('x.item.add',{list_id:lid,text:d.text,note:d.note||'',image_id:pic?pic.id:0});
      const l=S.lists.find(y=>y.id===lid);l.items.push({id:r.id,text:d.text.trim(),note:(d.note||'').trim(),image:pic?pic.url:'',image_id:pic?pic.id:0});
      ui.pics[k]=null;clear(['ix-text-'+lid,'ix-note-'+lid]);redraw('ix-text-'+lid);
      document.querySelectorAll('[data-cleared]').forEach(el=>delete el.dataset.cleared);
    }else if(x==='nb'){
      const nb=cur(),sections=new FormData(f).getAll('sections');
      const r=await api('x.nb.save',{id:nb.id,title:d.title,intro:d.intro||'',sections});
      Object.assign(nb,{title:r.notebook.title,intro:r.notebook.intro,sections:r.notebook.sections});
      if(ui.pg!=='cover'&&!nb.sections.includes(ui.pg))ui.pg='cover';
      toast('Saved.');redraw();
    }else if(x==='nbnew'){
      const look=d.look!==''?PRESETS[+d.look][1]:{};
      const r=await api('x.nb.add',{title:d.title,sections:new FormData(f).getAll('sections'),design:look});
      S.notebooks.push(r.notebook);ui.newNb=false;ui.panel='deco';pick(r.notebook.id);toast('Notebook created. Decorate it, then add things to its pages.');redraw();
    }else if(x==='style'){
      const r=await api('x.style.save',{name:d.name,design:designOut()});
      S.styles=r.styles;toast('Style saved. Find it under My styles.');redraw();
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
      }else if(k==='day'){S.profile.day=on;await api('x.profile.save',{day:on});redraw()}
      else if(k==='post-public'){const p=S.posts.find(x=>x.id===+t.dataset.id);if(p)p.public=on;await api('x.post.public',{id:+t.dataset.id,public:on});redraw()}
      else if(k==='nb-public'){const nb=S.notebooks.find(x=>x.id===+(t.dataset.id||ui.nb));nb.public=on;await api('x.nb.save',{id:nb.id,public:on});redraw()}
      else if(k==='notify'){S.profile.notify[t.dataset.k]=on;await api('x.profile.save',{notify:{[t.dataset.k]:on}})}
      else if(k==='list-public'){const l=S.lists.find(x=>x.id===+t.dataset.id);if(l)l.public=on;await api('x.list.update',{id:+t.dataset.id,public:on});redraw()}
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
      else if(kind==='cover'){ui.dd.cover_img=r.id;ui.dd.cover_url=r.url;markDirty();paintPreview();if(msg)msg.textContent=''}
      else{S.stickers_up.unshift({id:r.id,url:r.url});ui.dd.stickers.push({k:'up:'+r.id,p:ui.pg,x:50,y:50,s:1,r:0});ui.sel=ui.dd.stickers.length-1;markDirty();redraw()}
    }catch(err){if(msg)msg.textContent='';toast(err.message)}
  }
});

/* ---------- dragging stickers on the page (only while decorating) ---------- */
let drag=null;
document.addEventListener('pointerdown',e=>{
  const s=e.target.closest('.deco .stk-layer .stk');if(!s||!ui.dd)return;
  const i=+s.dataset.i;ui.sel=i;
  drag={i,box:s.parentElement.getBoundingClientRect(),el:s};s.setPointerCapture&&s.setPointerCapture(e.pointerId);e.preventDefault();
  document.querySelectorAll('.stk-layer .stk').forEach(x=>x.classList.toggle('sel',+x.dataset.i===i));
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
})();
