// One-shot: turn a venue's GENERATED drifting ice into hand-placed ice in its document.
//
//   node regatta/eval/_bake_ice.js [venue] [--write]
//
// Random ice is going away for document venues — a designed venue should say where its
// ice is. Rather than emptying Glacier Sound and asking someone to redraw 54 floes, this
// captures the layout the generator was already producing and writes it in as authored
// outlines, which are then editable like anything else.
//
// The shapes come from the real generator at the real seed, so the venue keeps the look it
// had; what changes is that it is now written down instead of re-rolled per race.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VENUE = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]) || 'arctic';
const WRITE = process.argv.includes('--write');
const SEED = 90210;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForTimeout(500);

    const out = await page.evaluate(({ venue, seed }) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue }));
        const real = Math.random;
        Math.random = mulberry32(seed);
        try { resetGame(); } finally { Math.random = real; }
        const floes = (state.course.islands || []).filter(f => f.isFloe && !f.authored);
        // The AUTHORED form is a world-space outline. `localArt` is the drawn shape around
        // the floe's own centre, which is exactly that once translated.
        return {
            n: floes.length,
            ice: floes.map((f, i) => ({
                id: `ice-${i + 1}`,
                outer: f.localArt.map(p => [
                    Math.round((f.x + p.x) * 1000) / 1000,
                    Math.round((f.y + p.y) * 1000) / 1000
                ])
            }))
        };
    }, { venue: VENUE, seed: SEED });

    await browser.close();

    const file = `regatta/assets/venues/${VENUE}.venue.js`;
    if (!fs.existsSync(file)) { console.error(`No document at ${file}`); process.exitCode = 1; return; }
    const text = fs.readFileSync(file, 'utf8');
    const key = `window.VENUE_DOC[${JSON.stringify(VENUE)}] = `;
    const head = text.slice(0, text.indexOf('window.VENUE_DOC'));
    const doc = JSON.parse(text.slice(text.indexOf(key) + key.length).trim().replace(/;$/, ''));

    const verts = out.ice.reduce((a, f) => a + f.outer.length, 0);
    console.log(`${VENUE}: ${out.n} generated floes at seed ${SEED} -> ${verts} authored vertices`);
    if (!WRITE) { console.log('Pass --write to bake them in.'); return; }

    doc.ice = out.ice;
    if (doc.seeded) delete doc.seeded.ice;
    const js = head + 'window.VENUE_DOC = window.VENUE_DOC || {};\n'
             + key + JSON.stringify(doc, null, 2) + ';\n';
    fs.writeFileSync(file, js);
    console.log(`Wrote ${file} (${(js.length / 1024).toFixed(1)} KB)`);
})();
