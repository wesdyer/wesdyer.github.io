// PT-084: the finish approach past kelp-islet-inner — straight through the bed, or the lane west of it
// (a jink past the shelf's tip, down the bed's west side, back to the line). A boat alone, steered at
// each waypoint in turn, from 600 u north of the bed to the finish line's middle.  node eval/rl/_pt084_islet.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction(() => window.state && window.VenueDoc && typeof resetGame === 'function');
  const routes = JSON.parse(process.env.ROUTES || '{"straight": [[8330, -2420]], "lane": [[8240, -3560], [8040, -3330], [8090, -3100], [8330, -2420]], "laneTight": [[8235, -3570], [8065, -3360], [8100, -3150], [8330, -2420]]}');
  for (const [name, wps] of Object.entries(routes)) {
    const r = await p.evaluate((wps) => { let s = 5;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
      selectVenue('otter'); resetGame(); startRace(); state.race.status = 'racing';
      const me = state.boats[0]; for (const o of state.boats) if (o !== me) { o.x = 1e6; o.y = 1e6; }
      me.x = 8300; me.y = -4250; me.heading = Math.PI; me.speed = 2.4;
      let t = 0, wi = 0, kelpT = 0, minKt = 99, grounded = 0;
      for (let i = 0; i < 30 * 120 && wi < wps.length; i++) {
        const [tx, ty] = wps[wi]; const want = Math.atan2(tx - me.x, -(ty - me.y)), dd = normalizeAngle(want - me.heading);
        state.keys.ArrowLeft = dd < -0.03; state.keys.ArrowRight = dd > 0.03;
        for (const o of state.boats) if (o !== me) { o.x = 1e6; o.y = 1e6; }
        update(1 / 30); t += 1 / 30;
        if (VenueDoc.shoalField(state.course.islands, me.x, me.y) < 0.9 && VenueDoc.shoalGrab() > 0) kelpT += 1 / 30;
        minKt = Math.min(minKt, me.speed * 4); if (me.aground || me.collided) grounded++;
        if (Math.hypot(tx - me.x, ty - me.y) < 40) wi++;
      }
      return { t: +t.toFixed(1), done: wi >= wps.length, kelpT: +kelpT.toFixed(1), minKt: +minKt.toFixed(1), grounded };
    }, wps);
    console.log(name.padEnd(9), JSON.stringify(r));
  }
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();
