// WHO ORDERS GLOWTIDE'S EXTRA TACKS? (2026-08-14)
//
// Leg 1 is 19.6 s of pure distance — the biggest single term left on the venue —
// and _glow_beatangle just KILLED the pointing hypothesis: in clean air she holds a
// median TWA of 38 deg against his 40 and spends MORE of her distance close-hauled
// (72.4% vs 70.7%). She points fine. What she does is tack 16 times to his 6, and
// only 44% of her leg-1 distance is clean against his 86%.
//
// Arctic taught the next question the hard way ([[regatta-tack-ownership]]): eight
// shapes died there tuning a tactician that orders only ONE TACK IN FIVE — the
// avoidance stack made 79%. So before anything is built here, ask who is steering
// when the hull actually crosses the wind.
//
// ⚠️ METHOD DIFFERS FROM `_tack_exec.js`, WHICH IS THE GOLD STANDARD. That probe
// reads a LAST-WRITER tag compiled into script.js (rule 27); the only tree carrying
// it, treeTW, is 2669 diff lines behind HEAD and predates the p90 landing, so it
// would answer for code that no longer exists. This attributes each crossing to the
// controller FLAGS live at the moment of the crossing instead — an approximation of
// ownership, not a tag. Where the two disagree, `_tack_exec` on a freshly
// instrumented tree wins. Quote this as "flags at the crossing".
//
// ⚠️ EPISODES, NOT FRAMES (rule 2): a crossing is ONE event. Attribution samples a
// window around it, because the flag that caused the tack may clear during the turn.
//
//   node _glow_tackown.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeFINAL');

(async () => {
    const br = await chromium.launch();
    const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const all = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(async (seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60;
            const st = {};       // per boat: rolling flag history + last side
            const events = [];
            const WIN = 30;      // frames of history kept either side of a crossing
            for (const b of state.boats) if (!b.isPlayer) st[b.id] = { hist: [], side: null, pend: null };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished) continue;
                    const s = st[b.id], c = b.controller || {};
                    const f = {
                        leg: b.raceState.leg,
                        av: (c.lastAvoidDeviation || 0) > 0.08,
                        role: c.avoidanceRole || null,
                        wig: !!c.wiggleActive,
                        esc: !!(c.stuckEscape || c.escapeActive || c.inEscape),
                        armed: !!b.raceState.roundArmed,
                        land: !!(c.collisionData && c.collisionData.type === 'island')
                    };
                    s.hist.push(f); if (s.hist.length > WIN) s.hist.shift();
                    const side = b.lastWindSide;
                    if (side === undefined || side === 0) continue;
                    if (s.side === null) { s.side = side; continue; }
                    if (side !== s.side) {
                        // a crossing. Attribute from the flags in the window BEFORE it.
                        const w = s.hist.slice();
                        const any = k => w.some(x => x[k]);
                        const roleAt = (w.find(x => x.av) || {}).role || null;
                        events.push({ leg: f.leg, av: any('av'), role: roleAt, wig: any('wig'),
                            esc: any('esc'), armed: any('armed'), land: any('land') });
                        s.side = side;
                        s.hist = [];   // one manoeuvre counts once
                    }
                }
            }
            return events;
        }, SEED0 + t);
        all.push(...r);
        console.log(`seed ${SEED0 + t}: ${r.length} crossings`);
    }
    await br.close();

    const legs = [...new Set(all.map(e => e.leg))].sort((a, b) => a - b);
    console.log(`\n=== ${VENUE} — WHO OWNS THE HULL'S SIDE-CHANGES (flags at the crossing) ===`);
    console.log(`${all.length} crossings over ${TRIALS} seeds\n`);
    const row = (label, set) => {
        if (!set.length) return;
        // priority order: a crossing with several flags is charged to the most specific
        const cnt = { escape: 0, land: 0, armed: 0, avoid_GW: 0, avoid_ROW: 0, avoid_none: 0, wiggle: 0, NAV: 0 };
        for (const e of set) {
            if (e.esc) cnt.escape++;
            else if (e.land) cnt.land++;
            else if (e.av) cnt[e.role === 'GIVE_WAY' ? 'avoid_GW' : e.role === 'STAND_ON' ? 'avoid_ROW' : 'avoid_none']++;
            else if (e.wig) cnt.wiggle++;
            else if (e.armed) cnt.armed++;
            else cnt.NAV++;
        }
        const parts = Object.entries(cnt).filter(([, v]) => v)
            .map(([k, v]) => `${k} ${(100 * v / set.length).toFixed(1)}%`).join('  ');
        console.log(`${label.padEnd(12)} n=${String(set.length).padStart(5)}   ${parts}`);
        return cnt;
    };
    const tot = row('ALL LEGS', all);
    for (const L of legs) row(`leg ${L}`, all.filter(e => e.leg === L));
    console.log(`\nNAV share of all crossings: ${(100 * tot.NAV / all.length).toFixed(1)}%   ` +
        `(arctic's was 20.0% by the last-writer tag — if this is high, glowtide is NOT arctic)`);
    console.log(`avoidance share: ${(100 * (tot.avoid_GW + tot.avoid_ROW + tot.avoid_none) / all.length).toFixed(1)}%   ` +
        `(arctic 47.2%)`);
    fs.writeFileSync(path.join(__dirname, `_glow_tackown_${VENUE}.json`), JSON.stringify({ all, tot }, null, 1));
})();
