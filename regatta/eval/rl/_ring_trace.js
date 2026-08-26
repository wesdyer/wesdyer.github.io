// RING TRACE — dump the worst rounding tracks at one mark for shape reading
// (2026-08-24 night, rounding-craft push). For (venue, leg): record every
// bot's track from window open (d<2z on leg) to close (2z receding after
// advance), rank by ring time, print the worst N as coarse polylines with
// event stamps (arm/bank/adv), plus his laps' tracks for the same window.
//   node _ring_trace.js <venue> <leg> <seed> <tree> [N]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const VENUE = process.argv[2] || 'redrock';
const LEG = parseInt(process.argv[3]) || 2;
const SEED = parseInt(process.argv[4]) || 9400;
const TREE = process.argv[5] || 'treeN1';
const N = parseInt(process.argv[6]) || 3;
const ROOT = path.join(__dirname, TREE);
const djb = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return h.toString(16) + ':' + str.length; };
const docFp = (p, v) => {
    const sandbox = { window: { VENUE_DOC: {} } };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox);
    const doc = sandbox.window.VENUE_DOC && sandbox.window.VENUE_DOC[v];
    return doc ? djb(JSON.stringify(doc)) : null;
};
const FP = docFp(path.resolve(__dirname, '../../assets/venues', VENUE + '.venue.js'), VENUE);

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await p.evaluate(({ seed, LEG }) => {
        window.evalHarness.seed = seed; window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
        const e = state.course.route[LEG];
        const rm = e && e.mark;
        if (!rm) return null;
        const DT = 1 / 60;
        const tr = {};
        for (let it = 0; it < 60 * 900; it++) {
            window.update(DT);
            if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
            const t = it * DT;
            for (const bo of state.boats.filter(x => !x.isPlayer)) {
                const rs = bo.raceState;
                if (rs.leg < LEG || rs.leg > LEG + 1) continue;
                const d = Math.hypot(bo.x - rm.x, bo.y - rm.y);
                let T = tr[bo.name];
                if (!T) { if (rs.leg === LEG && d < rm.zone * 2.0) T = tr[bo.name] = { pts: [], ev: [], ring: 0, done: false, prevD: null }; else continue; }
                if (T.done) continue;
                if (d < rm.zone * 1.5) T.ring += DT;
                if ((it % 30) === 0) T.pts.push([Math.round(bo.x), Math.round(bo.y), +t.toFixed(1), Math.round((bo.speed || 0) * 60)]);
                if (rs.leg === LEG) {
                    if (rs.roundArmed && !T.armed) { T.armed = 1; T.ev.push(['arm', +t.toFixed(1)]); }
                    if (rs.roundBanked && !T.banked) { T.banked = 1; T.ev.push(['bank', +t.toFixed(1)]); }
                    if (rs.penalty && !T.pen) { T.pen = 1; T.ev.push(['PEN', +t.toFixed(1)]); }
                } else if (!T.adv) { T.adv = 1; T.ev.push(['adv', +t.toFixed(1)]); }
                if (T.adv && d > rm.zone * 2.0 && T.prevD != null && d > T.prevD) T.done = true;
                T.prevD = d;
            }
            if (state.race.status === 'racing' && state.race.timer > 895) break;
        }
        return { mark: { x: rm.x, y: rm.y, zone: rm.zone, side: rm.side, req: rm.reqSweep }, tracks: tr };
    }, { seed: SEED, LEG });
    await b.close();
    if (!r) { console.log('no round mark on that leg'); return; }
    const { mark, tracks } = r;
    console.log(`MARK leg ${LEG} (${mark.side}) at ${Math.round(mark.x)},${Math.round(mark.y)} zone ${Math.round(mark.zone)} req ${(mark.req * 180 / Math.PI).toFixed(0)}°`);
    const rows = Object.entries(tracks).sort((a, b2) => b2[1].ring - a[1].ring);
    for (const [name, T] of rows.slice(0, N)) {
        console.log(`\n${name}: ring ${T.ring.toFixed(1)}s  events ${T.ev.map(e => e[0] + '@' + e[1]).join(' ')}`);
        // polar polyline relative to mark: r(dist), theta(deg), speed
        console.log('  t | r(u) | brg(deg) | spd: ' + T.pts.map(pt => {
            const dx = pt[0] - mark.x, dy = pt[1] - mark.y;
            return `${pt[2]}|${Math.round(Math.hypot(dx, dy))}|${Math.round(Math.atan2(dy, dx) * 180 / Math.PI)}|${pt[3]}`;
        }).join('  '));
    }
    // his laps for the same window
    const TD = path.join(__dirname, 'traj');
    for (const f of fs.readdirSync(TD).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
        const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
        if (String(j.venueFingerprint) !== String(FP)) continue;
        const F = j.format, gi = (s, k) => s[F.indexOf(k)];
        const rows2 = j.samples.filter(s => gi(s, 'phase') === 1);
        let open = false, out = [], ring = 0, prevD = null, adv = false, prevT = null;
        for (const s of rows2) {
            const t = gi(s, 't'), x = gi(s, 'x'), y = gi(s, 'y'), lg = gi(s, 'leg');
            if (lg < LEG || lg > LEG + 1) continue;
            const d = Math.hypot(x - mark.x, y - mark.y);
            if (!open) { if (lg === LEG && d < mark.zone * 2.0) open = true; else continue; }
            if (d < mark.zone * 1.5 && prevT != null) ring += Math.min(0.5, t - prevT);
            if (out.length === 0 || t - out[out.length - 1][2] >= 0.5) out.push([x, y, t]);
            if (lg > LEG) adv = true;
            if (adv && d > mark.zone * 2.0 && prevD != null && d > prevD) break;
            prevD = d; prevT = t;
        }
        if (!out.length) continue;
        console.log(`\nHIM (${f.slice(-10)}): ring ${ring.toFixed(1)}s`);
        console.log('  t | r | brg: ' + out.map(pt => {
            const dx = pt[0] - mark.x, dy = pt[1] - mark.y;
            return `${pt[2].toFixed(1)}|${Math.round(Math.hypot(dx, dy))}|${Math.round(Math.atan2(dy, dx) * 180 / Math.PI)}`;
        }).join('  '));
    }
})();
