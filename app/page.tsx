'use client';
import { useEffect, useRef, useState } from 'react';
import { Plane, Play, Pause, RotateCcw, Camera, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Volume2, VolumeX, Maximize2, Sun, Moon, CloudRain, Snowflake, Cloud, CloudLightning, Settings2, Navigation, Power } from 'lucide-react';
import { FlightMap, CockpitInstruments } from './instruments';
import type { SimHandle, Telemetry } from './flight';
import { initialState, ROUTES, type Weather, type TimeOfDay, type View, type Practice } from './dynamics';
const weatherOptions = [ ['clear', 'Summer', Sun], ['cloudy', 'Cloudy', Cloud], ['rain', 'Rain', CloudRain], ['snow', 'Snow', Snowflake], ['storm', 'Storm', CloudLightning] ] as const;
const times = [ ['day', 'Day', Sun], ['sunset', 'Sunset', Sun], ['night', 'Night', Moon] ] as const;
function minutes(seconds: number | null) { if (seconds === null) return '—'; return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
export default function Home() {
  const mount = useRef<HTMLDivElement>(null), sim = useRef<SimHandle | null>(null);
  const [data, setData] = useState<Telemetry>({ ...initialState(ROUTES[0], 'Parking'), running: true, audioStatus: 'AI clips pending · synthesized fallback' });
  const [routeId, setRouteId] = useState(ROUTES[0].id), [weather, setWeather] = useState<Weather>('clear'), [time, setTime] = useState<TimeOfDay>('night');
  const [view, setView] = useState<View>('Orbit'), [rate, setRate] = useState(1), [audio, setAudio] = useState(true), [volume, setVolume] = useState(50);
  const [sideOpen, setSideOpen] = useState(true), [bottomOpen, setBottomOpen] = useState(true), [error, setError] = useState(''), [ready, setReady] = useState(false), [soundBusy, setSoundBusy] = useState(false);
  const audioWanted=useRef(true),audioStarted=useRef(false);
  const [loadingStage,setLoadingStage]=useState('Downloading flight simulator…');
  const [audioNeedsGesture,setAudioNeedsGesture]=useState(true),[seed,setSeed]=useState('94'),[appliedSeed,setAppliedSeed]=useState(94);
  const route = ROUTES.find(r => r.id === routeId)!;
  useEffect(() => {
    let active=true;
    if (window.matchMedia('(max-width: 950px), (pointer: coarse)').matches) setSideOpen(false);
    void (async () => {
      try {
        const { createFlight } = await import('./flight');
        if (!active) return;
        setLoadingStage('Preparing aircraft and airports…');
        // Let the loading surface paint before the synchronous scene construction.
        await new Promise(resolve => setTimeout(resolve, 32));
        if (!active) return;
        sim.current=createFlight(mount.current!,setData, {
          onReady: () => { if(active)setReady(true); },
          onError: () => { if(active)setError('The 3D scene could not start. Try reloading in a browser with WebGL enabled.'); },
        });
      } catch { if(active)setError('The simulator could not load. Check your connection and reload; a browser with WebGL is required.'); }
    })();
    const unlock=async()=>{if(!audioWanted.current || audioStarted.current || !sim.current)return;audioStarted.current=true;try{await sim.current.sound(true);if(active)setAudioNeedsGesture(false);}catch{audioStarted.current=false;}};
    window.addEventListener('pointerdown',unlock,{capture:true});window.addEventListener('keydown',unlock,{capture:true});
    return()=>{active=false;window.removeEventListener('pointerdown',unlock,{capture:true});window.removeEventListener('keydown',unlock,{capture:true});sim.current?.dispose();};
  }, []);
  function applySeed(value:number){if(!Number.isInteger(value)||value<0||value>4294967295)return;setSeed(String(value));setAppliedSeed(value);sim.current?.seed(value);}
  const hold = (key: string) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); sim.current?.press(key); },
    onPointerUp: () => sim.current?.release(key), onPointerCancel: () => sim.current?.release(key), onLostPointerCapture: () => sim.current?.release(key),
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); sim.current?.press(key); } },
    onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); sim.current?.release(key); } },
    onBlur: () => sim.current?.release(key),
  });
  async function toggleAudio() { if(soundBusy)return;const enabled=!audioWanted.current;audioWanted.current=enabled;setAudio(enabled);setSoundBusy(true);try{await sim.current?.sound(enabled);if(enabled){audioStarted.current=true;setAudioNeedsGesture(false);}}catch{audioStarted.current=false;setAudioNeedsGesture(true);}finally{setSoundBusy(false);} }
  return <main className={`flight-app ${sideOpen ? 'side-open' : ''} ${bottomOpen ? 'bottom-open' : ''} ${view === 'Cockpit' ? 'cockpit-view' : ''}`}>
    <div ref={mount} className="world" />
    {!ready && <div className="loading-screen" aria-busy={!error}>
      <Plane size={32} aria-hidden="true"/><h1>A320 Flight Deck</h1>
      <p role={error ? 'alert' : 'status'}>{error || loadingStage}</p>
      {!error && <div className="loading-track" role="progressbar" aria-label="Loading flight simulator"><span /></div>}
      <small>{error ? 'Your flight will restart when you reload.' : 'First visits can take longer. Preparing your flight.'}</small>
      {error && <button onClick={() => window.location.reload()}>Reload simulator</button>}
    </div>}
    <header className="flight-header"><div className="brand"><Plane size={21} /><span>FLIGHT DECK<small>A320neo · Airbus livery</small></span></div><span className="mode-badge"><i /> {data.autopilot ? `Autopilot / ${data.autopilotPhase}` : 'MANUAL / ASSISTED'}</span></header>
    <div className="session-controls"><button className={data.autopilot ? 'selected' : ''} aria-label="Autopilot" title="Autopilot (F)" aria-pressed={data.autopilot} disabled={!ready || data.failed} onClick={() => sim.current?.autopilot(!data.autopilot)}>Autopilot <span>{data.autopilot ? 'On' : 'Off'}</span><kbd>F</kbd></button><button className="global-pause" disabled={!ready || data.failed} onClick={() => sim.current?.play(!data.running)} aria-label={data.running ? 'Pause entire simulation' : 'Resume entire simulation'}>{data.running ? <Pause size={16} /> : <Play size={16} />}{data.running ? 'Pause' : 'Resume'}<kbd>Esc</kbd></button><button className="settings-button" aria-expanded={sideOpen} aria-controls="environment-content" aria-label={sideOpen ? 'Close settings' : 'Open settings'} onClick={() => setSideOpen(!sideOpen)}><Settings2 size={17}/><span>Settings</span></button></div>
    {!data.running && !data.failed && <div className="pause-banner" role="status">SIMULATION PAUSED<span>Aircraft, weather, and sound are paused.</span></div>}
    <section className="route-hud" aria-label="Flight progress"><span className="eyebrow">{route.from.name} <span className="route-arrow">→</span> {route.to.name}</span><div className="status-line"><i className={data.failed ? 'danger' : ''} /><strong>{data.phase}</strong></div><p>{!ready ? 'Preparing aircraft…' : data.failed ? 'Use a practice button to reset your aircraft.' : !data.running ? 'Use Resume at the top to continue the whole simulation.' : data.autopilot ? `Autopilot: ${data.autopilotPhase.toLowerCase()} · flying, gear & flaps handled` : data.onGround ? !data.engineOn ? 'Aircraft On to start · Autopilot can taxi and fly for you' : data.parkingBrake ? 'Release parking brake to taxi · A / D steer · B brakes' : 'Taxi: low throttle · A / D steer · B brakes · H1/H2 parking' : `Destination ${data.bearing.toFixed(0).padStart(3, '0')}° · Runway 36`}</p></section>
    {view !== 'Cockpit' && <FlightMap state={data} route={route} />}
    {error && ready && <div className="error" role="alert">{error}<button aria-label="Dismiss message" onClick={() => setError('')}>×</button></div>}
    <div className="view-controls"><button onClick={() => { const views: View[] = ['Chase', 'Orbit', 'Wing', 'Cockpit']; const next = views[(views.indexOf(view) + 1) % views.length]; setView(next); sim.current?.camera(next); }}><Camera size={17} />{view}</button>{view !== 'Cockpit' && <button onClick={() => {setView('Cockpit');sim.current?.camera('Cockpit');}}>Cockpit controls</button>}<button aria-label="Toggle fullscreen" onClick={() => { const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); void action?.catch(() => setError('Fullscreen is unavailable in this preview.')); }}><Maximize2 size={17} /></button></div>
    <aside className={`environment-panel glass ${sideOpen ? '' : 'minimized'}`} aria-label="Environment settings">

      <div id="environment-content" className="side-content" hidden={!sideOpen}>
        <div className="panel-heading"><span className="eyebrow">FLIGHT SETUP</span><h2>Your surroundings</h2></div>
        <section><h3>Airport route</h3><div className="route-options">{ROUTES.map(r => <button key={r.id} className={r.id === routeId ? 'selected' : ''} aria-pressed={r.id === routeId} onClick={() => { setRouteId(r.id); sim.current?.route(r.id); }}><span>{r.from.name} <ChevronRight size={14} /> {r.to.name}</span><small>{(r.distance / 1000).toFixed(2)} km · {r.from.environment === 'sea' ? 'Coastal' : r.from.environment === 'city' ? 'City' : 'Forest'} to {r.to.environment === 'sea' ? 'coast' : r.to.environment}</small></button>)}</div><p className="setting-note">Three airports · 20–30 km apart · all with ATC<br />Changing route resets your flight.</p></section>
        <section><h3>Terrain seed</h3><form className="seed-form" onSubmit={e=>{e.preventDefault();applySeed(Number(seed));}}><label htmlFor="terrain-seed">Seed number</label><div><input id="terrain-seed" type="number" min="0" max="4294967295" step="1" required value={seed} onChange={e=>setSeed(e.target.value)}/><button type="submit">Generate</button></div><button type="button" onClick={()=>applySeed(crypto.getRandomValues(new Uint32Array(1))[0])}>New seed</button></form><p className="setting-note">Seed {appliedSeed} · same seed, same terrain.<br/>Airports and runways stay in place.</p></section>
        <section><h3>Weather</h3><div className="option-grid">{weatherOptions.map(([id, label, Icon]) => <button className={id === weather ? 'selected' : ''} aria-pressed={id === weather} key={id} onClick={() => { setWeather(id); sim.current?.weather(id); }}><Icon size={17} />{label}</button>)}</div></section>
        <section><h3>Time of day</h3><div className="time-options">{times.map(([id, label, Icon]) => <button className={id === time ? 'selected' : ''} aria-pressed={id === time} key={id} onClick={() => { setTime(id); sim.current?.timeOfDay(id); }}><Icon size={17} />{label}</button>)}</div></section>
        <section><h3>Engine & weather sound</h3><button className="sound-toggle" aria-pressed={audio} disabled={soundBusy || !ready} onClick={toggleAudio}>{audio ? <Volume2 size={18} /> : <VolumeX size={18} />}{soundBusy ? 'Loading sound…' : audio ? 'Sound on' : 'Enable sound'}</button><label className="volume">Volume <input aria-label="Sound volume" type="range" min="0" max="100" value={volume} onChange={e => { const v = Number(e.target.value); setVolume(v); sim.current?.volume(v / 100); }} /><span>{volume}%</span></label><p className="setting-note">{audio && audioNeedsGesture ? 'Sound on · starts with your first tap or click.' : data.audioStatus}</p></section>
        <p className="touch-help">Touch controls: hold arrows to pitch / roll, hold A / D to steer, and slide throttle. Hold Brakes to stop. Drag the scene to orbit; pinch to zoom. Landscape gives you more room.</p>
        <details className="control-help"><summary>Keyboard controls</summary><p>↑ Nose down · ↓ Nose up<br />← / → Bank left / right<br />A / D Rudder & ground steering<br />W / S Throttle up / down<br />Space / B Hold brakes · L Landing gear<br />G Cycle flaps · F Autopilot<br />E Aircraft on/off · V Parking brake<br />Esc Pause / resume entire simulation</p></details>
      </div>
    </aside>
    <section className={`console glass ${bottomOpen ? '' : 'minimized'}`} aria-label="Flight controls and instruments">
      <button className="console-toggle" aria-label={bottomOpen ? 'Minimize flight controls' : 'Open flight controls'} aria-expanded={bottomOpen} aria-controls="console-content" onClick={() => setBottomOpen(!bottomOpen)}>{bottomOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}<span>{bottomOpen ? 'Minimize flight controls' : `Flight controls · ${data.speed.toFixed(0)} kt · ${data.altitude.toFixed(0)} ft`}</span></button>
      <div id="console-content" hidden={!bottomOpen}>
        {view === 'Cockpit' && <CockpitInstruments state={data} route={route} onAutopilot={() => sim.current?.autopilot(!data.autopilot)} onEngine={() => sim.current?.engine(!data.engineOn)} onParkingBrake={() => sim.current?.parkingBrake(!data.parkingBrake)} />}
        <div className="telemetry"><div><span>AIRSPEED</span><strong>{data.speed.toFixed(0)}<small>KT</small></strong></div><div><span>ALTITUDE</span><strong>{data.altitude.toFixed(0)}<small>FT</small></strong></div><div><span>HEADING</span><strong>{(Math.round(data.heading * 180 / Math.PI) % 360).toString().padStart(3, '0')}<small>°</small></strong></div><div><span>VERTICAL SPEED</span><strong>{Math.round(data.verticalSpeed * 196.85)}<small>FPM</small></strong></div><div><span>DISTANCE LEFT</span><strong>{(data.distance / 1000).toFixed(2)}<small>KM</small></strong></div><div><span>ARRIVAL IN</span><strong>{minutes(data.eta)}</strong></div></div>
        <div className="route-progress" role="progressbar" aria-label="Route progress" aria-valuenow={Math.round(data.progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${data.progress * 100}%` }} /></div>
        <div className="manual-controls"><div className="stick-controls"><button {...hold('ArrowLeft')} aria-label="Bank left">←</button><div><button {...hold('ArrowUp')} aria-label="Nose down">↑</button><button {...hold('ArrowDown')} aria-label="Nose up">↓</button></div><button {...hold('ArrowRight')} aria-label="Bank right">→</button><span>Pitch / roll</span></div>
          <div className="rudder-controls"><div><button {...hold('a')} aria-label="Rudder left">A</button><button {...hold('d')} aria-label="Rudder right">D</button></div><span>Steer / rudder</span></div>
          <label className="throttle"><span>THROTTLE <b>{Math.round(data.throttle * 100)}%</b></span><input aria-label="Engine throttle" type="range" min="0" max="100" disabled={!data.engineOn} value={Math.round(data.throttle * 100)} onChange={e => sim.current?.throttle(Number(e.target.value) / 100)} /><small>W / S</small></label>
          <div className="configuration"><button onClick={() => sim.current?.press('l')} disabled={data.onGround} title={data.onGround ? 'Gear stays down while on the ground' : 'Toggle gear (L)'}><span>L · GEAR</span><strong>{Math.abs(data.gear - data.gearTarget) > .05 ? 'MOVING' : data.gearTarget ? 'DOWN' : 'UP'}</strong></button><button onClick={() => sim.current?.press('g')}><span>G · FLAPS</span><strong>{Math.round(data.flapTarget * 30)}°</strong></button><button className={`brakes ${data.braking ? 'selected' : ''}`} aria-label="Space or B — hold brakes" aria-pressed={data.braking} {...hold('b')}><kbd>Space / B</kbd><strong>BRAKES</strong></button><button aria-label="Toggle parking brake" aria-pressed={data.parkingBrake} className={data.parkingBrake ? 'selected' : ''} onClick={() => sim.current?.parkingBrake(!data.parkingBrake)}><span>V · PARK</span><strong>{data.parkingBrake ? 'SET' : 'RELEASED'}</strong></button></div>
        </div>
        <div className="console-bottom"><div className="phase-controls">{(['Parking', 'Takeoff', 'Cruise', 'Landing'] as Practice[]).map((phase, i) => <button key={phase} disabled={!ready} onClick={() => sim.current?.practice(phase)}><span className="phase-number">0{i + 1}</span>{phase}</button>)}</div><div className="playback"><button title="Reset flight" aria-label="Reset flight" onClick={() => sim.current?.practice('Parking')}><RotateCcw size={17} /></button><button aria-label="Change simulation speed" onClick={() => { const next = rate === 1 ? 2 : rate === 2 ? 4 : 1; setRate(next); sim.current?.rate(next); }}>{rate}×</button><button className={`play engine-power ${data.engineOn ? 'engine-running' : ''}`} aria-pressed={data.engineOn} aria-label={data.engineOn ? 'Turn aircraft off' : 'Turn aircraft on'} disabled={!ready} onClick={() => sim.current?.engine(!data.engineOn)}><Power size={16} />{data.engineOn ? 'Aircraft On' : 'Aircraft Off'}<kbd>E</kbd></button></div></div>
      </div>
    </section>
    <footer><span><Navigation size={12} /> {(route.distance / 1000).toFixed(2)} KM SCENIC ROUTE</span><span>Illustrative simulation · Not for flight training</span></footer>
  </main>;
}
