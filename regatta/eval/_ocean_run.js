// Probe: what surfing TECHNIQUE is worth on Bluewater Bonanza's run, measured cleanly — one
// boat alone, placed just past mark 4 on the last leg, from N different moments in the swell
// (the sea's clock is advanced before the start), sailed to the finish under each policy from
// the identical start. No fleet, so nothing but the sea and the helm differs.
//   node regatta/eval/_ocean_run.js [starts]      (from the repo root)
// Env: SWELL=<file.json> the swell block to try; POLICIES=bot,b30u10,... (append @x:y to sail via a waypoint first) (bNNuMM = bear away up
// to NN° down a face in a set, head up MM° in the trough ahead of a coming crest);
// MINSET (0.45) — the set size worth working.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
    const starts = +(process.argv[2] || 12);
    const swell = process.env.SWELL ? JSON.parse(fs.readFileSync(process.env.SWELL, 'utf8')) : null;
    const policies = (process.env.POLICIES || 'bot,b30u10,b30u0,b15u0').split(',');
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Swell && typeof BotController !== 'undefined');
    const r = await p.evaluate(async ({ starts, swell, policies, minSet, tune }) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        if (swell) VENUE_DOC.ocean.swell = swell;
        // CAPE=<kt> overrides the cape jet's speed; WSPOW=<p> the wind swell's windScale power
        if (tune.cape) { const r = VENUE_DOC.ocean.wind.regions.find(r => r.id === 'cape-jet'); if (r) r.speed = tune.cape; }
        if (tune.wspow) { const t = VENUE_DOC.ocean.swell.trains.find(t => t.windScale); if (t) t.windScale.power = tune.wspow; }
        const R = Math.PI / 180;
        const run = async (k, pol) => {
            let s = 7 + k * 131; Math.random =   // each start its own race seed -> its own sea (wind phases, sets)
             () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            // No await here: a pause would let the page's own loop run real-time frames and wind the sea
            // on by a wall-clock amount — the runs stopped repeating (Sep 25 2026).
            resetGame(); startRace();
            const me = state.boats[0], bt = state.boats[1];
            for (const o of state.boats) if (o !== bt) { o.x = 1e6 + Math.random(); o.y = 1e6; o.raceState.finished = true; }
            const last = state.course.route.length - 1;
            // Race on; the boat just past mark 4, on the run, at speed; the sea wound on k·7.3 s
            state.race.status = 'racing';
            const m4 = state.course.marks.find(m => m.id === 'mark-4');
            bt.raceState.leg = last; bt.x = m4.x + 300; bt.y = m4.y + 150; bt.speed = 3; bt.heading = Math.PI / 2;
            for (let i = 0; i < Math.round(k * 7.3 * 30); i++) Swell.update(1 / 30);
            const ctl = bt.controller || (bt.controller = new BotController(bt));
            const base = ctl.update.bind(ctl); let own = null;
            const P = Swell.primary();
            const wpm = /@(-?\d+):(-?\d+)$/.exec(pol), WP = wpm ? { x: +wpm[1], y: +wpm[2] } : null;
            pol = pol.replace(/@.*$/, '');
            const m = /^b(\d+)u(\d+)$/.exec(pol), BEAR = m ? +m[1] * R : 0, UP = m ? +m[2] * R : 0;
            // cNNmMM: the PEAK CHASER — each moment, of the headings within NN° of the bot's own,
            // take the one with the most push from the sea (Swell.surfPushAt, every train)
            // less MM/10 kn/s per unit of (1 - cos) off course; with nothing worth having, head up UU°.
            const cm = /^c(\d+)m(\d+)(?:u(\d+))?$/.exec(pol), CR = cm ? +cm[1] * R : 0, MU = cm ? +cm[2] / 10 : 0, CUP = cm && cm[3] ? +cm[3] * R : 0;
            ctl.update = (d) => {
                if (own != null) ctl.targetHeading = own;
                base(d); own = ctl.targetHeading;
                // a route: head for the waypoint (the bot's own heading only as the reference the
                // policy works around) until level with it
                if (WP && bt.raceState.leg === last && bt.x < WP.x) ctl.targetHeading = Math.atan2(WP.x - bt.x, -(WP.y - bt.y));
                if (cm && !bt.raceState.finished) {
                    const want = ctl.targetHeading; let best = want, bs = -1e9, bp = 0;
                    for (let d = -CR; d <= CR + 1e-6; d += 5 * R) { const h = normalizeAngle(want + d), push = Swell.surfPushAt(bt.x, bt.y, h), sc = push - MU * (1 - Math.cos(d)); if (sc > bs) { bs = sc; best = h; bp = push; } }
                    if (CUP && bp < 0.15) { const toW = normalizeAngle(Swell.primary().theta - want); best = normalizeAngle(want - Math.sign(toW || 1) * CUP); }
                    ctl.targetHeading = best; return;
                }
                if (!m || bt.raceState.finished) return;
                let ph = Swell.phaseAt(P, bt.x, bt.y) % (2 * Math.PI); if (ph > Math.PI) ph -= 2 * Math.PI; if (ph < -Math.PI) ph += 2 * Math.PI;
                const set = Swell.setAt(P, bt.x, bt.y), want = ctl.targetHeading, toWave = normalizeAngle(P.theta - want);
                if (set > minSet && ph > 0.1 && ph < 0.75 * Math.PI) ctl.targetHeading = normalizeAngle(want + Math.max(-BEAR, Math.min(BEAR, toWave)));
                else if (UP && set > minSet && (ph >= 0.75 * Math.PI || ph < -0.55 * Math.PI)) ctl.targetHeading = normalizeAngle(want - Math.sign(toWave || 1) * UP);
            };
            let t = 0, lock = 0, cur = 0, fast = 0, gap = 1e9, links = 0; const rides = []; const dt = 1 / 30;
            while (t < 400 && !bt.raceState.finished) {
                update(dt); t += dt; me.x = 1e6; me.y = 1e6;
                const kn = bt.speed * 4; if (kn >= 16) fast += dt;
                if (kn >= 15.5) { if (cur === 0 && gap <= 4 && rides.length) links++; cur += dt; lock = Math.max(lock, cur); gap = 0; } else { if (cur >= 2) rides.push(cur); cur = 0; gap += dt; }
            }
            if (cur >= 2) rides.push(cur);
            return { t: +t.toFixed(1), fin: bt.raceState.finished, lock: +lock.toFixed(1), fast: +fast.toFixed(1), links, n: rides.length, mean: rides.length ? rides.reduce((a, c) => a + c, 0) / rides.length : 0 };
        };
        const out = {};
        for (const pol of policies) { out[pol] = []; for (let k = 0; k < starts; k++) out[pol].push(await run(k, pol)); }
        return out;
    }, { starts, swell, policies, minSet: +(process.env.MINSET || 0.45), tune: { cape: +(process.env.CAPE || 0), wspow: +(process.env.WSPOW || 0) } });
    const base = r[policies[0]];
    for (const pol of policies) {
        const a = r[pol], mean = (f) => (a.reduce((s, o) => s + o[f], 0) / a.length).toFixed(1);
        const d = a.map((o, i) => o.t - base[i].t), dm = d.reduce((s, x) => s + x, 0) / d.length;
        const wins = d.filter(x => x < -0.5).length;
        console.log(`${pol.padEnd(8)} run ${mean('t')}s  ≥16kn ${mean('fast')}s  rides ${mean('n')} × ${mean('mean')}s links ${mean('links')}  longest≥15.5 ${mean('lock')}s  vs ${policies[0]}: ${dm >= 0 ? '+' : ''}${dm.toFixed(1)}s (faster in ${wins}/${a.length})  unfinished ${a.filter(o => !o.fin).length}`);
    }
    // ROUTE SCOREBOARD: from each start, which policy was fastest — a real choice means the
    // winner changes with the sea, not one route winning everywhere.
    const wins = {}; policies.forEach(p => wins[p] = 0);
    for (let k = 0; k < starts; k++) { let bp = null, bt = 1e9; for (const p of policies) if (r[p][k].t < bt) { bt = r[p][k].t; bp = p; } wins[bp]++; }
    console.log('fastest from each start: ' + policies.map(p => `${p} ${wins[p]}`).join(' | '));
    await b.close();
})();
