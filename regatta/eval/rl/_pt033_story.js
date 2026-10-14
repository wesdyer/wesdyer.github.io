// PT-033: an unlock's story. Grants Razor ("pass three boats within 20 s and finish ahead of all three")
// from a race whose decisive feat fired on leg 2 at 2:12, and a results-only row from the same race;
// prints the stories and shoots the unlock card and the picker cell.   OUT=dir node eval/rl/_pt033_story.js
const { chromium } = require('playwright'); const path = require('path');
const OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html') + '?unlocks=on');
  await p.waitForFunction(() => window.state && window.Unlocks && typeof resetGame === 'function');
  const r = await p.evaluate(() => {
    localStorage.removeItem('regatta_unlocks'); settings.venue = 'seatrials';
    const names = AI_CONFIG.map(c => c.name).filter(n => !Unlocks.gated(n)).slice(0, 3);
    const rFacts = { venue: 'seatrials', finished: true, solo: false, won: false, pos: 2, fleet: 10, time: 201.43, behind: names.concat(['x']),
      feats: ['pass:ambush', 'start:first'], vals: { 'pass:ambush': names.join('|') },
      featAt: { 'pass:ambush': { t: 132.4, leg: 2, v: names.join('|') }, 'start:first': { t: 0.5, leg: 0 } }, totalLegs: 4 };
    const st = Unlocks._stories(['Razor'], rFacts, Unlocks.career());
    Unlocks.grant(['Razor'], 'seatrials', st);
    return { story: st, line: Unlocks.storyLine('Razor'), passed: names };
  });
  console.log(JSON.stringify(r));
  await p.evaluate(() => presentUnlocks()); await p.waitForTimeout(1200);
  await (await p.$('#unlock-screen > div')).screenshot({ path: `${OUT}/pt033_card.png` }).catch(async () => p.screenshot({ path: `${OUT}/pt033_card.png` }));
  await p.evaluate(() => { advanceUnlockCard(false); openCharacterPicker(); }); await p.waitForTimeout(1200);
  const cell = await p.$('[data-char="Razor"]') || await p.$(`text=RAZOR`);
  if (cell) { await cell.scrollIntoViewIfNeeded(); await cell.screenshot({ path: `${OUT}/pt033_picker.png` }); }
  console.log('picker cell', !!cell, errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();
