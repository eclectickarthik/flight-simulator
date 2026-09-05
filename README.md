# A320 Flight Deck

A browser flight simulator built with React, TypeScript and Three.js. Includes assisted manual flight, autopilot, three airports, a seed-based environment, selectable weather, day/night lighting, cockpit instruments, and engine/weather audio.

## Play locally

Use Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open the local URL printed in Terminal, then add `/flight` if desired. The existing Vinext preview supports both `/` and `/flight` and uses the same app as the static hosting build.

## Publish free on GitHub Pages

This repository includes the complete hosting workflow. It runs only when you click **Run workflow**, so uploading code does not publish automatically.

1. Open this repository's **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions → Publish flight simulator → Run workflow**, choose `main`, and click the green **Run workflow** button.
4. Wait for the build and deploy jobs to turn green.
5. Open `https://eclectickarthik.github.io/flight-simulator/flight/`.

The project root redirects to `flight/`. All scripts, styling and audio use relative paths so they also work with the custom-domain address below.

For future updates, push the changes and run the workflow again. No ElevenLabs key, Cloudflare token, or GitHub personal access token is needed in workflow secrets. GitHub provides the deployment workflow token automatically.

## Use eclectickarthik.tech/flight/

The intended address is `https://eclectickarthik.tech/flight/`.

If this domain already hosts another website, keep its existing DNS settings: `/flight` must be added to that site's host or routed there. DNS selects a host for the whole domain and cannot choose a host for just `/flight`.

If the domain is available to host this repository:

1. First get the default GitHub Pages URL above working.
2. In **Settings → Pages → Custom domain**, enter `eclectickarthik.tech` (no `https://` and no `/flight`) and save.
3. Sign in at get.tech and open the control panel for `eclectickarthik.tech`. Open **DNS Management → Manage DNS → A Records → Add A Record**. In this panel, leave **Host Name** blank for the main domain (it already shows the domain suffix). Add one record for each address below and keep the default TTL. Other DNS panels may use `@` for the same root-domain field:

   | Type | Host | Value |
   | --- | --- | --- |
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |

4. Optionally add `CNAME`, host `www`, value `eclectickarthik.github.io`. If get.tech says its DNS service is inactive, check **Name Server Details**: the domain must use those nameservers for records entered in this panel to take effect. If it already uses another DNS provider, add the records there instead.
5. Allow DNS and the HTTPS certificate to update. GitHub's **Enforce HTTPS** option can take up to 24 hours to become available; enable it when ready.
6. Open `https://eclectickarthik.tech/flight/`.

Do not add `/flight` to a DNS record. Leave email records alone. If you already have conflicting website records, check their purpose before replacing them.

Official instructions: [get.tech DNS records](https://controlpanel.tech/kb/servlet/KBServlet/faq471.html), [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [custom domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

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

Static deployment output is `dist-static/`, with the simulator under `flight/`. Deploy this directory using GitHub Pages or another static host. To inspect it locally, run `python3 -m http.server 3002 --bind 127.0.0.1 --directory dist-static` and open `http://127.0.0.1:3002/flight/`.

`npm run build` retains the existing Vinext build. Changes to either hosting configuration do not duplicate the simulator source.

This is an illustrative flight simulation, not a flight-training tool.
