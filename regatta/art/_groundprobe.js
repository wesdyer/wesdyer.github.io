// Render-check land KINDS without touching any venue file on disk. Injects one blob of each
// named kind beside the start line, in memory only, and screenshots.
//
//   node regatta/art/_groundprobe.js out.png                       # ocean, its own set
//   node regatta/art/_groundprobe.js out.png lake forestfloor lakesand gneiss
const { chromium } = require('playwright');
const path = require('path');

const OUT = process.argv[2] || '/tmp/grounds.png';
const VENUE = process.argv[3] || 'ocean';
const KINDS = process.argv.slice(4).length ? process.argv.slice(4)
                                           : ['tropicscrub', 'coralrock', 'tropicsand'];

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

  await page.evaluate((v) => { settings.venue = v; resetGame(); startRace(); }, VENUE);
  await page.waitForTimeout(6000);
  const at = await page.evaluate(() => {
    const me = state.boats.find(b => b.isPlayer) || state.boats[0];
    return { x: me.x, y: me.y };
  });

  const info = await page.evaluate(({ x, y, blobSrc, kinds, venue }) => {
    const blob = eval(blobSrc);
    const doc = window.VENUE_DOC[venue];
    const n = kinds.length;
    const spots = kinds.map((k, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return blob(x + Math.cos(a) * 360, y + Math.sin(a) * 360, 190, k, 'probe-' + k);
    });
    doc.shapes = doc.shapes.filter(s => !String(s.id).startsWith('probe-')).concat(spots);
    resetGame(); startRace();
    return state.course.islands.filter(i => String(i.id).startsWith('probe-'))
      .map(i => `${i.id} kind=${i.kind} style=${i.style} soft=${i.soft}`);
  }, { ...at, blobSrc, kinds: KINDS, venue: VENUE });

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
