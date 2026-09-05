import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64');
const assets = compile(await readFile(new URL('../app/assets.ts',import.meta.url),'utf8'));
const {createFlightAudio}=await import(compile((await readFile(new URL('../app/audio.ts',import.meta.url),'utf8')).replace("'./assets'",JSON.stringify(assets))));
const originalContext=globalThis.AudioContext, originalFetch=globalThis.fetch;
const parameter = () => ({value:0,setTargetAtTime(value){this.value=value;}});
class Node {
  gain=parameter();frequency=parameter();threshold=parameter();ratio=parameter();playbackRate=parameter();
  connect(node){return node;} start(){}stop(){}disconnect(){}
}
class Context {
  static latest;
  state='suspended';sampleRate=100;currentTime=0;destination=new Node();resumeCalls=0;pending=[];gains=[];
  constructor(){Context.latest=this;}
  createGain(){const node=new Node();this.gains.push(node);return node;}
  createBiquadFilter(){return new Node();}createDynamicsCompressor(){return new Node();}createOscillator(){return new Node();}createBufferSource(){return new Node();}
  createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}
  resume(){this.resumeCalls++;return new Promise(resolve=>this.pending.push(resolve));}
  allow(){this.state='running';for(const resolve of this.pending.splice(0))resolve();}
  close(){this.state='closed';return Promise.resolve();}
}
const active=[];
function create(status=()=>{}){
  globalThis.AudioContext=Context;
  globalThis.fetch=async()=>({ok:false});
  const audio=createFlightAudio(status);active.push(audio);return audio;
}
afterEach(()=>{for(const audio of active.splice(0))audio.dispose();globalThis.AudioContext=originalContext;globalThis.fetch=originalFetch;});

test('a pending mobile resume does not block a later valid gesture',async()=>{
  const audio=create(), first=audio.enable(true), ctx=Context.latest;
  assert.equal(audio.ready(),false);
  const second=audio.enable(true);
  assert.equal(ctx.resumeCalls,2);
  ctx.allow();await Promise.all([first,second]);assert.equal(audio.ready(),true);
});
test('audio can be resumed after an iOS interruption',async()=>{
  const audio=create(), first=audio.enable(true), ctx=Context.latest;
  ctx.allow();await first;assert.equal(audio.ready(),true);
  ctx.state='interrupted';assert.equal(audio.ready(),false);
  const resumed=audio.enable(true);assert.equal(ctx.resumeCalls,2);
  ctx.allow();await resumed;assert.equal(audio.ready(),true);
});
test('muting while resume is pending keeps audio disabled',async()=>{
  const audio=create(), pending=audio.enable(true), ctx=Context.latest;
  await audio.enable(false);ctx.allow();await pending;
  assert.equal(audio.ready(),false);assert.equal(ctx.gains[0].gain.value,0);
});
test('optional audio download cannot hold playback readiness hostage',async()=>{
  const audio=create();globalThis.fetch=()=>new Promise(()=>{});
  const enabled=audio.enable(true);Context.latest.allow();await enabled;
  assert.equal(audio.ready(),true);
});
test('missing audio files keep the synthesized fallback available',async()=>{
  const statuses=[],audio=create(status=>statuses.push(status));
  const enabled=audio.enable(true);Context.latest.allow();await enabled;
  await Promise.resolve();assert.equal(audio.ready(),true);
  assert.ok(statuses.includes('Synthesized sound · AI clips pending'));
});
test('a blocked resume times out and can be retried',async()=>{
  const audio=create();await assert.rejects(audio.enable(true),/Tap to enable sound/);
  assert.equal(audio.ready(),false);
  const retry=audio.enable(true);Context.latest.allow();await retry;assert.equal(audio.ready(),true);
});
test('master volume respects global pause and user volume',async()=>{
  const audio=create(), enabled=audio.enable(true),ctx=Context.latest;ctx.allow();await enabled;
  const state={thrust:.4,velocity:30,onGround:true,touchdown:0,time:0};
  audio.volume(.75);audio.update(state,true,'clear','Orbit');assert.equal(ctx.gains[0].gain.value,.75);
  audio.update(state,false,'clear','Orbit');assert.equal(ctx.gains[0].gain.value,0);
});
