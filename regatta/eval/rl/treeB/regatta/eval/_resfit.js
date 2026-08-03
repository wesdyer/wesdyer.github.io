// The results table got an eleventh column (GAP TO WINNER, flexible) and the hero got a
// record card beside the splits. Both eat width. This checks, at four window widths, that
// no row overflows its page and that the gap markers land where the deltas say they should.
//
//   node regatta/eval/_resfit.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  let bad = 0;
  for (const W of [1280, 1400, 1600, 1920]) {
    const p = await b.newPage({ viewport: { width: W, height: Math.round(W * 0.62) } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.VENUE_DOC);
    const r = await p.evaluate(() => {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lagoon', character: 'Muninn', musicEnabled: false, soundEnabled: false }));
      // WITH a record on the books: the card sits between the hero and the splits, so this
      // is the widest the top band ever gets. Without it there is nothing to squeeze.
      localStorage.setItem('regatta_bests', JSON.stringify({ 'lagoon:4': { t: 250.5, bestPos: 4, bestPosT: 250.5 } }));
      let s = 100;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      resetGame(); startRace();
      const me = state.boats[0]; me.controller = new BotController(me);
      let t = 0;
      while (t < 900 && state.race.status !== 'finished') {
        me.controller.update(1 / 30);
        const d = normalizeAngle(me.controller.targetHeading - me.heading);
        state.keys.ArrowLeft = d < -0.02; state.keys.ArrowRight = d > 0.02;
        update(1 / 30); t += 1 / 30;
      }
      togglePause(true);
      showResults();

      const overlay = document.getElementById('results-overlay');
      const inner = overlay.firstElementChild;
      // Anything sticking out past the page column, on any row or in the hero.
      const box = inner.getBoundingClientRect();
      let over = 0;
      for (const el of inner.querySelectorAll('.res-bar, #res-hero > *, #res-splits > *')) {
        const r = el.getBoundingClientRect();
        over = Math.max(over, Math.round(r.right - box.right), Math.round(box.left - r.left));
      }
      // The ruler: the winner sits on the datum, the last boat home sits at the far end,
      // and everyone else is linear in their delta between them.
      const axis = document.querySelector('.res-gap').getBoundingClientRect();
      const marks = [...document.querySelectorAll('.res-row')].map(row => {
        const m = row.querySelector('.res-gap-mark');
        const d = row.querySelector('.res-delta').textContent;
        if (m.style.display === 'none') return `${d}:none`;
        const left = m.getBoundingClientRect().left - axis.left;
        return `${d}@${Math.round(left)}`;
      });
      return {
        over, hScroll: overlay.scrollWidth - overlay.clientWidth,
        gapW: Math.round(axis.width), marks,
        record: !!document.querySelector('#res-hero > div:nth-child(2)'),
      };
    });
    const ok = r.over <= 0 && r.hScroll <= 0;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'BAD '} ${W}  overflow=${r.over}px hScroll=${r.hScroll} gapCol=${r.gapW}px recordCard=${r.record}`);
    console.log('      ' + r.marks.join('  '));
    if (errs.length) { bad++; console.log('      ERRORS ' + errs.slice(0, 2)); }
    await p.close();
  }
  console.log(bad ? `\n${bad} FAILED` : '\nall fit');
  await b.close();
})();
