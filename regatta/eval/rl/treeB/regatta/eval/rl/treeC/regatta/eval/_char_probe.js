// The player is a character: name, colours and face come from the roster; stats do not.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1500);
  const out = await p.evaluate(() => {
    const o = {};
    let s = 90210;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    settings.character = 'Finley';
    resetGame();
    const me = state.boats[0];
    const fin = AI_CONFIG.find(c => c.name === 'Finley');
    o.name = me.name;
    o.coloursMatch = me.colors.hull === fin.hull && me.colors.spinnaker === fin.spinnaker
                  && me.colors.sail === fin.sail && me.colors.cockpit === fin.cockpit;
    o.hasPattern = !!me.spinPattern;
    o.statsAllZero = Object.values(me.stats).every(v => v === 0);
    o.fleetHasMe = state.boats.filter(x => x.name === 'Finley').length;
    o.fleet = state.boats.map(x => x.name);
    // Live swap: become someone already racing.
    const victim = state.boats[3].name;
    settings.character = victim;
    applyPlayerCharacter();
    o.afterSwapPlayer = state.boats[0].name;
    o.afterSwapDupes = state.boats.filter(x => x.name === victim).length;
    o.swappedBoatKeptLane = state.boats[3].ai !== undefined;
    o.victim = victim;
    o.newFleet = state.boats.map(x => x.name);
    // A swap must not touch the seeded stream.
    const real = Math.random; let draws = 0;
    Math.random = () => { draws++; return real(); };
    settings.character = 'Blaze'; applyPlayerCharacter();
    Math.random = real;
    o.swapDraws = draws;
    return o;
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors:', errs.length ? errs.slice(0, 4) : 'none');
  await b.close();
})();
