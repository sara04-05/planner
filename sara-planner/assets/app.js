(function(){
const TODAY=new Date();TODAY.setHours(0,0,0,0);
const pad=n=>String(n).padStart(2,'0');
const hm=m=>`${pad(Math.floor(m/60))}:${pad(m%60)}`;                 // 525 -> "08:45"
const durTxt=m=>m%60?(m>=60?`${Math.floor(m/60)}h ${m%60}m`:`${m} min`):`${m/60}h`;
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const wdi=d=>(d.getDay()+6)%7;
const weekStart=d=>addDays(d,-wdi(d));
const dim=(y,m)=>new Date(y,m+1,0).getDate();
const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
const M3=MON.map(m=>m.slice(0,3));
const WD=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const WDL=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const TI=iso(TODAY);
const fmtEur=new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'});
const eur=n=>fmtEur.format(n);
const eur0=n=>'€'+Math.round(n).toLocaleString('en-IE');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10);
const dayDiff=(a,b)=>Math.round((a-b)/864e5);
const short=d=>`${WD[wdi(d)]} ${d.getDate()} ${M3[d.getMonth()]}`;
const CATS=[['Food','food'],['Coffee','coffee'],['Transport','transport'],['Groceries','groceries'],['School','school'],['Phone','phone'],['Fun','fun'],['Clothes','clothes'],['Gifts','gifts'],['Work','work'],['Other','other']];
const cv=c=>`var(--c-${(CATS.find(x=>x[0]===c)||CATS[CATS.length-1])[1]})`;
const isoWeek=d=>{const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y0)/864e5+1)/7)};

/* ---------- talking to the server (api.php) ---------- */
const HT={uni:['Uni','school'],work:['Work','transport'],study:['Study','food'],personal:['Personal','fun'],health:['Health','groceries'],sleep:['Sleep','other']};
const CSRF=(document.querySelector('meta[name="csrf-token"]')||{}).content||'';
const PREFS='sara-planner-prefs';
let state=null;
let cursor=new Date(TODAY);
let blockMsg=null;

/** Only view preferences (tab, filters) live in the browser. All your data lives in the database. */
const save=()=>{try{localStorage.setItem(PREFS,JSON.stringify({tab:state.tab,taskFilter:state.taskFilter,expPeriod:state.expPeriod}))}catch(e){}};
function loadPrefs(){try{return JSON.parse(localStorage.getItem(PREFS))||{}}catch(e){return {}}}

/* How-to text only belongs in the visitor tour (Look inside); the real planner shows none of it */
const TOUR=!!window.SPL_TOUR,tip=s=>TOUR?s:'';

async function api(action,data={}){
  // Visitor tour: the planner is filled with sample data and nothing can be saved
  if(window.SPL_TOUR){
    if(action==='bootstrap')return window.SPL_TOUR();
    throw Object.assign(new Error('This is a preview, so nothing is saved. Log in or create a free account to use it.'),{status:403});
  }
  const res=await fetch('api.php?action='+encodeURIComponent(action),{
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json','X-CSRF-Token':CSRF},
    body:JSON.stringify(data)
  });
  let body={};try{body=await res.json()}catch(e){}
  if(res.status===401){location.href='login.php';throw new Error('Please log in again.')}
  if(!res.ok)throw Object.assign(new Error(body.error||'Something went wrong. Try again.'),{status:res.status});
  return body;
}
/** Save in the background. The page has already updated; if saving fails, show why and reload the real data. */
function sync(action,data){return api(action,data).catch(err=>{toast(err.message);reload()})}

let toastTimer=null;
function toast(msg){
  const t=document.getElementById('toast');if(!t)return;
  t.textContent=msg;t.hidden=false;clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{t.hidden=true},4500);
}
async function reload(){
  try{
    const data=await api('bootstrap');
    const p=loadPrefs();
    state={tab:'day',taskFilter:'open',expPeriod:'month',...p,...data,showAll:false};
    // Blog and Interests are pages of your notebooks now (Profile tab); other pages link here with ?tab=
    const want=new URLSearchParams(location.search).get('tab');
    if(want&&(want==='profile'||document.querySelector('nav[aria-label="Planner sections"] .tab[data-tab="'+want+'"]'))){state.tab=want;history.replaceState(null,'',location.pathname)}
    if(state.tab==='blog'||state.tab==='interests')state.tab='profile';
    if(typeof V[state.tab]!=='function')state.tab='day';   // a tab saved by an older version (e.g. Alerts) no longer exists
    if(window.SPL_TOUR&&state.tab==='profile')state.tab='day';
    render();
    if(GCAL_ON&&state.google&&state.google.connected&&state.google.needsSync&&!gcalBusy)gcalRun(true);
  }catch(err){
    view.innerHTML=`<p class="empty">Couldn't load your planner: ${esc(err.message)} <button class="linkbtn" onclick="location.reload()">Try again</button></p>`;
  }
}

/* ---------- money maths ---------- */
const sum=l=>l.reduce((s,e)=>s+e.amount,0);
function expIn(a,b){const A=iso(a),B=iso(b);return state.exps.filter(e=>e.date>=A&&e.date<=B)}
const mOv=(y,m)=>(state.months&&state.months[`${y}-${m}`])||{};
/** This month's income: the one you typed for that month, else your usual monthly income. */
const incomeFor=(y,m)=>{const v=mOv(y,m).income;return v==null?state.settings.income:v};
const monthStatus=(y,m)=>{const ty=TODAY.getFullYear(),cm=TODAY.getMonth();return y<ty||(y===ty&&m<cm)?'past':(y===ty&&m===cm)?'now':'future'};
/** Savings target per month. Only months with income count: the goal is shared evenly between them.
    What you did not save in a month (target minus the amount you confirmed) moves on to the next month,
    and anything saved extra lowers it. A finished month you have not confirmed counts as 0 saved. */
function targets(y){
  const goal=state.settings.goal,out=[];
  const act=[];for(let m=0;m<12;m++)if(incomeFor(y,m)>0)act.push(m);
  const base=act.length?goal/act.length:0;let carry=0;
  for(let m=0;m<12;m++){
    if(!act.includes(m)){out.push({t:0,active:false,custom:false,actual:null});continue}
    const o=mOv(y,m),auto=base+carry,t=o.save!=null?o.save:Math.max(0,auto);
    const eff=o.actual!=null?o.actual:(monthStatus(y,m)==='past'?0:t);
    out.push({t,active:true,custom:o.save!=null,actual:o.actual!=null?o.actual:null});
    carry=auto-eff;
  }
  return out;
}
function plan(y){
  const {goal}=state.settings, ty=TODAY.getFullYear(), cm=TODAY.getMonth(), tg=targets(y);
  let savedDone=0; const months=[];
  for(let m=0;m<12;m++){
    const income=incomeFor(y,m),status=monthStatus(y,m);
    const spent=sum(expIn(new Date(y,m,1),new Date(y,m,dim(y,m))));
    const t=tg[m],saved=status==='future'||!t.active?null:income-spent;
    if(status!=='future'&&t.actual!=null)savedDone+=t.actual;
    months.push({m,spent,income,saved,status,active:t.active,actual:t.actual,target:t.t,custom:t.custom,incCustom:mOv(y,m).income!=null});
  }
  const left=months.filter(o=>o.active&&o.status!=='past').length;
  const cur=months.find(o=>o.active&&o.status!=='past')||months[y===ty?cm:y>ty?0:11];
  return {y,months,target:goal/12,savedDone,need:cur.target,cur,left,goal};
}
function allowanceFor(y,m){return Math.max(0,incomeFor(y,m)-targets(y)[m].t)}
const dailyAllow=d=>allowanceFor(d.getFullYear(),d.getMonth())/dim(d.getFullYear(),d.getMonth());
function allowRange(a,b){let t=0;for(let d=new Date(a);d<=b;d=addDays(d,1))t+=dailyAllow(d);return t}

/* ---------- shared pieces ---------- */
const navBtns=()=>`<button class="btn" data-act="shift" data-n="-1" aria-label="Previous">‹</button><button class="btn" data-act="today">Today</button><button class="btn" data-act="shift" data-n="1" aria-label="Next">›</button>`;
const hdr=(eyebrow,title,right='')=>`<div class="vh"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div><div class="nav">${right}</div></div>`;
const catOpts=()=>CATS.map(c=>`<option>${c[0]}</option>`).join('');
const expForm=def=>`<form class="addform" data-form="exp" autocomplete="off">
  <input id="f-desc" name="desc" placeholder="What did you buy?" required aria-label="Description">
  <select id="f-cat" name="cat" aria-label="Category">${catOpts()}</select>
  <input id="f-amt" name="amount" type="number" step="0.01" min="0.01" placeholder="€0.00" required inputmode="decimal" aria-label="Amount in euros">
  <input id="f-date" name="date" type="date" value="${def}" required aria-label="Date">
  <button class="btn primary">Add</button></form>`;
function expRows(list,{showDate=true,limit=0}={}){
  const l=[...list].sort((a,b)=>b.date.localeCompare(a.date));
  const shown=limit?l.slice(0,limit):l;
  if(!shown.length)return tip(`<p class="empty">No expenses here yet.</p>`);
  return shown.map(e=>`<div class="row"><span class="dot" style="background:${cv(e.cat)}"></span><div class="grow"><div class="t">${esc(e.desc)}</div><div class="s">${e.cat}${showDate?' · '+short(parse(e.date)):''}</div></div><span class="amt">${eur(e.amount)}</span><button class="x" data-act="del-exp" data-id="${e.id}" aria-label="Delete ${esc(e.desc)}">×</button></div>`).join('')
   +(limit&&l.length>limit?`<p class="s" style="padding-top:8px"><button class="linkbtn" data-act="tab" data-tab="money">See all ${l.length} in Expenses →</button></p>`:'');
}
function catBars(list){
  const g={};list.forEach(e=>g[e.cat]=(g[e.cat]||0)+e.amount);
  const rows=Object.entries(g).sort((a,b)=>b[1]-a[1]);
  if(!rows.length)return tip(`<p class="empty">Nothing spent in this period.</p>`);
  const max=rows[0][1];
  return rows.map(([c,v])=>`<div class="catrow"><span class="lbl"><span class="dot" style="background:${cv(c)}"></span>${c}</span><span class="track"><span style="width:${(v/max*100).toFixed(1)}%;background:${cv(c)}"></span></span><span class="amt">${eur(v)}</span></div>`).join('');
}
function barChart(items,limit,{vals=true,limitLabel='limit'}={}){
  const max=Math.max(limit||0,...items.map(i=>i.v))*1.12||1;
  const cols=`grid-template-columns:repeat(${items.length},minmax(0,1fr))`;
  return `<div class="chart"><div class="plot${vals?' show-vals':''}" style="${cols}">
    ${items.map(i=>`<div class="b ${i.cls||''}" style="height:${Math.max(1.5,i.v/max*100).toFixed(1)}%" title="${i.label}: ${eur(i.v)}">${i.v?`<span>${eur0(i.v)}</span>`:''}</div>`).join('')}
    ${limit?`<div class="lim" style="bottom:calc((100% - var(--pt,0px))*${(limit/max).toFixed(3)})"><em>${limitLabel} ${eur0(limit)}</em></div>`:''}
  </div><div class="xl" style="${cols}">${items.map(i=>`<span class="${i.today?'today':''}">${items.length>7?String(i.label).slice(0,3):i.label}</span>`).join('')}</div></div>`;
}
const statusPill=(spent,allow)=>{if(allow<=0&&spent<=0)return '';if(spent>allow)return `<span class="pill bad">${eur(spent-allow)} over</span>`;const r=spent/allow;return r>.85?`<span class="pill warn">${eur(allow-spent)} left</span>`:`<span class="pill good">${eur(allow-spent)} left</span>`};
const meterCls=(spent,allow)=>spent>allow?'bad':spent>allow*.85?'warn':'good';
function taskRow(t){
  const d=parse(t.due),n=dayDiff(d,TODAY);
  const due=t.done?`<span class="pill muted">${short(d)}</span>`:n<0?`<span class="pill bad">Overdue</span>`:n===0?`<span class="pill warn">Today</span>`:n===1?`<span class="pill">Tomorrow</span>`:`<span class="pill muted">${short(d)}</span>`;
  return `<div class="row ${t.done?'done':''}"><input type="checkbox" data-chk="task" data-id="${t.id}" ${t.done?'checked':''} aria-label="Done: ${esc(t.title)}"><span class="prio ${t.priority}" title="${t.priority} priority"></span><div class="grow"><div class="t">${esc(t.title)}</div></div>${t.tag?`<span class="tag">${esc(t.tag)}</span>`:''}${due}<button class="x" data-act="del-task" data-id="${t.id}" aria-label="Delete ${esc(t.title)}">×</button></div>`;
}
function subjColor(title){
  const t=title.toLowerCase(),s=state.subjects.find(x=>t.includes(x.name.toLowerCase()));
  return s?s.c:'food';
}
function studyBlocks(di){
  const out=[];let cur=null;
  for(let h=0;h<24;h++){
    const e=resolveHour(di,h),txt=e&&e.text?e.text.trim():'';
    if(e&&e.type==='study'&&txt){
      const s=h*60+hS(e),z=h*60+hE(e);
      if(cur&&cur.title===txt&&cur.end===h&&cur.to===s){cur.end=h+1;cur.to=z}
      else{cur={date:di,start:h,end:h+1,from:s,to:z,title:txt,rep:e.rep};out.push(cur)}
    }else cur=null;
  }
  out.forEach(b=>{b.key=`${di}|${b.start}|${b.title}`;b.done=!!state.blockDone[b.key]});
  return out;
}
function blockRows(list){
  if(!list.length)return tip(`<p class="empty">No study blocks yet. Mark an hour as Study in Hour by hour, or add a block below.</p>`);
  return list.map(b=>`<div class="row ${b.done?'done':''}"><span class="time">${hm(b.from)}–${hm(b.to)}</span><span class="bar-mark" style="background:var(--c-${subjColor(b.title)})"></span><div class="grow"><div class="t">${esc(b.title)}</div><div class="s">${durTxt(b.to-b.from)}${b.rep?` · ↻ every ${WDL[wdi(parse(b.date))]}`:''}</div></div><input type="checkbox" data-chk="block" data-key="${esc(b.key)}" ${b.done?'checked':''} aria-label="Done: ${esc(b.title)}"><button class="x" data-act="del-block" data-date="${b.date}" data-start="${b.start}" data-end="${b.end}" data-confirm aria-label="Delete ${esc(b.title)}">×</button></div>`).join('');
}
function freeRanges(di){
  const r=[];let st=null;const from=di===TI?new Date().getHours():0;
  for(let h=from;h<=24;h++){
    const e=h<24?resolveHour(di,h):null,free=h<24&&!(e&&e.text&&e.text.trim());
    if(free&&st===null)st=h;
    if(!free&&st!==null){r.push([st,h]);st=null}
  }
  return r;
}
function freeChips(di){
  const r=freeRanges(di);
  return `<span>Free ${di===TI?'today':'on '+short(parse(di))}:</span>`+(r.length?r.map(([a,z])=>`<button type="button" data-act="pick-free" data-from="${a}" data-to="${Math.min(z,a+2)}" title="Use ${pad(a)}:00–${pad(Math.min(z,a+2))}:00">${pad(a)}–${pad(z)}</button>`).join(''):'<span>no free hours left</span>');
}
/** Hour + minute dropdowns (always 24-hour, whatever the browser's language). */
function timePick(name,h,h0,h1,lbl){
  let a='',b='';
  for(let i=h0;i<=h1;i++)a+=`<option value="${i}" ${i===h?'selected':''}>${pad(i)}</option>`;
  for(let m=0;m<60;m+=5)b+=`<option value="${m}" ${m===0?'selected':''}>${pad(m)}</option>`;
  return `<select id="bk-${name}" name="${name}" aria-label="${lbl} hour">${a}</select><b>:</b><select name="${name}_m" aria-label="${lbl} minutes">${b}</select>`;
}
function blockForm(di,showDate){
  const r=freeRanges(di),a=r.length?r[0][0]:9,z=r.length?Math.min(r[0][1],a+1):10;
  const msg=blockMsg?`<p class="formmsg ${blockMsg.ok?'ok':'err'}" role="status">${blockMsg.html}</p>`:'';
  return `<form class="blockform" data-form="block" autocomplete="off">
    <input id="bk-title" name="title" placeholder="Add extra study time, e.g. Calculus: series practice" required aria-label="What will you study?">
    ${showDate?`<input id="bk-date" name="date" type="date" value="${di}" required aria-label="Date">`:`<input type="hidden" name="date" value="${di}">`}
    <span class="bk-t">${timePick('from',a,0,23,'Start')}</span><span class="bk-to">to</span>
    <span class="bk-t">${timePick('to',z,1,24,'End')}</span>
    <button class="btn primary">Add block</button></form>${msg}
    <div class="freeh" id="freeh">${freeChips(di)}</div>`;
}

/* ---------- hour by hour ---------- */
// An hour can be only partly used: s = start minute (default 0), e = end minute (default 60)
// s can be negative: the hour starts early, in the gap the hour before left (lecture until 18:30 -> next thing from 18:30)
const hS=e=>e&&e.s?e.s:0,hE=e=>e&&e.e!=null?e.e:60;
const used=e=>!!(e&&e.text&&e.text.trim());
/** Minutes free at the end of the hour before (as a negative start), or 0. */
function gapBefore(di,h){const p=h>0?resolveHour(di,h-1):null;return used(p)&&hE(p)<60?hE(p)-60:0}
/** Where the next hour's entry starts, if it starts early inside this hour, else 60. */
function gapAfter(di,h){const n=h<23?resolveHour(di,h+1):null;return used(n)&&hS(n)<0?60+hS(n):60}
function resolveHour(di,h){
  const day=state.hours[di]||{},wk=state.weekly[wdi(parse(di))]||{};
  if(day[h])return {...day[h],rep:false};
  if(wk[h])return {...wk[h],rep:true};
  return null;
}
function setHour(di,h,patch){
  const day=state.hours[di]||(state.hours[di]={}),wd=wdi(parse(di)),wk=state.weekly[wd]||(state.weekly[wd]={});
  const src=day[h]?day:wk[h]?wk:day;
  let base=src[h];
  if(!base){base={text:'',type:'personal'};const g=gapBefore(di,h),a=gapAfter(di,h);if(g)base.s=g;if(a<60)base.e=a}
  const next={...base,...patch};
  if('text' in patch&&!next.text.trim())delete src[h];else src[h]=next;
}
function toggleRepeat(di,h){
  const day=state.hours[di]||(state.hours[di]={}),wd=wdi(parse(di)),wk=state.weekly[wd]||(state.weekly[wd]={});
  if(day[h]){wk[h]=day[h];delete day[h]}else if(wk[h]){day[h]=wk[h];delete wk[h]}
}
function hourRow(di,h){
  const e=resolveHour(di,h),ty=e&&HT[e.type]?e.type:'';
  const now=di===TI&&new Date().getHours()===h,hh=pad(h)+':00',dn=WDL[wdi(parse(di))];
  return `<div class="hr ${now?'now':''}" id="hr-${h}" style="${ty?`--hc:var(--c-${HT[ty][1]})`:''}"><button type="button" class="hl" data-act="hour-mins" data-date="${di}" data-h="${h}">${hourLabel(di,h)}</button>
    <select data-hf="type" data-date="${di}" data-h="${h}" aria-label="Type for ${hh}">${ty?'':'<option value="" selected>Type</option>'}${Object.entries(HT).map(([k,v])=>`<option value="${k}" ${k===ty?'selected':''}>${v[0]}</option>`).join('')}</select>
    <input data-hf="text" data-date="${di}" data-h="${h}" value="${e?esc(e.text):''}" placeholder="${now?'Now':'Free'}" aria-label="Plan for ${hh}">
    <button class="rep" data-act="hour-repeat" data-date="${di}" data-h="${h}">↻</button>
  </div>`;
}
/** Hours after h that carry the same entry on (a 17:15–19:45 lecture fills 17, 18 and 19). */
function spanHours(di,h){
  const e=resolveHour(di,h),out=[];if(!e)return out;
  for(let k=h+1,prev=e;k<24&&hE(prev)===60;k++){
    const x=resolveHour(di,k);
    if(!x||x.text!==e.text||x.type!==e.type||hS(x))break;
    out.push(k);prev=x;
  }
  return out;
}
function spanEnd(di,h){const c=spanHours(di,h),l=c.length?c[c.length-1]:h;return l*60+hE(resolveHour(di,l))}
const isCont=(di,h)=>h>0&&spanHours(di,h-1).includes(h);
/** Make the entry at h run until `end` (minutes since midnight): fills the next hours, or frees them. */
function setSpan(di,h,end){
  const e=resolveHour(di,h),old=spanHours(di,h),last=Math.ceil(end/60)-1;
  const day=state.hours[di]||(state.hours[di]={}),wd=wdi(parse(di)),wk=state.weekly[wd]||(state.weekly[wd]={});
  const src=day[h]?day:wk;
  const nx=resolveHour(di,last+1);
  if(used(nx)&&hS(nx)<0&&end>(last+1)*60+hS(nx))return `${esc(nx.text)} starts at ${hm((last+1)*60+hS(nx))}. Pick an earlier end.`;
  for(let k=h+1;k<=last;k++){
    if(old.includes(k))continue;
    const x=resolveHour(di,k);
    if(x&&x.text&&x.text.trim())return `${pad(k)}:00 is already taken (${x.text}). Clear it first or pick an earlier end.`;
  }
  old.filter(k=>k>last).forEach(k=>{if(day[k])delete day[k];else delete wk[k]});
  for(let k=h;k<=last;k++){
    const x=k===h?{...src[h]}:{text:e.text,type:e.type};
    if(k===last&&end-k*60<60)x.e=end-k*60;else delete x.e;
    (k===h?src:day[k]?day:wk[k]?wk:src)[k]=x;
  }
  return null;
}
function hourLabel(di,h){
  const e=resolveHour(di,h);
  if(!e)return hm(h*60+gapBefore(di,h));
  if(isCont(di,h))return hm(h*60)+(e&&hE(e)<60?`<small>–${hm(h*60+hE(e))}</small>`:'');
  const s=hS(e),z=spanEnd(di,h);
  return hm(h*60+s)+(z!==h*60+60||s?`<small>–${hm(z)}</small>`:'');
}
/** The little "starts / ends" picker under an hour, for times like 08:15–08:45. */
function minsEditor(di,h){
  // Ends can go past this hour (up to midnight), e.g. 17:15 until 19:45
  const e=resolveHour(di,h),s=hS(e),t0=h*60+s,z=spanEnd(di,h);
  let a='',b='';
  const starts=new Set([gapBefore(di,h),s]);for(let m=Math.ceil(gapBefore(di,h)/5)*5;m<60;m+=5)starts.add(m);
  for(const m of [...starts].sort((x,y)=>x-y))a+=`<option value="${m}" ${m===s?'selected':''}>${hm(h*60+m)}</option>`;
  const ends=[];for(let m=Math.floor(t0/5)*5+5;m<=1440;m+=5)ends.push(m);
  if(!ends.includes(z))ends.push(z),ends.sort((x,y)=>x-y);
  for(const m of ends)b+=`<option value="${m}" ${m===z?'selected':''}>${hm(m)} · ${durTxt(m-t0)}</option>`;
  // "Lasts 1/2/3 hours" is a shortcut for the end time: it fills the following hours with the same entry
  const c=[1,2,3].filter(k=>t0+k*60<=1440).map(k=>`<option value="${k}" ${z-t0===k*60?'selected':''}>${k} hour${k>1?'s':''}</option>`).join('');
  const lasts=`<label>Lasts <select data-hm="len" data-date="${di}" data-h="${h}">${[1,2,3].some(k=>z-t0===k*60)?'':'<option value="" selected disabled>–</option>'}${c}</select></label>`;
  return `<div class="hmin">${lasts}<label>Starts <select data-hm="s" data-date="${di}" data-h="${h}">${a}</select></label><label>Ends <select data-hm="e" data-date="${di}" data-h="${h}">${b}</select></label></div>`;
}
/** Update one hour row in place (no re-drawing, so focus and open dropdowns are never lost). */
function paintHourRow(row){
  const sel=row.querySelector('[data-hf=type]'),di=sel.dataset.date,h=+sel.dataset.h;
  const e=resolveHour(di,h),ty=e&&HT[e.type]?e.type:'',dn=WDL[wdi(parse(di))];
  if(ty)row.style.setProperty('--hc',`var(--c-${HT[ty][1]})`);else row.style.removeProperty('--hc');
  const ph=sel.querySelector('option[value=""]');
  if(ty){if(ph)ph.remove();if(sel.value!==ty)sel.value=ty}
  else if(!ph){sel.insertAdjacentHTML('afterbegin','<option value="">Type</option>');sel.value=''}
  const hl=row.querySelector('.hl');
  hl.innerHTML=hourLabel(di,h);
  const inp=row.querySelector('[data-hf=text]');if(document.activeElement!==inp)inp.value=e?e.text:'';
  const g=gapBefore(di,h);inp.placeholder=g?`Free from ${hm(h*60+g)}`:di===TI&&new Date().getHours()===h?'Now':'Free';
  hl.title=e?'Set the minutes (e.g. 08:15–08:45)':'Write something first, then click here to set the minutes';
  hl.setAttribute('aria-label',`${hl.textContent}. ${hl.title}`);
  const ed=row.querySelector('.hmin');if(ed&&!e)ed.remove();
  const rep=row.querySelector('.rep');
  rep.style.visibility=e?'visible':'hidden';rep.tabIndex=e?0:-1;
  rep.classList.toggle('on',!!(e&&e.rep));
  rep.title=e&&e.rep?`Repeats every ${dn}. Click to keep it on this day only.`:`Click to repeat every ${dn}`;
  rep.setAttribute('aria-label',e&&e.rep?'Stop repeating':'Repeat every '+dn);
}
function paintHourRows(){document.querySelectorAll('.hr').forEach(paintHourRow)}
function hourSum(di){
  // Count minutes, not rows: 07:00–10:45 is 3h 45m, not 4h
  const c={};let busy=0;
  for(let h=0;h<24;h++){const e=resolveHour(di,h);if(!e)continue;const m=Math.max(0,hE(e)-hS(e));busy+=m;if(HT[e.type]&&e.type!=='sleep')c[e.type]=(c[e.type]||0)+m}
  const free=Math.max(0,1440-busy);
  return Object.keys(HT).filter(k=>c[k]).map(k=>`<span style="--hc:var(--c-${HT[k][1]})"><i></i>${HT[k][0]} ${durTxt(c[k])}</span>`).join('')+`<span style="--hc:var(--line)"><i></i>Free ${durTxt(free)}</span>`;
}
function hourSection(d){
  const di=iso(d),rows=(a,b)=>{let o='';for(let h=a;h<=b;h++)o+=hourRow(di,h);return o};
  return `<section style="margin-top:34px"><div class="sec-h" style="flex-wrap:wrap"><h2>Hour by hour</h2><div class="hsum" id="hsum">${hourSum(di)}</div></div>${toolBar(di)}
    ${tip(`<p style="font-size:13px;color:var(--muted);margin-bottom:12px">Write your uni, work and everything else for each hour, and pick a type to colour it. Click a time to set when it starts and ends, like 17:15–19:45. Click ↻ to repeat an hour every ${WDL[wdi(d)]}, so your weekly timetable fills itself in.</p>`)}
    <div class="hours"><div><p class="hcol-h">Night and morning · 00:00–12:00</p>${rows(0,11)}</div><div><p class="hcol-h">Afternoon and evening · 12:00–24:00</p>${rows(12,23)}</div></div></section>`;
}

/* ---------- import a planner file (Excel, PDF, Word) ---------- */
const IMPORT_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>';
let impList=null,impDays=null;
function impDialog(html){
  let d=document.getElementById('impDlg');
  if(!d){d=document.createElement('dialog');d.id='impDlg';d.className='dlg';document.body.appendChild(d)}
  d.innerHTML=html;if(!d.open)d.showModal();
  const f=d.querySelector('.btn.primary')||d.querySelector('.btn');if(f)f.focus();
  return d;
}
const impClose=()=>{const d=document.getElementById('impDlg');if(d&&d.open)d.close();impList=impDays=null};
/** Read the picked file, find the hours in it, and show what will be filled in before saving anything. */
async function importFile(file,di){
  impDialog(`<h3>Reading ${esc(file.name)}…</h3><p class="dlg-s">This takes a moment for big files.</p>`);
  const d=parse(di),ws=weekStart(d),days=[...Array(7).keys()].map(k=>iso(addDays(ws,k)));
  let list;
  try{list=SplannerImport.parseRows(await SplannerImport.extractRows(file),di,days)}
  catch(err){impDialog(`<h3>Couldn't read that file</h3><p class="dlg-s">${esc(err.message||'Please try another file.')}</p><div class="dlg-b"><button class="btn primary" data-act="imp-close">OK</button></div>`);return}
  if(!list.length){
    impDialog(`<h3>Please specify the hours</h3><p class="dlg-s">We couldn't find any times in <b>${esc(file.name)}</b>. Write the hours next to each activity, like <b>08:00 Breakfast</b> or <b>09:15–10:45 Lecture</b>, then try again.</p>${window.SPL_LANG==='sq'?'':`<p class="dlg-s" lang="sq">Nuk gjetëm orë në këtë skedar. Shkruani orët pranë çdo aktiviteti, p.sh. <b>08:00 Mëngjes</b> ose <b>09:15–10:45 Ligjërata</b>, pastaj provoni përsëri.</p>`}<div class="dlg-b"><button class="btn primary" data-act="imp-close">OK</button></div>`);
    return;
  }
  impList=list;impDays=days;
  const dates=[...new Set(list.map(e=>e.date))],multi=dates.length>1;
  const rows=list.map((e,i)=>`<tr><td class="num">${multi?`<b>${WD[wdi(parse(e.date))]}</b> `:''}${hm(e.from)}–${hm(e.to)}</td><td>${esc(e.text)}</td><td><select data-imp="${i}" aria-label="Type for ${esc(e.text)}">${Object.entries(HT).map(([k,v])=>`<option value="${k}" ${k===e.type?'selected':''}>${v[0]}</option>`).join('')}</select></td></tr>`).join('');
  // A plan for one day fills every day of the week (repeating with ↻) unless you pick otherwise
  const opt=(v,label,on)=>`<label><input type="radio" name="impWhen" value="${v}" ${on?'checked':''}> ${label}</label>`;
  const when=multi?opt('weekly','Every week (↻)',true)+opt('once',`Only the week of ${short(ws)}`)
    :opt('every','Every day (↻)',true)+opt('weekdays','Monday to Friday (↻)')+opt('once',`Only ${short(parse(dates[0]))}`);
  impDialog(`<h3>Found ${list.length} ${list.length===1?'entry':'entries'}${multi?` for ${dates.length} days`:''}</h3>
    <p class="dlg-s">Check the types, then fill your planner. Anything already written at these times will be replaced.</p>
    <div class="dlg-list"><table>${rows}</table></div>
    <div class="dlg-rep" role="radiogroup" aria-label="Which days to fill"><span>Fill:</span>${when}</div>
    <div class="dlg-b"><button class="btn ghost" data-act="imp-close">Cancel</button><button class="btn primary" data-act="imp-save">Fill my planner</button></div>`);
}
/** Examples of files the import understands. */
function importHelp(){
  const tbl=(head,rows)=>`<table class="ex"><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
  const sq=window.SPL_LANG==='sq';
  impDialog(`<h3>How your file should look</h3>
    <p class="dlg-s">Any of these works. Each activity needs a time next to it, in the same row or line.</p>
    <div class="dlg-list ex-wrap">
      <p class="ex-h">Excel or CSV: one row per activity</p>
      ${tbl(['Start','End','Activity'],[['08:00','09:30','Lecture'],['10:00','','Gym'],['12:00','13:00','Lunch'],['14:15','16:45','Work shift']])}
      <p class="ex-h">Excel or Word: a weekly timetable</p>
      ${tbl(['Time',WDL[0],WDL[1],WDL[2]],[['08:00–09:30','Lecture','','Gym'],['10:00–11:30','','Study','']])}
      <p class="ex-h">PDF, Word or text: one line per activity</p>
      <pre class="ex-txt">${sq?'E Hënë\nora 8 Mëngjes\n8:15–9:45 Ligjërata\nnga 10 deri në 12 Mësim\n3 pasdite Palestër':'Monday\n08:00 Breakfast\n8:15–9:45 Lecture\n10:00 to 12:00 Study\n3 pm Gym'}</pre>
      <p class="dlg-s">A time on its own (08:00) lasts until the next activity. A range (08:15–09:45) sets both ends. Days can be columns or headings like <b translate="no">Monday</b> or <b translate="no">E Hënë</b>.</p>
      <p class="dlg-s">Times can be written in English or Albanian, for example 8:30, 8 am, ora 8, 8 e gjysmë or 3 pasdite.</p>
    </div>
    <p class="dlg-s">Download an example as:</p>
    <div class="dlg-rep">${EX_FORMATS.map(f=>`<button class="btn ghost" data-act="imp-example" data-fmt="${f[0]}">${f[1]}</button>`).join('')}</div>
    <div class="dlg-b"><button class="btn primary" data-act="imp-close">Got it</button></div>`);
}
const EX_FORMATS=[['xlsx','Excel (.xlsx)'],['docx','Word (.docx)'],['pptx','PowerPoint (.pptx)'],['pdf','PDF (.pdf)'],['csv','CSV (.csv)']];
const EX_LIBS={
  xlsx:['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'],
  docx:['https://cdn.jsdelivr.net/npm/docx@7.8.2/build/index.js'],
  pptx:['https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'],
  pdf:['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'],
};
const exLoaded={};
function exLoad(src){
  return exLoaded[src]||(exLoaded[src]=new Promise((ok,bad)=>{
    const s=document.createElement('script');s.src=src;s.async=true;s.onload=ok;
    s.onerror=()=>{delete exLoaded[src];bad(new Error("Couldn't load the file writer. Check your internet connection and try again."))};
    document.head.appendChild(s);
  }));
}
function exSave(blob,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
/** A small example planner in the chosen format (Excel, Word, PowerPoint, PDF or CSV), in the page's language. */
async function importExample(fmt){
  fmt=fmt||'xlsx';
  const sq=window.SPL_LANG==='sq';
  const rows=sq?[['Fillon','Mbaron','Aktiviteti'],['07:30','08:00','Mëngjes'],['08:15','09:45','Ligjërata'],['10:00','12:00','Mësim'],['12:00','13:00','Drekë'],['17:00','18:00','Palestër']]
    :[['Start','End','Activity'],['07:30','08:00','Breakfast'],['08:15','09:45','Lecture'],['10:00','12:00','Study'],['12:00','13:00','Lunch'],['17:00','18:00','Gym']];
  const base=sq?'shembull-planeri':'example-planner',title=sq?'Shembull planeri':'Example planner';
  try{
    if(fmt==='csv'){exSave(new Blob(['﻿'+rows.map(r=>r.join(',')).join('\r\n')],{type:'text/csv'}),base+'.csv');return}
    await Promise.all(EX_LIBS[fmt].map(exLoad));
    if(fmt==='xlsx'){
      const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:10},{wch:10},{wch:24}];
      const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,title);
      XLSX.writeFile(wb,base+'.xlsx');
    }else if(fmt==='docx'){
      const D=window.docx,cell=(t,b)=>new D.TableCell({children:[new D.Paragraph({children:[new D.TextRun({text:t,bold:b})]})]});
      const doc=new D.Document({sections:[{children:[
        new D.Paragraph({text:title,heading:D.HeadingLevel.HEADING_1}),
        new D.Table({width:{size:100,type:D.WidthType.PERCENTAGE},rows:rows.map((r,i)=>new D.TableRow({children:r.map(c=>cell(c,i===0))}))}),
      ]}]});
      exSave(await D.Packer.toBlob(doc),base+'.docx');
    }else if(fmt==='pptx'){
      const p=new window.PptxGenJS(),s=p.addSlide();
      s.addText(title,{x:0.5,y:0.3,w:9,h:0.8,fontSize:28,bold:true});
      s.addTable(rows.map((r,i)=>r.map(c=>({text:c,options:{bold:i===0}}))),{x:0.5,y:1.3,w:9,colW:[1.5,1.5,6],fontSize:16,border:{type:'solid',color:'BBBBBB',pt:1}});
      await p.writeFile({fileName:base+'.pptx'});
    }else if(fmt==='pdf'){
      const doc=new window.jspdf.jsPDF();
      doc.setFontSize(18);doc.text(title,15,20);doc.setFontSize(12);
      rows.forEach((r,i)=>{
        const y=35+i*9;
        doc.setFont('helvetica',i===0?'bold':'normal');
        doc.text(r[0],15,y);doc.text(r[1],45,y);doc.text(r[2],75,y);
      });
      doc.save(base+'.pdf');
    }
  }catch(err){impDialog(`<h3>Couldn't create the example</h3><p class="dlg-s">${esc(err.message||'Please try another format.')}</p><div class="dlg-b"><button class="btn primary" data-act="imp-close">OK</button></div>`)}
}
async function importSave(btn){
  if(!impList)return;
  btn.disabled=true;
  const w=(document.querySelector('input[name=impWhen]:checked')||{}).value||'once',list=impList;
  // every / weekdays: copy the day's plan to each of those days, saved in the weekly timetable so it repeats
  const k=w==='every'?7:w==='weekdays'?5:0;
  const entries=k?impDays.slice(0,k).flatMap(date=>list.map(e=>({...e,date}))):list;
  const msg={every:'on every day',weekdays:'on Monday to Friday',weekly:'every week',once:''}[w];
  try{
    const r=await api('hours.import',{entries,repeat:w!=='once'});
    impClose();
    await reload();
    (r.dates||[]).forEach(gcalLater);
    toast(`Filled in ${list.length} ${list.length===1?'entry':'entries'} from your file${msg?' '+msg:''}.`);
  }catch(err){btn.disabled=false;toast(err.message)}
}

/* ---------- Google Calendar ---------- */
// Changed days wait a moment, so typing several hours sends one update instead of many
/** Google Calendar is switched off for now: set to true once the Google API is set up again. */
const GCAL_ON=false;
let gcalTimer=null,gcalBusy=false,gcalFull=false,gcalMsg='';
const gcalDates=new Set();
/** One line above the hours: import a planner file, and Google Calendar (when the site has it set up). */
function toolBar(di){
  const g=state.google,on=g&&g.configured&&g.connected;
  const imp=`<label class="btn" title="Excel, CSV, PDF or Word (.docx)">${IMPORT_ICON}Import a planner<input type="file" id="impFile" data-date="${di}" accept=".xlsx,.xls,.xlsm,.ods,.csv,.pdf,.docx,.doc,.txt" hidden></label><button type="button" class="linkbtn" data-act="imp-help">What should my file look like?</button>`;
  if(!GCAL_ON)return `<div class="gcal"><span>${tip('Already have your day planned in Excel, a PDF or Word? Bring it in.')}</span>${imp}</div>`;
  if(on)return `<div class="gcal on"><span>${GCAL_ICON}<span id="gcalMsg">${gcalMsg||`In Google Calendar${g.email?` (${esc(g.email)})`:''}, in the calendar called <b>Splanner</b>`}</span></span>
    <button class="linkbtn" data-act="gcal-sync">Sync now</button>
    <form method="post" action="calendar.php" class="inline"><input type="hidden" name="csrf" value="${esc(CSRF)}"><button class="linkbtn" title="Stop sending hours to Google. What's already there stays until you delete the Splanner calendar.">Disconnect</button></form><span class="tb-gap"></span>${imp}</div>`;
  const cal=`<a class="btn" href="calendar.php?start=1">${GCAL_ICON}Show in Google Calendar</a>`;
  return `<div class="gcal"><span>${tip(cal?'Bring in a planner you already have, or show these hours in Google Calendar.':'Already have your day planned in Excel, a PDF or Word? Bring it in.')}</span>${imp}${cal}</div>`;
}
const GCAL_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
function gcalStatus(msg){gcalMsg=msg;const el=document.getElementById('gcalMsg');if(el)el.innerHTML=msg}
/** After an hour is saved, send that day (and the same weekday in the next two weeks) to Google. */
function gcalLater(di){
  if(!GCAL_ON||!state.google||!state.google.connected)return;
  if(di)gcalDates.add(di);
  clearTimeout(gcalTimer);gcalTimer=setTimeout(()=>gcalRun(false),2500);
}
async function gcalRun(full){
  gcalFull=gcalFull||full;
  if(gcalBusy){clearTimeout(gcalTimer);gcalTimer=setTimeout(()=>gcalRun(false),1500);return}
  full=gcalFull;gcalFull=false;
  const dates=[...gcalDates];gcalDates.clear();
  if(!full&&!dates.length)return;
  gcalBusy=true;gcalStatus('Sending to Google Calendar…');
  try{
    const r=await api('gcal.sync',{dates,full});
    state.google.needsSync=false;
    if(!r.connected){state.google.connected=false;render();return}
    gcalStatus('Up to date in Google Calendar ✓');
  }catch(err){
    gcalStatus("Couldn't reach Google Calendar");toast(err.message);
    if(/connect it again/i.test(err.message)){state.google.connected=false;render()}
  }finally{gcalBusy=false}
}
/** Save an hour change, then pass it on to Google Calendar. */
const hourSync=(action,data)=>sync(action,data).then(()=>gcalLater(data.date));

/* ---------- subjects ---------- */
const srcOpen=new Set(); // chapters whose "where to find it" box is open while still empty
let editKey=null;         // the chapter ("ch:id") or topic ("tp:id") whose name is being edited
const EDIT_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
/** The name of a chapter or topic, or a box to fix it in while it is being edited. */
function nameOrEdit(kind,id,text,a,max){
  if(editKey===kind+':'+id)return `<input class="edit" id="ed-${kind}-${id}" data-edit="${kind}" ${a} ${kind==='tp'?`data-tid="${id}"`:''} value="${esc(text)}" maxlength="${max}" aria-label="New name for ${esc(text)}">`;
  return `<span class="grow">${esc(text)}</span><button class="x sm ed" data-act="edit" data-key="${kind}:${id}" title="Edit" aria-label="Edit ${esc(text)}">${EDIT_ICON}</button>`;
}
const findS=id=>state.subjects.find(s=>s.id===id);
const findC=(sid,cid)=>{const s=findS(sid);return s?s.chapters.find(c=>c.id===cid):null};
const chDone=c=>c.topics.length?c.topics.every(t=>t.done):c.done;
const sItems=s=>s.chapters.flatMap(c=>c.topics.length?c.topics:[c]);
const matOpen=new Set(); // chapters whose study material box is open while still empty
const hasMat=c=>!!(c.mat&&(c.mat.pages.length||c.mat.files.length));
/** A chapter's study material: its pages in the study notebook (notes.php), the files on them, and buttons to add more. */
function matPanel(c,sid){
  const m=c.mat||{pages:[],files:[]},ic={audio:'music',image:'image'};
  const pages=m.pages.map(p=>`<a class="mat-chip" href="notes.php?page=${p.id}">${ico(p.kind==='board'?'board':'note')}<span translate="no">${esc(p.title||(p.kind==='board'?'Whiteboard':'Notes'))}</span></a>`).join('');
  const files=m.files.map(f=>`<a class="mat-chip" href="notefile.php?id=${f.id}${['pdf','image','audio'].includes(f.kind)?'':'&amp;dl=1'}" target="_blank" rel="noopener">${ico(ic[f.kind]||'file')}<span translate="no">${esc(f.name)}</span></a>`).join('');
  return `<div class="mat" id="mat-${c.id}">${pages||files?`<div class="mat-list">${pages}${files}</div>`:'<p class="mat-empty">Add the slides, PDFs, pictures or your own notes for this chapter.</p>'}
    <div class="mat-add"><label class="btn sm">${ico('clip')}Upload files<input type="file" multiple hidden data-matup="${c.id}"></label><a class="btn sm" href="notes.php?chapter=${c.id}&amp;new=note">${ico('note')}Write notes</a><a class="btn sm" href="notes.php?chapter=${c.id}&amp;new=board">${ico('board')}Whiteboard</a><a class="btn sm" href="notes.php?nb=${sid}&amp;ch=${c.id}">${ico('notebook')}Open in notebook</a></div></div>`;
}
/** Upload files from the Study tab: they go on the chapter's notes page (made the first time). */
async function matUpload(cid,files){
  let c=null;for(const s of state.subjects)for(const x of s.chapters)if(x.id===cid)c=x;
  if(!c)return;
  for(const f of files){
    toast('Uploading '+f.name+'…');
    const fd=new FormData();fd.append('chapter_id',cid);fd.append('file',f);
    try{
      const r=await fetch('noteapi.php?action=file.add',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':CSRF},body:fd});
      let j={};try{j=await r.json()}catch(e){}
      if(!r.ok||j.error)throw new Error(j.error||(r.status===413?'That file is too big.':'Something went wrong. Try again.'));
      if(!c.mat.pages.some(p=>p.id===j.page))c.mat.pages.push({id:j.page,kind:'note',title:c.title});
      c.mat.files.push({id:j.file.id,page:j.page,name:j.file.name,kind:j.file.kind});
      toast(f.name+' added.');
    }catch(e){toast(f.name+': '+e.message)}
  }
  render();
}

function subjectsSection(){
  const all=state.subjects.flatMap(sItems),allDone=all.filter(x=>x.done).length;
  const cards=state.subjects.map(s=>{
    const it=sItems(s),dn=it.filter(x=>x.done).length,pct=it.length?dn/it.length*100:0;
    let exam='<span class="pill muted">No exam date</span>';
    if(s.exam){const ed=parse(s.exam),n=dayDiff(ed,TODAY);exam=n<0?`<span class="pill muted">Exam was ${short(ed)}</span>`:`<span class="pill ${n<=7?'bad':n<=21?'warn':''}">Exam ${short(ed)} · ${n} day${n===1?'':'s'}</span>`}
    const chs=s.chapters.map(c=>{const d=chDone(c),tn=c.topics.filter(t=>t.done).length,a=`data-sid="${s.id}" data-cid="${c.id}"`;
      return `<div class="ch ${d?'done':''}"><div class="ch-h"><input type="checkbox" data-chk="ch" ${a} ${d?'checked':''} aria-label="Learned: ${esc(c.title)}">${nameOrEdit('ch',c.id,c.title,a,150)}${c.topics.length?`<span class="cnt">${tn}/${c.topics.length}</span>`:''}<button class="srcbtn ${c.src?'on':''}" data-act="src" ${a} title="Where to find this chapter (book, author, literature)" aria-label="Where to find ${esc(c.title)}" aria-expanded="${srcOpen.has(c.id)||!!c.src}">${ico('book')}</button><button class="srcbtn ${hasMat(c)?'on':''}" data-act="mat" ${a} title="Study material: files, notes and whiteboards" aria-label="Study material for ${esc(c.title)}" aria-expanded="${matOpen.has(c.id)||hasMat(c)}">${ico('clip')}</button><button class="x sm" data-act="del-ch" ${a} data-confirm aria-label="Delete ${esc(c.title)}">×</button></div>
      ${c.src||srcOpen.has(c.id)?`<textarea class="src" id="src-${c.id}" data-src ${a} rows="2" placeholder="Where to find it, e.g.&#10;Book: Java e pesëmbëdhjetë, by …&#10;Literatura: Manuali i BASIC për 8051" aria-label="Where to find ${esc(c.title)}">${esc(c.src||'')}</textarea>`:''}
      ${hasMat(c)||matOpen.has(c.id)?matPanel(c,s.id):''}
      ${c.topics.length?`<ul class="topics">${c.topics.map(t=>`<li class="${t.done?'dn':''}"><input type="checkbox" data-chk="topic" ${a} data-tid="${t.id}" ${t.done?'checked':''} aria-label="Learned: ${esc(t.t)}">${nameOrEdit('tp',t.id,t.t,a,200)}<button class="x sm" data-act="del-topic" ${a} data-tid="${t.id}" aria-label="Delete ${esc(t.t)}">×</button></li>`).join('')}</ul>`:''}
      <form class="mini" data-form="topic" ${a} autocomplete="off" style="margin-left:28px"><input id="tp-${c.id}" name="t" placeholder="+ Add something to learn" aria-label="Add something to learn in ${esc(c.title)}"></form></div>`}).join('');
    return `<div class="subj" style="--sc:var(--c-${s.c})"><div class="subj-h"><div><h3>${esc(s.name)}</h3><div style="margin-top:6px">${exam}</div><a class="linkbtn" style="display:inline-block;margin-top:6px" href="notes.php?nb=${s.id}" title="Your notes and files for this subject, chapter by chapter">${ico('notebook')}Open notebook</a></div><button class="x" data-act="del-subj" data-id="${s.id}" data-confirm aria-label="Delete ${esc(s.name)}">×</button></div>
      <div class="meter"><span style="width:${pct.toFixed(1)}%;background:var(--sc)"></span></div>
      <p style="font-size:12px;color:var(--muted);font-weight:600;margin:5px 0 2px">${dn} of ${it.length} learned · ${s.chapters.length} chapter${s.chapters.length===1?'':'s'}</p>
      <div class="chs">${chs}</div>
      <form class="mini" data-form="chapter" data-sid="${s.id}" autocomplete="off" style="margin-top:12px"><input id="ch-${s.id}" name="title" placeholder="+ Add a chapter" aria-label="Add a chapter to ${esc(s.name)}"><button class="btn">Add</button></form></div>`;
  }).join('');
  return `<section style="margin-top:36px"><div class="sec-h"><h2>Subjects and chapters</h2><span class="meta">${allDone} of ${all.length} things learned</span></div>
    <form class="addform subjform" data-form="subject" autocomplete="off"><input id="sb-name" name="name" placeholder="Add a subject, e.g. Linear Algebra" required aria-label="Subject name"><input id="sb-exam" name="exam" type="date" aria-label="Exam date (optional)" title="Exam date (optional)"><button class="btn primary">Add subject</button></form>
    ${state.subjects.length?`<div class="subjects">${cards}</div>`:tip('<p class="empty">No subjects yet. Add your first one above.</p>')}</section>`;
}

function revisedPanel(){
  const tot=state.study.reduce((s,r)=>s+r.h,0),rev=state.study.reduce((s,r)=>s+(r.rev?r.h:0),0);
  return `<div class="sec-h" style="margin-bottom:8px"><span style="font-weight:700;font-size:14px">Revised so far</span><span class="meta num">${rev}h of ${tot}h</span></div><div class="meter"><span style="width:${tot?(rev/tot*100).toFixed(1):0}%"></span></div>`;
}

/* ---------- views ---------- */
const V={};
V.day=()=>{
  const d=cursor,di=iso(d),list=expIn(d,d),spent=sum(list),allow=dailyAllow(d);
  const blocks=studyBlocks(di);
  let tasks=state.tasks.filter(t=>t.due===di);
  if(di===TI)tasks=state.tasks.filter(t=>t.due===di||(!t.done&&t.due<TI));
  tasks.sort((a,b)=>a.done-b.done||a.due.localeCompare(b.due));
  const rel=dayDiff(d,TODAY);
  const isNew=!state.exps.length&&!state.tasks.length&&!Object.keys(state.hours).length&&!state.weekly.some(w=>Object.keys(w).length);
  const welcome=isNew&&TOUR?`<div class="onboard"><span><b>Welcome, ${esc(state.user.name)}!</b> Start by adding your uni and work hours in Hour by hour below, and click ↻ to repeat them every week. Then set your income and savings goal in the Year tab.</span><button class="btn" data-act="tab" data-tab="year">Set up money</button></div>`:'';
  return welcome+hdr(WDL[wdi(d)]+(rel===0?' · Today':rel===1?' · Tomorrow':rel===-1?' · Yesterday':''),`${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`,navBtns())+
  `<div class="cols"><div class="stack">
    <section><div class="sec-h"><h2>Study blocks</h2><span class="meta">${blocks.filter(b=>b.done).length} of ${blocks.length} done</span></div><div id="blocklist">${blockRows(blocks)}</div>${blockForm(di,false)}</section>
    <section><div class="sec-h"><h2>Tasks</h2><button class="linkbtn" data-act="tab" data-tab="tasks">All tasks →</button></div>${tasks.length?tasks.map(taskRow).join(''):tip('<p class="empty">Nothing due on this day.</p>')}</section>
  </div>
  <section class="panel"><div class="sec-h"><h2>Money today</h2>${statusPill(spent,allow)}</div>
    <div class="meter ${meterCls(spent,allow)}" style="margin:6px 0 8px"><span style="width:${Math.min(100,spent/(allow||1)*100).toFixed(1)}%"></span></div>
    <p class="s" style="font-size:13px;color:var(--muted);margin-bottom:16px">${state.settings.income?`Spent <b class="num" style="color:var(--ink)">${eur(spent)}</b> of your daily allowance of ${eur(allow)}.`:`Spent <b class="num" style="color:var(--ink)">${eur(spent)}</b> today.${tip(' Set your income in the Year tab to get a daily allowance.')}`}</p>
    ${expForm(di)}${expRows(list,{showDate:false})}
    <div class="total-line"><span>Total for the day</span><span class="amt">${eur(spent)}</span></div>
  </section></div>`+hourSection(d);
};
V.week=()=>{
  const ws=weekStart(cursor),we=addDays(ws,6),days=[...Array(7)].map((_,i)=>addDays(ws,i));
  const list=expIn(ws,we),spent=sum(list),allow=allowRange(ws,we);
  const def=(TODAY>=ws&&TODAY<=we)?TI:iso(ws);
  const cards=days.map(d=>{
    const di=iso(d),ts=state.tasks.filter(t=>t.due===di),bs=studyBlocks(di),sp=sum(state.exps.filter(e=>e.date===di));
    const items=[...bs.map(b=>`<li class="${b.done?'dn':''}"><span class="dot" style="background:var(--c-${subjColor(b.title)})"></span>${hm(b.from)}–${hm(b.to)} ${esc(b.title)}</li>`),...ts.map(t=>`<li class="${t.done?'dn':''}"><span class="prio ${t.priority}" style="width:8px;height:8px;margin-top:5px"></span>${esc(t.title)}</li>`)];
    return `<div class="wd ${di===TI?'is-today':''}" data-act="goto" data-date="${di}"><button class="wd-h" data-act="goto" data-date="${di}"><span>${WD[wdi(d)]}</span><b>${d.getDate()}</b></button><ul>${items.slice(0,4).join('')||'<li style="color:var(--muted)">Free</li>'}${items.length>4?`<li style="color:var(--muted)">+${items.length-4} more</li>`:''}</ul><div class="foot"><span>Spent</span><span class="amt">${eur(sp)}</span></div></div>`;
  }).join('');
  const daily=allow/7;
  const bars=days.map(d=>{const v=sum(state.exps.filter(e=>e.date===iso(d)));return {label:WD[wdi(d)],v,today:iso(d)===TI,cls:d>TODAY?'fut':v>dailyAllow(d)?'over':''}});
  return hdr(`Week ${isoWeek(ws)} · ${ws.getFullYear()}`,`${ws.getDate()} ${M3[ws.getMonth()]} – ${we.getDate()} ${M3[we.getMonth()]}`,navBtns())+
  `<div class="wk-scroll"><div class="weekgrid">${cards}</div></div>
  <div class="cols"><section class="panel"><div class="sec-h"><h2>Spending this week</h2>${statusPill(spent,allow)}</div>
    ${barChart(bars,daily,{limitLabel:'daily'})}
    <div class="legend"><span><i style="background:var(--accent)"></i>Within allowance</span><span><i style="background:var(--bad)"></i>Over daily allowance</span></div>
    <div style="margin-top:18px">${catBars(list)}</div>
    <div class="total-line"><span>Week total</span><span class="amt">${eur(spent)}</span></div>
    <p class="s" style="font-size:12px;color:var(--muted);margin-top:4px">Weekly allowance ${eur(allow)}</p>
  </section>
  <section><div class="sec-h"><h2>Add an expense</h2></div>${expForm(def)}${expRows(list,{limit:8})}</section></div>`;
};
V.month=()=>{
  const y=cursor.getFullYear(),m=cursor.getMonth(),first=new Date(y,m,1),last=new Date(y,m,dim(y,m));
  const list=expIn(first,last),spent=sum(list),allow=allowanceFor(y,m),income=incomeFor(y,m),tg=targets(y)[m];
  const isNow=y===TODAY.getFullYear()&&m===TODAY.getMonth(),daily=allow/dim(y,m);
  let cells=WD.map(w=>`<div class="wh">${w}</div>`).join('')+'<div class="cell blank"></div>'.repeat(wdi(first));
  for(let i=1;i<=dim(y,m);i++){
    const d=new Date(y,m,i),di=iso(d),sp=sum(state.exps.filter(e=>e.date===di)),ts=state.tasks.filter(t=>t.due===di&&!t.done);
    cells+=`<button class="cell ${di===TI?'is-today':''} ${d>TODAY?'fut':''}" data-act="goto" data-date="${di}" aria-label="${short(d)}"><span class="n">${i}</span><span class="tdots">${ts.map(t=>`<i class="${t.priority==='high'?'hi':''}"></i>`).join('')}</span>${sp?`<span class="sp ${sp>daily?'over':''}">${eur0(sp)}</span>`:''}</button>`;
  }
  const saved=income-spent;
  return hdr(isNow?'This month':'Month',`${MON[m]} ${y}`,navBtns())+
  `<div class="cols wide-l"><section><div class="cal">${cells}</div>
    <div class="legend"><span><i style="background:var(--c-transport);border-radius:50%"></i>Task due</span><span><i style="background:var(--bad);border-radius:50%"></i>High-priority task</span><span style="color:var(--bad);font-weight:700">€ red</span><span>= over daily allowance (${eur(daily)})</span></div>
  </section>
  <div class="stack"><section class="panel"><div class="sec-h"><h2>Money this month</h2>${isNow?statusPill(spent,allow):spent>allow?'<span class="pill bad">Over budget</span>':'<span class="pill good">Within budget</span>'}</div>
    <div class="meter ${meterCls(spent,allow)}" style="margin:6px 0 16px"><span style="width:${Math.min(100,spent/(allow||1)*100).toFixed(1)}%"></span></div>
    <dl class="kv"><dt>Income</dt><dd>${eur(income)}</dd><dt>Spent${isNow?' so far':''}</dt><dd>${eur(spent)}</dd><dt>Spending allowance</dt><dd>${eur(allow)}</dd><dt><label for="m-save">Savings target</label>${tg.custom?` <button class="linkbtn" data-act="msave-reset" data-y="${y}" data-m="${m}" title="Go back to the automatic amount">reset</button>`:''}</dt><dd>€ <input class="cellin num${tg.custom?' edited':''}" id="m-save" type="number" min="0" step="1" value="${+tg.t.toFixed(2)}" data-mf="save" data-y="${y}" data-m="${m}" aria-label="Savings target for ${MON[m]}"></dd><dt>Left over</dt><dd style="color:${saved>=0?'var(--good)':'var(--bad)'}">${eur(saved)}</dd>${!tg.active?'<dt>Savings</dt><dd style="color:var(--muted)">No income this month</dd>':monthStatus(y,m)==='future'?'':`<dt><label for="m-actual">I saved</label></dt><dd><input type="checkbox" data-chk="msaved" data-y="${y}" data-m="${m}" ${tg.actual!=null&&tg.actual>=tg.t-0.005?'checked':''} aria-label="I saved ${eur(tg.t)} in ${MON[m]}" title="Tick if you saved the target"> € <input class="cellin num${tg.actual!=null?' edited':''}" id="m-actual" type="number" min="0" step="1" value="${tg.actual==null?'':tg.actual}" placeholder="${+tg.t.toFixed(2)}" data-mf="actual" data-y="${y}" data-m="${m}" aria-label="Amount saved in ${MON[m]}" title="Type what you really saved. Clear to undo."></dd>`}</dl>
    ${tip(`<p class="hint">Tick or type what you really saved in the Year tab. Whatever is missing is added to next month's target.</p>`)}
    <div style="margin-top:16px">${catBars(list)}</div>
    <div class="total-line"><span>Month total</span><span class="amt">${eur(spent)}</span></div>
  </section>
  <section><div class="sec-h"><h2>Add an expense</h2></div>${expForm(isNow?TI:iso(first))}${expRows(list,{limit:6})}</section></div></div>`;
};
V.year=()=>{
  const y=cursor.getFullYear(),p=plan(y),{income,goal}=state.settings;
  const allowM=Math.max(0,income-goal/12),allowOf=o=>Math.max(0,o.income-o.target);
  const bars=p.months.map(o=>({label:M3[o.m].slice(0,1)+M3[o.m].slice(1,3),v:o.spent,today:o.status==='now',cls:o.status==='future'?'fut':o.status==='now'?'now':o.spent>allowOf(o)?'over':''}));
  const done=p.months.filter(o=>o.status!=='future'&&o.active);
  const totSpent=sum(done.map(o=>({amount:o.spent}))),totInc=sum(done.map(o=>({amount:o.income}))),totSaved=totInc-totSpent;
  const rows=p.months.map(o=>{
    let st;
    if(!o.active)st='<span class="pill muted">No income</span>';
    else if(o.status==='future')st='<span class="pill muted">Upcoming</span>';
    else if(o.actual==null)st=o.status==='past'?`<span class="pill bad">Confirm · ${eur(o.target)} to catch up</span>`:'<span class="pill">In progress</span>';
    else st=o.actual>=o.target-0.005?'<span class="pill good">On target</span>':`<span class="pill bad">Short ${eur(o.target-o.actual)}</span>`;
    const inc=`€ <input class="cellin num${o.incCustom?' edited':''}" id="yi-${o.m}" type="number" min="0" step="10" value="${o.income}" placeholder="${income}" data-mf="income" data-y="${y}" data-m="${o.m}" aria-label="Income for ${MON[o.m]}" title="Clear to use your usual income">`;
    const conf=!o.active||o.status==='future'?'–':`<input type="checkbox" data-chk="msaved" data-y="${y}" data-m="${o.m}" ${o.actual!=null&&o.actual>=o.target-0.005?'checked':''} aria-label="I saved ${eur(o.target)} in ${MON[o.m]}" title="Tick if you saved the target"> € <input class="cellin num${o.actual!=null?' edited':''}" type="number" min="0" step="1" value="${o.actual==null?'':o.actual}" placeholder="${+o.target.toFixed(2)}" data-mf="actual" data-y="${y}" data-m="${o.m}" aria-label="Amount saved in ${MON[o.m]}" title="Type what you really saved. Clear to undo.">`;
    const tgt=!o.active?'–':`${eur(o.target)}${o.custom?' <span class="tag-edited" title="You changed this in the Month tab">edited</span>':''}`;
    return `<tr class="${o.status==='now'?'now':o.status==='future'?'fut':''}${o.active?'':' off'}"><td class="mn">${MON[o.m]}</td><td class="r" data-l="Spent">${o.status==='future'?'–':eur(o.spent)}</td><td class="r" data-l="Income">${inc}</td><td class="r" data-l="Left over">${o.saved===null?'–':eur(o.saved)}</td><td class="r" data-l="Target">${tgt}</td><td class="r" data-l="I saved">${conf}</td><td class="st">${st}</td></tr>`;
  }).join('');
  const pct=goal>0?Math.max(0,Math.min(100,p.savedDone/goal*100)):0;
  const yList=expIn(new Date(y,0,1),new Date(y,11,31));
  return hdr('Year overview',`${y}`,navBtns())+
  `<div class="cols"><section class="panel"><div class="sec-h"><h2>Savings plan</h2><span class="meta">${p.left} month${p.left===1?'':'s'} left</span></div>
    <div class="inputs"><label for="s-income">Usual monthly income<input class="field num" id="s-income" type="number" min="0" step="10" value="${income}" data-set="income"></label><label for="s-goal">Savings goal for ${y}<input class="field num" id="s-goal" type="number" min="0" step="50" value="${goal}" data-set="goal"></label></div>
    <p class="eyebrow">${p.left?(p.cur.status==='now'?'Save this month':'Next to save · '+MON[p.cur.m]):'Nothing left to save'}</p>
    <p class="save-big">${eur(p.need)}<span style="font-size:18px;color:var(--muted);font-weight:600"> / month</span></p>
    <p style="font-size:14px;color:var(--muted);margin:10px 0 16px">to reach ${eur0(goal)} by December. That leaves <b style="color:var(--ink)">${eur(Math.max(0,p.cur.income-p.need))}</b> for spending in ${MON[p.cur.m]} (${eur(Math.max(0,p.cur.income-p.need)/dim(y,p.cur.m))} a day). ${tip(' Months without income are skipped, and anything you did not save moves to the next month.')}</p>
    <div class="meter"><span style="width:${pct.toFixed(1)}%"></span></div>
    <p style="font-size:13px;margin-top:6px"><b class="num">${eur(p.savedDone)}</b> <span style="color:var(--muted)">saved so far (confirmed) · ${pct.toFixed(0)}% of goal</span></p>
  </section>
  <section class="panel"><div class="sec-h"><h2>Spending by month</h2><span class="meta">from your daily expenses</span></div>
    ${barChart(bars,allowM,{vals:false,limitLabel:'budget'})}
    <div class="legend"><span><i style="background:var(--accent)"></i>Within budget</span><span><i style="background:var(--bad)"></i>Over budget</span><span><i style="background:var(--line)"></i>Upcoming</span></div>
  </section></div>
  <section style="margin-top:28px"><div class="sec-h"><h2>Year expenses</h2><span class="meta">${tip('Spending adds up from your daily expenses · click an income to change it for that month')}</span></div>
    <div class="tbl-wrap"><table class="tbl ytbl"><thead><tr><th>Month</th><th class="r">Spent</th><th class="r">Income</th><th class="r">Left over</th><th class="r">Target</th><th class="r">I saved</th><th>Status</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td class="mn">Total ${y}</td><td class="r" data-l="Spent">${eur(totSpent)}</td><td class="r" data-l="Income">${eur(totInc)}</td><td class="r" data-l="Left over">${eur(totSaved)}</td><td class="r" data-l="Target">${eur(goal)}</td><td class="r" data-l="I saved">${eur(p.savedDone)}</td><td class="st"></td></tr></tfoot></table></div>
  </section>
  <section style="margin-top:28px;max-width:640px"><div class="sec-h"><h2>Where the money went</h2><span class="meta">${yList.length} expenses</span></div>${catBars(yList)}</section>
  ${income===0&&TOUR?'<div class="onboard" style="margin-top:24px"><span>Enter your monthly income and savings goal above. The planner then works out how much to save each month and your daily spending allowance.</span></div>':''}`;
};
V.study=()=>{
  const ws=weekStart(TODAY),we=addDays(ws,6),todayI=wdi(TODAY);
  const pc=['var(--bad)','var(--warn)','var(--c-transport)'];
  const rows=state.study.map((r,i)=>`<tr class="${i===todayI?'is-today':''}"><td class="d">${WD[i].toUpperCase()}</td><td><input class="cellin" data-study="subject" data-i="${i}" value="${esc(r.subject)}" placeholder="Subject" maxlength="80" aria-label="Subject for ${WDL[i]}"></td><td><input class="cellin num" type="number" min="0" max="24" step="0.5" data-study="hours" data-i="${i}" value="${r.h||''}" placeholder="0" aria-label="Hours for ${WDL[i]}"></td><td><input type="checkbox" data-chk="rev" data-i="${i}" ${r.rev?'checked':''} aria-label="Revised on ${WDL[i]}"></td><td><button class="pdots" data-act="prio" data-i="${i}" aria-label="Change priority">${pc.map((c,k)=>`<i style="--pc:${c}" class="${r.p===k?'on':''}"></i>`).join('')}</button></td></tr>`).join('');
  const blocks=studyBlocks(TI);
  const items=[...state.upcoming.map(u=>({...u,kind:'own'})),...state.subjects.filter(x=>x.exam).map(x=>({t:`${x.name} exam`,date:x.exam,kind:'exam'}))]
    .filter(u=>u.kind==='own'||dayDiff(parse(u.date),TODAY)>=0).sort((a,b)=>a.date.localeCompare(b.date));
  const soon=items.length?items.map(u=>{const n=dayDiff(parse(u.date),TODAY);
    const pill=n<0?'<span class="pill muted">Passed</span>':n===0?'<span class="pill bad">Today</span>':`<span class="pill ${n<=3?'bad':''}" style="${n>3?'background:var(--paper);color:var(--ink)':''}">${n} day${n===1?'':'s'}</span>`;
    return `<div class="row" style="border-color:color-mix(in srgb,var(--c-fun) 25%,transparent)"><div class="grow t">${esc(u.t)}${u.kind==='exam'?' <span class="tag">from Subjects</span>':''}</div><span class="s">${short(parse(u.date))}</span>${pill}${u.kind==='own'?`<button class="x" data-act="del-upcoming" data-id="${u.id}" data-confirm aria-label="Delete ${esc(u.t)}">×</button>`:''}</div>`}).join(''):tip('<p class="empty">No deadlines yet. Add one below, or give a subject an exam date.</p>');
  return hdr(`Week ${isoWeek(ws)} · ${ws.getDate()} ${M3[ws.getMonth()]} – ${we.getDate()} ${M3[we.getMonth()]}`,'Study planner')+
  `<div class="cols"><div class="stack"><div class="stbl tbl-wrap"><table><thead><tr><th style="background:var(--t-year)">Day</th><th style="background:var(--t-day)">Subject</th><th style="background:var(--t-week)">Time</th><th style="background:var(--t-year)">Revised</th><th style="background:var(--t-study)">Priority</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="panel" id="revpanel">${revisedPanel()}</div>
  </div>
  <div class="stack"><section><div class="sec-h"><h2>Today's study blocks</h2><span class="meta">${short(TODAY)}</span></div><div id="blocklist">${blockRows(blocks)}</div>${blockForm(TI,true)}</section>
    <section class="soon"><h2 style="margin-bottom:6px">Coming up</h2>${soon}
      <form class="mini" data-form="upcoming" autocomplete="off" style="margin-top:10px"><input id="up-title" name="t" placeholder="+ Add a deadline" required aria-label="Deadline"><input name="date" type="date" value="${iso(addDays(TODAY,7))}" required aria-label="Deadline date"><button class="btn">Add</button></form></section>
    <div class="sticky"><p class="eyebrow">Note to self</p><textarea id="note" rows="2" data-note aria-label="Note to self">${esc(state.note)}</textarea></div>
  </div></div>`+subjectsSection();
};
V.tasks=()=>{
  const ws=weekStart(TODAY),we=iso(addDays(ws,6));
  const F={open:t=>!t.done,today:t=>!t.done&&t.due===TI,week:t=>!t.done&&t.due>=iso(ws)&&t.due<=we,overdue:t=>!t.done&&t.due<TI,done:t=>t.done,all:()=>true};
  const L={open:'Open',today:'Today',week:'This week',overdue:'Overdue',done:'Done',all:'All'};
  const f=state.taskFilter in F?state.taskFilter:'open';
  const po={high:0,med:1,low:2};
  const list=state.tasks.filter(F[f]).sort((a,b)=>a.done-b.done||a.due.localeCompare(b.due)||po[a.priority]-po[b.priority]);
  const c=k=>state.tasks.filter(F[k]).length;
  return hdr(`${c('open')} open · ${c('today')} due today · ${c('overdue')} overdue`,'Tasks')+
  `<form class="addform task" data-form="task" autocomplete="off">
    <input id="t-title" name="title" placeholder="Add a task…" required aria-label="Task">
    <input id="t-due" name="due" type="date" value="${TI}" required aria-label="Due date">
    <select id="t-prio" name="priority" aria-label="Priority"><option value="high">High</option><option value="med" selected>Medium</option><option value="low">Low</option></select>
    <input id="t-tag" name="tag" placeholder="Tag" aria-label="Tag">
    <button class="btn primary">Add task</button></form>
  <div class="filters">${Object.keys(L).map(k=>`<button class="fbtn" data-act="filter" data-f="${k}" aria-pressed="${k===f}">${L[k]}<b>${c(k)}</b></button>`).join('')}</div>
  <section>${list.length?list.map(taskRow).join(''):tip('<p class="empty">No tasks in this view.</p>')}</section>
  <div class="legend" style="margin-top:16px"><span><i style="background:var(--bad);border-radius:50%"></i>High</span><span><i style="background:var(--warn);border-radius:50%"></i>Medium</span><span><i style="background:var(--c-transport);border-radius:50%"></i>Low priority</span></div>`;
};
V.money=()=>{
  const p=state.expPeriod,c=cursor;let a,b,title,eyebrow;
  if(p==='day'){a=b=c;title=`${c.getDate()} ${MON[c.getMonth()]} ${c.getFullYear()}`;eyebrow=WDL[wdi(c)]}
  else if(p==='week'){a=weekStart(c);b=addDays(a,6);title=`${a.getDate()} ${M3[a.getMonth()]} – ${b.getDate()} ${M3[b.getMonth()]}`;eyebrow=`Week ${isoWeek(a)}`}
  else if(p==='month'){a=new Date(c.getFullYear(),c.getMonth(),1);b=new Date(c.getFullYear(),c.getMonth(),dim(c.getFullYear(),c.getMonth()));title=`${MON[c.getMonth()]} ${c.getFullYear()}`;eyebrow='Month'}
  else{a=new Date(c.getFullYear(),0,1);b=new Date(c.getFullYear(),11,31);title=`${c.getFullYear()}`;eyebrow='Whole year'}
  const list=expIn(a,b),spent=sum(list);
  const endElapsed=b<TODAY?b:TODAY,days=a>TODAY?0:dayDiff(endElapsed,a)+1;
  const allow=allowRange(a,b);
  const seg=`<div class="seg" role="group" aria-label="Period">${['day','week','month','year'].map(k=>`<button data-act="period" data-p="${k}" aria-pressed="${k===p}">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div>`;
  // ledger grouped by date
  const byDate={};list.forEach(e=>(byDate[e.date]=byDate[e.date]||[]).push(e));
  const dates=Object.keys(byDate).sort().reverse();
  const lim=state.showAll?dates.length:14;
  const ledger=dates.length?dates.slice(0,lim).map(d=>`<div class="dgroup"><span>${short(parse(d))}</span><span class="num">${eur(sum(byDate[d]))}</span></div>${expRows(byDate[d],{showDate:false})}`).join('')+(dates.length>lim?`<p style="padding-top:12px"><button class="linkbtn" data-act="showall">Show all ${dates.length} days</button></p>`:''):'<p class="empty">No expenses in this period.</p>';
  let summary='';
  if(p==='year'){
    const y=c.getFullYear();
    summary=`<section class="panel"><div class="sec-h"><h2>Monthly totals</h2><span class="meta">auto-summed</span></div>${MON.map((mn,m)=>{const v=sum(expIn(new Date(y,m,1),new Date(y,m,dim(y,m))));return `<div class="row" style="padding:7px 0"><span class="grow">${mn}</span><span class="amt" style="${v?'':'color:var(--muted)'}">${eur(v)}</span></div>`}).join('')}<div class="total-line"><span>Total ${y}</span><span class="amt">${eur(spent)}</span></div></section>`;
  }
  const def=(TODAY>=a&&TODAY<=b)?TI:iso(a);
  return hdr(eyebrow,title,seg+navBtns())+
  `<div class="tiles"><div class="tile"><p class="l">Total spent</p><p class="v">${eur(spent)}</p><p class="s">${list.length} expense${list.length===1?'':'s'}</p></div>
   <div class="tile"><p class="l">Per day</p><p class="v">${eur(days?spent/days:0)}</p><p class="s">average over ${days} day${days===1?'':'s'}</p></div>
   <div class="tile"><p class="l">Allowance</p><p class="v">${eur(allow)}</p><p class="s">for this ${p}</p></div>
   <div class="tile"><p class="l">${spent>allow?'Over by':'Left'}</p><p class="v" style="color:${spent>allow?'var(--bad)':'var(--good)'}">${eur(Math.abs(allow-spent))}</p><p class="s">${allow?Math.round(spent/allow*100):0}% of allowance used</p></div></div>
  <div class="cols"><section><div class="sec-h"><h2>Add an expense</h2></div>${expForm(def)}${ledger}</section>
  <div class="stack"><section class="panel"><div class="sec-h"><h2>By category</h2></div>${catBars(list)}<div class="total-line"><span>Total</span><span class="amt">${eur(spent)}</span></div></section>${summary}</div></div>`;
};

/* ---------- render + events ---------- */
const view=document.getElementById('view');
/** Grow a "where to find it" box to fit its text. */
function fitSrc(t){t.style.height='auto';t.style.height=t.scrollHeight+2+'px'}
let drawing=false; // true while the page is re-drawn: boxes removed then fire change/focusout, which must be ignored
function render(focusId){
  if(!state)return;
  drawing=true;
  const PT='nav[aria-label="Planner sections"] .tab';   // the notebook inside the Profile tab has tabs of its own
  document.querySelectorAll(PT).forEach(t=>t.setAttribute('aria-selected',t.dataset.tab===state.tab));
  {const t=document.querySelector(PT+'[aria-selected="true"]'),r=t&&t.parentElement;   // phone: keep the open tab in view in the scrolling tab strip
   if(r&&r.scrollWidth>r.clientWidth){const a=t.getBoundingClientRect(),b=r.getBoundingClientRect();r.scrollBy({left:a.left-b.left-(b.width-a.width)/2})}}
  // Keep text typed in other "+ Add …" boxes that hasn't been added yet, so re-drawing doesn't wipe it
  const drafts=[...view.querySelectorAll('form.mini input[id]:not([type=date])')].filter(i=>i.value.trim()).map(i=>[i.id,i.value]);
  view.innerHTML=V[state.tab]();
  drafts.forEach(([id,v])=>{const el=document.getElementById(id);if(el&&!el.value)el.value=v});
  drawing=false;
  paintHourRows();
  layoutSubjects();
  document.querySelectorAll('textarea[data-src]').forEach(fitSrc);
  blockMsg=null;
  save();
  if(focusId){const el=document.getElementById(focusId);if(el){el.focus();if(el.dataset.edit)el.select()}}
}
/** Study tab: each subject stays whole in one box, and the boxes pack tightly (masonry) with no big empty gaps.
 *  Every subject lists its chapters in one straight column, however many it has. */
let subjRO=null;
function layoutSubjects(){
  const box=document.querySelector('.subjects');if(!box)return;
  const cards=[...box.children],ROW=8,GAP=16;
  cards.forEach(c=>{c.style.gridRowEnd=''});
  cards.forEach(c=>{c.style.gridRowEnd='span '+Math.ceil((c.getBoundingClientRect().height+GAP)/ROW)});
  if(window.ResizeObserver){   // a box that grows (a note opens, a chapter is added) re-packs the rest
    if(subjRO)subjRO.disconnect();
    subjRO=new ResizeObserver(()=>{clearTimeout(layoutSubjects.t);layoutSubjects.t=setTimeout(()=>{subjRO.disconnect();layoutSubjects()},60)});
    cards.forEach(c=>subjRO.observe(c));
  }
}
window.addEventListener('resize',()=>{clearTimeout(layoutSubjects.r);layoutSubjects.r=setTimeout(layoutSubjects,120)});
/** Save (or, with keep=false, drop) the new name typed into an edit box. */
function finishEdit(el,keep){
  const kind=el.dataset.edit,id=kind==='tp'?el.dataset.tid:el.dataset.cid;
  if(editKey!==kind+':'+id)return;   // already saved
  editKey=null;
  const v=el.value.trim(),c=findC(el.dataset.sid,el.dataset.cid);
  if(keep&&v&&c){
    if(kind==='ch'&&v!==c.title){c.title=v;sync('chapter.rename',{id,title:v})}
    const t=kind==='tp'&&c.topics.find(x=>x.id===id);
    if(t&&v!==t.t){t.t=v;sync('topic.rename',{id,title:v})}
  }
  const next=document.activeElement&&document.activeElement!==el&&document.activeElement.id;
  render(next||'tp-'+el.dataset.cid);
}
function setMonth(y,m,f,v){
  const k=`${y}-${m}`,o=state.months[k]||(state.months[k]={income:null,save:null});
  o[f]=v;sync('month.save',{year:y,month:m,[f]:v});
}
function shift(n){
  const t=state.tab==='money'?state.expPeriod:state.tab,c=cursor;
  if(t==='day')cursor=addDays(c,n);
  else if(t==='week')cursor=addDays(c,7*n);
  else if(t==='month')cursor=new Date(c.getFullYear(),c.getMonth()+n,1);
  else if(t==='year')cursor=new Date(c.getFullYear()+n,c.getMonth(),1);
  state.showAll=false;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b||!state&&b.dataset.act!=='theme')return;
  const a=b.dataset.act;
  if(b.hasAttribute('data-confirm')&&!b.dataset.armed){b.dataset.armed='1';b.textContent='Delete?';b.style.fontSize='12px';b.style.fontWeight='700';return}
  switch(a){
    case 'del-subj':state.subjects=state.subjects.filter(s=>s.id!==b.dataset.id);sync('subject.delete',{id:b.dataset.id});break;
    case 'del-ch':{const s=findS(b.dataset.sid);if(s)s.chapters=s.chapters.filter(c=>c.id!==b.dataset.cid);sync('chapter.delete',{id:b.dataset.cid});break}
    case 'mat':{const c=findC(b.dataset.sid,b.dataset.cid);if(!c)return;
      if(hasMat(c)){const el=document.getElementById('mat-'+c.id);if(el)el.scrollIntoView({block:'nearest'});return}
      if(matOpen.has(c.id))matOpen.delete(c.id);else matOpen.add(c.id);break}
    case 'src':{const c=findC(b.dataset.sid,b.dataset.cid);if(!c)return;
      if(c.src||srcOpen.has(c.id)){const el=document.getElementById('src-'+c.id);if(el&&document.activeElement!==el){el.focus();return}}
      if(!c.src&&srcOpen.has(c.id)){srcOpen.delete(c.id);break}
      srcOpen.add(c.id);render('src-'+c.id);return}
    case 'edit':{
      const cur=document.querySelector('input[data-edit]');if(cur)finishEdit(cur,true);
      editKey=b.dataset.key;const[k,id]=editKey.split(':');render(`ed-${k}-${id}`);return}
    case 'del-topic':{const c=findC(b.dataset.sid,b.dataset.cid);if(c)c.topics=c.topics.filter(t=>t.id!==b.dataset.tid);sync('topic.delete',{id:b.dataset.tid});break}
    case 'del-upcoming':state.upcoming=state.upcoming.filter(u=>u.id!==b.dataset.id);sync('upcoming.delete',{id:b.dataset.id});break;
    case 'pick-free':{const f=document.querySelector('form[data-form=block]');if(f){f.elements.from.value=b.dataset.from;f.elements.to.value=b.dataset.to;f.elements.from_m.value=f.elements.to_m.value='0';f.elements.title.focus()}return}
    case 'hour-mins':{
      const di=b.dataset.date;let h=+b.dataset.h;
      if(!resolveHour(di,h)){b.closest('.hr').querySelector('[data-hf=text]').focus();return}
      while(isCont(di,h))h--;            // a later hour of a longer entry: edit it where it starts
      const row=document.getElementById('hr-'+h),ed=row.querySelector('.hmin');
      if(ed){ed.remove();return}
      row.insertAdjacentHTML('beforeend',minsEditor(di,h));
      row.querySelector('.hmin select').focus();return}
    case 'del-block':{
      const di=b.dataset.date,wd=wdi(parse(di)),wk=state.weekly[wd]||(state.weekly[wd]={}),day=state.hours[di]||{};
      for(let h=+b.dataset.start;h<+b.dataset.end;h++){if(day[h])delete day[h];else delete wk[h]}
      hourSync('hours.clear',{date:di,start:+b.dataset.start,end:+b.dataset.end});break}
    case 'hour-repeat':toggleRepeat(b.dataset.date,+b.dataset.h);hourSync('hour.repeat',{date:b.dataset.date,hour:+b.dataset.h});break;
    case 'gcal-sync':gcalRun(true);return;
    case 'imp-close':impClose();return;
    case 'imp-save':importSave(b);return;
    case 'imp-help':importHelp();return;
    case 'imp-example':importExample(b.dataset.fmt);return;
    case 'msave-reset':setMonth(+b.dataset.y,+b.dataset.m,'save',null);break;
    case 'tab':state.tab=b.dataset.tab;state.showAll=false;window.scrollTo({top:0});break;
    case 'shift':shift(+b.dataset.n);break;
    case 'today':cursor=new Date(TODAY);break;
    case 'goto':cursor=parse(b.dataset.date);state.tab='day';break;
    case 'del-exp':state.exps=state.exps.filter(x=>x.id!==b.dataset.id);sync('expense.delete',{id:b.dataset.id});break;
    case 'del-task':state.tasks=state.tasks.filter(x=>x.id!==b.dataset.id);sync('task.delete',{id:b.dataset.id});break;
    case 'prio':{const i=+b.dataset.i,r=state.study[i];r.p=(r.p+1)%3;sync('study.save',{weekday:i,priority:r.p});break}
    case 'period':state.expPeriod=b.dataset.p;state.showAll=false;break;
    case 'filter':state.taskFilter=b.dataset.f;break;
    case 'showall':state.showAll=true;break;
    case 'theme':toggleTheme();return;
    default:return;
  }
  render();
});
document.addEventListener('change',e=>{
  if(!state)return;
  const t=e.target;
  if(t.dataset.matup){const fs=[...(t.files||[])];t.value='';if(fs.length)matUpload(t.dataset.matup,fs);return}
  if(t.id==='impFile'){const f=t.files&&t.files[0];t.value='';if(f)importFile(f,t.dataset.date);return}
  if(t.dataset.imp!=null){if(impList&&impList[+t.dataset.imp])impList[+t.dataset.imp].type=t.value;return}
  if(t.id==='bk-date'&&t.value){const fh=document.getElementById('freeh');if(fh)fh.innerHTML=freeChips(t.value);return}
  if(t.dataset.hm){
    const di=t.dataset.date,h=+t.dataset.h,e=resolveHour(di,h),row=t.closest('.hr');if(!e)return;
    if(t.dataset.hm==='s'){
      const v=+t.value;
      if(h*60+v>=spanEnd(di,h)){toast('The start has to be before the end.');t.value=String(hS(e));return}
      setHour(di,h,{s:v});hourSync('hour.save',{date:di,hour:h,s:v});
    }else{
      const end=t.dataset.hm==='len'?h*60+hS(e)+ +t.value*60:+t.value,oldEnd=spanEnd(di,h);
      // The next entry started right where this one ended (14:30 after 14:00–14:30), so it keeps following it
      const fh=Math.floor(oldEnd/60)+1,f=oldEnd%60&&fh<24?resolveHour(di,fh):null;
      const follow=used(f)&&fh*60+hS(f)===oldEnd&&end>(fh-1)*60&&end<=fh*60,ns=end-fh*60;
      if(follow)setHour(di,fh,{s:ns});
      const err=setSpan(di,h,end);
      if(err){if(follow)setHour(di,fh,{s:hS(f)});toast(err);const ed=row.querySelector('.hmin');if(ed)ed.outerHTML=minsEditor(di,h);return}
      // Save in an order the server accepts: move the next entry out of the way before growing, after shrinking
      const span=()=>hourSync('hour.span',{date:di,hour:h,end}),move=()=>hourSync('hour.save',{date:di,hour:fh,s:ns});
      if(!follow)span();else if(end>oldEnd)move().then(span);else span().then(move);
    }
    paintHourRows();
    const ed=row.querySelector('.hmin');if(ed){ed.outerHTML=minsEditor(di,h);row.querySelector(`[data-hm=${t.dataset.hm}]`).focus()}
    const sm=document.getElementById('hsum');if(sm)sm.innerHTML=hourSum(di);
    const bl=document.getElementById('blocklist');if(bl)bl.innerHTML=blockRows(studyBlocks(di));
    const fh=document.getElementById('freeh');if(fh)fh.innerHTML=freeChips(di);
    return;
  }
  if(t.dataset.hf){
    const di=t.dataset.date,h=+t.dataset.h,field=t.dataset.hf,patch={[field]:t.value};
    // A new entry starts where the hour before ended (14:30, not 15:00)
    if(!resolveHour(di,h)&&gapBefore(di,h)<0)patch.s=gapBefore(di,h);
    setHour(di,h,patch);
    hourSync('hour.save',{date:di,hour:h,...patch});
    const row=t.closest('.hr');if(row)paintHourRow(row);
    const nr=document.getElementById('hr-'+(h+1));if(nr)paintHourRow(nr);
    const sm=document.getElementById('hsum');if(sm)sm.innerHTML=hourSum(di);
    const bl=document.getElementById('blocklist');if(bl)bl.innerHTML=blockRows(studyBlocks(di));
    const fh=document.getElementById('freeh');if(fh)fh.innerHTML=freeChips(di);
    return;
  }
  if(t.dataset.study){
    // Weekly study table: subject / topic / hours. Saved without re-drawing so Tab keeps working.
    const i=+t.dataset.i,f=t.dataset.study,r=state.study[i];
    if(f==='hours'){const v=Math.max(0,Math.min(24,parseFloat(t.value)||0));r.h=v;t.value=v;sync('study.save',{weekday:i,hours:v})}
    else{r[f]=t.value.trim();sync('study.save',{weekday:i,[f]:r[f]})}
    const rp=document.getElementById('revpanel');if(rp)rp.innerHTML=revisedPanel();
    return;
  }
  if(drawing||t.dataset.edit)return;   // saved when the box is left (focusout below)
  const af=t.closest('form[data-form=chapter],form[data-form=topic]');
  if(af){
    // Typed a chapter or topic and moved on without pressing Add / Enter: add it anyway
    if(t.value.trim()&&!af.dataset.busy){af.dataset.auto='1';af.requestSubmit()}
    return;
  }
  if(t.hasAttribute('data-src')){
    // Where to find a chapter. Saved without re-drawing so focus is kept.
    const c=findC(t.dataset.sid,t.dataset.cid);if(!c)return;
    c.src=t.value.trim();sync('chapter.source',{id:c.id,source:c.src});
    const btn=t.closest('.ch').querySelector('.srcbtn');if(btn)btn.classList.toggle('on',!!c.src);
    return;
  }
  if(t.dataset.chk){
    const k=t.dataset.chk,on=t.checked;
    if(k==='task'){const x=state.tasks.find(i=>i.id===t.dataset.id);if(x)x.done=on;sync('task.toggle',{id:t.dataset.id,done:on})}
    if(k==='msaved'){const y=+t.dataset.y,m=+t.dataset.m;setMonth(y,m,'actual',on?Math.round(targets(y)[m].t*100)/100:null)}
    if(k==='block'){if(on)state.blockDone[t.dataset.key]=true;else delete state.blockDone[t.dataset.key];sync('block.done',{key:t.dataset.key,done:on})}
    if(k==='rev'){state.study[+t.dataset.i].rev=on;sync('study.save',{weekday:+t.dataset.i,revised:on})}
    if(k==='ch'){const c=findC(t.dataset.sid,t.dataset.cid);if(c){c.done=on;c.topics.forEach(x=>x.done=on)}sync('chapter.toggle',{id:t.dataset.cid,done:on})}
    if(k==='topic'){const c=findC(t.dataset.sid,t.dataset.cid);const x=c&&c.topics.find(i=>i.id===t.dataset.tid);if(x)x.done=on;sync('topic.toggle',{id:t.dataset.tid,done:on})}
    render();
  } else if(t.dataset.mf){
    // One month's income (Year table) or savings target (Month tab). Empty = back to the normal amount.
    const y=+t.dataset.y,m=+t.dataset.m,f=t.dataset.mf,raw=t.value.trim(),v=raw===''?null:Math.round(parseFloat(raw)*100)/100;
    if(v!==null&&!(v>=0)){render();return}
    setMonth(y,m,f,v);
    setTimeout(()=>render(document.activeElement&&document.activeElement.id),0); // keep focus when tabbing down the table
  } else if(t.dataset.set){
    const v=parseFloat(t.value);
    if(!isNaN(v)&&v>=0){state.settings[t.dataset.set]=v;sync('settings.save',{[t.dataset.set]:v});render()}
  }
});
let noteTimer=null;
document.addEventListener('input',e=>{
  if(e.target.hasAttribute('data-src'))fitSrc(e.target);
  if(state&&e.target.hasAttribute('data-note')){
    state.note=e.target.value;clearTimeout(noteTimer);
    noteTimer=setTimeout(()=>sync('settings.save',{note:state.note}),600);
  }
});
// Leaving an edit box saves it. Waits a moment so a click on another button still lands.
document.addEventListener('focusout',e=>{const t=e.target;if(!drawing&&t.dataset&&t.dataset.edit)setTimeout(()=>finishEdit(t,true),0)});
document.addEventListener('keydown',e=>{
  const t=e.target;if(!t.dataset||!t.dataset.edit)return;
  if(e.key==='Enter'){e.preventDefault();finishEdit(t,true)}
  else if(e.key==='Escape'){e.preventDefault();finishEdit(t,false)}
});
document.addEventListener('submit',async e=>{
  const f=e.target;
  if(!f.dataset.form)return;           // normal forms (like Log out) submit as usual
  e.preventDefault();
  if(!state||f.dataset.busy)return;
  const d=Object.fromEntries(new FormData(f));
  const btn=f.querySelector('button');
  const auto=!!f.dataset.auto;delete f.dataset.auto;
  // Added by leaving the box: after saving, keep the cursor where you clicked next
  // Empty the box that was just added, even if the page was re-drawn while saving
  const added=v=>{f.reset();const el=f.querySelector('input[id]'),live=el&&document.getElementById(el.id);if(live&&live.value.trim()===v)live.value=''};
  const focusNext=id=>{const a=document.activeElement;return auto&&a&&a.id&&a!==document.body?a.id:id};
  f.dataset.busy='1';if(btn)btn.disabled=true;
  try{
    if(f.dataset.form==='exp'){
      const amount=Math.round(parseFloat(d.amount)*100)/100;if(!(amount>0)||!d.desc.trim())return;
      const item={date:d.date||TI,desc:d.desc.trim(),cat:d.cat,amount};
      const r=await api('expense.add',item);
      state.exps.push({id:r.id,...item});
      render('f-desc');
    } else if(f.dataset.form==='task'){
      if(!d.title.trim())return;
      const item={title:d.title.trim(),due:d.due||TI,priority:d.priority,tag:d.tag.trim()};
      const r=await api('task.add',item);
      state.tasks.push({id:r.id,...item,done:false});
      render('t-title');
    } else if(f.dataset.form==='block'){
      const di=d.date||TI,a=+d.from*60+ +d.from_m,z=Math.min(1440,+d.to*60+ +d.to_m),title=d.title.trim();if(!title)return;
      if(z<=a){blockMsg={ok:false,html:'The end time has to be after the start time.'};render('bk-title');return}
      const clash=[];
      let h0=Math.floor(a/60);const h1=Math.ceil(z/60);
      // Starts in the free end of a used hour (e.g. 18:30 after a lecture until 18:30): keep it in the next hour's row
      {const x=resolveHour(di,h0);if(used(x)&&hE(x)<=a%60&&z>(h0+1)*60)h0++}
      {const n=resolveHour(di,h1);if(used(n)&&hS(n)<0&&z>h1*60+hS(n)){blockMsg={ok:false,html:`${esc(n.text)} starts at ${hm(h1*60+hS(n))}. Pick an earlier end.`};render('bk-title');return}}
      for(let h=h0;h<h1;h++){const x=resolveHour(di,h);if(x&&x.text&&x.text.trim())clash.push(`${pad(h)}:00 ${HT[x.type]?HT[x.type][0]+': ':''}${esc(x.text)}`)}
      if(clash.length){blockMsg={ok:false,html:`That time is already taken (${clash.join(', ')}). Pick one of the free times below.`};render('bk-title');return}
      try{await api('block.add',{date:di,from:hm(a),to:hm(z),title});gcalLater(di)}
      catch(err){if(err.status===409||err.status===400){blockMsg={ok:false,html:esc(err.message)};render('bk-title');return}throw err}
      const day=state.hours[di]||(state.hours[di]={});
      for(let h=h0;h<h1;h++){
        const x={text:title,type:'study'};
        if(h===h0&&a!==h*60)x.s=a-h*60;
        if(h===h1-1&&z-h*60<60)x.e=z-h*60;
        day[h]=x;
      }
      blockMsg={ok:true,html:`Added ${esc(title)}, ${hm(a)}–${hm(z)} on ${short(parse(di))}. It's in Hour by hour too.`};
      render('bk-title');
    } else if(f.dataset.form==='subject'){
      if(!d.name.trim())return;
      const r=await api('subject.add',{name:d.name.trim(),exam:d.exam||''});
      state.subjects.push({id:r.id,name:d.name.trim(),c:r.c,exam:d.exam||'',chapters:[]});
      render('sb-name');
    } else if(f.dataset.form==='chapter'){
      const s=findS(f.dataset.sid);if(!s||!d.title.trim())return;
      const r=await api('chapter.add',{subject_id:s.id,title:d.title.trim()});
      s.chapters.push({id:r.id,title:d.title.trim(),done:false,src:'',topics:[]});
      added(d.title.trim());render(focusNext('ch-'+s.id));
    } else if(f.dataset.form==='topic'){
      const c=findC(f.dataset.sid,f.dataset.cid);if(!c||!d.t.trim())return;
      const r=await api('topic.add',{chapter_id:c.id,title:d.t.trim()});
      c.topics.push({id:r.id,t:d.t.trim(),done:false});
      added(d.t.trim());render(focusNext('tp-'+c.id));
    } else if(f.dataset.form==='upcoming'){
      if(!d.t.trim()||!d.date)return;
      const r=await api('upcoming.add',{title:d.t.trim(),date:d.date});
      state.upcoming.push({id:r.id,t:d.t.trim(),date:d.date});
      f.reset();render('up-title');
    }
  }catch(err){
    toast(err.message);
  }finally{
    delete f.dataset.busy;if(btn&&btn.isConnected)btn.disabled=false;
  }
});

/* ---------- theme ---------- */
const root=document.documentElement,mq=window.matchMedia('(prefers-color-scheme: dark)');
const eff=()=>root.getAttribute('data-theme')||(mq.matches?'dark':'light');
const SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function paintThemeBtn(){const d=eff()==='dark';document.getElementById('themeBtn').innerHTML=d?SUN+'<span class="lbl">Light</span>':MOON+'<span class="lbl">Dark</span>'}
function toggleTheme(){const n=eff()==='dark'?'light':'dark';root.setAttribute('data-theme',n);try{localStorage.setItem('sara-theme',n)}catch(e){}paintThemeBtn()}
try{const t=localStorage.getItem('sara-theme');if(t==='dark'||t==='light')root.setAttribute('data-theme',t)}catch(e){}
mq.addEventListener&&mq.addEventListener('change',paintThemeBtn);
new MutationObserver(paintThemeBtn).observe(root,{attributes:true,attributeFilter:['data-theme']});
paintThemeBtn();

// Coming back from calendar.php (Google Calendar connect / disconnect)
{const r=new URLSearchParams(location.search).get('gcal');
 const M={connected:'Google Calendar is connected. Your hours are on their way to the "Splanner" calendar.',disconnected:'Google Calendar is disconnected. You can delete the "Splanner" calendar in Google if you don\'t need it.',cancelled:'Google Calendar was not connected.','no-calendar':'Please tick the calendar box on Google\'s page so the planner can add your hours.','not-set-up':'Google Calendar is not set up on this site yet.',error:"Couldn't connect Google Calendar. Please try again."};
 if(r){if(M[r])setTimeout(()=>toast(M[r]),300);history.replaceState(null,'',location.pathname)}}
// Blog, Interests and Profile are drawn by social.js
V.profile=()=>window.SPLX?window.SPLX.html('profile'):'';
window.SPL_RENDER=render;
window.SPL_TAB=()=>state&&state.tab;
document.getElementById('coil').innerHTML='<span></span>'.repeat(90);
{const tc=document.getElementById('todayChip');if(tc)tc.textContent=`${WDL[wdi(TODAY)]}, ${TODAY.getDate()} ${MON[TODAY.getMonth()]}`}
reload();
})();
