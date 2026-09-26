// Probe: Glowtide Strait leg by leg — Wes's recorded races vs the fleet. Per leg: seconds, the
// mean tidal current along the direction of travel (kn; + fair, - foul), the share of the leg
// spent in a fair stream of 1.5 kn or more, and (fleet) contacts with rock / sunken rock / shoal.
//   node regatta/eval/_glowtide_legs.js [seeds]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const wes = fs.readdirSync('regatta/eval/rl/traj').filter(f => f.startsWith('traj_glowtide_')).map(f => JSON.parse(fs.readFileSync('regatta/eval/rl/traj/' + f, 'utf8'))).filter(j => j.finished)
    .map(j => ({ fin: Math.round(j.finishTime), fp: String(j.venueFingerprint).split(':')[0], ev: (j.events || []).filter(e => e[1] === 'collision_island').length, pts: j.samples.filter(s => s[1] === 1).map(s => [s[0], s[8], s[2], s[3]]) }));
(async () => {
    const seeds = (process.argv[2] || '1,2,3').split(',').map(Number);
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && typeof BotController !== 'undefined');
    const r = await p.evaluate(({ wes, seeds }) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'glowtide', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame(); const NL = state.course.route.length;
        const summ = (pts) => { const L = Array.from({ length: NL }, () => ({ t: 0, c: 0, fair: 0 }));
            for (let i = 1; i < pts.length; i++) { const [t0, , x0, y0] = pts[i - 1], [t1, leg, x1, y1] = pts[i], dt = t1 - t0, d = Math.hypot(x1 - x0, y1 - y0); if (!(dt > 0) || leg >= NL || d < 0.01) continue;
                const cu = getCurrentAt(x1, y1), along = cu ? cu.speed * (Math.sin(cu.direction) * (x1 - x0) - Math.cos(cu.direction) * (y1 - y0)) / d : 0;   // kn along the track (direction = where it flows)
                L[leg].t += dt; L[leg].c += along * dt; if (along > 0) L[leg].fair += dt * (cu && cu.speed >= 1.5 ? 1 : 0); }
            return L.map(o => [Math.round(o.t), o.t ? +(o.c / o.t).toFixed(2) : 0, o.t ? Math.round(100 * o.fair / o.t) : 0]); };
        const probe = getCurrentAt(0, 0);
        const out = { keys: Object.keys(probe || {}), wes: wes.map(w => ({ fin: w.fin, fp: w.fp, ev: w.ev, legs: summ(w.pts) })), fleet: [] };
        for (const seed of seeds) {
            let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace(); const me = state.boats[0]; me.x = 1e6; me.y = 1e6; me.raceState.finished = true;
            const tr = new Map(), hits = new Map(); let t = 0;
            window.onRaceEvent = (type, e) => { if (type === 'collision_island' && e && e.boat) hits.set(e.boat, (hits.get(e.boat) || 0) + 1); };
            while (t < 600 && !state.boats.every(bt => bt.raceState.finished)) { update(1 / 30); t += 1 / 30; me.x = 1e6; if (state.race.status !== 'racing') continue;
                for (const bt of state.boats) { if (bt === me || bt.raceState.finished) continue; if (!tr.has(bt)) tr.set(bt, []); tr.get(bt).push([state.race.timer, bt.raceState.leg, bt.x, bt.y]); } }
            window.onRaceEvent = null;
            for (const [bt, pts] of tr) out.fleet.push({ name: bt.name, fin: bt.raceState.finished ? Math.round(bt.raceState.finishTime) : 'DNF', ev: hits.get(bt) || 0, legs: summ(pts) });
        }
        return out;
    }, { wes, seeds });
    console.log('current keys', r.keys.join(','));
    const row = (tag, o) => console.log(`${tag.padEnd(14)} ${String(o.fin).padStart(4)} contacts ${String(o.ev).padStart(3)}  ` + o.legs.slice(1).map((l, i) => `L${i + 1} ${String(l[0]).padStart(3)}s cur ${String(l[1]).padStart(5)} fair≥1.5 ${String(l[2]).padStart(3)}%`).join(' | '));
    console.log('WES'); r.wes.forEach(w => row('wes ' + w.fp.slice(0, 4), w));
    console.log('FLEET'); r.fleet.sort((a, c) => (a.fin === 'DNF') - (c.fin === 'DNF') || a.fin - c.fin).forEach(f => row(f.name, f));
    await b.close();
})();
