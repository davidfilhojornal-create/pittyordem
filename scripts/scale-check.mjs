// Local synthetic benchmark only. Never connects to Cloudflare or the live D1.
import fs from 'node:fs';import {performance} from 'node:perf_hooks';import assert from 'node:assert/strict';
import {fixture,insert} from '../tests/d1-fixture.mjs';import {aggregateResults,cachedResults,ensureAggregates} from '../server/aggregate-results.mjs';import {summarize} from '../server/album-order.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../server/catalog/pitty.json',import.meta.url))),base=catalog.tracks.map(t=>t.key);const n=Number(process.argv[2]||20000);
if(!Number.isInteger(n)||n<100||n>100000)throw new Error('Use between 100 and 100000 synthetic records');
let seed=42;function order(){const a=[...base];for(let i=12;i>0;i--){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const j=(seed>>>0)%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
const f=fixture({beforeMigration:raw=>{raw.exec('BEGIN');for(let i=0;i<n;i++)insert(raw,order(),'seed-'+String(i).padStart(7,'0'));raw.exec('COMMIT')}});
let start=performance.now();await ensureAggregates(f.db);const warmupMs=performance.now()-start;
start=performance.now();for(let i=0;i<1000;i++)insert(f.raw,order(),'new-'+i);const insertMs=(performance.now()-start)/1000;
start=performance.now();const reference=summarize(f.raw.prepare('SELECT order_json,verified_at FROM submissions').all(),catalog);const oldMs=performance.now()-start;
start=performance.now();const result=await aggregateResults(f.db,catalog);const resultsMs=performance.now()-start;
assert.equal(result.total,n+1000);assert.deepEqual(result.tracks,reference.tracks);assert.deepEqual(result.ranking,reference.ranking);
const positionKeys=Object.keys(JSON.parse(f.raw.prepare('SELECT positions_json FROM aggregate_state').get().positions_json)).length;
const pairKeys=Object.keys(JSON.parse(f.raw.prepare('SELECT pairs_json FROM aggregate_state').get().pairs_json)).length;assert.equal(positionKeys,169);assert.equal(pairKeys,156);assert.ok(result.sequences.length<=10);
const store=new Map(),cache={async match(k){return store.get(k.url)?.clone()},async put(k,r){store.set(k.url,r)}};const request=new Request('https://local-test.invalid/api/results');await (await cachedResults(request,{DB:f.db},null,catalog,cache)).json();const before={...f.metrics};
start=performance.now();await Promise.all(Array.from({length:200},async()=>{const r=await cachedResults(request,{DB:f.db},null,catalog,cache);assert.equal(r.headers.get('X-Results-Cache'),'HIT');await r.json()}));const cached200Ms=performance.now()-start;assert.deepEqual(f.metrics,before);
const report={scope:'LOCAL SQLite / Worker logic; not a Cloudflare network or peak-capacity test',syntheticRecords:result.total,warmupMs:+warmupMs.toFixed(2),insertWithAtomicCountersMeanMs:+insertMs.toFixed(2),oldFullScanResultsMs:+oldMs.toFixed(2),aggregateResultsMs:+resultsMs.toFixed(2),cached200RequestsMs:+cached200Ms.toFixed(2),cached200DatabaseQueries:0,responseBytes:JSON.stringify(result).length,positionCounters:positionKeys,pairCounters:pairKeys,sequencesReturned:result.sequences.length};
console.log(JSON.stringify(report,null,2));
