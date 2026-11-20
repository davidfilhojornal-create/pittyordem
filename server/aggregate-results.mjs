// One bounded state row (169 positions + at most 156 pairs) and an indexed top ten.
export async function ensureAggregates(db){
 const state=await db.prepare('SELECT ready FROM aggregate_state WHERE id=1').first();if(state?.ready)return;
 if(!state)await db.prepare("INSERT OR IGNORE INTO aggregate_state(id,total,ready,positions_json,pairs_json) VALUES(1,0,0,'{}','{}')").run();
 // D1 batch is atomic. Every statement rechecks ready, including concurrent warmups.
 await db.batch([
  db.prepare('DELETE FROM aggregate_sequences WHERE (SELECT ready FROM aggregate_state WHERE id=1)=0'),
  db.prepare('INSERT INTO aggregate_sequences(sequence,count) SELECT json(order_json),COUNT(*) FROM submissions WHERE (SELECT ready FROM aggregate_state WHERE id=1)=0 GROUP BY json(order_json)'),
  db.prepare(`UPDATE aggregate_state SET
   positions_json=COALESCE((SELECT json_group_object(k,n) FROM (SELECT j.value||'|'||j.key AS k,COUNT(*) AS n FROM submissions s,json_each(s.order_json) j GROUP BY k)),'{}'),
   pairs_json=COALESCE((SELECT json_group_object(k,n) FROM (SELECT a.value||'|'||b.value AS k,COUNT(*) AS n FROM submissions s,json_each(s.order_json) a JOIN json_each(s.order_json) b ON CAST(b.key AS INTEGER)=CAST(a.key AS INTEGER)+1 GROUP BY k)),'{}'),
   total=(SELECT COUNT(*) FROM submissions),updated_at=(SELECT MAX(verified_at) FROM submissions),ready=1 WHERE id=1 AND ready=0`)
 ]);
}
export async function aggregateResults(db,catalog){
 await ensureAggregates(db);
 const result=await db.batch([
  db.prepare('SELECT total,positions_json,pairs_json,updated_at FROM aggregate_state WHERE id=1'),
  db.prepare('SELECT sequence,count FROM aggregate_sequences ORDER BY count DESC,sequence ASC LIMIT 10')
 ]);
 const state=result[0].results[0],positions=JSON.parse(state.positions_json),pairs=JSON.parse(state.pairs_json),total=state.total;
 const tracks=catalog.tracks.map(t=>{
  const counts=Array.from({length:13},(_,i)=>positions[t.key+'|'+i]||0),max=Math.max(...counts);
  return {key:t.key,name:t.name,positions:counts,average:total?counts.reduce((sum,n,i)=>sum+n*(i+1),0)/total:null,modes:total?counts.flatMap((n,i)=>n===max?[i+1]:[]):[]};
 });
 return {total,tracks,ranking:[...tracks].sort((a,b)=>(a.average??99)-(b.average??99)).map(t=>t.key),
  pairs:Object.entries(pairs).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,10).map(([key,count])=>({order:key.split('|'),count})),
  sequences:result[1].results.map(r=>({order:JSON.parse(r.sequence),count:r.count})),updatedAt:new Date().toISOString(),dataUpdatedAt:state.updated_at,cacheSeconds:60};
}
const inFlight=new Map();
export async function cachedResults(request,env,ctx,catalog,cache=globalThis.caches?.default){
 const key=new Request(new URL('/api/results',request.url));
 let cached;try{cached=cache&&await cache.match(key)}catch{console.warn('Results cache unavailable; reading counters')}if(cached){const response=new Response(cached.body,cached);response.headers.set('X-Results-Cache','HIT');return response}
 let pending=inFlight.get(env.DB);
 if(!pending){pending=aggregateResults(env.DB,catalog).finally(()=>inFlight.delete(env.DB));inFlight.set(env.DB,pending)}
 const data=await pending;
 const response=new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public,max-age=60','X-Content-Type-Options':'nosniff','X-Results-Cache':'MISS'}});
 if(cache){const put=cache.put(key,response.clone()).catch(()=>console.warn('Results cache write unavailable'));if(ctx?.waitUntil)ctx.waitUntil(put);else await put}
 return response;
}
