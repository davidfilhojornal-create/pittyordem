export const STORY_WIDTH=1080,STORY_HEIGHT=1920;
const platforms={apple:'Apple Music',spotify:'Spotify',deezer:'Deezer'};
export function storyData(item,catalog){
 const tracks=new Map(catalog.map(t=>[t.key,t.name]));
 if(item.order?.length!==13||new Set(item.order).size!==13||item.order.some(k=>!tracks.has(k)))throw new Error('Não foi possível recuperar as 13 faixas deste envio. Atualize a lista e tente novamente.');
 return {name:item.displayName||null,tracks:item.order.map(k=>tracks.get(k)),platform:platforms[item.platform]||'Playlist verificada'};
}
// Fotos de divulgação (Jorge Daux), já recortadas em preto e branco com o rosto enquadrado para o card.
export const PHOTOS=[
 {id:'1',alt:'Pitty olhando para cima, de blazer e corset'},
 {id:'2',alt:'Pitty fazendo careta, mãos na cintura'},
 {id:'3',alt:'Pitty de chapéu de pelo, olhando para a câmera'},
 {id:'4',alt:'Pitty de chapéu de pelo cobrindo os olhos'},
 {id:'5',alt:'Pitty deitada no chão, de olhos fechados'},
 {id:'6',alt:'Pitty encostada na parede, de jaqueta'},
 {id:'7',alt:'Pitty sorrindo, com as mãos no cabelo'},
].map(p=>({...p,card:`/fotos/card-${p.id}.jpg`,mini:`/fotos/mini-${p.id}.jpg`}));
export const COVER_OPTION='capa';
export const PHOTO_CREDIT='Foto: Jorge Daux';
// Mesma foto para o mesmo envio (parece aleatório entre pessoas, mas não muda a cada abertura).
export function defaultPhotoId(item){
 const seed=String(item?.id??item?.url??(item?.order||[]).join(''));let h=2166136261;
 for(const ch of seed){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}
 return PHOTOS[(h>>>0)%PHOTOS.length].id;
}
export function storyFilename(name){return 'pitty-a-ordem-'+(String(name||'da-comunidade').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'da-comunidade')+'.png'}
function font(ctx,size){ctx.font=`500 ${size}px "IBM Plex Sans", Arial, sans-serif`}
function linesFor(ctx,text,width){
 const lines=[];let line='';
 for(const char of Array.from(text)){const next=line+char;if(line&&ctx.measureText(next).width>width){lines.push(line.trim());line=char}else line=next}
 if(line.trim())lines.push(line.trim());return lines;
}
export function nameLayout(ctx,name){
 for(let size=60;size>=24;size-=2){font(ctx,size);const lines=linesFor(ctx,name,856);if(lines.length<=2)return {size,lines}}
 throw new Error('Não foi possível diagramar este nome.');
}
export const PHOTO_BOX={width:1080,height:940};
function trackRows(ctx,data,top,step,max){
 data.tracks.forEach((name,i)=>{
  const y=top+i*step;ctx.textAlign='right';font(ctx,22);ctx.fillStyle='#8a8a8a';ctx.fillText(String(i+1).padStart(2,'0'),148,y);
  ctx.textAlign='left';let size=32;font(ctx,size);while(ctx.measureText(name).width>max&&size>22)font(ctx,--size);ctx.fillStyle='#fff';ctx.fillText(name,176,y);
  if(i===0||i===data.tracks.length-1){const w=ctx.measureText(name).width;font(ctx,18);ctx.fillStyle='#9a9a9a';ctx.fillText(i===0?'abre':'fecha',176+w+18,y)}
 });
}
// Card com foto: a foto entra clara no topo (como um bloco de luz) e escurece até o preto, onde fica a lista.
export function drawPhotoStory(ctx,data,{logo,photo},host){
 ctx.fillStyle='#080808';ctx.fillRect(0,0,STORY_WIDTH,STORY_HEIGHT);
 ctx.drawImage(photo,0,0,PHOTO_BOX.width,PHOTO_BOX.height);
 const fadeTop=380,fade=ctx.createLinearGradient(0,fadeTop,0,PHOTO_BOX.height);
 [[0,0],[.2,.06],[.4,.2],[.6,.48],[.8,.82],[1,1]].forEach(([at,a])=>fade.addColorStop(at,`rgba(8,8,8,${a})`));   // curva suave: sem linha marcada no fundo branco
 ctx.fillStyle=fade;ctx.fillRect(0,fadeTop,STORY_WIDTH,PHOTO_BOX.height-fadeTop+1);
 if(logo)ctx.drawImage(logo,STORY_WIDTH-96-190,826,190,190*logo.height/logo.width);
 ctx.textBaseline='alphabetic';ctx.textAlign='left';
 font(ctx,23);ctx.fillStyle='#b5b5b5';ctx.fillText(data.name?'A ORDEM DE':'UMA ORDEM DA COMUNIDADE',96,880);
 const layout=nameLayout(ctx,data.name||'Cada ordem, uma nova escuta.');font(ctx,layout.size);ctx.fillStyle='#fff';
 layout.lines.forEach((line,i)=>ctx.fillText(line,96,944+i*62,640));
 const nameBottom=944+(layout.lines.length-1)*62;
 ctx.strokeStyle='#5a5a5a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(96,nameBottom+36);ctx.lineTo(984,nameBottom+36);ctx.stroke();
 const step=layout.lines.length>1?41:46,top=nameBottom+92;
 trackRows(ctx,data,top,step,700);
 const listBottom=top+12*step;
 ctx.strokeStyle='#5a5a5a';ctx.beginPath();ctx.moveTo(96,listBottom+34);ctx.lineTo(984,listBottom+34);ctx.stroke();
 font(ctx,21);ctx.fillStyle='#b5b5b5';ctx.fillText(data.platform+' · '+PHOTO_CREDIT,96,listBottom+78);
 font(ctx,27);ctx.fillStyle='#fff';ctx.fillText('E você, como ouviria?',96,listBottom+122);
 font(ctx,19);ctx.fillStyle='#9a9a9a';ctx.fillText(host,96,listBottom+158,888);
}
export function drawStory(ctx,data,{logo,cover,photo},host){
 if(photo)return drawPhotoStory(ctx,data,{logo,photo},host);
 ctx.fillStyle='#080808';ctx.fillRect(0,0,STORY_WIDTH,STORY_HEIGHT);
 if(cover){ctx.save();ctx.globalAlpha=.24;const scale=STORY_HEIGHT/cover.height;ctx.drawImage(cover,(STORY_WIDTH-cover.width*scale)/2,0,cover.width*scale,STORY_HEIGHT);ctx.restore()}
 const shade=ctx.createLinearGradient(0,0,0,STORY_HEIGHT);shade.addColorStop(0,'rgba(0,0,0,.3)');shade.addColorStop(.4,'rgba(0,0,0,.65)');shade.addColorStop(1,'rgba(0,0,0,.95)');ctx.fillStyle=shade;ctx.fillRect(0,0,STORY_WIDTH,STORY_HEIGHT);
 ctx.strokeStyle='#666';ctx.lineWidth=1;ctx.strokeRect(64,196,952,1500);
 ctx.drawImage(logo,112,240,244,244*logo.height/logo.width);
 ctx.textBaseline='alphabetic';ctx.textAlign='left';font(ctx,22);ctx.fillStyle='#bbb';ctx.fillText('NA SUA ORDEM',112,423);
 font(ctx,23);ctx.fillStyle='#aaa';ctx.fillText(data.name?'A ORDEM DE':'UMA ORDEM DA COMUNIDADE',112,491);
 const layout=nameLayout(ctx,data.name||'Cada ordem, uma nova escuta.');font(ctx,layout.size);ctx.fillStyle='#fff';layout.lines.forEach((line,i)=>ctx.fillText(line,112,557+i*65));
 ctx.strokeStyle='#777';ctx.beginPath();ctx.moveTo(112,659);ctx.lineTo(968,659);ctx.stroke();
 data.tracks.forEach((name,i)=>{
  const y=724+i*61;ctx.fillStyle='#999';font(ctx,24);ctx.textAlign='right';ctx.fillText(String(i+1).padStart(2,'0'),151,y);
  ctx.textAlign='left';let size=34;font(ctx,size);while(ctx.measureText(name).width>774&&size>24){font(ctx,--size)}ctx.fillStyle='#fff';ctx.fillText(name,183,y);
 });
 ctx.strokeStyle='#777';ctx.beginPath();ctx.moveTo(112,1502);ctx.lineTo(968,1502);ctx.stroke();
 font(ctx,22);ctx.fillStyle='#ccc';ctx.fillText(data.platform+' · 13 faixas, na minha ordem',112,1553);
 font(ctx,27);ctx.fillStyle='#fff';ctx.fillText('E você, como ouviria?',112,1612);
 font(ctx,19);ctx.fillStyle='#aaa';ctx.fillText(host,112,1654,856);
}
let assetsPromise;
function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Não foi possível carregar a arte do card. Tente novamente.'));im.src=src})}
async function assets(){
 if(!assetsPromise)assetsPromise=(async()=>{await document.fonts.load('500 34px "IBM Plex Sans"');return {logo:await loadImage('/pitty-logo.png'),cover:await loadImage('/cover.jpg')}})().catch(e=>{assetsPromise=null;throw e});return assetsPromise;
}
const photoCache=new Map();
function loadPhoto(id){if(!photoCache.has(id)){const p=PHOTOS.find(x=>x.id===id);photoCache.set(id,loadImage(p.card).catch(e=>{photoCache.delete(id);throw e}))}return photoCache.get(id)}
let dialog,generation=0,objectUrl,currentItem,currentCatalog;
function element(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e}
function setupDialog(){
 if(dialog)return dialog;
 dialog=element('dialog',null,'story-dialog');dialog.setAttribute('aria-labelledby','story-title');
 const close=element('button','×','story-close');close.type='button';close.setAttribute('aria-label','Fechar card');close.onclick=()=>dialog.close();
 const heading=element('h2','Sua ordem nos stories');heading.id='story-title';
 const status=element('p','Preparando o card…','story-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const image=element('img',null,'story-preview');image.width=1080;image.height=1920;image.hidden=true;
 const picker=element('fieldset',null,'story-photos');const legend=element('legend','Escolha a foto');picker.append(legend);
 const options=[...PHOTOS.map(p=>({id:p.id,alt:p.alt,mini:p.mini})),{id:COVER_OPTION,alt:'Capa do disco, sem foto'}];
 for(const o of options){const label=element('label',null,'story-photo');const input=element('input');input.type='radio';input.name='story-photo';input.value=o.id;input.setAttribute('aria-label',o.alt);
  const thumb=o.mini?Object.assign(element('img'),{src:o.mini,alt:'',width:108,height:94,loading:'lazy',decoding:'async'}):element('span','Capa','story-photo-cover');
  label.append(input,thumb);picker.append(label)}
 picker.addEventListener('change',e=>{if(e.target.name==='story-photo'&&currentItem)render(e.target.value)});
 const credit=element('p',PHOTO_CREDIT,'story-credit');
 const actions=element('div',null,'story-actions'),download=element('button','Baixar PNG','secondary'),share=element('button','Compartilhar','secondary');download.type=share.type='button';download.disabled=true;share.hidden=true;actions.append(download,share);
 const help=element('p','Baixe a imagem e publique nos seus stories.','hint');dialog.append(close,heading,status,image,picker,credit,actions,help);document.body.append(dialog);
 dialog.addEventListener('close',()=>{generation++;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;image.removeAttribute('src');download.onclick=null;share.onclick=null});
 Object.assign(dialog,{story:{status,image,download,share,picker}});return dialog;
}
export async function openStoryCard(item,catalog){
 const modal=setupDialog();currentItem=item;currentCatalog=catalog;
 const chosen=defaultPhotoId(item);modal.story.picker.querySelectorAll('input').forEach(i=>i.checked=i.value===chosen);
 if(!modal.open)modal.showModal();
 return render(chosen);
}
async function render(photoId){
 const modal=setupDialog(),ui=modal.story,turn=++generation,item=currentItem,catalog=currentCatalog;
 if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;ui.image.hidden=true;ui.image.removeAttribute('src');ui.download.disabled=true;ui.share.hidden=true;ui.status.textContent='Preparando o card…';
 try{
  const data=storyData(item,catalog),art={...await assets()};if(photoId!==COVER_OPTION)art.photo=await loadPhoto(photoId);if(turn!==generation)return;
  const canvas=document.createElement('canvas');canvas.width=STORY_WIDTH;canvas.height=STORY_HEIGHT;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Seu navegador não conseguiu criar o card. Tente em outro navegador.');
  drawStory(ctx,data,art,location.host);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível gerar a imagem. Tente novamente.')),'image/png'));
  if(turn!==generation)return;
  objectUrl=URL.createObjectURL(blob);ui.image.src=objectUrl;ui.image.alt=(data.name?'A ordem de '+data.name:'Ordem da comunidade')+(art.photo?' (com '+PHOTOS.find(p=>p.id===photoId).alt.toLowerCase()+')':'')+': '+data.tracks.map((name,i)=>`${i+1}. ${name}`).join('; ');ui.image.hidden=false;
  ui.download.disabled=false;ui.status.textContent='Seu card está pronto · 1080 × 1920';const filename=storyFilename(data.name);
  ui.download.onclick=()=>{const a=document.createElement('a');a.href=objectUrl;a.download=filename;a.click()};
  if(typeof File!=='undefined'&&navigator.share&&navigator.canShare){const file=new File([blob],filename,{type:'image/png'});if(navigator.canShare({files:[file]})){
   ui.share.hidden=false;ui.share.onclick=async()=>{ui.share.disabled=true;try{await navigator.share({files:[file]})}catch(e){if(e.name!=='AbortError')ui.status.textContent='Não foi possível compartilhar. Use Baixar PNG para salvar a imagem.'}finally{ui.share.disabled=false}};
  }}
 }catch(e){if(turn===generation)ui.status.textContent=e.message||'Não foi possível gerar o card. Tente novamente.'}
}
