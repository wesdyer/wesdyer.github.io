// Probe: a night venue's course overlays (start line, laylines, mark zones, rounding arrows,
// right-of-way triangles) in the real frame — the fleet at the start, and mid-race near a mark.
// Env LIFT=0 turns the night overlay lift off, for a before/after.
//   node regatta/eval/_night_overlays.js <outdir> [venue]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2] || '/tmp/night_overlays', venue = process.argv[3] || 'glowtide'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  await p.evaluate(async ({ venue, lift }) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue, soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    if (!lift) window.drawNightOverlayLift = () => {};
    let sd = 7; Math.random = () => { let t = sd += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    resetGame(); startRace(); window.requestAnimationFrame = () => 0;
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none';
    state.showNavAids = true; state.camera.mode = 'north';
    for (let i = 0; i < 30 * 25; i++) update(1 / 30); draw(); }, { venue, lift: process.env.LIFT !== '0' });
  await p.screenshot({ path: path.join(out, 'start.png') });
  await p.evaluate(() => { for (let i = 0; i < 30 * 30; i++) update(1 / 30); draw(); });
  await p.screenshot({ path: path.join(out, 'race.png') });
  console.log(errs.length ? errs[0] : 'no page errors'); await b.close(); })();
