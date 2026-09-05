import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64');
const dynamics = compile(await readFile(new URL('../app/dynamics.ts', import.meta.url), 'utf8'));
const { ROUTES, AIRPORTS, HANGARS, airportPosition } = await import(dynamics);
const { createHangarCamera } = await import(compile((await readFile(new URL('../app/orbit-camera.ts', import.meta.url), 'utf8')).replace("'./dynamics'", JSON.stringify(dynamics))));
const normal = { x:48, y:20, z:-58 };
const length = p => Math.hypot(p.x,p.y,p.z);

test('Orbit starts below the roof with a closer aircraft view in every airport shed', () => {
  for(const route of ROUTES) for(const airport of AIRPORTS) for(const hangar of HANGARS) {
    const origin=airportPosition(route,airport), target={x:origin.x+hangar.x-20,y:3.9,z:origin.z+hangar.z};
    const camera=createHangarCamera(route), offset=camera.update(target,normal,1/60,true);
    assert.equal(camera.influence(target),1);
    assert.ok(Math.abs(length(offset)-50)<1e-8);
    assert.ok(offset.x<0);
    assert.ok(target.y+offset.y<17);
  }
});
test('camera smoothly returns to normal distance and elevation after leaving the shed', () => {
  const camera=createHangarCamera(ROUTES[0]);
  let offset=camera.update({x:310,y:3.9,z:950},normal,1/60,true);
  const outside={x:200,y:3.9,z:950}, first=camera.update(outside,offset,1/60);
  assert.ok(length(first)>length(offset)&&length(first)<length(normal));
  offset=first;
  for(let i=0;i<300;i++)offset=camera.update(outside,offset,1/60);
  assert.ok(Math.abs(length(offset)-length(normal))<.001);
  assert.ok(Math.abs(offset.y-20)<.001);
});
test('camera cannot pass through roof, side walls, back wall or front lintel; doorway stays open', () => {
  const camera=createHangarCamera(ROUTES[0]), target={x:310,y:3.9,z:950};
  for(const offset of [{x:0,y:60,z:0},{x:120,y:0,z:0},{x:0,y:0,z:120},{x:0,y:0,z:-120},{x:-50,y:38,z:0}]) {
    const safe=camera.constrain(target,offset);
    assert.ok(length(safe)<length(offset));
  }
  const doorway={x:-90,y:5,z:0};
  assert.deepEqual(camera.constrain(target,doorway),doorway);
  const towardShed=camera.constrain({x:410,y:4,z:950},{x:-100,y:0,z:0});
  assert.ok(towardShed.x>-20);
});
test('manual zoom persists after exiting until view framing is reset; collision remains active', () => {
  const camera=createHangarCamera(ROUTES[0]), outside={x:100,y:3.9,z:950}, zoom={x:-32,y:7,z:-20};
  camera.overrideZoom();
  for(let i=0;i<60;i++)assert.deepEqual(camera.update(outside,zoom,1/60),zoom);
  assert.ok(camera.update({x:310,y:3.9,z:950},{x:0,y:60,z:0},1/60).y<18);
  camera.reset();
  assert.ok(length(camera.update(outside,zoom,1/60))>length(zoom));
});
test('dragging preserves user framing and high flight over a hangar does not trigger indoor zoom', () => {
  const camera=createHangarCamera(ROUTES[0]), target={x:310,y:100,z:950};
  assert.equal(camera.influence(target),0);
  assert.deepEqual(camera.update(target,normal,1/60,false,true),normal);
});
