import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { HANGARS, AIRPORTS, airportPosition, createSeededRandom, type Airport, type Route, type Weather, type TimeOfDay, type Environment } from './dynamics';

export function createEnvironment(scene: THREE.Scene) {
  const root = new THREE.Group(); scene.add(root);
  let terrainSeed=94; let random=createSeededRandom(94); let activeRoute: Route;
  const standard = (color: string, roughness = .8) => new THREE.MeshStandardMaterial({ color, roughness });
  const airportLamps: THREE.PointLight[] = [];
  const grass = standard('#6c8662'), asphalt = standard('#353c40'), concrete = standard('#9ba5a5'), white = standard('#e8e7db');
  const windowMat = new THREE.MeshStandardMaterial({ color: '#6b8795', metalness: .45, roughness: .3, emissive: '#e4c992', emissiveIntensity: 0 });
  const treeMat = standard('#345e46');
  const lights = new THREE.MeshBasicMaterial({ color: '#fff1c0', transparent: true, opacity: .8 });
  const grainCanvas=document.createElement('canvas');grainCanvas.width=grainCanvas.height=128;const gc=grainCanvas.getContext('2d')!;const grain=gc.createImageData(128,128);for(let i=0;i<128*128;i++){const v=180+random()*60;grain.data.set([v,v,v,255],i*4);}gc.putImageData(grain,0,0);const grainTexture=new THREE.CanvasTexture(grainCanvas);grainTexture.wrapS=grainTexture.wrapT=THREE.RepeatWrapping;grainTexture.repeat.set(12,120);asphalt.roughnessMap=grainTexture;
  const sky = new Sky(); sky.scale.setScalar(180000); root.add(sky);
  const su = sky.material.uniforms;
  const waterCanvas = document.createElement('canvas'); waterCanvas.width = waterCanvas.height = 128;
  const ctx = waterCanvas.getContext('2d')!, pixels = ctx.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) { const x = i % 128, y = Math.floor(i / 128); pixels.data.set([128 + 18 * Math.sin(x * .35 + y * .2), 128 + 20 * Math.cos(y * .3), 250, 255], i * 4); }
  ctx.putImageData(pixels, 0, 0);
  const normal = new THREE.CanvasTexture(waterCanvas); normal.wrapS = normal.wrapT = THREE.RepeatWrapping; normal.repeat.set(5000, 5000);
  const waterMat = new THREE.MeshStandardMaterial({ color: '#307f91', metalness: .35, roughness: .27, normalMap: normal, normalScale: new THREE.Vector2(.25, .25) });
  function box(w: number, h: number, d: number, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.receiveShadow = true; parent.add(m); return m;
  }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(240000, 240000), waterMat); water.rotation.x = -Math.PI / 2; water.position.y = -1; root.add(water);
  const terrain = new THREE.Group(); root.add(terrain);
  const airportGroups: THREE.Group[] = [], beaconGroups: THREE.Group[] = [];
  const runwayTextures: THREE.Texture[] = [];
  function runwayLabel(text: string) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const ct = c.getContext('2d')!;
    ct.fillStyle = '#eeeee8'; ct.font = 'bold 170px Arial'; ct.textAlign = 'center'; ct.fillText(text, 128, 190);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; runwayTextures.push(t); return t;
  }
  function airport(definition: Airport) {
    const group = new THREE.Group(); root.add(group); airportGroups.push(group);
    box(1400, 1, 4200, grass, group, 0, -.6);
    box(64, .2, 3300, asphalt, group);
    for (const x of [-30, 30]) box(.9, .21, 3300, white, group, x, .1);
    for (let z = -1550; z <= 1550; z += 80) {
      box(1.5, .22, 32, white, group, 0, .12, z);
      for (const x of [-34, 34]) box(1.2, .7, 1.2, lights, group, x, .6, z);
    }
    for (const end of [-1, 1]) {
      for (let x = -25; x <= 25; x += 5) box(2, .23, 48, white, group, x, .14, end * 1510);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(20, 28), new THREE.MeshBasicMaterial({ map: runwayLabel(end === 1 ? '36' : '18'), transparent: true, depthWrite: false }));
      label.position.set(0, .25, end * 1420); label.rotation.x = -Math.PI / 2; if (end < 0) label.rotation.z = Math.PI; group.add(label);
      for (let j = 0; j < 10; j++) for (const x of [-4, 0, 4]) box(.8, .5, .8, lights, group, x, .5, end * (1700 + j * 35));
      for (const x of [-12, 12]) box(5, .23, 44, white, group, x, .14, end * 1180);
    }
    box(22, .15, 3000, concrete, group, 110); box(.6, .2, 2950, standard('#dabf73'), group, 110, .1);
    box(330, .15, 2800, concrete, group, 260);
    box(.65,.18,2600,standard('#e4c677'),group,190,.12,0);
    for (const z of [-1200, 0, 1200]) box(100, .15, 22, concrete, group, 70, 0, z);
    box(42, 22, 700, windowMat, group, 390, 11); box(53, 2, 720, white, group, 390, 23);
    for (let j = -3; j <= 3; j++) { box(70, 6, 10, concrete, group, 330, 7, j * 90); box(1.5, 22, 2, white, group, 368, 11, j * 90); }
    box(12, 42, 12, concrete, group, 280, 21, 460); box(27, 8, 27, windowMat, group, 280, 44, 460); box(29, 1, 29, white, group, 280, 49, 460);
    box(.5,10,.5,white,group,280,54,460);box(1,1,1,new THREE.MeshBasicMaterial({color:'#ff7060'}),group,280,59,460);
    const towerCanvas=document.createElement('canvas');towerCanvas.width=512;towerCanvas.height=128;const towerContext=towerCanvas.getContext('2d')!;towerContext.fillStyle='#dce8ef';towerContext.font='bold 56px Arial';towerContext.textAlign='center';towerContext.fillText(definition.id+' ATC',256,83);const towerTexture=new THREE.CanvasTexture(towerCanvas);towerTexture.colorSpace=THREE.SRGBColorSpace;runwayTextures.push(towerTexture);const towerSign=new THREE.Mesh(new THREE.PlaneGeometry(25,6),new THREE.MeshBasicMaterial({map:towerTexture,transparent:true,side:THREE.DoubleSide}));towerSign.position.set(266.4,43,460);towerSign.rotation.y=-Math.PI/2;group.add(towerSign);
    // Open-front parking hangars, ramp markings and service areas.
    const cladding=standard('#8e9ba4',.6),roofMat=standard('#586a76',.5),yellow=standard('#ecd27f');
    function groundText(label:string,x:number,z:number,w=20,h=12){const c=document.createElement('canvas');c.width=512;c.height=128;const ct=c.getContext('2d')!;ct.font='bold 78px Arial';ct.fillStyle='#edda96';ct.textAlign='center';ct.fillText(label,256,92);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;runwayTextures.push(texture);const sign=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));sign.position.set(x,.24,z);sign.rotation.x=-Math.PI/2;group.add(sign);}
    HANGARS.forEach((hangar,index)=>{
      const {x,z}=hangar;
      box(120,.15,120,concrete,group,x,.05,z);
      box(2,21,120,cladding,group,x+60,10.5,z);
      for(const side of [-1,1]){box(120,21,2,cladding,group,x,10.5,z+side*60);for(let k=-50;k<=50;k+=10)box(.6,20,1,white,group,x+k,10,z+side*61);}
      const roof=box(126,2,126,roofMat,group,x,22,z);roof.castShadow=true;
      box(2,4,120,cladding,group,x-60,19,z);box(2,22,4,white,group,x-61,11,z-57);box(2,22,4,white,group,x-61,11,z+57);
      box(108,.2,.6,yellow,group,x-25,.16,z);box(.6,.2,24,yellow,group,x-20,.16,z);
      groundText('H'+(index+1),x-95,z,18,10);
      const c=document.createElement('canvas');c.width=512;c.height=128;const ct=c.getContext('2d')!;ct.fillStyle='#e7edf1';ct.font='bold 57px Arial';ct.textAlign='center';ct.fillText('HANGAR '+(index+1),256,80);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;runwayTextures.push(texture);
      const label=new THREE.Mesh(new THREE.PlaneGeometry(35,6),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide}));label.position.set(x-61.1,19,z);label.rotation.y=-Math.PI/2;group.add(label);
      const lamp=new THREE.PointLight('#ffe3af',0,100,1.5);lamp.position.set(x-50,18,z);group.add(lamp);airportLamps.push(lamp);
    });
    for(const z of [-1200,0,1200]){box(100,.2,.6,yellow,group,60,.15,z);groundText('A',110,z+32,12,10);for(const off of [-2,2])box(.5,.21,24,yellow,group,48+off,.16,z);}
    for(let i=-3;i<=3;i++){const z=i*90;box(105,.2,.6,yellow,group,285,.16,z);box(.6,.2,22,yellow,group,320,.16,z);groundText('G'+(i+4),240,z+18,14,9);}
    const rubberMarks=standard('#1e2528');for(const end of [-1,1])for(const x of [-3,3])box(.6,.22,240,rubberMarks,group,x,.14,end*1000);
    for(let i=-5;i<=5;i++){const z=i*230;box(.4,17,.4,roofMat,group,450,8.5,z);box(5,.4,2,lights,group,450,17,z);}
    for(const x of [-680,680])for(let z=-2000;z<=2000;z+=80){box(.3,2,.3,cladding,group,x,1,z);box(.15,.08,80,cladding,group,x,1.6,z+40);}
    // Parked airport service vehicles, clear of the taxi centreline.
    for(let i=0;i<5;i++){const z=-300+i*120;box(3.2,1.6,6,white,group,425,1.5,z);box(2.9,1,2,windowMat,group,425,2.7,z-1.5);for(const side of [-1,1])for(const end of [-2,2]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.4,12),standard('#20252a'));wheel.rotation.z=Math.PI/2;wheel.position.set(425+side*1.65,.6,z+end);group.add(wheel);}}
    const beacon = new THREE.Group(); group.add(beacon); beaconGroups.push(beacon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(75, 1.4, 6, 64), new THREE.MeshBasicMaterial({ color: '#bfe8b0', transparent: true, opacity: .7, depthWrite: false }));
    ring.position.set(0, 90, 2900); beacon.add(ring);
    return group;
  }
  AIRPORTS.forEach(airport);
  const dummy = new THREE.Object3D();
  const instance = (geometry: THREE.BufferGeometry, material: THREE.Material, count: number, parent: THREE.Group, position: (i: number) => void) => {
    const mesh = new THREE.InstancedMesh(geometry, material, count); parent.add(mesh); mesh.castShadow = true; mesh.receiveShadow = true;
    for (let i = 0; i < count; i++) { dummy.rotation.set(0, 0, 0); position(i); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); }
    return mesh;
  };
  const facadeCanvas = document.createElement('canvas'); facadeCanvas.width = 128; facadeCanvas.height = 256;
  const fc = facadeCanvas.getContext('2d')!; fc.fillStyle = '#354c5c'; fc.fillRect(0, 0, 128, 256);
  for (let y = 2; y < 256; y += 10) for (let x = 2; x < 128; x += 10) { fc.fillStyle = random() > .4 ? '#d4c9a1' : '#476170'; fc.fillRect(x, y, 6, 6); }
  const facade = new THREE.CanvasTexture(facadeCanvas); facade.colorSpace = THREE.SRGBColorSpace;
  const towerMat = new THREE.MeshStandardMaterial({ map: facade, emissiveMap: facade, emissive: '#ffd99a', emissiveIntensity: 0, roughness: .38, metalness: .35 });
  function scenery(kind: Environment, x: number, z: number) {
    const group = new THREE.Group(); group.position.set(x,0,z); terrain.add(group);
    if (kind !== 'sea') box(22000, 1, 26000, grass, group, 0, -.65);
    if (kind === 'city') {
      instance(new THREE.BoxGeometry(1, 1, 1), towerMat, 520, group, i => {
        const h = 30 + Math.pow(random(), 2) * 310; dummy.position.set((i % 2 ? 1 : -1) * (850 + Math.floor(random() * 22) * 150), h / 2, -10000 + random() * 20000); dummy.scale.set(45 + random() * 45, h, 45 + random() * 45);
      });
      for (const x of [-700, 700, -1500, 1500]) box(24, .05, 24000, asphalt, group, x, -.02);
    } else if (kind === 'forest') {
      instance(new THREE.LatheGeometry([new THREE.Vector2(0,-.5),new THREE.Vector2(.9,-.38),new THREE.Vector2(.35,-.02),new THREE.Vector2(.7,-.1),new THREE.Vector2(.23,.25),new THREE.Vector2(.46,.18),new THREE.Vector2(0,.6)],8), treeMat, 4800, group, i => {
        const h = 12 + random() * 32; dummy.position.set((i % 2 ? 1 : -1) * (720 + random() * 6500), h / 2, (random() - .5) * 24000); dummy.scale.set(h * .28, h, h * .28);
      });
      instance(new THREE.SphereGeometry(1, 14, 10), grass, 45, group, i => {
        const h = 200 + random() * 450; dummy.position.set((i % 2 ? 1 : -1) * (5000 + random() * 6000), -h * .3, (random() - .5) * 26000); dummy.scale.set(900 + random() * 900, h, 1000 + random() * 1000);
      });
    } else {
      for (let i = 0; i < 12; i++) {
        const boat = new THREE.Group(); group.add(boat); boat.position.set((i % 2 ? 1 : -1) * (1300 + random() * 3500), 1, (random() - .5) * 20000); boat.rotation.y = random() * 3;
        box(24, 8, 120, standard('#334856'), boat); box(19, 8, 85, concrete, boat, 0, 8); box(16, 17, 18, white, boat, 0, 14, 40);
      }
    }
  }
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#f0f3f4', transparent: true, opacity: .5, depthWrite: false });
  const clouds = instance(new THREE.SphereGeometry(1, 12, 8), cloudMat, 240, root, i => {
    dummy.position.set((i % 2 ? 1 : -1) * (900 + random() * 6500), 1700 + random() * 1600, (random() - .5) * 24000); dummy.scale.set(180 + random() * 250, 50 + random() * 80, 150 + random() * 220);
  }); clouds.castShadow = false;
  const starPositions = new Float32Array(1500 * 3);
  for (let i = 0; i < 1500; i++) { const theta = random() * Math.PI * 2, y = random(); const r = Math.sqrt(1 - y * y); starPositions.set([Math.cos(theta) * r * 80000, y * 80000, Math.sin(theta) * r * 80000], i * 3); }
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPositions, 3)), new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, color: '#d7e4ff' })); root.add(stars);
  const count = 3500, positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) positions.set([(random() - .5) * 160, random() * 110, (random() - .5) * 160], i * 3);
  const flakeCanvas = document.createElement('canvas'); flakeCanvas.width = flakeCanvas.height = 32; const flakeContext = flakeCanvas.getContext('2d')!; const fade = flakeContext.createRadialGradient(16,16,1,16,16,15); fade.addColorStop(0,'#fff'); fade.addColorStop(.45,'#ffffffdd'); fade.addColorStop(1,'#ffffff00'); flakeContext.fillStyle=fade;flakeContext.fillRect(0,0,32,32);const flakeTexture=new THREE.CanvasTexture(flakeCanvas);
  const precipitation = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3)), new THREE.PointsMaterial({ map: flakeTexture, color: '#d5e9ef', size: .13, transparent: true, opacity: .55, depthWrite: false })); root.add(precipitation);
  let weather: Weather = 'clear', timeOfDay: TimeOfDay = 'day';
  function lighting() {
    const night = timeOfDay === 'night', sunset = timeOfDay === 'sunset', snow = weather === 'snow', wet = weather === 'rain' || weather === 'storm';
    sky.visible = !night; stars.visible = night && (weather === 'clear' || weather === 'cloudy');
    su.turbidity.value = weather === 'clear' ? 3 : wet ? 14 : 8; su.rayleigh.value = sunset ? 3 : 1.6; su.mieCoefficient.value = .005; su.mieDirectionalG.value = .8;
    su.sunPosition.value.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - (sunset ? 3 : 34)), -.75);
    asphalt.roughness = wet ? .25 : .9; asphalt.metalness = wet ? .2 : 0;
    grass.color.set(snow ? '#d9dfe1' : '#6c8662'); treeMat.color.set(snow ? '#9baea8' : '#345e46');
    waterMat.color.set(night ? '#102938' : wet ? '#496772' : '#307f91');
    airportLamps.forEach(l=>l.intensity=night?65:sunset?25:0);
    towerMat.emissiveIntensity = night ? .65 : sunset ? .18 : 0; windowMat.emissiveIntensity = night ? .4 : 0;
    cloudMat.color.set(night ? '#26394c' : wet ? '#98a4ad' : '#edf0f3'); cloudMat.opacity = weather === 'clear' ? .3 : .68;
    clouds.count = weather === 'clear' ? 80 : 240; lights.opacity = night ? 1 : .65;
    precipitation.visible = wet || snow; precipitation.material.size = snow ? .5 : .13; precipitation.material.opacity = snow ? .85 : .55;
    scene.background = new THREE.Color(night ? '#071321' : '#a9c5d4');
  }
  function disposeTerrain() {
    terrain.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); if (![grass, asphalt, concrete, white, towerMat, treeMat].includes(o.material)) (o.material as THREE.Material).dispose(); } }); terrain.clear();
  }
  return {
    route(route: Route) {
      activeRoute=route; disposeTerrain();
      AIRPORTS.forEach((a,i)=>{const p=airportPosition(route,a);airportGroups[i].position.set(p.x,0,p.z);beaconGroups[i].visible=a.id===route.to.id;
        random=createSeededRandom(terrainSeed+a.id.split('').reduce((n,c)=>n+c.charCodeAt(0),0));scenery(a.environment,p.x,p.z);
      });
      lighting();
    },
    seed(value:number){terrainSeed=value>>>0;this.route(activeRoute);},
    weather(value: Weather) { weather = value; lighting(); },
    timeOfDay(value: TimeOfDay) { timeOfDay = value; lighting(); },
    update(dt: number, time: number, camera: THREE.Camera) {
      sky.position.copy(camera.position); stars.position.copy(camera.position); clouds.position.z = camera.position.z;
      normal.offset.set(time * .0006, time * .0003);
      if (precipitation.visible) { precipitation.position.copy(camera.position); precipitation.position.y -= 35;
        for (let i = 0; i < count; i++) { positions[i * 3 + 1] -= dt * (weather === 'snow' ? 4 : 65); positions[i * 3] += dt * (weather === 'snow' ? Math.sin(time + i) * 2 : -6); if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] += 110; if (positions[i * 3] < -80) positions[i * 3] += 160; if (positions[i * 3] > 80) positions[i * 3] -= 160; }
        precipitation.geometry.attributes.position.needsUpdate = true;
      }
    },
    dispose() { grainTexture.dispose(); flakeTexture.dispose(); normal.dispose(); facade.dispose(); runwayTextures.forEach(t => t.dispose()); },
  };
}
