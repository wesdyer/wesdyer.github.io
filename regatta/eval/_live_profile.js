// PASTE THIS INTO THE BROWSER CONSOLE while a race is running, then sail.
//
// ⚠️ THE ONE MEASUREMENT THAT CANNOT BE AUTOMATED FROM HERE. Chrome suspends rAF entirely in
// a hidden tab, so a driven browser session records nothing unless the window is genuinely
// in front — and headless is a software rasteriser whose numbers do not transfer (it stalls
// ~250 ms on roughly one paint in twelve, on a FROZEN world with the game paused; see
// eval/_frame_spikes.js). So the state that matters — downwind, planing, surfing — has to be
// sailed by hand with the tab in front.
//
//   __prof.start()   begin recording
//   __prof.report()  print, split by point of sail
//   __prof.stop()    unhook
(() => {
  if (window.__prof) return console.log('already installed — call __prof.report()');
  const P = { upd: [], drw: [], frames: [], tag: [], on: false };
  const oU = window.update, oD = window.draw;
  window.update = function (dt) { const t = performance.now(); const r = oU.call(this, dt); if (P.on) P.upd.push(performance.now() - t); return r; };
  window.draw = function () {
    const t = performance.now(); const r = oD.call(this);
    if (P.on) {
      P.drw.push(performance.now() - t);
      const b = state.boats[0], sw = b && b.swell;
      P.tag.push(sw && sw.cosPsi > 0.3 && sw.surf01 > 0.35 ? 'surf'
               : b && b.raceState.isPlaning ? 'plane'
               : sw && sw.cosPsi < -0.3 ? 'upwind' : 'other');
    }
    return r;
  };
  let last = 0;
  (function tick(ts) { if (P.on && last) P.frames.push(ts - last); last = ts; requestAnimationFrame(tick); })(0);
  const q = (a, f) => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length * f)] : 0;
  P.start = () => { P.upd.length = P.drw.length = P.frames.length = P.tag.length = 0; last = 0; P.on = true; console.log('recording — sail for 30s or so, then __prof.report()'); };
  P.stop = () => { P.on = false; window.update = oU; window.draw = oD; delete window.__prof; console.log('unhooked'); };
  P.report = () => {
    const line = (nm, a) => `${nm.padEnd(9)} n=${String(a.length).padEnd(6)} p50 ${q(a,.5).toFixed(2)}  p90 ${q(a,.9).toFixed(2)}  p99 ${q(a,.99).toFixed(2)}  max ${(Math.max(...a)||0).toFixed(1)}`;
    console.log(line('frame ms', P.frames.filter(x => x < 500)));
    console.log(line('update', P.upd));
    console.log(line('draw', P.drw));
    for (const k of ['surf', 'plane', 'upwind', 'other']) {
      const idx = P.tag.map((t, i) => t === k ? i : -1).filter(i => i >= 0);
      if (idx.length < 20) continue;
      console.log('  ' + line(k, idx.map(i => P.drw[i] + (P.upd[i] || 0))) + '   (update+draw)');
    }
    const budget = 1000 / 60;
    console.log(`over 16.7ms (60Hz budget): ${P.drw.map((d,i)=>d+(P.upd[i]||0)).filter(x=>x>budget).length} / ${P.drw.length}`);
  };
  window.__prof = P;
  console.log('installed — call __prof.start()');
})();
