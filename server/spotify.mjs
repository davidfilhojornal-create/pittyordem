import {Rejection} from './album-order.mjs';
import {parsePlaylistLink} from './recognition.mjs';
function decode(value){return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi,s=>{const fixed={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'};if(fixed[s])return fixed[s];const n=s.toLowerCase().startsWith('&#x')?parseInt(s.slice(3,-1),16):parseInt(s.slice(2,-1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):s})}
export function parseSpotifyPage(html,id){
 const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
 if(!head)throw new Rejection('O Spotify não disponibilizou os dados desta playlist. Confira se ela é pública.');
 const meta=[];
 for(const tag of head.matchAll(/<meta\b[^>]*>/gi)){
 const attrs={};for(const a of tag[0].matchAll(/\b([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[a[1].toLowerCase()]=decode(a[2]??a[3]);
 meta.push({key:attrs.property||attrs.name,value:attrs.content});
 }
 const values=key=>meta.filter(m=>m.key===key).map(m=>m.value);
 const pageUrl=values('og:url');const type=values('og:type');
 let identity;try{identity=parsePlaylistLink(pageUrl[0])}catch{}
 if(type.length!==1||type[0]!=='music.playlist'||pageUrl.length!==1||identity?.provider!=='spotify'||identity.id!==id)throw new Rejection('O Spotify não retornou a playlist solicitada. Confira o link e a visibilidade pública.');
 const counts=values('music:song_count');
 if(counts.length!==1||!/^\d+$/.test(counts[0]))throw new Rejection('Não conseguimos confirmar o total de músicas desta playlist. Nenhum envio foi salvo.');
 const count=Number(counts[0]);
 if(count!==13)throw new Rejection(`Esta playlist tem ${count} faixas. São necessárias exatamente 13: todas as músicas do álbum, sem extras nem repetições.`);
 const songs=meta.filter(m=>m.key==='music:song'||m.key==='music:song:track');
 if(songs.length!==26)throw new Rejection('O Spotify retornou uma lista incompleta. Nenhuma posição foi contabilizada.');
 const items=[];
 for(let i=0;i<13;i++){
 const song=songs[i*2],position=songs[i*2+1];
 const track=song.key==='music:song'&&song.value?.match(/^https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]{22})$/);
 if(!track||position.key!=='music:song:track'||position.value!==String(i+1))throw new Rejection('Não conseguimos verificar todas as posições da playlist. O contador não foi alterado.');
 items.push({id:track[1],title:`Faixa ${i+1}`});
 }
 return {title:(values('og:title')[0]||'Minha ordem de Pitty').slice(0,200),items};
}
export async function readSpotify(playlist,fetcher=fetch){
 let response;const signal=AbortSignal.timeout(20000);
 try{
 let url=`https://open.spotify.com/playlist/${playlist.id}`;
 for(let attempt=0;attempt<4;attempt++){
 response=await fetcher(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'},redirect:'manual',signal});
 if(![301,302,303,307,308].includes(response.status))break;
 const target=new URL(response.headers.get('Location'),url);const parsed=parsePlaylistLink(target.href);
 if(parsed.provider!=='spotify'||parsed.id!==playlist.id)throw new Error('Unexpected redirect');
 await response.body?.cancel();url=target.href;
 }
 }catch(e){console.error('Spotify public read failed:',e.message);throw new Rejection('O Spotify não respondeu à consulta. Tente novamente; nenhum envio foi salvo.',503)}
 if(!response.ok)throw new Rejection('Não foi possível abrir esta playlist no Spotify. Confira se o link está correto e a playlist está pública.');
 const reader=response.body.getReader();let size=0;const chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>3000000){await reader.cancel();throw new Rejection('Não foi possível verificar a página completa do Spotify.')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 return parseSpotifyPage(new TextDecoder().decode(bytes),playlist.id);
}
