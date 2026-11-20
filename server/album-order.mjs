export class Rejection extends Error {constructor(message,status=422,details={}){super(message);this.status=status;this.details=details}}
export function validateOrder(items,catalog,provider='apple'){
 const allowed=new Map(catalog.tracks.filter(t=>t.ids[provider]).map(t=>[t.ids[provider],t.key]));
 const order=[],seen=new Set(),extra=[],repeated=[];
 for(const item of items){const key=allowed.get(String(item.id));if(!key){extra.push(item.title||'Faixa não reconhecida');continue}if(seen.has(key))repeated.push(item.title);seen.add(key);order.push(key)}
 const missing=catalog.tracks.filter(t=>!seen.has(t.key)).map(t=>t.name);
 if(extra.length||repeated.length||missing.length||order.length!==13)throw new Rejection('A playlist precisa conter somente as 13 faixas do disco, sem faltar nem repetir nenhuma.',422,{missing,extra,repeated});
 return order;
}
export function parseApplePage(html,id){
 const script=html.match(/<script\b(?=[^>]*\bid=["']serialized-server-data["'])[^>]*>([\s\S]*?)<\/script>/i);
 if(!script)throw new Rejection('Não foi possível ler esta playlist pública. O contador não foi alterado.');
 let payload;try{payload=JSON.parse(script[1])}catch{throw new Rejection('A Apple retornou uma página que não conseguimos verificar.')}
 const sections=payload?.data?.[0]?.data?.sections;
 if(!Array.isArray(sections))throw new Rejection('Formato de página não reconhecido.');
 const header=sections.flatMap(s=>s.items||[]).find(i=>i.contentDescriptor?.kind==='playlist'&&i.contentDescriptor?.identifiers?.storeAdamID===id);
 const lists=sections.filter(s=>s.itemKind==='trackLockup'&&s.containerContentDescriptor?.identifiers?.storeAdamID===id);
 const rows=lists.flatMap(s=>s.items||[]);
 if(!header||!Number.isInteger(header.trackCount)||header.trackCount!==rows.length)throw new Rejection('A lista está incompleta ou indisponível. Nenhuma posição foi contabilizada.');
 if(header.trackCount!==13)throw new Rejection(`Esta playlist tem ${header.trackCount} faixas. São necessárias exatamente 13: todas as músicas do álbum, sem extras nem repetições.`);
 const items=rows.map(row=>({id:row.contentDescriptor?.kind==='song'?row.contentDescriptor?.identifiers?.storeAdamID:null,title:row.title}));
 return {title:String(header.title||'Minha ordem de Pitty').slice(0,200),items};
}
export async function readApple(playlist,fetcher=fetch){
 let url=`https://music.apple.com/${playlist.storefront}/playlist/playlist/${playlist.id}`;
 let response;
 try{
 const signal=AbortSignal.timeout(20000);
 for(let attempt=0;attempt<4;attempt++){
 response=await fetcher(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'},redirect:'manual',signal});
 if(![301,302,303,307,308].includes(response.status))break;
 const target=new URL(response.headers.get('Location'),url);
 const parts=target.pathname.split('/').filter(Boolean);
 if(target.origin!=='https://music.apple.com'||parts[1]!=='playlist'||parts.at(-1)!==playlist.id||target.username||target.password)throw new Error('Unsafe redirect');
 await response.body?.cancel();url=target.href;
 }
 }catch{throw new Rejection('A Apple não respondeu à consulta. Tente novamente; nenhum envio foi salvo.',503)}
 if(!response.ok)throw new Rejection('A playlist não está acessível. Confira se ela é pública e se o link está correto.',422);
 const reader=response.body.getReader();let size=0;const chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>3000000){await reader.cancel();throw new Rejection('Não foi possível verificar esta página com segurança.')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 return parseApplePage(new TextDecoder().decode(bytes),playlist.id);
}
export function summarize(rows,catalog){
 const tracks=catalog.tracks.map(t=>({key:t.key,name:t.name,positions:Array(13).fill(0),average:null,modes:[]}));
 const byKey=new Map(tracks.map(t=>[t.key,t]));const sequences=new Map(),pairs=new Map();
 for(const row of rows){const order=JSON.parse(row.order_json);if(order.length!==13||new Set(order).size!==13||order.some(k=>!byKey.has(k)))throw new Error('Invalid stored order');order.forEach((key,i)=>byKey.get(key).positions[i]++);
 const sequence=order.join(',');sequences.set(sequence,(sequences.get(sequence)||0)+1);
 for(let i=0;i<12;i++){const key=order[i]+','+order[i+1];pairs.set(key,(pairs.get(key)||0)+1)}}
 for(const t of tracks){if(rows.length){t.average=t.positions.reduce((s,n,i)=>s+n*(i+1),0)/rows.length;const max=Math.max(...t.positions);t.modes=t.positions.flatMap((n,i)=>n===max?[i+1]:[])}}
 const top=m=>[...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,10).map(([key,count])=>({order:key.split(','),count}));
 return {total:rows.length,tracks,ranking:[...tracks].sort((a,b)=>(a.average??99)-(b.average??99)||catalog.tracks.findIndex(t=>t.key===a.key)-catalog.tracks.findIndex(t=>t.key===b.key)).map(t=>t.key),pairs:top(pairs),sequences:top(sequences),updatedAt:new Date().toISOString()};
}
