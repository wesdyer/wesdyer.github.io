// THE SHARK PACK (Sep 27 2026) — the ladder Bruce → Blaze → Stripes → Bruiser → Anvil → Lash → Nib → Goblin → Relic →
// Dapple, and the feat sharks Dozer, Woebegone, Razor. Headless, real page.
//
//   node regatta/eval/test_sharks.js     (from the repo root)
//
// Checks: the rows and their order; the head-to-head record kept by Unlocks._count (a streak counts only races the
// rival was in, breaks on a loss, the clean and per-venue streaks); the hunted shark gets a fleet slot; the
// mark feats fire for a rival ahead at a mark; every row against race facts; Dapple arriving with the last shark.
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
        const out = {}, A = Unlocks.ACHIEVEMENTS.filter(a => a.family === 'sharks');
        out.rows = A.map(a => a.char).join(',');
        out.prey = A.filter(a => a.prey).map(a => a.prey + '>' + a.char).join(' ');
        window.__UNLOCKS = 'on';
        localStorage.removeItem('regatta_unlocks'); localStorage.removeItem('regatta_career');
        // THE HUNT: nothing earned → Bruce is hunted (for Blaze); with Blaze earned → Blaze (for Stripes)
        out.hunt0 = Unlocks.huntTarget();
        Unlocks.grant(['Blaze'], 'bay'); out.hunt1 = Unlocks.huntTarget();
        const pool = AI_CONFIG.filter(c => c.name !== settings.character);
        out.slot = Unlocks.rivalsFor(pool).map(c => c.name).includes('Blaze');
        localStorage.removeItem('regatta_unlocks');
        // THE HEAD-TO-HEAD through the real counter: a race where the rival sits out neither counts nor breaks
        selectVenue('bay'); resetGame(); startRace();
        const me = state.boats[0], bots = state.boats.slice(1), R = bots[0];
        const race = (ahead, include, pen, venue) => {   // ahead: player ahead of R?
            if (venue) settings.venue = venue;
            const fleet = include ? [me, ...bots] : [me, ...bots.slice(1)];
            const order = ahead ? fleet : [R, me, ...bots.slice(1)].filter(x => include || x !== R);
            order.forEach((x, i) => { x.raceState.finished = true; x.raceState.finishTime = 200 + i; x.raceState.resultStatus = null; });
            me.raceState.totalPenalties = pen || 0;
            state.race.unlocks = { counted: false, feats: {}, vals: {}, eligible: true };
            Unlocks._count(order, state.race.unlocks); return Unlocks.career().h2h[R.name] || {}; };
        const seq = [race(true, true), race(true, false), race(true, true), race(false, true), race(true, true, 1), race(true, true)];
        out.streaks = seq.map(e => e.streak).join(','); out.cleans = seq.map(e => e.clean).join(',');
        race(true, true, 0, 'arctic'); out.arctic = (Unlocks.career().h2h[R.name].vs || {}).arctic; out.venues = Unlocks.career().h2h[R.name].venues.sort().join(',');
        settings.venue = 'bay';
        // THE MARK FEATS: rival ahead when the player rounds mark 1
        selectVenue('bay'); resetGame(); startRace(); const feats = []; GameEvents.on('player-feat', (e) => { if (/^mark1?:behind:/.test(e.id)) feats.push(e.id); });
        const me2 = state.boats[0], o = state.boats[1];
        state.race.status = 'racing'; me2.raceState.leg = 1; for (const x of state.boats.slice(1)) { x.raceState.leg = 1; x.raceState.nextWaypoint.dist = 9000; }
        o.raceState.leg = 2; o.raceState.nextWaypoint.dist = 500; checkAggression(1 / 30);
        me2.raceState.leg = 2; me2.raceState.nextWaypoint.dist = 900; checkAggression(1 / 30);
        out.markFeats = feats.filter(f => f.endsWith(':' + o.name)).sort().join(',');
        out.markOthers = feats.filter(f => !f.endsWith(':' + o.name)).length;
        // THE ROWS against facts
        const base = { finished: true, won: false, pos: 5, fleet: 10, penalties: 0, feats: [], vals: {}, behind: [], rivals: [], legRanks: [], startRank: 5, venue: 'bay' };
        const T = (ch, o, c) => Unlocks.ACHIEVEMENTS.find(a => a.char === ch).test(Object.assign({}, base, o), c || {});
        const h = (n, e) => ({ h2h: { [n]: Object.assign({ streak: 0, clean: 0, venues: [], vs: {} }, e) } });
        out.blaze = T('Blaze', {}, h('Bruce', { streak: 3 })) && !T('Blaze', {}, h('Bruce', { streak: 2 }));
        out.stripes = T('Stripes', {}, h('Blaze', { streak: 3 })) && !T('Stripes', {}, h('Blaze', { streak: 2 }));
        out.bruiser = T('Bruiser', {}, h('Stripes', { venues: ['lake', 'river', 'redrock', 'bay'] })) && !T('Bruiser', {}, h('Stripes', { venues: ['lake', 'river'] }));
        out.anvil = T('Anvil', {}, h('Bruiser', { streak: 5, clean: 3 })) && !T('Anvil', {}, h('Bruiser', { streak: 5, clean: 2 }));
        out.lash = T('Lash', { rivals: ['Anvil'], feats: ['mark1:behind:Anvil'], behind: ['Anvil'] }) && !T('Lash', { rivals: ['Anvil'], behind: ['Anvil'] }) && !T('Lash', { rivals: ['Anvil'], feats: ['mark1:behind:Anvil'], behind: [] });
        out.nib = T('Nib', { venue: 'lagoon', rivals: ['Lash'], behind: ['Lash'] }) && !T('Nib', { venue: 'lagoon', rivals: ['Lash'], behind: ['Lash'], feats: ['mark:behind:Lash'] }) && !T('Nib', { venue: 'bay', rivals: ['Lash'], behind: ['Lash'] });
        out.goblin = T('Goblin', { venue: 'glowtide', rivals: ['Nib'], behind: ['Nib'] }) && !T('Goblin', { venue: 'bay', rivals: ['Nib'], behind: ['Nib'] });
        out.relic = T('Relic', { venue: 'arctic' }, h('Goblin', { vs: { arctic: 2 } })) && !T('Relic', { venue: 'arctic' }, h('Goblin', { vs: { arctic: 1 } }));
        out.dozer = T('Dozer', { pos: 3, startRank: 10 }) && !T('Dozer', { pos: 4, startRank: 10 }) && !T('Dozer', { pos: 2, startRank: 9 });
        out.woebegone = T('Woebegone', { pos: 2, legRanks: [8, 10, 6, 2] }) && !T('Woebegone', { pos: 2, legRanks: [10, 9, 6, 2] }) && !T('Woebegone', { pos: 4, legRanks: [8, 10, 6, 4] });
        out.razor = T('Razor', { rivals: ['Bruce', 'Blaze', 'Nib', 'Cheer'], behind: ['Bruce', 'Blaze', 'Nib'] }) && !T('Razor', { rivals: ['Bruce', 'Blaze', 'Cheer'], behind: ['Bruce', 'Blaze'] }) && !T('Razor', { rivals: ['Bruce', 'Blaze', 'Nib'], behind: ['Bruce', 'Blaze'] });
        // DAPPLE: every other shark; arriving in the same race as the last one
        localStorage.removeItem('regatta_unlocks');
        const others = A.map(a => a.char).filter(n => n !== 'Dapple' && n !== 'Relic').concat(['Roam', 'Mitt']);
        Unlocks.grant(others, 'bay');
        const dap = Unlocks.ACHIEVEMENTS.find(a => a.char === 'Dapple');
        out.dappleBefore = dap.test({ feats: [] }, {});
        const got = Unlocks._grantFrom([Unlocks.ACHIEVEMENTS.find(a => a.char === 'Relic'), dap], Object.assign({}, base, { venue: 'arctic' }), h('Goblin', { vs: { arctic: 2 } }), {});
        out.dappleWith = got.join(',');
        out.dappleHint = Unlocks.hintOf(dap);
        window.__UNLOCKS = undefined; localStorage.removeItem('regatta_unlocks'); localStorage.removeItem('regatta_career');
        return out;
    });
    ok(r.rows === 'Blaze,Stripes,Bruiser,Anvil,Lash,Nib,Goblin,Relic,Dapple,Dozer,Woebegone,Razor', `the shark rows (${r.rows})`);
    ok(r.prey === 'Bruce>Blaze Blaze>Stripes Stripes>Bruiser Bruiser>Anvil Anvil>Lash Lash>Nib Nib>Goblin Goblin>Relic', `the ladder (${r.prey})`);
    ok(r.hunt0 === 'Bruce' && r.hunt1 === 'Blaze' && r.slot, `the hunted shark: ${r.hunt0}, then ${r.hunt1}, with a fleet slot`);
    ok(r.streaks === '1,1,2,0,1,2', `head to head: sat out neither counts nor breaks, a loss resets (${r.streaks})`);
    ok(r.cleans === '1,1,2,0,0,1', `the clean streak breaks on a penalty (${r.cleans})`);
    ok(r.arctic === 1 && /arctic/.test(r.venues), `the per-venue streak and the venues beaten at (${r.arctic}; ${r.venues})`);
    ok(/^mark1:behind:\w+,mark:behind:\w+$/.test(r.markFeats), `rival ahead at mark 1: ${r.markFeats}`);
    ok(r.markOthers === 0, `rivals behind at the mark are not named (${r.markOthers})`);
    for (const k of ['blaze', 'stripes', 'bruiser', 'anvil', 'lash', 'nib', 'goblin', 'relic', 'dozer', 'woebegone', 'razor']) ok(r[k], `${k}: the row reads its rule`);
    ok(r.dappleBefore === false && r.dappleWith === 'Relic,Dapple', `Dapple arrives with the last shark (${r.dappleWith})`);
    ok(/every other shark/.test(r.dappleHint), `Dapple's hint (${r.dappleHint})`);
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
