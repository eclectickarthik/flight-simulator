// The optional static host build supplies this prefix; the local app uses root assets.
declare const __FLIGHT_BASE__: string;
export function publicAsset(path: string, base = typeof __FLIGHT_BASE__ === 'string' ? __FLIGHT_BASE__ : '/') {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\/+/, '')}`;
}
