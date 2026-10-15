// OLD=<worktree of an earlier commit> node regatta/eval/_tide_pic_check.js — Oct 2026 perf pass (tide.js refreshPicture scalars,
// eelgrass dry-square ground cache): the flats picture must be pixel-identical to the old tree's.
const { chromium } = require('playwright'); const path = require('path'); const crypto = require('crypto');
const trees = { old: process.env.OLD, new: path.resolve('.') };
(async () => { const b = await chromium.launch(); const H = {};
  for (const [k, root] of Object.entries(trees)) { const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
    await p.goto('file://' + path.join(root, 'regatta/index.html')); await p.waitForFunction(() => window.state && typeof selectVenue === 'function');
    H[k] = await p.evaluate(() => { settings.venue = 'flats'; selectVenue('flats'); resetGame(); loadVenueWorld();
      const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 800; const g = cv.getContext('2d'); const out = [];
      const lv = Tide.levelAt(0); const views = [[state.course.marks[0].x, state.course.marks[0].y, 0.3], [state.course.marks[1].x + 500, state.course.marks[1].y - 300, 1.2]];
      for (const [cx, cy, rot] of views) for (let q = -6; q <= 6; q++) {
        Tide.setOverride(lv + q * 0.35);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1200, 800); g.translate(600, 400); g.rotate(-rot); g.translate(-cx, -cy);
        Tide.drawWet(g); Tide.drawDry(g);
        const d = g.getImageData(0, 0, 1200, 800).data; let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) >>> 0; out.push(h); }
      Tide.setOverride(null); return out; });
    await p.close(); }
  let bad = 0; H.old.forEach((h, i) => { if (h !== H.new[i]) bad++; });
  console.log("distinct hashes:", new Set(H.new).size); console.log(`${H.old.length} renders, ${bad} differ — ${bad ? 'FAIL' : 'PASS'}`); await b.close(); })();
