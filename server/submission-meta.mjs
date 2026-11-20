import {Rejection} from './album-order.mjs';
export function displayName(value){
 if(typeof value!=='string')throw new Rejection('Informe seu nome ou apelido.',400);
 const name=value.normalize('NFC').trim().replace(/\s+/gu,' ');
 if(!name||[...name].length>60||/[\u0000-\u001f\u007f]/u.test(value))throw new Rejection('Use um nome ou apelido com até 60 caracteres.',400);
 return name;
}
export function platformFor(row){
 const key=row.playlist_key||'';
 if(['apple','spotify','deezer'].includes(row.platform))return row.platform;
 if(key.startsWith('apple:')||row.playlist_url?.startsWith('https://music.apple.com/'))return 'apple';
 if(key.startsWith('spotify:')||row.playlist_url?.startsWith('https://open.spotify.com/'))return 'spotify';
 if(key.startsWith('deezer:')||row.playlist_url?.startsWith('https://www.deezer.com/'))return 'deezer';
 return null;
}
export function encodeCursor(row){return btoa(JSON.stringify([row.verified_at,row.id]))}
export function decodeCursor(raw){
 if(!raw)return null;
 try{if(raw.length>512)throw Error();const a=JSON.parse(atob(raw));if(!Array.isArray(a)||a.length!==2||!a.every(v=>typeof v==='string'&&v.length>0&&v.length<100))throw Error();return a}catch{throw new Rejection('Página inválida. Atualize a lista de playlists.',400)}
}
