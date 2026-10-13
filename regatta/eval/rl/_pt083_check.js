// PT-083 check: over ten minutes at Otter (no boat near, then the boat through each haul-out), count
// (a) water sea lions pressed to a haul-out rock (within 6 u of its edge) for over 3 s, and
// (b) climbs whose swim leg runs over the rock. Gone/lie counts show how full the rocks stay.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(() => { let s = 11;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('otter'); resetGame(); startRace();
    const pip = (x, y, V) => { let c = false; for (let i = 0, j = V.length - 1; i < V.length; j = i++) { if ((V[i].y > y) !== (V[j].y > y) && x < (V[j].x - V[i].x) * (y - V[i].y) / (V[j].y - V[i].y) + V[i].x) c = !c; } return c; };
    const ed = (x, y, V) => { let best = 1e9; for (let i = 0, j = V.length - 1; i < V.length; j = i++) { const ax = V[j].x, ay = V[j].y, bx = V[i].x - ax, by = V[i].y - ay, t = Math.max(0, Math.min(1, ((x - ax) * bx + (y - ay) * by) / (bx * bx + by * by))); best = Math.min(best, Math.hypot(x - ax - bx * t, y - ay - by * t)); } return best; };
    const d = Wildlife.debug(), hauls = d.slHauls, me = state.boats[0];
    const pressed = new Map(); const log = []; let pressedLong = new Set(), overRock = 0, climbs = 0, goneSum = 0, n = 0;
    for (let i = 0; i < 600 * 30; i++) {
      const sec = i / 30, H = hauls[Math.floor(sec / 30) % hauls.length], ph = (sec % 30) / 30;   // every 30 s the boat sails past the next rock
      for (const bt of state.boats) { bt.x = 30000; bt.y = 30000; bt.speed = 0; }
      if (sec > 300 && ph < 0.3) { me.x = H.C.x - 400 + ph / 0.3 * 800; me.y = H.C.y + 60; }
      update(1 / 30);
      const D = Wildlife.debug();
      for (const G of D.slGroups) for (const q of G.members) { if (q.gone || q.leap > 0) continue;
        const near = hauls.some(H2 => ed(q.x, q.y, H2.V) < 6 && !pip(q.x, q.y, H2.V));
        if (near) { const t = (pressed.get(q) || 0) + 1 / 30; pressed.set(q, t); if (t > 3) pressedLong.add(q); } else pressed.delete(q); }
      for (const H2 of hauls) for (const m of H2.members) if (m.mode === 'climb' && m.inWater) { if (!m._c) { m._c = 1; climbs++; } if (pip(m.x, m.y, H2.V) && ed(m.x, m.y, H2.V) > 4) { if (!m._o) { m._o = 1; overRock++; if (log.length < 12) log.push(`${H2.id} start ${Math.round(m.cx0)},${Math.round(m.cy0)} startIn ${pip(m.cx0, m.cy0, H2.V)} startEdge ${ed(m.cx0, m.cy0, H2.V).toFixed(0)} t ${sec.toFixed(0)}`); } } } else if (m.mode !== 'climb') { m._c = 0; m._o = 0; }
      if (i % 30 === 0) { for (const H2 of hauls) for (const m of H2.members) { n++; if (m.mode === 'gone' || m.mode === 'shuffle') goneSum++; } }
    }
    return { pressedLong: pressedLong.size, climbs, overRock, offRock: (goneSum / n * 100).toFixed(0) + '%', groupsOut: Wildlife.debug().slGroups.length, log };
  });
  console.log(JSON.stringify(r)); console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();
