// SWEEP-PHASE RL ENVIRONMENT (pilot scope: armed-orbit target selection only).
// Wraps the game in reset/step semantics for a single hero boat, solo course,
// starting each episode at ring arrival and ending at outbound latch (success),
// leg change (success), or timeout (failure).
//
//   const env = await SweepEnv.make(seed);
//   let { obs } = await env.reset();
//   while (!done) ({ obs, reward, done, info } = await env.step([advance, speed]));
//
// Action: [advance, speed]
//   advance in [0.15, 1.2]  — orbit target angle offset (sgn applied inside)
//   speed   in [0.4, 1.0]   — speed request cap
// Observation (26 floats):
//   16 sector states around the mark at 1.1x zone (0 clear, 0.5 opening lead,
//      0.8 plugged, 1 hard/land), from botGrid + _soft + _futBlk
//   [16] sweep fraction banked (roundSweep / need)
//   [17] bearing from mark (sin), [18] (cos)
//   [19] dist / zone (clamped 0..3)
//   [20] boat speed / 3
//   [21] drift dir rel to bearing (sin), [22] (cos)
//   [23] twa (sin), [24] (cos)
//   [25] time-in-phase / 300
// Reward per 0.5s step: 3.0 * d(sweepFrac) - 0.02 - 0.3 * contact
//   (+5 terminal on outbound latch; -2 on timeout)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, 'treeA');

class SweepEnv {
    static async make(headless = true) {
        const env = new SweepEnv();
        env.browser = await chromium.launch({ headless });
        env.page = await env.browser.newPage();
        env.page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
        await env.page.addInitScript(() => {
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
        });
        await env.page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await env.page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        await env.page.evaluate(() => {
            window.__rl = {
                // Steering override consumed by an injected hook (see below): when
                // set, the armed-orbit block uses these instead of its own policy.
                act: null,
                contacts: 0,
            };
            const inner = window.onRaceEvent;
            window.onRaceEvent = (t, d) => {
                if (t === 'collision_island') window.__rl.contacts++;
                return inner && inner(t, d);
            };
        });
        return env;
    }

    // Run sim until hero is ARMED at the ring (fast-forward through start+beat).
    async reset(seed) {
        this.seed = seed;
        const r = await this.page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            window.__hero = bots[0];
            if (!window.__rlFleet) {
                bots.slice(1).forEach((b, i) => { b.x = -4000 + i * 150; b.y = 4500; b.raceState.finished = true; });
            }
            const pl = state.boats.find(b => b.isPlayer); pl.x = -4500; pl.y = 4700;
            window.__rl.act = null; window.__rl.contacts = 0;
            const dt = 1 / 60;
            for (let i = 0; i < 60 * 700; i++) {
                window.update(dt);
                if (state.race.status !== 'racing') continue;
                if (window.__hero.raceState.roundArmed) break;
                if (state.race.timer > 650) return { failed: 'never-armed', t: state.race.timer };
            }
            window.__rl.t0 = state.race.timer;
            window.__rl.lastSweep = window.__hero.raceState.roundSweep || 0;
            return { armed: true, t: state.race.timer };
        }, seed);
        if (r.failed) return { failed: r.failed };
        this._done = false;
        const obs = await this.page.evaluate(() => window.__rlObs());
        return { obs, info: r };
    }

    async step(action) {
        const r = await this.page.evaluate(async (act) => {
            window.__rl.act = act;   // consumed by the hook each nav pass
            const hero = window.__hero, dt = 1 / 60;
            const rm = state.course.roundMark;
            const need = rm.reqSweep * ROUND_SWEEP_TOL;
            const s0 = hero.raceState.roundSweep || 0;
            const c0 = window.__rl.contacts;
            let done = false, terminal = 0;
            for (let i = 0; i < 30; i++) {   // 0.5 s
                window.update(dt);
                if (hero.controller._outbound || hero.raceState.leg >= 2) { done = true; terminal = 5; break; }
                if (state.race.timer - window.__rl.t0 > 300) { done = true; terminal = -2; break; }
            }
            const s1 = hero.raceState.roundSweep || 0;
            const dFrac = (s1 - s0) / need;
            const contacts = window.__rl.contacts - c0;
            const reward = 3.0 * dFrac - 0.02 - 0.3 * contacts + terminal;
            return { obs: window.__rlObs(), reward, done,
                     info: { sweep: s1, need, t: state.race.timer - window.__rl.t0, contacts } };
        }, action);
        this._done = r.done;
        return r;
    }

    async close() { await this.browser.close(); }
}
module.exports = { SweepEnv };

// Smoke test: `node rl_env.js <seed>` — random policy, one episode.
if (require.main === module) {
    (async () => {
        const seed = parseInt(process.argv[2]) || 4244;
        // Inject the obs builder + steering hook into the page via an init addendum
        const env = await SweepEnv.make();
        await env.page.evaluate(() => {
            window.__rlObs = () => {
                const hero = window.__hero, rm = state.course.roundMark;
                const g = state.course.botGrid;
                const o = new Array(26).fill(0);
                for (let k = 0; k < 16; k++) {
                    const a = k / 16 * Math.PI * 2;
                    const cc = g.cell(rm.x + Math.cos(a) * rm.zone * 1.1, rm.y + Math.sin(a) * rm.zone * 1.1);
                    const id = cc[1] * g.n + cc[0];
                    if (g.at(cc[0], cc[1])) o[k] = g._futBlk && g._futBlk[id] ? 0.3 : 0;
                    else if (g._soft && g._soft[id] === 1) o[k] = 0.5;
                    else if (g._soft && g._soft[id] === 2) o[k] = 0.8;
                    else o[k] = 1;
                }
                const need = rm.reqSweep * ROUND_SWEEP_TOL;
                o[16] = Math.min(1.5, (hero.raceState.roundSweep || 0) / need);
                const brg = Math.atan2(hero.y - rm.y, hero.x - rm.x);
                o[17] = Math.sin(brg); o[18] = Math.cos(brg);
                o[19] = Math.min(3, Math.hypot(hero.x - rm.x, hero.y - rm.y) / rm.zone);
                o[20] = Math.min(1, hero.speed / 3);
                const lw = getWindAt(hero.x, hero.y);
                const dd = lw.direction - brg;      // drift ~ wind-driven
                o[21] = Math.sin(dd); o[22] = Math.cos(dd);
                const twa = hero.heading - lw.direction;
                o[23] = Math.sin(twa); o[24] = Math.cos(twa);
                o[25] = Math.min(1, (state.race.timer - window.__rl.t0) / 300);
                return o;
            };
        });
        const r0 = await env.reset(seed);
        if (r0.failed) { console.log('reset failed:', r0.failed); await env.close(); return; }
        console.log('armed at t=%s, obs[0..7]=%s', r0.info.t.toFixed(0),
            r0.obs.slice(0, 8).map(v => v.toFixed(1)).join(','));
        let done = false, total = 0, steps = 0;
        while (!done && steps < 700) {
            const act = [0.15 + Math.random() * 1.05, 0.4 + Math.random() * 0.6];
            const r = await env.step(act);
            total += r.reward; done = r.done; steps++;
            if (steps % 40 === 0) console.log(`step ${steps} sweep ${(r.info.sweep).toFixed(2)}/${r.info.need.toFixed(2)} t ${r.info.t.toFixed(0)} R ${total.toFixed(1)}`);
        }
        console.log('EPISODE END: steps', steps, 'return', total.toFixed(2));
        await env.close();
    })();
}
