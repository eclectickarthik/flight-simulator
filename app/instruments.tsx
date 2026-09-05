'use client';
import { useEffect, useId, useState } from 'react';
import { Map, ChevronDown, ChevronUp } from 'lucide-react';
import { AIRPORTS, airportPosition, nearestAirport, HANGARS, clamp, type FlightState, type Route } from './dynamics';

export function FlightMap({ state, route, embedded = false }: { state: FlightState; route: Route; embedded?: boolean }) {
  const [open,setOpen]=useState(true),[scale,setScale]=useState<'airports'|'ground'|'route'>('airports'),[selected,setSelected]=useState<string|null>(null);
  useEffect(() => { if(!embedded && window.matchMedia('(max-width: 950px), (pointer: coarse)').matches)setOpen(false); }, [embedded]);
  const local=scale==='ground';
  const airport=AIRPORTS.find(a=>a.id===selected)??nearestAirport(route,state.x,state.z);
  const base=airportPosition(route,airport);
  const sites=AIRPORTS.map(a=>({...a,...airportPosition(route,a)}));
  const minX=Math.min(state.x,...sites.map(a=>a.x)),maxX=Math.max(state.x,...sites.map(a=>a.x));
  const minZ=Math.min(state.z,...sites.map(a=>a.z)),maxZ=Math.max(state.z,...sites.map(a=>a.z));
  const factor=local?204/4500:Math.min(222/(maxX-minX+7000),174/(maxZ-minZ+7000));
  const horizontalFactor=local?.18:factor;
  const centreX=local?base.x+180:(minX+maxX)/2,centreZ=local?base.z:(minZ+maxZ)/2;
  const project=(x:number,z:number)=>({x:140+(x-centreX)*horizontalFactor,y:120+(z-centreZ)*factor});
  const ground=(x:number,z:number)=>project(x+base.x,z+base.z);
  const point=project(state.x,state.z),clip=useId();
  function rect(x:number,z:number,w:number,d:number){const p=ground(x,z);return{x:p.x-w*horizontalFactor/2,y:p.y-d*factor/2,width:w*horizontalFactor,height:d*factor};}
  const selectAirport=(id:string)=>{setSelected(id);setScale('ground');};
  return <section className={`${embedded?'embedded-map':'flight-map glass'} ${open?'':'map-minimized'}`} aria-label="Navigation map">
    {!embedded&&<button className="map-heading" aria-expanded={open} onClick={()=>setOpen(!open)}><Map size={15}/>Map / HUD {open?<ChevronDown size={14}/>:<ChevronUp size={14}/>}</button>}
    <div hidden={!open}>
      <div className="map-scales">{(['airports','ground','route'] as const).map(v=><button key={v} className={scale===v?'selected':''} aria-pressed={scale===v} onClick={()=>{setScale(v);if(v==='ground')setSelected(null);}}>{v==='airports'?'Airports':v==='ground'?'Ground':'Route'}</button>)}</div>
      <svg viewBox="0 0 280 240" role="img" aria-label={local?`${airport.name} airport map with runway, taxiway, hangars, ATC tower and your aircraft`:'All three airports: Coast Bay, Metro City and Pine Valley, with ATC towers and aircraft position'}>
        <defs><clipPath id={clip}><rect x="10" y="14" width="260" height="212" rx="6"/></clipPath></defs>
        <rect width="280" height="240" fill="#081b22" rx="6"/>
        <g stroke="#25404a" strokeWidth=".6">{[40,80,120,160,200,240].map(x=><path key={x} d={`M${x} 14V226 M10 ${x}H270`}/>)}</g>
        <g clipPath={`url(#${clip})`}>
          {local?<>
            <rect {...rect(100,0,1250,4150)} fill="#283d36"/><rect {...rect(260,0,330,2800)} fill="#536169"/><rect {...rect(110,0,22,3000)} fill="#a49663"/>
            {[-1200,0,1200].map(z=><rect key={z} {...rect(60,z,100,22)} fill="#a49663"/>)}
            <rect {...rect(0,0,64,3300)} fill="#83949c" stroke="#e1e9e9" strokeWidth=".7"/>
            <line x1={ground(0,0).x} y1={ground(0,-1600).y} x2={ground(0,0).x} y2={ground(0,1600).y} stroke="#fff" strokeDasharray="4 4"/>
            <rect {...rect(390,0,42,700)} fill="#9db3bc"/><text x={ground(420,0).x} y={ground(420,0).y} fill="#c8d6dc" fontSize="8">GATES</text>
            {HANGARS.map((h,i)=><g key={i}><rect {...rect(h.x,h.z,120,120)} fill="#e3c692"/><text x={ground(h.x,h.z).x+14} y={ground(h.x,h.z).y+3} fill="#e3c692" fontSize="9">H{i+1}</text></g>)}
            <circle cx={ground(280,460).x} cy={ground(280,460).y} r="3" fill="#88cfee"/><text x={ground(280,460).x+6} y={ground(280,460).y+3} fill="#88cfee" fontSize="9">ATC</text>
            <text x={ground(0,1720).x-8} y={ground(0,1720).y} fill="#e4eded" fontSize="9">36</text><text x={ground(0,-1740).x-8} y={ground(0,-1740).y} fill="#e4eded" fontSize="9">18</text>
          </>:<>
            {sites.flatMap((a,i)=>sites.slice(i+1).map(b=>{const p=project(a.x,a.z),q=project(b.x,b.z);const active=[a.id,b.id].includes(route.from.id)&&[a.id,b.id].includes(route.to.id);return <g key={a.id+b.id}><path d={`M${p.x} ${p.y}L${q.x} ${q.y}`} stroke={active?'#c3eeb4':'#59777d'} strokeWidth={active?1.8:1} strokeDasharray={active?'5 4':'2 4'}/><text x={(p.x+q.x)/2+5} y={(p.y+q.y)/2-5} fill={active?'#dbf2d3':'#a1b7c0'} fontSize="9">{(Math.hypot(a.x-b.x,a.z-b.z)/1000).toFixed(2)} km</text></g>;}))}
            {sites.map(a=>{const p=project(a.x,a.z);return <g key={a.id} role="button" tabIndex={0} aria-label={`View ${a.name} airport ground map`} onClick={()=>selectAirport(a.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectAirport(a.id);}}} className="airport-map-marker"><title>{`${a.name} · ATC tower · runway 18/36`}</title><circle cx={p.x} cy={p.y} r="11" fill="#152f39" stroke="#91c3b0"/><path d={`M${p.x-2} ${p.y-7}v14m4-14v14`} stroke="#d4ebe2" strokeWidth="1.5"/><text x={p.x} y={p.y-16} textAnchor="middle" fill="#edf4f1" fontSize="11">{a.id}</text><text x={p.x} y={p.y+23} textAnchor="middle" fill="#8fcae3" fontSize="8">ATC</text></g>;})}
          </>}
          <g transform={`translate(${clamp(point.x,18,262)} ${clamp(point.y,22,218)}) rotate(${state.heading*180/Math.PI})`}><circle r="10" fill="#9cdbb8" opacity=".13"/><path d="M0 -9 L7 7 L0 4 L-7 7Z" fill="#c9f5bb" stroke="#071c22" strokeWidth="1.3"/></g>
        </g>
        <text x="17" y="27" fill="#e5eeee" fontSize="10">N ↑</text><text x="17" y="230" fill="#adc2ca" fontSize="9">{local?'AIRPORT DIAGRAM':scale==='route'?`${(route.distance/1000).toFixed(2)} KM ACTIVE ROUTE`:'3 AIRPORTS · 20–30 KM APART'}</text>
      </svg>
      <div className="map-caption"><span>{local?airport.name:'CBY · MTC · PNV'}</span><strong>{local?'Runway 18 / 36':`${(state.distance/1000).toFixed(2)} km left`}</strong></div>
      <p className="map-legend">{local?'H1 / H2 Hangars · ATC Tower · yellow = taxiway':'Select an airport marker for its ground map.'}</p>
    </div>
  </section>;
}
export function CockpitInstruments({ state, route, onAutopilot, onEngine, onParkingBrake }: { state: FlightState; route: Route; onAutopilot: () => void; onEngine: () => void; onParkingBrake: () => void }) {
  const horizon = useId();
  return <div className="cockpit-instruments" aria-label="Cockpit instrument panel">
    <section className="pfd-screen"><h3>PRIMARY FLIGHT DISPLAY</h3><svg viewBox="0 0 300 170" role="img" aria-label={`Attitude pitch ${(state.pitch*180/Math.PI).toFixed(0)} degrees, bank ${(state.bank*180/Math.PI).toFixed(0)} degrees`}>
      <defs><clipPath id={horizon}><rect x="55" y="15" width="190" height="128" rx="6"/></clipPath></defs>
      <g clipPath={`url(#${horizon})`}><g transform={`translate(150 82) rotate(${state.bank*180/Math.PI}) translate(0 ${state.pitch*220})`}><rect x="-250" y="-250" width="500" height="250" fill="#286b97"/><rect x="-250" y="0" width="500" height="250" fill="#8e6844"/><path d="M-250 0H250" stroke="#eee"/>{[-30,-15,15,30].map(y=><path key={y} d={`M-22 ${y}H22`} stroke="#e1e8e9"/>)}</g></g>
      <path d="M96 82h32l10 6 12-6 12 6 10-6h32" fill="none" stroke="#f2d071" strokeWidth="3"/>
      <text x="29" y="70" textAnchor="middle" fill="#aac1cc" fontSize="10">KT</text><text x="29" y="92" textAnchor="middle" fill="#eaf3f5" fontSize="19">{state.speed.toFixed(0)}</text>
      <text x="271" y="70" textAnchor="middle" fill="#aac1cc" fontSize="10">FT</text><text x="271" y="92" textAnchor="middle" fill="#eaf3f5" fontSize="17">{state.altitude.toFixed(0)}</text>
      <text x="150" y="12" textAnchor="middle" fill="#b9efb5" fontSize="10">{state.autopilot ? state.autopilotPhase : 'MANUAL FLIGHT'}</text>
      <text x="150" y="163" textAnchor="middle" fill="#e7eeee" fontSize="12">HDG {Math.round(state.heading*180/Math.PI)%360}° · VS {Math.round(state.verticalSpeed*196.85)}</text>
    </svg></section>
    <FlightMap state={state} route={route} embedded />
    <section className="engine-screen"><h3>ENGINE / SYSTEMS</h3><div className="engine-dials">{[1,2].map(i=><div key={i}><svg viewBox="0 0 100 78"><path d="M20 62A37 37 0 1 1 80 62" fill="none" stroke="#314a4d" strokeWidth="5"/><path d="M20 62A37 37 0 1 1 80 62" fill="none" stroke="#bce7a5" strokeWidth="5" pathLength="100" strokeDasharray={`${state.thrust*100} 100`}/><text x="50" y="43" textAnchor="middle" fill="#d8efdc" fontSize="19">{Math.round(state.thrust*100)}%</text><text x="50" y="62" textAnchor="middle" fill="#a9bdc6" fontSize="9">ENG {i}</text></svg></div>)}</div><p>{state.engineOn ? 'ENGINES RUNNING' : 'ENGINES OFF'}<span>GEAR {state.gearTarget?'DOWN':'UP'} · FLAPS {Math.round(state.flapTarget*30)}°</span></p></section>
    <section className="cockpit-switches"><h3>FLIGHT CONTROL UNIT</h3><button aria-pressed={state.autopilot} className={state.autopilot?'selected':''} onClick={onAutopilot}>Autopilot <strong>{state.autopilot?'ON':'OFF'}</strong></button><button aria-pressed={state.engineOn} onClick={onEngine}>ENG MASTER <strong>{state.engineOn?'ON':'OFF'}</strong></button><button aria-pressed={state.parkingBrake} className={state.parkingBrake?'selected':''} onClick={onParkingBrake}>PARK BRAKE <strong>{state.parkingBrake?'SET':'RELEASED'}</strong></button></section>
  </div>;
}
