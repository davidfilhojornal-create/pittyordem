import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {storyData,storyFilename,nameLayout,drawStory,STORY_WIDTH,STORY_HEIGHT} from '../public/story-card.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../server/catalog/pitty.json',import.meta.url))).tracks;
const item={displayName:'Lari',platform:'spotify',order:catalog.map(t=>t.key).reverse()};
function context(){return {font:'',calls:[],fillText(text,x,y,max){this.calls.push({text,x,y,max,font:this.font})},measureText(text){return {width:Array.from(text).length*parseFloat(this.font.match(/(\d+)px/)?.[1]||'20')*.65}},fillRect(){},strokeRect(){},drawImage(){},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},createLinearGradient(){return {addColorStop(){}}}}}
test('card preserves all 13 positions, participant and source platform',()=>{const d=storyData(item,catalog);assert.deepEqual(d.tracks,catalog.map(t=>t.name).reverse());assert.equal(d.name,'Lari');assert.equal(d.platform,'Spotify')});
test('card rejects partial, repeated and unknown orders',()=>{for(const order of [item.order.slice(1),Array(13).fill(item.order[0]),[...item.order.slice(1),'unknown']])assert.throws(()=>storyData({...item,order},catalog))});
test('legacy playlists never invent a participant name',()=>{const d=storyData({...item,displayName:null,platform:'apple'},catalog);assert.equal(d.name,null);assert.equal(d.platform,'Apple Music')});
test('long names remain complete, within two lines and inside the layout',()=>{for(const name of ['Lari','W'.repeat(60),'😊'.repeat(60),'Maria da Conceição dos Santos'.repeat(2)]){const ctx=context(),layout=nameLayout(ctx,name);assert.ok(layout.lines.length<=2);assert.equal(layout.lines.join('').replaceAll(' ',''),name.replaceAll(' ',''));for(const line of layout.lines)assert.ok(ctx.measureText(line).width<=856)}});
test('1080 × 1920 drawing includes every numbered title in the saved order, inside safe area',()=>{const ctx=context(),d=storyData(item,catalog);drawStory(ctx,d,{logo:{width:1920,height:994}},'example.com');assert.equal(STORY_WIDTH,1080);assert.equal(STORY_HEIGHT,1920);const titles=ctx.calls.filter(c=>d.tracks.includes(c.text));assert.deepEqual(titles.map(c=>c.text),d.tracks);assert.ok(titles.every(c=>c.y>=700&&c.y<1502));assert.deepEqual(ctx.calls.filter(c=>/^\d{2}$/.test(c.text)).map(c=>c.text),Array.from({length:13},(_,i)=>String(i+1).padStart(2,'0')))});
test('download filenames are safe and contain no user path segments',()=>{assert.equal(storyFilename('Lári / Silva'),'pitty-a-ordem-lari-silva.png');assert.equal(storyFilename(null),'pitty-a-ordem-da-comunidade.png');assert.ok(!storyFilename('../../\\❤️').includes('/'))});
import {drawPhotoStory,defaultPhotoId,PHOTOS,PHOTO_CREDIT} from '../public/story-card.js';
test('card com foto: 13 títulos na ordem, numerados, com crédito e tudo acima da barra de resposta do Instagram',()=>{
 for(const name of ['Lari','Maria da Conceição dos Santos Oliveira Pereira',null]){
  const ctx=context(),d=storyData({...item,displayName:name},catalog);drawPhotoStory(ctx,d,{logo:{width:1920,height:994},photo:{width:1080,height:940}},'example.com');
  const titles=ctx.calls.filter(c=>d.tracks.includes(c.text));assert.deepEqual(titles.map(c=>c.text),d.tracks);
  assert.ok(titles.every(c=>c.y>940),'lista fica abaixo da foto');
  const last=Math.max(...ctx.calls.map(c=>c.y));assert.ok(last<=1760,'último texto em '+last);
  assert.ok(ctx.calls.some(c=>c.text.includes(PHOTO_CREDIT)));
  assert.deepEqual(ctx.calls.filter(c=>c.text==='abre'||c.text==='fecha').map(c=>c.text),['abre','fecha']);
 }
});
test('foto padrão é a mesma para o mesmo envio e varia entre envios',()=>{
 const ids=new Set();for(let i=0;i<60;i++){const it={id:'envio-'+i};assert.equal(defaultPhotoId(it),defaultPhotoId({...it}));assert.ok(PHOTOS.some(p=>p.id===defaultPhotoId(it)));ids.add(defaultPhotoId(it))}
 assert.ok(ids.size>=5,'usa várias fotos: '+ids.size);
});
