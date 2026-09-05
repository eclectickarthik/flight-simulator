import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../app/dynamics.ts', import.meta.url), 'utf8');
const uri = 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64');
const { initialState, stepFlight, ROUTES, emptyInput, toggleGear, cycleFlaps, telemetry, setEngine, setAutopilot, AIRPORTS, airportPosition, createSeededRandom } = await import(uri);
const inputSource = (await readFile(new URL('../app/controls.ts', import.meta.url), 'utf8')).replace("'./dynamics'", JSON.stringify(uri));
const { createInputState, createSimulationClock } = await import('data:text/javascript;base64,' + Buffer.from(ts.transpileModule(inputSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64'));
const advance = (s, seconds, input = emptyInput(), weather = 'clear', route = ROUTES[0]) => { for (let t = 0; t < seconds * 60; t++) stepFlight(s, input, 1 / 60, route, weather); };
test('full-throttle takeoff rotates and climbs before leaving the runway', () => {
  const s = initialState(ROUTES[0]); s.throttle = 1;
  for (let i = 0; i < 60 * 50 && s.onGround; i++) { const input = emptyInput(); if (s.speed > 120) input.pitch = 1; stepFlight(s, input, 1 / 60, ROUTES[0], 'clear'); }
  assert.equal(s.failed, false); assert.equal(s.onGround, false); assert.ok(Math.abs(s.z) < 1650);
  advance(s, 10); assert.ok(s.altitude > 50);
});
test('all three landing practice presets can touch down and stop at destination', () => {
  for (const route of ROUTES) {
    const s = initialState(route, 'Landing');
    for (let i = 0; i < 60 * 200 && !s.arrived && !s.failed; i++) { const input = emptyInput(); if (s.onGround) { s.throttle = 0; input.brake = true; } stepFlight(s, input, 1 / 60, route, 'clear'); }
    assert.equal(s.failed, false, route.id); assert.equal(s.arrived, true, route.id); assert.equal(s.touchdown, 1); assert.ok(s.distance < 1650);
  }
});
test('banking and rudder change heading and world position', () => {
  const s = initialState(ROUTES[0], 'Cruise'), input = emptyInput(); input.roll = 1;
  advance(s, 10, input); assert.ok(s.heading > .1); assert.ok(s.x > 50);
  const g = initialState(ROUTES[0]); g.velocity = 10; input.roll = 0; input.rudder = -1; advance(g, 1, input); assert.ok(g.heading > Math.PI && g.heading < Math.PI*2); assert.ok(g.x < 0);
});
test('gear is locked on ground and transitions airborne; flaps cycle through three settings', () => {
  const s = initialState(ROUTES[0]); toggleGear(s); assert.equal(s.gearTarget, 1);
  s.onGround = false; s.y = 100; s.velocity = 80; toggleGear(s); advance(s, 8); assert.ok(s.gear < .01);
  cycleFlaps(s); assert.equal(s.flapTarget, 1); cycleFlaps(s); assert.equal(s.flapTarget, 0); cycleFlaps(s); assert.equal(s.flapTarget, .5);
});
test('rain and snow increase stopping distance', () => {
  function stoppingDistance(weather) { const s = initialState(ROUTES[0]); s.velocity = 40; s.throttle = 0; const z = s.z; const input = emptyInput(); input.brake = true; advance(s, 25, input, weather); assert.equal(s.velocity, 0); return z - s.z; }
  assert.ok(stoppingDistance('snow') > stoppingDistance('rain')); assert.ok(stoppingDistance('rain') > stoppingDistance('clear'));
});
test('hard landing and gear-up landing do not count as arrival', () => {
  for (const gear of [0, 1]) { const s = initialState(ROUTES[0], 'Landing'); s.z = -ROUTES[0].distance; s.y = 4; s.gear = s.gearTarget = gear; s.verticalSpeed = -15; s.pitch = -.17; advance(s, 1); assert.equal(s.failed, true); assert.equal(s.arrived, false); }
});
test('ETA tracks actual closing speed and disappears when flying away', () => {
  const s = initialState(ROUTES[0], 'Cruise'); assert.ok(s.eta > 0); s.heading = Math.PI; telemetry(s, ROUTES[0]); assert.equal(s.eta, null);
  s.heading = 0; s.x = 1000; telemetry(s, ROUTES[0]); assert.ok(s.bearing > 350); assert.ok(s.distance > Math.abs(s.z + ROUTES[0].distance));
});
test('fixed-step result is independent of display frame rate', () => {
  function run(fps) { const s = initialState(ROUTES[0], 'Cruise'); let acc = 0; for (let frame = 0; frame < fps * 20; frame++) { acc += 1 / fps; while (acc + 1e-10 >= 1 / 60) { stepFlight(s, emptyInput(), 1 / 60, ROUTES[0], 'storm'); acc -= 1 / 60; } } return s; }
  const a = run(30), b = run(144); assert.ok(Math.abs(a.z - b.z) < .01); assert.ok(Math.abs(a.y - b.y) < .01);
});
test('clearing held controls neutralizes inputs before resume; reset restores departure', () => {
  const controls = createInputState(); for (const k of ['ArrowDown', 'ArrowRight', 'w', 'b']) controls.press(k);
  assert.equal(controls.read().throttle, 1); controls.clear(); assert.deepEqual(controls.read(), emptyInput());
  const s = initialState(ROUTES[2]); assert.equal(s.time, 0); assert.equal(s.gear, 1); assert.equal(s.throttle, 0); assert.equal(s.failed, false);
});

test('autopilot completes takeoff, approach, landing and parks on every route', () => {
  for(const route of ROUTES){const s=initialState(route);setAutopilot(s,true,route);
    for(let i=0;i<60*1400 && !s.failed && s.autopilot;i++)stepFlight(s,emptyInput(),1/60,route,'clear');
    assert.equal(s.failed,false,JSON.stringify({route:route.id,phase:s.autopilotPhase,x:s.x,z:s.z,y:s.y,v:s.velocity}));
    assert.equal(s.arrived,true,JSON.stringify({route:route.id,phase:s.autopilotPhase,x:s.x,z:s.z,y:s.y,v:s.velocity}));
    assert.equal(s.autopilotPhase,'PARKED',JSON.stringify({x:s.x,z:s.z,v:s.velocity,phase:s.autopilotPhase,taxiIndex:s.taxiIndex}));
  }
});
test('autopilot taxis from the parking shed to the runway and takes off', () => {
  const route=ROUTES[0],s=initialState(route,'Parking');setAutopilot(s,true,route);
  for(let i=0;i<60*500 && s.onGround && !s.failed;i++)stepFlight(s,emptyInput(),1/60,route,'clear');
  assert.equal(s.onGround,false,JSON.stringify(s));assert.equal(s.failed,false);
});
test('landing does not lock the session and engine shutdown does not stop world time', () => {
  const route=ROUTES[0],s=initialState(route);s.z=-route.distance;s.touchdown=1;s.arrived=true;s.throttle=.4;
  advance(s,10);assert.ok(s.velocity>1);assert.ok(s.time>9);assert.equal(s.failed,false);
  setEngine(s,false);const t=s.time;advance(s,10);assert.equal(s.throttle,0);assert.ok(s.thrust<.002);assert.ok(s.time>t);
});
test('taxiing on the apron is allowed and parking brake holds the aircraft', () => {
  const s=initialState(ROUTES[0],'Parking');setEngine(s,true);s.parkingBrake=false;s.throttle=.4;advance(s,12);
  assert.equal(s.failed,false);assert.ok(s.x<300);s.parkingBrake=true;advance(s,10);assert.equal(s.velocity,0);
});

test('global pause freezes physics and the shared environment clock without catch-up on resume', () => {
  const clock=createSimulationClock(),s=initialState(ROUTES[0],'Cruise');let weatherTime=0;
  const tick=()=>{stepFlight(s,emptyInput(),1/60,ROUTES[0],'rain');return true;};
  weatherTime+=clock.advance(.1,true,1,tick);const before={...s},beforeWeather=weatherTime;
  for(let i=0;i<100;i++)weatherTime+=clock.advance(.1,false,4,tick);
  assert.deepEqual(s,before);assert.equal(weatherTime,beforeWeather);
  weatherTime+=clock.advance(1/60,true,1,tick);assert.ok(Math.abs(s.time-before.time-1/60)<.00001);assert.ok(weatherTime>beforeWeather);
});
test('autopilot lands and parks in rain, snow and storm, and manages gear/flaps', () => {
  for(const weather of ['rain','snow','storm']){const route=ROUTES[0],s=initialState(route,'Cruise');setAutopilot(s,true,route);
    for(let i=0;i<60*1000 && s.autopilot && !s.failed;i++)stepFlight(s,emptyInput(),1/60,route,weather);
    assert.equal(s.failed,false,weather);assert.equal(s.autopilotPhase,'PARKED',JSON.stringify({weather,phase:s.autopilotPhase,x:s.x,z:s.z}));assert.equal(s.gearTarget,1);assert.equal(s.flapTarget,1);
  }
});
test('autopilot can capture the approach from a lateral offset, and can be disengaged', () => {
  const route=ROUTES[0],s=initialState(route,'Cruise');s.x=650;s.heading=.15;setAutopilot(s,true,route);
  advance(s,60);assert.ok(Math.abs(s.x)<650);setAutopilot(s,false,route);assert.equal(s.autopilot,false);
  const input=emptyInput();input.roll=-1;const heading=s.heading;advance(s,3,input);assert.notEqual(s.heading,heading);
});

test('every airport pair is 20–30 km apart and all route frames preserve distances',()=>{
  for(const route of ROUTES){const from=airportPosition(route,route.from),to=airportPosition(route,route.to);
    assert.ok(Math.abs(from.x)<.001&&Math.abs(from.z)<.001);assert.ok(Math.abs(to.x)<.001);assert.ok(Math.abs(to.z+route.distance)<.001);
    for(let i=0;i<AIRPORTS.length;i++)for(let j=i+1;j<AIRPORTS.length;j++){const a=airportPosition(route,AIRPORTS[i]),b=airportPosition(route,AIRPORTS[j]),d=Math.hypot(a.x-b.x,a.z-b.z);assert.ok(d>=20000&&d<=30000);}
  }
});
test('terrain seed reproduces scenery and different seeds change it, including seed zero',()=>{
  const sample=seed=>{const random=createSeededRandom(seed);return Array.from({length:30},()=>random());};
  assert.deepEqual(sample(94),sample(94));assert.notDeepEqual(sample(94),sample(95));assert.notDeepEqual(sample(0),sample(94));assert.ok(sample(4294967295).every(n=>n>=0&&n<1));
});
test('manual landing at the third airport uses its actual world runway',()=>{
  const route=ROUTES[0],third=AIRPORTS.find(a=>a.id!==route.from.id&&a.id!==route.to.id),p=airportPosition(route,third),s=initialState(route,'Landing');s.x=p.x;s.z=p.z+300;s.y=4;s.verticalSpeed=-2;s.pitch=-.025;
  stepFlight(s,emptyInput(),.1,route,'clear');assert.equal(s.onGround,true);assert.equal(s.failed,false);
});

test('Space and B independently hold brakes and releasing both clears them',()=>{
  const controls=createInputState();controls.press(' ');assert.equal(controls.read().brake,true);
  controls.press('b');controls.release(' ');assert.equal(controls.read().brake,true);
  controls.release('b');assert.equal(controls.read().brake,false);
  controls.press(' ');controls.clear();assert.equal(controls.read().brake,false);
});

test('simultaneous touch controls support pitch, steering and brakes with independent release',()=>{
  const controls=createInputState();
  for(const key of ['ArrowDown','a','b'])controls.press(key);
  assert.equal(controls.read().pitch,1);assert.equal(controls.read().rudder,-1);assert.equal(controls.read().brake,true);
  controls.release('a');assert.equal(controls.read().rudder,0);assert.equal(controls.read().pitch,1);
  controls.clear();assert.deepEqual(controls.read(),emptyInput());
});
