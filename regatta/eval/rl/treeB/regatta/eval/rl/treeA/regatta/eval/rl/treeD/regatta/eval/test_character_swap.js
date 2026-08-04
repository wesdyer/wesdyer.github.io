// Picking a character who is CURRENTLY RACING must (a) make you them, (b) put a fresh
// character in their boat, and (c) show all of that on screen. (c) is the one that broke.
const { chromium } = require('playwright'); const path=require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof openCharacterPicker === 'function');
  await p.evaluate(() => setupPreRaceOverlay());
  await p.waitForTimeout(500);

  const gridNames = () => p.evaluate(() =>
    [...document.getElementById('pr-competitors-grid').children]
      .map(c => c.dataset.name === '__player__'
        ? 'YOU:' + c.querySelector('.t-display').textContent.trim()
        : c.dataset.name));

  const before = await gridNames();
  // Pick an opponent that is on screen in the fleet.
  const target = before.find(n => !n.startsWith('YOU:'));

  await p.evaluate(() => openCharacterPicker());
  await p.waitForTimeout(600);
  await p.click(`#character-grid [data-char="${target}"]`);   // a REAL click
  await p.waitForTimeout(500);

  const after = await gridNames();
  const bare = after.map(n => n.replace(/^YOU:/, ''));
  const dupes = bare.filter((n,i) => bare.indexOf(n) !== i);
  const fresh = bare.filter(n => !before.map(x=>x.replace(/^YOU:/,'')).includes(n));
  const state = await p.evaluate(() => ({ me: settings.character, boats: window.state.boats.map(x=>x.name) }));

  let bad = 0;
  const ok = (m,c)=>{ if(!c) bad++; console.log(`  ${c?'ok   ':'FAIL '} ${m}`); };
  console.log('picking a racing character swaps them out of the fleet\n');
  console.log('  target:', target);
  console.log('  before:', before.join(', '));
  console.log('  after :', after.join(', '));
  ok('the player became the picked character', state.me === target && state.boats[0] === target);
  ok('the player CARD shows them', after[0] === 'YOU:' + target);
  ok('they are no longer in the fleet', !after.slice(1).includes(target));
  ok('a fresh character took the empty boat', fresh.length === 1);
  ok('no duplicates on screen', dupes.length === 0);
  ok('fleet is still 10', after.length === 10);
  ok('picker closed', await p.evaluate(() => document.getElementById('character-picker').classList.contains('hidden')));
  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs.slice(0,3));
  console.log(`\n${bad ? 'FAIL' : 'PASS'} — ${bad} failure(s)`);
  await b.close();
  process.exitCode = bad ? 1 : 0;
})();
