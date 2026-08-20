// DEFLECTION-PUSH PROBE: frame timeline for one scenario seed straight
// from the lab recording — positions, range, tack/tacking, role/risk/dev,
// the recorded pair rights, and penalties.
//
//   node regatta/eval/rl/_scen_timeline.js "Rule 13 Both" <seed> [stepFrames]
const { chromium } = require('playwright');
const { newLabPage } = require('../_drive');

const name = process.argv[2];
const seedWant = process.argv[3] ? Number(process.argv[3]) : null;
const step = process.argv[4] ? Number(process.argv[4]) : 30;
if (!name) { console.error('usage: _scen_timeline.js "<scenario>" [seed] [step]'); process.exit(2); }

(async () => {
    const browser = await chromium.launch();
    const page = await newLabPage(browser);
    const out = await page.evaluate(({ n, s }) => {
        window.__LAB.testAPI.load(n);
        window.__LAB.testAPI.run();
        const seeds = window.__LAB.seeds.map(x => x >>> 0);
        const seed = s != null && seeds.includes(s) ? s : seeds[0];
        const rec = window.__LAB.recs[seed];
        return { seed, names: rec.names, nF: rec.nF, pens: rec.pens,
                 frames: rec.frames.map(f => ({ boats: f.boats, pairs: f.pairs })) };
    }, { n: name, s: seedWant });
    await browser.close();

    console.log(`${name} seed ${out.seed} — ${out.nF + 1} frames, boats ${out.names.join(',')}`);
    console.log('penalties: ' + (out.pens.length
        ? out.pens.map(p => `${out.names[p.boat] || p.boat} ${p.rule || p.kind}@${p.t.toFixed(1)}s`).join(', ') : 'none'));
    const DEG = 180 / Math.PI;
    for (let f = 0; f <= out.nF; f += step) {
        const fr = out.frames[f];
        const t = (f / 60).toFixed(1);
        const bits = fr.boats.map((b, i) =>
            `${out.names[i]}(${Math.round(b.x)},${Math.round(b.y)} h${Math.round(b.h * DEG)}`
            + ` ${b.ta === 1 ? 'S' : b.ta === -1 ? 'P' : '?'}${b.tk ? '*TK*' : ''}`
            + ` ${b.role.slice(0, 2)}/${(b.risk || '-').slice(0, 2)}`
            + (Math.abs(b.dev) > 0.02 ? ` dev${Math.round(Math.abs(b.dev) * DEG)}°` : '') + ')');
        const A = fr.boats[0], B = fr.boats[1];
        const rngU = B ? Math.round(Math.hypot(A.x - B.x, A.y - B.y)) : '';
        const rights = (fr.pairs || []).map(p => `${p.row || '—'}${p.rule ? '(' + p.rule + ')' : ''}`).join(' ');
        console.log(`t=${t}s rng=${rngU}u ${bits.join(' ')} row:${rights || 'far'}`);
    }
})();
