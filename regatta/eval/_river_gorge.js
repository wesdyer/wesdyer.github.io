// Probe: Sockeye Run's gorge (the long last leg) — for the Mechanic and Explorer design.
// Per boat, Wes's races and the fleet's: land/rock contacts on the last leg (episodes, a
// second apart), which arm of the finish island it took (east = through R9 to M4's end,
// west = past the p45 boulders to M5's end) and the seconds from the split (y < -5000) to
// the finish; and how close it came to a probe point (BEAR, default the s11 gravel bar).
//   node regatta/eval/_river_gorge.js [seeds]     (from the repo root)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const TRAJ = 'regatta/eval/rl/traj';
const FPS = ['9f41277d', '76659ee5'];
const BEAR = (process.env.BEAR || '2350,-4330').split(',').map(Number);
const wes = fs.readdirSync(TRAJ).filter(f => f.startsWith('traj_river_')).map(f => JSON.parse(fs.readFileSync(path.join(TRAJ, f), 'utf8')))
    .filter(j => FPS.includes(String(j.venueFingerprint).split(':')[0]))
    .map(j => {
        const race = j.samples.filter(s => s[1] === 1);
        const legAt = t => { const s = race.find(s => s[0] >= t); return s ? s[8] : -1; };
        const hits = j.events.filter(e => e[1] === 'collision_island' && legAt(e[0]) === 3).map(e => e[0]);
        return { fin: Math.round(j.finishTime), pts: race.map(s => [s[0], s[8], s[2], s[3]]), hits };
    });
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.VenueDoc && typeof BotController !== 'undefined');
    const seeds = (process.argv[2] || '1,2,3,4').split(',').map(Number);
    const r = await p.evaluate(async ({ wes, seeds, BEAR }) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const episodes = (ts) => ts.filter((t, i) => i === 0 || t - ts[i - 1] > 1).length;
        const judge = (pts, fin) => {
            const east = pts.some(([, leg, x, y]) => leg === 3 && x > 5450 && x < 5850 && y > -6300 && y < -5900);
            const split = pts.find(([, leg, , y]) => leg === 3 && y < -5000);
            const bear = Math.min(...pts.map(([, , x, y]) => Math.hypot(x - BEAR[0], y - BEAR[1])));
            return { arm: east ? 'E' : 'W', tail: split && fin !== 'DNF' ? Math.round(fin - split[0]) : '-', bear: Math.round(bear) };
        };
        const out = { wes: wes.map(w => ({ name: 'Wes', fin: w.fin, hits: episodes(w.hits), ...judge(w.pts, w.fin) })), fleet: [] };
        for (const seed of seeds) {
            let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace(); await new Promise(r => setTimeout(r, 100));
            const me = state.boats[0]; me.controller = new BotController(me);
            const hits = new Map(), tr = new Map();
            const prev = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => { if (ty === 'collision_island' && d && d.boat && d.boat.raceState.leg === 3 && !d.isFloe) { if (!hits.has(d.boat)) hits.set(d.boat, []); hits.get(d.boat).push(state.race.timer); } if (prev) prev(ty, d); };
            let t = 0; const dt = 1 / 30;
            while (t < 600 && !state.boats.every(bt => bt.raceState.finished)) {
                me.controller.update(dt); const d = normalizeAngle(me.controller.targetHeading - me.heading);
                state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(dt); t += dt;
                if (state.race.status !== 'racing' || Math.round(t * 30) % 10) continue;
                for (const bt of state.boats) { if (bt.raceState.finished) continue; if (!tr.has(bt)) tr.set(bt, []); tr.get(bt).push([state.race.timer, bt.raceState.leg, bt.x, bt.y]); }
            }
            window.onRaceEvent = prev;
            for (const [bt, pts] of tr) { const fin = bt.raceState.finished ? Math.round(bt.raceState.finishTime) : 'DNF';
                out.fleet.push({ name: `s${seed} ${bt.name}`, fin, hits: episodes(hits.get(bt) || []), ...judge(pts, fin) }); }
        }
        return out;
    }, { wes, seeds, BEAR });
    const row = o => console.log(`${o.name.padEnd(16)} ${String(o.fin).padStart(4)}  L3 contacts ${String(o.hits).padStart(2)}  arm ${o.arm}  split→fin ${String(o.tail).padStart(3)}s  bear ${o.bear}`);
    r.wes.forEach(row); console.log('--');
    r.fleet.sort((a, c) => (a.fin === 'DNF') - (c.fin === 'DNF') || a.fin - c.fin).forEach(row);
    const f = r.fleet, clean = f.filter(o => o.hits === 0 && o.fin !== 'DNF').length;
    console.log(`fleet clean gorge: ${clean}/${f.length}; arms E ${f.filter(o => o.arm === 'E').length} W ${f.filter(o => o.arm === 'W').length}`);
    await b.close();
})();
