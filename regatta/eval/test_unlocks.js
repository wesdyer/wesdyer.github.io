// CHARACTER UNLOCKS — the rulebook, the stores, and when a race counts (js/game/unlocks.js).
//
// Pure node: unlocks.js runs in a vm with a fake localStorage, a fake fleet and the real
// roster. No browser, so it is fast enough to run on every change to the file.
//
// Usage: node regatta/eval/test_unlocks.js   (from the repo root, like every suite)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const R = (p) => path.resolve('regatta', p);

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg); };

function world() {
    const store = {};
    const subs = {};
    const ctx = {
        console, Date, Math, JSON,
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; },
        },
        GameEvents: { on: (k, f) => (subs[k] = subs[k] || []).push(f), emit: (k, p) => (subs[k] || []).forEach(f => f(p)) },
        settings: { venue: 'bay', penaltiesEnabled: true, character: 'Bixby' },
        state: { race: { status: 'racing', timer: 0, unlocks: null }, boats: [] },
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    // roster.js declares AI_CONFIG with const; expose it for the test.
    vm.runInContext(fs.readFileSync(R('js/ai/roster.js'), 'utf8') + '\nwindow.AI_CONFIG = AI_CONFIG;', ctx);
    vm.runInContext(fs.readFileSync(R('js/game/unlocks.js'), 'utf8'), ctx);
    ctx.store = store;
    return ctx;
}

// A fleet in finish order. Each entry: [name, {finished, time, status, legRanks, top}]
function fleet(ctx, rows) {
    return rows.map(([name, o], i) => ({
        name, isPlayer: !!o.me,
        raceState: {
            finished: o.finished !== false, finishTime: o.time != null ? o.time : 100 + i,
            resultStatus: o.status || null, totalPenalties: o.pen || 0,
            legTopSpeeds: [o.top || 7], legRanks: o.legRanks || [1],
        },
    }));
}
function newRace(ctx) { ctx.state.race = { status: 'racing', timer: 0, unlocks: { counted: false, pending: null, eligible: true } }; }
const names10 = ['Bixby', 'Bruce', 'Cheer', 'Pinch', 'Glide', 'Wobble', 'Sunshine', 'Tangle', 'Whiskers', 'Rift'];

console.log('enforcement');
{
    const w = world();
    ok(!w.Unlocks.enforced(), 'no navigator (node vm) → not enforced');
    ok(w.Unlocks.isUnlocked('Ripple'), 'not enforced → everyone unlocked');
    const all = w.AI_CONFIG.slice();
    ok(w.Unlocks.fleetPool(all) === all, 'not enforced → the draw pool is the same array');
    w.navigator = { webdriver: true };
    ok(!w.Unlocks.enforced(), 'webdriver → not enforced');
    w.navigator = { webdriver: false };
    ok(w.Unlocks.enforced(), 'a real browser → enforced');
    w.evalHarness = {};
    ok(!w.Unlocks.enforced(), 'eval harness → not enforced');
    w.__UNLOCKS = 'on';
    ok(w.Unlocks.enforced(), '__UNLOCKS=on overrides');
}

console.log('the rulebook');
{
    const w = world(); w.__UNLOCKS = 'on';
    const unshipped = [];   // objectives live before the art — see Unlocks.shipped
    for (const a of w.Unlocks.ACHIEVEMENTS) ok(unshipped.includes(a.char) || w.AI_CONFIG.some(c => c.name === a.char), `${a.char} is in the roster`);
    ok(w.Unlocks.ACHIEVEMENTS.every(a => a.hidden === undefined), 'no objective is hidden');
    ok(w.Unlocks.ACHIEVEMENTS.every(a => typeof w.Unlocks.hintOf(a) === 'string' && w.Unlocks.hintOf(a).length > 10), 'every objective is spelled out');
    for (const n of w.Unlocks.STARTING_TEN) ok(!w.Unlocks.gated(n), `${n} (starter) is never gated`);
    ok(!w.Unlocks.isUnlocked('Finley') && !w.Unlocks.gated('Finley'), 'a character with no achievement yet is locked, and not on the board');
    ok(!w.Unlocks.isUnlocked('Ripple'), 'Ripple starts locked');
    const pool = w.Unlocks.fleetPool(w.AI_CONFIG);
    ok(!pool.some(c => c.name === 'Ripple') && pool.some(c => c.name === 'Bixby'), 'the pool drops the locked, keeps the free');
    ok(pool.length === 10 && pool.every(c => w.Unlocks.STARTING_TEN.includes(c.name)), 'a fresh pool is exactly the starting ten');
}

console.log('a first race: 4th, clean, 10.3 kt');
{
    const w = world(); w.__UNLOCKS = 'on'; newRace(w);
    const order = fleet(w, [['Bruce', {}], ['Cheer', {}], ['Pinch', {}], ['Bixby', { me: true, top: 10.3 }],
        ['Whiskers', { finished: false }], ['Glide', { finished: false }]]);
    w.state.race.timer = 90;       // before the player's time: a penalty could still slot someone in
    ok(w.Unlocks.poll(order).length === 0 && !w.state.race.unlocks.counted, 'not counted before the place is final');
    w.state.race.timer = 104;
    const got = w.Unlocks.poll(order);
    ok(got.includes('Ripple') && got.includes('Scuttle') && got.includes('Skim'), 'Ripple + Scuttle + Skim: ' + got.join(','));
    ok(!got.includes('Snap'), 'Snap undecided while Whiskers is still out');
    ok(w.Unlocks.career().finishes === 1, 'career counted once');
    w.Unlocks.poll(order);
    ok(w.Unlocks.career().finishes === 1, 'a second poll does not count again');
    // Whiskers crosses right behind.
    order[4].raceState.finished = true; order[4].raceState.finishTime = 110;
    w.state.race.timer = 109;
    ok(!w.Unlocks.poll(order).includes('Snap'), 'Snap waits for the clock to pass his time');
    w.state.race.timer = 111;
    ok(w.Unlocks.poll(order).includes('Snap'), 'Snap granted: Whiskers finished directly behind');
    ok(w.Unlocks.isUnlocked('Ripple'), 'Ripple now unlocked');
    const un = w.Unlocks.unseen();
    ok(un.length === 4, 'four unseen ceremonies: ' + un.join(','));
    ok(w.Unlocks.store().rivals.length === 4, 'four new rivals queued');
}

console.log('Snap: someone else finishes behind');
{
    const w = world(); w.__UNLOCKS = 'on'; newRace(w);
    const order = fleet(w, [['Bixby', { me: true }], ['Bruce', {}], ['Whiskers', {}]]);
    w.state.race.timer = 200;
    ok(!w.Unlocks.poll(order).includes('Snap'), 'Bruce behind you — no Snap');
    ok(w.state.race.unlocks.pending.length === 0, 'and nothing left pending');
}

console.log('Splat, Zing, Wiggle, Knot, Hug');
{
    const w = world(); w.__UNLOCKS = 'on'; newRace(w);
    let order = fleet(w, [['Bruce', {}], ['Cheer', {}], ['Pinch', {}], ['Bixby', { me: true, pen: 1 }]]);
    w.state.race.timer = 300;
    let got = w.Unlocks.poll(order);
    ok(got.includes('Splat'), 'last of four → Splat');
    ok(!got.includes('Scuttle'), 'a penalty → no Scuttle');

    newRace(w);
    order = fleet(w, names10.map((n, i) => [n, i === 0 ? { me: true, legRanks: [10, 6, 1] } : {}]));
    w.state.race.timer = 999;
    ok(w.Unlocks.poll(order).includes('Zing'), 'won after last at mark 1 → Zing');

    newRace(w);
    w.GameEvents.emit('player-penalty-served');
    order = fleet(w, [['Bruce', {}], ['Bixby', { me: true, status: 'DNF' }]]);
    ok(w.Unlocks.poll(order).includes('Wiggle'), 'a served turn → Wiggle, even on a DNF');

    for (let k = 0; k < 3; k++) {
        newRace(w);
        order = fleet(w, names10.map((n, i) => [n, i === 4 ? { me: true } : {}]));
        w.state.race.timer = 999;
        got = w.Unlocks.poll(order);
    }
    ok(got.includes('Knot'), 'three 5ths in a row → Knot');

    const w2 = world(); w2.__UNLOCKS = 'on';
    for (let k = 0; k < 3; k++) {
        newRace(w2);
        const pos = k === 1 ? 3 : 4;
        order = fleet(w2, names10.map((n, i) => [n, i === pos ? { me: true } : {}]));
        w2.state.race.timer = 999;
        got = w2.Unlocks.poll(order);
    }
    ok(!got.includes('Knot') && w2.Unlocks.career().fifthStreak === 1, 'a 4th breaks the streak');

    const w3 = world(); w3.__UNLOCKS = 'on';
    for (let k = 0; k < 25; k++) {
        newRace(w3);
        order = fleet(w3, [['Bixby', { me: true }], ['Bruce', {}]]);
        w3.state.race.timer = 999;
        got = w3.Unlocks.poll(order);
        if (k === 23) ok(!got.includes('Hug'), '24 finishes → no Hug yet');
    }
    ok(got.includes('Hug'), '25 finishes → Hug');
    ok(w3.Unlocks.achievementFor('Hug').progress(w3.Unlocks.career())[0] === 25, 'Hug progress reads 25');
}

console.log('rules off, school, flush');
{
    const w = world(); w.__UNLOCKS = 'on'; newRace(w);
    w.settings.penaltiesEnabled = false;
    let order = fleet(w, [['Bixby', { me: true }], ['Bruce', {}]]);
    w.state.race.timer = 999;
    ok(!w.Unlocks.poll(order).includes('Scuttle'), 'sailing rules off → no Scuttle');

    newRace(w); w.state.race.unlocks.eligible = false;
    ok(w.Unlocks.poll(order).length === 0, 'an ineligible (school) race counts nothing');

    const w2 = world(); w2.__UNLOCKS = 'on'; newRace(w2);
    order = fleet(w2, [['Bixby', { me: true, time: 500 }], ['Bruce', { finished: false }]]);
    w2.state.race.timer = 420;
    ok(w2.Unlocks.poll(order).length === 0, 'unsettled (penalty time still pending)');
    ok(w2.Unlocks.flush(order).includes('Ripple'), 'flush on leaving counts it anyway');
    ok(w2.Unlocks.flush(order).length === 0, 'and only once');
}

console.log('the new-rival queue');
{
    const w = world(); w.__UNLOCKS = 'on';
    w.Unlocks.grant(['Ripple', 'Scuttle', 'Skim'], 'bay');
    const pool = w.Unlocks.fleetPool(w.AI_CONFIG.filter(c => c.name !== 'Bixby'));
    const owed = w.Unlocks.rivalsFor(pool).map(c => c.name);
    ok(owed.join(',') === 'Ripple,Scuttle', 'two slots a race, oldest first: ' + owed.join(','));
    const boats = [{ name: 'Bixby', isPlayer: true }, { name: 'Ripple' }, { name: 'Scuttle' }];
    w.Unlocks.onRaceStart(boats);
    let r = w.Unlocks.store().rivals;
    ok(r.find(x => x.name === 'Ripple').left === 2 && r.find(x => x.name === 'Skim').left === 3, 'a rival not in the race keeps its three');
    w.Unlocks.onRaceStart([...boats, { name: 'Skim' }]);
    r = w.Unlocks.store().rivals;
    ok(r.find(x => x.name === 'Skim').left === 2, 'a lucky draw counts toward the three too');
    w.Unlocks.onRaceStart(boats);
    ok(w.Unlocks.store().rivals.map(x => x.name).join(',') === 'Skim', 'after three races Ripple and Scuttle are paid; Skim is next');
    ok(w.Unlocks.rivalsFor(pool).map(c => c.name).join(',') === 'Skim', 'Skim now owed');
    w.Unlocks.markSeen(['Ripple']);
    ok(!w.Unlocks.unseen().includes('Ripple') && w.Unlocks.unseen().length === 2, 'markSeen drops one ceremony');
}

console.log('Lighthouse Cove');
{
    const w = world(); w.__UNLOCKS = 'on';
    w.window.VenueDoc = { get: (k) => (k === 'bay' ? { records: { provisional: 255 } } : null) };
    w.recordsEligible = () => true;
    w.Series = { raceFacts: () => ({ stars: 4 }) };
    const cove = w.Unlocks.forVenue('bay').map(a => a.char).join(',');
    ok(cove === 'Roll,Wake,Zeffir,Plunge,Piper,Scoop', 'six Cove objectives: ' + cove);
    ok(w.Unlocks.hintOf(w.Unlocks.achievementFor('Plunge')).includes('4:15'), 'the target time is spelled out: ' + w.Unlocks.hintOf(w.Unlocks.achievementFor('Plunge')));
    // Pretend Wake's art has not shipped, to check an earned-before-art character waits.
    const wakeCfg = w.AI_CONFIG.splice(w.AI_CONFIG.findIndex(c => c.name === 'Wake'), 1)[0];
    newRace(w);
    w.GameEvents.emit('player-feat', { id: 'bay:bow-cross' });
    w.GameEvents.emit('player-feat', { id: 'bay:gulls' });
    w.GameEvents.emit('player-feat', { id: 'bay:bait-boil' });
    const order = fleet(w, [['Bixby', { me: true, time: 240 }], ['Bruce', {}]]);
    w.state.race.timer = 999;
    const got = w.Unlocks.poll(order);
    for (const n of ['Roll', 'Wake', 'Zeffir', 'Plunge', 'Piper', 'Scoop']) ok(got.includes(n), `${n} earned`);
    ok(!w.Unlocks.unseen().includes('Wake'), 'Wake earned but no ceremony until he ships');
    ok(w.Unlocks.isEarned('Wake'), 'and remembered');
    w.AI_CONFIG.push(wakeCfg);
    ok(w.Unlocks.unseen().includes('Wake'), 'the ceremony appears once Wake is in the roster');

    const w2 = world(); w2.__UNLOCKS = 'on';
    w2.window.VenueDoc = { get: () => ({ records: { provisional: 255 } }) };
    w2.recordsEligible = () => false;
    newRace(w2);
    const o2 = fleet(w2, [['Bixby', { me: true, time: 240 }], ['Bruce', {}]]);
    w2.state.race.timer = 999;
    const g2 = w2.Unlocks.poll(o2);
    ok(!g2.includes('Plunge'), 'the target only counts in Time Trials');
    ok(!g2.includes('Wake') && !g2.includes('Zeffir'), 'no feats, no mechanic or explorer');
    w2.settings.venue = 'lake';
}

console.log('Gatorgrass Bayou');
{
    const w = world(); w.__UNLOCKS = 'on'; w.settings.venue = 'swamp';
    w.window.VenueDoc = { get: () => ({ records: {} }) };
    w.recordsEligible = () => false;
    w.Series = { raceFacts: () => ({ stars: 1 }) };
    const bayou = w.Unlocks.forVenue('swamp').map(a => a.char).join(',');
    ok(bayou === 'Chomp,Croak,Flit,Etienne,Beau,Quill', 'six Bayou objectives: ' + bayou);
    // A race: the feats and values it emitted, the player finishing second.
    const race = (emits) => {
        newRace(w);
        for (const e of emits) w.GameEvents.emit('player-feat', e);
        const order = fleet(w, [['Bruce', {}], ['Bixby', { me: true, time: 240 }]]);
        w.state.race.timer = 999;
        return w.Unlocks.poll(order);
    };
    const r1 = race([{ id: 'swamp:route', value: 'cut' }, { id: 'swamp:route', value: 'east' }]);
    const r2 = race([{ id: 'swamp:route', value: 'cut' }]);
    const r3 = race([{ id: 'swamp:route', value: 'east' }]);
    ok(![...r1, ...r2, ...r3].includes('Croak'), 'two passages (the last crossing is the race\'s) is not yet Croak');
    const routes = JSON.parse(w.store.regatta_career).venues.swamp.routes;
    ok(routes.length === 2 && routes.includes('east') && routes.includes('cut'), 'the career keeps the passages finished by: ' + routes);
    ok(JSON.stringify(w.Unlocks.achievementFor('Croak').progress(JSON.parse(w.store.regatta_career))) === '[2,3]', 'the picker shows 2 of 3');
    const r4 = race([{ id: 'swamp:route', value: 'west' }, { id: 'swamp:gators', value: 4 }]);
    ok(r4.includes('Croak'), 'a third passage earns Croak');
    ok(!r4.includes('Flit'), 'four alligators is not Flit');
    const r5 = race([{ id: 'swamp:gators', value: 3 }, { id: 'swamp:gators', value: 5 }, { id: 'swamp:anhingas' }]);
    ok(r5.includes('Flit'), 'five alligators in one race earns Flit');
    ok(r5.includes('Quill'), 'putting up the anhingas earns Quill');
    // A DNF does not add its passage.
    const w2 = world(); w2.__UNLOCKS = 'on'; w2.settings.venue = 'swamp'; w2.window.VenueDoc = { get: () => ({ records: {} }) };
    newRace(w2); w2.GameEvents.emit('player-feat', { id: 'swamp:route', value: 'west' });
    const o = fleet(w2, [['Bruce', {}], ['Bixby', { me: true, finished: false }]]); w2.state.race.status = 'finished'; w2.state.race.timer = 999;
    w2.Unlocks.flush(o); w2.Unlocks.poll(o);
    const c2 = w2.store.regatta_career ? JSON.parse(w2.store.regatta_career) : { venues: {} };
    ok(!((c2.venues.swamp || {}).routes || []).length, 'an unfinished race adds no passage');
}

console.log('Sockeye Run');
{
    const w = world(); w.__UNLOCKS = 'on'; w.settings.venue = 'river';
    w.window.VenueDoc = { get: () => ({ records: {} }) };
    w.recordsEligible = () => false;
    w.Series = { raceFacts: () => ({ stars: 1 }) };
    const river = w.Unlocks.forVenue('river').map(a => a.char).join(',');
    ok(river === 'Slipstream,Snag,Grizzle,Riffle,Seam', 'five Sockeye Run objectives: ' + river);
    const race = (emits, me = { me: true, time: 240 }) => {
        newRace(w);
        for (const e of emits) w.GameEvents.emit('player-feat', e);
        const order = fleet(w, [['Bruce', {}], ['Bixby', me]]);
        w.state.race.timer = 999;
        return w.Unlocks.poll(order);
    };
    const r1 = race([{ id: 'river:scraped' }, { id: 'river:chute' }]);
    ok(!r1.includes('Snag'), 'a scrape on the run home is not Snag');
    ok(r1.includes('Grizzle'), 'finishing down the chute earns Grizzle');
    const r2 = race([]);
    ok(r2.includes('Snag'), 'a clean run home earns Snag');
    const w2 = world(); w2.__UNLOCKS = 'on'; w2.settings.venue = 'river'; w2.window.VenueDoc = { get: () => ({ records: {} }) };
    newRace(w2); w2.GameEvents.emit('player-feat', { id: 'river:chute' });
    const o = fleet(w2, [['Bruce', {}], ['Bixby', { me: true, finished: false }]]); w2.state.race.status = 'finished'; w2.state.race.timer = 999;
    w2.Unlocks.flush(o); const g = w2.Unlocks.poll(o);
    ok(!g.includes('Snag') && !g.includes('Grizzle'), 'an unfinished race earns neither');
}

console.log('Sailing School');
{
    const w = world(); w.__UNLOCKS = 'on';
    let units = {};
    w.School = { active: true, progress: () => ({ units }) };
    const school = w.Unlocks.forVenue('pond').map(a => a.char).join(',');
    ok(school === 'Paddle,Fuzz,Oar,Bask,Wisp', 'five school objectives: ' + school);
    // Start practice: 2.0 s counts, 2.4 s and an early start do not.
    ok(!w.Unlocks.schoolEvent('start', { late: 2.4, ocs: false }).includes('Oar'), 'a 2.4 s start is not Oar');
    ok(!w.Unlocks.schoolEvent('start', { late: 0.5, ocs: true }).includes('Oar'), 'over early is not Oar');
    ok(w.Unlocks.schoolEvent('start', { late: 2.0, ocs: false }).includes('Oar'), 'a 2.0 s start earns Oar');
    // Turtles: the feat alone is not enough — the section has to finish.
    w.Unlocks.schoolSection();
    w.GameEvents.emit('player-feat', { id: 'pond:turtles' });
    ok(w.Unlocks.schoolEvent('start', { late: 9 }).indexOf('Bask') < 0, 'turtles, section not finished: no Bask');
    units = { 1: true, 2: true };
    ok(w.Unlocks.schoolEvent('unit', { n: 2 }).includes('Bask'), 'turtles, then the section ends: Bask');
    w.Unlocks.schoolSection();
    ok(w.Unlocks._schoolFeats.size === 0, 'a new section starts with no feats');
    // Every lesson: all four completed (skips never set the flag).
    units = { 1: true, 2: true, 4: true };
    ok(!w.Unlocks.schoolEvent('unit', { n: 4 }).includes('Fuzz'), 'three of four sections: no Fuzz');
    units = { 1: true, 2: true, 3: true, 4: true };
    ok(w.Unlocks.schoolEvent('unit', { n: 3 }).includes('Fuzz'), 'all four, over two visits: Fuzz');
    // The race: Paddle for the win, Wisp for the clean card — independent.
    const g1 = w.Unlocks.schoolEvent('race', { won: false, clean: true });
    ok(g1.includes('Wisp') && !g1.includes('Paddle'), 'third with a clean card: Wisp, not Paddle');
    ok(w.Unlocks.schoolEvent('race', { won: true, clean: false }).includes('Paddle'), 'a win: Paddle');
    // School objectives never pay from an ordinary race.
    const w2 = world(); w2.__UNLOCKS = 'on'; newRace(w2); w2.settings.venue = 'pond';
    const o2 = fleet(w2, [['Bixby', { me: true }], ['Bruce', {}]]); w2.state.race.timer = 999;
    ok(!w2.Unlocks.poll(o2).some(n => ['Paddle', 'Fuzz', 'Oar', 'Bask', 'Wisp'].includes(n)), 'an ordinary race pays no school objective');
}

console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
process.exit(fails ? 1 : 0);
