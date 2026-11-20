// Server-owned catalog only. Never accept catalog IDs or ISRCs from the browser.
export function parsePlaylistLink(raw) {
  if(typeof raw!=='string'||raw.length>2048)throw new Error('INVALID_PLAYLIST');
  let url;try{url=new URL(raw.trim())}catch{throw new Error('INVALID_PLAYLIST')}
  if(url.protocol!=='https:'||url.username||url.password||url.port)throw new Error('INVALID_PLAYLIST');
  let match,provider,id,storefront;
  if(url.hostname==='open.spotify.com' && (match=url.pathname.match(/^\/(?:intl-[a-z]{2}\/)?playlist\/([A-Za-z0-9]{22})\/?$/))){provider='spotify';id=match[1]}
  else if(['deezer.com','www.deezer.com'].includes(url.hostname) && (match=url.pathname.match(/^\/(?:[a-z]{2}\/)?playlist\/(\d+)\/?$/))){provider='deezer';id=match[1]}
  else if(url.hostname==='music.apple.com' && (match=url.pathname.match(/^\/([a-z]{2})\/playlist\/(?:[^/]+\/)?(pl\.[A-Za-z0-9-]+)\/?$/))){provider='apple';storefront=match[1];id=match[2]}
  else throw new Error('UNSUPPORTED_PLAYLIST_LINK');
  // Region and marketing parameters never change the shared duplicate key.
  return {provider,id,storefront,key:provider+':'+id};
}
export function recognizeTracks({provider,items,complete},catalog) {
  if(!complete)throw new Error('INCOMPLETE_PLAYLIST');
  if(!Array.isArray(items))throw new Error('INVALID_PROVIDER_RESPONSE');
  const config=catalog.providers[provider];
  if(!config?.albumIds?.length)throw new Error('PROVIDER_CATALOG_NOT_CONFIGURED');
  const allowedAlbums=new Set(config.albumIds);
  const ids=new Map(),isrcs=new Map();
  for(const song of catalog.tracks){
    if(song.ids[provider])ids.set(song.ids[provider],song.key);
    for(const isrc of song.isrcs||[]){const key=isrc.toUpperCase();if(isrcs.has(key)&&isrcs.get(key)!==song.key)throw new Error('AMBIGUOUS_CATALOG');isrcs.set(key,song.key)}
  }
  const accepted=new Set();let outsideAlbum=0,duplicates=0,unresolved=0;
  for(const item of items){
    if(!item||item.type!=='track'||item.isLocal){unresolved++;continue}
    const albumAllowed=allowedAlbums.has(String(item.albumId));
    // Exact trusted IDs qualify. ISRC fallback additionally requires the official album.
    const key=ids.get(String(item.id)) || (albumAllowed&&item.isrc&&isrcs.get(String(item.isrc).toUpperCase()));
    if(!key){outsideAlbum++;continue}
    if(accepted.has(key)){duplicates++;continue}accepted.add(key);
  }
  return {trackKeys:[...accepted],validTracks:accepted.size,totalItems:items.length,outsideAlbum,duplicates,unresolved};
}
// Readers must finish every page and verify the provider snapshot before persistence.
export async function collectPages(readPage,{maxPages=500}={}){
  const items=[],seen=new Set();let cursor=null;
  for(let i=0;i<maxPages;i++){
    const page=await readPage(cursor);
    if(!page||!Array.isArray(page.items)||page.error)throw new Error('INVALID_PROVIDER_RESPONSE');
    items.push(...page.items);
    if(!page.next){if(page.total!=null&&items.length!==page.total)throw new Error('INCOMPLETE_PLAYLIST');return items}
    if(seen.has(page.next))throw new Error('PAGINATION_LOOP');seen.add(page.next);cursor=page.next;
  }
  throw new Error('PLAYLIST_TOO_LARGE');
}
