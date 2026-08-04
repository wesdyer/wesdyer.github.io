// The race-day board's header row: two venue chips on the left, the personal-best pill on
// the right, all of them nowrap. It has to fit — or wrap cleanly — in a venue column that is
// only 386px at 1280, and the board is a screen where NOTHING SCROLLS.
//
// Checked with a best on record (the pill is at its widest) and on the longest venue name.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  let bad = 0;
  for (const W of [1280, 1400, 1500, 1680]) {
    const p = await b.newPage({ viewport: { width: W, height: Math.round(W * 0.625) } });
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.VENUE_DOC);
    for (const venue of ['lagoon', 'ocean']) {     // short name, and the longest one
      const r = await p.evaluate((venue) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue, character: 'Muninn', musicEnabled: false, soundEnabled: false }));
        localStorage.setItem('regatta_bests', JSON.stringify({ [`${venue}:4`]: { t: 243.099, bestPos: 2, bestPosT: 288.02 } }));
        resetGame();
        const row = document.querySelector('#venue-detail > div');
        const rowBox = row.getBoundingClientRect();
        // How far any chip sticks out past the column on either side.
        const over = [...row.children].flatMap(k => [...k.children]).reduce((m, c) => {
          const r = c.getBoundingClientRect();
          return Math.max(m, Math.round(r.right - rowBox.right), Math.round(rowBox.left - r.left));
        }, 0);
        const detail = document.getElementById('venue-detail');
        const overlay = document.getElementById('pre-race-overlay');
        return {
          rowW: Math.round(rowBox.width), rowH: Math.round(rowBox.height), over,
          detailScrolls: detail.scrollHeight - detail.clientHeight,
          pageScrolls: overlay.scrollHeight - overlay.clientHeight,
          pill: row.innerText.replace(/\n/g, ' ').trim(),
        };
      }, venue);
      const ok = r.over <= 0 && r.detailScrolls <= 0 && r.pageScrolls <= 0;
      if (!ok) bad++;
      console.log(`${ok ? 'ok  ' : 'BAD '} ${W} ${venue.padEnd(8)} row=${r.rowW}x${r.rowH} overflow=${r.over}px`
                + ` detailScroll=${r.detailScrolls} pageScroll=${r.pageScrolls}  ${r.pill}`);
    }
    await p.close();
  }
  console.log(bad ? `\n${bad} FAILED` : '\nall fit');
  await b.close();
})();
