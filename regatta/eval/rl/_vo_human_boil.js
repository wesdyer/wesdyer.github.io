// HIS BOIL EXPOSURE, OFFLINE (2026-09-13, the volcano push). The vents are fixed props and
// Volcano.boilMul is a pure function of position, so his five laps (recorded before the
// recorder logged `boil`) can be scored on the frozen doc after the fact: load the page on
// volcanic, build state.volcano, and evaluate boilMul at every racing sample. In-boil is
// boilMul < 0.88 (static turb > 0.1, the bench's b.boil > 0.1 without the breath); any
// contact is boilMul < 0.999. Episodes, seconds (0.1 s per sample at 10 Hz) and per leg.
//   node _vo_human_boil.js [tree]   (fp-filtered to the frozen doc)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeVO0');
const FP = '4ac8c0e5:45501';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); });
    const files = fs.readdirSync(path.join(__dirname, 'traj')).filter(f => /^traj_volcanic_/.test(f)).sort();
    const laps = files.map(f => JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f)))).filter(t => t.venueFingerprint === FP);
    const res = await page.evaluate((laps) => {
        window.evalHarness.seed = 1; window.resetGame(); window.startRace();
        const v = state.volcano; if (!v) return { err: 'no state.volcano' };
        const out = { vents: v.vents.length, laps: [] };
        for (const t of laps) {
            const ix = {}; t.format.forEach((k, i) => ix[k] = i);
            const S = t.samples.filter(s => s[ix.phase] === 1 && s[ix.leg] >= 1);
            const L = { fin: t.finishTime, eps: [], any: 0, in: 0, byLeg: {} };
            let cur = null;
            for (const s of S) {
                const m = Volcano.boilMul(s[ix.x], s[ix.y]);
                const lg = s[ix.leg];
                if (m < 0.999) L.any++;
                const inB = m < 0.88;
                if (inB) { L.in++; L.byLeg[lg] = (L.byLeg[lg] || 0) + 1; }
                if (inB && !cur) cur = { lg, t0: s[ix.t], n: 0, minMul: m, spd0: s[ix.spd] * 4, minSpd: s[ix.spd] * 4 };
                if (cur) { if (inB) { cur.n++; if (m < cur.minMul) cur.minMul = m; if (s[ix.spd] * 4 < cur.minSpd) cur.minSpd = s[ix.spd] * 4; } else { cur.dur = +(cur.n / 10).toFixed(1); cur.minMul = +cur.minMul.toFixed(2); L.eps.push(cur); cur = null; } }
            }
            if (cur) { cur.dur = +(cur.n / 10).toFixed(1); L.eps.push(cur); }
            out.laps.push(L);
        }
        return out;
    }, laps);
    await browser.close();
    if (res.err) { console.log(res.err); return; }
    console.log(`HIS BOIL EXPOSURE on the frozen volcanic doc (${res.vents} vents), ${res.laps.length} laps:`);
    for (const [i, L] of res.laps.entries()) {
        console.log(`  lap ${i + 1} fin ${L.fin.toFixed(1)}: in-boil ${(L.in / 10).toFixed(1)} s (${L.eps.length} episodes: ${L.eps.map(e => `L${e.lg} ${e.dur}s mul${e.minMul} ${e.spd0.toFixed(1)}→${e.minSpd.toFixed(1)}kt`).join('; ')}), any-contact ${(L.any / 10).toFixed(1)} s; by leg ${JSON.stringify(Object.fromEntries(Object.entries(L.byLeg).map(([k, v]) => [k, +(v / 10).toFixed(1)])))}`);
    }
    const tot = res.laps.map(L => L.in / 10);
    console.log(`  mean ${(tot.reduce((a, b) => a + b, 0) / tot.length).toFixed(1)} s/lap in boil; episodes/lap ${(res.laps.reduce((a, L) => a + L.eps.length, 0) / res.laps.length).toFixed(1)}`);
})();
