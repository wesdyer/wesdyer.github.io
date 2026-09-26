// Probe: what Wes would have SEEN on Glacier Sound — replays his recorded races (the player boat
// moved along his track, the sim stepped at 30 Hz for the wildlife) and counts, per race, the
// seconds each animal was within view distance VIEW (default 550 u, about half a screen): a
// leopard seal (hauled out / in the water), an orca at the surface, a tern flock, penguins on
// the ice (colony, floe, trek) and in the water.
//   node regatta/eval/_arctic_sightings.js [races]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const VIEW = +(process.env.VIEW || 550);
const files = fs.readdirSync('regatta/eval/rl/traj').filter(f => f.startsWith('traj_arctic_')).sort().slice(-(+process.argv[2] || 6));
const tracks = files.map(f => JSON.parse(fs.readFileSync('regatta/eval/rl/traj/' + f, 'utf8'))).filter(j => j.finished)
    .map(j => j.samples.filter(s => s[1] === 1).map(s => [s[0], s[2], s[3]]));
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    const out = await p.evaluate(({ tracks, VIEW }) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        const res = [];
        for (const tr of tracks) {
            resetGame(); state.race.status = 'racing';
            const me = state.boats[0]; for (const o of state.boats.slice(1)) { o.x = 1e6; o.y = 1e6; }
            const C = { sealHaul: 0, sealSwim: 0, orcaUp: 0, terns: 0, pIce: 0, pWater: 0 }, dt = 1 / 30;
            let k = 0;
            for (let t = tr[0][0]; t < tr[tr.length - 1][0]; t += dt) {
                while (k < tr.length - 2 && tr[k + 1][0] < t) k++;
                const [t0, x0, y0] = tr[k], [t1, x1, y1] = tr[k + 1], u = Math.max(0, Math.min(1, (t - t0) / ((t1 - t0) || 1)));
                me.x = x0 + (x1 - x0) * u; me.y = y0 + (y1 - y0) * u; me.raceState.finished = false;
                Wildlife.update(dt);
                const d = Wildlife.debug(), near = (x, y) => Math.hypot(x - me.x, y - me.y) < VIEW;
                if (d.lseals.some(s => s.mode === 'haul' && near(s.x, s.y))) C.sealHaul += dt;
                if (d.lseals.some(s => s.mode !== 'haul' && near(s.x, s.y))) C.sealSwim += dt;
                if (d.orcaPods.some(W => W.members.some(m => m.up >= 0 && near(m.x, m.y)))) C.orcaUp += dt;
                if (d.ternFlocks.some(F => near(F.cx, F.cy))) C.terns += dt;
                if (d.penguinColonies.some(c => near(c.home.x, c.home.y)) || d.floeGroups.some(g => g.birds.length && near(g.floe.x, g.floe.y))) C.pIce += dt;
                if (d.swimmers.some(s => near(s.x, s.y))) C.pWater += dt;
            }
            res.push({ secs: Math.round(tr[tr.length - 1][0] - tr[0][0]), ...Object.fromEntries(Object.entries(C).map(([a, v]) => [a, Math.round(v)])) });
        }
        return res;
    }, { tracks, VIEW });
    console.log(`seconds in view (within ${VIEW} u) on Wes's races:`);
    for (const r of out) console.log(`  ${r.secs}s race: leopard seal hauled ${r.sealHaul} / in water ${r.sealSwim} · orcas at the surface ${r.orcaUp} · terns ${r.terns} · penguins on ice ${r.pIce} / swimming ${r.pWater}`);
    await b.close();
})();
