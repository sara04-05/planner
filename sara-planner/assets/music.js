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
let curName=embed.dataset.title||'',embedPlaying=false,embedUri='',mirrored='',playHook=null;   // what Spotify's own card is showing / playing
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
if(pop)pop.addEventListener('click',()=>{
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
function noPremium(){premium=false;listCtx='';showList(false);const n=$('spPremium');if(n)n.hidden=false;const p=$('spPlayer');if(p)p.hidden=true}
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
function markSong(uri){   // highlight the playing song in the list and keep it in view
  if(!tracksBox)return;
  let on=null;
  tracksBox.querySelectorAll('.sp-tk').forEach(r=>{const is=r.dataset.tk===uri;r.classList.toggle('on',is);if(is)on=r});
  if(on)tracksBox.scrollTop=Math.max(0,on.offsetTop-tracksBox.clientHeight/2+on.offsetHeight/2);
}
async function viewContext(ctx,uri){   // the playlist or album that is playing: its whole list, with the playing song marked
  if(ctx===listCtx){markSong(uri);return}
  listCtx=ctx;
  const m=/^spotify:(playlist|album):([A-Za-z0-9]+)$/.exec(ctx);
  const songs=await ctxSongs({type:m[1],id:m[2]});
  if(listCtx!==ctx)return;   // something else was picked meanwhile
  if(!songs.length){   // Spotify won't let us read this one (its own playlists, for example): its card shows the playlist instead
    showList(false);mirrored='';
    if(!embed.src.includes('/embed/'+m[1]+'/'+m[2])){embed.src='https://open.spotify.com/embed/'+m[1]+'/'+m[2]+'?utm_source=generator';embed.classList.remove('short')}
    return;
  }
  if(!curName){   // opened with a playlist that has no name yet: ask for it
    try{const r=await api(m[1]==='playlist'?'/playlists/'+m[2]+'?fields=name':'/albums/'+m[2]);if(r.ok)curName=(await r.json()).name||''}catch(e){}
    if(listCtx!==ctx)return;
  }
  tracksBox.innerHTML='<div class="sp-tk-h"><b translate="no">'+esc(curName)+'</b><span>'+songs.length+' '+esc(t('songs'))+'</span></div>'
    +songs.map((x,i)=>'<button type="button" class="sp-tk" data-tk="'+esc(x.uri)+'" translate="no"><span class="n">'+(i+1)+'</span><span class="m"><b>'+esc(x.name)+'</b><small>'+esc((x.artists||[]).map(a=>a.name).join(', '))+'</small></span><span class="d">'+fmt(x.duration_ms)+'</span></button>').join('');
  showList(true);markSong(uri);
  if(!sdkStarted)setBar(curName||t('Nothing playing yet'),t('Press play to start'),null);   // nothing has played yet: the controls name the list that the play button will start
}
async function playList(offsetUri){   // play the listed playlist, from a song or from the start
  if(!listCtx||!device)return;
  if(player&&player.activateElement)player.activateElement();
  const body={context_uri:listCtx};if(offsetUri)body.offset={uri:offsetUri};
  try{await startPlayback(body)}catch(x){}
}
if(tracksBox)tracksBox.addEventListener('click',e=>{const b=e.target.closest('[data-tk]');if(b)playList(b.dataset.tk)});   // a song in the list: play the list from there
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
  });
  player.addListener('not_ready',()=>{device=null});
  player.addListener('account_error',noPremium);              // not a Premium account
  player.addListener('initialization_error',()=>{premium=false}); // this browser can't play protected music; the embed still works
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
if(box){
  box.addEventListener('click',e=>{
    const b=e.target.closest('[data-sp]');if(!b)return;
    if(box.dataset.src==='embed'){   // the card is the one playing: the button pauses or resumes it
      if(b.dataset.sp==='toggle'&&embed.contentWindow)embed.contentWindow.postMessage({command:'toggle'},'https://open.spotify.com');
      return;
    }
    if(!sdkStarted&&listCtx&&device){playList('');return}   // nothing has played yet: the buttons start the listed playlist
    if(!player)return;
    if(player.activateElement)player.activateElement();
    ({prev:()=>player.previousTrack(),next:()=>player.nextTrack(),toggle:()=>player.togglePlay()})[b.dataset.sp]();
  });
  $('spVol').addEventListener('input',e=>{if(player)player.setVolume(e.target.value/100)});
}
const s=document.createElement('script');s.src='https://sdk.scdn.co/spotify-player.js';s.async=true;document.head.appendChild(s);
})();
