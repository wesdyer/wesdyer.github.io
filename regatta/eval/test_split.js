// KNOT'S "DEAD RECKONING" (Sep 27 2026) — 'split:leg': a leg of 20 s+ with 60%+ of it on the other side of the leg's
// rhumb line from the fleet (the rivals' median), 150 u+ apart. RAZOR'S "AMBUSH" — three counted passes within
// 20 s, after the first 60 s. Headless, real page, the boats placed by hand.
//   node regatta/eval/test_split.js     (from the repo root)
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
        const out = {}, feats = []; GameEvents.on('player-feat', e => feats.push(e.id + (e.value !== undefined ? '=' + e.value : '')));
        selectVenue('bay'); loadVenueWorld(); resetGame(); startRace(); state.race.status = 'racing';
        const me = state.boats[0], bots = state.boats.slice(1);
        const a = legTargetPoint(0), c = legTargetPoint(1), dx = c.x - a.x, dy = c.y - a.y, len = Math.hypot(dx, dy), nx = dy / len, ny = -dx / len;
        const at = (bt, f, side) => { bt.x = a.x + dx * f + nx * side; bt.y = a.y + dy * f + ny * side; };
        const run = (secs, meSide) => { for (let i = 0; i < secs * 30; i++) { const f = 0.2 + 0.5 * i / (secs * 30); at(me, f, meSide); bots.forEach((bt, k) => at(bt, f, 300 + k * 10)); checkSplit(1 / 30); } };
        for (const bt of state.boats) { bt.raceState.leg = 1; bt.raceState.finished = false; }
        // leg 1: 25 s on the fleet's side → nothing when the leg ends
        run(25, 250); for (const bt of state.boats) bt.raceState.leg = 2; checkSplit(1 / 30);
        out.same = feats.filter(f => /^split/.test(f)).length;
        // leg 2: 25 s on the far side
        const a2 = legTargetPoint(1), c2 = legTargetPoint(2);
        const dx2 = c2.x - a2.x, dy2 = c2.y - a2.y, l2 = Math.hypot(dx2, dy2), n2x = dy2 / l2, n2y = -dx2 / l2;
        for (let i = 0; i < 25 * 30; i++) { const f = 0.2 + 0.5 * i / 750; me.x = a2.x + dx2 * f - n2x * 250; me.y = a2.y + dy2 * f - n2y * 250; bots.forEach((bt, k) => { bt.x = a2.x + dx2 * f + n2x * (300 + k * 10); bt.y = a2.y + dy2 * f + n2y * (300 + k * 10); }); checkSplit(1 / 30); }
        for (const bt of state.boats) bt.raceState.leg = 3; checkSplit(1 / 30);
        out.split = feats.filter(f => /^split/.test(f)).join(',');
        return out;
    });
    ok(r.same === 0, `a leg sailed with the fleet is not a split (${r.same})`);
    ok(r.split === 'split:leg=2', `a leg sailed apart from the fleet is 'split:leg' (${r.split})`);
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
