// Render-check the two new land kinds WITHOUT touching any venue file on disk.
// Loads the game on `ocean`, finds the start line, injects one blob of each new kind
// beside it IN MEMORY ONLY, restarts and screenshots the water.
//
//   node regatta/art/_groundprobe.js /tmp/grounds.png
const { chromium } = require('playwright');
const path = require('path');

const OUT = process.argv[2] || '/tmp/grounds.png';

const blobSrc = `
  (cx, cy, r, kind, id) => {
    const outer = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rr = r * (0.74 + 0.30 * ((Math.sin(i * 2.7) + Math.sin(i * 5.1)) * 0.5 + 0.5));
      outer.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return { id, kind, outer, holes: [] };
  }`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts.ready);

  // 1. start a race on ocean and find where the fleet begins
  await page.evaluate(() => { settings.venue = 'ocean'; resetGame(); startRace(); });
  await page.waitForTimeout(6000);
  const at = await page.evaluate(() => {
    const me = state.boats.find(b => b.isPlayer) || state.boats[0];
    return { x: me.x, y: me.y };
  });

  // 2. inject the probes beside the line, in memory only, and restart
  const info = await page.evaluate(({ x, y, blobSrc }) => {
    const blob = eval(blobSrc);
    const doc = window.VENUE_DOC.ocean;
    doc.shapes = doc.shapes.filter(s => !String(s.id).startsWith('probe-')).concat([
      // A bar UNDER each sand island, so the sand-to-bar transition is visible: the
      // tropicshoal must read as the same beach continuing under the water, and the
      // plain `shoal` beside it must stay tan.
      blob(x, y + 330, 300, 'tropicshoal', 'probe-tropicshoal'),
      blob(x + 330, y - 300, 300, 'shoal', 'probe-shoal'),
      blob(x - 330, y - 300, 165, 'tropicscrub', 'probe-scrub'),
      blob(x, y + 330, 165, 'tropicsand', 'probe-sand'),
    ]);
    // Trees, so the whole chain gets exercised: kind -> sprite path -> plane -> draw.
    // The two canopy species sit at the sand's waterline where a hull passes under them;
    // the surface-plane almond sits inland on the scrub.
    doc.props = (doc.props || []).filter(p => !String(p.id).startsWith('probe-')).concat([
      { id: 'probe-palm-a',   kind: 'ocean-palm-coconut',    x: x - 100, y: y + 270 },
      { id: 'probe-palm-b',   kind: 'ocean-palm-coconut',    x: x + 10,  y: y + 250 },
      { id: 'probe-pand-a',   kind: 'ocean-pandanus',        x: x + 105, y: y + 300 },
      { id: 'probe-pand-b',   kind: 'ocean-pandanus',        x: x - 95,  y: y + 385 },
      // Same distance from the camera as the two canopy species, so the ONLY thing that
      // differs is the plane: this one is `surface` and must NOT fade.
      { id: 'probe-almond',   kind: 'ocean-almond-tropical', x: x + 20,  y: y + 390 },
    ]);
    resetGame(); startRace();
    const land = state.course.islands
      .filter(i => String(i.id).startsWith('probe-'))
      .map(i => `${i.id} kind=${i.kind} style=${i.style} soft=${i.soft}`);
    const reg = window.VenueDoc.PROP_KINDS;
    const props = (state.course.props || []).filter(p => String(p.id).startsWith('probe-'))
      .map(p => `${p.id} ${p.kind} plane=${reg[p.kind].plane} world=${reg[p.kind].world}`);
    return land.concat(props);
  }, { ...at, blobSrc });

  await page.waitForTimeout(7000);
  await page.evaluate(() => {
    for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT });

  console.log(info.join('\n'));
  console.log('ERRORS', errors.length ? errors.slice(0, 6) : 'none');
  await browser.close();
})();
