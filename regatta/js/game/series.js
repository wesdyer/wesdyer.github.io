// regatta/js/game/series.js — CUPS AND SERIES: a race list plus a scoring rule.
//
// One object underneath the three ways onto the water that are more than one race
// (guidelines/venues.md, the Sep 2026 clubhouse redesign): a CUP is a fixed, named list
// of four venues with a trophy; a SERIES is a random draw of 4/6/8/10/12 from the twelve
// racing venues. Both lock the fleet and the player's character from the start of race
// one, score 10 for a win down to 1 with DNF/DNS at 0, sum every race with no discards,
// and break ties on the better place in the LAST race — stepping back a race when
// neither boat placed in it. A single race is not a series and never touches this.
//
// ⚠️ THE ACTIVE SERIES LIVES IN MEMORY ONLY. A reload forfeits it, by design ("reload
// forfeits", Wes, Sep 1 2026) — nothing here is written to storage except the trophy
// shelf, which is the record of series already finished.
//
// ⚠️ THE DRAW HAS ITS OWN PRNG. Math.random() is the seeded simulation stream (the eval
// harness pins it), and a clubhouse click must not move a race. Same rule as water.js.
//
// Classic script; global scope. Loads after state.js (VENUE_ORDER) and before screens.js.

// `art`: flip to true once the cup's trophy master is ingested (art/manifest.json `trophy-<id>`);
// until then the screens draw an SVG placeholder of the same form.
const CUPS = [
    { id: 'commodore', art: true, name: "Commodore's Cup", form: 'cup',
      venues: ['bay', 'swamp', 'glowtide', 'ocean'],
      blurb: 'Every kind of water: harbour, bayou, strait, open ocean.' },
    { id: 'explorer', art: true, name: "Explorer's Cup", form: 'chalice',
      venues: ['otter', 'lake', 'redrock', 'arctic'],
      blurb: 'A rocky coast, a lake island, sandstone spires, and ice. The hard one.' },
    { id: 'swirl', art: true, name: 'Swirl Cup', form: 'bowl',
      venues: ['lagoon', 'river', 'flats', 'volcanic'],
      blurb: 'A squall, a current, a falling tide, a vent. Every race has a clock in it.' },
];
const SERIES_LENGTHS = [4, 6, 8, 10, 12];
const TROPHIES_KEY = 'regatta_trophies';

// A win is worth ten, tenth is worth one; anyone who did not finish scores nothing.
// Mirrors POINTS_FOR_PLACE in screens.js (the results page's Pts column) so the two can
// never disagree about what a race was worth.
function seriesPoints(pos, finished) {
    if (!finished || !(pos >= 1)) return 0;
    return Math.max(1, 11 - pos);
}

function _mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

const Series = {
    active: null,
    _rng: null,

    cups() { return CUPS; },
    cup(id) { return CUPS.find(c => c.id === id) || null; },
    lengths() { return SERIES_LENGTHS; },
    // The twelve racing venues: the picker's order minus the benchmark course. The school
    // pond is not in VENUE_ORDER at all.
    pool() {
        const order = (typeof VENUE_ORDER !== 'undefined') ? VENUE_ORDER : [];
        return order.filter(k => k !== 'seatrials');
    },
    rng() {
        if (!this._rng) {
            const seed = (Date.now() ^ Math.floor((typeof performance !== 'undefined' ? performance.now() : 0) * 1000)) >>> 0;
            this._rng = _mulberry32(seed || 1);
        }
        return this._rng;
    },
    // n venues, no repeats, in a shuffled order. Twelve is every venue.
    draw(n, rng) {
        const r = rng || this.rng();
        const pool = this.pool().slice();
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(r() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        return pool.slice(0, Math.max(1, Math.min(n, pool.length)));
    },

    // ── starting ────────────────────────────────────────────────────────────
    startCup(id) {
        const c = this.cup(id);
        if (!c) return null;
        this.active = { kind: 'cup', id: c.id, name: c.name, venues: c.venues.slice(), index: 0,
                        fleet: null, character: null, results: [] };
        return this.active;
    },
    startSeries(venues) {
        if (!venues || !venues.length) return null;
        this.active = { kind: 'series', id: 'series-' + venues.length, name: `${venues.length}-race series`,
                        venues: venues.slice(), index: 0, fleet: null, character: null, results: [] };
        return this.active;
    },
    abandon() { this.active = null; },

    // ── where we are ────────────────────────────────────────────────────────
    raceNumber() { return this.active ? this.active.index + 1 : 0; },
    total() { return this.active ? this.active.venues.length : 0; },
    currentVenue() { return this.active ? this.active.venues[this.active.index] : null; },
    nextVenue() { return this.active && this.active.index + 1 < this.active.venues.length ? this.active.venues[this.active.index + 1] : null; },
    isLast() { return !!this.active && this.active.index === this.active.venues.length - 1; },
    finished() { return !!this.active && this.active.results.length >= this.active.venues.length; },
    locked() { return !!(this.active && this.active.fleet); },
    // Everyone sails the same fleet in the same boat from the moment race one starts.
    lockFleet(opponentNames, character) {
        if (!this.active || this.active.fleet) return;
        this.active.fleet = opponentNames.slice();
        this.active.character = character;
    },
    // One race's classification: the results page's own finish order (finishers by time,
    // then DNF, then DNS, then anyone still on the water when the player moved on — those
    // are ranked by progress and scored as finishers, since they were behind the player).
    recordRace(order) {
        if (!this.active) return null;
        let place = 0;
        const rows = order.map((b) => {
            const rs = b.raceState || {};
            const status = rs.resultStatus || null;             // 'DNF' | 'DNS' | null
            const finished = !status;                            // a classified finisher, or still racing
            if (finished) place++;
            return { name: b.name, isPlayer: !!b.isPlayer, pos: finished ? place : null, status,
                     time: (rs.finished && !status) ? rs.finishTime : null, pts: seriesPoints(place, finished) };
        });
        const result = { venue: this.currentVenue(), index: this.active.index, rows };
        this.active.results[this.active.index] = result;
        return result;
    },
    advance() {
        if (!this.active || this.isLast()) return false;
        this.active.index++;
        return true;
    },

    // ── the table ───────────────────────────────────────────────────────────
    // Standings after the races sailed so far. Ties: better place in the most recent race
    // in which at least one of the two placed; a finisher beats a DNF; if every race is a
    // dead heat the earlier name in the fleet's order stays ahead (stable).
    standings() {
        if (!this.active) return [];
        const res = this.active.results.filter(Boolean);
        const names = [];
        const seen = new Set();
        for (const r of res) for (const row of r.rows) if (!seen.has(row.name)) { seen.add(row.name); names.push(row); }
        const table = names.map(row => {
            const per = res.map(r => { const x = r.rows.find(q => q.name === row.name); return x ? x.pts : 0; });
            const places = res.map(r => { const x = r.rows.find(q => q.name === row.name); return x ? x.pos : null; });
            return { name: row.name, isPlayer: row.isPlayer, pts: per, places, total: per.reduce((a, b) => a + b, 0) };
        });
        const tie = (a, b) => {
            for (let i = res.length - 1; i >= 0; i--) {
                const pa = a.places[i], pb = b.places[i];
                if (pa == null && pb == null) continue;
                if (pa == null) return 1;
                if (pb == null) return -1;
                if (pa !== pb) return pa - pb;
            }
            return 0;
        };
        table.sort((a, b) => (b.total - a.total) || tie(a, b));
        table.forEach((row, i) => { row.rank = i + 1; });
        return table;
    },
    playerRow() { return this.standings().find(r => r.isPlayer) || null; },

    // ── the shelf ───────────────────────────────────────────────────────────
    // What survives: per cup, whether it has been won and the best finish; for series,
    // the best finish and at what length. Written once, when the last race is scored.
    trophies() {
        try { return JSON.parse(localStorage.getItem(TROPHIES_KEY)) || {}; } catch (e) { return {}; }
    },
    saveTrophies(t) {
        try { localStorage.setItem(TROPHIES_KEY, JSON.stringify(t)); } catch (e) { /* no store */ }
    },
    recordFinal() {
        if (!this.active || !this.finished()) return null;
        const me = this.playerRow();
        if (!me) return null;
        const t = this.trophies();
        const s = this.active;
        if (s.kind === 'cup') {
            const prev = t[s.id] || { sailed: 0 };
            t[s.id] = { sailed: (prev.sailed || 0) + 1, won: !!prev.won || me.rank === 1,
                        best: prev.best ? Math.min(prev.best, me.rank) : me.rank,
                        bestPts: Math.max(prev.bestPts || 0, me.total), last: new Date().toISOString() };
        } else {
            const prev = t.series || { sailed: 0 };
            const better = !prev.best || me.rank < prev.best.rank || (me.rank === prev.best.rank && s.venues.length > prev.best.n);
            t.series = { sailed: (prev.sailed || 0) + 1, best: better ? { rank: me.rank, n: s.venues.length, pts: me.total } : prev.best, last: new Date().toISOString() };
        }
        this.saveTrophies(t);
        return t;
    },
    cupsWon() { const t = this.trophies(); return CUPS.filter(c => t[c.id] && t[c.id].won).length; },
};

if (typeof window !== 'undefined') { window.Series = Series; window.CUPS = CUPS; window.seriesPoints = seriesPoints; }
if (typeof module !== 'undefined' && module.exports) module.exports = { Series, CUPS, SERIES_LENGTHS, seriesPoints };
