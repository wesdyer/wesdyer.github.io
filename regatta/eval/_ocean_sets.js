// Probe: Bluewater Bonanza's run under a candidate sea — for tuning the swell's SETS (Wes,
// Sep 25 2026: it must take skill to start a surf and to connect surfs across sets).
//
// Swaps the venue's `swell` block in the page (SWELL=<json file>, or the venue's own), runs the
// fleet, and on every seed sails boat 1 twice: once as the plain bot, once under a SURFER policy
// on the run (bear away down a face in a set, head up to carry speed in a trough or a lull).
// Reports, on the run (the last leg): seconds, seconds on a wave, rides of 3 s+, the mean and
// longest ride, and peak speed — for the surfer, the same boat as a bot, and the fleet.
//   node regatta/eval/_ocean_sets.js [seeds]      (from the repo root)
// Env: SWELL=<file.json> the swell block to try; COURSE=<file.json> marks to override.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
    const seeds = (process.argv[2] || '1,2,3').split(',').map(Number);
    const swell = process.env.SWELL ? JSON.parse(fs.readFileSync(process.env.SWELL, 'utf8')) : null;
    const marks = process.env.COURSE ? JSON.parse(fs.readFileSync(process.env.COURSE, 'utf8')) : null;
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Swell && typeof BotController !== 'undefined');
    const r = await p.evaluate(async ({ seeds, swell, marks, POLICY }) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        if (swell) VENUE_DOC.ocean.swell = swell;
        if (marks) for (const m of VENUE_DOC.ocean.course.marks) if (marks[m.id]) Object.assign(m, marks[m.id]);
        const one = async (seed, surfer) => {
            let s = seed; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame(); startRace(); await new Promise(r => setTimeout(r, 50));
            const me = state.boats[0]; me.controller = new BotController(me); me.spinnaker = false;
            const last = state.course.route.length - 1;
            const S = new Map(); let t = 0; const dt = 1 / 30;
            const P = Swell.primary();
            const pilot = state.boats[1];
            if (surfer) {
                const ctl = pilot.controller || (pilot.controller = new BotController(pilot));
                const base = ctl.update.bind(ctl);
                // The controller builds each frame's heading on the last one, so it must be handed
                // back its OWN heading before it runs — or the offsets pile up frame on frame.
                let own = null;
                ctl.update = (d) => {
                    if (own != null) ctl.targetHeading = own;
                    base(d);
                    own = ctl.targetHeading;
                    if (pilot.raceState.leg !== last || pilot.raceState.finished) return;
                    // Where the boat sits in the wave: phase 0 on the crest, (0, π) on the face AHEAD
                    // of the crest (downhill in the travel direction — the part that pushes), ±π in
                    // the trough. A crest behind is coming on as the phase runs down toward 0.
                    let ph = Swell.phaseAt(P, pilot.x, pilot.y) % (2 * Math.PI); if (ph > Math.PI) ph -= 2 * Math.PI; if (ph < -Math.PI) ph += 2 * Math.PI;
                    const set = Swell.setAt(P, pilot.x, pilot.y);
                    const want = ctl.targetHeading, toWave = normalizeAngle(P.theta - want);
                    const R = Math.PI / 180, BEAR = (+POLICY.bear || 30) * R, UP = (+POLICY.up || 15) * R;
                    if (set > POLICY.minSet && ph > 0.1 && ph < 0.75 * Math.PI) ctl.targetHeading = normalizeAngle(want + Math.max(-BEAR, Math.min(BEAR, toWave)));   // the steep face under the stern: go
                    else if (set > POLICY.minSet && (ph >= 0.75 * Math.PI || ph < -0.55 * Math.PI)) ctl.targetHeading = normalizeAngle(want - Math.sign(toWave || 1) * UP); // trough, crest coming: build speed
                };
            }
            while (t < 600 && !state.boats.every(bt => bt.raceState.finished || bt === me)) {
                me.controller.update(dt); const d = normalizeAngle(me.controller.targetHeading - me.heading);
                state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02; update(dt); t += dt;
                if (state.race.status !== 'racing') continue;
                for (const bt of state.boats) {
                    if (bt === me || bt.raceState.finished || bt.raceState.leg !== last) continue;
                    if (!S.has(bt)) S.set(bt, { t: 0, on: 0, ride: 0, rides: [], hold: 0, pk: 0, fast: 0, run: 0, lock: 0, drops: 0 });
                    const o = S.get(bt), sw = bt.swell; o.t += dt; o.pk = Math.max(o.pk, bt.speed * 4);
                    // Wes's complaint, measured: how long a boat stays at surfing speed without a break
                    const kn = bt.speed * 4; if (kn >= 16) o.fast += dt;
                    if (kn >= 15.5) { o.run += dt; o.lock = Math.max(o.lock, o.run); } else { if (o.run > 2) o.drops++; o.run = 0; }
                    const on = !!(sw && sw.withWave && sw.surf01 > 0.34);
                    o.hold = on ? 0.25 : Math.max(0, o.hold - dt);
                    if (o.hold > 0) { o.on += dt; o.ride += dt; } else { if (o.ride >= 3) o.rides.push(o.ride); o.ride = 0; }
                }
            }
            const sum = (bt) => { const o = S.get(bt); if (!o) return null; if (o.ride >= 3) o.rides.push(o.ride);
                return { run: +o.t.toFixed(1), fast: Math.round(o.fast), lock: +o.lock.toFixed(1), drops: o.drops, on: Math.round(o.on), n: o.rides.length, mean: o.rides.length ? +(o.rides.reduce((a, c) => a + c, 0) / o.rides.length).toFixed(1) : 0, best: +Math.max(0, ...o.rides).toFixed(1), pk: +o.pk.toFixed(1), fin: bt.raceState.finished ? Math.round(bt.raceState.finishTime) : 'DNF' }; };
            return { pilot: sum(pilot), name: pilot.name, fleet: [...S.keys()].filter(bt => bt !== pilot).map(sum) };
        };
        const out = [];
        for (const seed of seeds) out.push({ seed, bot: await one(seed, false), surf: await one(seed, true) });
        return out;
    }, { seeds, swell, marks, POLICY: { minSet: +(process.env.MINSET || 0.45), bear: +(process.env.BEAR || 30), up: +(process.env.UP || 15) } });
    const fmt = (o) => o ? `run ${o.run}s ≥16kn ${o.fast}s longest≥15.5 ${o.lock}s drops ${o.drops} on-wave ${o.on}s rides ${o.n} mean ${o.mean}s best ${o.best}s pk ${o.pk}kn fin ${o.fin}` : '-';
    const agg = [];
    for (const x of r) {
        console.log(`seed ${x.seed} (${x.bot.name})\n  bot    ${fmt(x.bot.pilot)}\n  SURFER ${fmt(x.surf.pilot)}`);
        agg.push(...x.bot.fleet.filter(Boolean));
    }
    const m = (k) => (agg.reduce((a, o) => a + o[k], 0) / agg.length).toFixed(1);
    const gain = r.map(x => x.bot.pilot && x.surf.pilot ? x.bot.pilot.run - x.surf.pilot.run : 0);
    const runs = agg.map(o => o.run).sort((a, c) => a - c);
    console.log(`FLEET (${agg.length} runs): run ${m('run')}s (spread ${runs[0]}-${runs[runs.length - 1]})  ≥16kn ${m('fast')}s  longest≥15.5 ${m('lock')}s  drops ${m('drops')}  on-wave ${m('on')}s  rides ${m('n')}  mean ride ${m('mean')}s  best ${m('best')}s  pk ${m('pk')}kn`);
    console.log(`SURFER vs same boat as bot: ${gain.map(g => (g >= 0 ? '-' : '+') + Math.abs(g).toFixed(1) + 's').join(' ')}  (mean ${(gain.reduce((a, c) => a + c, 0) / gain.length).toFixed(1)}s faster)`);
    await b.close();
})();
