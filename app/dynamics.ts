export type Weather = 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm';
export type Environment = 'sea' | 'city' | 'forest';
export type TimeOfDay = 'day' | 'sunset' | 'night';
export type View = 'Chase' | 'Orbit' | 'Cockpit' | 'Wing';
export type Practice = 'Parking' | 'Takeoff' | 'Cruise' | 'Landing';
export type Airport = { id: string; name: string; environment: Environment; x: number; z: number };
export const AIRPORTS: Airport[] = [
  { id: 'CBY', name: 'Coast Bay', environment: 'sea', x: 0, z: 0 },
  { id: 'MTC', name: 'Metro City', environment: 'city', x: 0, z: -24000 },
  { id: 'PNV', name: 'Pine Valley', environment: 'forest', x: 22000, z: -13500 },
];
export type Route = { id: string; from: Airport; to: Airport; distance: number };
const airportDistance = (a: Airport, b: Airport) => Math.hypot(a.x-b.x,a.z-b.z);
export const ROUTES: Route[] = [
  { id: 'coast-city', from: AIRPORTS[0], to: AIRPORTS[1], distance: airportDistance(AIRPORTS[0],AIRPORTS[1]) },
  { id: 'city-forest', from: AIRPORTS[1], to: AIRPORTS[2], distance: airportDistance(AIRPORTS[1],AIRPORTS[2]) },
  { id: 'forest-coast', from: AIRPORTS[2], to: AIRPORTS[0], distance: airportDistance(AIRPORTS[2],AIRPORTS[0]) },
];
// Rotate the shared world into the active route's frame: departure at 0, arrival north.
export function airportPosition(route: Route, airport: Airport) {
  const fx=(route.to.x-route.from.x)/route.distance,fz=(route.to.z-route.from.z)/route.distance;
  const dx=airport.x-route.from.x,dz=airport.z-route.from.z;
  return {x:-fz*dx+fx*dz,z:-(fx*dx+fz*dz)};
}
export function nearestAirport(route: Route, x: number, z: number) {
  return AIRPORTS.reduce((best,a)=>{const p=airportPosition(route,a),b=airportPosition(route,best);return Math.hypot(x-p.x,z-p.z)<Math.hypot(x-b.x,z-b.z)?a:best;},AIRPORTS[0]);
}
export function createSeededRandom(value: number) {
  let seed=value>>>0;
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const approach = (v: number, target: number, speed: number, dt: number) => v + (target - v) * (1 - Math.exp(-speed * dt));
export type ControlInput = { pitch: number; roll: number; rudder: number; throttle: number; brake: boolean };
export const emptyInput = (): ControlInput => ({ pitch: 0, roll: 0, rudder: 0, throttle: 0, brake: false });
export const HANGARS = [{x:330,z:950}, {x:330,z:-950}];
export const PARKING = {x:310,z:950};
export type FlightState = {
  engineOn: boolean; parkingBrake: boolean; braking: boolean; autopilot: boolean; autopilotPhase: string; taxiIndex: number;
  x: number; y: number; z: number; pitch: number; bank: number; heading: number;
  velocity: number; verticalSpeed: number; speed: number; altitude: number;
  thrust: number; throttle: number; gear: number; gearTarget: number; flaps: number; flapTarget: number;
  spoilers: number; onGround: boolean; arrived: boolean; failed: boolean; phase: string;
  time: number; distance: number; progress: number; bearing: number; eta: number | null;
  touchdown: number; touchdownStrength: number; aileron: number; elevator: number; rudder: number;
};
export function initialState(route: Route, practice: Practice = 'Takeoff'): FlightState {
  const cruising = practice === 'Cruise', landing = practice === 'Landing', parking = practice === 'Parking';
  const s: FlightState = {
    engineOn: !parking, parkingBrake: false, braking: false, autopilot: false, autopilotPhase: 'OFF', taxiIndex: 0,
    x: parking ? PARKING.x : 0, y: cruising ? 1250 : landing ? 324 : 3.9,
    z: cruising ? -route.distance * .4 : landing ? -route.distance + 7600 : parking ? PARKING.z : 1200,
    pitch: landing ? -.052 : 0, bank: 0, heading: parking ? Math.PI * 1.5 : 0, velocity: cruising ? 116 : landing ? 73 : 0,
    verticalSpeed: landing ? -3.8 : 0, speed: 0, altitude: 0,
    thrust: cruising ? .68 : landing ? .32 : parking ? 0 : .08, throttle: cruising ? .68 : landing ? .32 : 0,
    gear: cruising ? 0 : 1, gearTarget: cruising ? 0 : 1, flaps: cruising ? 0 : landing ? 1 : .5,
    flapTarget: cruising ? 0 : landing ? 1 : .5, spoilers: 0, onGround: !cruising && !landing,
    arrived: false, failed: false, phase: 'Ready for departure', time: 0, distance: 0, progress: 0,
    bearing: 0, eta: null, touchdown: 0, touchdownStrength: 0, aileron: 0, elevator: 0, rudder: 0,
  };
  telemetry(s, route); return s;
}
export function toggleGear(s: FlightState) { if (!s.onGround) s.gearTarget = 1 - s.gearTarget; }
export function cycleFlaps(s: FlightState) { s.flapTarget = s.flapTarget >= 1 ? 0 : s.flapTarget + .5; }
export function setEngine(s: FlightState, value: boolean) { s.engineOn = value; if (!value) { s.throttle = 0; s.autopilot = false; s.autopilotPhase = 'OFF'; } }
export function setAutopilot(s: FlightState, value: boolean, route: Route) {
  s.autopilot = value; s.taxiIndex = 0;
  if (!value) { s.autopilotPhase = 'OFF'; return; }
  s.engineOn = true; s.parkingBrake = false;
  s.autopilotPhase = s.onGround ? (s.touchdown > 0 && Math.abs(s.z + route.distance) < 2200 ? 'TAXI TO PARKING' : Math.abs(s.x) > 18 || s.z < 700 ? 'TAXI TO RUNWAY' : 'TAKEOFF') : 'FLIGHT';
}
const headingError = (target: number, actual: number) => Math.atan2(Math.sin(target-actual), Math.cos(target-actual));
export function autopilotInput(s: FlightState, route: Route): ControlInput {
  const input = emptyInput(); if (!s.autopilot || !s.engineOn || s.failed) return input;
  const remaining = s.z + route.distance;
  if (s.onGround) {
    if (s.autopilotPhase === 'FLIGHT' || s.autopilotPhase === 'APPROACH') s.autopilotPhase = 'ROLLOUT';
    if (s.autopilotPhase === 'ROLLOUT') {
      s.throttle = 0; input.brake = true;
      input.rudder = clamp(headingError(0, s.heading)*4 - s.x*.03, -1, 1);
      if(s.velocity < .5) {s.autopilotPhase = 'TAXI TO PARKING';s.taxiIndex=0;}
      return input;
    }
    if (s.autopilotPhase.startsWith('TAXI')) {
      const arrival = s.autopilotPhase === 'TAXI TO PARKING', base = arrival ? -route.distance : 0;
      const path = arrival ? [[0,0],[110,0],[110,950],[230,950],[PARKING.x,PARKING.z]] : [[190,s.z],[110,s.z],[110,1200],[0,1200]];
      const point=path[Math.min(s.taxiIndex,path.length-1)];const tx=point[0],tz=arrival ? point[1]+base : point[1];
      const distance=Math.hypot(tx-s.x,tz-s.z);
      if(distance<9){s.taxiIndex++;if(s.taxiIndex>=path.length){
        if(arrival){s.throttle=0;input.brake=true;if(s.velocity<.4){s.parkingBrake=true;s.autopilot=false;s.autopilotPhase='PARKED';}}
        else{s.autopilotPhase='ALIGN RUNWAY';}return input;
      }}
      const error=headingError(Math.atan2(tx-s.x,-(tz-s.z)),s.heading);
      input.rudder=clamp(error*2.2,-1,1);
      const targetSpeed=distance<25 || Math.abs(error)>.35 ? 2.5 : 6;
      s.throttle=clamp(.17+(targetSpeed-s.velocity)*.12,.0,.65);input.brake=s.velocity>targetSpeed+1;
      return input;
    }
    if(s.autopilotPhase==='ALIGN RUNWAY'){
      const error=headingError(0,s.heading); input.rudder=clamp(error*3,-1,1); s.throttle=.24; input.brake=s.velocity>2.5;
      if(Math.abs(error)<.05){s.autopilotPhase='TAKEOFF';} return input;
    }
    s.throttle=1;s.flapTarget=.5;s.gearTarget=1;
    input.rudder=clamp(headingError(0,s.heading)*5-s.x*.05,-1,1);
    input.pitch=s.velocity>61?clamp((.12-s.pitch)*6,-1,1):0;
    return input;
  }
  s.autopilotPhase=remaining<13000?'APPROACH':'FLIGHT';
  const targetSpeed=remaining<7000?73:remaining<13000?73+(remaining-7000)/6000*43:116;
  s.gearTarget=remaining<11000?1:0;s.flapTarget=remaining<7000?1:remaining<13000?.5:0;
  const targetHeight=Math.min(1250,Math.max(-3,(remaining-1200)*.052));
  const feedforward=remaining<25000 && remaining>1200?-s.velocity*.052:0;
  let vertical=clamp(feedforward+(targetHeight-(s.y-3.9))*.09,-8,14);
  if(remaining<1900 && s.y<25)vertical=-Math.max(.8,Math.min(2,(s.y-3.9)*.15));
  const targetPitch=Math.asin(clamp(vertical/Math.max(s.velocity,50),-.17,.22));
  input.pitch=clamp((targetPitch-s.pitch)*7,-1,1);
  const desiredHeading=Math.atan2(-s.x,Math.max(1000,Math.min(3500,remaining-1200)));
  input.roll=clamp(headingError(desiredHeading,s.heading)*3.5,-1,1);
  const drag=.00011*s.velocity*s.velocity+s.gear*.15+s.flaps*.32;
  s.throttle=clamp((drag+Math.sin(s.pitch)*2)/3+(targetSpeed-s.velocity)*.045,0,1);
  return input;
}
export function telemetry(s: FlightState, route: Route) {
  s.speed = s.velocity * 1.943844; s.altitude = Math.max(0, (s.y - 3.9) * 3.28084);
  s.distance = Math.hypot(s.x, s.z + route.distance);
  s.progress = clamp((1200 - s.z) / (route.distance + 1200), 0, 1);
  s.bearing = (Math.atan2(-s.x, -route.distance - s.z) * -180 / Math.PI + 180) % 360;
  // Ground-track closing speed: ETA disappears when flying away or nearly stationary.
  const vx = Math.sin(s.heading) * s.velocity, vz = -Math.cos(s.heading) * s.velocity;
  const closing = s.distance > 1 ? (-s.x * vx + (-route.distance - s.z) * vz) / s.distance : 0;
  s.eta = closing > 10 ? s.distance / closing : null;
  s.phase = s.failed ? 'Reset to try again' : s.onGround ? s.parkingBrake ? 'Parking brake set' : !s.engineOn && s.velocity<.5 ? 'Aircraft off · parked' : s.touchdown && s.velocity>25 ? 'Landing rollout' : s.velocity>25 ? 'Takeoff roll' : s.velocity>.5 ? 'Taxiing' : s.arrived ? 'Landed · free taxi' : 'Ready to taxi' : s.verticalSpeed>2 ? 'Climbing' : s.verticalSpeed< -1 ? 'Descending' : 'Cruising';
}
export function stepFlight(s: FlightState, input: ControlInput, dt: number, route: Route, weather: Weather) {
  if (s.failed) return;
  input = s.autopilot ? autopilotInput(s, route) : input;
  s.braking = input.brake || s.parkingBrake;
  s.time += dt;
  s.throttle = s.engineOn ? clamp(s.throttle + input.throttle * dt * .27, 0, 1) : 0;
  s.thrust = approach(s.thrust, s.engineOn ? Math.max(.06, s.throttle) : 0, .65, dt);
  s.gear = approach(s.gear, s.gearTarget, 1, dt); s.flaps = approach(s.flaps, s.flapTarget, .7, dt);
  s.aileron = approach(s.aileron, input.roll, 5, dt); s.elevator = approach(s.elevator, input.pitch, 5, dt); s.rudder = approach(s.rudder, input.rudder, 5, dt);
  s.bank = approach(s.bank, s.onGround ? 0 : -input.roll * .48, 1.8, dt);
  // Neutral stick holds pitch; assisted envelope limits make it easy to trim by hand.
  s.pitch = clamp(s.pitch + input.pitch * .16 * dt, -.18, .25);
  if (s.onGround && s.velocity < 60) s.pitch = approach(s.pitch, 0, 3, dt);
  const turn = s.onGround ? input.rudder * Math.min(s.velocity / 3, 1) * (.48 / (1 + s.velocity / 18)) : -Math.tan(s.bank) * 9.81 / Math.max(50, s.velocity) + input.rudder * .018;
  s.heading = (s.heading + turn * dt + Math.PI * 2) % (Math.PI * 2);
  const wet = weather === 'rain' || weather === 'storm', snow = weather === 'snow';
  const brake = s.onGround && s.braking ? (snow ? 2.3 : wet ? 3.3 : 4.5) : 0;
  const drag = .00011 * s.velocity * s.velocity + s.gear * .15 + s.flaps * .32;
  s.velocity = clamp(s.velocity + (s.thrust * 3.0 - drag - (s.onGround ? .16 : Math.sin(s.pitch) * 2) - brake) * dt, 0, 165);
  if (s.onGround && s.velocity > 64 - s.flaps * 7 && s.pitch > .055 && !s.braking) { s.onGround = false; s.verticalSpeed = 1.2; }
  if (!s.onGround) {
    const gust = weather === 'storm' ? Math.sin(s.time * 1.8) * .7 : 0;
    const stallSink = Math.max(0, 54 - s.flaps * 8 - s.velocity) * .3;
    const targetVertical = s.velocity * Math.sin(s.pitch) - stallSink + gust;
    s.verticalSpeed = approach(s.verticalSpeed, targetVertical, 1.8, dt);
    s.y += s.verticalSpeed * dt;
    if (s.y <= 3.9) {
      const onRunway = AIRPORTS.some(a=>{const p=airportPosition(route,a);return Math.abs(s.x-p.x)<33&&Math.abs(s.z-p.z)<1650;});
      s.touchdownStrength = Math.abs(s.verticalSpeed); s.touchdown++;
      s.failed = !onRunway || s.gear < .9 || s.verticalSpeed < -9 || Math.abs(s.bank) > .25;
      s.onGround = true; s.y = 3.9; s.verticalSpeed = 0; s.pitch = 0;
    }
  } else { s.y = 3.9; s.verticalSpeed = 0; }
  s.x += Math.sin(s.heading) * s.velocity * dt; s.z -= Math.cos(s.heading) * s.velocity * dt;
  s.spoilers = approach(s.spoilers, s.onGround && s.braking ? 1 : 0, 4, dt);
  if (s.onGround && Math.abs(s.x) < 33 && Math.abs(s.z + route.distance) < 1650 && s.velocity < 1 && s.touchdown > 0 && !s.failed) s.arrived = true;
  // Taxi freely across the airfield; leaving the painted runway is not a crash.
  if(s.onGround){const near=airportPosition(route,nearestAirport(route,s.x,s.z));
    const onAirfield=Math.abs(s.x-near.x)<700&&Math.abs(s.z-near.z)<2100;
    if(!onAirfield){s.velocity=Math.max(0,s.velocity-dt*3);}
  }
  telemetry(s, route);
}
