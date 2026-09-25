// SOCKEYE RUN — its wildlife and the feats its objectives read (js/wildlife.js FISHERS, RUNS,
// SOARERS, ROMPERS and LEAPERS' rapids mode; RIVER_RUN / checkRiverRun in js/sim/course.js;
// the player-contact event in js/sim/collision.js). Headless, on the real page.
//
//   node regatta/eval/test_river.js     (from the repo root, like every suite)
//
// Checks: two bears, four salmon runs, three eagles and two otter families, all where they
// should be; none of it draws from Math.random; a boat close by makes a bear rear up and it
// stays put; a run scatters from a boat and gathers again; an eagle stoops, takes a salmon and
// climbs away with it; an otter family dives from a boat and surfaces; salmon leap only in the
// white water and always upstream. The chute gate pays 'river:chute' on the run home only —
// not down the west arm, not before the gun, not on an earlier leg — and Wes's own recorded
// races come out the way they went (the six down the east arm, the three down the west). A
// scrape on the run home is 'river:scraped', once; a bot's scrape is nobody's.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

const TRAJ = 'regatta/eval/rl/traj';
const FPS = ['9f41277d', '76659ee5'];
const WES = fs.readdirSync(TRAJ).filter(f => f.startsWith('traj_river_')).map(f => JSON.parse(fs.readFileSync(path.join(TRAJ, f), 'utf8')))
    .filter(j => FPS.includes(String(j.venueFingerprint).split(':')[0]))
    .map(j => j.samples.filter(s => s[1] === 1).map(s => [s[8], s[2], s[3]]));

(async () => {
    const b = await chromium.launch();
    const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    const r = await p.evaluate(({ WES }) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const out = {}, feats = [];
        GameEvents.on('player-feat', (e) => feats.push(e.id));
        const d = Wildlife.debug();
        out.counts = [d.fishers.length, d.runs.map(G => G.fish.length).join('+'), d.soarers.length, d.rompers.map(F => F.members.length).join('+')].join(' / ');
        out.onWater = d.fishers.every(B => !pointOnLand(B.x, B.y)) && d.runs.every(G => !pointOnLand(G.hx, G.hy)) && d.rompers.every(F => !pointOnLand(F.entry.x, F.entry.y));
        out.chuteBear = Math.hypot(d.fishers[0].x - 5500, d.fishers[0].y + 6070) < 1;

        const real = Math.random; let calls = 0; Math.random = () => { calls++; return real(); };
        for (let i = 0; i < 900; i++) Wildlife.update(1 / 30);
        Math.random = real;
        out.randomCalls = calls;

        const me = state.boats[0], bot = state.boats[1];
        const away = (bt) => { bt.x = 1e5; bt.y = 1e5; };
        for (const bt of state.boats) away(bt);
        // ── a bear rears up to look at a boat, and stays where it is ──
        { const B = d.fishers[0]; B.mode = 'watch'; B.t = 30; B.rear = 0; B.x = B.hx; B.y = B.hy;
          bot.x = B.x + 150; bot.y = B.y; for (let i = 0; i < 60; i++) Wildlife.update(1 / 30);
          out.bearRears = B.rear > 0.8; out.bearStays = Math.hypot(B.x - B.hx, B.y - B.hy) < 20; away(bot);
          for (let i = 0; i < 90; i++) Wildlife.update(1 / 30); out.bearDown = B.rear < 0.2; }
        // ── a run scatters from a boat and gathers again ──
        { const G = d.runs[1]; const mean = () => { let x = 0, y = 0; for (const f of G.fish) { x += f.x; y += f.y; } return [x / G.fish.length, y / G.fish.length]; };
          const [x0, y0] = mean(); bot.x = G.hx - 60; bot.y = G.hy; for (let i = 0; i < 30; i++) Wildlife.update(1 / 30);
          const [x1, y1] = mean(); out.runScatters = Math.hypot(x1 - x0, y1 - y0) > 30; away(bot);
          for (let i = 0; i < 30 * 20; i++) Wildlife.update(1 / 30);
          const [x2, y2] = mean(); out.runGathers = Math.hypot(x2 - x0, y2 - y0) < 25;
          out.runOnWater = G.fish.every(f => !pointOnLand(f.x, f.y)); }
        // ── an eagle stoops on a run, takes a salmon and climbs away ──
        out.eaglesInReach = d.soarers.every(E => d.runs.some(G => Math.hypot(G.hx - E.cx, G.hy - E.cy) < 900 - E.r));
        { const E = d.soarers[0]; E.mode = 'soar'; E.t = 0; let grabbed = false, climbed = false;
          for (let i = 0; i < 30 * 40 && !climbed; i++) { Wildlife.update(1 / 30); if (E.mode === 'grab') grabbed = true; if (grabbed && E.mode === 'soar') climbed = E.fish > 0; }
          out.eagleFishes = grabbed && climbed; }
        // ── otters: a boat puts the family under; they come up further off ──
        { const F = d.rompers[0]; F.mode = 'rest'; F.t = 0; Wildlife.update(1 / 30);
          out.ottersIn = F.mode === 'swim';
          for (let i = 0; i < 60; i++) Wildlife.update(1 / 30);
          const lead = F.members[0]; bot.x = lead.x + 60; bot.y = lead.y; Wildlife.update(1 / 30);
          out.ottersDive = F.mode === 'under'; away(bot);
          let up = false; for (let i = 0; i < 30 * 8 && !up; i++) { Wildlife.update(1 / 30); up = F.mode === 'swim'; }
          out.ottersSurface = up && F.members.every(m => !pointOnLand(m.x, m.y)); }
        // ── salmon leap in the white water, upstream ──
        { me.x = 1300; me.y = -2550; const seen = [];
          for (let i = 0; i < 30 * 30; i++) { Wildlife.update(1 / 30); for (const L of Wildlife.debug().leaps) if (!seen.includes(L)) seen.push(L); }   // (the list is rebuilt each update)
          const up = (x, y) => { const c = getCurrentAt(x, y); return c.direction + Math.PI; };
          out.leaps = seen.length;
          out.leapsInRapids = seen.filter(L => !L.fromRun).every(L => rapidsTurbAt(L.x, L.y) >= 0.3);
          // and out of a holding run in view: park by the eddy's run for half a minute
          me.x = 2450; me.y = -4200; let fromRun = 0;
          for (let i = 0; i < 30 * 30; i++) { Wildlife.update(1 / 30); for (const L of Wildlife.debug().leaps) if (L.fromRun && !seen.includes(L)) { seen.push(L); fromRun++; } }
          out.runLeaps = fromRun;
          out.leapsUpstream = seen.every(L => Math.cos(L.h - up(L.x, L.y)) > 0.8);
          away(me); }

        // ── the chute ──
        const last = state.course.route.length - 1;
        const cross = (x, leg, status) => {
            const n0 = feats.length; state.race.status = 'finished'; checkRiverRun();   // a new race
            state.race.status = status; me.raceState.leg = leg; me.raceState.finished = false;
            for (const y of [-6060, -6120, -6180, -6240]) { me.x = x; me.y = y; checkRiverRun(); }
            return feats.slice(n0).filter(f => f === 'river:chute').length;
        };
        out.chute = cross(5900, last, 'racing');
        out.westArm = cross(5100, last, 'racing');
        out.chutePrestart = cross(5900, last, 'prestart');
        out.chuteEarlyLeg = cross(5900, 1, 'racing');
        // Wes's recorded races, replayed through the check
        out.wes = WES.map(tr => { const n0 = feats.length; state.race.status = 'finished'; checkRiverRun(); state.race.status = 'racing';
            for (const [leg, x, y] of tr) { me.raceState.leg = leg; me.x = x; me.y = y; checkRiverRun(); }
            return feats.slice(n0).includes('river:chute') ? 'E' : 'W'; }).join('');

        // ── a scrape on the run home ──
        const scrape = (who, leg, status) => {
            const n0 = feats.length; state.race.status = 'finished'; checkRiverRun();
            state.race.status = status; me.raceState.leg = leg; me.raceState.finished = false; checkRiverRun();
            if (who === 'player') { GameEvents.emit('player-contact', { leg, isFloe: false }); GameEvents.emit('player-contact', { leg, isFloe: false }); }
            return feats.slice(n0).filter(f => f === 'river:scraped').length;
        };
        out.scrapeHome = scrape('player', last, 'racing');
        out.scrapeEarly = scrape('player', 1, 'racing');
        out.scrapeBot = scrape('bot', last, 'racing');
        // and a real grounding: the player driven onto the bank on the run home
        { const n0 = feats.length; state.race.status = 'finished'; checkRiverRun(); state.race.status = 'racing';
          me.raceState.leg = last; me.raceState.finished = false;
          // the footbridge bank, where Wes's slowest race scraped (3714..3900, -3690)
          me.x = 3800; me.y = -3560; me.heading = Math.PI; me.speed = 3;
          for (let i = 0; i < 90; i++) { me.speed = 3; me.heading = Math.PI; update(1 / 30); }
          out.realScrape = feats.slice(n0).filter(f => f === 'river:scraped').length; }
        return out;
    }, { WES });

    ok(r.counts === '2 / 34+40+32+28 / 3 / 4+4', `2 bears, 4 salmon runs, 3 eagles, 2 otter families (${r.counts})`);
    ok(r.onWater, 'the bears, the runs and the otters\' way in are all on the water');
    ok(r.chuteBear, 'a bear stands at the head of the chute');
    ok(r.randomCalls === 0, `wildlife never calls Math.random (${r.randomCalls})`);
    ok(r.bearRears && r.bearStays, 'a boat close by makes the bear rear up to look, and it stays put');
    ok(r.bearDown, 'with the boat gone it drops back down');
    ok(r.runScatters && r.runGathers, 'a salmon run scatters from a boat and gathers again');
    ok(r.runOnWater, 'every salmon stays in the water');
    ok(r.eaglesInReach, 'every eagle circles within a stoop of a salmon run');
    ok(r.eagleFishes, 'an eagle stoops on a run, takes a salmon and climbs away with it');
    ok(r.ottersIn, 'the otters slide off their logjam and swim');
    ok(r.ottersDive && r.ottersSurface, 'a boat puts the otter family under; they surface again on the water');
    ok(r.leaps >= 30 && r.leapsInRapids && r.leapsUpstream, `plenty of salmon leap in the white water, upstream (${r.leaps} in 30 s; rapids ${r.leapsInRapids}, upstream ${r.leapsUpstream})`);
    ok(r.runLeaps >= 5, `and now and then out of a holding run in view (${r.runLeaps} in 30 s)`);
    ok(r.chute === 1, 'down the chute on the run home: river:chute, once');
    ok(r.westArm === 0, 'down the west arm: no chute');
    ok(r.chutePrestart === 0 && r.chuteEarlyLeg === 0, 'no chute before the gun, or on an earlier leg');
    ok(r.wes.split('').sort().join('') === 'EEEEEEWWW', `Wes's nine races: six down the chute, three down the west arm (${r.wes})`);
    ok(r.scrapeHome === 1, 'a scrape on the run home is river:scraped, once however many');
    ok(r.scrapeEarly === 0 && r.scrapeBot === 0, 'a scrape on an earlier leg, or a bot\'s, is nothing');
    ok(r.realScrape === 1, `driven onto the bank on the run home, the real collision reports it (${r.realScrape})`);
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
