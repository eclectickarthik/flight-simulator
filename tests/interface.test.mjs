import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
await mkdir('work', {recursive:true});
const temp=await mkdtemp(path.resolve('work/interface-test-'));
after(()=>rm(temp,{recursive:true,force:true}));
for(const file of ['page.tsx','instruments.tsx','dynamics.ts','controls.ts','flight.ts','orbit-camera.ts','environment.ts','aircraft.ts','audio.ts','assets.ts']){
  const source=await readFile(new URL('../app/'+file,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/import\(['"]\.\/flight['"]\)/g, "import('./flight.mjs')").replace(/from ['"](\.\/[^'"]+)['"]/g,(_,p)=>`from '${p}.mjs'`);
  await writeFile(path.join(temp,file.replace(/\.tsx?$/,'.mjs')),js);
}
const {default:Home}=await import(pathToFileURL(path.join(temp,'page.mjs')));
const {FlightMap,CockpitInstruments}=await import(pathToFileURL(path.join(temp,'instruments.mjs')));
const {initialState,ROUTES}=await import(pathToFileURL(path.join(temp,'dynamics.mjs')));
test('main page exposes brakes B, autopilot, cockpit, map, and independent engine and pause controls',()=>{
  const html=renderToStaticMarkup(React.createElement(Home));
  for(const text of ['Space or B — hold brakes','Pause entire simulation','Aircraft Off','Cockpit controls','Autopilot','Map / HUD','Toggle parking brake'])assert.ok(html.includes(text),text);
  assert.ok(!html.includes('Start flight'));assert.ok(!html.includes('AUTOPILOT ENGAGED'));
});
test('airport overview shows all three airports, ATC towers and ground-map links',()=>{
  const route=ROUTES[0];
  for(const preset of ['Parking','Cruise']){const html=renderToStaticMarkup(React.createElement(FlightMap,{route,state:initialState(route,preset)}));
    for(const text of ['All three airports','CBY','MTC','PNV','ATC','View Coast Bay airport ground map','View Metro City airport ground map','View Pine Valley airport ground map'])assert.ok(html.includes(text),text);
    assert.ok(html.includes('24.00 km'));assert.ok(!/\d+\.\d{3,}/.test(html.replace(/<[^>]*>/g,'')));
  }
});
test('Summer, Night and sound are selected by default, with a terrain seed control',()=>{
  const html=renderToStaticMarkup(React.createElement(Home));
  const buttons=[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m=>({attributes:m[1],text:m[2].replace(/<[^>]*>/g,'')}));
  for(const label of ['Summer','Night','Sound on'])assert.ok(buttons.some(b=>b.text===label&&b.attributes.includes('aria-pressed="true"')),label);

  assert.ok(html.includes('Sound on'));assert.ok(html.includes('value="94"'));assert.ok(html.includes('Generate'));assert.ok(html.includes('aria-label="Close settings"'));
  assert.ok(!html.includes('side-toggle'));assert.ok(!html.includes('Sunny'));
});
test('cockpit has instrument displays plus real engine, autopilot and parking-brake buttons',()=>{
  const html=renderToStaticMarkup(React.createElement(CockpitInstruments,{route:ROUTES[0],state:initialState(ROUTES[0],'Landing'),onAutopilot(){},onEngine(){},onParkingBrake(){}}));
  for(const text of ['PRIMARY FLIGHT DISPLAY','ENGINE / SYSTEMS','FLIGHT CONTROL UNIT','ENG MASTER','PARK BRAKE','HDG','aria-pressed'])assert.ok(html.includes(text),text);
});

test('initial page has an accessible indeterminate loading bar before the simulator is ready',()=>{
  const html=renderToStaticMarkup(React.createElement(Home));
  assert.ok(html.includes('Downloading flight simulator…'));
  assert.ok(html.includes('aria-label="Loading flight simulator"'));
  assert.ok(html.includes('aria-busy="true"'));
  assert.ok(html.includes('Touch controls: hold arrows'));
});
const {publicAsset}=await import(pathToFileURL(path.join(temp,'assets.mjs')));
test('sound assets resolve under custom-domain /flight-simulator and GitHub project paths',()=>{
  for(const base of ['https://eclectickarthik.com/flight-simulator/','https://eclectickarthik.github.io/flight-simulator/']){
    const path=publicAsset('/audio/manifest.json','./');
    assert.equal(new URL(path,base).href,base+'audio/manifest.json');
  }
  assert.equal(publicAsset('/audio/manifest.json'),'/audio/manifest.json');
});
