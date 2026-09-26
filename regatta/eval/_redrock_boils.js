// Probe: Linesider's Boil Chaser — how many striper boils a race puts in the player's way. The
// player sailed by the autopilot (not chasing), per race seed: boils sailed through, boils that
// came up within 600 u of the player (in sight) during the race, finish time.
//   node regatta/eval/_redrock_boils.js [seeds]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const seeds = (process.argv[2] || '1,2,3,4,5,6,7,8').split(',').map(Number);
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof BotController !== 'undefined');
    const rows = await p.evaluate((seeds) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        const out = [];
        for (const seed of seeds) {
            let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace();
            const me = state.boats[0]; me.controller = new BotController(me);
            let vals = 0; const seen = new Set(); let t = 0, near = 1e9;
            const h = (e) => { if (e.id === 'redrock:boils') vals = e.value; }; GameEvents.on('player-feat', h);
            while (t < 600 && !me.raceState.finished) {
                me.controller.update(1 / 30); const d = normalizeAngle(me.controller.targetHeading - me.heading);
                state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(1 / 30); t += 1 / 30;
                if (state.race.status !== 'racing') continue;
                for (const B of Wildlife.debug().stripers) { const dd = Math.hypot(B.x - me.x, B.y - me.y); if (dd < 600) seen.add(B.seed); near = Math.min(near, dd); }
            }
            if (GameEvents.off) GameEvents.off('player-feat', h);
            out.push({ seed, through: vals, inSight: seen.size, closest: Math.round(near), fin: Math.round(me.raceState.finishTime || 0) });
        }
        return out;
    }, seeds);
    for (const r of rows) console.log(`seed ${r.seed}: sailed through ${r.through}, in sight ${r.inSight}, closest pass ${r.closest} u, finish ${r.fin}s`);
    await b.close();
})();
