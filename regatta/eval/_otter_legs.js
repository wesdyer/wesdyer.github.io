// Probe: Otter Point leg by leg — Wes's races and the fleet. Per leg: seconds; on each leg the
// seconds in KELP (drag 0.65), and the mean distance off the land (inshore vs offshore); contacts.
//   node regatta/eval/_otter_legs.js [seeds]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const wes = fs.readdirSync('regatta/eval/rl/traj').filter(f => f.startsWith('traj_otter_')).map(f => JSON.parse(fs.readFileSync('regatta/eval/rl/traj/' + f, 'utf8'))).filter(j => j.finished)
    .map(j => ({ name: 'WES', fin: Math.round(j.finishTime), ev: (j.events || []).filter(e => e[1] === 'collision_island').length, pts: j.samples.filter(s => s[1] === 1).map(s => [s[0], s[8], s[2], s[3]]) }));
(async () => {
    const seeds = (process.argv[2] || '1,2,3').split(',').map(Number);
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && typeof BotController !== 'undefined');
    const r = await p.evaluate(({ wes, seeds }) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame(); const NL = state.course.route.length;
        const kelp = state.course.islands.filter(s => /kelp/.test(s.kind || '')), land = state.course.islands.filter(s => !s.awash && !(s.id || '').endsWith('.hit') && s.vertices);
        const inKelp = (x, y) => kelp.some(s => pointInPoly(x, y, s.vertices));
        const off = (x, y) => { for (let d = 50; d <= 1500; d += 50) for (let a = 0; a < 12; a++) { const px = x + Math.cos(a / 12 * 6.283) * d, py = y + Math.sin(a / 12 * 6.283) * d; if (land.some(s => Math.hypot(px - s.x, py - s.y) < (s.radius || 1e9) && pointInPoly(px, py, s.vertices))) return d; } return 1500; };
        const summ = (pts) => { const L = Array.from({ length: NL }, () => ({ t: 0, k: 0, off: 0, n: 0 }));
            for (let i = 1; i < pts.length; i++) { const [t0] = pts[i - 1], [t1, leg, x, y] = pts[i], dt = t1 - t0; if (!(dt > 0) || leg >= NL) continue; const o = L[leg]; o.t += dt; if (inKelp(x, y)) o.k += dt; if (i % 15 === 0) { o.off += off(x, y); o.n++; } }
            return L.slice(1).map(o => [Math.round(o.t), Math.round(o.k), o.n ? Math.round(o.off / o.n) : 0]); };
        const out = wes.map(w => ({ name: w.name, fin: w.fin, ev: w.ev, legs: summ(w.pts) }));
        for (const seed of seeds) {
            let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace(); const me = state.boats[0]; me.x = 1e6; me.y = 1e6; me.raceState.finished = true;
            const tr = new Map(), hits = new Map(); let t = 0;
            window.onRaceEvent = (type, e) => { if (type === 'collision_island' && e && e.boat) hits.set(e.boat, (hits.get(e.boat) || 0) + 1); };
            while (t < 600 && !state.boats.every(bt => bt.raceState.finished)) { update(1 / 30); t += 1 / 30; me.x = 1e6; if (state.race.status !== 'racing') continue;
                for (const bt of state.boats) { if (bt === me || bt.raceState.finished) continue; if (!tr.has(bt)) tr.set(bt, []); tr.get(bt).push([state.race.timer, bt.raceState.leg, bt.x, bt.y]); } }
            window.onRaceEvent = null;
            for (const [bt, pts] of tr) out.push({ name: bt.name, fin: bt.raceState.finished ? Math.round(bt.raceState.finishTime) : 'DNF', ev: hits.get(bt) || 0, legs: summ(pts) });
        }
        return out;
    }, { wes, seeds });
    r.sort((a, c) => (a.fin === 'DNF') - (c.fin === 'DNF') || a.fin - c.fin);
    for (const o of r) console.log(`${o.name.padEnd(10)} ${String(o.fin).padStart(4)}  hits ${String(o.ev).padStart(3)}  ` + o.legs.map((l, i) => `L${i + 1} ${String(l[0]).padStart(3)}s kelp ${String(l[1]).padStart(2)}s off-land ${String(l[2]).padStart(4)}u`).join(' | '));
    await b.close();
})();
