// Probe: the Flats waders over N minutes of tide, boats away but a boat through each flock once a minute — feeding walk
// speed (u/s, and real m/s on the game clock: /29), share of feeding time walking, flight speeds (cruise = top 25%), flight
// durations, flights still airborne past 20 s (orbiting), birds on land while wading (not roosting), close pairs feeding.
//   node regatta/eval/_flats_waders.js [minutes]
const { chromium } = require('playwright'); const path = require('path');
(async () => { const MIN = +(process.argv[2] || 10);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' })); resetGame(); });
  console.log(await p.evaluate((MIN) => { const D = Wildlife.debug(), out = [];
    for (const [k, list] of [['spoonbill', D.spoonFlocks], ['avocet', D.avoFlocks]]) {
      const walk = [], fly = [], durs = [], st = new Map(); let land = 0, close = 0, feedN = 0, long = 0;
      for (let i = 0; i < 30 * 60 * MIN; i++) {
        for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; }
        if (i % 1800 < 60) { const F = list[(i / 1800 | 0) % list.length], me = state.boats[0]; me.x = F.cx + 40; me.y = F.cy; }
        const prev = list.map(F => F.birds.map(q => [q.x, q.y, q.mode]));
        update(1 / 30);
        list.forEach((F, fi) => F.birds.forEach((q, j) => { const [px, py, pm] = prev[fi][j], sp = Math.hypot(q.x - px, q.y - py) * 30;
          if (q.mode === 'wade' && pm === 'wade' && !F.roosting) { walk.push(sp); feedN++; if (pointOnLand(q.x, q.y)) land++;
            for (const o of F.birds) if (o !== q && o.mode === 'wade' && Math.hypot(o.x - q.x, o.y - q.y) < (k === 'spoonbill' ? 10 : 7)) { close++; break; } }
          if (q.mode === 'fly' && pm === 'fly') fly.push(sp);
          const key = q; if (q.mode !== 'wade' && !st.has(key)) st.set(key, i); if (q.mode === 'wade' && st.has(key)) { durs.push((i - st.get(key)) / 30); st.delete(key); } }));
        for (const [q, t0] of st) if ((i - t0) / 30 === 20) long++;
      }
      const med = (a) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[a.length >> 1] : 0; }, q75 = (a) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length * 0.85)] : 0; };
      out.push(`${k}: feeding walk median ${med(walk).toFixed(1)} u/s (${(med(walk) / 29).toFixed(2)} m/s real), walking ${Math.round(100 * walk.filter(v => v > 2).length / walk.length)}% of feeding frames; flight cruise ${q75(fly).toFixed(0)} u/s (${(q75(fly) / 29).toFixed(1)} m/s), flights ${durs.length} median ${med(durs).toFixed(1)} s max ${Math.max(0, ...durs).toFixed(1)} s, past 20 s ${long}; on land ${land}/${feedN}; close pairs ${Math.round(100 * close / Math.max(1, feedN))}% of feeding frames`);
    }
    return out.join('\n'); }, MIN));
  await b.close(); })();
