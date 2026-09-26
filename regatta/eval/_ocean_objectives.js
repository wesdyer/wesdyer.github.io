// Probe: Bluewater Bonanza's objectives, measured — for the design phase. On the run (the last
// leg), per boat: the longest unbroken stretch at surfing speed (≥15 and ≥15.5 kn — a crest dies
// in ~25 s, so a long stretch means LINKED rides), peak speed, and the closest pass to each
// candidate spot. The fleet over several race seeds (bots only — the player's autopilot never
// hoists a kite here), and Wes's own recorded races (eval/rl/traj + any on the Desktop).
//   node regatta/eval/_ocean_objectives.js [seeds]     (from the repo root)
// Env: SPOTS="x:y,x:y,..." candidate spots (default: the cape lee, mid-lane, offshore).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const SPOTS = (process.env.SPOTS || '8000:-3200,4000:-2600,6000:1500').split(',').map(s => s.split(':').map(Number));
const measure = (pts) => {   // pts: [t, x, y, kn] on the run
    const o = { l15: 0, l155: 0, pk: 0, near: SPOTS.map(() => 1e9) }; let a = 0, b = 0;
    for (let i = 1; i < pts.length; i++) {
        const [t, x, y, kn] = pts[i], dt = t - pts[i - 1][0];
        o.pk = Math.max(o.pk, kn);
        a = kn >= 15 ? a + dt : 0; b = kn >= 15.5 ? b + dt : 0;
        o.l15 = Math.max(o.l15, a); o.l155 = Math.max(o.l155, b);
        SPOTS.forEach((s, k) => { o.near[k] = Math.min(o.near[k], Math.hypot(x - s[0], y - s[1])); });
    }
    return o;
};
const files = [...fs.readdirSync('regatta/eval/rl/traj').filter(f => f.startsWith('traj_ocean_')).map(f => 'regatta/eval/rl/traj/' + f),
    ...fs.readdirSync(path.join(require('os').homedir(), 'Desktop')).filter(f => /^traj_ocean_\d+\.json$/.test(f)).map(f => path.join(require('os').homedir(), 'Desktop', f))];
const wes = files.map(f => JSON.parse(fs.readFileSync(f, 'utf8'))).filter(j => j.finished && (j.format || []).includes('swell'))
    .map(j => ({ fin: Math.round(j.finishTime), ...measure(j.samples.filter(s => s[1] === 1 && s[8] === 3).map(s => [s[0], s[2], s[3], s[5] * 4])) }));
(async () => {
    const seeds = (process.argv[2] || '1,2,3,4,5,6').split(',').map(Number);
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Swell && typeof BotController !== 'undefined');
    const fleet = await p.evaluate((seeds) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        const out = [];
        for (const seed of seeds) {
            let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace();
            const me = state.boats[0]; me.x = 1e6; me.y = 1e6; me.raceState.finished = true;
            const last = state.course.route.length - 1, tr = new Map(); let t = 0;
            while (t < 600 && !state.boats.every(bt => bt.raceState.finished)) {
                update(1 / 30); t += 1 / 30; me.x = 1e6;
                if (state.race.status !== 'racing') continue;
                for (const bt of state.boats) { if (bt === me || bt.raceState.finished || bt.raceState.leg !== last) continue;
                    if (!tr.has(bt)) tr.set(bt, []); tr.get(bt).push([t, bt.x, bt.y, bt.speed * 4]); }
            }
            for (const [bt, pts] of tr) out.push({ name: bt.name, seed, fin: bt.raceState.finished ? Math.round(bt.raceState.finishTime) : 'DNF', pts });
        }
        return out;
    }, seeds);
    const F = fleet.map(f => ({ ...f, ...measure(f.pts) }));
    const pct = (arr, f) => (100 * arr.filter(f).length / arr.length).toFixed(0) + '%';
    const q = (arr, k) => { const v = arr.map(o => o[k]).sort((a, c) => a - c); return `median ${v[v.length >> 1].toFixed(1)} p90 ${v[Math.floor(v.length * 0.9)].toFixed(1)} max ${v[v.length - 1].toFixed(1)}`; };
    console.log(`FLEET (${F.length} runs, ${seeds.length} seeds)`);
    console.log(`  longest ≥15 kn:   ${q(F, 'l15')}   ≥20 s ${pct(F, o => o.l15 >= 20)}  ≥25 s ${pct(F, o => o.l15 >= 25)}  ≥30 s ${pct(F, o => o.l15 >= 30)}  ≥35 s ${pct(F, o => o.l15 >= 35)}`);
    console.log(`  longest ≥15.5 kn: ${q(F, 'l155')}   ≥20 s ${pct(F, o => o.l155 >= 20)}  ≥25 s ${pct(F, o => o.l155 >= 25)}  ≥30 s ${pct(F, o => o.l155 >= 30)}`);
    console.log(`  peak kn:          ${q(F, 'pk')}   ≥19 ${pct(F, o => o.pk >= 19)}  ≥20 ${pct(F, o => o.pk >= 20)}`);
    SPOTS.forEach((s, k) => console.log(`  spot (${s}): closest pass ${q(F.map(o => ({ v: o.near[k] })), 'v')}  within 600 u ${pct(F, o => o.near[k] < 600)}  within 1000 u ${pct(F, o => o.near[k] < 1000)}`));
    console.log(`WES (${wes.length} races with the swell recorded)`);
    for (const w of wes) console.log(`  ${w.fin}s  longest ≥15 ${w.l15.toFixed(1)}s  ≥15.5 ${w.l155.toFixed(1)}s  peak ${w.pk.toFixed(1)}  spots ${w.near.map(n => Math.round(n)).join(' / ')}`);
    await b.close();
})();
