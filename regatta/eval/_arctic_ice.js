// Probe: Glacier Sound's ice, measured — for the design phase. Per boat per race: floe contacts
// and land contacts (episodes: contacts more than 2 s apart), finish time. The player sailed by
// the autopilot is marked *. Uses the harness's onRaceEvent hook (collision_island, isFloe).
//   node regatta/eval/_arctic_ice.js [seeds]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const seeds = (process.argv[2] || '1,2,3,4').split(',').map(Number);
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && typeof BotController !== 'undefined');
    const rows = await p.evaluate((seeds) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        const out = [];
        for (const seed of seeds) {
            let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace();
            const me = state.boats[0]; me.controller = new BotController(me);
            const C = new Map(state.boats.map(bt => [bt, { floe: 0, land: 0, lf: -9, ll: -9 }]));
            window.onRaceEvent = (type, e) => { if (type !== 'collision_island' || !e || !e.boat) return; const o = C.get(e.boat); if (!o) return; const t = state.race.timer;
                if (e.isFloe) { if (t - o.lf > 2) o.floe++; o.lf = t; } else { if (t - o.ll > 2) o.land++; o.ll = t; } };
            let t = 0;
            while (t < 600 && !state.boats.every(bt => bt.raceState.finished)) {
                me.controller.update(1 / 30); const d = normalizeAngle(me.controller.targetHeading - me.heading);
                state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(1 / 30); t += 1 / 30;
            }
            window.onRaceEvent = null;
            for (const bt of state.boats) { const o = C.get(bt); out.push({ seed, name: (bt === me ? '*' : '') + bt.name, fin: bt.raceState.finished ? Math.round(bt.raceState.finishTime) : 'DNF', floe: o.floe, land: o.land }); }
        }
        return out;
    }, seeds);
    rows.forEach(r => console.log(`s${r.seed} ${r.name.padEnd(12)} ${String(r.fin).padStart(4)}  floe ${r.floe}  land ${r.land}`));
    const clean = rows.filter(r => r.fin !== 'DNF' && r.floe === 0).length, fin = rows.filter(r => r.fin !== 'DNF').length;
    console.log(`\nno floe contact: ${clean}/${fin} finishers; no contact at all: ${rows.filter(r => r.fin !== 'DNF' && r.floe + r.land === 0).length}/${fin}`);
    await b.close();
})();
