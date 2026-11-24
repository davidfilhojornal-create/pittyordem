import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
// Exercise the actual form and routing code with a DOM substitute; changing hash
// deliberately emits no event, so success must show the page explicitly.
const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace("import * as PM from '/position-map.js';",'').replace("import {openStoryCard} from '/story-card.js';",'').replace("import {initBackgroundAudio} from '/background-audio.js';",'').replace("import {createTurnstileGate} from '/turnstile.js';",'').replace('const turnstileGate=createTurnstileGate();',"const turnstileGate={token:()=>'',reset(){}};").split('async function loadResults()')[0];
class Element{constructor(){this.children=[];this.value='';this.checked=false;this.hidden=false;this.classList={toggle(){}}}replaceChildren(...v){this.children=v}append(...v){this.children.push(...v)}querySelector(){return new Element()}setAttribute(){}removeAttribute(){}}
function setup(reply,status=201,displayName='Ana Maria'){
 const nodes=new Map(),el=s=>{if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s)};
 const pages=['enviar','playlists','resultados'].map(id=>Object.assign(el('#'+id),{id,hidden:id!=='enviar'}));
 const requests=[],scrolls=[],stories=[];const context=vm.createContext({openStoryCard:async(item)=>{stories.push(item)},console,AbortController,CustomEvent:class{},dispatchEvent(){},location:{hash:'#enviar'},window:{addEventListener(){},scrollTo(options){scrolls.push(options);this.scrollY=options.top}},document:{querySelector:el,querySelectorAll:s=>s==='.page'?pages:[],createElement:()=>new Element(),createTextNode:s=>s},fetch:async(path,options)=>{requests.push({path,options});return path==='/api/submit'?new Response(JSON.stringify(reply),{status}):new Response(JSON.stringify({items:[{id:'saved',displayName,title:'Minha playlist',platform:'spotify',order:[],verifiedAt:new Date().toISOString()}],nextCursor:null}))}});
 vm.runInContext(source,context);el('#display-name').value='Ana Maria';el('#playlist-url').value='https://open.spotify.com/playlist/example';el('#consent').checked=true;
 return {el,context,requests,scrolls,stories,async send(){await el('#submission').onsubmit({preventDefault(){},target:{querySelector:()=>new Element()}});await new Promise(r=>setImmediate(r))}};
}
test('successful submit sends name, opens playlists without hash event, and renders saved name/platform',async()=>{
 const c=setup({accepted:true,submission:{id:'saved',displayName:'Ana Maria',platform:'spotify'},order:[],message:'Aceita'});await c.send();
 assert.equal(JSON.parse(c.requests[0].options.body).name,'Ana Maria');assert.equal(c.context.location.hash,'#playlists');assert.equal(c.el('#enviar').hidden,true);assert.equal(c.el('#playlists').hidden,false);
 assert.equal(c.requests.filter(r=>r.path==='/api/playlists').length,1);
 const card=c.el('#playlist-list').children[0],[,head,,foot]=card.children;assert.match(card.className,/setlist-card/);assert.equal(head.children[0].textContent,'Ana Maria');assert.equal(head.children[1].alt,'Spotify');assert.equal(head.children[1].src,'/plataformas/spotify.png');assert.equal(foot.children[0].children[0],'Spotify · ');assert.equal(c.el('#display-name').value,'');
});
test('duplicate navigates to playlists and explains unchanged original, without claiming name saved',async()=>{
 const c=setup({error:'Esta playlist já foi contabilizada.'},409);await c.send();assert.equal(c.el('#playlists').hidden,false);assert.match(c.el('#playlist-feedback').textContent,/sem alterar o nome/);assert.equal(c.el('#display-name').value,'Ana Maria');assert.equal(c.requests.filter(r=>r.path==='/api/submit').length,1);
});
test('old server response cannot silently report success or discard entered name',async()=>{
 const c=setup({accepted:true,message:'Aceita'});await c.send();assert.equal(c.context.location.hash,'#enviar');assert.match(c.el('#feedback').textContent,/não confirmou o nome/);assert.equal(c.el('#display-name').value,'Ana Maria');
});

test('switching tabs resets a previously scrolled page to the top, including results',async()=>{
 const c=setup({});c.context.loadResults=()=>{};c.context.window.scrollY=900;
 c.context.location.hash='#playlists';vm.runInContext('route()',c.context);await new Promise(r=>setImmediate(r));assert.equal(c.context.window.scrollY,0);assert.equal(c.el('#playlists').hidden,false);
 c.context.window.scrollY=700;c.context.location.hash='#resultados';vm.runInContext('route()',c.context);assert.equal(c.context.window.scrollY,0);assert.equal(c.el('#resultados').hidden,false);
 const calls=c.scrolls.length;vm.runInContext('route()',c.context);assert.equal(c.scrolls.length,calls);
});
test('legacy card is a muted anonymous participant and preserves metadata',async()=>{
 const c=setup({},201,null);c.context.location.hash='#playlists';vm.runInContext('route()',c.context);await new Promise(r=>setImmediate(r));
 const [,head,,foot]=c.el('#playlist-list').children[0].children;assert.equal(head.children[0].textContent,'Participante sem nome');assert.match(head.children[0].className,/participant-anonymous/);assert.equal(head.children[1].alt,'Spotify');assert.equal(foot.children[0].children.length,2);assert.equal(foot.children[1].className,'setlist-story');
});
test('insights render readable text titles with separate singular/plural counts',()=>{
 const c=setup({});c.context.renderMap=()=>{};
 const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 vm.runInContext(app.slice(app.indexOf('function countLabel('),app.indexOf("$('#export').onclick")),c.context);
 const tracks=[{key:'a',name:'Sobriedade Seletiva',positions:Array(13).fill(1)},{key:'b',name:'Álbum de Casamento',positions:Array(13).fill(1)}];
 vm.runInContext('catalog='+JSON.stringify(tracks)+';summary='+JSON.stringify({total:2,tracks,sequences:[{count:1,order:['a','b']},{count:2,order:['b','a']}],pairs:[{count:1,order:['a','b']},{count:2,order:['b','a']}]})+';renderSummary()',c.context);
 assert.equal(c.el('#pairs').children[0].children[1].textContent,'1 vez');assert.equal(c.el('#pairs').children[1].children[1].textContent,'2 vezes');
 assert.equal(c.el('#sequences').children[0].children[0].children[1].textContent,'1 playlist');assert.equal(c.el('#sequences').children[1].children[0].children[1].textContent,'2 playlists');
 assert.equal(c.el('#pairs').children[0].children[0].textContent,'Sobriedade Seletiva → Álbum de Casamento');
});

test('confirmed submission opens a story with the saved name, platform and exact returned order',async()=>{
 const order=Array.from({length:13},(_,i)=>'track-'+i);
 const c=setup({accepted:true,submission:{id:'saved',displayName:'Nome confirmado',platform:'deezer'},order,message:'Aceita'});
 await c.send();assert.equal(c.context.location.hash,'#playlists');assert.equal(c.stories.length,1);
 assert.equal(c.stories[0].displayName,'Nome confirmado');assert.equal(c.stories[0].platform,'deezer');assert.deepEqual(c.stories[0].order,order);
});
test('duplicate or rejected submission never automatically opens a story',async()=>{
 for(const status of [409,422]){const c=setup({error:'Não aceito'},status);await c.send();assert.equal(c.stories.length,0)}
});
test('story failure never turns a saved submission into a failed submission',async()=>{
 const c=setup({accepted:true,submission:{id:'saved',displayName:'Ana Maria',platform:'spotify'},order:[],message:'Aceita'});
 c.context.openStoryCard=async()=>{throw new Error('Canvas unavailable')};await c.send();
 assert.equal(c.context.location.hash,'#playlists');assert.match(c.el('#playlist-feedback').textContent,/Playlist salva/);assert.equal(c.el('#display-name').value,'');
});
