// Probe: Lighthouse Cove's two bridges as composites (towers hard + lee, deck opaque over the fleet).
// For each placed bridge: frames with the player far off, beside the deck, under the deck
// mid-span, and under the deck near a tower; the deck alpha canopyAlpha gives at each; the
// hidden tower isles the venue compiled; and the wind either side of a tower along the breeze.
//   node regatta/eval/_bay_bridges.js <outdir>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2] || '/tmp/bay_bridges'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 300));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none'; });
  // wait for the part sprites to land
  await p.evaluate(async () => { for (let i = 0; i < 40; i++) { draw(); await new Promise(r => setTimeout(r, 100)); } });
  const bridges = await p.evaluate(() => VenueDoc.get('bay').props.filter(q => /bridge/.test(q.kind)).map(q => ({ id: q.id, kind: q.kind })));
  for (const br of bridges) {
    // tower centres in bake px (bridgesplit.py BANDS), frame 1740 / 1840
    const towerPx = /truss/.test(br.kind) ? [[311, 1740], [1400, 1740]] : [[369, 1840], [1467, 1840]];
    const info = await p.evaluate(({ id }) => {
      const q = VenueDoc.get('bay').props.find(r => r.id === id); const K = VenueDoc.PROP_KINDS[q.kind];
      const isles = (state.course.islands || []).filter(i => String(i.id || '').startsWith(id + '.hit'));
      return { x: q.x, y: q.y, h: q.heading || 0, s: q.scale || 1, world: K.world,
               isles: isles.map(i => ({ id: i.id, h: i.height, n: (i.vertices || []).length })) };
    }, { id: br.id });
    const ux = Math.sin(info.h), uy = -Math.cos(info.h), nx = -uy, ny = ux, W = info.world * info.s;
    const t0 = (towerPx[0][0] / towerPx[0][1] - 0.5) * W;
    const spots = { far: [nx * 1400, ny * 1400], beside: [nx * 300, ny * 300], under_mid: [0, 0], under_near_tower: [ux * (t0 * 0.6), uy * (t0 * 0.6)] };
    console.log(`${br.id} ${br.kind} at (${info.x.toFixed(0)},${info.y.toFixed(0)}) scale ${info.s}; tower isles: ${JSON.stringify(info.isles)}`);
    for (const [name, [dx, dy]] of Object.entries(spots)) {
      const a = await p.evaluate(({ id, x, y }) => { const me = state.boats[0];
        for (let i = 0; i < 20; i++) { me.x = x; me.y = y; me.speed = 0; update(1 / 30); me.x = x; me.y = y; }
        draw();
        const q = VenueDoc.get('bay').props.find(r => r.id === id); const K = VenueDoc.PROP_KINDS[q.kind];
        return K.opaque ? 1 : canopyAlpha(q, K.fadeMin); }, { id: br.id, x: info.x + dx, y: info.y + dy });
      await p.screenshot({ path: path.join(out, `${br.id}_${name}.png`) });
      console.log(`   ${name.padEnd(17)} deck alpha ${a.toFixed(2)}`);
    }
    // wind along the breeze through the first tower: upwind 200u vs downwind 100..500u
    const w = await p.evaluate(({ x, y }) => { const base = getWindAt(x, y - 2000); const d = base.direction != null ? base.direction : 0;
      const vx = Math.sin(d), vy = -Math.cos(d); const at = k => { const r = getWindAt(x + vx * k, y + vy * k); return +(r.speed != null ? r.speed : Math.hypot(r.x || 0, r.y || 0)).toFixed(2); };
      return { dir: +(d * 180 / Math.PI).toFixed(0), samples: [-400, -200, 100, 200, 350, 500].map(k => [k, at(k), at(-k)]) }; },
      { x: info.x + ux * t0, y: info.y + uy * t0 });
    console.log(`   wind through tower 1 (dir ${w.dir}°): [offset, speed at +k, speed at -k] ${JSON.stringify(w.samples)}`);
  }
  console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors'); await b.close(); })();
