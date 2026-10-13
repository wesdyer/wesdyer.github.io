// THE UNLOCK CEREMONY (PT-012): every card earned by one race comes in ONE pile — a criterion decided
// late (Dart's Beeline waits for the fleet to come home) joins the pile that is up instead of opening a
// second one after it closes — and no card shows an empty band where its portrait goes.
//   node regatta/eval/test_unlock_cards.js
const { chromium } = require('playwright'); const path = require('path');
let failures = 0;
const ok = (n, c, d) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${n}${d ? '   ' + d : ''}`); if (!c) failures++; };
(async () => {
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => localStorage.setItem('regatta_progress', JSON.stringify({ graduated: true })));
    await p.goto('file://' + path.resolve(__dirname, '../index.html') + '?unlocks=on'); await p.waitForTimeout(1500);
    const grant = (names) => p.evaluate((names) => { const s = Unlocks.store(); for (const n of names) if (!s.unseen.includes(n)) s.unseen.push(n); Unlocks._write('regatta_unlocks', s); }, names);
    const view = () => p.evaluate(() => ({ open: unlockCeremonyOpen(), count: document.getElementById('unlock-count').textContent,
        btn: document.querySelector('#unlock-next span').textContent, name: (document.querySelector('#unlock-body .t-display') || {}).textContent,
        hidden: document.getElementById('unlock-screen').classList.contains('hidden') }));

    await grant(['Roll', 'Wick', 'Sovereign']);
    await p.evaluate(() => presentUnlocks());
    const a = await view();
    ok('a race\'s unlocks open one pile', a.open && !a.hidden && a.count === '1 of 3', JSON.stringify(a));
    await p.evaluate(() => advanceUnlockCard(false)); await p.evaluate(() => advanceUnlockCard(false));
    const c = await view();
    ok('...the last card says CONTINUE', /CONTINUE/.test(c.btn) && c.count === '3 of 3', JSON.stringify(c));

    // Dart is decided now, with the pile still up: the results page polls and presents again
    await grant(['Dart']);
    await p.evaluate(() => presentUnlocks());
    const d = await view();
    ok('a late unlock joins the pile that is up', d.open && d.count === '3 of 4' && /NEXT/.test(d.btn), JSON.stringify(d));
    await p.evaluate(() => advanceUnlockCard(false));
    const e = await view();
    ok('...and is its last card', e.name && /DART/i.test(e.name) && e.count === '4 of 4' && /CONTINUE/.test(e.btn), JSON.stringify(e));
    await p.evaluate(() => presentUnlocks());
    ok('presenting again adds no duplicate', (await view()).count === '4 of 4');
    const pic = await p.evaluate(async () => { const im = document.querySelector('#unlock-body .unlock-portrait'); if (!im.complete) await new Promise(r => im.addEventListener('load', r, { once: true })); return { w: im.naturalWidth, op: getComputedStyle(im).opacity }; });
    ok('the portrait is there', pic.w > 0 && +pic.op > 0.5, JSON.stringify(pic));
    await p.evaluate(() => advanceUnlockCard(false));
    const f = await view();
    ok('CONTINUE closes it, all four seen', !f.open && f.hidden && (await p.evaluate(() => Unlocks.unseen().length)) === 0);
    ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    await b.close();
    console.log(failures ? `FAIL — ${failures} failure(s)` : 'PASS — 0 failure(s)');
    process.exit(failures ? 1 : 0);
})();
