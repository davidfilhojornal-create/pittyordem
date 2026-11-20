// Prepara os trechos de 30 s (refrão) de cada faixa para o player do site.
// Lê os MP3s originais da pasta "musicas", corta cada um a partir do início indicado em scripts/refroes.json
// e grava só os trechos em public/audio-assets/audio. Os originais nunca são alterados nem publicados.
// O corte é feito quadro a quadro no próprio MP3, sem FFmpeg nem Python.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const CLIP_SECONDS=30;
export const MAX_CLIP_SECONDS=31;

const BITRATES={
 1:[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320],   // MPEG-1 Layer III
 2:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160]        // MPEG-2/2.5 Layer III
};
const RATES={3:[44100,48000,32000],2:[22050,24000,16000],0:[11025,12000,8000]};

function id3Size(buf){
 if(buf.length<10||buf.toString('latin1',0,3)!=='ID3')return 0;
 const size=(buf[6]&127)<<21|(buf[7]&127)<<14|(buf[8]&127)<<7|(buf[9]&127);
 return 10+size+((buf[5]&0x10)?10:0);
}
function header(buf,i){
 if(i+4>buf.length||buf[i]!==0xFF||(buf[i+1]&0xE0)!==0xE0)return null;
 const version=(buf[i+1]>>3)&3,layer=(buf[i+1]>>1)&3,bIdx=buf[i+2]>>4,sIdx=(buf[i+2]>>2)&3,pad=(buf[i+2]>>1)&1;
 if(version===1||layer!==1||bIdx===0||bIdx===15||sIdx===3)return null;   // só Layer III válido
 const mpeg1=version===3,bitrate=BITRATES[mpeg1?1:2][bIdx]*1000,rate=RATES[version][sIdx];
 const length=Math.floor((mpeg1?144:72)*bitrate/rate)+pad,samples=mpeg1?1152:576;
 return length>4?{length,seconds:samples/rate}:null;
}
// Lista os quadros de áudio do MP3, ignorando etiquetas e o quadro de informação (Xing/Info/VBRI),
// que descreveria a duração da música inteira.
export function mp3Frames(buf){
 const frames=[];let i=id3Size(buf),time=0;
 while(i<buf.length-4){
  const h=header(buf,i);
  if(!h||i+h.length>buf.length){i++;continue}
  const next=header(buf,i+h.length);
  if(!next&&i+h.length<buf.length-4&&frames.length===0){i++;continue}   // falso sincronismo no começo
  const body=buf.toString('latin1',i+4,Math.min(i+h.length,i+64));
  if(!(frames.length===0&&/Xing|Info|VBRI/.test(body)))frames.push({offset:i,length:h.length,start:time,seconds:h.seconds}),time+=h.seconds;
  i+=h.length;
 }
 return {frames,duration:time};
}
export function cutMp3(buf,startSeconds,seconds=CLIP_SECONDS){
 const {frames,duration}=mp3Frames(buf);
 if(frames.length<100)throw new Error('não parece um MP3 válido');
 if(!(startSeconds>=0)||startSeconds+seconds>duration+0.05)throw new Error(`o trecho começa em ${startSeconds}s, mas a faixa tem ${duration.toFixed(1)}s`);
 const chosen=frames.filter(f=>f.start>=startSeconds&&f.start+f.seconds<=startSeconds+seconds+1e-6);
 const clip=Buffer.concat(chosen.map(f=>buf.subarray(f.offset,f.offset+f.length)));
 return {clip,seconds:chosen.reduce((s,f)=>s+f.seconds,0)};
}
export function loadClipStarts(file=path.join(root,'scripts/refroes.json')){
 const data=JSON.parse(fs.readFileSync(file,'utf8')),starts=new Map();
 for(const f of data.faixas){if(!Number.isInteger(f.numero)||!(f.inicio_segundos>=0))throw new Error('refroes.json tem um início inválido na faixa '+f.numero);starts.set(f.numero,f.inicio_segundos)}
 return starts;
}
export function prepareAudio(sourceDir=path.join(root,'musicas'),outputDir=path.join(root,'public/audio-assets/audio'),starts=loadClipStarts()){
 const catalog=JSON.parse(fs.readFileSync(path.join(root,'server/catalog/pitty.json'),'utf8')).tracks;
 if(!fs.existsSync(sourceDir))throw new Error('A pasta musicas não existe. Crie essa pasta e copie os 13 MP3s para ela.');
 const files=fs.readdirSync(sourceDir).filter(n=>n.toLowerCase().endsWith('.mp3')),byNumber=new Map();
 for(const name of files){const match=/^(\d{1,2})[\s._-]/.exec(name);if(!match)continue;const n=Number(match[1]);if(n<1||n>13)continue;if(byNumber.has(n))throw new Error(`Há dois arquivos com o número ${n}. Deixe apenas um para cada faixa.`);byNumber.set(n,name)}
 const missing=catalog.map((t,i)=>({number:i+1,name:t.name})).filter(t=>!byNumber.has(t.number));
 if(missing.length)throw new Error('Faltam estes arquivos na pasta musicas:\n'+missing.map(t=>`${String(t.number).padStart(2,'0')} ${t.name}.mp3`).join('\n'));
 // Corta tudo na memória primeiro: se uma faixa falhar, nada é gravado.
 const clips=[];
 for(let n=1;n<=catalog.length;n++){
  const name=byNumber.get(n),start=starts.get(n);
  if(start===undefined)throw new Error(`Falta o início do refrão da faixa ${n} em scripts/refroes.json.`);
  const buf=fs.readFileSync(path.join(sourceDir,name));
  if(buf.length===0)throw new Error('Arquivo vazio: '+name);
  let cut;try{cut=cutMp3(buf,start)}catch(e){throw new Error(`Não foi possível cortar "${name}": ${e.message}.`)}
  if(cut.seconds>MAX_CLIP_SECONDS||cut.seconds<CLIP_SECONDS-1)throw new Error(`O trecho de "${name}" ficou com ${cut.seconds.toFixed(1)}s; o esperado é ${CLIP_SECONDS}s.`);
  clips.push({n,cut,start});
 }
 fs.mkdirSync(outputDir,{recursive:true});const tracks=[];
 for(const {n,cut,start} of clips){
  const filename=String(n).padStart(2,'0')+'.mp3',destination=path.join(outputDir,filename);
  fs.writeFileSync(destination,cut.clip);
  tracks.push({key:catalog[n-1].key,name:catalog[n-1].name,position:n,src:'/audio/'+filename,bytes:cut.clip.length,start,duration:Math.round(cut.seconds*10)/10});
 }
 fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify({album:'Pitty',clipSeconds:CLIP_SECONDS,tracks,missing:[]},null,2)+'\n');
 return tracks;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const tracks=prepareAudio(process.argv[2]?path.resolve(process.argv[2]):undefined);console.log(`Pronto! ${tracks.length} trechos de ${CLIP_SECONDS} segundos (refrão) foram preparados. Seus MP3s originais não foram alterados nem copiados.\nPara mudar onde um trecho começa, edite scripts/refroes.json e rode de novo.\nAgora publique com:\nnpm ci\nnpm run build:cloudflare\nnpx wrangler deploy --assets ./public/audio-assets`)}catch(e){console.error('\n'+e.message+'\n');process.exitCode=1}
}
