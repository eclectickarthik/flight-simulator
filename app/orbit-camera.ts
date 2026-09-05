import { AIRPORTS, HANGARS, airportPosition, clamp, type Route } from './dynamics';

type Point = { x: number; y: number; z: number };
type Bounds = { min: Point; max: Point };
const NORMAL_RADIUS = Math.hypot(48, 20, 58);
const NORMAL_ELEVATION = Math.asin(20 / NORMAL_RADIUS);
const INDOOR_RADIUS = 50;
const INDOOR_ELEVATION = Math.asin(8 / INDOOR_RADIUS);

export function createHangarCamera(route: Route) {
  const hangars = AIRPORTS.flatMap(airport => {
    const origin = airportPosition(route, airport);
    return HANGARS.map(h => ({ x: origin.x + h.x, z: origin.z + h.z }));
  });
  // Match the shed geometry, with clearance for the camera's near plane.
  const walls: Bounds[] = [];
  function box(x: number, y: number, z: number, w: number, h: number, d: number) {
    const pad = .6;
    walls.push({ min: { x: x-w/2-pad, y: y-h/2-pad, z: z-d/2-pad }, max: { x: x+w/2+pad, y: y+h/2+pad, z: z+d/2+pad } });
  }
  for (const h of hangars) {
    box(h.x+60, 10.5, h.z, 2, 21, 120);
    for (const side of [-1, 1]) {
      box(h.x, 10.5, h.z+side*60, 120, 21, 2);
      box(h.x-61, 11, h.z+side*57, 2, 22, 4);
    }
    box(h.x, 22, h.z, 126, 2, 126);
    box(h.x-60, 19, h.z, 2, 4, 120);
  }
  let manualZoom = false;
  function influence(target: Point) {
    let amount = 0;
    for (const h of hangars) {
      const outside = Math.hypot(Math.max(0, Math.abs(target.x-h.x)-60), Math.max(0, Math.abs(target.z-h.z)-60));
      const proximity = clamp(1-outside/35, 0, 1) * clamp((30-target.y)/9, 0, 1);
      amount = Math.max(amount, proximity*proximity*(3-2*proximity));
    }
    return amount;
  }
  function constrain(target: Point, offset: Point): Point {
    let fraction = 1;
    for (const wall of walls) {
      let entry = 0, leave = 1;
      for (const axis of ['x', 'y', 'z'] as const) {
        if (Math.abs(offset[axis]) < 1e-8) {
          if (target[axis] < wall.min[axis] || target[axis] > wall.max[axis]) { leave = -1; break; }
        } else {
          const a = (wall.min[axis]-target[axis])/offset[axis], b = (wall.max[axis]-target[axis])/offset[axis];
          entry = Math.max(entry, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
        }
      }
      if (entry <= leave && leave >= 0 && entry > 0) fraction = Math.min(fraction, entry);
    }
    if (offset.y < 0) fraction = Math.min(fraction, Math.max(0, (target.y-.8)/-offset.y));
    return { x: offset.x*fraction, y: offset.y*fraction, z: offset.z*fraction };
  }
  return {
    influence,
    constrain,
    reset() { manualZoom = false; },
    overrideZoom() { manualZoom = true; },
    update(target: Point, current: Point, dt: number, first = false, interacting = false): Point {
      const amount = influence(target);
      let result = { ...current };
      if (!manualZoom && !interacting) {
        const radius = Math.hypot(current.x, current.y, current.z) || NORMAL_RADIUS;
        const elevation = Math.asin(clamp(current.y/radius, -1, 1));
        const blend = first ? 1 : 1-Math.exp(-dt*3);
        const nextRadius = radius + (NORMAL_RADIUS+(INDOOR_RADIUS-NORMAL_RADIUS)*amount-radius)*blend;
        const nextElevation = elevation + (NORMAL_ELEVATION+(INDOOR_ELEVATION-NORMAL_ELEVATION)*amount-elevation)*blend;
        // Start on the open side of the shed; subsequent mouse orbiting keeps its azimuth.
        const azimuth = first && amount > .5 ? Math.atan2(-40, -30) : Math.atan2(current.x, current.z);
        result = { x: Math.sin(azimuth)*Math.cos(nextElevation)*nextRadius, y: Math.sin(nextElevation)*nextRadius, z: Math.cos(azimuth)*Math.cos(nextElevation)*nextRadius };
      }
      return constrain(target, result);
    },
  };
}
