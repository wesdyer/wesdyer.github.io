// IS THE BAY GAP DISTANCE OR SPEED?
//
// The bay bench loses +4 to +6 seconds to the recorded human on EVERY leg
// (L1 +4, L2 +1, L3 +6, L4 +4, L5 +5, L6 +5). A deficit that uniform is not a
// tactical class — it is either a longer track everywhere, or a slower boat
// everywhere, and those want completely different work. This measures both
// sides on the same footing: per leg, the odometer, the DMC leg length, the
// resulting distance ratio, and the mean speed while sailing it.
//
// Bot side from a live fleet; human side from the banked 10Hz trajectories in
// traj/ (same legs, same course).
//
// node _bay_pace_probe.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const bot = [];
    let legLens = null;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 5900; pl.y = -6100;
            const st = bots.map(b => ({ leg: -1, t0: 0, odo: 0, px: b.x, py: b.y, twa: 0, n: 0, rows: [] }));
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], s = st[k];
                    if (b.raceState.finished && s.leg < 0) continue;
                    if (s.leg !== b.raceState.leg) {
                        if (s.leg >= 1) s.rows.push({ leg: s.leg, dur: state.race.timer - s.t0,
                                                      odo: s.odo, near: s.odoNear || 0, far: s.odoFar || 0,
                                                      twa: s.n ? s.twa / s.n : 0 });
                        s.leg = b.raceState.leg; s.t0 = state.race.timer; s.odo = 0; s.twa = 0; s.n = 0;
                        s.odoNear = 0; s.odoFar = 0;
                    }
                    // WHERE in the leg is the extra distance spent? Split the
                    // odometer by distance to THIS leg's rounding mark: the last
                    // 3 zone radii are the approach and the rounding, everything
                    // before it is the leg proper.
                    const step = Math.hypot(b.x - s.px, b.y - s.py);
                    s.odo += step;
                    const rmP = (typeof legRoundMark === 'function' ? legRoundMark(b.raceState.leg) : null);
                    if (rmP) {
                        const dz = Math.hypot(b.x - rmP.x, b.y - rmP.y) / rmP.zone;
                        if (dz <= 3) s.odoNear = (s.odoNear || 0) + step;
                        else s.odoFar = (s.odoFar || 0) + step;
                    } else s.odoFar = (s.odoFar || 0) + step;
                    s.px = b.x; s.py = b.y;
                    if (it % 6 === 0) {
                        const w = getWindAt(b.x, b.y);
                        s.twa += Math.abs(normalizeAngle(b.heading - w.direction)); s.n++;
                    }
                }
            }
            const lens = {};
            for (let L = 1; L < state.course.dmc.legs.length; L++)
                if (state.course.dmc.legs[L]) lens[L] = state.course.dmc.legs[L].length;
            return { rows: st.flatMap(s => s.rows), lens };
        }, seed);
        bot.push(...r.rows); legLens = r.lens;
        console.log(`seed ${seed}: ${r.rows.length} leg records`);
    }
    await browser.close();

    // ---- human side, from the banked trajectories ----
    const F = { t: 0, x: 2, y: 3, hdg: 4, spd: 5, wd: 6, leg: 8 };
    const hum = [];
    for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_bay'))) {
        const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
        let leg = -1, t0 = 0, odo = 0, px = 0, py = 0, twa = 0, n = 0, first = true;
        for (const s of j.samples) {
            const lg = s[F.leg];
            if (lg !== leg) {
                if (leg >= 1) hum.push({ leg, dur: s[F.t] - t0, odo, twa: n ? twa / n : 0 });
                leg = lg; t0 = s[F.t]; odo = 0; twa = 0; n = 0; first = true;
            }
            if (!first) odo += Math.hypot(s[F.x] - px, s[F.y] - py);
            px = s[F.x]; py = s[F.y]; first = false;
            let d = s[F.hdg] - s[F.wd];
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            twa += Math.abs(d); n++;
        }
    }

    console.log(`\nBAY PACE — bot ${TRIALS} seeds vs ${hum.length ? 'banked human' : 'NO HUMAN DATA'}`);
    console.log('  leg   len      BOT dur  odo   ratio  spd    |   HUMAN dur  odo   ratio  spd    | gap = dist? speed?');
    for (let L = 1; L <= 6; L++) {
        const B = bot.filter(r => r.leg === L), H = hum.filter(r => r.leg === L);
        if (!B.length || !H.length) continue;
        const len = legLens[L] || NaN;
        const bd = med(B.map(r => r.dur)), bo = med(B.map(r => r.odo));
        const hd = med(H.map(r => r.dur)), ho = med(H.map(r => r.odo));
        const bs = bo / bd, hs = ho / hd;
        // Decompose the time gap: how much is extra distance at the human's speed,
        // and how much is the same distance sailed slower?
        const gap = bd - hd;
        const distPart = (bo - ho) / hs;
        const spdPart = gap - distPart;
        console.log(`  L${L}  ${String(Math.round(len)).padStart(5)}   ` +
            `${bd.toFixed(1).padStart(7)} ${String(Math.round(bo)).padStart(5)} ${(bo / len).toFixed(2).padStart(6)} ${bs.toFixed(1).padStart(6)}  |  ` +
            `${hd.toFixed(1).padStart(8)} ${String(Math.round(ho)).padStart(5)} ${(ho / len).toFixed(2).padStart(6)} ${hs.toFixed(1).padStart(6)}  | ` +
            `${gap > 0 ? '+' : ''}${gap.toFixed(1)}s = ${distPart.toFixed(1)}s dist + ${spdPart.toFixed(1)}s speed`);
    }
    console.log('  odometer split — FAR (>3x zone from the mark) vs NEAR (the approach + rounding):');
    for (let L = 1; L <= 6; L++) {
        const B = bot.filter(r => r.leg === L && r.near != null);
        if (!B.length) continue;
        console.log(`   L${L}  far ${String(Math.round(med(B.map(r => r.far)))).padStart(5)}u   near ${String(Math.round(med(B.map(r => r.near)))).padStart(5)}u`);
    }
    const tot = (set) => [1, 2, 3, 4, 5, 6].reduce((a, L) => {
        const r = set.filter(x => x.leg === L); return a + (r.length ? med(r.map(x => x.dur)) : 0);
    }, 0);
    console.log(`  total per-leg median: bot ${tot(bot).toFixed(0)}s  human ${tot(hum).toFixed(0)}s`);
})();
