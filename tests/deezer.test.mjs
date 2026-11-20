import {test} from 'node:test';import assert from 'node:assert/strict';
import catalog from '../server/catalog/pitty.json' with {type:'json'};
import {readDeezer,deezerMode,deezerAllowed} from '../server/deezer.mjs';
import {validateOrder} from '../server/album-order.mjs';
import {parsePlaylistLink} from '../server/recognition.mjs';

const ID='15975809523';
const albumTracks=catalog.tracks.map(t=>({id:Number(t.ids.deezer),title:t.name,type:'track'}));
const meta=(over={})=>({id:Number(ID),type:'playlist',title:'Pitty',public:true,nb_tracks:13,...over});
// Fake API: answers like api.deezer.com, honoring index/limit, and records each URL asked.
function fakeApi({metaBody=meta(),tracks=albumTracks,total,pages,status=200,raw}={}){
 const calls=[];
 const fetcher=async url=>{calls.push(url);const u=new URL(url);
  if(raw)return new Response(raw,{status});
  if(status!==200)return new Response('{}',{status});
  if(u.pathname===`/playlist/${ID}`)return Response.json(metaBody);
  if(u.pathname===`/playlist/${ID}/tracks`){const i=+u.searchParams.get('index'),l=+u.searchParams.get('limit');
   const pageIndex=calls.filter(c=>c.includes('/tracks')).length-1;
   if(pages)assert.equal(i,pages.slice(0,pageIndex).reduce((n,p)=>n+p.length,0),'page offset must match received items');
   const data=pages?pages[pageIndex]??[]:tracks.slice(i,i+l);
   return Response.json({data,total:total??tracks.length})}
  return new Response('not found',{status:404})};
 return {fetcher,calls};
};
const read=api=>readDeezer({provider:'deezer',id:ID},api.fetcher);

test('links da Deezer reconhecidos, com e sem região',()=>{
 assert.equal(parsePlaylistLink('https://www.deezer.com/br/playlist/'+ID).key,'deezer:'+ID);
 assert.equal(parsePlaylistLink('https://www.deezer.com/playlist/'+ID+'?utm=x').key,'deezer:'+ID);
 assert.throws(()=>parsePlaylistLink('https://link.deezer.com/s/abc'));
});

test('catálogo tem 13 IDs Deezer únicos',()=>{
 const ids=catalog.tracks.map(t=>t.ids.deezer);assert.equal(new Set(ids).size,13);assert.ok(ids.every(i=>/^\d+$/.test(i)));
});

test('playlist completa é lida, mantém a ordem e passa na validação estrita',async()=>{
 const page=await read(fakeApi());assert.equal(page.items.length,13);assert.equal(page.title,'Pitty');
 assert.deepEqual(validateOrder(page.items,catalog,'deezer'),catalog.tracks.map(t=>t.key));
 const reversed=[...albumTracks].reverse();
 const p2=await read(fakeApi({tracks:reversed}));
 assert.deepEqual(validateOrder(p2.items,catalog,'deezer'),catalog.tracks.map(t=>t.key).reverse());
});

test('paginação: junta páginas na ordem e confere o total',async()=>{
 const api=fakeApi({pages:[albumTracks.slice(0,6),albumTracks.slice(6)],total:13});
 const page=await read(api);
 assert.deepEqual(page.items.map(i=>i.id),albumTracks.map(t=>String(t.id)));
 assert.equal(api.calls.filter(c=>c.includes('/tracks')).length,2);
});

test('lista parcial nunca vira envio (página vazia antes do total)',async()=>{
 await assert.rejects(()=>read(fakeApi({pages:[albumTracks.slice(0,6),[]],total:13})),/incompleta/);
});

test('total declarado diferente do recebido é recusado',async()=>{
 await assert.rejects(()=>read(fakeApi({total:14})),/mudou/);
 await assert.rejects(()=>read(fakeApi({metaBody:meta({nb_tracks:12})})),/12 faixas/);
 await assert.rejects(()=>read(fakeApi({tracks:[...albumTracks,albumTracks[0]],total:13})),e=>e.status===422);
 await assert.rejects(()=>read(fakeApi({metaBody:meta({nb_tracks:'13'})})),/confirmar o total/);
});

test('faixa repetida, extra ou ausente recusada pela validação por ID (não por nome)',async()=>{
 const repeated=[...albumTracks.slice(0,12),albumTracks[0]];
 const p=await read(fakeApi({tracks:repeated}));
 assert.throws(()=>validateOrder(p.items,catalog,'deezer'),e=>e.details.repeated.length===1&&e.details.missing.length===1);
 const sameNameOtherId=[{...albumTracks[0],id:999999999},...albumTracks.slice(1)];
 const p2=await read(fakeApi({tracks:sameNameOtherId}));
 assert.throws(()=>validateOrder(p2.items,catalog,'deezer'),e=>e.details.extra.length===1);
});

test('erros e falhas de leitura nunca viram lista vazia',async()=>{
 await assert.rejects(()=>read(fakeApi({metaBody:{error:{type:'DataException',message:'no data',code:800}}})),e=>e.status===422);
 await assert.rejects(()=>read(fakeApi({metaBody:{error:{type:'Exception',message:'Quota limit exceeded',code:4}}})),e=>e.status===503);
 await assert.rejects(()=>read(fakeApi({metaBody:{error:{type:'OAuthException',message:'token',code:300}}})),/autenticação/);
 await assert.rejects(()=>read(fakeApi({metaBody:meta({public:false})})),/pública/);
 await assert.rejects(()=>read(fakeApi({metaBody:meta({id:123})})),/não retornou a playlist/);
 await assert.rejects(()=>read(fakeApi({status:500})),e=>e.status===422);
 await assert.rejects(()=>read(fakeApi({status:403})),e=>e.status===422);
 await assert.rejects(()=>read(fakeApi({raw:'<html>bloqueado</html>'})),e=>e.status===503);
 await assert.rejects(()=>readDeezer({provider:'deezer',id:ID},async()=>{throw new Error('network')}),e=>e.status===503);
 await assert.rejects(()=>readDeezer({provider:'deezer',id:ID},async()=>new Response('',{status:302,headers:{Location:'https://evil.example'}})),e=>e.status===503);
 await assert.rejects(()=>read(fakeApi({tracks:[{id:1,type:'podcast'},...albumTracks.slice(1)]})),/não é uma faixa/);
});

test('chave de modo: off por padrão, verify só no /api/verify, on libera tudo',()=>{
 assert.equal(deezerMode({}),'off');assert.equal(deezerMode({DEEZER_MODE:'algo'}),'off');assert.equal(deezerMode({DEEZER_MODE:' Verify '}),'verify');
 assert.equal(deezerAllowed('off','/api/verify'),false);assert.equal(deezerAllowed('off','/api/submit'),false);
 assert.equal(deezerAllowed('verify','/api/verify'),true);assert.equal(deezerAllowed('verify','/api/submit'),false);
 assert.equal(deezerAllowed('on','/api/submit'),true);
});

test('server capped page size: reads offsets 0,6,12 without skipping songs',async()=>{
 const indexes=[];
 const page=await readDeezer({id:ID},async url=>{
  const u=new URL(url);if(!u.pathname.endsWith('/tracks'))return Response.json(meta());
  const offset=Number(u.searchParams.get('index'));indexes.push(offset);
  return Response.json({data:albumTracks.slice(offset,offset+6),total:13});
 });
 assert.deepEqual(indexes,[0,6,12]);
 assert.deepEqual(validateOrder(page.items,catalog,'deezer'),catalog.tracks.map(t=>t.key));
});
