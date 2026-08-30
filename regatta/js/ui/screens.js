// regatta/js/ui/screens.js — screens and overlays: the AI-sayings overlay, the
// canvas/ctx/UI element cache (60+ getElementById at load — pages must ship
// #gameCanvas), race-day venue board + course chart (its own rAF loop),
// competitor cards, character picker, venue load & race-start flow, settings,
// records book, results screen, race messages/toasts. Classic script; global
// scope. Extracted verbatim from script.js (refactor 2026-08-24).
// AI Sayings System
const Sayings = {
    queue: [],
    current: null,
    timer: 0,
    silenceTimer: 0,
    overlay: null,
    img: null,
    name: null,
    text: null,

    init: function() {
        this.overlay = document.getElementById('ai-saying-overlay');
        this.img = document.getElementById('ai-saying-img');
        this.name = document.getElementById('ai-saying-name');
        this.text = document.getElementById('ai-saying-text');
    },

    queueQuote: function(boat, type) {
        if (!boat || boat.isPlayer) return;
        // Sailing School: the classmates keep quiet, lessons and race alike — the only voice
        // on the water is Coach Paddle's, and the race's reminders need the box to themselves.
        if (window.School && School.active) return;
        if (this.queue.length >= 3) return;
        if (!this.overlay) this.init();

        const quotes = typeof AI_QUOTES !== 'undefined' ? AI_QUOTES[boat.name] : null;
        let rawQuote = quotes ? quotes[type] : null;
        // Archetype behavior triggers fall back to generic archetype lines so
        // every character voices its style even without bespoke quotes.
        if (!rawQuote && typeof ARCHETYPE_CALLS !== 'undefined' && ARCHETYPE_CALLS[type]) {
            const lines = ARCHETYPE_CALLS[type];
            rawQuote = lines[Math.floor(Math.random() * lines.length)];
        }
        if (!rawQuote) return;

        let text = rawQuote;
        if (typeof rawQuote === 'object') {
            const options = ['short', 'medium', 'long'];
            const length = options[Math.floor(Math.random() * options.length)];
            text = rawQuote[length];
        }

        this.queue.push({ boat, text });
    },

    update: function(dt) {
        this.silenceTimer += dt;

        if (this.current) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.hide();
            }
        } else if (this.queue.length > 0) {
            const item = this.queue.shift();
            this.show(item);
        } else if (this.silenceTimer > 10.0 && state.race.status !== 'finished') {
            const candidates = state.boats.filter(b => !b.isPlayer && !b.raceState.finished);
            if (candidates.length > 0) {
                const boat = candidates[Math.floor(Math.random() * candidates.length)];
                let type = 'random';
                if (state.race.status === 'prestart') type = 'prestart';
                this.queueQuote(boat, type);
            }
            this.silenceTimer = 0;
        }
    },

    show: function(item) {
        this.current = item;
        this.timer = 2.0;
        this.silenceTimer = 0;

        if (this.overlay && this.img && this.name && this.text) {
            this.img.src = "assets/images/competitors/" + item.boat.name.toLowerCase() + ".png";
            const color = isVeryDark(item.boat.colors.hull) ? item.boat.colors.spinnaker : item.boat.colors.hull;
            this.img.style.borderColor = color;
            this.name.textContent = item.boat.name;
            this.name.style.color = color;
            this.text.textContent = `"${item.text}"`;

            this.overlay.classList.remove('hidden');
            requestAnimationFrame(() => {
                 this.overlay.classList.remove('translate-y-4', 'opacity-0');
            });
        }
    },

    hide: function() {
        if (this.overlay) {
             this.overlay.classList.add('translate-y-4', 'opacity-0');
             setTimeout(() => {
                 if (this.current === null) this.overlay.classList.add('hidden');
             }, 500);
             this.current = null;
        } else {
            this.current = null;
        }
    }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements Cache
const UI = {
    timer: document.getElementById('hud-timer'),
    startTime: document.getElementById('hud-start-time'),
    message: document.getElementById('hud-message'),
    legInfo: document.getElementById('hud-leg-info'),
    legTimes: document.getElementById('hud-leg-times'),
    pauseScreen: document.getElementById('pause-screen'),
    helpScreen: document.getElementById('help-screen'),
    settingsScreen: document.getElementById('settings-screen'),
    helpButton: document.getElementById('help-button'),
    closeHelp: document.getElementById('close-help'),
    resumeHelp: document.getElementById('resume-help'),
    resumeButton: document.getElementById('resume-button'),
    restartButton: document.getElementById('restart-button'),
    settingsButton: document.getElementById('settings-button'),
    closeSettings: document.getElementById('close-settings'),
    saveSettings: document.getElementById('save-settings'),
    abandonScreen: document.getElementById('abandon-screen'),
    abandonButton: document.getElementById('abandon-button'),
    abandonKeep: document.getElementById('abandon-keep'),
    abandonConfirm: document.getElementById('abandon-confirm'),
    pauseContext: document.getElementById('pause-context'),
    abandonContext: document.getElementById('abandon-context'),
    preRaceSettingsBtn: document.getElementById('prerace-settings-btn'),
    settingSound: document.getElementById('setting-sound'),
    settingBgSound: document.getElementById('setting-bg-sound'),
    settingMusic: document.getElementById('setting-music'),
    settingPenalties: document.getElementById('setting-penalties'),
    settingNavAids: document.getElementById('setting-navaids'),
    settingTrim: document.getElementById('setting-trim'),
    settingCameraMode: document.getElementById('setting-camera-mode'),
    settingHudMode: document.getElementById('setting-hud-mode'),
    settingTelltaleColor: document.getElementById('setting-color-telltale'),
    leaderboard: document.getElementById('leaderboard'),
    lbLeg: document.getElementById('lb-leg'),
    lbRows: document.getElementById('lb-rows'),
    lbPips: document.getElementById('lb-pips'),
    characterPicker: document.getElementById('character-picker'),
    hudRose: document.getElementById('hud-rose'),
    minimapWrap: document.getElementById('hud-minimap-wrap'),
    compassRose: document.getElementById('hud-compass-rose'),
    windArrow: document.getElementById('hud-wind-arrow'),
    headingArrow: document.getElementById('hud-heading-arrow'),
    waypointArrow: document.getElementById('hud-waypoint-arrow'),
    speed: document.getElementById('hud-speed'),
    windSpeed: document.getElementById('hud-wind-speed'),
    windAngle: document.getElementById('hud-wind-angle'),
    vmg: document.getElementById('hud-vmg'),
    overpoweredBadge: document.getElementById('hud-overpowered'),
    ocsBanner: document.getElementById('hud-ocs'),
    ocsArrow: document.getElementById('hud-ocs-arrow'),
    resultsOverlay: document.getElementById('results-overlay'),
    resultsList: document.getElementById('results-list'),
    resultsRestartButton: document.getElementById('results-restart-button'),
    resultsRematchButton: document.getElementById('results-rematch-button'),
    preRaceOverlay: document.getElementById('pre-race-overlay'),
    // Config Sliders
    venuePicker: document.getElementById('venue-picker'),
    venueDetail: document.getElementById('venue-detail'),

    // Current UI
    valCurrentDir: document.getElementById('val-current-direction'),
    valCurrentSpeed: document.getElementById('val-current-speed'),
    uiCurrentArrow: document.getElementById('ui-current-arrow'),
    uiCurrentDirText: document.getElementById('ui-current-dir-text'),
    currentControls: document.getElementById('current-controls'),

    prCompetitorsGrid: document.getElementById('pr-competitors-grid'),
    // Toast
    toast: document.getElementById('toast-notification'),
    toastMsg: document.getElementById('toast-message'),

    startRaceBtn: document.getElementById('start-race-btn'),
    boatRows: {},

    // Water Debug
    waterDebug: document.getElementById('water-debug'),
    waterDebugControls: document.getElementById('water-debug-controls'),
    waterReset: document.getElementById('water-reset'),
    waterClose: document.getElementById('water-close')
};


;

// --- Venue picker ----------------------------------------------------------
// The strip under the hero: every venue as its own square art tile. Square because the
// art IS square (1254x1254) — the same master the hero shows at full size, downscaled,
// so there is no second crop to keep in sync with the first.
function renderVenuePicker() {
    if (!UI.venuePicker) return;
    const selected = (settings.venue && VENUE_ORDER.includes(settings.venue)) ? settings.venue : 'bay';
    const visibleKeys = VENUE_ORDER;

    if (UI.venuePicker._keys !== visibleKeys.join()) {
        UI.venuePicker._keys = visibleKeys.join();
        UI.venuePicker.innerHTML = '';
        for (const key of visibleKeys) {
            const c = venueCard(key);
            const btn = document.createElement('button');
            btn.dataset.venue = key;
            btn.className = 'pr-venue-tile';
            // THE NAME SITS ON THE PICTURE. A caption outside the tile costs a line of
            // height per row — two rows, two lines — and that height is the picture's. On
            // the art, over a scrim, it costs nothing and labels the thing it names.
            btn.innerHTML = `
                <div class="pr-venue-shot">
                    <img src="assets/images/venues/thumbs/${key}.png" alt="${c.tag || key}" draggable="false">
                    <span class="pr-venue-name t-display-8 uppercase">${c.name || c.tag || key}</span>
                </div>`;
            btn.addEventListener('click', (e) => { e.preventDefault(); selectVenue(key); });
            UI.venuePicker.appendChild(btn);
        }
    }

    for (const btn of UI.venuePicker.children) {
        btn.classList.toggle('sel', btn.dataset.venue === selected);
    }
    sizeRaceDayHero();
    renderVenueDetail(selected);
}

// ⚠️ THE HERO'S HEIGHT IS SET BY ITS OWN WIDTH, and only JS can say so. The art panel is
// square and takes the hero's full height, so the hero must never be taller than the share
// of the column the art is allowed to have — otherwise the panel hits its max-width, stops
// being square, and the art letterboxes onto the gradient. CSS cannot express "my height
// depends on my width", so this runs on every render and on resize.
const HERO_ART_SHARE = 0.58;   // of the column's WIDTH — the art is square
const VENUE_STRIP_SHARE = 0.55; // of the column's HEIGHT — the hero keeps the rest
function sizeRaceDayHero() {
    const hero = document.getElementById('venue-hero');
    const art = document.getElementById('venue-art');
    const picker = document.getElementById('venue-picker');
    const col = hero && hero.parentElement;
    if (!hero || !art || !col) return;
    const w = col.clientWidth, h = col.clientHeight;
    if (w <= 0) return;

    const side = Math.round(w * HERO_ART_SHARE);
    // ⚠️ ONE NUMBER GOVERNS BOTH ENDS. The height cap and the art's width ceiling have to be
    // the same share of the column: cap the height higher than the width and the square
    // panel hits its width limit, stops being square, and the art letterboxes.
    hero.style.maxHeight = side + 'px';
    art.style.maxWidth = side + 'px';

    // THE TILES FILL THE ROW; the strip's height share is what stops two rows of them
    // eating the hero. With the start bar gone the strip owns more of the column (0.55),
    // and a tile is the smaller of "a fifth of the row" and "half the strip's budget" —
    // width-limited on a laptop, height-limited on a big screen, never scrolling either
    // way. Only when height wins does space-between have any slack to spread.
    if (picker && h > 0) {
        const GAP = 10, ROWS = 2, COLS = 5;
        const widthTile = Math.floor((w - (COLS - 1) * GAP) / COLS);
        const heightTile = Math.floor((h * VENUE_STRIP_SHARE - (ROWS - 1) * GAP) / ROWS);
        const tile = Math.max(64, Math.min(widthTile, heightTile));
        picker.style.gridTemplateColumns = `repeat(${COLS}, minmax(0, ${tile}px))`;
    }
}

// THE BREEZE A BRIEFING SHOULD QUOTE. Not `state.wind.baseSpeed`, which is the region
// blend at ONE POINT (the route centroid) — on Glacier Sound that point reads 20 while the
// katabatic corner blows 29 and the far side sits in 14, so the board called a course that
// varies by half its own strength "20 kt steady".
//
// `state.wind.spread` is the p10/p90 of the MEAN field over the racecourse, measured across
// a full oscillation period (computeWindPressureScale). Gust sources add their knots on top
// of that, because a puff is a deviation from the mean rather than part of it.
//
// "Steady" is then a claim the numbers have to earn: under a knot and a half of spread, and
// only then.
function windRangeText() {
    const sp = state.wind.spread;
    let lo = sp ? sp.lo : state.wind.baseSpeed;
    let hi = sp ? sp.hi : state.wind.baseSpeed;
    let gust = 0;
    for (const r of ((state.course && state.course.gustRegions) || [])) {
        if (r.count > 0 && r.gustKt > gust) gust = r.gustKt;
    }
    // HALF the stated gust, the same headroom the pressure ramp allows itself: a puff can
    // reach ~1.4x its source's knots at full spread, but a forecast that quotes the one
    // biggest puff of the race describes weather nobody sails in most of the time.
    if (gust > 0) { hi += gust * 0.5; lo -= gust * 0.5 * LULL_RATIO; }
    lo = Math.max(0, Math.round(lo));
    hi = Math.round(hi);
    return hi - lo >= 2 ? `${lo}–${hi} kt` : `${Math.round((lo + hi) / 2)} kt steady`;
}

// Two colours mixed in hex space. Only ever used on the venue's own water palette, to
// take the deep end darker still so white type has something to sit on.
function mixHex(a, b, t) {
    const [ar, ag, ab] = _rgbOf(a), [br, bg, bb] = _rgbOf(b);
    const m = (x, y) => Math.round(x + (y - x) * t);
    return `rgb(${m(ar, br)},${m(ag, bg)},${m(ab, bb)})`;
}

// THE HERO. The selected venue at full size: its square art on the short side, the
// briefing on the wide one, over a gradient built from the venue's OWN water colours —
// the same palette you are about to sail on, so the board is already telling you what
// the water looks like.
function renderVenueDetail(key) {
    if (!UI.venueDetail) return;
    const c = venueCard(key);
    const hero = document.getElementById('venue-hero');
    const art = document.getElementById('venue-art');

    const pal = ((window.VenueDoc && window.VenueDoc.get(key)) || {}).palette || {};
    const deep = pal.deepColor || '#0e7490';
    // `heroColor` is the venue's SIGNATURE water, when that differs from its open water.
    // The lagoon is the case that created it: baseColor became the ocean OUTSIDE the reef
    // (what you sail out on), but the colour the venue is famous for — the one the card
    // art leads with — is the painted turquoise inside, which lives on no palette field
    // the picker reads. Falls back to baseColor, so every other venue is unchanged.
    const base = pal.heroColor || pal.baseColor || '#0e6f84';
    if (hero) {
        // Dark at the text end, the venue's own water at the art end. The mix toward the
        // page colour is what keeps 14px body type legible on a bright lagoon.
        // ⚠️ THE HERO ELEMENT SPANS THE ART TOO — the square card sits over its right
        // ~58% — so the gradient must ARRIVE at the water colour before the art begins,
        // or the signature turquoise renders entirely underneath the picture and the
        // visible briefing shows only the dark half (which is exactly how the lagoon's
        // heroColor went unseen for a day).
        //
        // THE ORIGINAL SUBTLE SHAPE — dark across the briefing, the venue's deep water
        // through the middle, and the hero water arriving only at the far end, so the
        // bright turquoise is a glow at the art seam rather than a flood (the flooded
        // version was tried and rolled back by taste). What changed from the first
        // cut is only smoothness: the two segments are smoothstepped and sampled into
        // many stops, because straight ramps meeting at a stop make a Mach band the
        // eye reads as a smudged seam — the bay and the lagoon both showed it.
        //
        // THE DARK END IS THE VENUE'S OWN WATER AT DEPTH, not a mix toward the page
        // navy. Mixing every deep 55% into one fixed #0c1322 converged all ten panels
        // onto the same muddy blue-slate — the venue's hue died exactly where the
        // panel is largest, and a cross-fade between two different hues is how mud is
        // made. Instead: keep the deep colour's hue and saturation, drop only its
        // lightness — a monochrome depth ramp (abyss -> deep -> signature water) that
        // stays dark enough for 14px type and stays THIS venue's water end to end.
        // ⚠️ HEX, not rgb() — mixHex parses hex pairs, and an rgb() string fed to it
        // parses "rg"/"b(" as colour and renders near-black garbage (shipped briefly).
        const deepRgb = (() => { const s2 = deep.replace('#', '');
            return [parseInt(s2.substr(0, 2), 16), parseInt(s2.substr(2, 2), 16), parseInt(s2.substr(4, 2), 16)]; })();
        const [dh, ds, dl] = rgbToHsl(deepRgb[0], deepRgb[1], deepRgb[2]);
        const dk = hslToRgb(dh, Math.min(1, ds * 1.05), Math.min(dl, 0.15));
        const darkEnd = '#' + dk.map(v => v.toString(16).padStart(2, '0')).join('');
        const smoothMix = (a, b, t) => mixHex(a, b, t * t * (3 - 2 * t));
        const at = (t) => t <= 0.58 ? smoothMix(darkEnd, deep, t / 0.58)
                                    : smoothMix(deep, base, (t - 0.58) / 0.42);
        const stops = [];
        for (let i = 0; i <= 16; i++) {
            const t = i / 16;
            stops.push(`${at(t)} ${(t * 100).toFixed(1)}%`);
        }
        hero.style.background = `linear-gradient(115deg, ${stops.join(', ')})`;
    }
    if (art) {
        // A GENTLE seam, not a shadow: just enough of the panel colour bleeding onto the
        // art's left edge to avoid a hard cut. Semi-transparent and narrow — at full
        // opacity over a quarter of the frame it was eating the picture's left side.
        const seam = mixHex(deep, '#0c1322', 0.55).replace('rgb(', 'rgba(').replace(')', ',0.5)');
        art.innerHTML = `
            <img src="assets/images/venues/${key}.png" alt="${c.name || c.tag || key}" draggable="false"
                 style="width:100%; height:100%; object-fit:contain; display:block;">
            <div style="position:absolute; inset:0; pointer-events:none;
                        background:linear-gradient(90deg, ${seam} 0%, rgba(12,19,34,0) 14%);"></div>`;
    }


    // THE COMPUTED HALF OF THE BOARD IS PENDING until the deferred light build lands —
    // selection paints from the document alone first, and state.course still holds the
    // previous venue for a beat. Everything derived from state (the wind range, the
    // course numbers, the chart) shows an ellipsis rather than the WRONG venue's
    // numbers; everything authored (name, blurb, hazards, art) is already right.
    const pending = !state.course || state.course.venueKey !== key;

    // Water = what the water itself is doing: current, swell, glass, chop.
    // THE AUTHOR'S LINE WINS. The card is written against the real course in the
    // editor now, and "Slight ebb" is a better briefing than any number derived from
    // it. The measured values speak only when the card says nothing: the strongest
    // on-course set (courseCurrentMax — a knot or more is a stream, less a drift)
    // for a venue that authors current, the player's uniform dial otherwise.
    let waterVal = c.conditions;
    if (!waterVal && !pending) {
        const onCourse = courseCurrentMax();
        if (onCourse != null) {
            if (onCourse >= 0.15) waterVal = onCourse.toFixed(1) + (onCourse >= 0.9 ? ' kt stream' : ' kt drift');
        } else if (state.race.conditions.current) {
            waterVal = state.race.conditions.current.speed.toFixed(1) + ' kt set';
        }
    }

    const row = (label, value, gold) => `
        <div class="pr-row flex items-center justify-between gap-5"
             style="background:${gold ? 'rgba(242,193,78,0.14)' : 'rgba(6,14,26,0.45)'};
                    border:1px solid ${gold ? 'rgba(242,193,78,0.4)' : 'transparent'};">
            <span class="t-label t-label-sm" style="color:${gold ? '#f2c14e' : '#9fd3dd'};">${label}</span>
            <span class="t-mono" style="font-size:12.5px; color:${gold ? '#f2c14e' : '#ffffff'};">${value}</span>
        </div>`;

    const idx = VENUE_ORDER.indexOf(key) + 1;
    const best = bestForVenue(key);
    // The names run from "Redrock" to "Bluewater Bonanza", so the long ones step down a
    // size. Everything else about this block's type is in CSS, where a short window can
    // restyle it — see the max-height rules. Measuring the hero here would read a height
    // flex has not settled on the first paint.
    const longName = (c.name || c.tag || key).length > 14 ? ' long' : '';

    // THE RECORD GIVEN A HOME (design 9a): the header chip moved into the hero's
    // empty middle as the challenge block. THE CLOCK ONLY — a best finish caps at
    // 1st and then stops being chaseable, so it is not a challenge and does not
    // belong here (the records book still keeps it). Gold = a time YOU set here.
    // When you have none, the course's provisional target stands instead — "time
    // to beat", in white, because it is held by nobody. With neither, the block
    // still stands with an em dash: the first run founds the book, and ALL
    // RECORDS is still the way in.
    const prov = provisionalRecord(key);
    const rec = best ? { label: 'Your best time', t: best.t, mine: true }
              : { label: 'Time to beat', t: prov, mine: false };
    const recordBlock = `
        <div class="pr-record shrink-0" style="background:rgba(6,14,26,0.4); border-radius:14px;
                    border:1px solid ${rec.mine ? 'rgba(242,193,78,0.4)' : 'rgba(255,255,255,0.18)'};">
            <div class="flex items-center justify-between gap-4">
                <span class="t-label t-label-sm" style="color:${rec.mine ? '#f2c14e' : '#dbeafe'};">${rec.label}</span>
                <button class="t-label t-label-sm" onclick="openRecordsOverlay()"
                        style="background:none; border:none; padding:0; cursor:pointer; color:#8fd8d0;
                               text-decoration:underline; text-underline-offset:3px; white-space:nowrap;">All records &rarr;</button>
            </div>
            <div class="t-mono pr-record-time" style="color:${rec.mine ? '#f2c14e' : '#ffffff'};">${rec.t != null ? formatBestTime(rec.t) : '&mdash;'}</div>
        </div>`;

    UI.venueDetail.innerHTML = `
        <div class="pr-chips flex gap-2 shrink-0">
            <span class="t-label t-label-sm" style="background:rgba(6,14,26,0.45); border-radius:999px; padding:5px 13px; color:#dbeafe; white-space:nowrap;">Venue ${idx} of ${VENUE_ORDER.length}</span>
            <span class="t-label t-label-sm" style="background:rgba(6,14,26,0.45); border-radius:999px; padding:5px 13px; color:#7ff0d4; white-space:nowrap;">${c.tag || key}</span>
        </div>
        <div class="t-display uppercase pr-venue-title${longName}">${c.name || c.tag || key}</div>
        <div class="pr-blurb">${c.blurb || ''}</div>
        ${recordBlock}
        <!-- CHART LEFT, FACTS RIGHT (design 9a). The chart is the picture and gets
             the room: this row takes ALL the slack the briefing leaves (flex-grow,
             not margin-top:auto), so the chart scales up into it — as big as the
             vertical space allows, cropped to the course's own aspect. The facts
             stay a fixed-width readout column, anchored to the bottom edge like
             the chart so the two read as one baseline. The Course row still
             carries the numbers, so nothing is lost when the chart yields. -->
        <div class="pr-bottom flex" style="flex:1 1 auto; gap:14px;">
            <!-- The box is the AVAILABLE room; the inner card crops itself to the
                 course's own aspect inside it (drawCourseMiniMap sizes it), pinned
                 to the bottom-left so growth spends the slack upward. -->
            <div id="venue-course-box" class="relative" style="flex:1 1 auto; min-width:0;">
                <div id="venue-course-inner" style="position:absolute; left:0; bottom:0; border-radius:8px; background:rgba(6,14,26,0.45); overflow:hidden;">
                    <canvas id="venue-course-map" style="position:absolute; inset:0; width:100%; height:100%;"></canvas>
                </div>
                <!-- The record book rides in whatever water the chart leaves — see
                     drawCourseMiniMap, which places it and decides if it fits. -->
                <div id="venue-records-inline" style="position:absolute; bottom:0; right:0; display:none; min-width:0; overflow:hidden;"></div>
            </div>
            <div class="pr-facts flex flex-col gap-1.5" style="flex:0 1 360px; min-width:240px; align-self:flex-end;">
                ${row('Wind', pending ? '&hellip;' : windRangeText())}
                ${row('Water', waterVal || (pending ? '&hellip;' : '&mdash;'))}
                ${row('Hazards', c.hazards || '—')}
                ${row('Course', pending ? '&hellip;' : courseSummaryText())}
                ${row('Time Limit', pending ? '&hellip;' : timeLimitText())}
            </div>
        </div>`;
    layoutVenueCourseMap(pending);
}

// ── The course chart ────────────────────────────────────────────────────────
// "4 legs" says almost nothing about a race; the SHAPE of the course says how to sail
// it. This is the race-day board's chart: the route the fleet will sail, zoomed to the
// marks — start line, each leg with its direction, each rounding with the side it is
// taken on, the finish — with the venue's land for context and the wind and any
// on-course drift as arrows. Everything here is read from the same compiled course the
// boats race (state.course), so the chart cannot disagree with the water.

// The course in one line: legs, and the distance actually sailed — the sum of the
// computed leg paths (the same ruler the chart draws), falling back to straight legs
// when no path was built. Units are the game's own; U_PER_M turns them into km.
function courseSummaryText() {
    let units = 0;
    const dmc = state.course && state.course.dmc;
    const remembered = state.course && _venueStats[state.course.venueKey];
    if (dmc && dmc.total > 0) {
        units = dmc.total;
    } else if (remembered && remembered.total > 0) {
        // A light course has no router paths, but this venue has been fully built
        // before — quote the real sailed distance it measured then.
        units = remembered.total;
    } else {
        for (let leg = 1; leg <= state.race.totalLegs; leg++) {
            const a = legTargetPoint(leg - 1), b = legTargetPoint(leg);
            if (a && b) units += Math.hypot(b.x - a.x, b.y - a.y);
        }
    }
    const km = units / ((window.VenueDoc && window.VenueDoc.U_PER_M) || 5) / 1000;
    return `${state.race.totalLegs} legs${km >= 0.1 ? ` &middot; ${km.toFixed(1)} km` : ''}`;
}

// The race's cutoff, as the briefing states it — THE SAME RULE the race enforces
// (see the dynamic cutoff in updateRace): the course's authored/compiled limit
// when it has one, otherwise derived from the course length. Anyone still on the
// water at this time is scored DNF.
function timeLimitText() {
    // On a light course whose document authors no cutoff, the stated limit is the
    // straight-line estimate — prefer the one a past FULL build measured, if any.
    const remembered = state.course && _venueStats[state.course.venueKey];
    const cutoff = (state.course && state.course.loadState === 'light'
                    && (!state.course.doc || state.course.doc.course.cutoff == null)
                    && remembered && remembered.cutoff != null)
        ? remembered.cutoff
        : (state.course && state.course.cutoff != null)
        ? state.course.cutoff
        : (state.race.totalLegs * state.race.legLength) / 5 * 0.1875;
    if (cutoff <= 0) return '&mdash;';
    // Unpadded minutes — "7:00", not the race clock's "07:00": this is a stated
    // limit, not a running readout that needs stable digits.
    return `${Math.floor(cutoff / 60)}:${String(Math.floor(cutoff % 60)).padStart(2, '0')}`;
}

// The chart earns its place only when the briefing can carry facts and a chart side by
// side. Below ~400px of section width the facts column would be crushed, so the chart
// yields — the Course row states its numbers either way. (At 1280 the whole briefing
// is cramped — the blurb collapses there too; this is the same trade.)
function layoutVenueCourseMap(pending) {
    const box = document.getElementById('venue-course-box');
    if (!box) return;
    // While the selection's light build is still in flight, the chart holds off
    // entirely — state.course is the PREVIOUS venue, and a wrong chart for a beat is
    // worse than a blank one. The build's completion re-renders the panel.
    if (pending) {
        box.style.display = 'none';
        if (_chartAnim.raf) { cancelAnimationFrame(_chartAnim.raf); _chartAnim.raf = 0; }
        if (_chartAnim.ro) { _chartAnim.ro.disconnect(); _chartAnim.ro = null; }
        return;
    }
    const section = box.parentElement;
    const show = !!(state.course && state.course.route && state.course.route.length)
        && section.clientWidth >= 404;
    box.style.display = show ? 'block' : 'none';
    // Redraw whenever the box actually changes size — the first draw happens before
    // the web fonts land, and when they do the fact rows grow and the box with them;
    // without this the chart stayed sized to the pre-font stack, visibly short of
    // the Wind and Course rows it sits beside.
    if (typeof ResizeObserver !== 'undefined') {
        if (_chartAnim.ro) _chartAnim.ro.disconnect();
        _chartAnim.ro = new ResizeObserver(() => drawCourseMiniMap());
        _chartAnim.ro.observe(box);
    }
    if (show) drawCourseMiniMap();
}

// `target` lets another surface borrow the chart whole — Sailing School's screens draw it
// into their own box. Absent, it is the race-day board's.
function drawCourseMiniMap(target) {
    const T = target || {};
    const box = T.box || document.getElementById('venue-course-box');
    const inner = T.inner || document.getElementById('venue-course-inner');
    const canvas = T.canvas || document.getElementById('venue-course-map');
    if (!box || !inner || !canvas) return;
    const availW = box.clientWidth, availH = box.clientHeight;
    if (availW < 40 || availH < 40) return;

    const marks = state.course.marks || [];
    const route = state.course.route || [];
    const legs = route.length - 1;
    if (legs < 1) return;

    // THE COURSE sets the frame: marks, rounding zones, and the computed paths the
    // legs actually take (a detour around land must not leave the picture).
    const dmc = state.course.dmc;
    const pts = [];
    for (const e of route) {
        if (e.kind === 'round' && e.mark) {
            const z = e.mark.zone || 165;
            pts.push([e.mark.x - z, e.mark.y - z], [e.mark.x + z, e.mark.y + z]);
        } else if (e.marks) {
            for (const i of e.marks) if (marks[i]) pts.push([marks[i].x, marks[i].y]);
        }
    }
    for (let leg = 1; leg <= legs; leg++) {
        const P = dmc && dmc.legs && dmc.legs[leg] && dmc.legs[leg].pts;
        if (P) for (const q of P) pts.push([q.x, q.y]);
    }
    if (pts.length < 2) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    // No boundary in the frame: it was tried, and it pulled every chart out to water
    // nobody races on. The COURSE is the subject — marks, zones and the sailed paths,
    // padded a touch — and whatever land falls inside that frame is the context.
    // AS BIG AS THE BOX ALLOWS, CROPPED BOTH WAYS. The chart scales until it runs
    // out of width or height, then the panel takes only what the course's aspect
    // needs — no letterboxed dead water on either axis. It is pinned bottom-left,
    // so the facts column beside it shares its baseline and growth spends the
    // vertical slack upward.
    const PAD = 16; // room for arrowheads
    const spanX = Math.max(200, maxX - minX), spanY = Math.max(200, maxY - minY);
    const scale = Math.min((availW - 2 * PAD) / spanX, (availH - 2 * PAD) / spanY);
    const w = Math.max(96, Math.round(spanX * scale) + 2 * PAD);
    const h = Math.max(96, Math.round(spanY * scale) + 2 * PAD);
    inner.style.width = w + 'px';
    inner.style.height = h + 'px';
    // The record book fills the water the chart leaves, when there is enough of it.
    const recEl = T.noRecords ? null : document.getElementById('venue-records-inline');
    if (recEl) {
        const remain = availW - w - 16;
        if (remain >= 215) {
            recEl.style.left = (w + 16) + 'px';
            recEl.style.display = 'block';
            renderVenueRecordsInline(recEl);
        } else {
            recEl.style.display = 'none';
        }
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    // The chart is STATIC and the wind is not: everything below draws once into an
    // offscreen layer, and the animation loop blits it under the moving wind comets
    // each frame instead of re-tracing land and legs sixty times a second.
    const off = document.createElement('canvas');
    off.width = canvas.width; off.height = canvas.height;
    const ctx = off.getContext('2d');
    ctx.scale(dpr, dpr);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const X = (x) => w / 2 + (x - cx) * scale;
    const Y = (y) => h / 2 + (y - cy) * scale;

    // Land, faintly — context, not subject. `hidden` shapes draw here too: hidden
    // means "the venue's own art already paints me" (the river's banks sit behind one
    // continuous drawn shore), and the chart has no such art — a collider is land.
    // ONE fill for all of it: translucent fills painted shape by shape stack where
    // shapes overlap, and the river's 82 overlapping banks read as bubbles instead of
    // a shore. A single path with nonzero winding fills the union at one flat alpha.
    // Outlines only on shapes the venue itself draws — an invisible collider gets no
    // internal seams.
    // NORMALIZED WINDING, one ring direction for everything: the mask baker emits
    // rings wound either way, and under nonzero fill two overlapping rings of
    // opposite winding cancel — land over land read as a hole in the terrain. Wound
    // the same way, overlap is union, which is what land on land is.
    const ringPath = (vs) => {
        let area = 0;
        for (let i = 0, n = vs.length; i < n; i++) {
            const p2 = vs[i], q2 = vs[(i + 1) % n];
            area += p2.x * q2.y - q2.x * p2.y;
        }
        const seq = area < 0 ? [...vs].reverse() : vs;
        seq.forEach((v, i) => i ? ctx.lineTo(X(v.x), Y(v.y)) : ctx.moveTo(X(v.x), Y(v.y)));
        ctx.closePath();
    };
    // SHALLOWS FIRST, under the land, because that is where they are. A chart is where a
    // sailor decides whether to cut a bar, so leaving them off would hide the one hazard
    // this view exists to plan around — but they are drawn as a WASH with no outline. An
    // inked edge here is the difference between "you may cross this, slowly" and "sail
    // round it", and the second one is a lie the player would plan on.
    // KEYED ON DRAG, not on who renders it. The chart is information, and what makes a
    // shape informative here is that crossing it costs something — a visual-only zone
    // carries nothing, and drawn in the shoal's warning sand it would read as a hazard
    // that is not there. This used to test `!l.paint`, which was the same answer back
    // when every paint zone was dragless and the wrong one the moment the bayou's weed
    // arrived: a 0.6-drag hyacinth mat is precisely what a sailor opens this view to plan
    // around. `shoalMul < 1` is the same condition _hasShoals uses for the physics, so
    // the chart now warns about exactly the set of things that can slow you down.
    const chartShoals = (state.course.islands || []).filter(l => l.awash && l.shoalMul < 1 && l.vertices && l.vertices.length >= 3);
    if (chartShoals.length) {
        ctx.beginPath();
        for (const isl of chartShoals) ringPath(isl.vertices);
        ctx.fillStyle = 'rgba(232,220,177,0.16)';
        ctx.fill();
    }
    const landShapes = (state.course.landShapes || []).filter(l => l.vertices && l.vertices.length >= 3);
    if (landShapes.length) {
        ctx.beginPath();
        for (const isl of landShapes) ringPath(isl.vertices);
        ctx.fillStyle = 'rgba(238,243,251,0.10)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(238,243,251,0.18)';
        ctx.lineWidth = 1;
        for (const isl of landShapes) {
            if (isl.hidden) continue;
            ctx.beginPath();
            ringPath(isl.vertices);
            ctx.stroke();
        }
    }

    // THE TOUR, not the atlas. The legs, lines and roundings are no longer painted
    // into this layer all at once — chartTourFrame walks them leg by leg on top of
    // it every frame (see the course-tour block below), showing how the course is
    // SAILED rather than where its furniture sits. The static layer keeps only
    // land and a dim pip per mark, so the frame still reads as a chart while the
    // tour is between goals. Reduced motion gets the whole course at once instead
    // (chartStaticCourse) — a walkthrough nobody watches move is a slow diagram.
    for (const mk of marks) {
        ctx.beginPath();
        ctx.arc(X(mk.x), Y(mk.y), 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(238,243,251,0.3)';
        ctx.fill();
    }

    // Wind is MOTION, not a glyph: comet streaks fly downwind across the chart —
    // and they fly the FIELD, not one average. Each comet samples regionWindAt at
    // its own position every frame, so the streaks bend where the authored regions
    // bend, park in the dead spots, and stream where the breeze is real.
    const A = _chartAnim;
    if (A.raf) { cancelAnimationFrame(A.raf); A.raf = 0; }
    A.static = off; A.w = w; A.h = h; A.dpr = dpr; A.last = 0;
    A.box = box; A.canvas = canvas;
    A.visible = T.visible || (() => UI.preRaceOverlay && !UI.preRaceOverlay.classList.contains('hidden'));
    // The chart-to-world transform, inverted — the field lives in world units.
    A.scale = scale; A.cx = cx; A.cy = cy;
    A.X = X; A.Y = Y;
    // Screen-space polyline per leg, measured once — the tour draws partial
    // lengths every frame and should not re-project the ruler each time.
    A.legPaths = [];
    for (let leg = 1; leg <= legs; leg++) {
        const P = dmc && dmc.legs && dmc.legs[leg] && dmc.legs[leg].pts;
        let pp = [];
        if (P && P.length >= 2) pp = P.map(q => [X(q.x), Y(q.y)]);
        else {
            const a = legTargetPoint(leg - 1), b = legTargetPoint(leg);
            if (a && b) pp = [[X(a.x), Y(a.y)], [X(b.x), Y(b.y)]];
        }
        const cum = [0];
        for (let i = 1; i < pp.length; i++)
            cum.push(cum[i - 1] + Math.hypot(pp[i][0] - pp[i - 1][0], pp[i][1] - pp[i - 1][1]));
        A.legPaths[leg] = { pts: pp, cum, total: cum[cum.length - 1] || 0 };
    }
    A.tour = { leg: 1, phase: 'origin', t: 0, clock: 0 };
    const count = Math.max(30, Math.min(140, Math.round(w * h / 400)));
    A.comets = [];
    for (let i = 0; i < count; i++) A.comets.push(spawnChartComet());

    const draw2d = canvas.getContext('2d');
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // One still frame: the whole course at once, and the same streaks at
        // mid-life, pointing the way, no loop.
        chartStaticCourse(ctx, X, Y);
        draw2d.setTransform(1, 0, 0, 1, 0, 0);
        draw2d.drawImage(off, 0, 0);
        draw2d.setTransform(dpr, 0, 0, dpr, 0, 0);
        for (const cm of A.comets) { cm.age = cm.ttl / 2; drawChartComet(draw2d, cm); }
        return;
    }
    A.raf = requestAnimationFrame(chartCometFrame);
}

// The chart's one animation. Comets ride on fxRand — the seeded VISUALS stream — so
// an idle clubhouse never advances the race's own RNG.
const _chartAnim = { raf: 0 };

// The LOCAL wind, in chart terms: the same blended field the boats sail
// (regionWindAt — direction is where the wind comes FROM), turned downwind and
// mapped from knots to chart px/s with enough contrast that a dead spot visibly
// parks its comets while a katabatic corner streams.
function chartWindAt(sx, sy) {
    const A = _chartAnim;
    const wind = regionWindAt(A.cx + (sx - A.w / 2) / A.scale,
                              A.cy + (sy - A.h / 2) / A.scale);
    return { fx: -Math.sin(wind.direction), fy: Math.cos(wind.direction),
             px: 3 + Math.min(60, wind.speed * 2.6), kt: wind.speed };
}

function spawnChartComet() {
    const A = _chartAnim;
    const cm = { x: fxRand() * A.w, y: fxRand() * A.h,
                 ttl: 1.8 + fxRand() * 2.2, age: fxRand() * 1.8,   // desynced fades
                 jit: 0.75 + fxRand() * 0.5 };                     // per-comet size character
    const lw = chartWindAt(cm.x, cm.y);   // the still frame needs a heading too
    cm.fx = lw.fx; cm.fy = lw.fy; cm.kt = lw.kt;
    return cm;
}

// THE STREAK IS THE ANEMOMETER: length, brightness and weight all follow the LOCAL
// knots, so a katabatic corner reads as long hard strokes and a glassy patch as
// short faint drifters — the difference is visible in a still, not only in motion.
function drawChartComet(ctx, cm) {
    const env = Math.sin(Math.PI * Math.min(1, cm.age / cm.ttl));
    const kt = cm.kt || 0;
    const a = env * Math.min(0.8, 0.22 + kt * 0.025);
    if (a <= 0.01) return;
    const len = cm.jit * Math.min(30, 4 + kt * 0.9);
    const tx = cm.x - cm.fx * len, ty = cm.y - cm.fy * len;
    const grad = ctx.createLinearGradient(cm.x, cm.y, tx, ty);
    grad.addColorStop(0, `rgba(190,220,255,${a.toFixed(3)})`);
    grad.addColorStop(1, 'rgba(190,220,255,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.min(2, 1 + kt * 0.035);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cm.x, cm.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
}

// ── The course tour ─────────────────────────────────────────────────────────
// The chart doesn't show the whole route at once — it SAILS it. One leg at a
// time: the origin goal appears (the start line first), the path draws itself
// toward the next goal, the goal lands — a rounding's curl sweeping around its
// mark in the side's colour, on repeat — then the spent goal and path clear and
// the next leg begins from the goal just reached. After the finish the whole
// picture holds a beat and the tour restarts. The point is the ORDER: how to
// move through the course, not just where its furniture sits.

function chartArrowGlyph(ctx, x, y, dx, dy, size, color) {
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    ctx.beginPath();
    ctx.moveTo(x + ux * size, y + uy * size);
    ctx.lineTo(x - ux * size * 0.6 - uy * size * 0.6, y - uy * size * 0.6 + ux * size * 0.6);
    ctx.lineTo(x - ux * size * 0.6 + uy * size * 0.6, y - uy * size * 0.6 - ux * size * 0.6);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

// One route entry's goal, at `alpha`. Lines and gates keep their standing
// colours — start green, gate gold, finish white-dashed. A rounding is the mark
// plus its curled arrow in the SIDE'S OWN colour (red for port, green for
// starboard — the same red and green the water means by those words), and
// `clock` makes the curl sweep around the mark on repeat, tracing the turn the
// way it will be sailed; pass null for the full static curl (reduced motion).
function chartGoalGlyph(ctx, e, marks, X, Y, alpha, clock) {
    if (!e || alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    if ((e.kind === 'line' || e.kind === 'gate') && e.marks) {
        const m1 = marks[e.marks[0]], m2 = marks[e.marks[1]];
        if (m1 && m2) {
            const col = e.role === 'start' ? '#34d399'
                      : e.kind === 'gate' && !e.finish ? '#f2c14e' : '#eef3fb';
            ctx.beginPath();
            ctx.moveTo(X(m1.x), Y(m1.y)); ctx.lineTo(X(m2.x), Y(m2.y));
            ctx.strokeStyle = col;
            ctx.lineWidth = 2;
            if (e.finish) ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
            for (const m of [m1, m2]) {
                ctx.beginPath();
                ctx.arc(X(m.x), Y(m.y), 2.5, 0, Math.PI * 2);
                ctx.fillStyle = col;
                ctx.fill();
            }
        }
    } else if (e.kind === 'round' && e.mark) {
        const port = e.mark.side === 'port';
        const col = port ? '#f87171' : '#4ade80';
        const mx = X(e.mark.x), my = Y(e.mark.y);
        ctx.beginPath();
        ctx.arc(mx, my, 3, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        // The curl grows around the mark, holds a beat, fades, goes again. A port
        // rounding keeps the mark to port — counterclockwise seen from above, and
        // the world renders north-up, so the screen agrees with the water.
        let frac = 1, curlA = 0.9;
        if (clock !== null) {
            const p = (clock % 1.7) / 1.7;
            frac = p < 0.65 ? 1 - Math.pow(1 - p / 0.65, 2) : 1;
            if (p > 0.88) curlA *= (1 - p) / 0.12;
        }
        const r = 8.5, ccw = port;
        const a1 = -Math.PI / 2 + (ccw ? -1.55 : 1.55) * Math.PI * frac;
        ctx.globalAlpha = alpha * curlA;
        ctx.beginPath();
        ctx.arc(mx, my, r, -Math.PI / 2, a1, ccw);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // arrowhead at the arc's end, tangent to it
        const tx = Math.cos(a1), ty = Math.sin(a1);
        chartArrowGlyph(ctx, mx + tx * r, my + ty * r, ccw ? ty : -ty, ccw ? -tx : tx, 4, col);
    }
    ctx.restore();
}

// Point (and local heading) at arc-length `s` along a measured screen polyline.
function chartPathPoint(path, s) {
    const pts = path.pts, cum = path.cum;
    for (let i = 1; i < pts.length; i++) {
        if (cum[i] >= s || i === pts.length - 1) {
            const f = Math.max(0, Math.min(1, (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1)));
            return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
                     y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f,
                     dx: pts[i][0] - pts[i - 1][0], dy: pts[i][1] - pts[i - 1][1] };
        }
    }
    return null;
}

// The leg's path drawn to `prog` of its length, like a pen: an arrowhead rides
// the growing tip while drawing and leaves with it — once the line is complete
// the revealed goal says where it was going, and a leftover mid-path arrow is
// clutter.
function chartTourPath(ctx, path, prog, alpha) {
    if (!path || path.pts.length < 2 || prog <= 0 || alpha <= 0.01) return;
    const target = path.total * Math.min(1, prog);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(path.pts[0][0], path.pts[0][1]);
    for (let i = 1; i < path.pts.length && path.cum[i] <= target; i++)
        ctx.lineTo(path.pts[i][0], path.pts[i][1]);
    const tip = chartPathPoint(path, target);
    if (tip) {
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        if (prog < 1) chartArrowGlyph(ctx, tip.x, tip.y, tip.dx, tip.dy, 5, 'rgba(255,255,255,0.85)');
    } else {
        ctx.stroke();
    }
    ctx.restore();
}

// The tour's phase clock. The draw phase paces to the leg's on-screen length —
// a long beat takes longer to trace than a short hop — everything else is a
// fixed beat, and the finish holds longest: the last goal lingers before the
// loop wipes and restarts.
function chartTourDur(phase, leg) {
    if (phase === 'draw') {
        const p = _chartAnim.legPaths && _chartAnim.legPaths[leg];
        return Math.max(0.6, Math.min(1.8, ((p && p.total) || 150) / 240));
    }
    return { origin: 0.45, reveal: 0.35, hold: 1.2, holdFinal: 2.6, fade: 0.4 }[phase];
}

// One frame of the walkthrough: advance the phase clock, then draw at most three
// things — the start line (leg 1 only), the leg's path (partial while drawing),
// and its destination goal. 'fade' clears the WHOLE leg, goal included: a goal
// already shown as one leg's end is not re-shown as the next leg's beginning —
// the next path simply draws from where it stood, and the picture never carries
// more than one leg.
function chartTourFrame(ctx, dt) {
    const A = _chartAnim, T = A.tour;
    const route = (state.course && state.course.route) || [];
    const marks = (state.course && state.course.marks) || [];
    const legs = route.length - 1;
    if (!T || legs < 1) return;
    T.clock += dt;
    T.t += dt;
    const durOf = (ph) => chartTourDur(ph === 'hold' && T.leg === legs ? 'holdFinal' : ph, T.leg);
    let d;
    while (T.t >= (d = durOf(T.phase))) {
        T.t -= d;
        if (T.phase === 'origin') T.phase = 'draw';
        else if (T.phase === 'draw') T.phase = 'reveal';
        else if (T.phase === 'reveal') T.phase = 'hold';
        else if (T.phase === 'hold') T.phase = 'fade';
        else if (T.leg === legs) { T.leg = 1; T.phase = 'origin'; }
        else { T.leg++; T.phase = 'draw'; }
    }
    const k = Math.min(1, T.t / durOf(T.phase));
    let originA = 1, pathProg = 1, pathA = 1, destA = 1;
    if (T.phase === 'origin')      { originA = k; pathProg = pathA = destA = 0; }
    else if (T.phase === 'draw')   { pathProg = k; destA = 0; }
    else if (T.phase === 'reveal') { destA = k; }
    else if (T.phase === 'fade')   { originA = pathA = destA = 1 - k; }
    // The start line is the only goal ever shown at a leg's beginning — every
    // later leg starts from a goal the viewer just watched land, so re-drawing
    // it would only restate the obvious.
    if (T.leg === 1) chartGoalGlyph(ctx, route[0], marks, A.X, A.Y, originA, T.clock);
    chartTourPath(ctx, A.legPaths[T.leg], pathProg, pathA);
    chartGoalGlyph(ctx, route[T.leg], marks, A.X, A.Y, destA, T.clock);
}

// The whole course at once — the pre-tour chart, kept for reduced motion where
// a leg-by-leg walkthrough would never move. Physical lines are merged across
// roles (a windward-leeward reuses one pair of marks as start, leeward gate and
// finish): the start's green outranks the gate's gold, and the finish rides on
// top as white dashes over any base.
function chartStaticCourse(ctx, X, Y) {
    const marks = state.course.marks || [];
    const route = state.course.route || [];
    const dmc = state.course.dmc;
    const legs = route.length - 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    for (let leg = 1; leg <= legs; leg++) {
        const P = dmc && dmc.legs && dmc.legs[leg] && dmc.legs[leg].pts;
        if (P && P.length >= 2) {
            ctx.beginPath();
            P.forEach((q, i) => i ? ctx.lineTo(X(q.x), Y(q.y)) : ctx.moveTo(X(q.x), Y(q.y)));
            ctx.stroke();
            const i = Math.max(1, Math.round((P.length - 1) * 0.42));
            chartArrowGlyph(ctx, X(P[i].x), Y(P[i].y), X(P[i].x) - X(P[i - 1].x), Y(P[i].y) - Y(P[i - 1].y),
                            5, 'rgba(255,255,255,0.75)');
            continue;
        }
        const a = legTargetPoint(leg - 1), b = legTargetPoint(leg);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(X(a.x), Y(a.y));
        ctx.lineTo(X(b.x), Y(b.y));
        ctx.stroke();
        const t = 0.42;
        chartArrowGlyph(ctx, X(a.x + (b.x - a.x) * t), Y(a.y + (b.y - a.y) * t),
                        X(b.x) - X(a.x), Y(b.y) - Y(a.y), 5, 'rgba(255,255,255,0.75)');
    }
    const segs = new Map();
    for (const e of route) {
        if ((e.kind !== 'line' && e.kind !== 'gate') || !e.marks) continue;
        const m1 = marks[e.marks[0]], m2 = marks[e.marks[1]];
        if (!m1 || !m2) continue;
        const key = Math.min(e.marks[0], e.marks[1]) + '|' + Math.max(e.marks[0], e.marks[1]);
        const g = segs.get(key) || { m1, m2, start: false, finish: false, gate: false };
        if (e.role === 'start') g.start = true;
        if (e.finish) g.finish = true;
        if (e.kind === 'gate') g.gate = true;
        segs.set(key, g);
    }
    for (const g of segs.values()) {
        const col = g.start ? '#34d399' : g.gate ? '#f2c14e' : g.finish ? '#eef3fb' : 'rgba(255,255,255,0.6)';
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(X(g.m1.x), Y(g.m1.y)); ctx.lineTo(X(g.m2.x), Y(g.m2.y));
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.stroke();
        if (g.finish && col !== '#eef3fb') {
            ctx.setLineDash([4, 3]);
            ctx.strokeStyle = '#eef3fb';
            ctx.stroke();
            ctx.setLineDash([]);
        }
        for (const m of [g.m1, g.m2]) {
            ctx.beginPath();
            ctx.arc(X(m.x), Y(m.y), 2.5, 0, Math.PI * 2);
            ctx.fillStyle = col;
            ctx.fill();
        }
    }
    for (const e of route) {
        if (e.kind === 'round' && e.mark) chartGoalGlyph(ctx, e, marks, X, Y, 1, null);
    }
}

// Self-terminating: the loop lives only while the race-day board is up and the chart
// is showing. Everything that re-opens or re-sizes the chart goes through
// drawCourseMiniMap, which restarts it.
function chartCometFrame(ts) {
    const A = _chartAnim;
    const box = A.box || document.getElementById('venue-course-box');
    const canvas = A.canvas || document.getElementById('venue-course-map');
    const boardUp = A.visible ? A.visible() : (UI.preRaceOverlay && !UI.preRaceOverlay.classList.contains('hidden'));
    if (!A.static || !box || !canvas || box.style.display === 'none' || !boardUp || !canvas.isConnected) {
        A.raf = 0;
        return;
    }
    const dt = A.last ? Math.min(0.05, (ts - A.last) / 1000) : 0.016;
    A.last = ts;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(A.static, 0, 0);
    ctx.setTransform(A.dpr, 0, 0, A.dpr, 0, 0);
    chartTourFrame(ctx, dt);
    const M = 18; // wrap margin: a comet leaves fully before it re-enters fully
    for (const cm of A.comets) {
        const lw = chartWindAt(cm.x, cm.y);
        cm.fx = lw.fx; cm.fy = lw.fy; cm.kt = lw.kt;
        cm.x += lw.fx * lw.px * dt;
        cm.y += lw.fy * lw.px * dt;
        cm.age += dt;
        if (cm.x < -M) cm.x += A.w + 2 * M; else if (cm.x > A.w + M) cm.x -= A.w + 2 * M;
        if (cm.y < -M) cm.y += A.h + 2 * M; else if (cm.y > A.h + M) cm.y -= A.h + 2 * M;
        if (cm.age > cm.ttl) {
            cm.age = 0;
            cm.ttl = 1.8 + fxRand() * 2.2;
            cm.x = fxRand() * A.w;
            cm.y = fxRand() * A.h;
            cm.jit = 0.75 + fxRand() * 0.5;
        }
        drawChartComet(ctx, cm);
    }
    A.raf = requestAnimationFrame(chartCometFrame);
}

// --- Competitor scouting (sidebar, below the venue briefing) ---------------
let selectedCompetitor = null;
// Sentinel for the player's own fleet card. Deliberately not a legal AI_CONFIG
// name, so it can't collide with a competitor — or with a player who names
// themselves after one.
const PLAYER_CARD_KEY = '__player__';

// Clicking a badge opens that boat's scouting notes underneath it, in the list. Clicking
// it again closes them. There is no separate detail panel any more: with the fleet listed
// as badges, the notes belong to the badge you clicked, and a second panel would have been
// a second place to look for one boat.
function selectCompetitor(name) {
    selectedCompetitor = selectedCompetitor === name ? null : name; // toggle
    renderCompetitorGrid();
    // The list scrolls, so an expansion below the fold is an expansion nobody sees.
    if (selectedCompetitor && UI.prCompetitorsGrid) {
        const item = UI.prCompetitorsGrid.querySelector(`[data-name="${selectedCompetitor}"]`);
        if (item && item.scrollIntoView) item.scrollIntoView({ block: 'nearest' });
    }
}

// Kept as the name the pre-race setup and the venue switch call: selection state lives in
// the list now, so re-rendering the list IS re-rendering the detail.
function renderCompetitorDetail() { renderCompetitorGrid(); }

// Perceived brightness of a hex color. Three callers now (fleet cards, the
// competitor profile band, the player card), all asking the same question:
// is this color too dark or too washed out to carry a panel background?
function colorLuma(c) {
    const hex = (c || '#888888').replace('#', '');
    const dbl = hex.length === 3;
    const part = (i) => parseInt(dbl ? hex[i] + hex[i] : hex.substring(i * 2, i * 2 + 2), 16) || 0;
    return 0.299 * part(0) + 0.587 * part(1) + 0.114 * part(2);
}

// A color reads as a panel background unless it is near-black or near-white;
// in those cases fall back to the boat's other signature color.
function bandColorFor(primary, fallback) {
    const l = colorLuma(primary);
    return (l < 50 || l > 200) ? fallback : primary;
}

const _rgbOf = (c) => {
    const h = (c || '#64748b').replace('#', '');
    const dbl = h.length === 3;
    const part = (i) => parseInt(dbl ? h[i] + h[i] : h.substring(i * 2, i * 2 + 2), 16) || 0;
    return [part(0), part(1), part(2)];
};

// THE BOAT'S COLOUR, for a 42px leaderboard row — which is a different problem from the
// 128px profile card, twice over.
//
// `bandColorFor` picks by LUMINANCE: hull unless it is near-black or near-white, else the
// spinnaker. On a big card that is right. Here it failed twice. Most spinnakers are white,
// so two thirds of the fleet came out as a pale wash that swallowed the rank numeral. And
// deepening that wash does not rescue it: scaling white down gives GREY, because white has
// no hue to keep.
//
// So pick by CHROMA instead — whichever of the boat's colours is most saturated is the one
// a player would name it by — then pin the luminance so white text wins over all of them.
function deepBandFor(primary, fallback, accent) {
    const chromaOf = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
    const lumaOf = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

    // THE HULL FIRST, when it can carry the job. It is the biggest piece of a boat and the
    // thing a player would name it by — picking purely by chroma made Finley olive, because
    // her yellow kite out-saturates a perfectly good blue hull. The hull only loses when it
    // cannot serve: too dark, too pale, or too grey to read as a colour at all.
    let best = null, bestChroma = -1;
    const hull = primary ? _rgbOf(primary) : null;
    if (hull && chromaOf(hull) >= 40 && lumaOf(hull) > 45 && lumaOf(hull) < 205) {
        best = hull; bestChroma = chromaOf(hull);
    } else {
        for (const c of [fallback, accent, primary]) {
            if (!c) continue;
            const rgb = _rgbOf(c);
            if (chromaOf(rgb) > bestChroma) { bestChroma = chromaOf(rgb); best = rgb; }
        }
    }
    // A genuinely colourless boat gets the panel's own slate rather than a grey smear.
    if (!best || bestChroma < 30) return 'rgb(44,58,80)';
    let [r, g, b] = best;
    // Saturate toward the dominant channel a little, so a muted colour still reads as one
    // at this size, then scale to a fixed luminance.
    const mean = (r + g + b) / 3;
    const PUNCH = 1.35;
    r = mean + (r - mean) * PUNCH; g = mean + (g - mean) * PUNCH; b = mean + (b - mean) * PUNCH;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    const TARGET = 104;                 // colour reads, and white on it still clears 4.5:1
    const k = l > 1 ? TARGET / l : 1;
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

// Portrait band + blurb + stat bars + counter-tactic, as markup. Shared by the
// pre-race sidebar and the competitor.html roster sheet, so the roster always
// shows exactly what a player sees.
// The SPECIES, under the name. A competitor's name is invented ("Bruce") and its
// creature is the fact ("Great White Shark") — the profile said the first and never the
// second, so the roster read as 81 names rather than 81 animals.
//
// Set in mono rather than in the display or label face on purpose. The band already
// carries a 36px Saira name and an uppercase letterspaced archetype, and a third
// weight of the same voice would fight both. Mono reads as a specimen line — a
// stated fact rather than a third piece of branding — and it is the face the design
// system already uses for data everywhere else.
//
// Rendered by a helper because the same line goes on the fleet cards, where it has to
// be smaller: one definition, two sizes, so the two can't drift.
function speciesLine(creature, size) {
    if (!creature) return '';
    const s = size || 13;
    return `<div class="t-mono" style="font-size:${s}px; letter-spacing:0.4px; margin-top:${s > 11 ? 3 : 2}px;`
         + ` color:rgba(255,255,255,0.72); text-shadow:0 1px 4px rgba(0,0,0,0.75);">${creature}</div>`;
}

// THE IDENTITY BAND: portrait, name, species, archetype, boat. This is the fleet display —
// the block a player already reads when scouting a rival and when looking at themselves — so
// it is a function rather than markup inlined in one panel. The character picker is its third
// caller and shows exactly the same block, minus the archetype (see openCharacterPicker).
//
// `opts.archetype` false drops the gold archetype line but keeps its box, so a band with one
// and a band without still stack to the same height in a grid.
//
// `opts.compact` is the band at the size the race-day board's fleet list uses: a smaller
// portrait and name so ten of them stack in a 470px column.
//
// `opts.boat` keeps or drops the rig preview at the right-hand end; it defaults to ON for a
// full-size band and OFF for a compact one. ⚠️ IT IS NOT A TASTE CALL: `renderProfileBoat`
// claims 36% of the band's width, so the name and the species run underneath it once the
// band is narrower than about 420px. Pass `boat: true` on a compact band only when the
// column is wide enough to carry both — the fleet list at 470px is, a 380px panel is not.
// `opts.label` replaces the gold archetype line with a line of your own. The fleet list
// uses it to put YOU on your own badge — an archetype names the AI behaviour driving a
// character's stats, and on the boat you are steering there is no such behaviour to name.
function profileBandHTML(config, opts) {
    const o = opts || {};
    const showArch = o.archetype !== false;
    const compact = !!o.compact;
    const withBoat = o.boat !== undefined ? !!o.boat : !compact;
    const archDef = (typeof ARCHETYPES !== 'undefined' && config.archetype) ? ARCHETYPES[config.archetype] : null;
    // Header band in the competitor's racing colors (same hull-vs-spinnaker
    // luma pick as the fleet cards, so the panel matches their card)
    const bandColor = bandColorFor(config.hull, config.spinnaker);
    return `
        <div class="rounded-xl overflow-hidden border border-white/10 relative"
             style="background: linear-gradient(105deg, ${bandColor} 0%, ${bandColor}66 45%, rgba(15,23,42,0.92) 100%)">
            ${withBoat ? `<canvas class="profile-boat-canvas absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" width="176" height="130" data-boat="${config.name}"></canvas>` : ''}
            <div class="flex items-center relative" style="gap:${compact ? 14 : 20}px;">
                <img src="assets/images/competitors/${config.name.toLowerCase()}.png" alt="${config.name}" class="object-cover shrink-0" draggable="false"
                     style="width:${compact ? 92 : 128}px; height:${compact ? 92 : 128}px;">
                <div style="padding:${compact ? '10px 12px 10px 0' : '16px 0'}; min-width:0;">
                    <div class="t-display text-white uppercase leading-tight truncate" style="font-size:${compact ? 26 : 36}px; text-shadow: 0 2px 8px rgba(0,0,0,0.6)">${config.name}</div>
                    ${speciesLine(config.creature, compact ? 11 : 13)}
                    <div class="t-label mt-1" style="font-size:${compact ? 11 : 13}px; letter-spacing:${compact ? 1.8 : 2.5}px; color:#fcd34d; text-shadow: 0 1px 4px rgba(0,0,0,0.7)">${o.label !== undefined ? o.label : (showArch && archDef ? archDef.label : '')}</div>
                </div>
            </div>
        </div>`;
}

// THE SCOUTING NOTES: what this rival does, the three stats that say it, and how to beat
// them. Split out from the profile because the race-day board shows them on their own,
// under the badge you clicked — the badge is already there, so repeating it would be the
// same face twice in 90px.
function scoutingNotesHTML(config, compact) {
    const archDef = (typeof ARCHETYPES !== 'undefined' && config.archetype) ? ARCHETYPES[config.archetype] : null;

    // Highlight the character's three most extreme stats (base ±5 design
    // values, not the AI difficulty bonus) — the bars always say something.
    const STAT_NAMES = {
        acceleration: 'Acceleration', momentum: 'Momentum', handling: 'Handling',
        upwind: 'Upwind', reach: 'Reach', downwind: 'Downwind', pressure: 'Pressure',
        lightAir: 'Light Air', heavyAir: 'Heavy Air', memory: 'Memory'
    };
    const stats = config.stats || {};
    const sorted = Object.entries(stats).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const top3 = sorted.slice(0, 3);
    // A profile should show both sides: if the three most extreme stats are
    // all weaknesses (or all strengths), swap the last for the best of the
    // other sign — Pulse's panel shouldn't be a wall of red.
    const rest = sorted.slice(3);
    if (!top3.some(([, v]) => v > 0)) {
        const bestPos = rest.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
        if (bestPos) top3[2] = bestPos;
    } else if (!top3.some(([, v]) => v < 0)) {
        const worstNeg = rest.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1])[0];
        if (worstNeg) top3[2] = worstNeg;
    }
    // Strengths first, then weaknesses
    top3.sort((a, b) => (b[1] >= 0 ? 1 : 0) - (a[1] >= 0 ? 1 : 0) || Math.abs(b[1]) - Math.abs(a[1]));
    const bars = top3.map(([key, v]) => {
        const pos = v >= 0;
        return `
        <div class="flex items-center" style="gap:${compact ? 8 : 12}px;">
            <span class="t-label t-label-sm" style="width:${compact ? 84 : 112}px;">${STAT_NAMES[key]}</span>
            <div class="flex-1 rounded-full relative overflow-hidden" style="height:${compact ? 6 : 10}px; background:#293346;">
                <div class="absolute inset-y-0 left-1/2 w-px bg-white/20"></div>
                <div class="absolute inset-y-0 ${pos ? 'left-1/2 bg-emerald-400' : 'right-1/2 bg-rose-400'} rounded-full" style="width:${Math.abs(v) * 10}%"></div>
            </div>
            <span class="t-mono w-8 text-right ${pos ? 'text-emerald-300' : 'text-rose-300'}" style="font-size:${compact ? 12.5 : 14.5}px;">${v > 0 ? '+' : ''}${v}</span>
        </div>`;
    }).join('');

    const S = compact
        ? { quote: 13.5, quoteTop: 0, barsTop: 10, barGap: 7, headTop: 10, beat: 13 }
        : { quote: 16, quoteTop: 16, barsTop: 20, barGap: 12, headTop: 20, beat: 15 };

    return `
        <div class="italic pl-3" style="margin-top:${S.quoteTop}px; font-size:${S.quote}px; color:#e6ecf8; border-left:3px solid #fcd34d;">${config.personality || ''}</div>
        <div class="flex flex-col" style="gap:${S.barGap}px; margin-top:${S.barsTop}px;">${bars}</div>
        <div class="t-label t-label-sm" style="margin-top:${S.headTop}px;">How to Beat Them</div>
        <div class="mt-1 leading-snug" style="font-size:${S.beat}px; font-weight:500; color:#9fe6c4;">${config.beat || (archDef ? archDef.weakness : '')}</div>`;
}

// `asSelf` is the PLAYER looking at the character they have chosen. It keeps only what you
// actually take on — the face, the name, the species and the boat — and drops everything
// that describes a RIVAL: the stat bars (you take none of their stats), the archetype label
// (that is the AI behaviour driving those stats), the personality quote (they are not
// speaking, you are steering) and the counter-tactic, which would tell you how to beat
// yourself.
function competitorProfileHTML(config, asSelf, compact) {
    return profileBandHTML(config, { archetype: !asSelf, compact: !!compact })
        + (asSelf ? `` : `<div style="margin-top:${compact ? 12 : 16}px;">${scoutingNotesHTML(config, compact)}</div>`);
}

// Cockpit sole, wheel and mast, in the hull sprite's own coordinates. The sprite
// bakes the coaming, deck hatch and trunk; the sole is painted here so every boat
// keeps its own cockpit colour, and the wheel goes back on top of that paint —
// the sprite's own wheel sits underneath it. Shared by the race and the profile
// card so the two can't drift apart.
function drawCockpitFittings(g, cockpitColor) {
    const c = cockpitColor || '#cbd5e1';
    g.save(); // lineWidth/lineCap here must not leak into the sails or the fly
    // Matches the sole the artwork outlines: template px x 376..648, y 580..861
    const sole = () => { g.beginPath(); g.roundRect(-8.5, 6.75, 17, 17.5, 5); };
    g.fillStyle = c;
    sole(); g.fill();

    // The cockpit is a WELL sunk into the deck, so the coaming shades the sole
    // all the way around its inside edge. Clip to the sole and stroke the same
    // path: the outer half of each stroke is clipped away, leaving a band that
    // hugs the inside. Two bands, not a smooth ramp — the style guide asks for
    // hard 1-2 tone shading and no soft gradients, and the crisp step reads as
    // a well rather than a dished bowl. The middle of the sole stays flat,
    // because most of a cockpit floor is flat.
    //
    // Even all the way round rather than cast to one side — the boat rotates,
    // so a directional pool of shadow would swing with her and read as wrong.
    g.save();
    sole(); g.clip();
    for (const [inset, alpha] of [[2.4, 0.11], [1.1, 0.14]]) {
        g.strokeStyle = `rgba(15,23,42,${alpha})`;
        g.lineWidth = inset * 2; // half falls outside the clip
        sole(); g.stroke();
    }
    g.restore();

    // Wheel: dark on a pale sole, pale on a dark one, so it reads on any paint job
    const hex = c.replace('#', '');
    const luma = 0.299 * parseInt(hex.substring(0, 2), 16)
               + 0.587 * parseInt(hex.substring(2, 4), 16)
               + 0.114 * parseInt(hex.substring(4, 6), 16);
    const ink = (luma > 140 || !Number.isFinite(luma)) ? '#475569' : '#e2e8f0';
    const cy = 19.5, r = 3.05;
    g.strokeStyle = ink; g.fillStyle = ink;
    g.lineWidth = 0.6; g.lineCap = 'round';
    g.beginPath(); g.arc(0, cy, r, 0, Math.PI * 2); g.stroke();
    g.beginPath();
    for (const a of [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6]) {
        g.moveTo(0, cy); g.lineTo(Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.stroke();
    g.beginPath(); g.arc(0, cy, 0.85, 0, Math.PI * 2); g.fill();

    // Mast
    g.fillStyle = '#475569'; g.beginPath(); g.arc(0, -5, 3, 0, Math.PI * 2); g.fill();
    g.restore();
}

// Their boat, kite flying, drawn from the same sprite pipeline as the race.
// Drawn around the origin at unit scale — the caller fits and places it.
function drawProfileBoatArt(g, cfg) {
    const u = 1024 / BOAT_SPRITE_SCALE;
    g.save();
    g.rotate(Math.PI / 6); // bow angled ~30° to the right
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.beginPath(); g.ellipse(3, 3, 12, 28, 0, 0, Math.PI * 2); g.fill();
    const hull = getTintedBoatPart('hull', cfg.hull);
    if (hull) g.drawImage(hull, -512 / BOAT_SPRITE_SCALE, -472 / BOAT_SPRITE_SCALE, u, u);
    drawCockpitFittings(g, cfg.cockpit);
    const sail = (sprite, tackY, rot, mirror) => {
        if (!sprite) return;
        g.save();
        g.translate(0, tackY);
        g.rotate(rot);
        g.scale(mirror, 1);
        g.globalAlpha = 0.95;
        g.drawImage(sprite, -512 / BOAT_SPRITE_SCALE, -112 / BOAT_SPRITE_SCALE, u, u);
        g.restore();
        g.globalAlpha = 1;
    };
    // broad reach: main and kite both to starboard, set at the same angle
    sail(getTintedBoatPart('main', cfg.sail), -5, -1.25, 1);
    // spinPattern first: the player picks theirs explicitly, and SPIN_LOOKS is
    // keyed by competitor name so it would miss them (or worse, match if they
    // happened to name themselves after one).
    sail(getSpinnakerSprite(cfg.spinPattern || SPIN_LOOKS[cfg.name] || 'solid', cfg.spinnaker, cfg.spinnaker2 || cfg.hull, cfg.spinnaker3), -28, -1.25, 1);
    g.restore();
}

// Painted bounds of that composition, relative to the origin. The silhouette is
// identical for every competitor (only the tints differ) and the pose is fixed,
// so this is a constant rather than a measurement — sniffing it from pixels
// would mean getImageData, which throws on a file:// page's tainted canvas.
// Re-derive it (alpha > 8 over a scratch render) if the pose or art changes.
const PROFILE_BOAT_BOUNDS = { x: -26, y: -26, w: 77, h: 59 };

// Can a profile boat be drawn at all yet? Both callers below need the answer: one to
// re-schedule itself, the other to decide whether the result is worth caching.
function boatSpritesReady() {
    return ['hull', 'main', 'spin'].every(k => boatSprites[k].complete && boatSprites[k].naturalWidth);
}

function renderProfileBoat(canvas, cfg) {
    if (!canvas) return;
    // Claim the right end of the header band, but give ground on narrow panels
    // so the boat never crowds the competitor's name
    const band = canvas.parentElement;
    const CW = Math.round(Math.max(104, Math.min(176, (band ? band.clientWidth : 480) * 0.36)));
    const CH = Math.max(96, Math.min(130, band ? band.clientHeight : 130));
    // Render at device resolution — a CSS-sized backing store blurs on HiDPI
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(CW * dpr)) {
        canvas.width = Math.round(CW * dpr); canvas.height = Math.round(CH * dpr);
        canvas.style.width = CW + 'px'; canvas.style.height = CH + 'px';
    }
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    if (!boatSpritesReady()) {
        // sprites still loading (first open) — retry once they're in, unless
        // the panel has been swapped out from under us in the meantime
        setTimeout(() => { if (canvas.isConnected) renderProfileBoat(canvas, cfg); }, 300);
        return;
    }
    const box = PROFILE_BOAT_BOUNDS;
    // Fit the whole rig inside the canvas so nothing clips against the band
    // edge, but keep it a garnish rather than letting it fill the panel
    const pad = 7;
    const scale = Math.min(1.65, (CW - pad * 2) / box.w, (CH - pad * 2) / box.h);
    g.save();
    g.scale(dpr, dpr);
    g.translate(CW / 2, CH / 2);
    g.scale(scale, scale);
    g.translate(-(box.x + box.w / 2), -(box.y + box.h / 2));
    drawProfileBoatArt(g, cfg);
    g.restore();
}

// Name, colours, kite pattern and stats — everything that says WHICH BOAT this is, with
// nothing about where it is or how its race is going. Split out so a character can be
// swapped onto a boat that is already on the water (see swapClashingOpponent).
function applyBoatIdentity(boat, config, isPlayer) {
    boat.name = config ? config.name : boat.name;
    boat.colors = config
        ? { hull: config.hull, sail: config.sail, cockpit: config.cockpit, spinnaker: config.spinnaker }
        : { hull: '#fff', sail: '#fff', cockpit: '#ccc', spinnaker: '#f00' };
    // Panel pattern (SPIN_LOOKS, config.spinPattern override, name-hash fallback);
    // accent colours come from config.spinnaker2/3.
    boat.spinPattern = (config && config.spinPattern) || SPIN_LOOKS[boat.name] || spinPatternForName(boat.name);
    if (config && config.spinnaker2) boat.colors.spinAccent = config.spinnaker2;
    // Optional third kite colour. Absent means the two-colour look, unchanged.
    if (config && config.spinnaker3) boat.colors.spinAccent3 = config.spinnaker3;

    // Stats (copied so the difficulty bonus never mutates AI_CONFIG). Missing keys fall
    // back to 0, so a character authored before a stat existed races exactly as it did.
    //
    // ⚠️ THE PLAYER TAKES NONE OF THEM. You get the boat, not the sailor.
    //
    // NEUTRAL-BOT MACHINERY (2026-08-08, owner-directed). `window.__CHAR` is the
    // existing harness switch for character layers — it already carried
    // `traitsOff` for the archetype persona; it now also carries the two stat
    // layers, so a probe can strip exactly as much of "the sailor" as its
    // question needs:
    //   traitsOff — archetype/character BEHAVIOUR (see the traits site)
    //   statsOff  — per-character stat blocks: every bot gets STAT_DEFAULTS
    //   bonusOff  — the flat AI_STAT_BONUS difficulty handicap
    //   neutral   — shorthand for traitsOff + statsOff: one identical boat for
    //               every rival, at the SHIPPED difficulty (bonus still on)
    // WHY THE BONUS IS A SEPARATE KNOB: `statsOff` answers "is this result a
    // roster draw?", which is a question about VARIANCE between characters.
    // `bonusOff` answers "how much of the human gap is decisions rather than the
    // +4 handicap?", which is a question about the LEVEL. They are independent
    // and the machinery keeps them independent.
    // ⚠️ INERT BY DEFAULT: nothing sets `window.__CHAR` in the shipping game, so
    // this reads exactly as it did — verified by goldens and a byte-identical
    // bench, not assumed.
    const CH = (typeof window !== 'undefined' && window.__CHAR) || null;
    const statsOff = !!(CH && (CH.statsOff || CH.neutral));
    boat.stats = Object.assign({}, STAT_DEFAULTS,
        (!isPlayer && !statsOff && config && config.stats) || {});
    if (!isPlayer && !(CH && CH.bonusOff)) {
        for (const k of BONUS_STATS) boat.stats[k] += AI_STAT_BONUS;
    }
}

// ── THE CHARACTER PICKER ────────────────────────────────────────────────────
// Every cell IS THE FLEET DISPLAY — the same portrait + name + species + boat band the
// pre-race panel puts on a rival and on you (`profileBandHTML`). One block in three places,
// so the character you are choosing looks exactly like the character you become. A band is
// wide, so the grid fits two or three per row where the old tiles fit five; the boat, the
// face and the species are all legible at a glance, which the tiles never quite managed.
//
// THE ARCHETYPE LINE IS DROPPED HERE. It labels the AI behaviour driving that character's
// stats, and the player takes NO stats (see applyBoatIdentity) — "line bully" on a card you
// are about to pick promises a way of sailing that picking it cannot deliver.
//
// SORTED ALPHABETICALLY. With 100 characters this is where you come to find a NAME you have
// already met — on the leaderboard, in a profile, in someone's beat line — and A to Z is the
// only order that answers "where is Clutch". (It was sorted by hull hue when the cells were
// colour swatches and the fleet was smaller; a hue wheel is a fine way to browse and a
// useless way to look something up.)
let characterOrder = null;
function charactersAlphabetical() {
    if (!characterOrder) characterOrder = AI_CONFIG.slice().sort((a, b) => a.name.localeCompare(b.name));
    return characterOrder;
}

// Baked once per character and reused. 100 boats is 100 canvases of tinted sprite
// compositing; doing that every time the picker opens is waste, and `renderProfileBoat`
// re-schedules itself every 300ms until the boat sprites load — 100 of those racing each
// other on first open is worse than waste.
const _charBoatCache = new Map();
function characterBoatCanvas(cfg) {
    // ⚠️ NOTHING IS CACHED UNTIL THE SPRITES ARE IN. `renderProfileBoat` draws nothing while
    // they load and retries only for as long as its canvas `isConnected` — which a detached
    // bake canvas never is. Caching that blank would leave the boat blank for the session.
    if (!boatSpritesReady()) return null;
    const hit = _charBoatCache.get(cfg.name);
    if (hit) return hit;
    // Detached on purpose. `renderProfileBoat` sizes itself from its parent, so baking inside
    // the grid would re-bake at a different size after every window resize; with no parent it
    // falls back to the 480px band it was designed for, which is the picker's column minimum.
    const c = document.createElement('canvas');
    renderProfileBoat(c, cfg);
    _charBoatCache.set(cfg.name, c);
    return c;
}

function openCharacterPicker() {
    if (!UI.characterPicker) return;
    const grid = UI.characterPicker.querySelector('#character-grid');
    // Unhide BEFORE filling it: `renderProfileBoat` measures its parent, and a display:none
    // grid measures zero — which would shrink every boat to the 104px floor.
    UI.characterPicker.classList.remove('hidden');
    grid.innerHTML = '';
    for (const cfg of charactersAlphabetical()) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.dataset.char = cfg.name;
        const me = cfg.name === settings.character;
        // The band brings its own border, rounding and gradient, so the cell adds only the
        // ring: amber for the character you are already sailing, white on hover to say the
        // rest are live. A ring rather than a border — a border would resize the band and
        // shift the row.
        cell.className = 'block w-full text-left rounded-xl transition '
            + (me ? 'ring-2 ring-amber-400' : 'hover:ring-2 hover:ring-white/30');
        cell.innerHTML = profileBandHTML(cfg, { archetype: false });
        cell.addEventListener('click', () => pickCharacter(cfg.name));
        grid.appendChild(cell);

        // Painted after the cell is in the document: the baked-canvas path needs no layout,
        // but the fallback below does — both its size and its retry come from being connected.
        const canvas = cell.querySelector('.profile-boat-canvas');
        const baked = characterBoatCanvas(cfg);
        if (baked) {
            canvas.width = baked.width; canvas.height = baked.height;
            canvas.style.width = baked.style.width; canvas.style.height = baked.style.height;
            canvas.getContext('2d').drawImage(baked, 0, 0);
        } else {
            renderProfileBoat(canvas, cfg);   // sprites still loading; it will retry itself
        }
    }
}
function closeCharacterPicker() {
    if (UI.characterPicker) UI.characterPicker.classList.add('hidden');
}
(() => {
    const btn = document.getElementById('character-picker-close');
    if (btn) btn.addEventListener('click', closeCharacterPicker);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && UI.characterPicker && !UI.characterPicker.classList.contains('hidden')) {
            closeCharacterPicker();
        }
    });
})();

function pickCharacter(name) {
    settings.character = name;
    saveSettings();
    applyPlayerCharacter();
    closeCharacterPicker();
    renderCompetitorGrid();
}

// --- Who the player is ------------------------------------------------------
// The player IS one of the fleet's characters. `playerBoatConfig` used to assemble a
// competitor-shaped object out of the appearance settings so the player could go through
// the competitors' renderer; now it just IS a competitor's config, which is the same shape
// arrived at honestly.
//
// ⚠️ STATS ARE NOT PART OF IT — see the Boat constructor. A character's stats are what makes
// the AI sail like them; handing those to the player would turn the picker into a difficulty
// setting and make every eval number depend on which face was chosen.
function playerCharacter() {
    return AI_CONFIG.find(c => c.name === settings.character) || AI_CONFIG[0];
}
function playerBoatConfig() { return playerCharacter(); }

// The character can change from the picker, so everything that says who you are re-reads
// it: the header chip, your face in the fleet, and the panel if it happens to be open.
// Visuals only.
function refreshPlayerAppearance() {
    if (UI.prCompetitorsGrid && UI.prCompetitorsGrid.children.length) renderCompetitorGrid();
}

// Player names are free text and land in innerHTML in two places here.
function escapeHTMLText(s) {
    return String(s).replace(/[&<>"']/g, ch => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

// ── Selecting a venue is TWO beats ──────────────────────────────────────────
// The click paints immediately from the document alone — art, name, blurb, the authored
// card rows — and the computed half of the board (wind range, distance, the chart)
// arrives one breath later from a LIGHT course build. It used to run the full build in
// the click handler, and a click that spends two seconds building a nav grid before it
// repaints reads as a click that did not work. The FULL build — validator, planner,
// router legs, pressure scan — waits until Start Race, behind a stated loading step.
//
// The token retires a deferred build the moment a newer click or a Start supersedes
// it — without it, clicking four tiles queued four stale builds behind the paint.
let _venueLoadToken = 0;
let _venueLoading = false;   // a full load is in flight; the UI is showing why

// The world made current for settings.venue — everything selectVenue used to do besides
// paint. One body for both builds: the board's deferred light pass and Start's full
// pass, so the two can never disagree about what "loaded" includes.
function loadVenueWorld(opts) {
    // No per-venue conditions here: every venue's day is stated by its document's
    // regions, and initCourse()'s compile writes them over whatever the last venue
    // left behind. (Bay once had no doc and needed a re-roll on return; it is a
    // designed venue now like everything else.)
    applyVenueConditions();
    initCourse(opts);
    if (window.WaterRenderer) window.WaterRenderer.init();
    // Clear stale gusts and reseed at the new venue's density/strength
    state.gusts = [];
    // Pre-populate the sources' cells, so a race opens with its puffs already on the water
    // rather than fading in over the first minute. No sources means none to populate.
    const gregs = state.course.gustRegions;
    if (gregs && gregs.length) {
        let want = 0;
        for (const r of gregs) want += r.count;
        for (let i = 0; i < want; i++) spawnRegionGust(gregs, true);
    }
    state.particles = [];

    // The fleet was laid out behind the PREVIOUS venue's start line. initCourse() has
    // just moved the marks and the wind out from under it, and startRace() only flips
    // the status — it never re-places anyone — so without this the race begins with
    // every boat stranded wherever the old course put them. Only ever visible when the
    // two venues disagree about the course axis, which is why it read as intermittent.
    // Consumes no RNG, so the golden traces are untouched.
    repositionBoats();

    // A FULL build just priced the course honestly — remember the numbers, so the next
    // time this venue is merely browsed the board can quote the real sailed distance
    // and limit instead of the light build's straight-line guess. Survives reloads:
    // a venue you have raced once never shows the guess again.
    if (state.course.loadState === 'full' && state.course.dmc && state.course.dmc.total > 0) {
        _venueStats[state.course.venueKey] = {
            total: state.course.dmc.total,
            cutoff: state.course.cutoff != null ? state.course.cutoff : null
        };
        try { localStorage.setItem('regatta_venue_stats', JSON.stringify(_venueStats)); } catch (e) {}
    }
}

// The priced numbers from past full builds, by venue — see loadVenueWorld.
let _venueStats = {};
try { _venueStats = JSON.parse(localStorage.getItem('regatta_venue_stats')) || {}; } catch (e) { _venueStats = {}; }

function selectVenue(key) {
    if (!(window.VenueDoc && window.VenueDoc.get(key)) || state.race.status !== 'waiting') return;
    if (_venueLoading) return;   // mid "Preparing…" — the start already owns the world
    settings.venue = key;
    saveSettings();

    // Beat one: paint now, from the document alone. renderVenueDetail shows the
    // computed rows as pending while state.course still holds another venue.
    const token = ++_venueLoadToken;
    setupPreRaceOverlay();

    // Already built for this venue — a return visit after a race, or a double click —
    // so there is nothing to defer and nothing to downgrade: a FULL course must never
    // be rebuilt as a light one, or Start would pay for the same venue twice.
    if (state.course && state.course.venueKey === key) return;

    // Beat two: the light course, after the click has painted.
    setTimeout(() => {
        if (token !== _venueLoadToken || state.race.status !== 'waiting') return;
        loadVenueWorld({ light: true });
        renderVenuePicker();
    }, 30);
}

function setupPreRaceOverlay() {
    renderVenuePicker();
    if (!UI.preRaceOverlay) return;

    // Show Overlay
    UI.preRaceOverlay.classList.remove('hidden');
    UI.preRaceOverlay.querySelectorAll('.overflow-y-auto').forEach(el => el.scrollTop = 0);
    UI.leaderboard.classList.add('hidden');
    UI.legInfo.parentElement.classList.add('hidden'); // Hide venue caption
    if (UI.legTimes) UI.legTimes.classList.add('hidden'); // now a sibling, hide it too

    // Initialize Sliders from Current State (Randomized or Default)
    const cond = state.race.conditions;


    // Reverse Map Wind Strength
    const baseMin = 5, baseMax = 25;
    const strVal = Math.max(0, Math.min(1, (state.wind.baseSpeed - baseMin) / (baseMax - baseMin)));



    // Course Defaults
    // 4000 units / 5 = 800m
    // The player's preference, NOT state.race.totalLegs. Writing the current course's
    // leg count into the slider laundered Glacier Sound's 2 legs through the UI, and the
    // next resetGame read it straight back — so every later venue raced 2 laps.


    // Bind Listeners (if not already bound - simple check or rebind is fine since overlay is destroyed? No, persistent.)
    // Better to remove old listeners? Or just use oninput which overwrites?
    // addEventListener adds multiple if called multiple times.
    // Let's rely on checking a flag or just do it once globally?
    // setupPreRaceOverlay is called on resetGame. resetGame is called multiple times.
    // We should bind listeners globally at the bottom of the script, not here.
    // BUT we need to set values here.


    // Populate Competitors. New race, new fleet: clear any scouting selection.
    selectedCompetitor = null;
    renderCompetitorDetail();
    renderCompetitorGrid();
}

// Builds the fleet grid from state.boats — the LIVE fleet, not the roster. Extracted
// from setupPreRaceOverlay so that changing character can refresh it without re-running
// the whole overlay (which would also rebuild the venue picker and reset the scroll).
//
// ⚠️ `pickCharacter` has always called this by name behind a `typeof ... === 'function'`
// guard, and the function did not exist — so the guard silently did nothing and the grid
// kept showing the character you had just taken over, still racing against you. The swap
// underneath was working the whole time. A typeof guard around a name you own is not a
// safety net, it is a silent failure.
function renderCompetitorGrid() {
    if (!UI.prCompetitorsGrid) return;
    const scrollTop = UI.prCompetitorsGrid.scrollTop;   // survive a re-render on selection
    UI.prCompetitorsGrid.innerHTML = '';
    const count = document.getElementById('pr-fleet-count');
    if (count) count.textContent = `${state.boats.length} boats`;

    // ONE BADGE PER BOAT, listed — the same identity band the picker and the results screen
    // use, boat preview and all, so a rival looks the same everywhere you meet them. Ten do
    // not fit the column and are not meant to: this panel scrolls.
    for (const boat of state.boats) {
        const config = AI_CONFIG.find(c => c.name === boat.name) || boat;
        const key = boat.isPlayer ? PLAYER_CARD_KEY : boat.name;
        const selected = selectedCompetitor === key;

        const item = document.createElement('div');
        // ⚠️ The player's item keeps the PLAYER_CARD_KEY name and a `.t-display` label —
        // test_character_swap reads both to prove a character swap reached the screen.
        item.dataset.name = key;
        item.className = 'pr-fleet-item' + (boat.isPlayer ? ' me' : '') + (selected ? ' sel' : '');

        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'block w-full text-left';
        badge.innerHTML = profileBandHTML(config, {
            compact: true, boat: true,
            // Your badge says YOU where a rival's says what kind of sailor they are, and it
            // carries the control that swaps you for someone else.
            label: boat.isPlayer ? 'You <span class="pr-change-pill">Change</span>' : undefined
        });
        // YOUR badge is the way to change character — there is no header chip any more, and
        // your own badge has no scouting notes to open, so its click is free to mean the
        // one thing you would want from it.
        badge.addEventListener('click', () => boat.isPlayer ? openCharacterPicker() : selectCompetitor(key));
        item.appendChild(badge);

        // YOUR badge does not open scouting notes. There is nothing to scout — you take no
        // stats from the character, and "how to beat them" would be about you.
        if (selected && !boat.isPlayer) {
            const notes = document.createElement('div');
            notes.className = 'pr-fleet-notes';
            notes.innerHTML = scoutingNotesHTML(config);
            item.appendChild(notes);
        }
        UI.prCompetitorsGrid.appendChild(item);

        // The rig preview, painted once the canvas is in the document (it sizes itself from
        // the band it sits in).
        renderProfileBoat(item.querySelector('.profile-boat-canvas'), config);
    }
    UI.prCompetitorsGrid.scrollTop = scrollTop;
}

// ── Starting a race is where the FULL venue is paid for ─────────────────────
// Browsing built a light course (no validator, no planner estimate, no router legs, no
// pressure scan); racing needs all four. If the world is already full for this venue —
// a rematch, or the venue the session booted into — the gun is immediate. Otherwise a
// loading card states what is happening while the build runs, and the race is not shown
// until it is ready. Each step yields through a short TIMEOUT so the card (and each
// message) paints before the main thread disappears into the build — a timeout and not
// requestAnimationFrame, because rAF never fires in a hidden tab and a player who
// switches away mid-load must come back to a race, not to a stuck curtain.
function startRace() {
    if (state.race.status !== 'waiting' || _venueLoading) return;
    if (state.course && state.course.venueKey === settings.venue && state.course.loadState === 'full') {
        beginRace();
        return;
    }
    _venueLoading = true;
    _venueLoadToken++;           // retire any deferred light build still queued
    showVenueLoading(settings.venue);
    const step = (msg, fn) => new Promise((res) => {
        setVenueLoadingMsg(msg);
        setTimeout(() => { fn(); res(); }, 50);
    });
    (async () => {
        try {
            await step('Charting the course…', () => loadVenueWorld());
        } finally {
            _venueLoading = false;
            hideVenueLoading();
        }
        renderVenuePicker();     // the board's numbers upgrade to the priced ones
        beginRace();
    })();
}

// The loading card: a dark curtain with the venue's name and one line of what is
// happening. Built lazily — most sessions that never switch venue never make it.
let _venueLoadingEl = null;
function showVenueLoading(key) {
    const c = venueCard(key);
    if (!_venueLoadingEl) {
        _venueLoadingEl = document.createElement('div');
        _venueLoadingEl.id = 'venue-loading';
        _venueLoadingEl.style.cssText = 'position:fixed; inset:0; z-index:220; display:flex;'
            + 'flex-direction:column; align-items:center; justify-content:center; gap:10px;'
            + 'background:rgba(5,10,20,0.94);';
        document.body.appendChild(_venueLoadingEl);
    }
    _venueLoadingEl.innerHTML = `
        <span class="t-label t-label-sm" style="color:#8fd8d0; letter-spacing:0.14em;">Preparing</span>
        <span class="t-display uppercase" style="color:#ffffff; font-size:34px;">${c.name || c.tag || key}</span>
        <span id="venue-loading-msg" class="t-mono" style="color:#9fd3dd; font-size:13px;"></span>`;
    _venueLoadingEl.style.display = 'flex';
}
function setVenueLoadingMsg(msg) {
    const el = document.getElementById('venue-loading-msg');
    if (el) el.textContent = msg;
}
function hideVenueLoading() {
    if (_venueLoadingEl) _venueLoadingEl.style.display = 'none';
}

function beginRace() {
    if (UI.preRaceOverlay) UI.preRaceOverlay.classList.add('hidden');
    UI.leaderboard.classList.remove('hidden'); // Or hidden if prestart logic handles it
    // Prestart logic usually hides leaderboard until start? No, updateLeaderboard logic: if 'prestart' UI.leaderboard.classList.add('hidden');

    // Show venue caption (leg splits stay hidden until the prestart ends — the
    // render loop unhides them once status leaves 'prestart')
    if (UI.legInfo) UI.legInfo.parentElement.classList.remove('hidden');

    state.race.status = 'prestart';
    state.race.timer = state.race.startTimerDuration;

    // Init Audio Context if needed (user interaction trusted here)
    if ((settings.soundEnabled || settings.musicEnabled) && (!Sound.ctx || Sound.ctx.state !== 'running')) Sound.init();
    Sound.updateMusic();
}

// Settings Functions
function loadSettings() {
    // getItem can throw for the same reasons setItem can; a player with site data disabled
    // should get defaults, not a dead page.
    let stored = null;
    try { stored = localStorage.getItem('regatta_settings'); } catch (e) { stored = null; }
    let parsed = null;
    if (stored) {
        try {
            parsed = JSON.parse(stored);
            settings = { ...DEFAULT_SETTINGS, ...parsed };
        } catch (e) { console.error("Failed to parse settings", e); }
    }
    // Migration: the Polar venue was renamed to Arctic (July 2026)
    if (settings.venue === 'polar') settings.venue = 'arctic';
    // Migration: the Wind and Gate camera modes were removed (August 2026) — a
    // saved one would leave the camera in a mode nothing updates or displays.
    if (settings.cameraMode === 'wind' || settings.cameraMode === 'gate') settings.cameraMode = 'heading';
    // Migration: the Semicircle kite panel became Triangle (July 2026) — without
    // this a saved 'bullseye' falls through to a plain solid sail
    // Migration: the Manual Trim toggle became Auto Trim (July 2026), flipping the
    // stored polarity. Test the raw save, not the merged settings — the merge always
    // supplies an autoTrim default, so only `parsed` can tell us which era it is from.
    if (parsed && parsed.autoTrim === undefined && parsed.manualTrim !== undefined) {
        settings.autoTrim = !parsed.manualTrim;
    }
    delete settings.manualTrim;
    applySettings();
}

// ⚠️ APPLYING AND STORING ARE SEPARATE JOBS, AND THE WRITE MUST NOT BE ABLE TO KILL THE
// APPLY. localStorage.setItem throws for real reasons a player can hit — Safari private
// browsing, a full quota, a file:// origin with site data disabled — and this used to let
// that exception escape into every caller. `pickCharacter` would then leave the picker
// open with the character half-applied, and `applySettings()` (which is what actually puts
// the choice on the boat) would never run at all. Losing persistence is a nuisance; losing
// the apply is a broken screen.
function saveSettings() {
    try {
        localStorage.setItem('regatta_settings', JSON.stringify(settings));
    } catch (e) {
        // Warn once — this fires on every toggle, and a storage-disabled browser would
        // otherwise flood the console.
        if (!saveSettings._warned) {
            saveSettings._warned = true;
            console.warn('Settings could not be saved; they will not survive a reload.', e);
        }
    }
    applySettings();
}

// You changed character while a fleet already existed, and one of them is now you. Swap
// that opponent for someone not on the water — identity only, so it inherits the lane,
// the position and the start setup the outgoing boat had.
//
// ⚠️ THE REPLACEMENT IS CHOSEN DETERMINISTICALLY (first unused, in roster order) rather than
// at random. A `Math.random()` here would add a draw to the seeded stream and move every
// venue's races, for a UI action that has nothing to do with the simulation.
function swapClashingOpponent() {
    if (!state.boats || !state.boats.length) return false;
    if (window.School && School.active) return false;   // the classmates are cast, not drawn; nobody clashes with a trainer
    const mine = settings.character;
    const clash = state.boats.find(b => !b.isPlayer && b.name === mine);
    if (!clash) return false;
    const taken = new Set(state.boats.map(b => b.name));
    const repl = AI_CONFIG.find(c => !taken.has(c.name));
    if (!repl) return false;
    applyBoatIdentity(clash, repl, false);
    return true;
}

// Point the player's boat at whoever they are now, without rebuilding the race.
// WHO THE PLAYER IS RIGHT NOW: the chosen character — except in Sailing School, where the
// player sails the assigned trainer dinghy. Every re-apply of settings (the C key, the
// settings screen, any saveSettings) used to reach for the stored character and turn the
// trainer back into it mid-lesson.
function currentPlayerConfig() {
    return (window.School && School.active) ? School.playerConfig() : playerCharacter();
}

function applyPlayerCharacter() {
    const pc = currentPlayerConfig();
    if (state.boats && state.boats.length) {
        applyBoatIdentity(state.boats[0], pc, true);
        swapClashingOpponent();
    }
    refreshPlayerAppearance();
}

function applySettings() {
    state.showNavAids = settings.navAids;
    if (state.boats.length > 0) {
        state.boats[0].manualTrim = !settings.autoTrim;
        applyBoatIdentity(state.boats[0], currentPlayerConfig(), true);
        swapClashingOpponent();
    }
    state.camera.mode = settings.cameraMode;

    if (UI.settingSound) UI.settingSound.checked = settings.soundEnabled;
    if (UI.settingBgSound) UI.settingBgSound.checked = settings.bgSoundEnabled;
    if (UI.settingMusic) UI.settingMusic.checked = settings.musicEnabled;
    if (UI.settingPenalties) UI.settingPenalties.checked = settings.penaltiesEnabled;
    if (UI.settingNavAids) UI.settingNavAids.checked = settings.navAids;
    if (UI.settingTrim) UI.settingTrim.checked = settings.autoTrim;
    if (UI.settingCameraMode) UI.settingCameraMode.value = settings.cameraMode;
    if (UI.settingHudMode) UI.settingHudMode.value = settings.hudMode || 'boat';
    applyHudMode();
    if (UI.settingTelltaleColor) UI.settingTelltaleColor.value = settings.telltaleColor || '#fbbf24';
    // Boat colors have two editors now (this modal and the pre-race player
    // panel); both write here, so this is where they re-sync.
    refreshPlayerAppearance();
}

// The pause card keeps the race on it — venue, leg, standing — so pausing reads
// as a held breath, not a different app. Standing comes from fleetRank (the
// leaderboard's own order); before the gun there is no standing to report.
function raceContextLine() {
    const p = state.boats[0];
    // Sailing School: the pond and the section, as the section screen names it.
    if (window.School && School.active && School.sectionName) return `DUCKLING POND · ${School.sectionName().toUpperCase()}`;
    const venue = (venueDisplayName(state.race.venue) || '').toUpperCase();
    const total = state.race.totalLegs;
    const leg = p ? p.raceState.leg : 0;
    if (!p || leg === 0) return `${venue} · PRESTART`;
    if (p.raceState.finished) return `${venue} · FINISHED`;
    return `${venue} · LEG ${Math.min(leg, total)}/${total} · <span style="color:#f2c14e">YOU'RE ${ordinalOf(fleetRank(p))}</span>`;
}

// What abandoning costs, in the race's own terms — the honest version of "are
// you sure?". Staying in the race is the default (and what ESC does).
function abandonContextLine() {
    const p = state.boats[0];
    const total = state.race.totalLegs;
    const leg = p ? p.raceState.leg : 0;
    if (!p || leg === 0) return "The race hasn't started — back to the clubhouse to change venue or skipper.";
    if (p.raceState.finished) return "You've already finished — this just heads in to the clubhouse.";
    const left = Math.max(0, total - leg);
    const standing = `You're ${ordinalOf(fleetRank(p)).toLowerCase()}`;
    const clause = left === 0 ? `${standing} on the last leg` : `${standing} with ${left} leg${left === 1 ? '' : 's'} to go`;
    return `${clause}. This race won't count — the fleet sails on without you.`;
}

function togglePause(show) {
    const isPaused = state.paused;
    const shouldPause = show !== undefined ? show : !isPaused;
    if (shouldPause) {
        state.paused = true;
        if (UI.pauseContext) UI.pauseContext.innerHTML = raceContextLine();
        if (UI.pauseScreen) UI.pauseScreen.classList.remove('hidden');
        if (UI.helpScreen) UI.helpScreen.classList.add('hidden');
        if (UI.settingsScreen) UI.settingsScreen.classList.add('hidden');
        if (UI.abandonScreen) UI.abandonScreen.classList.add('hidden');
    } else {
        state.paused = false;
        if (UI.pauseScreen) UI.pauseScreen.classList.add('hidden');
        if (UI.abandonScreen) UI.abandonScreen.classList.add('hidden');
        lastTime = 0;
    }
}

// The abandon confirm sits OVER the pause menu (its scrim is darker), so
// "keep racing" still shows where you'd land if you stayed.
function toggleAbandon(show) {
    if (!UI.abandonScreen) return;
    if (show) {
        if (UI.abandonContext) UI.abandonContext.textContent = abandonContextLine();
        UI.abandonScreen.classList.remove('hidden');
    } else {
        UI.abandonScreen.classList.add('hidden');
    }
}

function toggleHelp(show) {
    if (!UI.helpScreen) return;
    const isVisible = !UI.helpScreen.classList.contains('hidden');
    const shouldShow = show !== undefined ? show : !isVisible;
    if (shouldShow) {
        state.paused = true;
        UI.helpScreen.classList.remove('hidden');
        if (UI.pauseScreen) UI.pauseScreen.classList.add('hidden');
        if (UI.settingsScreen) UI.settingsScreen.classList.add('hidden');
        if (UI.abandonScreen) UI.abandonScreen.classList.add('hidden');
    } else {
        UI.helpScreen.classList.add('hidden');
        state.paused = false;
        lastTime = 0;
    }
}

// The camera segments and telltale swatches are faces on the hidden select and
// color input (script wiring reads and writes those); this repaints the faces
// from the current values. Called on open because the 'C' key changes the
// camera without going through the select.
function paintSettingsControls() {
    if (UI.settingCameraMode) UI.settingCameraMode.value = settings.cameraMode;
    const mode = UI.settingCameraMode ? UI.settingCameraMode.value : settings.cameraMode;
    document.querySelectorAll('#camera-segs .ov-seg').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    if (UI.settingHudMode) UI.settingHudMode.value = settings.hudMode || 'boat';
    const hm = UI.settingHudMode ? UI.settingHudMode.value : (settings.hudMode || 'boat');
    document.querySelectorAll('#hud-mode-segs .ov-seg').forEach(b => b.classList.toggle('active', b.dataset.hud === hm));
    const color = ((UI.settingTelltaleColor && UI.settingTelltaleColor.value) || settings.telltaleColor || '#fbbf24').toLowerCase();
    let matched = false;
    document.querySelectorAll('.ov-swatch[data-color]').forEach(b => {
        const on = b.dataset.color.toLowerCase() === color;
        b.classList.toggle('active', on);
        matched = matched || on;
    });
    const custom = document.getElementById('telltale-custom');
    if (custom) custom.classList.toggle('active', !matched);
}

function toggleSettings(show) {
    if (!UI.settingsScreen) return;
    const isVisible = !UI.settingsScreen.classList.contains('hidden');
    const shouldShow = show !== undefined ? show : !isVisible;
    if (shouldShow) {
        state.paused = true;
        paintSettingsControls();
        UI.settingsScreen.classList.remove('hidden');
        if (UI.pauseScreen) UI.pauseScreen.classList.add('hidden');
        if (UI.helpScreen) UI.helpScreen.classList.add('hidden');
        if (UI.abandonScreen) UI.abandonScreen.classList.add('hidden');
    } else {
        UI.settingsScreen.classList.add('hidden');
        state.paused = false;
        lastTime = 0;
    }
}

// Event Listeners
if (UI.helpButton) UI.helpButton.addEventListener('click', (e) => { e.preventDefault(); toggleHelp(true); UI.helpButton.blur(); });
if (UI.closeHelp) UI.closeHelp.addEventListener('click', () => toggleHelp(false));
if (UI.resumeHelp) UI.resumeHelp.addEventListener('click', () => toggleHelp(false));
if (UI.resumeButton) UI.resumeButton.addEventListener('click', (e) => { e.preventDefault(); togglePause(false); });
// RESTART re-races NOW (same venue, same fleet). Leaving for the clubhouse is
// its own action — ABANDON, behind a confirm — so restart no longer silently
// dumps you on the pre-race board.
// In Sailing School, Restart is the whole tutorial from its intro screen.
if (UI.restartButton) UI.restartButton.addEventListener('click', (e) => { e.preventDefault(); if (window.School && School.active) { togglePause(false); School.begin(); } else rematchRace(); });
if (UI.abandonButton) UI.abandonButton.addEventListener('click', (e) => { e.preventDefault(); toggleAbandon(true); UI.abandonButton.blur(); });
if (UI.abandonKeep) UI.abandonKeep.addEventListener('click', (e) => { e.preventDefault(); toggleAbandon(false); togglePause(false); });
if (UI.abandonConfirm) UI.abandonConfirm.addEventListener('click', (e) => { e.preventDefault(); toggleAbandon(false); restartRace(); });
if (UI.settingsButton) UI.settingsButton.addEventListener('click', (e) => { e.preventDefault(); toggleSettings(true); UI.settingsButton.blur(); });
if (UI.preRaceSettingsBtn) UI.preRaceSettingsBtn.addEventListener('click', (e) => { e.preventDefault(); toggleSettings(true); UI.preRaceSettingsBtn.blur(); });
if (UI.closeSettings) UI.closeSettings.addEventListener('click', () => toggleSettings(false));
if (UI.saveSettings) UI.saveSettings.addEventListener('click', () => toggleSettings(false));
// Segments/swatches write through the hidden controls so the existing change/
// input listeners (and anything else watching them) keep working unchanged.
document.querySelectorAll('#camera-segs .ov-seg').forEach(b => b.addEventListener('click', () => {
    if (!UI.settingCameraMode) return;
    UI.settingCameraMode.value = b.dataset.mode;
    state.camera.mode = b.dataset.mode; // live, like the C key
    UI.settingCameraMode.dispatchEvent(new Event('change'));
    paintSettingsControls();
}));
document.querySelectorAll('#hud-mode-segs .ov-seg').forEach(b => b.addEventListener('click', () => {
    if (!UI.settingHudMode) return;
    UI.settingHudMode.value = b.dataset.hud;
    settings.hudMode = b.dataset.hud;      // live, so you can see the face you are picking
    applyHudMode();
    UI.settingHudMode.dispatchEvent(new Event('change'));
    paintSettingsControls();
}));
document.querySelectorAll('.ov-swatch[data-color]').forEach(b => b.addEventListener('click', () => {
    if (!UI.settingTelltaleColor) return;
    UI.settingTelltaleColor.value = b.dataset.color;
    UI.settingTelltaleColor.dispatchEvent(new Event('input'));
    paintSettingsControls();
}));
{
    const customSwatch = document.getElementById('telltale-custom');
    if (customSwatch && UI.settingTelltaleColor) {
        customSwatch.addEventListener('click', () => UI.settingTelltaleColor.click());
        UI.settingTelltaleColor.addEventListener('input', paintSettingsControls);
    }
}
// Two ways off the results page, where a series would have offered "next race": back to
// the clubhouse to change venue or character, or straight into another race here.
if (UI.resultsRestartButton) UI.resultsRestartButton.addEventListener('click', (e) => { e.preventDefault(); restartRace(); });
if (UI.resultsRematchButton) UI.resultsRematchButton.addEventListener('click', (e) => { e.preventDefault(); rematchRace(); });
if (UI.startRaceBtn) UI.startRaceBtn.addEventListener('click', (e) => { e.preventDefault(); startRace(); });
{
    // Sailing School. Primary styling until graduated, then a plain secondary — the
    // clubhouse leads with the school for a first-time player and gets out of the way after.
    const sb = document.getElementById('school-btn');
    if (sb) {
        const style = () => {
            const grad = window.School && School.graduated();
            sb.classList.toggle('res-btn-primary', !grad);
            if (UI.startRaceBtn) UI.startRaceBtn.classList.toggle('res-btn-primary', !!grad);
            sb.textContent = grad ? 'Sailing School' : 'Sailing School →';
        };
        style();
        window.__styleSchoolBtn = style;
        sb.addEventListener('click', (e) => {
            e.preventDefault(); sb.blur();
            if (state.race.status !== 'waiting' || _venueLoading) return;
            School.begin();
        });
    }
}
{
    const rc = document.getElementById('records-close');
    if (rc) rc.addEventListener('click', () => closeRecordsOverlay());
    const ro = document.getElementById('records-overlay');
    // Clicking the scrim closes the book, same as every other overlay here.
    if (ro) ro.addEventListener('click', (e) => { if (e.target === ro) closeRecordsOverlay(); });
}

if (UI.settingSound) UI.settingSound.addEventListener('change', (e) => { settings.soundEnabled = e.target.checked; saveSettings(); if (settings.soundEnabled) Sound.init(); Sound.updateWindSound(Sound.playerWindSpeed()); });
if (UI.settingBgSound) UI.settingBgSound.addEventListener('change', (e) => { settings.bgSoundEnabled = e.target.checked; saveSettings(); Sound.updateWindSound(Sound.playerWindSpeed()); });
if (UI.settingMusic) UI.settingMusic.addEventListener('change', (e) => { settings.musicEnabled = e.target.checked; saveSettings(); Sound.init(); });
if (UI.settingPenalties) UI.settingPenalties.addEventListener('change', (e) => { settings.penaltiesEnabled = e.target.checked; saveSettings(); });
if (UI.settingNavAids) UI.settingNavAids.addEventListener('change', (e) => { settings.navAids = e.target.checked; saveSettings(); });
if (UI.settingTrim) UI.settingTrim.addEventListener('change', (e) => { settings.autoTrim = e.target.checked; saveSettings(); });
if (UI.settingCameraMode) UI.settingCameraMode.addEventListener('change', (e) => { settings.cameraMode = e.target.value; saveSettings(); });
if (UI.settingHudMode) UI.settingHudMode.addEventListener('change', (e) => { settings.hudMode = e.target.value; applyHudMode(); saveSettings(); });
if (UI.settingTelltaleColor) UI.settingTelltaleColor.addEventListener('input', (e) => { settings.telltaleColor = e.target.value; saveSettings(); });

// Pre-race config listeners: the venue customization panel is gone. A course's wind,
// current, obstacles and leg count are stated by its DOCUMENT, so there is nothing on this
// screen left to tune them with.




function showRaceMessage(text, textColorClass, borderColorClass) {
    if (UI.message) {
        UI.message.textContent = text;
        UI.message.className = `mt-2 text-lg font-bold bg-slate-900/80 px-4 py-1 rounded-full border shadow-lg ${textColorClass} ${borderColorClass}`;
        UI.message.classList.remove('hidden');
    }
}

function hideRaceMessage() { if (UI.message) UI.message.classList.add('hidden'); }

function showToast(text) {
    if (UI.toast && UI.toastMsg) {
        UI.toastMsg.textContent = text;
        UI.toast.classList.remove('opacity-0', 'translate-y-4');

        if (UI.toast.hideTimeout) clearTimeout(UI.toast.hideTimeout);
        UI.toast.hideTimeout = setTimeout(() => {
            UI.toast.classList.add('opacity-0', 'translate-y-4');
        }, 1500);
    }
}

const RESULT_BESTS_KEY = 'regatta_bests';
function loadVenueBests() {
    try { return JSON.parse(localStorage.getItem(RESULT_BESTS_KEY)) || {}; } catch (e) { return {}; }
}
function venueBestKey(venue) { return `${venue || settings.venue}:${state.race.totalLegs}`; }

// TWO RECORDS, KEPT APART. A time and a finish are not the same achievement and do not
// move together: a light-air race you win can be a minute slower than a windy one you come
// eighth in, so hanging the place off the fastest time ("2nd · 4:12") reported a placing
// that had nothing to do with why the row was there. The clock is the record; the best
// finish is its own line, with the time it was set in so it stays a memory of a race.
//
// A stored best, normalised. ⚠️ Two older shapes still read: a bare number (the first
// version) and { t, pos } (the second, where `pos` was the place in the fastest race).
// That `pos` seeds `bestPos` — it is a real finish that really happened here.
function bestForVenue(venue) {
    const rec = loadVenueBests()[venueBestKey(venue)];
    if (typeof rec === 'number') return { t: rec, bestPos: 0, bestPosT: 0 };
    if (!rec || typeof rec.t !== 'number') return null;
    return {
        t: rec.t,
        bestPos: rec.bestPos || rec.pos || 0,
        bestPosT: rec.bestPosT || (rec.bestPos ? 0 : rec.t) || 0
    };
}

// Called once per race, from the first showResults() of that race — see `bestChecked`.
// Returns what there was to beat on each record, and whether this race beat it.
function recordVenueBest(seconds, pos) {
    const bests = loadVenueBests();
    const key = venueBestKey();
    const prev = bestForVenue();
    const previous = prev ? prev.t : null;
    const previousPos = (prev && prev.bestPos) ? prev.bestPos : null;

    const isBest = previous === null || seconds < previous;
    const isBestPos = !!pos && (previousPos === null || pos < previousPos);
    if (isBest || isBestPos) {
        bests[key] = {
            t: isBest ? seconds : previous,
            bestPos: isBestPos ? pos : (previousPos || 0),
            bestPosT: isBestPos ? seconds : (prev ? prev.bestPosT : 0)
        };
        // Same reasoning as saveSettings: a storage failure must not take the screen with
        // it. Losing a personal best is a nuisance; throwing here would blank the results.
        try { localStorage.setItem(RESULT_BESTS_KEY, JSON.stringify(bests)); } catch (e) { /* no store */ }
    }
    return { previous, isBest, previousPos, isBestPos };
}

// Distances are recorded in world units. 5 units = 1 metre (VenueDoc.U_PER_M), and a race
// is a couple of kilometres, so kilometres is the unit that reads without counting zeros.
function unitsToKm(u) { return u / 5 / 1000; }

// ── VENUE RECORDS ───────────────────────────────────────────────────────────
// The record BOOK, as opposed to the personal-best chip above: per venue, per leg
// count, and per TRIM BOARD — hand-trimmed runs compete only with hand-trimmed runs,
// because auto trim is an assist and a record must say what it took to set.
//
// A board holds: the track record (with the leg splits of that run — the record run's
// own story), the best time ever sailed round each individual leg, the top speed, the
// shortest distance sailed, and the quickest start. Every entry remembers WHICH
// CHARACTER the player was sailing as: records belong to avatars, not to the browser.
//
// ⚠️ The run's board is decided by USE, not by the setting: touch auto trim once and
// the run is an auto run (rs.usedAutoTrim, sampled every frame).
const RECORDS_KEY = 'regatta_records';
function loadAllRecords() {
    try { return JSON.parse(localStorage.getItem(RECORDS_KEY)) || {}; } catch (e) { return {}; }
}
function saveAllRecords(r) {
    // Same reasoning as saveSettings: a storage failure must not take the race with it.
    try { localStorage.setItem(RECORDS_KEY, JSON.stringify(r)); } catch (e) { /* no store */ }
}
function runTrimBoard(rs) { return (rs && rs.usedAutoTrim) ? 'auto' : 'manual'; }
function recordsBoardKey(board, venue, legs) {
    return `${venue || settings.venue}:${legs || state.race.totalLegs}:${board}`;
}
const EMPTY_BOARD = () => ({ track: null, legs: [], topSpeed: null, minDist: null, start: null });
function recordsFor(board, venue, legs) {
    return loadAllRecords()[recordsBoardKey(board, venue, legs)] || EMPTY_BOARD();
}

// The venue document may state a PROVISIONAL track record — the designer's target
// (aimed at the 75th percentile of real runs). It stands on both boards, held by
// nobody, until a player beats it.
function provisionalRecord(venue) {
    const d = window.VenueDoc && window.VenueDoc.get(venue || settings.venue);
    const t = d && d.records && d.records.provisional;
    return (typeof t === 'number' && t > 0) ? t : null;
}

// What there is to beat on a board: the stored record, else the legacy personal best
// (pre-records saves were set with the assist available, so they seed the AUTO board
// only), else the document's provisional. `char: null` means no avatar to show.
function trackRecordFor(board, venue) {
    const rec = recordsFor(board, venue);
    let best = rec.track ? { ...rec.track } : null;
    if (!best && board === 'auto') {
        const legacy = bestForVenue(venue);
        if (legacy) best = { t: legacy.t, char: null };
    }
    const prov = provisionalRecord(venue);
    if (prov != null && (!best || prov < best.t)) best = { t: prov, char: null, provisional: true };
    return best;
}

// A leg record is committed THE MOMENT it is sailed — abandoning a race later does
// not unhappen a great leg. ⚠️ Returns true only when a PREVIOUS record was beaten:
// the first run over a course founds every entry in the book, and founding is not
// breaking — announcing it would paint the whole first results screen gold.
function commitLegRecord(board, legIdx, t) {
    const all = loadAllRecords();
    const key = recordsBoardKey(board);
    const rec = all[key] || (all[key] = EMPTY_BOARD());
    const prev = rec.legs[legIdx];
    if (prev && prev.t <= t) return false;
    rec.legs[legIdx] = { t, char: settings.character };
    saveAllRecords(all);
    return !!prev;
}

// Everything a FINISHED run can set, committed at the line: the track record (with
// this run's splits), top speed, shortest distance, quickest start. Player only, and
// only for a boat that sailed the whole course. Returns what this run took, for the
// results screen to paint gold.
function finalizeRaceRecords(player) {
    const rs = player.raceState;
    const board = runTrimBoard(rs);
    const all = loadAllRecords();
    const key = recordsBoardKey(board);
    const rec = all[key] || (all[key] = EMPTY_BOARD());
    const me = settings.character;
    const out = { board, track: false, topSpeed: false, minDist: false, start: false,
                  legs: (state.race.legRecordsSet || []).slice() };

    // Same founding-vs-breaking rule everywhere: the entry is written either way,
    // but `out` — which drives the toast, the gold tiles and the pills — only says
    // so when something that already stood was beaten. (The provisional counts as
    // standing: beating the designer's target is a real record.)
    const beating = trackRecordFor(board);   // provisional and legacy included
    if (!beating || rs.finishTime < beating.t) {
        rec.track = { t: rs.finishTime, char: me, legs: rs.legTimes.slice() };
        out.track = !!beating;
    }
    const ts = boatTopSpeed(player);
    if (ts > 0 && (!rec.topSpeed || ts > rec.topSpeed.v)) { out.topSpeed = !!rec.topSpeed; rec.topSpeed = { v: ts, char: me }; }
    const dk = boatDistKm(player);
    if (dk > 0 && (!rec.minDist || dk < rec.minDist.d)) { out.minDist = !!rec.minDist; rec.minDist = { d: dk, char: me }; }
    const st = boatStartTime(player);
    if (st !== null && (!rec.start || st < rec.start.t)) { out.start = !!rec.start; rec.start = { t: st, char: me }; }
    saveAllRecords(all);
    return out;
}

// ── The record book, readable ───────────────────────────────────────────────
// FACELESS BY CHOICE. Every entry still RECORDS the character that set it
// (entry.char — kept for a future rivals book), but the display shows no
// avatars: today every record is the player's own, and a page of identical
// faces says nothing. The one badge left is PROV — the designer's standing
// target, which is a status, not a holder.
const recHolderHTML = (entry) => {
    if (!entry || !entry.provisional) return '';
    return `<span class="t-label t-label-xs" style="color:#8fa3bd;letter-spacing:0.12em;">PROV</span>`;
};

// The record book as ONE comparison table (design 10a): AUTO and MANUAL are
// columns of the same rows, because how the two boards compare IS the reading.
// The two track records headline it; the leg splits and the other bests share
// one grid underneath. No avatars anywhere — see recHolderHTML.
function openRecordsOverlay() {
    const ov = document.getElementById('records-overlay');
    const content = document.getElementById('records-content');
    if (!ov || !content) return;
    // No .toUpperCase() here — it would mangle courseSummaryText's &middot;
    // entity, and .t-label already uppercases in CSS.
    const sub = document.getElementById('records-subtitle');
    if (sub) sub.innerHTML = `${venueDisplayName(settings.venue) || ''} &middot; ${courseSummaryText()}`;

    const recs = { auto: recordsFor('auto'), manual: recordsFor('manual') };
    const tracks = { auto: trackRecordFor('auto'), manual: trackRecordFor('manual') };
    const current = settings.autoTrim ? 'auto' : 'manual';

    // A REAL record fills its card gold; a provisional stands in grey with a
    // TARGET chip; an empty card is dashed — an invitation, not a blank.
    const headCard = (board) => {
        const t = tracks[board];
        const real = t && !t.provisional;
        const accent = real ? '#f2c14e' : '#8fa3bd';
        return `
        <div style="flex:1;min-width:0;background:${real ? 'rgba(242,193,78,0.1)' : '#141d31'};
                    border:1px ${real ? 'solid rgba(242,193,78,0.45)' : 'dashed rgba(255,255,255,0.16)'};
                    border-radius:12px;padding:13px 18px;">
            <div class="t-label t-label-sm" style="color:${accent};">Track record &middot; ${board} trim</div>
            <div class="flex items-center" style="gap:10px;margin-top:7px;">
                <span class="t-mono" style="font-size:31px;font-weight:900;line-height:1;color:${accent};">${t ? formatBestTime(t.t) : '&mdash;'}</span>
                ${t && t.provisional ? `<span class="t-label t-label-xs" style="color:#0c1322;background:#8fa3bd;border-radius:4px;padding:2px 6px;">Target</span>` : ''}
            </div>
        </div>`;
    };

    // One cell of the comparison grid: the number, nothing else.
    const cell = (entry, fmt) => `
        <div class="flex items-center justify-end" style="min-width:0;">
            <span class="t-mono" style="font-size:13px;color:${entry ? '#eef3fb' : '#4a5a72'};">${entry ? fmt(entry) : '—'}</span>
        </div>`;
    const GRID = 'display:grid;grid-template-columns:minmax(0,1fr) 120px 120px;gap:10px;align-items:center;';
    const dataRow = (label, autoEntry, manualEntry, fmt) => `
        <div style="${GRID}padding:7px 14px;border-top:1px solid rgba(255,255,255,0.05);">
            <span class="t-label t-label-sm" style="color:#9fb2cc;">${label}</span>
            ${cell(autoEntry, fmt)}
            ${cell(manualEntry, fmt)}
        </div>`;
    // The current trim board's column header runs teal: that is the board the
    // player is set up to attack right now.
    const sectionRow = (label) => `
        <div style="${GRID}padding:10px 14px 8px;">
            <span class="t-label t-label-sm" style="color:#66748c;">${label}</span>
            <span class="t-label t-label-sm" style="text-align:right;color:${current === 'auto' ? '#7ff0d4' : '#66748c'};">Auto</span>
            <span class="t-label t-label-sm" style="text-align:right;color:${current === 'manual' ? '#7ff0d4' : '#66748c'};">Manual</span>
        </div>`;

    const legRows = [];
    for (let i = 0; i < state.race.totalLegs; i++) {
        legRows.push(dataRow(`Leg ${i + 1}`, recs.auto.legs[i], recs.manual.legs[i], (e) => formatSplitTime(e.t)));
    }
    content.innerHTML = `
        <div class="flex items-stretch" style="gap:10px;">
            ${headCard('auto')}${headCard('manual')}
        </div>
        <div style="margin-top:8px;">
            ${sectionRow('Leg splits')}
            ${legRows.join('')}
            <div style="border-top:1px solid rgba(255,255,255,0.1);margin-top:6px;">${sectionRow('Other bests')}</div>
            ${dataRow('Top speed', recs.auto.topSpeed, recs.manual.topSpeed, (e) => e.v.toFixed(1) + ' kt')}
            ${dataRow('Shortest track', recs.auto.minDist, recs.manual.minDist, (e) => e.d.toFixed(2) + ' km')}
            ${dataRow('Best start', recs.auto.start, recs.manual.start, (e) => '+' + e.t.toFixed(1) + 's')}
        </div>`;
    ov.classList.remove('hidden');
}
function closeRecordsOverlay() {
    const ov = document.getElementById('records-overlay');
    if (ov) ov.classList.add('hidden');
}

// The inline record book: the empty water to the RIGHT of the course chart, on
// screens wide enough to have any. Shows the board the player is currently set up to
// attack (their trim setting), with the full book one click away — which is also the
// only route on small screens, via the Records chip in the hero header.
function renderVenueRecordsInline(el) {
    const board = settings.autoTrim ? 'auto' : 'manual';
    const rec = recordsFor(board);
    const track = trackRecordFor(board);
    const line = (label, value, holder) => `
        <div class="flex items-center justify-between" style="gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span class="t-label t-label-sm" style="color:#9fb2cc;">${label}</span>
            <span class="flex items-center" style="gap:7px;">
                <span class="t-mono" style="font-size:12px;color:#eef3fb;white-space:nowrap;">${value}</span>
                ${recHolderHTML(holder, 18)}
            </span>
        </div>`;
    const legBits = [];
    for (let i = 0; i < state.race.totalLegs; i++) {
        const lr = rec.legs[i];
        if (lr) legBits.push(`L${i + 1} ${formatSplitTime(lr.t)}`);
    }
    el.innerHTML = `
        <div class="flex items-baseline justify-between" style="margin-bottom:4px;">
            <span class="t-label t-label-sm" style="color:#f2c14e;">✦ Records &middot; ${board === 'auto' ? 'auto' : 'manual'} trim</span>
            <button class="t-label t-label-xs" onclick="openRecordsOverlay()"
                    style="color:#a8cbff;border:1px solid rgba(168,203,255,0.4);border-radius:999px;padding:2px 9px;cursor:pointer;background:transparent;">All records</button>
        </div>
        ${line('Track', track ? formatBestTime(track.t) : '—', track)}
        ${legBits.length ? `<div class="t-mono" style="font-size:10px;color:#66748c;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.06);">${legBits.join(' &middot; ')}</div>` : ''}
        ${line('Top speed', rec.topSpeed ? rec.topSpeed.v.toFixed(1) + ' kt' : '—', rec.topSpeed)}
        ${line('Shortest', rec.minDist ? rec.minDist.d.toFixed(2) + ' km' : '—', rec.minDist)}
        ${line('Best start', rec.start ? '+' + rec.start.t.toFixed(1) + 's' : '—', rec.start)}`;
}

const RES_MEDALS = ['#f2c14e', '#c8d3e3', '#c98a4b'];   // gold, silver, bronze

// OFF THE PODIUM THERE IS NO METAL. Fourth gets the page's own white — full weight, still
// the loudest thing on the screen, but not a fourth medal colour, because inventing one
// would say the game awards something for fourth. Not finishing is the table's own red,
// the colour DNF already wears in the results rows.
const RES_PLACE_PLAIN = '#eef3fb';
const RES_PLACE_DNF = '#f87171';
const placeColor = (pos, dnf) => dnf ? RES_PLACE_DNF : (RES_MEDALS[pos - 1] || RES_PLACE_PLAIN);

// 10 for a win, down to 1 for tenth. Position, not fleet size: a win is worth ten whoever
// turns up, and nobody who sailed the race scores nothing.
const POINTS_FOR_PLACE = (pos) => Math.max(1, 11 - pos);

// THE RULER IS THE RACE ITSELF: winner at the datum, last boat home at the far end, and
// everyone spaced between them. A fixed scale had to pick a number that suits every race
// and suits none — `eval/_gapspread.js` measured last place finishing anywhere from 35s to
// 107s back, so a 30s ruler stacked a third of the fleet against the end and a 60s one
// squeezed the close races into the first third. Fitting it to the fleet spends the whole
// column on the boats that are actually in it, and nothing ever pins.
//
// The price is that the scale changes race to race, so the header states it (see
// renderResultsHeader) — otherwise the picture would be unreadable between races.
function fleetGapScale() {
    const home = state.boats
        .filter(b => b.raceState.finished && !b.raceState.resultStatus)
        .map(b => b.raceState.finishTime);
    return home.length < 2 ? 0 : Math.max(...home) - Math.min(...home);
}

// The boat's own colour as a glow. `deepBandFor` already answers "which of these three
// colours IS this boat" and pins it to a luminance that reads on a dark page — a dark hull
// would otherwise glow black. All that is missing is the alpha.
function boatGlow(boat, alpha) {
    const c = deepBandFor(boat.colors.hull, boat.colors.spinnaker, boat.colors.spinAccent);
    const m = c.match(/\d+/g) || [148, 163, 184];
    return `rgba(${m[0]},${m[1]},${m[2]},${alpha})`;
}

// What the wind DID, measured off the player's masthead through the race (see updateBoat),
// rather than `state.wind.baseSpeed` — which is the field at ONE point and describes a
// course nobody sailed. Falls back to the forecast range if there is nothing observed,
// which is the DNS case: you cannot report a breeze you never went out in.
function observedWindText() {
    const p = state.boats.find(b => b.isPlayer) || state.boats[0];
    const rs = p && p.raceState;
    if (!rs || !rs.windObsN) return windRangeText();
    const lo = Math.round(rs.windObsMin), hi = Math.round(rs.windObsMax);
    return (hi - lo >= 2) ? `${lo}–${hi} kt observed`
                          : `${Math.round(rs.windObsSum / rs.windObsN)} kt observed`;
}

function showResults() {
    if (!UI.resultsOverlay || !UI.resultsList) return;

    const wasHidden = UI.resultsOverlay.classList.contains('hidden');
    UI.resultsOverlay.classList.remove('hidden');
    if (wasHidden) UI.resultsOverlay.scrollTop = 0;
    UI.leaderboard.classList.add('hidden');
    Sound.updateMusic();

    // Finish order: finishers by time, then DNF, then DNS, then anyone still racing.
    const sorted = [...state.boats].sort((a, b) => {
        const getScore = (boat) => {
            if (!boat.raceState.finished) return 3;
            if (boat.raceState.resultStatus === 'DNS') return 2;
            if (boat.raceState.resultStatus === 'DNF') return 1;
            return 0;
        };
        const scoreA = getScore(a), scoreB = getScore(b);
        if (scoreA !== scoreB) return scoreA - scoreB;
        if (scoreA === 0) return a.raceState.finishTime - b.raceState.finishTime;
        return getBoatProgress(b) - getBoatProgress(a);
    });

    const leader = sorted[0];
    const player = state.boats.find(b => b.isPlayer) || state.boats[0];

    const gapScale = fleetGapScale();

    renderResultsHeader(sorted, gapScale);
    renderResultsHero(sorted, player, leader);
    // Called from HERE, not from inside the hero. The hero redraws only when the hero's own
    // signature changes, and a split tile can go stale without it: "fleet fastest" is taken
    // away by a boat still out on the water sailing a quicker leg than you did.
    renderResultsSplits(player);
    renderResultsRows(sorted, leader, fleetExtremes(), gapScale);
    renderResultsFootnote(leader);
}

// Venue, breeze, fleet size — and whether the race is actually over, which it often is
// not: the overlay opens when YOU finish, with boats still on the water behind you.
function renderResultsHeader(sorted, gapScale) {
    const sub = document.getElementById('res-subtitle');
    const status = document.getElementById('res-status');

    // The ruler states the span it is drawn to, and re-states it as boats finish — the
    // scale is the fleet's own, so without the caption the markers would be a picture with
    // no units. Written from the same number the markers are placed with.
    const gapHead = document.getElementById('res-gap-head');
    const scaleText = gapScale > 0 ? `— 0 to +${gapScale.toFixed(1)}s` : '';
    if (gapHead && gapHead.dataset.scale !== scaleText) {
        gapHead.dataset.scale = scaleText;
        gapHead.innerHTML = `Gap to winner <span style="color:#4a5a72;letter-spacing:0.05em;">${scaleText}</span>`;
    }
    if (sub) {
        sub.textContent = [
            venueDisplayName(settings.venue) || 'Open Water',
            observedWindText(),
            `${state.boats.length} boats`
        ].join(' · ').toUpperCase();
    }
    if (status) {
        const racing = state.boats.filter(b => !b.raceState.finished).length;
        const out = state.boats.filter(b => b.raceState.resultStatus).length;
        const text = racing ? `${racing} still racing`
            : out ? `${state.boats.length - out} home · ${out} did not finish`
            : 'All boats home';
        // The DOT carries the state and the text stays quiet: green once everyone is in,
        // amber while the race is still running. Rewritten only when it changes — this runs
        // six times a second, and replacing the markup every tick is exactly the churn that
        // made the rest of the page flicker.
        const dot = racing ? '#f2c14e' : '#34d399';
        if (status.dataset.sig !== text) {
            status.dataset.sig = text;
            status.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;flex:none;`
                + `background:${dot};"></span><span>${text}</span>`;
        }
        status.style.color = '#9fb2cc';
    }
}

// THE RECORD, AS A CARD. It was a chip, and a chip can hold a time or a delta but not the
// three things that make a lap time mean anything: what the mark was, what you did, and the
// difference. Two states — one for beating it, a quiet one for missing it — and nothing at
// all when there is no mark yet, because a first race here beat nobody.
function recordCard(best, rs) {
    // The measured records this run took — top speed, shortest way round, quickest
    // start — as gold pills under the time card. The track record has the card
    // itself; these are the record book's other pages.
    const rr = state.race.recordResults;
    const pills = [];
    if (rr) {
        const pill = (text) => pills.push(
            `<span class="t-mono" style="background:rgba(242,193,78,0.14);border:1px solid rgba(242,193,78,0.5);`
            + `border-radius:999px;padding:3px 10px;font-size:10.5px;color:#f2c14e;white-space:nowrap;">✦ ${text}</span>`);
        if (rr.topSpeed) pill(`Top speed ${boatTopSpeed(state.boats[0]).toFixed(1)} kt`);
        if (rr.minDist) pill(`Shortest track ${boatDistKm(state.boats[0]).toFixed(2)} km`);
        if (rr.start) pill(`Best start +${(boatStartTime(state.boats[0]) || 0).toFixed(1)}s`);
    }
    const pillRow = pills.length
        ? `<div class="flex flex-wrap justify-center" style="gap:6px;margin-top:10px;max-width:230px;">${pills.join('')}</div>`
        : '';
    if (!best || best.previous === null) {
        return pillRow ? `<div style="flex:none;text-align:center;">${pillRow}</div>` : '';
    }
    const won = best.isBest;
    const delta = Math.abs(rs.finishTime - best.previous).toFixed(2);
    const frame = won
        ? 'background:linear-gradient(150deg,rgba(242,193,78,0.16),rgba(242,193,78,0.05));border:1px solid rgba(242,193,78,0.5);'
        : 'background:#141d31;border:1px solid rgba(255,255,255,0.09);';
    return `
        <div style="flex:none;${frame}border-radius:14px;padding:16px 20px;text-align:center;">
            <div class="t-label" style="font-size:11px;letter-spacing:0.22em;color:${won ? '#f2c14e' : '#9fb2cc'};">
                ${won ? '✦ New Course Record ✦' : 'Course Record'}
            </div>
            <!-- The time you just set, and what it was worth. The old time struck through
                 with an arrow to the new one was three numbers to say one thing, and the
                 delta underneath already carries the one you cannot work out yourself. -->
            <div class="flex items-baseline justify-center gap-2" style="margin-top:6px;">
                <span class="t-mono" style="font-size:30px;font-weight:900;color:${won ? '#f2c14e' : '#eef3fb'};">${formatBestTime(won ? rs.finishTime : best.previous)}</span>
            </div>
            <div class="t-mono" style="font-size:11px;font-weight:800;color:${won ? '#34d399' : '#7787a0'};margin-top:2px;">
                ${won ? '−' + delta + 's off the record' : '+' + delta + 's off the record'}
            </div>
            ${pillRow}
        </div>`;
}

// You: portrait, the place you took, the gap that decided it, and your splits. Rebuilt
// only when something in it changes — this function runs six times a second, and
// re-writing the <img> every tick would flicker the portrait.
function renderResultsHero(sorted, player, leader) {
    const host = document.getElementById('res-hero');
    if (!host) return;
    const rs = player.raceState;
    const pos = sorted.indexOf(player) + 1;
    const ahead = pos > 1 ? sorted[pos - 2] : null;

    // The venue best is decided ONCE per race, on the first render, and only by a boat
    // that actually finished the course.
    if (!state.race.bestChecked) {
        state.race.bestChecked = true;
        state.race.bestOutcome = (rs.finished && !rs.resultStatus)
            ? recordVenueBest(rs.finishTime, pos) : null;
    }
    const best = state.race.bestOutcome;

    const sig = [pos, rs.finished, rs.resultStatus, rs.finishTime.toFixed(2),
                 rs.totalPenalties, rs.legTimes.length,
                 best && best.isBest, best && best.isBestPos].join('|');
    if (host.dataset.sig === sig) return;
    host.dataset.sig = sig;

    const dnf = !!rs.resultStatus;
    const headline = dnf ? rs.resultStatus : ordinalOf(pos);
    // The gap that decided your race — to the boat AHEAD, because that is the one you were
    // sailing against. The winner gets the gap they won by instead.
    let gap = '';
    if (dnf) {
        gap = rs.resultStatus === 'DNS' ? 'Never started' : 'Did not finish';
    } else if (ahead && ahead.raceState.finished && !ahead.raceState.resultStatus) {
        gap = `+${(rs.finishTime - ahead.raceState.finishTime).toFixed(2)}s behind ${ahead.name}`;
    } else if (pos === 1) {
        const next = sorted[1];
        gap = (next && next.raceState.finished && !next.raceState.resultStatus)
            ? `Won by ${(next.raceState.finishTime - rs.finishTime).toFixed(2)}s`
            : 'First home';
    } else {
        gap = 'Racing continues behind you';
    }

    const chip = (text, color, border, bg) =>
        `<span style="background:${bg};border:1px solid ${border};border-radius:999px;padding:4px 12px;`
      + `font-size:11px;font-weight:800;letter-spacing:0.02em;color:${color};white-space:nowrap;">${text}</span>`;
    const chips = [];
    // The clock record has its own card beside the hero now (see `recordCard`) — a chip
    // could not carry "old → new, and by how much" without becoming a sentence.
    //
    // The OTHER record stays a chip. Only when it is news, and only when there was
    // something to beat: ⚠️ A FIRST RACE AT A VENUE IS NOT A PERSONAL BEST, or the screen
    // congratulates every player on every new venue and the praise stops meaning anything.
    if (best && best.isBestPos && best.previousPos !== null) {
        chips.push(chip('BEST FINISH HERE ✦ ' + ordinalOf(best.previousPos).toUpperCase()
                        + ' → ' + ordinalOf(pos).toUpperCase(),
                        '#f2c14e', 'rgba(242,193,78,0.4)', 'rgba(242,193,78,0.1)'));
    }
    chips.push(rs.totalPenalties > 0
        ? chip(`${rs.totalPenalties} PENALT${rs.totalPenalties > 1 ? 'IES' : 'Y'}`, '#fca5a5', 'rgba(239,68,68,0.4)', 'rgba(239,68,68,0.12)')
        : chip('CLEAN RACE — NO PENALTIES', '#34d399', 'rgba(255,255,255,0.09)', '#141d31'));

    // THE PLACE IS SAID IN METAL, and the label says it with the number — one statement in
    // one colour. Gold, silver, bronze for the podium and the page's white for everyone
    // else; the screen used to shout every result in gold, which made a seventh look like a
    // win until you read the number.
    const pc = placeColor(pos, dnf);
    // The band's wash is the PLAYER'S colour, not a gold that belongs to first place. It is
    // the same colour as the glow behind the portrait sitting in it, at a third the alpha.
    if (host.parentElement) {
        host.parentElement.style.background =
            `radial-gradient(700px 200px at 30% 0%, ${boatGlow(player, 0.14)}, transparent)`;
    }
    host.innerHTML = `
        <div class="flex items-center" style="flex:none; gap:18px;">
            <div style="width:110px;height:130px;flex:none;filter:drop-shadow(0 6px 22px ${boatGlow(player, 0.5)});">
                <img src="assets/images/competitors/${player.name.toLowerCase()}.png" alt="${escapeHTMLText(player.name)}"
                     style="width:100%;height:100%;object-fit:contain;" draggable="false">
            </div>
            <div>
                <div class="t-label" style="font-size:12px;letter-spacing:0.24em;color:${pc};">${dnf ? 'You Did Not Finish' : 'You Finished'}</div>
                <div class="flex items-baseline gap-3.5" style="margin-top:4px;">
                    <span class="t-display italic" style="font-size:${dnf ? 46 : 72}px;line-height:1;color:${pc};">${headline}</span>
                    <div>
                        <div class="t-display-8 t-display uppercase" style="font-size:19px;letter-spacing:0.02em;">${escapeHTMLText(player.name)}${dnf ? '' : ' · ' + formatTime(rs.finishTime)}</div>
                        <div style="font-size:13px;color:#9fb2cc;margin-top:2px;">${gap}</div>
                    </div>
                </div>
                <div class="flex gap-2" style="margin-top:10px;">${chips.join('')}</div>
            </div>
        </div>
        ${recordCard(best, rs)}`;
}

// START + one tile per leg: the time, where you stood when you got there, and which way
// that had moved. A single race cannot tell you much, but it can tell you where you won
// or lost it — which the old screen, showing only the total, never did.
function renderResultsSplits(player) {
    const host = document.getElementById('res-splits');
    const label = document.getElementById('res-splits-label');
    if (!host) return;
    const rs = player.raceState;
    const legs = rs.legTimes.length;
    const started = rs.startTimeDisplay > 0;

    // Fastest round each leg, over everyone who has sailed it — `legTimes` is recorded for
    // every boat, so this is the whole fleet's answer and not just the finishers'. It is in
    // the signature because a boat still out there can take "fleet fastest" off your tile.
    const fleetLegBest = [];
    for (let i = 0; i < legs; i++) {
        let bestT = Infinity;
        for (const b of state.boats) {
            const t = b.raceState.legTimes[i];
            if (typeof t === 'number' && t < bestT) bestT = t;
        }
        fleetLegBest.push(bestT);
    }

    const rrSig = state.race.recordResults
        ? `${state.race.recordResults.legs.join('.')}|${state.race.recordResults.start}` : '';
    const sig = `${started}|${legs}|${rs.legTimes.map(t => t.toFixed(2)).join(',')}`
              + `|${fleetLegBest.map(t => t.toFixed(2)).join(',')}|${rrSig}`;
    if (host.dataset.sig === sig) return;
    host.dataset.sig = sig;

    if (label) {
        label.innerHTML = `Your Splits <span style="color:#4a5a72;letter-spacing:0.05em;">— `
            + (started ? `start + ${legs} leg${legs === 1 ? '' : 's'}` : 'no clean start') + `</span>`;
    }

    const tiles = [];
    // A TAG ON THE LEG THAT DID SOMETHING, and the tile's border carries it to the eye from
    // across the panel. Places won and lost outrank the speed note, because they are the
    // only thing on the tile that changed the race — a leg you sailed quicker than anyone
    // and still went backwards on is a fact about the boat ahead. When both are true the
    // ✦ rides along on the end of the place tag.
    const GREEN = { color: '#34d399', border: '1px solid rgba(52,211,153,0.5)' };
    const RED = { color: '#ef4444', border: '1px solid rgba(239,68,68,0.5)' };
    const TEAL = { color: '#7ff0d4', border: '1px solid rgba(127,240,212,0.5)' };
    // Gold is reserved for the START RECORD tile. Leg tiles used to go gold when a
    // leg entered the record book, but early in a course's life that is most legs
    // of most races — a page of gold that drowned the green/red story of places
    // won and lost, which is what the tiles are for. The record book still keeps
    // every leg record; the toast still announces one the moment it is sailed.
    const GOLD = { color: '#f2c14e', border: '1px solid rgba(242,193,78,0.65)' };
    const tile = (name, time, rank, prevRank, fastest, startTag, record) => {
        let trend = '', trendColor = '#66748c', tag = null, moved = 0;
        if (rank && prevRank) {
            const d = prevRank - rank;
            if (d > 0) { trend = `▲${d}`; trendColor = '#34d399'; moved = d; }
            else if (d < 0) { trend = `▼${-d}`; trendColor = '#f87171'; moved = d; }
            else { trend = '–'; }
        }
        const places = (n) => Math.abs(n) === 1 ? 'a place' : `${Math.abs(n)} places`;
        if (record) {
            tag = { ...GOLD, text: (typeof record === 'string' ? record : 'Leg record') + ' ✦' };
        } else if (moved) {
            tag = { ...(moved > 0 ? GREEN : RED),
                    text: `${moved > 0 ? 'Gained' : 'Lost'} ${places(moved)}${fastest ? ' ✦' : ''}` };
        } else if (fastest) {
            tag = { ...TEAL, text: 'Fleet fastest ✦' };
        } else if (startTag) {
            tag = startTag;
        }
        tiles.push(`
        <div class="res-split" ${tag ? `style="border:${tag.border};"` : ''}>
            <div class="t-label" style="font-size:9px;letter-spacing:0.1em;color:#66748c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
            <div class="res-split-time t-mono">${time}</div>
            <div class="flex items-baseline gap-1.5" style="margin-top:3px;">
                <span style="font-size:12px;font-weight:800;color:#9fb2cc;">${rank ? ordinalOf(rank) : '—'}</span>
                <span style="font-size:11px;font-weight:800;color:${trendColor};">${trend}</span>
            </div>
            <!-- The slot is always there, tag or no tag: five tiles with four heights is a
                 ragged row, and the tags are the thing you are meant to scan for.
                 ⚠️ NOT nowrap. "Fleet fastest ✦" set on one line is 90px, which made it —
                 not the split time — the thing deciding how narrow a tile can be, and at
                 1280 that pushed the fifth leg onto a row of its own. Let it break; the
                 grid stretches the other tiles to match. -->
            <div class="t-label" style="font-size:8.5px;letter-spacing:0.08em;color:${tag ? tag.color : 'transparent'};margin-top:3px;min-height:10px;">${tag ? tag.text : '—'}</div>
        </div>`);
    };

    // Tenths, not thousandths. `formatSplitTime` reports 0:58.999 because a mid-race split
    // banner is a stopwatch; a tile you read at a glance next to four others is a
    // comparison, and three decimals of noise is what stops five of them lining up.
    const splitTime = (t) => {
        const m = Math.floor(t / 60);
        const s = (t % 60).toFixed(1);
        return `${m}:${s.padStart(4, '0')}`;
    };

    // The start has no previous place to move from, so it is judged on where it PUT you:
    // top three off the line is the start that wins races, back three is the one you spend
    // the first leg paying for. Read against the fleet, so it still means the same thing if
    // the fleet size ever changes.
    const fleetN = state.boats.length;
    const sr = rs.startRank || 0;
    const startTag = !sr ? null
        : sr <= 3 ? { ...GREEN, text: 'Top 3 off the line' }
        : sr > fleetN - 3 ? { ...RED, text: 'Back 3 off the line' }
        : null;

    // What this run wrote into the record book — only the start still paints gold.
    const rr = state.race.recordResults;
    if (started) tile('Start', '+' + rs.startTimeDisplay.toFixed(1) + 's', sr, 0, false,
                      rr && rr.start ? null : startTag, rr && rr.start ? 'Start record' : false);
    let prev = sr;
    for (let i = 0; i < legs; i++) {
        const rank = rs.legRanks[i] || 0;
        tile('Leg ' + (i + 1), splitTime(rs.legTimes[i]), rank, prev,
             rs.legTimes[i] <= fleetLegBest[i] + 1e-9, null, false);
        if (rank) prev = rank;
    }
    if (!tiles.length) {
        tiles.push(`<div style="font-size:13px;color:#66748c;">No splits — you never crossed the line.</div>`);
    }
    host.innerHTML = tiles.join('');
}

// The measured columns, read for the whole boat. One definition each, because the row and
// the fleet-wide comparison have to be computing the same number.
//
// ⚠️ ROUNDED TO WHAT THE COLUMN PRINTS. Comparing full precision marked one boat's 0.91 as
// the shortest way round while the boat beside it printed 0.91 in plain white — the two
// differed in the third decimal, which the column does not show. A highlight has to be
// checkable against the number next to it.
function boatAvgSpeed(b) {
    const rs = b.raceState;
    const duration = rs.finished ? rs.finishTime : state.race.timer;
    const sum = rs.legSpeedSums ? rs.legSpeedSums.reduce((a, c) => a + c, 0) : 0;
    return Math.round((duration > 0.1 ? sum / duration : 0) * 10) / 10;
}
function boatTopSpeed(b) { return Math.round(Math.max(...b.raceState.legTopSpeeds) * 10) / 10; }
// Seconds after the gun that this boat crossed the line. Recorded for the whole fleet, not
// just the player — 0 means it never got away (a DNS), which is not a slow start but the
// absence of one, so it stays out of both the column and the comparison.
function boatStartTime(b) {
    const t = b.raceState.startTimeDisplay;
    return t > 0 ? Math.round(t * 10) / 10 : null;
}
function boatDistKm(b) {
    return Math.round(unitsToKm(b.raceState.legDistances.reduce((a, c) => a + c, 0)) * 100) / 100;
}

// BEST AND WORST OF EACH MEASURED COLUMN — quickest and slowest burst, quickest and slowest
// average, shortest and longest way round.
//
// ⚠️ OVER BOATS THAT FINISHED THE COURSE, and only those. A boat still on the water has
// sailed a shorter distance than everyone home for the obvious reason, and it would take
// "shortest way round" every time until it crossed the line. Nothing is marked until two
// boats are home, because the only boat in is not the best or the worst of anything.
// The START is the exception, and reads against a different set: it is complete the moment
// a boat crosses the line, so every boat that got away is comparable — including one that
// went on to retire. Nothing else in the row is settled until the boat is home.
function fleetExtremes() {
    const span = (list, f) => {
        const v = list.map(f).filter(x => x !== null);
        return v.length < 2 ? null : { hi: Math.max(...v), lo: Math.min(...v) };
    };
    const done = state.boats.filter(b => b.raceState.finished && !b.raceState.resultStatus);
    return {
        top: done.length < 2 ? null : span(done, boatTopSpeed),
        avg: done.length < 2 ? null : span(done, boatAvgSpeed),
        dist: done.length < 2 ? null : span(done, boatDistKm),
        start: span(state.boats, boatStartTime),
    };
}

// The fleet. One row per boat, built once and patched — boats are still finishing behind
// you while this is on screen.
function renderResultsRows(sorted, leader, ext, gapScale) {
    if (!UI.resultRows) UI.resultRows = {};

    sorted.forEach((boat, index) => {
        const rs = boat.raceState;
        let row = UI.resultRows[boat.id];
        if (!row) {
            row = document.createElement('div');
            // `res-me` gives the player the same gold ring + gold type the leaderboard
            // uses, so "which one is me" is answered the same way on every screen.
            row.className = 'res-row' + (boat.isPlayer ? ' res-me' : '');
            row.style.marginBottom = '2px';
            row.innerHTML = `
                <div class="res-bar res-grid">
                    <!-- The place, in metal. The little medal dot that used to sit beside it
                         said the same thing twice for the podium and drew an empty ring for
                         everyone else — the colour of the numeral is the whole signal. -->
                    <div class="res-pos t-display italic" style="font-size:16px;"></div>
                    <div style="width:32px;height:32px;">
                        <img class="res-face" src="assets/images/competitors/${boat.name.toLowerCase()}.png"
                             alt="${escapeHTMLText(boat.name)}" draggable="false"
                             style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
                    </div>
                    <!-- items-center, not items-baseline: the "You" tag is a badge with its
                         own box, and sitting a padded box on the name's baseline hangs it
                         low. Centre the two and the tag reads as a marker on the name. -->
                    <div class="flex items-center gap-2" style="min-width:0;">
                        <span class="res-name t-display-8 t-display uppercase truncate" style="font-size:14px;letter-spacing:0.03em;"></span>
                        <span class="res-you t-label" style="font-size:9px;letter-spacing:0.12em;color:#0c1322;background:#f2c14e;border-radius:4px;padding:2px 5px;line-height:1.15;display:none;">You</span>
                    </div>
                    <!-- The finish, drawn. The number beside it is exact; this is the one
                         place on the page you can see the shape of the race — who sailed
                         away, who was in a pack, who is still out there. -->
                    <div class="res-gap">
                        <div class="res-gap-axis"></div>
                        <div class="res-gap-mark" style="display:none;">
                            <div class="res-gap-tri"></div>
                        </div>
                    </div>
                    <div class="res-time res-r t-mono" style="font-size:13px;"></div>
                    <div class="res-delta res-r t-mono" style="font-size:12px;color:#7787a0;"></div>
                    <div class="res-start res-r t-mono" style="font-size:12px;"></div>
                    <div class="res-top res-r t-mono" style="font-size:12px;"></div>
                    <div class="res-avg res-r t-mono" style="font-size:12px;color:#9fb2cc;"></div>
                    <div class="res-dist res-r t-mono" style="font-size:12px;color:#9fb2cc;"></div>
                    <div class="res-pen res-r t-mono" style="font-size:12px;"></div>
                    <div class="res-pts res-r t-display" style="font-size:16px;"></div>
                </div>`;
            // NO RING. The coloured ring was here to answer "which hull is that out on the
            // water" — the gap marker answers it now, in the same colour, and ten ringed
            // portraits beside ten coloured arrows was the same fact drawn twice.
            row.querySelector('.res-name').textContent = boat.name;
            // YOUR ROW GLOWS IN YOUR OWN COLOUR — the same hue as the portrait glow on the
            // hero and the badge on your name. The NAME stays white like every other boat's:
            // the row is already marked three ways, and a coloured name on top of a coloured
            // row read as a different kind of row rather than as the same fleet.
            if (boat.isPlayer) {
                const c = deepBandFor(boat.colors.hull, boat.colors.spinnaker, boat.colors.spinAccent);
                const bar = row.querySelector('.res-bar');
                bar.style.borderColor = boatGlow(boat, 0.55);
                bar.style.background = boatGlow(boat, 0.10);
                bar.style.boxShadow = `0 0 18px ${boatGlow(boat, 0.30)}`;
                const you = row.querySelector('.res-you');
                you.style.background = c;
                you.style.display = '';
            }
            UI.resultRows[boat.id] = row;
        }

        const q = (c) => row.querySelector('.' + c);
        const posEl = q('res-pos');
        posEl.textContent = index + 1;
        posEl.style.color = index < 3 ? RES_MEDALS[index] : '#66748c';

        const timeEl = q('res-time');
        if (rs.resultStatus) {
            timeEl.textContent = rs.resultStatus;
            timeEl.style.color = '#f87171';
        } else if (!rs.finished) {
            timeEl.textContent = 'racing';
            timeEl.style.color = '#66748c';
        } else {
            timeEl.textContent = formatTime(rs.finishTime);
            timeEl.style.color = '#eef3fb';
        }

        const clean = rs.finished && !rs.resultStatus;
        const leaderClean = leader.raceState.finished && !leader.raceState.resultStatus;
        const behind = (clean && leaderClean) ? rs.finishTime - leader.raceState.finishTime : null;
        q('res-delta').textContent = (index > 0 && behind !== null) ? '+' + behind.toFixed(2) : '—';

        // The gap, as a marker on a fixed ruler. Only boats with a settled gap get one: a
        // boat still on the water has no gap to the winner yet, and neither has a DNF.
        const mark = q('res-gap-mark');
        if (behind === null) {
            mark.style.display = 'none';
        } else {
            // Winner at 0, last boat home at 1. A one-boat fleet has no spread to draw, so
            // everyone sits on the datum rather than dividing by nothing.
            const f = gapScale > 0 ? behind / gapScale : 0;
            mark.style.display = '';
            // The 24px keeps the marker inside the column at full scale; `calc` does the
            // work so the ruler stays fluid with the layout.
            mark.style.left = `calc(${f.toFixed(4)} * (100% - 24px))`;
            // Every marker is its own boat's colour, yours included — the ruler is a picture
            // of the fleet, and a gold arrow in it would have read as the winner's.
            q('res-gap-tri').style.color =
                deepBandFor(boat.colors.hull, boat.colors.spinnaker, boat.colors.spinAccent);
        }

        // THE ENDS OF EACH COLUMN, GREEN AND RED. Best in the fleet reads green, worst
        // reads red, everyone in between stays quiet — the column is a ranking you can
        // read without reading it. Only a boat that finished can hold either end (see
        // `fleetExtremes`), and "best" is not the same direction in every column: high for
        // speed, LOW for the distance you sailed to get here.
        const edge = (v, s, lowIsGood, gate) => {
            if (!s || !(gate === undefined ? clean : gate)) return '#9fb2cc';
            const good = lowIsGood ? s.lo : s.hi, bad = lowIsGood ? s.hi : s.lo;
            if (Math.abs(v - good) < 1e-9) return '#34d399';
            if (Math.abs(v - bad) < 1e-9) return '#ef4444';
            return '#9fb2cc';
        };
        // Time to cross the line — the first thing you can win or lose, and the one number
        // here that is settled while the rest of the race is still being sailed.
        const start = boatStartTime(boat);
        const startEl = q('res-start');
        startEl.textContent = start === null ? '—' : '+' + start.toFixed(1) + 's';
        startEl.style.color = start === null ? '#4a5a72'
            : edge(start, ext && ext.start, true, true);

        const top = boatTopSpeed(boat), avg = boatAvgSpeed(boat), dist = boatDistKm(boat);
        const topEl = q('res-top');
        topEl.textContent = top.toFixed(1);
        topEl.style.color = edge(top, ext && ext.top, false);

        const avgEl = q('res-avg');
        avgEl.textContent = avg.toFixed(1);
        avgEl.style.color = edge(avg, ext && ext.avg, false);

        const distEl = q('res-dist');
        distEl.textContent = dist.toFixed(2);
        distEl.style.color = edge(dist, ext && ext.dist, true);

        const penEl = q('res-pen');
        penEl.textContent = rs.totalPenalties > 0 ? rs.totalPenalties : '—';
        penEl.style.color = rs.totalPenalties > 0 ? '#ef4444' : '#4a5a72';

        // POINTS, and only for a boat that finished the course. A place you were holding
        // when the screen opened is not a result, and neither is a DNF — scoring either
        // would put a number in the column that the race has not decided yet.
        const ptsEl = q('res-pts');
        ptsEl.textContent = clean ? POINTS_FOR_PLACE(index + 1) : '—';
        // No metal here. The medal colour is already on the place three columns left, and
        // saying it twice made the row look like it was scoring the colour, not the boat.
        ptsEl.style.color = clean ? '#eef3fb' : '#4a5a72';

        // Appending an element that is already in the list MOVES it, which is how the order
        // stays right as boats finish behind you — but a move is a REMOVE + INSERT, and doing
        // ten of them six times a second is what made the finished table flicker. Only touch
        // the DOM when this row is not already where it belongs.
        if (UI.resultsList.children[index] !== row) {
            UI.resultsList.insertBefore(row, UI.resultsList.children[index] || null);
        }
    });
}

// The race's own one-line story, where a series would have put "next stop".
function renderResultsFootnote(leader) {
    const el = document.getElementById('res-footnote');
    if (!el) return;
    const rs = leader.raceState;
    const vn = venueDisplayName(settings.venue);
    el.innerHTML = (rs.finished && !rs.resultStatus)
        ? `<span style="color:#eef3fb;font-weight:800;">${escapeHTMLText(leader.name)}</span> takes `
          + `${vn || 'the race'} in <span class="t-mono" style="color:#eef3fb;">${formatTime(rs.finishTime)}</span>`
        : `${vn || 'The race'} — still on the water`;
}


// Physics announces; the banner answers (see GameEvents in game/core.js — this
// replaced triggerPenalty calling showRaceMessage directly from sim code).
GameEvents.on('player-penalty', (info) => {
    const why = info && info.rule ? ` (${info.rule}${info.reason ? ' — ' + info.reason : ''})` : '';
    showRaceMessage(`PENALTY${why}! DO A 360° TURN TO CLEAR`, "text-red-500", "border-red-500/50");
});
