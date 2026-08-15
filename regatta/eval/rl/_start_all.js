// MEDIAN START TIME, EVERY VENUE, BOTS vs HIM (2026-08-14)
//
// "crossTime = seconds after the gun the boat's hull first clears the line" is the
// campaign's own definition (_start_ledger.js), detected off the game's `leg_complete`
// event for leg 0. This reports it for all ten venues at once, beside the same
// quantity computed from his fingerprint-verified laps, because a start time is only
// interpretable against the human on that document (swamp's start was once 26.94x).
//
// Only the first CUTOFF seconds of each race are simulated — every boat clears the
// line inside that — so ten venues cost about what one full bench does.
//
// ⚠️ OCS boats are reported separately: their crossing time measures the RETURN trip,
// not the approach, and would poison the median (_start_ledger's rule).
// ⚠️ Human side: the gun is the first phase==1 sample; the crossing is the first
// sample with leg >= 1. Same event, same frame of reference.
//
//   node _start_all.js [trials] [seed0] [tree] [cutoffSecs]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeFINAL');
const CUT = parseInt(process.argv[5]) || 90;
const VENUES = ['seatrials', 'ocean', 'bay', 'lake', 'lagoon', 'river', 'swamp', 'glowtide', 'redrock', 'arctic'];

const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };

// ── HIS START, offline from the corpus (fingerprint-verified laps only) ─────
const FP = {};   // venue -> frozen doc fingerprint, taken from _traj_fp's own method
const vm = require('vm');
const REPO = path.resolve(__dirname, '../../..');
const djb = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return h.toString(16) + ':' + str.length; };
const docFp = (p, v) => {
    if (!fs.existsSync(p)) return null;
    const sandbox = { window: { VENUE_DOC: {} } }; vm.createContext(sandbox);
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox); } catch (e) { return null; }
    const doc = sandbox.window.VENUE_DOC && sandbox.window.VENUE_DOC[v];
    return doc ? djb(JSON.stringify(doc)) : null;
};
for (const v of VENUES) FP[v] = docFp(path.join(REPO, 'regatta/eval/venues', v + '.venue.js'), v);

const TD = path.join(__dirname, 'traj');
const human = {};
for (const v of VENUES) {
    const rows = [];
    for (const f of fs.readdirSync(TD).filter(x => x.startsWith(`traj_${v}_`))) {
        const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
        if (!FP[v] || j.venueFingerprint !== FP[v]) continue;        // his doc only
        const F = j.format, gi = (s, k) => s[F.indexOf(k)];
        const S = j.samples.filter(s => gi(s, 'phase') === 1);
        if (!S.length) continue;
        const gun = gi(S[0], 't');
        const c = S.find(s => gi(s, 'leg') >= 1);
        if (c) rows.push(+(gi(c, 't') - gun).toFixed(2));
    }
    human[v] = rows;
}

(async () => {
    const br = await chromium.launch();
    const out = {};
    for (const V of VENUES) {
        const p = await br.newPage();
        await p.addInitScript(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), V);
        await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        const rows = [];
        for (let i = 0; i < TRIALS; i++) {
            const r = await p.evaluate(async ({ seed, CUT }) => {
                window.evalHarness.seed = seed; window.resetGame(); window.startRace();
                const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
                const led = {}, n = state.boats.filter(b => !b.isPlayer).length;
                const inner = window.onRaceEvent;
                window.onRaceEvent = (ty, d) => {
                    if (ty === 'leg_complete' && d && d.leg === 0 && d.boat && !d.boat.isPlayer
                        && led[d.boat.name] == null) led[d.boat.name] = state.race.timer;
                    if (inner) inner(ty, d);
                };
                // ⚠️ OCS AT THE GUN, not OCS-ever. _start_ledger captures
                // `raceState.ocs` in the gun frame; latching it on every racing frame
                // instead counts any boat that is EVER flagged, which on the high-OCS
                // venues threw out half the fleet and left the median on a biased
                // remnant (glowtide n=12 of 27). Both are reported now.
                const ocsGun = {}, ocsEver = {};
                let gunDone = false;
                const dt = 1 / 60;
                for (let it = 0; it < 60 * (CUT + 60); it++) {
                    window.update(dt);
                    if (state.race.status === 'racing') {
                        if (!gunDone) { for (const b of state.boats) if (!b.isPlayer && b.raceState.ocs) ocsGun[b.name] = 1; gunDone = true; }
                        for (const b of state.boats) if (!b.isPlayer && b.raceState.ocs) ocsEver[b.name] = 1;
                        if (state.race.timer > CUT) break;
                        if (Object.keys(led).length >= n) break;
                    }
                    if (state.race.status === 'finished') break;
                }
                const ocs = ocsGun;
                window.onRaceEvent = inner;
                return state.boats.filter(b => !b.isPlayer)
                    .map(b => ({ n: b.name, cross: led[b.name] != null ? +led[b.name].toFixed(2) : null,
                                 ocs: !!ocs[b.name], ocsEver: !!ocsEver[b.name] }));
            }, { seed: SEED0 + i, CUT });
            rows.push(...r);
        }
        await p.close();
        const clean = rows.filter(r => r.cross != null && !r.ocs).map(r => r.cross);
        const ocsN = rows.filter(r => r.ocs).length;
        const ocsEverN = rows.filter(r => r.ocsEver).length;
        const all = rows.filter(r => r.cross != null).map(r => r.cross);   // NO OCS filter
        const never = rows.filter(r => r.cross == null).length;
        out[V] = { med: med(clean), p25: q(clean, .25), p75: q(clean, .75), n: clean.length,
                   medAll: med(all), nAll: all.length,
                   ocsPct: +(100 * ocsN / rows.length).toFixed(1),
                   ocsEverPct: +(100 * ocsEverN / rows.length).toFixed(1), never, tot: rows.length,
                   hMed: med(human[V]), hN: human[V].length };
        const o = out[V];
        // ⚠️ Quote the DIFFERENCE, not a ratio: his start is often sub-second, and a
        // ratio with a ~0.1 s denominator explodes into a meaningless number.
        console.log(`${V.padEnd(10)} med ${String(o.med).padStart(6)}s (ex-OCS, n=${String(o.n).padStart(2)})  ` +
            `ALL-boat med ${String(o.medAll).padStart(6)}s (n=${String(o.nAll).padStart(2)})  ` +
            `p25 ${String(o.p25).padStart(5)} p75 ${String(o.p75).padStart(6)}  ` +
            `OCS@gun ${String(o.ocsPct).padStart(5)}% ever ${String(o.ocsEverPct).padStart(5)}%  ` +
            `him ${o.hMed == null ? ' n/a' : String(o.hMed).padStart(5) + 's(' + o.hN + ')'}  ` +
            `${o.hMed != null ? 'Δ ' + (o.medAll - o.hMed).toFixed(2) + 's' : ''}`);
    }
    await br.close();
    console.log(`\n(crossTime = seconds after the gun the hull first clears the line, _start_ledger's definition.`);
    console.log(` OCS boats excluded from the median — their crossing measures the return trip.)`);
    fs.writeFileSync(path.join(__dirname, '_start_all.json'), JSON.stringify(out, null, 1));
})();
