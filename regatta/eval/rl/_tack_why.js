// WHICH TERM BUYS EACH TACK? (2026-08-11, arctic push)
//
// arctic's gap is MANOEUVRE COUNT: his leg-1 tacks are 5 (median, 29 laps), the
// fleet's 19-23, and the odometer 1.64x his line on a router plan that already
// equals it. Eight shapes have died aiming at that number (AC1/TK1/TK2/TK3/
// LANE1/LANE2 + two clearance extensions) and none of them ever asked the
// argmin what it was actually buying. This does.
//
// Runs on treeTW — HEAD plus a probe-only decomposition of `scoreTack` into its
// additive terms (vmg / press / cur / land / riv / shift / cover) and an emitter
// at each of getStrategicHeading's four tack-region exits (layline / cd_hold /
// blow_hold / score). Every commanded tack is logged with BOTH tacks' full term
// vectors, so the decisive term can be recovered offline:
//
//   a tack from the current side happens iff  M = f_other - f_cur - tackBonus >= 0
//   ablating term X moves it to               M - (X_other - X_cur)
//   ⇒ X is DECISIVE for this tack iff  M >= 0  and  M - dX < 0
//
// ⚠️ EPISODES, NOT FRAMES (rule 2): the emitter dedups against the last COMMANDED
// side, not against boat.heading — during the turn the heading still reads the old
// tack for a second or more and a frame-counter multiplies one manoeuvre by ~10.
//
// usage: node _tack_why.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeTW');

(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const ALL = { rec: [], kind: {}, tk: {}, dec: 0, up: 0, fetch: 0, fetchH: [], legTacks: [] };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            window.__tkLog = { rec: [] };
            // independent per-boat leg-1 tack counter (cross-check on the emitter)
            const side = {}, cnt = {};
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished || b.raceState.leg !== 1) continue;
                    const s = b.lastWindSide;
                    if (s === undefined) continue;
                    if (side[b.name] != null && s !== side[b.name]) cnt[b.name] = (cnt[b.name] || 0) + 1;
                    side[b.name] = s;
                }
                if (state.race.timer > 895) break;
            }
            const L = window.__tkLog;
            return { rec: L.rec, kind: L.kind || {}, tk: L.tk || {}, dec: L.dec || 0,
                     up: L.up || 0, fetch: L.fetch || 0, fetchH: L.fetchH || [],
                     legTacks: Object.values(cnt) };
        }, SEED0 + t);
        ALL.rec.push(...r.rec); ALL.dec += r.dec; ALL.up += r.up; ALL.fetch += r.fetch;
        ALL.fetchH.push(...r.fetchH); ALL.legTacks.push(...r.legTacks);
        for (const k in r.kind) ALL.kind[k] = (ALL.kind[k] || 0) + r.kind[k];
        for (const k in r.tk) ALL.tk[k] = (ALL.tk[k] || 0) + r.tk[k];
        console.log(`seed ${SEED0 + t}: ${r.rec.length} tacks, ${r.dec} decisions, leg1 tacks med ${med(r.legTacks)}`);
    }
    await br.close();

    const R = ALL.rec, n = R.length || 1;
    const P = x => `${x} (${(100 * x / n).toFixed(1)}%)`;
    console.log(`\n=== ${VENUE.toUpperCase()} TACK ARGMIN (${TRIALS} seeds) ===`);
    console.log(`upwind strategic calls ${ALL.up}   of which FETCH (target outside the cone, sail straight at it) ${ALL.fetch} = ${(100 * ALL.fetch / (ALL.up || 1)).toFixed(1)}%`);
    console.log(`tack-region decisions ${ALL.dec}   commanded TACK EPISODES ${R.length}`);
    console.log(`leg-1 tacks per boat: med ${med(ALL.legTacks)}  p25 ${q(ALL.legTacks, .25)}  p75 ${q(ALL.legTacks, .75)}  (n=${ALL.legTacks.length} boats)`);
    console.log(`\nEXIT that commanded the tack:`);
    for (const k of Object.keys(ALL.tk).sort((a, b) => ALL.tk[b] - ALL.tk[a]))
        console.log(`   ${k.padEnd(10)} ${P(ALL.tk[k])}   (that exit was taken ${ALL.kind[k]} times)`);

    // --- decisive-term ablation, score-branch tacks only ---
    const TERMS = ['vmg', 'press', 'cur', 'land', 'riv', 'shift', 'cover'];
    const sc = R.filter(r => r.kind === 'score');
    console.log(`\n--- SCORE-BRANCH TACKS (n=${sc.length}) : which single term is DECISIVE? ---`);
    console.log(`(decisive = removing it alone flips the decision back to HOLD)`);
    const dec = {}; let none = 0;
    const margins = [];
    for (const r of sc) {
        const cur = r.ct === 1 ? r.cS : r.cP, oth = r.ct === 1 ? r.cP : r.cS;
        const fCur = r.ct === 1 ? r.sS : r.sP, fOth = r.ct === 1 ? r.sP : r.sS;
        const M = fOth - fCur - r.tb;
        margins.push(M);
        let hit = 0;
        for (const T of TERMS) {
            const d = (oth[T] || 0) - (cur[T] || 0);
            if (M - d < 0) { dec[T] = (dec[T] || 0) + 1; hit = 1; }
        }
        if (!hit) none++;
    }
    for (const T of TERMS.filter(t => dec[t]).sort((a, b) => dec[b] - dec[a]))
        console.log(`   ${T.padEnd(6)} decisive on ${dec[T]} (${(100 * dec[T] / (sc.length || 1)).toFixed(1)}%)`);
    console.log(`   no single term decisive (a majority of small terms): ${none} (${(100 * none / (sc.length || 1)).toFixed(1)}%)`);
    console.log(`   tack margin M at the moment of tacking: med ${med(margins).toFixed(3)}  p75 ${q(margins, .75).toFixed(3)}  p90 ${q(margins, .90).toFixed(3)}  (tackBonus med ${med(sc.map(r => r.tb)).toFixed(2)})`);

    // how big is each term's SPREAD between the two tacks, over all tack records
    console.log(`\n--- term SPREAD between the two tacks at a tack decision (|other - cur|) ---`);
    for (const T of TERMS) {
        const d = R.map(r => Math.abs(((r.ct === 1 ? r.cP : r.cS)[T] || 0) - ((r.ct === 1 ? r.cS : r.cP)[T] || 0)));
        const nz = d.filter(x => x > 1e-9);
        console.log(`   ${T.padEnd(6)} nonzero on ${(100 * nz.length / n).toFixed(1)}%   med(nonzero) ${nz.length ? med(nz).toFixed(3) : '-'}   p90 ${nz.length ? q(nz, .9).toFixed(3) : '-'}`);
    }

    // the land veto's own anatomy
    const anyBlk = R.filter(r => r.cS.blk1 || r.cS['blk2.5'] || r.cP.blk1 || r.cP['blk2.5']).length;
    const softBlk = R.filter(r => [r.cS.blk1, r.cS['blk2.5'], r.cP.blk1, r.cP['blk2.5']].some(v => v === 2)).length;
    console.log(`\n--- the -3.0 grid veto ---`);
    console.log(`   at least one projection BLOCKED on one of the two tacks: ${P(anyBlk)}`);
    console.log(`   ...of which the blocked cell was SOFT (grindable ice, not hard land): ${P(softBlk)}`);
    console.log(`   distance to target at a tack: med ${med(R.map(r => r.dist)).toFixed(0)}u  p25 ${q(R.map(r => r.dist), .25).toFixed(0)}  p75 ${q(R.map(r => r.dist), .75).toFixed(0)}`);
    console.log(`   |TWA to target| at a tack: med ${(med(R.map(r => Math.abs(r.twaT))) * 180 / Math.PI).toFixed(0)}deg`);
    if (ALL.fetchH.length) {
        console.log(`   FETCH samples: dist med ${med(ALL.fetchH.map(f => f[0])).toFixed(0)}u   |TWA| med ${(med(ALL.fetchH.map(f => f[1])) * 180 / Math.PI).toFixed(0)}deg  vs optTWA ${(med(ALL.fetchH.map(f => f[2])) * 180 / Math.PI).toFixed(0)}deg`);
    }
    fs.writeFileSync(path.join(__dirname, 'tack_why_' + VENUE + '.json'), JSON.stringify(R));
    console.log(`\nsaved tack_why_${VENUE}.json  (${R.length} records)`);
})();

function q(a, pp) { if (!a || !a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; }
function med(a) { return q(a, .5); }
