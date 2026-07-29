const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type()==='error') errs.push('CONSOLE: ' + m.text()); });
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.waitForTimeout(1500);

  const fatal = await p.evaluate(() => {
    const f = document.getElementById('fatal');
    return f && !f.classList.contains('hidden') ? f.textContent : null;
  });
  console.log('fatal:', fatal ? fatal.slice(0,600) : 'none');
  console.log('errors:', errs.length ? errs.slice(0,6) : 'none');

  const info = await p.evaluate(() => ({
    venues: document.getElementById('venue-select').options.length,
    course: document.getElementById('info-course').innerText,
    time: document.getElementById('info-time').innerText,
    land: document.getElementById('info-land').innerText
  }));
  console.log('venues in picker:', info.venues);
  console.log('--- course ---\n' + info.course);
  console.log('--- time ---\n' + info.time);
  console.log('--- land ---\n' + info.land);

  await p.screenshot({ path: 'regatta/eval/_editor_arctic.png' });

  // Fleet tab
  await p.click('.tab[data-view="fleet"]');
  await p.waitForTimeout(1200);
  const roster = await p.evaluate(() => ({
    count: document.getElementById('roster-count').textContent,
    cards: document.querySelectorAll('#roster section').length,
    canvases: document.querySelectorAll('.profile-boat-canvas').length,
    painted: [...document.querySelectorAll('.profile-boat-canvas')].filter(c => c.width>1 && c.height>1).length
  }));
  console.log('roster:', JSON.stringify(roster));
  console.log('errors after fleet:', errs.length ? errs.slice(0,6) : 'none');
  await b.close();
})();
