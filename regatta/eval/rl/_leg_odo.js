// PER-LEG DISTANCE-vs-SPEED ATLAS — fleet against him, leg by leg (2026-08-27).
//
// `_leg_matrix.js` says WHERE each venue's gap is; it does not say WHAT KIND of
// gap it is. `_beat_decomp.js` splits the waste, but its reference is VMC toward
// the LEG TARGET, which is the wrong reference on the four islandRound venues
// (bay, lake, glowtide, redrock): a route that must go around an island scores
// as waste by construction, and its ARMED bucket is really "the DMC carrot is
// live", 44 s of a 64 s lake leg.
//
// This asks the one question that needs no plan model, on both sides of the
// comparison, in the same units:
//     time = distance / speed
// so a leg's gap is (extra GROUND DISTANCE sailed) plus (lower GROUND SPEED),
// and those two want completely different fixes. Ground distance on both sides
// per standing rule 32 (positions, never the speed integral).
//
//   node _leg_odo.js <venue> <trials> <seed0> <tree> [fp]
// Ten-bot (the player boat is converted, not parked); LATE venue write.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'bay';
const TRIALS = parseInt(process.argv[3] || '8');
const SEED0 = parseInt(process.argv[4] || '9400');
const ROOT = path.join(__dirname, process.argv[5] || 'treeSPP');
const FP = process.argv[6] || null;
const med = a => { const s = a.filter(x => x != null && !Number.isNaN(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// ── HIM ─────────────────────────────────────────────────────────────────────
const TD = path.join(__dirname, 'traj');
const human = {};
for (const f of fs.readdirSync(TD).filter(x => x.startsWith('traj_' + VENUE + '_'))) {
    const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
    if (FP && String(j.venueFingerprint) !== FP) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const legs = [...new Set(j.samples.filter(s => gi(s, 'phase') === 1).map(s => gi(s, 'leg')))];
    for (const L of legs) {
        const S = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === L);
        if (S.length < 5) continue;
        let odo = 0, flips = 0, prev = null;
        for (let i = 1; i < S.length; i++) odo += Math.hypot(gi(S[i], 'x') - gi(S[i - 1], 'x'), gi(S[i], 'y') - gi(S[i - 1], 'y'));
        // cross-track from the leg's own chord — how far off the direct line the
        // track wanders. Needs no plan model, so it is computable on BOTH sides.
        const ax = gi(S[0], 'x'), ay = gi(S[0], 'y');
        const bx2 = gi(S[S.length - 1], 'x'), by2 = gi(S[S.length - 1], 'y');
        const LL = Math.hypot(bx2 - ax, by2 - ay) || 1;
        const xt = S.map(s => Math.abs(((gi(s, 'x') - ax) * (by2 - ay) - (gi(s, 'y') - ay) * (bx2 - ax)) / LL));
        xt.sort((p1, p2) => p1 - p2);
        for (const s of S) { const tw = norm(gi(s, 'hdg') - gi(s, 'windDir')); const sd = tw > 0 ? 1 : -1;
            if (prev !== null && sd !== prev) flips++; prev = sd; }
        const dur = gi(S[S.length - 1], 't') - gi(S[0], 't');
        const st = Math.hypot(gi(S[S.length - 1], 'x') - gi(S[0], 'x'), gi(S[S.length - 1], 'y') - gi(S[0], 'y'));
        (human[L] = human[L] || []).push({ dur, odo, st, sp: odo / dur, flips, xtMed: xt[Math.floor(xt.length/2)], xtMax: xt[xt.length-1] });
    }
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const bot = {};
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(async ({ seed }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(b => b !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90,
                nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            const nm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const acc = {};
            for (const b of state.boats) acc[b.name] = { leg: null, odo: 0, t0: 0, x0: 0, y0: 0, side: null, flips: 0, pts: [], out: [] };
            const dt = 1 / 60;
            let prev = state.boats.map(b => ({ x: b.x, y: b.y }));
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') { prev = state.boats.map(b => ({ x: b.x, y: b.y })); continue; }
                const tm = state.race.timer; if (tm > 900) break;
                state.boats.forEach((b, k) => {
                    const a = acc[b.name]; if (!a || b.raceState.finished) return;
                    const L = b.raceState.leg;
                    if (a.leg !== L) {
                        if (a.leg != null && a.leg >= 1) {
                            const LL = Math.hypot(b.x - a.x0, b.y - a.y0) || 1;
                            const xt = a.pts.map(p => Math.abs(((p.x - a.x0) * (b.y - a.y0) - (p.y - a.y0) * (b.x - a.x0)) / LL));
                            xt.sort((p1, p2) => p1 - p2);
                            a.out.push({ leg: a.leg, dur: tm - a.t0, odo: a.odo,
                                st: Math.hypot(b.x - a.x0, b.y - a.y0), flips: a.flips,
                                xtMed: xt.length ? xt[Math.floor(xt.length / 2)] : 0,
                                xtMax: xt.length ? xt[xt.length - 1] : 0 });
                        }
                        a.leg = L; a.odo = 0; a.t0 = tm; a.x0 = b.x; a.y0 = b.y; a.flips = 0; a.side = null; a.pts = [];
                    }
                    a.odo += Math.hypot(b.x - prev[k].x, b.y - prev[k].y);
                    if (a.pts.length < 4000) a.pts.push({ x: b.x, y: b.y });
                    const tw = nm(b.heading - getWindAt(b.x, b.y).direction), sd = tw > 0 ? 1 : -1;
                    if (a.side !== null && sd !== a.side) a.flips++;
                    a.side = sd;
                });
                prev = state.boats.map(b => ({ x: b.x, y: b.y }));
                if (state.boats.every(b => b.raceState.finished)) break;
            }
            return Object.values(acc).flatMap(a => a.out);
        }, { seed: SEED0 + t });
        for (const o of r) (bot[o.leg] = bot[o.leg] || []).push({ ...o, sp: o.odo / o.dur });
        console.log(`  seed ${SEED0 + t}: ${r.length} boat-legs`);
    }
    await browser.close();
    console.log(`\n══ ${VENUE} — per-leg DISTANCE vs SPEED, fleet against him (ten-bot, ${TRIALS} races)`);
    console.log('leg |  him: dur  odo  ratio  kt |  fleet: dur  odo  ratio  kt | Δdur | of which DISTANCE / SPEED | flips h/f | xtrack med h/f');
    for (const L of Object.keys(bot).map(Number).sort((a, b) => a - b)) {
        const H = human[L], B = bot[L];
        if (!H || !H.length) { console.log(`${String(L).padStart(3)} |  (no fp-valid human lap)`); continue; }
        const hd = med(H.map(x => x.dur)), ho = med(H.map(x => x.odo)), hs = med(H.map(x => x.sp));
        const bd = med(B.map(x => x.dur)), bo = med(B.map(x => x.odo)), bs = med(B.map(x => x.sp));
        const hr = med(H.map(x => x.odo / x.st)), br = med(B.map(x => x.odo / x.st));
        // time = distance / speed: split the gap into the part the extra distance
        // buys at HIS speed, and the part his distance would cost at THEIR speed.
        const dDist = (bo - ho) / hs, dSpeed = ho / bs - ho / hs;
        console.log(`${String(L).padStart(3)} | ${hd.toFixed(1).padStart(10)} ${ho.toFixed(0).padStart(5)} ${hr.toFixed(3).padStart(6)} ${(hs/15).toFixed(2).padStart(5)} | ${bd.toFixed(1).padStart(11)} ${bo.toFixed(0).padStart(5)} ${br.toFixed(3).padStart(6)} ${(bs/15).toFixed(2).padStart(5)} | ${(bd-hd).toFixed(1).padStart(5)} | ${dDist.toFixed(1).padStart(8)} / ${dSpeed.toFixed(1).padStart(6)} | ${med(H.map(x=>x.flips))}/${med(B.map(x=>x.flips))} | ${med(H.map(x=>x.xtMed)).toFixed(0)}/${med(B.map(x=>x.xtMed)).toFixed(0)}`);
    }
})();
