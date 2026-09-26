// OTTER POINT — its wildlife (js/wildlife.js: sea otters, California sea lions, great white sharks,
// blue whales) and the feat the Wildlife rung reads. Headless, real page.
//
//   node regatta/eval/test_otter.js     (from the repo root, like every suite)
//
// Checks: the rafts, haul-outs, sharks and whales are all there; no Math.random; otters stay in the
// water, hauled sea lions on their rock, swimmers off the land, sharks never inside rock; otters
// react to a close boat; a boat puts sea lions off a rock and they come back; a shark hunts a sea
// lion in a breach; a shark comes to shadow the player; blue whales blow and lunge; Blue Water is
// the player's only, only racing, only alongside.
const { chromium } = require('playwright');
const path = require('path');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    const r = await p.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const out = {}, feats = [];
        GameEvents.on('player-feat', (e) => feats.push(e));
        const d = Wildlife.debug();
        out.rafts = d.seaOtterRafts.length; out.otters = d.seaOtterRafts.reduce((n, G) => n + G.members.length, 0);
        out.hauls = d.slHauls.length; out.lions = d.slHauls.reduce((n, H) => n + H.members.length, 0);
        out.groups = d.slGroups.length; out.whites = d.whites.length; out.blues = d.bluePods.reduce((n, W) => n + W.members.length, 0);
        const away = (bt) => { bt.x = 1e6 + (bt.id || 0) * 500; bt.y = 1e6; };
        for (const bt of state.boats) away(bt);
        const solid = (x, y) => ((state.course && state.course.islands) || []).some(s => !s.awash && s.vertices && VenueDoc.traits(s).hard && Math.hypot(x - s.x, y - s.y) < (s.radius || 1e9) && pointInPoly(x, y, s.vertices));
        const real = Math.random; let calls = 0; Math.random = () => { calls++; return real(); };
        let otterDry = 0, lionOff = 0, swimDry = 0, sharkRock = 0, blows = 0, lunges = 0, surfaced = 0; const lungeSeen = new Set();
        // blue whales: they swim, never spin in place (a turn no tighter than ~1.5 body lengths), and
        // their whole length stays off the rocks
        let spin = 0, whaleRock = 0; const prevW = new Map(); const departures = new Set(), travellers = new Set();
        const whaleCheck = () => { for (const W of d.bluePods) for (const m of W.members) { const p0 = prevW.get(m);
            if (p0) { const ds = Math.hypot(m.x - p0.x, m.y - p0.y), dh = Math.abs(((m.h - p0.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (dh > 0.002 && dh / Math.max(ds, 1e-6) > 1 / (1.2 * m.len)) spin++; }
            prevW.set(m, { x: m.x, y: m.y, h: m.h });
            for (const u of [-0.45, -0.2, 0, 0.2, 0.42]) if (solid(m.x + Math.sin(m.h) * m.len * u, m.y - Math.cos(m.h) * m.len * u)) whaleRock++; } };
        for (let i = 0; i < 30 * 600; i++) { Wildlife.update(1 / 30);
            if (i % 10) continue;
            for (const G of d.seaOtterRafts) for (const m of G.members) if (pointOnLand(m.x, m.y)) otterDry++;
            for (const H of d.slHauls) for (const m of H.members) if ((m.mode === 'lie' || m.mode === 'upright') && !pointInPoly(m.x, m.y, H.V)) lionOff++;
            for (const G of Wildlife.debug().slGroups) for (const q of G.members) if (!q.gone && q.z === 0 && !(q.flung > 0) && pointOnLand(q.x, q.y)) swimDry++;
            for (const W of d.whites) if (W.mode !== 'breach' && solid(W.x, W.y)) sharkRock++;
            whaleCheck();
            for (const G of Wildlife.debug().slGroups) if (G.from) departures.add(G);
            for (const G of d.seaOtterRafts) for (const m of G.members) if (m.mode === 'travel') travellers.add(m.i + G.id);
            blows = Math.max(blows, Wildlife.debug().blueBlows.length);
            for (const W of d.bluePods) for (const m of W.members) { if (m.mode === 'surface') surfaced++; if (m.lunge > 0.5) lungeSeen.add(m); if (m.lunge > 0.5) lunges++; }
        }
        Math.random = real;
        Object.assign(out, { calls, otterDry, lionOff, swimDry, sharkRock, blows, lunges: lungeSeen.size, surfaced, spin, whaleRock, departures: departures.size, travellers: travellers.size });
        // otters react to a close boat: they dive or swim off
        { const G = d.seaOtterRafts[1], m = G.members.find(q => q.mode === 'float' || q.mode === 'eat') || G.members[0]; const me = state.boats[0]; me.x = m.x + 60; me.y = m.y; me.opacity = 1;
          for (let i = 0; i < 20; i++) Wildlife.update(1 / 30); out.otterReact = G.members.filter(q => ['dive', 'under', 'swim', 'back'].includes(q.mode)).length; away(me); }
        // a boat puts sea lions off a rock; after a while they are back on it
        { const H = d.slHauls.find(h => h.id === 'prop-458'), me = state.boats[0]; const n0 = H.members.length;
          me.x = H.C.x + 300; me.y = H.C.y; for (let i = 0; i < 30 * 4; i++) { me.x -= 60 / 30; Wildlife.update(1 / 30); }
          const went = H.members.filter(m => m.mode === 'shuffle' || m.mode === 'gone'); out.flushed = went.length; away(me);
          // (others come and go to sea all the time now: follow the ones the boat put in)
          const back = new Set(); for (let i = 0; i < 30 * 240; i++) { Wildlife.update(1 / 30); for (const m of went) if (m.mode === 'lie' && pointInPoly(m.x, m.y, H.V)) back.add(m); }
          out.back = back.size + '/' + went.length; }
        // a shark hunts a sea lion: a breach, a splash, and the sea lion thrown or taken
        { const open = (x, y) => { for (let r = 0; r <= 150; r += 30) for (let i = 0; i < 8; i++) if (pointOnLand(x + Math.cos(i * 0.785) * r, y + Math.sin(i * 0.785) * r)) return false; return true; };
          const L = Wildlife.debug().slGroups, gi = L.findIndex(G => G.members.filter(q => !q.gone).length >= 2); const G = L[gi];
          // staged in clear water (the shark rightly refuses a sea lion by the rocks): a raft moved to open sea
          let sp = null; for (let r = 0; r < 2000 && !sp; r += 100) for (let i = 0; i < 16 && !sp; i++) { const x = G.x + Math.cos(i * 0.39) * r, y = G.y + Math.sin(i * 0.39) * r; if (open(x, y)) sp = { x, y }; }
          G.x = sp.x; G.y = sp.y; G.tx = sp.x; G.ty = sp.y; G.mode = 'raft'; G.t = 100; G.H = Object.assign({}, G.H, { sea: sp }); G.from = null; for (const q of G.members) { q.x = sp.x + q.ox * 0.5; q.y = sp.y + q.oy * 0.5; q.leap = 0; q.z = 0; } const me = state.boats[0]; me.x = G.x; me.y = G.y + 100; me.opacity = 0.05;
          state.camera.x = G.x; state.camera.y = G.y;
          Wildlife.forceHunt(0, gi); const W = d.whites[0]; let breach = false, crash = true, n = 0;
          const modes = []; while (n++ < 30 * 30 && !(breach && W.mode !== 'breach')) { Wildlife.update(1 / 30); if (modes[modes.length - 1] !== W.mode) modes.push(W.mode); if (W.mode === 'breach' || W.mode === 'strike') breach = true; } out.foam = Wildlife.debug().foams.length; out.modes = modes.join('>');
          out.breach = breach; out.crash = crash; out.outcome = W.caught ? 'taken' : 'thrown'; away(me); }
        // a shark comes up to shadow the player's boat as it sails past its patch
        { const W = d.whites[2]; W.cool = 0; W.mode = 'patrol'; const me = state.boats[0]; me.opacity = 1; me.heading = -Math.PI / 2; me.x = W.x + 380; me.y = W.y + 40;
          let shadow = 0, near = 1e9; for (let i = 0; i < 30 * 12; i++) { me.x -= 70 / 30; Wildlife.update(1 / 30); if (W.mode === 'shadow') { shadow++; near = Math.min(near, Math.hypot(W.x - me.x, W.y - me.y)); } }
          out.shadow = shadow / 30; out.shadowNear = Math.round(near); away(me); }
        // a shark after a sea otter caught out of the kelp: it bolts for the bed, and it always gets away
        { const kelp = state.course.islands.filter(s2 => VenueDoc.traits(s2).veg === 'kelp'), inK = (x, y) => kelp.some(K => pointInPoly(x, y, K.vertices));
          const open = (x, y) => { for (let r = 0; r <= 300; r += 50) for (let i = 0; i < 8; i++) { const px = x + Math.cos(i * 0.785) * r, py = y + Math.sin(i * 0.785) * r; if (pointOnLand(px, py) || inK(px, py)) return false; } return true; };
          const G = d.seaOtterRafts[1], m = G.members.find(q => !q.pup); let sp = null; for (let r = 400; r < 1200 && !sp; r += 50) for (let i = 0; i < 16 && !sp; i++) { const x = G.cx + Math.cos(i * 0.39) * r, y = G.cy + Math.sin(i * 0.39) * r; if (open(x, y)) sp = { x, y }; }
          m.mode = 'travel'; m.x = sp.x; m.y = sp.y; m.tx = G.cx; m.ty = G.cy; m.away = true; m.homeG = G; m.leg = 'home';
          const W = d.whites[0], a = Math.atan2(sp.x - G.cx, -(sp.y - G.cy)); W.x = m.x + Math.sin(a) * 250; W.y = m.y - Math.cos(a) * 250; W.mode = 'chaseOtter'; W.otter = m; W.t = 12; W.depth = 0.05;
          let bolted = false, n = 0; while (n++ < 30 * 30 && (W.mode === 'chaseOtter' || W.mode === 'breach')) { Wildlife.update(1 / 30); if (m.mode === 'bolt') bolted = true; }
          out.otterBolt = bolted; out.otterSafe = G.members.includes(m) && !m.gone; }
        // GET OUT OF THE WAY: a boat at racing speed (130 u/s) driven straight through an otter raft and
        // through a travelling sea-lion group — count the frames anything at the surface is under the hull
        { const me = state.boats[0]; me.opacity = 1;
          const drive = (x, y, h) => { let under = 0; me.heading = h; me.speed = 130 / 60; me.velocity = { x: Math.sin(h) * me.speed, y: -Math.cos(h) * me.speed }; me.x = x - Math.sin(h) * 500; me.y = y + Math.cos(h) * 500;
            const fx = Math.sin(h), fy = -Math.cos(h), hit = (px, py) => { const dx = px - me.x, dy = py - me.y, a = Math.max(-27, Math.min(27, dx * fx + dy * fy)); return Math.hypot(dx - fx * a, dy - fy * a) < 14; };
            for (let i = 0; i < 30 * 8; i++) { me.x += me.velocity.x * 60 / 30; me.y += me.velocity.y * 60 / 30; Wildlife.update(1 / 30); const D = Wildlife.debug();
              for (const G of D.seaOtterRafts) for (const m of G.members) if (m.mode !== 'under' && m.mode !== 'dive' && hit(m.x, m.y)) under++;
              for (const G of D.slGroups) for (const q of G.members) if (!q.gone && !(q.z > 0.15) && !(q.flung > 0) && hit(q.x, q.y)) under++; }
            me.x = 1e6; me.y = 1e6; me.velocity = { x: 0, y: 0 }; return under; };
          const G = d.seaOtterRafts[3], m0 = G.members.find(q => q.mode === 'float' || q.mode === 'eat') || G.members[0];
          out.underOtter = drive(m0.x, m0.y, 1.1);
          const L = Wildlife.debug().slGroups.find(G2 => G2.members.length >= 4 && G2.mode !== 'inspect'); const q0 = L.members[0];
          out.underLion = drive(q0.x, q0.y, L.h + Math.PI / 2); }
        // the sailing objectives (sim/course.js OTTER_RUN), on scripted paths through checkOtterRun
        { const me = state.boats[0]; const ids = () => feats.filter(e => /^otter:(inside|tip|arch)/.test(e.id)).map(e => e.id + (e.value != null ? '=' + e.value : ''));
          const fresh = () => { state.race.status = 'finished'; checkOtterRun(); state.race.status = 'racing'; me.raceState.finished = false; feats.length = 0; };
          const sail = (pts) => { for (let k = 0; k < pts.length - 1; k++) for (let i = 0; i <= 20; i++) { me.x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * i / 20; me.y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * i / 20; checkOtterRun(); } return ids().join(' '); };
          fresh(); out.insideTwo = sail([[-800, -3940], [-400, -3940], [900, -4470], [1250, -4470]]);
          fresh(); out.outsideKelp = sail([[-800, -4700], [1250, -5200], [3000, -5700]]);
          fresh(); out.archOnly = sail([[-2150, -4890], [-1600, -4890]]);
          fresh(); out.tipArch = sail([[-5000, -1900], [-6200, -2300], [-6000, -3700], [-4200, -3900], [-2150, -4890], [-1600, -4890]]);
          fresh(); out.halfTip = sail([[-5000, -1900], [-6200, -2300], [-5000, -1900], [-2150, -4890], [-1600, -4890]]);
          state.race.status = 'prestart'; feats.length = 0; out.preGun = sail([[-800, -3940], [-400, -3940]]); state.race.status = 'racing'; }
        // Witness the Hunt: a kill near the racing player counts; not before the gun, not from far off
        const n = () => feats.filter(e => e.id === 'otter:hunt').length;
        // the player's view is the camera: put it dx off the strike (on screen at 300, off it at 1500)
        const kill = (dx) => { const L = Wildlife.debug().slGroups, G = L.find(G2 => G2.members.some(q2 => !q2.gone)); const q = G.members.find(q2 => !q2.gone);
            const me = state.boats[0]; me.x = q.x + dx; me.y = q.y; state.camera.x = me.x; state.camera.y = me.y; state.camera.rotation = 0;
            const W = d.whites[1]; W.killT = 0; W.sawSprint = false; W.target = { G, q }; W.mode = 'sprint'; W.t = 0.001; W.depth = 0.2; W.x = q.x - 20; W.y = q.y;
            for (let i = 0; i < 3; i++) Wildlife.update(1 / 30); return W.caught && W.killT > 0; };
        const takeNear = (dx) => { for (let k = 0; k < 40; k++) { if (kill(dx)) return true; } return false; };
        state.race.status = 'prestart'; out.huntPreTook = takeNear(300); out.huntPre = n();
        state.race.status = 'racing'; state.boats[0].raceState.finished = false;
        out.huntFarTook = takeNear(1500); out.huntFar = n();
        out.huntNearTook = takeNear(300); out.huntNear = n();
        out.rows = Unlocks.ACHIEVEMENTS.filter(x => x.venue === 'otter').map(x => x.char).join(',');
        return out;
    });
    ok(r.rafts === 10 && r.otters >= 40, `ten otter rafts in the kelp (${r.rafts}, ${r.otters} otters)`);
    ok(r.hauls === 9 && r.lions >= 60, `nine sea-lion haul-outs (${r.hauls}, ${r.lions} animals)`);
    ok(r.groups >= 5 && r.whites === 4 && r.blues === 6, `sea lions in the water, four great whites, six blue whales (${r.groups}/${r.whites}/${r.blues})`);
    ok(r.calls === 0, `wildlife never calls Math.random (${r.calls})`);
    ok(r.otterDry === 0, `otters stay in the water (${r.otterDry} samples on land)`);
    ok(r.lionOff === 0, `hauled-out sea lions stay on their rock (${r.lionOff})`);
    ok(r.swimDry === 0, `swimming sea lions stay off the land (${r.swimDry})`);
    ok(r.sharkRock === 0, `sharks never inside rock (${r.sharkRock})`);
    ok(r.spin === 0, `blue whales never turn on the spot (${r.spin} samples turning tighter than 1.2 body lengths)`);
    ok(r.whaleRock === 0, `blue whales keep their whole length off the rocks (${r.whaleRock})`);
    ok(r.blows > 0 && r.surfaced > 0, `blue whales surface and blow (${r.blows} blows at once at most)`);
    ok(r.lunges >= 1, `a blue whale lunges through krill in ten minutes (${r.lunges})`);
    ok(r.departures >= 10, `sea lions head out to sea and back all the time (${r.departures} groups went out in ten minutes)`);
    ok(r.travellers >= 3, `sea otters cross open water between beds (${r.travellers} in ten minutes)`);
    ok(r.otterBolt && r.otterSafe, 'a shark after an otter out of the kelp: it bolts for the bed and gets away');
    ok(r.otterReact >= 1, `otters dive or swim off from a close boat (${r.otterReact})`);
    ok(r.flushed >= 1, `a boat puts sea lions off the bird rock (${r.flushed})`);
    ok(+r.back.split('/')[0] >= +r.back.split('/')[1] - 1, `and they haul out again (${r.back} of them back on the rock; a shark may take one)`);
    ok(r.breach && r.foam >= 1, `a great white sprints in and strikes: foam (${r.outcome}; ${r.modes})`);
    ok(r.shadow >= 3 && r.shadowNear < 200, `a great white shadows the player's boat (${r.shadow.toFixed(1)} s, closest ${r.shadowNear} u)`);
    ok(r.underOtter <= 3, `otters get out of a boat's way (${r.underOtter} frames under the hull)`);
    ok(r.underLion <= 3, `sea lions get out of a boat's way (${r.underLion} frames under the hull)`);
    ok(r.insideTwo === 'otter:inside=1 otter:inside=2', `Inside the Kelp Line counts each bed passed on the inside (${r.insideTwo})`);
    ok(r.outsideKelp === '' && r.preGun === '', 'nothing for the offshore line, nothing before the gun');
    ok(r.tipArch === 'otter:tip otter:arch', `Tip and Arch: round the tip, then the arch (${r.tipArch})`);
    ok(r.archOnly === '' && r.halfTip === '', 'Tip and Arch: not the arch alone, not half way round the tip');
    ok(r.huntPreTook && r.huntPre === 0, 'Witness the Hunt: not before the gun');
    ok(r.huntFarTook && r.huntFar === 0, 'Witness the Hunt: not off screen (1,500 u away)');
    ok(r.huntNearTook && r.huntNear === 1, `Witness the Hunt: a kill on screen counts (${r.huntNear})`);
    ok(r.rows === 'Barker,Ruby,Gilt,Freckle,Maw,Azure', `six Otter Point rows (${r.rows})`);
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
