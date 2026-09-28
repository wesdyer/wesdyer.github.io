// RACE / TIME TRIALS (Wes, Sep 27 2026) and the SERIES achievements. Headless, real page.
//
//   node regatta/eval/test_race_modes.js     (from the repo root)
//
// Time Trials is solo: the door sends the fleet home, a solo race is never a win, counts only for the venue rungs
// about the course (Unlocks.soloCounts), and leaves a ghost of the best run that the next trial loads. The Race door
// is a series of 1..12: one race has no pennant and no series summary; four or more fly the biggest pennant tier
// they reach. Then the ten Series rows against hand-built series tables.
const { chromium } = require('playwright');
const path = require('path');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && typeof resetGame === 'function');
    const r = await p.evaluate(() => {
        const out = {};
        localStorage.removeItem('regatta_ghosts'); localStorage.removeItem('regatta_unlocks'); localStorage.removeItem('regatta_career');
        // ── TIME TRIALS ──
        document.getElementById('door-race').click();
        out.ttBoats = state.boats.length; out.solo = TimeTrial.solo();
        startRace(); const me = state.boats[0], ctl = new BotController(me); let t = 0;
        while (t < 700 && !me.raceState.finished) { ctl.update(1 / 30); const dd = normalizeAngle(ctl.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(1 / 30); t += 1 / 30; }
        state.keys.ArrowLeft = state.keys.ArrowRight = false; update(1 / 30);
        const f = Unlocks.raceFacts([me]); out.soloFacts = { solo: f.solo, won: f.won, stars: f.stars, pos: f.pos };
        const g = TimeTrial.ghostFor(); out.ghostSaved = !!(g && Math.abs(g.t - me.raceState.finishTime) < 1e-6 && g.s.length > 100);
        out.ghostMeta = !!(g && g.char === me.name && g.colors && g.colors.hull === me.colors.hull && g.s[10] && g.s[10].length === 17);
        resetGame(); out.ghostLoaded = TimeTrial.ghostTime() === g.t; out.pose = !!TimeTrial.poseAt(10);
        // picking another venue on the board (a light build, no resetGame) must not carry this venue's ghost over
        const home = settings.venue; selectVenue(home === 'volcanic' ? 'bay' : 'volcanic'); loadVenueWorld({ light: true });
        out.otherVenueGhost = TimeTrial.ghostTime(); selectVenue(home); loadVenueWorld(); resetGame();
        // the ghost on the leaderboard (a row with progress and a leg) and its splits for the leg chips
        startRace(); while (state.race.status === 'prestart') update(1 / 30); for (let i = 0; i < 30 * 20; i++) update(1 / 30);
        const le = TimeTrial.leaderEntry(); updateLeaderboard();
        out.lb = !!(le && le.isGhost && le.raceState.leg >= 1 && le.ghostProgress > 0 && UI.boatRows.ghost);
        const sp = TimeTrial.ghostSplits(); out.splits = !!(sp && sp.legs.length === state.race.totalLegs && sp.start != null);
        // GHOST STORY: a run that beats a ghost you already had emits 'ghost:beaten'; five venues earn Phantom
        { const gb = []; GameEvents.on('player-feat', e => { if (e.id === 'ghost:beaten') gb.push(1); });
          const all = JSON.parse(localStorage.getItem('regatta_ghosts') || '{}'); all[TimeTrial._key()] = { t: 9999, t0: 0, s: [[0, 0, 0, 1, 0, 0, 1]] }; localStorage.setItem('regatta_ghosts', JSON.stringify(all));
          resetGame(); startRace(); const m2 = state.boats[0], c2 = new BotController(m2); let t2 = 0;
          while (t2 < 700 && !m2.raceState.finished) { c2.update(1 / 30); const dd = normalizeAngle(c2.targetHeading - m2.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(1 / 30); t2 += 1 / 30; }
          state.keys.ArrowLeft = state.keys.ArrowRight = false; update(1 / 30); out.ghostBeaten = gb.length; }
        window.__UNLOCKS = 'on'; localStorage.removeItem('regatta_career'); localStorage.removeItem('regatta_unlocks');
        { const me3 = state.boats[0]; const got = [];
          for (const v of ['bay', 'lake', 'lagoon', 'river', 'ocean']) { settings.venue = v; state.race.unlocks = { counted: false, feats: { 'ghost:beaten': true }, vals: {}, eligible: true };
            me3.raceState.finished = true; me3.raceState.resultStatus = null; got.push(...Unlocks._count([me3], state.race.unlocks)); }
          out.phantom = got.join(','); out.ghostVenues = (Unlocks.career().ghostVenues || []).length; }
        localStorage.removeItem('regatta_career'); localStorage.removeItem('regatta_unlocks'); settings.venue = 'bay';
        // solo gating: only the course rungs
        window.__UNLOCKS = 'on';
        const fake = { venue: 'arctic', solo: true, finished: true, won: false, pos: 1, penalties: 0, feats: ['arctic:face'], vals: {}, behind: [], legRanks: [], stars: 0 };
        const got = Unlocks._grantFrom(Unlocks.ACHIEVEMENTS.filter(a => ['Chime', 'Bluff', 'Scuttle', 'Splat', 'Ripple'].includes(a.char)), fake, Unlocks.career(), {});
        out.soloGot = got.join(',');
        out.soloRule = Unlocks.soloCounts({ rung: 'target', char: 'Pebble' }) && !Unlocks.soloCounts({ rung: 'mechanic', char: 'Sawbill' }) && !Unlocks.soloCounts({ family: 'start', char: 'Crush' });
        // ── THE RACE DOOR ──
        TimeTrial.active = false;
        Series.startSeries(['bay']); out.oneName = Series.active.name; out.oneSummary = Series.summary();
        out.tiers = [1, 3, 4, 5, 7, 8, 11, 12, 13].map(n => pennantTier(n)).join(',');
        resetGame(); out.raceBoats = state.boats.length; Series.abandon();
        // ── THE SERIES ROWS, against built tables ──
        const fleet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
        const mk = (n, places, extra) => {   // places: the player's place each race (null = DNF); the fleet fills the rest
            const venues = Series.pool().slice(0, n);
            const results = venues.map((v, i) => { const mine = places[i]; let pl = 0;
                const rot = fleet.slice(i % 9).concat(fleet.slice(0, i % 9));   // the fleet's order turns over race by race
                const order = mine == null ? [...rot, 'You'] : [...rot.slice(0, mine - 1), 'You', ...rot.slice(mine - 1)];
                const rows = order.map(nm => { const fin = !(nm === 'You' && mine == null); if (fin) pl++; return { name: nm, isPlayer: nm === 'You', pos: fin ? pl : null, pts: seriesPoints(pl, fin),
                    facts: nm === 'You' ? { clean: !(extra.dirty === i) } : null,
                    aggro: nm === 'You' ? { start: extra.start ? extra.start(i) : 3, margin: extra.margin != null ? extra.margin : 1, passed: extra.passed ? extra.passed(i) : [] } : null }; });
                return { venue: v, index: i, rows }; });
            Series.active = { kind: 'series', id: 's', name: 's', venues, index: n - 1, fleet: fleet.slice(), character: 'You', results };
            const S = Series.summary(); Series.active = null; return S;
        };
        const test = (ch, S, c) => Unlocks.ACHIEVEMENTS.find(a => a.char === ch).test({ series: S, venue: null, feats: [], vals: {} }, c || {});
        const wins = (n) => Array(n).fill(1);
        out.rows = Unlocks.ACHIEVEMENTS.filter(a => a.family === 'series').map(a => a.char).join(',');
        out.anchor = test('Anchor', mk(4, wins(4), {})) && !test('Anchor', mk(4, [9, 9, 9, 9], {})) && mk(3, wins(3), {}) === null;
        out.regal = test('Regal', mk(4, wins(4), {})) && !test('Regal', mk(4, wins(4), { dirty: 2 }));
        out.mistral = test('Mistral', null, { seriesDone: 10 }) && !test('Mistral', null, { seriesDone: 9 });
        // Flare: behind going into the last race, then won it overall — A wins three, you win the last and two more by points
        const fl = mk(4, [2, 2, 2, 1], {}); out.flareSetup = [fl.won, fl.trailing].join('/');
        out.flare = !test('Flare', mk(4, wins(4), {})) && test('Flare', fl) === (fl.won && fl.trailing) && test('Flare', { won: true, trailing: true, n: 4, races: [] });
        out.tempo = test('Tempo', mk(6, wins(6), { start: () => 0.8 })) && !test('Tempo', mk(4, wins(4), { start: () => 0.8 })) && !test('Tempo', mk(6, wins(6), { start: i => i === 3 ? 1.2 : 0.5 }));
        out.titan = test('Titan', mk(8, wins(8), { margin: 6 })) && !test('Titan', mk(8, wins(8), { margin: 4 })) && !test('Titan', mk(6, wins(6), { margin: 9 }));
        out.lance = test('Lance', mk(4, wins(4), { passed: i => fleet.slice(i * 3, i * 3 + 3) })) && !test('Lance', mk(4, wins(4), { passed: i => fleet.slice(0, 3) }));
        out.huddle = test('Huddle', mk(12, Array(12).fill(3), {})) && !test('Huddle', mk(12, [...Array(11).fill(1), 4], {})) && !test('Huddle', mk(10, Array(10).fill(1), {})) && test('Huddle', mk(13, Array(13).fill(2), {}));
        out.renew = test('Renew', mk(6, [1, 1, 1, 1, 1, null], {})) && test('Renew', mk(6, [1, 1, 1, 1, 1, 10], {})) && !test('Renew', mk(4, [1, 1, 1, null], {})) && !test('Renew', mk(6, wins(6), {}));
        out.crest = test('Crest', mk(12, wins(12), {})) && !test('Crest', mk(12, Array(12).fill(9), {})) && !test('Crest', mk(10, wins(10), {})) && test('Crest', mk(13, wins(13), {}));
        // seriesFinal: counts the series and grants
        localStorage.removeItem('regatta_unlocks'); localStorage.removeItem('regatta_career');
        out.final = Unlocks.seriesFinal(mk(12, wins(12), { start: () => 0.5, margin: 8, passed: () => fleet })).sort().join(',');
        out.done = Unlocks.career().seriesDone;
        out.finalNull = Unlocks.seriesFinal(null).length;
        window.__UNLOCKS = undefined;
        return out;
    });
    // A Race of one, through the screens: picker → board → results reads as a single race; Rematch keeps the fleet
    await p.evaluate(() => { localStorage.removeItem('regatta_unlocks'); ['regatta_bests', 'regatta_records', 'regatta_ghosts'].forEach(k => localStorage.removeItem(k)); const u = document.getElementById('unlock-screen'); if (u) u.classList.add('hidden'); resetGame(); showClubhouse(); });
    await p.click('#door-series'); await p.waitForTimeout(200);
    await p.click('#series-lengths .ch-len[data-n="1"]'); await p.waitForTimeout(200);
    const lbl = await p.evaluate(() => document.getElementById('series-start-label').textContent);
    await p.click('#series-start-btn'); await p.waitForTimeout(1200);
    const one = await p.evaluate(() => { startRace(); const fleet0 = Series.active.fleet || state.boats.filter(b => !b.isPlayer).map(b => b.name);
        while (state.race.status === 'prestart') update(1 / 30);
        state.boats.forEach((b, i) => { b.raceState.finished = true; b.raceState.finishTime = 200 + i * 3; b.raceState.resultStatus = null; });
        for (let i = 0; i < 10; i++) update(1 / 30);
        showResults && showResults(); styleResultsButtons();
        return { fleet0, boats: state.boats.length, restart: UI.resultsRestartButton.textContent.trim(), rematch: UI.resultsRematchButton.textContent.trim() }; });
    await p.evaluate(() => UI.resultsRematchButton.click()); await p.waitForTimeout(800);
    const again = await p.evaluate(() => ({ n: Series.active && Series.total(), fleet: state.boats.filter(b => !b.isPlayer).map(b => b.name), status: state.race.status }));
    const setNothing = await p.evaluate(() => ({ elig: recordsEligible(), bests: Object.values(JSON.parse(localStorage.getItem('regatta_bests') || '{}')).some(b => b.t != null), recs: Object.keys(JSON.parse(localStorage.getItem('regatta_records') || '{}')).filter(k => k !== '__distV2').length, ghosts: localStorage.getItem('regatta_ghosts') }));
    ok(!setNothing.elig && !setNothing.bests && setNothing.recs === 0 && !setNothing.ghosts, `a Race sets no best time, no record and no ghost (its place and stars are kept) (${JSON.stringify(setNothing)})`);
    ok(lbl === 'Sail this race' && one.boats === 10 && one.restart === 'Back to Clubhouse' && /Rematch/.test(one.rematch), `a Race of one reads as one race: '${lbl}', ${one.restart} / ${one.rematch}`);
    ok(again.n === 1 && JSON.stringify(again.fleet) === JSON.stringify(one.fleet0), `Rematch: a new Race of one with the same fleet (${again.n}, ${again.status})`);
    // A NEW GAME forgets the ghosts
    const ng = await p.evaluate(() => { localStorage.setItem('regatta_ghosts', '{"bay:x:6":{"t":1}}'); TimeTrial._ghost = { t: 1, s: [] }; const had = !!localStorage.getItem('regatta_ghosts'); try { startNewGame(); } catch (e) { return { err: e.message }; }
        return { had, gone: !localStorage.getItem('regatta_ghosts') && TimeTrial._ghost === null }; });
    ok(ng.had && ng.gone, `a new game forgets the ghosts (${JSON.stringify(ng)})`);
    ok(r.ttBoats === 1 && r.solo, `Time Trials sends the fleet home (${r.ttBoats} boat)`);
    ok(r.soloFacts.solo && !r.soloFacts.won && r.soloFacts.stars === 0, `a solo race is no win and no stars (${JSON.stringify(r.soloFacts)})`);
    ok(r.ghostSaved && r.ghostLoaded && r.pose, 'the finished run is saved as the ghost and the next trial loads it');
    ok(r.otherVenueGhost === null, `a venue picked on the board has no ghost of the last one (${r.otherVenueGhost})`);
    ok(r.ghostMeta, 'the ghost keeps its character, livery and sail trim');
    ok(r.lb && r.splits, 'the ghost has a leaderboard row (leg, progress) and its splits for the leg chips');
    ok(r.ghostBeaten === 1, `beating a ghost you already had is 'ghost:beaten' (${r.ghostBeaten})`);
    ok(r.phantom.split(',').includes('Phantom') && r.ghostVenues === 5, `Ghost Story: ghosts beaten at five venues earn Phantom, in solo (${r.phantom}; ${r.ghostVenues})`);
    ok(r.soloGot === 'Chime' && r.soloRule, `solo counts only for the course rungs: the Calving Face yes, Bluff/Scuttle/Splat/Ripple no (${r.soloGot})`);
    ok(r.oneName === 'Race' && r.oneSummary === null && r.raceBoats === 10, `a Race of one: named 'Race', no series summary, a full fleet (${r.raceBoats})`);
    ok(r.tiers === '0,0,4,4,6,8,10,12,12', `pennant tiers (${r.tiers})`);
    ok(r.rows === 'Anchor,Regal,Mistral,Flare,Tempo,Titan,Lance,Huddle,Renew,Crest', `the ten Series rows (${r.rows})`);
    ok(r.anchor, 'Champion: a won series of 4+; a 3-race Race is not a series');
    ok(r.regal, 'White Gloves: won with every race clean');
    ok(r.mistral, 'The Season: 10 series');
    ok(r.flare, `Grudge Match: behind before the last race and won; never when you led all the way (${r.flareSetup})`);
    ok(r.tempo, 'Metronome: every start ≤ 1.0 s, six races or more');
    ok(r.titan, 'By Daylight: every race won by 5 s+, eight races or more');
    ok(r.lance, 'Through the Fleet: won, every rival passed at least once');
    ok(r.huddle, 'Unbroken: top three in all twelve of a 12-race series');
    ok(r.renew, 'Start Over: won a 6+ series with a last place or a DNF');
    ok(r.crest, 'Six Months at Sea: won a 12-race series');
    ok(r.final === 'Anchor,Crest,Huddle,Lance,Regal,Tempo,Titan' && r.done === 1 && r.finalNull === 0, `seriesFinal grants and counts the series (${r.final}; ${r.done})`);
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
