import catalog from '../server/catalog/pitty.json';
import {acceptedOrigin,apiCors,preflight} from '../server/frontend-origin.mjs';
const deploymentConfig="globalThis.PITTY_API_ORIGIN='';";
import {cachedResults,ensureAggregates} from '../server/aggregate-results.mjs';
import {turnstileConfig,verifyTurnstile} from '../server/turnstile.mjs';
import {displayName,platformFor,encodeCursor,decodeCursor} from '../server/submission-meta.mjs';
import {parsePlaylistLink} from '../server/recognition.mjs';
import {Rejection,validateOrder,readApple} from '../server/album-order.mjs';
import {readSpotify} from '../server/spotify.mjs';
import {readDeezer,deezerMode,deezerAllowed} from '../server/deezer.mjs';
import html from '../public/index.html';
import css from '../public/style.css';
const js=__CLIENT_JS__;
const mapJs=__MAP_JS__;
const motionJs=__MOTION_JS__;
const storyJs=__STORY_JS__;
const audioJs=__AUDIO_JS__;
const turnstileJs=__TURNSTILE_JS__;
import cover from '../public/cover.jpg';
import pittyLogo from '../public/pitty-logo.png';
import trackLettering from '../public/track-lettering.png';
import {fotos} from './fotos.js';
import {plataformas} from './plataformas.js';
import lacquer from '../public/fonts/lacquer.woff2';
import montserrat from '../public/fonts/montserrat.woff2';
import ibmPlex from '../public/fonts/ibm-plex-sans-medium.ttf';
const fonts={'/fonts/lacquer.woff2':lacquer,'/fonts/montserrat.woff2':montserrat};
import sourceArchive from '../public/codigo-fonte.zip';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
async function handle(request,env,ctx){try{
 const url=new URL(request.url),path=url.pathname;
 if(request.method==='GET'){
 if(path==='/codigo-fonte.zip')return new Response(sourceArchive,{headers:{...headers,'Content-Type':'application/zip','Content-Disposition':'attachment; filename=pitty-na-sua-ordem-codigo-aberto.zip','X-Content-Type-Options':'nosniff'}});
 if(path==='/')return new Response(html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; media-src 'self'; connect-src 'self' https://challenges.cloudflare.com; base-uri 'none'; frame-ancestors 'self' https://chatgpt.com; form-action 'self'"}});
 if(path==='/style.css')return new Response(css,{headers:{...headers,'Content-Type':'text/css'}});
 if(path==='/turnstile.js')return new Response(turnstileJs,{headers:{...headers,'Content-Type':'text/javascript'}});
 if(path==='/deployment-config.js')return new Response(deploymentConfig,{headers:{...headers,'Content-Type':'text/javascript'}});
 if(path==='/app.js')return new Response(js,{headers:{...headers,'Content-Type':'text/javascript'}});
 if(path==='/position-map.js')return new Response(mapJs,{headers:{...headers,'Content-Type':'text/javascript'}});
 if(path==='/background-audio.js')return new Response(audioJs,{headers:{...headers,'Content-Type':'text/javascript'}});
 if(path==='/story-card.js')return new Response(storyJs,{headers:{...headers,'Content-Type':'text/javascript'}});
 if(path==='/motion.js')return new Response(motionJs,{headers:{...headers,'Content-Type':'text/javascript'}});
 if(path==='/fonts/ibm-plex-sans-medium.ttf')return new Response(ibmPlex,{headers:{'Content-Type':'font/ttf','Cache-Control':'public,max-age=31536000,immutable'}});
 if(fonts[path])return new Response(fonts[path],{headers:{'Content-Type':'font/woff2','Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'}});
 if(path==='/track-lettering.png')return new Response(trackLettering,{headers:{'Content-Type':'image/png','Cache-Control':'public,max-age=3600'}});
 if(path==='/pitty-logo.png')return new Response(pittyLogo,{headers:{'Content-Type':'image/png','Cache-Control':'public,max-age=86400'}});
 if(fotos[path])return new Response(fotos[path],{headers:{'Content-Type':'image/jpeg','Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'}});
 if(plataformas[path])return new Response(plataformas[path],{headers:{'Content-Type':'image/png','Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'}});
 if(path==='/cover.jpg')return new Response(cover,{headers:{'Content-Type':'image/jpeg','Cache-Control':'public,max-age=86400'}});
 if(path==='/api/catalog')return json({album:catalog.album,tracks:catalog.tracks.map(t=>({key:t.key,name:t.name})),providers:{apple:true,spotify:true,deezer:deezerMode(env)==='on'},security:turnstileConfig(env)});
 if(path==='/api/results'){
 return await cachedResults(request,env,ctx,catalog)}
 if(path==='/api/playlists'){
 const cursor=decodeCursor(url.searchParams.get('cursor'));
 const select='SELECT id,playlist_key,playlist_url,title,display_name,platform,order_json,verified_at FROM submissions';
 const query=cursor?env.DB.prepare(select+' WHERE (verified_at,id) < (?,?) ORDER BY verified_at DESC,id DESC LIMIT 13').bind(cursor[0],cursor[1]):env.DB.prepare(select+' ORDER BY verified_at DESC,id DESC LIMIT 13');
 const {results}=await query.all();const items=results.slice(0,12);
 return json({items:items.map(r=>({id:r.id,url:r.playlist_url,title:r.title,displayName:r.display_name||null,platform:platformFor(r),order:JSON.parse(r.order_json),verifiedAt:r.verified_at})),nextCursor:results.length>12?encodeCursor(items.at(-1)):null})}

 }
 if(['/api/submit','/api/verify'].includes(path)&&request.method==='POST'){
 const origin=acceptedOrigin(request,env);
 if(!origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Envio não autorizado.'},403);
 if(Number(request.headers.get('Content-Length')||0)>8192)return json({error:'Envio muito grande.'},413);
 const text=await request.text();if(text.length>8192)return json({error:'Envio muito grande.'},413);
 let body;try{body=JSON.parse(text)}catch{return json({error:'Envio inválido.'},400)}
 if(body.consent!==true)return json({error:'Confirme a publicação da sua playlist e da ordem das faixas.'},400);
 const sender=path==='/api/submit'?displayName(body.name):null;
 const deezer=deezerMode(env);
 let playlist;try{playlist=parsePlaylistLink(body.url)}catch{
 let host='';try{host=new URL(String(body.url).trim()).hostname}catch{}
 if(deezer!=='off'&&['link.deezer.com','deezer.page.link'].includes(host))return json({error:'Links curtos da Deezer não são aceitos. Abra o link, copie o endereço completo da playlist (deezer.com/…/playlist/…) e envie de novo.'},400);
 return json({error:deezer==='on'?'Envie o link completo de uma playlist pública do Spotify, Apple Music ou Deezer.':'Envie o link completo de uma playlist pública do Spotify ou Apple Music.'},400)}
 if(playlist.provider==='deezer'&&!deezerAllowed(deezer,path))return json({error:deezer==='verify'?'A Deezer está em fase de testes e ainda não entra na contagem. Use Spotify ou Apple Music.':'Não conseguimos verificar playlists da Deezer neste momento. Use Spotify ou Apple Music.'},422);
 if(!['apple','spotify','deezer'].includes(playlist.provider))return json({error:'Plataforma não suportada.'},422);
 await verifyTurnstile(request,body,env,fetch,new URL(origin).hostname);
 const existing=await env.DB.prepare('SELECT id FROM submissions WHERE playlist_key=?').bind(playlist.key).first();if(existing&&path==='/api/submit')return json({error:'Esta playlist já foi contabilizada. O total não foi alterado.'},409);
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';const bucket=Math.floor(Date.now()/3600000);
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+':'+url.host+':'+bucket));const rateKey=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
 const rate=await env.DB.prepare('INSERT INTO request_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(rateKey,Date.now()+3600000).first();
 if(rate.count>30)return json({error:'Muitas tentativas nesta hora. Aguarde antes de enviar novamente.'},429);
 const page=await (playlist.provider==='spotify'?readSpotify(playlist):playlist.provider==='deezer'?readDeezer(playlist):readApple(playlist));const order=validateOrder(page.items,catalog,playlist.provider);
 if(path==='/api/verify')return json({valid:true,title:page.title,order,alreadySubmitted:!!existing});
 const canonical=playlist.provider==='spotify'?`https://open.spotify.com/playlist/${playlist.id}`:playlist.provider==='deezer'?`https://www.deezer.com/playlist/${playlist.id}`:`https://music.apple.com/${playlist.storefront}/playlist/playlist/${playlist.id}`;
 await ensureAggregates(env.DB);
 const submissionId=crypto.randomUUID();
 const inserted=await env.DB.batch([
 env.DB.prepare('INSERT INTO submissions (id,playlist_key,playlist_url,title,display_name,platform,order_json,verified_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(playlist_key) DO NOTHING').bind(submissionId,playlist.key,canonical,page.title,sender,playlist.provider,JSON.stringify(order),new Date().toISOString()),
 env.DB.prepare('DELETE FROM request_limits WHERE key IN (SELECT key FROM request_limits WHERE expires_at < ? ORDER BY expires_at LIMIT 20)').bind(Date.now())]);
 if(!inserted[0].meta.changes)return json({error:'Esta playlist já foi contabilizada. O total não foi alterado.'},409);
 return json({accepted:true,submission:{id:submissionId,displayName:sender,platform:playlist.provider},order,title:page.title,message:'Playlist aceita! As 13 posições foram contabilizadas.'},201);
 }
 return json({error:'Página não encontrada.'},404);
 }catch(e){if(e instanceof Rejection)return json({error:e.message,...e.details},e.status);console.error('Request failed',e?.message);return json({error:'Não foi possível concluir a operação. Atualize os resultados antes de tentar novamente.'},503)}}
export default {async fetch(request,env,ctx){
 const api=new URL(request.url).pathname.startsWith('/api/');
 if(api&&request.method==='OPTIONS')return preflight(request,env);
 const response=await handle(request,env,ctx);return api?apiCors(request,env,response):response;
}};
