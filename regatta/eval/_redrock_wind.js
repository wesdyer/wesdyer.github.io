// Probe: Redrock Reservoir's wind, leg by leg — what the canyon does to a boat. For Wes's races
// (the current layout's fingerprint) and the fleet: per leg, seconds, time in a TOWER SHADOW
// (the wind at the boat below 70% of the region's own breeze — regionWindAt is the breeze
// without lee or gusts), time in a GUST (more than 4 kn over it), and the mean wind sailed.
//   node regatta/eval/_redrock_wind.js [seeds]     (from the repo root)
// Env: FP=<fingerprint> (default 18d5c8a8)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const FP = process.env.FP || '18d5c8a8';
const wes = fs.readdirSync('regatta/eval/rl/traj').filter(f => f.startsWith('traj_redrock_')).map(f => JSON.parse(fs.readFileSync('regatta/eval/rl/traj/' + f, 'utf8')))
    .filter(j => String(j.venueFingerprint).split(':')[0] === FP && j.finished)
    .map(j => ({ fin: Math.round(j.finishTime), pts: j.samples.filter(s => s[1] === 1).map(s => [s[0], s[8], s[2], s[3], s[7]]) }));
(async () => {
    const seeds = (process.argv[2] || '1,2,3').split(',').map(Number);
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && typeof BotController !== 'undefined');
    const r = await p.evaluate(async ({ wes, seeds }) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const NL = state.course.route.length;
        const summ = (samples, windOf) => {   // samples: [t, leg, x, y, (recorded tws)]
            const L = Array.from({ length: NL }, () => ({ t: 0, lee: 0, gust: 0, w: 0, n: 0 })); let run = 0, best = 0, cells = 0;
            for (let i = 1; i < samples.length; i++) { const [t0] = samples[i - 1], [t1, leg, x, y, rec] = samples[i]; const dt = t1 - t0; if (!(dt > 0) || leg >= NL) continue;
                const o = L[leg]; o.t += dt; const base = regionWindAt(x, y).speed, here = windOf(x, y, rec);
                if (here < base * 0.7) o.lee += dt; if (here > base + 4) { o.gust += dt; if (run === 0) cells++; run += dt; best = Math.max(best, run); } else run = 0; o.w += here * dt; }
            L.best = best; L.cells = cells;
            const rr = L.map(o => [Math.round(o.t), Math.round(o.lee), Math.round(o.gust), o.t ? +(o.w / o.t).toFixed(1) : 0]); rr.best = +best.toFixed(1); rr.cells = cells; rr.lee = Math.round(L.reduce((a, o) => a + o.lee, 0)); return rr;
        };
        // Wes: the wind he sailed was recorded (sample[7] = windSpd)
        const out = { wes: wes.map(w => { const l = summ(w.pts, (x, y, rec) => rec); return { fin: w.fin, legs: l, best: l.best, cells: l.cells, lee: l.lee }; }), fleet: [] };
        for (const seed of seeds) {
            let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace();
            const me = state.boats[0]; me.controller = new BotController(me);
            const tr = new Map(); let t = 0;
            while (t < 600 && !state.boats.every(bt => bt.raceState.finished)) {
                me.controller.update(1 / 30); const d = normalizeAngle(me.controller.targetHeading - me.heading);
                state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(1 / 30); t += 1 / 30;
                if (state.race.status !== 'racing') continue;
                for (const bt of state.boats) { if (bt.raceState.finished) continue; if (!tr.has(bt)) tr.set(bt, []); tr.get(bt).push([state.race.timer, bt.raceState.leg, bt.x, bt.y, getWindAt(bt.x, bt.y).speed]); }
            }
            for (const [bt, pts] of tr) { const l = summ(pts, (x, y, rec) => rec); out.fleet.push({ name: `s${seed} ${bt.name}`, fin: bt.raceState.finished ? Math.round(bt.raceState.finishTime) : 'DNF', legs: l, best: l.best, cells: l.cells, lee: l.lee }); }
        }
        return out;
    }, { wes, seeds });
    const row = (tag, fin, legs, o) => console.log(`${tag.padEnd(16)} ${String(fin).padStart(4)}  shadow ${String(o.lee).padStart(3)}s  gusts caught ${o.cells}  longest gust ride ${o.best}s   ` + legs.slice(1).map((l, i) => `L${i + 1} ${String(l[0]).padStart(2)}s lee${String(l[1]).padStart(3)} gust${String(l[2]).padStart(3)} ${String(l[3]).padStart(4)}kt`).join(' |'));
    console.log('WES (fp ' + FP + ')'); r.wes.forEach(w => row('wes', w.fin, w.legs, w));
    console.log('FLEET'); r.fleet.sort((a, c) => (a.fin === 'DNF') - (c.fin === 'DNF') || a.fin - c.fin).forEach(f => row(f.name, f.fin, f.legs, f));
    await b.close();
})();
