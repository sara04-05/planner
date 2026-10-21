/* Study notebook (notes.php): pages of notes, whiteboards and study files. Saves through noteapi.php.
   A notes page saves by itself a moment after you stop typing. The whiteboard is a drawing (canvas) that is
   saved as a picture: pen, marker, eraser, lines, arrows, shapes, text and pictures you can draw over. */
(function(){
const box=document.getElementById('notes');if(!box)return;
const CSRF=box.dataset.csrf, TOUR=!!box.dataset.tour, T=s=>(window.SPL_T?window.SPL_T(s):s);
const $=id=>document.getElementById(id);
const listEl=$('ntList'), main=$('ntMain'), search=$('ntSearch'), subjEl=$('ntSubjects'), useEl=$('ntUse');
let S={notes:[],subjects:[],limits:{file_max:10485760,total_max:104857600,files_max:200,used:{count:0,bytes:0},types:[]}};
let cur=null, filter='', subject='', saveTimer=null, saving=null;

function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
function btn(cls,text,fn,title){const b=el('button',cls,text);b.type='button';if(title){b.title=T(title);b.setAttribute('aria-label',T(title))}if(fn)b.onclick=fn;return b}
/** Put a line icon (and a label) in a button or link. */
function withIcon(node,name,label){node.insertAdjacentHTML('afterbegin',ico(name));if(label)node.append(label);return node}
function mine(e){e.setAttribute('translate','no');return e}   // what people wrote themselves is never translated
const toast=m=>{const t=$('toast');if(!t)return;t.textContent=T(m);t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{t.hidden=true},4500)};
const mb=b=>b>=1048576?(b/1048576).toFixed(b>=10485760?0:1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
function when(ts){const d=new Date(ts*1000),now=new Date();
  return d.toDateString()===now.toDateString()?d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString([],{day:'numeric',month:'short'})}
/** Delete buttons ask twice: the first click arms them for a few seconds. */
function armed(b){if(b.dataset.armed)return true;b.dataset.armed='1';const old=b.textContent;b.textContent=T('Sure? Click again');
  setTimeout(()=>{delete b.dataset.armed;b.textContent=old},3500);return false}

/** Visitor tour (Look inside): a few sample pages, view only. Nothing is sent to noteapi.php. */
function tourData(){
  const now=Math.floor(Date.now()/1000),h=3600;
  const notes=[
    {id:1,kind:'note',title:'Normal forms',subject:'Databases',paper:'lined',updated:now-2*h,chapter:'Normal forms',board:'',files:[],
      body:'1NF: every column holds a single value, no repeating groups.\n2NF: 1NF + every non-key column depends on the whole key.\n3NF: 2NF + no non-key column depends on another non-key column.\n\nExam tip: practise turning a messy table into 3NF step by step.'},
    {id:2,kind:'note',title:'Merge sort vs quick sort',subject:'Algorithms',paper:'grid',updated:now-26*h,chapter:'',board:'',files:[],
      body:'Merge sort: always O(n log n), needs extra memory, stable.\nQuick sort: O(n log n) on average, O(n²) worst case, sorts in place.\n\nTo revise: draw the recursion tree for [5, 2, 9, 1].'},
    {id:3,kind:'note',title:'OOP lab report outline',subject:'OOP',paper:'dots',updated:now-50*h,chapter:'',board:'',files:[],
      body:'1. Aim of the lab\n2. Class diagram\n3. Code and what each class does\n4. Test results\n5. What I would improve'}
  ];
  return {notes,subjects:['Algorithms','Databases','OOP'],limits:{file_max:10485760,total_max:104857600,files_max:200,used:{count:0,bytes:0},types:[]}};
}
const TOUR_DATA=TOUR?tourData():null;
const TOUR_MSG='This is a preview with sample pages. Create a free account to write your own notes.';
async function api(action,data={}){
  if(TOUR){
    if(action==='note.list')return {ok:true,notes:TOUR_DATA.notes.map(summary),subjects:TOUR_DATA.subjects,limits:TOUR_DATA.limits};
    if(action==='note.get'){const n=TOUR_DATA.notes.find(x=>x.id===data.id);if(!n)throw new Error('That page was not found.');return {ok:true,note:{...n}}}
    throw new Error(TOUR_MSG);
  }
  const r=await fetch('noteapi.php?action='+encodeURIComponent(action),{method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json','X-CSRF-Token':CSRF},body:JSON.stringify(data)});
  let j={};try{j=await r.json()}catch(e){}
  if(!r.ok||j.error)throw new Error(j.error||'Something went wrong. Try again.');
  return j;
}
/** A form upload, with progress (onProgress gets 0-1). */
function upload(action,form,onProgress){
  return new Promise((ok,bad)=>{
    const x=new XMLHttpRequest();x.open('POST','noteapi.php?action='+action);x.setRequestHeader('X-CSRF-Token',CSRF);
    if(onProgress)x.upload.onprogress=e=>{if(e.lengthComputable)onProgress(e.loaded/e.total)};
    x.onload=()=>{let j={};try{j=JSON.parse(x.responseText)}catch(e){}
      if(x.status>=400||j.error||!j.ok)bad(new Error(j.error||(x.status===413?'That file is too big.':'Something went wrong. Try again.')));else ok(j)};
    x.onerror=()=>bad(new Error('No connection. Try again.'));
    x.send(form);
  });
}

/* ---------- the list of pages ---------- */
function summary(n){return {id:n.id,kind:n.kind,title:n.title,subject:n.subject,snippet:(n.body||'').replace(/\s+/g,' ').slice(0,90),
  files:(n.files||[]).length,updated:n.updated,thumb:n.kind==='board'?n.board:''}}
function upsert(n){const s=summary(n),i=S.notes.findIndex(x=>x.id===n.id);if(i<0)S.notes.unshift(s);else S.notes[i]=s;S.notes.sort((a,b)=>b.updated-a.updated||b.id-a.id)}
function drawSubjects(){
  const all=[...new Set([...S.notes.map(n=>n.subject).filter(Boolean)])].sort((a,b)=>a.localeCompare(b));
  subjEl.replaceChildren();
  if(!all.length){subjEl.hidden=true;return}
  subjEl.hidden=false;
  const chip=(v,label)=>{const b=btn('nt-chip'+(subject===v?' on':''),label,()=>{subject=subject===v?'':v;drawList()});if(v)mine(b);return b};
  subjEl.append(chip('',T('All')));
  all.forEach(s=>subjEl.append(chip(s,s)));
}
function drawList(){
  drawSubjects();
  const q=filter.toLowerCase();
  const list=S.notes.filter(n=>(!subject||n.subject===subject)&&(!q||(n.title+' '+n.subject+' '+n.snippet).toLowerCase().includes(q)));
  listEl.replaceChildren();
  if(!list.length){
    listEl.append(el('li','empty',S.notes.length?T('No pages match.'):T('No pages yet. Start one with “New page” or “New whiteboard”.')));
  }
  for(const n of list){
    const li=el('li'),b=el('button','nt-item'+(cur&&cur.id===n.id?' on':''));b.type='button';b.onclick=()=>open(n.id);
    const ic=el('span','nt-ic');ic.innerHTML=ico(n.kind==='board'?'board':'note');
    if(n.thumb){ic.textContent='';const im=el('img');im.src=n.thumb;im.alt='';im.loading='lazy';ic.append(im);ic.classList.add('thumb')}
    const tx=el('span','nt-tx');
    tx.append(mine(el('b',null,n.title||T(n.kind==='board'?'Untitled whiteboard':'Untitled page'))));
    const meta=el('small');
    if(n.subject)meta.append(mine(el('span','nt-sub',n.subject)));
    meta.append(el('span',null,when(n.updated)+(n.files?' · '+n.files+' '+T('files'):'')));
    tx.append(meta);
    if(n.snippet)tx.append(mine(el('span','nt-snip',n.snippet)));
    b.append(ic,tx);li.append(b);listEl.append(li);
  }
  const u=S.limits.used;
  useEl.textContent=u.count?T('Files')+': '+mb(u.bytes)+' / '+mb(S.limits.total_max):'';
}
async function load(){
  try{Object.assign(S,await api('note.list'))}catch(e){listEl.replaceChildren(el('li','empty',T(e.message)));return}
  drawList();
  const want=+box.dataset.open,qs=new URLSearchParams(location.search);
  if(qs.get('chapter')&&qs.get('new')){   // "Notes" / "Whiteboard" on a chapter in the Study tab
    const n=await create(qs.get('new')==='board'?'board':'note',{chapter_id:+qs.get('chapter')});
    if(!n)welcome();
  }else if(want&&S.notes.some(n=>n.id===want))open(want);else if(!cur)welcome();
}

/* ---------- empty state ---------- */
function welcome(){
  cur=null;main.replaceChildren();drawList();
  const w=el('div','nt-welcome');
  w.append(el('h2',null,T('Your study notebook')),el('p','muted',T('Everything here is private. Only you can see it.')));
  const cards=el('div','nt-cards');
  const card=(icon,title,text,fn)=>{const c=btn('nt-card',null,fn);const ci=el('span','nt-card-i');ci.innerHTML=ico(icon);c.append(ci,el('b',null,T(title)),el('span',null,T(text)));return c};
  cards.append(
    card('note','Notes page','Write lecture notes and keep the files for that lesson with them.',()=>create('note')),
    card('board','Whiteboard','Draw, write by hand, label diagrams and sketch over pictures.',()=>create('board')),
    card('clip','Upload study files','PDFs, slides, Word, pictures and music. A page is made for them.',()=>quickUpload()));
  w.append(cards,el('p','nt-limit',T('Up to')+' '+mb(S.limits.file_max)+' '+T('a file')+' · '+mb(S.limits.total_max)+' '+T('in total')));
  main.append(w);
}
async function create(kind,extra={}){
  try{
    const r=await api('note.add',{kind,subject:extra.chapter_id?'':subject||'',...extra});
    upsert(r.note);cur=r.note;history.replaceState(null,'','?page='+cur.id);drawList();
    if(kind==='board')openBoard(extra.picture||null);else{drawNote();const t=$('ntTitle');if(t&&!t.value)t.focus();else if($('ntBody'))$('ntBody').focus()}
    return r.note;
  }catch(e){toast(e.message)}
}
function quickUpload(){
  const inp=el('input');inp.type='file';inp.multiple=true;inp.accept=acceptList();
  inp.onchange=async()=>{if(!inp.files.length)return;const files=[...inp.files];
    const first=files[0].name.replace(/\.[^.]+$/,'');
    const n=await create('note',{title:files.length>1?T('Study files'):first});if(n)addFiles(files)};
  inp.click();
}
const acceptList=()=>S.limits.types.map(t=>'.'+t).join(',');

/* ---------- one page ---------- */
async function open(id){
  if(cur&&cur.id===id){return}
  await flush();
  try{const r=await api('note.get',{id});cur=r.note}catch(e){toast(e.message);return}
  history.replaceState(null,'','?page='+id);
  drawList();
  drawNote();
  if(window.innerWidth<760)main.scrollIntoView({behavior:'smooth',block:'start'});
}
function queueSave(){
  setState('Saving…');clearTimeout(saveTimer);saveTimer=setTimeout(flush,900);
}
async function flush(){
  clearTimeout(saveTimer);saveTimer=null;
  if(!cur||!cur.dirty)return saving;
  const n=cur;n.dirty=false;
  const data={id:n.id,title:n.title,subject:n.subject,paper:n.paper};if(n.kind==='note')data.body=n.body;
  saving=api('note.save',data).then(r=>{n.updated=r.updated;upsert(n);drawList();if(cur===n)setState('All saved')})
    .catch(e=>{n.dirty=true;if(cur===n)setState('Not saved');toast(e.message)});
  return saving;
}
function setState(s){const e=$('ntState');if(e){e.textContent=T(s);e.dataset.s=s}}
window.addEventListener('beforeunload',e=>{if(cur&&cur.dirty){flush();e.preventDefault();e.returnValue=''}});

function head(n){
  const h=el('div','nt-head');
  const back=btn('btn ghost nt-back',null,()=>{flush();history.replaceState(null,'','notes.php');welcome();window.scrollTo({top:0})});
  withIcon(back,'back',T('All pages'));
  const title=el('input','nt-title');title.id='ntTitle';title.placeholder=T(n.kind==='board'?'Whiteboard title':'Page title');title.value=n.title;title.maxLength=120;
  title.oninput=()=>{n.title=title.value;n.dirty=true;queueSave()};title.readOnly=TOUR;
  const sub=el('input','nt-subj');sub.placeholder=T('Subject');sub.value=n.subject;sub.maxLength=80;sub.setAttribute('list','ntSubjList');
  sub.oninput=()=>{n.subject=sub.value;n.dirty=true;queueSave()};sub.readOnly=TOUR;
  const dl=el('datalist');dl.id='ntSubjList';
  [...new Set([...S.subjects,...S.notes.map(x=>x.subject).filter(Boolean)])].forEach(s=>{const o=el('option');o.value=s;dl.append(o)});
  const row=el('div','nt-row');
  row.append(sub,dl);
  if(n.kind==='note'){
    const paper=el('select','nt-paper-pick');paper.setAttribute('aria-label',T('Paper'));
    [['lined','Lined paper'],['grid','Squared paper'],['dots','Dotted paper'],['plain','Plain paper']].forEach(([v,l])=>{const o=el('option',null,T(l));o.value=v;o.selected=n.paper===v;paper.append(o)});
    paper.onchange=()=>{n.paper=paper.value;n.dirty=true;$('ntBody').dataset.paper=n.paper;queueSave()};paper.disabled=TOUR;
    row.append(paper);
  }
  const st=el('span','nt-state');st.id='ntState';st.textContent=T('All saved');
  const del=btn('btn ghost nt-del',T('Delete page'),async e=>{if(!armed(e.currentTarget))return;
    try{clearTimeout(saveTimer);n.dirty=false;await api('note.delete',{id:n.id});S.notes=S.notes.filter(x=>x.id!==n.id);
      S.limits.used.count-=n.files.length;S.limits.used.bytes-=n.files.reduce((a,f)=>a+f.size,0);
      history.replaceState(null,'','notes.php');toast('Page deleted.');welcome()}catch(err){toast(err.message)}});
  if(!TOUR)row.append(st,del);
  h.append(back,title,row);
  if(n.chapter){const a=el('a','nt-chapter');a.href=(TOUR?'tour':'index')+'.php?tab=study';const cl=el('span',null,T('Material for chapter')+' ');cl.insertAdjacentHTML('afterbegin',ico('book'));a.append(cl,mine(el('b',null,n.chapter)));h.append(a)}
  return h;
}
function drawNote(){
  const n=cur;main.replaceChildren();
  main.append(head(n));
  if(n.kind==='note'){
    const body=el('textarea','nt-body');body.id='ntBody';body.dataset.paper=n.paper;body.value=n.body;
    body.placeholder=T('Start writing… Your notes save by themselves.');body.setAttribute('aria-label',T('Notes'));
    body.oninput=()=>{n.body=body.value;n.dirty=true;queueSave();fit(body)};body.readOnly=TOUR;
    body.onkeydown=e=>{if(e.key==='Tab'&&!e.shiftKey){e.preventDefault();body.setRangeText('    ',body.selectionStart,body.selectionEnd,'end');body.oninput()}};
    main.append(body);requestAnimationFrame(()=>fit(body));
  }else{
    const wrap=el('div','nt-board-prev');wrap.dataset.paper=n.paper;
    if(n.board){const im=el('img');im.src=n.board;im.alt=T('Your whiteboard');wrap.append(im)}
    else wrap.append(el('p','empty',T('This whiteboard is empty. Open it to start drawing.')));
    wrap.onclick=()=>openBoard();
    const go=btn('btn primary nt-draw',null,()=>openBoard());withIcon(go,'pencil',T('Open the whiteboard'));
    main.append(wrap,go);
  }
  if(!TOUR)main.append(filesBox(n));
}
function fit(t){t.style.height='auto';t.style.height=Math.max(420,t.scrollHeight+40)+'px'}

/* ---------- study files ---------- */
function filesBox(n){
  const sec=el('section','nt-files');
  const h=el('div','nt-files-h');
  h.append(el('h2',null,T('Study files & pictures')));
  const add=btn('btn',null,()=>pick.click());withIcon(add,'clip',T('Add files'));
  const pick=el('input');pick.type='file';pick.multiple=true;pick.hidden=true;pick.accept=acceptList();
  pick.onchange=()=>{addFiles([...pick.files]);pick.value=''};
  h.append(add,pick);sec.append(h);
  const drop=el('div','nt-drop');drop.id='ntDrop';
  drop.append(el('span',null,T('Drop files here, or use “Add files”.')+' '+T('PDF, Word, PowerPoint, Excel, pictures, music and short videos, up to')+' '+mb(S.limits.file_max)+' '+T('each.')));
  ['dragenter','dragover'].forEach(t=>sec.addEventListener(t,e=>{e.preventDefault();sec.classList.add('over')}));
  ['dragleave','drop'].forEach(t=>sec.addEventListener(t,e=>{if(t==='dragleave'&&sec.contains(e.relatedTarget))return;e.preventDefault();sec.classList.remove('over')}));
  sec.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files.length)addFiles([...e.dataTransfer.files])});
  sec.append(drop);
  const pics=el('div','nt-pics');pics.id='ntPics';
  const docs=el('ul','nt-docs');docs.id='ntDocs';
  sec.append(pics,docs);
  n.files.forEach(f=>showFile(f,pics,docs));
  return sec;
}
function showFile(f,pics,docs){
  pics=pics||$('ntPics');docs=docs||$('ntDocs');if(!pics||!docs)return;
  if(f.kind==='image'){
    const fig=el('figure','nt-pic');fig.dataset.id=f.id;
    const a=el('a');a.href=f.url;a.target='_blank';a.rel='noopener';
    const im=el('img');im.src=f.url;im.alt=f.name;im.loading='lazy';a.append(im);a.onclick=e=>{e.preventDefault();lightbox(f)};
    const cap=el('figcaption');cap.append(mine(el('span',null,f.name)));
    const tools=el('span','nt-pic-tools');
    const dr=btn('linkbtn',null,()=>drawOn(f));withIcon(dr,'pencil',T('Draw on it'));tools.append(dr,fileDel(f));
    cap.append(tools);fig.append(a,cap);pics.append(fig);return;
  }
  const li=el('li','nt-doc');li.dataset.id=f.id;
  const icon={audio:'music',video:'video',image:'image'}[f.kind]||'file';
  const a=el('a','nt-doc-name');a.href=f.url+(['pdf','audio','video'].includes(f.kind)?'':'&dl=1');a.target='_blank';a.rel='noopener';
  const di=el('span','nt-doc-i');di.innerHTML=ico(icon);a.append(di,mine(el('span',null,f.name)),el('small',null,mb(f.size)));
  const r=el('div','nt-doc-r');
  const dl=el('a','linkbtn',T('Download'));dl.href=f.url+'&dl=1';
  r.append(dl,fileDel(f));
  li.append(a,r);
  if(f.kind==='audio'){const au=el('audio');au.controls=true;au.preload='none';au.src=f.url;li.append(au)}
  if(f.kind==='video'){const v=el('video');v.controls=true;v.preload='metadata';v.src=f.url;li.append(v)}
  docs.append(li);
}
function fileDel(f){
  return btn('linkbtn nt-x',T('Delete'),async e=>{if(!armed(e.currentTarget))return;
    try{const r=await api('file.delete',{id:f.id});S.limits.used=r.used;
      if(cur){cur.files=cur.files.filter(x=>x.id!==f.id);upsert(cur);drawList()}
      document.querySelectorAll('[data-id="'+f.id+'"]').forEach(x=>{if(x.closest('.nt-files'))x.remove()});
    }catch(err){toast(err.message)}});
}
async function addFiles(files){
  if(!cur)return;
  if(TOUR){toast(TOUR_MSG);return}
  const n=cur,max=S.limits.file_max,ok=new Set(S.limits.types);
  for(const file of files){
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(!ok.has(ext)){toast(file.name+': '+T("this kind of file can't be added."));continue}
    if(file.size>max){toast(file.name+': '+T('too big. The most is')+' '+mb(max)+'.');continue}
    const row=el('li','nt-doc nt-up');row.append(mine(el('span',null,file.name)));const bar=el('progress');bar.max=1;bar.value=0;row.append(bar);
    const docs=$('ntDocs');if(docs&&cur===n)docs.prepend(row);
    const fd=new FormData();fd.append('note_id',n.id);fd.append('file',file);
    try{
      const r=await upload('file.add',fd,p=>{bar.value=p});
      S.limits.used=r.used;n.files.push(r.file);n.updated=Math.floor(Date.now()/1000);upsert(n);drawList();
      row.remove();if(cur===n)showFile(r.file);
    }catch(e){row.remove();toast(file.name+': '+T(e.message))}
  }
}
function lightbox(f){
  const lb=el('div','nt-lb');lb.tabIndex=-1;
  const im=el('img');im.src=f.url;im.alt=f.name;
  const bar=el('div','nt-lb-bar');
  const close=()=>{lb.remove();document.removeEventListener('keydown',key)};
  const key=e=>{if(e.key==='Escape')close()};
  const dr=btn('btn',null,()=>{close();drawOn(f)});withIcon(dr,'pencil',T('Draw on it'));
  bar.append(mine(el('span',null,f.name)),dr,btn('btn',T('Close'),close));
  lb.onclick=e=>{if(e.target===lb)close()};
  lb.append(im,bar);document.body.append(lb);lb.focus();document.addEventListener('keydown',key);
}
/** A new whiteboard with this picture on it, ready to draw over (labelling a diagram, sketching over a reference). */
async function drawOn(f){
  await flush();
  const title=f.name.replace(/\.[^.]+$/,'');
  create('board',{title,subject:cur?cur.subject:'',picture:f.url});
}

/* ---------- the whiteboard ---------- */
const W=1600,H=1000;
const COLORS=['#141414','#ffffff','#E5484D','#F76B15','#FFC53D','#46A758','#0090FF','#555555','#9E9E9E','#8D6E63'];
function openBoard(picture){
  const n=cur;if(!n)return;
  const ov=el('div','wb');ov.setAttribute('role','dialog');ov.setAttribute('aria-label',T('Whiteboard'));
  const bar=el('div','wb-bar');
  const stage=el('div','wb-stage');
  const sheet=el('div','wb-sheet');sheet.dataset.paper=n.paper||'plain';
  const cv=el('canvas');cv.width=W;cv.height=H;const cx=cv.getContext('2d');
  const live=el('canvas','wb-live');live.width=W;live.height=H;const lx=live.getContext('2d');
  sheet.append(cv,live);stage.append(sheet);
  let tool='pen',color=COLORS[0],size=4,dirty=false,undo=[],redo=[],autoT=null,busy=false;

  // toolbar
  const tools=el('div','wb-group');
  const TOOLS=[['pen','pencil','Pen'],['marker','highlighter','Highlighter'],['eraser','eraser','Eraser'],['line','line','Line'],['arrow','arrow','Arrow'],['rect','square','Box'],['ellipse','circle','Circle'],['text','text','Text'],['picture','image','Picture']];
  for(const [k,icon,label] of TOOLS){
    const b=btn('wb-tool'+(k===tool?' on':''),null,()=>{if(textBox)commitText();if(k==='picture'){picPick.click();return}tool=k;tools.querySelectorAll('.wb-tool').forEach(x=>x.classList.toggle('on',x===b));sheet.dataset.tool=k},label);
    withIcon(b,icon);b.dataset.k=k;tools.append(b);
  }
  sheet.dataset.tool=tool;
  const picPick=el('input');picPick.type='file';picPick.accept='image/*';picPick.hidden=true;
  picPick.onchange=()=>{const f=picPick.files[0];picPick.value='';if(f)placePicture(URL.createObjectURL(f))};
  const cols=el('div','wb-group wb-colors');
  const swatch=c=>{const b=btn('wb-col'+(c===color?' on':''),'',()=>{color=c;cols.querySelectorAll('.wb-col').forEach(x=>x.classList.toggle('on',x===b));pickC.value=c},'Colour');b.style.setProperty('--c',c);return b};
  COLORS.forEach(c=>cols.append(swatch(c)));
  const pickC=el('input','wb-pickc');pickC.type='color';pickC.value=color;pickC.title=T('Any colour');pickC.setAttribute('aria-label',T('Any colour'));
  pickC.oninput=()=>{color=pickC.value;cols.querySelectorAll('.wb-col').forEach(x=>x.classList.remove('on'))};
  cols.append(pickC);
  const sz=el('label','wb-size');const range=el('input');range.type='range';range.min=1;range.max=40;range.value=size;range.oninput=()=>{size=+range.value;dot.style.setProperty('--s',Math.max(3,Math.min(26,size))+'px')};
  const dot=el('i');dot.style.setProperty('--s',size+'px');sz.title=T('Size');sz.append(dot,range);
  const papers=el('select','wb-paper');papers.setAttribute('aria-label',T('Paper'));
  [['plain','Plain paper'],['grid','Squared paper'],['dots','Dotted paper'],['lined','Lined paper'],['black','Blackboard']].forEach(([v,l])=>{const o=el('option',null,T(l));o.value=v;o.selected=(n.paper||'plain')===v;papers.append(o)});
  papers.onchange=()=>{n.paper=papers.value;sheet.dataset.paper=n.paper;dirty=true;queue()};
  const acts=el('div','wb-group');
  const bUndo=btn('wb-tool',null,doUndo,'Undo'),bRedo=btn('wb-tool',null,doRedo,'Redo');withIcon(bUndo,'undo');withIcon(bRedo,'redo');
  acts.append(bUndo,bRedo,
    withIcon(btn('wb-tool',null,e=>{if(!armed(e.currentTarget))return;snap();cx.clearRect(0,0,W,H);changed()},'Clear the board'),'trash'),
    withIcon(btn('wb-tool',null,download,'Save as picture'),'download'));
  const st=el('span','wb-state',T('All saved'));
  const done=btn('btn primary',T('Done'),close);
  const ttl=mine(el('b','wb-title',n.title||T('Untitled whiteboard')));
  bar.append(ttl,tools,cols,sz,papers,acts,st,done,picPick);
  ov.append(bar,stage);document.body.append(ov);document.body.classList.add('wb-open');

  // what's already on the board
  if(n.board){const im=new Image();im.onload=()=>{cx.drawImage(im,0,0,W,H);if(picture)placePicture(picture)};im.onerror=()=>{if(picture)placePicture(picture)};im.src=n.board}
  else if(picture)placePicture(picture);

  function snap(){undo.push(cx.getImageData(0,0,W,H));if(undo.length>12)undo.shift();redo=[];paintUndo()}
  function paintUndo(){bUndo.disabled=!undo.length;bRedo.disabled=!redo.length}
  function doUndo(){if(!undo.length)return;redo.push(cx.getImageData(0,0,W,H));cx.putImageData(undo.pop(),0,0);paintUndo();changed()}
  function doRedo(){if(!redo.length)return;undo.push(cx.getImageData(0,0,W,H));cx.putImageData(redo.pop(),0,0);paintUndo();changed()}
  paintUndo();
  function changed(){dirty=true;queue()}
  function queue(){st.textContent=T('Saving…');clearTimeout(autoT);autoT=setTimeout(save,4000)}
  async function save(){
    clearTimeout(autoT);if(!dirty)return;if(busy){autoT=setTimeout(save,1500);return}
    busy=true;dirty=false;st.textContent=T('Saving…');
    try{
      const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
      const fd=new FormData();fd.append('note_id',n.id);fd.append('image',blob,'board.png');fd.append('paper',n.paper||'plain');
      const r=await upload('board.save',fd);
      n.board=r.board;n.updated=r.updated;upsert(n);drawList();st.textContent=T('All saved');
    }catch(e){dirty=true;st.textContent=T('Not saved');toast(e.message)}
    busy=false;
  }
  async function close(){
    if(textBox)commitText();
    if(placing)placing.place();
    await save();
    if(dirty&&!confirmLeave())return;
    ov.remove();document.body.classList.remove('wb-open');document.removeEventListener('keydown',keys);
    if(cur===n)drawNote();
  }
  function confirmLeave(){st.textContent=T('Not saved. Click Done again to leave anyway.');if(close.warned)return true;close.warned=true;return false}
  function download(){
    const out=document.createElement('canvas');out.width=W;out.height=H;const o=out.getContext('2d');
    o.fillStyle=n.paper==='black'?'#1f2a24':'#ffffff';o.fillRect(0,0,W,H);o.drawImage(cv,0,0);
    const a=document.createElement('a');a.download=(n.title||'whiteboard').replace(/[\\/:*?"<>|]+/g,'')+'.png';a.href=out.toDataURL('image/png');a.click();
  }
  const keys=e=>{
    if(textBox&&e.target===textBox)return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?doRedo():doUndo()}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();doRedo()}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();dirty=true;save()}
    else if(e.key==='Escape'&&!placing)close();
  };
  document.addEventListener('keydown',keys);

  // drawing
  const at=e=>{const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}};
  let down=null,pts=[];
  function style(c,pressure){
    c.lineCap='round';c.lineJoin='round';c.globalCompositeOperation='source-over';c.globalAlpha=1;c.strokeStyle=c.fillStyle=color;
    let w=size*(pressure||1);
    if(tool==='marker'){c.globalAlpha=.35;w=size*3+6}
    if(tool==='eraser'){c.globalCompositeOperation='destination-out';w=size*3+8;c.strokeStyle='#000'}
    c.lineWidth=w;
  }
  function shape(c,a,b){
    c.beginPath();
    if(tool==='line'||tool==='arrow'){c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);
      if(tool==='arrow'){const ang=Math.atan2(b.y-a.y,b.x-a.x),L=Math.max(14,size*4);
        c.moveTo(b.x,b.y);c.lineTo(b.x-L*Math.cos(ang-.45),b.y-L*Math.sin(ang-.45));
        c.moveTo(b.x,b.y);c.lineTo(b.x-L*Math.cos(ang+.45),b.y-L*Math.sin(ang+.45))}}
    else if(tool==='rect')c.rect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(b.x-a.x),Math.abs(b.y-a.y));
    else if(tool==='ellipse')c.ellipse((a.x+b.x)/2,(a.y+b.y)/2,Math.abs(b.x-a.x)/2,Math.abs(b.y-a.y)/2,0,0,Math.PI*2);
    c.stroke();
  }
  const freehand=()=>['pen','marker','eraser'].includes(tool);
  live.addEventListener('pointerdown',e=>{
    if(e.button>0)return;
    if(placing)return;
    if(textBox){commitText();return}
    const p=at(e);
    if(tool==='text'){e.preventDefault();startText(p);return}
    e.preventDefault();live.setPointerCapture(e.pointerId);
    snap();down=p;pts=[p];
    if(freehand()&&tool!=='marker'){style(cx,pr(e));cx.beginPath();cx.arc(p.x,p.y,cx.lineWidth/2,0,Math.PI*2);cx.fill()}
  });
  const pr=e=>e.pointerType==='pen'&&e.pressure>0?.4+e.pressure*1.2:1;
  live.addEventListener('pointermove',e=>{
    if(!down)return;
    const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];
    if(freehand()){
      for(const ev of evs.length?evs:[e]){
        const p=at(ev),last=pts[pts.length-1];pts.push(p);
        if(tool==='marker'){   // the highlighter is drawn as one stroke on top, so it doesn't get darker where it overlaps itself
          lx.clearRect(0,0,W,H);style(lx);lx.globalAlpha=1;lx.beginPath();lx.moveTo(pts[0].x,pts[0].y);
          for(let i=1;i<pts.length-1;i++){const m={x:(pts[i].x+pts[i+1].x)/2,y:(pts[i].y+pts[i+1].y)/2};lx.quadraticCurveTo(pts[i].x,pts[i].y,m.x,m.y)}
          lx.lineTo(p.x,p.y);lx.stroke();live.style.opacity=.35;
        }else{
          style(cx,pr(ev));cx.beginPath();cx.moveTo(last.x,last.y);
          const prev=pts[pts.length-3];
          if(prev){const m1={x:(prev.x+last.x)/2,y:(prev.y+last.y)/2},m2={x:(last.x+p.x)/2,y:(last.y+p.y)/2};cx.moveTo(m1.x,m1.y);cx.quadraticCurveTo(last.x,last.y,m2.x,m2.y)}
          else cx.lineTo(p.x,p.y);
          cx.stroke();
        }
      }
    }else{
      const p=at(e);lx.clearRect(0,0,W,H);style(lx);live.style.opacity=1;shape(lx,down,p);
    }
  });
  const up=e=>{
    if(!down)return;
    const p=at(e);
    if(tool==='marker'){lx.clearRect(0,0,W,H);live.style.opacity=1;style(cx);cx.beginPath();cx.moveTo(pts[0].x,pts[0].y);
      for(let i=1;i<pts.length-1;i++){const m={x:(pts[i].x+pts[i+1].x)/2,y:(pts[i].y+pts[i+1].y)/2};cx.quadraticCurveTo(pts[i].x,pts[i].y,m.x,m.y)}
      cx.lineTo(p.x,p.y);if(pts.length<2)cx.lineTo(p.x+.1,p.y);cx.stroke()}
    else if(!freehand()){lx.clearRect(0,0,W,H);if(Math.hypot(p.x-down.x,p.y-down.y)>3){style(cx);shape(cx,down,p)}}
    down=null;pts=[];cx.globalAlpha=1;cx.globalCompositeOperation='source-over';changed();
  };
  live.addEventListener('pointerup',up);live.addEventListener('pointercancel',up);

  // text
  let textBox=null,textAt=null;
  function startText(p){
    const r=sheet.getBoundingClientRect(),k=r.width/W;
    textAt=p;textBox=el('textarea','wb-text');textBox.rows=1;
    const fs=Math.max(18,size*4+12);
    Object.assign(textBox.style,{left:(p.x*k)+'px',top:(p.y*k-fs*k*.2)+'px',fontSize:(fs*k)+'px',color:color});
    textBox.dataset.fs=fs;textBox.placeholder=T('Type, then click outside');
    textBox.onkeydown=ev=>{if(ev.key==='Escape'){textBox.value='';commitText()}};
    textBox.oninput=()=>{textBox.style.height='auto';textBox.style.height=textBox.scrollHeight+'px'};
    sheet.append(textBox);textBox.focus();
    textBox.onblur=()=>setTimeout(()=>{if(textBox&&document.activeElement!==textBox)commitText()},120);
  }
  function commitText(){
    if(!textBox)return;const t=textBox.value,fs=+textBox.dataset.fs,p=textAt;textBox.remove();textBox=null;
    if(!t.trim())return;
    snap();cx.globalCompositeOperation='source-over';cx.globalAlpha=1;cx.fillStyle=color;cx.textBaseline='top';
    cx.font='600 '+fs+'px "Plus Jakarta Sans", system-ui, sans-serif';
    t.split('\n').forEach((line,i)=>cx.fillText(line,p.x,p.y+i*fs*1.25));
    changed();
  }

  // a picture: placed on top, dragged and resized, then drawn onto the board
  let placing=null;
  function placePicture(src){
    const im=new Image();
    im.onload=()=>{
      if(placing)placing.place();
      const k0=Math.min(1,(W*.7)/im.width,(H*.8)/im.height);
      let pw=im.width*k0,ph=im.height*k0,px=(W-pw)/2,py=(H-ph)/2;
      const box=el('div','wb-place');const img=el('img');img.src=src;img.alt='';img.draggable=false;
      const handle=el('span','wb-handle');handle.title=T('Drag to resize');
      const pbar=el('div','wb-place-bar');
      const ok=btn('btn primary',T('Place picture'),()=>placing.place()),no=btn('btn',T('Cancel'),()=>placing.cancel());
      pbar.append(ok,no);box.append(img,handle,pbar);sheet.append(box);
      const lay=()=>{const k=sheet.getBoundingClientRect().width/W;Object.assign(box.style,{left:px*k+'px',top:py*k+'px',width:pw*k+'px',height:ph*k+'px'})};
      lay();
      let drag=null;
      box.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;e.preventDefault();box.setPointerCapture(e.pointerId);
        drag={mode:e.target===handle?'size':'move',sx:e.clientX,sy:e.clientY,px,py,pw,ph}});
      box.addEventListener('pointermove',e=>{if(!drag)return;const k=sheet.getBoundingClientRect().width/W,dx=(e.clientX-drag.sx)/k,dy=(e.clientY-drag.sy)/k;
        if(drag.mode==='move'){px=drag.px+dx;py=drag.py+dy}else{const s=Math.max(40/drag.pw,(drag.pw+dx)/drag.pw);pw=drag.pw*s;ph=drag.ph*s}lay()});
      box.addEventListener('pointerup',()=>{drag=null});
      window.addEventListener('resize',lay);
      placing={
        place(){snap();cx.globalCompositeOperation='source-over';cx.globalAlpha=1;cx.drawImage(im,px,py,pw,ph);this.cancel();changed()},
        cancel(){box.remove();window.removeEventListener('resize',lay);placing=null}
      };
    };
    im.onerror=()=>toast('That picture could not be opened.');
    im.src=src;
  }
}

/* ---------- start ---------- */
search.oninput=()=>{filter=search.value.trim();drawList()};
document.querySelectorAll('[data-nt]').forEach(b=>b.onclick=async()=>{await flush();create(b.dataset.nt==='new-board'?'board':'note')});
document.addEventListener('paste',e=>{   // paste a screenshot straight into a page
  if(TOUR||!cur||document.querySelector('.wb'))return;
  const files=[...(e.clipboardData||{}).files||[]].filter(f=>f.type.startsWith('image/'));
  if(!files.length)return;e.preventDefault();
  addFiles(files.map((f,i)=>new File([f],f.name&&f.name!=='image.png'?f.name:'pasted-'+Date.now()+(i?'-'+i:'')+'.png',{type:f.type})));
});
load();
})();
