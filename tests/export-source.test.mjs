import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
test('source download excludes local original audio and prepared assets, while retaining preparation instructions',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pitty-export-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const dir of ['scripts','public/audio-assets/audio','musicas','server','worker'])fs.mkdirSync(path.join(root,dir),{recursive:true});
 fs.copyFileSync(new URL('../scripts/export-source.py',import.meta.url),path.join(root,'scripts/export-source.py'));
 for(const name of ['musicas/01 Sobremesa.mp3','public/accidental.MP3','public/audio-assets/audio/01.mp3','server/test.wav'])fs.writeFileSync(path.join(root,name),Buffer.alloc(100000));
 fs.writeFileSync(path.join(root,'wrangler.jsonc'),'{}');fs.writeFileSync(path.join(root,'musicas/LEIA-ME.txt'),'instructions');fs.writeFileSync(path.join(root,'worker/index.js'),'code');
 execFileSync('python3',[path.join(root,'scripts/export-source.py')]);
 const out=execFileSync('python3',['-c',"import sys,zipfile,json; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps(z.namelist()))",path.join(root,'public/codigo-fonte.zip')],{encoding:'utf8'});
 const names=JSON.parse(out);assert.ok(names.some(n=>n.endsWith('wrangler.modelo.jsonc')));assert.ok(!names.some(n=>n.endsWith('/wrangler.jsonc')));assert.ok(names.some(n=>n.endsWith('musicas/LEIA-ME.txt')));assert.ok(names.some(n=>n.endsWith('worker/index.js')));assert.ok(!names.some(n=>/\.(mp3|wav)$/i.test(n)));assert.ok(!names.some(n=>n.includes('audio-assets')));assert.ok(fs.statSync(path.join(root,'public/codigo-fonte.zip')).size<10000);
});
