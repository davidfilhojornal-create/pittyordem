import test from 'node:test';import assert from 'node:assert/strict';
import {availableTracks,createPlayback,INITIAL_VOLUME,startBackgroundPlayback} from '../public/background-audio.js';
const tracks=[{key:'a',name:'Sobremesa',src:'/audio/01.mp3'},{key:'b',name:'Armadura',src:'/audio/02.mp3'}];
class FakeAudio extends EventTarget{paused=true;src='';calls=0;volume=1;getAttribute(){return this.src||null}async play(){this.calls++;this.paused=false;this.dispatchEvent(new Event('playing'))}pause(){this.paused=true;this.dispatchEvent(new Event('pause'))}}
test('no autoplay or source fetch; playback starts quietly only on explicit play',async()=>{const a=new FakeAudio(),p=createPlayback(a,tracks,{createContext:()=>null});assert.equal(a.calls,0);assert.equal(a.src,'');assert.equal(a.preload,'none');assert.equal(a.volume,INITIAL_VOLUME);await p.play();assert.equal(a.src,'/audio/01.mp3');assert.equal(a.calls,1);assert.equal(p.state().playing,true)});
test('next preserves paused state, ended advances and wraps in album order',async()=>{const a=new FakeAudio(),p=createPlayback(a,tracks,{createContext:()=>null});await p.next();assert.equal(p.state().track.name,'Armadura');assert.equal(a.calls,0);await p.play();a.dispatchEvent(new Event('ended'));await new Promise(r=>setImmediate(r));assert.equal(p.state().track.name,'Sobremesa');assert.equal(a.calls,2);p.pause();assert.equal(p.state().playing,false)});
test('Web Audio gain applies initial quiet volume even if device ignores element volume',async()=>{const a=new FakeAudio();const gain={gain:{value:1},connect(){}};const ctx={state:'suspended',destination:{},createMediaElementSource(){return {connect(){}}},createGain(){return gain},async resume(){this.state='running'}};const p=createPlayback(a,tracks,{createContext:()=>ctx});await p.play();assert.equal(gain.gain.value,INITIAL_VOLUME);assert.equal(ctx.state,'running');p.setVolume(.08);assert.equal(gain.gain.value,.08);p.setVolume(-2);assert.equal(gain.gain.value,0);p.setVolume(2);assert.equal(gain.gain.value,1)});
test('blocked playback returns an actionable status and remains paused',async()=>{const a=new FakeAudio();a.play=async()=>{throw Object.assign(new Error(),{name:'NotAllowedError'})};const p=createPlayback(a,tracks,{createContext:()=>null});await p.play();assert.equal(p.state().playing,false);assert.match(p.state().error,/Toque/)});
test('invalid, repeated and remote audio URLs are not offered to the player',()=>{assert.deepEqual(availableTracks({tracks:[tracks[0],tracks[0],{key:'evil',name:'X',src:'https://elsewhere/audio.mp3'},tracks[1]]}),tracks);assert.deepEqual(availableTracks({}),[])});

test('automatic start retries once on real interaction when the browser blocks autoplay',async()=>{
 const listeners=new Map();const target={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
 let calls=0,playing=false;const player={async play(){calls++;if(calls>1)playing=true},state:()=>({playing})};
 startBackgroundPlayback(player,target,null);await new Promise(r=>setImmediate(r));assert.equal(calls,1);
 listeners.get('pointerdown')({isTrusted:false});assert.equal(calls,1);
 listeners.get('pointerdown')({isTrusted:true});assert.equal(calls,2);assert.equal(listeners.size,0);
});
test('player controls cancel automatic retry so a manual pause is respected',async()=>{
 const listeners=new Map();const target={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
 let calls=0;const player={async play(){calls++},state:()=>({playing:false})};startBackgroundPlayback(player,target,{contains:()=>true});await new Promise(r=>setImmediate(r));
 listeners.get('pointerdown')({isTrusted:true});assert.equal(calls,1);assert.equal(listeners.size,0);
});
