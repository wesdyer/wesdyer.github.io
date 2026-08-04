// Picking a new character does NOT rebuild the fleet — boat 0 is renamed in place — so
// anything that cached the old identity keeps showing it. This checks the leaderboard row
// follows the change, both for the player and for an opponent swapped out by a colour clash.
//
//   node regatta/eval/_facechange.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VENUE_DOC);

  const out = await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lagoon', character: 'Muninn', musicEnabled: false, soundEnabled: false }));
    resetGame(); startRace();
    // Past the 30s prestart — updateLeaderboard hides the panel and builds no rows until
    // the race is actually running.
    for (let i = 0; i < 2400; i++) { update(1 / 30); if (i % 10 === 0) updateLeaderboard(); }

    const read = () => [...document.querySelectorAll('#lb-rows .lb-row')].map(r => ({
      name: r.querySelector('.lb-name').textContent,
      face: (r.querySelector('.lb-face').getAttribute('src') || '').split('/').pop(),
      me: r.classList.contains('lb-me'),
      ring: r.style.boxShadow,
      nameColor: r.querySelector('.lb-name').style.color,
    }));
    const before = read();
    // The picker's own path, not a hand-rolled one.
    pickCharacter('Torch');
    updateLeaderboard();
    const after = read();

    const mine = (rows) => rows.find(r => r.me) || {};
    return {
      wasPlayer: mine(before), nowPlayer: mine(after),
      stale: after.filter(r => r.face !== r.name.toLowerCase() + '.png')
                  .map(r => `${r.name} shows ${r.face}`),
      ringedRows: after.filter(r => r.ring).length,
      anyBorder: [...document.querySelectorAll('#lb-rows .lb-face')]
        .filter(i => getComputedStyle(i).borderTopWidth !== '0px' || getComputedStyle(i).backgroundColor !== 'rgba(0, 0, 0, 0)').length,
    };
  });
  console.log('player row before pick:', JSON.stringify(out.wasPlayer));
  console.log('player row after  pick:', JSON.stringify(out.nowPlayer));
  console.log('rows whose face does not match their name:', out.stale.length ? out.stale : 'none');
  console.log('ringed rows:', out.ringedRows, '| faces still carrying a ring or fill:', out.anyBorder);
  console.log(errs.length ? 'ERRORS ' + errs.slice(0, 3) : 'no page errors');
  await b.close();
})();
