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
    skipButton: document.getElementById('skip-button'),
    abandonLabel: document.getElementById('abandon-label'),
    settingsButton: document.getElementById('settings-button'),
    closeSettings: document.getElementById('close-settings'),
    saveSettings: document.getElementById('save-settings'),
    newGameButton: document.getElementById('new-game-button'),
    newGameScreen: document.getElementById('new-game-screen'),
    newGameKeep: document.getElementById('new-game-keep'),
    newGameConfirm: document.getElementById('new-game-confirm'),
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
    settingAdaptiveAI: document.getElementById('setting-adaptive-ai'),
    settingNavAids: document.getElementById('setting-navaids'),
    settingClockMillis: document.getElementById('setting-clock-millis'),
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
    tideRow: document.getElementById('hud-tide'),
    tideCanvas: document.getElementById('hud-tide-canvas'),
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
    // The clubhouse (Sep 2026): the hub and its pickers, and the board's series dress.
    preRaceBackBtn: document.getElementById('prerace-back-btn'),
    preRaceCrumb: document.getElementById('prerace-crumb'),
    prRoute: document.getElementById('pr-route'),
    prRouteGrid: document.getElementById('pr-route-grid'),
    prRouteNote: document.getElementById('pr-route-note'),
    clubhouse: document.getElementById('clubhouse-overlay'),
    cupOverlay: document.getElementById('cup-overlay'),
    seriesOverlay: document.getElementById('series-overlay'),
    standingsOverlay: document.getElementById('standings-overlay'),
    fleetOverlay: document.getElementById('fleet-overlay'),
    fleetPrimaryBtn: document.getElementById('fleet-primary-btn'),
    fleetBackLabel: document.getElementById('fleet-back-label'),
    fleetContext: document.getElementById('fleet-context'),
    fleetCrumb: document.getElementById('fleet-crumb'),
    prRightTitle: document.getElementById('pr-right-title'),
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
// A venue thumbnail that stays sharp at whatever size the tile is drawn: the 256px PNG for
// small tiles and the 640px JPEG once the tile needs more device pixels than 256 (a 150px
// tile on a Retina display already does). `cssPx` is the tile's rendered CSS width, which
// is what the browser needs to choose — approximate is fine, it only has to land the same
// side of 256 device pixels as the truth.
function venueThumb(key, alt, cssPx) {
    const base = `assets/images/venues/thumbs/${key}`;
    return `<img src="${base}.png" srcset="${base}.png 256w, ${base}-640.jpg 640w" sizes="${Math.round(cssPx || 150)}px" alt="${alt || ''}" draggable="false">`;
}

function renderVenuePicker() {
    if (!UI.venuePicker) return;
    // Inside a cup or series the venue is not a choice: it is the current race's.
    const inSeries = !!(window.Series && Series.active);
    const selected = inSeries ? Series.currentVenue()
        : ((settings.venue && VENUE_ORDER.includes(settings.venue)) ? settings.venue : 'bay');
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
                    ${venueThumb(key, c.tag || key, 150)}
                    <span class="pr-venue-stars" style="position:absolute; top:6px; right:6px; background:rgba(6,14,26,0.72); border-radius:999px; padding:2px 6px; display:none;"></span>
                    <span class="pr-venue-name t-display-8 uppercase">${c.name || c.tag || key}</span>
                </div>`;
            btn.addEventListener('click', (e) => { e.preventDefault(); selectVenue(key); });
            UI.venuePicker.appendChild(btn);
        }
    }

    for (const btn of UI.venuePicker.children) {
        btn.classList.toggle('sel', btn.dataset.venue === selected);
        // Stars earned here, in the corner of the art — only once there are any.
        const st = btn.querySelector('.pr-venue-stars');
        if (st) { const b = bestForVenue(btn.dataset.venue); const n = b ? b.stars : 0; st.innerHTML = n ? starStrip(n, 10) : ''; st.style.display = n ? '' : 'none'; }
    }
    // The board's series dress: the picker gives way to the route, and the header names
    // the race. A single race shows neither.
    UI.venuePicker.classList.toggle('hidden', inSeries);
    if (UI.prRoute) { UI.prRoute.classList.toggle('hidden', !inSeries); if (inSeries) renderRouteStrip(); }
    if (!inSeries) {
        if (UI.prRightTitle) UI.prRightTitle.innerHTML = '<span style="color:#5aa7ff; font-size:14px; vertical-align:middle;">&#9679;</span> Venues';
        if (UI.prRouteNote) UI.prRouteNote.textContent = `${VENUE_ORDER.length} venues`;
    }
    // The board's button is the gun in every mode (Sep 6): the skipper is chosen on the hub and
    // the fleet page is no longer a step. (It still exists for the eval suites.)
    if (UI.startRaceBtn) UI.startRaceBtn.innerHTML = `Start Race ${_CH_ARROW}`;
    // The header's second line: which cup or series and which race, where the standings
    // screen says the same thing. A single race keeps the club motto.
    if (UI.preRaceCrumb) {
        UI.preRaceCrumb.textContent = inSeries ? (Series.total() === 1 ? 'RACE · ONE RACE AGAINST THE FLEET' : `${Series.active.name} · Race ${Series.raceNumber()} of ${Series.total()}`.toUpperCase()) : 'TIME TRIAL · SOLO, AGAINST THE CLOCK AND YOUR GHOST';
        UI.preRaceCrumb.style.color = inSeries ? '#f2c14e' : '#7787a0';
    }
    sizeRaceDayHero();
    renderVenueDetail(selected);
}

// The hero used to be sized here (a square of art as tall as half the column, the chart
// under it). Since PT-010 the hero is the briefing strip over the map's foot with a fixed CSS
// height, so this only clears what older builds of the page left inline. Kept as the resize
// hook input.js already calls.
function sizeRaceDayHero() {
    const hero = document.getElementById('venue-hero');
    const art = document.getElementById('venue-art');
    if (hero) { hero.style.height = ''; hero.style.maxHeight = ''; }
    if (art) art.style.maxWidth = '';
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
        // The strip rides over the map, so it stays dark enough for its type on any water: the
        // venue's deep water beside the art, settling to its abyss under the facts and the time.
        hero.style.background = `linear-gradient(100deg, ${deep}f0 0%, ${darkEnd}f2 46%, ${darkEnd}f5 100%)`;
    }
    if (art) {
        // A GENTLE seam, not a shadow: just enough of the panel colour bleeding onto the
        // art's left edge to avoid a hard cut. Semi-transparent and narrow — at full
        // opacity over a quarter of the frame it was eating the picture's left side.
        const seam = mixHex(deep, '#0c1322', 0.55).replace('rgb(', 'rgba(').replace(')', ',0.5)');
        art.innerHTML = `
            <img src="assets/images/venues/${key}.png" alt="${c.name || c.tag || key}" draggable="false"
                 style="width:100%; height:100%; object-fit:cover; display:block;">
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
    // ONE RECORDS BLOCK (PT-010): the time to beat big, your best under it, the book one click
    // away. The records table that sat beside the old chart is gone — the same numbers twice
    // was the complaint. Gold = a time YOU set here. "Time trials only" shows where records
    // cannot be set (a cup or series briefing), so the question is answered where it arises.
    const prov = provisionalRecord(key);
    const mine = !!(best && best.t != null);
    const recordBlock = `
        <div class="vs-record">
            <div class="t-label t-label-xs" style="color:#dbeafe;">Time to beat</div>
            <div class="t-mono vs-record-time">${prov != null ? formatBestTime(prov) : '&mdash;'}</div>
            <div class="t-label t-label-xs" style="color:#9fb2cc; white-space:nowrap;">${best && best.stars ? starStrip(best.stars, 11) + ' &middot; ' : ''}Your best
                <span class="t-mono" style="font-size:12px; color:${mine ? '#f2c14e' : '#7787a0'}; margin-left:3px;">${mine ? formatBestTime(best.t) : '&mdash;'}</span></div>
            <div class="vs-record-links">
                ${recordsEligible() ? '' : '<span class="t-label t-label-xs" style="color:#7787a0;">Time trials only</span>'}
                ${venueObjectivesStrip(key, true)}
                <button class="t-label t-label-xs vs-link" onclick="openRecordsOverlay()">Records &rarr;</button>
            </div>
        </div>`;
    const chip = (label, value) => `
        <div class="vs-chip" title="${String(value).replace(/<[^>]+>/g, '').replace(/"/g, '&quot;')}"><span class="t-label t-label-xs" style="color:#9fd3dd;">${label}</span><span class="t-mono vs-chip-v">${value}</span></div>`;
    const context = (window.Series && Series.active) ? `Race ${Series.raceNumber()} of ${Series.total()}` : `Venue ${idx} of ${VENUE_ORDER.length}`;

    UI.venueDetail.innerHTML = `
        <div class="vs-top">
            <div class="vs-head">
                <div class="t-label t-label-xs" style="color:#7ff0d4;">${context} &middot; ${c.tag || key}</div>
                <div class="t-display uppercase vs-title${longName}">${c.name || c.tag || key}</div>
                <div class="vs-blurb">${c.blurb || ''}</div>
            </div>
            ${recordBlock}
        </div>
        <div class="vs-chips">
            ${chip('Wind', pending ? '&hellip;' : windRangeText())}
            ${chip('Water', waterVal || (pending ? '&hellip;' : '&mdash;'))}
            ${chip('Course', pending ? '&hellip;' : courseSummaryText())}
            ${chip('Time limit', pending ? '&hellip;' : timeLimitText())}
        </div>`;
    layoutVenueCourseMap(pending);
}

// ── The venue's objectives ──────────────────────────────────────────────────
// Every character earned at a venue, on its card: a face per objective (a silhouette until
// earned, a "?" for one whose art has not shipped) and a button to the full list. Nothing is
// hidden — the list spells every objective out (Wes, Sep 25 2026). One compact row, because
// the race-day board does not scroll.
function venueObjectivesStrip(key, compact) {
    if (!window.Unlocks || !Unlocks.enforced()) return '';
    const list = Unlocks.forVenue(key);
    if (!list.length) return '';
    const got = list.filter(a => Unlocks.isEarned(a.char)).length;
    const faces = list.map(a => venueObjectiveFace(a, compact ? 20 : 30)).join('');
    // The venue page's strip has room for one link, not the faces: the count, and the list a
    // click away.
    if (compact) return `
        <button type="button" class="t-label t-label-xs vs-link" onclick="openVenueObjectives('${key}')">Earn here &middot; ${got}/${list.length} &rarr;</button>`;
    return `
        <button type="button" class="pr-objectives shrink-0" onclick="openVenueObjectives('${key}')"
                style="background:rgba(6,14,26,0.4); border:1px solid rgba(255,255,255,0.14); border-radius:12px; padding:7px 12px; cursor:pointer; text-align:left;">
            <span class="t-label t-label-sm pr-obj-label" style="color:#dbeafe; white-space:nowrap;">Earn here &middot; ${got}/${list.length}</span>
            <span class="pr-obj-faces">${faces}</span>
            <span class="t-label t-label-sm pr-obj-link" style="color:#8fd8d0; white-space:nowrap; text-decoration:underline; text-underline-offset:3px;">Objectives &rarr;</span>
        </button>`;
}
function venueObjectiveFace(a, size) {
    const earned = Unlocks.isEarned(a.char);
    if (!Unlocks.shipped(a.char)) {
        return `<span title="Coming soon" style="width:${size}px;height:${size}px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.08);color:#7787a0;font-weight:800;font-size:${Math.round(size * 0.45)}px;">?</span>`;
    }
    return `<img src="assets/images/competitors/${a.char.toLowerCase()}.png" alt="" draggable="false"
                 style="width:${size}px;height:${size}px;border-radius:50%;background:${earned ? 'rgba(242,193,78,0.18)' : 'rgba(255,255,255,0.06)'};
                        ${earned ? 'box-shadow:0 0 0 2px #f2c14e;' : 'filter:brightness(0) opacity(0.55);'}">`;
}
const _RUNG_LABEL = { 'first-win': 'First win', mechanic: 'Mechanic', explorer: 'Explorer', target: 'Target time', 'four-stars': 'Four stars', wildlife: 'Wildlife', lessons: 'Every lesson', start: 'The start', report: 'Report card' };
// One row per objective — face, rung, who, title, hint, a tick once earned. The venue's
// objectives overlay uses it, and so does the Sailing School's first screen (school.js),
// where the pond's list stands in for the strip the hub door no longer carries.
function venueObjectiveRowsHTML(key) {
    return Unlocks.forVenue(key).map(a => {
        const earned = Unlocks.isEarned(a.char), shipped = Unlocks.shipped(a.char);
        const who = earned || !shipped ? a.char : '';
        return `
            <div class="flex items-center gap-3" style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.07);">
                ${venueObjectiveFace(a, 46)}
                <div style="min-width:0; flex:1;">
                    <div class="flex items-center gap-2">
                        <span class="t-label t-label-xs" style="color:#8fd8d0;">${_RUNG_LABEL[a.rung] || ''}</span>
                        ${who ? `<span class="t-label t-label-xs" style="color:${earned ? '#f2c14e' : '#7787a0'};">${who}${!shipped ? ' &middot; coming soon' : ''}</span>` : ''}
                    </div>
                    <div class="t-display uppercase" style="font-size:17px; line-height:1.15; color:${earned ? '#f2c14e' : '#eef3fb'};">${a.title}</div>
                    <div style="font-size:13px; font-weight:700; color:#9fb2cc; margin-top:2px;">${Unlocks.hintOf(a)}</div>
                </div>
                <span style="font-size:18px; color:${earned ? '#34d399' : 'transparent'};">&#10003;</span>
            </div>`;
    }).join('');
}
function openVenueObjectives(key) {
    let host = document.getElementById('venue-objectives');
    if (!host) {
        host = document.createElement('div');
        host.id = 'venue-objectives';
        host.className = 'absolute inset-0 bg-slate-900/75 backdrop-blur z-[75] flex flex-col items-center justify-center p-4 pointer-events-auto';
        host.addEventListener('click', (e) => { if (e.target === host) closeVenueObjectives(); });
        (UI.preRaceOverlay ? UI.preRaceOverlay.parentElement : document.body).appendChild(host);
    }
    const d = window.VenueDoc && VenueDoc.get(key);
    const name = key === 'pond' ? 'Sailing School' : ((d && d.card && d.card.name) || key);
    const rows = venueObjectiveRowsHTML(key);
    host.innerHTML = `
        <div class="ov-card w-full" style="max-width:520px; padding:20px 24px; max-height:86vh; overflow-y:auto;">
            <div class="flex items-center justify-between">
                <span class="ov-title" style="font-size:22px;">${name}</span>
                <button type="button" onclick="closeVenueObjectives()" style="font-size:15px; color:#66748c;" class="hover:text-white transition-colors">&#10005;</button>
            </div>
            <div class="t-label t-label-sm" style="color:#9fb2cc; margin-top:4px;">Characters to earn here</div>
            <div style="margin-top:6px;">${rows}</div>
        </div>`;
    host.classList.remove('hidden');
}
function closeVenueObjectives() { const h = document.getElementById('venue-objectives'); if (h) h.classList.add('hidden'); }
function venueObjectivesOpen() { const h = document.getElementById('venue-objectives'); return !!(h && !h.classList.contains('hidden')); }

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
    return `${state.race.totalLegs} leg${state.race.totalLegs === 1 ? "" : "s"}${km >= 0.1 ? ` &middot; ${km.toFixed(1)} km` : ''}`;
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

// ── THE VENUE MAP (PT-010, Oct 2026) ──────────────────────────────────────────────
// The map IS the venue page: it fills the left column and the briefing rides a strip over
// its foot (#venue-hero). Playtesters could not tell land from water on the old chart (grey
// contours on navy) and it looked nothing like the minimap they race with, so the map is now
// DRAWN BY the minimap — drawMinimap into a borrowed canvas, terrain only — with the course,
// the wind and the current laid over it in the race's own vocabulary:
//   · TURNED TO FIT. The course's long axis lies along the panel — 0° unless a turn buys 12%
//     more scale, never past 90° — so a tall strait fills a wide panel instead of sitting in a
//     strip at the bottom. A small N arrow says how far it turned (cartography's rule).
//   · MARKS LIKE THE GOAL CHIP: green buoy, teal arc the way round, numbered in sailing order
//     ("2 · 4" for a mark rounded twice). Start green, gates gold with their leg, finish
//     dashed. The legs are a quiet dotted line — one way round, not THE way.
//   · WIND IS MOTION, coloured by the race's own streak ramp (streakColorFor: ice → white →
//     cream → gold → amber → red), so a shade means the same knots here as on the water.
//   · CURRENT as chart arrows, weighted by rate, a few labelled in knots; a tidal venue plays
//     its whole cycle every TIDE_LOOP_S so flood and ebb both show.
// Everything static draws once into an offscreen layer; the loop blits it under the comets
// and the current. `target` lets another surface borrow the map whole (the full-screen chart,
// the Sailing School's screens); absent, it is the race-day board's.

const _chartAnim = { raf: 0 };
const TIDE_LOOP_S = 12;

// THE MEDIAN DAY (Wes, Oct 4 2026): the map shows the wind a race will mostly see, not the
// instant the board was opened — the regions' own means with the oscillation at zero
// (regionWindAt under WIND_MEAN_FIELD, the switch the grid bake uses for the same reason),
// and no puffs, lulls or squalls. A venue with no wind regions blows its base wind.
function venueMeanWindAt(x, y) {
    if (!(state.course.windRegions && state.course.windRegions.length) || typeof WIND_MEAN_FIELD === 'undefined')
        return { direction: state.wind.baseDirection, speed: state.wind.baseSpeed };
    const was = WIND_MEAN_FIELD;
    WIND_MEAN_FIELD = true;
    try { return regionWindAt(x, y); } finally { WIND_MEAN_FIELD = was; }
}          // one full tidal cycle on the preview, seconds

// THE STAGE (Wes, Oct 5 2026): the map is SQUARE — the whole sailable area fits it with a thin margin,
// so there is no wide band of scenery to build — with the briefing either BESIDE it (a card at least
// VS_CARD_MIN wide) or UNDER it (the strip). Whichever leaves the bigger map wins, so every window
// shape gets the largest square it can hold.
const VS_GAP = 14, VS_CARD_MIN = 300, VS_CARD_MAX = 640;
function layoutVenueStage() {
    const st = document.getElementById('venue-stage'), box = document.getElementById('venue-course-box'), hero = document.getElementById('venue-hero');
    if (!st || !box || !hero) return;
    const w = st.clientWidth, h = st.clientHeight; if (w < 40 || h < 40) return;
    const stripH = window.innerHeight <= 760 ? 140 : 156;
    const place = (el, x, y, ww, hh) => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = ww + 'px'; el.style.height = hh + 'px'; };
    const besideSide = Math.min(h, w - VS_CARD_MIN - VS_GAP), underSide = Math.min(w, h - stripH - VS_GAP);
    if (besideSide >= underSide) {
        st.dataset.mode = 'row';
        const side = Math.max(120, besideSide), cw = Math.min(VS_CARD_MAX, w - side - VS_GAP);
        place(box, 0, 0, side, side);
        place(hero, side + VS_GAP, 0, cw, side);
    } else {
        st.dataset.mode = 'col';
        const side = Math.max(120, underSide);
        place(box, Math.round((w - side) / 2), 0, side, side);
        place(hero, 0, side + VS_GAP, w, stripH);
    }
}
// Kept as the board's single entry point (selectVenue and resize call it).
function layoutVenueCourseMap(pending) {
    layoutVenueStage();
    const box = document.getElementById('venue-course-box');
    if (!box) return;
    // While the selection's light build is in flight state.course is the PREVIOUS venue — a
    // wrong map for a beat is worse than an empty one. The build's completion re-renders.
    // (The box stays up: the briefing strip lives inside it.)
    if (pending || !(state.course && state.course.route && state.course.route.length)) {
        if (_chartAnim.raf) { cancelAnimationFrame(_chartAnim.raf); _chartAnim.raf = 0; }
        const cv = document.getElementById('venue-course-map');
        if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
        return;
    }
    // Redraw when the box changes size (web fonts landing re-flow the strip, and the strip's
    // height is the map's bottom inset).
    if (typeof ResizeObserver !== 'undefined') {
        if (_chartAnim.ro) _chartAnim.ro.disconnect();
        _chartAnim.ro = new ResizeObserver(() => { layoutVenueStage(); _drawBoardMap(); });
        const stage = document.getElementById('venue-stage');
        _chartAnim.ro.observe(stage || box);
    }
    venueMapResetButton(!!venueMapBoardView());
    _drawBoardMap();
    _wireBoardMapGestures();
}

// PAN AND ZOOM ON THE BOARD'S MAP (Wes, Oct 5 2026: the full-screen chart is gone — the board's map
// is big enough once it can zoom). Wheel or pinch to zoom about the pointer, drag to pan, double-
// click or "Reset view" to go back. Every view is clamped live inside the whole view (the whole sailable area) and to 6x
// the fit (drawCourseMiniMap's `limit`). During a gesture the baked map — over a backing of the
// whole view — is moved as a picture; 150 ms after it settles it is redrawn sharp. The view
// belongs to the venue: picking another starts from the fit.
const _vmBoard = { view: null, venue: null, timer: 0, wired: false, backing: null, backingFor: null };
function venueMapBoardView() {
    return (_vmBoard.view && state.course && _vmBoard.venue === state.course.venueKey) ? _vmBoard.view : null;
}
function _drawBoardMap() {
    drawCourseMiniMap();
    _chartAnim.gesture = null;
}
function venueMapResetView() { _vmBoard.view = null; if (_vmBoard.motion) { _vmBoard.motion.cur = _vmBoard.motion.target = _vmBoard.motion.vel = null; } venueMapResetButton(false); _drawBoardMap(); }
function venueMapResetButton(on) {
    const inner = document.getElementById('venue-course-inner'); if (!inner) return;
    let b2 = inner.querySelector('.vm-reset');
    if (!b2) {
        b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'vm-reset'; b2.textContent = 'Reset view'; b2.title = 'Back to the whole area (or double-click the map)';
        b2.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); venueMapResetView(); });
        b2.addEventListener('pointerdown', (e) => e.stopPropagation());
        inner.appendChild(b2);
    }
    b2.style.display = on ? 'block' : 'none';
}
// SMOOTH PAN AND ZOOM (Wes, Oct 5 2026). The view animates: `cur` is what is on screen, `target` where
// it is going. A wheel step moves the target (about the pointer) and `cur` eases toward it; a drag
// moves both 1:1 with the pointer and leaves a little inertia on release. While anything moves, each
// frame is only a composite — the whole-area backing plus the last sharp bake, placed by `cur` — and
// the sharp re-bake (≈80 ms) waits until the motion has settled, no button is down and the input has
// been quiet for 300 ms, so it never lands mid-gesture.
const VM_EASE = 16;            // per second: wheel zoom glides to its target in ~0.2 s
const VM_IDLE_MS = 120;          // the settle is a re-anchor now (a few ms), not a re-bake
function _wireBoardMapGestures() {
    if (_vmBoard.wired) return;
    const inner = document.getElementById('venue-course-inner'), cv = document.getElementById('venue-course-map');
    if (!inner || !cv) return;
    _vmBoard.wired = true;
    inner.style.cursor = 'grab'; inner.style.touchAction = 'none';
    const V0 = () => cv._vmView;
    const base = () => { const o = V0(); return o && { scale: o.scale, rcx: o.rcx, rcy: o.rcy }; };
    const M = _vmBoard.motion = _vmBoard.motion || { cur: null, target: null, vel: null, lastInput: 0, down: false };
    const start = () => {
        if (!M.cur) { M.cur = venueMapBoardView() || base(); M.target = Object.assign({}, M.cur); }
        _vmBoard.venue = state.course.venueKey;
        venueMapResetButton(true);
        M.lastInput = performance.now();
        if (!_chartAnim.raf) _chartAnim.raf = requestAnimationFrame(chartCometFrame);
    };
    const clamp = (q) => { const o = V0(); return o && o.limit ? o.limit(q) : q; };
    const zoomAt = (px, py, f) => {
        const o = V0(); if (!o) return;
        start();
        const q = M.target;
        const ns = o.clampScale ? o.clampScale(q.scale * f) : q.scale * f;
        if (Math.abs(ns - q.scale) < q.scale * 1e-4) return;
        const rx = (px - o.W / 2) / q.scale + q.rcx, ry = (py - o.oy) / q.scale + q.rcy;
        M.target = clamp({ scale: ns, rcx: rx - (px - o.W / 2) / ns, rcy: ry - (py - o.oy) / ns });
        M.vel = null;
    };
    const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    inner.addEventListener('wheel', (e) => {
        e.preventDefault(); e.stopPropagation();
        const [x, y] = local(e);
        // trackpads send many small deltas, mice a few big ones: one exponential handles both
        zoomAt(x, y, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
    }, { passive: false });
    const ptrs = new Map(); let last = null, lastT = 0, pinch = null, moved = false;
    inner.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.vm-toggle, .vm-reset, .vm-tide')) return;
        inner.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, local(e)); moved = false;
        const tip = inner.querySelector('.vm-hover'); if (tip) tip.style.display = 'none';
        start(); M.down = true; M.vel = null;
        M.target = Object.assign({}, M.cur);            // a grab stops any glide where it is
        if (ptrs.size === 1) { last = local(e); lastT = performance.now(); inner.style.cursor = 'grabbing'; }
        if (ptrs.size === 2) { const [a2, b2] = [...ptrs.values()]; pinch = { d: Math.hypot(a2[0] - b2[0], a2[1] - b2[1]) }; }
    });
    inner.addEventListener('pointermove', (e) => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.set(e.pointerId, local(e));
        if (ptrs.size === 2 && pinch) {
            const [a2, b2] = [...ptrs.values()], d = Math.hypot(a2[0] - b2[0], a2[1] - b2[1]);
            if (pinch.d > 0) { zoomAt((a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2, d / pinch.d); M.cur = Object.assign({}, M.target); }
            pinch.d = d; moved = true; return;
        }
        const p2 = local(e), now = performance.now();
        if (last) {
            const dx = p2[0] - last[0], dy = p2[1] - last[1];
            if (dx || dy) {
                moved = true; start();
                const q = M.cur;
                const nv = clamp({ scale: q.scale, rcx: q.rcx - dx / q.scale, rcy: q.rcy - dy / q.scale });
                const dt = Math.max(1, now - lastT) / 1000;
                // panel px per second, smoothed: the fling on release
                const vx = (q.rcx - nv.rcx) * q.scale / dt, vy = (q.rcy - nv.rcy) * q.scale / dt;
                M.flick = M.flick ? { x: M.flick.x * 0.6 + vx * 0.4, y: M.flick.y * 0.6 + vy * 0.4 } : { x: vx, y: vy };
                M.cur = nv; M.target = Object.assign({}, nv);
            }
        }
        last = p2; lastT = now;
    });
    const up = (e) => {
        ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
        if (!ptrs.size) {
            last = null; inner.style.cursor = 'grab'; M.down = false; M.lastInput = performance.now();
            // inertia: carry the last drag velocity on, decaying (a stale flick — the pointer held still — is dropped)
            if (M.flick && performance.now() - lastT < 80 && Math.hypot(M.flick.x, M.flick.y) > 60) M.vel = { x: M.flick.x, y: M.flick.y };
            M.flick = null;
        }
    };
    inner.addEventListener('pointerup', up); inner.addEventListener('pointercancel', up);
    inner.addEventListener('dblclick', (e) => { e.preventDefault(); M.cur = M.target = M.vel = null; venueMapResetView(); });
    // a drag is not a click on the box behind
    inner.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); moved = false; } }, true);
}
// One step of the view's motion; returns true while it is still moving (or a bake is pending).
function venueMapStepMotion(dt) {
    const M = _vmBoard.motion, cv = document.getElementById('venue-course-map');
    if (!M || !M.cur || !cv || !cv._vmView) return false;
    const o = cv._vmView;
    if (M.vel && !M.down) {
        const q = M.cur;
        const nv = o.limit({ scale: q.scale, rcx: q.rcx - M.vel.x * dt / q.scale, rcy: q.rcy - M.vel.y * dt / q.scale });
        M.cur = nv; M.target = Object.assign({}, nv);
        const k = Math.exp(-5 * dt); M.vel = { x: M.vel.x * k, y: M.vel.y * k };
        if (Math.hypot(M.vel.x, M.vel.y) < 8) M.vel = null;
        M.lastInput = performance.now();
    } else if (!M.down) {
        const k = 1 - Math.exp(-VM_EASE * dt), c = M.cur, t = M.target;
        // ease the scale in log space and the centre linearly — zoom feels even at every level
        const ls = Math.log(c.scale) + (Math.log(t.scale) - Math.log(c.scale)) * k;
        M.cur = { scale: Math.exp(ls), rcx: c.rcx + (t.rcx - c.rcx) * k, rcy: c.rcy + (t.rcy - c.rcy) * k };
        if (Math.abs(Math.log(t.scale / M.cur.scale)) < 0.002 && Math.hypot(t.rcx - M.cur.rcx, t.rcy - M.cur.rcy) * t.scale < 0.4) M.cur = Object.assign({}, t);
    }
    const settled = !M.down && !M.vel && M.cur.scale === M.target.scale && M.cur.rcx === M.target.rcx && M.cur.rcy === M.target.rcy;
    if (settled && performance.now() - M.lastInput > VM_IDLE_MS) {
        // the sharp bake, at rest
        _vmBoard.view = Object.assign({ rot: o.rot }, M.cur);
        const same = Math.abs(M.cur.scale - o.scale) < 1e-9 && Math.abs(M.cur.rcx - o.rcx) < 1e-6 && Math.abs(M.cur.rcy - o.rcy) < 1e-6;
        M.cur = M.target = null;
        if (!same) { _drawBoardMap(); return 'baked'; }   // the bake restarted the loop itself
        return false;
    }
    // the composite for this frame
    const k2 = M.cur.scale / o.scale;
    _chartAnim.gesture = { k: k2, tx: (o.W / 2) * (1 - k2) + (o.rcx - M.cur.rcx) * M.cur.scale, ty: o.oy * (1 - k2) + (o.rcy - M.cur.rcy) * M.cur.scale,
                           view: M.cur, rot: o.rot, W: o.W, oy: o.oy };
    return true;
}

// The points the frame must hold: every goal (a rounding with room for its chip) and the
// sailed paths, so a detour round land never leaves the picture.
function venueMapPoints() {
    const marks = state.course.marks || [], route = state.course.route || [], dmc = state.course.dmc;
    const pts = [];
    // THE WHOLE SAILABLE AREA (Wes, Oct 5 2026): every bay, finger and outer route a boat can reach
    // from the start, inside the arena, is part of the choice — VenueDoc.sailableHull.
    const hull = state.course.doc && window.VenueDoc && VenueDoc.sailableHull ? VenueDoc.sailableHull(state.course.doc) : null;
    const B = state.course.boundary;
    if (hull && hull.length) for (const q of hull) pts.push([q[0], q[1]]);
    else if (B && B.poly && B.poly.length) for (const q of B.poly) pts.push([q[0], q[1]]);   // [x, y] pairs (arena.js)
    else if (B && B.radius) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; pts.push([B.x + Math.cos(a) * B.radius, B.y + Math.sin(a) * B.radius]); }
    // The goals frame only a venue WITHOUT a sailable area (a generated course): every mark lies on
    // sailable water, so the area already holds them, and adding room round each one shifted the frame
    // off the area the editor's preview guide measures (Oct 6 2026). The labels keep their own check
    // (fitMinimum).
    if (!(hull && hull.length)) for (const e of route) {
        if (e.kind === 'round' && e.mark) {
            const z = (e.mark.zone || 165) * 1.6;
            pts.push([e.mark.x - z, e.mark.y - z], [e.mark.x + z, e.mark.y + z]);
        } else if (e.marks) for (const i of e.marks) if (marks[i]) pts.push([marks[i].x, marks[i].y]);
    }
    return pts;
}

// The turn (multiple of 15°, within ±90°) that lets the course fill a W×H window best.
// Upright wins unless a turn buys 12% more scale, so a venue that fits either way stays put.
function venueMapRotation(pts, W, H) {
    let best = { score: -1, a: 0 };
    for (let k = -6; k <= 6; k++) {
        const a = k * Math.PI / 12, ca = Math.cos(a), sa = Math.sin(a);
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const [x, y] of pts) {
            const rx = x * ca - y * sa, ry = x * sa + y * ca;
            if (rx < x0) x0 = rx; if (rx > x1) x1 = rx; if (ry < y0) y0 = ry; if (ry > y1) y1 = ry;
        }
        const s = Math.min(W / Math.max(300, x1 - x0), H / Math.max(300, y1 - y0)) * (k === 0 ? 1.12 : 1);
        if (s > best.score) best = { score: s, a };
    }
    return best.a;
}

function venueMapArrow(ctx, x, y, ang, len, col, w) {
    const dx = Math.sin(ang), dy = -Math.cos(ang);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - dx * len / 2, y - dy * len / 2);
    ctx.lineTo(x + dx * len / 2 - dx * w * 2, y + dy * len / 2 - dy * w * 2);
    ctx.stroke();
    const hx = x + dx * len / 2, hy = y + dy * len / 2, s = w * 3.2;
    ctx.beginPath(); ctx.moveTo(hx, hy);
    ctx.lineTo(hx - dx * s * 1.6 + dy * s, hy - dy * s * 1.6 - dx * s);
    ctx.lineTo(hx - dx * s * 1.6 - dy * s, hy - dy * s * 1.6 + dx * s);
    ctx.closePath(); ctx.fill();
}

// ── HOVER: the wind and the stream where the pointer is ──
// The median-day wind (venueMeanWindAt) and the current at the map's own tide clock — the
// numbers a venue-wide badge could not give on a course where both change across the water.
const VM_POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
function vmCompassName(rad) {
    const deg = ((rad * 180 / Math.PI) % 360 + 360) % 360;
    return VM_POINTS[Math.round(deg / 22.5) % 16];
}
function venueMapHoverWire(inner, canvas) {
    let tip = inner.querySelector('.vm-hover');
    if (!tip) { tip = document.createElement('div'); tip.className = 'vm-hover'; inner.appendChild(tip); }
    if (inner._vmHover) return;
    inner._vmHover = true;
    inner.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    inner.addEventListener('mousemove', (e) => {
        // over the map's own controls the readout steps aside, so it never covers what you are reaching for
        if (e.target.closest && e.target.closest('.vm-reset, .vm-toggle, .vm-tide')) { tip.style.display = 'none'; return; }
        const cv = inner.querySelector('canvas'), V = cv && cv._vm;
        if (!V || !state.course) return;
        const r = cv.getBoundingClientRect();
        const sx = e.clientX - r.left, sy = e.clientY - r.top;
        const [wx, wy] = V.inv(sx, sy);
        // THE SAME BOX WHEREVER THE POINTER IS (Wes, Oct 6 2026: it jumped as its size changed): always
        // the same rows — Wind, and Current where the venue has a stream — at a fixed width (CSS), so on
        // land or ice the values say so instead of the box shrinking to one word.
        const hasCurRow = !!(state.course.currentRegions && state.course.currentRegions.length && typeof getCurrentAt === 'function');
        const row = (k, v) => `<div><span class="t-label t-label-xs vm-hover-k">${k}</span><span class="t-mono">${v}</span></div>`;
        const onFloe = typeof pointInVerts === 'function' && (state.course.islands || []).some(i => i.isFloe && i.vertices
            && (wx - i.x) ** 2 + (wy - i.y) ** 2 <= i.radius * i.radius && pointInVerts(wx, wy, i.vertices));
        let html;
        if (onFloe || (typeof pointOnLand === 'function' && pointOnLand(wx, wy))) {
            const what = onFloe ? 'drifting ice' : 'land';
            html = row('Wind', what) + (hasCurRow ? row('Current', what) : '');
        } else {
            const w = venueMeanWindAt(wx, wy);
            html = row('Wind', `${Math.round(w.speed)} kt from ${vmCompassName(w.direction)}`);
            if (hasCurRow) {
                const C = _chartAnim.canvas === cv ? _chartAnim.curField : null;
                const t0 = state.time;
                if (C && C.period > 0) state.time = C.t0 + (C.clock / TIDE_LOOP_S) * C.period;
                let c = null;
                try { c = vmTidal() ? Tide.atPhase(vmTidePhase(), () => getCurrentAt(wx, wy)) : getCurrentAt(wx, wy); } finally { state.time = t0; }
                html += row('Current', c && c.speed >= 0.1 ? `${c.speed.toFixed(1)} kt toward ${vmCompassName(c.direction)}` : 'slack');
            }
        }
        if (tip.innerHTML !== html) tip.innerHTML = html;
        tip.style.display = 'block';
        // beside the compass when the row has room for the box's fixed width; on a small map, where it
        // would run into the Wind / Current toggle, just under the compass. Decided by the MAP's width
        // alone, so it never flips as the reading changes.
        const tg = inner.querySelector('.vm-toggle'), ir = inner.getBoundingClientRect();
        const toggleRight = tg ? tg.getBoundingClientRect().right - ir.left : 0;
        const under = ir.width - 66 - tip.offsetWidth < toggleRight + 8;
        tip.style.top = under ? '64px' : ''; tip.style.right = under ? '14px' : '';
        // pinned beside the compass (Wes, Oct 6 2026), not trailing the pointer: it never covers the
        // spot being read or a control being reached for (CSS .vm-hover places it)
    });
}

function drawCourseMiniMap(target) {
    const T = target || { view: venueMapBoardView() };
    const box = T.box || document.getElementById('venue-course-box');
    const inner = T.inner || document.getElementById('venue-course-inner');
    const canvas = T.canvas || document.getElementById('venue-course-map');
    if (!box || !inner || !canvas || !state.course || !state.boats.length) return;
    const route = state.course.route || [];
    if (route.length < 2) return;
    // The board's map fills its box; the full chart and the school's screens keep their box's
    // own size too. Only the board has a strip over the foot to frame the course above.
    const W = Math.round(T.inner ? (T.full ? box.clientWidth * 0.92 : box.clientWidth) : box.clientWidth);
    const H = Math.round(T.inner ? (T.full ? box.clientHeight * 0.86 : box.clientHeight) : box.clientHeight);
    if (W < 60 || H < 60) return;
    inner.style.width = W + 'px'; inner.style.height = H + 'px';
    const strip = !T.box ? document.getElementById('venue-hero') : null;
    const inB = strip && strip.offsetParent && box.contains(strip) ? strip.offsetHeight + 16 : 0;   // the strip over the map's foot (none since the square stage)
    const inT = 70;                                // the compass's row, and a mark chip's label above it
    const pad = 26;

    // ── THE FRAME (Wes, Oct 5 2026): the WHOLE view — every bit of water a boat can reach from the
    // start (VenueDoc.sailableArea) and every mark and gate with its label — is where the map opens AND
    // the furthest it zooms out: the smallest view that holds the whole sailable area. Zoomed in, a view
    // pans only within it. The editor's cyan guide is this view on each measured panel size.
    const pts = venueMapPoints();
    if (pts.length < 2) return;
    const Hv = H - inB - inT;
    const oy = inT + Hv / 2;
    const visH = H - inB;                          // what shows: the panel above the strip
    const fitBox = { fw: W - 2 * pad - 90, fh: Hv - 2 * pad };   // == VenueDoc.previewPanel
    const frameFor = (rot, view) => {
        const ca = Math.cos(rot), sa = Math.sin(rot);
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const [x, y] of pts) {
            const rx = x * ca - y * sa, ry = x * sa + y * ca;
            if (rx < x0) x0 = rx; if (rx > x1) x1 = rx; if (ry < y0) y0 = ry; if (ry > y1) y1 = ry;
        }
        const v = { scale: Math.min(fitBox.fw / Math.max(300, x1 - x0), fitBox.fh / Math.max(300, y1 - y0)),
                    rcx: (x0 + x1) / 2, rcy: (y0 + y1) / 2 };
        const fitMarks = [], fitLines = [];
        {
            const mk = state.course.marks || [];
            for (const e of route) {
                if (e.kind === 'round' && e.mark) fitMarks.push(e.mark);
                else if (e.marks && mk[e.marks[0]] && mk[e.marks[1]]) fitLines.push([mk[e.marks[0]], mk[e.marks[1]]]);
            }
        }
        const projectV = (q) => (x, y) => { const rx = x * ca - y * sa, ry = x * sa + y * ca; return [W / 2 + (rx - q.rcx) * q.scale, oy + (ry - q.rcy) * q.scale]; };
        const invV = (q) => (sx, sy) => { const rx = (sx - W / 2) / q.scale + q.rcx, ry = (sy - oy) / q.scale + q.rcy; return [rx * ca + ry * sa, -rx * sa + ry * ca]; };
        // The minimum: zoom out until every mark's number and every line's label clears the panel's
        // edges, the compass row and the strip.
        const fitMinimum = (q, shiftFirst) => {
            for (let it = 0; it < 30; it++) {
                const P = projectV(q);
                let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
                const add = (xa, ya, xb, yb) => { bx0 = Math.min(bx0, xa); by0 = Math.min(by0, ya); bx1 = Math.max(bx1, xb); by1 = Math.max(by1, yb); };
                for (const m of fitMarks) { const [x, y] = P(m.x, m.y); add(x - 22, y - 36, x + 22, y + 18); }
                for (const [a2, b2] of fitLines) { const [ax, ay] = P(a2.x, a2.y), [bx, by] = P(b2.x, b2.y); const mx = (ax + bx) / 2, my = (ay + by) / 2;
                    add(Math.min(ax, bx) - 6, Math.min(ay, by) - 6, Math.max(ax, bx) + 6, Math.max(ay, by) + 6); add(mx - 85, my, mx + 85, my + 30); }
                if (bx0 === Infinity) return;
                const L = 8, R2 = W - 8, Tp = inT - 20, Bt = H - inB - 6;
                if (bx0 >= L && bx1 <= R2 && by0 >= Tp && by1 <= Bt) return;
                const fits = (bx1 - bx0) <= (R2 - L) && (by1 - by0) <= (Bt - Tp);
                if (shiftFirst && fits) {
                    // slide the view (not the zoom) until the goals are on the panel
                    const dx = bx0 < L ? L - bx0 : bx1 > R2 ? R2 - bx1 : 0, dy = by0 < Tp ? Tp - by0 : by1 > Bt ? Bt - by1 : 0;
                    q.rcx -= dx / q.scale; q.rcy -= dy / q.scale;
                    continue;
                }
                q.scale *= 0.94;
            }
        };
        // The whole view: the fit, then the label check — VenueDoc's, the same one the editor's preview
        // guide runs, so the guide is exactly what this board can show. (A course with no document keeps
        // the local check.)
        if (window.VenueDoc && VenueDoc.previewWholeFit && state.course.doc) {
            const w = VenueDoc.previewWholeFit(pts, VenueDoc.previewGoals(null, state.course), rot, VenueDoc.previewPanel(W, H, inB));
            v.scale = w.scale; v.rcx = w.rcx; v.rcy = w.rcy;
        } else fitMinimum(v, false);
        const whole = { scale: v.scale, rcx: v.rcx, rcy: v.rcy };
        // The limit, EXACT (no nudging, so a zoom-out at the stop never jiggles): scale between the
        // whole view's and 6x it, and the view's visible box inside the whole view's, in the turned frame.
        const clampV = (q) => {
            q.scale = Math.min(whole.scale * 6, Math.max(whole.scale, q.scale));
            const hx = W / 2 / whole.scale - W / 2 / q.scale;
            q.rcx = Math.min(whole.rcx + hx, Math.max(whole.rcx - hx, q.rcx));
            const top = whole.rcy - oy / whole.scale + oy / q.scale, bot = whole.rcy + (visH - oy) / whole.scale - (visH - oy) / q.scale;
            q.rcy = Math.min(bot, Math.max(top, q.rcy));
            return q;
        };
        if (view) { v.scale = view.scale; v.rcx = view.rcx; v.rcy = view.rcy; clampV(v); }
        return { v, rot, ca, sa, whole, clampV, projectV, invV };
    };
    // THE TURN: a venue's own, chosen once (VenueDoc.previewVenueTurn, on a reference panel) and used at
    // every size, so the map faces the same way on any screen and the editor's guide is one rectangle.
    // (A course with no document still picks per panel: upright unless a turn buys 12%.)
    let F;
    if (T.view && T.view.rot != null) F = frameFor(T.view.rot, T.view);
    else if (T.rot != null) F = frameFor(T.rot, null);
    else if (state.course.doc && window.VenueDoc && VenueDoc.previewVenueTurn) F = frameFor(VenueDoc.previewVenueTurn(state.course.doc), null);
    else {
        let bestScore = -1;
        for (let k = -6; k <= 6; k++) {
            const f = frameFor(k * Math.PI / 12, null);
            const sc = f.whole.scale * (k === 0 ? 1.12 : 1);
            if (sc > bestScore) { bestScore = sc; F = f; }
        }
    }
    const { v, rot, ca, sa, whole, clampV, projectV, invV } = F;
    const scale = v.scale, rcx = v.rcx, rcy = v.rcy;
    // world → panel, and back
    const S = projectV(v);
    const inv = invV(v);
    // The limits a live gesture needs, without a redraw.
    const clampScale = (sc) => Math.min(whole.scale * 6, Math.max(whole.scale, sc));
    const limit = (q) => clampV({ scale: q.scale, rcx: q.rcx, rcy: q.rcy });
    // The whole view's visible box in the world (for the board's backing bake)
    const IW = invV(whole), wc = [IW(0, 0), IW(W, 0), IW(0, visH), IW(W, visH)];
    const wholeBox = { x0: Math.min(...wc.map(p => p[0])), x1: Math.max(...wc.map(p => p[0])), y0: Math.min(...wc.map(p => p[1])), y1: Math.max(...wc.map(p => p[1])) };
    canvas._vmView = { scale, rcx, rcy, rot, fit: whole.scale, W, H, oy, limit, clampScale, wholeBox };
    canvas._vmViewFor = state.course;

    const dpr = window.devicePixelRatio || 1;
    // THE SWAP. Setting a canvas's size clears it, and the new picture would only land a frame later —
    // a blank flash. So the size is set only when it changes, the first frame is drawn before this
    // returns, and a NEW VENUE crossfades from a snapshot of the old one. A new view of the same venue
    // needs neither: the land is cached (vmLand) and everything over it is drawn live.
    const prevA = (_chartAnim.canvas === canvas && _chartAnim.ready && _chartAnim.inv) ? { course: _chartAnim.course, inv: _chartAnim.inv, comets: _chartAnim.comets } : null;
    let fadeFrom = null;
    if (canvas.width && canvas.height && prevA && prevA.course !== state.course) {
        fadeFrom = document.createElement('canvas'); fadeFrom.width = canvas.width; fadeFrom.height = canvas.height;
        fadeFrom.getContext('2d').drawImage(canvas, 0, 0);
    }
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); fadeFrom = null; }
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';



    // No wind or current badge: a venue-wide number misleads where the breeze and the stream
    // change across the water (Wes, Oct 4 2026). Hover the map instead — venueMapHover reads the
    // median wind and the current at the pointer.
    const curMax = (typeof courseCurrentMax === 'function') ? courseCurrentMax() : null;
    const hasCur = curMax != null && curMax >= 0.3;
    // THE COMPASS is not baked in: it is drawn over every frame (vmDrawCompass), so a pan or zoom
    // moves the map under it rather than carrying it off (Wes, Oct 5 2026).

    // ── THE LOOP: the cached land, the course and the comets, composed every frame (chartCometFrame) ──
    const A = _chartAnim;
    if (A.raf) { cancelAnimationFrame(A.raf); A.raf = 0; }
    A.ready = true; A.w = W; A.h = H; A.dpr = dpr; A.last = 0; A.course = state.course;
    A.view = { scale, rcx, rcy }; A.oy = oy; A.fit = whole.scale;
    vmLandEnsure(wholeBox, whole.scale * dpr);
    A.box = box; A.canvas = canvas;
    A.visible = T.visible || (() => UI.preRaceOverlay && !UI.preRaceOverlay.classList.contains('hidden'));
    A.inv = inv; A.S = S; A.rot = rot; A.scale = scale; A.T = T;
    A.compass = { x: W - 34, y: 37, rot };
    canvas._vm = { inv, rot, T };
    // The School's small preview stays a picture: no leg bar, no hover.
    if (!T.noRecords) venueMapHoverWire(inner, canvas);
    A.inT = inT; A.inB = inB;
    // The median field, sampled once per draw on a coarse panel grid the comets read every frame.
    const FC = 24, fw = Math.ceil(W / FC) + 1, fh = Math.ceil(H / FC) + 1, field = new Float32Array(fw * fh * 3);
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
        const [wx, wy] = inv(i * FC, j * FC);
        const w = venueMeanWindAt(wx, wy);
        const fx = -Math.sin(w.direction), fy = Math.cos(w.direction);
        const o = (j * fw + i) * 3;
        field[o] = fx * ca - fy * sa; field[o + 1] = fx * sa + fy * ca; field[o + 2] = w.speed;
    }
    A.field = { FC, fw, fh, data: field };
    // THE CURRENT VIEW (Wes, Oct 5 2026): the same comets, flown by the stream instead of the wind,
    // on a toggle. Sampled on the same grid at the map's tide clock (venueMapCurrentField), and
    // re-sampled through the cycle on a tidal venue.
    A.curField = null;
    if (hasCur && typeof getCurrentAt === 'function') {
        let period = 0;
        for (const r of (state.course.currentRegions || [])) period = Math.max(period, r.period || 0);
        // A finer grid than the wind's: a stream lives in channels a few px wide (Sockeye's river).
        const CF = 10, cw = Math.ceil(W / CF) + 1, chh = Math.ceil(H / CF) + 1;
        A.curField = { FC: CF, fw: cw, fh: chh, data: new Float32Array(cw * chh * 3), land: new Uint8Array(cw * chh), period, t0: state.time, clock: 0, sampled: -1,
                       ref: Math.max(0.6, (curMax || 0) * 0.5) };   // half the peak: most of a stream runs well below it
        for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
            const [wx, wy] = inv(i * CF, j * CF);
            A.curField.land[j * cw + i] = (typeof pointOnLand === 'function' && pointOnLand(wx, wy)) ? 1 : 0;
        }
        venueMapCurrentField(A.curField, 0);
    }
    if (!A.curField && _vmMode === 'current') _vmMode = 'wind';
    if (!T.noRecords) venueMapModeToggle(inner, !!A.curField);
    if (!T.noRecords && !T.box) venueMapTideSlider(inner);
    const count = Math.max(40, Math.min(220, Math.round(W * H / 2600)));
    // The same venue in a new view KEEPS its comets, carried to where they now are on the panel — a
    // pan's end is not a reason to restart the weather.
    if (prevA && prevA.course === state.course && prevA.comets) {
        A.comets = prevA.comets.slice(0, count);
        for (const cm of A.comets) { const [wx, wy] = prevA.inv(cm.x, cm.y); [cm.x, cm.y] = S(wx, wy); }
    } else A.comets = chartCometSeed(count);
    while (A.comets.length < count) A.comets.push(spawnChartComet());
    chartCometRelax(null);           // a zoom or a reset left them bunched or spread: even them out

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        for (const cm of A.comets) cm.age = cm.ttl / 2;
        vmComposeFrame(canvas.getContext('2d'), A.view, 0, null, true);
        return;
    }
    A.fade = fadeFrom ? { c: fadeFrom, t: 0 } : null;
    A.last = 0;
    chartCometFrame(performance.now());            // the new picture, now — no blank frame
}

// THE COURSE over the land — lines, gates, the finish, rounding marks and their numbers — drawn LIVE
// every frame from the view on screen (S: world → panel px), so a pan or zoom never waits on a bake
// and the labels stay crisp at any zoom.
function vmDrawCourse(ctx, S) {
    const route = state.course.route || [];
    // ── THE COURSE ──
    const marks = state.course.marks || [];
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // NO ROUTES (Wes, Oct 4 2026): the map shows the marks and gates and the water between them,
    // and the player chooses the way round. A drawn route — even several — reads as the answer.
    ctx.setLineDash([]);
    // Sailing order: every goal after the start is a numbered leg. A line remembers every pass
    // it serves, in order, and which one is the finish.
    const linePasses = {}, byMark = new Map();
    {
        let n = 0;
        for (const e of route) {
            if (e.role === 'start') continue;
            n++;
            if (e.kind === 'round' && e.mark) {
                const k = Math.round(e.mark.x / 40) + ',' + Math.round(e.mark.y / 40);
                const g = byMark.get(k) || { m: e.mark, nums: [], side: e.side || e.mark.side };
                g.nums.push(n); byMark.set(k, g);
            } else if (e.marks) {
                const k = e.marks.slice().sort().join('|');
                (linePasses[k] = linePasses[k] || []).push({ n, finish: !!e.finish });
            }
        }
    }
    const segs = new Map();
    for (const e of route) {
        if ((e.kind !== 'line' && e.kind !== 'gate') || !e.marks) continue;
        const key = e.marks.slice().sort().join('|');
        const g = segs.get(key) || { key, m1: marks[e.marks[0]], m2: marks[e.marks[1]], start: false, finish: false };
        if (e.role === 'start') g.start = true;
        if (e.finish) g.finish = true;
        segs.set(key, g);
    }
    const START_C = '#34d399', GATE_C = '#f2c14e', FINISH_C = '#ffffff';
    for (const g of segs.values()) {
        if (!g.m1 || !g.m2) continue;
        const [ax, ay] = S(g.m1.x, g.m1.y), [bx, by] = S(g.m2.x, g.m2.y);
        const passes = linePasses[g.key] || [];
        const gatePasses = passes.filter(p => !p.finish);
        // EVERY ROLE THE LINE PLAYS, said in its own colour (Wes, Oct 4 2026: on the lake the start
        // is also the finish and the old "START · GATE 3" hid it). The line itself carries them
        // too: a start's green, a gate's gold, and a finish's white dashes laid over either.
        const parts = [];
        if (g.start) parts.push(['START', START_C]);
        for (const p of gatePasses) parts.push([`GATE ${p.n}`, GATE_C]);
        if (g.finish) parts.push(['FINISH', FINISH_C]);
        const base = g.start ? START_C : gatePasses.length ? GATE_C : FINISH_C;
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(6,14,26,0.75)';
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = base;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        if (g.finish && base !== FINISH_C) {
            ctx.setLineDash([5, 5]); ctx.strokeStyle = FINISH_C;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
            ctx.setLineDash([]);
        } else if (g.finish) {
            // A finish alone: white and black, like the chequered flag.
            ctx.setLineDash([5, 5]); ctx.strokeStyle = '#0f172a';
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
            ctx.setLineDash([]);
        }
        for (const [x, y] of [[ax, ay], [bx, by]]) { ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fillStyle = base; ctx.fill(); }
        // The pill: each role in its colour, a dot between.
        ctx.font = '800 10px "Archivo", sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        const sep = ' · ', sepW = ctx.measureText(sep).width;
        const ws = parts.map(([t]) => ctx.measureText(t).width);
        const tw = ws.reduce((a, b) => a + b, 0) + sepW * (parts.length - 1) + 14;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        ctx.fillStyle = 'rgba(6,14,26,0.88)'; ctx.beginPath(); ctx.roundRect(mx - tw / 2, my + 10, tw, 17, 8.5); ctx.fill();
        let x = mx - tw / 2 + 7;
        parts.forEach(([t, c], i) => {
            if (i) { ctx.fillStyle = '#94a3b8'; ctx.fillText(sep, x, my + 19); x += sepW; }
            ctx.fillStyle = c; ctx.fillText(t, x, my + 19); x += ws[i];
        });
    }
    // Rounding marks, drawn like the race's goal chip (drawMarkEdgeIndicator): a port rounding
    // circles the mark counter-clockwise, a starboard one clockwise, arrowhead the way you go.
    for (const g of byMark.values()) {
        const [x, y] = S(g.m.x, g.m.y);
        ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fillStyle = 'rgba(6,14,26,0.85)'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = (typeof chipColorFor === 'function') ? chipColorFor(g.side) : '#22c55e'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
        if (g.side === 'port' || g.side === 'starboard') {
            const ccw = g.side === 'port';
            const a0 = ccw ? 0.9 : Math.PI - 0.9, a1 = ccw ? -Math.PI * 0.85 : Math.PI * 1.85;
            ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2.6;
            ctx.beginPath(); ctx.arc(x, y, 11, a0, a1, ccw); ctx.stroke();
            const tx = x + 11 * Math.cos(a1), ty = y + 11 * Math.sin(a1), tg = a1 + (ccw ? -Math.PI / 2 : Math.PI / 2);
            ctx.save(); ctx.translate(tx, ty); ctx.rotate(tg); ctx.fillStyle = '#22d3ee';
            ctx.beginPath(); ctx.moveTo(-3.5, -4); ctx.lineTo(4.5, 0); ctx.lineTo(-3.5, 4); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        const lbl = g.nums.join(' · ');
        ctx.font = '700 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(lbl).width + 10;
        ctx.fillStyle = 'rgba(6,14,26,0.88)'; ctx.beginPath(); ctx.roundRect(x - tw / 2, y - 33, tw, 16, 8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(lbl, x, y - 24.5);
    }

}

// The current at the preview's own tide clock, into the comet grid. state.time is borrowed and put
// straight back (courseCurrentMax does the same): the board does not advance the race.
function venueMapCurrentField(C, clock) {
    const t0 = state.time, A = _chartAnim, ca = Math.cos(A.rot || 0), sa = Math.sin(A.rot || 0);
    if (vmTidal()) return Tide.atPhase(vmTidePhase(), () => venueMapCurrentSample(C, ca, sa));
    state.time = C.t0 + (C.period > 0 ? (clock / TIDE_LOOP_S) * C.period : 0);
    try { venueMapCurrentSample(C, ca, sa); } finally { state.time = t0; }
}
function venueMapCurrentSample(C, ca, sa) {
    const A = _chartAnim;
    {
        for (let j = 0; j < C.fh; j++) for (let i = 0; i < C.fw; i++) {
            const k = j * C.fw + i, o = k * 3;
            if (C.land[k]) { C.data[o] = C.data[o + 1] = C.data[o + 2] = 0; continue; }
            const [wx, wy] = A.inv(i * C.FC, j * C.FC);
            const c = getCurrentAt(wx, wy);
            const sp = c ? c.speed : 0, d = c ? c.direction : 0;
            // `direction` is where the stream sets TOWARD
            const fx = Math.sin(d), fy = -Math.cos(d);
            C.data[o] = fx * ca - fy * sa; C.data[o + 1] = fx * sa + fy * ca; C.data[o + 2] = sp;
        }
    }
}

// Which flow the comets show: the median wind, or the current. Kept across venues; a venue with no
// current falls back to wind.
let _vmMode = 'wind';
function venueMapModeToggle(inner, hasCur) {
    let tg = inner.querySelector('.vm-toggle');
    if (!hasCur) { if (tg) tg.remove(); return; }
    if (!tg) {
        tg = document.createElement('div'); tg.className = 'vm-toggle';
        tg.addEventListener('click', (e) => {
            e.stopPropagation(); e.preventDefault();
            const b2 = e.target.closest('[data-mode]'); if (!b2) return;
            _vmMode = b2.dataset.mode;
            tg.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('sel', x.dataset.mode === _vmMode));
            for (const cm of _chartAnim.comets || []) { cm.age = cm.ttl; }   // respawn into the new flow
        });
        tg.addEventListener('mousemove', (e) => e.stopPropagation());
        inner.appendChild(tg);
    }
    tg.innerHTML = `<button type="button" data-mode="wind" class="${_vmMode === 'wind' ? 'sel' : ''}">Wind</button>`
                 + `<button type="button" data-mode="current" class="${_vmMode === 'current' ? 'sel' : ''}">Current</button>`;
}

// The flow at a panel point, already turned into the panel's frame: the median wind (A.field) or
// the current (A.curField), by the toggle.
function chartWindAt(sx, sy) {
    const A = _chartAnim, cur = _vmMode === 'current' && A.curField;
    const F = cur ? A.curField : A.field;
    // BILINEAR between grid points, so a comet's heading turns smoothly instead of snapping as it
    // crosses into the next cell (Wes, Oct 5 2026).
    const gx = Math.max(0, Math.min(F.fw - 1.001, sx / F.FC)), gy = Math.max(0, Math.min(F.fh - 1.001, sy / F.FC));
    const i = Math.floor(gx), j = Math.floor(gy), ux = gx - i, uy = gy - j;
    const o00 = (j * F.fw + i) * 3, o10 = o00 + 3, o01 = o00 + F.fw * 3, o11 = o01 + 3, D = F.data;
    const bl = (k) => (D[o00 + k] * (1 - ux) + D[o10 + k] * ux) * (1 - uy) + (D[o01 + k] * (1 - ux) + D[o11 + k] * ux) * uy;
    let fx = bl(0), fy = bl(1);
    const m = Math.hypot(fx, fy); if (m > 1e-6) { fx /= m; fy /= m; }
    const kt = bl(2);
    // knots to panel px/s: the stream is a tenth of the wind's speed, so it is drawn ~10x faster
    return cur ? { fx, fy, px: 5 + Math.min(55, (kt / (F.ref || 3)) * 45), kt, cur: true }
               : { fx, fy, px: 8 + Math.min(80, kt * 3.4), kt, cur: false };
}

// Where a comet is born: anywhere for the wind; in the current view, on water that is moving —
// on a river most of the panel is land, and comets born there showed nothing.
// Where a comet is born. EVENLY (Wes, Oct 6 2026): uniform random spots clump — three streaks in one
// patch, none in the next — so a rebirth draws CANDIDATES and takes the one farthest from every other
// comet (best-candidate sampling, as the race's comet field does), and the first population is laid on
// a jittered grid (chartCometSeed). In the current view a candidate must also be on moving water — on
// a river most of the panel is land, and comets born there showed nothing.
const CHART_COMET_CANDIDATES = 10;
// Comets live in the frame of the view they were sampled in (A.view). A gesture `g` maps that frame to
// the screen by a similarity (k, tx, ty); null is the identity.
const cmScreen = (g, x, y) => g ? [g.k * x + g.tx, g.k * y + g.ty] : [x, y];
const cmAnchor = (g, X, Y) => g ? [(X - g.tx) / g.k, (Y - g.ty) / g.k] : [X, Y];
function chartCometSpot(self, g) {
    const A = _chartAnim, others = A.comets || [];
    const ok = (x, y) => !(_vmMode === 'current' && A.curField) || chartWindAt(x, y).kt >= 0.15;
    let best = null, bestD = -1;
    for (let c = 0, tries = 0; c < CHART_COMET_CANDIDATES && tries < 160; tries++) {
        const X = fxRand() * A.w, Y = fxRand() * A.h, [x, y] = cmAnchor(g, X, Y);
        if (!ok(x, y)) continue;
        c++;
        let d = Infinity;
        for (const o of others) { if (o === self) continue; const [ox, oy] = cmScreen(g, o.x, o.y), dd = (ox - X) ** 2 + (oy - Y) ** 2; if (dd < d) d = dd; }
        if (d > bestD) { bestD = d; best = [x, y]; }
    }
    return best || cmAnchor(g, fxRand() * A.w, fxRand() * A.h);
}
// KEEP THEM EVEN through a zoom (Wes, Oct 6 2026: "when you zoom the placement looks off"). Comets ride
// the map, so a zoom in spreads them and pushes most off the panel, and a zoom out squeezes them into
// the middle. Each call looks at `n` comets (all of them when n is omitted): one off the panel, or with
// a neighbour closer than half the even spacing, is reborn at the emptiest spot, fading in.
function chartCometRelax(g, n) {
    const A = _chartAnim, C = A.comets || []; if (!C.length) return;
    const sp = Math.sqrt(A.w * A.h / C.length), near = (0.5 * sp) ** 2, M = 18;
    // every comet off the panel (cheap to find, and a fast zoom pushes half of them out at once), then
    // `n` more at random for the neighbour test
    const off = C.filter(cm => { const [X, Y] = cmScreen(g, cm.x, cm.y); return X < -M || X > A.w + M || Y < -M || Y > A.h + M; });
    const pick = n == null ? C.slice().sort(() => fxRand() - 0.5) : off.concat(Array.from({ length: Math.min(n, C.length) }, () => C[Math.floor(fxRand() * C.length)]));
    for (const cm of pick) {
        const [X, Y] = cmScreen(g, cm.x, cm.y);
        let bad = X < -M || X > A.w + M || Y < -M || Y > A.h + M;
        if (!bad) for (const o of C) { if (o === cm) continue; const [ox, oy] = cmScreen(g, o.x, o.y); if ((ox - X) ** 2 + (oy - Y) ** 2 < near) { bad = true; break; } }
        if (bad) { [cm.x, cm.y] = chartCometSpot(cm, g); cm.age = 0; cm.ttl = 1.8 + fxRand() * 2.2; }
    }
}
// The first population: one comet per cell of a grid as fine as the count, jittered within its cell,
// ages spread so they do not all fade in together.
function chartCometSeed(count) {
    const A = _chartAnim, out = [];
    const cols = Math.max(1, Math.round(Math.sqrt(count * A.w / A.h))), rows = Math.max(1, Math.ceil(count / cols));
    const cw = A.w / cols, chh = A.h / rows;
    const cells = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cells.push([i, j]);
    for (let k = cells.length - 1; k > 0; k--) { const r = Math.floor(fxRand() * (k + 1)); [cells[k], cells[r]] = [cells[r], cells[k]]; }
    for (const [i, j] of cells.slice(0, count)) {
        const cm = spawnChartComet();
        let x = (i + 0.15 + fxRand() * 0.7) * cw, y = (j + 0.15 + fxRand() * 0.7) * chh;
        if (_vmMode === 'current' && A.curField && chartWindAt(x, y).kt < 0.15) [x, y] = chartCometSpot(cm);
        cm.x = x; cm.y = y;
        out.push(cm);
        A.comets = out;               // later picks see the ones already placed
    }
    return out;
}
function spawnChartComet() {
    const A = _chartAnim;
    const [sx0, sy0] = chartCometSpot();
    const cm = { x: sx0, y: sy0,
                 ttl: 1.8 + fxRand() * 2.2, age: fxRand() * 1.8,   // desynced fades
                 jit: 0.75 + fxRand() * 0.5 };                     // per-comet size character
    const lw = chartWindAt(cm.x, cm.y);
    cm.fx = lw.fx; cm.fy = lw.fy; cm.kt = lw.kt; cm.cur = lw.cur;
    return cm;
}

// THE STREAK IS THE ANEMOMETER, in the race's own colours: streakColorFor maps knots to the
// same ice → white → cream → gold → amber → red the comets wear on the water, so a gold
// streak here is the gold one out there. Larger than the race's (Wes, Oct 5 2026) — this is the
// map's one moving thing and must read over any water. The CURRENT view flies cyan comets whose
// length and weight follow the stream's knots; slack water shows none.
function drawChartComet(ctx, cm, g) {
    const env = Math.sin(Math.PI * Math.min(1, cm.age / cm.ttl));
    const kt = cm.kt || 0;
    let col, a, len, lw, head = 1;
    if (cm.cur) {
        if (kt < 0.1) return;
        // Scaled to this venue's strongest stream, so a 0.5 kt harbour drift still reads; the
        // hover gives the knots.
        const ref = (_chartAnim.curField && _chartAnim.curField.ref) || 3;
        const u = Math.min(1, kt / ref);
        col = [Math.round(120 - 90 * u), Math.round(235 - 25 * u), 255];
        a = env * Math.min(0.95, 0.6 + u * 0.35);
        len = cm.jit * (20 + u * 42);
        lw = 2 + u * 2.6;
    } else {
        col = (typeof streakColorFor === 'function') ? streakColorFor(kt) : [235, 245, 255];
        a = env * Math.min(0.95, 0.5 + kt * 0.02);
        // a longer tail and a quieter head (Wes, Oct 6 2026): the streak carries the direction, the
        // head only says which end leads
        len = cm.jit * Math.min(110, 26 + kt * 3.3);
        lw = Math.min(4.5, 2.2 + kt * 0.08);
        head = 0.55;
    }
    if (a <= 0.01) return;
    // THE TAIL FOLLOWS THE FLOW: traced back upstream from the head in short steps through the
    // field, so it bends round a headland the way the air or the water does, instead of a straight
    // stroke along the head's heading. Tapered from the head's width to a point, fading as it goes.
    // traced through the field in the comet's own frame, drawn on screen: its length is screen px at
    // any zoom, and mid-gesture the tail still bends where the air does
    const gk = g ? g.k : 1, N = 10, step = len / N / gk, pts = [cmScreen(g, cm.x, cm.y)];
    let x = cm.x, y = cm.y;
    for (let k = 0; k < N; k++) {
        const f = chartWindAt(x, y);
        x -= f.fx * step; y -= f.fy * step;
        pts.push(cmScreen(g, x, y));
    }
    const hw = lw / 2;
    for (let k = 0; k < N; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
        let dx = x1 - x0, dy = y1 - y0; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        const w0 = hw * (1 - k / N), w1 = hw * (1 - (k + 1) / N);
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(a * (1 - k / N)).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x0 - dy * w0, y0 + dx * w0); ctx.lineTo(x1 - dy * w1, y1 + dx * w1);
        ctx.lineTo(x1 + dy * w1, y1 - dx * w1); ctx.lineTo(x0 + dy * w0, y0 - dx * w0);
        ctx.closePath(); ctx.fill();
    }
    // the head: the tail's blunt end, rounded
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(a * head).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], hw * (head < 1 ? 0.85 : 1), 0, Math.PI * 2); ctx.fill();
}

// Self-terminating: the loop lives only while its surface is up and showing.
function chartCometFrame(ts) {
    const A = _chartAnim;
    const canvas = A.canvas;
    const up = A.visible ? A.visible() : false;
    if (!A.ready || !canvas || !up || !canvas.isConnected) { A.raf = 0; return; }
    const dt = A.last ? Math.min(0.05, (ts - A.last) / 1000) : 0.016;
    A.last = ts;
    const moving = venueMapStepMotion(dt);
    if (moving === 'baked') return;              // settled: drawCourseMiniMap re-anchored and drew
    if (!moving) A.gesture = null;
    const g = moving ? A.gesture : null;
    vmComposeFrame(canvas.getContext('2d'), g ? g.view : A.view, dt, g, false);
    // At rest, sharpen: paint one missing land tile a frame (vmLandWork), never mid-motion.
    if (moving) _vmLand.idleSince = performance.now();
    else vmLandWork();
    A.raf = requestAnimationFrame(chartCometFrame);
}
// ONE FRAME: the land from the cache at `view`, the course over it, the comets (anchored to A.view and
// carried by the gesture's similarity while it lasts), a venue switch's crossfade, the compass.
function vmComposeFrame(ctx, view, dt, g, still) {
    const A = _chartAnim;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    vmLandDraw(ctx, view);
    ctx.setTransform(A.dpr, 0, 0, A.dpr, 0, 0);
    vmDrawCourse(ctx, vmProject(view));
    // the hover readout reads the view on screen, mid-zoom too
    if (A.canvas && A.canvas._vm && g) { const ca = Math.cos(A.rot), sa = Math.sin(A.rot);
        A.canvas._vm.inv = (sx, sy) => { const rx = (sx - A.w / 2) / view.scale + view.rcx, ry = (sy - A.oy) / view.scale + view.rcy; return [rx * ca + ry * sa, -rx * sa + ry * ca]; }; }
    if (still) { ctx.setTransform(A.dpr, 0, 0, A.dpr, 0, 0); for (const cm of A.comets) drawChartComet(ctx, cm); }
    else chartCometsStep(ctx, dt, g);
    if (g) A.fade = null;
    if (A.fade) {
        A.fade.t += dt;
        const a = 1 - A.fade.t / 0.22;
        if (a <= 0) A.fade = null;
        else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a * a; ctx.drawImage(A.fade.c, 0, 0); ctx.globalAlpha = 1; }
    }
    vmDrawCompass(ctx);
}
// world → panel px for a view at the map's turn
function vmProject(v) {
    const A = _chartAnim, ca = Math.cos(A.rot), sa = Math.sin(A.rot);
    return (x, y) => { const rx = x * ca - y * sa, ry = x * sa + y * ca; return [A.w / 2 + (rx - v.rcx) * v.scale, A.oy + (ry - v.rcy) * v.scale]; };
}

// ── THE TIDE SLIDER (Wes, Oct 7 2026) ──
// On a tidal venue the board's map takes a slider through the tide's CYCLE — low water, flood, high, ebb,
// low — and everything on the map follows that one moment: the land is repainted at its level
// (Tide.setChartLevel, the chart's own) and the current comets show its stream, flooding or ebbing
// (Tide.atPhase, a scoped clock the race never sees). A level alone would not do: the same level comes
// twice a cycle, once with the stream running in and once running out. Per venue; starts at mid-flood.
const _vmTide = { venue: null, phase: 0.25, timer: 0 };
function vmTidal() { const T = state.tide; return !!(T && T.amp > 0 && window.Tide && Tide.setChartLevel && Tide.atPhase); }
function vmTidePhase() {
    if (!vmTidal() || !state.course) return null;
    if (_vmTide.venue !== state.course.venueKey) { _vmTide.venue = state.course.venueKey; _vmTide.phase = 0.25; }
    return _vmTide.phase;
}
function vmTideLevel() { const s = vmTidePhase(); return s == null ? null : Tide.levelAtPhase(s); }
const VM_TIDE_NAMES = ['Low water', 'Flood', 'High water', 'Ebb', 'Low water'];
function vmTideName(s) { const k = Math.round(s * 4); return Math.abs(s * 4 - k) < 0.12 ? VM_TIDE_NAMES[k] : (s < 0.5 ? 'Flood · rising' : 'Ebb · falling'); }
function venueMapTideSlider(inner) {
    let el = inner.querySelector('.vm-tide');
    if (!vmTidal()) { if (el) el.remove(); return; }
    vmTidePhase();
    if (!el) {
        el = document.createElement('div'); el.className = 'vm-tide';
        el.innerHTML = `<div class="vm-tide-top"><span class="t-label t-label-xs vm-tide-k">Tide</span><span class="t-label t-label-xs vm-tide-now"></span></div>`
            + `<input type="range" class="vm-tide-range" min="0" max="1" step="0.005">`
            + `<div class="vm-tide-ticks t-label">${['Low', 'Flood', 'High', 'Ebb', 'Low'].map(n => `<span>${n}</span>`).join('')}</div>`;
        for (const ev of ['pointerdown', 'mousemove', 'wheel', 'dblclick']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
        const r = el.querySelector('input');
        r.addEventListener('input', () => {
            _vmTide.phase = +r.value;
            el.querySelector('.vm-tide-now').textContent = vmTideName(_vmTide.phase);
            // the stream follows at once; the land is repainted at most every 120 ms while dragging
            const C = _chartAnim.curField; if (C) venueMapCurrentField(C, 0);
            if (!_vmTide.timer) _vmTide.timer = setTimeout(() => { _vmTide.timer = 0; _drawBoardMap(); }, 120);
        });
        inner.appendChild(el);
    }
    const r = el.querySelector('input');
    if (document.activeElement !== r) r.value = String(_vmTide.phase);
    el.querySelector('.vm-tide-now').textContent = vmTideName(_vmTide.phase);
}

// ── THE LAND CACHE (Wes, Oct 5 2026: "prerender, then pan around with the wind and current on top") ──
// The land never changes while a venue is on the board, so it is painted ONCE per zoom level and only
// composited after that. Level 0 is the whole view (wholeBox) at the fit's resolution, painted with the
// venue and always there, so nothing is ever blank; levels 1 and 2 are the same area at 2x and 4x.
// WHOLE IMAGES, NOT TILES: the painter sizes its depth band and waterlines to the picture it paints and
// measures the distance to shore only inside it, so tiles each shaded the water their own way and met
// in visible seams. A whole level matches the base exactly. Painted at rest only (0.15-0.6 s, once per
// venue): level 1 in the background a moment after the venue settles, level 2 the first time a zoom
// asks for it. Until then the next level down stands in, a little soft.
const VM_LEVELS = 2, VM_LAND_MAX = 4096, VM_PREFILL_MS = 700;
const _vmLand = { key: '', course: null, x0: 0, y0: 0, side: 0, p0: 0, lv: [], want: 0, idleSince: 0 };
function vmLandPaint(minX, minY, side, N) {
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const p0 = state.boats[0], keep = p0 && { x: p0.x, y: p0.y };
    if (p0) { p0.x = 1e9; p0.y = 1e9; }   // parked off the paint, whatever drawMinimap decides to draw
    drawMinimap.target = { ctx: c.getContext('2d'), terrainOnly: true, extent: { minX, maxX: minX + side, minY, maxY: minY + side } };
    const tl = vmTideLevel();
    if (tl != null && window.Tide && Tide.setChartLevel) Tide.setChartLevel(tl);
    try { drawMinimap(); } catch (e) { /* a map without terrain still shows the course */ }
    finally { drawMinimap.target = null; if (p0) { p0.x = keep.x; p0.y = keep.y; } if (window.Tide && Tide.setChartLevel) Tide.setChartLevel(null); }
    return c;
}
function vmLandEnsure(B, p0) {
    if (!B) return;
    const side = Math.max(B.x1 - B.x0, B.y1 - B.y0), cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2;
    const tl = vmTideLevel();
    const key = [state.course && state.course.venueKey, Math.round(cx), Math.round(cy), Math.round(side), p0.toFixed(4), tl == null ? '' : tl.toFixed(2)].join('|');
    const L = _vmLand;
    if (L.key === key && L.course === state.course) return;
    L.key = key; L.course = state.course; L.want = 0; L.idleSince = performance.now();
    L.x0 = cx - side / 2; L.y0 = cy - side / 2; L.side = side; L.p0 = p0;
    L.lv = [vmLandPaint(L.x0, L.y0, side, vmLandSize(0))];
}
function vmLandSize(l) { return Math.max(64, Math.min(VM_LAND_MAX, Math.ceil(_vmLand.side * _vmLand.p0 * 2 ** l))); }
// The level a view wants: used up to 1.5x its own resolution (a 6x zoom draws 4x), so the biggest
// level paints half as many pixels for a softness the eye does not find at rest.
function vmLandLevel(v) {
    const need = v.scale * _chartAnim.dpr / _vmLand.p0;
    return need <= 1.2 ? 0 : Math.max(1, Math.min(VM_LEVELS, Math.ceil(Math.log2(need / 1.5))));
}
function vmLandDraw(ctx, v) {
    const A = _chartAnim, L = _vmLand, d = A.dpr, c = Math.cos(A.rot), sn = Math.sin(A.rot);
    const pal = (state.course.doc && state.course.doc.palette) || {};
    ctx.fillStyle = pal.baseColor || '#1f6f95';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!L.lv[0]) return;
    ctx.setTransform(d * v.scale * c, d * v.scale * sn, -d * v.scale * sn, d * v.scale * c,
                     d * (A.w / 2 - v.rcx * v.scale), d * (A.oy - v.rcy * v.scale));
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const want = vmLandLevel(v);
    let l = want; while (l > 0 && !L.lv[l]) l--;
    ctx.drawImage(L.lv[l], L.x0, L.y0, L.side, L.side);
    L.want = L.lv[want] ? 0 : want;
}
// At rest: paint the level the view wants, or — once the venue has been still a moment — level 1 ahead
// of the first zoom. One level a call; returns true when it painted.
function vmLandWork() {
    const L = _vmLand, now = performance.now();
    let l = L.want;
    if (!l && !L.lv[1] && L.lv[0] && now - L.idleSince > VM_PREFILL_MS) l = 1;
    if (!l || L.lv[l]) return false;
    L.lv[l] = vmLandPaint(L.x0, L.y0, L.side, vmLandSize(l));
    L.want = 0;
    return true;
}
// THE COMPASS: a needle, white to north and red to south (Wes), turned with the map — in the panel's
// own frame, over everything, so it stays in its corner while the map pans and zooms beneath it.
function vmDrawCompass(ctx) {
    const A = _chartAnim, K = A.compass; if (!K) return;
    ctx.setTransform(A.dpr, 0, 0, A.dpr, 0, 0);
    const nx = K.x, ny = K.y, rot = K.rot;
    ctx.fillStyle = 'rgba(6,14,26,0.84)'; ctx.beginPath(); ctx.arc(nx, ny, 21, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(203,213,225,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    const dx = Math.sin(rot), dy = -Math.cos(rot), px = -dy, py = dx, L = 15, Wd = 5;
    ctx.beginPath(); ctx.moveTo(nx + dx * L, ny + dy * L); ctx.lineTo(nx + px * Wd, ny + py * Wd); ctx.lineTo(nx - px * Wd, ny - py * Wd); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(nx - dx * L, ny - dy * L); ctx.lineTo(nx + px * Wd, ny + py * Wd); ctx.lineTo(nx - px * Wd, ny - py * Wd); ctx.closePath();
    ctx.fillStyle = '#ef4444'; ctx.fill();
    ctx.beginPath(); ctx.arc(nx, ny, 1.8, 0, Math.PI * 2); ctx.fillStyle = '#0f172a'; ctx.fill();
    ctx.font = '800 9px "Archivo", sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', nx + dx * 29, ny + dy * 29);
}
// The comets live in the frame of the view they were sampled in (A.view). Mid-gesture they are CARRIED
// by the gesture's similarity `g` (k, tx, ty): their positions move with the map, their size does not —
// scaled with it, a 6x zoom drew them as six-times-fat streaks.
function chartCometsStep(ctx, dt, g) {
    const A = _chartAnim;
    ctx.setTransform(A.dpr, 0, 0, A.dpr, 0, 0);
    const C = A.curField;
    if (C && C.period > 0 && !vmTidal()) {
        C.clock = (C.clock + dt) % TIDE_LOOP_S;
        const q = Math.floor(C.clock * 4);   // a tidal field re-samples four times a second
        if (q !== C.sampled) { C.sampled = q; venueMapCurrentField(C, C.clock); }
    }
    const M = 18, k = g ? g.k : 1;   // wrap margin: a comet leaves fully before it re-enters fully
    if (g) chartCometRelax(g, 12);   // mid-gesture, a dozen a frame keeps the spread even
    for (const cm of A.comets) {
        const lw = chartWindAt(cm.x, cm.y);
        cm.fx = lw.fx; cm.fy = lw.fy; cm.kt = lw.kt; cm.cur = lw.cur;
        // the drift is in SCREEN px a second, whatever the zoom
        cm.x += lw.fx * lw.px * dt / k;
        cm.y += lw.fy * lw.px * dt / k;
        cm.age += dt;
        // A current comet that drifts off the moving water (onto land, into slack) is reborn on
        // it: a narrow river would otherwise empty in a second.
        if (lw.cur && lw.kt < 0.1 && cm.age > 0.2) cm.age = cm.ttl + 1;
        if (!g) {
            if (cm.x < -M) cm.x += A.w + 2 * M; else if (cm.x > A.w + M) cm.x -= A.w + 2 * M;
            if (cm.y < -M) cm.y += A.h + 2 * M; else if (cm.y > A.h + M) cm.y -= A.h + 2 * M;
        }
        if (cm.age > cm.ttl) {
            cm.age = 0;
            cm.ttl = 1.8 + fxRand() * 2.2;
            [cm.x, cm.y] = chartCometSpot(cm, g);
            cm.jit = 0.75 + fxRand() * 0.5;
        }
        drawChartComet(ctx, cm, g);
    }
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
    if (window.Series && Series.locked()) { showToast(`Your skipper is locked for the ${Series.active.kind}`); return; }
    const grid = UI.characterPicker.querySelector('#character-grid');
    // Unhide BEFORE filling it: `renderProfileBoat` measures its parent, and a display:none
    // grid measures zero — which would shrink every boat to the 104px floor.
    UI.characterPicker.classList.remove('hidden');
    grid.innerHTML = '';
    // Yours first, A to Z; then every character with a written achievement you have not
    // earned yet, as a silhouette. Characters with no achievement yet are not on the board.
    const all = charactersAlphabetical();
    const open = window.Unlocks ? all.filter(c => Unlocks.isUnlocked(c.name)) : all;
    const toEarn = window.Unlocks ? all.filter(c => !Unlocks.isUnlocked(c.name) && Unlocks.gated(c.name)) : [];   // all from AI_CONFIG, so shipped
    // Both halves of the board carry a count, so it reads as N yours and M still to earn.
    const labelRow = (text, top) => { const head = document.createElement('div'); head.style.cssText = `grid-column:1/-1; margin-top:${top}px;`;
        head.innerHTML = `<div class="t-label" style="font-size:11px; letter-spacing:0.22em; color:#8fa3bd;">${text}</div>`; grid.appendChild(head); };
    labelRow(`Yours · ${open.length}`, 0);
    for (const cfg of open) {
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
    if (toEarn.length) {
        labelRow(`Still to earn · ${toEarn.length}`, 14);
        const career = Unlocks.career();
        for (const cfg of toEarn) {
            const cell = document.createElement('div');
            cell.dataset.char = cfg.name;
            cell.dataset.locked = '1';
            cell.innerHTML = lockedBandHTML(Unlocks.achievementFor(cfg.name), cfg, career);
            grid.appendChild(cell);
        }
    }
}

// A character you have not earned: their portrait as a silhouette, the achievement's title
// where the name goes, and the way to earn it. No boat, no colours — the livery is part of
// the reveal.
function lockedBandHTML(ach, cfg, career) {
    const prog = ach.progress ? ach.progress(career) : null;
    const progLine = prog ? `<span class="t-mono" style="color:#f2c14e; margin-left:8px;">${Math.min(prog[0], prog[1])} / ${prog[1]}</span>` : '';
    return `
        <div class="rounded-xl overflow-hidden border border-white/10 relative" style="background:linear-gradient(105deg, #1c2638 0%, #141d2d 60%, rgba(15,23,42,0.92) 100%);">
            <div class="flex items-center relative" style="gap:20px;">
                <img src="assets/images/competitors/${cfg.name.toLowerCase()}.png" alt="" class="object-cover shrink-0" draggable="false"
                     style="width:128px; height:128px; filter:brightness(0) opacity(0.55);">
                <div style="padding:16px 16px 16px 0; min-width:0;">
                    <div class="t-label" style="font-size:10.5px; letter-spacing:0.22em; color:#66748c;">&#128274; Locked</div>
                    <div class="t-display uppercase leading-tight" style="font-size:26px; color:#c4d2e6; margin-top:2px;">${ach.title}</div>
                    <div style="font-size:14px; font-weight:700; color:#9fb2cc; margin-top:4px;">${Unlocks.hintOf(ach)}${progLine}</div>
                </div>
            </div>
        </div>`;
}

// ── THE UNLOCK CEREMONY ─────────────────────────────────────────────────────────
// Every unlock is granted the moment it is earned (Unlocks.poll); the cards present one at
// a time, weakest to strongest, over whatever screen is up. Past four in one go, the weakest
// collapse into one "+N more" card that goes first, and the last card offers the picker.
const UNLOCK_CARDS_MAX = 4;
let _unlockQueue = null;
function presentUnlocks() {
    if (!window.Unlocks || _unlockQueue) return;
    const names = Unlocks.unseen();
    if (!names.length) return;
    const shown = names.length > UNLOCK_CARDS_MAX + 1 ? names.slice(-UNLOCK_CARDS_MAX) : names;
    const rest = names.filter(n => !shown.includes(n));
    // The strongest go last; the "+N more" card collects the weakest, and sits before them.
    _unlockQueue = { cards: rest.length ? [{ more: rest }, ...shown.map(n => ({ name: n }))] : shown.map(n => ({ name: n })), i: 0 };
    renderUnlockCard();
}
function renderUnlockCard() {
    const host = document.getElementById('unlock-screen');
    if (!host || !_unlockQueue) return;
    const q = _unlockQueue, card = q.cards[q.i];
    const total = q.cards.length, last = q.i === total - 1;
    const body = document.getElementById('unlock-body');
    const btn = document.getElementById('unlock-next');
    const count = document.getElementById('unlock-count');
    if (count) count.textContent = total > 1 ? `${q.i + 1} of ${total}` : '';
    const seeBtn = document.getElementById('unlock-see');
    if (card.more) {
        const faces = card.more.map(n => `<img src="assets/images/competitors/${n.toLowerCase()}.png" alt="${n}" title="${n}" style="width:64px;height:64px;border-radius:12px;background:rgba(255,255,255,0.06);">`).join('');
        body.innerHTML = `
            <div class="flex flex-wrap justify-center" style="gap:8px; margin-top:14px;">${faces}</div>
            <div class="t-display uppercase" style="font-size:32px; margin-top:14px;">+${card.more.length} more</div>
            <div style="font-size:14px; color:#9fb2cc; margin-top:6px;">${card.more.join(', ')} also joined the club.</div>`;
    } else {
        const cfg = AI_CONFIG.find(c => c.name === card.name);
        const ach = Unlocks.achievementFor(card.name);
        const band = cfg ? bandColorFor(cfg.hull, cfg.spinnaker) : '#1c2638';
        body.innerHTML = `
            <div class="rounded-xl" style="margin-top:14px; padding:14px 0 6px; background:linear-gradient(180deg, ${band} 0%, ${band}55 60%, transparent 100%);">
                <img src="assets/images/competitors/${card.name.toLowerCase()}.png" alt="${card.name}" draggable="false" style="width:190px;height:190px;margin:0 auto;display:block;">
            </div>
            <div class="t-display uppercase" style="font-size:40px; line-height:1; margin-top:8px;">${card.name}</div>
            ${cfg ? `<div class="t-mono" style="font-size:13px; color:#9fb2cc; margin-top:4px;">${cfg.creature}</div>` : ''}
            ${ach ? `<div class="t-display italic uppercase" style="font-size:19px; color:#f2c14e; margin-top:16px;">${ach.title}</div>
            <div style="font-size:14px; font-weight:700; color:#dce6f2; margin-top:4px;">${Unlocks.hintOf(ach)}</div>` : ''}
            <div style="font-size:12.5px; color:#7787a0; margin-top:12px;">Now in the picker, and racing against you from your next race.</div>`;
    }
    // The picker is offered once, on the last card of a pile — never earlier, where it would
    // skip the cards still to come.
    if (seeBtn) seeBtn.classList.toggle('hidden', !(last && total > 1));
    if (btn) btn.querySelector('span').textContent = last ? 'CONTINUE' : 'NEXT';
    host.classList.remove('hidden');
    if (window.confetti && !card.more) {
        try { confetti({ particleCount: 90, spread: 75, startVelocity: 38, origin: { y: 0.3 }, zIndex: 90 }); } catch (e) {}
    }
}
function advanceUnlockCard(openPicker) {
    const q = _unlockQueue;
    if (!q) return;
    const card = q.cards[q.i];
    Unlocks.markSeen(card.more ? card.more : [card.name]);
    q.i++;
    if (openPicker || q.i >= q.cards.length) {
        _unlockQueue = null;
        document.getElementById('unlock-screen').classList.add('hidden');
        if (openPicker) openCharacterPicker();
        return;
    }
    renderUnlockCard();
}
function unlockCeremonyOpen() { return !!_unlockQueue; }
(() => {
    const next = document.getElementById('unlock-next');
    if (next) next.addEventListener('click', (e) => { e.preventDefault(); advanceUnlockCard(false); });
    const see = document.getElementById('unlock-see');
    if (see) see.addEventListener('click', (e) => { e.preventDefault(); advanceUnlockCard(true); });
})();

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
    if (window.Series && Series.locked()) { closeCharacterPicker(); return; }
    settings.character = name;
    saveSettings();
    applyPlayerCharacter();
    closeCharacterPicker();
    renderCompetitorGrid();
    if (typeof refreshClubhouse === 'function') refreshClubhouse();   // the hub's skipper badge
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

    // The race's wind shadows, every wind angle it can swing to, built here behind the loading
    // card rather than mid-race (see leeWarm). Only a full build races; browsing never pays it.
    if (state.course.loadState === 'full' && typeof leeWarm === 'function') leeWarm();

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
    // The Race door remembers what was chosen HERE, on the board — never what a cup or
    // series put in `settings.venue` on its way through.
    if (!(window.Series && Series.active)) settings.lastRaceVenue = key;
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
    // Un-hide BEFORE rendering. The chart sizes itself from the briefing column, and a
    // display:none column measures zero: the chart then hides its own box and the resize
    // observer watching that box never wakes. Harmless while the board was the first
    // screen and always up; the clubhouse hub now hides it between visits (Sep 2026).
    if (UI.preRaceOverlay) UI.preRaceOverlay.classList.remove('hidden');
    renderVenuePicker();
    if (!UI.preRaceOverlay) return;
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
    // No changing skipper mid-cup: the fleet — you included — is what started race one.
    const seriesLocked = !!(window.Series && Series.locked());

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
            label: boat.isPlayer
                ? (seriesLocked ? `You <span class="pr-lock-pill">Locked for the ${Series.active.kind}</span>` : 'You <span class="pr-change-pill">Change</span>')
                : undefined
        });
        // YOUR badge is the way to change character — there is no header chip any more, and
        // your own badge has no scouting notes to open, so its click is free to mean the
        // one thing you would want from it.
        badge.addEventListener('click', () => boat.isPlayer
            ? (seriesLocked ? showToast(`Your skipper is locked for the ${Series.active.kind}`) : openCharacterPicker())
            : selectCompetitor(key));
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
    if (typeof hideClubhouseOverlays === 'function') hideClubhouseOverlays();
    // Starting race one of a cup or series is what locks the fleet: these nine, and you as
    // this skipper, race every venue in it. Nothing is locked before the gun.
    if (window.Series && Series.active && !Series.locked()) {
        Series.lockFleet(state.boats.filter(b => !b.isPlayer).map(b => b.name), settings.character);
    }
    // A new rival's promised races are spent here, at the gun — not when the fleet was drawn,
    // which also happens every time a venue is merely browsed.
    if (window.Unlocks && !(window.School && School.active)) Unlocks.onRaceStart(state.boats);
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
    // A character you have not earned (a save from before unlocks, or a new game) falls
    // back to the default skipper — or the first starter, if the default is ever earned too.
    if (window.Unlocks && !Unlocks.isUnlocked(settings.character)) {
        settings.character = Unlocks.isUnlocked(DEFAULT_SETTINGS.character) ? DEFAULT_SETTINGS.character : STARTING_TEN[0];
    }
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
    if (UI.settingAdaptiveAI) UI.settingAdaptiveAI.checked = settings.adaptiveAI !== false;
    if (UI.settingNavAids) UI.settingNavAids.checked = settings.navAids;
    if (UI.settingClockMillis) UI.settingClockMillis.checked = !!settings.clockMillis;
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
    const pre = (window.Series && Series.active) ? `${Series.active.name} · RACE ${Series.raceNumber()}/${Series.total()} · `.toUpperCase() : '';
    const venue = pre + (venueDisplayName(state.race.venue) || '').toUpperCase();
    const total = state.race.totalLegs;
    const leg = p ? p.raceState.leg : 0;
    if (!p || leg === 0) return `${venue} · PRESTART`;
    if (p.raceState.finished) return `${venue} · FINISHED`;
    return `${venue} · LEG ${Math.min(leg, total)}/${total} · <span style="color:#f2c14e">YOU'RE ${ordinalOf(fleetRank(p))}</span>`;
}

// What abandoning costs, in the race's own terms — the honest version of "are
// you sure?". Staying in the race is the default (and what ESC does).
function abandonContextLine() {
    // A cup or series is abandoned whole: no per-race retire, no restart, standings gone.
    if (window.Series && Series.active) {
        const s = Series.active, t = Series.total(), done = s.results.filter(Boolean).length;
        return `This ends the ${s.name} ${done ? `after race ${done} of ${t}` : `before race ${Series.raceNumber()} of ${t}`}. The standings won't be kept.`;
    }
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
        // The indicator overlay sits ABOVE this menu (z-65) and draw() stops while paused,
        // so whatever chips were on it would FREEZE over the menu. Clear it now.
        if (window._indCtx) window._indCtx.clearRect(0, 0, window._indCtx.canvas.width, window._indCtx.canvas.height);
        if (UI.pauseContext) UI.pauseContext.innerHTML = raceContextLine();
        // Sailing School wears the menu differently: a Skip to the next section (not on the
        // last one), and the red row leaves the school rather than abandoning a race.
        const school = !!(window.School && School.active);
        if (UI.skipButton) UI.skipButton.classList.toggle('hidden', !(school && School.canSkip()));
        const series = !school && !!(window.Series && Series.active);
        if (UI.abandonLabel) UI.abandonLabel.textContent = school ? 'LEAVE SCHOOL' : series ? `ABANDON ${Series.active.kind.toUpperCase()}` : 'ABANDON RACE';
        // No restarting a race inside a cup: abandoning ends the whole thing (Wes, Sep 4 2026).
        if (UI.restartButton) UI.restartButton.classList.toggle('hidden', series);
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
        const title = UI.abandonScreen.querySelector('.ov-title');
        if (title) title.textContent = (window.Series && Series.active) ? `Abandon ${Series.active.kind}?` : 'Abandon race?';
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
        toggleNewGame(false);
        state.paused = false;
        lastTime = 0;
    }
}

// NEW GAME. The confirm stacks over Settings; keeping your game is the default (and ESC).
function toggleNewGame(show) {
    if (!UI.newGameScreen) return;
    UI.newGameScreen.classList.toggle('hidden', !show);
}

// Everything a player EARNS lives under these keys; erasing them is a new game. Settings are
// preferences and stay — except who you sail as and which venue is up, which belong to the
// game you are leaving. Editor/scenario stores and the dev `regatta_record` flag are not
// the player's and are never touched.
// ⚠️ A NEW PERSISTED PROGRESS KEY MUST BE ADDED HERE, or it survives a new game.
function startNewGame() {
    const keys = [SCHOOL_PROGRESS_KEY, TROPHIES_KEY, RESULT_BESTS_KEY, RECORDS_KEY, 'regatta_venue_stats',
                  UNLOCKS_KEY, CAREER_KEY, GHOSTS_KEY];
    for (const k of keys) { try { localStorage.removeItem(k); } catch (e) {} }
    if (window.TimeTrial) { TimeTrial._ghost = null; TimeTrial._lb = null; }
    settings.character = window.Unlocks ? STARTING_TEN[0] : DEFAULT_SETTINGS.character;
    settings.venue = DEFAULT_SETTINGS.venue;
    settings.lastRaceVenue = DEFAULT_SETTINGS.lastRaceVenue;
    try { localStorage.setItem('regatta_settings', JSON.stringify(settings)); } catch (e) {}
    // Reload rather than unwind: the school, the shelf, the record book, the venue stats
    // and any cup in progress all hold in-memory copies, and a fresh page is the only
    // state that is certainly the same as a first visit.
    location.reload();
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
if (UI.abandonButton) UI.abandonButton.addEventListener('click', (e) => { e.preventDefault(); UI.abandonButton.blur(); if (window.School && School.active) { togglePause(false); School.exit(); } else toggleAbandon(true); });
if (UI.skipButton) UI.skipButton.addEventListener('click', (e) => { e.preventDefault(); UI.skipButton.blur(); if (window.School && School.active) { togglePause(false); School.skip(); } });
if (UI.abandonKeep) UI.abandonKeep.addEventListener('click', (e) => { e.preventDefault(); toggleAbandon(false); togglePause(false); });
if (UI.abandonConfirm) UI.abandonConfirm.addEventListener('click', (e) => { e.preventDefault(); toggleAbandon(false); if (window.Series && Series.active) Series.abandon(); restartRace(); });
if (UI.settingsButton) UI.settingsButton.addEventListener('click', (e) => { e.preventDefault(); toggleSettings(true); UI.settingsButton.blur(); });
if (UI.preRaceSettingsBtn) UI.preRaceSettingsBtn.addEventListener('click', (e) => { e.preventDefault(); toggleSettings(true); UI.preRaceSettingsBtn.blur(); });
if (UI.closeSettings) UI.closeSettings.addEventListener('click', () => toggleSettings(false));
if (UI.saveSettings) UI.saveSettings.addEventListener('click', () => toggleSettings(false));
if (UI.newGameButton) UI.newGameButton.addEventListener('click', (e) => { e.preventDefault(); UI.newGameButton.blur(); toggleNewGame(true); });
if (UI.newGameKeep) UI.newGameKeep.addEventListener('click', (e) => { e.preventDefault(); toggleNewGame(false); });
if (UI.newGameConfirm) UI.newGameConfirm.addEventListener('click', (e) => { e.preventDefault(); startNewGame(); });
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
// Inside a cup or series the same two buttons are "abandon" (behind the confirm) and
// "standings" — the results page never offers a rematch mid-series.
// A Race of ONE is a series of one underneath, but it reads as a single race: Back to Clubhouse and Rematch
// (the same fleet), no standings (Wes, Sep 27 2026).
const _oneRace = () => !!(window.Series && Series.active && Series.total() === 1);
function _closeOneRace() {
    if (!Series.active.results[0]) Series.recordRace(finishOrder());
    if (window.Unlocks) { Unlocks.flush(finishOrder()); presentUnlocks(); }
    Series.recordFinal();
}
if (UI.resultsRestartButton) UI.resultsRestartButton.addEventListener('click', (e) => { e.preventDefault();
    if (_oneRace()) { _closeOneRace(); Series.abandon(); restartRace(); }
    else if (window.Series && Series.active) toggleAbandon(true); else restartRace(); });
if (UI.resultsRematchButton) UI.resultsRematchButton.addEventListener('click', (e) => { e.preventDefault();
    if (_oneRace()) { const prev = Series.active; _closeOneRace(); Series.startSeries(prev.venues); if (prev.fleet) Series.lockFleet(prev.fleet, prev.character); rematchRace(); }
    else if (window.Series && Series.active) proceedToStandings(); else rematchRace(); });
if (UI.startRaceBtn) UI.startRaceBtn.addEventListener('click', (e) => { e.preventDefault(); startRace(); });
{
    // THE CLUBHOUSE DOORS (Sep 2026 redesign). The school is the front door until you
    // graduate; Cup and Series go through a picker; Race opens the board as it always was.
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', (e) => { e.preventDefault(); el.blur(); fn(e); }); };
    const idle = () => state.race.status === 'waiting' && !_venueLoading;
    // Time Trials is solo (TimeTrial.active); every other door races a fleet.
    on('door-school', () => { if (!idle()) return; TimeTrial.active = false; hideClubhouseOverlays(); School.begin(); });
    on('door-cup', () => { if (!idle()) return; TimeTrial.active = false; showCupPicker(); });
    on('door-series', () => { if (!idle()) return; TimeTrial.active = false; showSeriesPicker(true); });
    on('door-race', () => {
        if (!idle()) return;
        TimeTrial.active = true;
        if (window.Series && Series.active) Series.abandon();
        // The board opens on the venue the door was previewing — the last one picked HERE —
        // not on whatever venue the last cup or series race left in `settings.venue`.
        const lv = settings.lastRaceVenue;
        if (lv && VENUE_ORDER.includes(lv) && lv !== settings.venue) selectVenue(lv);
        else resetGame();   // send the fleet home: a time trial is solo
        showRaceBoard();
    });
    on('cup-back-btn', () => showClubhouse());
    on('series-back-btn', () => showClubhouse());
    // Leaving the board mid-cup is abandoning the cup, so it goes through the confirm.
    on('prerace-back-btn', () => { if (!idle()) return; if (window.Series && Series.active) toggleAbandon(true); else showClubhouse(); });
    on('series-redraw-btn', () => { _seriesDraw = Series.draw(_seriesLen); renderSeriesPicker(); });
    on('series-start-btn', () => { const v = _seriesChosen(); if (!idle() || !v.length) return; TimeTrial.active = false; Series.startSeries(v); _seriesDraw = null; enterSeriesRace(); });   // straight to the race 1 briefing, like a cup
    // The fleet page: back to where you chose, or on — a single race starts here, a cup or
    // series goes to its first briefing.
    on('fleet-back-btn', () => {
        if (!idle()) return;
        if (window.Series && Series.active && _fleetFrom !== 'board') { const k = Series.active.kind; Series.abandon(); if (k === 'cup') showCupPicker(); else showSeriesPicker(); }
        else showRaceBoard();
    });
    on('hub-skipper', () => { if (!idle()) return; openCharacterPicker(); });
    on('fleet-primary-btn', () => { if (!idle()) return; if (window.Series && Series.active) showRaceBoard(); else startRace(); });
    on('standings-abandon-btn', () => { if (!Series.active) return; if (Series.finished()) { Series.abandon(); restartRace(); } else toggleAbandon(true); });
    on('standings-next-btn', () => {
        if (!Series.active) return;
        if (Series.finished()) { const sr = Series.active; if (sr.kind === 'cup') Series.startCup(sr.id); else Series.startSeries(sr.venues); enterSeriesRace(); }
        else { Series.advance(); enterSeriesRace(); }
    });
    document.querySelectorAll('.js-open-settings').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); toggleSettings(true); b.blur(); }));
    window.__styleSchoolBtn = () => refreshClubhouse();   // School.exit() calls this by name
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
if (UI.settingAdaptiveAI) UI.settingAdaptiveAI.addEventListener('change', (e) => { settings.adaptiveAI = e.target.checked; saveSettings(); });
if (UI.settingNavAids) UI.settingNavAids.addEventListener('change', (e) => { settings.navAids = e.target.checked; saveSettings(); });
if (UI.settingClockMillis) UI.settingClockMillis.addEventListener('change', (e) => { settings.clockMillis = e.target.checked; saveSettings(); });
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

// ── RECORDS ARE SET IN SINGLE RACES, ON THE VENUE AS IT STANDS ────────────────────────
// (owner's call, Sep 13 2026.) A cup or series race sets nothing — the record book is a
// single-race pursuit — and neither does the school. Every key in BOTH stores (the
// personal-best store below and the record book after it) carries the venue's records
// hash (VenueDoc.recordsHash: the venue's physical content, not its copy or colours), so
// editing a venue retires its book. Old entries stay in storage under the old hash and
// come back if the edit is reverted. Pre-hash entries are simply never read again.
// SINCE SEP 27 2026 (Wes): only a TIME TRIAL sets anything — the records book, your best time and the ghost.
// A Race (even a Race of one), a Cup, the school and the eval harness set none of them.
function recordsEligible() {
    return !!(window.TimeTrial && TimeTrial.solo()) && state.boats.length === 1;
}
// Cached per venue on the document's identity: the game never edits a document in place,
// and hashing one is a canonical walk of ~10k props.
const _recordsHashCache = {};
function recordsVenueHash(venue) {
    const key = venue || settings.venue;
    const VD = window.VenueDoc;
    const doc = (VD && VD.get) ? VD.get(key) : null;
    const c = _recordsHashCache[key];
    if (c && c.doc === doc) return c.hash;
    const hash = (doc && VD.recordsHash) ? VD.recordsHash(doc) : 'r1-none';
    _recordsHashCache[key] = { doc, hash };
    return hash;
}

const RESULT_BESTS_KEY = 'regatta_bests';
function loadVenueBests() {
    try { return JSON.parse(localStorage.getItem(RESULT_BESTS_KEY)) || {}; } catch (e) { return {}; }
}
function venueBestKey(venue) { return `${venue || settings.venue}:${recordsVenueHash(venue)}:${state.race.totalLegs}`; }

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
    if (typeof rec === 'number') return { t: rec, bestPos: 0, bestPosT: 0, stars: 0 };
    if (!rec || (typeof rec.t !== 'number' && !rec.bestPos && !rec.stars)) return null;
    return {
        t: typeof rec.t === 'number' ? rec.t : null,   // null: raced here, never trialled (Sep 27 2026)
        bestPos: rec.bestPos || rec.pos || 0,
        bestPosT: rec.bestPosT || (rec.bestPos ? 0 : rec.t) || 0,
        stars: rec.stars || 0
    };
}

// Called once per race, from the first showResults() of that race — see `bestChecked`.
// Returns what there was to beat on each record, and whether this race beat it.
// SINCE SEP 27 2026 (Wes): the TIME is a Time Trials best — solo, against the clock — and the PLACE and the
// STARS come from racing the fleet (a Race or a Cup). The school sets neither.
function recordVenueBest(seconds, pos, stars) {
    if (window.School && School.active) return null;
    const trial = recordsEligible();
    if (trial) { pos = 0; stars = 0; }
    const bests = loadVenueBests();
    const key = venueBestKey();
    const prev = bestForVenue();
    const previous = prev ? prev.t : null;
    const previousPos = (prev && prev.bestPos) ? prev.bestPos : null;
    const previousStars = prev ? (prev.stars || 0) : 0;

    const isBest = trial && (previous === null || seconds < previous);
    const isBestPos = !!pos && (previousPos === null || pos < previousPos);
    const isBestStars = (stars | 0) > previousStars;
    if (isBest || isBestPos || isBestStars) {
        bests[key] = {
            t: isBest ? seconds : previous,
            bestPos: isBestPos ? pos : (previousPos || 0),
            bestPosT: isBestPos ? seconds : (prev ? prev.bestPosT : 0),
            stars: Math.max(previousStars, stars | 0)
        };
        // Same reasoning as saveSettings: a storage failure must not take the screen with
        // it. Losing a personal best is a nuisance; throwing here would blank the results.
        try { localStorage.setItem(RESULT_BESTS_KEY, JSON.stringify(bests)); } catch (e) { /* no store */ }
    }
    return { previous, isBest, previousPos, isBestPos, previousStars, isBestStars };
}

// ⚠️ DISTANCE SAILED IS ALREADY IN METRES. physics.js adds `speed × 12 × dt` to legDistances — the
// world-units-to-metres step (0.2 m a unit) is inside that 12 — and this used to divide by 5 AGAIN
// as if it were world units, so every distance on screen was a fifth of the truth: a 4.8 km course
// "sailed" in 1.2 km (Wes, Sep 27 2026: corrected everywhere; stored shortest tracks migrated ×5 on
// load, see loadAllRecords). unitsToKm stays for genuine world units.
function unitsToKm(u) { return u / 5 / 1000; }
function sailedKm(m) { return m / 1000; }

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
    let all;
    try { all = JSON.parse(localStorage.getItem(RECORDS_KEY)) || {}; } catch (e) { return {}; }
    // THE SHORTEST TRACKS WERE STORED A FIFTH SHORT (see sailedKm). Migrated once, in place.
    if (!all.__distV2) {
        for (const k of Object.keys(all)) { const b = all[k]; if (b && b.minDist && typeof b.minDist.d === 'number') b.minDist.d = Math.round(b.minDist.d * 5 * 100) / 100; }
        all.__distV2 = true;
        saveAllRecords(all);
    }
    return all;
}
function saveAllRecords(r) {
    // Same reasoning as saveSettings: a storage failure must not take the race with it.
    try { localStorage.setItem(RECORDS_KEY, JSON.stringify(r)); } catch (e) { /* no store */ }
}
function runTrimBoard(rs) { return (rs && rs.usedAutoTrim) ? 'auto' : 'manual'; }
function recordsBoardKey(board, venue, legs) {
    const v = venue || settings.venue;
    return `${v}:${recordsVenueHash(v)}:${legs || state.race.totalLegs}:${board}`;
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
        if (legacy && legacy.t != null) best = { t: legacy.t, char: null };
    }
    const prov = provisionalRecord(venue);
    if (prov != null && (!best || prov < best.t)) best = { t: prov, char: null, provisional: true };
    return best;
}

// A leg record is committed THE MOMENT it is sailed — abandoning a race later does
// not unhappen a great leg. ⚠️ Returns the BEATEN record's time (for the split card's
// margin) only when a PREVIOUS record was beaten, else false: the first run over a course
// founds every entry in the book, and founding is not breaking — announcing it would paint
// the whole first results screen gold.
function commitLegRecord(board, legIdx, t) {
    if (!recordsEligible()) return false;
    const all = loadAllRecords();
    const key = recordsBoardKey(board);
    const rec = all[key] || (all[key] = EMPTY_BOARD());
    const prev = rec.legs[legIdx];
    if (prev && prev.t <= t) return false;
    rec.legs[legIdx] = { t, char: settings.character };
    saveAllRecords(all);
    return prev ? prev.t : false;
}
// The book's record for one leg on this board (null when none), read without writing.
function legRecordTime(board, legIdx) {
    const rec = loadAllRecords()[recordsBoardKey(board)];
    return rec && rec.legs && rec.legs[legIdx] ? rec.legs[legIdx].t : null;
}

// ── THE SPLIT CARD (PT-008, Wes Oct 7 2026) ──
// Every leg, the moment it ends: its time, and how it compares — in a Time Trial against your ghost's same
// leg, in a race against your record for that leg (a Time Trial's) — green quicker, red slower; and a new
// leg record in gold, against the record it beat. Three seconds, under the clock. Not in the School.
function showSplitCard(kind, label, time, delta) {
    const el = document.getElementById('hud-split-card');
    if (!el) return;
    el.className = 'hud-split-card show' + (kind ? ' ' + kind : '');
    el.innerHTML = `<span class="k">${label}</span><span class="t">${time}</span>${delta ? `<span class="d">${delta}</span>` : ''}`;
    clearTimeout(el._hide);
    el._hide = setTimeout(() => { el.className = 'hud-split-card' + (kind ? ' ' + kind : ''); }, 3000);
}
function announceLegSplit(rs, li, split, beaten) {
    if (window.School && School.active) return;
    const signed = (d) => `${d < 0 ? '\u2212' : '+'}${Math.abs(d).toFixed(1)}`;
    if (beaten !== false && beaten != null) {
        showSplitCard('record', `\u2726 Leg ${li + 1} record`, formatSplitTime(split), `${signed(split - beaten)} vs record`);
        return;
    }
    let ref = null, what = '';
    const gs = window.TimeTrial && TimeTrial.solo() ? TimeTrial.ghostSplits() : null;
    if (gs && gs.legs && gs.legs[li] != null) { ref = gs.legs[li]; what = 'vs ghost'; }
    else { const r = legRecordTime(runTrimBoard(rs), li); if (r != null) { ref = r; what = 'vs record'; } }
    if (ref == null) { showSplitCard('', `Leg ${li + 1}`, formatSplitTime(split), ''); return; }
    const d = split - ref;
    showSplitCard(d <= 0 ? 'faster' : 'slower', `Leg ${li + 1}`, formatSplitTime(split), `${signed(d)} ${what}`);
}

// Everything a FINISHED run can set, committed at the line: the track record (with
// this run's splits), top speed, shortest distance, quickest start. Player only, and
// only for a boat that sailed the whole course. Returns what this run took, for the
// results screen to paint gold.
function finalizeRaceRecords(player) {
    const rs = player.raceState;
    const board = runTrimBoard(rs);
    const out = { board, track: false, topSpeed: false, minDist: false, start: false,
                  legs: (state.race.legRecordsSet || []).slice(), eligible: recordsEligible() };
    if (!out.eligible) return out;   // cup, series, school: the book is closed
    const all = loadAllRecords();
    const key = recordsBoardKey(board);
    const rec = all[key] || (all[key] = EMPTY_BOARD());
    const me = settings.character;

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

    // TIME TRIALS have their own page: the run on the chart, and its numbers (renderTrialResults).
    const trial = sorted.length === 1 && !!(window.TimeTrial && TimeTrial.solo());
    const raceBody = document.getElementById('res-race-body'), trialBody = document.getElementById('res-trial');
    if (raceBody) raceBody.classList.toggle('hidden', trial);
    if (trialBody) trialBody.classList.toggle('hidden', !trial);
    const title = document.getElementById('res-title'); if (title) title.textContent = trial ? 'Time Trial' : 'Race Results';
    if (trial) {
        const rs = player.raceState;
        if (!state.race.bestChecked) {
            state.race.bestChecked = true;
            state.race.bestOutcome = (rs.finished && !rs.resultStatus) ? recordVenueBest(rs.finishTime, 1, 0) : null;
        }
        const sub = document.getElementById('res-subtitle');
        if (sub) sub.textContent = `${(venueDisplayName(settings.venue) || settings.venue).toUpperCase()} · SOLO, AGAINST THE CLOCK`;
        const status = document.getElementById('res-status'); if (status) status.textContent = '';
        renderTrialResults(player);
        renderResultsFootnote(leader);
        styleResultsButtons();
        if (window.Unlocks) { Unlocks.poll(sorted); presentUnlocks(); }
        return;
    }

    const gapScale = fleetGapScale();

    renderResultsHeader(sorted, gapScale);
    renderResultsHero(sorted, player, leader);
    // Called from HERE, not from inside the hero. The hero redraws only when the hero's own
    // signature changes, and a split tile can go stale without it: "fleet fastest" is taken
    // away by a boat still out on the water sailing a quicker leg than you did.
    // THE CHART, THE REPLAY AND YOUR LEGS (PT-007, js/ui/raceresults.js) — the old split tiles' job, and more.
    if (typeof renderRaceResults === 'function') renderRaceResults(player, sorted);
    renderResultsRows(sorted, leader, fleetExtremes(), gapScale);
    renderResultsFootnote(leader);
    styleResultsButtons();
    // Achievements: counted once the player's place is final, then the cards.
    if (window.Unlocks) { Unlocks.poll(sorted); presentUnlocks(); }
}

// ── TIME TRIALS RESULTS (Wes, Sep 27 2026) ──────────────────────────────────────
// Left: the chart (the minimap, drawn big) with this run's track, coloured leg by leg, and the ghost's —
// your previous best — dashed. Right: the whole run (time, the delta to the previous best, top and average
// speed, distance, collisions), then every leg with the same numbers and its delta to the ghost's leg.
const TRIAL_LEG_COLOURS = ['#94a3b8', '#5eead4', '#f2c14e', '#f472b6', '#60a5fa', '#a78bfa', '#fb923c', '#34d399', '#f87171', '#facc15'];
function _trialLegColour(k) { return k <= 0 ? TRIAL_LEG_COLOURS[0] : TRIAL_LEG_COLOURS[1 + (k - 1) % (TRIAL_LEG_COLOURS.length - 1)]; }
function renderTrialResults(player) {
    const host = document.getElementById('res-trial-stats'), cv = document.getElementById('res-trial-map');
    if (!host || !cv) return;
    const rs = player.raceState, dnf = !!rs.resultStatus;
    const sig = [rs.finished, rs.resultStatus, rs.finishTime.toFixed(3), rs.legTimes.length].join('|');
    if (host.dataset.sig === sig) return;
    host.dataset.sig = sig;
    const best = state.race.bestOutcome, prev = best ? best.previous : null;
    const gs = TimeTrial.ghostSplits(), hits = TimeTrial.hitsByLeg();
    const kmTxt = (m) => `${sailedKm(m).toFixed(2)} km`, mTxt = (m) => `${Math.round(m)} m`;
    const signed = (d, digits) => `${d <= 0 ? '\u2212' : '+'}${Math.abs(d).toFixed(digits)}s`;
    const dCol = (d) => d <= 0 ? '#34d399' : '#f87171';
    const totalHits = Object.values(hits).reduce((a, c) => a + c, 0);
    const dist = rs.legDistances.reduce((a, c) => a + c, 0);

    const stat = (label, value, sub, color) => `<div style="background:#101a2e; border:1px solid rgba(255,255,255,0.09); border-radius:14px; padding:14px 16px; min-width:0;">
        <div class="t-label t-label-sm" style="color:#9fb2cc;">${label}</div>
        <div class="t-mono" style="font-size:26px; font-weight:900; line-height:1.15; margin-top:4px; color:${color || '#eef3fb'};">${value}</div>
        ${sub ? `<div style="font-size:12px; color:#9fb2cc; margin-top:2px;">${sub}</div>` : ''}</div>`;
    const timeStat = dnf ? stat('Time', rs.resultStatus, 'Did not finish', '#f87171')
        : stat('Time', formatBestTime(rs.finishTime), best && best.isBest ? (prev == null ? 'Your first time here' : 'A new best') : '', best && best.isBest ? '#f2c14e' : null);
    const deltaStat = (dnf || prev == null) ? stat('Vs previous best', '\u2014', prev == null ? 'No previous best' : '')
        : stat('Vs previous best', signed(rs.finishTime - prev, 3), `Best was ${formatBestTime(prev)}`, dCol(rs.finishTime - prev));
    const cards = [timeStat, deltaStat,
        stat('Top speed', `${boatTopSpeed(player).toFixed(1)} kn`),
        stat('Average speed', `${boatAvgSpeed(player).toFixed(1)} kn`),
        stat('Distance', kmTxt(dist)),
        stat('Collisions', String(totalHits), totalHits ? 'land, ice or marks' : 'A clean run', totalHits ? '#f87171' : '#34d399')];

    // Leg by leg: the start (gun to the line), then each leg.
    const rows = [];
    const row = (k, label, t, gt) => {
        const top = rs.legTopSpeeds[k] || 0, d = rs.legDistances[k] || 0, sum = rs.legSpeedSums ? (rs.legSpeedSums[k] || 0) : 0;
        const avg = t > 0.1 ? sum / t : 0, h = hits[k] || 0;
        rows.push(`<div class="grid items-center res-trial-leg" data-leg="${k}" style="grid-template-columns:18px 70px 1fr 0.9fr 0.8fr 0.8fr 0.9fr 0.6fr; gap:10px; padding:9px 12px; border-top:1px solid rgba(255,255,255,0.06); font-size:13px; cursor:pointer; border-radius:8px;">
            <span style="width:10px; height:10px; border-radius:3px; background:${_trialLegColour(k)};"></span>
            <span class="t-label t-label-sm" style="color:#dbeafe;">${label}</span>
            <span class="t-mono" style="color:#eef3fb;">${t != null ? formatSplitTime(t) : '\u2014'}</span>
            <span class="t-mono" style="color:${gt != null && t != null ? dCol(t - gt) : '#66748c'};">${gt != null && t != null ? signed(t - gt, 1) : '\u2014'}</span>
            <span class="t-mono" style="color:#c4d2e6;">${top.toFixed(1)}</span>
            <span class="t-mono" style="color:#c4d2e6;">${avg.toFixed(1)}</span>
            <span class="t-mono" style="color:#c4d2e6;">${mTxt(d)}</span>
            <span class="t-mono" style="color:${h ? '#f87171' : '#66748c'};">${h}</span></div>`);
    };
    if (rs.startLegDuration != null) row(0, 'Start', rs.startLegDuration, gs ? gs.start : null);
    rs.legTimes.forEach((t, i) => row(i + 1, `Leg ${i + 1}`, t, gs && gs.legs ? gs.legs[i] : null));
    const head = `<div class="grid t-label" style="grid-template-columns:18px 70px 1fr 0.9fr 0.8fr 0.8fr 0.9fr 0.6fr; gap:10px; padding:0 12px 8px; font-size:10px; letter-spacing:0.14em; color:#66748c;">
        <span></span><span>Leg</span><span>Time</span><span>Vs ghost</span><span>Top kn</span><span>Avg kn</span><span>Dist</span><span>Hits</span></div>`;
    host.innerHTML = `<div class="grid" style="grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px;">${cards.join('')}</div>
        <div style="background:#101a2e; border:1px solid rgba(255,255,255,0.09); border-radius:16px; padding:14px 4px 6px;">
            <div class="t-label t-label-sm" style="color:#dbeafe; padding:0 12px 10px;">Leg by leg${gs ? '' : ' <span style="color:#66748c;">· no ghost yet to compare</span>'}</div>
            ${head}${rows.join('') || '<div style="padding:10px 12px; color:#66748c;">No legs sailed.</div>'}</div>`;

    // THE CHART. The minimap's own drawing, rendered once onto a base canvas; the tracks go over it on every
    // redraw, so a click (highlight a leg) or a hover (the readout) never repaints the whole chart.
    const px = Math.round(cv.clientWidth * (window.devicePixelRatio || 1)) || 640;
    const base = document.createElement('canvas'); base.width = px; base.height = px;
    drawMinimap.target = { ctx: base.getContext('2d') };
    try { drawMinimap(); } finally { drawMinimap.target = null; }
    const P = drawMinimap.last; if (!P) return;
    cv.width = px; cv.height = px;
    _trialMap = { cv, base, P, px, run: (TimeTrial._rec && TimeTrial._rec.s) || [], ghost: (TimeTrial._ghost && TimeTrial._ghost.s) || null, sel: null, hover: null };
    _trialMapDraw();
    _trialMapWire(host);
    const ghost = _trialMap.ghost;
    const legend = document.getElementById('res-trial-legend');
    if (legend) {
        const sw = (c, dash) => `<span style="display:inline-block; width:22px; height:0; border-top:3px ${dash ? 'dashed' : 'solid'} ${c}; vertical-align:middle; margin-right:6px;"></span>`;
        legend.innerHTML = [`<span data-leg="0" style="cursor:pointer;">${sw(_trialLegColour(0))}Start</span>`, ...rs.legTimes.map((_, i) => `<span data-leg="${i + 1}" style="cursor:pointer;">${sw(_trialLegColour(i + 1))}Leg ${i + 1}</span>`),
            ghost ? `<span>${sw('rgba(255,255,255,0.7)', true)}Ghost (previous best)</span>` : ''].join('')
            + `<span style="color:#66748c; margin-left:auto;">Click a leg to pick it out · hover the track for the numbers</span>`;
        legend.querySelectorAll('[data-leg]').forEach(el => el.addEventListener('click', () => _trialMapSelect(+el.dataset.leg)));
    }
}

// THE RESULTS CHART'S INTERACTION (Wes, Sep 27 2026): click a leg row or the track to pick that leg out (the
// rest dims; click it again to clear); hover the track for the instruments at that moment, in plain words.
let _trialMap = null;
function _trialMapXY(x, y) { const P = _trialMap.P; return [(x - P.cx) * P.scale + P.width / 2, (y - P.cy) * P.scale + P.height / 2]; }
function _trialMapDraw() {
    const M = _trialMap; if (!M) return;
    const g = M.cv.getContext('2d'), lw = Math.max(2, M.px / 260), sel = M.sel;
    g.clearRect(0, 0, M.px, M.px); g.drawImage(M.base, 0, 0);
    if (M.ghost && M.ghost.length > 1) {
        g.save(); g.setLineDash([lw * 3, lw * 2.5]); g.lineWidth = lw * 0.9; g.strokeStyle = 'rgba(255,255,255,0.55)';
        g.beginPath(); let first = true;
        for (const q of M.ghost) { if (!(q[6] >= 1)) continue; if (sel != null && q[6] !== sel) { first = true; continue; }
            const [x, y] = _trialMapXY(q[0], q[1]); if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y); }
        g.stroke(); g.restore();
    }
    const run = M.run;
    if (run.length > 1) {
        g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
        // outline first so the track reads on any water, then each leg in its own colour; a picked leg is
        // drawn fat and last, the others faint
        const seg = (i, pass, on) => { const a = run[i - 1], b = run[i], leg = b[6] || 0;
            const [x0, y0] = _trialMapXY(a[0], a[1]), [x1, y1] = _trialMapXY(b[0], b[1]);
            g.globalAlpha = sel == null ? (leg === 0 && pass ? 0.55 : 1) : on ? 1 : 0.18;
            const w = sel != null && on ? lw * 1.8 : lw;
            g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
            g.strokeStyle = pass ? _trialLegColour(leg) : 'rgba(8,16,28,0.75)'; g.lineWidth = pass ? w : w + 2.5; g.stroke(); };
        for (const pass of [0, 1]) for (let i = 1; i < run.length; i++) if (sel == null || (run[i][6] || 0) !== sel) seg(i, pass, false);
        if (sel != null) for (const pass of [0, 1]) for (let i = 1; i < run.length; i++) if ((run[i][6] || 0) === sel) seg(i, pass, true);
        const endQ = run[run.length - 1], [ex, ey] = _trialMapXY(endQ[0], endQ[1]);
        g.globalAlpha = 1; g.beginPath(); g.arc(ex, ey, lw * 2.2, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = '#0b1c2b'; g.lineWidth = 1.5; g.stroke();
        if (M.hover != null && run[M.hover]) {   // the boat at the hovered moment
            const q = run[M.hover], [hx, hy] = _trialMapXY(q[0], q[1]);
            g.save(); g.translate(hx, hy); g.rotate(q[2] / 1000);
            g.beginPath(); g.moveTo(0, -lw * 5); g.lineTo(lw * 3.3, lw * 3.8); g.lineTo(0, lw * 2.3); g.lineTo(-lw * 3.3, lw * 3.8); g.closePath();
            g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = '#0b1c2b'; g.lineWidth = 1.6; g.stroke(); g.restore();
        }
        g.restore();
    }
}
function _trialMapSelect(leg) {
    const M = _trialMap; if (!M) return;
    M.sel = (leg == null || M.sel === leg) ? null : leg;
    document.querySelectorAll('#res-trial-stats .res-trial-leg').forEach(r => { const on = M.sel != null && +r.dataset.leg === M.sel;
        r.style.background = on ? 'rgba(255,255,255,0.08)' : ''; r.style.boxShadow = on ? `inset 3px 0 0 ${_trialLegColour(M.sel)}` : ''; r.style.opacity = M.sel == null || on ? '' : '0.55'; });
    _trialMapDraw();
}
// The nearest sample of this run to a point on the canvas (canvas pixels), within `maxPx`.
function _trialMapNearest(cx, cy, maxPx) {
    const M = _trialMap; let best = -1, bd = maxPx * maxPx;
    for (let i = 0; i < M.run.length; i++) { const q = M.run[i]; if (M.sel != null && (q[6] || 0) !== M.sel) continue;
        const [x, y] = _trialMapXY(q[0], q[1]), d = (x - cx) ** 2 + (y - cy) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
}
// What the boat was doing at sample i, in words a non-sailor reads: speeds in knots, the wind by name.
function _trialMoment(i) {
    const M = _trialMap, q = M.run[i]; if (!q) return '';
    const t0 = TimeTrial._rec ? TimeTrial._rec.t0 : 0, t = t0 + i * 0.25;
    const kn = (v) => v == null ? '\u2014' : `${(v / 10).toFixed(1)} kn`;
    const twa = q[10], abs = twa == null ? null : Math.abs(twa);
    const pointOf = abs == null ? '' : abs < 38 ? 'Too close to the wind' : abs < 60 ? 'Sailing upwind' : abs < 110 ? 'Reaching across the wind' : abs < 150 ? 'Broad reach' : 'Running downwind';
    const side = twa == null ? '' : twa < 0 ? 'wind over the right side (starboard)' : 'wind over the left side (port)';
    const row = (k, v) => `<div style="display:flex; justify-content:space-between; gap:14px;"><span style="color:#9fb2cc;">${k}</span><span class="t-mono" style="color:#eef3fb;">${v}</span></div>`;
    const leg = q[6] || 0;
    return `<div class="t-label t-label-sm" style="color:${_trialLegColour(leg)}; margin-bottom:6px;">${leg ? 'Leg ' + leg : 'Start'} \u00b7 ${t < 0 ? '\u2212' + formatSplitTime(-t) + ' before the gun' : formatSplitTime(t) + ' into the race'}</div>`
        + row('Speed over the ground', kn(q[7]))
        + row('Boat speed through the water', kn(q[8]))
        + row('Wind speed', kn(q[9]))
        + row('Angle to the wind', abs == null ? '\u2014' : `${abs}\u00b0`)
        + (pointOf ? `<div style="color:#dbeafe; margin-top:4px;">${pointOf}, ${side}</div>` : '')
        + row('Speed toward / away from the wind', kn(q[11]))
        + row('Spinnaker', q[4] ? 'Up' : 'Down')
        + (q[12] ? `<div style="color:#67e8f9; margin-top:2px;">Planing</div>` : '');
}
function _trialMapWire(host) {
    const M = _trialMap, cv = M.cv;
    host.querySelectorAll('.res-trial-leg').forEach(r => r.addEventListener('click', () => _trialMapSelect(+r.dataset.leg)));
    if (cv.dataset.wired) return;   // the canvas outlives the race; its listeners read the current _trialMap
    cv.dataset.wired = '1';
    let tip = document.getElementById('res-trial-tip');
    if (!tip) { tip = document.createElement('div'); tip.id = 'res-trial-tip';
        tip.style.cssText = 'position:absolute; pointer-events:none; display:none; z-index:5; background:rgba(6,14,26,0.94); border:1px solid rgba(255,255,255,0.18); border-radius:10px; padding:10px 12px; font-size:12px; line-height:1.55; min-width:250px; box-shadow:0 8px 24px rgba(0,0,0,0.5);';
        cv.parentElement.style.position = 'relative'; cv.parentElement.appendChild(tip); }
    const at = (e) => { const r = cv.getBoundingClientRect(), k = _trialMap.px / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k, k, r]; };
    cv.addEventListener('mousemove', (e) => {
        if (!_trialMap) return;
        const [x, y, k] = at(e), i = _trialMapNearest(x, y, 14 * k);
        _trialMap.hover = i >= 0 ? i : null; _trialMapDraw();
        cv.style.cursor = i >= 0 ? 'pointer' : '';
        if (i < 0) { tip.style.display = 'none'; return; }
        tip.innerHTML = _trialMoment(i); tip.style.display = '';
        const host = cv.parentElement.getBoundingClientRect(), ox = e.clientX - host.left, oy = e.clientY - host.top;
        const left = ox + 18 + tip.offsetWidth > host.width ? ox - tip.offsetWidth - 18 : ox + 18;
        tip.style.left = Math.max(4, left) + 'px'; tip.style.top = Math.max(4, Math.min(host.height - tip.offsetHeight - 4, oy - 20)) + 'px';
    });
    cv.addEventListener('mouseleave', () => { if (_trialMap) { _trialMap.hover = null; _trialMapDraw(); } tip.style.display = 'none'; });
    cv.addEventListener('click', (e) => {
        if (!_trialMap) return;
        const [x, y, k] = at(e); const M2 = _trialMap, keep = M2.sel; M2.sel = null;   // search every leg, not just the picked one
        const i = _trialMapNearest(x, y, 14 * k); M2.sel = keep;
        _trialMapSelect(i >= 0 ? (M2.run[i][6] || 0) : null);
    });
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
            `${state.boats.length} boats`,
            // the race was sailed with the Adaptive AI band engaged at some point (js/ai/adaptive.js)
            state.race && state.race.adaptiveUsed ? 'Adaptive AI' : null
        ].filter(Boolean).join(' · ').toUpperCase();
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
    // SECONDARY BY DESIGN: the reference, not the result. Smaller and quieter than your own
    // time on the hero (Wes, Sep 13 2026 — it used to be the biggest number on the page).
    return `
        <div style="flex:none;${frame}border-radius:12px;padding:11px 16px;text-align:center;">
            <div class="t-label" style="font-size:10px;letter-spacing:0.2em;color:${won ? '#f2c14e' : '#7787a0'};">
                ${won ? '✦ New Course Record ✦' : 'Course Record'}
            </div>
            <div class="flex items-baseline justify-center gap-2" style="margin-top:4px;">
                <span class="t-mono" style="font-size:20px;font-weight:800;color:${won ? '#f2c14e' : '#c4d2e6'};">${formatBestTime(won ? rs.finishTime : best.previous)}</span>
            </div>
            <div class="t-mono" style="font-size:11px;font-weight:800;color:${won ? '#34d399' : '#7787a0'};margin-top:2px;">
                ${won ? 'beat it by ' + delta + 's' : '+' + delta + 's off the record'}
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
    const facts = (rs.finished && !rs.resultStatus) ? Series.raceFacts(rs, pos) : null;
    if (!state.race.bestChecked) {
        state.race.bestChecked = true;
        state.race.bestOutcome = (rs.finished && !rs.resultStatus)
            ? recordVenueBest(rs.finishTime, pos, facts ? facts.stars : 0) : null;
    }
    const best = state.race.bestOutcome;

    const sig = [pos, rs.finished, rs.resultStatus, rs.finishTime.toFixed(2),
                 rs.totalPenalties, rs.legTimes.length,
                 best && best.isBest, best && best.isBestPos].join('|');
    if (host.dataset.sig === sig) return;
    host.dataset.sig = sig;

    const dnf = !!rs.resultStatus;
    // TIME TRIALS are solo: the time is the headline, and the ghost is the boat you raced.
    const solo = sorted.length === 1;
    const headline = dnf ? rs.resultStatus : solo ? formatBestTime(rs.finishTime) : ordinalOf(pos);
    // The gap that decided your race — to the boat AHEAD, because that is the one you were
    // sailing against. The winner gets the gap they won by instead.
    let gap = '';
    const gt = solo && window.TimeTrial ? TimeTrial.ghostTime() : null;
    if (solo && !dnf) {
        gap = gt == null ? 'Your first run here — it is your ghost now'
            : rs.finishTime < gt ? `${(gt - rs.finishTime).toFixed(2)}s faster than your ghost — the new ghost`
            : `+${(rs.finishTime - gt).toFixed(2)}s behind your ghost`;
    } else if (dnf) {
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
    const pc = solo ? (best && best.isBest ? '#f2c14e' : '#eef3fb') : placeColor(pos, dnf);
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
                <div class="t-label" style="font-size:12px;letter-spacing:0.24em;color:${pc};">${dnf ? 'You Did Not Finish' : solo ? 'Time Trial' : 'You Finished'}</div>
                <div class="flex items-baseline gap-3.5" style="margin-top:4px;">
                    <span class="t-display italic" style="font-size:${dnf ? 46 : solo ? 60 : 72}px;line-height:1;color:${pc};">${headline}</span>
                    <div>
                        <div class="t-display-8 t-display uppercase" style="font-size:19px;letter-spacing:0.02em;">${escapeHTMLText(player.name)}</div>
                        <!-- YOUR time is the second-biggest thing on the page, at full precision — the
                             record card beside it used to out-size it with thousandths while this
                             read 02:44, which put the emphasis on the wrong race. -->
                        ${dnf || solo ? '' : `<div class="t-mono" style="font-size:34px;font-weight:900;line-height:1.05;margin-top:2px;color:${best && best.isBest ? '#f2c14e' : '#eef3fb'};">${formatBestTime(rs.finishTime)}</div>`}
                        <div style="font-size:13px;color:#9fb2cc;margin-top:2px;">${gap}</div>
                    </div>
                </div>
                <div class="flex gap-2" style="margin-top:10px;">${chips.join('')}</div>
                ${facts && !solo ? `<div class="flex items-center gap-3" style="margin-top:10px;">${starStrip(facts.stars, 17)}<span style="font-size:13px; color:${facts.stars >= 4 ? '#f2c14e' : '#9fb2cc'};">${starSentence(facts.stars, facts.missed, 'race')}${best && best.isBestStars && facts.stars > 0 ? ' <span style="color:#f2c14e;">New best here.</span>' : ''}</span></div>` : ''}
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
    return Math.round(sailedKm(b.raceState.legDistances.reduce((a, c) => a + c, 0)) * 100) / 100;
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
            timeEl.textContent = formatBestTime(rs.finishTime);
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

        // THE START LIVES IN THE ROW'S HOVER (PT-007): the finish arrows, top and average speed and the distance
        // stayed on the row at Wes's word; the start time is the one number that moved off it.
        const start = boatStartTime(boat);
        row.title = `${boat.name} — start ${start === null ? 'never crossed' : '+' + start.toFixed(1) + 's'} · top ${boatTopSpeed(boat).toFixed(1)} kn`
            + ` · average ${boatAvgSpeed(boat).toFixed(1)} kn · sailed ${boatDistKm(boat).toFixed(2)} km`;

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
          + `${vn || 'the race'} in <span class="t-mono" style="color:#eef3fb;">${formatBestTime(rs.finishTime)}</span>`
        : `${vn || 'The race'} — still on the water`;
}


// Physics announces; the banner answers (see GameEvents in game/core.js — this
// replaced triggerPenalty calling showRaceMessage directly from sim code).
GameEvents.on('player-penalty', (info) => {
    const why = info && info.rule ? ` (${info.rule}${info.reason ? ' — ' + info.reason : ''})` : '';
    showRaceMessage(`PENALTY${why}! DO A 360° TURN TO CLEAR`, "text-red-500", "border-red-500/50");
});
// A PASSAGE over the flats, named as you sail onto it (sim/course.js FLATS_RUN) — Wes, Sep 26 2026:
// Scythe's objective collects them, so the player has to be told where they are. Never over another
// message (a penalty, aground); gone after two seconds unless something replaced it.
GameEvents.on('flats-passage', (info) => {
    if (!info || !UI.message || !UI.message.classList.contains('hidden')) return;
    const text = (info.name || '').toUpperCase() + (info.sailed ? '' : ' — A PASSAGE OVER THE FLATS');
    showRaceMessage(text, "text-teal-300", "border-teal-400/50");
    setTimeout(() => { if (UI.message && UI.message.textContent === text) hideRaceMessage(); }, 2200);
});
// AGROUND on the flats (js/tide.js): the one message a stranded sailor needs is when the
// water comes back, and the sine knows.
GameEvents.on('player-aground', (info) => {
    const r = window.Tide && info && info.boat ? Tide.refloatIn(info.boat) : null;
    showRaceMessage(r == null ? 'AGROUND — THE CREW ARE PUSHING OFF' : `AGROUND — THE TIDE REFLOATS YOU IN ${Math.max(1, Math.ceil(r))}s`, "text-amber-400", "border-amber-500/50");
});


// ═══════════════════════════ THE CLUBHOUSE (Sep 2026 redesign) ═══════════════════════════
// Four doors in front of the race board. Sailing School goes straight onto the pond; Cup
// and Series pick a race list and then use the SAME board a single race uses, in its
// series dress: the picker gives way to the route, the header names the race, and from
// race two your skipper is locked. Between races: the standings; after the last: the
// podium. The series itself — venues, index, points, tie-break — is js/game/series.js.

const _CH_ARROW = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-3px;"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>';
const _CH_REDO = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-3px;"><path d="M21 12a9 9 0 1 1-3-6.7"></path><path d="M21 4v5h-5"></path></svg>';
function _ordinal(n) { const sfx = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (sfx[(v - 20) % 10] || sfx[v] || sfx[0]); }

function _chOverlays() { return [UI.clubhouse, UI.cupOverlay, UI.seriesOverlay, UI.standingsOverlay, UI.fleetOverlay].filter(Boolean); }
function hideClubhouseOverlays() { for (const el of _chOverlays()) el.classList.add('hidden'); }
function _chShow(el) {
    hideClubhouseOverlays();
    if (UI.preRaceOverlay) UI.preRaceOverlay.classList.add('hidden');
    if (UI.resultsOverlay) UI.resultsOverlay.classList.add('hidden');
    if (el) { el.classList.remove('hidden'); el.scrollTop = 0; }
}
// Is any clubhouse screen (hub, a picker, the standings) up? The render loop and the
// keyboard treat these like the board.
function clubhouseUp() { return _chOverlays().some(el => !el.classList.contains('hidden')); }

// The shelf's four states, one colour each: won (gold), a best finish of 2nd (silver) or
// 3rd (bronze), and not yet placed (a dim ghost). The medal dots on the standings use the
// same three metals, so a trophy and its dot agree.
const TROPHY_TONES = {
    won:    ['#f2c14e', 'rgba(242,193,78,0.18)'],
    silver: ['#c0c8d4', 'rgba(192,200,212,0.16)'],
    bronze: ['#c88a5a', 'rgba(200,138,90,0.16)'],
    none:   ['#7787a0', 'rgba(119,135,160,0.10)'],
};
// ── STARS ON SCREEN ───────────────────────────────────────────────────────────────────
// Four slots, the earned ones gold — one glyph a rung, so it reads at a glance anywhere:
// on a tile, under a trophy, in a state line. See Series.raceFacts for the rungs.
function starStrip(n, size) {
    n = Math.max(0, Math.min(4, n | 0));
    let g = '';
    for (let i = 0; i < 4; i++) g += `<span style="color:${i < n ? '#f2c14e' : 'rgba(255,255,255,0.22)'};">&#9733;</span>`;
    return `<span class="t-mono" style="font-size:${size || 12}px; letter-spacing:1px; white-space:nowrap; line-height:1;">${g}</span>`;
}
const STAR_RUNGS = { race: ['Win', 'Clean win', 'Wire to wire', 'Wire to wire, on manual trim'],
                     cup: ['Sweep', 'Clean sweep', 'Wire to wire', 'Wire to wire, on manual trim'] };
// "Clean sweep. 3rd at mark 1 in race 2 was the third star." — what was earned, and the
// first thing that was missed, in one line. That line is what makes the next attempt.
function starSentence(stars, missed, kind) {
    const names = STAR_RUNGS[kind] || STAR_RUNGS.race;
    const nth = ['first', 'second', 'third', 'fourth'];
    const head = stars > 0 ? names[stars - 1] + '.' : '';
    let tail = '';
    if (stars >= 4) tail = 'Four stars.';
    else if (missed) {
        const why = missed.why.charAt(0).toUpperCase() + missed.why.slice(1);
        tail = `${why}${missed.race ? ` in race ${missed.race}` : ''} was the ${nth[missed.rung - 1]} star.`;
    }
    return [head, tail].filter(Boolean).join(' ');
}

// ── PENNANTS ─────────────────────────────────────────────────────────────────────────
// A series pennant: a burgee-shaped flag with the series length on it, gold when that
// length has been won, a faint outline otherwise. Drawn, not an asset, so it scales.
function pennantHTML(n, won, w) {
    w = w || 40; const h = Math.round(w * 0.62);
    const fill = won ? '#f2c14e' : 'rgba(255,255,255,0.08)', stroke = won ? '#8a6a12' : 'rgba(255,255,255,0.28)', ink = won ? '#0c1322' : 'rgba(255,255,255,0.45)';
    return `<svg width="${w}" height="${h}" viewBox="0 0 40 25" style="display:block; overflow:visible;${won ? ' filter:drop-shadow(0 2px 6px rgba(242,193,78,0.45));' : ''}">
        <path d="M2 2 L37 12.5 L2 23 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round"/>
        <text x="12" y="16.6" font-family="ui-monospace, Menlo, monospace" font-size="11" font-weight="800" fill="${ink}" text-anchor="middle">${n}</text></svg>`;
}
function pennantRack(w, gap) {
    return `<span style="display:inline-flex; align-items:center; gap:${gap == null ? 4 : gap}px;">${Series.pennants().map(p => pennantHTML(p.n, p.won, w)).join('')}</span>`;
}

function trophyState(cupId) {
    const t = Series.trophies()[cupId];
    if (!t) return 'none';
    if (t.won) return 'won';
    if (t.best === 2) return 'silver';
    if (t.best === 3) return 'bronze';
    return 'none';
}
const rankState = (rank) => rank === 1 ? 'won' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'none';

// Placeholder silverware, one form per cup — a two-handled cup, a tall chalice, a wide
// bowl — until the masters land (art/manifest.json `trophy-<id>`).
function trophySVG(form, size, state) {
    const [c, fill] = TROPHY_TONES[state === true ? 'won' : (state || 'none')] || TROPHY_TONES.none;
    const common = `xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" fill="${fill}" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"`;
    if (form === 'cup') return `<svg ${common}><path d="M18 12h28v14a14 14 0 0 1-28 0z"></path><path d="M18 18h-6a6 6 0 0 0 6 10"></path><path d="M46 18h6a6 6 0 0 1-6 10"></path><path d="M32 40v8"></path><path d="M22 52h20"></path><path d="M18 56h28"></path></svg>`;
    if (form === 'chalice') return `<svg ${common}><path d="M22 8h20v16a10 10 0 0 1-20 0z"></path><path d="M32 34v14"></path><path d="M32 22l3 4h-6z"></path><path d="M24 52h16"></path><path d="M20 56h24"></path></svg>`;
    if (form === 'trophy') return `<svg ${common}><path d="M24 8h16l-2 26h-12z"></path><path d="M28 34h8v8h-8z"></path><path d="M20 46h24l2 8H18z"></path><path d="M14 56h36"></path><path d="M32 14v10"></path></svg>`;
    return `<svg ${common}><path d="M10 24h44a22 22 0 0 1-44 0z"></path><path d="M32 46v6"></path><path d="M20 56h24"></path><path d="M26 32a6 6 0 1 1 6 6a3 3 0 1 1 -3 -3"></path></svg>`;
}

// The cup's trophy at `size`px in the given state: the delivered gold master when the cup
// has `art`, else the placeholder of the same form. One master per cup — the silver, the
// bronze and the ghost are CSS on the same image.
function trophyHTML(cup, size, state) {
    const st = state === true ? 'won' : (state || 'none');
    if (!cup || !cup.art) return trophySVG(cup ? cup.form : 'cup', size, st);
    const filt = { won: 'drop-shadow(0 0 16px rgba(242,193,78,0.45))', silver: 'grayscale(1) brightness(1.08)',
                   bronze: 'sepia(0.6) hue-rotate(-18deg) saturate(1.1) brightness(0.72)', none: 'grayscale(1) brightness(0.55) opacity(0.45)' }[st];
    return `<img src="assets/images/trophies/trophy-${cup.id}.png" alt="" draggable="false" style="width:${size}px; height:${size}px; object-fit:contain; filter:${filt};">`;
}

// A venue tile as a picture of where you are going: thumb, name on the scrim, a tag.
function _routeTile(key, cls, tag, aspect, cssPx, extra) {
    // aspect: the tile's width/height (1 = square); the route strip passes its own.
    const name = venueDisplayName(key) || key;
    const sel = /\bsel\b/.test(cls || '');
    // The tag pill says the state as well as the number: blue and bold for the race in play,
    // grey with a tick and your result for one already sailed.
    const done = /\bdone\b/.test(cls || '');
    const tagStyle = sel ? 'background:#5aa7ff;color:#0c1322;font-weight:800;' : done ? 'color:#9fb2cc;' : '';
    return `<div class="${cls || ''}" style="min-width:0;">
        <div class="pr-venue-shot" style="${aspect ? `aspect-ratio:${aspect};` : ''}${sel ? 'box-shadow:0 0 0 2px #5aa7ff, 0 6px 18px rgba(90,167,255,0.35);' : ''}">
            ${venueThumb(key, escapeHTMLText(name), cssPx || 170)}
            ${tag ? `<span class="t-mono pr-route-tag" style="${tagStyle}">${tag}</span>` : ''}
            ${extra ? `<span style="position:absolute; top:8px; right:8px; background:rgba(6,14,26,0.72); border-radius:999px; padding:3px 7px;">${extra}</span>` : ''}
            <span class="pr-venue-name t-display-8 uppercase">${escapeHTMLText(name)}</span>
        </div></div>`;
}
// The stars one race of the active cup earned, for its tile — null on a series or before it is sailed.
function _raceStarsExtra(i) {
    if (!Series.active || Series.active.kind !== 'cup') return '';
    const r = Series.active.results[i]; const me = r && r.rows.find(q => q.isPlayer);
    return me && me.facts ? starStrip(me.facts.stars, 11) : '';
}
// Your place in race i of the active cup or series, as the tile tag says it: "1st", "DNF".
function _raceResultTag(i) {
    const r = Series.active && Series.active.results[i];
    const me = r && r.rows && r.rows.find(q => q.isPlayer);
    if (!me) return '';
    return me.status ? me.status : (me.pos ? _ordinal(me.pos) : '');
}
// One rule for both rails: which class and which tag a race gets from its state.
function _raceTileSpec(i, cur, nowWord) {
    if (cur == null || i < cur) { const res = _raceResultTag(i); return { cls: 'done', tag: `✓ Race ${i + 1}${res ? ' · ' + res : ''}` }; }
    if (i === cur) return { cls: 'sel', tag: `Race ${i + 1} · ${nowWord}` };
    return { cls: 'up', tag: `Race ${i + 1}` };
}

// ESC AS "BACK" (Wes, Sep 6): whatever the screen's own back button would do. Dialogs
// (settings, the record book, the character picker, the abandon confirm) are peeled off
// first by the key handler in input.js; this is only reached with none of them open.
function clubhouseBack() {
    const up = (el) => el && !el.classList.contains('hidden');
    const idle = state.race.status === 'waiting' && !_venueLoading;
    if (!idle) return false;
    const inS = !!(window.Series && Series.active);
    if (up(UI.fleetOverlay)) {
        if (inS && _fleetFrom !== 'board') { const k = Series.active.kind; Series.abandon(); if (k === 'cup') showCupPicker(); else showSeriesPicker(); }
        else showRaceBoard();
        return true;
    }
    if (up(UI.cupOverlay) || up(UI.seriesOverlay)) { showClubhouse(); return true; }
    if (up(UI.standingsOverlay)) {
        if (Series.finished()) { Series.abandon(); restartRace(); } else toggleAbandon(true);
        return true;
    }
    if (up(UI.preRaceOverlay)) { if (inS) toggleAbandon(true); else showClubhouse(); return true; }
    return false;   // the hub: nowhere further back to go
}

// ── the hub ──────────────────────────────────────────────────────────────────
// The hub's painting. null until the hero master is ingested (art/manifest.json
// `hero-clubhouse` -> assets/images/hero/clubhouse.png); the home venue's card stands in.
const HUB_HERO = 'assets/images/hero/hero-clubhouse-trio.jpg';   // the JPEG ingest writes beside the PNG master

function showClubhouse() {
    if (!UI.clubhouse) return;
    refreshClubhouse();
    _chShow(UI.clubhouse);
    if (typeof presentUnlocks === 'function') presentUnlocks();   // anything earned on the way out
}
// Every door shows its state; the school keeps the primary dress until you graduate.
function refreshClubhouse() {
    if (!UI.clubhouse || !window.Series) return;
    const $ = (id) => document.getElementById(id);
    const grad = !!(window.School && School.graduated());
    const door = $('door-school');
    if (door) {
        door.classList.toggle('primary', !grad);
        // The front door until you graduate; the last door after. Moving the element keeps
        // every handler and id, so nothing else has to know the order changed.
        const row = door.parentElement;
        // The doors keep their markup order — Cup, Time Trials, Series, Sailing School (Wes,
        // Sep 14 2026). The school used to jump to the front until graduation; the START HERE
        // pill carries that now.
    }
    const chip = $('door-school-chip'); if (chip) chip.classList.toggle('hidden', grad);
    // Four dots, one per section, filled as each is completed (all four once graduated).
    if (door) {
        const pic = door.querySelector('.ch-door-pic');
        const dots = (window.School && School.unitsDone) ? School.unitsDone() : [false, false, false, false];
        let holder = pic && pic.querySelector('.ch-dots');
        if (pic && !holder) {
            holder = document.createElement('div'); holder.className = 'ch-dots';
            holder.style.cssText = 'position:absolute; right:12px; bottom:12px; display:flex; gap:7px; padding:7px 10px; border-radius:999px; background:rgba(6,14,26,0.72);';
            pic.appendChild(holder);
        }
        if (holder) {
            holder.title = `${dots.filter(Boolean).length} of 4 sections completed`;
            holder.innerHTML = dots.map(d => `<span style="width:11px; height:11px; border-radius:999px; border:2px solid #7ff0d4; background:${d ? '#7ff0d4' : 'transparent'};"></span>`).join('');
        }
    }
    const st = $('door-school-state'); if (st) { st.textContent = grad ? 'Graduated' : 'Not yet graduated'; st.style.color = grad ? '#7f8ea9' : '#7ff0d4'; }
    // No "Earn here" strip on the school door (Wes, Sep 26 2026: the faces distract and the
    // link cannot really be clicked from a door). The pond's objectives are listed on the
    // school's own first screen instead — School.screenContent('A').
    if (door) { const old = door.querySelector('.ch-earn'); if (old) old.remove(); }
    const cta = $('door-school-cta'); if (cta) cta.innerHTML = (grad ? 'Sail again ' : 'Start school ') + _CH_ARROW;
    const t = Series.trophies();
    const won = Series.cupsWon();
    // The best result in a cup you have NOT won stays on the door (Wes, Sep 13 2026) — the
    // cup page says "Sailed · best 6th", and the door should not forget it the moment you
    // walk out. With no cup sailed at all the line says so.
    const unwon = CUPS.map(c => ({ c, t: t[c.id] })).filter(x => x.t && x.t.sailed && !x.t.won && x.t.best);
    const bestUnwon = unwon.length ? unwon.reduce((a, b) => (b.t.best < a.t.best ? b : a)) : null;
    const bestTxt = bestUnwon ? `${_ordinal(bestUnwon.t.best)} in the ${bestUnwon.c.name.replace(/ Cup$/i, '')}` : '';
    // With a starred cup the door shows the stars and which cup; the best unwon result
    // otherwise. Both at once is too long for a door foot.
    const starred = CUPS.map(c => ({ c, t: t[c.id] })).filter(x => x.t && x.t.won && x.t.stars > 0);
    const topStar = starred.length ? starred.reduce((a, b) => (b.t.stars > a.t.stars ? b : a)) : null;
    const starTxt = topStar ? `${'\u2605'.repeat(topStar.t.stars)} ${topStar.c.name.replace(/ Cup$/i, '')}` : '';
    const cupState = $('door-cup-state');
    if (cupState) {
        cupState.textContent = won ? `${won} of ${CUPS.length} won${starTxt ? ' · ' + starTxt : bestTxt ? ' · best ' + bestTxt : ''}`
                             : bestTxt ? `No cup yet · best ${bestTxt}` : 'No cups sailed yet';
        cupState.style.color = won ? '#f2c14e' : bestTxt ? '#c4d2e6' : '#7f8ea9';
    }
    const cupPic = $('door-cup-pic'); if (cupPic) cupPic.innerHTML = `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:18px; background:radial-gradient(420px 160px at 50% 100%, rgba(242,193,78,0.14), transparent);">${CUPS.map(c => trophyHTML(c, 84, trophyState(c.id))).join('')}</div>`;
    const sb = t.series && t.series.best;
    // Pennants won, else the best result — like the cup door.
    const pens = Series.pennants(), pWon = pens.filter(p => p.won).length;
    const seriesState = $('door-series-state');
    if (seriesState) {
        seriesState.textContent = pWon ? `${pWon} of ${pens.length} pennants` : sb ? `Best ${_ordinal(sb.rank)} · ${sb.n} races` : 'No series yet';
        seriesState.style.color = pWon ? '#f2c14e' : sb ? '#c4d2e6' : '#7f8ea9';
    }
    // THE DRAW AS A HAND OF CARDS (design 21a): three venue cards fanned on a graphite
    // stage, the outer two splayed and tilted, the middle one on top, all peeking up from
    // the bottom edge — a draw you could pick up. Dealt once per visit, not on every refresh.
    const seriesPic = $('door-series-pic');
    if (seriesPic && !seriesPic.children.length) {
        const hand = Series.draw(3);
        const card = (k, i) => {
            const tf = i === 0 ? 'translateX(-50%) translateX(-58px) rotate(-14deg)' : i === 2 ? 'translateX(-50%) translateX(58px) rotate(14deg)' : 'translateX(-50%)';
            const shadow = i === 1 ? '0 10px 24px rgba(0,0,0,0.6)' : '0 8px 20px rgba(0,0,0,0.5)';
            return `<div class="ch-fan-card" style="position:absolute; left:50%; bottom:${i === 1 ? -20 : -28}px; width:110px; height:90px; border-radius:8px; border:2px solid #fff; overflow:hidden; box-shadow:${shadow}; transform:${tf}; z-index:${i === 1 ? 2 : 1};">${venueThumb(k, escapeHTMLText(venueDisplayName(k) || k), 110)}</div>`;
        };
        seriesPic.innerHTML = `<div style="position:absolute; inset:0; background:radial-gradient(ellipse at 50% 110%, #2a3450, #111a2e 70%);">${[0, 2, 1].map(i => card(hand[i], i)).join('')}</div><div id="door-series-rack" style="position:absolute; top:10px; left:12px; background:rgba(6,14,26,0.72); border-radius:999px; padding:5px 9px;"></div>`;
    }
    // The pennant rack over the cards, refreshed on every visit (the cards are dealt once).
    const rack = $('door-series-rack'); if (rack) rack.innerHTML = pennantRack(26, 3);
    // The door previews the last venue picked on the race board (settings.lastRaceVenue).
    // A profile from before that key existed falls back to `venue` once, until a pick.
    const last = VENUE_ORDER.includes(settings.lastRaceVenue) ? settings.lastRaceVenue
               : (settings.venue && VENUE_ORDER.includes(settings.venue)) ? settings.venue : 'bay';
    const raceState = $('door-race-state'); if (raceState) { raceState.textContent = venueDisplayName(last) || last; raceState.style.cssText = "min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"; }
    const racePic = $('door-race-pic');
    if (racePic) {
        racePic.innerHTML = `<img src="assets/images/venues/${last}.png" alt="${escapeHTMLText(venueDisplayName(last) || last)}" draggable="false">`;
        // The record for that venue, as the briefing states it: your best time in gold, else
        // the course's time to beat. The door says "Set a record" — this is the number.
        const best = (typeof bestForVenue === 'function') ? bestForVenue(last) : null;
        const prov = (typeof provisionalRecord === 'function') ? provisionalRecord(last) : null;
        const rec = best && best.t != null ? { label: 'Your best', t: best.t, mine: true } : (prov != null ? { label: 'Time to beat', t: prov, mine: false } : { label: 'No record yet', t: null, mine: false });
        // m:ss.s — the door is a glance, not the records book.
        const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
        racePic.insertAdjacentHTML('beforeend', `<span class="ch-chip" style="position:absolute; right:12px; bottom:12px; display:inline-flex; align-items:center; gap:8px; background:rgba(6,14,26,0.8); color:${rec.mine ? '#f2c14e' : rec.t != null ? '#dbeafe' : '#9fb2cc'}; border:1px solid ${rec.mine ? 'rgba(242,193,78,0.5)' : 'rgba(255,255,255,0.22)'};">${rec.label}${rec.t != null ? ` <span class="t-mono" style="font-size:13px; letter-spacing:0; text-transform:none;">${fmt(rec.t)}</span>` : ''}</span>`);
    }
    for (const id of ['hub-hero-img', 'hub-hero-bg']) { const el = $(id); if (el && HUB_HERO && el.getAttribute('src') !== HUB_HERO) el.src = HUB_HERO; }
    // Who you are, in the header. Locked mid-series, so the pill says so then.
    const me = playerCharacter();
    const skImg = $('hub-skipper-img'); if (skImg) { skImg.src = `assets/images/competitors/${me.name.toLowerCase()}.png`; skImg.alt = me.name; }
    const skName = $('hub-skipper-name'); if (skName) skName.textContent = me.name;
    // Sailors = the ones you have: the starting ten plus everyone unlocked (all of them when unlocks are off).
    const sailors = (typeof AI_CONFIG !== 'undefined') ? AI_CONFIG.filter(c => !window.Unlocks || Unlocks.isUnlocked(c.name)).length : 0;
    const tally = $('clubhouse-tally'); if (tally) tally.textContent = `${Series.pool().length} venues · ${CUPS.length} cups · ${sailors} sailors`;
}
// The race board — the pre-race overlay, in whichever dress the moment calls for.
function showRaceBoard() {
    hideClubhouseOverlays();
    if (UI.resultsOverlay) UI.resultsOverlay.classList.add('hidden');
    setupPreRaceOverlay();
}

// ── cups ─────────────────────────────────────────────────────────────────────
let _cupSel = null;
function showCupPicker() { renderCupPicker(); _chShow(UI.cupOverlay); }
function renderCupPicker() {
    const list = document.getElementById('cup-list'); if (!list) return;
    const t = Series.trophies();
    if (!_cupSel) _cupSel = (CUPS.find(c => !(t[c.id] && t[c.id].won)) || CUPS[0]).id;
    list.innerHTML = CUPS.map(c => {
        const tr = t[c.id], won = !!(tr && tr.won), sel = c.id === _cupSel;
        const cupStars = won ? (tr.stars || 0) : 0;
        const stateText = won ? `Won${cupStars ? ' ' + '\u2605'.repeat(cupStars) : ''} · best ${tr.bestPts} pts` : (tr && tr.sailed) ? `Sailed · best ${_ordinal(tr.best)}` : 'Not yet sailed';
        return `<button type="button" class="ch-cup${sel ? ' sel' : ''}" data-cup="${c.id}">
            <div class="flex flex-col items-center justify-center" style="position:relative; gap:6px;">${trophyHTML(c, 120, trophyState(c.id))}${won ? starStrip(cupStars, 14) : ''}${
                // A podium finish IS the trophy's metal. Anything worse shows the greyed cup with
                // your best place over it, so a cup you have sailed never looks like one you haven't.
                (tr && tr.sailed && !won && tr.best > 3)
                    ? `<span class="t-mono" style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); font-size:19px; color:#eef3fb; background:rgba(6,14,26,0.86); border:1px solid rgba(255,255,255,0.28); border-radius:999px; padding:5px 13px; letter-spacing:0.04em; white-space:nowrap;">${_ordinal(tr.best)}</span>`
                    : ''}</div>
            <div class="flex flex-col" style="gap:8px; min-width:0;">
                <div class="t-display uppercase ch-cup-name" style="font-size:36px; line-height:0.98;">${c.name}</div>
                <div class="ch-cup-blurb" style="font-size:14px; line-height:1.5; color:#d5ecf5;">${c.blurb}</div>
                <div class="t-label t-label-sm ch-cup-state" style="color:${won ? '#f2c14e' : '#7f8ea9'};">${stateText}</div>
                <div class="ch-cup-cta" style="margin-top:auto; padding-top:10px;">${sel ? `<span class="res-btn res-btn-primary js-cup-start" style="display:inline-block;">Sail this cup ${_CH_ARROW}</span>` : `<span class="res-btn" style="display:inline-block;">Select</span>`}</div>
            </div>
            <div class="ch-cup-venues">${c.venues.map((k, i) => _routeTile(k, 'ch-cup-tile', String(i + 1), null, 260)).join('')}</div>
        </button>`;
    }).join('');
    list.querySelectorAll('.ch-cup').forEach(b => b.addEventListener('click', (e) => {
        const id = b.dataset.cup;
        if (id === _cupSel && e.target.closest('.js-cup-start')) { startCup(id); return; }
        _cupSel = id; renderCupPicker();
    }));
}
function startCup(id) {
    if (state.race.status !== 'waiting' || _venueLoading) return;
    if (!Series.startCup(id)) return;
    enterSeriesRace();   // straight to the race 1 briefing; the fleet is a detour from there
}

// ── the Race door ────────────────────────────────────────────────────────────
// RACE (Wes, Sep 27 2026): the fleet, one race or a series of up to thirteen — drawn at random from
// every venue (Redraw is free until you start), or picked by hand in the order you
// click them, Clubhouse Point included. Four races or more fly a pennant (the biggest tier the
// length reaches) and count for the series achievements. The solo race is Time Trials.
// NOTHING PRESELECTED (PT-011, Wes): the hub door opens it fresh — Pick, nothing picked, and no
// draw until you say how many. The last visit's picks had turned a click on one venue into a 2-race
// series. Coming BACK from race 1's briefing (`fresh` false) keeps what you chose.
let _seriesLen = 0, _seriesDraw = null, _seriesMode = 'pick', _seriesPicks = [];
function showSeriesPicker(fresh) {
    if (fresh) { _seriesLen = 0; _seriesDraw = null; _seriesMode = 'pick'; _seriesPicks = []; }
    renderSeriesPicker(); _chShow(UI.seriesOverlay);
}
function _seriesChosen() { return _seriesMode === 'pick' ? _seriesPicks.slice() : (_seriesDraw || []); }
function renderSeriesPicker() {
    const $ = (id) => document.getElementById(id);
    const lens = $('series-lengths'), grid = $('series-draw'), note = $('series-draw-note');
    if (!lens || !grid) return;
    if (!_seriesDraw && _seriesLen) _seriesDraw = Series.draw(_seriesLen);
    const pick = _seriesMode === 'pick';
    document.querySelectorAll('#series-mode .ch-mode').forEach(b => {
        b.classList.toggle('sel', b.dataset.mode === _seriesMode);
        b.onclick = () => { _seriesMode = b.dataset.mode; renderSeriesPicker(); };
    });
    // How many races: 1..12 when drawing; when picking, the count is what you have picked.
    const pens = Series.pennants();
    const nNow = pick ? _seriesPicks.length : _seriesLen;
    $('series-len-title').textContent = pick ? `${nNow} race${nNow === 1 ? '' : 's'} picked` : 'How many races?';
    lens.style.display = pick ? 'none' : '';
    lens.innerHTML = Array.from({ length: RACE_MAX }, (_, i) => i + 1).map(n => {
        const tier = SERIES_LENGTHS.includes(n) ? pens.find(q => q.n === n) : null;
        return `<button type="button" class="ch-len${n === _seriesLen ? ' sel' : ''}" data-n="${n}"><span class="t-display n">${n}</span>`
            + (tier ? `<span style="margin-top:2px;">${pennantHTML(n, !!tier.won, 22)}</span>` : `<span style="height:24px;"></span>`) + `</button>`; }).join('');
    lens.querySelectorAll('.ch-len').forEach(b => b.addEventListener('click', () => { _seriesLen = +b.dataset.n; _seriesDraw = Series.draw(_seriesLen); renderSeriesPicker(); }));
    const tier = pennantTier(nNow), tp = tier ? pens.find(q => q.n === tier) : null;
    $('series-pennant-note').textContent = nNow === 0 ? (pick ? 'Click venues in the order you want to race them — any or all of them.' : 'Choose how many races, and the venues are drawn for you.')
        : nNow === 1 ? 'One race against the fleet. No standings, no pennant.'
        : nNow < 4 ? `${nNow} races, one set of standings. Four or more races fly a pennant.`
        : `Sails for the ${tier}-race pennant${tp && tp.won ? ' — already yours' : tp && tp.best ? ` · your best ${_ordinal(tp.best)}` : ''}.`;
    // Scoring only means something across races: a single race is just "finish as high as you
    // can", and explaining points there was noise (PT-010).
    $('series-scoring').style.display = nNow === 1 ? 'none' : '';
    const drawn = !pick && !!_seriesDraw;
    $('series-right-title').textContent = pick ? 'Pick your venues' : nNow === 1 ? 'Your venue' : 'Your draw';
    $('series-bar-note').textContent = pick ? (_seriesPicks.length ? 'Click a picked venue again to take it out.' : 'Pick at least one venue.')
        : drawn ? 'Not the draw you wanted? Redraw as often as you like — it is free until you start.' : 'Choose how many races.';
    $('series-redraw-btn').style.display = drawn ? '' : 'none';
    const chosen = _seriesChosen();
    $('series-start-label').textContent = chosen.length === 1 ? 'Sail this race' : 'Sail this series';
    $('series-start-btn').disabled = !chosen.length;
    $('series-start-btn').style.opacity = chosen.length ? '' : '0.4';
    if (pick) {
        const all = VENUE_ORDER.slice();
        grid.style.gridTemplateColumns = 'repeat(5, minmax(0, 1fr))';
        grid.innerHTML = all.map(k => { const i = _seriesPicks.indexOf(k);
            return `<div class="ch-pick${i >= 0 ? ' on' : ''}" data-k="${k}">${_routeTile(k, '', '', 1.4, 220)}${i >= 0 ? `<span class="ch-pick-n">${i + 1}</span>` : ''}</div>`; }).join('');
        grid.querySelectorAll('.ch-pick').forEach(el => el.addEventListener('click', () => {
            const k = el.dataset.k, i = _seriesPicks.indexOf(k);
            if (i >= 0) _seriesPicks.splice(i, 1); else if (_seriesPicks.length < RACE_MAX) _seriesPicks.push(k);
            renderSeriesPicker(); }));
        if (note) note.textContent = _seriesPicks.length ? `${_seriesPicks.length} race${_seriesPicks.length === 1 ? '' : 's'} · about ${_seriesPicks.length * 5} minutes on the water` : '';
        return;
    }
    if (!drawn) { grid.innerHTML = ''; if (note) note.textContent = ''; return; }
    const n = _seriesDraw.length;
    const cols = n <= 4 ? n : n <= 6 ? 3 : 4;
    grid.style.gridTemplateColumns = `repeat(${Math.max(cols, 2)}, minmax(0, 1fr))`;
    const tilePx = n <= 4 ? 260 : n <= 6 ? 360 : 260;
    grid.innerHTML = _seriesDraw.map((k, i) => _routeTile(k, '', n === 1 ? escapeHTMLText(venueDisplayName(k) || k) : `Race ${i + 1}`, n > 6 ? 1.8 : (n > 4 ? 1.4 : n === 1 ? 1.6 : 1), tilePx)).join('');
    if (note) note.textContent = `${n} race${n === 1 ? '' : 's'} · about ${n * 5} minutes on the water`;
}

// Onto the board for the current race of the cup or series.
function enterSeriesRace(opts) {
    if (!Series.active) return;
    settings.venue = Series.currentVenue();
    saveSettings();
    resetGame();
    // At a start the fleet page comes first (you can still change skipper); between races
    // the fleet is locked, so the briefing is next.
    if (opts && opts.fleetFirst) showFleetPage({ from: 'picker' }); else showRaceBoard();
}

// ── the fleet page ───────────────────────────────────────────────────────────
// Between choosing and starting: you (changeable until race one of a cup or series starts)
// and the nine rivals with their scouting notes. A single race starts from here; a cup or
// series goes on to its first briefing.
let _fleetFrom = 'board';
function showFleetPage(opts) {
    if (!UI.fleetOverlay) return;
    const inS = !!(window.Series && Series.active);
    _fleetFrom = (opts && opts.from) || (inS ? 'picker' : 'board');
    _chShow(UI.fleetOverlay);
    // Render AFTER un-hiding: the boat previews measure the band they sit in.
    selectedCompetitor = null;
    renderCompetitorGrid();
    if (UI.fleetCrumb) UI.fleetCrumb.textContent = !inS ? 'THE FLEET · TIME TRIAL' : Series.total() === 1 ? 'RACE · THE FLEET' : `${Series.active.name} · the fleet for all ${Series.total()} races`.toUpperCase();
    const fromBoard = _fleetFrom === 'board';
    if (UI.fleetBackLabel) UI.fleetBackLabel.textContent = inS ? (fromBoard ? 'Briefing' : (Series.active.kind === 'cup' ? 'Cups' : 'Race')) : 'Venues';
    if (UI.fleetPrimaryBtn) UI.fleetPrimaryBtn.innerHTML = inS ? (fromBoard ? `Back to the briefing ${_CH_ARROW}` : `Race 1 briefing ${_CH_ARROW}`) : `Start Race ${_CH_ARROW}`;
    if (UI.fleetContext) {
        const key = settings.venue, c = venueCard(key);
        const me = playerCharacter();
        UI.fleetContext.innerHTML = `
            <div class="t-label t-label-sm" style="color:#dbeafe;">${inS ? (Series.total() === 1 ? 'One race' : 'Race 1 of ' + Series.total()) : 'Time trial'}</div>
            <div style="border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.09); background:#101a2e;">
                <div class="pr-venue-shot" style="aspect-ratio:1.5; border-radius:0; box-shadow:none;">${venueThumb(key, escapeHTMLText(c.name || key), 400)}</div>
                <div class="flex flex-col" style="padding:16px 20px 18px; gap:6px;">
                    <div class="t-display uppercase" style="font-size:30px; line-height:0.98;">${escapeHTMLText(c.name || venueDisplayName(key) || key)}</div>
                    <div style="font-size:13px; line-height:1.5; color:#d5ecf5;">${escapeHTMLText(c.blurb || '')}</div>
                </div>
            </div>
            <div class="ch-panel flex flex-col" style="gap:10px;">
                <div class="t-label t-label-sm" style="color:#dbeafe;">You're sailing as</div>
                <div class="t-display uppercase" style="font-size:28px; line-height:1;">${escapeHTMLText(me.name)}</div>
                <div class="t-mono" style="font-size:12px; color:#9fb2cc;">${escapeHTMLText(me.creature || '')}</div>
                <button id="fleet-change-btn" class="res-btn" style="align-self:flex-start; padding:11px 18px; font-size:13px;">Change skipper</button>
                <div style="font-size:13px; line-height:1.5; color:#9fb2cc;">${inS ? `Your skipper and this fleet lock when race 1 starts, for the whole ${escapeHTMLText(Series.active.kind)}.` : 'Click a rival for their scouting notes.'}</div>
            </div>`;
        const cb = document.getElementById('fleet-change-btn');
        if (cb) cb.addEventListener('click', (e) => { e.preventDefault(); openCharacterPicker(); });
    }
}

// The route strip on the board: every race of it, sailed / now / to come.
function renderRouteStrip() {
    if (!UI.prRouteGrid || !window.Series || !Series.active) return;
    const s = Series.active, n = s.venues.length, cur = s.index;
    const twoCols = n > 6;
    UI.prRouteGrid.style.gridTemplateColumns = twoCols ? 'repeat(2, minmax(0, 1fr))' : '1fr';
    UI.prRouteGrid.innerHTML = s.venues.map((k, i) => { const sp = _raceTileSpec(i, cur, 'NOW');
        return _routeTile(k, 'pr-route-tile ' + sp.cls, sp.tag, twoCols ? 2.0 : 2.6, twoCols ? 210 : 430, _raceStarsExtra(i)); }).join('');
    if (UI.prRightTitle) UI.prRightTitle.innerHTML = `<span style="color:#f2c14e; font-size:14px; vertical-align:middle;">&#9679;</span> ${s.kind === 'cup' ? 'The cup, race by race' : 'The series, race by race'}`;
    if (UI.prRouteNote) UI.prRouteNote.textContent = cur === 0 ? 'Your skipper locks when you start race 1' : _standingsBlurb();
}
function _standingsBlurb() {
    const table = Series.standings(); const me = table.find(r => r.isPlayer); if (!me) return '';
    const done = Series.active.results.filter(Boolean).length;
    if (me.rank === 1) { const gap = table[1] ? me.total - table[1].total : 0; return `After race ${done}: you lead${gap ? ` by ${gap}` : ' on the tie-break'}`; }
    return `After race ${done}: you're ${_ordinal(me.rank)}, ${table[0].total - me.total ? `${table[0].total - me.total} behind ${table[0].name}` : `level with ${table[0].name}`}`;
}

// ── between races ────────────────────────────────────────────────────────────
// The results page's own finish order: finishers by time, then DNF, then DNS, then anyone
// still on the water — by progress, since they are behind whoever is looking at the page.
function finishOrder() {
    const score = (boat) => !boat.raceState.finished ? 3 : boat.raceState.resultStatus === 'DNS' ? 2 : boat.raceState.resultStatus === 'DNF' ? 1 : 0;
    return [...state.boats].sort((a, b) => {
        const sa = score(a), sb = score(b);
        if (sa !== sb) return sa - sb;
        if (sa === 0) return a.raceState.finishTime - b.raceState.finishTime;
        return getBoatProgress(b) - getBoatProgress(a);
    });
}
function styleResultsButtons() {
    const inS = !!(window.Series && Series.active) && !_oneRace();
    if (UI.resultsRestartButton) UI.resultsRestartButton.textContent = inS ? `Abandon ${Series.active.kind}` : 'Back to Clubhouse';
    const trial = !!(window.TimeTrial && TimeTrial.solo()) && state.boats.length === 1;
    if (UI.resultsRematchButton) UI.resultsRematchButton.innerHTML = inS ? `Standings ${_CH_ARROW}` : trial ? 'Retry &#8635;' : 'Rematch &#8635;';
}
function proceedToStandings() {
    if (!window.Series || !Series.active) return;
    if (!Series.active.results[Series.active.index]) Series.recordRace(finishOrder());
    const final = Series.finished();
    if (window.Unlocks) { Unlocks.flush(finishOrder()); if (final) Unlocks.seriesFinal(Series.summary()); presentUnlocks(); }
    if (final) Series.recordFinal();
    renderStandings(final);
    _chShow(UI.standingsOverlay);
}
// The route down the side of the standings: every race as a wide tile, sailed / next / to
// come, in one column up to six races and two beyond, sharing whatever height is left.
function _routeList(s, n, nextIdx) {
    const twoCols = n > 6;
    const tiles = s.venues.map((k, i) => { const sp = _raceTileSpec(i, nextIdx, 'NEXT');
        return _routeTile(k, `ch-fill-tile ${sp.cls}`, sp.tag, null, twoCols ? 200 : 420, _raceStarsExtra(i)); }).join('');
    return `<div class="ch-route-list" style="grid-template-columns:${twoCols ? 'repeat(2, minmax(0, 1fr))' : '1fr'};">${tiles}</div>`;
}

function renderStandings(final) {
    const $ = (id) => document.getElementById(id);
    const s = Series.active, table = Series.standings(), n = s.venues.length, done = s.results.filter(Boolean).length;
    const me = table.find(r => r.isPlayer) || table[0];
    const crumb = $('standings-crumb'); if (crumb) crumb.textContent = `${s.name} · ${final ? 'final standings' : `standings after race ${done} of ${n}`}`.toUpperCase();
    // A tie the player is part of is the one worth explaining.
    const note = $('standings-note');
    if (note) {
        const i = table.indexOf(me);
        const tied = (i > 0 && table[i - 1].total === me.total) || (i < table.length - 1 && table[i + 1].total === me.total);
        const cs = s.kind === 'cup' ? Series.cupStars(s) : null;
        const starNote = cs ? (cs.stars > 0 ? ` · on course for ${'\u2605'.repeat(cs.stars)}` : ' · no stars this time') : '';
        note.textContent = tied ? 'Tied on points? The better place in the last race wins.' : `${done} of ${n} race${n === 1 ? '' : 's'} sailed · 10 for a win, down to 1${final ? '' : starNote}`;
    }
    const cols = `--races:${n};`;
    // A race column's header is the venue's thumbnail with its race number: it reads at any
    // race count where a name would not, and the names live in the route on the right.
    const headThumb = (k, i) => `<div style="display:flex; justify-content:flex-end;"><div class="pr-venue-shot" title="Race ${i + 1} · ${escapeHTMLText(venueDisplayName(k) || k)}" style="width:${n > 8 ? 44 : 50}px; height:${n > 8 ? 34 : 38}px; aspect-ratio:auto; border-radius:6px; ${i < done ? '' : 'opacity:0.45;'}">${venueThumb(k, escapeHTMLText(venueDisplayName(k) || k), 50)}<span class="t-mono" style="position:absolute; left:4px; top:3px; font-size:10px; line-height:1; color:#eef3fb; background:rgba(6,14,26,0.78); border-radius:999px; padding:2px 5px;">R${i + 1}</span></div></div>`;
    const head = `<div class="ch-grid t-label" style="${cols} padding:0 14px 6px; font-size:10px; letter-spacing:0.14em; color:#66748c;"><div>Pos</div><div></div><div></div><div>Skipper</div>${s.venues.map(headThumb).join('')}<div style="text-align:right;">Total</div></div>`;
    const medal = (i) => i < 3 ? `<span style="display:inline-block; width:10px; height:10px; border-radius:999px; background:${['#f2c14e', '#c0c8d4', '#c88a5a'][i]};"></span>` : '';
    // YOUR ROW, THE WAY THE RESULTS TABLE DOES IT: border, tint and badge in your own boat
    // colour, numbers white like everyone else's. It was gold here and blue there, and the
    // two screens sit one click apart.
    const pb = state.boats.find(b => b.isPlayer);
    const meStyle = pb ? `background:${boatGlow(pb, 0.10)}; box-shadow:0 0 0 2px ${boatGlow(pb, 0.55)}, 0 0 18px ${boatGlow(pb, 0.30)};` : '';
    const meBadge = pb ? `<span class="t-label" style="font-size:9px; letter-spacing:0.12em; color:#0c1322; background:${deepBandFor(pb.colors.hull, pb.colors.spinnaker, pb.colors.spinAccent)}; border-radius:4px; padding:2px 5px; line-height:1.15; vertical-align:middle; margin-left:6px;">You</span>` : ' <span class="t-label t-label-sm">You</span>';
    const rows = table.map((r, i) => {
        const cfg = (typeof AI_CONFIG !== 'undefined') ? AI_CONFIG.find(c => c.name === r.name) : null;
        const cells = s.venues.map((k, j) => { const p = r.pts[j]; const sailed = j < done; return `<div class="t-mono" style="font-size:15px; text-align:right; color:${sailed ? '#eef3fb' : '#3d4a63'};">${sailed ? p : '&mdash;'}</div>`; });
        return `<div class="ch-grid ch-row${r.isPlayer ? ' me' : (i % 2 ? ' alt' : '')}" style="${cols}${r.isPlayer ? meStyle : ''}">
            <div class="t-mono" style="font-size:16px; color:#eef3fb;">${r.rank}</div>
            <div>${medal(i)}</div>
            <div><img src="assets/images/competitors/${escapeHTMLText(r.name.toLowerCase())}.png" alt="" style="width:42px; height:42px; object-fit:cover; border-radius:10px; background:${cfg ? bandColorFor(cfg.hull, cfg.spinnaker) : '#1f2937'}33;" draggable="false"></div>
            <div style="min-width:0;"><div class="t-display uppercase truncate" style="font-size:20px; line-height:1;">${escapeHTMLText(r.name)}${r.isPlayer ? meBadge : ''}</div><div class="t-mono" style="font-size:11px; color:#9fb2cc; margin-top:3px;">${escapeHTMLText(cfg ? cfg.creature : '')}</div></div>
            ${cells.join('')}
            <div class="t-mono" style="font-size:20px; text-align:right; color:#fff;">${r.total}</div>
        </div>`;
    }).join('');
    const tbl = $('standings-table'); if (tbl) tbl.innerHTML = head + rows;

    const hero = $('standings-hero'), side = $('standings-side');
    const cup = s.kind === 'cup' ? Series.cup(s.id) : null;
    if (final) {
        const winner = table[0];
        if (hero) {
            hero.classList.remove('hidden');
            hero.innerHTML = `${trophyHTML(cup, 120, rankState(me.rank))}
                <div class="flex flex-col" style="gap:8px;">
                    <div class="t-label" style="color:#f2c14e;">${me.rank === 1 ? 'Winner' : 'Final result'}</div>
                    <div class="t-display uppercase" style="font-size:56px; line-height:0.95;">${me.rank === 1 ? `You take the ${escapeHTMLText(s.name)}` : `${escapeHTMLText(winner.name)} takes the ${escapeHTMLText(s.name)}`}</div>
                    <div style="font-size:15px; line-height:1.5; color:#d5ecf5; max-width:720px;">${me.rank === 1 ? `${me.total} points over ${n} races.` : `You finished ${_ordinal(me.rank)} on ${me.total} points, ${winner.total - me.total} behind.`}${cup ? (me.rank === 1 ? ' The trophy goes on the shelf.' : ' The trophy stays on the shelf, waiting.') : ''}</div>
                    ${cup && me.rank === 1 ? (() => { const cs = Series.cupStars(s); return `<div class="flex items-center gap-3" style="margin-top:4px;">${starStrip(cs.stars, 20)}<span style="font-size:15px; color:${cs.stars >= 4 ? '#f2c14e' : '#d5ecf5'};">${starSentence(cs.stars, cs.missed, 'cup')}</span></div>`; })() : ''}
                    ${!cup && me.rank === 1 ? (() => { const lf = Series.lastFinal || {}; return `<div class="flex items-center gap-3" style="margin-top:4px;">${pennantHTML(n, true, 44)}<span style="font-size:15px; color:#f2c14e;">${lf.firstPennant ? `The ${n}-race pennant is yours.` : `The ${n}-race pennant, again.`}</span></div>`; })() : ''}
                </div>`;
        }
        if (side) side.innerHTML = `<div class="t-label t-label-sm shrink-0" style="color:#dbeafe;">The ${escapeHTMLText(s.kind)}, race by race</div>
            ${_routeList(s, n, null)}`;
    } else {
        if (hero) { hero.classList.add('hidden'); hero.innerHTML = ''; }
        // ONE LIST, IN RACE ORDER. The next race used to get its own card above the list and
        // then appear again inside it, so race 2 was on the rail twice and race 1 sat below
        // race 2. Now the rail is the races in order, the sailed ones greyed with your result,
        // the next one ringed and named as next, the rest plain.
        const next = Series.nextVenue();
        if (side) side.innerHTML = `<div class="t-label t-label-sm shrink-0" style="color:#dbeafe;">The ${escapeHTMLText(s.kind)}, race by race${next ? ` · next: ${escapeHTMLText(venueDisplayName(next) || next)}` : ''}</div>
            ${_routeList(s, n, done)}
            <div class="shrink-0" style="font-size:13px; line-height:1.5; color:#9fb2cc;">Abandoning ends the whole ${escapeHTMLText(s.kind)}. There is no restarting a race inside one.</div>`;
    }
    const ab = $('standings-abandon-btn'), nx = $('standings-next-btn');
    if (ab) ab.textContent = final ? 'Back to clubhouse' : `Abandon ${s.kind}`;
    if (nx) nx.innerHTML = final ? `Sail it again ${_CH_REDO}` : `Next race ${_CH_ARROW}`;
}
