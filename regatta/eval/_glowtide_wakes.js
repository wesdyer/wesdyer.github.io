// Probe: how much of a race each boat spends sailing in ANOTHER boat's glowing wake (within R u
// of a live point of another boat's bioTrail), after the start gun and after the first N s (the
// start is a pack). Every boat, the player sailed by the autopilot (*).
//   node regatta/eval/_glowtide_wakes.js [seeds]     Env: R (14), GRACE (secs from the gun, 0)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const seeds = (process.argv[2] || '1,2,3').split(',').map(Number);
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && typeof BotController !== 'undefined');
    const rows = await p.evaluate(({ seeds, R, GRACE }) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'glowtide', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        const out = [];
        for (const seed of seeds) {
            let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace(); const me = state.boats[0]; me.controller = new BotController(me);
            const W = new Map(state.boats.map(bt => [bt, { secs: 0, first: null }])); let t = 0;
            while (t < 600 && !state.boats.every(bt => bt.raceState.finished)) {
                me.controller.update(1 / 30); const d = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02;
                update(1 / 30); t += 1 / 30;
                if (state.race.status !== 'racing' || state.race.timer < GRACE) continue;
                for (const bt of state.boats) { if (bt.raceState.finished) continue;
                    let inW = false;
                    for (const o of state.boats) { if (o === bt || !o.bioTrail) continue; if (Math.hypot(o.x - bt.x, o.y - bt.y) > 700) continue;
                        for (const q of o.bioTrail) if (q.age > 0.4 && Math.hypot(q.x - bt.x, q.y - bt.y) < R) { inW = true; break; } if (inW) break; }
                    if (inW) { const w = W.get(bt); w.secs += 1 / 30; if (w.first == null) w.first = state.race.timer; } }
            }
            const order = state.boats.filter(bt => bt.raceState.finished).sort((a, c) => a.raceState.finishTime - c.raceState.finishTime);
            for (const bt of state.boats) { const w = W.get(bt); out.push({ seed, name: (bt === me ? '*' : '') + bt.name, place: order.indexOf(bt) + 1 || 'DNF', secs: +w.secs.toFixed(1), first: w.first == null ? '-' : Math.round(w.first) }); }
        }
        return out;
    }, { seeds, R: +(process.env.R || 14), GRACE: +(process.env.GRACE || 0) });
    rows.forEach(r => console.log(`s${r.seed} ${String(r.place).padStart(3)} ${r.name.padEnd(12)} in others' glow ${String(r.secs).padStart(5)} s  (first at ${r.first})`));
    console.log('never in another wake:', rows.filter(r => r.secs === 0).length, '/', rows.length, ' winners never:', rows.filter(r => r.place === 1 && r.secs === 0).length, '/', seeds.length);
    await b.close();
})();
