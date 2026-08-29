// WHO OWNS THE TIME OUT OF THE WORKING BAND (2026-08-28 night, the re-entry push, P0).
// `_band_ledger.js` showed the fleet spends 53% of an upwind leg close-hauled to
// his 79% and that the reaching+deep frames buy NEGATIVE progress. Before any
// candidate: which helm layer WROTE each out-of-band frame (trap 27, last writer
// wins), and what the excursions look like as EPISODES (rule 2), plus the offline
// currency arithmetic on the real avoidance-owned onsets.
//   owner codes: spin | esc | wiggle | pre-av (early return above avoidance) |
//                post (reflex/ice/mark/traj override AFTER avoidance) |
//                avoid (applyAvoidance moved the helm > 0.05 rad) |
//                nav-armed (rounding armed, no deviation) | nav
//   excursion = >= 0.5 s continuous at |TWA| >= 50 deg on an upwind leg.
//   node _band_owner.js <venue> <leg> <trials> <seed0> <tree> [fp]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'bay', LEG = parseInt(process.argv[3] || '1');
const TRIALS = parseInt(process.argv[4] || '6'), SEED0 = parseInt(process.argv[5] || '9400');
const ROOT = path.join(__dirname, process.argv[6] || 'treeNV');
const FP = process.argv[7] || null;
const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const OUT = 50; // deg |TWA| — out-of-band threshold
const MIN_EP = 0.5;
const med = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
const pct = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

// ---- episodes from a frame list [{t, twa(deg, signed), dx, dy, owner, ...}] along chord (ux,uy)
function episodes(frames, ux, uy) {
    const eps = []; let cur = null;
    for (const f of frames) {
        const out = Math.abs(f.twa) >= OUT;
        if (out) {
            if (!cur) cur = { t0: f.t, board0: Math.sign(f.twa), maxTwa: 0, path: 0, prog: 0, n: 0, owners: {}, onset: f.owner, rivalNear: f.rivalNear, first: f };
            cur.t1 = f.t; cur.board1 = Math.sign(f.twa);
            cur.maxTwa = Math.max(cur.maxTwa, Math.abs(f.twa));
            cur.path += Math.hypot(f.dx, f.dy); cur.prog += f.dx * ux + f.dy * uy; cur.n++;
            if (f.owner) cur.owners[f.owner] = (cur.owners[f.owner] || 0) + 1;
        } else if (cur) {
            cur.board2 = Math.sign(f.twa); // board on re-entry
            eps.push(cur); cur = null;
        }
    }
    if (cur) { cur.board2 = cur.board1; eps.push(cur); }
    return eps.filter(e => (e.t1 - e.t0) >= MIN_EP).map(e => ({
        dur: e.t1 - e.t0 + 1 / 60, maxTwa: e.maxTwa, path: e.path, prog: e.prog,
        reentry: e.board2 !== e.board0 ? 'tack' : 'luff', onset: e.onset,
        dom: Object.entries(e.owners).sort((a, b) => b[1] - a[1])[0]?.[0], rivalNear: e.rivalNear, first: e.first,
    }));
}

// ---- HIM
const TD = path.join(__dirname, 'traj');
const humEps = []; let humLaps = 0, humT = 0, humOut = 0;
for (const f of fs.readdirSync(TD).filter(x => x.startsWith('traj_' + VENUE + '_'))) {
    const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
    if (FP && String(j.venueFingerprint) !== FP) continue;
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    if (S.length < 10) continue;
    humLaps++;
    const ax = gi(S[0], 'x'), ay = gi(S[0], 'y'), bx = gi(S[S.length - 1], 'x'), by = gi(S[S.length - 1], 'y');
    const L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L;
    const fr = [];
    for (let i = 1; i < S.length; i++) {
        const twa = norm(gi(S[i], 'hdg') - gi(S[i], 'windDir')) * 180 / Math.PI;
        const dt = gi(S[i], 't') - gi(S[i - 1], 't');
        humT += dt; if (Math.abs(twa) >= OUT) humOut += dt;
        fr.push({ t: gi(S[i], 't'), twa, dx: gi(S[i], 'x') - gi(S[i - 1], 'x'), dy: gi(S[i], 'y') - gi(S[i - 1], 'y'), owner: null });
    }
    humEps.push(...episodes(fr, ux, uy));
}

(async () => {
    const br = await chromium.launch(); const page = await br.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const ownerT = {}; let botT = 0, botOut = 0, botLegs = 0; const botEps = []; const cf = [];
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
                // THE BODY RUNS AT 10 Hz (bot.js update): attribute on tick frames only,
                // carry the owner across the five non-tick frames (rule 18 audit).
                const u = c.update.bind(c);
                c.update = (dt) => { const will = (c.updateTimer - dt) <= 0; u(dt); b._ticked = will; }; c.__w = 1; } };
            const A = {}; const out = []; const dt = 1 / 60;
            let prev = state.boats.map(b => ({ x: b.x, y: b.y }));
            for (let it = 0; it < 60 * 940; it++) {
                for (const b of state.boats) { b._avCalled = false; b._ticked = false; }
                window.update(dt);
                wrap();
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') { prev = state.boats.map(b => ({ x: b.x, y: b.y })); continue; }
                const tm = state.race.timer; if (tm > 900) break;
                state.boats.forEach((b, k) => {
                    if (b.raceState.finished) return;
                    const a = A[b.name] = A[b.name] || { leg: null };
                    if (a.leg !== b.raceState.leg) {
                        if (a.leg === LEG && a.rows) out.push({ x0: a.x0, y0: a.y0, x1: b.x, y1: b.y, rows: a.rows });
                        a.leg = b.raceState.leg; a.x0 = b.x; a.y0 = b.y; a.rows = [];
                    }
                    if (b.raceState.leg !== LEG) return;
                    const c = b.controller; if (!c) return;
                    const w = getWindAt(b.x, b.y); const wd = w.direction;
                    const twa = nm(b.heading - wd) * 180 / Math.PI;
                    const fin = c.targetHeading;
                    let owner;
                    if (!b._ticked && b._owner) owner = b._owner;
                    else if (c.penaltySpin) owner = 'spin';
                    else if (c.escActive) owner = 'esc';
                    else if (c.wiggleActive) owner = 'wiggle';
                    else if (!b._avCalled) owner = 'pre-av';
                    else if (Math.abs(nm(fin - b._avOut)) > 0.02) owner = 'post';
                    else if (Math.abs(nm(b._avOut - b._avIn)) > 0.05) owner = 'avoid';
                    else if (b.raceState.roundArmed) owner = 'nav-armed';
                    else owner = 'nav';
                    b._owner = owner;
                    let rivalNear = 9999;
                    for (const o of state.boats) if (o !== b && !o.raceState.finished) rivalNear = Math.min(rivalNear, Math.hypot(o.x - b.x, o.y - b.y));
                    const row = { t: tm, twa, dx: b.x - prev[k].x, dy: b.y - prev[k].y, owner, rivalNear: Math.round(rivalNear),
                        kt: b.speed * 4, armed: !!b.raceState.roundArmed };
                    if (owner === 'avoid' && !b._ticked && b._avRow) Object.assign(row, b._avRow);
                    if (owner === 'avoid' && b._ticked) {
                        row.twaIn = nm(b._avIn - wd) * 180 / Math.PI; row.twaOut = nm(b._avOut - wd) * 180 / Math.PI;
                        row.off = nm(b._avOut - b._avIn); row.role = c.avoidanceRole; row.risk = c.riskState;
                        // the fan's own currency for the chosen offset, and for the other close-hauled board
                        const hullTk = twa > 0 ? 1 : -1;
                        const desTwa = nm(b._avIn - wd);
                        const taxTack = Math.abs(desTwa) < Math.PI / 3.5 && (desTwa > 0 ? 1 : -1) === hullTk;
                        const chosenOther = ((nm(b._avOut - wd) > 0 ? 1 : -1) !== hullTk);
                        row.costChosen = Math.pow(Math.abs(row.off), 3) * 200 + (taxTack && chosenOther ? 600 : 0);
                        const hOther = nm(wd - desTwa); const offOther = nm(hOther - b._avIn);
                        row.offOther = offOther;
                        row.costOther = Math.pow(Math.abs(offOther), 3) * 200 + (taxTack ? 600 : 0);
                        row.otherInFan = Math.abs(offOther) <= 1.6 + 1e-6;
                        b._avRow = { twaIn: row.twaIn, twaOut: row.twaOut, off: row.off, role: row.role, risk: row.risk,
                            costChosen: row.costChosen, offOther: row.offOther, costOther: row.costOther, otherInFan: row.otherInFan };
                    }
                    if (a.rows.length < 40000) a.rows.push(row);
                });
                prev = state.boats.map(b => ({ x: b.x, y: b.y }));
                if (state.boats.every(x => x.raceState.finished)) break;
            }
            return out;
        }, { seed: SEED0 + t, LEG });
        for (const leg of r) {
            botLegs++;
            const L = Math.hypot(leg.x1 - leg.x0, leg.y1 - leg.y0) || 1;
            const ux = (leg.x1 - leg.x0) / L, uy = (leg.y1 - leg.y0) / L;
            for (const f of leg.rows) {
                botT += 1 / 60;
                if (Math.abs(f.twa) >= OUT) { botOut += 1 / 60; ownerT[f.owner] = (ownerT[f.owner] || 0) + 1 / 60; }
            }
            const eps = episodes(leg.rows, ux, uy);
            botEps.push(...eps);
            // counterfactual: onset frames that are avoidance-owned with an in-band desired heading
            for (const e of eps) {
                const f = e.first;
                if (f.owner === 'avoid' && f.twaIn != null && Math.abs(f.twaIn) < OUT && Math.abs(f.twaOut) >= OUT) cf.push(f);
            }
        }
    }
    await br.close();

    const showEps = (name, eps, laps, T, OUTT) => {
        console.log(`\n  ${name} (${laps} legs): out-of-band ${(100 * OUTT / T).toFixed(1)}% of ${(T / laps).toFixed(0)} s/leg; ` +
            `${(eps.length / laps).toFixed(1)} excursions/leg (>= ${MIN_EP} s at |TWA| >= ${OUT})`);
        if (!eps.length) return;
        const d = eps.map(e => e.dur), p = eps.map(e => e.prog), pa = eps.map(e => e.path), m = eps.map(e => e.maxTwa);
        console.log(`    duration  med ${med(d).toFixed(1)} s  p75 ${pct(d, .75).toFixed(1)}  p90 ${pct(d, .9).toFixed(1)}  max ${Math.max(...d).toFixed(1)}` +
            `   |  seconds/leg in excursions ${(d.reduce((a, b) => a + b, 0) / laps).toFixed(1)}`);
        console.log(`    depth     med ${med(m).toFixed(0)} deg  p75 ${pct(m, .75).toFixed(0)}  |  path/ep med ${med(pa).toFixed(0)} u  progress/ep med ${med(p).toFixed(0)} u` +
            `  (sum path/leg ${(pa.reduce((a, b) => a + b, 0) / laps).toFixed(0)}, sum progress/leg ${(p.reduce((a, b) => a + b, 0) / laps).toFixed(0)})`);
        const tk = eps.filter(e => e.reentry === 'tack').length;
        console.log(`    re-entry  tack ${(100 * tk / eps.length).toFixed(0)}%  luff-back ${(100 * (eps.length - tk) / eps.length).toFixed(0)}%` +
            `   |  long (>= 3 s): ${(100 * eps.filter(e => e.dur >= 3).length / eps.length).toFixed(0)}% carrying ${(100 * eps.filter(e => e.dur >= 3).reduce((a, e) => a + e.dur, 0) / d.reduce((a, b) => a + b, 0)).toFixed(0)}% of the seconds`);
    };
    console.log(`\n══ ${VENUE} leg ${LEG} — who owns the time out of the working band (tree ${path.basename(ROOT)}, seeds ${SEED0}+${TRIALS})`);
    showEps('HIM  ', humEps, humLaps, humT, humOut);
    showEps('FLEET', botEps, botLegs, botT, botOut);
    console.log('\n  FLEET out-of-band seconds by LAST WRITER (share of out-of-band time):');
    Object.entries(ownerT).sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
        console.log(`    ${k.padEnd(10)} ${(100 * v / botOut).toFixed(1).padStart(5)}%   ${(v / botLegs).toFixed(1)} s/leg`));
    const byOnset = {}, byDom = {};
    for (const e of botEps) { byOnset[e.onset] = (byOnset[e.onset] || 0) + 1; byDom[e.dom] = (byDom[e.dom] || 0) + 1; }
    const fmt = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / botEps.length).toFixed(0)}%`).join('  ');
    console.log(`  excursions by ONSET owner:    ${fmt(byOnset)}`);
    console.log(`  excursions by DOMINANT owner: ${fmt(byDom)}`);
    // duration and depth by onset owner
    const groups = {};
    for (const e of botEps) (groups[e.onset] = groups[e.onset] || []).push(e);
    console.log('  per onset owner: n | dur med | depth med | prog/ep med | tack re-entry % | rival<250u at onset %');
    for (const [k, g] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length))
        console.log(`    ${k.padEnd(10)} ${String(g.length).padStart(4)} | ${med(g.map(e => e.dur)).toFixed(1).padStart(5)} | ${med(g.map(e => e.maxTwa)).toFixed(0).padStart(4)} | ${med(g.map(e => e.prog)).toFixed(0).padStart(6)} | ${(100 * g.filter(e => e.reentry === 'tack').length / g.length).toFixed(0).padStart(3)} | ${(100 * g.filter(e => e.rivalNear < 250).length / g.length).toFixed(0).padStart(3)}`);
    // the currency counterfactual on avoidance-owned onsets from an in-band desired heading
    console.log(`\n  CURRENCY at avoidance-owned onsets (desired in-band, chosen out-of-band): n=${cf.length}`);
    if (cf.length) {
        const ratio = cf.map(f => f.costOther / Math.max(1e-6, f.costChosen));
        console.log(`    chosen offset med ${(med(cf.map(f => Math.abs(f.off))) * 180 / Math.PI).toFixed(0)} deg -> TWA out med ${med(cf.map(f => Math.abs(f.twaOut))).toFixed(0)} deg; ` +
            `fan cost chosen med ${med(cf.map(f => f.costChosen)).toFixed(0)}  vs other board med ${med(cf.map(f => f.costOther)).toFixed(0)}  (ratio med ${med(ratio).toFixed(1)}x, p25 ${pct(ratio, .25).toFixed(1)}x)`);
        console.log(`    other board inside the fan (|offset| <= 1.6): ${(100 * cf.filter(f => f.otherInFan).length / cf.length).toFixed(0)}%; ` +
            `role at onset: ${fmt(cf.reduce((o, f) => (o[f.role] = (o[f.role] || 0) + 1, o), {})).replace(/%/g, '%')}` );
        const rl = cf.reduce((o, f) => (o[f.risk] = (o[f.risk] || 0) + 1, o), {});
        console.log(`    risk at onset: ${Object.entries(rl).map(([k, v]) => `${k} ${(100 * v / cf.length).toFixed(0)}%`).join('  ')}`);
    }
})();
