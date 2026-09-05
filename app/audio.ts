import type { FlightState, Weather, View } from './dynamics';
import { publicAsset } from './assets';
type Clip = 'idle' | 'power' | 'airflow' | 'roll' | 'rain' | 'touchdown' | 'thunder';
type Layer = { source: AudioBufferSourceNode; gain: GainNode };
export function createFlightAudio(onStatus: (message: string) => void) {
  let ctx: AudioContext | undefined, master: GainNode, filter: BiquadFilterNode;
  let enabled = false, volume = .5, previousTouchdown = 0, nextThunder = 12, disposed = false;
  let assets: Partial<Record<Clip, AudioBuffer>> = {}, layers: Partial<Record<Clip, Layer>> = {};
  const nodes: AudioScheduledSourceNode[] = [];
  let synthetic: { engine: GainNode; wind: GainNode; rain: GainNode; rumble: GainNode; tones: OscillatorNode[] } | undefined;
  let loading: Promise<void> | undefined;
  function noise(frequency: number, type: BiquadFilterType) {
    const buffer = ctx!.createBuffer(1, ctx!.sampleRate * 4, ctx!.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx!.createBufferSource(), low = ctx!.createBiquadFilter(), gain = ctx!.createGain();
    source.buffer = buffer; source.loop = true; low.type = type; low.frequency.value = frequency; gain.gain.value = 0;
    source.connect(low).connect(gain).connect(filter); source.start(); nodes.push(source); return gain;
  }
  function init() {
    ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = 0; filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 16000;
    const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -12; limiter.ratio.value = 8; filter.connect(master).connect(limiter).connect(ctx.destination);
    const engine = ctx.createGain(); engine.gain.value = 0; engine.connect(filter); const tones: OscillatorNode[] = [];
    for (const ratio of [1, 1.016, 2, 3, 7.1]) { const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = 'sine'; osc.frequency.value = 40 * ratio; g.gain.value = .1 / Math.sqrt(ratio); osc.connect(g).connect(engine); osc.start(); nodes.push(osc); tones.push(osc); }
    synthetic = { engine, tones, wind: noise(1100, 'bandpass'), rain: noise(2300, 'highpass'), rumble: noise(250, 'lowpass') };
  }
  async function load() {
    try {
      const response = await fetch(publicAsset('/audio/manifest.json')); if (!response.ok) throw new Error('pending');
      const manifest = await response.json() as Record<string, unknown>;
      const clips: Clip[] = ['idle', 'power', 'airflow', 'roll', 'rain', 'touchdown', 'thunder'];
      const buffers = await Promise.all(clips.map(async key => {
        if (typeof manifest[key] !== 'string' || !manifest[key].startsWith('/audio/')) throw new Error('Missing sound');
        const response = await fetch(publicAsset(manifest[key] as string)); if (!response.ok) throw new Error('Missing sound');
        return [key, await ctx!.decodeAudioData(await response.arrayBuffer())] as const;
      }));
      if (disposed) return;
      assets = Object.fromEntries(buffers);
      for (const key of ['idle', 'power', 'airflow', 'roll', 'rain'] as Clip[]) {
        const source = ctx!.createBufferSource(), gain = ctx!.createGain(); source.buffer = assets[key]!; source.loop = true; gain.gain.value = 0;
        source.connect(gain).connect(filter); source.start(); nodes.push(source); layers[key] = { source, gain };
      }
      onStatus('AI sound · ElevenLabs');
    } catch { if (!disposed) onStatus('Synthesized sound · AI clips pending'); }
  }
  function oneShot(key: Clip, strength: number) {
    if (!ctx || !enabled) return;
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    if (assets[key]) source.buffer = assets[key]!;
    else { const length = key === 'thunder' ? 3 : .45, buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate), data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / data.length * 7) * .2; source.buffer = buffer; }
    gain.gain.value = strength; source.connect(gain).connect(filter); source.start(); source.onended = () => { source.disconnect(); gain.disconnect(); };
  }
  return {
    async enable(value: boolean) {
      enabled = value;
      if (!value) { if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, .05); return; }
      if (!ctx) init(); await ctx!.resume(); if (ctx!.state !== 'running') throw new Error('Click sound again to allow audio.');
      loading ??= load(); await loading;
    },
    volume(value: number) { volume = Math.max(0, Math.min(1, value)); },
    reset(s: FlightState) { previousTouchdown = s.touchdown; nextThunder = s.time + 12; },
    update(s: FlightState, running: boolean, weather: Weather, view: View) {
      if (!ctx) return;
      const now = ctx.currentTime, inside = view === 'Cockpit', rain = weather === 'rain' ? .25 : weather === 'storm' ? .45 : 0;
      const target = (node: GainNode, value: number) => node.gain.setTargetAtTime(value, now, .25);
      target(master, enabled && running ? volume * (inside ? .6 : 1) : 0);
      filter.frequency.setTargetAtTime(inside ? 1500 : 15000, now, .3);
      const ai = Boolean(layers.idle);
      if (synthetic) {
        target(synthetic.engine, ai ? 0 : s.thrust * .6);
        synthetic.tones.forEach((tone, i) => tone.frequency.setTargetAtTime((38 + s.thrust * 98) * [1, 1.016, 2, 3, 7.1][i], now, .35));
        target(synthetic.rumble, ai ? 0 : s.thrust * .34 + (s.onGround ? s.velocity / 450 : 0));
        target(synthetic.wind, ai ? 0 : s.velocity / 650); target(synthetic.rain, ai ? 0 : rain);
      }
      const gains = { idle: .5 * (1 - s.thrust) * Math.min(1,s.thrust*15), power: s.thrust * .82, airflow: s.velocity / 210, roll: s.onGround ? s.velocity / 140 : 0, rain };
      for (const key of Object.keys(gains) as (keyof typeof gains)[]) if (layers[key]) { target(layers[key]!.gain, gains[key]); if (key === 'power' || key === 'idle') layers[key]!.source.playbackRate.setTargetAtTime(.85 + s.thrust * .3, now, .35); }
      if (running && s.touchdown > previousTouchdown) oneShot('touchdown', Math.min(.9, .3 + s.touchdownStrength / 14));
      if (running && weather === 'storm' && s.time >= nextThunder) { oneShot('thunder', .5); nextThunder = s.time + 18; }
      previousTouchdown = s.touchdown;
    },
    dispose() { disposed = true; nodes.forEach(n => { try { n.stop(); n.disconnect(); } catch {} }); void ctx?.close(); assets = {}; layers = {}; },
  };
}
