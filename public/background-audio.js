export const INITIAL_VOLUME=.08;
export function availableTracks(manifest){
 const tracks=manifest?.tracks;
 if(!Array.isArray(tracks))return [];
 const seen=new Set();return tracks.filter(t=>t&&typeof t.key==='string'&&typeof t.name==='string'&&/^\/audio\/\d{2}\.mp3$/.test(t.src)&&!seen.has(t.key)&&seen.add(t.key));
}
export function createPlayback(audio,tracks,{onChange=()=>{},createContext=()=>{const C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C():null}}={}){
 let index=0,volume=INITIAL_VOLUME,context=null,gain=null,graphReady=false,error='',busy=false;
 audio.preload='none';audio.volume=volume;
 const state=()=>({track:tracks[index],index,volume,playing:!audio.paused,busy,error});
 const update=()=>onChange(state());
 function ensureGraph(){
  if(graphReady)return;graphReady=true;
  try{context=createContext();if(context){const source=context.createMediaElementSource(audio);gain=context.createGain();gain.gain.value=volume;source.connect(gain);gain.connect(context.destination);audio.volume=1}}catch{context=null;gain=null;audio.volume=volume}
 }
 function select(next){audio.pause();index=(next+tracks.length)%tracks.length;audio.src=tracks[index].src;error='';update()}
 async function play(){
  if(!tracks.length)return;error='';busy=true;if(!audio.getAttribute('src'))audio.src=tracks[index].src;ensureGraph();update();
  try{await Promise.all([context?.state==='suspended'?context.resume():Promise.resolve(),audio.play()])}catch(e){if(e.name==='AbortError')return;error=e.name==='NotAllowedError'?'Toque para começar a escuta.':'Não foi possível tocar. Tente a próxima faixa.';audio.pause()}finally{busy=false;update()}
 }
 function pause(){audio.pause();busy=false;update()}
 async function next(){const resume=!audio.paused;select(index+1);if(resume)await play()}
 function setVolume(value){const n=Number(value);if(!Number.isFinite(n))return;volume=Math.min(1,Math.max(0,n));if(gain){gain.gain.cancelScheduledValues?.(context?.currentTime??0);gain.gain.value=volume}else audio.volume=volume;update()}
 // Fade curto no começo e no fim de cada trecho, para o corte não soar seco.
 const FADE_IN=.25,FADE_OUT=1.8;let fadingOut=false;
 function ramp(to,seconds){if(!gain||!context)return;const now=context.currentTime;gain.gain.cancelScheduledValues(now);gain.gain.setValueAtTime(Math.max(gain.gain.value,.0001),now);gain.gain.linearRampToValueAtTime(Math.max(to,.0001),now+seconds)}
 audio.addEventListener('playing',()=>{if(audio.currentTime<.5){fadingOut=false;if(gain&&context){gain.gain.setValueAtTime(.0001,context.currentTime);ramp(volume,FADE_IN)}}});
 audio.addEventListener('timeupdate',()=>{const left=audio.duration-audio.currentTime;if(!fadingOut&&Number.isFinite(left)&&left<=FADE_OUT){fadingOut=true;ramp(0,Math.max(.1,left))}});
 audio.addEventListener('ended',()=>{fadingOut=false;select(index+1);void play()});
 audio.addEventListener('playing',()=>{busy=false;error='';update()});audio.addEventListener('pause',update);
 audio.addEventListener('waiting',()=>{busy=true;update()});
 audio.addEventListener('error',()=>{busy=false;error='Áudio indisponível. Tente a próxima faixa.';update()});
 return {play,pause,next,setVolume,state};
}
// Try native autoplay; when blocked, retry once on a real user gesture.
export function startBackgroundPlayback(player,target,region){
 let listening=true;
 function stop(){if(!listening)return;listening=false;target.removeEventListener('pointerdown',gesture,true);target.removeEventListener('keydown',gesture,true)}
 function gesture(event){
  if(!event.isTrusted||['Shift','Control','Alt','Meta'].includes(event.key))return;
  stop();if(region?.contains(event.target)||player.state().playing)return;
  void player.play();
 }
 target.addEventListener('pointerdown',gesture,{capture:true,passive:true});
 target.addEventListener('keydown',gesture,true);
 void player.play().then(()=>{if(player.state().playing)stop()});
 return stop;
}
function el(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e}
let initialized=false;
export async function initBackgroundAudio(){
 if(initialized)return;initialized=true;
 let tracks;try{const r=await fetch('/audio/manifest.json');if(!r.ok)return;tracks=availableTracks(await r.json());if(!tracks.length)return}catch{return}
 const region=el('aside',null,'background-player');region.setAttribute('aria-label','Música de fundo');
 const toggle=el('button','▶','audio-toggle');toggle.type='button';toggle.setAttribute('aria-label','Ouvir música de fundo');
 const info=el('div',null,'audio-info'),label=el('span','Refrões do disco','audio-label'),name=el('span',tracks[0].name,'audio-name');info.append(label,name);
 const next=el('button','›','audio-next');next.type='button';next.setAttribute('aria-label','Próxima faixa');
 const settings=el('details',null,'audio-settings'),settingsToggle=el('summary','⋯');settingsToggle.setAttribute('aria-label','Ajustar volume');
 const volumeLabel=el('label','Volume','audio-volume'),volume=el('input');volume.type='range';volume.min='0';volume.max='1';volume.step='.01';volume.value=String(INITIAL_VOLUME);volume.setAttribute('aria-label','Volume da música de fundo');volumeLabel.append(volume);settings.append(settingsToggle,volumeLabel);
 const status=el('span',null,'sr-only');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 region.append(toggle,info,next,settings,status);document.querySelector('header').append(region);
 const audio=new Audio();const player=createPlayback(audio,tracks,{onChange:s=>{
  name.textContent=s.track.name;name.title=s.track.name;
  label.textContent=s.error|| (s.busy?'Preparando a escuta…':s.playing?'Em escuta · trecho de 30 s':'Refrões do disco');
  toggle.textContent=s.playing?'Ⅱ':'▶';toggle.setAttribute('aria-label',s.playing?'Pausar música de fundo':'Ouvir música de fundo');toggle.setAttribute('aria-pressed',String(s.playing));
  region.classList.toggle('is-playing',s.playing);status.textContent=s.error||'';
 }});
 toggle.onclick=()=>player.state().playing?player.pause():void player.play();next.onclick=()=>void player.next();volume.oninput=()=>player.setVolume(volume.value);
 startBackgroundPlayback(player,document,region);
}
