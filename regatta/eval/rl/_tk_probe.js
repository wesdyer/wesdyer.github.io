// DOES THE FAR TACK REFERENCE EVER DIFFER, AND DOES IT EVER FLIP THE CHOICE?
// (2026-08-08, treeTK1 audit.) The candidate benched byte-identical on its first
// seed, which per standing rule 17 means it is pricing water no decision buys —
// so instrument the decision itself before touching the shape again.
// Logs, per upwind tick on a floe venue: the near-carrot bearing, the far
// reference bearing, their difference, the two tack scores under EACH reference,
// and whether the argmax differs.
//   node _tk_probe.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 2;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHD9');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const hero = bots[0];
            for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
            const nz = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const R = { seed, n: 0, upwind: 0, hasPath: 0, farOK: 0, diffs: [], bigDiff: 0,
                        carrotD: [], pathLenAhead: [], tacks: 0, fin: null };
            let lastTk = null;
            const dt = 1 / 60; let fr = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                R.n++;
                const w = getWindAt(hero.x, hero.y);
                const off = Math.abs(nz(hero.heading - w.direction));
                if (off < 1.2) {
                    R.upwind++;
                    const tk = Math.sign(nz(hero.heading - w.direction)) || 0;
                    if (lastTk != null && tk !== 0 && tk !== lastTk) R.tacks++;
                    if (tk !== 0) lastTk = tk;
                }
                const c = hero.controller, gp = c && c.gridPath;
                if (!gp || !gp.length) continue;
                R.hasPath++;
                // near carrot: what getNavigationTarget would hand getStrategicHeading
                const tgt = c.navTarget || null;
                // reproduce the far reference exactly as the candidate computes it
                let j = 0, acc = 0;
                while (j < gp.length - 1 && acc < 1400) {
                    acc += Math.hypot(gp[j + 1].x - gp[j].x, gp[j + 1].y - gp[j].y);
                    j++;
                }
                R.pathLenAhead.push(Math.round(acc));
                const pK = gp[j];
                const dxK = pK.x - hero.x, dyK = pK.y - hero.y;
                if (dxK * dxK + dyK * dyK > 600 * 600) {
                    R.farOK++;
                    // near reference = the carrot the boat is actually steering to
                    let j2 = 0, acc2 = 0;
                    while (j2 < gp.length - 1 && acc2 < 420) {
                        acc2 += Math.hypot(gp[j2 + 1].x - gp[j2].x, gp[j2 + 1].y - gp[j2].y);
                        j2++;
                    }
                    const pN = gp[j2];
                    const bN = Math.atan2(pN.x - hero.x, -(pN.y - hero.y));
                    const bF = Math.atan2(dxK, -dyK);
                    const d = Math.abs(nz(bF - bN));
                    R.diffs.push(+(d * 180 / Math.PI).toFixed(0));
                    if (d > 0.15) R.bigDiff++;
                    R.carrotD.push(Math.round(Math.hypot(pN.x - hero.x, pN.y - hero.y)));
                }
                if (hero.raceState.finished && R.fin == null) { R.fin = +t.toFixed(1); break; }
            }
            const q = (v, p) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p / 100))]; };
            return { seed: R.seed, fin: R.fin, n: R.n, upwindPct: Math.round(100 * R.upwind / R.n),
                hasPathPct: Math.round(100 * R.hasPath / R.n),
                farOKPct: R.hasPath ? Math.round(100 * R.farOK / R.hasPath) : 0,
                pathAheadMed: q(R.pathLenAhead, 50), carrotDMed: q(R.carrotD, 50),
                diffMed: q(R.diffs, 50), diffP90: q(R.diffs, 90),
                bigDiffPct: R.farOK ? Math.round(100 * R.bigDiff / R.farOK) : 0, tacks: R.tacks };
        }, seed);
        console.log('seed', r.seed, 'fin', r.fin, 'upwind%', r.upwindPct, 'tacks', r.tacks,
            '\n   gridPath present', r.hasPathPct + '%', ' far-ref ≥600u in', r.farOKPct + '%',
            ' path-ahead med', r.pathAheadMed, ' carrot dist med', r.carrotDMed,
            '\n   |far - near| bearing med', r.diffMed + '°', 'p90', r.diffP90 + '°',
            ' >8.6° in', r.bigDiffPct + '% of ticks');
    }
    await browser.close();
})();
