import { writeFile } from 'node:fs/promises';
// Root link keeps the default GitHub Pages address useful; the app lives in /flight/.
await writeFile('dist-static/index.html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./flight/"><title>A320 Flight Deck</title></head><body><a href="./flight/">Open A320 Flight Deck</a></body></html>');
await writeFile('dist-static/.nojekyll', '');
