// ONE-TIME: rewrite every venue document from land[] + ice[] to a single ordered shapes[].
//
//   node regatta/art/to_shapes.js
//
// Runs in a page so it calls the REAL VenueDoc.shapes(), rather than a second copy of the
// migration that could drift from it — the mistake the mask exporter made once already.
// Idempotent: a document already in shapes[] form is rewritten unchanged.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ORDER = ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean', 'redrock', 'glowtide',
               'arctic', 'seatrials'];

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => { console.error('PAGE ERROR:', e.message); process.exit(1); });
    await page.goto('file://' + path.resolve('regatta/index.html'));

    for (const venue of ORDER) {
        const out = await page.evaluate((v) => {
            const doc = JSON.parse(JSON.stringify(window.VENUE_DOC[v]));
            const shapes = window.VenueDoc.shapes(doc);
            delete doc.land; delete doc.ice;
            // `shapes` sits where `land` was: geography, then the course laid on it.
            const rebuilt = {};
            for (const k of Object.keys(doc)) {
                rebuilt[k] = doc[k];
                if (k === 'world') rebuilt.shapes = shapes;
            }
            if (!rebuilt.shapes) rebuilt.shapes = shapes;
            const counts = {};
            for (const s of shapes) counts[s.kind] = (counts[s.kind] || 0) + 1;
            return { doc: rebuilt, counts, n: shapes.length };
        }, venue);

        const file = path.resolve(`regatta/assets/venues/${venue}.venue.js`);
        const head = fs.readFileSync(file, 'utf8').split('\n')
            .filter(l => l.startsWith('//')).join('\n');
        fs.writeFileSync(file, head + '\n'
            + 'window.VENUE_DOC = window.VENUE_DOC || {};\n'
            + `window.VENUE_DOC[${JSON.stringify(venue)}] = ${JSON.stringify(out.doc, null, 2)};\n`);
        console.log(`${venue.padEnd(10)} ${String(out.n).padStart(3)} shapes   `
            + Object.entries(out.counts).map(([k, n]) => `${k} ${n}`).join(', '));
    }
    await browser.close();
})();
