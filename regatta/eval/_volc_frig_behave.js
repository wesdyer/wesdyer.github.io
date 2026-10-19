// Probe: twenty minutes of Emberfall's frigatebirds against the research — time flapping (almost never, soaring), surface
// snatches, chases (and group chases), the share of chases that make a booby drop its fish, fish taken in the air.
//   node regatta/eval/_volc_frig_behave.js
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })); selectVenue('volcanic'); resetGame(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const d = Wildlife.debug(), Fr = d.frigates; let frames = 0, flapping = 0, dips = 0, chases = 0, groups = 0, drops = 0, caught = 0; const prev = new Map(Fr.map(f => [f, f.mode])), seenFish = new Set(), chased = new Set();
    for (let i = 0; i < 30 * 1200; i++) { Wildlife.update(1 / 30);
      for (const f of Fr) { frames++; if (f.beats > 0) flapping++; const pm = prev.get(f);
        if (pm === 'dip' && f.mode === 'climb' && f.dipRing > 0.9) dips++;
        if (pm !== 'swoop' && f.mode === 'swoop' && !chased.has(f.tgt)) { chased.add(f.tgt); chases++; f.tgt.__T = i; }
        prev.set(f, f.mode); }
      for (const B of chased) { const n = Fr.filter(f => f.tgt === B && f.mode === 'swoop').length; if (n > 1 && !B.__g) { B.__g = 1; groups++; } if (i - B.__T > 30 * 30) { chased.delete(B); B.__g = 0; } }
      for (const q of Wildlife.debug().frigFish) if (!seenFish.has(q)) { seenFish.add(q); drops++; } }
    for (const q of seenFish) if (q.caught) caught++;
    return { frigates: Fr.length, flappingShare: (flapping / frames).toFixed(3), surfaceSnatchesPerMin: (dips / 20).toFixed(2), chases, groupChases: groups, fishDropped: drops, dropShare: chases ? (drops / chases).toFixed(2) : '-', caughtInAir: caught }; });
  console.log(JSON.stringify(r, null, 1)); await b.close(); })();
