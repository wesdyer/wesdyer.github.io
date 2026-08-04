// The results table's green/red column marks, and the split tags, checked against the
// numbers actually printed — a highlight nobody can verify by looking at the column beside
// it is worse than no highlight.
//
//   node regatta/eval/_resmarks.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VENUE_DOC);

  const out = await p.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'lagoon', character: 'Muninn', musicEnabled: false, soundEnabled: false }));
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
    togglePause(true); showResults();

    const GREEN = 'rgb(52, 213, 153)', GREEN2 = 'rgb(52, 211, 153)', RED = 'rgb(239, 68, 68)';
    const col = (cls) => [...document.querySelectorAll('.res-row')].map(r => {
      const el = r.querySelector('.' + cls);
      const c = el.style.color;
      return { v: el.textContent, mark: (c === GREEN || c === GREEN2) ? 'green' : c === RED ? 'red' : '' };
    });
    const check = (cls, lowIsGood) => {
      const cells = col(cls).filter(c => c.v !== '—' && c.v !== 'racing');
      const nums = cells.map(c => parseFloat(c.v));
      const good = lowIsGood ? Math.min(...nums) : Math.max(...nums);
      const bad = lowIsGood ? Math.max(...nums) : Math.min(...nums);
      // Every cell printing the best number must be green, every worst red, nothing else.
      const wrong = cells.filter((c, i) =>
        (nums[i] === good && c.mark !== 'green') ||
        (nums[i] === bad && c.mark !== 'red') ||
        (nums[i] !== good && nums[i] !== bad && c.mark !== ''));
      return { column: cls, best: good, worst: bad, marks: cells.map(c => c.v + (c.mark ? ':' + c.mark : '')).join(' '), wrong: wrong.length };
    };
    return {
      cols: [check('res-start', true), check('res-top', false), check('res-avg', false), check('res-dist', true)],
      splits: [...document.querySelectorAll('#res-splits > div')].map(t => {
        const tag = t.lastElementChild;
        return `${t.firstElementChild.textContent}[${tag.textContent}|${tag.style.color}|${t.style.border || 'plain'}]`;
      }),
      startRank: state.boats.find(b => b.isPlayer).raceState.startRank,
      fleet: state.boats.length,
      heroLabel: document.querySelector('#res-hero .t-label').style.color,
      bandWash: document.getElementById('res-hero').parentElement.style.background,
    };
  });
  // The cases one race cannot produce: a start at either end of the fleet, and a leg you
  // gained on. Re-report the same race with the ranks doctored.
  const synth = await p.evaluate(() => {
    const rs = state.boats.find(b => b.isPlayer).raceState;
    const out = [];
    for (const [sr, ranks, label] of [[2, [1, 3, 2, 2], 'good start, gains'], [9, [9, 10, 10, 10], 'bad start, losses']]) {
      rs.startRank = sr;
      rs.legRanks = ranks;
      delete document.getElementById('res-splits').dataset.sig;
      showResults();
      out.push(label + ': ' + [...document.querySelectorAll('#res-splits > div')]
        .map(t => `${t.firstElementChild.textContent}[${t.lastElementChild.textContent}]`).join(' '));
    }
    return out;
  });
  for (const c of out.cols) console.log(`${c.column.padEnd(9)} best=${c.best} worst=${c.worst} wrong=${c.wrong}\n           ${c.marks}`);
  console.log(synth.join('\n'));
  console.log('splits:', out.splits.join('\n        '));
  console.log('start rank', out.startRank, 'of', out.fleet);
  console.log('hero label', out.heroLabel, '| band', out.bandWash);
  const bad = out.cols.reduce((n, c) => n + c.wrong, 0);
  console.log(bad ? `\n${bad} MISMARKED CELLS` : '\nevery mark matches the printed number');
  console.log(errs.length ? 'ERRORS ' + errs.slice(0, 3) : 'no page errors');
  await b.close();
})();
