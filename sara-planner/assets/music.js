/* Music page: Spotify's own player for any link, and (when connected) the person's own Spotify.
   Playing on the page uses Spotify's Web Playback SDK, which works with Spotify Premium; everyone else gets
   their playlists in Spotify's player instead. Nothing here asks the server on a timer: the SDK tells the
   page itself when the song changes, and a token is only fetched again when the old one runs out. */
(function(){
const root=document.getElementById('music');if(!root)return;
const $=id=>document.getElementById(id);
const t=s=>window.SPL_T?window.SPL_T(s):s;
const csrf=root.dataset.csrf, connected=root.dataset.connected==='1';
const embed=$('spEmbed'),playerBox=$('musicTop');
let curName=embed.dataset.title||'',embedPlaying=false,embedUri='',mirrored='',playHook=null,popHook=null;   // what Spotify's own card is showing / playing
const toTop=()=>(playerBox||embed).scrollIntoView({behavior:'smooth',block:'start'});   // the player is the first thing on the page: bring it into view when something starts

/* ---------- Spotify's player for a link ---------- */
function parse(link){
  link=(link||'').trim();
  let m=/^spotify:(playlist|album|track|artist|episode|show):([A-Za-z0-9]{10,40})$/.exec(link);
  if(!m)m=/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(playlist|album|track|artist|episode|show)\/([A-Za-z0-9]{10,40})/.exec(link);
  return m?{type:m[1],id:m[2]}:null;
}
const tracksBox=$('spTracks');let listCtx='';   // the playlist being played is listed here (instead of Spotify's card) when its songs can be read
function showList(on){if(tracksBox){tracksBox.hidden=!on;embed.style.display=on?'none':''}}
function saveLink(p){   // the link that opens next time you open Music
  const f=new FormData();f.append('csrf',csrf);f.append('do','link');f.append('link','https://open.spotify.com/'+p.type+'/'+p.id);
  fetch('music.php',{method:'POST',body:f,headers:{'X-Requested-With':'fetch'}}).catch(()=>{});
}
function show(link,save,name){
  const p=parse(link);if(!p)return false;
  curName=name||'';embedPlaying=false;embedUri='';mirrored='';listCtx='';showList(false);
  const ti=$('spTitle'),bx=$('spPlayer');
  if(bx)bx.dataset.src='';
  if(name&&ti){ti.textContent=name;$('spArtist').textContent='';$('spArt').hidden=true}   // the controls say what you picked until Spotify reports the song
  embed.src='https://open.spotify.com/embed/'+p.type+'/'+p.id+'?utm_source=generator';
  embed.classList.toggle('short',p.type==='track'||p.type==='episode');
  if(save)saveLink(p);
  return true;
}
// A link picked anywhere on the page: the account's own player (the controls above) plays it when it can, otherwise Spotify's card shows it
function go(link,name){return (playHook&&playHook(link,name))||show(link,true,name)}
const first=parse(embed.src);if(first)embed.classList.toggle('short',first.type==='track'||first.type==='episode');

const form=$('spLinkForm'), input=$('spLink');
if(form)form.addEventListener('submit',e=>{
  if(!parse(input.value)){e.preventDefault();input.setCustomValidity(t("That doesn't look like a Spotify link. Copy it in Spotify with Share → Copy link."));input.reportValidity();return}
  e.preventDefault();go(input.value,'');toTop();
});
if(input)input.addEventListener('input',()=>input.setCustomValidity(''));
root.addEventListener('click',e=>{const b=e.target.closest('[data-sp-link]');if(!b)return;go(b.dataset.spLink,(b.querySelector('b')||b).textContent.trim());toTop()});

/* ---------- My playlists: links people saved once, shown as buttons ---------- */
const shelf=$('spSaved'),saveForm=$('spSaveForm'),saveIn=$('spSaveLink');
const post=(data)=>{const f=new FormData();f.append('csrf',csrf);for(const k in data)f.append(k,data[k]);return fetch('music.php',{method:'POST',body:f,headers:{'X-Requested-With':'fetch'}})};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(saveForm)saveForm.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!parse(saveIn.value)){saveIn.setCustomValidity(t("That doesn't look like a Spotify link. Copy it in Spotify with Share → Copy link."));saveIn.reportValidity();return}
  const btn=saveForm.querySelector('button');btn.disabled=true;
  try{
    const r=await post({do:'save',link:saveIn.value});
    if(r.status===409){saveIn.setCustomValidity(t('My playlists is full. Remove one to add another.'));saveIn.reportValidity();return}
    if(!r.ok)throw 0;
    const row=await r.json();
    if(!shelf.querySelector('[data-sp-link="'+CSS.escape(row.link)+'"]')){
      shelf.insertAdjacentHTML('beforeend',`<div class="sp-saved"><button class="sp-item" type="button" data-sp-link="${esc(row.link)}" translate="no">`
        +(row.image?`<img alt="" src="${esc(row.image)}" loading="lazy">`:'<i aria-hidden="true">'+ico('music')+'</i>')
        +`<span><b>${esc(row.title)}</b></span></button><form method="post" action="music.php"><input type="hidden" name="do" value="unsave"><input type="hidden" name="id" value="${+row.id}"><button class="sp-x" aria-label="Remove">×</button></form></div>`);
    }
    saveIn.value='';go(row.link,row.title);toTop();
  }catch(x){saveIn.setCustomValidity(t("Couldn't add it. Try again in a minute."));saveIn.reportValidity()}
  finally{btn.disabled=false}
});
if(saveIn)saveIn.addEventListener('input',()=>saveIn.setCustomValidity(''));
if(shelf)shelf.addEventListener('submit',e=>{
  e.preventDefault();const box=e.target.closest('.sp-saved');
  post({do:'unsave',id:e.target.querySelector('[name=id]').value}).then(r=>{if(r.ok)box.remove()});
});

// A small window keeps the music going while you move around the planner (every page change reloads the page)
const pop=$('spPop');
if(pop)pop.addEventListener('click',async()=>{
  if(popHook&&await popHook())return;   // the floating player, where the browser allows it
  const w=window.open('music.php?mini=1','splanner-music','width=420,height='+(connected?660:520));
  if(w){embed.src='about:blank';pop.textContent=t('Playing in the small window ↗');}
});

if(!connected)return;

/* ---------- the person's own Spotify ---------- */
let token=null,tokenUntil=0,device=null,premium=null,player=null;
async function getToken(force){
  if(!force&&token&&Date.now()<tokenUntil)return token;
  const r=await fetch('music.php?token=1',{credentials:'same-origin'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.token)throw new Error(j.error||t("Couldn't reach Spotify"));
  token=j.token;tokenUntil=Date.now()+(j.expires_in-30)*1000;return token;
}
async function api(path,opt={},retry=true){
  const r=await fetch('https://api.spotify.com/v1'+path,{...opt,headers:{...(opt.headers||{}),Authorization:'Bearer '+await getToken()}});
  if(r.status===401&&retry){token=null;return api(path,opt,false)}
  return r;
}
function card(item,kind){
  const img=(kind==='track'?item.album?.images:item.images)||[];
  const pic=img.length?img[img.length>1?img.length-2:0].url:'';
  const sub=kind==='track'?(item.artists||[]).map(a=>a.name).join(', '):(item.owner?.display_name||'');
  return `<button class="sp-item" type="button" data-uri="${esc(item.uri)}" data-url="${esc(item.external_urls?.spotify||'')}" translate="no">`
    +(pic?`<img alt="" src="${esc(pic)}" loading="lazy">`:'<i aria-hidden="true">'+ico('music')+'</i>')
    +`<span><b>${esc(item.name)}</b><small>${esc(sub)}</small></span></button>`;
}
async function startPlayback(body){   // ask Spotify to play on this page's player; say so when it can't
  const send=()=>api('/me/player/play?device_id='+encodeURIComponent(device),{method:'PUT',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});
  let r=await send();
  if(r.status===404){   // Spotify doesn't know the player yet: make it the active one, then try again
    try{await api('/me/player',{method:'PUT',body:JSON.stringify({device_ids:[device],play:false}),headers:{'Content-Type':'application/json'}})}catch(e){}
    await new Promise(ok=>setTimeout(ok,700));
    r=await send();
  }
  const ok=r.ok||r.status===204;
  if(!ok){
    if(r.status===403)noPremium();
    else setBar(curName||t('Nothing playing yet'),t("Couldn't start playing. Try again in a moment."),null);
    if(typeof log==='function')log('play: '+r.status);
  }
  return ok;
}
function stopCard(){   // only one thing plays at a time
  if(embedPlaying&&embed.contentWindow)embed.contentWindow.postMessage({command:'toggle'},'https://open.spotify.com');
  embedPlaying=false;box.dataset.src='';
}
async function play(uri,url,name){
  if(player&&player.activateElement)player.activateElement();   // lets the browser start sound after this click
  const link=url||('https://open.spotify.com/'+uri.split(':').slice(1).join('/'));
  const p=parse(link);
  if(device&&premium!==false){
    stopCard();
    if(p)saveLink(p);
    if(name){curName=name;setBar(name,'',null)}   // until the player reports the song
    const body=/^spotify:(track|episode):/.test(uri)?{uris:[uri]}:{context_uri:uri};
    try{if(await startPlayback(body)){toTop();return}}catch(e){}
  }
  show(link,true,name);toTop();   // couldn't play it here: Spotify's own card shows it
}
function popHome(){const h=$('spPopHome'),b=$('spPop');if(h&&b&&!h.contains(b))h.appendChild(b)}   // the pop-out button lives under the volume slider; without that player it goes back to My playlists
function noPremium(){premium=false;listCtx='';showList(false);popHome();const n=$('spPremium');if(n)n.hidden=false;const p=$('spPlayer');if(p)p.hidden=true}
playHook=(link,name)=>{
  if(!device||premium===false)return false;
  const p=parse(link);if(!p)return false;
  play('spotify:'+p.type+':'+p.id,'https://open.spotify.com/'+p.type+'/'+p.id,name);
  return true;
};
root.addEventListener('click',e=>{const b=e.target.closest('.sp-item[data-uri]');if(b)play(b.dataset.uri,b.dataset.url,(b.querySelector('b')||b).textContent.trim())});

const lists=$('spPlaylists');
async function loadPlaylists(){
  if(!lists)return;
  try{
    const r=await api('/me/playlists?limit=50');
    if(!r.ok)throw 0;
    const items=((await r.json()).items||[]).filter(Boolean);
    lists.innerHTML=items.length?items.map(p=>card(p,'playlist')).join(''):`<p class="muted">${esc(t('No playlists in your Spotify yet.'))}</p>`;
  }catch(e){lists.innerHTML=`<p class="muted">${esc(t("Couldn't load your playlists. Try again in a minute."))}</p>`}
}
loadPlaylists();

const sForm=$('spSearch'),sOut=$('spResults');
if(sForm)sForm.addEventListener('submit',async e=>{
  e.preventDefault();const q=$('spQuery').value.trim();if(!q){sOut.innerHTML='';return}
  sOut.innerHTML=`<p class="muted">${esc(t('Searching…'))}</p>`;
  try{
    const r=await api('/search?type=track,playlist&limit=10&q='+encodeURIComponent(q));
    if(!r.ok)throw 0;
    const j=await r.json();
    const html=(j.tracks?.items||[]).filter(Boolean).map(x=>card(x,'track')).join('')+(j.playlists?.items||[]).filter(Boolean).map(x=>card(x,'playlist')).join('');
    sOut.innerHTML=html||`<p class="muted">${esc(t('Nothing found.'))}</p>`;
  }catch(e){sOut.innerHTML=`<p class="muted">${esc(t("Couldn't search Spotify. Try again in a minute."))}</p>`}
});

/* ---------- playing right here (Spotify Premium) ---------- */
const box=$('spPlayer'),tog=$('spToggle');
let sdkPlaying=false,sdkStarted=false;   // sdkStarted: the controls' player has played something since the page opened
const fmt=ms=>{const s=Math.round((ms||0)/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
function markSong(uri,paused){   // mark the playing song in the list and keep it in view
  if(!tracksBox)return;
  const list=tracksBox.querySelector('.sp-tk-list');if(!list)return;
  let on=null;
  list.querySelectorAll('.sp-tk').forEach(r=>{const is=r.dataset.tk===uri;r.classList.toggle('on',is);r.classList.toggle('paused',is&&!!paused);if(is)on=r});
  if(on)list.scrollTop=Math.max(0,on.offsetTop-list.offsetTop-list.clientHeight/2+on.offsetHeight/2);
}
async function ctxMeta(c){   // name, cover picture and owner of the playlist or album
  try{
    const r=await api(c.type==='playlist'?'/playlists/'+c.id+'?fields=name,images,owner(display_name)':'/albums/'+c.id);
    if(!r.ok)return {};
    const j=await r.json();
    return {name:j.name||'',image:((j.images||[])[0]||{}).url||'',sub:c.type==='playlist'?(j.owner&&j.owner.display_name)||'':(j.artists||[]).map(a=>a.name).join(', ')};
  }catch(e){return {}}
}
async function viewContext(ctx,uri){   // the playlist or album that is playing: its whole list, with the playing song marked
  if(ctx===listCtx){markSong(uri,!sdkPlaying);return}
  listCtx=ctx;
  const m=/^spotify:(playlist|album):([A-Za-z0-9]+)$/.exec(ctx);
  const c={type:m[1],id:m[2]};
  const [songs,meta]=await Promise.all([ctxSongs(c),ctxMeta(c)]);
  if(listCtx!==ctx)return;   // something else was picked meanwhile
  if(!songs.length){   // Spotify won't let us read this one (its own playlists, for example): its card shows the playlist instead
    showList(false);mirrored='';
    if(!embed.src.includes('/embed/'+m[1]+'/'+m[2])){embed.src='https://open.spotify.com/embed/'+m[1]+'/'+m[2]+'?utm_source=generator';embed.classList.remove('short')}
    return;
  }
  if(meta.name)curName=meta.name;
  const total=Math.round(songs.reduce((n,x)=>n+(x.duration_ms||0),0)/60000);
  const cover=meta.image||((songs[0].album&&songs[0].album.images||[])[0]||{}).url||'';
  tracksBox.innerHTML='<div class="sp-tk-top">'+(cover?'<img class="cov" alt="" src="'+esc(cover)+'">':'')
    +'<div class="inf"><small>'+esc(t(m[1]==='album'?'Album':'Playlist'))+'</small><h3 translate="no">'+esc(curName)+'</h3>'
    +'<span><span translate="no">'+esc(meta.sub||'')+(meta.sub?' · ':'')+'</span>'+songs.length+' '+esc(t('songs'))+' · '+(total>=60?Math.floor(total/60)+' '+esc(t('hr'))+' ':'')+(total%60)+' '+esc(t('min'))+'</span></div></div>'
    +'<div class="sp-tk-list">'+songs.map((x,i)=>'<button type="button" class="sp-tk" data-tk="'+esc(x.uri)+'" translate="no"><span class="n"><i class="num">'+(i+1)+'</i><i class="ic-play">'+ico('play')+'</i><i class="ic-pause">'+ico('pause')+'</i></span><span class="m"><b>'+esc(x.name)+'</b><small>'+esc((x.artists||[]).map(a=>a.name).join(', '))+'</small></span><span class="d">'+fmt(x.duration_ms)+'</span></button>').join('')+'</div>';
  showList(true);markSong(uri,!sdkPlaying);
  if(!sdkStarted)setBar(curName||t('Nothing playing yet'),t('Press play to start'),null);   // nothing has played yet: the controls name the list that the play button will start
}
async function playList(offsetUri){   // play the listed playlist, from a song or from the start
  if(!listCtx||!device)return;
  if(player&&player.activateElement)player.activateElement();
  const body={context_uri:listCtx};if(offsetUri)body.offset={uri:offsetUri};
  try{await startPlayback(body)}catch(x){}
}
if(tracksBox)tracksBox.addEventListener('click',e=>{
  const b=e.target.closest('[data-tk]');if(!b)return;
  if(b.classList.contains('on')&&sdkStarted&&player){if(player.activateElement)player.activateElement();player.togglePlay();return}   // the song that is on: pause or resume it
  playList(b.dataset.tk);
});   // a song in the list: play the list from there
function mirror(tr){   // Spotify's card shows the song the controls are playing, so the two always agree
  const m=/^spotify:track:([A-Za-z0-9]+)$/.exec(tr.uri||'');
  if(!m||m[1]===mirrored)return;
  mirrored=m[1];curName=tr.name;embedUri=tr.uri;
  embed.src='https://open.spotify.com/embed/track/'+m[1]+'?utm_source=generator';
  embed.classList.add('short');
}
function nowPlaying(st){
  if(!st||!st.track_window||!st.track_window.current_track)return;
  sdkPlaying=!st.paused;sdkStarted=true;
  if(embedPlaying)return;
  box.dataset.src='';const tr=st.track_window.current_track,art=$('spArt'),img=(tr.album.images||[])[0];
  $('spTitle').textContent=tr.name;$('spArtist').textContent=(tr.artists||[]).map(a=>a.name).join(', ');
  if(img){art.src=img.url;art.hidden=false}
  tog.innerHTML=ico(st.paused?'play':'pause');
  const ctx=st.context&&st.context.uri||'';
  if(/^spotify:(playlist|album):[A-Za-z0-9]+$/.test(ctx))viewContext(ctx,tr.uri);
  else{listCtx='';showList(false);mirror(tr)}
}
window.onSpotifyWebPlaybackSDKReady=()=>{
  player=new Spotify.Player({name:document.body.classList.contains('music-win')?'Splanner (small window)':'Splanner',getOAuthToken:cb=>getToken().then(cb,()=>{}),volume:.6});
  player.addListener('ready',({device_id})=>{
    device=device_id;if(premium!==false&&box)box.hidden=false;
    const c=parse(embed.src);   // the playlist the page opened with: list its songs right away, so playing always goes through the controls
    if(c&&(c.type==='playlist'||c.type==='album')&&!listCtx&&!embedPlaying&&premium!==false)viewContext('spotify:'+c.type+':'+c.id,'');
    else if(!listCtx)showList(false);   // nothing to list (a single song, an artist…): Spotify's card instead
  });
  player.addListener('not_ready',()=>{device=null});
  player.addListener('account_error',noPremium);              // not a Premium account
  player.addListener('initialization_error',()=>{premium=false;showList(false);popHome()}); // this browser can't play protected music; the embed still works
  player.addListener('authentication_error',()=>{token=null});
  player.addListener('player_state_changed',nowPlaying);
  player.connect();
};
/* ---------- playing in Spotify's own card ---------- */
// Spotify's card tells this page when it starts, pauses or moves to another song, so the controls never say "Nothing playing yet" while it plays.
const setBar=(title,artist,img)=>{
  $('spTitle').textContent=title;$('spArtist').textContent=artist||'';
  const art=$('spArt');if(img){art.src=img;art.hidden=false}else art.hidden=true;
};
function showItem(j){
  if(!j||!j.name)return;
  const img=((j.album?j.album.images:j.images)||[])[0];
  setBar(j.name,j.artists?j.artists.map(a=>a.name).join(', '):(j.show&&j.show.name)||'',img&&img.url);
}
async function embedSong(uri){   // the song the card is on, when the card says which one it is
  const m=/^spotify:(track|episode):([A-Za-z0-9]+)$/.exec(uri||'');
  if(!m||uri===embedUri)return;
  embedUri=uri;
  try{
    const r=await api('/'+m[1]+'s/'+m[2]);if(!r.ok)throw 0;
    const j=await r.json();if(embedUri===uri&&embedPlaying)showItem(j);
  }catch(e){}
}
/* The card doesn't say which song it is on, so find out another way: ask the account what it is playing, and failing that
   match the song's length (the card does report that) against the songs of the playlist or album it has loaded. */
const dbg=/[?&]debug\b/.test(location.search),dbgBox=dbg?document.createElement('pre'):null;
if(dbg){dbgBox.style.cssText='font-size:11px;white-space:pre-wrap;word-break:break-all;margin:8px 0 0;max-height:160px;overflow:auto;color:var(--muted)';box.after(dbgBox)}
const log=m=>{if(dbg){dbgBox.textContent=(dbgBox.textContent+'\n'+m).split('\n').slice(-10).join('\n')}};
const ctxCache={};
async function ctxSongs(c){   // the songs of a playlist or album, when Spotify lets this account read them
  if(!c||(c.type!=='playlist'&&c.type!=='album'))return [];
  const key=c.type+c.id;if(key in ctxCache)return ctxCache[key];
  let out=[],failed=false;
  try{
    if(c.type==='album'){
      const r=await api('/albums/'+c.id);if(r.ok){const j=await r.json();out=(j.tracks.items||[]).map(x=>({...x,album:{images:j.images}}))}
    }else{
      let base='/playlists/'+c.id+'/tracks';
      for(let off=0;off<1000;off+=100){
        let r=await api(base+'?limit=100&offset='+off);
        if(!r.ok&&off===0&&base.endsWith('/tracks')){base='/playlists/'+c.id+'/items';r=await api(base+'?limit=100&offset='+off)}   // Spotify has been renaming this call
        if(!r.ok){log('playlist songs: '+r.status);break}
        const j=await r.json();out=out.concat((j.items||[]).map(i=>i&&(i.track||i.item)).filter(Boolean));
        if(!j.next)break;
      }
    }
  }catch(e){failed=true}
  out=out.filter(x=>x.uri&&x.uri.startsWith('spotify:track:'));
  if(!failed)ctxCache[key]=out;
  return out;
}
const pickByLen=(songs,len)=>{   // the song whose length is closest to the card's, unless two are about as close
  if(len>0&&len<5000)len*=1000;   // in case the card counts in seconds
  const c=songs.map(x=>({x,d:Math.abs((x.duration_ms||0)-len)})).filter(o=>o.d<=1500).sort((a,b)=>a.d-b.d);
  return c.length&&(c.length===1||c[1].d-c[0].d>250)?c[0].x:null;
};
async function handOver(len,pos){   // the card started by hand on a playlist we can read: carry on in the controls, on the same song
  if(!device||premium===false||len<=31000)return false;
  const c=parse(embed.src);if(!c)return false;
  const song=pickByLen(await ctxSongs(c),len);
  if(!song||!embedPlaying)return false;
  stopCard();
  try{
    const r=await api('/me/player/play?device_id='+encodeURIComponent(device),{method:'PUT',body:JSON.stringify({context_uri:'spotify:'+c.type+':'+c.id,offset:{uri:song.uri},position_ms:pos}),headers:{'Content-Type':'application/json'}});
    return r.ok||r.status===204;
  }catch(e){return false}
}
async function ctxTitle(){   // the name of the playlist or album the card has, for the controls
  const c=parse(embed.src);if(!c)return;
  const path=c.type==='playlist'?'/playlists/'+c.id+'?fields=name':c.type==='album'?'/albums/'+c.id:'';if(!path)return;
  try{
    const r=await api(path);if(!r.ok)return;
    const j=await r.json();
    if(embedPlaying&&!curName&&j.name){curName=j.name;if(!embedUri)setBar(j.name,'Spotify',null)}
  }catch(e){}
}
async function embedNow(len,tries){
  let done=false;
  try{
    const r=await api('/me/player/currently-playing?additional_types=episode');
    log('currently-playing: '+r.status);
    const j=r.status===200?await r.json():null;
    if(!embedPlaying)return;
    if(j&&j.item&&j.is_playing){embedUri=j.item.uri||'now';showItem(j.item);done=true}
  }catch(e){log('currently-playing failed')}
  if(!done&&len){
    const song=pickByLen(await ctxSongs(parse(embed.src)),len);
    log('song of that length: '+(song?song.name:'none'));
    if(embedPlaying&&song){embedUri=song.uri||'len';showItem(song);done=true}
  }
  if(!done&&tries>0&&embedPlaying)setTimeout(()=>embedNow(len,tries-1),2000);   // Spotify can take a moment to notice a new song
}
const findUri=o=>{   // whatever the card calls it, a song's spotify:track:… address is somewhere in its message
  if(typeof o==='string')return /^spotify:(track|episode):[A-Za-z0-9]+$/.test(o)?o:'';
  if(o&&typeof o==='object')for(const k in o){const u=findUri(o[k]);if(u)return u}
  return '';
};
let embedLen=0;
window.addEventListener('message',e=>{
  if(!box||e.origin!=='https://open.spotify.com'||e.source!==embed.contentWindow)return;
  const d=e.data;if(!d||typeof d!=='object'||(d.type!=='playback_update'&&d.type!=='playback_started'))return;
  const p=d.payload||d.data||{};
  if(dbg&&d.type==='playback_started'||dbg&&!embedPlaying)log(JSON.stringify(d));
  const was=embedPlaying;
  embedPlaying=d.type==='playback_started'||!p.isPaused;
  if(embedPlaying){
    box.dataset.src='embed';
    if(!was&&sdkPlaying&&player)player.pause();   // the card was started by hand: the controls' own player steps aside
    const u=findUri(d),len=+p.duration||0,known=mirrored&&embedUri==='spotify:track:'+mirrored;   // known: the card is on the song the controls named
    if(!embedUri&&!was){setBar(curName||t('Playing in Spotify'),'Spotify',null);if(!curName)ctxTitle()}
    if(known){embedLen=len||embedLen}
    else if(u){embedSong(u);embedLen=len||embedLen}
    else if(!was||(len&&len!==embedLen)){   // started, or the song's length changed = a new song
      embedLen=len||embedLen;
      handOver(len,+p.position||0).then(ok=>{if(ok){tog.innerHTML=ico('pause')}else if(embedPlaying)embedNow(len,3)});
    }
  }
  if(box.dataset.src==='embed')tog.innerHTML=ico(embedPlaying?'pause':'play');
});
function control(which){   // previous / play-pause / next, from the controls above or from the floating player
  if(box.dataset.src==='embed'){   // the card is the one playing: the button pauses or resumes it
    if(which==='toggle'&&embed.contentWindow)embed.contentWindow.postMessage({command:'toggle'},'https://open.spotify.com');
    return;
  }
  if(!sdkStarted&&listCtx&&device){playList('');return}   // nothing has played yet: the buttons start the listed playlist
  if(!player)return;
  if(player.activateElement)player.activateElement();
  ({prev:()=>player.previousTrack(),next:()=>player.nextTrack(),toggle:()=>player.togglePlay()})[which]();
}
if(box){
  box.addEventListener('click',e=>{const b=e.target.closest('[data-sp]');if(b)control(b.dataset.sp)});
  $('spVol').addEventListener('input',e=>{if(player)player.setVolume(e.target.value/100)});
}
/* ---------- the floating player (Chrome and Edge): stays on top of other windows while this tab stays open ---------- */
let pip=null;
const PIP_CSS=`*{box-sizing:border-box}
html{font-size:clamp(8px,2.7vmin,14px)}
html,body{margin:0;height:100%}
body{--bg1:#fdeff5;--bg2:#f8dce8;--ink:#3a2230;--p1:#f8cbdd;--p2:#eaa8c2;--r1:#e592b4;--r2:#f6c0d4;--ac:#d6336c;--btnink:#fdeff5;--ring:#f7d6e3;--scr:#f3b9d0;--arm:#1d1d1f;--gv:rgba(255,255,255,.13);
--mut:color-mix(in srgb,var(--ink) 62%,transparent);--ln:color-mix(in srgb,var(--ink) 22%,transparent);
font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:var(--ink);background:linear-gradient(180deg,var(--bg1),var(--bg2));display:grid;place-items:center;overflow:hidden}
.mp{display:grid;gap:1.1rem;justify-items:center;width:100%;padding:1.2rem 1.5rem}
.tbl{width:min(100%,calc(100vh - 14rem));min-width:4rem;aspect-ratio:1}
.plinth{position:relative;width:100%;height:100%;border-radius:5%;background:linear-gradient(145deg,var(--p1),var(--p2));box-shadow:0 .9rem 1.8rem rgba(0,0,0,.22),inset 0 0 0 2px rgba(255,255,255,.28)}
.plinth::before,.plinth::after{content:"";position:absolute;top:4.5%;width:3%;height:3%;border-radius:50%;background:var(--scr);box-shadow:inset 0 1px 2px rgba(0,0,0,.35),0 1px 0 rgba(255,255,255,.35)}
.plinth::before{left:5%}.plinth::after{left:62%}
.rec{position:absolute;left:9.33%;top:14.67%;width:74.67%;height:74.67%;border-radius:50%;background:repeating-radial-gradient(circle,var(--gv) 0 1px,transparent 1px 5px),conic-gradient(var(--r1),var(--r2) 25%,var(--r1) 50%,var(--r2) 75%,var(--r1));box-shadow:0 0 0 3px rgba(255,255,255,.22),0 .5rem 1rem rgba(0,0,0,.3);animation:spin 3.6s linear infinite;animation-play-state:paused}
.playing .rec{animation-play-state:running}
@keyframes spin{to{transform:rotate(360deg)}}
.rec img{position:absolute;left:31%;top:31%;width:38%;height:38%;border-radius:50%;object-fit:cover;background:#cfd9de;box-shadow:0 0 0 3px var(--ring),0 0 0 4px rgba(0,0,0,.2)}
.rec i{position:absolute;left:48.6%;top:48.6%;width:2.8%;height:2.8%;border-radius:50%;background:#e4e8ec;box-shadow:0 0 2px rgba(0,0,0,.5)}
.armsvg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
#arm{transform-origin:252px 50px;transition:transform .9s ease}
body[data-look="1"] .plinth{border-radius:15%}
body[data-look="1"] .rec{background:repeating-radial-gradient(circle,rgba(255,255,255,.2) 0 2px,transparent 2px 10px),conic-gradient(var(--r1),var(--r2) 25%,var(--r1) 50%,var(--r2) 75%,var(--r1))}
body[data-look="2"] .rec{background:repeating-radial-gradient(circle,rgba(255,255,255,.08) 0 1px,transparent 1px 4px),conic-gradient(from 20deg,#0e0e10,#2b2b31 25%,#0e0e10 50%,#2b2b31 75%,#0e0e10)}
body[data-look="2"] .rec img{box-shadow:0 0 0 4px var(--r2),0 0 0 5px rgba(0,0,0,.4)}
body[data-look="2"] .plinth{border-radius:3%;box-shadow:0 .9rem 1.8rem rgba(0,0,0,.28),inset 0 0 0 5px rgba(0,0,0,.14)}
body[data-look="3"] .rec{background:repeating-radial-gradient(circle,rgba(0,0,0,.14) 0 1px,transparent 1px 5px),linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.12)),var(--cover) center/cover}
body[data-look="3"] .plinth{border-radius:9%;box-shadow:0 .9rem 1.8rem rgba(0,0,0,.25),inset 0 0 0 2px rgba(255,255,255,.5),inset 0 0 0 7px rgba(255,255,255,.12)}
.main{display:grid;gap:.6rem;min-width:0;width:100%}
.t b{display:block;font-size:1.35rem;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.t span{display:block;font-size:1rem;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:1.2rem}
.bar{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:.6rem;align-items:center;font-size:.85rem;color:var(--mut);font-variant-numeric:tabular-nums}
.trk{position:relative;height:1.1rem;cursor:pointer}
.trk::before{content:"";position:absolute;left:0;right:0;top:calc(50% - 1px);height:2px;border-radius:2px;background:var(--ln)}
.fill{position:absolute;left:0;top:calc(50% - 1px);height:2px;border-radius:2px;background:var(--ink);width:0}
.dot{position:absolute;top:calc(50% - .35rem);left:0;width:.7rem;height:.7rem;margin-left:-.35rem;border-radius:50%;background:var(--ink)}
.ctl{display:flex;align-items:center;justify-content:space-between}
button{border:0;background:none;color:var(--ink);width:2.4rem;height:2.4rem;display:grid;place-items:center;border-radius:50%;cursor:pointer;padding:0}
button svg{width:1.6rem;height:1.6rem;fill:currentColor}
button.on{color:var(--ac)}
button.big{width:3.6rem;height:3.6rem;background:var(--ink);color:var(--btnink)}
button.big:hover{transform:scale(1.06)}
button.big svg{width:2rem;height:2rem}
@media (min-aspect-ratio:7/5){
  .mp{grid-template-columns:auto minmax(0,1fr);gap:1.6rem;justify-items:stretch;align-items:center;padding:1rem 1.4rem}
  .tbl{width:min(46vw,calc(100vh - 2.2rem))}
  .main{gap:.8rem}
}
@media (max-width:250px) and (max-aspect-ratio:7/5){
  #bs,#br{display:none}
  .ctl{justify-content:center;gap:1.4rem}
  .tbl{width:min(100%,calc(100vh - 12rem))}
}
@media (max-height:190px) and (max-aspect-ratio:7/5){
  .bar{display:none}
  .t span{min-height:0}
  .tbl{width:min(100%,calc(100vh - 10.5rem))}
}
@media (max-height:130px) and (max-aspect-ratio:7/5),(max-width:150px) and (max-aspect-ratio:7/5){
  #bs,#br,#bp,#bn,.t span,.bar{display:none}
  .t b{font-size:1.1rem}
  .mp{gap:.6rem;padding:.6rem 1rem}
  .tbl{width:min(100%,calc(100vh - 7.5rem))}
}
@media (min-aspect-ratio:7/5) and (max-width:300px){#bs,#br{display:none}.ctl{justify-content:space-evenly}}
@media (min-aspect-ratio:7/5) and (max-height:130px){
  .mp{gap:1rem;padding:.7rem 1rem}
  .tbl{width:calc(100vh - 1.4rem)}
  .main{gap:.45rem}
  .t b{font-size:1.2rem}
}
@media (min-aspect-ratio:7/5) and (max-height:100px){.bar{display:none}}
@media (min-aspect-ratio:7/5) and (max-height:75px){.t span{display:none}}
}`;
const ARM_REST=-23;   // degrees: lifted off the record
const PIP_ARM='<svg class="armsvg" viewBox="0 0 300 300"><g id="arm" style="transform:rotate(-23deg)"><g transform="translate(252 50) rotate(18)">'
  +'<rect x="-10" y="-40" width="20" height="28" rx="5" style="fill:var(--arm)"/>'
  +'<line x1="0" y1="0" x2="0" y2="176" style="stroke:var(--arm)" stroke-width="5" stroke-linecap="round"/><line x1="-1" y1="6" x2="-1" y2="170" stroke="#fff" stroke-opacity=".55" stroke-width="1"/>'
  +'<circle r="19" style="fill:var(--p2)"/><circle r="15" style="fill:var(--arm)"/><circle r="5" fill="#8a8a92" fill-opacity=".6"/>'
  +'<rect x="-9" y="168" width="18" height="26" rx="3" style="fill:var(--arm)"/><rect x="-5" y="192" width="10" height="7" rx="1" fill="#e4e8ec"/></g></g></svg>';
/* Each song gets its own colours (taken from its cover) and one of four turntable looks (chosen from the cover, so a song always looks the same). */
const palCache={};
function coverPalette(url){   // the cover's main hue and colourfulness, and whether it is a dark picture
  if(palCache[url])return Promise.resolve(palCache[url]);
  return new Promise(ok=>{
    const im=new Image();im.crossOrigin='anonymous';
    im.onload=()=>{try{
      const c=document.createElement('canvas');c.width=c.height=24;const x=c.getContext('2d');x.drawImage(im,0,0,24,24);
      const d=x.getImageData(0,0,24,24).data,w=new Array(12).fill(0),hs=new Array(12).fill(0),ss=new Array(12).fill(0);let L=0,n=0,chroma=0;
      for(let i=0;i<d.length;i+=4){
        const r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,dl=mx-mn;
        const sat=dl?dl/(1-Math.abs(2*l-1)):0;let h=0;
        if(dl){h=mx===r?((g-b)/dl)%6:mx===g?(b-r)/dl+2:(r-g)/dl+4;h=(h*60+360)%360}
        const wt=sat*(1-Math.abs(2*l-1))+.01,k=Math.min(11,Math.floor(h/30));
        w[k]+=wt;hs[k]+=h*wt;ss[k]+=sat*wt;L+=l;n++;chroma+=dl;
      }
      let k=0;for(let i=1;i<12;i++)if(w[i]>w[k])k=i;
      const grey=chroma/n<.06;
      ok(palCache[url]={h:grey?0:hs[k]/w[k],s:grey?.06:Math.min(.9,Math.max(.3,ss[k]/w[k])),dark:L/n<.38});
    }catch(e){ok(null)}};   // the picture can't be read: keep the pink
    im.onerror=()=>ok(null);
    im.src=url;
  });
}
function palVars(p){
  const H=Math.round(p.h),S=p.s*100,hs=(s,l)=>'hsl('+H+','+Math.round(Math.max(0,Math.min(100,s)))+'%,'+l+'%)';
  return p.dark?{'--bg1':hs(S*.45,17),'--bg2':hs(S*.5,9),'--ink':hs(30,94),'--p1':hs(S*.5,27),'--p2':hs(S*.5,19),'--r1':hs(S*.5,13),'--r2':hs(S*.55,25),'--ac':hs(85,66),'--btnink':hs(S*.5,9),'--ring':hs(S*.4,80),'--scr':hs(S*.4,38),'--arm':hs(15,84),'--gv':'rgba(255,255,255,.07)'}
   :{'--bg1':hs(S*.5,96),'--bg2':hs(S*.55,89),'--ink':hs(Math.min(S,40),20),'--p1':hs(S*.8,86),'--p2':hs(S*.75,75),'--r1':hs(S*.85,69),'--r2':hs(S*.8,82),'--ac':hs(75,42),'--btnink':hs(S*.5,96),'--ring':hs(S*.6,92),'--scr':hs(S*.7,82),'--arm':hs(Math.min(S,25),11),'--gv':'rgba(255,255,255,.13)'};
}
const lookOf=url=>{let h=0;for(let i=0;i<url.length;i++)h=(h*31+url.charCodeAt(i))>>>0;return h%4};
const PIP_ICONS={
  shuffle:'<path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>',
  prev:'<path d="M6 6h2v12H6zM9.5 12 18 6v12z"/>',
  next:'<path d="M16 6h2v12h-2zM6 18V6l8.5 6z"/>',
  play:'<path d="M8 5v14l11-7z"/>',
  pause:'<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
  repeat:'<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>',
};
const pipSvg=n=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+PIP_ICONS[n]+'</svg>';
const popBtn=$('spPop');
function pipClosed(){
  pip=null;document.body.classList.remove('sp-popped');
  const n=$('spPopNote');if(n)n.remove();
  if(popBtn)popBtn.textContent=t('Pop out player ↗');
}
async function openPip(){
  if(pip){pip.close();return true}
  if(!('documentPictureInPicture' in window)||!player||!device||premium===false)return false;   // other browsers: the small window instead
  let w;
  try{w=await documentPictureInPicture.requestWindow({width:340,height:500})}catch(e){return false}
  pip=w;
  const d=w.document;
  d.title='Splanner';
  d.head.insertAdjacentHTML('beforeend','<style>'+PIP_CSS+'</style>');
  d.body.innerHTML='<div class="mp" id="mp"><div class="tbl"><div class="plinth"><div class="rec"><img id="cv" alt="" hidden><i></i></div>'+PIP_ARM+'</div></div><div class="main">'
    +'<div class="t"><b id="tt" translate="no"></b><span id="ta" translate="no"></span></div>'
    +'<div class="bar"><span id="tp">0:00</span><div class="trk" id="trk"><i class="fill" id="fl"></i><i class="dot" id="dt"></i></div><span id="tr">-0:00</span></div>'
    +'<div class="ctl"><button id="bs" aria-label="Shuffle">'+pipSvg('shuffle')+'</button><button id="bp" aria-label="Previous song">'+pipSvg('prev')+'</button>'
    +'<button class="big" id="bt" aria-label="Play or pause">'+pipSvg('play')+'</button><button id="bn" aria-label="Next song">'+pipSvg('next')+'</button><button id="br" aria-label="Repeat">'+pipSvg('repeat')+'</button></div></div></div>';
  const g=id=>d.getElementById(id);
  let st=null,cover='';
  g('bp').onclick=()=>control('prev');g('bn').onclick=()=>control('next');g('bt').onclick=()=>control('toggle');
  g('bs').onclick=()=>{if(st)api('/me/player/shuffle?state='+(!st.shuffle)+'&device_id='+encodeURIComponent(device),{method:'PUT'}).catch(()=>{})};
  g('br').onclick=()=>{if(st)api('/me/player/repeat?state='+['context','track','off'][st.repeat_mode===0?0:st.repeat_mode===1?1:2]+'&device_id='+encodeURIComponent(device),{method:'PUT'}).catch(()=>{})};
  g('trk').onclick=e=>{if(!st||!st.duration)return;const r=g('trk').getBoundingClientRect();player.seek(Math.round(st.duration*Math.min(1,Math.max(0,(e.clientX-r.left)/r.width))))};
  const tick=async()=>{
    if(!pip)return;
    try{st=await player.getCurrentState()}catch(e){st=null}
    const tr=st&&st.track_window&&st.track_window.current_track;
    if(tr){
      g('tt').textContent=tr.name;g('ta').textContent=(tr.artists||[]).map(a=>a.name).join(', ');
      const im=(tr.album.images||[])[0];g('cv').hidden=!im;
      if(im&&im.url!==cover){   // the song's picture is the label of the record, and sets this song's colours and look
        cover=im.url;g('cv').src=cover;
        d.body.dataset.look=lookOf(cover);d.body.style.setProperty('--cover','url("'+cover+'")');
        coverPalette(cover).then(pal=>{
          if(!pip||cover!==im.url)return;
          const v=pal?palVars(pal):{};
          for(const k of ['--bg1','--bg2','--ink','--p1','--p2','--r1','--r2','--ac','--btnink','--ring','--scr','--arm','--gv'])
            if(v[k])d.body.style.setProperty(k,v[k]);else d.body.style.removeProperty(k);
        });
      }
      const dur=st.duration||1,pos=Math.min(st.position||0,dur),p=pos/dur*100;
      d.body.classList.toggle('playing',!st.paused);
      g('arm').style.transform='rotate('+(st.paused?ARM_REST:p*.2)+'deg)';   // the arm rests off the record, and moves in as the song goes on
      g('fl').style.width=p+'%';g('dt').style.left=p+'%';g('tp').textContent=fmt(pos);g('tr').textContent='-'+fmt(dur-pos);
      g('bt').innerHTML=pipSvg(st.paused?'play':'pause');
            g('bs').classList.toggle('on',!!st.shuffle);g('br').classList.toggle('on',st.repeat_mode>0);
    }else{   // nothing playing yet: say what the buttons will start
      g('tt').textContent=$('spTitle').textContent;g('ta').textContent=$('spArtist').textContent;
      g('bt').innerHTML=pipSvg('play');d.body.classList.remove('playing');g('arm').style.transform='rotate('+ARM_REST+'deg)';
    }
  };
  const timer=setInterval(tick,500);tick();
  w.addEventListener('pagehide',()=>{clearInterval(timer);pipClosed()});
  document.body.classList.add('sp-popped');
  if(popBtn)popBtn.textContent=t('Bring it back ↙');
  const note=document.createElement('p');note.className='music-note ok';note.id='spPopNote';
  note.textContent=t('The player is floating on your screen. Keep this tab open; other pages you open from here open in a new tab, so the music keeps playing.');
  root.prepend(note);
  return true;
}
popHook=openPip;
document.addEventListener('click',e=>{   // while the player floats, this tab has to stay: other pages open in a new tab
  if(!pip||e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey)return;
  const a=e.target.closest&&e.target.closest('a[href]');if(!a||a.target||a.hasAttribute('download'))return;
  let u;try{u=new URL(a.href,location.href)}catch(x){return}
  if(u.origin!==location.origin||u.href.split('#')[0]===location.href.split('#')[0])return;
  a.target='_blank';a.rel='noopener';setTimeout(()=>{a.removeAttribute('target');a.removeAttribute('rel')},0);
},true);
const phone=matchMedia('(pointer:coarse)').matches&&!matchMedia('(any-pointer:fine)').matches;   // phones and tablets: Spotify's in-page player doesn't run in their browsers
if(phone){premium=false;showList(false);popHome()}   // so go straight to Spotify's own card
else{
  setTimeout(()=>{if(!device&&!listCtx){showList(false);popHome()}},7000);   // the player never came up: don't leave the page waiting, show Spotify's card
  const s=document.createElement('script');s.src='https://sdk.scdn.co/spotify-player.js';s.async=true;document.head.appendChild(s);
}
})();
