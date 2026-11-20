import {test} from 'node:test';import assert from 'node:assert/strict';
import catalog from '../server/catalog/pitty.json' with {type:'json'};
import {summarize} from '../server/album-order.mjs';
import {modeLabel,percent,formatPercent,buildMatrix,describeCell,colorFor,contrast,SCALE_LOW,SCALE_HIGH} from '../public/position-map.js';

const keys=catalog.tracks.map(t=>t.key);
const rowsOf=orders=>orders.map(o=>({order_json:JSON.stringify(o)}));
const rotate=(n)=>[...keys.slice(n),...keys.slice(0,n)];

test('zero envios: nada de divisão por zero nem porcentagem inventada',()=>{
 assert.equal(percent(0,0),null);assert.equal(percent(5,0),null);
 assert.equal(formatPercent(percent(0,0)),'—');
 const m=buildMatrix(catalog.tracks,summarize([],catalog));
 assert.equal(m.total,0);assert.equal(m.max,0);
 assert.ok(m.rows.every(r=>r.cells.every(c=>c.percent===null&&c.count===0)));
});

test('0% e 100% com contagens conhecidas',()=>{
 const m=buildMatrix(catalog.tracks,summarize(rowsOf([keys,keys]),catalog));
 assert.equal(m.rows[0].cells[0].percent,100);assert.equal(formatPercent(m.rows[0].cells[0].percent),'100%');
 assert.equal(m.rows[0].cells[1].percent,0);assert.equal(formatPercent(m.rows[0].cells[1].percent),'0%');
 assert.equal(m.max,100);
});

test('porcentagens fracionárias: valor exato no cálculo, arredondado só na exibição',()=>{
 const m=buildMatrix(catalog.tracks,summarize(rowsOf([keys,rotate(1),rotate(2)]),catalog));
 const v=m.rows[0].cells[0].percent;
 assert.ok(Math.abs(v-100/3)<1e-12);assert.equal(formatPercent(v),'33,3%');
 assert.equal(formatPercent(percent(1,8)),'12,5%');
 assert.equal(formatPercent(percent(2,3)*1),'66,7%');
 assert.equal(formatPercent(percent(32,100)),'32%');
 // cada linha e cada coluna somam 100%
 for(const r of m.rows)assert.ok(Math.abs(r.cells.reduce((s,c)=>s+c.percent,0)-100)<1e-9);
 for(let c=0;c<13;c++)assert.ok(Math.abs(m.rows.reduce((s,r)=>s+r.cells[c].percent,0)-100)<1e-9);
});

test('linhas seguem a ordem oficial do catálogo, não o ranking',()=>{
 const summary=summarize(rowsOf([[...keys].reverse()]),catalog);
 assert.notDeepEqual(summary.ranking,keys);
 assert.deepEqual(buildMatrix(catalog.tracks,summary).rows.map(r=>r.key),keys);
});

test('frases do detalhe para 1ª, 13ª e posições do meio',()=>{
 const a=describeCell({name:'Armadura',count:32,total:100,index:0});
 assert.equal(a.title,'Armadura');assert.equal(a.headline,'32% em 1º lugar');
 assert.equal(a.sentence,'32 de 100 playlists começam com esta faixa.');
 assert.equal(describeCell({name:'Nó',count:40,total:100,index:12}).sentence,'40 de 100 playlists terminam com esta faixa.');
 const mid=describeCell({name:'Madame',count:7,total:100,index:3});
 assert.equal(mid.headline,'7% em 4º lugar');assert.equal(mid.sentence,'7 de 100 playlists colocam esta faixa na 4ª posição.');
 assert.equal(describeCell({name:'Madame',count:1,total:1,index:0}).sentence,'1 de 1 playlist começa com esta faixa.');
 assert.equal(describeCell({name:'Madame',count:1,total:3,index:5}).sentence,'1 de 3 playlists coloca esta faixa na 6ª posição.');
 assert.match(a.label,/Armadura, 1ª posição: 32%/);
});

test('escala única de cor: extremos e texto sempre legível',()=>{
 assert.equal(colorFor(0,50).background,'#1c1c1c');assert.equal(colorFor(null,0).background,'#1c1c1c');
 assert.equal(colorFor(50,50).background,'#ffffff');
 assert.ok(colorFor(10,50).t<colorFor(30,50).t);
 for(let v=0;v<=100;v+=2.5)assert.ok(colorFor(v,100).contrast>=4.5,`contraste baixo em ${v}%`);
 assert.ok(contrast(SCALE_LOW,SCALE_HIGH)>3);
});

test('most frequent positions from API stay 1-based, including 13th and ties',()=>{
 const data=summarize(rowsOf([keys,[...keys].reverse()]),catalog);
 assert.equal(data.tracks[0].modes.map(modeLabel).join(', '),'1ª, 13ª');
 assert.equal(data.tracks[6].modes.map(modeLabel).join(', '),'7ª');
});
