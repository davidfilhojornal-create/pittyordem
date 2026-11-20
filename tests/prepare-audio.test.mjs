import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {prepareAudio,cutMp3,mp3Frames,loadClipStarts,CLIP_SECONDS} from '../scripts/preparar-audio.mjs';

// MP3 sintético: quadros MPEG-1 Layer III de 128 kbps / 44,1 kHz (417 bytes, 1152 amostras cada).
const FRAME_SECONDS=1152/44100;
function fakeMp3(seconds,{id3=true,xing=true,mark=0}={}){
 const frames=[];const count=Math.ceil(seconds/FRAME_SECONDS);
 for(let i=0;i<count+(xing?1:0);i++){const f=Buffer.alloc(417);f[0]=0xFF;f[1]=0xFB;f[2]=0x90;f[3]=0x00;if(xing&&i===0)f.write('Xing',36,'latin1');else f.writeUInt32BE((mark<<16)|(i-(xing?1:0)),8);frames.push(f)}
 const tag=id3?Buffer.concat([Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x0a','latin1'),Buffer.alloc(10)]):Buffer.alloc(0);
 return Buffer.concat([tag,...frames]);
}
const frameIndex=(clip,k)=>clip.readUInt32BE(k*417+8)&0xFFFF;
const starts=new Map(Array.from({length:13},(_,i)=>[i+1,5+i]));
function fixture(t,count=13,seconds=50){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pitty-audio-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'musicas'),output=path.join(dir,'audio');fs.mkdirSync(source);
 for(let i=1;i<=count;i++)fs.writeFileSync(path.join(source,String(i).padStart(2,'0')+' Música com acentuação.mp3'),fakeMp3(seconds,{mark:i}));
 return {source,output};
}

test('lê os quadros ignorando a etiqueta ID3 e o quadro Xing (que traz a duração da música inteira)',()=>{
 const {frames,duration}=mp3Frames(fakeMp3(10));
 assert.ok(Math.abs(duration-10)<0.05);assert.equal(frameIndex(Buffer.concat([fakeMp3(10).subarray(frames[0].offset,frames[0].offset+417)]),0),0);
});

test('corta exatamente 30 s a partir do início pedido, sem re-encodar',()=>{
 const buf=fakeMp3(120),{clip,seconds}=cutMp3(buf,40);
 assert.ok(seconds<=CLIP_SECONDS&&seconds>CLIP_SECONDS-FRAME_SECONDS*2,String(seconds));
 assert.equal(clip.length%417,0);
 const first=frameIndex(clip,0);assert.ok(Math.abs(first*FRAME_SECONDS-40)<FRAME_SECONDS*1.01,String(first));
 assert.ok(Math.abs(mp3Frames(clip).duration-seconds)<1e-6);
});

test('recusa trecho que passaria do fim da faixa e arquivos que não são MP3',()=>{
 assert.throws(()=>cutMp3(fakeMp3(40),20),/a faixa tem/);
 assert.throws(()=>cutMp3(Buffer.from('isto não é áudio'),0),/MP3 válido/);
});

test('preparador gera 13 trechos de 30 s na ordem do disco, com manifest, sem tocar nos originais',t=>{
 const {source,output}=fixture(t),before=fs.readFileSync(path.join(source,'09 Música com acentuação.mp3'));
 const tracks=prepareAudio(source,output,starts);
 assert.equal(tracks.length,13);assert.equal(tracks[8].name,'Madame');
 for(const tr of tracks){const clip=fs.readFileSync(path.join(output,String(tr.position).padStart(2,'0')+'.mp3'));assert.ok(mp3Frames(clip).duration<=31);assert.equal(tr.duration,30);assert.equal(tr.start,starts.get(tr.position));assert.equal(clip.readUInt32BE(8)>>>16,tr.position)}
 assert.deepEqual(fs.readFileSync(path.join(source,'09 Música com acentuação.mp3')),before);
 const manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.json')));assert.equal(manifest.tracks.length,13);assert.equal(manifest.clipSeconds,30);
});

test('música faltando é avisada antes de gravar qualquer arquivo',t=>{const {source,output}=fixture(t,12);assert.throws(()=>prepareAudio(source,output,starts),/13 Nó/);assert.equal(fs.existsSync(output),false)});
test('números repetidos são recusados em vez de escolher um arquivo às cegas',t=>{const {source,output}=fixture(t);fs.writeFileSync(path.join(source,'01 Outra.mp3'),fakeMp3(50));assert.throws(()=>prepareAudio(source,output,starts),/dois arquivos/);assert.equal(fs.existsSync(output),false)});
test('faixa curta demais para o trecho pedido não grava nada',t=>{const {source,output}=fixture(t,13,20);assert.throws(()=>prepareAudio(source,output,starts),/Não foi possível cortar/);assert.equal(fs.existsSync(output),false)});
test('refroes.json do projeto tem um início para cada uma das 13 faixas',()=>{const s=loadClipStarts();assert.equal(s.size,13);for(let n=1;n<=13;n++)assert.ok(s.get(n)>=0)});
