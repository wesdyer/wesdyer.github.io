// GATORGRASS BAYOU — its wildlife and the feats its objectives read (js/wildlife.js LURKERS,
// STALKERS, PERCHERS; checkSwampRoute / ROUTE_GATES in js/sim/course.js). Headless, on the
// real page.
//
//   node regatta/eval/test_swamp.js     (from the repo root, like every suite)
//
// Checks: 21 alligators, 7 egrets and 3 anhingas, all on water; none of it draws from
// Math.random; a bot puts an alligator down but only the player's own count (and never before
// the gun, never the same animal twice); egrets fly off from a boat; only the player putting
// up the anhingas earns 'swamp:anhingas'; each passage's gate names its route, the last one
// crossed wins; and two of Wes's own recorded races, replayed through the check, come out as
// the passages they took.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

// Two of Wes's trajectories: his fastest (East, 2:08) and one through the Cut (2:39).
const TRAJ = 'regatta/eval/rl/traj';
const track = (name) => { const f = path.join(TRAJ, name); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).samples.map(s => [s[2], s[3]]) : null; };
const EAST = track('traj_swamp_1788850706135.json'), CUT = track('traj_swamp_1788850969567.json');

(async () => {
    const b = await chromium.launch();
    const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    const r = await p.evaluate(({ EAST, CUT }) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'swamp', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const out = {}, feats = [];
        GameEvents.on('player-feat', (e) => feats.push(e));
        const d = Wildlife.debug();
        out.counts = [d.lurkers.length, d.stalkers.length, d.perchers.length].join('/');
        out.onWater = d.lurkers.every(g => !pointOnLand(g.x, g.y)) && d.perchers.every(a => !pointOnLand(a.px, a.py));

        const real = Math.random; let calls = 0; Math.random = () => { calls++; return real(); };
        for (let i = 0; i < 900; i++) Wildlife.update(1 / 30);
        Math.random = real;
        out.randomCalls = calls;
        out.stillOnWater = d.lurkers.every(g => g.mode === 'under' || !pointOnLand(g.x, g.y));

        const me = state.boats[0], bot = state.boats[1];
        const away = (bt) => { bt.x = 1e5; bt.y = 1e5; };
        for (const bt of state.boats) away(bt);
        const settle = () => { for (const g of d.lurkers) { g.mode = 'float'; g.sink = 0; g.t = 30; g.x = g.hx; g.y = g.hy; } };
        const gatorVals = () => feats.filter(e => e.id === 'swamp:gators').map(e => e.value);
        // A bot puts one down: it sinks, nobody's count moves.
        settle(); state.race.status = 'racing';
        const g0 = d.lurkers[0]; bot.x = g0.x + 60; bot.y = g0.y;
        for (let i = 0; i < 3; i++) Wildlife.update(1 / 30);
        out.botSank = g0.mode === 'sink' || g0.mode === 'under';
        out.botCounted = gatorVals().length > 0;
        away(bot);
        // The player before the gun: it sinks, still no count.
        settle(); state.race.status = 'prestart';
        me.x = g0.x + 60; me.y = g0.y;
        for (let i = 0; i < 3; i++) Wildlife.update(1 / 30);
        out.prestartCounted = gatorVals().length > 0;
        // The player racing, past three of them — and back past the first again.
        settle(); state.race.status = 'racing';
        for (const g of [d.lurkers[0], d.lurkers[1], d.lurkers[2], d.lurkers[0]]) { settle(); me.x = g.x + 60; me.y = g.y; Wildlife.update(1 / 30); away(me); Wildlife.update(1 / 30); }
        out.playerVals = gatorVals().join(',');

        // Egrets fly off from a boat.
        const e0 = d.stalkers[0]; e0.mode = 'stand'; bot.x = e0.x + 50; bot.y = e0.y;
        Wildlife.update(1 / 30); out.egretFlew = e0.mode === 'fly'; away(bot);
        // Anhingas: a bot flushes them, no feat; the player does, the feat.
        const a0 = d.perchers[0];
        bot.x = a0.px + 60; bot.y = a0.py; Wildlife.update(1 / 30);
        out.anhingaDropped = a0.mode === 'drop';
        out.botAnhinga = feats.some(e => e.id === 'swamp:anhingas'); away(bot);
        const a1 = d.perchers[1]; me.x = a1.px + 60; me.y = a1.py; Wildlife.update(1 / 30);
        out.playerAnhinga = feats.some(e => e.id === 'swamp:anhingas'); away(me);

        // ── the passages ──
        const routeOf = (pts) => {
            const n0 = feats.length; me.x = pts[0][0]; me.y = pts[0][1]; checkSwampRoute();
            for (const [x, y] of pts) { me.x = x; me.y = y; checkSwampRoute(); }
            const v = feats.slice(n0).filter(e => e.id === 'swamp:route').map(e => e.value);
            return v.join('>');
        };
        state.race.status = 'racing';
        // straight across each gate's middle
        const gates = { cut: [[-774, 479], [-290, 263]], east: [[343, 1766], [656, 1224]], west: [[-3611, 1288], [-2409, -366]], longway: [[976, 5051], [802, 2557]] };
        out.gates = Object.entries(gates).map(([n, [a, c]]) => {
            const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy);
            const nx = -dy / L, ny = dx / L;
            return n + ':' + routeOf([[mx - nx * 60, my - ny * 60], [mx + nx * 60, my + ny * 60]]);
        }).join(' ');
        out.lastWins = routeOf([[-532 - 60, 371], [-532 + 60, 371]].map(([x, y]) => [x, y])) && routeOf([[-560, 300], [-500, 420], [500, 1420], [560, 1560]]);
        out.prestartRoute = (() => { state.race.status = 'prestart'; const v = routeOf([[-560, 300], [-500, 420]]); state.race.status = 'racing'; return v; })();
        out.wesEast = EAST ? routeOf(EAST) : 'no file';
        out.wesCut = CUT ? routeOf(CUT) : 'no file';
        return out;
    }, { EAST, CUT });

    ok(r.counts === '21/7/3', `21 alligators, 7 egrets, 3 anhingas (${r.counts})`);
    ok(r.onWater, 'the alligators and the anhingas\' snags are on the water');
    ok(r.randomCalls === 0, `wildlife never calls Math.random (${r.randomCalls})`);
    ok(r.stillOnWater, 'half a minute on, every alligator up is still on the water');
    ok(r.botSank && !r.botCounted, 'a bot puts an alligator down, and counts for nobody');
    ok(!r.prestartCounted, 'no count before the gun');
    ok(r.playerVals === '1,2,3', `the player's count rises once per alligator, never twice for the same one (${r.playerVals})`);
    ok(r.egretFlew, 'an egret flies off from a boat');
    ok(r.anhingaDropped && !r.botAnhinga, 'a bot drops the anhingas into the water, and earns nobody anything');
    ok(r.playerAnhinga, 'the player putting them up earns swamp:anhingas');
    ok(r.gates === 'cut:cut east:east west:west longway:longway', `each gate names its passage (${r.gates})`);
    ok(r.lastWins.endsWith('cut>east') || r.lastWins === 'cut>east', `the last passage crossed is the one that counts (${r.lastWins})`);
    ok(r.prestartRoute === '', 'no passage before the gun');
    ok(r.wesEast.split('>').pop() === 'east', `Wes's 2:08 race comes out as East (${r.wesEast})`);
    ok(r.wesCut.split('>').pop() === 'cut', `Wes's 2:39 race comes out as the Cut (${r.wesCut})`);
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
