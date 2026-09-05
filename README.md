# A320 Flight Deck

A browser flight simulator built with React, TypeScript and Three.js. Includes assisted manual flight, autopilot, three airports, a seed-based environment, selectable weather, day/night lighting, cockpit instruments, and engine/weather audio.

## Play locally

Use Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open the preview address printed by the development server.

## Hosting

The included GitHub Pages workflow runs manually from the repository's Actions tab. Select GitHub Actions as the Pages publishing source, then run **Publish flight simulator**.

Keep account-specific domains, repository links, preview addresses, and deployment details out of this README. Manage the deployed address in the hosting provider's settings.

The static build uses relative asset paths and can be mounted within another website. When integrating it, copy the build output into the intended project directory in that website's published output.

No ElevenLabs key is required by the hosted application. GitHub provides the deployment workflow token automatically.

## Phone and tablet controls

Settings and Map/HUD start collapsed on small/touch devices. Use Settings to read the touch instructions. Landscape provides more room; the bottom flight panel scrolls when necessary.

- Tap **Aircraft Off** to turn the engines on. The parking brake starts released.
- Hold arrow buttons to pitch and roll; hold **A / D** to steer or use rudder.
- Slide **Throttle** to change engine power. Hold **Brakes** to stop.
- Tap **Gear**, **Flaps**, **Park**, or **Autopilot** to change their state.
- Drag the scene in Orbit view; pinch to zoom.
- **Pause** pauses the entire simulation. Switching away also pauses and releases held controls.
- Audio starts with the first tap/click after loading, subject to the browser's audio permission.

Touch devices use lower pixel and shadow resolution. Performance depends on the phone's GPU and browser; actual phone performance has not been measured. No keyboard or device-motion permission is required.

## Loading

The first visit downloads the app and 3D engine, then constructs the aircraft and scenery. The loading bar is indeterminate rather than a fabricated percentage. It disappears after the first rendered 3D frame. Download/startup failures show a reload action. Cached assets can make later visits faster.

## Audio and secrets

Current audio uses synthesized engine and weather sounds. AI-generated clips remain pending until they are generated and reviewed.

To prepare reusable ElevenLabs clips privately, create `.env.local` with your `ELEVENLABS_API_KEY`, then run:

```bash
node --env-file=.env.local scripts/generate-audio.mjs
```

This consumes your ElevenLabs service credits. Only the resulting `public/audio` files and manifest should be committed. Never commit `.env.local` or prefix the key with `VITE_`. The deployed game needs no live ElevenLabs requests and no API key.

## Build and checks

```bash
npm test
npx tsc --noEmit
npm run build:static
```

Static deployment output is `dist-static/`. The existing Vinext build remains available through `npm run build`. Both builds use the same simulator source.

This is an illustrative flight simulation, not a flight-training tool.
