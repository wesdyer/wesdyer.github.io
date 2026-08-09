// MARK-5 APPROACH TRAJECTORY COMPARISON (2026-08-09). Leg-3 band 4 (last 20%
// of the DMC path into mark-5) is clean-but-uniformly-slow: zero median
// contacts yet even the best bot transit never reaches her best. This probe
// answers WHY the trajectories differ, in three mutually exclusive buckets:
//   LINE     — bot lateral offset from her median line, per 1%-of-leg sub-bin
//   THROTTLE — % samples with commanded speedLimit < 1.0 (metering/pack/etc.)
//   MANEUVER — tack/gybe count in the band, human vs bot (TWA sign flips with
//              0.35 rad hysteresis; rule 19: TWA 0 = head-to-wind)
// plus speed-through-water per sub-bin (is she just faster on the same line?).
//   node _m5_approach.js <venue> <leg> <trials> <seed0> <tree> [fp=<hash>]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const LEG = parseInt(process.argv[3]) || 3;
const TRIALS = parseInt(process.argv[4]) || 8;
const SEED0 = parseInt(process.argv[5]) || 9400;
const ROOT = path.join(__dirname, process.argv[6] || 'treeB1');
const FP = (process.argv[7] || '').startsWith('fp=') ? process.argv[7].slice(3).split(',') : null;
const F0 = 0.8, NSUB = 20; // band 4, 1%-of-leg sub-bins

const laps = [];
for (const f of fs.readdirSync(path.join(__dirname, 'traj')).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'traj', f), 'utf8'));
    if (FP && !FP.includes(String(j.venueFingerprint))) continue;
    const Fm = j.format, gi = (s, k) => s[Fm.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1 && gi(s, 'leg') === LEG);
    if (S.length < 5) continue;
    laps.push({ file: f.slice(5, -5),
        pts: S.map(s => [gi(s, 'x'), gi(s, 'y'), gi(s, 't'), gi(s, 'spd') * 60, gi(s, 'hdg'), gi(s, 'windDir')]) });
}
console.log(`${laps.length} fp-matched human laps`);

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    // fraction-projector shared by both sides
    const PROJ = `(x, y) => {
        const leg = state.course.dmc.legs[${LEG}];
        const P = leg.pts, C = leg.cum, L = leg.length || C[C.length - 1] || 1;
        let best = Infinity, bs = 0;
        for (let i = 1; i < P.length; i++) {
            const a = P[i - 1], b = P[i];
            const vx = b.x - a.x, vy = b.y - a.y, wx = x - a.x, wy = y - a.y;
            const dd = vx * vx + vy * vy;
            let t = dd ? (wx * vx + wy * vy) / dd : 0; t = Math.max(0, Math.min(1, t));
            const px = a.x + t * vx, py = a.y + t * vy;
            const d2 = (x - px) * (x - px) + (y - py) * (y - py);
            if (d2 < best) { best = d2; bs = C[i - 1] + t * Math.hypot(vx, vy); }
        }
        return bs / L;
    }`;

    const humRows = await page.evaluate(async (arg) => {
        const { laps, PROJ } = arg;
        window.evalHarness.seed = 9100; window.resetGame(); window.startRace(); window.update(1 / 60);
        const proj = eval(PROJ);
        return laps.map(l => ({ file: l.file,
            rows: l.pts.map(p => ({ f: proj(p[0], p[1]), x: p[0], y: p[1], t: p[2], spd: p[3], hdg: p[4], wd: p[5] })) }));
    }, { laps, PROJ });

    const botRows = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (arg) => {
            const { seed, LEG, PROJ, F0 } = arg;
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const proj = eval(PROJ);
            const out = [];
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (it % 6 === 0 && state.race.status === 'racing') {
                    for (const b of state.boats) {
                        if (b.isPlayer || b.raceState.finished || b.raceState.leg !== LEG) continue;
                        const f = proj(b.x, b.y);
                        if (f < F0) continue;
                        const c = b.controller || {};
                        out.push({ n: b.name, f: +f.toFixed(4), x: Math.round(b.x), y: Math.round(b.y),
                            spd: +((b.speed || 0) * 60).toFixed(0), hdg: +b.heading.toFixed(3),
                            wd: +getWindAt(b.x, b.y).direction.toFixed(3),
                            sl: c.speedLimit != null ? +c.speedLimit.toFixed(2) : 1,
                            arm: b.raceState.roundArmed ? 1 : 0, wig: c.wiggleActive ? 1 : 0,
                            risk: c.riskState || '-', dev: c.lastAvoidDeviation ? 1 : 0 });
                    }
                }
                if (state.race.status === 'finished') break;
            }
            return out;
        }, { seed, LEG, PROJ, F0 });
        console.log(`seed ${seed}: ${r.length} band samples`);
        for (const s of r) { s.seed = seed; botRows.push(s); }
    }
    await browser.close();

    const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
    const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const sub = f => Math.max(0, Math.min(NSUB - 1, Math.floor((f - F0) / (1 - F0) * NSUB)));

    // her median line + speed per sub-bin
    const humBand = humRows.map(l => ({ file: l.file, rows: l.rows.filter(r => r.f >= F0) }));
    const line = [];
    for (let sb = 0; sb < NSUB; sb++) {
        const pts = [].concat(...humBand.map(l => l.rows.filter(r => sub(r.f) === sb)));
        line.push(pts.length ? { x: q(pts.map(p => p.x), .5), y: q(pts.map(p => p.y), .5), spd: q(pts.map(p => p.spd), .5), n: pts.length } : null);
    }
    // maneuvers: TWA sign flips w/ hysteresis
    const flips = rows => {
        let sgn = 0, n = 0;
        for (const r of rows) {
            const twa = norm(r.hdg - r.wd);
            if (Math.abs(twa) < 0.35) continue;
            const s = twa > 0 ? 1 : -1;
            if (sgn && s !== sgn) n++;
            sgn = s;
        }
        return n;
    };
    const humFlips = humBand.map(l => flips(l.rows));
    const botByBoat = {};
    for (const r of botRows) (botByBoat[r.seed + ':' + r.n] = botByBoat[r.seed + ':' + r.n] || []).push(r);
    const botFlips = Object.values(botByBoat).map(rows => flips(rows.sort((a, c) => a.f - c.f)));

    console.log(`\n=== ${VENUE} leg ${LEG} band ${F0}-1.0 (${NSUB} sub-bins): ${humBand.length} laps vs ${Object.keys(botByBoat).length} boat-legs, ${botRows.length} samples ===`);
    console.log('sub   herX,Y        her spd   bot spd med   bot latOff med/p75   thr<1%   arm%  wig%');
    for (let sb = 0; sb < NSUB; sb++) {
        const L2 = line[sb]; if (!L2) { console.log(`  ${sb}   (no human samples)`); continue; }
        const bs = botRows.filter(r => sub(r.f) === sb);
        if (!bs.length) { console.log(`  ${sb}   (no bot samples)`); continue; }
        const off = bs.map(r => Math.hypot(r.x - L2.x, r.y - L2.y));
        const thr = Math.round(100 * bs.filter(r => r.sl < 1).length / bs.length);
        const arm = Math.round(100 * bs.filter(r => r.arm).length / bs.length);
        const wig = Math.round(100 * bs.filter(r => r.wig).length / bs.length);
        console.log(`  ${String(sb).padStart(2)}   (${L2.x},${L2.y})   ${L2.spd.toFixed(0)}        ${q(bs.map(r => r.spd), .5)}          ${Math.round(q(off, .5))} / ${Math.round(q(off, .75))}            ${thr}%     ${arm}%   ${wig}%`);
    }
    const allBot = botRows;
    const riskCnt = {};
    for (const r of allBot) riskCnt[r.risk] = (riskCnt[r.risk] || 0) + 1;
    console.log(`\nband totals: bot samples ${allBot.length} | throttled(sl<1) ${Math.round(100 * allBot.filter(r => r.sl < 1).length / allBot.length)}% | sl med ${q(allBot.map(r => r.sl), .5)} | armed ${Math.round(100 * allBot.filter(r => r.arm).length / allBot.length)}% | wiggle ${Math.round(100 * allBot.filter(r => r.wig).length / allBot.length)}% | avoid-deviating ${Math.round(100 * allBot.filter(r => r.dev).length / allBot.length)}%`);
    console.log('risk states:', JSON.stringify(riskCnt));
    console.log(`maneuvers in band (TWA sign flips): human per lap ${JSON.stringify(humFlips)} | bot per boat-leg med ${q(botFlips, .5)} p75 ${q(botFlips, .75)} max ${Math.max(...botFlips)}`);
})();
