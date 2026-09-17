// PASSAGE FILL PROBE — for every marked passage in the document (doc.tide.passages), the
// ground along its centreline off the live field, and the windows the tide gives it: for
// how many seconds of the cycle the WHOLE line is afloat (depth >= draft) and free (depth >=
// draft + free), and where the high point is. A passage that never fills all the way shows
// up here as a free window of 0 s and a named high point.
//   NODE_PATH=node_modules node regatta/eval/_flats_passages.js
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 200)));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  await page.waitForTimeout(400);
  const out = await page.evaluate(() => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' }));
    window.resetGame(); window.startRace();
    const T = state.tide, P = state.course.doc.tide.passages || [];
    const res = [];
    for (const p of P) {
      // sample every 20u along the polyline
      const samples = [];
      for (let i = 1; i < p.pts.length; i++) {
        const a = p.pts[i - 1], b = p.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 20));
        for (let k = 0; k < n; k++) { const s = k / n; const x = a[0] + (b[0] - a[0]) * s, y = a[1] + (b[1] - a[1]) * s; samples.push([x, y, Tide.groundAt(x, y)]); }
      }
      let zmax = -99, at = null; for (const s of samples) if (s[2] > zmax) { zmax = s[2]; at = s; }
      const HW = T.mid + T.amp;
      // windows: the level must exceed zmax + draft (afloat) / + draft + free (free); on a sine
      const win = (need) => { const r = (need - T.mid) / T.amp; if (r >= 1) return 0; if (r <= -1) return T.period; return T.period * Math.acos(r) / Math.PI; };
      // the second-highest stretch: count of samples above HW - draft - free (the choke length)
      const chokeN = samples.filter(s => s[2] > HW - T.draft - T.free).length;
      // WIDTH: at the middle of the line, the ground across the corridor (±400u), and the
      // span at free depth at high water
      const mi = Math.floor(samples.length / 2), a = samples[Math.max(0, mi - 3)], b = samples[Math.min(samples.length - 1, mi + 3)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const xs = []; for (let o = -400; o <= 400; o += 20) xs.push([o, Tide.groundAt(samples[mi][0] - ty * o, samples[mi][1] + tx * o)]);
      const freeW = xs.filter(q => q[1] <= HW - T.draft - T.free).length * 20, afloatW = xs.filter(q => q[1] <= HW - T.draft).length * 20;
      res.push({ id: p.id, name: p.name, len: Math.round(samples.length * 20), zmax: +zmax.toFixed(2), at: [Math.round(at[0]), Math.round(at[1])], freeW, afloatW, xsec: xs.filter((q, i) => i % 2 === 0).map(q => +q[1].toFixed(1)),
                 depthAtHW: +(HW - zmax).toFixed(2), afloatSecs: +win(zmax + T.draft).toFixed(1), freeSecs: +win(zmax + T.draft + T.free).toFixed(1), chokeU: chokeN * 20,
                 profile: samples.filter((s, i) => i % 10 === 0).map(s => +s[2].toFixed(2)) });
    }
    return { draft: T.draft, free: T.free, period: T.period, res };
  });
  console.log(`draft ${out.draft}  free ${out.free}  period ${out.period}s   (afloat: whole line >= draft; free: whole line >= draft+free)`);
  for (const r of out.res) console.log(`${r.id.padEnd(9)} ${String(r.len).padStart(5)}u  high ${String(r.zmax).padStart(5)} m at (${r.at})  depth@HW ${r.depthAtHW}  afloat ${String(r.afloatSecs).padStart(4)}s  free ${String(r.freeSecs).padStart(4)}s  width@HW free ${r.freeW}u afloat ${r.afloatW}u\n          along: ${r.profile.join(' ')}\n          across: ${r.xsec.join(' ')}`);
  await browser.close();
})();
// (cross-sections are printed by the WIDTH block below when --width is passed)
