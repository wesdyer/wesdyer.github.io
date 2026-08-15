// SURF PROBE — is the shore surf now the SWELL's, and do the bars break?
//
// Reports, per shape, what the layer resolved: which train is driving it, how many break
// sites a bar produced, and the focus/exposure spread across a coast (a headland and the bay
// beside it must not come out the same). Then screenshots a bar and a coast.
//
// Usage: node eval/_surf_probe.js [venue]
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOT_OUT || '/private/tmp/claude-501/-Users-wesdyer-Desktop-wesdyer-github-io/0b98d4e5-b137-4a82-9d99-591fe88704f5/scratchpad';
const venue = process.argv[2] || 'ocean';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForTimeout(1400);

  const r = await p.evaluate((v) => {
    settings.venue = v; resetGame(); startRace();
    for (let i = 0; i < 900; i++) { update(1 / 60); if (i % 6 === 0) draw(); }
    const out = { shapes: [], sea: null, sites: window.SeaFX.debug().shoalSites };
    const sw = window.Swell && window.Swell.active() ? window.Swell.primary() : null;
    out.sea = sw ? { heightM: sw.heightM, periodS: sw.periodS,
                     dirDeg: Math.round(((Math.atan2(sw.sx, -sw.sy) * 180 / Math.PI) % 360 + 360) % 360) } : null;
    for (const isl of (state.course.islands || [])) {
      if (isl.hidden) continue;
      const rec = { style: isl.style || '?', awash: !!isl.awash, paint: !!isl.paint,
                    reef: !!isl.reef, verts: isl.vertices ? isl.vertices.length : 0,
                    x: Math.round(isl.x), y: Math.round(isl.y), r: Math.round(isl.radius) };
      if (!isl.awash && isl.vertices && isl.vertices.length >= 3) {
        // The spread that says headland-vs-bay is actually being measured.
        // The DISTRIBUTION, not the extremes: one sharp notch on a ring puts min/max at
        // both rails and says nothing about whether the measure works.
        const f = [...surfFocus(isl)].sort((a, b) => a - b);
        rec.focusLo = +f[0].toFixed(2);
        rec.focusMed = +f[f.length >> 1].toFixed(2);
        rec.focusHi = +f[f.length - 1].toFixed(2);
        rec.focusFlat = +(f.filter(x => Math.abs(x - 1) < 0.12).length / f.length).toFixed(2);
        const dry = surfDryEdges(isl);
        rec.wetEdges = dry.filter(d => !d).length;
      }
      out.shapes.push(rec);
    }
    return out;
  }, venue);

  console.log('venue', venue, 'sea', JSON.stringify(r.sea));
  console.log('shoal break sites:', r.sites);
  for (const s of r.shapes) {
    console.log(`  ${s.style.padEnd(12)} awash=${String(s.awash).padEnd(5)} paint=${String(s.paint).padEnd(5)}` +
      ` v=${String(s.verts).padEnd(4)} r=${String(s.r).padEnd(5)}` +
      (s.focusLo !== undefined ? ` wet=${String(s.wetEdges).padEnd(4)} focus ${s.focusLo}/${s.focusMed}/${s.focusHi} flat=${s.focusFlat}` : ''));
  }
  // ⚠️ SET THE CAMERA AFTER update(), NOT BEFORE. The game recomputes it from the player
  // every tick, so the first pass at this shot silently framed the start line every time.
  //
  // ⚠️ AND SHOOT THE ISLANDS, NOT THE BIGGEST SHAPE. "Point at the highest-scoring wet edge"
  // aimed at the mainland's outer edge, which on this venue is 14 km out and is drawn as the
  // flat out-of-bounds fill with the club banner across it — a screenshot of the arena's
  // edge treatment, with no coastline in it at all. What is worth looking at is a real
  // island: small enough to fit the frame whole, so the exposed side and the lee are both
  // visible in one shot, which is the entire claim the layer is making.
  const targets = await p.evaluate(() => {
    const sw = window.Swell.primary();
    const out = { isles: [], bar: null };
    for (const isl of (state.course.islands || [])) {
      if (isl.hidden || isl.awash || !isl.vertices || isl.vertices.length < 3) continue;
      if (isl.radius > 2000) continue;                    // has to fit the frame
      const dry = surfDryEdges(isl);
      const wet = dry.filter(d => !d).length;
      if (wet < 6) continue;                              // an inland cap, not a coast
      out.isles.push({ x: isl.x, y: isl.y, r: Math.round(isl.radius), style: isl.style, wet });
    }
    out.isles.sort((a, b) => b.wet - a.wet);
    const sites = window.SeaFX.debugSites ? window.SeaFX.debugSites() : null;
    if (sites && sites.length) {
      for (const st of sites) {
        const face = -(st.nx * sw.sx + st.ny * sw.sy);
        if (!out.bar || face > out.bar.score) out.bar = { x: st.x, y: st.y, score: face };
      }
    }
    return out;
  });
  console.log('targets', JSON.stringify(targets.isles.slice(0, 3)), 'bar', JSON.stringify(targets.bar));
  const shots = targets.isles.slice(0, 2).map((t, i) => ['isle' + i, t]);
  if (targets.bar) shots.push(['bar', targets.bar]);
  // ⚠️ PAUSE FIRST, THEN AIM. The game's own rAF loop keeps running between the evaluate()
  // and the screenshot, and it re-derives the camera from the player every tick — so a shot
  // set up and taken as two calls is composed by me and framed by the game. Every early
  // "the island is not there" was that: the camera was back on the start line by the time
  // the shutter opened. Paused, the loop skips update AND draw, so the canvas holds exactly
  // what this call put on it.
  for (const [tag, s] of shots) {
    for (let f = 0; f < 6; f++) {
      await p.evaluate(({ x, y, n }) => {
        state.paused = false;
        for (let i = 0; i < n; i++) update(1 / 60);
        state.paused = true;
        state.camera.x = x; state.camera.y = y; state.camera.rotation = 0;
        draw();
      }, { x: s.x, y: s.y, n: f === 0 ? 0 : 12 });
      await p.screenshot({ path: `${OUT}/_surf_${tag}_${f}.png` });
    }
  }
  console.log('ERRORS', errs.length ? errs.slice(0, 6).join('\n') : 'none');
  await b.close();
})();
