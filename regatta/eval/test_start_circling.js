// NO BOT CIRCLES INSTEAD OF STARTING (PT-051, Oct 2026).
//
//   node regatta/eval/test_start_circling.js            (ROOT=<tree> to run another checkout)
//
// Wes: "what I'm worried about most is bots that spin endlessly without starting — literally in
// circles". His own races showed it (Sep 30): Splash 13 turns before crossing at 112 s, Vex 11 and
// never started. Bot-only races never reproduce it; it needs a boat in the pack the way he sails. So
// this replays his boat through a real start — Gatorgrass R2, the race with the most circling — placed
// every frame where he was (eval/golden/wes_start_swamp.json), and lets nine bots start around him.
//
// Fails if any bot turns two or more full circles (net) on the start leg after the gun, or has not
// crossed by 90 s. The Sep 30 code fails it (8 circlers, up to 17.9 turns, some never start); the fix
// was 0e614d9 (PT-002, the starboard start).
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = process.env.ROOT ? path.resolve(process.env.ROOT) : path.resolve('.');
const FIX = JSON.parse(fs.readFileSync(path.resolve('regatta/eval/golden/wes_start_swamp.json'), 'utf8'));
const SEEDS = [9400, 9401, 9402, 9403];
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), FIX.venue);
    const all = [];
    for (const seed of SEEDS) all.push(...await p.evaluate(({ seed, track }) => {
        window.evalHarness.seed = seed; window.resetGame(); window.startRace(); state.course.cutoff = 900;
        const P = state.boats.find(bt => bt.isPlayer); let k = 0;
        const place = () => {
            const t = state.race.status === 'prestart' ? -state.race.timer : state.race.timer;
            while (k < track.length - 2 && track[k + 1][0] <= t) k++;
            const a = track[k], c = track[Math.min(k + 1, track.length - 1)], f = c[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (c[0] - a[0]))) : 0;
            P.x = a[1] + (c[1] - a[1]) * f; P.y = a[2] + (c[2] - a[2]) * f; P.heading = a[3]; P.speed = a[4] / 4;
            P.velocity = { x: Math.sin(P.heading) * P.speed, y: -Math.cos(P.heading) * P.speed };
        };
        const rot = new Map();
        for (let it = 0; it < 60 * 130; it++) {
            place(); window.update(1 / 60);
            if (state.race.status !== 'racing') continue;
            for (const bt of state.boats) { if (bt === P || bt.raceState.leg >= 1) continue;
                const R = rot.get(bt) || { h: bt.heading, net: 0, max: 0 }; R.net += normalizeAngle(bt.heading - R.h);
                R.max = Math.max(R.max, Math.abs(R.net)); R.h = bt.heading; rot.set(bt, R); }
            if (state.race.timer > 95 || state.boats.every(bt => bt === P || bt.raceState.leg >= 1)) break;
        }
        return state.boats.filter(bt => bt !== P).map(bt => ({ seed, name: bt.name,
            turns: rot.get(bt) ? rot.get(bt).max / (2 * Math.PI) : 0,
            cross: bt.raceState.leg >= 1 ? bt.raceState.startTimeDisplay : null }));
    }, { seed, track: FIX.track }));
    await b.close();
    let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`); };
    const circ = all.filter(r => r.turns >= 2), late = all.filter(r => r.cross == null || r.cross > 90);
    const maxT = Math.max(0, ...all.map(r => r.turns));
    if (process.env.VERBOSE) for (const r of all.filter(r => r.turns >= 1)) console.log(`    ${r.name} @${r.seed}: ${r.turns.toFixed(1)} turns, crossed ${r.cross == null ? 'never' : r.cross.toFixed(1) + ' s'}`);
    console.log(`Wes's Gatorgrass start replayed, ${SEEDS.length} seeds, ${all.length} bot starts\n`);
    ok(!circ.length, `no bot circles twice before starting (most: ${maxT.toFixed(1)} turns)` + (circ.length ? ' — ' + circ.map(r => `${r.name} ${r.turns.toFixed(1)}t @${r.seed}`).join(', ') : ''));
    ok(!late.length, `every bot has started by 90 s` + (late.length ? ' — ' + late.map(r => `${r.name} @${r.seed}`).join(', ') : ''));
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${fails} failure(s)`);
    process.exit(fails ? 1 : 0);
})();
