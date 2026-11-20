const trackTitles=["Sobremesa", "Armadura", "DESOBEDIENTE", "Pileque de Poeta", "Não à Deriva", "Caminhada", "Sobriedade Seletiva", "\"Amiga,\"", "Madame", "Álbum de Casamento", "Prazer, Universo", "Cuidada", "Nó"];
function setTrackText(element,value){
 const text=String(value);element.replaceChildren();
 let offset=0;
 while(offset<text.length){
  let best=-1,index=-1;
  trackTitles.forEach((name,i)=>{const at=text.indexOf(name,offset);if(at>=0&&(best<0||at<best||(at===best&&name.length>trackTitles[index].length))){best=at;index=i}});
  if(best<0){element.append(document.createTextNode(text.slice(offset)));break}
  if(best>offset)element.append(document.createTextNode(text.slice(offset,best)));
  const art=document.createElement('span');art.className='track-lettering track-lettering-'+index;
  const accessible=document.createElement('span');accessible.className='sr-only';accessible.textContent=trackTitles[index];art.append(accessible);element.append(art);
  offset=best+trackTitles[index].length;
 }
}
import * as PM from '/position-map.js';
import {openStoryCard} from '/story-card.js';
import {initBackgroundAudio} from '/background-audio.js';
import {createTurnstileGate} from '/turnstile.js';
const turnstileGate=createTurnstileGate();
const $=s=>document.querySelector(s),node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)setTrackText(e,text);if(cls)e.className=cls;return e};
let catalog=[],summary=null,nextCursor=null,loadedPlaylists=false,loadingResults=false,loadingPlaylists=false;
const names=()=>new Map(catalog.map(t=>[t.key,t.name]));
const API_ORIGIN=globalThis.PITTY_API_ORIGIN||'';
async function api(path,options){const r=await fetch(API_ORIGIN+path,{...options,credentials:'omit'});let data;try{data=await r.json()}catch{throw new Error('Não foi possível acessar o servidor. Tente novamente.')}if(!r.ok){const e=new Error(data.error||'Não foi possível concluir.');e.details=data;e.status=r.status;throw e}return data}
function setStatus(el,text){el.textContent=text}
let activePage=null;
function route(){const target=['enviar','playlists','resultados'].includes(location.hash.slice(1))?location.hash.slice(1):'enviar';document.querySelectorAll('.page').forEach(e=>e.hidden=e.id!==target);document.querySelectorAll('nav a').forEach(a=>{const active=a.hash==='#'+target;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});if(target!==activePage){activePage=target;window.scrollTo({top:0,left:0,behavior:'instant'})}if(target==='playlists'&&!loadedPlaylists&&!loadingPlaylists)loadPlaylists();if(target==='resultados')loadResults()}
window.addEventListener('hashchange',route);
const dialog=$('#about');const openAbout=()=>dialog.showModal();$('#about-button').onclick=openAbout;$('#rules-button').onclick=openAbout;dialog.querySelector('.close').onclick=()=>dialog.close();
function openPlaylists(message){playlistAbort?.abort();loadingPlaylists=false;loadedPlaylists=false;summary=null;setStatus($('#playlist-feedback'),message);location.hash='#playlists';route();window.scrollTo({top:0,behavior:'auto'})}
$('#submission').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button[type=submit]');button.disabled=true;button.textContent='Conferindo as 13 faixas…';$('#validation-details').replaceChildren();setStatus($('#feedback'),'Lendo a página pública e verificando a sequência completa.');try{const data=await api('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:$('#playlist-url').value.trim(),consent:$('#consent').checked,name:$('#display-name').value.trim(),turnstileToken:turnstileGate.token()})});if(!data.accepted||!data.submission?.displayName)throw new Error('O servidor não confirmou o nome salvo. Atualize o site e consulte a lista antes de reenviar.');setStatus($('#feedback'),data.message);dispatchEvent(new CustomEvent('pitty:accepted',{detail:{order:data.order}}));const link=node('a','Ver resultados ↗');link.href='#resultados';$('#validation-details').append(link);$('#playlist-url').value='';$('#display-name').value='';$('#consent').checked=false;openPlaylists('Playlist de '+data.submission.displayName+' enviada! Explore também as escolhas de outras pessoas.')}catch(error){if(error.status===409){openPlaylists('Essa playlist já foi contabilizada. O envio original foi mantido, sem alterar o nome nem duplicar a contagem. Envios anteriores ao cadastro de nomes continuam sem identificação.');return}setStatus($('#feedback'),error.message);for(const [key,label] of [['missing','Faltando'],['extra','Fora do disco'],['repeated','Repetidas']]){const list=error.details?.[key];if(list?.length)$('#validation-details').append(node('p',label+': '+list.join(', ')))}}finally{turnstileGate.reset();button.disabled=false;button.replaceChildren(node('span','Conferir e enviar'),node('span','↗'))}};
const platformLabels={apple:'Apple Music',spotify:'Spotify',deezer:'Deezer'};
let playlistAbort=null;const renderedPlaylistIds=new Set();
function plain(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e}
async function loadPlaylists(append=false){
 if(append&&loadingPlaylists)return;
 if(!append)playlistAbort?.abort();
 const controller=new AbortController();playlistAbort=controller;loadingPlaylists=true;
 const holder=$('#playlist-list'),more=$('#load-more');more.disabled=true;more.textContent='Carregando…';
 if(!append){holder.replaceChildren(node('p','Carregando playlists…','hint'));nextCursor=null;renderedPlaylistIds.clear();more.hidden=true}
 try{
  const data=await api('/api/playlists'+(append?'?cursor='+encodeURIComponent(nextCursor):''),{signal:controller.signal});
  if(controller!==playlistAbort)return;
  if(!append)holder.replaceChildren();
  if(!data.items.length&&!append)holder.append(node('p','A primeira ordem ainda está por vir. Envie sua playlist para começar.','empty'));
  const lookup=names();
  for(const item of data.items){
   const identity=item.id||item.url;if(renderedPlaylistIds.has(identity))continue;renderedPlaylistIds.add(identity);
   const article=node('article',undefined,'playlist-card setlist-card');
   const tape=plain('span','','setlist-tape');tape.setAttribute('aria-hidden','true');
   const head=plain('div','','setlist-head');
   const name=plain('h3',item.displayName||'Participante sem nome',item.displayName?'participant-name':'participant-name participant-anonymous');
   const platform=platformLabels[item.platform];head.append(name);
   if(platform){const logo=document.createElement('img');logo.className='setlist-logo';logo.src='/plataformas/'+item.platform+'.png';logo.alt=platform;logo.title=platform;logo.width=32;logo.height=32;logo.decoding='async';head.append(logo)}
   const ol=node('ol',undefined,'setlist-tracks');ol.setAttribute('aria-label','Ordem das 13 faixas');item.order.forEach(key=>ol.append(node('li',lookup.get(key)||'Faixa')));
   const foot=plain('div','','setlist-foot');const meta=plain('p','','setlist-meta');
   const when=new Date(item.verifiedAt),day=when.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'numeric'}),month=when.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',month:'short'}).replace('.','');
   const date=plain('time',day+' '+month);date.dateTime=item.verifiedAt;date.setAttribute('aria-label','Verificada em '+when.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}));
   meta.append((platform||'Plataforma não identificada')+' · ',date);
   const story=plain('button','','setlist-story');story.type='button';story.setAttribute('aria-label','Gerar card para stories: '+(item.displayName||'ordem da comunidade'));const arrow=plain('span','↗');arrow.setAttribute('aria-hidden','true');story.append(plain('span','Card para stories'),arrow);story.onclick=()=>openStoryCard(item,catalog);
   foot.append(meta,story);article.append(tape,head,ol,foot);holder.append(article);
  }
  nextCursor=data.nextCursor;more.hidden=!nextCursor;loadedPlaylists=true;
 }catch(e){if(e.name==='AbortError')return;if(!append)holder.replaceChildren(node('p',e.message,'empty'));else holder.append(node('p',e.message,'hint'))}
 finally{if(controller===playlistAbort){loadingPlaylists=false;more.disabled=false;more.textContent='Carregar mais playlists'}}
}
$('#load-more').onclick=()=>loadPlaylists(true);
async function loadResults(){if(loadingResults)return;loadingResults=true;$('#refresh').disabled=true;setStatus($('#results-status'),summary?'Atualizando…':'Carregando resultados…');try{summary=await api('/api/results');$('#results-stale').hidden=true;if(!summary.total)closeDetail(false);$('#total').textContent=summary.total;$('#insights').hidden=summary.total===0;setStatus($('#results-status'),summary.total?'Atualizado às '+new Date(summary.updatedAt).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · horário de Brasília.':'Ainda não há envios aceitos. Os resultados aparecerão após a primeira playlist verificada.');if(summary.total)renderSummary()}catch(e){setStatus($('#results-status'),e.message+(summary?' Os dados exibidos são da última consulta bem-sucedida.':''));if(summary?.total)$('#results-stale').hidden=false}finally{loadingResults=false;$('#refresh').disabled=false}}
$('#refresh').onclick=loadResults;
function countLabel(count,singular,plural){return `${count} ${count===1?singular:plural}`}
function renderSummary(){const lookup=names(),tracks=new Map(summary.tracks.map(t=>[t.key,t]));const highlights=$('#highlights');highlights.replaceChildren();for(const [label,index]of [['Quem abre o disco',0],['Quem fecha o disco',12]]){const max=Math.max(...summary.tracks.map(t=>t.positions[index]));const winners=summary.tracks.filter(t=>t.positions[index]===max);const box=node('article');box.append(node('h3',label),node('strong',winners.map(t=>t.name).join(' / ')),node('p',`${max} de ${countLabel(summary.total,'playlist','playlists')} · ${(max/summary.total*100).toFixed(1).replace('.',',')}%${winners.length>1?' · empate':''}`));highlights.append(box)}renderMap();
for(const [selector,entries,type]of [['#sequences',summary.sequences,'sequence'],['#pairs',summary.pairs,'pair']]){
 const container=$(selector);container.replaceChildren();
 for(const item of entries){
  const title=plain('span',`${lookup.get(item.order[0])} → ${lookup.get(item.order.at(-1))}`,'sequence-titles');
  const count=plain('span',type==='sequence'?countLabel(item.count,'playlist','playlists'):countLabel(item.count,'vez','vezes'),'sequence-count');
  if(type==='sequence'){
   const details=node('details',undefined,'sequence');const heading=document.createElement('summary');heading.append(title,count);
   const ol=node('ol');item.order.forEach(k=>ol.append(plain('li',lookup.get(k))));details.append(heading,ol);container.append(details);
  }else{const row=plain('div','','sequence pair-row');row.append(title,count);container.append(row)}
 }
}
}

$('#export').onclick=()=>{if(!summary)return;const esc=s=>'"'+String(s).replaceAll('"','""')+'"';const lines=[['Faixa',...Array.from({length:13},(_,i)=>`${i+1}ª posição`),'Posição média','Posições mais frequentes'],...summary.tracks.map(t=>[t.name,...t.positions,t.average,t.modes.join(' / ')])];const blob=new Blob(['\ufeff'+lines.map(r=>r.map(esc).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=node('a');a.href=url;a.download='pitty-posicoes.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};


/* ---------- Mapa de posições ---------- */
let matrix=null,selected=null,preview=null,focusCell={r:0,c:0},quietFocus=false;
const cellButton=(r,c)=>$(`#position-table button[data-r="${r}"][data-c="${c}"]`);

function renderMap(){
 const rows=catalog.length?catalog:summary.tracks.map(t=>({key:t.key,name:t.name}));
 matrix=PM.buildMatrix(rows,summary);
 const table=$('#position-table'),caption=table.querySelector('caption');table.replaceChildren(caption);
 const head=node('thead'),hr=node('tr'),corner=node('th','Faixa','map-corner');corner.scope='col';hr.append(corner);
 for(let c=0;c<PM.POSITIONS;c++){const th=node('th',PM.positionLabel(c));th.scope='col';th.dataset.c=c;hr.append(th)}
 head.append(hr);table.append(head);
 const body=node('tbody');
 if(selected&&!matrix.rows.some(r=>r.key===selected.key))selected=null;
 matrix.rows.forEach((row,r)=>{
  const tr=node('tr'),th=node('th',undefined,'map-track');th.textContent=row.name;th.scope='row';th.dataset.r=r;tr.append(th);
  row.cells.forEach((cell,c)=>{
   const td=node('td'),b=node('button',PM.formatPercent(cell.percent),'map-cell');
   b.type='button';b.dataset.r=r;b.dataset.c=c;
   const color=PM.colorFor(cell.percent,matrix.max);b.style.background=color.background;b.style.color=color.color;
   b.setAttribute('aria-label',PM.describeCell({name:row.name,count:cell.count,total:matrix.total,index:c}).label);
   b.setAttribute('aria-pressed','false');b.tabIndex=-1;
   td.append(b);tr.append(td);
  });
  body.append(tr);
 });
 table.append(body);
 const sel=selected&&{r:matrix.rows.findIndex(x=>x.key===selected.key),c:selected.c};
 focusCell=sel||{r:Math.min(focusCell.r,matrix.rows.length-1),c:focusCell.c};
 cellButton(focusCell.r,focusCell.c)&&(cellButton(focusCell.r,focusCell.c).tabIndex=0);
 if(sel)applySelection(sel.r,sel.c,true);else if(!$('#cell-detail').hidden)closeDetail(false);
}

function markActive(r,c){
 document.querySelectorAll('#position-table .is-selected').forEach(e=>{e.classList.remove('is-selected');e.setAttribute('aria-pressed','false')});
 document.querySelectorAll('#position-table .is-active').forEach(e=>e.classList.remove('is-active'));
 if(r===null)return;
 const b=cellButton(r,c);if(!b)return;
 b.classList.add('is-selected');b.setAttribute('aria-pressed','true');
 $(`#position-table th[data-r="${r}"]`)?.classList.add('is-active');$(`#position-table thead th[data-c="${c}"]`)?.classList.add('is-active');
}
function fillDetail(r,c){
 const row=matrix.rows[r],cell=row.cells[c];
 const d=PM.describeCell({name:row.name,count:cell.count,total:matrix.total,index:c});
 setTrackText($('#detail-title'),d.title);$('#detail-headline').textContent=d.headline;$('#detail-sentence').textContent=d.sentence;
 $('#detail-extra').textContent=row.average===null?'':`Posição média da faixa: ${PM.formatAverage(row.average)} · mais frequente: ${row.modes.map(PM.modeLabel).join(', ')}`;
 return d;
}
function placeDetail(){
 const box=$('#cell-detail'),cur=preview||selected;if(box.hidden||!cur)return;
 const r=preview?preview.r:matrix.rows.findIndex(x=>x.key===selected.key),b=cellButton(r,cur.c);if(!b)return;
 const rect=b.getBoundingClientRect(),w=box.offsetWidth,h=box.offsetHeight,vw=document.documentElement.clientWidth,vh=window.innerHeight,m=8;
 let left=Math.min(Math.max(rect.left+rect.width/2-w/2,m),vw-w-m),top=rect.bottom+m;
 const navRect=document.querySelector('nav')?.getBoundingClientRect(),navTop=navRect&&navRect.top>vh/2?navRect.top:vh,bottom=Math.min(vh,navTop)-m;
 if(top+h>bottom)top=rect.top-h-m;
 top=Math.min(Math.max(top,m),Math.max(m,bottom-h));
 box.style.left=Math.max(m,left)+'px';box.style.top=top+'px';
}
function applySelection(r,c,silent){
 selected={key:matrix.rows[r].key,c};preview=null;
 markActive(r,c);const d=fillDetail(r,c);
 const box=$('#cell-detail');box.hidden=false;box.classList.add('pinned');placeDetail();
 if(!silent)$('#map-live').textContent=`${d.title}. ${d.headline}. ${d.sentence}`;
 else $('#map-live').textContent=`Resultados atualizados. ${d.title}. ${d.headline}. ${d.sentence}`;
}
function showPreview(r,c){
 preview={r,c};fillDetail(r,c);const box=$('#cell-detail');box.hidden=false;box.classList.remove('pinned');placeDetail();
}
function endPreview(){
 if(!preview)return;preview=null;
 if(selected){const r=matrix.rows.findIndex(x=>x.key===selected.key);fillDetail(r,selected.c);$('#cell-detail').classList.add('pinned');placeDetail()}
 else $('#cell-detail').hidden=true;
}
function closeDetail(returnFocus=true){
 const had=selected;selected=null;preview=null;$('#cell-detail').hidden=true;markActive(null);
 if(had&&returnFocus){quietFocus=true;cellButton(focusCell.r,focusCell.c)?.focus({preventScroll:true});quietFocus=false}
 $('#map-live').textContent=had?'Detalhe fechado.':'';
}
function moveFocus(r,c){
 const rows=matrix.rows.length;r=Math.max(0,Math.min(rows-1,r));c=Math.max(0,Math.min(PM.POSITIONS-1,c));
 cellButton(focusCell.r,focusCell.c)&&(cellButton(focusCell.r,focusCell.c).tabIndex=-1);
 focusCell={r,c};const b=cellButton(r,c);b.tabIndex=0;b.focus();b.scrollIntoView({block:'nearest',inline:'nearest'});
}
const tableEl=$('#position-table');
tableEl.addEventListener('click',e=>{const b=e.target.closest('button.map-cell');if(!b)return;const r=+b.dataset.r,c=+b.dataset.c;moveFocus(r,c);applySelection(r,c)});
tableEl.addEventListener('focusin',e=>{const b=e.target.closest('button.map-cell');if(!b)return;const r=+b.dataset.r,c=+b.dataset.c;
 if(focusCell.r!==r||focusCell.c!==c){cellButton(focusCell.r,focusCell.c)&&(cellButton(focusCell.r,focusCell.c).tabIndex=-1);focusCell={r,c};b.tabIndex=0}
 if(!quietFocus&&b.matches(':focus-visible'))applySelection(r,c)});
tableEl.addEventListener('keydown',e=>{const b=e.target.closest('button.map-cell');if(!b)return;const r=+b.dataset.r,c=+b.dataset.c;
 const moves={ArrowUp:[r-1,c],ArrowDown:[r+1,c],ArrowLeft:[r,c-1],ArrowRight:[r,c+1],Home:[r,0],End:[r,PM.POSITIONS-1]};
 if(moves[e.key]){e.preventDefault();moveFocus(...moves[e.key]);applySelection(focusCell.r,focusCell.c)}});
tableEl.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const b=e.target.closest('button.map-cell');if(b)showPreview(+b.dataset.r,+b.dataset.c)});
tableEl.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')endPreview()});
$('#cell-detail .detail-close').onclick=()=>closeDetail(true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#cell-detail').hidden&&!$('#about').open){e.preventDefault();closeDetail(true)}});
window.addEventListener('resize',placeDetail);
window.addEventListener('scroll',placeDetail,{capture:true,passive:true});
window.addEventListener('hashchange',()=>{if(location.hash!=='#resultados'){preview=null;$('#cell-detail').hidden=true}});

function revealFocusedField(){
 const field=document.activeElement;if(!field?.matches('#display-name, #playlist-url, #consent'))return;
 const nav=document.querySelector('nav');if(!nav)return;
 const rect=field.getBoundingClientRect(),menu=nav.getBoundingClientRect();
 if(rect.bottom>menu.top-16)field.scrollIntoView({block:'center',behavior:'instant'});
}
document.addEventListener('focusin',revealFocusedField);
window.visualViewport?.addEventListener('resize',revealFocusedField);

/* ---------- Início ---------- */
try{const data=await api('/api/catalog');catalog=data.tracks;try{await turnstileGate.configure(data.security)}catch(error){setStatus($('#feedback'),error.message)}if(data.providers?.deezer){document.querySelectorAll('.platforms').forEach(e=>e.textContent='Spotify, Apple Music ou Deezer');$('#playlist-url').placeholder='Cole o link da sua playlist'}catalog.forEach(t=>$('#track-list').append(node('li',t.name)))}catch(e){setStatus($('#feedback'),e.message)}route();

void initBackgroundAudio();
