# A320 Flight Deck

A browser flight simulator built with React, TypeScript and Three.js. Includes assisted manual flight, autopilot, three airports, a seed-based environment, selectable weather, day/night lighting, cockpit instruments, and engine/weather audio.

## Play locally

Use Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open the local URL printed in Terminal, then add `/flight-simulator` if desired. The existing Vinext preview supports both `/` and `/flight-simulator` and uses the same app as the static hosting build.

## Publish free on GitHub Pages

This repository includes the complete hosting workflow. It runs only when you click **Run workflow**, so uploading code does not publish automatically.

1. Open this repository's **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions → Publish flight simulator → Run workflow**, choose `main`, and click the green **Run workflow** button.
4. Wait for the build and deploy jobs to turn green.
5. Open `https://eclectickarthik.github.io/flight-simulator/`.

The repository name supplies the `/flight-simulator/` path on GitHub Pages. All scripts, styling and audio use relative paths. There is no homepage redirect.

For future updates, push the changes and run the workflow again. No ElevenLabs key, Cloudflare token, or GitHub personal access token is needed in workflow secrets. GitHub provides the deployment workflow token automatically.

## Add the game to your personal website

The intended address is **https://eclectickarthik.com/flight-simulator/**. The homepage at **https://eclectickarthik.com/** belongs to the personal website.

Cloudflare manages the domain. The hosting integration depends on where the personal website runs; domain registration alone does not determine that.

### If your personal website is not built yet

Keep this simulator repository as a separate project. When creating your personal site, use a repository named `eclectickarthik.github.io`, enable GitHub Pages there, and connect `eclectickarthik.com` to that personal site's Pages settings. Its root will be your homepage. This existing `flight-simulator` project can then inherit that domain at `/flight-simulator/`.

You can publish and try the simulator first at `https://eclectickarthik.github.io/flight-simulator/`, before building your personal site or changing DNS.

### If the personal website uses GitHub Pages

Keep the custom domain `eclectickarthik.com` on the **personal website's user-site repository** (`eclectickarthik.github.io`). Leave **Custom domain blank in this flight-simulator repository**. GitHub Pages project sites inherit the user site's domain and append the repository name, giving `/flight-simulator/`.

If the personal site is currently a different project repository rather than the user-site repository, this inheritance does not apply; integrate the simulator into that site's output instead.

### If the personal website uses Cloudflare Pages or another static host

Build with `npm run build:static`. Copy the **contents** of `dist-static/` into a `flight-simulator/` directory within the personal website's published output, then deploy the personal website through its normal process. The personal homepage and other folders remain in place.

If the personal website has application routing, ensure `/flight-simulator/` and its assets are served from that directory before any catch-all route. Requests to `/flight-simulator` should redirect to `/flight-simulator/` so relative asset URLs resolve correctly.

Do not replace the personal site's entire output with `dist-static/`: that would put the game on the homepage. Do not set this game repository's Custom domain to the personal domain. DNS cannot route individual paths; the host handles `/flight-simulator/`.

Official references: [GitHub Pages project-domain inheritance](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages), [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Cloudflare DNS management](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/).

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

Static deployment output is `dist-static/`, containing the simulator entry page and assets. GitHub Pages mounts it under the repository name; for a personal website, mount its contents under `/flight-simulator/` as described above. To inspect it locally, run `python3 -m http.server 3002 --bind 127.0.0.1 --directory dist-static` and open `http://127.0.0.1:3002/`.

`npm run build` retains the existing Vinext build. Changes to either hosting configuration do not duplicate the simulator source.

This is an illustrative flight simulation, not a flight-training tool.
