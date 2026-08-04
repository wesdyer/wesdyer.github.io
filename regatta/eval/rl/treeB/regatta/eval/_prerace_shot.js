// The race-day board (design 2a): does it fit without scrolling, and does the header chip
// open the character picker?
const { chromium } = require('playwright');
const path = require('path');
const VENUE = process.env.VENUE || 'lagoon';
const OUT = process.env.OUT || '/private/tmp/claude-501/-Users-wesdyer-Documents-GitHub-wesdyer-github-io/d2838aad-e4a1-4bb9-9da9-9e523f267081/scratchpad';
(async () => {
  const b = await chromium.launch();
  for (const [W, H] of [[1500, 950], [1920, 1080], [1280, 800]]) {
    const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.VENUE_DOC);
    await p.evaluate((v) => {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: 'Muninn' }));
      localStorage.setItem('regatta_bests', JSON.stringify({ 'lagoon:4': { t: 252.1, pos: 2 } }));
      resetGame();
      selectCompetitor(state.boats[3].name);
    }, VENUE);
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/prerace_${VENUE}_${W}.png` });
    const info = await p.evaluate((v) => {
      const ov = document.getElementById('pre-race-overlay');
      const art = document.getElementById('venue-art').getBoundingClientRect();
      const scrollers = [...ov.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflowY !== 'visible');
      return {
        overlayScrolls: ov.scrollHeight > ov.clientHeight + 2,
        docScrolls: document.documentElement.scrollHeight > window.innerHeight + 2,
        innerScrollers: scrollers.map(e => (e.id || e.className) + ` ${e.scrollHeight}>${e.clientHeight}`),
        fleetItems: document.getElementById('pr-competitors-grid').children.length,
        fleetBoats: document.querySelectorAll('#pr-competitors-grid canvas.profile-boat-canvas').length,
        notesOpen: document.querySelectorAll('.pr-fleet-notes').length,
        artSquare: Math.abs(art.width - art.height) < 2 ? `${Math.round(art.width)}px square` : `NOT SQUARE ${Math.round(art.width)}x${Math.round(art.height)}`,
        myBadge: document.querySelector('#pr-competitors-grid [data-name="__player__"]').innerText.split('\n'),
        venueTiles: document.getElementById('venue-picker').children.length,
        fleetCells: document.getElementById('pr-competitors-grid').children.length,
        brief: document.getElementById('pr-brief').innerText.split('\n'),
        best: document.getElementById('venue-detail').innerText.includes('2ND'),
        blurbVisible: document.querySelector('.pr-blurb').clientHeight > 10,
        venueLabels: [...document.querySelectorAll('.pr-venue-name')].map(e => e.scrollHeight <= e.clientHeight + 1 ? 'ok' : 'clipped'),
        tileSize: Math.round(document.querySelector('.pr-venue-shot').getBoundingClientRect().width),
        heroBottom: Math.round(document.getElementById('venue-picker').getBoundingClientRect().bottom),
        footerBottom: Math.round(document.querySelector('#start-race-btn').getBoundingClientRect().bottom),
      };
    }, VENUE);
    // The chip is the way to the character picker.
    await p.click('#pr-competitors-grid [data-name="__player__"] button');
    await p.waitForTimeout(700);
    const picker = await p.evaluate(() => !document.getElementById('character-picker').classList.contains('hidden'));
    console.log(`${W}x${H}`, JSON.stringify({ ...info, pickerOpensFromBadge: picker }, null, 1));
    if (errs.length) console.log('ERRORS:', errs.slice(0, 4));
    await p.close();
  }
  await b.close();
})();
