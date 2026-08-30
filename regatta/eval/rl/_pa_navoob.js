// NAV-OWNED TIME OUT OF THE BAND (2026-08-30). `_band_owner` says the tactician
// itself (no avoidance deviation, not armed) is the last writer of 15% (bay 1),
// 15% (redrock 1), 24% (glowtide 1), 42% (arctic 1) of the out-of-band seconds on
// an upwind leg. WHAT is it doing? Per nav-owned frame at |TWA| >= 50 deg on the
// leg: the bearing of the boat's own nav target (`_lastNav`, the carrot) relative
// to the wind, its distance, and the bearing of the LEG's anchor (the mark). A
// frame where the boat sails straight at a carrot that sits at 60 deg TWA while
// the leg anchor is upwind is a "carrot reach on a beat" — the router's polyline
// being followed corner to corner instead of beaten toward.
//   node _pa_navoob.js <venue> <leg> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'bay', LEG = parseInt(process.argv[3] || '1');
const TRIALS = parseInt(process.argv[4] || '4'), SEED0 = parseInt(process.argv[5] || '9400');
const ROOT = path.join(__dirname, process.argv[6] || 'treePA');
(async () => {
    const br = await chromium.launch(); const page = await br.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const all = []; let legT = 0, legN = 0; const ownT = {};
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(async ({ seed, LEG }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(x => x !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, x) => a + x.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            const nm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const wrap = () => { for (const b of state.boats) { const c = b.controller; if (!c || !c.applyAvoidance || c.__w) continue;
                const o = c.applyAvoidance.bind(c);
                c.applyAvoidance = (dh, sr) => { b._avIn = dh; const r = o(dh, sr); b._avOut = r; b._avCalled = true; return r; };
                const u = c.update.bind(c);
                c.update = (dt) => { const will = (c.updateTimer - dt) <= 0; u(dt); b._ticked = will; }; c.__w = 1; } };
            const rows = []; const dt = 1 / 60; let legT = 0, legN = 0; const ownT = {};
            const seen = {};
            for (let it = 0; it < 60 * 940; it++) {
                for (const b of state.boats) { b._avCalled = false; b._ticked = false; }
                window.update(dt);
                wrap();
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                for (const b of state.boats) {
                    if (b.raceState.finished || b.raceState.leg !== LEG) continue;
                    const c = b.controller; if (!c) continue;
                    if (!seen[b.name]) { seen[b.name] = 1; legN++; }
                    legT += dt;
                    const wd = getWindAt(b.x, b.y).direction;
                    const twa = nm(b.heading - wd) * 180 / Math.PI;
                    let owner;
                    if (!b._ticked && b._owner) owner = b._owner;
                    else if (c.penaltySpin) owner = 'spin';
                    else if (c.escActive) owner = 'esc';
                    else if (c.wiggleActive) owner = 'wiggle';
                    else if (!b._avCalled) owner = 'pre-av';
                    else if (Math.abs(nm(c.targetHeading - b._avOut)) > 0.02) owner = 'post';
                    else if (Math.abs(nm(b._avOut - b._avIn)) > 0.05) owner = 'avoid';
                    else if (b.raceState.roundArmed) owner = 'nav-armed';
                    else owner = 'nav';
                    b._owner = owner;
                    if (Math.abs(twa) >= 50) ownT[owner] = (ownT[owner] || 0) + dt;
                    if (owner !== 'nav' || Math.abs(twa) < 50) continue;
                    const nav = c._lastNav;
                    const tgtB = nav ? Math.atan2(nav.x - b.x, -(nav.y - b.y)) : null;
                    const tgtTwa = tgtB == null ? null : nm(tgtB - wd) * 180 / Math.PI;
                    const tgtD = nav ? Math.hypot(nav.x - b.x, nav.y - b.y) : null;
                    const anc = (typeof CoursePath !== 'undefined' && state.course.route) ? CoursePath.anchor(state.course.route[LEG], state.course.marks) : null;
                    const ancB = anc ? Math.atan2(anc.x - b.x, -(anc.y - b.y)) : null;
                    const ancTwa = ancB == null ? null : nm(ancB - wd) * 180 / Math.PI;
                    const ancD = anc ? Math.hypot(anc.x - b.x, anc.y - b.y) : null;
                    const desTwa = b._avIn != null ? nm(b._avIn - wd) * 180 / Math.PI : null;
                    rows.push({ twa, tgtTwa, tgtD, ancTwa, ancD, desTwa, kt: b.speed * 4, name: b.name, t: state.race.timer });
                }
            }
            return { rows, legT, legN, ownT };
        }, { seed: SEED0 + t, LEG });
        all.push(...r.rows); legT += r.legT; legN += r.legN; for (const k in r.ownT) ownT[k] = (ownT[k] || 0) + r.ownT[k];
    }
    await br.close();
    const med = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
    const p = (n, d) => (100 * n / Math.max(1e-9, d)).toFixed(0) + '%';
    const n = all.length, dtF = 1 / 60;
    const oobT = Object.values(ownT).reduce((a, b) => a + b, 0);
    console.log(`\n══ ${VENUE} leg ${LEG} — NAV-OWNED OUT-OF-BAND (tree ${path.basename(ROOT)}, ${legN} boat-legs, leg med ${(legT / legN).toFixed(1)} s/boat)`);
    console.log(`  out-of-band ${p(oobT, legT)} of leg time; owners: ${Object.entries(ownT).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${p(v, oobT)}`).join('  ')}`);
    console.log(`  nav-owned OOB = ${(n * dtF / legN).toFixed(1)} s/boat-leg (${p(n * dtF, legT)} of leg time); |TWA| med ${med(all.map(x => Math.abs(x.twa))).toFixed(0)}`);
    const withT = all.filter(x => x.tgtTwa != null);
    const sameAsTgt = withT.filter(x => Math.abs(Math.abs(x.tgtTwa) - Math.abs(x.twa)) < 8).length;
    const desOob = all.filter(x => x.desTwa != null && Math.abs(x.desTwa) >= 50).length;
    console.log(`  the tactician's own DESIRED heading was out of band on ${p(desOob, n)} of these frames (rest = hull lagging a command / not yet ticked)`);
    console.log(`  carrot (_lastNav) |TWA|: med ${med(withT.map(x => Math.abs(x.tgtTwa))).toFixed(0)} deg, dist med ${med(withT.map(x => x.tgtD)).toFixed(0)} u; boat heading within 8 deg of the carrot bearing on ${p(sameAsTgt, withT.length)}`);
    const bins = [[0, 50, 'carrot UPWIND <50'], [50, 75, 'carrot 50-75'], [75, 110, 'carrot 75-110'], [110, 181, 'carrot >110']];
    console.log('  ' + bins.map(([a, b, l]) => `${l}: ${p(withT.filter(x => Math.abs(x.tgtTwa) >= a && Math.abs(x.tgtTwa) < b).length, withT.length)}`).join(' | '));
    const withA = all.filter(x => x.ancTwa != null);
    const beatFrames = withA.filter(x => Math.abs(x.ancTwa) < 50);
    console.log(`  LEG ANCHOR |TWA|: med ${med(withA.map(x => Math.abs(x.ancTwa))).toFixed(0)} deg, dist med ${med(withA.map(x => x.ancD)).toFixed(0)} u; anchor is UPWIND (<50) on ${p(beatFrames.length, withA.length)} of nav-owned OOB frames`);
    const carrotReach = withA.filter(x => Math.abs(x.ancTwa) < 50 && x.tgtTwa != null && Math.abs(x.tgtTwa) >= 50 && Math.abs(Math.abs(x.tgtTwa) - Math.abs(x.twa)) < 8);
    console.log(`  ⇒ CARROT REACH ON A BEAT (anchor upwind, carrot off the wind, boat pointed at the carrot): ${p(carrotReach.length, n)} of nav-owned OOB = ${(carrotReach.length * dtF / legN).toFixed(1)} s/boat-leg; those carrots sit at med ${med(carrotReach.map(x => Math.abs(x.tgtTwa))).toFixed(0)} deg, ${med(carrotReach.map(x => x.tgtD)).toFixed(0)} u away, boat speed med ${med(carrotReach.map(x => x.kt)).toFixed(1)} kt`);
    const deep = all.filter(x => Math.abs(x.twa) >= 110).length;
    console.log(`  deep (>=110) share of nav-owned OOB: ${p(deep, n)}`);
})();
