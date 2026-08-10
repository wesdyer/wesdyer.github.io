// IS THE FAST SERVICE ALIVE IN THE CROWD? (2026-08-10, the arctic push)
//
// arctic leg-1 subs 8-9 are +86.6 s/boat — 48% of the venue's whole gap — and the
// state mix there is **armed 73%**, i.e. the granite approach/ring. Everything
// else about this class is already known and mostly dead
// ([[regatta-granite-rounding]]): the SOLO geometry is cured (RD11), the fleet
// never cashes it, the jam is physical once formed (the duck verdict: 86% of slow
// give-way ticks have a TRUE collision flag on every duck candidate), and the pile
// is SERVICE TIME rather than arrival spread (transits 63-76 s vs her 19, ρ≈7).
// The one lever the record leaves open is: **keep the fast service — the arc —
// alive in the crowd.**
//
// The arc (script.js ~3192) is the mid-rounding probe that grades the ORBIT the
// boat will actually sail instead of a straight ray. It is switched off by a
// PARKED rival (speed*4 < 1.0 kt) within 400u — narrowed at wide zones (granite's
// is 851) to a rival within 120u of my own arc radius. That is a self-perpetuating
// shape, and it is the same one found in redrock's bowl and swamp's wiggle loop:
//   a rival parks -> my arc dies -> my transit is slow -> I park ->
//   the next boat's arc dies.
//
// SO MEASURE IT, rather than assume RD11 fixed it: over armed frames inside the
// ring, how often is the arc actually ON, and when it is OFF, who switched it off
// and how far away were they? A high OFF share is the lever; a high ON share kills
// this line and sends the push elsewhere.
//
//   node _arc_alive.js <trials> <seed0> <tree> [markIdx]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 6;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeDB3');

const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const A = { armed: 0, inZone: 0, arcOn: 0, arcOff: 0, offWide: 0, offNarrow: 0,
                slow: 0, slowArcOn: 0, slowArcOff: 0, nOff: 0, offDist: [], offROff: [], parkedN: [] };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const o = { armed: 0, inZone: 0, arcOn: 0, arcOff: 0, offWide: 0, offNarrow: 0,
                        slow: 0, slowArcOn: 0, slowArcOff: 0, nOff: 0, offDist: [], offROff: [], parkedN: [] };
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished || bo.raceState.leg < 1) continue;
                    const rs = bo.raceState;
                    if (!rs.roundArmed) continue;
                    const rm = (typeof legRoundMark === 'function' ? legRoundMark(rs.leg) : null) || state.course.roundMark;
                    if (!rm) continue;
                    const dM = Math.hypot(bo.x - rm.x, bo.y - rm.y);
                    o.armed += DT;
                    if (dM >= (rm.zone || 165) * 1.5) continue;      // outside the arc's own window
                    o.inZone += DT;
                    const v = (bo.speed || 0) * 60;
                    if (v < 40) o.slow += DT;
                    // replicate the gate exactly (script.js ~3220)
                    const myR = Math.max(70, dM);
                    const wideQ = (rm.zone || 165) >= 500;
                    let queued = false, culprit = null, nParked = 0;
                    for (const oQ of state.boats) {
                        if (oQ === bo || oQ.isPlayer || oQ.raceState.finished) continue;
                        if (oQ.speed * 4 >= 1.0) continue;
                        const d = Math.hypot(oQ.x - bo.x, oQ.y - bo.y);
                        if (d >= 400) continue;
                        nParked++;
                        if (!wideQ) { queued = true; culprit = { d, rOff: null }; break; }
                        const rQ = Math.hypot(oQ.x - rm.x, oQ.y - rm.y);
                        if (Math.abs(rQ - myR) < 120) { queued = true; culprit = { d, rOff: Math.abs(rQ - myR) }; break; }
                    }
                    if (queued) {
                        o.arcOff += DT; o.nOff++;
                        if (wideQ) o.offNarrow += DT; else o.offWide += DT;
                        if (culprit) { o.offDist.push(Math.round(culprit.d)); if (culprit.rOff != null) o.offROff.push(Math.round(culprit.rOff)); }
                        if (v < 40) o.slowArcOff += DT;
                    } else {
                        o.arcOn += DT;
                        if (v < 40) o.slowArcOn += DT;
                    }
                    o.parkedN.push(nParked);
                }
            }
            return o;
        }, { seed: SEED0 + t });
        for (const k of ['armed', 'inZone', 'arcOn', 'arcOff', 'offWide', 'offNarrow', 'slow', 'slowArcOn', 'slowArcOff', 'nOff']) A[k] += r[k];
        A.offDist = A.offDist.concat(r.offDist.filter((_, i) => i % 13 === 0));
        A.offROff = A.offROff.concat(r.offROff.filter((_, i) => i % 13 === 0));
        A.parkedN = A.parkedN.concat(r.parkedN.filter((_, i) => i % 53 === 0));
        console.log(`seed ${SEED0 + t}: ${r.inZone.toFixed(0)} armed-in-zone boat-s, arc off ${(100 * r.arcOff / (r.inZone || 1)).toFixed(0)}%`);
    }
    await b.close();
    const P = (x, d) => ((100 * x / (d || 1)).toFixed(0) + '%');
    console.log(`\n=== ARCTIC: IS THE ARC ALIVE IN THE CROWD? (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`armed time ${A.armed.toFixed(0)} boat-s, of which inside zone*1.5 ${A.inZone.toFixed(0)} (${P(A.inZone, A.armed)})`);
    console.log(`\n  ⭐ ARC ON  ${A.arcOn.toFixed(0)} boat-s  ${P(A.arcOn, A.inZone)}`);
    console.log(`  ⭐ ARC OFF ${A.arcOff.toFixed(0)} boat-s  ${P(A.arcOff, A.inZone)}   (all of it via the WIDE-ZONE narrowed test at granite)`);
    console.log(`\n  slow (<40 u/s) share of armed-in-zone time  ${P(A.slow, A.inZone)}`);
    console.log(`    while arc ON   ${P(A.slowArcOn, A.arcOn)} of that state's time`);
    console.log(`    while arc OFF  ${P(A.slowArcOff, A.arcOff)} of that state's time`);
    if (A.offDist.length) console.log(`\n  when OFF: culprit distance med ${q(A.offDist, 0.5)}u   |rivalR - myR| med ${A.offROff.length ? q(A.offROff, 0.5) : '-'}u`);
    if (A.parkedN.length) console.log(`  parked rivals within 400u: med ${q(A.parkedN, 0.5)}  p90 ${q(A.parkedN, 0.9)}`);
    console.log(`\n  → a large ARC OFF share is the self-perpetuating loop: a parked rival kills`);
    console.log(`    the fast service, the slow transit makes another parked rival.`);
    console.log(`  → a small ARC OFF share KILLS this line — the arc is already alive and the`);
    console.log(`    crawl is something else. Say so and move the push.`);
})();
