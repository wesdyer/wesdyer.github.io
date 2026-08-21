// SEA EFFECTS PROBE — does the ocean actually draw whitecaps, surf spray and bow impacts,
// and does each fire where the sailing says it should?
//
// Polls the live layer through a whole race and reports, per point of sail, how much of
// each effect was on screen. Screenshots the two moments the effects exist for: the fastest
// ride of the race, and the hardest the bow was working upwind.
//
// Usage: node eval/_seafx_probe.js [venue] [seconds]
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOT_OUT || '/private/tmp/claude-501/-Users-wesdyer-Desktop-wesdyer-github-io/0b98d4e5-b137-4a82-9d99-591fe88704f5/scratchpad';
const venue = process.argv[2] || 'ocean';
const SECS = parseInt(process.argv[3] || '150', 10);

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts.ready);

  await page.evaluate((v) => {
    settings.venue = v;
    window.resetGame && resetGame();
    window.startRace && startRace();
    // Hand the player's boat to a bot so it actually sails the course. The camera follows
    // state.boats[0], which every camera and HUD path resolves `player` to, so it still
    // watches this hull — the effects have to be judged where the camera actually is.
    state.boats[0].isPlayer = false;
  }, venue);
  await page.waitForTimeout(32000);   // through the prestart

  const samples = [];
  let bestSurf = null, bestPound = null;
  for (let i = 0; i < SECS; i++) {
    const s = await page.evaluate(() => {
      const p = state.boats[0];
      const sw = p.swell;
      const d = window.SeaFX ? window.SeaFX.debug() : { caps: -1, spray: -1 };
      const wind = getWindAt(p.x, p.y);
      const twa = Math.abs(((p.heading - wind.direction + Math.PI) % (2 * Math.PI) + 2 * Math.PI)
                  % (2 * Math.PI) - Math.PI) * 180 / Math.PI;
      return {
        t: +state.race.timer.toFixed(1), status: state.race.status,
        kn: +(p.speed * 4).toFixed(2), twa: +twa.toFixed(0), windKt: +wind.speed.toFixed(1),
        caps: d.caps, spray: d.spray,
        surf01: sw ? +sw.surf01.toFixed(3) : null,
        cosPsi: sw ? +sw.cosPsi.toFixed(3) : null,
        pound: sw ? +sw.poundMul.toFixed(3) : null
      };
    });
    if (s.status === 'finished') break;
    samples.push(s);
    // The two moments worth looking at.
    const surfing = s.t > 50 && s.cosPsi > 0.3 && s.surf01 > 0.45 && s.kn > 10;
    if (surfing && (!bestSurf || s.surf01 > bestSurf.surf01)) {
      bestSurf = s;
      await page.screenshot({ path: `${OUT}/seafx-surf.png` });
    }
    // ⚠️ AFTER THE GUN. The first pass fired its burst at t=13 s, in the middle of a
    // prestart mill-about — every boat on a different heading and none of them beating. A
    // 'beating' test that does not check the race has started is a test of the start line.
    const beating = s.t > 50 && s.twa < 55 && s.kn > 5.5 && s.cosPsi < -0.4;
    if (beating && (!bestPound || s.spray > bestPound.spray)) {
      bestPound = s;
      await page.screenshot({ path: `${OUT}/seafx-upwind.png` });
      // ⚠️ A BURST, NOT A FRAME. A slam is one event per wave and it is over in under a
      // second; sampled once a second the odds are against catching it, and the first pass
      // at this probe reported "spray fires upwind" from counters while every screenshot it
      // saved happened to land between two of them. Eight frames a sixth of a second apart
      // cover a whole encounter cycle, cropped tight on the camera so the hull fills it.
      const clip = { x: 600, y: 300, width: 400, height: 400 };
      for (let f = 0; f < 8; f++) {
        await page.screenshot({ path: `${OUT}/seafx-slam-${f}.png`, clip });
        await page.waitForTimeout(160);
      }
    }
    await page.waitForTimeout(1000);
  }

  const bucket = (name, f) => {
    const g = samples.filter(f);
    if (!g.length) return `${name.padEnd(9)} n=0`;
    const avg = (k) => +(g.reduce((a, b) => a + (b[k] || 0), 0) / g.length).toFixed(1);
    return `${name.padEnd(9)} n=${String(g.length).padEnd(4)} caps=${String(avg('caps')).padEnd(6)}`
         + `spray=${String(avg('spray')).padEnd(7)}kn=${avg('kn')}`;
  };
  console.log('SAMPLES', samples.length);
  console.log(bucket('upwind', s => s.twa < 60));
  console.log(bucket('reach', s => s.twa >= 60 && s.twa < 140));
  console.log(bucket('downwind', s => s.twa >= 140));
  console.log(bucket('surfing', s => s.cosPsi > 0.3 && s.surf01 > 0.4));
  const caps = samples.map(s => s.caps);
  const spray = samples.map(s => s.spray);
  console.log('caps  min/max', Math.min(...caps), Math.max(...caps));
  console.log('spray min/max', Math.min(...spray), Math.max(...spray));
  console.log('BEST SURF  ', JSON.stringify(bestSurf));
  console.log('BEST UPWIND', JSON.stringify(bestPound));
  console.log('ERRORS', errors.length ? errors.slice(0, 8).join('\n') : 'none');
  await browser.close();
})();
