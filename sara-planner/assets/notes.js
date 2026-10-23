/* Study notebook (notes.php): one notebook for every subject in the Study tab. Inside a notebook every chapter has its own
   pages of notes, whiteboards and study files. Saves through noteapi.php.
   A notes page saves by itself a moment after you stop typing. The whiteboard is a drawing (canvas) that is
   saved as a picture: pen, marker, eraser, lines, arrows, shapes, text and pictures you can draw over. */
(function(){
const box=document.getElementById('notes');if(!box)return;
const CSRF=box.dataset.csrf, TOUR=!!box.dataset.tour, T=s=>(window.SPL_T?window.SPL_T(s):s);
const $=id=>document.getElementById(id);
const listEl=$('ntList'), main=$('ntMain'), search=$('ntSearch'), useEl=$('ntUse');
const NO_LIMITS={file_max:10485760,total_max:104857600,files_max:200,used:{count:0,bytes:0},types:[]};
let S={notes:[],books:[],files:[],limits:NO_LIMITS};
/* Where you are: bk is the open notebook (a Study subject's id; 0 = "Other", pages that are in no notebook; null = the shelf of
   all notebooks). chap is the open chapter of that notebook (its id; -1 = pages in the notebook but in no chapter; 0 = the notebook). */
let cur=null, bk=null, chap=0, filter='', saveTimer=null, saving=null;

// ruled paper: keep the 32px line height and the 1px rules a whole number of screen pixels at any browser zoom
function snapRules(){
  const d=window.devicePixelRatio||1, st=document.documentElement.style;
  st.setProperty('--nt-lh',Math.round(32*d)/d+'px');
  st.setProperty('--nt-rule',Math.max(1,Math.round(d))/d+'px');
  const b=document.getElementById('ntBody');if(b)fit(b);
}
snapRules();window.addEventListener('resize',snapRules);

function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
function btn(cls,text,fn,title){const b=el('button',cls,text);b.type='button';if(title){b.title=T(title);b.setAttribute('aria-label',T(title))}if(fn)b.onclick=fn;return b}
/** Put a line icon (and a label) in a button or link. */
function withIcon(node,name,label){node.insertAdjacentHTML('afterbegin',ico(name));if(label)node.append(label);return node}
function mine(e){e.setAttribute('translate','no');return e}   // what people wrote themselves is never translated
const toast=m=>{const t=$('toast');if(!t)return;t.textContent=T(m);t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{t.hidden=true},4500)};
const mb=b=>b>=1048576?(b/1048576).toFixed(b>=10485760?0:1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
const count=(n,one,many)=>n+' '+T(n===1?one:many);
function when(ts){const d=new Date(ts*1000),now=new Date();
  return d.toDateString()===now.toDateString()?d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString([],{day:'numeric',month:'short'})}
/** Delete buttons ask twice: the first click arms them for a few seconds. */
function armed(b){if(b.dataset.armed)return true;b.dataset.armed='1';const old=b.textContent;b.textContent=T('Sure? Click again');
  setTimeout(()=>{delete b.dataset.armed;b.textContent=old},3500);return false}

/** Visitor tour (Look inside): a few sample notebooks and pages, view only. Nothing is sent to noteapi.php. */
function tourData(){
  const now=Math.floor(Date.now()/1000),h=3600;
  const books=[
    {id:1,name:'Algorithms',c:'school',chapters:[{id:11,title:'Sorting'},{id:12,title:'Graphs'}]},
    {id:2,name:'Databases',c:'fun',chapters:[{id:21,title:'Normal forms'},{id:22,title:'SQL joins'}]},
    {id:3,name:'OOP',c:'transport',chapters:[{id:31,title:'Inheritance'}]}];
  const notes=[
    {id:1,kind:'note',title:'Normal forms',sid:2,cid:21,paper:'lined',updated:now-2*h,board:'',files:[],
      body:'1NF: every column holds a single value, no repeating groups.\n2NF: 1NF + every non-key column depends on the whole key.\n3NF: 2NF + no non-key column depends on another non-key column.\n\nExam tip: practise turning a messy table into 3NF step by step.'},
    {id:2,kind:'note',title:'Merge sort vs quick sort',sid:1,cid:11,paper:'grid',updated:now-26*h,board:'',files:[],
      body:'Merge sort: always O(n log n), needs extra memory, stable.\nQuick sort: O(n log n) on average, O(n²) worst case, sorts in place.\n\nTo revise: draw the recursion tree for [5, 2, 9, 1].'},
    {id:3,kind:'note',title:'OOP lab report outline',sid:3,cid:0,paper:'dots',updated:now-50*h,board:'',files:[],
      body:'1. Aim of the lab\n2. Class diagram\n3. Code and what each class does\n4. Test results\n5. What I would improve'}
  ];
  return {notes,books,files:[],limits:NO_LIMITS};
}
const TOUR_DATA=TOUR?tourData():null;
const TOUR_MSG='This is a preview with sample pages. Create a free account to write your own notes.';
async function api(action,data={}){
  if(TOUR){
    if(action==='note.list')return {ok:true,notes:TOUR_DATA.notes.map(summary),books:TOUR_DATA.books,files:[],limits:TOUR_DATA.limits};
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

/* ---------- notebooks, chapters and pages ---------- */
function summary(n){return {id:n.id,kind:n.kind,title:n.title,sid:n.sid,cid:n.cid,snippet:(n.body||'').replace(/\s+/g,' ').slice(0,90),
  updated:n.updated,thumb:n.kind==='board'?n.board:''}}
function upsert(n){const s=summary(n),i=S.notes.findIndex(x=>x.id===n.id);if(i<0)S.notes.unshift(s);else S.notes[i]=s;S.notes.sort((a,b)=>b.updated-a.updated||b.id-a.id)}
const bookOf=id=>S.books.find(b=>b.id===id)||null;
const chapOf=(b,id)=>b?b.chapters.find(c=>c.id===id)||null:null;
const bookName=id=>{const b=bookOf(id);return b?b.name:T('Other')};
const filesOf=id=>S.files.filter(f=>f.note===id);
/** The pages of a notebook's chapter (cid -1: the ones in no chapter; undefined: the whole notebook). */
const pagesIn=(sid,cid)=>S.notes.filter(n=>n.sid===sid&&(cid===undefined||n.cid===(cid>0?cid:0)));
const fileCount=pages=>{const ids=new Set(pages.map(n=>n.id));return S.files.filter(f=>ids.has(f.note)).length};
/** "3 chapters · 5 pages · 2 files" for a notebook (cid undefined) or one of its chapters. */
function stats(sid,cid){
  const pages=pagesIn(sid,cid),b=bookOf(sid),parts=[];
  if(cid===undefined&&b)parts.push(count(b.chapters.length,'chapter','chapters'));
  parts.push(count(pages.length,'page','pages'),count(fileCount(pages),'file','files'));
  return parts.join(' · ');
}
async function refresh(){const r=await api('note.list');S.notes=r.notes;S.books=r.books;S.files=r.files;S.limits=r.limits}

function setUrl(){
  let q='';
  if(cur)q='?page='+cur.id;
  else if(bk!==null)q='?nb='+(bk||'other')+(chap>0?'&ch='+chap:'');
  history.replaceState(null,'','notes.php'+q);
}
/** Open a notebook (b), one of its chapters (c), or the shelf of notebooks (b null). */
async function go(b,c=0){
  await flush();
  cur=null;bk=b;chap=b===0?-1:c;setUrl();render();
  if(window.innerWidth<760)main.scrollIntoView({behavior:'smooth',block:'start'});
}
function render(){
  if(cur)bk=cur.sid;
  if(!cur&&bk>0&&!bookOf(bk)){bk=null;chap=0}                     // the subject was deleted in the Study tab
  if(!cur&&bk>0&&chap>0&&!chapOf(bookOf(bk),chap))chap=0;          // so was the chapter
  box.dataset.view=cur?'page':bk===null?'shelf':'book';
  document.querySelectorAll('[data-nt]').forEach(b=>b.hidden=bk===null);   // new pages go into the open notebook
  drawSide();
  if(cur)drawNote();else if(bk===null)drawShelf();else if(chap===0)drawBook();else drawChapter();
}

/* ---------- the sidebar: recent pages, or the chapters of the open notebook ---------- */
function pageLi(n,showBook){
  const li=el('li'),b=el('button','nt-item'+(cur&&cur.id===n.id?' on':''));b.type='button';b.onclick=()=>open(n.id);
  const ic=el('span','nt-ic');ic.innerHTML=ico(n.kind==='board'?'board':'note');
  if(n.thumb){ic.textContent='';const im=el('img');im.src=n.thumb;im.alt='';im.loading='lazy';ic.append(im);ic.classList.add('thumb')}
  const tx=el('span','nt-tx');
  tx.append(mine(el('b',null,n.title||T(n.kind==='board'?'Untitled whiteboard':'Untitled page'))));
  const meta=el('small'),fc=filesOf(n.id).length;
  if(showBook&&n.sid)meta.append(mine(el('span','nt-sub',bookName(n.sid))));
  meta.append(el('span',null,when(n.updated)+(fc?' · '+count(fc,'file','files'):'')));
  tx.append(meta);
  if(n.snippet)tx.append(mine(el('span','nt-snip',n.snippet)));
  b.append(ic,tx);li.append(b);return li;
}
function drawSide(){
  const q=filter.toLowerCase();
  const ch=n=>{const c=chapOf(bookOf(n.sid),n.cid);return c?c.title:''};
  const match=n=>!q||(n.title+' '+n.snippet+' '+(n.sid?bookName(n.sid):'')+' '+ch(n)).toLowerCase().includes(q);
  listEl.replaceChildren();
  if(bk===null){
    const list=S.notes.filter(match).slice(0,q?60:10);
    if(list.length)listEl.append(el('li','nt-sec',T(q?'Search results':'Recent pages')));
    else listEl.append(el('li','empty',T(S.notes.length?'No pages match.':'No pages yet. Open a notebook to start one.')));
    list.forEach(n=>listEl.append(pageLi(n,true)));
  }else{
    const b=bookOf(bk);
    const top=el('li','nt-bk');
    const back=btn('nt-bk-back',null,()=>go(null));withIcon(back,'back',T('All notebooks'));
    const name=btn('nt-bk-name',null,()=>go(bk,bk?0:-1));
    if(b)name.style.setProperty('--sc','var(--c-'+b.c+')');
    name.append(mine(el('b',null,b?b.name:T('Other'))));
    top.append(back,name);listEl.append(top);
    const groups=b?b.chapters.map(c=>({id:c.id,title:c.title})):[];
    groups.push({id:-1,title:T('General notes')});
    let any=false;
    for(const g of groups){
      const pages=pagesIn(bk,g.id).filter(match);
      if(g.id===-1&&!pages.length&&b)continue;                     // no loose pages: no "General notes" heading
      if(q&&!pages.length)continue;
      any=true;
      const li=el('li','nt-grp');
      if(b){
        const h=btn('nt-grp-h'+(chap===g.id?' on':''),null,()=>go(bk,g.id));
        const t=el('span',null,g.title);if(g.id>0)mine(t);
        h.append(t,el('small',null,String(pagesIn(bk,g.id).length)));li.append(h);
      }
      const ul=el('ul','nt-grp-l');pages.forEach(n=>ul.append(pageLi(n)));li.append(ul);listEl.append(li);
    }
    if(!any)listEl.append(el('li','empty',T(q?'No pages match.':'No chapters yet. Add the first one below.')));
    if(b&&!q){const li=el('li');li.append(chapterForm(b));listEl.append(li)}
  }
  const u=S.limits.used;
  useEl.textContent=u.count?T('Files')+': '+mb(u.bytes)+' / '+mb(S.limits.total_max):'';
}
/** A box to add a chapter to a notebook: it becomes a chapter of that subject in the Study tab too. */
function chapterForm(b){
  const f=el('form','nt-addch'),inp=el('input');inp.placeholder=T('+ Add a chapter');inp.maxLength=150;inp.autocomplete='off';
  inp.setAttribute('aria-label',T('Add a chapter to')+' '+b.name);
  const add=el('button','btn sm',T('Add'));add.type='submit';f.append(inp,add);
  f.onsubmit=async e=>{e.preventDefault();const t=inp.value.trim();if(!t)return;
    try{const r=await api('chapter.add',{subject_id:b.id,title:t});b.chapters.push(r.chapter);render()}catch(err){toast(err.message)}};
  return f;
}
/** "Notebooks › Databases › Normal forms": every step but the last (when plainLast) takes you back there. */
function trail(plainLast){
  const parts=[[T('Notebooks'),()=>go(null),false]];
  if(bk!==null){const b=bookOf(bk);parts.push([b?b.name:T('Other'),()=>go(bk,bk?0:-1),!!b])}
  if(bk>0&&chap!==0){const c=chapOf(bookOf(bk),chap);parts.push(c?[c.title,()=>go(bk,chap),true]:[T('General notes'),()=>go(bk,-1),false])}
  const nav=el('nav','nt-crumb');nav.setAttribute('aria-label',T('Where you are'));
  parts.forEach(([label,fn,user],i)=>{
    if(i)nav.append(el('span','nt-crumb-s','›'));
    const last=i===parts.length-1&&plainLast;
    const e=last?el('span','nt-crumb-here',label):btn('nt-crumb-l',label,fn);
    nav.append(user?mine(e):e);
  });
  return nav;
}

/* ---------- the shelf of notebooks ---------- */
function drawShelf(){
  main.replaceChildren();
  const w=el('div','nt-welcome');
  w.append(el('h2',null,T('Your notebooks')),el('p','muted',T('There is a notebook for every subject in your Study tab. Open one to take notes and keep files chapter by chapter. Everything here is private. Only you can see it.')));
  const shelf=el('div','nt-shelf');
  const card=(b,sid)=>{
    const c=btn('nt-book'+(b?'':' other'),null,()=>go(sid,sid?0:-1));
    if(b)c.style.setProperty('--sc','var(--c-'+b.c+')');
    const ci=el('span','nt-book-i');ci.innerHTML=ico('notebook');
    c.append(ci,mine(el('b',null,b?b.name:T('Other'))),el('small',null,b?stats(sid):count(pagesIn(0).length,'page','pages')));
    if(!b)c.append(el('span','nt-book-d',T('Pages that are not in a notebook yet.')));
    return c;
  };
  S.books.forEach(b=>shelf.append(card(b,b.id)));
  if(pagesIn(0).length)shelf.append(card(null,0));
  const nf=el('form','nt-book nt-new'),ni=el('input');ni.placeholder=T('New notebook, e.g. Linear Algebra');ni.maxLength=80;ni.autocomplete='off';ni.setAttribute('aria-label',T('Notebook name'));
  const nb=el('button','btn primary sm',T('Create notebook'));nb.type='submit';
  nf.append(el('b',null,T('New notebook')),ni,nb);
  nf.onsubmit=async e=>{e.preventDefault();const name=ni.value.trim();if(!name)return;
    try{const r=await api('book.add',{name});S.books.push(r.book);toast('Notebook added. It is in your Study tab too.');go(r.book.id,0)}catch(err){toast(err.message)}};
  shelf.append(nf);
  w.append(shelf,el('p','nt-limit',T('Up to')+' '+mb(S.limits.file_max)+' '+T('a file')+' · '+mb(S.limits.total_max)+' '+T('in total')));
  main.append(w);
}

/* ---------- one notebook: its chapters ---------- */
function drawBook(){
  main.replaceChildren();
  const b=bookOf(bk),w=el('div','nt-overview');
  w.append(trail(true));
  w.style.setProperty('--sc','var(--c-'+b.c+')');
  const h=el('div','nt-ov-h');
  h.append(mine(el('h2',null,b.name)),el('p','muted',stats(bk)));
  w.append(h);
  const chs=el('div','nt-chcards');
  const chCard=(id,title,user)=>{
    const c=btn('nt-chcard',null,()=>go(bk,id));
    const t=el('b',null,title);if(user)mine(t);
    c.append(t,el('small',null,stats(bk,id)));return c;
  };
  b.chapters.forEach(c=>chs.append(chCard(c.id,c.title,true)));
  if(pagesIn(bk,-1).length)chs.append(chCard(-1,T('General notes'),false));
  if(chs.children.length)w.append(el('h3','nt-ov-t',T('Chapters')),chs);
  else w.append(el('p','nt-hint',T('No chapters yet. Add the chapters of this subject (the same ones are in your Study tab) and every chapter gets its own pages and files.')));
  w.append(chapterForm(b));
  // files that belong to the notebook but to no chapter
  w.append(filesBox(S.files.filter(f=>pagesIn(bk,-1).some(n=>n.id===f.note)),{subject_id:bk},T('General files')));
  main.append(w);
}

/* ---------- one chapter: its pages and files ---------- */
function drawChapter(){
  main.replaceChildren();
  const b=bookOf(bk),c=chapOf(b,chap),w=el('div','nt-overview');
  w.append(trail(true));
  if(b)w.style.setProperty('--sc','var(--c-'+b.c+')');
  const h=el('div','nt-ov-h');
  const title=c?c.title:T(b?'General notes':'Other pages');
  const t=el('h2',null,title);if(c)mine(t);
  h.append(t,el('p','muted',stats(bk,chap)));w.append(h);
  const pages=pagesIn(bk,chap);
  const ph=el('div','nt-ov-bar');ph.append(el('h3','nt-ov-t',T('Pages')));
  const mk=(kind,icon,label)=>{const x=btn('btn sm',null,()=>create(kind));return withIcon(x,icon,T(label))};
  const bar=el('span','nt-ov-btns');bar.append(mk('note','note','New page'),mk('board','board','New whiteboard'));ph.append(bar);
  w.append(ph);
  if(pages.length){const ul=el('ul','nt-plist');pages.forEach(n=>ul.append(pageLi(n)));w.append(ul)}
  else w.append(el('p','nt-hint',T('No pages here yet. Write the notes for this chapter on a page, or draw on a whiteboard.')));
  if(b)w.append(filesBox(S.files.filter(f=>pages.some(n=>n.id===f.note)),chap>0?{chapter_id:chap}:{subject_id:bk}));
  main.append(w);
}

async function load(){
  try{await refresh()}catch(e){listEl.replaceChildren(el('li','empty',T(e.message)));return}
  const want=+box.dataset.open,qs=new URLSearchParams(location.search);
  if(qs.get('chapter')&&qs.get('new')){   // "Notes" / "Whiteboard" on a chapter in the Study tab
    const n=await create(qs.get('new')==='board'?'board':'note',{chapter_id:+qs.get('chapter')});
    if(!n)render();
  }else if(want&&S.notes.some(n=>n.id===want))open(want);
  else if(qs.get('nb')){
    const sid=qs.get('nb')==='other'?0:+qs.get('nb');
    const ch=+qs.get('ch')||0;
    if(sid===0||bookOf(sid)){bk=sid;chap=sid===0?-1:(chapOf(bookOf(sid),ch)?ch:0)}
    render();
  }else render();
}

async function create(kind,extra={}){
  const {picture,...place}=extra;
  if(!('chapter_id' in place)&&!('subject_id' in place)){if(chap>0)place.chapter_id=chap;else if(bk>0)place.subject_id=bk}   // into the notebook you are in
  try{
    const r=await api('note.add',{kind,...place});
    cur=r.note;cur.files=cur.files||[];upsert(cur);bk=cur.sid;chap=cur.cid||-1;setUrl();render();
    if(kind==='board')openBoard(picture||null);else{const t=$('ntTitle');if(t&&!t.value)t.focus();else if($('ntBody'))$('ntBody').focus()}
    return r.note;
  }catch(e){toast(e.message)}
}
const acceptList=()=>S.limits.types.map(t=>'.'+t).join(',');

/* ---------- one page ---------- */
async function open(id){
  if(cur&&cur.id===id){return}
  await flush();
  try{const r=await api('note.get',{id});cur=r.note}catch(e){toast(e.message);return}
  bk=cur.sid;chap=cur.cid||-1;setUrl();render();
  if(window.innerWidth<760)main.scrollIntoView({behavior:'smooth',block:'start'});
}
function queueSave(){
  setState('Saving…');clearTimeout(saveTimer);saveTimer=setTimeout(flush,900);
}
async function flush(){
  clearTimeout(saveTimer);saveTimer=null;
  if(!cur||!cur.dirty)return saving;
  const n=cur,moved=n.move;n.dirty=false;n.move=false;
  const data={id:n.id,title:n.title,paper:n.paper};if(n.kind==='note')data.body=n.body;
  if(moved){data.subject_id=n.sid;data.chapter_id=n.cid}
  saving=api('note.save',data).then(r=>{n.updated=r.updated;upsert(n);drawSide();if(cur===n)setState('All saved')})
    .catch(e=>{n.dirty=true;if(moved)n.move=true;if(cur===n)setState('Not saved');toast(e.message)});
  return saving;
}
function setState(s){const e=$('ntState');if(e){e.textContent=T(s);e.dataset.s=s}}
window.addEventListener('beforeunload',e=>{if(cur&&cur.dirty){flush();e.preventDefault();e.returnValue=''}});

function head(n){
  const h=el('div','nt-head');
  let crumb=trail(false);h.append(crumb);
  const title=el('input','nt-title');title.id='ntTitle';title.placeholder=T(n.kind==='board'?'Whiteboard title':'Page title');title.value=n.title;title.maxLength=120;
  title.oninput=()=>{n.title=title.value;n.dirty=true;queueSave()};title.readOnly=TOUR;
  // which notebook and chapter the page is in: change them to move it
  const place=el('span','nt-where');mine(place);
  const bsel=el('select','nt-paper-pick');bsel.setAttribute('aria-label',T('Notebook'));
  const csel=el('select','nt-paper-pick');csel.setAttribute('aria-label',T('Chapter'));
  [...S.books.map(b=>[b.id,b.name]),[0,T('Other')]].forEach(([v,l])=>{const o=el('option',null,l);o.value=v;o.selected=n.sid===v;bsel.append(o)});
  const fillChapters=()=>{
    csel.replaceChildren();const b=bookOf(n.sid);
    const none=el('option',null,T('No chapter'));none.value=0;csel.append(none);
    if(b)b.chapters.forEach(c=>{const o=el('option',null,c.title);o.value=c.id;csel.append(o)});
    csel.value=n.cid;csel.hidden=!b;
  };
  fillChapters();
  const moved=()=>{n.move=true;n.dirty=true;bk=n.sid;chap=n.cid||-1;queueSave();drawSide();
    const nc=trail(false);crumb.replaceWith(nc);crumb=nc;pill()};
  bsel.onchange=()=>{n.sid=+bsel.value;n.cid=0;fillChapters();moved()};
  csel.onchange=()=>{n.cid=+csel.value;moved()};
  bsel.disabled=csel.disabled=TOUR;
  place.append(bsel,csel);
  const row=el('div','nt-row');
  row.append(place);
  if(n.kind==='note'){
    const paper=el('select','nt-paper-pick');paper.setAttribute('aria-label',T('Paper'));
    [['lined','Lined paper'],['grid','Squared paper'],['dots','Dotted paper'],['plain','Plain paper']].forEach(([v,l])=>{const o=el('option',null,T(l));o.value=v;o.selected=n.paper===v;paper.append(o)});
    paper.onchange=()=>{n.paper=paper.value;n.dirty=true;$('ntBody').dataset.paper=n.paper;queueSave()};paper.disabled=TOUR;
    row.append(paper);
  }
  const st=el('span','nt-state');st.id='ntState';st.textContent=T('All saved');
  const del=btn('btn ghost nt-del',T('Delete page'),async e=>{if(!armed(e.currentTarget))return;
    try{clearTimeout(saveTimer);n.dirty=false;await api('note.delete',{id:n.id});S.notes=S.notes.filter(x=>x.id!==n.id);
      const gone=filesOf(n.id);S.files=S.files.filter(f=>f.note!==n.id);
      S.limits.used.count-=gone.length;S.limits.used.bytes-=gone.reduce((a,f)=>a+f.size,0);
      cur=null;toast('Page deleted.');go(bk,chap)}catch(err){toast(err.message)}});
  if(!TOUR)row.append(st,del);
  h.append(title,row);
  // a link to the chapter in the Study tab
  const pill=()=>{
    h.querySelector('.nt-chapter')?.remove();
    const c=chapOf(bookOf(n.sid),n.cid);if(!c)return;
    const a=el('a','nt-chapter');a.href=(TOUR?'tour':'index')+'.php?tab=study';const cl=el('span',null,T('Material for chapter')+' ');cl.insertAdjacentHTML('afterbegin',ico('book'));a.append(cl,mine(el('b',null,c.title)));h.append(a);
  };
  pill();
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
    const draw=btn('btn primary nt-draw',null,()=>openBoard());withIcon(draw,'pencil',T('Open the whiteboard'));
    main.append(wrap,draw);
  }
  if(!TOUR)main.append(filesBox(n.files,{note_id:n.id}));
}
function fit(t){t.style.height='auto';t.style.height=Math.max(420,t.scrollHeight+40)+'px'}

/* ---------- study files ---------- */
/** The files of a page, chapter or notebook, and a way to add more. dest says where new files go: {note_id}, {chapter_id} or {subject_id}. */
function filesBox(files,dest,label){
  const sec=el('section','nt-files');
  const h=el('div','nt-files-h');
  h.append(el('h2',null,label||T('Study files & pictures')));
  const add=btn('btn',null,()=>pick.click());withIcon(add,'clip',T('Add files'));
  const pick=el('input');pick.type='file';pick.multiple=true;pick.hidden=true;pick.accept=acceptList();
  pick.onchange=()=>{addFiles([...pick.files],dest);pick.value=''};
  h.append(add,pick);sec.append(h);
  const drop=el('div','nt-drop');drop.id='ntDrop';
  drop.append(el('span',null,T('Drop files here, or use “Add files”.')+' '+T('PDF, Word, PowerPoint, Excel, pictures, music and short videos, up to')+' '+mb(S.limits.file_max)+' '+T('each.')));
  ['dragenter','dragover'].forEach(t=>sec.addEventListener(t,e=>{e.preventDefault();sec.classList.add('over')}));
  ['dragleave','drop'].forEach(t=>sec.addEventListener(t,e=>{if(t==='dragleave'&&sec.contains(e.relatedTarget))return;e.preventDefault();sec.classList.remove('over')}));
  sec.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files.length)addFiles([...e.dataTransfer.files],dest)});
  sec.append(drop);
  const pics=el('div','nt-pics');pics.id='ntPics';
  const docs=el('ul','nt-docs');docs.id='ntDocs';
  sec.append(pics,docs);
  files.forEach(f=>showFile(f,pics,docs));
  return sec;
}
/** The page a file is on, as a link (shown where files of several pages are listed together). */
function pageLink(f){
  const n=S.notes.find(x=>x.id===f.note);if(!n)return null;
  return mine(btn('linkbtn',n.title||T(n.kind==='board'?'Untitled whiteboard':'Untitled page'),()=>open(f.note),'Open the page this file is on'));
}
function showFile(f,pics,docs){
  pics=pics||$('ntPics');docs=docs||$('ntDocs');if(!pics||!docs)return;
  const where=cur?null:pageLink(f);
  if(f.kind==='image'){
    const fig=el('figure','nt-pic');fig.dataset.id=f.id;
    const a=el('a');a.href=f.url;a.target='_blank';a.rel='noopener';
    const im=el('img');im.src=f.url;im.alt=f.name;im.loading='lazy';a.append(im);a.onclick=e=>{e.preventDefault();lightbox(f)};
    const cap=el('figcaption');cap.append(mine(el('span',null,f.name)));
    const tools=el('span','nt-pic-tools');
    const dr=btn('linkbtn',null,()=>drawOn(f));withIcon(dr,'pencil',T('Draw on it'));tools.append(dr,fileDel(f));
    cap.append(tools);if(where)cap.append(where);fig.append(a,cap);pics.append(fig);return;
  }
  const li=el('li','nt-doc');li.dataset.id=f.id;
  const icon={audio:'music',video:'video',image:'image'}[f.kind]||'file';
  const a=el('a','nt-doc-name');a.href=f.url+(['pdf','audio','video'].includes(f.kind)?'':'&dl=1');a.target='_blank';a.rel='noopener';
  const di=el('span','nt-doc-i');di.innerHTML=ico(icon);a.append(di,mine(el('span',null,f.name)),el('small',null,mb(f.size)));
  const r=el('div','nt-doc-r');
  const dl=el('a','linkbtn',T('Download'));dl.href=f.url+'&dl=1';
  if(where)r.append(where);
  r.append(dl,fileDel(f));
  li.append(a,r);
  if(f.kind==='audio'){const au=el('audio');au.controls=true;au.preload='none';au.src=f.url;li.append(au)}
  if(f.kind==='video'){const v=el('video');v.controls=true;v.preload='metadata';v.src=f.url;li.append(v)}
  docs.append(li);
}
function fileDel(f){
  return btn('linkbtn nt-x',T('Delete'),async e=>{if(!armed(e.currentTarget))return;
    try{const r=await api('file.delete',{id:f.id});S.limits.used=r.used;
      S.files=S.files.filter(x=>x.id!==f.id);
      if(cur){cur.files=cur.files.filter(x=>x.id!==f.id);upsert(cur)}
      drawSide();
      if(cur)document.querySelectorAll('[data-id="'+f.id+'"]').forEach(x=>{if(x.closest('.nt-files'))x.remove()});
      else render();   // the chapter's list and counts
    }catch(err){toast(err.message)}});
}
/** Upload files. dest: {note_id} (default: the open page), or {chapter_id} / {subject_id}: they go on that chapter's or notebook's files page (made the first time). */
async function addFiles(files,dest){
  if(!dest&&cur)dest={note_id:cur.id};
  if(!dest)return;
  if(TOUR){toast(TOUR_MSG);return}
  const n=cur,max=S.limits.file_max,ok=new Set(S.limits.types);
  for(const file of files){
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(!ok.has(ext)){toast(file.name+': '+T("this kind of file can't be added."));continue}
    if(file.size>max){toast(file.name+': '+T('too big. The most is')+' '+mb(max)+'.');continue}
    const row=el('li','nt-doc nt-up');row.append(mine(el('span',null,file.name)));const bar=el('progress');bar.max=1;bar.value=0;row.append(bar);
    const docs=$('ntDocs');if(docs&&cur===n)docs.prepend(row);
    const fd=new FormData();for(const k in dest)fd.append(k,dest[k]);fd.append('file',file);
    try{
      const r=await upload('file.add',fd,p=>{bar.value=p});
      S.limits.used=r.used;S.files.push(r.file);
      if(!S.notes.some(x=>x.id===r.page))await refresh();   // a page was made for the file
      row.remove();
      if(n&&dest.note_id===n.id){n.files.push(r.file);n.updated=Math.floor(Date.now()/1000);upsert(n);if(cur===n)showFile(r.file)}
      else if(cur===n)render();
      drawSide();
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
/** A new whiteboard with this picture on it, ready to draw over (labelling a diagram, sketching over a reference). It goes where the picture is. */
async function drawOn(f){
  await flush();
  const title=f.name.replace(/\.[^.]+$/,''),p=S.notes.find(x=>x.id===f.note);
  create('board',{title,picture:f.url,...(p&&p.cid?{chapter_id:p.cid}:{subject_id:p?p.sid:0})});
}

/* ---------- the whiteboard ---------- */
const W=1600,H=1000;
const COLORS=['#141414','#ffffff','#E5484D','#F76B15','#FFC53D','#46A758','#0090FF','#6A4DC4','#D6409F','#8D6E63'];
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
      n.board=r.board;n.updated=r.updated;upsert(n);drawSide();st.textContent=T('All saved');
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
search.oninput=()=>{filter=search.value.trim();drawSide()};
document.querySelectorAll('[data-nt]').forEach(b=>b.onclick=async()=>{await flush();create(b.dataset.nt==='new-board'?'board':'note')});
document.addEventListener('paste',e=>{   // paste a screenshot straight into a page
  if(TOUR||!cur||document.querySelector('.wb'))return;
  const files=[...(e.clipboardData||{}).files||[]].filter(f=>f.type.startsWith('image/'));
  if(!files.length)return;e.preventDefault();
  addFiles(files.map((f,i)=>new File([f],f.name&&f.name!=='image.png'?f.name:'pasted-'+Date.now()+(i?'-'+i:'')+'.png',{type:f.type})));
});
load();
})();
