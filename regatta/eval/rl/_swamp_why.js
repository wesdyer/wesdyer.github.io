// WHAT COSTS GATORGRASS BAYOU ITS TIME? (2026-08-10, the swamp push.)
//
// Swamp is 2.09x med / 2.19x mean — the campaign's biggest gap — and it is unlike
// every venue before it in TWO ways at once, so the usual probes cannot separate
// the causes:
//   * it is a LIGHT-AIR venue: wind 0.90-4.84 kt across 54 regions (one named
//     "dead air"), where every other venue runs 11-16 kt in 1-9 regions;
//   * it carries a GRADED DRAG FIELD (mudflat 0.9, weedmat 0.75, weedbed 0.6,
//     lilybed 0.35, duckweed 0) on top of 45 solid shapes and 2051 hard prop
//     colliders.
// So a slow boat here has four candidate excuses — no breeze, weed, a rock, or
// traffic — and they want different builds. This attributes her slow time to
// each, and does the same for the HUMAN so the two are compared on the water
// they actually sailed rather than on the venue average.
//
//   node _swamp_why.js [trials] [seed0] [tree]
//
// ⭐ THE QUESTION THAT MATTERS MOST: on a patchy light-air course, does she ROUTE
// THROUGH THE PRESSURE while the fleet sails into the holes? Her recordings stamp
// `windSpd` at every sample (schema-2 format index 7), so her mean local breeze is
// directly measurable and directly comparable to the fleet's. If she finds
// materially more wind than they do, that is a capability the campaign has never
// built for, and it is not a contact or avoidance problem at all.
//
// ⚠️ UNITS (rule 18): `spd` in both the recording and the engine is PER FRAME —
// u/s is spd*60. `windSpd` is knots. And ⚠️ the recording's `t` runs BACKWARDS in
// the prestart (the 30→0 timer), so racing frames are gated on `phase`, never on
// a dt sign.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 4300;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHD11');
const REPO = path.resolve(__dirname, '../../..');

const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

// ── the human side, computed offline ────────────────────────────────────────
// Her drag exposure is NOT recorded, so it is recomputed from the same compiled
// islands the engine uses — VenueDoc.shoalField at her own positions.
function humanSide() {
    const sb = { window: {}, Math, structuredClone, console };
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(REPO, 'regatta/js/arena.js'), 'utf8'), sb);
    vm.runInContext(fs.readFileSync(path.join(REPO, 'regatta/js/venuedoc.js'), 'utf8'), sb);
    const VD = sb.window.VenueDoc;
    const ds = { window: { VENUE_DOC: {} } }; vm.createContext(ds);
    vm.runInContext(fs.readFileSync(path.join(REPO, 'regatta/eval/venues/swamp.venue.js'), 'utf8'), ds);
    const islands = VD.compile(ds.window.VENUE_DOC.swamp).islands.filter(i => i.awash);

    const dir = path.join(__dirname, 'traj');
    const out = [];
    for (const f of fs.readdirSync(dir).filter(f => f.startsWith('traj_swamp_'))) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const F = j.format, I = n => F.indexOf(n);
        const rows = j.samples.filter(r => r[I('leg')] >= 1);   // racing only
        if (!rows.length) continue;
        const v = rows.map(r => r[I('spd')] * 60);
        const w = rows.map(r => r[I('windSpd')]);
        const mul = rows.map(r => VD.shoalField(islands, r[I('x')], r[I('y')]));
        out.push({ file: f, n: rows.length, fin: j.finishTime, v, w, mul });
    }
    return out;
}

(async () => {
    const H = humanSide();
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'swamp' })); });
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const acc = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(async ({ seed }) => {
            const hit = {}; const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer) hit[d.boat.name] = 1;
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const DT = 1 / 60;
            const A = { t: 0, dist: 0, wSum: 0, mulSum: 0, vSum: 0,
                        slow: 0, sWind: 0, sDrag: 0, sTouch: 0, sTraffic: 0, sIrons: 0, sOther: 0,
                        sWindSum: 0, sMulSum: 0, wiggle: 0, spin: 0, esc: 0 };
            for (let it = 0; it < 60 * 900; it++) {
                for (const k in hit) delete hit[k];
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished || bo.raceState.leg < 1) continue;
                    const c = bo.controller;
                    const v = (bo.speed || 0) * 60;
                    const w = getWindAt(bo.x, bo.y);
                    const mul = bo.shoalMul != null ? bo.shoalMul : 1;
                    A.t += DT; A.dist += v * DT; A.wSum += w.speed * DT; A.mulSum += mul * DT; A.vSum += v * DT;
                    if (v >= 20) continue;
                    A.slow += DT; A.sWindSum += w.speed * DT; A.sMulSum += mul * DT;
                    // PRECEDENCE, most physical first (rule 27's habit): on a rock >
                    // stopped by weed > no breeze to sail with > in irons > traffic.
                    if (hit[bo.name]) A.sTouch += DT;
                    else if (mul < 0.7) A.sDrag += DT;
                    else if (w.speed < 2.0) A.sWind += DT;
                    else if (Math.abs(normalizeAngle(bo.heading - w.direction)) < 0.55) A.sIrons += DT;
                    else if (c && c.threatBoat && c.riskState && c.riskState !== 'LOW') A.sTraffic += DT;
                    else A.sOther += DT;
                    if (c) { if (c.wiggleActive) A.wiggle += DT; if (c.penaltySpin) A.spin += DT; if (c.iceEscapeTimer > 0) A.esc += DT; }
                }
            }
            window.onRaceEvent = inner;
            return A;
        }, { seed: SEED0 + t });
        acc.push(r);
        console.log(`seed ${SEED0 + t}: ${r.t.toFixed(0)} boat-s racing, ${(100 * r.slow / r.t).toFixed(0)}% under 20 u/s`);
    }
    await b.close();

    const S = k => acc.reduce((a, x) => a + x[k], 0);
    const T = S('t'), SL = S('slow');
    const pct = (a, bb) => bb ? (100 * a / bb).toFixed(0) + '%' : '-';
    console.log(`\n=== GATORGRASS: WHAT COSTS THE TIME (${TRIALS} seeds from ${SEED0}, ${path.basename(ROOT)}) ===`);
    console.log(`fleet racing time ${T.toFixed(0)} boat-s   mean speed ${(S('dist') / T).toFixed(1)} u/s`);
    console.log(`  mean LOCAL WIND the fleet sailed in   ${(S('wSum') / T).toFixed(2)} kt`);
    console.log(`  mean DRAG MULTIPLIER the fleet felt   ${(S('mulSum') / T).toFixed(3)}  (1.0 = clean water)`);

    const hv = [], hw = [], hm = [];
    for (const h of H) { hv.push(mean(h.v)); hw.push(mean(h.w)); hm.push(mean(h.mul)); }
    console.log(`\n  HER THREE LAPS (racing frames only)`);
    for (const h of H) console.log(`    ${h.file.slice(11, 24)}  fin ${h.fin.toFixed(1)}s  speed ${mean(h.v).toFixed(1)} u/s` +
        `  local wind ${mean(h.w).toFixed(2)} kt  drag mul ${mean(h.mul).toFixed(3)}`);
    console.log(`    HUMAN MEAN        speed ${mean(hv).toFixed(1)} u/s   local wind ${mean(hw).toFixed(2)} kt   drag mul ${mean(hm).toFixed(3)}`);
    console.log(`\n  ⭐ PRESSURE GAP   she sails in ${(mean(hw) - S('wSum') / T).toFixed(2)} kt MORE wind than the fleet` +
        `  (${((mean(hw) / (S('wSum') / T) - 1) * 100).toFixed(0)}%)`);
    console.log(`  ⭐ WEED GAP       her drag mul ${mean(hm).toFixed(3)} vs fleet ${(S('mulSum') / T).toFixed(3)}` +
        `  (lower = more weed; she is ${(((S('mulSum') / T) / mean(hm) - 1) * 100).toFixed(0)}% ${mean(hm) < S('mulSum') / T ? 'MORE' : 'LESS'} weeded)`);

    console.log(`\n  THE FLEET'S SLOW TIME (under 20 u/s): ${SL.toFixed(0)} boat-s = ${pct(SL, T)} of racing time`);
    console.log(`    on a rock (land contact)   ${S('sTouch').toFixed(0).padStart(6)} boat-s  ${pct(S('sTouch'), SL)}`);
    console.log(`    stopped in WEED (mul<0.7)  ${S('sDrag').toFixed(0).padStart(6)} boat-s  ${pct(S('sDrag'), SL)}`);
    console.log(`    NO BREEZE (<2.0 kt)        ${S('sWind').toFixed(0).padStart(6)} boat-s  ${pct(S('sWind'), SL)}`);
    console.log(`    in irons                   ${S('sIrons').toFixed(0).padStart(6)} boat-s  ${pct(S('sIrons'), SL)}`);
    console.log(`    traffic (engaged threat)   ${S('sTraffic').toFixed(0).padStart(6)} boat-s  ${pct(S('sTraffic'), SL)}`);
    console.log(`    none of the above          ${S('sOther').toFixed(0).padStart(6)} boat-s  ${pct(S('sOther'), SL)}`);
    console.log(`  conditions DURING slow time: mean wind ${(S('sWindSum') / SL).toFixed(2)} kt   mean drag mul ${(S('sMulSum') / SL).toFixed(3)}`);
    console.log(`  helm states (share of racing time): wiggle ${pct(S('wiggle'), T)}  spin ${pct(S('spin'), T)}  contact-escape ${pct(S('esc'), T)}`);
})();
