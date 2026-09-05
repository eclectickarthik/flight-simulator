import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createAircraft, createCockpit } from './aircraft';
import { createEnvironment } from './environment';
import { createFlightAudio } from './audio';
import { createInputState, createSimulationClock } from './controls';
import { createHangarCamera } from './orbit-camera';
import { initialState, stepFlight, toggleGear, cycleFlaps, setEngine, setAutopilot, clamp, ROUTES, type FlightState, type Weather, type TimeOfDay, type Route, type View, type Practice } from './dynamics';
export type Telemetry = FlightState & { running: boolean; audioStatus: string };
export type SimHandle = ReturnType<typeof createFlight>;
export function createFlight(host: HTMLDivElement, update: (data: Telemetry) => void, callbacks: { onReady?: () => void; onError?: () => void } = {}) {
  const mobile = window.matchMedia('(pointer: coarse)').matches;
  let presented = false;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2('#aac8d4', .000075);
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.75)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 250000); scene.add(camera);
  const orbit = new OrbitControls(camera, renderer.domElement); orbit.enableDamping = true; orbit.enabled = true; orbit.minDistance = 2; orbit.maxDistance = 200; orbit.maxPolarAngle = Math.PI * .51; orbit.enablePan = false;
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(), envMap = pmrem.fromScene(room, .04); scene.environment = envMap.texture; scene.environmentIntensity = .45; room.dispose(); pmrem.dispose();
  const ambient = new THREE.HemisphereLight('#def0fc', '#526246', 2.1); scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff1dc', 3); sun.castShadow = true; sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, far: 600 }); sun.shadow.normalBias = .03; sun.shadow.bias = -.0002; scene.add(sun, sun.target);
  const environment = createEnvironment(scene), aircraft = createAircraft(), cockpit = createCockpit(camera); scene.add(aircraft.root);
  const landingLights = new THREE.SpotLight('#fff3d8', 0, 450, .27, .65, 1); landingLights.position.set(0, -.4, -8); landingLights.target.position.set(0, -8, -160); aircraft.root.add(landingLights, landingLights.target);
  let audioStatus = 'AI clips pending · synthesized fallback'; const audio = createFlightAudio(message => { audioStatus = message; emit(); });
  let route: Route = ROUTES[0], state = initialState(route, 'Parking'), running = true, rate = 1, mode: View = 'Orbit', weather: Weather = 'clear', timeOfDay: TimeOfDay = 'night';
  let raf = 0, last = performance.now(), lastUI = 0, first = true, disposed = false;
  let hangarCamera = createHangarCamera(route), orbitInteracting = false;
  const touchPointers = new Set<number>();
  const orbitStart = () => { orbitInteracting = true; };
  const orbitEnd = () => { orbitInteracting = false; };
  const manualZoom = () => { if (orbit.enabled) hangarCamera.overrideZoom(); };
  const pointerDown = (event: PointerEvent) => { if (event.pointerType === 'touch') { touchPointers.add(event.pointerId); if (touchPointers.size > 1) manualZoom(); } };
  const pointerUp = (event: PointerEvent) => { touchPointers.delete(event.pointerId); };
  orbit.addEventListener('start', orbitStart); orbit.addEventListener('end', orbitEnd);
  renderer.domElement.addEventListener('wheel', manualZoom, { passive: true });
  renderer.domElement.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointerup', pointerUp); window.addEventListener('pointercancel', pointerUp);
  const clock = createSimulationClock();
  const input = createInputState(), offset = new THREE.Vector3(), look = new THREE.Vector3(), previous = new THREE.Vector3();
  function emit() { if (!disposed) update({ ...state, running, audioStatus }); }
  function applyLighting() {
    const night = timeOfDay === 'night', sunset = timeOfDay === 'sunset', storm = weather === 'storm', wet = weather === 'rain' || storm, snow = weather === 'snow';
    sun.intensity = night ? .22 : storm ? .45 : wet || snow ? 1 : 3; ambient.intensity = night ? .38 : storm ? 1.2 : 2.1;
    sun.color.set(night ? '#99bbff' : sunset ? '#ffbb87' : '#fff1dc'); ambient.color.set(night ? '#57759e' : wet || snow ? '#bccbd6' : '#def0fc');
    scene.environmentIntensity = night ? .15 : .4; scene.fog!.color.set(night ? '#071321' : storm ? '#758592' : snow ? '#ccd5db' : wet ? '#9eafbc' : sunset ? '#caa49a' : '#aac8d4');
    (scene.fog as THREE.FogExp2).density = storm ? .00038 : snow ? .00025 : wet ? .00019 : .000055;
    renderer.toneMappingExposure = night ? .85 : 1.05; environment.weather(weather); environment.timeOfDay(timeOfDay);
  }
  environment.route(route); applyLighting();
  function pause() { orbitInteracting = false; touchPointers.clear(); running = false; clock.reset(); input.clear(); state.braking=state.parkingBrake; orbit.enabled=false; audio.update(state, false, weather, mode); emit(); }
  function practice(value: Practice) { state = initialState(route, value); input.clear(); clock.reset(); first = true; hangarCamera.reset(); audio.reset(state); emit(); }
  function press(key: string) {
    if(key==='f'||key==='p')setAutopilot(state,!state.autopilot,route);
    else if(key==='e')setEngine(state,!state.engineOn);
    else if(key==='v'){state.parkingBrake=!state.parkingBrake;state.braking=state.parkingBrake;}
    else {if(state.autopilot)setAutopilot(state,false,route);if(key==='l')toggleGear(state);else if(key==='g')cycleFlaps(state);else input.press(key);}
    emit();
  }
  const allowed = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 's', 'a', 'd', 'b', 'g', 'f', 'p', 'e', 'v', 'l', ' ', 'escape']);
  const normalized = (event: KeyboardEvent) => event.key.startsWith('Arrow') ? event.key : event.key.toLowerCase();
  function keydown(event: KeyboardEvent) {
    if(event.ctrlKey || event.metaKey || event.altKey)return;
    const key = normalized(event);
    if(key==='escape'){event.preventDefault();event.stopPropagation();if(event.repeat)return;if(running)pause();else if(!state.failed){running=true;orbit.enabled=mode==='Orbit';emit();}return;}
    if ((event.target as HTMLElement)?.closest('input:not([type=range]),select,textarea,[contenteditable=true]')) return;
    if((event.target as HTMLElement)?.closest('input[type=range]') && event.key.startsWith('Arrow'))return;
    if (!allowed.has(key)) return; event.preventDefault(); if(key===' ')event.stopPropagation(); if (event.repeat) return;
    press(key);
  }
  function keyup(event: KeyboardEvent) { const key=normalized(event);if(key===' '&&input.held.has(key)){event.preventDefault();event.stopPropagation();}input.release(key); }
  function visibility() { if (document.hidden) pause(); }
  window.addEventListener('keydown', keydown, {capture:true}); window.addEventListener('keyup', keyup, {capture:true}); window.addEventListener('blur', pause); document.addEventListener('visibilitychange', visibility);
  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, .1); last = now;
    const simDt = clock.advance(dt,running,rate,()=>{stepFlight(state,input.read(),1/60,route,weather);if(state.failed){running=false;input.clear();orbit.enabled=false;return false;}return true;});
    previous.copy(aircraft.root.position); aircraft.root.position.set(state.x, state.y, state.z); aircraft.root.rotation.set(state.pitch, -state.heading, state.bank, 'YXZ'); aircraft.update(state, state.time, simDt);
    aircraft.body.visible = mode !== 'Cockpit'; cockpit.root.visible = mode === 'Cockpit';
    if (mode === 'Orbit') {
      if (first) camera.position.copy(aircraft.root.position).add(offset.set(48, 20, -58));
      else camera.position.add(offset.copy(aircraft.root.position).sub(previous));
      orbit.target.copy(aircraft.root.position);
      if (running || first) {
        orbit.update();
        offset.copy(camera.position).sub(orbit.target);
        const framing = hangarCamera.update(orbit.target, offset, dt, first, orbitInteracting);
        camera.position.copy(orbit.target).add(offset.set(framing.x, framing.y, framing.z));
        camera.lookAt(orbit.target);
      }
    } else if (mode === 'Cockpit') {
      camera.position.copy(aircraft.root.position).add(offset.set(0, 1.05, -16.2).applyQuaternion(aircraft.root.quaternion)); camera.quaternion.copy(aircraft.root.quaternion); camera.rotateX(-.09);
    } else if (mode === 'Wing') {
      camera.position.copy(aircraft.root.position).add(offset.set(-2.4, .8, 3.7).applyQuaternion(aircraft.root.quaternion)); look.set(-24, .4, 6).applyQuaternion(aircraft.root.quaternion).add(aircraft.root.position); camera.lookAt(look);
    } else {
      offset.set(48, 20, -58).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -state.heading); camera.position.copy(aircraft.root.position).add(offset); camera.lookAt(aircraft.root.position);
    }
    first = false; sun.position.copy(aircraft.root.position).add(offset.set(-130, timeOfDay === 'sunset' ? 55 : 240, 100)); sun.target.position.copy(aircraft.root.position);
    landingLights.intensity = timeOfDay !== 'day' && state.gear > .5 ? 220 : 0;
    environment.update(simDt, state.time, camera); audio.update(state, running, weather, mode);
    if (now - lastUI > 100) { cockpit.update(state, state.time); emit(); lastUI = now; }
    try { renderer.render(scene, camera); }
    catch { pause(); callbacks.onError?.(); return; }
    if (!presented) { presented = true; callbacks.onReady?.(); }
    raf = requestAnimationFrame(frame);
  }
  function resize() { const w = host.clientWidth, h = host.clientHeight; camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); renderer.setSize(w, h); }
  const observer = new ResizeObserver(resize); observer.observe(host); resize(); raf = requestAnimationFrame(frame);
  return {
    play(value: boolean) { if (!value) pause(); else if (!state.failed) { running = true; orbit.enabled=mode==='Orbit'; emit(); } },
    practice,
    route(value: string) { const next = ROUTES.find(r => r.id === value); if (!next) return; route = next; hangarCamera = createHangarCamera(route); environment.route(route); practice('Parking'); },
    seed(value: number) { environment.seed(value); },
    rate(value: number) { rate = clamp(value, 1, 4); },
    camera(value: View) { hangarCamera.reset(); orbitInteracting = false; mode = value; orbit.enabled = running && value === 'Orbit'; first = true; },
    weather(value: Weather) { weather = value; applyLighting(); },
    timeOfDay(value: TimeOfDay) { timeOfDay = value; applyLighting(); },
    press,
    release(key: string) { input.release(key); },
    throttle(value: number) { if(state.autopilot)setAutopilot(state,false,route); state.throttle = state.engineOn ? clamp(value, 0, 1) : 0; emit(); },
    engine(value:boolean){setEngine(state,value);emit();},
    autopilot(value:boolean){setAutopilot(state,value,route);emit();},
    parkingBrake(value:boolean){state.parkingBrake=value;state.braking=value;emit();},
    sound(value: boolean) { return audio.enable(value); }, volume(value: number) { audio.volume(value); },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener('keydown', keydown, {capture:true}); window.removeEventListener('keyup', keyup, {capture:true}); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility);
      orbit.removeEventListener('start', orbitStart); orbit.removeEventListener('end', orbitEnd);
      renderer.domElement.removeEventListener('wheel', manualZoom); renderer.domElement.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointerup', pointerUp); window.removeEventListener('pointercancel', pointerUp);
      orbit.dispose(); audio.dispose(); aircraft.dispose(); cockpit.dispose(); environment.dispose(); envMap.dispose();
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Points) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) { materials.add(m); for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v); } } });
      geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
