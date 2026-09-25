// Probe: Sockeye Run leg by leg — Wes's recorded races against the fleet. Per leg: seconds,
// seconds in white water (rapidsTurbAt > 0.2), mean stream along the track (kn; + = carried),
// and on the long gorge leg which side of the footbridge island (s42) the boat took.
//   node regatta/eval/_river_legs.js [seeds]     (from the repo root)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const TRAJ = 'regatta/eval/rl/traj';
const FPS = ['9f41277d', '76659ee5'];
const wes = fs.readdirSync(TRAJ).filter(f => f.startsWith('traj_river_')).map(f => JSON.parse(fs.readFileSync(path.join(TRAJ, f), 'utf8')))
    .filter(j => FPS.includes(String(j.venueFingerprint).split(':')[0]))
    // [t, leg, x, y] while racing
    .map(j => ({ fp: String(j.venueFingerprint).split(':')[0], fin: j.finishTime, pts: j.samples.filter(s => s[1] === 1).map(s => [s[0], s[8], s[2], s[3]]) }));
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.VenueDoc && typeof BotController !== 'undefined');
    const seeds = (process.argv[2] || '1,2,3,4').split(',').map(Number);
    const r = await p.evaluate(async ({ wes, seeds }) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        // Per-leg summary of a track of [t, leg, x, y].
        const summarise = (pts) => {
            const L = [0, 1, 2, 3].map(() => ({ t: 0, rap: 0, cur: 0, n: 0 }));
            for (let i = 1; i < pts.length; i++) {
                const [t0, , xa, ya] = pts[i - 1], [t1, leg, x, y] = pts[i]; const dt = t1 - t0; if (!(dt > 0) || leg > 3) continue;
                const o = L[leg]; o.t += dt; if (rapidsTurbAt(x, y) > 0.2) o.rap += dt;
                const c = getCurrentAt(x, y), hx = x - xa, hy = y - ya, h = Math.hypot(hx, hy);
                if (c && h > 0.5) { o.cur += c.speed * (Math.sin(c.direction) * hx - Math.cos(c.direction) * hy) / h; o.n++; }
            }
            return L.map(o => [Math.round(o.t), Math.round(o.rap), +(o.cur / Math.max(1, o.n)).toFixed(2)]);
        };
        resetGame();   // the river's course (currents, rapids) must be loaded before Wes's races are read against it
        const out = { wes: wes.map(w => ({ fp: w.fp, fin: Math.round(w.fin), legs: summarise(w.pts) })), fleet: [] };
        for (const seed of seeds) {
            let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace(); await new Promise(r => setTimeout(r, 100));
            const me = state.boats[0]; me.controller = new BotController(me);
            const tr = new Map(); let t = 0; const dt = 1 / 30;
            while (t < 600 && !state.boats.every(bt => bt.raceState.finished)) {
                me.controller.update(dt); const d = normalizeAngle(me.controller.targetHeading - me.heading);
                state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(dt); t += dt;
                if (state.race.status !== 'racing') continue;
                for (const bt of state.boats) { if (bt.raceState.finished) continue; if (!tr.has(bt)) tr.set(bt, []); tr.get(bt).push([state.race.timer, bt.raceState.leg, bt.x, bt.y]); }
            }
            for (const [bt, pts] of tr) out.fleet.push({ seed, name: bt.name, fin: bt.raceState.finished ? Math.round(bt.raceState.finishTime) : 'DNF', legs: summarise(pts) });
        }
        return out;
    }, { wes, seeds });
    const row = (tag, fin, legs) => console.log(`${tag.padEnd(22)} ${String(fin).padStart(4)}  ` + legs.map((l, i) => `L${i} ${String(l[0]).padStart(3)}s rap${String(l[1]).padStart(3)} cur${String(l[2]).padStart(6)}`).join(' | '));
    console.log('WES'); for (const w of r.wes) row('wes ' + w.fp, w.fin, w.legs);
    console.log('FLEET'); for (const f of r.fleet.sort((a, c) => (a.fin === 'DNF') - (c.fin === 'DNF') || a.fin - c.fin)) row(`s${f.seed} ${f.name}`, f.fin, f.legs);
    await b.close();
})();
