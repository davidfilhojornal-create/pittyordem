import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import path from 'node:path';
export function fixture({beforeMigration,metrics={reads:0,writes:0}}={}){
 const raw=new DatabaseSync(':memory:');const root=path.resolve(import.meta.dirname,'..');const migrations=fs.readdirSync(root+'/drizzle').filter(n=>n.endsWith('.sql')).sort();
 for(const [i,n] of migrations.entries()){if(i===2)beforeMigration?.(raw);raw.exec(fs.readFileSync(root+'/drizzle/'+n,'utf8'))}
 function prepare(sql,args=[]){return {sql,args,bind(...values){return prepare(sql,values)},async first(){metrics.reads++;return raw.prepare(sql).get(...args)||null},async all(){metrics.reads++;return {results:raw.prepare(sql).all(...args)}},async run(){metrics.writes++;return {results:[],meta:{changes:Number(raw.prepare(sql).run(...args).changes)}}}}}
 let queue=Promise.resolve();async function batch(statements){raw.exec('BEGIN');try{const out=[];for(const s of statements){if(/^\s*SELECT\b/i.test(s.sql))out.push(await s.all());else out.push(await s.run())}raw.exec('COMMIT');return out}catch(e){raw.exec('ROLLBACK');throw e}}
 const db={prepare,batch(statements){const next=queue.then(()=>batch(statements));queue=next.catch(()=>{});return next}};return {raw,db,metrics};
}
export function insert(raw,order,id='a'){raw.prepare('INSERT INTO submissions(id,playlist_key,playlist_url,title,order_json,verified_at) VALUES(?,?,?,?,?,?)').run(id,'spotify:'+id,'https://open.spotify.com/playlist/'+id,'Playlist',JSON.stringify(order),'2026-11-17T12:00:00.000Z')}
