// D-sizing (fidelity push): the BOT mirror of _d_passgap.py — per bot-pair
// encounter (<600u) minimum center distance, parked split, plus the
// CONTACT-POSE audit: at every collision_boat, both boats' headings and the
// bearing of the other boat (is contact bow-on, beam-on, raked?).
// node _d_botgap.js <trials> <seed0> <venue> [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 2;
const SEED0 = parseInt(process.argv[3]) || 9100;
const VENUE = process.argv[4] || 'arctic';
const ROOT = path.join(__dirname, process.argv[5] || 'treeFL1B');
const pct = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const k = (s.length - 1) * p / 100, f = Math.floor(k); return s[f] + (s[Math.min(f + 1, s.length - 1)] - s[f]) * (k - f); };
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const gaps = [], parked = [], moving = [], poses = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            // contact-pose hook
            const poses = [];
            const inner = window.onRaceEvent;
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            window.onRaceEvent = (ty, d) => {
                try {
                    if (ty === 'collision_boat' && d && d.boat && d.other && !d.boat.isPlayer && !d.other.isPlayer) {
                        const brg = Math.atan2(d.other.x - d.boat.x, -(d.other.y - d.boat.y));
                        poses.push({
                            relHdg: Math.abs(norm(d.other.heading - d.boat.heading)),
                            relBrg: Math.abs(norm(brg - d.boat.heading)),
                            v1: d.boat.speed, v2: d.other.speed,
                            t: state.race.status === 'prestart' ? -state.race.timer : state.race.timer
                        });
                    }
                } catch (e) {}
                return inner && inner(ty, d);
            };
            // pairwise encounter tracking at 2 Hz
            const enc = {};   // "i:j" -> {min, rsAtMin}
            const done = [];
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (it % 30 === 0 && state.race.status !== 'finished') {
                    const bs = state.boats.filter(b => !b.isPlayer && !b.raceState.finished);
                    const seen = new Set();
                    for (let a = 0; a < bs.length; a++) for (let b = a + 1; b < bs.length; b++) {
                        const k = bs[a].name + ':' + bs[b].name;
                        seen.add(k);
                        const d2 = Math.hypot(bs[a].x - bs[b].x, bs[a].y - bs[b].y);
                        if (d2 < 600) {
                            const slower = Math.min(bs[a].speed, bs[b].speed);
                            if (!enc[k] || d2 < enc[k].min) enc[k] = { min: d2, rsAtMin: slower };
                        } else if (enc[k]) { done.push(enc[k]); delete enc[k]; }
                    }
                    for (const k of Object.keys(enc)) if (!seen.has(k)) { done.push(enc[k]); delete enc[k]; }
                }
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            for (const k of Object.keys(enc)) done.push(enc[k]);
            return { done, poses };
        }, seed);
        for (const e of r.done) { gaps.push(e.min); (e.rsAtMin < 0.25 ? parked : moving).push(e.min); }
        poses.push(...r.poses);
        console.log('seed', seed, 'encounters', r.done.length, 'contacts', r.poses.length);
    }
    const lt = (a, x) => a.length ? Math.round(100 * a.filter(q => q < x).length / a.length) : NaN;
    console.log(`\n${VENUE} BOT pass-gaps: n=${gaps.length} p10=${pct(gaps, 10).toFixed(0)} p25=${pct(gaps, 25).toFixed(0)} p50=${pct(gaps, 50).toFixed(0)} <55u=${lt(gaps, 55)}% <80u=${lt(gaps, 80)}% <110u=${lt(gaps, 110)}%`);
    console.log(`  parked-at-min(<1kt): n=${parked.length} p50=${pct(parked, 50).toFixed(0)} <400u=${lt(parked, 400)}%`);
    if (poses.length) {
        const relH = poses.map(p => p.relHdg * 180 / Math.PI);
        const relB = poses.map(p => p.relBrg * 180 / Math.PI);
        const slowBoth = poses.filter(p => Math.max(p.v1, p.v2) < 0.25).length;
        console.log(`  contact poses: n=${poses.length} |relHdg| p25/50/75 = ${pct(relH, 25).toFixed(0)}/${pct(relH, 50).toFixed(0)}/${pct(relH, 75).toFixed(0)} deg; |brg(other)| p50 = ${pct(relB, 50).toFixed(0)} deg; both<1kt ${Math.round(100 * slowBoth / poses.length)}%`);
    }
    await browser.close();
})();
