// BLUEWATER BONANZA — its wildlife and the feats its objectives read (js/wildlife.js WHALES,
// RIDERS, FLYERS, GLIDERS; OCEAN_RUN / checkOceanRun in js/sim/course.js). Headless, real page.
//
//   node regatta/eval/test_ocean.js     (from the repo root, like every suite)
//
// Checks: four humpback pods (one a mother and calf), dolphins, albatross, all on water; no
// Math.random; whales surface and blow, and over time breach, lobtail, pec-slap and feed; the
// calf feat only for the player racing, near the calf pod; the linked-swells feat at 30 s at
// 15 kn on the run and not at 25 s, nor on another leg; the far island only round its south side
// on the run, and not a bot's.
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
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const out = {}, feats = [];
        GameEvents.on('player-feat', (e) => feats.push(e.id));
        const d = Wildlife.debug();
        out.pods = d.whalePods.map(W => W.members.length + (W.cfg.calf ? 'c' : '')).join(',');
        out.calf = d.whalePods.some(W => W.cfg.calf && W.members.some(m => m.calf));
        out.others = [d.riders.length, d.gliders.length].join('/');
        const me = state.boats[0], away = (bt) => { bt.x = 1e6; bt.y = 1e6; };
        for (const bt of state.boats) away(bt);
        // a long quiet run (not racing): behaviours, water, no RNG
        const real = Math.random; let calls = 0; Math.random = () => { calls++; return real(); };
        const seen = new Set(); let dry = 0, blows = 0;
        for (let i = 0; i < 30 * 600; i++) { Wildlife.update(1 / 30);
            for (const W of d.whalePods) for (const m of W.members) { if (m.ev) seen.add(m.ev); if (pointOnLand(m.x, m.y)) dry++; }
            blows = Math.max(blows, Wildlife.debug().blows.length); }
        Math.random = real;
        out.randomCalls = calls; out.events = [...seen].sort().join(','); out.dry = dry; out.blows = blows;
        // the calf feat
        const calfPod = d.whalePods.find(W => W.cfg.calf), cm = calfPod.members[1];
        state.race.status = 'prestart'; me.x = cm.x + 100; me.y = cm.y; Wildlife.update(1 / 30);
        out.calfPrestart = feats.includes('ocean:calf'); away(me);
        state.race.status = 'racing'; const bot = state.boats[1]; bot.x = cm.x + 100; bot.y = cm.y; Wildlife.update(1 / 30);
        out.calfBot = feats.includes('ocean:calf'); away(bot);
        me.x = cm.x + 600; me.y = cm.y; Wildlife.update(1 / 30); out.calfFar = feats.includes('ocean:calf');
        me.x = cm.x + 150; me.y = cm.y; Wildlife.update(1 / 30); out.calfNear = feats.includes('ocean:calf'); away(me);
        // linked swells
        const last = state.course.route.length - 1;
        const fresh = () => { state.race.status = 'finished'; checkOceanRun(); state.race.status = 'racing'; me.raceState.finished = false; };
        const sail = (leg, secs, kn) => { const n0 = feats.length; fresh(); me.raceState.leg = leg; me.speed = kn / 4; me.x = 5000; me.y = 0;
            for (let i = 0; i <= secs * 30; i++) { state.race.timer = i / 30; checkOceanRun(); } return feats.slice(n0).filter(f => f === 'ocean:linked').length; };
        out.link30 = sail(last, 31, 16); out.link25 = sail(last, 25, 16); out.linkSlow = sail(last, 40, 14.5); out.linkLeg = sail(1, 40, 16);
        // the player sailing fast: dolphins come AHEAD of the bow and ride there; flying fish burst
        // off the bow and outrun the boat; the albatross stay in view
        { const me2 = state.boats[0], P0 = d.flyPatches[0]; let x = P0.x - Math.sin(1.75) * 1200, y = P0.y + Math.cos(1.75) * 1200, joined = -1, ahead = [], ffFast = 0, ffN = 0, albFar = 0;   // (through a flying-fish patch)
          for (let i = 0; i < 30 * 30; i++) { x += Math.sin(1.75) * 8; y -= Math.cos(1.75) * 8; me2.x = x; me2.y = y; me2.heading = 1.75; me2.speed = 4; me2.raceState.finished = false;
            Wildlife.update(1 / 30);
            const S = d.riders.find(o => o.boat === me2);
            if (S && S.state === 'riding') { if (joined < 0) joined = i / 30;
              if (i / 30 - joined > 4) for (const m of S.members) ahead.push((m.x - x) * Math.sin(1.75) - (m.y - y) * Math.cos(1.75)); }
            for (const f of Wildlife.debug().flyfish) if (f.t > 0 && f.t < f.dur) { ffN++; if (f.len / f.dur > 240) ffFast++; }
            for (const G of d.gliders) albFar = Math.max(albFar, Math.hypot(G.x - x, G.y - y)); }
          ahead.sort((a, c) => a - c);
          out.dolphinJoin = joined; out.dolphinAhead = ahead.length ? ahead[Math.floor(ahead.length * 0.1)] : -999; out.dolphinAheadMax = ahead.length ? ahead[ahead.length - 1] : 0;
          out.flyfish = ffN; out.flyfishFast = ffN ? ffFast / ffN : 0; out.albFar = albFar; }
        // flying fish only in their patches: sail fast outside every patch — none; through one — a burst
        { const me3 = state.boats[0], P = d.flyPatches; out.patches = P.length;
          const run = (px, py) => { const n0 = new Set(); for (let i = 0; i < 30 * 8; i++) { me3.x = px + i * 2; me3.y = py; me3.heading = Math.PI / 2; me3.speed = 4; Wildlife.update(1 / 30); for (const f of Wildlife.debug().flyfish) n0.add(f); } return n0.size; };
          let ox = 0, oy = 0; for (let k = 0; k < 200; k++) { ox = -4000 + (k * 997) % 18000; oy = -5000 + (k * 613) % 7500; if (!pointOnLand(ox, oy) && P.every(q => Math.hypot(q.x - ox, q.y - oy) > q.r + 800)) break; }
          const before = Wildlife.debug().flyfish.length; for (let i = 0; i < 90; i++) Wildlife.update(1 / 30);   // let any in the air land
          out.ffOutside = run(ox, oy); out.ffInside = run(P[0].x - 200, P[0].y); }
        // mahi-mahi: packs in most flying-fish patches; a hunt puts the fish up and the mahi chase fast
        { const P = d.flyPatches.find(q => q.pack); out.packs = d.flyPatches.filter(q => q.pack).length;
          const me4 = state.boats[0]; me4.x = P.x + 700; me4.y = P.y; me4.speed = 0; P.huntT = 0; P.since = 99;
          let vmax = 0; const px = new Map(); let chased = false;
          for (let i = 0; i < 90; i++) { me4.x = P.x + 700; me4.y = P.y; Wildlife.update(1 / 30);
            for (const m of P.pack) { const q = px.get(m); if (q) vmax = Math.max(vmax, Math.hypot(m.x - q[0], m.y - q[1]) * 30); px.set(m, [m.x, m.y]); if (m.mode === 'chase') chased = true; } }
          out.mahiChase = chased; out.mahiKn = vmax / 15; }
        // whales are hard contact at the surface only
        { const W = d.whalePods.find(w => w.cfg.id === 'B'), m = W.members[0], bt = state.boats[2]; state.race.status = 'racing';
          const put = () => { bt.raceState.finished = false; bt.heading = m.h + Math.PI / 2; bt.x = m.x - Math.sin(bt.heading) * 5; bt.y = m.y + Math.cos(bt.heading) * 5; bt.speed = 3; bt._whaleT = null; };
          m.mode = 'surface'; m.ev = null; m.blowT = 50; m.breaths = 3; put(); checkWhaleContact(1 / 30);
          out.hitSurface = bt.speed < 1 && Math.hypot(bt.x - m.x, bt.y - m.y) > 10;
          m.mode = 'under'; m.ev = null; m.t = 30; put(); checkWhaleContact(1 / 30);
          out.passUnder = bt.speed === 3;
          m.mode = 'surface'; m.t = 0; m.blowT = 50; for (const o of state.boats) { o.x = 1e6; o.y = 1e6; } }
        // the far island: round its south side, not its north
        const cross = (x0, y0, x1, y1, leg) => { const n0 = feats.length; fresh(); me.raceState.leg = leg;
            for (let i = 0; i <= 20; i++) { me.x = x0 + (x1 - x0) * i / 20; me.y = y0 + (y1 - y0) * i / 20; checkOceanRun(); } return feats.slice(n0).filter(f => f === 'ocean:far-island').length; };
        out.southRound = cross(2000, 9000, 4600, 9000, last);
        out.northPass = cross(2000, 4500, 4600, 4500, last);
        out.southEarly = cross(2000, 9000, 4600, 9000, 1);
        // the gate is where it says: the island's sand is land (so the gate cannot be dodged over it)
        out.islandLand = pointOnLand(3300, 6300);
        return out;
    });
    ok(r.pods === '2c,5,2,2,2,1,3', `seven humpback pods — the mother and calf, and groups of 1-5 (${r.pods})`);
    ok(r.calf, 'the calf is in the calf pod');
    ok(r.others === '4/2', `dolphin schools and albatross (${r.others})`);
    ok(r.randomCalls === 0, `wildlife never calls Math.random (${r.randomCalls})`);
    ok(r.dry === 0, `no whale ever on land (${r.dry} frames)`);
    ok(r.blows > 0, 'whales blow');
    ok(['breach', 'feed', 'lobtail', 'pecslap'].every(e => r.events.includes(e)), `ten minutes of whales shows every behaviour (${r.events})`);
    ok(!r.calfPrestart && !r.calfBot && !r.calfFar, 'the calf feat: not before the gun, not a bot, not from far off');
    ok(r.calfNear, 'the player alongside the mother and calf earns ocean:calf');
    ok(r.dolphinJoin >= 0 && r.dolphinJoin < 20, `spinner dolphins come to a fast boat's bow (after ${r.dolphinJoin.toFixed(1)} s)`);
    ok(r.dolphinAhead > 27 && r.dolphinAheadMax < 110, `and ride AHEAD of the stem, not alongside (10th pct ${r.dolphinAhead.toFixed(0)} u ahead of centre, max ${r.dolphinAheadMax.toFixed(0)}; stem at 27)`);
    ok(r.flyfish > 0 && r.flyfishFast === 1, `flying fish burst off the bow and outrun the boat (${r.flyfish} fish-frames)`);
    ok(r.patches === 14, `flying fish live in patches of ocean, on every lane (${r.patches})`);
    ok(r.ffOutside === 0 && r.ffInside > 3, `none outside a patch (${r.ffOutside}), a burst through one (${r.ffInside})`);
    ok(r.albFar < 1500, `the albatross stay in view of the player (farthest ${r.albFar.toFixed(0)} u)`);
    ok(r.packs >= 3, `mahi-mahi hunt in most flying-fish patches (${r.packs})`);
    ok(r.mahiChase && r.mahiKn > 25 && r.mahiKn < 40, `a hunt: the mahi chase the flying fish at ${r.mahiKn.toFixed(0)} kn`);
    ok(r.hitSurface, 'a boat that sails into a whale at the surface is stopped and pushed clear');
    ok(r.passUnder, 'a whale cruising below is passed over');
    ok(r.link30 === 1, '30 s at 16 kn on the run: ocean:linked');
    ok(r.link25 === 0 && r.linkSlow === 0 && r.linkLeg === 0, 'not at 25 s, not at 14.5 kn, not on another leg');
    ok(r.southRound === 1 && r.northPass === 0 && r.southEarly === 0, 'far island: round the south side on the run only');
    ok(r.islandLand, 'the far island is land at its centre');
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
