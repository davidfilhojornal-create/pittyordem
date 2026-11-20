import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const origin=new URL(process.env.PUBLIC_API_ORIGIN||'https://pitty-na-sua-ordem.david-filhojornal.workers.dev');
if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('PUBLIC_API_ORIGIN must be an HTTPS origin without a path');
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));const policy=config.headers.flatMap(x=>x.headers).find(h=>h.key==='Content-Security-Policy')?.value||'';if(!policy.includes(origin.origin))throw new Error('Update connect-src in vercel.json to allow PUBLIC_API_ORIGIN');
const out='dist-vercel';fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const files=['app.js','position-map.js','story-card.js','background-audio.js','turnstile.js','motion.js','style.css','cover.jpg','pitty-logo.png','track-lettering.png'];
for(const name of files)fs.copyFileSync('public/'+name,path.join(out,name));
for(const name of ['fonts','fotos','plataformas'])if(fs.existsSync('public/'+name))fs.cpSync('public/'+name,path.join(out,name),{recursive:true});
const media='media/audio';const manifest=JSON.parse(fs.readFileSync(media+'/manifest.json','utf8'));
if(manifest.tracks?.length!==13||new Set(manifest.tracks.map(t=>t.key)).size!==13)throw new Error('The frontend requires the 13 prepared clips');
for(const t of manifest.tracks){if(!/^\/audio\/\d{2}\.mp3$/.test(t.src))throw new Error('Unexpected audio path');const file=path.join(media,path.basename(t.src));if(!fs.existsSync(file)||fs.statSync(file).size!==t.bytes)throw new Error('Missing or changed clip: '+t.src);if(!(t.duration>=29&&t.duration<=31))throw new Error('Only 30-second prepared clips belong in media/audio');}
fs.cpSync(media,out+'/audio',{recursive:true});
const revision=createHash('sha256').update(files.map(n=>fs.readFileSync('public/'+n)).join('')).update(origin.origin).digest('hex').slice(0,16);
const html=fs.readFileSync('public/index.html','utf8').replace(/(\/(?:deployment-config\.js|app\.js|motion\.js|style\.css))(?=")/g,'$1?v='+revision);
fs.writeFileSync(out+'/index.html',html);fs.writeFileSync(out+'/deployment-config.js','globalThis.PITTY_API_ORIGIN='+JSON.stringify(origin.origin)+';\n');
console.log('Built static Vercel frontend with all 13 clips. API:',origin.origin);
