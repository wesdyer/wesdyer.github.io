// Probe: Otter Point's run home (leg 2) — surfing. Per boat: peak speed, the longest unbroken
// stretch at or above 11/12/13 kn, and the seconds spent at 12 kn or more. Wes's races (sample
// [5] is speed/4 kn) and the fleet over seeds.
//   node regatta/eval/_otter_surf.js [seeds]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const wes = fs.readdirSync('regatta/eval/rl/traj').filter(f => f.startsWith('traj_otter_')).map(f => JSON.parse(fs.readFileSync('regatta/eval/rl/traj/' + f, 'utf8'))).filter(j => j.finished)
    .map(j => ({ name: 'WES', fin: Math.round(j.finishTime), pts: j.samples.filter(s => s[1] === 1).map(s => [s[0], s[8], s[5] * 4]) }));
const meas = (pts, leg) => { const o = { pk: 0, r11: 0, r12: 0, r13: 0, t12: 0, legT: 0 }; let a = 0, b2 = 0, c = 0;
    for (let i = 1; i < pts.length; i++) { const [t0] = pts[i - 1], [t, lg, kn] = pts[i], dt = t - t0; if (lg !== leg || !(dt > 0)) { a = b2 = c = 0; continue; } o.legT += dt; o.pk = Math.max(o.pk, kn);
        a = kn >= 11 ? a + dt : 0; b2 = kn >= 12 ? b2 + dt : 0; c = kn >= 13 ? c + dt : 0; if (kn >= 12) o.t12 += dt; o.r11 = Math.max(o.r11, a); o.r12 = Math.max(o.r12, b2); o.r13 = Math.max(o.r13, c); } return o; };
(async () => {
    const seeds = (process.argv[2] || '1,2,3').split(',').map(Number);
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && typeof BotController !== 'undefined');
    const fleet = await p.evaluate((seeds) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        const out = []; for (const seed of seeds) { let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace(); const me = state.boats[0]; me.x = 1e6; me.y = 1e6; me.raceState.finished = true; const tr = new Map(); let t = 0;
            while (t < 600 && !state.boats.every(bt => bt.raceState.finished)) { update(1 / 30); t += 1 / 30; me.x = 1e6; if (state.race.status !== 'racing') continue;
                for (const bt of state.boats) { if (bt === me || bt.raceState.finished) continue; if (!tr.has(bt)) tr.set(bt, []); tr.get(bt).push([state.race.timer, bt.raceState.leg, bt.speed * 4]); } }
            for (const [bt, pts] of tr) out.push({ name: bt.name, fin: bt.raceState.finished ? Math.round(bt.raceState.finishTime) : 'DNF', pts }); }
        return out; }, seeds);
    for (const L of [1, 2]) { console.log(`LEG ${L}`);
        for (const o of [...wes, ...fleet]) { const m = meas(o.pts, L); if (o.name === 'WES' || fleet.indexOf(o) < 12) console.log(`  ${o.name.padEnd(9)} ${String(o.fin).padStart(4)}  leg ${Math.round(m.legT)}s peak ${m.pk.toFixed(1)}  ≥11 ${m.r11.toFixed(0)}s ≥12 ${m.r12.toFixed(0)}s ≥13 ${m.r13.toFixed(0)}s  total≥12 ${Math.round(m.t12)}s`); } }
    await b.close();
})();
