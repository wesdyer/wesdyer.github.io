// Race the ocean for real: does the fleet cope with the sea, and what does it look like?
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '/private/tmp/claude-501/-Users-wesdyer-Desktop-wesdyer-github-io/94ee2bf6-5b8c-4103-9e96-20eb59ec4e72/scratchpad';
const VENUE = process.env.VENUE || 'ocean';

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.VENUE_DOC);
  await p.evaluate((v) => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: 'Muninn' }));
    resetGame();
  }, VENUE);
  await p.waitForTimeout(600);
  await p.evaluate(() => { startRace(); state.race.status = 'racing'; state.race.timer = 0; });

  // Let it run on the real animation loop so the render path is exercised too.
  const shots = [];
  for (let i = 0; i < 5; i++) {
    await p.waitForTimeout(4000);
    const f = `${OUT}/swell_${VENUE}_${i}.png`;
    await p.screenshot({ path: f });
    shots.push(f);
    const st = await p.evaluate(() => ({
      t: Math.round(state.time),
      spd: state.boats.map(b => +(b.speed * 4).toFixed(1)),
      surf: state.boats.filter(b => b.swell && b.swell.surf01 > 0.34 && b.swell.withWave).length,
      plane: state.boats.filter(b => b.raceState.isPlaning).length,
      legs: state.boats.map(b => b.raceState.leg),
      stuck: state.boats.filter(b => b.speed * 4 < 1.5).length,
      fps: window.__fps || null
    }));
    console.log(`t=${st.t}s  legs=${JSON.stringify(st.legs)}  surfing=${st.surf}/${st.spd.length}  planing=${st.plane}  slow(<1.5kt)=${st.stuck}`);
    console.log(`      speeds ${st.spd.join(' ')}`);
  }
  const fin = await p.evaluate(() => ({
    finished: state.boats.filter(b => b.raceState.finished).length,
    total: state.boats.length,
    swellOn: window.Swell.active(),
    trains: window.Swell.active() ? window.Swell.debug().trains.length : 0
  }));
  console.log(`\nswell active: ${fin.swellOn} (${fin.trains} trains) | finished ${fin.finished}/${fin.total}`);
  console.log('shots:\n  ' + shots.join('\n  '));
  if (errs.length) console.log('\nERRORS:\n' + errs.slice(0, 10).join('\n'));
  await b.close();
})();
