// A LOOK-BENCH for the venue animals (js/wildlife.js). Browser only — load it into a running
// index.html (served over http):
//
//   const s = document.createElement('script'); s.src = 'eval/_wildlife_bench.js?' + Date.now(); document.head.appendChild(s);
//   __bench('lake')          // or 'pond', 'bay'; __bench(null) removes it
//
// Draws every animal on the venue's water colour at GAME scale (the camera's own zoom) and at
// 3x, with the Cove's gull, pelican and porpoise as the reference row and a hull for size. It
// animates, so behaviour poses (dive, flap, dance, dip) can be seen cycling.
(function () {
    let raf = 0;
    window.__bench = function (venue) {
        cancelAnimationFrame(raf);
        const old = document.getElementById('wl-bench'); if (old) old.remove();
        if (!venue) return;
        const A = Wildlife.art;
        const d = VenueDoc.get(venue);
        const water = (d && d.palette && (d.palette.heroColor || d.palette.baseColor || d.palette.water)) || '#2b6f8c';
        const dpr = window.devicePixelRatio || 1;
        const W = 1500, H = 800;
        const c = document.createElement('canvas'); c.id = 'wl-bench';
        c.width = W * dpr; c.height = H * dpr; c.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px;z-index:99999;`;
        document.body.appendChild(c);
        const g = c.getContext('2d');
        // the camera's world-to-css scale
        // The game draws world units 1:1 onto its canvas; the canvas is CSS-scaled onto the page.
        const zoom = canvas.getBoundingClientRect().width / canvas.width;
        let t = 0, last = performance.now();
        const boat = state.boats && state.boats[0];
        const mk = (o) => Object.assign({ x: 0, y: 0, h: 0, sink: 0, flap: 0, yaw: 0, trail: [], bob: 0, stick: false, splash: 0, slap: 0, rise: 0 }, o);
        function row(y0, scale, label) {
            g.save(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '12px sans-serif'; g.fillText(label, 10, y0 - 70 * scale / 3 - 8); g.restore();
            const items = [];
            const cyc = (p) => (t % p) / p;
            // reference: the Cove's animals
            items.push(['gull glide', (x, y) => A.drawGullFlying(g, x, y, -0.4, 40, 0)]);
            items.push(['gull flapping', (x, y) => A.drawGullFlying(g, x, y, 0.3, 40, t * 7)]);
            items.push(['pelican', (x, y) => A.drawPelicanFlying(g, x, y, 0.3, 60, t * 4.5, false)]);
            items.push(['pelican dive', (x, y) => A.drawPelicanFlying(g, x, y, 0.2, 30, 0, true)]);
            items.push(['pelican sitting', (x, y) => A.drawPelicanSitting(g, x, y, -0.3, 1.2 + (t % 3))]);
            items.push(['porpoise', (x, y) => A.drawPorpoise(g, { phase: cyc(3), sx: x, sy: y, sh: 0.2 })]);
            items.push(['perched gull', (x, y) => A.drawGullPerched(g, x, y, 0.2)]);
            items.push(['bait boil', (x, y) => A.drawBoilAt(g, x, y, t)]);
            // pond
            items.push(['turtle', (x, y) => A.drawTurtle(g, x, y, 0.4, 1, 0)]);
            items.push(['turtle wet', (x, y) => A.drawTurtle(g, x, y, -2.4, 1, 1)]);
            items.push(['turtle peek', (x, y) => A.drawTurtleUnder(g, { ux: x, uy: y + 10, uh: 0.3, peek: 0.8 })]);
            const dance = Math.sin(t * 7) * 0.55;
            items.push(['grebe', (x, y) => { const b = mk({ x, y, h: 0.3 }); b.trail = [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ x: x - Math.sin(0.3) * i * 5, y: y + Math.cos(0.3) * i * 5 })); A.drawWakeTrail(g, b, 5.5, 1.3, 0.35); A.drawGrebe(g, b); }]);
            items.push(['grebe dance', (x, y) => A.drawGrebe(g, mk({ x, y, h: 1.57, yaw: dance }))]);
            items.push(['duckling swim', (x, y) => { const b = mk({ x, y, h: 0.3, swim: 1 }); b.trail = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => ({ x: x - Math.sin(0.3) * i * 3.5, y: y + Math.cos(0.3) * i * 3.5 })); A.drawWakeTrail(g, b, 5.5, 1.9, 0.45); A.drawDuckling(g, b, t, 0); }]);
            items.push(['duckling rest', (x, y) => A.drawDuckling(g, mk({ x, y, h: -0.6, swim: 0 }), t, 2)]);
            // lagoon: the cruisers, at three depths, plus a leap and a turtle up for air
            const cr = (kind, depth, extra) => Object.assign({ kind, x: 0, y: 0, h: 0.25, depth, ph: t * (kind === 'reefshark' ? 5.5 : kind === 'eagleray' ? 1.6 : 2.2), size: 1, mode: 'cruise', ring: 0, z: 0 }, extra || {});
            items.push(['sea turtle', (x, y) => A.drawCruiser(g, cr('seaturtle', 0.35, { x, y }))]);
            items.push(['turtle breathing', (x, y) => A.drawCruiser(g, cr('seaturtle', 0.02, { x, y, h: -0.8, ring: 1 - cyc(2.5) }))]);
            items.push(['turtle deep', (x, y) => A.drawCruiser(g, cr('seaturtle', 0.85, { x, y, h: 1.9 }))]);
            items.push(['eagle ray', (x, y) => A.drawCruiser(g, cr('eagleray', 0.3, { x, y: y - 14 }))]);
            items.push(['ray deep', (x, y) => A.drawCruiser(g, cr('eagleray', 0.8, { x, y: y - 14, h: -0.6 }))]);
            items.push(['ray leap', (x, y) => A.drawCruiser(g, cr('eagleray', 0, { x, y: y - 14, mode: 'leap', z: Math.sin(Math.PI * cyc(2)) }))]);
            items.push(['reef shark', (x, y) => A.drawCruiser(g, cr('reefshark', 0.3, { x, y }))]);
            items.push(['shark deep', (x, y) => A.drawCruiser(g, cr('reefshark', 0.8, { x, y, h: 2.4 }))]);
            // lake
            items.push(['loon', (x, y) => { const b = mk({ x, y, h: -0.3 }); b.trail = [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ x: x + Math.sin(0.3) * i * 6, y: y + Math.cos(0.3) * i * 6 })); A.drawWakeTrail(g, b, 5.5, 1.3, 0.35); A.drawLoon(g, b); }]);
            items.push(['loon flap', (x, y) => A.drawLoon(g, mk({ x, y, h: 0, flap: 0.5 + 0.5 * Math.sin(t * 6) }))]);
            items.push(['loon dive', (x, y) => A.drawLoon(g, mk({ x, y, h: 0, sink: cyc(2) }))]);
            items.push(['beaver', (x, y) => { const b = mk({ x, y, h: 0.2 }); b.trail = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => ({ x: x - Math.sin(0.2) * i * 6, y: y + Math.cos(0.2) * i * 6 })); A.drawWakeTrail(g, b, 7, 2.4, 0.6); A.drawBeaver(g, b); }]);
            items.push(['beaver + stick', (x, y) => A.drawBeaver(g, mk({ x, y, h: -0.4, stick: true }))]);
            items.push(['slap', (x, y) => A.drawSlap(g, x, y, 1 - cyc(1.5))]);
            items.push(['moose graze', (x, y) => A.drawMoose(g, { x, y: y + 5, h: 0.2, alpha: 1, dip: 0.5 + 0.5 * Math.sin(t * 0.8), drip: 0, bob: t, sway: 0, mode: 'graze' })]);
            items.push(['moose alert', (x, y) => A.drawMoose(g, { x, y: y + 5, h: -0.5, alpha: 1, dip: 0, drip: cyc(2.5), bob: t, sway: t * 6, mode: 'alert' })]);
            const big = scale > 2, perLine = big ? 11 : items.length, gap = big ? 130 : 50;
            items.forEach(([name, fn], k) => {
                const x = 70 + (k % perLine) * gap, y = y0 + Math.floor(k / perLine) * (big ? 200 : 0);
                g.save(); g.translate(x, y); g.scale(scale, scale); fn(0, 0); g.restore();
                if (big) { g.fillStyle = 'rgba(255,255,255,0.65)'; g.font = '11px sans-serif'; g.fillText(name, x - 30, y + 90); }
            });
            // a hull for size
            if (boat && typeof drawBoat === 'function') { g.save(); g.translate(big ? 1420 : 70 + items.length * gap, big ? y0 + 200 : y0); g.scale(scale, scale); g.rotate(-0.3); drawBoat(g, boat); g.restore(); }
        }
        function frame(now) {
            t += Math.min(0.05, (now - last) / 1000); last = now;
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.fillStyle = water; g.fillRect(0, 0, W, H);
            row(110, zoom, `GAME SCALE (${zoom.toFixed(2)} css px / unit) — ${venue} water`);
            row(340, 3, '3x');
            raf = requestAnimationFrame(frame);
        }
        raf = requestAnimationFrame(frame);
        return zoom;
    };
})();
