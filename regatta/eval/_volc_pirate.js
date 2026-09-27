// Probe: frigatebird piracy — put a booby flock in 'rise' near a frigate and step; count chases, drops, catches, misses.
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
 const errs = []; p.on('pageerror', e => errs.push(e.message));
 await p.goto('file://' + path.resolve('regatta/index.html'));
 await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
 const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame();
  const d = Wildlife.debug(); const out = { chases: 0, drops: 0, caught: 0, missed: 0, runs: 0 };
  for (let run = 0; run < 6; run++) {
   const f = d.frigates[run % d.frigates.length], F = d.boobyFlocks.slice().sort((a, b) => Math.hypot(a.cx - f.x, a.cy - f.y) - Math.hypot(b.cx - f.x, b.cy - f.y))[0];
   F.mode = 'rise'; F.t = 6; for (const q of F.birds) { q.mode = 'fly'; q.z = 20; } f.mode = 'soar'; f.t = 0; out.runs++;
   const seen = new Set(); let chased = false;
   for (let i = 0; i < 30 * 25; i++) { Wildlife.update(1 / 30); const D = Wildlife.debug(); if (f.mode === 'swoop') chased = true; for (const q of D.frigFish) if (!seen.has(q)) { seen.add(q); out.drops++; } }
   if (chased) out.chases++;
   for (const q of seen) { if (q.caught) out.caught++; else out.missed++; }
  }
  return out; });
 console.log(JSON.stringify(r), errs.length ? errs : 'no page errors'); await b.close(); })();
