// DID THE COURSE MOVE, OR ONLY THE SAILING?
//
//   node regatta/eval/_geomcheck.js
//
// `npm run trace` reports one number — "N behaviour changes" — and that number goes up for
// two completely different reasons: geometry moved, or the boats sail it differently. When
// two people work the repo at once (a venue change here, an AI change there) that is the
// first question to settle, and guessing it from a diff of boat positions is hopeless.
//
// The golden carries BOTH hashes, so this asks only the geometry one. All identical means
// every course is exactly where it was and the divergence is in how it is raced — which is
// what an archetype or physics change looks like, and is not a reason to re-record.

const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const golden = JSON.parse(fs.readFileSync('regatta/eval/golden/traces.json', 'utf8'));
(async () => {
    const browser = await chromium.launch();
    const HARNESS = fs.readFileSync('regatta/eval/trace_harness.js', 'utf8');
    let geomSame = 0, geomDiff = [], behSame = 0, behDiff = 0;
    for (const venue of Object.keys(golden.venues)) {
        for (const seed of Object.keys(golden.venues[venue]).slice(0, 2)) {
            const page = await browser.newPage();
            await page.goto('file://' + path.resolve('regatta/index.html'));
            await page.addScriptTag({ content: HARNESS });
            await page.evaluate(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), venue);
            const r = await page.evaluate(([sd]) => {
                window.resetGame();
                return { geom: window.traceHarness.hashCourseGeom() };
            }, [+seed]);
            await page.close();
            const g = golden.venues[venue][seed];
            if (r.geom === g.courseGeomHash) geomSame++;
            else geomDiff.push(`${venue}/${seed}: ${g.courseGeomHash} -> ${r.geom}`);
        }
    }
    await browser.close();
    console.log(`course geometry identical: ${geomSame}`);
    console.log(geomDiff.length ? 'MOVED:\n  ' + geomDiff.join('\n  ') : 'no course moved');
})();
