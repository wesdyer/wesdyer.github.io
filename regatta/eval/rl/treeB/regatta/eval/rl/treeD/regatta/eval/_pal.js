// What does the water render actually USE? A swatch for a colour nothing draws is a lie.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.waitForTimeout(1600);
  const r = await p.evaluate(() => {
    const isls = (state.course.islands || []);
    const kinds = {};
    for (const i of isls) {
      const k = `${i.style}${i.fromMask ? '/mask' : ''}${i.isFloe ? '/floe' : ''}`;
      kinds[k] = (kinds[k] || 0) + 1;
    }
    // Which islands would take the shoreline-glow branch in drawIslandSprite?
    const glowing = isls.filter(i => i.style !== 'ice' && !i.fromMask).length;
    // Ripples: sample the preview and measure how much it varies off the smooth gradient.
    const cv = document.getElementById('pal-preview');
    const c = cv.getContext('2d');
    const d = c.getImageData(0, 0, cv.width, cv.height).data;
    let mn = 999, mx = -1, n = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) { const v = d[i] + d[i+1] + d[i+2]; mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; n++; }
    // Local roughness: |pixel - pixel 3 to the right|, which a smooth gradient scores ~0 on.
    let rough = 0, m = 0;
    const W = cv.width;
    for (let y = 0; y < cv.height; y += 2) for (let x = 0; x + 3 < W; x += 3) {
      const a = (y * W + x) * 4, bb = (y * W + x + 3) * 4;
      rough += Math.abs(d[a] - d[bb]) + Math.abs(d[a+1] - d[bb+1]) + Math.abs(d[a+2] - d[bb+2]); m++;
    }
    return { kinds, glowing, blank: mx < 0, tone: { mn, mx, mean: Math.round(sum / n) },
             roughness: +(rough / Math.max(1, m)).toFixed(2),
             cfg: { base: WATER_CONFIG.baseColor, deep: WATER_CONFIG.deepColor,
                    shallow: WATER_CONFIG.shallowColor, shore: WATER_CONFIG.shorelineColor },
             ripple: { spacing: WATER_CONFIG.rippleSpacing, opacity: WATER_CONFIG.rippleOpacity,
                       caustics: WATER_CONFIG.causticStrength, resScale: WATER_CONFIG.resolutionScale } };
  });
  console.log(JSON.stringify(r, null, 2));
  console.log('errs:', errs.slice(0, 2));
  await b.close();
})();
