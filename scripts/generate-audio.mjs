// Run locally with: node --env-file=.env.local scripts/generate-audio.mjs
// The key stays in this preparation process; only audio files enter the app.
import { mkdir, writeFile, access } from 'node:fs/promises';
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('Configure ELEVENLABS_API_KEY in .env.local first.'); process.exit(1); }
const clips = [
  ['idle', 10, true, 'Steady Airbus A320neo twin turbofan engines idling, low deep turbine rumble and soft fan whine, close exterior perspective, constant power, clean isolated realistic field recording, no voices, no music.'],
  ['power', 10, true, 'Steady Airbus A320neo twin turbofan engines at takeoff thrust, powerful smooth broad low frequency roar and high fan whine, constant full power, realistic exterior recording, no voices, no music.'],
  ['airflow', 10, true, 'Steady smooth high speed airflow over an airliner fuselage, soft broadband wind hiss, realistic isolated recording, no voices, no music.'],
  ['roll', 10, true, 'Steady aircraft landing gear tires rolling fast on smooth airport asphalt, deep continuous wheel rumble with subtle runway vibration, no engines, no voices, no music.'],
  ['rain', 10, true, 'Steady rainfall hitting an aircraft windshield and metal fuselage, fine soft rain patter, realistic detailed close recording, no thunder, no voices, no music.'],
  ['touchdown', 2, false, 'One short realistic airliner main landing gear touchdown, brief tire chirp and low heavy thump followed by short rumble, no voices, no music.'],
  ['thunder', 6, false, 'One distant thunder rumble, low broad rolling atmospheric thunder fading naturally, no rain, no music, no voices.'],
];
await mkdir('public/audio', { recursive: true });
const manifest = {};
for (const [name, duration, loop, prompt] of clips) {
  const path = `public/audio/${name}.mp3`;
  let exists = false; try { await access(path); exists = true; } catch {}
  if (!exists) {
    const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: prompt, duration_seconds: duration, loop, model_id: 'eleven_text_to_sound_v2' }) });
    if (!response.ok) { console.error(`Generation stopped (${response.status}) for ${name}. Check account access and credits. No automatic retries.`); process.exit(1); }
    if (!response.headers.get('content-type')?.startsWith('audio/')) { console.error('Service returned an unexpected response.'); process.exit(1); }
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
  }
  manifest[name] = `/audio/${name}.mp3`; console.log(`${name}: ready`);
}
await writeFile('public/audio/manifest.json', JSON.stringify(manifest, null, 2));
console.log('Generated assets ready. Listen to all seven clips before marking AI audio complete.');
