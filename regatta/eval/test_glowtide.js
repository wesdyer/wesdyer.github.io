// GLOWTIDE STRAIT — its wildlife and the feats its objectives read (js/wildlife.js golden
// jellies, mantas, flying foxes, hawksbills, dugongs; GLOW_RUN / checkGlowRun in js/sim/course.js).
//   node regatta/eval/test_glowtide.js     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => {
    const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    const r = await p.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'glowtide', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame(); const out = {}, feats = []; GameEvents.on('player-feat', (e) => feats.push(e));
        const d = Wildlife.debug(); out.jel = d.jellyBloom.jel.length; out.mantas = d.mantas.length; out.dug = d.dugongs.length + (d.dugongs.some(G => G.calf) ? 'c' : ''); out.haw = d.hawksbills.map(H => H.mode).join(',');
        const me = state.boats[0]; for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; }
        const real = Math.random; let calls = 0; Math.random = () => { calls++; return real(); };
        const dry = { jel: 0, manta: 0, dug: 0, haw: 0 }, modes = new Set(); let foxes = 0, loops = 0;
        for (let i = 0; i < 30 * 480; i++) { Wildlife.update(1 / 30); if (i % 6) continue; const D = Wildlife.debug();
            for (const j of D.jellyBloom.jel) if (pointOnLand(j.x, j.y)) dry.jel++;
            for (const M of D.mantas) { if (pointOnLand(M.x, M.y)) dry.manta++; if (M.mode === 'loop') loops++; }
            for (const G of D.dugongs) if (pointOnLand(G.x, G.y)) dry.dug++;
            for (const H of D.hawksbills) { if (H.mode === 'swim' && pointOnLand(H.x, H.y)) dry.haw++; modes.add(H.mode); }
            foxes = Math.max(foxes, D.foxFlocks.length); }
        Math.random = real;
        out.calls = calls; out.dry = dry; out.modes = [...modes].sort().join(','); out.foxes = foxes; out.loops = loops;
        out.breathed = Wildlife.debug().dugongs.some(G => G.trail.length > 3);
        // the glow feat: counts time in ANOTHER boat's live glow; not before the gun; not its own
        const fresh = () => { state.race.status = 'finished'; checkGlowRun(1 / 30); state.race.status = 'racing'; me.raceState.finished = false; };
        const other = state.boats[1], val = () => { const v = feats.filter(e => e.id === 'glowtide:glow'); return v.length ? v[v.length - 1].value : 0; };
        other.bioTrail = [{ x: 0, y: 0, age: 1 }, { x: 5, y: 0, age: 1 }]; other.x = 20; other.y = 0;
        state.race.status = 'prestart'; me.x = 0; me.y = 0; for (let i = 0; i < 60; i++) checkGlowRun(1 / 30); out.glowPre = val();
        fresh(); me.x = 0; me.y = 0; for (let i = 0; i < 90; i++) checkGlowRun(1 / 30); out.glow3 = val();
        me.x = 60; me.y = 0; for (let i = 0; i < 90; i++) checkGlowRun(1 / 30); out.glowAway = val();
        other.bioTrail = [{ x: 0, y: 0, age: 0.1 }]; me.x = 0; for (let i = 0; i < 90; i++) checkGlowRun(1 / 30); out.glowFresh = val();   // its own fresh-churned stern water: not yet a wake
        other.bioTrail = []; other.x = 1e6;
        // the bloom
        fresh(); const n0 = feats.filter(e => e.id === 'glowtide:bloom').length;
        me.x = -2350 + 400; me.y = -2550; checkGlowRun(1 / 30); out.bloomFar = feats.filter(e => e.id === 'glowtide:bloom').length - n0;
        me.x = -2350 + 100; checkGlowRun(1 / 30); out.bloomIn = feats.filter(e => e.id === 'glowtide:bloom').length - n0;
        const A = Unlocks.ACHIEVEMENTS.filter(a => a.venue === 'glowtide'); out.rows = A.map(a => a.char).join(',');
        const base = { venue: 'glowtide', finished: true, won: true, feats: [], vals: {} }, T = (c, o) => A.find(a => a.char === c).test(Object.assign({}, base, o));
        out.veil = T('Veil', { vals: { 'glowtide:glow': 4.9 } }) && T('Veil', {}) && !T('Veil', { vals: { 'glowtide:glow': 5.2 } }) && !T('Veil', { won: false });
        out.bloom = T('Bloom', { feats: ['glowtide:bloom'] }) && !T('Bloom', {});
        return out;
    });
    ok(r.jel >= 400 && r.mantas === 3 && r.dug === '3c', `a golden jellyfish bloom (${r.jel}), 3 mantas, 3 dugongs with a calf (${r.dug})`);
    ok(r.calls === 0, `wildlife never calls Math.random (${r.calls})`);
    ok(Object.values(r.dry).every(v => v === 0), `jellies, mantas, dugongs and swimming turtles stay in the water (${JSON.stringify(r.dry)})`);
    ok(['crawldown', 'crawlup', 'nest', 'swim'].every(m => r.modes.includes(m)), `hawksbills swim, and nest: up the beach, dig, back down (${r.modes})`);
    ok(r.loops > 0 && r.foxes >= 1 && r.breathed, 'mantas somersault; flying foxes cross; dugongs graze leaving a trail');
    ok(r.glowPre === 0, 'glow: nothing counted before the gun');
    ok(r.glow3 >= 2.9 && r.glow3 <= 3.1 && r.glowAway === r.glow3 && r.glowFresh === r.glow3, `glow: 3 s in another boat's wake counts 3 s (${r.glow3}); out of it, or in fresh stern water, adds nothing`);
    ok(r.bloomFar === 0 && r.bloomIn === 1, 'the bloom: only inside it');
    ok(r.rows === 'Lure,Veil,Bloom,Drift,Prism', `five Glowtide rows (${r.rows})`);
    ok(r.veil && r.bloom, 'Veil: a win with 5 s or less in the glow; Bloom: the bloom');
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await b.close(); console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)'); process.exit(fails ? 1 : 0);
})();
