// Offline integration check: synthetic database + mocked music page and Turnstile.
import fs from 'node:fs';import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';import {fixture,insert} from '../tests/d1-fixture.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../server/catalog/pitty.json',import.meta.url))),order=catalog.tracks.map(t=>t.key);
const backend='https://backend.workers.dev',frontend='https://frontend.example.com';
const f=fixture({beforeMigration:r=>insert(r,order,'existing')});const env={DB:f.db,DEEZER_MODE:'on',TURNSTILE_SITE_KEY:'public',TURNSTILE_SECRET_KEY:'test-secret',FRONTEND_ORIGINS:frontend};
function request(path,{method='GET',origin=frontend,body,ip='192.0.2.1'}={}){return new Request(backend+path,{method,headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':ip},...(body?{body:JSON.stringify(body)}:{})})}
const payload=id=>({name:'Pessoa de teste',consent:true,url:'https://music.apple.com/br/playlist/test/pl.u-'+id,turnstileToken:'valid'});
let fetchCalls=0;const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{fetchCalls++;if(String(url).includes('siteverify'))return Response.json({success:true,hostname:frontend.slice(8),action:'playlist_submit'});
 const id=new URL(url).pathname.split('/').at(-1),items=catalog.tracks.map(t=>({title:t.name,contentDescriptor:{kind:'song',identifiers:{storeAdamID:t.ids.apple}}}));
 return new Response('<script id="serialized-server-data" type="application/json">'+JSON.stringify({data:[{data:{sections:[{items:[{title:'Minha playlist',trackCount:13,contentDescriptor:{kind:'playlist',identifiers:{storeAdamID:id}}}]},{itemKind:'trackLockup',containerContentDescriptor:{identifiers:{storeAdamID:id}},items}]}}]})+'</script>');
};
try{
 let r=await worker.fetch(new Request(backend+'/api/submit',{method:'OPTIONS',headers:{Origin:frontend,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}}),env);assert.equal(r.status,204);
 r=await worker.fetch(request('/api/submit',{method:'POST',origin:'https://evil.vercel.app',body:payload('blocked')}),env);assert.equal(r.status,403);assert.equal(fetchCalls,0);
 for(const [id,ip] of [['first','192.0.2.1'],['second','192.0.2.2']]){r=await worker.fetch(request('/api/submit',{method:'POST',body:payload(id),ip}),env);assert.equal(r.status,201);assert.equal(r.headers.get('Access-Control-Allow-Origin'),frontend)}
 assert.equal(f.raw.prepare('SELECT COUNT(*) n FROM request_limits').get().n,2);
 r=await worker.fetch(request('/api/submit',{method:'POST',body:payload('first')}),env);assert.equal(r.status,409);
 r=await worker.fetch(request('/api/results'),env);assert.equal(r.status,200);const results=await r.json();assert.equal(results.total,3);assert.ok(results.tracks.every(t=>t.positions.reduce((a,b)=>a+b)===3));
 r=await worker.fetch(request('/api/catalog',{origin:backend}),env);assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),backend);
 console.log('Hybrid integration OK: approved frontend, CORS preflight, Turnstile hostname, separate visitor limits, atomic counters and existing data preserved. No live services contacted.');
}finally{globalThis.fetch=originalFetch}
