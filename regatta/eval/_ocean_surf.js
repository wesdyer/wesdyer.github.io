// Probe: Bluewater Bonanza's swell, leg by leg — for the Ocean's objectives. Per boat (the
// autopilot player and the fleet, several seeds): seconds per leg; on each leg the seconds
// SURFING (on a face, with the waves: boat.swell.withWave && surf01 > 0.34, latched on for
// 0.25 s like the HUD's label), the longest single ride, and the peak speed. Wes's recorded
// races give per-leg times and peak speed (his samples carry no swell state).
//   node regatta/eval/_ocean_surf.js [seeds]     (from the repo root)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const TRAJ = 'regatta/eval/rl/traj';
const FP = process.env.FP || '1b1a7101';
const wes = fs.readdirSync(TRAJ).filter(f => f.startsWith('traj_ocean_')).map(f => JSON.parse(fs.readFileSync(path.join(TRAJ, f), 'utf8')))
    .filter(j => String(j.venueFingerprint).split(':')[0] === FP)
    .map(j => { const s = j.samples.filter(s => s[1] === 1); const L = [0, 1, 2, 3].map(() => ({ t: 0, pk: 0, a: [0, 0, 0, 0] }));
        for (let i = 1; i < s.length; i++) { const l = s[i][8]; if (l > 3) continue; const dt = s[i][0] - s[i - 1][0], kn = s[i][5] * 4; L[l].t += dt; L[l].pk = Math.max(L[l].pk, kn); [16, 17, 18, 19].forEach((k, j) => { if (kn >= k) L[l].a[j] += dt; }); }
        return { fin: Math.round(j.finishTime), legs: L }; });
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Swell && typeof BotController !== 'undefined');
    const seeds = (process.argv[2] || '1,2,3').split(',').map(Number);
    const fleet = await p.evaluate(async (seeds) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        const out = [];
        for (const seed of seeds) {
            let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace(); await new Promise(r => setTimeout(r, 100));
            const me = state.boats[0]; me.controller = new BotController(me);
            const S = new Map(); let t = 0; const dt = 1 / 30;
            while (t < 600 && !state.boats.every(bt => bt.raceState.finished)) {
                me.controller.update(dt); const d = normalizeAngle(me.controller.targetHeading - me.heading);
                state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(dt); t += dt;
                if (state.race.status !== 'racing') continue;
                for (const bt of state.boats) {
                    if (bt.raceState.finished) continue;
                    if (!S.has(bt)) S.set(bt, [0, 1, 2, 3].map(() => ({ t: 0, surf: 0, ride: 0, best: 0, pk: 0, hold: 0, a16: 0, a17: 0, a18: 0, a19: 0 })));
                    const leg = Math.min(3, bt.raceState.leg), o = S.get(bt)[leg], sw = bt.swell;
                    o.t += dt; o.pk = Math.max(o.pk, bt.speed * 4); const kn = bt.speed * 4; if (kn >= 16) o.a16 += dt; if (kn >= 17) o.a17 += dt; if (kn >= 18) o.a18 += dt; if (kn >= 19) o.a19 += dt;
                    const on = !!(sw && sw.withWave && sw.surf01 > 0.34);
                    o.hold = on ? 0.25 : Math.max(0, o.hold - dt);
                    if (o.hold > 0) { o.surf += dt; o.ride += dt; o.best = Math.max(o.best, o.ride); } else o.ride = 0;
                }
            }
            for (const [bt, L] of S) out.push({ name: `s${seed} ${bt.name}${bt === me ? '*' : ''}`, fin: bt.raceState.finished ? Math.round(bt.raceState.finishTime) : 'DNF',
                legs: L.map(o => [Math.round(o.t), Math.round(o.surf), +o.best.toFixed(1), +o.pk.toFixed(1)]), above: [L[3].a16, L[3].a17, L[3].a18, L[3].a19].map(v => +v.toFixed(1)) });
        }
        return out;
    }, seeds);
    console.log('WES (fp ' + FP + ')  leg: secs / peak kn');
    for (const w of wes) console.log(`  ${String(w.fin).padStart(4)}  run ${Math.round(w.legs[3].t)}s pk ${w.legs[3].pk.toFixed(1)}  s>=16/17/18/19kn ${w.legs[3].a.map(v => v.toFixed(1)).join('/')}`);
    console.log('FLEET  leg: secs / surf secs / longest ride / peak kn');
    for (const f of fleet.sort((a, c) => (a.fin === 'DNF') - (c.fin === 'DNF') || a.fin - c.fin))
        console.log(`  ${f.name.padEnd(16)} ${String(f.fin).padStart(4)}  run ${f.legs[3][0]}s pk ${f.legs[3][3]}  s>=16/17/18/19kn ${f.above.join('/')}`);
    await b.close();
})();
