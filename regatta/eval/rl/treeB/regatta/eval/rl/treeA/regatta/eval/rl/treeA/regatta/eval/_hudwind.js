// Why is the HUD wind red nearly all the time on arctic?
// The readout compares the wind AT THE BOAT against `state.wind.speed`, which is the region
// blend at ONE POINT — the route centroid. Measure the spread the boat actually sails
// through against that single reference, on every venue.
const { chromium } = require('playwright');
const path = require('path');
const VENUES = ['ocean', 'bay', 'lake', 'glowtide', 'arctic'];

(async () => {
    const browser = await chromium.launch();
    for (const venue of VENUES) {
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        await page.addInitScript(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), venue);
        await page.goto('file://' + path.resolve('regatta/index.html'));
        await page.waitForTimeout(2200);
        const r = await page.evaluate(() => {
            const P0 = state.wind.pressure;
            const o = { venue: settings.venue, ref: +state.wind.speed.toFixed(2),
                        lo: P0 ? +P0.lo.toFixed(1) : null, med: P0 ? +P0.med.toFixed(1) : null, hi: P0 ? +P0.hi.toFixed(1) : null };
            startRace();
            while (state.race.status === 'prestart') update(1 / 60);
            const seen = [];
            let boost = 0, loss = 0, flat = 0;
            for (let f = 0; f < 60 * 60 * 4 && state.race.status === 'racing'; f++) {
                update(1 / 60);
                if (f % 6) continue;
                // Exactly the HUD's own arithmetic, for the player's boat.
                const p = state.boats.find(b => b.isPlayer) || state.boats[0];
                if (!p || p.raceState.finished) continue;
                const lw = getWindAt(p.x, p.y);
                const eff = lw.speed * (1.0 - p.badAirIntensity);
                seen.push(eff);
                // The HUD's own arithmetic, kept in step with it.
                const P = state.wind.pressure;
                const refLo = P ? P.lo : state.wind.speed - 0.1;
                const refHi = P ? P.hi : state.wind.speed + 0.1;
                if (p.badAirIntensity > 0.05) loss++;
                else if (eff > refHi) boost++;
                else if (eff < refLo) loss++;
                else flat++;
            }
            const s = seen.sort((a, b) => a - b);
            const q = f => +s[Math.min(s.length - 1, Math.floor(s.length * f))].toFixed(2);
            const n = boost + loss + flat || 1;
            o.p05 = q(.05); o.p50 = q(.5); o.p95 = q(.95);
            o.greenPct = +(boost / n * 100).toFixed(1);
            o.redPct = +(loss / n * 100).toFixed(1);
            o.whitePct = +(flat / n * 100).toFixed(1);
            return o;
        });
        console.log(`${r.venue.padEnd(10)} centroid ${String(r.ref).padStart(5)}  course lo/med/hi ${String(r.lo).padStart(5)}/${String(r.med).padStart(5)}/${String(r.hi).padStart(5)}   ` +
            `sailed p05/p50/p95 ${String(r.p05).padStart(5)}/${String(r.p50).padStart(5)}/${String(r.p95).padStart(5)}   ` +
            `GREEN ${String(r.greenPct).padStart(5)}%  RED ${String(r.redPct).padStart(5)}%  white ${String(r.whitePct).padStart(5)}%`);
        await page.close();
    }
    await browser.close();
})();
