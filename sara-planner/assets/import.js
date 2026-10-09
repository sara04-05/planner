/* Import a planner you already have (Excel, CSV, PDF, Word or text) into Hour by hour.
   The file is read here in the browser; only the times and activities found are sent to the server.
   The readers are loaded from cdnjs the first time a file of that kind is picked. */
(function(){
const LIBS={
  xlsx:['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'],
  pdf:['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'],
  docx:['https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'],
};
const PDF_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const loaded={};
function loadScript(src){
  return loaded[src]||(loaded[src]=new Promise((ok,bad)=>{
    const s=document.createElement('script');s.src=src;s.async=true;
    s.onload=ok;s.onerror=()=>{delete loaded[src];bad(new Error("Couldn't load the file reader. Check your internet connection and try again."))};
    document.head.appendChild(s);
  }));
}
const need=k=>Promise.all(LIBS[k].map(loadScript));

const clean=s=>String(s==null?'':s).replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();

/* ---------- reading files into rows of cells ---------- */
async function readXlsx(file){
  await need('xlsx');
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
  const rows=[];
  for(const n of wb.SheetNames){
    const sh=wb.Sheets[n];if(!sh['!ref'])continue;
    const r=XLSX.utils.decode_range(sh['!ref']);
    for(let y=r.s.r;y<=r.e.r;y++){
      const row=[];
      for(let x=r.s.c;x<=r.e.c;x++){
        const c=sh[XLSX.utils.encode_cell({r:y,c:x})];
        row.push(c?cellText(c):'');
      }
      if(row.some(Boolean))rows.push(row);
    }
  }
  return rows;
}
/** A spreadsheet cell as text. Times typed as times are stored as a fraction of a day (0.5 = 12:00). */
function cellText(c){
  if(c.t==='n'&&c.v>=0&&c.v<1&&!/\d:\d/.test(c.w||'')&&/[hH]|:/.test(c.z||'')){const m=Math.round(c.v*1440);return `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`}
  if(c.t==='d'&&c.v instanceof Date)return `${c.v.getHours()}:${String(c.v.getMinutes()).padStart(2,'0')}`;
  return clean(c.w!=null?c.w:c.v);
}
async function readPdf(file){
  await need('pdf');
  pdfjsLib.GlobalWorkerOptions.workerSrc=PDF_WORKER;
  const doc=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const rows=[];
  for(let p=1;p<=doc.numPages;p++){
    const items=(await (await doc.getPage(p)).getTextContent()).items.filter(i=>i.str&&i.str.trim());
    // Group the words into lines by their height on the page, then split a line into cells where there's a wide gap
    const lines=[];
    for(const it of items){
      const y=it.transform[5],x=it.transform[4],h=Math.abs(it.transform[3])||10;
      let l=lines.find(l=>Math.abs(l.y-y)<h*.5);
      if(!l)lines.push(l={y,h,items:[]});
      l.items.push({x,w:it.width||0,s:it.str});
    }
    lines.sort((a,b)=>b.y-a.y);
    for(const l of lines){
      l.items.sort((a,b)=>a.x-b.x);
      const cells=[];let cur=null,end=0;
      for(const it of l.items){
        if(cur!=null&&it.x-end<l.h*1.5)cur+=(it.x-end>l.h*.15?' ':'')+it.s;
        else{if(cur!=null)cells.push(clean(cur));cur=it.s}
        end=it.x+it.w;
      }
      if(cur!=null)cells.push(clean(cur));
      rows.push(cells.filter(Boolean));
    }
  }
  return rows;
}
async function readDocx(file){
  await need('docx');
  const {value}=await mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()});
  const body=new DOMParser().parseFromString(value,'text/html').body,rows=[];
  (function walk(el){
    for(const n of el.children){
      if(n.tagName==='TABLE'){
        for(const tr of n.querySelectorAll('tr'))rows.push([...tr.children].map(td=>clean(td.textContent)));
      }else if(/^(UL|OL)$/.test(n.tagName))walk(n);
      else{const t=clean(n.textContent);if(t)rows.push([t])}
    }
  })(body);
  return rows;
}
async function readText(file){
  return (await file.text()).split(/\r?\n/).map(l=>l.split(/\t|\s*\|\s*|;/).map(clean).filter(Boolean)).filter(r=>r.length);
}
/** Turn any supported file into rows of cells (a table, or one cell per line of text). */
async function extractRows(file){
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  if(['xlsx','xlsm','xls','ods','csv'].includes(ext))return readXlsx(file);
  if(ext==='pdf')return readPdf(file);
  if(ext==='docx')return readDocx(file);
  if(ext==='doc')throw new Error('Old .doc files can\'t be read. In Word, use File > Save As > Word Document (.docx), then try again.');
  if(['txt','text','md'].includes(ext))return readText(file);
  throw new Error('Pick an Excel, CSV, PDF or Word (.docx) file.');
}

/* ---------- finding times and activities ---------- */
// One time: 8:00, 08.30, 8h, 8h30, 8 am, 8:30pm
const T=String.raw`(\d{1,2})(?:\s*(?:[:.]|h)\s*(\d{2})|(h))?\s*(a\.?m\.?|p\.?m\.?)?`;
const SEP=String.raw`\s*(?:-|–|—|−|to|till|until|(?:deri|gjer|gjersa)(?:\s+n[eë](?:\s+or[eë]n)?)?|n[eë])\s*`;
const NB=String.raw`(?<![\d.:/,])`,NA=String.raw`(?![\d]|[.:/]\d)`;
const RANGE=new RegExp(NB+T+SEP+T+NA,'i'),ONE=new RegExp(NB+T+NA,'i');

/** Minutes since midnight, or null. `strict`: a bare number (like "8") isn't a time on its own. */
function toMin(h,m,hflag,ap,strict){
  if(strict&&m==null&&!hflag&&!ap)return null;
  h=+h;m=m==null?0:+m;
  if(ap){ap=ap[0].toLowerCase();if(h<1||h>12)return null;if(ap==='p'&&h<12)h+=12;if(ap==='a'&&h===12)h=0}
  if(h>24||m>59||(h===24&&m))return null;
  return h*60+m;
}
/** Albanian ways of writing a time, rewritten to the forms above:
    "ora 8" -> 8:00, "8 e gjysmë" -> 8:30, "8 e një çerek" -> 8:15, "9 pa një çerek" -> 8:45,
    "8 e 20" -> 8:20, "3 pasdite" / "8 e mbrëmjes" -> pm, "8 paradite" / "8 e mëngjesit" -> am, "mesditë" -> 12:00. */
const H2=n=>String(n).padStart(2,'0');
function albanian(t){
  return t
    .replace(/\b(mesdit[eë]s?|mesdite)(?![a-zëç])/gi,'12:00')
    .replace(/\b(mesnat[eë]s?)(?![a-zëç])/gi,'24:00')
    .replace(/(\d{1,2})\s+e\s+gjysm[eë](?![a-zëç])/gi,'$1:30')
    .replace(/(\d{1,2})\s+e\s+(?:nj[eë]\s+)?[cç]erek(?![a-zëç])/gi,'$1:15')
    .replace(/(\d{1,2})\s+pa\s+(?:nj[eë]\s+)?[cç]erek(?![a-zëç])/gi,(m,h)=>`${(+h+23)%24}:45`)
    .replace(/(\d{1,2})\s+pa\s+(\d{1,2})(?![a-zëç])(?:\s*min(?:uta)?(?![a-zëç]))?/gi,(m,h,mm)=>+mm<60?`${(+h+23)%24}:${H2(60-mm)}`:m)
    .replace(/(?<![\d.:])(\d{1,2})\s+e\s+(\d{2})(?![a-zëç])(?:\s*min(?:uta)?(?![a-zëç]))?/gi,(m,h,mm)=>+mm<60&&+h<25?`${h}:${H2(mm)}`:m)
    .replace(/\b(?:n[eë]\s+)?or(?:a|[eë]n|[eë])\s+(\d{1,2})(?![\d:.]|\s*h(?![a-zëç]))/gi,'$1:00')
    .replace(/(\d{1,2}(?::\d{2})?)\s*(?:e\s+)?(?:pasdit[eë]s?|pas\s+dite|mbasdit[eë]s?|mbr[eë]mjes?|n[eë]\s+mbr[eë]mje)(?![a-zëç])/gi,'$1 pm')
    .replace(/(\d{1,2}(?::\d{2})?)\s*(?:e\s+)?(?:paradit[eë]s?|para\s+dite|m[eë]ngjesit|n[eë]\s+m[eë]ngjes)(?![a-zëç])/gi,'$1 am');
}
/** The first time or time range in a piece of text: {from, to|null, rest}. */
function findTime(text,atStart){
  text=albanian(text);
  let m=RANGE.exec(text);
  if(m){
    const b=toMin(m[5],m[6],m[7],m[8],false);
    let a=toMin(m[1],m[2],m[3],m[4]||m[8],false);
    if(!m[4]&&m[8]&&(a==null||b==null||a>=b))a=toMin(m[1],m[2],m[3],null,false);   // 11-1pm
    const bare=m[2]==null&&!m[3]&&!m[4]&&m[6]==null&&!m[7]&&!m[8];
    // "8-9" only counts at the start of a line or as a whole cell, so "read pages 8-9" isn't a time
    if(a!=null&&b!=null&&!(bare&&(!atStart||m.index>0))){
      if(b<=a&&b<720&&!m[8]&&a<720)b+=720;          // 11:00-1:00 means until 13:00
      if(b===0)b=1440;
      if(b>a)return {from:a,to:b,ap:!!(m[4]||m[8]),rest:text.slice(0,m.index)+' '+text.slice(m.index+m[0].length)};
    }
  }
  m=ONE.exec(text);
  while(m){
    const a=toMin(m[1],m[2],m[3],m[4],true);
    if(a!=null&&a<1440)return {from:a,to:null,ap:!!m[4],rest:text.slice(0,m.index)+' '+text.slice(m.index+m[0].length)};
    const re=new RegExp(ONE.source,'gi');re.lastIndex=m.index+m[0].length;m=re.exec(text);
  }
  return null;
}
// Words left around a time that aren't part of the activity: "nga 8 deri 10 Ligjërata", "from 8 to 9", "at 10"
const FILLER=/^(?:(?:nga|prej|from|at|@|ora|or[eë]n|n[eë]|deri|to)\b\s*)+|(?:\s*\b(?:nga|prej|from|at|ora|or[eë]n|n[eë]|deri)\s*)+$/i;
const tidy=s=>{let t=clean(s),o;do{o=t;t=t.replace(/^[\s\-–—:|,;•·*.)]+|[\s\-–—:|,;•·*(]+$/g,'').replace(FILLER,'').trim()}while(t!==o);return t};

// Weekday names in English and Albanian, for weekly timetables (a column per day)
const DAYS=[/^(mon(day)?|(e\s*)?h[eë]n[eë]|h[eë]n)(?![a-zë])/i,/^(tue(s(day)?)?|(e\s*)?mart[eë]|mar)(?![a-zë])/i,/^(wed(nesday)?|(e\s*)?m[eë]rkur[eë]|m[eë]r)(?![a-zë])/i,/^(thu(r(s(day)?)?)?|(e\s*)?enjte|enj)(?![a-zë])/i,/^(fri(day)?|(e\s*)?premte|pre)(?![a-zë])/i,/^(sat(urday)?|(e\s*)?shtun[eë]|sht)(?![a-zë])/i,/^(sun(day)?|(e\s*)?diel|die)(?![a-zë])/i];
const dayOf=s=>{s=clean(s).replace(/[\s:.,;\-–—]+$/,'');if(!s||s.length>14)return -1;return DAYS.findIndex(r=>r.test(s))};
/** A line that starts with a day: "E Hënë: 08:00 Ligjërata" -> {d: 0, rest: "08:00 Ligjërata"}. */
function dayPrefix(s){
  s=clean(s);
  for(let d=0;d<7;d++){const m=DAYS[d].exec(s);if(m){const r=s.slice(m[0].length);if(/^\s*[:\-–—,]/.test(r))return {d,rest:r.replace(/^\s*[:\-–—,]\s*/,'')}}}
  return null;
}

const TYPES=[
  ['sleep',/\b(sleep|bed|nap|gjum|fle|flej|fjet)/i],
  ['study',/\b(study|revise|revision|homework|read|assignment|project|m[eë]so|m[eë]sim|detyr|lexo|lexim|studi|p[eë]rs[eë]rit|projekt|p[eë]rgatit)/i],
  ['work',/\b(work|job|shift|office|meeting|pun[eë]|pun[oi]j|takim|zyr[eë]|nd[eë]rrim|klient)/i],
  ['uni',/\b(uni|lecture|class|seminar|lab|course|exam|tutorial|ligj[eë]rat|ushtrim|provim|fakultet|kolokfium|kollokfium|kolokvium|l[eë]nd|laborator|konsultim|or[eë]\s+m[eë]simi)/i],
  ['health',/\b(gym|workout|run|walk|yoga|doctor|dentist|sport|training|exercise|st[eë]rvitj|vrapim|vrapo|palest[eë]?r|ecje|shetit|mjek|fitnes|joga|terapi)/i],
];
const guessType=t=>(TYPES.find(([,r])=>r.test(t))||['personal'])[0];

/** How long an entry without an end time lasts: until the next one (up to 3 hours), else 1 hour. */
function fillEnds(list){
  list.sort((a,b)=>a.date.localeCompare(b.date)||a.from-b.from);
  list.forEach((e,i)=>{
    if(e.to!=null)return;
    const n=list[i+1];
    e.to=n&&n.date===e.date&&n.from>e.from&&n.from-e.from<=180?n.from:Math.min(1440,e.from+60);
  });
  return list;
}

/** Hour by hour keeps one entry per hour row, so two things inside the same hour (08:00–08:20 coffee,
    08:20–08:40 bus) are joined into one entry. Overlaps are trimmed so the earlier one wins. */
function fitToRows(list){
  const out=[];
  for(const e of list){
    const p=out[out.length-1];
    if(p&&p.date===e.date){
      if(e.from<p.to)e.from=p.to;
      if(e.to<=e.from)continue;
      // The row where e would start is p's last row and e doesn't reach the next hour: join them
      const pLast=Math.ceil(p.to/60)-1;
      if(Math.floor(e.from/60)===pLast&&p.to%60!==0&&e.to<=(pLast+1)*60){
        if(p.text!==e.text)p.text=p.text+' · '+e.text;p.to=e.to;continue;
      }
    }
    out.push(e);
  }
  out.forEach(e=>{e.text=e.text.slice(0,200)});
  return out;
}

/** Find the entries in the rows. `days` = the 7 dates (Mon..Sun, "YYYY-MM-DD") of the week being shown,
    `date` = the day being shown. Returns [{date, from, to, text, type}] (minutes since midnight). */
function parseRows(rows,date,days){
  const found=[],last={};let cols=null,cur=date;
  for(let i=0;i<rows.length;i++){
    let row=rows[i];
    // A day on its own line ("E Hënë", "Monday:") starts that day's part of a weekly list
    const filled=row.filter(Boolean);
    if(filled.length===1&&dayOf(filled[0])>=0&&!findTime(filled[0],true)){cur=days[dayOf(filled[0])];cols=null;continue}
    const dp=row[0]&&dayPrefix(row[0]);
    if(dp){cur=days[dp.d];row=[dp.rest,...row.slice(1)]}
    // A header row with weekday names: each of those columns is a day of the week
    const hd=row.map(dayOf);
    if(hd.filter(d=>d>=0).length>=2){cols=hd;continue}
    if(cols){
      let t=null;
      for(let c=0;c<row.length&&!t;c++)if(cols[c]<0&&row[c])t=findTime(row[c],true);
      if(t){
        for(let c=0;c<row.length;c++){
          if(cols[c]<0||!row[c])continue;
          const txt=tidy(row[c]);if(txt)found.push({date:days[cols[c]],from:t.from,to:t.to,text:txt});
        }
        continue;
      }
      if(row.some((c,k)=>c&&cols[k]>=0))continue;   // a row of a timetable without a time
    }
    // Otherwise a list: the time and the activity are on the same line (or the activity is on the next one)
    let t=null,rest=[];
    for(let c=0;c<row.length;c++){
      if(!t&&row[c]){const f=findTime(row[c],c===0||!row.slice(0,c).some(Boolean));if(f){t=f;rest.push(f.rest);continue}}
      // Start and end in separate columns: 08:00 | 09:30 | Lecture
      if(t&&t.to==null&&row[c]&&!tidy(rest.join(' '))){const f=findTime(row[c],true);if(f&&f.to==null&&!tidy(f.rest)&&f.from>t.from){t.to=f.from;continue}}
      rest.push(row[c]);
    }
    if(!t)continue;
    let txt=tidy(rest.join(' '));
    if(!txt&&rows[i+1]&&!rows[i+1].some(c=>findTime(c,true))&&!(rows[i+1].filter(Boolean).length===1&&dayOf(rows[i+1].find(Boolean))>=0)){txt=tidy(rows[i+1].join(' '));i++}
    if(!txt)continue;
    // Written in 12-hour time without am/pm ("8 Ligjërata … 2 Mësim … 5 Palestër"): a time earlier than
    // the one before it, in the same day's list, is in the afternoon
    if(!t.ap&&t.from<720&&last[cur]>t.from&&t.from+720>=last[cur]){t.from+=720;if(t.to!=null&&t.to<=720)t.to+=720}
    last[cur]=Math.max(last[cur]||0,t.from);
    found.push({date:cur,from:t.from,to:t.to,text:txt});
  }
  const list=fitToRows(fillEnds(found));
  list.forEach(e=>{e.type=guessType(e.text)});
  return list;
}

window.SplannerImport={extractRows,parseRows,findTime};
})();
