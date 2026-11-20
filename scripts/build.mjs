import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';import {mp3Frames,MAX_CLIP_SECONDS} from './preparar-audio.mjs';
import fs from 'node:fs';import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';
execFileSync('python3',['scripts/export-source.py'],{stdio:'inherit'});
// Trava: o site só pode publicar trechos de até 31 s. Se uma música inteira voltar para a pasta de áudio, o build para.
const audioDir='public/audio-assets/audio';
if(fs.existsSync('media/audio'))fs.cpSync('media/audio',audioDir,{recursive:true});
if(fs.existsSync(audioDir))for(const name of fs.readdirSync(audioDir).filter(n=>n.toLowerCase().endsWith('.mp3'))){
 const seconds=mp3Frames(fs.readFileSync(audioDir+'/'+name)).duration;
 if(seconds>MAX_CLIP_SECONDS)throw new Error(`${audioDir}/${name} tem ${Math.round(seconds)} s. O site só publica trechos de 30 s do refrão: rode PREPARAR-AUDIO.bat (ou node scripts/preparar-audio.mjs) em vez de copiar as músicas inteiras.`);
}
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
const revision=createHash('sha256').update(['public/app.js','public/position-map.js','public/motion.js','public/story-card.js','public/background-audio.js','public/turnstile.js','public/style.css'].map(p=>fs.readFileSync(p)).join('')).digest('hex').slice(0,16);
const versionedHtml=fs.readFileSync('public/index.html','utf8').replace(/(\/(?:app\.js|motion\.js|style\.css))(?=")/g,'$1?v='+revision);
await build({plugins:[{name:'versioned-html',setup(b){b.onLoad({filter:/public\/index\.html$/},()=>({contents:versionedHtml,loader:'text'}))}}],entryPoints:['worker/index.js'],outfile:'dist/server/index.js',bundle:true,define:{__CLIENT_JS__:JSON.stringify(fs.readFileSync('public/app.js','utf8')),__MAP_JS__:JSON.stringify(fs.readFileSync('public/position-map.js','utf8')),__TURNSTILE_JS__:JSON.stringify(fs.readFileSync('public/turnstile.js','utf8')),__AUDIO_JS__:JSON.stringify(fs.readFileSync('public/background-audio.js','utf8')),__STORY_JS__:JSON.stringify(fs.readFileSync('public/story-card.js','utf8')),__MOTION_JS__:JSON.stringify(fs.readFileSync('public/motion.js','utf8'))},format:'esm',target:'es2022',platform:'browser',loader:{'.html':'text','.css':'text','.jpg':'binary','.png':'binary','.zip':'binary','.woff2':'binary','.ttf':'binary'}});
const workerBytes=fs.statSync('dist/server/index.js').size;
if(workerBytes>8*1024*1024)throw new Error('O Worker ficou maior que 8 MiB. Verifique se músicas ou outros arquivos grandes entraram no pacote de código. Publique áudio separadamente com --assets.');
const gzipBytes=gzipSync(fs.readFileSync('dist/server/index.js')).length;
if(gzipBytes>3*1024*1024)throw new Error('O Worker comprimido ultrapassou 3 MiB, limite do plano gratuito. Mova arquivos grandes para os assets antes de publicar.');
console.log('Worker gzip: '+(gzipBytes/1024/1024).toFixed(2)+' MiB');
console.log('Worker size: '+(workerBytes/1024/1024).toFixed(2)+' MiB (audio must remain in static assets)');
if(fs.existsSync('.openai/hosting.json'))fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');fs.cpSync('drizzle','dist/drizzle',{recursive:true});
console.log('Built worker with embedded assets and migrations');

// Static requests are served by Workers Assets rather than invoking the Worker.
// Keep the prepared audio directory; refresh only known code, image and font assets.
const assets='public/audio-assets';fs.mkdirSync(assets,{recursive:true});
for(const name of ['deployment-config.js','app.js','position-map.js','story-card.js','background-audio.js','turnstile.js','motion.js','style.css','cover.jpg','pitty-logo.png','track-lettering.png','codigo-fonte.zip'])fs.copyFileSync('public/'+name,assets+'/'+name);
for(const name of ['fonts','fotos','plataformas'])if(fs.existsSync('public/'+name))fs.cpSync('public/'+name,assets+'/'+name,{recursive:true});
fs.writeFileSync(assets+'/_headers','/*\n  X-Content-Type-Options: nosniff\n/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n/codigo-fonte.zip\n  Content-Disposition: attachment; filename="pitty-na-sua-ordem-codigo-aberto.zip"\n');
console.log('Prepared static files and preserved audio for --assets ./public/audio-assets');
