// Probe: Redrock Reservoir's traffic, measured — for the design phase. Per boat, per race: how
// many DIFFERENT rivals were made to give way to it (the rival's avoidance holds the GIVE_WAY
// role against this boat, at HIGH/IMMINENT risk, turned > DEV rad off its own course for HOLD s
// — the same test bot.js uses to call a no-contact foul, seen from the other side), how many
// of those happened in the M3 hub (within HUB u of mark 3), the boat's own penalties, and how
// many rivals it MET head-on (within 2 boat lengths, headings > 135° apart). Every boat is
// scored, the player included (sailed by the autopilot), so leaders and the pack both show.
//   node regatta/eval/_redrock_giveway.js [seeds]     (from the repo root)
// Env: DEV (0.35) HOLD (0.8) HUB (450)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const seeds = (process.argv[2] || '1,2,3,4,5,6').split(',').map(Number);
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && typeof BotController !== 'undefined');
    const rows = await p.evaluate(({ seeds, DEV, HOLD, HUB }) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        const out = [];
        for (const seed of seeds) {
            let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace();
            const me = state.boats[0]; me.controller = new BotController(me);
            const m3 = state.course.marks.find(m => m.id === 'mark-3');
            const S = new Map(state.boats.map(bt => [bt, { gave: new Map(), hub: new Set(), all: new Set(), meet: new Set(), pen: 0 }]));
            const timers = new Map(); let t = 0;
            while (t < 600 && !state.boats.every(bt => bt.raceState.finished)) {
                me.controller.update(1 / 30); const d = normalizeAngle(me.controller.targetHeading - me.heading);
                state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02;
                const pens = state.boats.map(bt => bt.raceState.penaltyCount || 0);
                update(1 / 30); t += 1 / 30;
                state.boats.forEach((bt, i) => { if ((bt.raceState.penaltyCount || 0) > pens[i]) S.get(bt).pen++; });
                if (state.race.status !== 'racing') continue;
                for (const rv of state.boats) {
                    const c = rv.controller; if (!c || rv === me || rv.raceState.finished) continue;
                    const tb = c.threatBoat;
                    const on = tb && !tb.raceState.finished && c.avoidanceRole === 'GIVE_WAY' && (c.riskState === 'HIGH' || c.riskState === 'IMMINENT') && c.lastAvoidDeviation > DEV;
                    const k = rv.id + '>' + (tb ? tb.id : ''), v = on ? (timers.get(k) || 0) + 1 / 30 : Math.max(0, (timers.get(k) || 0) - 1 / 60);
                    timers.set(k, v);
                    if (on && v >= HOLD) { const o = S.get(tb); o.all.add(rv.id); if (Math.hypot(tb.x - m3.x, tb.y - m3.y) < HUB) o.hub.add(rv.id); }
                }
                for (let i = 0; i < state.boats.length; i++) for (let j = i + 1; j < state.boats.length; j++) {
                    const a = state.boats[i], c = state.boats[j]; if (a.raceState.finished || c.raceState.finished) continue;
                    if (Math.hypot(a.x - c.x, a.y - c.y) < 110 && Math.abs(normalizeAngle(a.heading - c.heading)) > 2.36) { S.get(a).meet.add(c.id); S.get(c).meet.add(a.id); }
                }
            }
            const order = state.boats.filter(bt => bt.raceState.finished).sort((a, c) => a.raceState.finishTime - c.raceState.finishTime);
            for (const bt of state.boats) { const o = S.get(bt);
                out.push({ seed, name: bt === me ? 'YOU(auto) ' + bt.name : bt.name, place: order.indexOf(bt) + 1 || 'DNF', fin: bt.raceState.finished ? Math.round(bt.raceState.finishTime) : 'DNF', gave: o.all.size, hub: o.hub.size, meet: o.meet.size, pen: o.pen }); }
        }
        return out;
    }, { seeds, DEV: +(process.env.DEV || 0.35), HOLD: +(process.env.HOLD || 0.8), HUB: +(process.env.HUB || 450) });
    for (const r of rows) console.log(`s${r.seed} ${String(r.place).padStart(3)} ${r.name.padEnd(20)} ${String(r.fin).padStart(4)}s  gave-way-to-me ${r.gave} (hub ${r.hub})  met head-on ${r.meet}  penalties ${r.pen}`);
    const dist = (f) => { const c = {}; rows.forEach(r => c[f(r)] = (c[f(r)] || 0) + 1); return Object.entries(c).map(([k, v]) => `${k}:${v}`).join(' '); };
    console.log('\nrivals made to give way, all boats: ' + dist(r => r.gave));
    console.log('...clean (no penalty):             ' + dist(r => r.pen ? 'pen' : r.gave));
    console.log('...in the hub:                      ' + dist(r => r.hub));
    console.log('...the winners:                     ' + dist(r => r.place === 1 ? r.gave : '-'));
    console.log('met head-on:                        ' + dist(r => Math.min(r.meet, 8)));
    await b.close();
})();
