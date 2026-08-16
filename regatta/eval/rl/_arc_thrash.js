// THE CRAWL IS MANOEUVRE-THRASH — WHO ORDERS THE MANOEUVRES, AND WHAT DOES EACH
// COST? (2026-08-15, follows _arc_crawl's cause split: in dRM 300-1200 leg-1,
// slow time is 58% under-half-polar + 56% turning + 25% contact-latch, and only
// 3% commanded throttle, 9% rival-ahead queue. So the speed is lost to heading
// churn. This counts TURN EPISODES in the band, attributes each to the helm
// layer active at onset (flag precedence mirrors rule 27's last-writer order:
// spin > contact-latch > escape > deflection > wiggle > nav), and prices each:
// speed at onset, min speed in the following 5 s, seconds to recover 80% of
// onset speed. Also marks which episodes are full tacks (hull crosses head-to-
// wind) vs nudges. Episode = |accumulated heading delta| > 0.4 rad inside 2 s.
//   node _arc_thrash.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeBASE');

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), 'arctic');

    const EP = [];   // pooled episodes
    let bandT = 0;
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60;
            const eps = []; let bandT = 0;
            const st = new Map();  // per-boat tracking state
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const ownerOf = (bo) => {
                const c = bo.controller; if (!c) return 'nav';
                if (c.penaltySpin) return 'spin';
                if ((c.iceEscapeTimer || 0) > 0) return 'contactLatch';
                if (c.escActive) return 'escape';
                if (Math.abs(c.lastAvoidDeviation || 0) > 0.26) return 'deflect';
                if (c.wiggleActive) return 'wiggle';
                return 'nav';
            };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    const rs = bo.raceState;
                    let s = st.get(bo.name);
                    if (!s) { s = { h: bo.heading, acc: 0, accT: 0, ep: null, inBand: false }; st.set(bo.name, s); }
                    const rm = (typeof legRoundMark === 'function' ? legRoundMark(rs.leg) : null) || state.course.roundMark;
                    const dM = rm ? Math.hypot(bo.x - rm.x, bo.y - rm.y) : 1e9;
                    const inBand = rs.leg === 1 && dM >= 300 && dM < 1200;
                    if (inBand) bandT += DT;
                    const dh = norm(bo.heading - s.h); s.h = bo.heading;
                    const w = getWindAt(bo.x, bo.y);
                    const twaSign = Math.sign(norm(bo.heading - w.direction)) || 1;
                    // close an open episode's pricing window
                    if (s.ep) {
                        const e = s.ep; e.age += DT;
                        const v = (bo.speed || 0) * 60;
                        if (v < e.vMin) e.vMin = v;
                        if (twaSign !== e.twaSign) e.tacked = true;
                        if (e.rec == null && v >= 0.8 * e.v0 && e.age > 0.5) e.rec = e.age;
                        if (e.age >= 8) { eps.push(e); s.ep = null; }
                    }
                    // accumulate turning; open an episode on threshold inside band
                    s.acc += dh; s.accT += DT;
                    if (s.accT > 2) { s.acc = 0; s.accT = 0; }
                    if (!s.ep && inBand && Math.abs(s.acc) > 0.4) {
                        s.ep = { owner: ownerOf(bo), v0: (bo.speed || 0) * 60, vMin: 1e9,
                                 rec: null, age: 0, tacked: false, twaSign,
                                 armed: rs.roundArmed ? 1 : 0 };
                        s.acc = 0; s.accT = 0;
                    }
                }
            }
            return { eps, bandT };
        }, { seed: SEED0 + t });
        EP.push(...r.eps); bandT += r.bandT;
        console.log(`seed ${SEED0 + t}: ${r.eps.length} episodes, band ${r.bandT.toFixed(0)}s`);
    }
    await b.close();
    const nb = TRIALS * 9;
    console.log(`\n=== TURN EPISODES IN THE CRAWL BAND (dRM 300-1200 leg 1, ${TRIALS} seeds) ===`);
    console.log(`episodes/boat ${(EP.length / nb).toFixed(1)}, band time ${(bandT / nb).toFixed(1)} s/boat → one manoeuvre every ${(bandT / EP.length).toFixed(1)} s`);
    const by = {};
    for (const e of EP) (by[e.owner] = by[e.owner] || []).push(e);
    const med = (a) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
    console.log(`owner            n  /boat  tack%  v0med  vMinMed  drop  rec80%med(s)  norec%`);
    for (const k of Object.keys(by).sort((a, c) => by[c].length - by[a].length)) {
        const E = by[k];
        const recs = E.filter(e => e.rec != null).map(e => e.rec);
        console.log(`  ${k.padEnd(12)} ${String(E.length).padStart(4)} ${(E.length / nb).toFixed(1).padStart(6)}  ${(100 * E.filter(e => e.tacked).length / E.length).toFixed(0).padStart(4)}%  ${med(E.map(e => e.v0)).toFixed(0).padStart(5)} ${med(E.map(e => e.vMin)).toFixed(0).padStart(8)} ${med(E.map(e => e.v0 - e.vMin)).toFixed(0).padStart(5)}  ${(recs.length ? med(recs) : NaN).toFixed(1).padStart(10)}  ${(100 * (E.length - recs.length) / E.length).toFixed(0).padStart(5)}%`);
    }
    console.log(`\n→ 'norec%' = episodes not back to 80% of onset speed within 8 s (the next manoeuvre usually hit first).`);
})();
