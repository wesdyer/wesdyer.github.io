// DUCKLING POND — the Sailing School's animals (js/wildlife.js) and the turtle feat.
//
//   node regatta/eval/test_pond.js     (from the repo root, like every suite)
//
// Checks: five turtles line up on the drift log Wes placed; a classmate sends them into the
// water but earns nothing; the player does, in a lesson (not a race); two grebes swim and
// dive; nothing draws from Math.random.
const { chromium } = require('playwright');
const path = require('path');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

(async () => {
    const b = await chromium.launch();
    const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && window.School);
    const r = await p.evaluate(async () => {
        localStorage.setItem('regatta_settings', JSON.stringify({ soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        School.start(2);
        await new Promise(res => setTimeout(res, 500));
        const out = { venue: state.course.venueKey };
        const feats = [];
        GameEvents.on('player-feat', (e) => feats.push(e.id));
        const d = Wildlife.debug();
        const bk = d.baskers[0];
        out.turtles = bk ? bk.turtles.length : 0;
        out.logKind = bk && bk.log.kind;
        out.onLog = !!bk && bk.turtles.every(t => Math.hypot(t.hx - bk.log.x, t.hy - bk.log.y) < 70);
        out.divers = d.divers.length ? d.divers[0].birds.length : 0;

        const real = Math.random; let calls = 0; Math.random = () => { calls++; return real(); };
        for (let i = 0; i < 600; i++) Wildlife.update(1 / 30);
        Math.random = real;
        out.randomCalls = calls;

        const me = state.boats[0], mate = state.boats.find(x => !x.isPlayer);
        if (mate) {
            mate.x = bk.log.x + 60; mate.y = bk.log.y + 40;
            for (let i = 0; i < 40; i++) Wildlife.update(1 / 30);
            out.mateSlid = bk.turtles.some(t => t.mode !== 'bask');
            out.featAfterMate = feats.includes('pond:turtles');
            mate.x = 1e5; mate.y = 1e5;
        } else { out.mateSlid = true; out.featAfterMate = false; }
        me.x = bk.log.x + 60; me.y = bk.log.y + 40;
        for (let i = 0; i < 5; i++) Wildlife.update(1 / 30);
        out.featPlayer = feats.includes('pond:turtles');
        out.schoolFeat = Unlocks._schoolFeats.has('pond:turtles');
        return out;
    });
    ok(r.venue === 'pond', 'section 2 sails the pond');
    ok(r.turtles === 6 && r.onLog, `six turtles in single file on the ${r.logKind}`);
    ok(r.divers === 2, 'two grebes');
    ok(r.randomCalls === 0, `wildlife never calls Math.random (${r.randomCalls})`);
    ok(r.mateSlid && !r.featAfterMate, 'a classmate sends them in, and earns nothing');
    ok(r.featPlayer && r.schoolFeat, 'the player does, in a lesson, and the school remembers it');
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
