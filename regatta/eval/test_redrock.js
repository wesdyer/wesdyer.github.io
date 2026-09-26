// REDROCK RESERVOIR — its wildlife and the feats its objectives read (js/wildlife.js stripers,
// condors, bighorn, coyotes; REDROCK_RUN / checkRedrockRun in js/sim/course.js). Headless, real
// page.
//
//   node regatta/eval/test_redrock.js     (from the repo root, like every suite)
//
// Checks: four bighorn bands and four coyotes on land, three condors over the butte, boils on
// open water; carp jumping near the player, close to the shore; no Math.random; sheep bound from a close boat, coyotes lope; a boil counts once,
// only for the player racing, not from beside it; Right of Way counts different rivals giving
// way in the junction and nothing outside it or before the gun; Condor Butte only all the way
// round; the six rows read what they should.
const { chromium } = require('playwright');
const path = require('path');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    const r = await p.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const out = {}, feats = [];
        GameEvents.on('player-feat', (e) => feats.push(e));
        const d = Wildlife.debug();
        out.bands = d.bands.map(G => G.members.length).join(',');
        out.coyotes = d.coyotes.length; out.condors = d.condors.length;
        const me = state.boats[0], away = (bt) => { bt.x = 1e6; bt.y = 1e6; };
        for (const bt of state.boats) away(bt);
        // ten quiet minutes: no RNG, land animals on land, boils on water, condors near the roost
        const real = Math.random; let calls = 0; Math.random = () => { calls++; return real(); };
        let wet = 0, dry = 0, boils = 0, far = 0; const bseen = new Set();
        const [rx, ry] = Wildlife.WILDLIFE.redrock.condors.roost;
        for (let i = 0; i < 30 * 600; i++) { Wildlife.update(1 / 30);
            for (const G of d.bands) for (const s of G.members) if (!pointOnLand(s.x, s.y)) wet++;
            for (const K of d.coyotes) if (!pointOnLand(K.x, K.y)) wet++;
            for (const B of Wildlife.debug().stripers) { bseen.add(B.seed); if (pointOnLand(B.x, B.y)) dry++; }
            for (const C of d.condors) if (C.mode === 'circle' && Math.hypot(C.x - rx, C.y - ry) > 500) far++; }
        Math.random = real;
        out.randomCalls = calls; out.wet = wet; out.dry = dry; out.boils = bseen.size; out.far = far;
        out.glided = d.condors.some(C => C.mode === 'glide') || d.condors[0].t < 200;
        // carp jumping near the player: often enough, on water, near the shore, sometimes twice
        { const me2 = state.boats[0]; me2.x = -1600; me2.y = -700; state.race.status = 'prestart';   // (not racing: nothing here is a feat)
          const seen = new Map(); let wetLand = 0, farOut = 0;
          for (let i = 0; i < 30 * 120; i++) { me2.x = -1600; me2.y = -700; Wildlife.update(1 / 30);
            for (const L of Wildlife.debug().leaps) if (L.kind === 'carp' && L.t >= 0 && !seen.has(L)) { seen.set(L, 1);
              if (pointOnLand(L.x, L.y)) wetLand++;
              let near = false; for (let a = 0; a < 12 && !near; a++) near = pointOnLand(L.x + Math.cos(a / 12 * 6.283) * 175, L.y + Math.sin(a / 12 * 6.283) * 175); if (!near) farOut++; } }
          out.carp = seen.size; out.carpDry = wetLand; out.carpFar = farOut; away(me2); }
        // sheep bound from a close boat; a coyote lopes
        { const G = d.bands[0], s = G.members[0]; me.x = s.x + 60; me.y = s.y; me.opacity = 1;
          for (let i = 0; i < 10; i++) Wildlife.update(1 / 30); out.bound = G.members.some(q => q.mode === 'bound'); away(me);
          const K = d.coyotes[0]; me.x = K.x + 60; me.y = K.y; for (let i = 0; i < 10; i++) Wildlife.update(1 / 30); out.lope = K.mode === 'lope'; away(me); }
        // boils: not before the gun, not a bot, not from beside it; once each for the player
        const n = (id) => feats.filter(e => e.id === id);
        const boilAt = () => Wildlife.debug().stripers.find(B => B.t > 5 && B.life - B.t > 8);
        let B = null; for (let i = 0; i < 3000 && !B; i++) { Wildlife.update(1 / 30); B = boilAt(); }
        state.race.status = 'prestart'; me.x = B.x; me.y = B.y; Wildlife.update(1 / 30); out.boilPrestart = n('redrock:boils').length; away(me);
        state.race.status = 'racing'; me.raceState.finished = false;
        const bot = state.boats[1]; bot.x = B.x; bot.y = B.y; Wildlife.update(1 / 30); out.boilBot = n('redrock:boils').length; away(bot);
        me.x = B.x + B.r * 1.2; me.y = B.y; Wildlife.update(1 / 30); out.boilBeside = n('redrock:boils').length;
        me.x = B.x; me.y = B.y; Wildlife.update(1 / 30); Wildlife.update(1 / 30); out.boilIn = n('redrock:boils').map(e => e.value).join(',');
        away(me);
        // Right of Way: a rival's controller giving way to the player, in and out of the junction
        const m3 = state.course.marks.find(m => m.id === 'mark-3');
        const giveWay = (rv, secs, x, y, status) => { state.race.status = status || 'racing'; me.x = x; me.y = y; me.raceState.finished = false;
            const c = rv.controller || (rv.controller = new BotController(rv)); rv.raceState.finished = false;
            for (let i = 0; i < secs * 30; i++) { c.threatBoat = me; c.avoidanceRole = 'GIVE_WAY'; c.riskState = 'HIGH'; c.lastAvoidDeviation = 0.6; checkRedrockRun(); }
            c.threatBoat = null; c.avoidanceRole = 'NONE'; c.riskState = 'LOW'; c.lastAvoidDeviation = 0; for (let i = 0; i < 60; i++) checkRedrockRun(); };
        const rows = state.boats.slice(1, 6);
        const fresh = () => { state.race.status = 'finished'; checkRedrockRun(); state.race.status = 'racing'; };
        fresh(); giveWay(rows[0], 1.2, m3.x + 100, m3.y, 'prestart'); out.rowPrestart = n('redrock:gave-way').length;
        fresh(); giveWay(rows[0], 1.2, m3.x + 1500, m3.y); out.rowOutside = n('redrock:gave-way').length;
        fresh(); giveWay(rows[0], 0.5, m3.x + 100, m3.y); out.rowShort = n('redrock:gave-way').length;
        fresh(); giveWay(rows[0], 1.2, m3.x + 100, m3.y); giveWay(rows[0], 1.2, m3.x + 100, m3.y); giveWay(rows[1], 1.2, m3.x - 200, m3.y); giveWay(rows[2], 1.2, m3.x, m3.y + 300);
        out.rowVals = n('redrock:gave-way').map(e => e.value).join(',');
        // Condor Butte: all the way round, not halfway
        const sailPath = (pts) => { fresh(); const n0 = n('redrock:butte').length;
            for (let k = 0; k < pts.length - 1; k++) for (let i = 0; i <= 20; i++) { me.x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * i / 20; me.y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * i / 20; checkRedrockRun(); }
            return n('redrock:butte').length - n0; };
        out.butteRound = sailPath([[-2000, -1000], [-2850, -1300], [-2800, -1950], [-2250, -2150], [-1850, -1700]]);
        out.butteBack = sailPath([[-2000, -1000], [-2850, -1300], [-2850, -1700], [-2850, -1300], [-2000, -1000]]);
        out.butteDirect = sailPath([[-1500, -900], [-300, -250]]);
        // the rows
        const A = Unlocks.ACHIEVEMENTS.filter(a => a.venue === 'redrock');
        out.rows = A.map(a => a.char).join(',');
        const base = { venue: 'redrock', finished: true, rulesOn: true, penalties: 0, feats: [], vals: {} };
        const T = (ch, o) => A.find(a => a.char === ch).test(Object.assign({}, base, o));
        out.sawYes = T('Sawbill', { vals: { 'redrock:gave-way': 3 } });
        out.sawNo = T('Sawbill', { vals: { 'redrock:gave-way': 2 } }) || T('Sawbill', { vals: { 'redrock:gave-way': 3 }, penalties: 1 }) || T('Sawbill', { vals: { 'redrock:gave-way': 4 }, rulesOn: false });
        out.trek = T('Trek', { feats: ['redrock:butte'] }) && !T('Trek', {});
        out.line = T('Linesider', { vals: { 'redrock:boils': 3 } }) && !T('Linesider', { vals: { 'redrock:boils': 2 } });
        return out;
    });
    ok(r.bands === '5,4,6,3', `four bighorn bands at the towers and talus (${r.bands})`);
    ok(r.coyotes === 4 && r.condors === 3, `four coyotes, three condors (${r.coyotes}/${r.condors})`);
    ok(r.randomCalls === 0, `wildlife never calls Math.random (${r.randomCalls})`);
    ok(r.wet === 0, `sheep and coyotes stay on land (${r.wet} frames off it)`);
    ok(r.dry === 0 && r.boils >= 8, `boils come and go on open water (${r.boils} in ten minutes, ${r.dry} frames on land)`);
    ok(r.far === 0, 'circling condors stay over the butte');
    ok(r.glided, 'the first condor glides out over the course');
    ok(r.carp >= 10 && r.carp <= 30, `carp jump near the player — ${r.carp} in two minutes`);
    ok(r.carpDry === 0 && r.carpFar === 0, `every carp jump on water within 175 u of the shore (${r.carpDry} on land, ${r.carpFar} out in open water)`);
    ok(r.bound, 'bighorn bound up the rock from a close boat');
    ok(r.lope, 'a coyote lopes off from a close boat');
    ok(r.boilPrestart === 0 && r.boilBot === 0 && r.boilBeside === 0, 'a boil: not before the gun, not a bot, not from beside it');
    ok(r.boilIn === '1', `sailing into a boil counts it once (${r.boilIn})`);
    ok(r.rowPrestart === 0 && r.rowOutside === 0 && r.rowShort === 0, 'Right of Way: not before the gun, not outside the junction, not a flicker');
    ok(r.rowVals === '1,2,3', `three different rivals giving way in the junction count 1, 2, 3 — the same rival twice counts once (${r.rowVals})`);
    ok(r.butteRound === 1 && r.butteBack === 0 && r.butteDirect === 0, 'Condor Butte: all the way round only');
    ok(r.rows === 'Chisel,Sawbill,Trek,Ridge,Talon,Linesider', `six Redrock rows (${r.rows})`);
    ok(r.sawYes && !r.sawNo, 'Sawbill: three, rules on, no penalty');
    ok(r.trek && r.line, 'Trek reads the butte, Linesider three boils');
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
