// BEAT TACK OWNERSHIP (flats push): on leg 1 (the 1200 u beat he sails with ONE tack),
// every tack a bot makes (TWA sign change of the boat's heading, 2 s debounce) is
// attributed to the LAST WRITER of desiredHeading on that frame, read by wrapping
// applyAvoidance per boat: NAV (the nav heading itself was on the new tack — scoreTack /
// layline / commitment), AVOID (nav asked for the old tack, applyAvoidance returned the
// new one), WIGGLE/ESCAPE/FORCE (the flags that pre-empt avoidance), SPIN (a penalty
// turn). Also where: distance to the mark and rivals within 120 u at the tack.
//   node _fl_tacks.js <trials> <seed0> <tree>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const TRIALS = +(process.argv[2] || 8), SEED0 = +(process.argv[3] || 9400), ROOT = path.join(__dirname, process.argv[4] || 'treeFL0');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR', e.message.slice(0, 200)));
  await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
  await page.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', character: AI_CONFIG[0].name })); });
  const all = [];
  for (let i = 0; i < TRIALS; i++) {
    const seed = SEED0 + i;
    const r = await page.evaluate(async (seed) => {
      window.evalHarness.seed = seed; resetGame(); startRace(); state.course.cutoff = 900;
      const pl = state.boats.find(b => b.isPlayer); applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
      const nine = state.boats.filter(b => b !== pl); pl.ai.startLinePct = Math.max(0.05, Math.min(0.9, nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length)); pl.ai.setupDist = 300;
      const bots = state.boats.filter(b => !b.isPlayer);
      const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
      const mk = state.course.marks.find(m => m.id === 'mark-top' || (m.x === 420 && m.y === 7150)) || { x: 420, y: 7150 };
      const tacks = []; const st = bots.map(b => ({ last: 0, lastT: -9, line: null, r2: null }));
      const dt = 1 / 60;
      for (let it = 0; it < 60 * 150; it++) {
        update(dt);
        // the controller is created lazily on the first update — wrap it then (⚠ not after startRace)
        for (const b of bots) { const c = b.controller; if (!c || c.__wrapped) continue; const orig = c.applyAvoidance; c.__navIn = null; c.__avOut = null; c.applyAvoidance = function (h, s2) { this.__navIn = h; const o = orig.call(this, h, s2); this.__avOut = o; return o; }; c.__wrapped = 1; }
        if (state.race.status !== 'racing') continue;
        const t = state.race.timer;
        for (let k = 0; k < bots.length; k++) {
          const b = bots[k], s = st[k], c = b.controller;
          if (s.line == null && b.raceState.leg >= 1) s.line = t;
          if (s.r2 == null && b.raceState.leg >= 2) s.r2 = t;
          if (s.line == null || s.r2 != null) continue;
          const wd = getWindAt(b.x, b.y).direction; const twa = norm(b.heading - wd); const tk = twa > 0 ? 1 : -1;
          if (s.last && tk !== s.last && t - s.lastT > 2) {
            s.lastT = t;
            const navTk = c.__navIn != null ? (norm(c.__navIn - wd) > 0 ? 1 : -1) : 0;
            const avTk = c.__avOut != null ? (norm(c.__avOut - wd) > 0 ? 1 : -1) : 0;
            let owner = 'nav';
            if (b.raceState.penaltyTurns > 0 || c.penaltySpinActive || (c.spinning)) owner = 'spin';
            else if (c.wiggleActive) owner = 'wiggle';
            else if (c.escActive) owner = 'escape';
            else if (c.livenessState === 'force' || c.livenessState === 'recovery') owner = 'force';
            else if (navTk === tk) owner = 'nav';
            else if (avTk === tk) owner = 'avoid';
            else owner = 'other';
            const near = bots.filter(o => o !== b && Math.hypot(o.x - b.x, o.y - b.y) < 120).length;
            const dbg = c.__dbg ? Object.assign({}, c.__dbg) : null; tacks.push({ dbg, name: b.name, t: +t.toFixed(1), owner, dMark: Math.round(Math.hypot(b.x - mk.x, b.y - mk.y)), near, spd: +(b.speed * 4).toFixed(1), dev: +(c.lastAvoidDeviation || 0).toFixed(2), sinceLine: +(t - s.line).toFixed(1) });
          }
          if (tk !== s.last) s.last = tk;
        }
        if (st.every(s => s.r2 != null) || t > 130) break;
      }
      return { tacks, beats: st.map((s, k) => ({ name: bots[k].name, line: s.line, r2: s.r2 })) };
    }, seed);
    for (const x of r.tacks) all.push({ seed, ...x });
    console.log(`seed ${seed}: ${r.tacks.length} tacks; ` + r.tacks.map(x => `${x.name}@${x.t}(${x.owner},d${x.dMark},n${x.near}${x.dbg ? ',S' + x.dbg.S + '/P' + x.dbg.P + ',sh' + x.dbg.shift + ',ll' + x.dbg.layline + ',tg' + x.dbg.tgt : ''})`).join(' '));
  }
  const by = {}; for (const x of all) by[x.owner] = (by[x.owner] || 0) + 1;
  console.log(`\nTOTAL ${all.length} tacks on leg 1 over ${TRIALS * 10} boats (${(all.length / (TRIALS * 10)).toFixed(2)}/boat): ` + Object.entries(by).map(([k, v]) => `${k} ${v} (${(100 * v / all.length).toFixed(0)}%)`).join(', '));
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  for (const o of Object.keys(by)) { const S = all.filter(x => x.owner === o); console.log(`  ${o}: dMark med ${med(S.map(x => x.dMark))}, rivals<120u med ${med(S.map(x => x.near))}, ${(100 * S.filter(x => x.near > 0).length / S.length).toFixed(0)}% with a rival inside 120 u, sinceLine med ${med(S.map(x => x.sinceLine))} s, spd med ${med(S.map(x => x.spd))} kt`); }
  const firstT = {}; for (const x of all) { const k = x.seed + x.name; firstT[k] = (firstT[k] || 0) + 1; }
  const perBoat = Object.values(firstT); console.log(`  boats with ≥1 tack ${perBoat.length}/${TRIALS * 10}; tacks/boat dist: ` + [0, 1, 2, 3, 4, 5].map(n => `${n}:${n === 0 ? TRIALS * 10 - perBoat.length : perBoat.filter(v => v === n).length}`).join(' ') + ` 6+:${perBoat.filter(v => v >= 6).length}`);
  fs.writeFileSync(path.join(__dirname, '_fl_tacks.json'), JSON.stringify(all));
  await browser.close();
})();
