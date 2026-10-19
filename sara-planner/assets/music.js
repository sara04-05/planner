/* Music page: Spotify's own player for any link, and (when connected) the person's own Spotify.
   Playing on the page uses Spotify's Web Playback SDK, which works with Spotify Premium; everyone else gets
   their playlists in Spotify's player instead. Nothing here asks the server on a timer: the SDK tells the
   page itself when the song changes, and a token is only fetched again when the old one runs out. */
(function(){
const root=document.getElementById('music');if(!root)return;
const $=id=>document.getElementById(id);
const t=s=>window.SPL_T?window.SPL_T(s):s;
const csrf=root.dataset.csrf, connected=root.dataset.connected==='1';
const embed=$('spEmbed');

/* ---------- Spotify's player for a link ---------- */
function parse(link){
  link=(link||'').trim();
  let m=/^spotify:(playlist|album|track|artist|episode|show):([A-Za-z0-9]{10,40})$/.exec(link);
  if(!m)m=/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(playlist|album|track|artist|episode|show)\/([A-Za-z0-9]{10,40})/.exec(link);
  return m?{type:m[1],id:m[2]}:null;
}
function show(link,save){
  const p=parse(link);if(!p)return false;
  embed.src='https://open.spotify.com/embed/'+p.type+'/'+p.id+'?utm_source=generator';
  embed.classList.toggle('short',p.type==='track'||p.type==='episode');
  if(save){
    const f=new FormData();f.append('csrf',csrf);f.append('do','link');f.append('link','https://open.spotify.com/'+p.type+'/'+p.id);
    fetch('music.php',{method:'POST',body:f,headers:{'X-Requested-With':'fetch'}}).catch(()=>{});
  }
  return true;
}
const first=parse(embed.src);if(first)embed.classList.toggle('short',first.type==='track'||first.type==='episode');

const form=$('spLinkForm'), input=$('spLink');
if(form)form.addEventListener('submit',e=>{
  if(!parse(input.value)){e.preventDefault();input.setCustomValidity(t("That doesn't look like a Spotify link. Copy it in Spotify with Share → Copy link."));input.reportValidity();return}
  e.preventDefault();show(input.value,true);
});
if(input)input.addEventListener('input',()=>input.setCustomValidity(''));
root.addEventListener('click',e=>{const b=e.target.closest('[data-sp-link]');if(!b)return;show(b.dataset.spLink,true);embed.scrollIntoView({behavior:'smooth',block:'nearest'})});

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
        +(row.image?`<img alt="" src="${esc(row.image)}" loading="lazy">`:'<i aria-hidden="true">♪</i>')
        +`<span><b>${esc(row.title)}</b></span></button><form method="post" action="music.php"><input type="hidden" name="do" value="unsave"><input type="hidden" name="id" value="${+row.id}"><button class="sp-x" aria-label="Remove">×</button></form></div>`);
    }
    saveIn.value='';show(row.link,true);
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
    +(pic?`<img alt="" src="${esc(pic)}" loading="lazy">`:'<i aria-hidden="true">♪</i>')
    +`<span><b>${esc(item.name)}</b><small>${esc(sub)}</small></span></button>`;
}
async function play(uri,url){
  if(player&&player.activateElement)player.activateElement();   // lets the browser start sound after this click
  if(device&&premium!==false){
    const body=uri.startsWith('spotify:track:')?{uris:[uri]}:{context_uri:uri};
    try{
      const r=await api('/me/player/play?device_id='+encodeURIComponent(device),{method:'PUT',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});
      if(r.ok||r.status===204)return;
      if(r.status===403)noPremium();
    }catch(e){}
  }
  show(url||('https://open.spotify.com/'+uri.split(':').slice(1).join('/')),true);
  embed.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function noPremium(){premium=false;const n=$('spPremium');if(n)n.hidden=false;const p=$('spPlayer');if(p)p.hidden=true}
root.addEventListener('click',e=>{const b=e.target.closest('.sp-item[data-uri]');if(b)play(b.dataset.uri,b.dataset.url)});

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
function nowPlaying(st){
  if(!st||!st.track_window||!st.track_window.current_track)return;
  const tr=st.track_window.current_track,art=$('spArt'),img=(tr.album.images||[])[0];
  $('spTitle').textContent=tr.name;$('spArtist').textContent=(tr.artists||[]).map(a=>a.name).join(', ');
  if(img){art.src=img.url;art.hidden=false}
  tog.textContent=st.paused?'▶':'⏸';
}
window.onSpotifyWebPlaybackSDKReady=()=>{
  player=new Spotify.Player({name:document.body.classList.contains('music-win')?'Splanner (small window)':'Splanner',getOAuthToken:cb=>getToken().then(cb,()=>{}),volume:.6});
  player.addListener('ready',({device_id})=>{device=device_id;if(premium!==false&&box)box.hidden=false});
  player.addListener('not_ready',()=>{device=null});
  player.addListener('account_error',noPremium);              // not a Premium account
  player.addListener('initialization_error',()=>{premium=false}); // this browser can't play protected music; the embed still works
  player.addListener('authentication_error',()=>{token=null});
  player.addListener('player_state_changed',nowPlaying);
  player.connect();
};
if(box){
  box.addEventListener('click',e=>{
    const b=e.target.closest('[data-sp]');if(!b||!player)return;
    if(player.activateElement)player.activateElement();
    ({prev:()=>player.previousTrack(),next:()=>player.nextTrack(),toggle:()=>player.togglePlay()})[b.dataset.sp]();
  });
  $('spVol').addEventListener('input',e=>{if(player)player.setVolume(e.target.value/100)});
}
const s=document.createElement('script');s.src='https://sdk.scdn.co/spotify-player.js';s.async=true;document.head.appendChild(s);
})();
