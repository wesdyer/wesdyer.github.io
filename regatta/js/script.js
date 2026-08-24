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

const burgeeImg = new Image();
burgeeImg.src = 'assets/images/misc/salty-crew-yacht-club-burgee.png';

const palmImg = new Image();
palmImg.src = 'assets/images/misc/palm.png';

// ── Land textures ───────────────────────────────────────────────────────────
// An ISLAND_STYLE with an entry here is filled with a tiling surface instead of
// one flat colour. Only FIXED land: floes and bergs keep their baked faceted
// sprite, because a floe spins and a world-anchored pattern would slide across
// it as it turned.
//
// `tile` is the world units one square covers, from the asset's `tileWorld` in
// art/manifest.json. The camera is translate-only at 1:1, so a tile is downscaled
// ONCE into its pattern source rather than resampled per fill — and because the
// fill happens in world space, the texture stays nailed to the land underneath it
// while the camera moves over.
//
// `alpha` is baked into the pattern source, not applied at fill time. Compositing
// the tile over the flat colour once, here, costs one drawImage per style; doing it
// with globalAlpha would cost a second full-screen fill on every frame. The result
// is identical because land is opaque — the flat body colour is what would be under
// it. 0 is the old flat fill, 1 is the raw tile.
const LAND_TEXTURES = {
    ice:      { src: 'assets/images/terrain/arctic/snow.png',    tile: 512, alpha: 0.3 },
    granite:  { src: 'assets/images/terrain/arctic/granite.png', tile: 256, alpha: 0.3 },
    // Beach sand. Keyed to `tropical`, not to one venue: every sandy isle in the
    // game is the same material, so the cove, the lake islets and the lagoon all
    // inherit it rather than the bay owning a look the others fake with a flat
    // fill.
    //
    // 128, a QUARTER of the tile this asset was first authored against, and the
    // number is measured rather than picked. The other two textures size their
    // tile so the repeat is not countable across a big mass; this one is sized so
    // the features that CAN be resolved land at true size. At the art scale of
    // 9.2 world units per metre, 128 puts the shell chips at 4.9cm median and
    // 14cm at p95 — a shell fragment and a small beach stone. The old 512 made
    // those 20cm cobbles, which is why it read as a photograph zoomed too far in.
    //
    // Note what 128 is NOT doing: it is not what fixed the ripples the first art
    // had. Retiling cannot fix a periodicity problem — 512 -> 90 moved the
    // measured periodicity 5.44 -> 6.70, i.e. not at all, because a smaller tile
    // makes ripples smaller and never fewer. That took redrawing the asset. See
    // the manifest note; it is the transferable lesson here.
    //
    // 0.7 is a CONTRAST knob and nothing else, because the flat body above is set
    // to this tile's own mean: the blend cannot move the colour, only the spread
    // around it. That retires the mean-luma-shift warning the two arctic textures
    // carry, and it is why this alpha could be tuned on looks alone. 0.7 lands
    // on-screen surface contrast at 4.12, between the smooth-beach reference
    // (2.95) and the Varkala plate (8.33), which keeps the ground losing the
    // contrast fight with the boats as the texture class requires.
    tropical: { src: 'assets/images/terrain/bay/bay-sand.png',   tile: 128, alpha: 0.7 },
    // The 2026-08-08 batch, each with ISLAND_STYLES body already reset to its tile's
    // mean, so every alpha below is a pure contrast knob. The two swards start at 0.5
    // (their mottle is busier than sand's); the rock at 0.35, the granite precedent.
    coralsand:  { src: 'assets/images/terrain/lagoon/coralsand.png',  tile: 128, alpha: 0.7 },
    grass:      { src: 'assets/images/terrain/grass.png',            tile: 128, alpha: 0.5 },
    swampgrass: { src: 'assets/images/terrain/swamp/swampgrass.png', tile: 128, alpha: 0.5 },
    redrock:    { src: 'assets/images/terrain/redrock/sandstone.png', tile: 256, alpha: 0.35 },
    // Delivered 2026-08-09. Takes sand's 0.7 as pre-registered — its mottle is broad tonal
    // drift, not busy — and ISLAND_STYLES.mud is reset to this tile's own mean (#524731),
    // so the alpha stays a pure contrast knob.
    //
    // ⚠️ THIS IS THE QUIETEST TILE IN THE SET, by some way. Measured luma sd at tile scale
    // is 2.20 against sand's 3.93 and the two swards' 10-13, so 0.7 lands on-screen sd at
    // 1.54 — below coralsand (1.80) and only just above sandstone (1.38). That is the
    // subject doing what it was asked ("AT THIS HEIGHT MUD IS ALMOST FEATURELESS"), not a
    // fault, but it means this alpha has less room BELOW it than any other row: turning it
    // down erases the leaf litter, which is the only structure the tile has. If the bank
    // reads dead at race scale the move is UP (0.85 -> sd 1.87, 1.0 -> 2.20, still inside
    // the accepted band), never down.
    //
    // tile 128 is the manifest's, and it is a READABILITY floor rather than a true-size
    // pick — the one place this tile departs from the bay-sand recipe. Measured on the
    // delivered art, the litter marks run 18px median / 48px p95 in the 1024 master, which
    // at 128 puts them at 25cm median and 65cm p95: about 2x life size for a dead leaf.
    // Halving to 64 would fix the size and destroy the asset — the marks are already 2.2px
    // median ON SCREEN at 128, so at 64 every one of them dissolves into grey noise and the
    // bank becomes a flat brown field. Oversized leaves that read beat true-size leaves
    // that don't, so the scale error is taken deliberately. Do not "correct" it.
    mud:        { src: 'assets/images/terrain/swamp/mud.png',        tile: 128, alpha: 0.7 },
    // Delivered 2026-08-09, closing the bayou's ladder: sward -> marsh -> bare mud -> water.
    //
    // 0.4 IS A DEPARTURE FROM THE PRE-REGISTERED 0.5, and the reason is measured rather
    // than aesthetic. 0.5 was picked to "put it with the two swards, whose clump structure
    // it shares" — but that assumed it would arrive at their contrast, and it did not: sd
    // at tile scale is 16.17 against swampgrass's 10.21, half again as busy, because this
    // tile is a genuine TWO-material mix (light clump against dark mud) where a sward is
    // one material mottled. At 0.5 it would land on-screen sd 8.09 — the loudest ground in
    // the game, 20% past `grass` (6.74), which is backwards for the quiet middle term of a
    // three-step ladder. 0.4 lands 6.47: between the two swards, just under the loudest
    // accepted ground, with the clump structure fully intact. Same tile 128 as its two
    // neighbours.
    //
    // Grain was CHECKED, not assumed, because the manifest flagged even-scatter as this
    // tile's top risk. Component counting says the clumps are 2.4x swampgrass's, but that
    // is an artifact of comparing discrete clumps to a connected sward — on the radially
    // averaged power spectrum, which does not care about topology, marsh's dominant grain
    // is 128px in the master against swampgrass's and mud's 171px and `grass`'s 146px. It
    // is the FINEST-grained ground of the four, not the coarsest, so 128 is right and
    // retiling it to 64 would have halved it out of family. Use the spectrum, not blob
    // counts, if this is ever revisited.
    marsh:      { src: 'assets/images/terrain/swamp/marsh.png',      tile: 128, alpha: 0.4 },
    // ── LIGHTHOUSE COVE'S TWO GROUNDS ───────────────────────────────────────
    // Both delivered 2026-08-10, so both alphas below are now MEASURED and both bodies are
    // their delivered tile's own mean — with base equal to tile mean the blend cannot move
    // the colour, only the spread around it, so each alpha is a pure contrast knob.
    //
    // ⚠️ THE SCRUB CAME OFF ITS PRE-REGISTERED 0.5, and it is the marsh's argument again. Its
    // delivered mottle is much busier than the two swards it was sized against — luma sd 14.30
    // at tile 128, against swampgrass's 10.20 — so 0.5 would land on-screen sd 7.15, the
    // LOUDEST ground in the game and past `grass` (6.75). That is backwards for the material
    // most of Lighthouse Cove's land is made of, and for the class rule that a ground must
    // lose the contrast fight with the boats and props drawn on it. 0.40 lands 5.72, between
    // swampgrass (5.10) and grass (6.75), with the tussock and scrub structure fully intact.
    //
    // The rock kept 0.35: sd 8.10 at 256 puts it at 2.83, between the two shipped rocks
    // (sandstone 1.38, granite 4.91), so the pre-registered value was already right.
    //
    // TILE SIZE FOLLOWS THE MATERIAL, NOT THE VENUE, which is why these two differ. Grass
    // tussocks are centimetre-scale and land at true size at 128, with the cove's sand; a
    // rounded whaleback is metre-scale, and 256 spans 27.8 world metres, putting a hump at
    // 3-6 m across. That is a boulder, which is what it should be. Halving the rock to 128
    // would make it a cobble field.
    // ── STILLWATER LAKE'S THREE GROUNDS ─────────────────────────────────────
    // All three delivered 2026-08-14 and all three alphas MEASURED. Notably this is the
    // first batch where no alpha had to come down hard: the masters arrived at luma sd 6.97,
    // 9.32 and 6.74, against the ocean pair's 21.79 and 19.17, so there was room to spend.
    //
    // ⚠️ TWO RATIO METRICS FLAGGED THESE AND BOTH WERE WRONG, which is the transferable part.
    // On the radially averaged power spectrum lake-sand scores peak/mean 21.4 and lake-gneiss
    // 35.2 — far past the shipped range of 8.65-12.18 and enough to look like rejects. In
    // ABSOLUTE terms, which is what a player sees, their dominant-band amplitude is 1.75 and
    // 0.90 against grass's 3.34 and bay-scrub's 3.72: quieter than every shipped ground. The
    // gneiss's wrap ratio told the same lie — 1.50x the interior difference, against
    // ocean-coralrock's 1.47x which needed alpha held down to hide it — but 1.50x of a very
    // smooth tile is 0.81 LUMA UNITS, invisible at any alpha. A RATIO IS NORMALISED BY THE
    // BROADBAND FLOOR, so on a quiet tile it inflates without anything actually being wrong.
    // Judge periodicity and seams on ABSOLUTE amplitude; the ratio misleads in both
    // directions and has now done so four times on this venue pair.
    // ⚠️ RAISED 0.45 -> 0.70 ON 2026-08-15, and the reason is worth keeping. The lake's ground
    // was reading as flat plowed dirt beside the new forest, and the first guess was that the
    // TILE was wrong — too orange, too saturated. It is not: at sat 0.51 it sits mid-pack among
    // shipped grounds (grass 0.83, ocean-scrub 0.76, redrock-sandstone 0.75, bay-scrub 0.59).
    // What was actually wrong is that NONE OF ITS LITTER REACHED THE SCREEN. getLandPattern
    // squashes the WHOLE master into a tile x tile canvas, so a 1024px photograph of needles
    // and pebbles becomes 128px, and 0.45 of that landed at on-screen sd 3.14 — the quietest
    // ground on the lake, below its own sand at 4.21. At 0.70 it lands 4.89, beside bay-lane's
    // 5.08, and the needles read as needles. The mean does not move, because body IS the tile
    // mean; alpha here is contrast and nothing else.
    // A REPLACEMENT TILE WAS OFFERED AND DECLINED. It measured #83633D/sat 0.53 against this
    // one's #7B623C/sat 0.51 — the same colour — and the same on-screen sd at the same alpha,
    // so it did not address the complaint. It also carried a horizontal wrap seam of +1.81 luma
    // where this tile carries +0.47 at MORE texture. The alpha was the whole fix.
    forestfloor:  { src: 'assets/images/terrain/lake/forestfloor.png', tile: 128, alpha: 0.70 },
    // 0.45 rather than the sands' usual 0.70, because this tile carries real litter where a
    // beach carries almost nothing: it lands on-screen sd 4.19, between bay-lane (3.63) and
    // arctic granite (4.89). THE PEBBLES ARE WHY IT SITS THAT HIGH — they are what makes this
    // a glacial shore rather than a tinted beach, and at 0.30 they fade to a mottle.
    lakesand:     { src: 'assets/images/terrain/lake/sand.png',        tile: 128, alpha: 0.45 },
    // ⚠️ SECOND SLAB, 2026-08-15, AND THIS ONE IS THE CASE WHERE ALPHA COULD NOT HAVE SAVED IT.
    // Worth keeping next to the forest floor's note directly above, which is the opposite case.
    // The first slab was smooth to the point of being featureless: soft lavender blobs, full-res
    // sd 7.22, landing on-screen sd 2.70 — the quietest surface in the venue. Raising its alpha
    // to 1.00 would have taken it to 6.80, so CONTRAST was recoverable. What was not recoverable
    // is CONTENT: no fracture lines, no lichen, no whaleback edges. Turning the gain up on soft
    // blobs gives you louder soft blobs. The new slab carries the rock's actual structure, so
    // the redraw was the right call here and the alpha was the right call there — the test is
    // whether the thing you want is IN the tile and merely faint, or absent.
    // 0.55 measured: on-screen sd 5.55, between lake sand's 4.21 and the 6.66 ceiling. Higher
    // reads better on a single slab and worse across several, because this tile's structure is
    // strong enough that the 256-unit repeat becomes legible as wallpaper once it is loud.
    // ⚠️ tile STAYS 256. It is tempting to raise it to cut the repeat over a 700-unit slab, but
    // tile is in WORLD UNITS: 256 puts a whaleback lobe at about 28 m, which is what an ice-
    // scoured outcrop actually measures. 512 would halve the repetition and give 56 m lobes,
    // which is no longer granite, it is scenery.
    gneiss:       { src: 'assets/images/terrain/lake/gneiss.png',      tile: 256, alpha: 0.55 },

    // ── SOCKEYE RUN, delivered 2026-08-17 ───────────────────────────────────
    // Every alpha here is a PURE CONTRAST KNOB, because each ISLAND_STYLES.body above was
    // reset to its own tile's delivered mean first. They were not picked by eye: each tile's
    // luma sd was measured, and the alpha is what lands it in the on-screen band the shipped
    // grounds already occupy (1.57 for sandstone up to 8.87 for lake forestfloor). These four
    // sit at 6.6, 7.6, 7.9 and 4.6 — the busy end of the band, which is right for a venue
    // whose identity IS its ground.
    //
    // ⚠️ THE ALPHAS WERE CHOSEN AGAINST A TILED FIELD, NOT AGAINST THE MASTER, and that is the
    // whole reason these four shipped. Measured on the raw 1254px masters, all four carry a
    // wrap seam 1.5x to 3.3x an interior pixel boundary — by that number none of them tile.
    // Composited at these alphas over the flat body and drawn at the tile size the camera
    // actually sees, the seam is INVISIBLE across 4.7 to 9.4 repeats: the same alpha that tames
    // the contrast suppresses the discontinuity, because the seam error is multiplied by alpha
    // exactly as the texture is. Two earlier deliveries were rejected on the master-scale number
    // alone; that was the wrong test. Judge a texture tiled, composited and at size.
    // ⚠️ RAISING AN ALPHA RE-EXPOSES ITS SEAM. These are not free to tune upward.
    cobble:       { src: 'assets/images/terrain/river/cobble.png',   tile: 256, alpha: 0.42 },
    meadow:       { src: 'assets/images/terrain/river/meadow.png',   tile: 128, alpha: 0.50 },
    // Highest alpha of the four because its jointed facets ARE the read, and the one to watch
    // for repeats: it carries about twice the mid-scale structure of the other three, so a rock
    // mass more than three or four tiles across (110 m+) starts showing its pattern. Keep
    // outcrop shapes small, which is what a rock in a rapid is anyway.
    outcrop:      { src: 'assets/images/terrain/river/outcrop.png',  tile: 256, alpha: 0.65 },
    humus:        { src: 'assets/images/terrain/river/humus.png',    tile: 128, alpha: 0.70 },
    // ⚠️ THE BUSIEST TILE IN THE GAME, so this is the LOWEST alpha in the game and both facts are
    // the same fact. Tile-scale luma sd is 28.3 against a shipped range of 3.3-17.4, because a moss
    // carpet is thousands of tiny cushions and that is exactly what it should look like. 0.31 lands
    // it at on-screen sd 8.78, which matches lake forestfloor's 8.87 — the top of the band and the
    // right precedent, since both are forest floors. It reads as moss at this alpha; if it ever
    // looks flat in the venue, 0.55 doubles the cushion texture (on-screen sd 15.6) at the cost of
    // leaving the band, and a floor the fleet can never sail on is the one place that trade is
    // arguable.
    mossfloor:    { src: 'assets/images/terrain/river/mossfloor.png', tile: 128, alpha: 0.31 },
    // ── BLUEWATER BONANZA'S TWO GROUNDS ─────────────────────────────────────
    // Both delivered 2026-08-14. Both bodies in ISLAND_STYLES are their delivered tile's own
    // mean, so both alphas below are pure contrast knobs, and BOTH ARE MEASURED — these are
    // the two loudest masters the game has ever taken in, at luma sd 21.79 and 19.17 against
    // a previous worst of marsh's 16.39, so neither pre-registered value survived contact.
    //
    // THE ROCK CAME OFF 0.35 HARDER THAN ANYTHING BEFORE IT — 0.35 would land on-screen sd
    // 7.63, past every accepted ground including `grass` (6.66), on a material that is
    // supposed to be a quiet rock. 0.20 lands 4.36: between the two shipped hard rocks
    // (bay-rock 2.85, arctic granite 4.89), with the solution pitting still legible. Going
    // further down to bay-rock's own 2.85 was tried and rejected by eye — at 0.13 the tile
    // is a flat field and the pitting, which is this material's entire identity, is gone.
    //
    // ⚠️ THIS ALPHA IS ALSO WHAT FIXES THE ROCK'S SEAM, which is the non-obvious part. The
    // master does NOT wrap cleanly: at the 128px it draws at, its edge-to-edge difference is
    // 1.47x (horizontal) and 1.32x (vertical) the interior neighbour difference, where a
    // seamless tile sits at ~1.0 and the scrub below measures 1.11 / 0.87. A seam is a
    // CONTRAST artefact, so the same knob that quiets the tile quiets the seam: at 0.20 the
    // mismatch is under 4 luma units and invisible in a 3x3 tiling. Raise this alpha and the
    // seam comes back before the loudness does — that is the binding constraint here, not
    // the contrast band.
    coralrock:    { src: 'assets/images/terrain/ocean/coralrock.png', tile: 128, alpha: 0.20 },
    // 0.30, one step under the sward family's usual 0.40-0.50, because this master is the
    // busiest sward ever delivered (sd 19.17 against bay-scrub's 14.21). It lands on-screen
    // sd 5.75, effectively on top of bay-scrub's 5.68, between swampgrass (5.07) and grass
    // (6.66).
    //
    // ⚠️ PERIODICITY WAS MEASURED TWO WAYS AND ONLY THE SECOND ONE MEANS ANYTHING. On the
    // radially averaged power spectrum this tile scores peak/mean 20.34 at 4 cycles, by far
    // the worst in the set (shipped range 8.65-12.18) and enough to look like a reject. It
    // is not: peak/mean is normalised by the BROADBAND FLOOR, and this art has an unusually
    // smooth one, so the ratio inflates without the repeat actually being stronger. In
    // absolute on-screen terms — the sd carried by the dominant band, times alpha — it is
    // 3.48 at 0.30, BELOW bay-scrub's 3.72 and marsh's 3.68, both shipped and accepted. Use
    // the absolute amplitude when judging a repeat; the ratio will lie to you in both
    // directions.
    tropicscrub:  { src: 'assets/images/terrain/ocean/scrub.png',     tile: 128, alpha: 0.30 },
    coastalscrub: { src: 'assets/images/terrain/bay/bay-scrub.png', tile: 128, alpha: 0.4 },
    // Alpha MEASURED on the delivered tile, not pre-registered: sd 7.28 at tile 128, so 0.7
    // would land on-screen sd 5.10 — near the loud end of the 1.38-6.75 set, and wrong for a
    // narrow strip that must not pull the eye off the water. 0.5 lands 3.64, between sand
    // (2.80) and the scrub it is drawn across (5.72), with the shell chips fully intact.
    lane:         { src: 'assets/images/terrain/bay/bay-lane.png',  tile: 128, alpha: 0.5 },
    coastalrock:  { src: 'assets/images/terrain/bay/bay-rock.png',  tile: 256, alpha: 0.35 },
    // ── THE SAME GRANITE, SEEN THROUGH WATER ────────────────────────────────
    // Its own row rather than borrowing `granite` outright, because both numbers want to
    // change and neither may move on the arctic's mountains. It is the identical image file
    // — this is one stone, not two — with the tile HALVED and the alpha well under half.
    //
    // 128, so the fracture pattern is twice as fine. At 256 a drowned head is barely one
    // tile across and you read the individual cobbles as boulders the size of a boat, which
    // is the same "photograph zoomed too far in" failure the beach sand note describes. The
    // rock wants texture, not features.
    //
    // Alpha stays at granite's own 0.3 rather than being cut for the water, because the
    // WATER IS NOT WHAT DIMS THIS TILE — SUNKEN_DEPTH is, and it scales the pattern and the
    // base together after the fact. Cutting both is how the rock ended up with neither
    // darkness nor texture. Measured at matched darkness (-7 luma against the water), 0.13
    // gives an in-slab texture sd of 0.86 and 0.30 gives 1.17: the tile is barely legible
    // either way once the rock is properly dark, which is the honest look of a dark thing
    // under water at night, so this takes the version with more of it.
    sunkenrock:   { src: 'assets/images/terrain/arctic/granite.png', tile: 128, alpha: 0.30 }
};
for (const k in LAND_TEXTURES) {
    const t = LAND_TEXTURES[k];
    t.img = new Image();
    t.img.src = t.src;
    t.patterns = {};   // keyed by the base colour it is blended over
}

function getLandPattern(ctx, style, base) {
    const t = LAND_TEXTURES[style];
    if (!t) return null;
    if (t.patterns[base]) return t.patterns[base];
    if (!t.img.complete || !t.img.naturalWidth) return null;   // flat fill until it lands
    const c = document.createElement('canvas');
    c.width = c.height = t.tile;
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, t.tile, t.tile);
    g.globalAlpha = t.alpha;
    g.imageSmoothingQuality = 'high';
    g.drawImage(t.img, 0, 0, t.tile, t.tile);
    t.patterns[base] = ctx.createPattern(c, 'repeat');
    return t.patterns[base];
}

// Boat part sprites (uniform 16 px/world-unit on 1024^2 transparent canvases;
// exported from the vector shapes — drop-in replaceable with painted art).
// Anchors: hull sprite has the boat origin at px (512,472); each sail sprite
// has its tack/pivot at px (512,112) with the camber bulging toward +x.
const BOAT_SPRITE_SCALE = 16;
// Tint bakes downsample to 4 px/world-unit (256^2): boats are ~55 px on screen,
// so this stays ~4x oversampled for zoom while cutting texture memory and the
// per-frame GPU downsample ~16x vs baking at the 1024^2 authoring size.
const BOAT_SPRITE_BAKE = 4;
const boatSprites = { hull: new Image(), main: new Image(), jib: new Image(), spin: new Image() };
for (const k in boatSprites) boatSprites[k].src = 'assets/images/boat-parts/' + k + '.png';
// Hull shading. Boats rotate, so anything baked into the sprite has to be
// rotation-invariant — a directional "sun" would spin with the boat and read as
// wrong. Darkening toward the gunwale is direction-free and says the same thing:
// the topsides curve away from you. Elliptical, tracking the hull's own bbox
// (template x 252..772, y 62..964) as a fraction of the 1024 box.
// 0 = flat, 1 = the full effect below. Turn it down or to 0 to taste.
const HULL_SHADE = 0.55;
const HULL_SHADE_GEOM = { cx: 0.500, cy: 0.501, rx: 0.254, ry: 0.440 };
function shadeHullBake(g, size) {
    if (HULL_SHADE <= 0) return;
    const { cx, cy, rx, ry } = HULL_SHADE_GEOM;
    const px = cx * size, py = cy * size, r = rx * size;
    // Mix each stop back toward white by (1 - HULL_SHADE) so one knob scales it
    const stop = (v) => {
        const b = Math.round(255 - (255 - v) * HULL_SHADE);
        return `rgb(${b},${b},${b})`;
    };
    g.save();
    g.globalCompositeOperation = 'multiply';
    // Squash the circle into the hull's proportions so the falloff hugs the
    // sheerline instead of pooling at the bow and stern
    g.translate(px, py); g.scale(1, ry / rx); g.translate(-px, -py);
    const grad = g.createRadialGradient(px, py, r * 0.30, px, py, r);
    grad.addColorStop(0.00, stop(255));   // deck stays the pure paint colour
    grad.addColorStop(0.62, stop(246));
    grad.addColorStop(0.88, stop(226));
    grad.addColorStop(1.00, stop(203));   // gunwale
    g.fillStyle = grad;
    g.fillRect(-size, -size, size * 3, size * 3);
    g.restore();
}

// Spinnaker shading, worked out from aerial photographs of running boats by
// sampling single-colour panels across each sail, so panel colour can't be
// mistaken for shading.
//
// What the photographs actually show:
//   • a broad lit region over the OUTER belly — the face of the balloon — which
//     stays essentially full-strength colour; the sail is bright, not muddy;
//   • the deepest shadow pooled at the FOOT, where the sail hangs under its own
//     belly, and along the LUFF where it turns back toward the mast;
//   • the head bright, being nearest the sky;
//   • and the light wrapping in smooth CURVES that follow the sail's form.
//
// That last point is what an earlier attempt here got wrong. Crossed linear
// ramps put bands of constant brightness across the sail and read as a machined
// tube, not cloth. One elliptical falloff centred on the lit belly gives curved
// contours and reads as an inflated kite. (The two aerials disagree on how hard
// the head-to-foot falloff is — that is sun angle, not sail shape — so this
// takes the middle of them rather than fitting either exactly.)
//
// Both passes run in sprite space. The kite swings with the sail, mirrors on
// each tack and spins with the boat, so a fixed world light would be wrong three
// ways at once; the sail's own form is true from every angle.
// Sail occupies template x 504..840 (luff..max bulge), y 105..927 (head..foot).
// 0 = flat, 1 = the full effect below.
const SPIN_SHADE = 0.8;
function shadeSpinBake(g, size) {
    if (SPIN_SHADE <= 0) return;
    const s = size / 1024;
    const stop = (v) => {
        const b = Math.round(255 - (255 - v) * SPIN_SHADE);
        return `rgb(${b},${b},${b})`;
    };
    // The form: one elliptical falloff centred on the lit outer belly, set high
    // so the head keeps its light and the shadow gathers toward the foot
    g.save();
    g.globalCompositeOperation = 'multiply';
    const cx = 730 * s, cy = 370 * s, rx = 310 * s, ry = 500 * s;
    g.translate(cx, cy); g.scale(1, ry / rx); g.translate(-cx, -cy);
    const belly = g.createRadialGradient(cx, cy, rx * 0.18, cx, cy, rx);
    belly.addColorStop(0.00, stop(255));   // lit face — full-strength colour
    belly.addColorStop(0.48, stop(253));
    belly.addColorStop(0.74, stop(233));
    belly.addColorStop(0.90, stop(206));
    belly.addColorStop(1.00, stop(178));   // foot and the far edges
    g.fillStyle = belly;
    g.fillRect(-size, -size, size * 3, size * 3);
    g.restore();
    // The luff turning back on itself, a soft band rather than a hard edge
    g.save();
    g.globalCompositeOperation = 'multiply';
    const luff = g.createLinearGradient(504 * s, 0, 712 * s, 0);
    luff.addColorStop(0.00, stop(200));
    luff.addColorStop(0.33, stop(233));
    luff.addColorStop(1.00, stop(255));
    g.fillStyle = luff;
    g.fillRect(0, 0, size, size);
    g.restore();
}

// Paint jobs: multiply-tint a part once per color, then re-cut the silhouette.
// Composite ops only (no getImageData — file:// safe). Cache shared across boats.
const boatTintCache = new Map();
function getTintedBoatPart(part, color) {
    const key = part + '|' + color;
    let c = boatTintCache.get(key);
    if (c) return c;
    const img = boatSprites[part];
    if (!img.complete || !img.naturalWidth) return null;
    c = document.createElement('canvas');
    const size = Math.round(img.naturalWidth * BOAT_SPRITE_BAKE / BOAT_SPRITE_SCALE);
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, size, size);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = color;
    g.fillRect(0, 0, size, size);
    // Shading rides along in the same cached bake, so it costs nothing per frame.
    // Before the silhouette cut, since 'multiply' paints into transparent pixels.
    if (part === 'hull') shadeHullBake(g, size);
    if (part === 'spin') shadeSpinBake(g, size); // solid kites come through here
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(img, 0, 0, size, size);
    boatTintCache.set(key, c);
    return c;
}

// Spinnaker panel patterns: accent regions in the sprite's template space
// (1024 box, tack at (512,112), bulge +x). Regions are clipped by the art's
// alpha at bake time, so any future painted spinnaker inherits every pattern.
function spinWedge(g, s, cx, cy, a0, a1) {
    const tx = cx * s, ty = cy * s, R = 1400 * s;
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx + Math.cos(a0) * R, ty + Math.sin(a0) * R);
    g.lineTo(tx + Math.cos(a1) * R, ty + Math.sin(a1) * R);
    g.closePath();
}
// Display names for the patterns below. Kept adjacent so a new pattern that
// forgets a label is obvious; the pre-race player panel builds its dropdown
// from these, while the Settings modal hard-codes the same list in markup.
const SPIN_PATTERN_LABELS = {
    solid: 'Solid', halves: 'Halves', crosshalves: 'Cross Halves', gores: 'Gores',
    stripes: 'Stripes', rays: 'Rays', triangle: 'Triangle',
    thirds: 'Thirds', chevron: 'Chevron', sunburst: 'Sunburst', tricolour: 'Tricolour'
};
// DERIVED from the pattern data, never hand-maintained: no regions = one colour,
// any [3, fn] region = three, otherwise two. A new pattern is counted correctly
// the moment it is written, which a hand-kept list would not manage.
function spinColorCount(key) {
    const regions = SPIN_PATTERNS[key];
    if (!regions || !regions.length) return 1;
    return regions.some(r => Array.isArray(r)) ? 3 : 2;
}
// Fewest colours first, alphabetical within each count.
function spinPatternsByColorCount() {
    return Object.keys(SPIN_PATTERNS).sort((a, b) =>
        spinColorCount(a) - spinColorCount(b) ||
        (SPIN_PATTERN_LABELS[a] || a).localeCompare(SPIN_PATTERN_LABELS[b] || b));
}

const SPIN_PATTERNS = {
    solid: [],
    // Straight seam across the middle of the sail: head half / foot half
    halves: [(g, s) => { g.beginPath(); g.rect(0, 512 * s, 1024 * s, 1024 * s); }],
    // Diagonal split radiating from the head (the original "halves")
    crosshalves: [(g, s) => spinWedge(g, s, 512, 112, 0, 1.23)],
    gores: [1, 3].map(i => (g, s) => spinWedge(g, s, 512, 112, 0.89 + i * 0.136, 0.89 + (i + 1) * 0.136)),
    // Five even stripes head-to-foot (sail spans y 112-912): base/accent alternating
    stripes: [(g, s) => { g.beginPath(); g.rect(0, 272 * s, 1024 * s, 160 * s); },
              (g, s) => { g.beginPath(); g.rect(0, 592 * s, 1024 * s, 160 * s); }],
    // Rising-sun rays from the front-edge center (pairs with the triangle)
    rays: [1, 3, 5, 7].map(i => (g, s) =>
        spinWedge(g, s, 512, 512, -Math.PI / 2 + i * (Math.PI / 9), -Math.PI / 2 + (i + 1) * (Math.PI / 9))),
    // Triangle: tip on the straight (luff) edge at the BACK of the kite, opening
    // forward. The two rays run well past the leech, so the silhouette clips the
    // wide end into a curve that follows the sail's front edge — a wedge with a
    // rounded mouth rather than a flat-based triangle.
    triangle: [(g, s) => spinWedge(g, s, 512, 512, -0.70, 0.70)],

    // --- three-colour patterns -------------------------------------------------
    // The kite is roughly 40-60px at race scale, so these stay LARGE-FEATURED.
    // `stripes` at five bands of one accent is already near the limit; three
    // colours in finer divisions grey out into mush. Thirds, chevrons and
    // alternating rays survive because each field is big. See skills.md 8.2.
    //
    // Sail spans y 112-912. Thirds: head band base, middle accent, foot third.
    thirds: [(g, s) => { g.beginPath(); g.rect(0, 379 * s, 1024 * s, 267 * s); },
             [3, (g, s) => { g.beginPath(); g.rect(0, 646 * s, 1024 * s, 266 * s); }]],
    // Nested wedges radiating from the head — an arrow aimed at the masthead.
    //
    // GEOMETRY NOTE, learned the hard way twice. spinWedge takes CANVAS angles
    // (0 = +x, PI/2 = straight down) and the sail is NOT the full 1024 square: it
    // occupies x 504..840, y 105..927, luff straight down the left, bulging right.
    // From the head that subtends roughly 0.5..1.58 rad. Centring the wedges on 0
    // put them entirely off the sail and the pattern rendered as a plain solid;
    // sweeping the full 0.28..1.72 swallowed the base colour instead. These keep
    // base visible top-right and along the luff.
    chevron: [(g, s) => spinWedge(g, s, 512, 112, 0.68, 1.42),
              [3, (g, s) => spinWedge(g, s, 512, 112, 0.92, 1.18)]],
    // Rising-sun rays alternating accent/third, from the front-edge centre.
    sunburst: [1, 3, 5, 7].map(i => (g, s) =>
                  spinWedge(g, s, 512, 512, -Math.PI / 2 + i * (Math.PI / 9), -Math.PI / 2 + (i + 1) * (Math.PI / 9)))
              .concat([2, 4, 6].map(i => [3, (g, s) =>
                  spinWedge(g, s, 512, 512, -Math.PI / 2 + i * (Math.PI / 9), -Math.PI / 2 + (i + 1) * (Math.PI / 9))])),
    // Flag-like vertical bands: base | accent | third. Bands are fitted to the
    // sail's real x-range (504..840), not the 1024 sprite, and the outer band is
    // widest because the crescent tapers away from the luff — equal widths gave
    // the third colour a sliver and the base almost nothing.
    tricolour: [(g, s) => { g.beginPath(); g.rect(600 * s, 0, 100 * s, 1024 * s); },
                [3, (g, s) => { g.beginPath(); g.rect(700 * s, 0, 160 * s, 1024 * s); }]],
};
const SPIN_PATTERN_NAMES = Object.keys(SPIN_PATTERNS);
function spinPatternForName(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return SPIN_PATTERN_NAMES[h % SPIN_PATTERN_NAMES.length];
}

// Hand-curated kite pattern per character (colors live in AI_CONFIG:
// spinnaker = base, spinnaker2 = panel accent; solid ignores the accent).
const SPIN_LOOKS = {
    Cheer: 'sunburst',
    Bixby: 'halves',
    Skim: 'chevron',
    Wobble: 'triangle',
    Pinch: 'crosshalves',
    Bruce: 'solid',
    Strut: 'tricolour',
    Gasket: 'stripes',
    Chomp: 'crosshalves',
    Whiskers: 'thirds',
    Vex: 'crosshalves',
    Hug: 'thirds',
    Ripple: 'gores',
    Clutch: 'solid',
    Glide: 'thirds',
    Fathom: 'triangle',
    Scuttle: 'stripes',
    Finley: 'gores',
    Torch: 'sunburst',
    Nimbus: 'solid',
    Tangle: 'stripes',
    Brine: 'thirds',
    Razor: 'gores',
    Pebble: 'tricolour',
    Saffron: 'triangle',
    Bramble: 'sunburst',
    Mistral: 'chevron',
    Drift: 'triangle',
    Anchor: 'thirds',
    Zing: 'rays',
    Knot: 'sunburst',
    Flash: 'rays',
    Pearl: 'tricolour',
    Bluff: 'solid',
    Regal: 'tricolour',
    Sunshine: 'sunburst',
    Pulse: 'triangle',
    Splat: 'triangle',
    Dart: 'chevron',
    Roll: 'stripes',
    Spike: 'gores',
    Flicker: 'stripes',
    Croak: 'solid',
    Snap: 'triangle',
    Rift: 'rays',
    Skerry: 'crosshalves',
    Crush: 'rays',
    Torrent: 'tricolour',
    Jester: 'stripes',
    Breeze: 'gores',
    Petal: 'halves',
    Stomp: 'halves',
    Crimson: 'solid',
    Viper: 'crosshalves',
    Skitter: 'gores',
    Veil: 'chevron',
    Puff: 'sunburst',
    Lure: 'triangle',
    Wiggle: 'triangle',
    Zeffir: 'solid',
    Scoop: 'thirds',
    Popper: 'rays',
    Frond: 'gores',
    Bulkhead: 'thirds',
    Slipstream: 'chevron',
    Blaze: 'chevron',
    Cruz: 'thirds',
    Prism: 'sunburst',
    Ember: 'chevron',
    Torpedo: 'tricolour',
    Flaunt: 'tricolour',
    Piper: 'crosshalves',
    Stripes: 'stripes',
    Anvil: 'halves',
    Paddle: 'triangle',
    Etienne: 'stripes',
    Frenzy: 'crosshalves',
    Tiny: 'rays',
    Grip: 'halves',
    Splash: 'solid',
    Dozer: 'halves',
    Muninn: 'solid',
    Talon: 'rays',
    Latch: 'stripes',
    Skip: 'sunburst',
    Sable: 'solid',
    Seam: 'gores',
    Snag: 'solid',
    Lunker: 'triangle',
    Flare: 'crosshalves',
    Spar: 'tricolour',
    Bloom: 'rays',
    Needle: 'triangle',
    Sovereign: 'thirds',
    Lateen: 'halves',
    Ribbon: 'chevron',
    Plunge: 'chevron',
    Riffle: 'stripes',
    Chisel: 'gores',
    Chroma: 'halves',
};
// colorC is OPTIONAL and falls back to colorB, so every pattern authored before the
// third colour existed renders byte-identically. A region is either a bare function
// (fills with colorB, the original behaviour) or [3, fn] to fill with colorC.
function getSpinnakerSprite(pattern, colorA, colorB, colorC) {
    const regions = SPIN_PATTERNS[pattern];
    if (!regions || !regions.length || !colorB) return getTintedBoatPart('spin', colorA);
    const c3 = colorC || colorB;
    const key = 'spinp|' + pattern + '|' + colorA + '|' + colorB + '|' + c3;
    let c = boatTintCache.get(key);
    if (c) return c;
    const img = boatSprites.spin;
    if (!img.complete || !img.naturalWidth) return null;
    const size = Math.round(img.naturalWidth * BOAT_SPRITE_BAKE / BOAT_SPRITE_SCALE);
    c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d');
    const tintPass = (color) => {
        g.drawImage(img, 0, 0, size, size);
        g.globalCompositeOperation = 'multiply'; g.fillStyle = color; g.fillRect(0, 0, size, size);
        g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0, size, size);
        g.globalCompositeOperation = 'source-over';
    };
    tintPass(colorA);
    const s = size / 1024;
    for (const region of regions) {
        const third = Array.isArray(region);
        const draw = third ? region[1] : region;
        g.save();
        draw(g, s);
        g.clip();
        tintPass(third ? c3 : colorB);
        g.restore();
    }
    // Shade last, so the base and every accent panel curve together
    shadeSpinBake(g, size);
    // Final unclipped silhouette cut: antialiased clip edges leave partial-alpha
    // accent pixels outside the sail that the clipped passes can't clear
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(img, 0, 0, size, size);
    g.globalCompositeOperation = 'source-over';
    boatTintCache.set(key, c);
    return c;
}

// Penguin species that ride the floes. These are the art pipeline's ELEMENT
// masters, shipped individually rather than baked into a group sprite: a bird
// only gets to waddle (and later dive) if the engine owns it as its own object.
//
// The per-species numbers are the point, not decoration. At 15-19px on screen
// the plumage that separates an emperor from an adelie is two or three pixels
// and reads as noise, so species is carried by MOVEMENT — a stately emperor
// rocking slowly against an adelie skittering flat out is legible where the
// markings are not.

// MARK SPRITES, BY KIND. This used to be one global `markImg`, which meant a mark's
// `kind` chose nothing: a document could say `can` or `committee` and still get the
// orange tetrahedron. That is why mark-can-yellow shipped and then sat unused for a
// week — the art was ready and no mark could ask for it.
//
// `world` is the manifest's world size for that sprite, and it sizes the FRAME, not
// the object: each master is fill-normalized at ingest, so mark.png fills 96% of its
// square (30 -> ~29px across) and committee-boat.png fills 40%x92% (92 -> 37x85px).
// Drawing the frame at `world` is what makes those two numbers mean the same thing.
const MARK_SPRITES = {
    inflatable: { src: 'assets/images/props/mark.png',            world: 30 },
    can:        { src: 'assets/images/props/mark-can-yellow.png', world: 30 },
    committee:  { src: 'assets/images/props/committee-boat.png',  world: 92 }
};
for (const k in MARK_SPRITES) {
    const s = MARK_SPRITES[k];
    s.img = new Image();
    s.img.src = s.src;
    s.gray = null;
}
// An unknown kind falls back to the inflatable rather than drawing nothing: a typo in
// a document should look wrong, not make a course mark invisible.
const markSprite = (kind) => MARK_SPRITES[kind] || MARK_SPRITES.inflatable;

// PROP SPRITES, DERIVED — no second table. VenueDoc.PROP_KINDS is the one list (kinds,
// labels, world sizes), and the src falls out of the ingest convention: a manifest key
// '<venue>-<name>' stores its bake at assets/images/props/<venue>/<name>.png. Loaded
// lazily on first draw, so a course with no props loads no images. Unlike marks there
// is no fallback sprite: an unknown prop kind draws nothing, because the validator
// already flags it and a wrong palm is harder to notice than a missing one.
//
// ⚠️ THE DERIVATION CANNOT REACH VENUE-NEUTRAL ART, which is why `src` exists as an opt-out.
// Splitting the kind at the first hyphen assumes every bake sits under a venue directory, and
// six shipped world-props carry no venue at all — mark, mark-can-yellow, buoy-channel-red,
// buoy-channel-green, committee-boat, zodiac — because they are shared across venues rather
// than belonging to one. paths.py stores those FLAT at props/<key>.png, so the derivation
// would go looking for props/buoy/channel-red.png and load nothing. Before this escape hatch
// none of the six could be a prop at all, whatever the table said. A kind may therefore name
// its own `src`; the derivation stays the default and stays the rule for venue art.
const PROP_SPRITES = {};
function propSprite(kind) {
    let s = PROP_SPRITES[kind];
    if (!s) {
        const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
        if (!reg[kind]) return null;
        const i = kind.indexOf('-');
        s = PROP_SPRITES[kind] = { img: new Image(), world: reg[kind].world || 40,
                                   box: reg[kind].srcBox || null };
        s.img.src = reg[kind].src
            || `assets/images/props/${kind.slice(0, i)}/${kind.slice(i + 1)}.png`;
    }
    return s;
}

// DRAW ONLY THE INKED PART OF A SPRITE. `srcBox` is [x, y, w, h] as fractions of the frame,
// naming the rectangle the art actually occupies; the rest of the quad is transparent and
// costs real time to composite anyway. Measured on the bayou: props were filling 36 Mpx a
// frame against a 1.3 Mpx canvas, and the worst offenders were the derived tree trunks at
// 4.5% ink — a 440x440 quad drawn to show a 93px stem, because a derived part keeps the full
// master frame so it stays in register with its canopy.
//
// This keeps that guarantee and skips the emptiness: the sub-rect maps to exactly the same
// world position, since the full frame maps to (-w/2, -w/2, w, w) and a fraction of the
// source maps to the same fraction of the destination. Nothing moves, 95% of the trunk fill
// disappears.
//
// The box CANNOT be computed at runtime — reading pixels to find it taints the canvas under
// file://, which is the same wall submergedTint hit. It is measured off the bake instead and
// carried on the kind, like contactR and wash.
function drawSpriteBoxed(ctx, img, s, w) {
    const b = s.box;
    if (!b) { ctx.drawImage(img, -w / 2, -w / 2, w, w); return; }
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    ctx.drawImage(img, b[0] * iw, b[1] * ih, b[2] * iw, b[3] * ih,
                  -w / 2 + b[0] * w, -w / 2 + b[1] * w, b[2] * w, b[3] * w);
}

// Props draw in FOUR PASSES, one per plane — the compiled trait says which stratum a
// prop belongs to, and the pass is called from that stratum's place in drawScene:
//   seabed   with the bottom (after the seagrass, before the swell) — everything at the
//            surface runs over it, which is most of what sells "under water"; drawn at
//            reduced alpha so the water above keeps a say in its colour.
//   float    ON the water and UNDER the land — a lily pad, a raft of hyacinth. It runs
//            after every mark the water makes (swell, wakes, cat's-paws, wind waves) so
//            nothing ripples across something floating on top of them, and before
//            drawIslands so the land covers whatever part of the prop lies on it.
//            THAT ORDERING IS THE ENTIRE "water objects are not drawn on land" RULE: it
//            is occlusion by draw order, so it costs no clip path, no per-prop land test
//            and no per-frame work at all. Distinguish it from `surface` by asking what
//            holds the object up — water floats a pad, ground holds up a log.
//   surface  over the land and the shore, under the fleet — a trunk, a beached log.
//   canopy   over the boats — a crown a hull passes beneath.
// `world` sizes the sprite frame exactly as MARK_SPRITES does; `heading` rotates about
// the prop's own centre (sprite-up is zero, the engine convention).
// Seabed translucency is doing REAL work at 0.72: the baked ripple lattice below shows
// through the sprite, which puts the water's own texture ON the coral — the strongest
// single "it is under there" cue this renderer has.
const PROP_PLANE_ALPHA = { seabed: 0.72, float: 1, surface: 1, canopy: 1 };

// A SEABED sprite is seen THROUGH the water column: its colours washed toward the
// venue's water (source-atop), softened by a whisper of blur (the refraction cue —
// ~0.7px at display scale once the 4x bake lands on screen). The wash runs STRONGER
// than SHOAL_IN_WATER on purpose — 0.38 is the flat sand's number and it left the
// coral reading as a sticker; a discrete object only reads submerged when the water
// clearly owns its colour, which by eye lands at ~0.52 against the reference plate.
// (submergedTint's brightness-gain step needs per-pixel reads, which taint the canvas
// under file:// — wash + blur + translucency carry the look.) Baked once per sprite
// per water colour; a venue swap or palette edit rebakes.
const SEABED_WASH = 0.52;
const SEABED_BLUR = 3;         // px in the 4x bake
function submergedSprite(s) {
    const W = window.WATER_CONFIG || {};
    const tint = W.heroColor || W.baseColor || '#0ea5e9';
    if (s.sub && s.sub.tint === tint) return s.sub.canvas;
    const c = document.createElement('canvas');
    c.width = s.img.naturalWidth;
    c.height = s.img.naturalHeight;
    const g = c.getContext('2d');
    g.filter = `blur(${SEABED_BLUR}px)`;
    g.drawImage(s.img, 0, 0);
    g.filter = 'none';
    g.globalCompositeOperation = 'source-atop';
    const hex = tint.replace('#', '');
    g.fillStyle = `rgba(${parseInt(hex.substr(0, 2), 16)},${parseInt(hex.substr(2, 2), 16)},`
                + `${parseInt(hex.substr(4, 2), 16)},${SEABED_WASH})`;
    g.fillRect(0, 0, c.width, c.height);
    s.sub = { canvas: c, tint };
    return c;
}
// ── WATER AT THE FOOT OF A STANDING OBJECT ──────────────────────────────────
// A cypress grows OUT OF the bayou, but a sprite pasted on the water is a sticker: nothing
// says the wood displaces anything, so the trunk reads as hovering a few inches above the
// surface. Two marks fix that, and both are about the water rather than the tree.
//
//   THE POOL   a soft darkening hugging the base. Wet wood is dark, the trunk shades the
//              water it stands in, and a little depth gathers against anything vertical.
//              This is what actually welds the sprite down; the foam alone reads as a ring
//              drawn AROUND a floating object.
//   THE LAP    two or three short arcs of pale water at the waterline, breathing in and out
//              on a slow cycle. Deliberately BROKEN and never a closed ring — drawSurf's
//              note is the lesson here ("foam that only pulses in place reads as a dashed
//              BORDER however irregular you make it"), and a complete circle is that failure
//              in its purest form. Arcs that come and go read as water moving; a ring reads
//              as a decal.
//
// Biased into the wind, using the same field surf reads: the upwind side of a piling is
// where the water piles up and whitens, and the lee stays quiet. That asymmetry is most of
// what stops the effect looking stamped, and it costs one regionWindAt per prop.
//
// Alpha sits well under SURF_MAX_ALPHA (0.55). That layer is a sea breaking on a coast; this
// is water lapping a post, and the brief was "gently".
const WASH_ALPHA  = 0.26;   // peak whiteness of a lap
const WASH_POOL   = 0.20;   // peak darkness of the pool at the base
const WASH_PERIOD = 3.4;    // seconds per breath — slow enough never to read as a pulse
function drawPropWash(ctx) {
    const props = state.course && state.course.props;
    if (!props || !props.length) return;
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const camX = state.camera.x, camY = state.camera.y;
    const viewRadius = cullRadius(ctx);
    const t = state.time;
    // Stable per-object phase, so two trunks never breathe in step and no trunk crawls
    // between sessions. Same trick drawSurf uses, and it touches no RNG stream.
    const hash = (u, v) => { const h = Math.sin(u * 12.9898 + v * 78.233) * 43758.5453; return h - Math.floor(h); };
    ctx.save();
    ctx.lineCap = 'round';
    for (const p of props) {
        const k = reg[p.kind];
        if (!k || !k.wash) continue;
        const x = p.x + (p._dx || 0), y = p.y + (p._dy || 0);
        const r = (k.world || 40) * (p.scale || 1) * k.wash;
        if ((x - camX) ** 2 + (y - camY) ** 2 > (viewRadius + r * 3) ** 2) continue;

        // The pool. Transparent at the very centre because the trunk covers that anyway,
        // strongest just outside the wood, gone by 1.6r.
        const pool = ctx.createRadialGradient(x, y, r * 0.35, x, y, r * 1.6);
        pool.addColorStop(0, `rgba(18,26,12,${WASH_POOL})`);
        pool.addColorStop(0.45, `rgba(18,26,12,${(WASH_POOL * 0.5).toFixed(3)})`);
        pool.addColorStop(1, 'rgba(18,26,12,0)');
        ctx.fillStyle = pool;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
        ctx.fill();

        // ⚠️ WHICH FIELD PUSHES THE WATER — WIND FOR A PILING, CURRENT FOR A ROCK.
        // The default is wind, and it is right for everything this was written for: a cypress
        // trunk or a channel buoy stands in near-still water, so the side that whitens is the
        // side the BREEZE piles water against, and `up` is therefore the direction the wind
        // comes from.
        //
        // A boulder in a river is the opposite case. The water is moving fast past a fixed
        // obstruction, so what a helmsman reads is the boil DOWNSTREAM of it, not a lap on the
        // upstream face — and on this venue the current runs to 2.4 kn where the ambient
        // breeze does almost nothing to the surface. A kind opts in with
        // `washFrom: 'current'`; getCurrentAt's `direction` is where the water is going, which
        // is where the foam goes, so it is used WITHOUT the +PI the wind case needs.
        // `push` is 0..1: how hard whichever field is driving this is pushing. The two are
        // on different scales — wind runs to ~8 units, this venue's current to 2.4 knots —
        // so each is normalised against its own before the lap alpha reads it.
        let up, push;
        if (k.washFrom === 'current' && typeof getCurrentAt === 'function') {
            const cur = getCurrentAt(x, y);
            if (!cur || !cur.speed) continue;      // slack water makes no boil
            up = cur.direction;
            push = cur.speed / 2.4;
        } else {
            const w = regionWindAt(x, y);
            up = w.direction + Math.PI;
            push = w.speed / 8;
        }
        const seed = hash(x, y);
        for (let i = 0; i < 3; i++) {
            // Spread the arcs round the trunk, weighted toward windward rather than pinned
            // to it — a piling laps all round, just harder on one side.
            const spread = (i - 1) * 1.15 + (hash(x + i * 37, y - i * 19) - 0.5) * 0.7;
            const mid = up + spread;
            const lean = Math.cos(spread);                        // 1 windward, -1 lee
            const phase = (t / WASH_PERIOD + seed + i * 0.37) % 1;
            // In and out, never a hard on/off: sin gives the arc a swell and a retreat.
            const breath = Math.sin(phase * Math.PI);
            const a = WASH_ALPHA * breath * (0.35 + 0.65 * Math.max(0, lean))
                    * Math.max(0.35, Math.min(1, push));
            if (a <= 0.004) continue;
            const rr = r * (1.02 + 0.05 * breath);                // the lap runs up and back
            const half = 0.5 + 0.22 * breath;                     // and widens as it comes
            ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
            ctx.lineWidth = Math.max(0.8, r * 0.13);
            ctx.beginPath();
            ctx.arc(x, y, rr, mid - half, mid + half);
            ctx.stroke();
        }
    }
    ctx.restore();
}

// ── A CROWN YOU CAN SEE YOUR BOAT THROUGH ───────────────────────────────────
// The canopy plane is defined as the one drawn OVER the fleet, which is exactly what makes
// it the one plane able to lose a boat. Measured on a cypress crown parked over the player:
// 77% of the visible hull went, and the crowns are effectively solid discs (interior alpha
// holes are 0.0%, 0.0% and 0.4% on the three bayou canopies), so "you can see a bit through
// the leaves" was not true — nothing came through at all.
//
// So a crown fades while a hull is under it. This is the ordinary game answer to an
// occluder and it is deliberately NOT tied to land or water: a boat vanishing is a
// legibility problem wherever it happens, and the live oak roots on high ground overhanging
// the exact corner a boat wants to cut. Tying opacity to the ground underneath would also
// make a crown straddling a shoreline half-transparent along an arbitrary line.
//
// Driven by DISTANCE, so it eases in and out on its own with no timers and no popping, and
// A STRAIGHT LINE IN BOAT LENGTHS, not a curve fitted to the crown (designer, 2026-08-09):
// full opacity at TWENTY hull lengths out, fully clear with the hull dead under the stem,
// linear between. Stated in boat lengths because that is the unit the player actually reads
// distance in, and it makes the ramp identical for every tree — a tupelo and a live oak
// clear at the same range even though one crown is half again the other's width.
//
// THE FLOOR IS ZERO, AND THE TRUNK IS WHY THAT IS HONEST. Earlier versions held the crown at
// 34% and then 5%, on the argument that a hull sailing through empty air where a tree stands
// trades one lie for another. But the tree does not vanish when the crown does: the stem
// keeps drawing on the SURFACE plane at full opacity and keeps its collider, so what is left
// under your boat is the wood you are about to hit with the leaves out of the way. That is a
// truer picture than a ghost crown, not a compromise between two.
//
// TWENTY LENGTHS IS A LONG RAMP, and it is doing something broader than uncovering your hull:
// at 1120u a tree ten lengths off still sits at 50%, so the whole neighbourhood thins around
// the player and the wood closes back in behind. Nothing pops, nothing switches state, and
// there is no edge anywhere at which a crown becomes solid. On a venue carrying 1500 trees
// that means roughly ninety crowns are partly open at any moment — which is the look being
// asked for, an opening that travels with the boat rather than a tree that blinks.
const CANOPY_FADE_MIN = 0.0;     // crown left with the hull dead under the stem
const BOAT_LEN = 56;             // hull in world units; the manifest's scale anchor

// HOW FAST THE BOAT'S SPEED CHASES ITS TARGET, per frame at 60fps. These were
// literals inside updateBoat; they are named here because the ROUTER now has to
// price what they imply, and a copied constant that drifts out of sync is the
// exact bug the shoal pricing exists to fix (see the grid's shoal cost). One
// source, two readers: the speed integrator and the router's shoal cost.
//   tau = -1 / (60 * ln DECAY)  =>  UP ~5.5s (accelerating), DOWN ~9.25s.
// Change either number, or make it shoal-specific, and the router's price
// follows automatically — that is the whole point of naming them.
const SPEED_DECAY_UP = 0.9970;    // accelerating, ~5.5s
const SPEED_DECAY_DOWN = 0.9982;  // decelerating, ~9.25s — carries its way
const SPEED_TAU_DOWN = -1 / (60 * Math.log(SPEED_DECAY_DOWN));
const CANOPY_FADE_RANGE = 20 * BOAT_LEN;
// THE PLAYER'S BOAT ONLY, and that asymmetry is the point rather than an oversight. The fade
// exists to solve one problem — you must never lose your own hull under a tree — and every
// crown it opens is a crown that stopped being scenery. Letting the whole fleet trigger it
// costs twice: crowns flicker all race as the AI sails through them, and a dimming treetop
// becomes a free radar pip announcing a rival you could not otherwise see. A competitor
// disappearing under the leaves is the venue working correctly.
// ⚠️ THE FLOOR IS PER-KIND, BECAUSE CANOPY_FADE_MIN's ARGUMENT DOES NOT HOLD FOR EVERYTHING.
// It is 0.0 — a crown vanishes completely with the hull under it — and the comment above earns
// that: "the tree does not vanish when the crown does: the stem keeps drawing on the SURFACE
// plane at full opacity and keeps its collider, so what is left under your boat is the wood you
// are about to hit with the leaves out of the way."
//
// A BRIDGE HAS NO STEM. `river-footbridge` is a single canopy sprite with nothing on any other
// plane, so at floor 0 it does not open — it disappears, and a landmark the player sails under
// stops existing at exactly the moment they are under it. So a kind may declare `fadeMin` in
// PROP_KINDS and keep a floor of its own. Absent, the tree behaviour is unchanged, which is
// every existing kind.
function canopyAlpha(p, floor) {
    const boats = state.boats;
    if (!boats || !boats.length) return 1;
    const me = boats.find(b => b.isPlayer);
    if (!me) return 1;
    const x = p.x + (p._dx || 0), y = p.y + (p._dy || 0);
    const d = Math.hypot(me.x - x, me.y - y);
    if (d >= CANOPY_FADE_RANGE) return 1;
    const lo = (typeof floor === 'number' && floor >= 0 && floor < 1) ? floor : CANOPY_FADE_MIN;
    return lo + (1 - lo) * (d / CANOPY_FADE_RANGE);
}

// ── WHICH CROWNS ARE ALLOWED TO FADE ────────────────────────────────────────
// A crown fades for exactly one reason: it can hide the player's hull. A hull is only ever
// on WATER, so a tree whose crown lies entirely over land can never hide one — and fading it
// costs the venue a tree for nothing. Every crown that opens is a crown that stopped being
// scenery, so the fade is spent only where it buys something.
//
// That makes the test a plain boolean rather than a proportion, and the reasoning is worth
// keeping: it is tempting to fade in proportion to how much of the crown overhangs water, so
// neighbouring trees do not fade by different amounts. But a crown that is one tenth over
// water can still have the boat under that tenth, and a tenth of a fade would not clear it.
// Any overhang at all is enough to hide a hull, so any overhang at all earns the full rule.
//
// ⚠️ ISLAND RINGS ARE {x, y} OBJECTS, NOT [x, y] PAIRS. VenueDoc.pointInRing reads ring[i][0]
// and is for the DOCUMENT's rings; the compiled course carries vertices the other way round.
// Handing island vertices to pointInRing returns false for every point in silence, which
// reads as "all water" and fades the whole wood. Hence the local test below.
function pointInVerts(x, y, verts) {
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i].x, yi = verts[i].y, xj = verts[j].x, yj = verts[j].y;
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}

// AWASH SHAPES ARE WATER. A shoal, a lily bed, a weed bed is something you sail over, so a
// crown reaching across one is still reaching over water and still has to get out of the way.
function pointOnLand(x, y) {
    const islands = (state.course && state.course.islands) || [];
    for (const isl of islands) {
        if (isl.awash || !isl.vertices || isl.vertices.length < 3) continue;
        const dx = x - isl.x, dy = y - isl.y;
        if (dx * dx + dy * dy > isl.radius * isl.radius) continue;   // bounding circle first
        if (!pointInVerts(x, y, isl.vertices)) continue;
        let inHole = false;
        for (const h of (isl.holes || [])) {
            if (h && h.length >= 3 && pointInVerts(x, y, h)) { inHole = true; break; }
        }
        if (!inHole) return true;
    }
    return false;
}

// The stem, sixteen points round the rim, and eight at two thirds out. The rim is where the
// answer usually lives — a tree rooted well inland whose crown still reaches past the shore is
// exactly the case this must catch, and its stem sample says "land". The inner ring is for the
// other shape of the same question: a crown big enough to cover a whole pond or a narrow
// channel, where the rim is on land all the way round and the water is underneath the middle.
//
// ⚠️ THE SAMPLE COUNT IS CHOSEN BY WHICH WAY IT FAILS, not by cost. A false "over water" costs
// one tree a little transparency near the player. A false "on land" leaves a SOLID crown over
// open water, which can swallow the hull — the one thing the whole fade exists to prevent. So
// this errs toward detecting overlap: at sixteen points a 198u white pine samples its rim every
// 39u, finer than the 56u hull that has to stay visible under it.
const CANOPY_RIM_SAMPLES = 16;
const CANOPY_INNER_SAMPLES = 8;
function crownOverWater(p, worldW) {
    if (p._overWater !== undefined) return p._overWater;
    const x = p.x + (p._dx || 0), y = p.y + (p._dy || 0);
    const r = worldW * 0.5;
    let over = !pointOnLand(x, y);
    for (let k = 0; !over && k < CANOPY_RIM_SAMPLES; k++) {
        const a = (k / CANOPY_RIM_SAMPLES) * Math.PI * 2;
        if (!pointOnLand(x + r * Math.cos(a), y + r * Math.sin(a))) over = true;
    }
    for (let k = 0; !over && k < CANOPY_INNER_SAMPLES; k++) {
        const a = (k + 0.5) / CANOPY_INNER_SAMPLES * Math.PI * 2;   // offset off the rim spokes
        if (!pointOnLand(x + r * 0.66 * Math.cos(a), y + r * 0.66 * Math.sin(a))) over = true;
    }
    if (p.motion !== 'drift') p._overWater = over;   // a drifter's answer moves with it
    return over;
}

// WHICH SPRITE THIS PROP SHOWS IN THIS PLANE, which is not always its own.
//
// A TWO-PLANE KIND draws in both passes from ONE placement. A whole tree is the case: the
// stem belongs under the fleet and the crown over it, so a designer who drops "Live oak
// tree" in the channel should get a hull that passes beneath the leaves and stops on the
// wood — without having to know the sprite is really two, or place them twice and trust
// they line up. The kind names its halves in `parts` (VenueDoc.PROP_KINDS) and this returns
// the half for the pass being drawn; the parts are cut from the same master by treesplit.py
// and share a frame, so they register exactly.
//
// Everything else answers with its own sprite in its own plane, exactly as before. The
// separate `-trunk` and `-canopy` kinds stay placeable for the cases the pair cannot cover:
// a bare snag with no crown, or a crown reaching in from a tree rooted off the map.
function propSpriteFor(p, plane) {
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const parts = (reg[p.kind] || {}).parts;
    if (parts) return parts[plane] ? propSprite(parts[plane]) : null;
    return (p.plane || 'surface') === plane ? propSprite(p.kind) : null;
}

// THE EXACT CULL RADIUS IS HALF THE DIAGONAL, not 0.6 of it. The camera rotates, so the
// region a player can see is the canvas turned about its centre, and the circle that
// contains it has radius diag/2 — that is the whole requirement. A sprite is visible when
// its own half-width reaches that circle.
//
// The old test asked `0.6*diag + full width`, over-reaching by 0.1*diag plus another half
// width. On the planted bayou, where a crown can be 440u across, that admitted a circle
// 1.9x the area it needed to and about half of every prop drawn was off screen. Measured
// after: 116 prop draw calls a frame fell to 63 with nothing changing on screen.
//
// Kept as a named helper because drawVegetation, drawShoals and drawPropWash all had the
// same 0.6 in them, and a cull constant that drifts between layers is how one layer starts
// popping in at the corner of the screen while its neighbour does not.
function cullRadius(ctx) {
    return Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.5;
}

// ── SPATIAL INDEX OVER THE PROPS ────────────────────────────────────────────
// Walking every prop in every pass is fine for a venue with a dozen; the planted bayou has
// 1555, and four passes over it is 6220 slots visited to find the ~56 that draw. That work
// is invisible while a software rasteriser dominates the frame, and it is NOT invisible on a
// GPU, where the fill collapses and whatever the CPU does per frame is what is left.
//
// So: bucket props into a coarse grid once, and visit only the buckets the view touches.
// Rebuilt when the props array identity changes, which is once per course compile — props do
// not move (the only motion is `drift`, and that is a visual offset well under one cell).
const PROP_CELL = 600;
function propGrid() {
    const course = state.course;
    if (!course || !course.props) return null;
    if (course._propGrid && course._propGrid.src === course.props) return course._propGrid;
    const cells = new Map();
    course.props.forEach((p, i) => {
        const key = `${Math.floor(p.x / PROP_CELL)},${Math.floor(p.y / PROP_CELL)}`;
        let a = cells.get(key);
        if (!a) cells.set(key, a = []);
        a.push(i);
    });
    return (course._propGrid = { src: course.props, cells });
}

// `filter(p, w)`: optional predicate the world-tile caches use to split a plane into its
// cacheable (static) and live (fading/drifting) populations — see drawCanopyCached.
// `pending`: optional array; sprites whose image has not finished loading are pushed so a
// tile baked too early knows to rebake when the art lands. Returns the number drawn.
function drawProps(ctx, plane, filter, pending) {
    const props = state.course && state.course.props;
    if (!props || !props.length) return 0;
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const viewRadius = cullRadius(ctx);
    const camX = state.camera.x, camY = state.camera.y;
    // Reach one cell beyond the view so a big crown centred just outside still draws; the
    // per-prop test below is what actually decides, this only narrows the search.
    const grid = propGrid();
    const pad = viewRadius + 460;
    const visit = [];
    if (grid) {
        const cx0 = Math.floor((camX - pad) / PROP_CELL), cx1 = Math.floor((camX + pad) / PROP_CELL);
        const cy0 = Math.floor((camY - pad) / PROP_CELL), cy1 = Math.floor((camY + pad) / PROP_CELL);
        for (let cy = cy0; cy <= cy1; cy++)
            for (let cx = cx0; cx <= cx1; cx++) {
                const a = grid.cells.get(`${cx},${cy}`);
                if (a) for (let k = 0; k < a.length; k++) visit.push(a[k]);
            }
        // BACK TO DOCUMENT ORDER. The grid hands props back cell by cell, and painting in
        // that order silently hands z-order to the spatial index: two overlapping props
        // would swap which is on top depending on which bucket they fell in, and it would
        // change as the camera moved across a cell boundary. Within a plane the stacking is
        // the DESIGNER'S, in the order the document lists them — the same guarantee
        // compileVenueDoc's shapeOrder makes for shapes. Sorting a few dozen indices a frame
        // is nothing next to what the cull just saved.
        visit.sort((a, b) => a - b);
    }
    const list = grid ? visit.map(i => props[i]) : props;
    let drawn = 0;
    for (const p of list) {
        // A `scatter` kind is a GROUP, not a sprite: one placement stands for a drift of
        // several animals that its own renderer draws and animates. Drawing the bell here
        // as well would put a motionless extra one at the placement point.
        if ((reg[p.kind] || {}).scatter) continue;
        const s = propSpriteFor(p, plane);
        if (!s) continue;
        if (!s.img.complete || !s.img.naturalWidth) {
            // ⚠️ Only a STILL-LOADING image goes on the tile's pending list. A failed load
            // is complete=true/naturalWidth=0, and pending-listing one made `landed` true
            // every frame — the tile rebaked its ~5 screens of fill per frame, and the
            // caches benched SLOWER than the live paths they replaced.
            if (pending && !s.img.complete) pending.push(s.img);
            continue;
        }
        const w = s.world * (p.scale || 1);
        if (filter && !filter(p, w)) continue;
        const limit = viewRadius + w * 0.5;
        const x = p.x + (p._dx || 0), y = p.y + (p._dy || 0);
        if ((x - camX) ** 2 + (y - camY) ** 2 > limit ** 2) continue;
        // A crown the player is sitting under fades to nothing, and a fully transparent
        // drawImage still costs the composite. Worth an explicit skip on a venue holding
        // 1500 trees: the fade reaches twenty hull lengths, so the crowns nearest the
        // camera — the big ones, the expensive ones — are exactly the ones at zero.
        // ...and only a crown that OVERHANGS WATER fades at all: one standing wholly on land
        // cannot hide a hull, so it stays a solid tree. See crownOverWater.
        const alpha = (PROP_PLANE_ALPHA[plane] || 1)
                    * (plane === 'canopy' && crownOverWater(p, w)
                       ? canopyAlpha(p, (reg[p.kind] || {}).fadeMin) : 1);
        if (alpha <= 0.004) continue;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        if (p.heading) ctx.rotate(p.heading);
        drawSpriteBoxed(ctx, plane === 'seabed' ? submergedSprite(s) : s.img, s, w);
        ctx.restore();
        drawn++;
    }
    return drawn;
}

// Drift, for props whose motion says so: they ride the same current the boats feel,
// with a touch of windage, accumulated in `_dx/_dy` so the AUTHORED position stays
// what the document says. Purely visual by construction — the traits force a drifting
// prop's contact to none, so nothing physical ever reads the drifted position.
let _propClock = 0;
function updateDriftingProps(now) {
    const props = state.course && state.course.props;
    if (!props || !props.length) return;
    const dt = _propClock ? Math.min(0.1, (now - _propClock) / 1000) : 0;
    _propClock = now;
    if (!dt) return;
    for (const p of props) {
        if (p.motion !== 'drift') continue;
        const x = p.x + (p._dx || 0), y = p.y + (p._dy || 0);
        const cur = (typeof getCurrentAt === 'function') ? getCurrentAt(x, y) : null;
        let vx = 0, vy = 0;
        // (-sin, +cos) is DOWN-STREAM in this engine — the gust drift convention. The
        // first version had the signs mirrored and flotsam crept upwind.
        if (cur && cur.speed) {
            vx += -Math.sin(cur.direction) * cur.speed;
            vy += Math.cos(cur.direction) * cur.speed;
        }
        // ~3% windage: flotsam moves downwind even on slack water.
        if (state.wind) {
            vx += -Math.sin(state.wind.direction) * state.wind.speed * 0.03;
            vy += Math.cos(state.wind.direction) * state.wind.speed * 0.03;
        }
        p._dx = (p._dx || 0) + vx * dt;
        p._dy = (p._dy || 0) + vy * dt;
    }
}

// ── TRAFFIC: VESSELS ON RAILS ────────────────────────────────────────────────────────
// The cove's promised mechanic — "slow, utterly predictable" shipping the player has to
// time. The path maths lives in js/traffic.js; this is the lifecycle and the draw.
//
// EVERY VESSEL IS A PURE FUNCTION OF THE RACE CLOCK. There is no integrator here and no
// accumulated position: given t, the compiled tables say where the hull is, which way it
// points and how fast it is going. That is what makes it predictable in the sense the
// design means — the same seed puts the ship in the same place at the same second, and it
// is in that place whether the frame rate was 30 or 144. It also makes restarts, pauses
// and the prestart free: nothing to reset, because nothing was ever accumulated.
const KELVIN_TAN = 1 / (2 * Math.SQRT2);   // tan(19.47 deg), exactly
const WAKE_SPAN = 2.2;        // ship-lengths of track the wake covers — length scales with
                              // the hull, so the same constant suits a tug and a cruise ship
const WAKE_STEPS = 26;        // quads per arm
const WAKE_FULL_KT = 3.0;     // knots at which the wake reaches full strength
// The other wake a vessel can wear: the fleet's own. drawWakes calls it a ribbon — "tapered
// two-tone ribbons along each boat's recent stern track" — so this does too rather than
// inventing a second word for a thing that already has one.
//
// WHICH ONE IS RIGHT IS A QUESTION ABOUT THE HULL, not a preference. The Kelvin wedge is
// what a DISPLACEMENT hull throws: slow, heavy, pushing water aside. A small craft up on the
// plane leaves a narrow churned trail instead, and the wedge drawn behind a motorboat claims
// a tonnage it does not have.
const RIBBON_SPAN = 1.8;      // hull-lengths of track the ribbon covers

// NO HISTORY BUFFER. The boats keep a wakeTrail because nothing else knows where they have
// been; a vessel on rails has its whole past in the path it is sailing, so the wake is read
// straight off it with atArc(). That also means the wake is exactly as curved as the track
// really was, and costs nothing to carry between frames.
function drawTrafficWakes(ctx) {
    const list = state.traffic;
    if (!list || !list.length) return;
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = cullRadius(ctx);
    ctx.save();
    for (const v of list) {
        if (!v.active) continue;
        // A STATIONARY VESSEL HAS NO WAKE, and the berthing case falls out of it: a hull
        // authored to stop sheds its wake as it slows, so it comes alongside clean with no
        // special case anywhere.
        // NOTHING WHILE GOING ASTERN. A hull backing down does churn water in life, but it
        // is a slow, close, propeller-driven mess and nothing like the Kelvin wedge a bow
        // throws — drawing the wedge behind a ship moving the other way would read as the
        // hull travelling in the direction it is pointing, which is the one thing the
        // manoeuvre exists to contradict.
        const style = v.wake.style;
        if (style === 'none') continue;
        // A HULL WITH TWO BOWS IS NOT BACKING DOWN. Everything else suppresses its wake
        // astern — a ship going backwards churns with its propeller rather than throwing a
        // bow wave — but a double-ender running the other way is simply under way, and makes
        // its wake from the end that is now leading. Which end that is needs no special case
        // at all: the wake trails DOWN the track behind the direction of travel, and the
        // direction of travel is a fact about arc length, not about which way the bow points.
        if (v.astern && !v.wake.symmetric) continue;
        const str = Math.min(1, v.knots / WAKE_FULL_KT);
        if (str <= 0.02) continue;
        const spr = propSprite(v.kind);
        if (!spr) continue;
        const w = spr.world * v.scale;
        const halfHull = v.hullLen * 0.5;
        // A pingpong vessel on its return leg is sailing the path BACKWARDS, so its wake
        // trails toward increasing arc length. One sign carries that everywhere below;
        // without it the return leg draws its wake out in front of the bow.
        const dir = v.reverse ? -1 : 1;
        const bowS = v.s + dir * halfHull;
        // Never longer than the water actually sailed — a vessel that just spawned trails a
        // short wake that grows, rather than arriving with a mile of history behind it.
        // A LOOPING VESSEL HAS ALWAYS BEEN SAILING. Bounding the wake by "how far along the
        // path am I" is right for a one-shot passage and wrong for a lap: it would trim the
        // wake back to nothing every time the arc length wrapped, announcing exactly where
        // the seam is on a curve built specifically not to have one.
        const sailed = v.path.closed ? Infinity
                     : (v.reverse ? v.path.length - v.s : v.s);
        const span = Math.min(sailed + halfHull, WAKE_SPAN * v.hullLen);
        if (span < v.hullLen * 0.2) continue;
        if ((v.x - camX) ** 2 + (v.y - camY) ** 2 > (viewR + w + span) ** 2) continue;

        const beam = v.hullBeam;

        // ── THE FLEET'S RIBBON ───────────────────────────────────────────────────────
        // The same two-pass taper drawWakes gives a boat — outer band, then a brighter core
        // — but read off the PATH rather than a remembered trail, and sized from the hull
        // instead of the 56-unit dinghy those constants were tuned against.
        if (style === 'ribbon') {
            const rSpan = Math.min(sailed - halfHull, RIBBON_SPAN * v.hullLen);
            if (rSpan <= v.hullLen * 0.1) continue;
            const sternR = v.s - dir * halfHull;
            const rp = [];
            for (let k = 0; k <= WAKE_STEPS; k++) {
                const d = rSpan * k / WAKE_STEPS;
                const q = v.path.atArc(sternR - dir * d);
                rp.push({ x: q.x, y: q.y, px: Math.cos(q.heading), py: Math.sin(q.heading), d });
            }
            // ONE TRAIL PER HULL. A catamaran is not a wide monohull: it leaves two narrow
            // wakes with clear water between them, and drawing one broad band across the
            // whole beam claims a displacement hull that is not there. The offsets are
            // applied per SAMPLE, along each sample's own perpendicular, so the pair follows
            // the track round a turn instead of sliding across it.
            const rw = v.wakeBeam * 0.42;
            for (const off of v.wakeHulls) {
                for (let pass = 0; pass < 2; pass++) {
                    const wS = pass === 0 ? 1 : 0.42, aS = pass === 0 ? 0.35 : 0.50;
                    for (let k = 0; k < WAKE_STEPS; k++) {
                        const a = rp[k], b = rp[k + 1];
                        const alpha = Math.pow(1 - a.d / rSpan, 1.25) * aS * str;
                        if (alpha <= 0.01) continue;
                        const wa = (rw + a.d * 0.055) * wS, wb = (rw + b.d * 0.055) * wS;
                        const ax = a.x + a.px * off, ay = a.y + a.py * off;
                        const bx = b.x + b.px * off, by = b.y + b.py * off;
                        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
                        ctx.beginPath();
                        ctx.moveTo(ax + a.px * wa, ay + a.py * wa);
                        ctx.lineTo(bx + b.px * wb, by + b.py * wb);
                        ctx.lineTo(bx - b.px * wb, by - b.py * wb);
                        ctx.lineTo(ax - a.px * wa, ay - a.py * wa);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
            }
            continue;
        }

        const pts = [];
        for (let k = 0; k <= WAKE_STEPS; k++) {
            const d = span * k / WAKE_STEPS;
            const p = v.path.atArc(bowS - dir * d);
            pts.push({ x: p.x, y: p.y, px: Math.cos(p.heading), py: Math.sin(p.heading), d });
        }

        const fade = (d) => Math.pow(1 - d / span, 1.5) * str;

        // 1. THE SCAR — churned water, and it starts at the TRANSOM, not the stem. Run from
        // the bow and the ship gets a white stripe painted down its own deck.
        const sternS = v.s - dir * halfHull;
        const scarSpan = Math.min(sailed - halfHull, v.hullLen * 1.5);
        if (scarSpan > v.hullLen * 0.1) {
            const sc = [];
            for (let k = 0; k <= WAKE_STEPS; k++) {
                const d = scarSpan * k / WAKE_STEPS;
                const p = v.path.atArc(sternS - dir * d);
                sc.push({ x: p.x, y: p.y, px: Math.cos(p.heading), py: Math.sin(p.heading), d });
            }
            for (let pass = 0; pass < 2; pass++) {
                const wS = pass === 0 ? 1 : 0.45, aS = pass === 0 ? 0.10 : 0.13;
                for (let k = 0; k < WAKE_STEPS; k++) {
                    const a = sc[k], b = sc[k + 1];
                    const alpha = Math.pow(1 - a.d / scarSpan, 1.4) * str * aS;
                    if (alpha <= 0.008) continue;
                    const wa = (beam * 0.5 + a.d * 0.05) * wS, wb = (beam * 0.5 + b.d * 0.05) * wS;
                    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
                    ctx.beginPath();
                    ctx.moveTo(a.x + a.px * wa, a.y + a.py * wa);
                    ctx.lineTo(b.x + b.px * wb, b.y + b.py * wb);
                    ctx.lineTo(b.x - b.px * wb, b.y - b.py * wb);
                    ctx.lineTo(a.x - a.px * wa, a.y - a.py * wa);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }

        // 2. THE DIVERGENT ARMS — the wedge. Lateral offset grows as d * tan(19.47), which
        // on a straight track is the Kelvin wedge exactly and through a turn bends with the
        // hull, because every sample carries the heading the ship actually had there.
        //
        // THIN. The wedge is genuinely this wide — 560 units off the track by the tail on a
        // 720-unit hull — so anything but a fine crest line fills a third of the screen with
        // flat white and reads as fog rather than water. The width is physics; the weight of
        // the line is what keeps it legible.
        const armW = v.hullLen * 0.014;
        for (const side of [1, -1]) {
            for (let k = 0; k < WAKE_STEPS; k++) {
                const a = pts[k], b = pts[k + 1];
                const alpha = fade(a.d) * 0.30;
                if (alpha <= 0.008) continue;
                const oa = a.d * KELVIN_TAN * side, ob = b.d * KELVIN_TAN * side;   // side-symmetric, so no dir here
                const ax = a.x + a.px * oa, ay = a.y + a.py * oa;
                const bx = b.x + b.px * ob, by = b.y + b.py * ob;
                // Thicken astern: a crest that has run further has spread further.
                const ta = armW * (0.6 + 0.7 * a.d / span), tb = armW * (0.6 + 0.7 * b.d / span);
                const sdx = bx - ax, sdy = by - ay;
                const sl = Math.hypot(sdx, sdy) || 1;
                const nx = -sdy / sl, ny = sdx / sl;
                ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
                ctx.beginPath();
                ctx.moveTo(ax + nx * ta, ay + ny * ta);
                ctx.lineTo(bx + nx * tb, by + ny * tb);
                ctx.lineTo(bx - nx * tb, by - ny * tb);
                ctx.lineTo(ax - nx * ta, ay - ny * ta);
                ctx.closePath();
                ctx.fill();
            }
        }

        // 3. THE BOW WAVE — the manifest is explicit that the sprite carries no baked
        // disturbance, so the water piling up at the stem has to be drawn or it is absent.
        //
        // ⚠️ ONE FRAME, AND IT IS THE HULL'S. This mixed two: the lateral axis came from the
        // path tangent at `atArc(bowS)` while the longitudinal came from `v.heading` at the
        // ship's centre. On a straight lane they agree and it looked right. In a turn they
        // do not — measured on the cove's lane, up to 23.8 degrees apart — so the two axes
        // stopped being perpendicular and the crescent SKEWED, bulging on one bow while it
        // tightened on the other. The anchor was wrong too: `atArc` walks half a hull along
        // the CURVE, which in a turn lands up to 75 units (43% of the beam) off the stem the
        // sprite is actually drawn with.
        //
        // The hull is drawn at (v.x, v.y) rotated by v.heading and nothing else, so the wave
        // that belongs to it must be built from exactly that and nothing else.
        // ⚠️ THE LEADING END, WHICH IS NOT ALWAYS THE BOW. A double-ender running astern
        // travels the way her stern points, and the water piles up at the end going first.
        // `lead` is the only place that distinction is needed — everything else about the
        // wake is measured along the track, which already knows which way she is going.
        const lead = v.astern ? -1 : 1;
        const fx = Math.sin(v.heading) * lead, fy = -Math.cos(v.heading) * lead;
        const rx = Math.cos(v.heading), ry = Math.sin(v.heading);    // abeam, square to it
        const bx = v.x + fx * halfHull, by = v.y + fy * halfHull;    // the end going first
        ctx.fillStyle = `rgba(255,255,255,${(0.5 * str).toFixed(3)})`;
        for (const side of [1, -1]) {
            const o = (lat, lon) => [bx + rx * side * beam * lat - fx * v.hullLen * lon,
                                     by + ry * side * beam * lat - fy * v.hullLen * lon];
            const c1 = o(0.46, -0.01), p1 = o(0.60, 0.20), c2 = o(0.30, 0.06);
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo(c1[0], c1[1], p1[0], p1[1]);
            ctx.quadraticCurveTo(c2[0], c2[1], bx, by);
            ctx.closePath();
            ctx.fill();
        }
    }
    ctx.restore();
}

// Drawn with the surface props, under the marks and the fleet. The sprite's own bow points
// -y in its frame — the game's heading convention exactly — so the tangent goes straight
// into rotate() with no offset. (Measured on all three cove hulls: the stern is the wider
// end, and it is at +y on every one.)
function drawTraffic(ctx) {
    const list = state.traffic;
    if (!list || !list.length) return;
    const viewRadius = cullRadius(ctx);
    const camX = state.camera.x, camY = state.camera.y;
    for (const v of list) {
        if (!v.active) continue;
        const s = propSprite(v.kind);
        if (!s || !s.img.complete || !s.img.naturalWidth) continue;
        const w = s.world * v.scale;
        const limit = viewRadius + w * 0.5;
        if ((v.x - camX) ** 2 + (v.y - camY) ** 2 > limit ** 2) continue;
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.rotate(v.heading);
        drawSpriteBoxed(ctx, s.img, s, w);
        ctx.restore();
    }
}

function getMarkImgGray(kind) {
    const s = markSprite(kind);
    if (s.gray || !s.img.complete || !s.img.naturalWidth) return s.gray;
    const c = document.createElement('canvas');
    c.width = s.img.naturalWidth; c.height = s.img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(s.img, 0, 0);
    // Slate tint via source-atop (keeps the sprite's alpha + some shading;
    // avoids getImageData, which taints the canvas under file://)
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(148, 163, 184, 0.8)';
    g.fillRect(0, 0, c.width, c.height);
    s.gray = c;
    return s.gray;
}

// How long a boat takes to disappear after it finishes. Long enough to read as a hull
// sailing on past the line rather than being deleted, short enough that it is gone before
// the next boat needs the water.
//
// ⚠️ It also paces the RESULTS: the camera hands over and `showResults()` fires when the
// Canvas Setup
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

function drawCourseMiniMap() {
    const box = document.getElementById('venue-course-box');
    const inner = document.getElementById('venue-course-inner');
    const canvas = document.getElementById('venue-course-map');
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
    const recEl = document.getElementById('venue-records-inline');
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
    const box = document.getElementById('venue-course-box');
    const canvas = document.getElementById('venue-course-map');
    const boardUp = UI.preRaceOverlay && !UI.preRaceOverlay.classList.contains('hidden');
    if (!A.static || !box || !canvas || box.style.display === 'none' || !boardUp) {
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
function applyPlayerCharacter() {
    const pc = playerCharacter();
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
        applyBoatIdentity(state.boats[0], playerCharacter(), true);
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
if (UI.restartButton) UI.restartButton.addEventListener('click', (e) => { e.preventDefault(); rematchRace(); });
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




let minimapCtx = null;
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
// The race-day hero is sized from its column's width, so it has to be re-sized with it.
window.addEventListener('resize', sizeRaceDayHero);
// After the hero re-sizes, the chart's box has a new width — re-decide and re-draw.
window.addEventListener('resize', layoutVenueCourseMap);
resize();

window.addEventListener('click', () => {
    if ((settings.soundEnabled || settings.musicEnabled) && (!Sound.ctx || Sound.ctx.state !== 'running')) Sound.init();
});

window.addEventListener('keydown', (e) => {
    if (state.race.status === 'waiting') {
        // Settings and the record book are reachable from the clubhouse, so their
        // keys work there too; everything else on this handler is race-only and
        // stays gated. Settings stacks above the book, so ESC peels it first.
        const settingsOpen = UI.settingsScreen && !UI.settingsScreen.classList.contains('hidden');
        const recordsEl = document.getElementById('records-overlay');
        const recordsOpen = recordsEl && !recordsEl.classList.contains('hidden');
        if (e.key === 'F2') { e.preventDefault(); toggleSettings(); }
        else if (e.key === 'Escape' && settingsOpen) toggleSettings(false);
        else if (e.key === 'Escape' && recordsOpen) closeRecordsOverlay();
        return;
    }

    if ((settings.soundEnabled || settings.musicEnabled) && (!Sound.ctx || Sound.ctx.state !== 'running')) Sound.init();

    let key = e.key;
    if (key === 'a' || key === 'A') key = 'ArrowLeft';
    if (key === 'd' || key === 'D') key = 'ArrowRight';
    if (key === 'w' || key === 'W') key = 'ArrowUp';
    if (key === 's' || key === 'S') key = 'ArrowDown';

    if (state.keys.hasOwnProperty(key)) state.keys[key] = true;

    // View & System
    if (e.key.toLowerCase() === 'c') {
        const modes = ['heading', 'north'];
        state.camera.mode = modes[(modes.indexOf(state.camera.mode) + 1) % modes.length];
        settings.cameraMode = state.camera.mode;
        state.camera.message = state.camera.mode.toUpperCase();
        state.camera.messageTimer = 1.5;
        saveSettings();
        showToast(`Camera: ${state.camera.mode.toUpperCase()}`);
    }
    if (e.key.toLowerCase() === 'n') {
        state.showNavAids = !state.showNavAids;
        settings.navAids = state.showNavAids;
        saveSettings();
        if (UI.settingNavAids) UI.settingNavAids.checked = state.showNavAids;
        showToast(`Nav Aids: ${state.showNavAids ? "ON" : "OFF"}`);
    }
    if (e.key.toLowerCase() === 'p') {
        settings.penaltiesEnabled = !settings.penaltiesEnabled;
        saveSettings();
        if (UI.settingPenalties) UI.settingPenalties.checked = settings.penaltiesEnabled;
        showToast(`Sailing Rules: ${settings.penaltiesEnabled ? "ON" : "OFF"}`);
    }

    if (e.key === 'F12') {
        e.preventDefault();
        if (window.html2canvas) {
            showToast("Capturing Screenshot...");
            setTimeout(() => {
                window.html2canvas(document.body).then(c => {
                    const link = document.createElement('a');
                    link.download = 'regatta-screenshot.png';
                    link.href = c.toDataURL();
                    link.click();
                    showToast("Screenshot Saved");
                });
            }, 100);
        }
    }

    if (e.key === 'F2') { e.preventDefault(); toggleSettings(); }
    if (e.key === '?' || (e.shiftKey && e.key === '/')) toggleHelp();
    if (e.key === 'Escape') {
        // On the abandon confirm, ESC is KEEP RACING — straight back on the water.
        if (UI.abandonScreen && !UI.abandonScreen.classList.contains('hidden')) { toggleAbandon(false); togglePause(false); }
        else if (UI.helpScreen && !UI.helpScreen.classList.contains('hidden')) toggleHelp(false);
        else if (UI.settingsScreen && !UI.settingsScreen.classList.contains('hidden')) toggleSettings(false);
        else togglePause();
    }

    // Audio
    if (e.key.toLowerCase() === 'm') {
        if (e.shiftKey) {
            settings.musicEnabled = !settings.musicEnabled;
            saveSettings();
            if (UI.settingMusic) UI.settingMusic.checked = settings.musicEnabled;
            if (settings.musicEnabled) Sound.init();
            else Sound.stopMusic();
            Sound.updateMusic();
            showToast(`Music: ${settings.musicEnabled ? "ON" : "OFF"}`);
        } else {
            settings.soundEnabled = !settings.soundEnabled;
            saveSettings();
            if (UI.settingSound) UI.settingSound.checked = settings.soundEnabled;
            if (settings.soundEnabled) Sound.init();
            Sound.updateWindSound(Sound.playerWindSpeed());
            showToast(`Sound: ${settings.soundEnabled ? "ON" : "OFF"}`);
        }
    }
    if (e.key === 'F7') { e.preventDefault(); toggleWaterDebug(); }
    // Sailing
    if (e.key === ' ' || e.code === 'Space') {
        if (state.boats.length > 0) state.boats[0].spinnaker = !state.boats[0].spinnaker;
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        if (state.boats.length > 0) {
            settings.autoTrim = !settings.autoTrim;
            saveSettings(); // re-derives boat.manualTrim from settings.autoTrim
            if (UI.settingTrim) UI.settingTrim.checked = settings.autoTrim;
            if (state.boats[0].manualTrim) state.boats[0].manualSailAngle = Math.abs(state.boats[0].sailAngle);
            // The chips are gone from the HUD, so this toast is the only signal that
            // ↑/↓ just changed meaning — keep it.
            showToast(`Trim: ${state.boats[0].manualTrim ? "MANUAL" : "AUTO"}`);
        }
    }

    // Dev
    if (e.key === 'F8') {
        e.preventDefault();
        settings.debugMode = !settings.debugMode;
        showToast(`Debug: ${settings.debugMode ? "ON" : "OFF"}`);
    }
    if (e.key === '[') {
        const steps = [0.1, 0.25, 0.5, 1.0, 2.0, 4.0, 10.0];
        let current = state.gameSpeed || 1.0;
        let next = 0.1;
        for (let i = steps.length - 1; i >= 0; i--) {
            if (steps[i] < current - 0.01) { next = steps[i]; break; }
        }
        state.gameSpeed = next;
        showToast(`Speed: ${state.gameSpeed}x`);
    }
    if (e.key === ']') {
        const steps = [0.1, 0.25, 0.5, 1.0, 2.0, 4.0, 10.0];
        let current = state.gameSpeed || 1.0;
        let next = 10.0;
        for (let i = 0; i < steps.length; i++) {
            if (steps[i] > current + 0.01) { next = steps[i]; break; }
        }
        state.gameSpeed = next;
        showToast(`Speed: ${state.gameSpeed}x`);
    }
});

window.addEventListener('keyup', (e) => {
    let key = e.key;
    if (key === 'a' || key === 'A') key = 'ArrowLeft';
    if (key === 'd' || key === 'D') key = 'ArrowRight';
    if (key === 'w' || key === 'W') key = 'ArrowUp';
    if (key === 's' || key === 'S') key = 'ArrowDown';
    if (state.keys.hasOwnProperty(key)) state.keys[key] = false;
});

window.addEventListener('focus', () => { for (const k in state.keys) state.keys[k] = false; });

// Race Logic & Update Functions

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

const WORLD_CLOCK = 0.24;

// HOW FAR THE CAMERA LOOKS PAST THE BOW, as a fraction of the frame's height. The boat ends
// up at `0.5 + this` down the screen, so 1/6 puts it two thirds of the way down and splits
// the frame two-to-one in favour of the water ahead. Read only in heading mode — see the
// note at the camera follow.
//
// ⚠️ IT IS A TRADE, NOT A FREE WIN, and that is why it is not larger. Everything the offset
// buys ahead of the bow it takes from ASTERN, where the boat on your transom is. At 1/4 that
// was a third of the rearward view gone; 1/6 keeps more of it while still giving the forward
// half of the frame most of the picture.
//
// ⚠️ THE BOAT MUST ALSO KEEP ROOM BELOW IT. drawBoatInstruments hangs its panel BI_DROP +
// BI_H under the hull and projects it through the real transform, so it follows the boat
// down. Past about 0.3 that panel starts running off the bottom edge.
const CAM_LOOK_AHEAD = 1 / 6;

function update(dt) {
    state.time += WORLD_CLOCK * dt;
    const timeScale = dt * 60;

    if (window.Rules) window.Rules.update(dt);

    updateBaseWind(dt);
    updateGusts(dt);
    updateSqualls(dt);
    // No dt: every vessel is evaluated straight from the race clock, so it cannot drift
    // with the frame rate the way an integrated position would.
    updateTraffic();
    // The swell's own clock. Advanced from dt like everything else, so it pauses with the
    // race and is identical for a given seed — a wave field is pure trigonometry and must
    // never reach for the RNG stream. No-op off the ocean.
    if (window.Swell) window.Swell.update(dt);

    // Current Visuals (uniform current, or the river's spatial field)
    if (venueCurrent() || (state.race.conditions.current && state.race.conditions.current.speed > 0.1)) {
        // Spawn at a random point near the camera; visibility scales with the
        // LOCAL current there, so the river's midstream reads faster than the banks.
        const range = Math.max(canvas.width, canvas.height) * 1.5;
        const px = state.camera.x + (fxRand() - 0.5) * range;
        const py = state.camera.y + (fxRand() - 0.5) * range;
        const local = getCurrentAt(px, py);
        if (local && local.speed > 0.15) {
            // Density is one of the three speed channels, so it leans on local speed harder
            // than it used to and runs denser overall — a lane has to be several streaks
            // wide before it reads as a lane rather than as scattered marks.
            const spawnChance = (0.10 + (local.speed / 3.0) * 0.9) * 0.75;
            if (fxRand() < spawnChance) {
                createParticle(px, py, 'current', {
                    trail: [{ x: px, y: py }], trailT: 0, spd: local.speed,
                    // Jitter so a lane is a band of streaks at slightly different weights
                    // rather than a comb of identical ones — the same trick the comets use.
                    jit: 0.7 + fxRand() * 0.6
                });
            }
        }

        // Mark Wakes
        // ── AND CHANNEL BUOYS MAKE THEM TOO ─────────────────────────────────
        // A moored buoy standing in a two-knot stream throws exactly the same wash as a
        // race mark does — it is the same situation, a fixed object in moving water — and
        // on a tidal venue that wash is a CUE: it shows which way the stream is setting and
        // roughly how hard, at a glance, from across the channel. Only marks got one, so
        // Glowtide's eighteen buoys sat in a 2.5 kt tide with dead-flat water round them.
        const wakeSource = (ox, oy, radius) => {
            const mc = getCurrentAt(ox, oy);
            if (!(mc && mc.speed > 0.15) || fxRand() >= 0.3 * (mc.speed / 3.0)) return;
            // Wake forms DOWNSTREAM of the obstacle.
            const wx = Math.sin(mc.direction) * radius;
            const wy = -Math.cos(mc.direction) * radius;
            createParticle(ox + wx + (fxRand() - 0.5) * 10, oy + wy + (fxRand() - 0.5) * 10,
                'mark-wake', { life: 1.5, alpha: 0.5 * (mc.speed / 3.0), scale: 0.8 });
        };
        if (state.course.marks) {
            for (const m of state.course.marks) wakeSource(m.x, m.y, 12);
        }
        if (state.course.props) {
            const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
            for (const pr of state.course.props) {
                if (pr.kind !== 'buoy-channel-red' && pr.kind !== 'buoy-channel-green') continue;
                const kw = (reg[pr.kind] && reg[pr.kind].world) || 28;
                wakeSource(pr.x, pr.y, kw * (pr.scale || 1) * 0.45);
            }
        }

    }

    // Rapids whitewater is NOT a particle system any more — see drawRapidsFoam. A
    // particle is a thing that travels, and anything that travels reads as an object;
    // broken water is a FIELD. The foam is drawn from the regions directly, statelessly.

    // Drifting ice floes — authored by the venue document (`c.ice`); a no-op
    // wherever none are.
    updateIceFloes(dt);

    // Sound (the player's APPARENT wind — see Sound.playerWindSpeed). Whether the bed
    // should be heard at all is Sound.windAudible's business, not the loop's.
    Sound.updateWindSound(Sound.playerWindSpeed());

    // Global Race Timer
    if (state.race.status === 'prestart') {
        state.race.timer -= dt;
        if (state.race.timer <= 0) {
            state.race.status = 'racing';
            state.race.timer = 0;

            // ⚠️ OCS IS A FACT ABOUT POSITION AT THE STARTING SIGNAL, NOT A HISTORY OF
            // CROSSINGS. RRS 29.1: "when at her starting signal any part of a boat's hull
            // is on the course side of the starting line". The flag was only ever set by a
            // crossing EVENT during the prestart, so a boat that arrived on the course side
            // without one — sliding in laterally from beyond a mark, a crossing that fell
            // between two frames, a clear-then-re-cross — started clean.
            //
            // Measured (`_ocs_truth.js`, 3 races a venue, 270 boat-starts): SIX boats over
            // the line at the gun and not flagged, one of them 182 units over, and NONE
            // wrongly flagged. Judging by position closes every one by construction,
            // whatever the cause was.
            //
            // The line has ENDS: a hull past the pin is not on the course side of the
            // starting line, she is past it. Both tests are applied per hull point.
            {
                const [sm0, sm1] = startLinePts();
                if (sm0 && sm1) {
                    const sdx = sm1.x - sm0.x, sdy = sm1.y - sm0.y;
                    const sL = Math.hypot(sdx, sdy) || 1;
                    const ss = startCrossSign();
                    for (const b of state.boats) {
                        if (b.raceState.finished) continue;
                        let over = false;
                        for (const q of hullPolygonAt(b.x, b.y, b.heading)) {
                            const d = ss * ((q.x - sm0.x) * sdy - (q.y - sm0.y) * sdx) / sL;
                            if (d <= 0) continue;
                            const along = ((q.x - sm0.x) * sdx + (q.y - sm0.y) * sdy) / sL;
                            if (along >= 0 && along <= sL) { over = true; break; }
                        }
                        if (over !== !!b.raceState.ocs) {
                            b.raceState.ocs = over;
                            if (b.isPlayer) {
                                if (over) showRaceMessage("OCS - RETURN TO PRE-START!", "text-red-500", "border-red-500/50");
                                else hideRaceMessage();
                            }
                        }
                    }
                }
            }

            Sound.playStart();
            Sound.updateMusic();

            // Reset AI Stuck timers to prevent immediate recovery maneuvers
            for (const b of state.boats) {
                b.ai.stuckTimer = 0;
                b.ai.recoveryMode = false;
            }
        }
    } else if (state.race.status === 'racing') {
        state.race.timer += dt;

        // Calculate Cutoff Time (0.1875s per meter)
        // legLength is in units. 5 units = 1 meter.
        let totalDistMeters = (state.race.totalLegs * state.race.legLength) / 5;
        // A designed course carries its own limit — authored, or derived from the route
        // by VenueDoc.compile. `legs × legLength` only ever described a
        // windward-leeward; the island special case that used to live here was that
        // same gap patched for one venue, and it did not generalise to a course with
        // gates in it.
        const cutoffTime = (state.course.cutoff != null)
            ? state.course.cutoff : totalDistMeters * 0.1875;

        if (state.race.timer >= cutoffTime) { // Dynamic Cutoff
            state.race.status = 'finished';

            // Mark all active boats as DNF/DNS
            for (const boat of state.boats) {
                if (!boat.raceState.finished) {
                    boat.raceState.finished = true;
                    boat.raceState.finishTime = state.race.timer;

                    // If still on Leg 0 (Start), they count as DNS
                    if (boat.raceState.leg === 0) {
                        boat.raceState.resultStatus = 'DNS';
                    } else {
                        boat.raceState.resultStatus = 'DNF';
                    }
                }
            }

            if (state.camera.target === 'boat') {
                state.camera.target = 'finish';
                showResults();
            }
        }
    }

    // Update Boats
    for (const boat of state.boats) {
        updateBoat(boat, dt);
    }

    // Collisions
    checkBoatCollisions(dt);
    checkMarkCollisions(dt);
    // BEFORE the land pass, so the coastline still gets the last word. settleFloes states
    // the rule for ice — "shore pass, last, so the coastline always wins" — and it holds
    // here for a stronger reason: a bow can shove a boat clean into a beach, and if land
    // resolved first that boat would spend a frame inside the shore.
    checkTrafficCollisions(dt);
    checkIslandCollisions(dt);
    checkNearMisses(dt);

    // Sayings
    Sayings.update(dt);

    // Player Cam
    const player = state.boats[0];
    const camLerp = 1 - Math.pow(0.9, timeScale);
    if (state.camera.mode === 'heading') {
        let diff = normalizeAngle(player.heading - state.camera.rotation);
        state.camera.rotation += diff * camLerp;
    } else if (state.camera.mode === 'north') {
        let diff = normalizeAngle(0 - state.camera.rotation);
        state.camera.rotation += diff * camLerp;
    }

    if (state.camera.messageTimer > 0) state.camera.messageTimer -= dt;
    if (state.camera.target === 'boat') {
        if (player.raceState.finished && player.fadeTimer <= 0) {
             state.camera.target = 'finish';
             showResults();
        } else {
            // ── THE BOAT SITS LOW, SO THE WATER AHEAD IS ON SCREEN ──────────────
            // Centred, half the frame is spent on where you have already been. What a
            // sailor is actually reading is in front: the next mark, the pressure coming
            // down, the crest about to lift the stern. So the camera aims at a point AHEAD
            // of the boat and the boat falls back down the frame.
            //
            // ⚠️ HEADING MODE ONLY, and that is not a scoping shortcut. The offset is what
            // puts the boat at a fixed spot on screen, and that only works because heading
            // mode guarantees the bow points up the frame. In `north` the same offset would
            // slide the boat to a different edge every time you changed course, which is
            // worse than centred rather than better.
            //
            // ⚠️ THE OFFSET IS APPLIED AFTER THE SMOOTHING, NOT CHASED BY IT. The first cut
            // lerped the view centre toward `boat + offset`, and it ROCKED through every
            // turn: as the camera rotates, that target swings through an arc of radius
            // `look` — a quarter of the screen — and a 10%-per-frame lerp cannot keep up, so
            // the boat slid up the frame during the turn and drifted back afterwards.
            //
            // So the smoothing follows the BOAT (`fx, fy`, the same lerp as before) and the
            // look-ahead is added on top as a rigid offset. The boat's place on screen is
            // then fixed by construction, and turning pivots the world about the hull —
            // which is what a camera locked to a boat should do anyway.
            //
            // ⚠️ ALONG camera.rotation, NOT player.heading. The two differ mid-turn, and
            // offsetting along the heading would walk the boat sideways across the frame
            // instead. Along the camera's own up-axis it stays put.
            if (state.camera.fx === undefined) { state.camera.fx = state.camera.x; state.camera.fy = state.camera.y; }
            state.camera.fx += (player.x - state.camera.fx) * 0.1;
            state.camera.fy += (player.y - state.camera.fy) * 0.1;
            const look = state.camera.mode === 'heading' ? canvas.height * CAM_LOOK_AHEAD : 0;
            state.camera.x = state.camera.fx + Math.sin(state.camera.rotation) * look;
            state.camera.y = state.camera.fy - Math.cos(state.camera.rotation) * look;
        }
    } else if (state.camera.target === 'finish') {
        // Focus on Finish Line center
        let indices = finishMarks() || [0, 1];
        if (state.course.marks && state.course.marks.length >= 2) {
             const m1 = state.course.marks[indices[0]], m2 = state.course.marks[indices[1]];
             const tx = (m1.x+m2.x)/2, ty = (m1.y+m2.y)/2;
             state.camera.x += (tx - state.camera.x) * 0.05;
             state.camera.y += (ty - state.camera.y) * 0.05;
             // Rotate to face upwind (North, 0) for better view of finishers
             let diff = normalizeAngle(0 - state.camera.rotation);
             state.camera.rotation += diff * 0.05;
        }
    }

    // Particles
    const windDirX = Math.sin(state.wind.direction);
    const windDirY = -Math.cos(state.wind.direction);

    // Wakes: each boat carries a short tapered RIBBON trail (sampled stern
    // positions, ~1.5s of life — about half the old visual length) plus
    // sparse foam dots. The old 'wake-wave' particle streams lived ~11s and
    // are gone entirely; drawWakes renders the ribbons.
    if (state.race.status !== 'waiting') {
        for (const boat of state.boats) {
            if (!boat.wakeTrail) { boat.wakeTrail = []; boat.wakeSampleT = 0; }

            // Age + prune (all boats, including finished — trails fade out)
            for (const s2 of boat.wakeTrail) s2.age += dt;
            while (boat.wakeTrail.length && boat.wakeTrail[boat.wakeTrail.length - 1].age > 2.25) boat.wakeTrail.pop();

            // ── THE BIOLUMINESCENT TRAIL IS ITS OWN, LONGER BUFFER ──────────────
            // The ribbon above is deliberately short (2.25 s, ~4 boat lengths) because it
            // draws FOAM, and foam collapses. Bioluminescence is a different quantity and
            // outlives it, so it gets its own trail rather than borrowing this one — the
            // alternative was lengthening `wakeTrail`, which would have stretched the
            // daylight foam on all nine other venues to fix a night effect on one.
            // Sampled at half the rate: the light is a smooth band, not beads, and 0.16 s
            // at racing speed is ~17 units, far finer than the stroke width.
            if (nightAmt() > 0) {
                if (!boat.bioTrail) { boat.bioTrail = []; boat.bioSampleT = 0; }
                for (const s2 of boat.bioTrail) s2.age += dt;
                while (boat.bioTrail.length && boat.bioTrail[boat.bioTrail.length - 1].age > BIO_TRAIL_LIFE) boat.bioTrail.pop();
            } else if (boat.bioTrail && boat.bioTrail.length) {
                boat.bioTrail.length = 0;
            }

            if (boat.speed > 0.08 && !boat.raceState.finished) {
                const boatDX = Math.sin(boat.heading);
                const boatDY = -Math.cos(boat.heading);
                // Sample UNDER the aft hull (not at the transom) — the boat
                // sprite covers the ribbon origin, so the wake emerges from
                // beneath the hull instead of spurting off the stern
                const sternX = boat.x - boatDX * 12;
                const sternY = boat.y - boatDY * 12;
                const planing = boat.raceState.isPlaning;

                boat.wakeSampleT -= dt;
                if (boat.wakeSampleT <= 0) {
                    boat.wakeSampleT = 0.08;
                    boat.wakeTrail.unshift({ x: sternX, y: sternY, age: 0, str: Math.max(0, Math.min(1, (boat.speed - 0.05) / 1.45)) * (planing ? 1.3 : 1) });
                    if (boat.wakeTrail.length > 34) boat.wakeTrail.pop();
                }
                if (boat.bioTrail) {
                    boat.bioSampleT -= dt;
                    if (boat.bioSampleT <= 0) {
                        boat.bioSampleT = 0.16;
                        // `str` is SHEAR, which is what actually triggers a cell — so it is
                        // taken from speed, and a planing hull tearing the surface lights
                        // more water than one ghosting along at two knots.
                        boat.bioTrail.unshift({ x: sternX, y: sternY, age: 0,
                            str: Math.max(0, Math.min(1, (boat.speed - 0.04) / 1.3)) * (planing ? 1.25 : 1) });
                        if (boat.bioTrail.length > 80) boat.bioTrail.pop();
                    }
                }

                // Occasional foam blobs scattered ALONG the wake band (real
                // wakes break into patches); never point-spawned at the stern
                const str0 = boat.wakeTrail.length ? boat.wakeTrail[0].str : 0;
                if (boat.wakeTrail.length > 4 && fxRand() < (planing ? 0.22 : 0.10) * str0) {
                    const idx = 1 + Math.floor(fxRand() * Math.min(9, boat.wakeTrail.length - 2));
                    const p = boat.wakeTrail[idx];
                    const q = boat.wakeTrail[idx + 1];
                    const sdx = q.x - p.x, sdy = q.y - p.y;
                    const sl = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
                    const off = (fxRand() - 0.5) * 2 * (8 + p.age * 8);
                    createParticle(p.x + (-sdy / sl) * off, p.y + (sdx / sl) * off, 'wake', { scale: 0.7 + fxRand() * 0.9 });
                }
            }
        }
    }

    // ── WIND STREAKS: where a streak is BORN is the primary pressure cue ────────
    //
    // Real water tells you this by presence and absence. Below about six knots the
    // surface is glassy and there are no wind streaks at all; the along-wind lines
    // (Langmuir streaks) start showing in a moderate breeze and cover the water in a
    // fresh one. So a lull is drawn as BARE WATER, not as a dim streak — which is both
    // what a sailor actually sees and the only encoding that survives on a dark palette,
    // where "faint white" and "nothing" look identical anyway.
    //
    // Two independent gates, because they answer two different questions:
    //   absolute (`windiness`) — is there enough breeze here to mark the water at all?
    //   relative (`pressureAt`) — is this the windy side of THIS course?
    // Absolute alone would make a light venue uniformly bare and a fresh one uniformly
    // covered; relative alone would paint 7-knot swamp water like a squall.
    //
    // The old rule was `max(0.07, (rel - 0.85) * 1.6)` against the route-centroid wind.
    // On nine of the ten venues the wind field is spatially uniform, so `rel` was exactly
    // 1 everywhere and the floor was doing all the work: density was flat, and so was
    // every other channel. This layer varied nothing on nine venues and read the tenth
    // backwards.
    const spawnTries = 2;
    for (let s = 0; s < spawnTries; s++) {
        const range = Math.max(canvas.width, canvas.height) * 1.35;
        // A streak is a mark on the WATER. A single roll rejected on land used to be
        // the whole story — which on open water changed nothing, but in Redrock's
        // canyon maze most of the box IS land, so the layer thinned out exactly
        // where the wind does its wildest work. Resample a few times instead: the
        // WATER keeps its density whatever the land fraction around it. Extra
        // draws are safe — fxRand is the visuals-only stream.
        let sx = 0, sy = 0, onWater = false;
        for (let r = 0; r < 6 && !onWater; r++) {
            sx = state.camera.x + (fxRand() - 0.5) * range;
            sy = state.camera.y + (fxRand() - 0.5) * range;
            onWater = Arena.contains(state.course.boundary, sx, sy, 0) && inMaskWater(sx, sy);
        }
        if (!onWater) continue;
        const spd = getWindAt(sx, sy).speed;
        const windiness = Math.max(0, Math.min(1, (spd - _streakRef.floor) / _streakRef.span));
        if (windiness <= 0) continue;                       // glassy: the water is not marked
        const t = pressureAt(spd);
        // Squared, so the windy side is unmistakably denser rather than slightly denser.
        // Capped well below saturation: at the top of Glacier Sound's ramp the first
        // tuning put ~300 streaks on screen and the fleet raced through a curtain. This
        // layer is the water talking, and it stays under the boats and the labels
        // (race-view.md §8) — ~2.5x the density of the light corner is plenty to read.
        // Capped for the same reason the other two channels are: density is the strongest
        // pressure cue AND the one that most easily becomes a curtain. The gradient below
        // the ceiling is what carries the reading; the ceiling is what keeps it readable.
        const _c = cometCfg();
        // ⚠️ THE PRESSURE WEIGHT IS THE CONTRAST. The constant term is density you get for
        // being on windy water at all; the t² term is density you get for being on the WINDY
        // SIDE of this course. Measured puff:clear was 1.5-1.7 against the 2.5 this layer's
        // own note claims to deliver, so the constant came down and the weighted term went up.
        const chance = Math.min(STREAK_MAX_SPAWN, _c.dens0 + _c.dens1 * windiness * (0.18 + 0.82 * t * t));
        if (fxRand() >= chance) continue;
        createParticle(sx, sy, 'wind', {
            life: 1.0,
            jit: fxRand(),
            // Each streak rides at its own share of the true wind, in the same 0.6-0.9
            // band the puff cells use — so a streak inside a cat's-paw travels WITH it
            // instead of sliding through it. The spread is also the only source of
            // streak-to-streak LENGTH variety, and it stays inside that physical band:
            // 1.5x of scatter against the 1.9x the wind varies across Glacier Sound and
            // the 2.4x it varies between venues, so length still READS as wind speed
            // rather than becoming decoration on top of one.
            drift: 0.60 + fxRand() * 0.30,
            trail: [{ x: sx, y: sy }],
            trailT: 0,
            beach: 1,
            waterT: fxRand() * WIND_WATER_RECHECK
        });
    }
    updateParticles(dt);
    updateWindWaves(dt);
    updateSurf(dt);
    // WHITECAPS, SURF SPRAY AND THE BOW UPWIND. After the boats, because two of the three
    // read `boat.swell` and it is written in updateBoat. Its own particle arrays and its
    // own PRNG, so it can neither be seen by the sim nor perturb it. No-op off the ocean.
    if (window.SeaFX) window.SeaFX.update(dt, state);

    recordTrajectory(dt);
}

// HUMAN TRAJECTORY RECORDER (instrument, off by default — enable with
// localStorage.setItem('regatta_record','1')). Samples the player at 10Hz and
// auto-downloads a JSON when they finish (or the race ends). Read-only: no sim
// state or RNG is touched, so traces and evals are unaffected with the flag off.
// Near a rounding mark it also samples the 16 ring sectors THROUGH THE SAME
// GRID LENS the RL policy observes, plus rival positions, so human samples are
// comparable to policy observations. Uses: human-vs-bot segment diagnostics,
// BC warm-starts for crew/driver policies (see arctic-ai-campaign.md).
function createParticle(x, y, type, props = {}) { state.particles.push({ x, y, type, life: 1.0, ...props }); }

function updateParticles(dt) {
    const timeScale = dt * 60;
    for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        if (p.vx) p.x += p.vx * timeScale;
        if (p.vy) p.y += p.vy * timeScale;
        let decay = 0.0025;
        if (p.type === 'wake') {
            decay = 0.009;
            const s = p.scale || 1.0;
            p.scaleVal = s + (1-p.life)*1.5;
            p.alpha = p.life*0.4;
        }
        else if (p.type === 'wake-wave') {
            decay = 0.0015;
            const s = p.scale || 1.0;
            p.scaleVal = (0.5 + (1-p.life)*3) * s;
            p.alpha = p.life*0.25;
        }
        else if (p.type === 'wind') {
             decay = 1 / (WIND_LIFE * 60);   // life 1 -> 0 over WIND_LIFE seconds
             const local = getWindAt(p.x, p.y);
             // THE GAME'S ONE CONVERSION: units/second = knots * 15 (a knot is 0.25
             // units/frame at 60fps, which is what boat.speed and the current both use).
             // This used to be `speed / 10` per frame — units/s = knots * 6, i.e. 0.40x
             // the true wind. The puff cells travel at 0.58-0.86x, so streaks visibly
             // lagged the cat's-paws they are supposed to be the texture of.
             const v = local.speed * 15 * p.drift * dt;
             p.x -= Math.sin(local.direction) * v;
             p.y += Math.cos(local.direction) * v;
             p.spd = local.speed;

             // THE COMET'S TAIL IS THE PARCEL'S OWN TRACK. Nothing is inferred: the streak
             // curves where the breeze bends, stretches where it blows harder and shortens
             // where it dies, because that is literally where this air has been. It cannot
             // point the wrong way, and its LENGTH reports wind speed for free — a fixed
             // window of time times the distance covered in it.
             p.trailT += dt;
             if (p.trailT >= _streakRef.tailStep) {
                 // Carry the overshoot rather than zeroing it, so the window really is
                 // the tail step and not "the next frame after it" — otherwise every tail
                 // is a frame-time longer than the speed it claims to report.
                 p.trailT -= _streakRef.tailStep;
                 p.trail.unshift({ x: p.x, y: p.y });
                 // ONE SPARE sample beyond the drawn window. The tail end is interpolated
                 // between the last two (see streakSpine), so dropping the oldest never
                 // moves anything that is on screen.
                 if (p.trail.length > WIND_TAIL_PTS + 1) p.trail.pop();
             }

             // ── REACHING THE BEACH ──────────────────────────────────────────────
             // A streak that drifts onto a berg or out of the arena stops being a mark on
             // water. Killing it outright made it BLINK OUT at full strength against the
             // shoreline — the eye is drawn straight to a disappearance, so a cull meant to
             // be invisible was the most conspicuous thing the layer did.
             //
             // So it fades, and it starts fading BEFORE it lands: the test point is thrown
             // ahead by exactly the distance this streak covers while it fades. Streaks
             // therefore die out approaching the shore and reach the sand already gone —
             // which is also what real streaks do in the lee of land.
             //
             // Rechecked on a stagger rather than every frame: this is a point-in-polygon
             // against every land shape, and it does not need 60Hz.
             p.waterT -= dt;
             if (p.waterT <= 0) {
                 p.waterT = WIND_WATER_RECHECK;
                 const look = local.speed * 15 * p.drift * WIND_BEACH_FADE;
                 const lx = p.x - Math.sin(local.direction) * look;
                 const ly = p.y + Math.cos(local.direction) * look;
                 if (!Arena.contains(state.course.boundary, lx, ly, 0) || !inMaskWater(lx, ly)) p.beached = true;
             }
             if (p.beached) {
                 p.beach -= dt / WIND_BEACH_FADE;
                 if (p.beach <= 0) p.life = 0;
             }
        } else if (p.type === 'current' || p.type === 'mark-wake') {
             const c = getCurrentAt(p.x, p.y);
             const speed = c ? c.speed : 0;
             const dir = c ? c.direction : 0;
             // Move with current (Game Units = Knots / 4)
             const moveSpeed = (speed / 4.0) * timeScale;
             p.x += Math.sin(dir) * moveSpeed;
             p.y -= Math.cos(dir) * moveSpeed;
             if (p.type === 'current') {
                 decay = 1 / (CUR_LIFE * 60);   // life 1 -> 0 over CUR_LIFE seconds
                 p.spd = speed;
                 // THE STREAMLINE IS THE PARCEL'S OWN TRACK, exactly as a comet's tail is.
                 // Nothing is inferred from a single sample, so the mark curves through a
                 // bend because the water did, and it is longer in the fast lane because
                 // that water covered more ground in the same seconds.
                 p.trailT += dt;
                 if (p.trailT >= CUR_TAIL_STEP) {
                     // Overshoot carried, not zeroed — otherwise every streak is a frame
                     // longer than the speed it is claiming to report.
                     p.trailT -= CUR_TAIL_STEP;
                     p.trail.unshift({ x: p.x, y: p.y });
                     // One spare beyond the drawn window: the tail end is interpolated
                     // between the last two, so retiring the oldest moves nothing on screen.
                     if (p.trail.length > CUR_TAIL_PTS + 1) p.trail.pop();
                 }
             }
        }

        p.life -= decay * timeScale;
        if (p.life <= 0) { state.particles[i] = state.particles[state.particles.length-1]; state.particles.pop(); }
    }
}

// Boat wakes: tapered two-tone ribbons along each boat's recent stern track —
// a soft outer band that widens and fades as it ages (wake spreading) with a
// brighter narrow core, plus two short V quarter-wave strokes at the stern.
// Clean filled shapes, no blur: fits the art style and replaces the old
// long-lived particle streams.
function drawWakes(ctx) {
    const camX = state.camera.x, camY = state.camera.y;
    const viewR2 = (Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 200) ** 2;
    const MAX_AGE = 2.25;

    ctx.save();
    for (const boat of state.boats) {
        const trail = boat.wakeTrail;
        if (!trail || trail.length < 2) continue;
        const dxv = boat.x - camX, dyv = boat.y - camY;
        if (dxv * dxv + dyv * dyv > viewR2) continue;

        // Per-segment quads so alpha/width can vary along the ribbon
        for (let pass = 0; pass < 2; pass++) {
            const wScale = pass === 0 ? 1 : 0.42;      // outer band, then bright core
            const aScale = pass === 0 ? 0.35 : 0.50;
            for (let i = 0; i < trail.length - 1; i++) {
                const a = trail[i], b = trail[i + 1];
                const segDX = b.x - a.x, segDY = b.y - a.y;
                const len = Math.sqrt(segDX * segDX + segDY * segDY);
                if (len < 0.5) continue;
                const nx = -segDY / len, ny = segDX / len;
                const wA = (9 + a.age * 6) * wScale * a.str;
                const wB = (9 + b.age * 6) * wScale * b.str;
                const alpha = Math.pow(1 - a.age / MAX_AGE, 1.25) * aScale * a.str;
                if (alpha <= 0.01) continue;
                ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
                ctx.beginPath();
                ctx.moveTo(a.x + nx * wA, a.y + ny * wA);
                ctx.lineTo(b.x + nx * wB, b.y + ny * wB);
                ctx.lineTo(b.x - nx * wB, b.y - ny * wB);
                ctx.lineTo(a.x - nx * wA, a.y - ny * wA);
                ctx.closePath();
                ctx.fill();
            }
        }

    }
    ctx.restore();
}

// Drawing (Refactored for Boat object)
function drawBoat(ctx, boat) {
    if (boat.opacity !== undefined && boat.opacity <= 0) return;
    ctx.save();
    if (boat.opacity !== undefined) ctx.globalAlpha = boat.opacity;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(5, 5, 12, 28, 0, 0, Math.PI * 2); ctx.fill();

    // Hull (sprite, tinted with the paint job; vector fallback while loading)
    const hullColor = boat.colors.hull || '#f1f5f9';
    const hullSprite = getTintedBoatPart('hull', hullColor);
    if (hullSprite) {
        const u = 1024 / BOAT_SPRITE_SCALE;
        ctx.drawImage(hullSprite, -512 / BOAT_SPRITE_SCALE, -472 / BOAT_SPRITE_SCALE, u, u);
    } else {
        ctx.fillStyle = hullColor;
        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.bezierCurveTo(18, -10, 18, 20, 12, 30);
        ctx.lineTo(-12, 30);
        ctx.bezierCurveTo(-18, 20, -18, -10, 0, -25);
        ctx.fill();
        ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Cockpit sole, wheel and mast
    const cockpitColor = boat.colors.cockpit;
    drawCockpitFittings(ctx, cockpitColor);

    // Sails
    const drawSailFunc = (isJib, scale = 1.0) => {
        ctx.save();
        if (isJib) { ctx.translate(0, -25); ctx.rotate(boat.sailAngle); }
        else { ctx.translate(0, -5); ctx.rotate(boat.sailAngle); }

        const sailColor = boat.colors.sail;
        ctx.globalAlpha = 0.9 * (boat.opacity !== undefined ? boat.opacity : 1.0);
        ctx.fillStyle = sailColor || '#ffffff';
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;

        const luff = boat.luffIntensity || 0;
        const angleRatio = Math.min(1.0, Math.abs(boat.sailAngle) / (Math.PI / 4));
        const flattenFactor = 0.6 + 0.4 * angleRatio;
        const baseDepth = (isJib ? 11 : 15) * scale * flattenFactor;
        let controlX = -boat.boomSide * baseDepth;
        if (luff > 0) {
             const currentDepth = baseDepth * (1.0 - luff * 0.8);
             const time = state.time * 30;
             const flutterAmt = Math.sin(time) * baseDepth * 1.5 * luff;
             controlX = (-boat.boomSide * currentDepth) + flutterAmt;
        }
        ctx.beginPath();
        if (isJib) { ctx.moveTo(0, 0); ctx.lineTo(0, 28 * scale); ctx.quadraticCurveTo(controlX, 14 * scale, 0, 0); }
        else { ctx.moveTo(0, 0); ctx.lineTo(0, 45); ctx.quadraticCurveTo(controlX, 20, 0, 0); }
        ctx.fill(); ctx.stroke();

        if (!isJib) {
            ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath();
            ctx.moveTo(0, 15); ctx.lineTo(controlX * 0.33, 12);
            ctx.moveTo(0, 30); ctx.lineTo(controlX * 0.6, 24);
            ctx.stroke();
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 45); ctx.stroke();
        }
        ctx.restore();
    };

    const drawSpinnaker = (scale = 1.0) => {
        ctx.save();
        ctx.translate(0, -28); ctx.rotate(boat.sailAngle);
        const spinColor = boat.colors.spinnaker;
        ctx.globalAlpha = 0.9 * (boat.opacity !== undefined ? boat.opacity : 1.0);
        ctx.fillStyle = spinColor || '#ef4444';
        ctx.strokeStyle = spinColor || '#ef4444';
        ctx.lineWidth = 1;

        const luff = boat.luffIntensity || 0;
        const baseDepth = 40 * scale;
        let controlX = -boat.boomSide * baseDepth;
        if (luff > 0) {
             const currentDepth = baseDepth * (1.0 - luff * 0.9);
             const time = state.time * 25;
             const flutterAmt = Math.sin(time) * baseDepth * 1.2 * luff;
             controlX = (-boat.boomSide * currentDepth) + flutterAmt;
        }
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 50 * scale); ctx.quadraticCurveTo(controlX, 25 * scale, 0, 0);
        ctx.fill(); ctx.stroke(); ctx.restore();
    };

    // Sprite sails: rotate at the tack like the vector sails, mirror the camber
    // to the leeward side, flatten as the sheet comes in, shear-flutter when
    // luffing, and scale about the tack for the jib<->spinnaker crossfade.
    const drawSailSprite = (part, tackY, color, scale) => {
        const sprite = part === 'spin'
            ? getSpinnakerSprite(
                boat.spinPattern || 'solid',
                color || '#ffffff',
                boat.colors.spinAccent || boat.colors.hull,
                boat.colors.spinAccent3)
            : getTintedBoatPart(part, color || '#ffffff');
        if (!sprite) return false;
        ctx.save();
        ctx.translate(0, tackY);
        ctx.rotate(boat.sailAngle);
        const luff = boat.luffIntensity || 0;
        const angleRatio = Math.min(1.0, Math.abs(boat.sailAngle) / (Math.PI / 4));
        // Floor the camber squash — a sail scaled too thin reads as a broken sliver
        const flatten = Math.max(0.5, (0.6 + 0.4 * angleRatio) * (1 - luff * 0.8));
        if (luff > 0) ctx.transform(1, 0, Math.sin(state.time * 30) * 0.3 * luff, 1, 0, 0);
        // boomSide lerps through 0 as the boom swings across in a tack/gybe —
        // use its sign for which side the camber bulges and floor the magnitude
        // so the sail keeps its body mid-swing instead of collapsing to a line
        const side = boat.boomSide < 0 ? -1 : 1;
        const body = Math.max(0.7, Math.abs(boat.boomSide));
        ctx.scale(-side * body * flatten * scale, scale);
        ctx.globalAlpha = 0.9 * (boat.opacity !== undefined ? boat.opacity : 1.0);
        const u = 1024 / BOAT_SPRITE_SCALE;
        ctx.drawImage(sprite, -512 / BOAT_SPRITE_SCALE, -112 / BOAT_SPRITE_SCALE, u, u);
        ctx.restore();
        return true;
    };
    const sailColor = boat.colors.sail;
    const spinColor = boat.colors.spinnaker;

    if (!drawSailSprite('main', -5, sailColor, 1)) drawSailFunc(false);
    const progress = boat.spinnakerDeployProgress;
    const jibScale = Math.max(0, 1 - progress * 2);
    const spinScale = Math.max(0, (progress - 0.5) * 2);
    if (jibScale > 0.01 && !drawSailSprite('jib', -25, sailColor, jibScale)) drawSailFunc(true, jibScale);
    if (spinScale > 0.01 && !drawSailSprite('spin', -28, spinColor, spinScale)) drawSpinnaker(spinScale);

    // Masthead fly (wind pennant) — streams downwind with the APPARENT wind. You can
    // watch it swing forward as the boat accelerates ("the boat makes its own wind"),
    // and it's the realistic cue for trimming and reading the lift/header in a puff.
    // Player only: it is an instrument, and nine more fluttering ribbons made the
    // one that matters harder to pick out of the fleet.
    //
    // Drawn after the sails: a real fly sits above the rig, and underneath them
    // only ~25% of the ribbon survived at any point of sail. Anchored at the mast
    // rather than the stern — at the transom it reads as a burgee (decoration) and
    // sits in the boom clutter, where at the mast it lands where the eye already is.
    // Kept short so that being on top buys visibility without adding noise.
    if (boat.apparentWind && boat.isPlayer) {
        const rel = normalizeAngle(boat.apparentWind.direction - boat.heading);
        const fx = -Math.sin(rel), fy = Math.cos(rel); // streams to where wind blows TO (local frame)
        const px2 = -fy, py2 = fx; // perpendicular, for the flutter wave

        // Breeze 0..1 over the sailable range. Light air lets the ribbon fall into
        // slow, wide swings; as it builds, the fly pulls taut and shivers instead —
        // faster but tighter.
        //
        // state.time runs at 0.24 units/sec, so cycles/sec = freq * 0.24 / 2pi.
        // 68..158 is 2.6Hz drifting to 6.0Hz (the old flat 55 was 2.1Hz). Well
        // clear of the 60fps sampling limit, which starts to bite around 15Hz.
        const breeze = Math.min(1, Math.max(0, (boat.apparentWind.speed - 4) / 16));
        const len = 9 + 4 * breeze;
        const freq = 68 + 90 * breeze;
        const amp = 3.2 - 2.1 * breeze;

        // Phase is accumulated rather than computed as time*freq. With a frequency
        // that moves with the wind, that product lurches whenever the breeze shifts
        // — and the jump scales with elapsed race time, so it gets worse the longer
        // you sail. Integrating keeps the wave continuous across gusts and gybes.
        const dt = Math.min(0.1, Math.max(0, state.time - (boat.telltaleTime ?? state.time)));
        boat.telltaleTime = state.time;
        boat.telltalePhase = ((boat.telltalePhase ?? 0) + dt * freq) % (Math.PI * 2);
        const t = boat.telltalePhase;

        ctx.save();
        ctx.strokeStyle = settings.telltaleColor || '#fbbf24';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // Travelling wave down the ribbon, amplitude growing toward the free end
        ctx.beginPath();
        ctx.moveTo(0, -5);
        for (let i = 1; i <= 6; i++) {
            const f = i / 6;
            const wave = Math.sin(t - f * 4.5) * f * f * amp;
            ctx.lineTo(fx * len * f + px2 * wave, -5 + fy * len * f + py2 * wave);
        }
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

function isConflictSoon(b1, b2) {
    const distSq = (b1.x - b2.x)**2 + (b1.y - b2.y)**2;
    if (distSq < 80*80) return true; // Very close/overlapping

    // Relative velocity
    // velocity is units per frame (1/60s)
    const vx = b1.velocity.x - b2.velocity.x; // Velocity of B1 relative to B2
    const vy = b1.velocity.y - b2.velocity.y;

    // Relative position of B1 from B2
    const px = b1.x - b2.x;
    const py = b1.y - b2.y;

    // Check if moving closer
    // d/dt (P.P) = 2 P.V
    const dot = px * vx + py * vy;

    // If dot > 0, distance is increasing (moving apart)
    if (dot >= 0) return false;

    // Time to CPA
    const vSq = vx*vx + vy*vy;
    if (vSq < 0.0001) return false;

    // t_cpa = -(P.V) / (V.V)
    const t = -dot / vSq;

    // Thresholds
    // 10 seconds = 600 frames at 60fps
    if (t > 600) return false;

    // CPA Distance
    // P_cpa = P + V*t
    const cpaX = px + vx * t;
    const cpaY = py + vy * t;
    const cpaDistSq = cpaX*cpaX + cpaY*cpaY;

    // 120 units is approx 3-4 boat lengths (safety margin)
    if (cpaDistSq < 120*120) return true;

    return false;
}

function drawRulesOverlay(ctx) {
    if (!state.showNavAids || !settings.penaltiesEnabled || state.race.status === 'finished') return;

    const checkDist = 400; // Increased range for visibility

    // Helper to draw triangle
    const drawTriangle = (boat, target, color) => {
        const dx = target.x - boat.x;
        const dy = target.y - boat.y;
        const angle = Math.atan2(dy, dx);

        // Calculate distance based on hull shape (elliptical approx)
        // Hull is roughly width=15 (rx=25 w/ pad), length=30 (ry=40 w/ pad)
        const dAngle = angle - boat.heading;
        const rx = 25, ry = 40;
        const lx = Math.cos(dAngle), ly = Math.sin(dAngle);
        const dist = (rx * ry) / Math.sqrt((ry * lx) ** 2 + (rx * ly) ** 2);

        const tx = boat.x + Math.cos(angle) * dist;
        const ty = boat.y + Math.sin(angle) * dist;

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(angle);

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        // Pointing right (towards target)
        ctx.moveTo(10, 0);
        ctx.lineTo(-6, 7);
        ctx.lineTo(-6, -7);
        ctx.closePath();

        ctx.fill();
        ctx.restore();
    };

    // HYSTERESIS, per pair. The raw tests are re-asked every frame and both sit on knife
    // edges: isConflictSoon is a projection with a threshold, and getRightOfWay flips its
    // winner where a rule boundary runs (the overlap line, windward/leeward nearly abeam,
    // tack near head-to-wind). Drawn raw, a pair near either edge flickers at frame rate —
    // green and red trading places is the worst case, because it reverses the instruction.
    // So the display is a DEBOUNCED VIEW of the raw answer: a new verdict must hold for
    // SWITCH_HOLD before the triangles change, and a vanished conflict lingers OFF_DELAY
    // before they hide. The physics and penalties still read the raw answer every frame —
    // this steadies the advice, never the rules.
    const SWITCH_HOLD = 0.35, OFF_DELAY = 0.45;
    const t = state.time;
    if (!drawRulesOverlay._pairs) drawRulesOverlay._pairs = new Map();
    const pairs = drawRulesOverlay._pairs;

    for (let i = 0; i < state.boats.length; i++) {
        const b1 = state.boats[i];
        for (let j = i + 1; j < state.boats.length; j++) {
            const b2 = state.boats[j];
            const distSq = (b1.x - b2.x)**2 + (b1.y - b2.y)**2;

            let raw = null;
            if (distSq < checkDist * checkDist && isConflictSoon(b1, b2)) {
                const res = getRightOfWay(b1, b2);
                if (res.boat) raw = { wi: res.boat === b1 ? i : j, rule: res.rule };
            }

            const key = i * 1000 + j;
            let ps = pairs.get(key);
            if (ps && ps.at > t) ps = null;                 // a new race rewound the clock
            if (raw) {
                if (!ps || !ps.show) {
                    ps = { show: true, wi: raw.wi, rule: raw.rule, at: t, pend: null, offAt: null };
                } else if (raw.wi === ps.wi && raw.rule === ps.rule) {
                    ps.pend = null; ps.offAt = null;        // steady verdict — keep it
                } else if (!ps.pend || ps.pend.wi !== raw.wi || ps.pend.rule !== raw.rule) {
                    ps.pend = { wi: raw.wi, rule: raw.rule, at: t };   // new verdict: start the clock
                    ps.offAt = null;
                } else if (t - ps.pend.at >= SWITCH_HOLD) {
                    ps.wi = ps.pend.wi; ps.rule = ps.pend.rule; ps.pend = null;
                }
            } else if (ps && ps.show) {
                ps.pend = null;
                if (ps.offAt == null) ps.offAt = t;
                if (t - ps.offAt >= OFF_DELAY) ps.show = false;
            }
            if (!ps) continue;
            pairs.set(key, ps);
            if (!ps.show) continue;

            const winner = ps.wi === i ? b1 : b2;
            const loser  = ps.wi === i ? b2 : b1;
            if (ps.pend) {
                // CONTESTED: a new verdict is holding its SWITCH_HOLD clock, which means
                // the law has flipped and the display is about to follow. Matched amber
                // on BOTH boats says exactly that — the advice is damped and currently
                // unstable — instead of letting the old green/red claim a certainty the
                // law no longer has. Symmetric on purpose: Rule 21's orange/red pairing
                // stays unambiguous because it is not.
                drawTriangle(winner, loser, '#fbbf24');
                drawTriangle(loser, winner, '#fbbf24');
            } else if (ps.rule === 'Rule 21') {
                // Section D override — orange for OCS/penalty
                drawTriangle(winner, loser, '#f59e0b');
                drawTriangle(loser, winner, '#ef4444');
            } else {
                // Normal — green ROW, red give-way
                drawTriangle(winner, loser, '#4ade80');
                drawTriangle(loser, winner, '#ef4444');
            }
        }
    }
}

// Course-overlay kit (SailGP-inspired): thin mint-teal geometry, dashed
// laylines, amber only for the active in-zone state, Saira italic labels.
const NAV_RGB = '64, 245, 200';

function drawRoundingArrows(ctx) {
    if (!state.showNavAids || !state.course || !state.course.marks || state.race.status === 'finished') return;

    // Player Leg determines what to show
    const player = state.boats[0];
    // No arrows on Start (0) or Finish (totalLegs)
    if (player.raceState.leg === 0 || player.raceState.leg >= state.race.totalLegs) return;

    // ISLAND ROUNDING: the active mark is ONE mark, so the arrow belongs on it. Every other
    // nav-aid here has an islandRound branch; this one did not, and `legMarks()` returns null
    // on a leg that rounds rather than crosses — so the `|| [0, 1]` fallback below reached for
    // the first two marks in the array, which are the START LINE. Crossing the start turned
    // the line you had just left into a phantom gate with rounding arcs on both ends, while
    // the mark you were actually sailing to had none.
    if (state.course.type === 'islandRound') {
        const e = routeLeg(player.raceState.leg);
        const rm = (e && e.kind === 'round' && e.mark) ? e.mark : null;
        if (!rm) return;
        // Leaving the mark to STARBOARD means the bearing angle increases (see the sweep test
        // in updateBoatRaceState) — and with y down, increasing angle is clockwise on screen,
        // which is `counterclockwise = false`. So port rounds are the ccw ones.
        const ccw = (rm.side === 'port');
        const R = Math.max(90, (rm.zone || 0) * 0.42);
        ctx.save();
        ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(${NAV_RGB}, 0.85)`; ctx.fillStyle = `rgba(${NAV_RGB}, 0.85)`;
        ctx.translate(rm.x, rm.y);
        ctx.rotate(state.time * 8.0 * (ccw ? -1 : 1));
        const start = 0, end = Math.PI;
        ctx.beginPath(); ctx.arc(0, 0, R, start, end, ccw); ctx.stroke();
        ctx.translate(R * Math.cos(end), R * Math.sin(end));
        ctx.rotate(end + (ccw ? -Math.PI / 2 : Math.PI / 2));
        ctx.beginPath();
        ctx.moveTo(-10, -10); ctx.lineTo(10, 0); ctx.lineTo(-10, 10); ctx.lineTo(-6, 0); ctx.fill();
        ctx.restore();
        return;
    }

    // Rounding direction alternates with which end of the gate you take: at the
    // windward gate the first mark is left to port, at the leeward line it is the
    // second. Keyed on the route ROLE, not leg parity — leg 0 targets the start
    // line and must read as a leeward-style pair even though it is a beat.
    const amIdx = legMarks(player.raceState.leg) || [0, 1];
    const amWindward = (routeLeg(player.raceState.leg) || {}).role === 'windward';
    const activeMarks = amIdx.map((index, k) => ({ index, ccw: amWindward ? k === 0 : k === 1 }));

    ctx.save();
    ctx.lineWidth = 7; ctx.strokeStyle = `rgba(${NAV_RGB}, 0.85)`; ctx.fillStyle = `rgba(${NAV_RGB}, 0.85)`; ctx.lineCap = 'round';
    const windDir = state.wind.baseDirection;

    for (const item of activeMarks) {
        if (item.index >= state.course.marks.length) continue;
        const m = state.course.marks[item.index];
        ctx.save(); ctx.translate(m.x, m.y);
        let start, end, ccw = item.ccw;
        if (item.index === 0 || item.index === 2) { start = 0; end = Math.PI; } // Left
        else { start = Math.PI; end = 0; } // Right
        // Invert if Upwind Gate vs Leeward Gate direction?
        // Mark 2 (Left Upwind): Round CCW. 0->PI. Correct.
        // Mark 3 (Right Upwind): Round CW. PI->0. Correct.
        // Mark 0 (Left Leeward): Round CW. 0->PI.
        if (item.index === 0) ccw = false; // Override for Leeward Left
        if (item.index === 1) ccw = true; // Override for Leeward Right

        const anim = state.time * 8.0 * (ccw ? -1 : 1);
        ctx.rotate(windDir + anim);
        ctx.beginPath(); ctx.arc(0, 0, 80, start, end, ccw); ctx.stroke();
        const tipX = 80 * Math.cos(end), tipY = 80 * Math.sin(end);
        let tangent = end + (ccw ? -Math.PI/2 : Math.PI/2);
        ctx.translate(tipX, tipY); ctx.rotate(tangent);
        ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 0); ctx.lineTo(-10, 10); ctx.lineTo(-6, 0); ctx.fill();
        ctx.restore();
    }
    ctx.restore();
}

// ... Reused standard draw functions ...
function drawActiveGateLine(ctx) {
    const player = state.boats[0];
    const finished = state.race.status === 'finished' || player.raceState.finished;
    const leg = player.raceState.leg;
    const totalLegs = state.race.totalLegs;

    // One crossing line, with the shared treatment: bright when it is what the player is
    // being asked for, slate furniture otherwise, label facing the approaching racer.
    const drawLine = (indices, target, color, label, dir) => {
        const m1 = state.course.marks[indices[0]], m2 = state.course.marks[indices[1]];
        if (!m1 || !m2) return;
        ctx.save();
        ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y);
        ctx.shadowColor = color; ctx.shadowBlur = target ? 15 : 0;
        ctx.strokeStyle = color; ctx.lineWidth = target ? 5 : 3;
        ctx.globalAlpha = target ? 1 : 0.4;
        ctx.lineDashOffset = -state.time * 20; ctx.stroke();
        if (label) {
            ctx.fillStyle = color; ctx.font = FONT.display(24); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            // Face approaching racers: the text's top points in the direction of travel
            // through the line — the crossing normal n = (dy, -dx) times the entry's own
            // crossing sign. (This used to look up "the other gate" as marks[2]/[3] —
            // which do not exist on a course with one line and a rounding, so it read
            // undefined and crashed the whole draw.)
            const angle = Math.atan2(m2.y - m1.y, m2.x - m1.x);
            const tx = (m2.y - m1.y) * dir, ty = -(m2.x - m1.x) * dir;
            ctx.translate((m1.x + m2.x) / 2, (m1.y + m2.y) / 2);
            let rot = angle;
            if (Math.sin(rot) * tx - Math.cos(rot) * ty < 0) rot += Math.PI;
            ctx.rotate(rot); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.strokeText(label, 0, 0); ctx.fillText(label, 0, 0);
        }
        ctx.restore();
    };

    if (state.course.type === 'islandRound') {
        // A rounding course keeps its lines on the water for the whole race — they are
        // fixed furniture you will come back to. Read them off the ROUTE: on Glacier
        // Sound start and finish are the same pair; on Lighthouse Cove they are two
        // different lines, and BOTH draw — the finish permanently labelled so the two
        // can never be confused.
        const route = state.course.route || [];
        const startE = route[0] || {};
        const sIdx = startE.marks || [0, 1];
        const finE = route[totalLegs] || route[route.length - 1] || {};
        const fIdx = finE.marks || sIdx;
        const sameLine = fIdx[0] === sIdx[0] && fIdx[1] === sIdx[1];

        const finTarget = finished || leg >= totalLegs;
        if (sameLine) {
            // One line playing both roles — the original single-line logic.
            const target = finTarget || leg === 0;
            let color = '#ffffff';
            if (finished) color = '#4ade80';
            else if (leg === 0 && state.race.status === 'prestart') color = '#ef4444';
            // The same slate the greyed-out buoys use, so "not the thing you are sailing
            // to" looks the same whatever piece of furniture is saying it.
            else if (!target) color = '#94a3b8';
            const label = leg === 0 ? 'START' : (finTarget ? 'FINISH' : '');
            const dir = ((routeLeg(Math.min(leg, totalLegs)) || {}).dir) || 1;
            drawLine(sIdx, target, color, label, dir);
        } else {
            const startTarget = !finished && leg === 0;
            let sColor = '#94a3b8';
            if (startTarget) sColor = state.race.status === 'prestart' ? '#ef4444' : '#ffffff';
            drawLine(sIdx, startTarget, sColor, startTarget ? 'START' : '', startE.dir || 1);
            const fColor = finished ? '#4ade80' : (finTarget ? '#ffffff' : '#94a3b8');
            drawLine(fIdx, finTarget, fColor, 'FINISH', finE.dir || 1);
        }
        return;
    }

    // Windward-leeward: the line appears only when it is the thing to cross.
    let indices;
    if (finished) {
        indices = finishMarks() || [0, 1];
    } else {
        if (leg !== 0 && leg !== totalLegs) return;
        indices = legMarks(leg) || [0, 1];
    }
    let color = '#ffffff';
    if (finished) color = '#4ade80';
    else if (leg === 0 && state.race.status === 'prestart') color = '#ef4444';
    const label = (leg === 0 && !finished) ? 'START' : 'FINISH';
    const dir = ((routeLeg(Math.min(leg, totalLegs)) || {}).dir) || 1;
    drawLine(indices, true, color, label, dir);
}

// ⚠️ THE TRAINING AIDS BELONG TO ONE VENUE, AND IT IS A DESIGN LINE RATHER THAN A TOGGLE.
// Ladder lines and laylines are a COACHING overlay: they hand you the answer to "can I lay
// it yet" and "am I gaining on that boat", which are two of the things learning to race
// consists of working out from the water. Sea Trials is the practice course — that is what
// it is for — so it keeps them, and everywhere else you read the shifts and the angles.
//
// Venue KEY rather than a doc field on purpose. This is a property of one named course in
// the game's progression, not a knob a venue author should be reaching for; keys are
// identity here (see VENUE_ORDER's note), so the test is stable.
function trainingAidsOn() {
    return (state.race.venue || settings.venue) === 'seatrials';
}

function drawLadderLines(ctx) {
    const player = state.boats[0];
    if (!state.showNavAids || state.race.status === 'prestart' || state.race.status === 'finished' || player.raceState.finished) return;
    if (!trainingAidsOn()) return;

    const _ax = courseAxis();
    if (!_ax) return;
    const c1x = _ax.start.x, c1y = _ax.start.y, c2x = _ax.windward.x, c2y = _ax.windward.y;
    const dx = _ax.dx, dy = _ax.dy, len = _ax.len;
    const wx = _ax.ux, wy = _ax.uy, px = -wy, py = wx;
    const courseAngle = Math.atan2(wx, -wy);

    // Ladder rungs span the course AXIS — from the leeward/start line to the
    // windward gate — so they are keyed on the two ends of the route, and flipped
    // by whether this leg is sailed up or down.
    const dnPair = (routeLeg(0) && routeLeg(0).marks) || [0, 1];
    const upPair = (routeLeg(1) && routeLeg(1).marks) || [2, 3];
    const goingUp = legGoesUpwind(player.raceState.leg);
    const nextPair = goingUp ? upPair : dnPair;
    const prevPair = goingUp ? dnPair : upPair;
    let prevIndex = prevPair[0];
    let nextIndex = nextPair[0];

    const mPrev = state.course.marks[prevIndex], mNext = state.course.marks[nextIndex];
    const startProj = mPrev.x*wx + mPrev.y*wy, endProj = mNext.x*wx + mNext.y*wy;
    let minP = Math.min(startProj, endProj), maxP = Math.max(startProj, endProj);

    const interval = 500;
    const firstLine = Math.floor(minP/interval)*interval;

    // Boundary & Laylines Projection logic same as before...
    const uL = mNext.x*wx + mNext.y*wy, vL = mNext.x*px + mNext.y*py;
    const mNextR = state.course.marks[nextPair[1]];
    const uR = mNextR.x*wx + mNextR.y*wy, vR = mNextR.x*px + mNextR.y*py;
    const b = state.course.boundary;
    const uC = b.x*wx + b.y*wy, vC = b.x*px + b.y*py, R = b.radius;

    const isUpwindTarget = goingUp;
    const delta = normalizeAngle(state.wind.direction - courseAngle);
    let slopeLeft = Math.tan(delta + Math.PI/4), slopeRight = Math.tan(delta - Math.PI/4);
    if (!isUpwindTarget) { slopeLeft = Math.tan(delta - Math.PI/4); slopeRight = Math.tan(delta + Math.PI/4); }

    ctx.save(); ctx.strokeStyle = `rgba(${NAV_RGB}, 0.5)`; ctx.lineWidth = 3;
    ctx.font = FONT.display(22); ctx.fillStyle = `rgba(${NAV_RGB}, 0.9)`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // Labels lie along the rung itself (SailGP style), flipped to stay upright ON SCREEN
    // (the camera rotates, so the flip test must be in screen space, not world space)
    let labelAngle = Math.atan2(py, px);
    if (Math.abs(normalizeAngle(labelAngle - state.camera.rotation)) > Math.PI / 2) labelAngle += Math.PI;
    const toGateSign = (endProj > startProj) ? 1 : -1;
    const gateAngle = Math.atan2(toGateSign * wy, toGateSign * wx);

    for (let p = firstLine; p <= maxP; p+=interval) {
        if (p < minP) continue;
        if (Math.abs(p - endProj) < 1.0) continue;
        if (player.raceState.leg === 0 && Math.abs(p - startProj) < 1.0) continue;

        const dist = p - uL, distR = p - uR;
        const vMin = vL + dist * slopeLeft, vMax = vR + distR * slopeRight;
        const du = p - uC;
        if (Math.abs(du) >= R) continue;
        const dv = Math.sqrt(R*R - du*du);
        const finalMin = Math.max(vMin, vC - dv), finalMax = Math.min(vMax, vC + dv);

        if (finalMin < finalMax) {
            const cx = p*wx, cy = p*wy;
            const x1 = cx + finalMin*px, y1 = cy + finalMin*py;
            const x2 = cx + finalMax*px, y2 = cy + finalMax*py;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

            const distToGate = Math.abs(endProj - p) * 0.2;
            if (distToGate > 50) {
                 // Labels repeat at fixed world positions along the rung (static — the water
                 // moves past them), each with a chevron pointing toward the gate
                 const label = String(Math.round(distToGate));
                 const tw = ctx.measureText(label).width;
                 for (let v = Math.ceil((finalMin + 90) / 900) * 900; v <= finalMax - 90; v += 900) {
                     const lx = cx + v * px, ly = cy + v * py;
                     ctx.save();
                     ctx.translate(lx, ly);
                     ctx.rotate(labelAngle);
                     ctx.fillText(label, 0, -14);
                     ctx.translate(tw / 2 + 16, -14);
                     ctx.rotate(gateAngle - labelAngle);
                     ctx.beginPath();
                     ctx.moveTo(-4, -7); ctx.lineTo(4, 0); ctx.lineTo(-4, 7);
                     ctx.strokeStyle = `rgba(${NAV_RGB}, 0.9)`;
                     ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                     ctx.stroke();
                     ctx.restore();
                 }
            }
        }
    }
    ctx.restore();
}

// Is the target upwind of the boat? On a fixed course the legs are not
// alternating beats and runs, so this has to be measured rather than inferred
// from the leg number.
function isUpwindTo(boat, target) {
    const wx = Math.sin(state.wind.direction), wy = -Math.cos(state.wind.direction);
    const dx = target.x - boat.x, dy = target.y - boat.y;
    const l = Math.hypot(dx, dy) || 1;
    return ((dx / l) * wx + (dy / l) * wy) > 0;   // pointing into the wind
}

// ONE LAYLINE PER END, running back from that end, down and away from the line.
//
// Each end is laid on ONE tack — the starboard end on starboard, the port end on port —
// so each gets that tack's layline and no other. Written as the ray that leans AWAY from
// the other end, which is the same statement without needing to work out which end is
// which: the two close-hauled angles are 90 degrees apart, and the one pointing away from
// your neighbour is the tack that fetches you.
//
// So the pair DIVERGES. Taking the ray that leans TOWARD the other end gives the opposite
// tack at each end — two lines that cross below the middle of the line and read as a big X
// over the fleet. Clipping that X at its crossing makes a tidy wedge and is still the wrong
// two lines.
//
// ⚠️ THE PAIR IS GEOMETRIC, NOT AN INDEX PARITY. The windward-leeward path used to decide
// which end got which tack from `idx % 2`, i.e. from the order the marks happen to sit in
// the document. On Gatorgrass mark 0 is the EAST end, so parity handed each end the other's
// tack and drew the X above. "Lean away from your neighbour" cannot be ordered wrongly.
//
// THE WIND IS SAMPLED AT EACH END, so a line lying across a gradient shows its skew. This
// used to read the global `state.wind.direction` — the blend at the ROUTE CENTROID — which
// on Gatorgrass is 39 degrees off the wind actually at the line. A layline drawn from a
// wind measured two kilometres away is a decoration, not a nav aid.
function drawEndLaylines(ctx, pts, inset) {
    ctx.save(); ctx.lineWidth = 5.5;
    ctx.strokeStyle = `rgba(${NAV_RGB}, 0.72)`;
    for (let k = 0; k < pts.length; k++) {
        const m = pts[k], other = pts[k ^ 1];
        if (!m || !other) continue;
        const wHere = getWindAt(m.x, m.y).direction;
        let tx = other.x - m.x, ty = other.y - m.y;
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let best = null;
        for (const s of [-1, 1]) {
            const a = wHere + s * Math.PI / 4 + Math.PI;   // back down the close-hauled track
            const dx = Math.sin(a), dy = -Math.cos(a);
            const lean = dx * tx + dy * ty;
            if (!best || lean < best.lean) best = { dx, dy, lean };
        }
        const sx = m.x + best.dx * (inset || 0), sy = m.y + best.dy * (inset || 0);
        const t = Arena.rayHit(state.course.boundary, sx, sy, best.dx, best.dy);
        if (t === null) continue;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + best.dx * t, sy + best.dy * t);
        ctx.stroke();
    }
    ctx.restore();
}

function drawLayLines(ctx) {
    if (!state.showNavAids || state.race.status === 'finished') return;
    if (!trainingAidsOn()) return;
    const player = state.boats[0];
    const leg = player.raceState.leg;

    // Island course: the rounding is a single mark with a zone circle, and the finish is a
    // line you simply cross — neither wants laylines. Only the start does.
    if (state.course.type === 'islandRound') {
        if (leg !== 0) return;
        const pts = startLinePts();
        if (!pts[0] || !pts[1]) return;
        return drawEndLaylines(ctx, pts, 0);
    }

    // A FINISH *LINE* IS CROSSED, NOT LAID — but a finish GATE is still a gate.
    //
    // ⚠️ THIS USED TO SUPPRESS EVERY FINISH, and that was too broad by exactly one case. The
    // rule was written for Gatorgrass, where the windward gate IS the finish, on the argument
    // that you do not lay a line you merely cross. True of a LINE. False of a gate at the end
    // of an ordinary leg: Sea Trials runs down to its leeward gate four times and gets gybe
    // laylines every lap, then crosses the same gate on the fifth and got nothing — the same
    // water, the same decision about which end to take, and the aid silently gone at the one
    // moment it decides the race. That inconsistency is what a player reads as a bug.
    //
    // So the LEG's geometry decides, not the finish flag, and `kind` is what separates them.
    // Only windward-leeward courses reach this line at all — every islandRound venue has
    // already returned above, since it draws laylines for the start and nothing else.
    // `routeLeg` is the authority on which leg finishes; `totalLegs` alone is not, because
    // the route deliberately generates entries past it.
    const rl = routeLeg(leg);
    if (rl && rl.finish && rl.kind === 'line') return;

    // Downwind gates keep their own treatment below; everything approached on a beat —
    // the start line and every windward gate — is the same two-ended problem.
    const targets = legMarks(leg);
    if (!targets) return;
    const isUpwind = legGoesUpwind(leg);
    // ⚠️ A FINISH HAS NO ZONE, SO ITS LAYLINES RUN ALL THE WAY IN. The 165 inset exists to
    // keep a layline from cutting across the rounding circle drawn around a mark you have to
    // go round. There is no circle at a finish and nothing to round — you cross — so the
    // inset only opened a gap between the line and the mark you are aiming at, in the one
    // place the aid has to be exact. Same reason the start line is already 0.
    const zoneRadius = (leg === 0 || (rl && rl.finish)) ? 0 : 165;
    const pts = targets.map(i => state.course.marks[i]);
    if (!pts[0] || !pts[1]) return;
    if (isUpwind) return drawEndLaylines(ctx, pts, zoneRadius);

    // Running down to a leeward gate: the pair runs UPWIND from each mark, still leaning
    // away from its neighbour so the two diverge rather than cross.
    ctx.save(); ctx.lineWidth = 5.5;
    ctx.strokeStyle = `rgba(${NAV_RGB}, 0.72)`;
    for (let k = 0; k < pts.length; k++) {
        const m = pts[k], other = pts[k ^ 1];
        const wHere = getWindAt(m.x, m.y).direction;
        let tx = other.x - m.x, ty = other.y - m.y;
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let best = null;
        for (const s of [-1, 1]) {
            const a = wHere + s * Math.PI / 4;
            const dx = Math.sin(a), dy = -Math.cos(a);
            const lean = dx * tx + dy * ty;
            if (!best || lean < best.lean) best = { dx, dy, lean };
        }
        const sx = m.x + best.dx * zoneRadius, sy = m.y + best.dy * zoneRadius;
        const t = Arena.rayHit(state.course.boundary, sx, sy, best.dx, best.dy);
        if (t === null) continue;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + best.dx * t, sy + best.dy * t);
        ctx.stroke();
    }
    ctx.restore();
}

function drawMarkZones(ctx) {
    if (!state.showNavAids || state.race.status === 'finished') return;
    const player = state.boats[0];
    let active = [];

    // MARKS WITH NO BUOY. A rounding laid on an island, or a transit — there is nothing
    // physically there, so the indicator IS the mark: a ring and a cross, pulsing gently
    // so it reads as course information rather than as scenery.
    for (const m of state.course.marks) {
        if (m.kind !== 'none') continue;
        const pulse = 1 + Math.sin(state.time * 2.2 + m.x * 0.01) * 0.06;
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.strokeStyle = `rgba(${NAV_RGB}, 0.75)`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 22 * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-30, 0); ctx.lineTo(-12, 0);
        ctx.moveTo(12, 0);  ctx.lineTo(30, 0);
        ctx.moveTo(0, -30); ctx.lineTo(0, -12);
        ctx.moveTo(0, 12);  ctx.lineTo(0, 30);
        ctx.stroke();
        ctx.restore();
    }

    // Rounding course: the zone circle belongs to whatever mark THIS leg rounds — read
    // it off the route entry, not off `roundMark`, which is only the first rounding of
    // the course. Keying on `leg !== 1` left Lighthouse Cove's legs 2-5 with no circle
    // at all, and always drawing `roundMark` put leg 1's circle on the wrong can.
    //
    // Drawn SOLID: the zone is hard course geometry, same as a gate's — the dashes read
    // as a suggestion. And amber the moment the hull is inside it, exactly like a gate.
    if (state.course.type === 'islandRound') {
        const e = routeLeg(player.raceState.leg);
        const rm = (e && e.kind === 'round' && e.mark) ? e.mark : null;
        if (!rm) return;
        const h = player.heading, sinH = Math.sin(h), cosH = Math.cos(h);
        const bowX = player.x + 25 * sinH, bowY = player.y - 25 * cosH;
        const sternX = player.x - 30 * sinH, sternY = player.y + 30 * cosH;
        const closest = getClosestPointOnSegment(rm.x, rm.y, bowX, bowY, sternX, sternY);
        const inZone = (closest.x - rm.x) ** 2 + (closest.y - rm.y) ** 2 < rm.zone * rm.zone;
        ctx.save();
        ctx.strokeStyle = inZone ? 'rgba(251, 191, 36, 0.95)' : `rgba(${NAV_RGB}, 0.55)`;
        ctx.lineWidth = inZone ? 5.5 : 5;
        ctx.beginPath(); ctx.arc(rm.x, rm.y, rm.zone, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        return;
    }

    // Exclude Start (0) and Finish (totalLegs)
    if (player.raceState.leg > 0 && player.raceState.leg < state.race.totalLegs) {
        active = legMarks(player.raceState.leg) || [];
    } else return;

    ctx.save();
    const h = player.heading, sinH = Math.sin(h), cosH = Math.cos(h);
    const bowX = player.x + 25*sinH, bowY = player.y - 25*cosH;
    const sternX = player.x - 30*sinH, sternY = player.y + 30*cosH;

    for (const idx of active) {
        const m = state.course.marks[idx];
        const closest = getClosestPointOnSegment(m.x, m.y, bowX, bowY, sternX, sternY);
        const distSq = (closest.x-m.x)**2 + (closest.y-m.y)**2;
        const inZone = distSq < 165*165;
        ctx.strokeStyle = inZone ? 'rgba(251, 191, 36, 0.95)' : `rgba(${NAV_RGB}, 0.68)`;
        ctx.lineWidth = inZone ? 5.5 : 4;
        ctx.beginPath(); ctx.arc(m.x, m.y, 165, 0, Math.PI*2); ctx.stroke();
    }

    // Flat GATE label on the water between the active gate marks
    const gA = state.course.marks[active[0]], gB = state.course.marks[active[1]];
    const gx = (gA.x + gB.x) / 2, gy = (gA.y + gB.y) / 2;
    const gAng = Math.atan2(gB.y - gA.y, gB.x - gA.x);
    ctx.save();
    ctx.translate(gx, gy);
    let rot = gAng; if (Math.abs(normalizeAngle(rot - state.camera.rotation)) > Math.PI / 2) rot += Math.PI;
    ctx.rotate(rot);
    ctx.font = FONT.display(52);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.30)';
    ctx.fillText('GATE ' + player.raceState.leg, 0, 0);
    ctx.restore();
    ctx.restore();
}

const NIGHT_TINT = '#4a5aa0';        // what the ambient multiplies TOWARD: cool moonlight,
                                     // not grey — a neutral wash reads as underexposure
const BIO_COLOR = '#2b9dff';         // ELECTRIC BLUE, off the reference photographs and the
                                     // venue card. An early cut was a pale cyan (#8ffbff)
                                     // and it read as mint: real dinoflagellate bloom is a
                                     // saturated blue with only its hottest cores going pale.
const BIO_CORE = '#cfe9ff';          // the pale blue-white centre, never pure white

// ── HOW LONG A BIOLUMINESCENT TRAIL LIVES ───────────────────────────────────
// Researched rather than picked, and the research changed the shape of the effect.
//
// A dinoflagellate flash is SHORT: rise 10-50 ms, decay ~200 ms, the whole thing about a
// tenth of a second, and a spent cell does not immediately re-fire. So the light in a wake
// is NOT one glow persisting — it is a moving front of fresh cells being triggered as the
// boat reaches them. What you see behind a hull is therefore a map of where the water is
// STILL shearing hard enough to fire cells, and the trail ends where that shear drops below
// threshold (~0.04-0.32 N/m^2 by species), not where the light "fades out".
//
// That gives the effect its two-part shape, which is what is drawn: a short BRIGHT stretch
// of churn right behind the transom where shear is well over threshold, and a long dimmer
// band behind it where the disturbed water is still just tripping cells.
//
// 9 s is a GAME number on top of that physics. At racing speed (~7 kt = 105 u/s) it draws
// about 950 units, ~17 boat lengths — long enough to read the fleet's recent history across
// a screen, which is the tactical gift of a night venue, and short enough not to smear the
// whole strait. The foam ribbon stays 2.25 s; these are different quantities, and only the
// light outlives the foam.
const BIO_TRAIL_LIFE = 9;
const BIO_CHURN_LIFE = 1.6;          // the bright, over-threshold stretch at the stern

// ⚠️ COOL WHITE, NOT CREAM. This was warm (#f6edd2), taken off the venue card, on the
// theory that a blue-white path disappears into blue water. The art references say
// otherwise: every one of them puts a near-white, faintly blue column on blue water and it
// reads perfectly, because what separates it is BRIGHTNESS, not hue. Warm cream on this
// palette read as lamplight rather than moonlight.
const MOON_COLOR = '#e6f0ff';

// ⚠️ RADIAL GRADIENTS ARE NOT FREE. The surf is painted as a field of soft blobs stepped
// along the coast, and building a fresh createRadialGradient for each one cost 4.7 ms a
// frame near shore — 28% of a 60 fps budget for one decorative layer. A gradient cannot be
// repositioned, but a SPRITE can: the blob is rendered once into an offscreen canvas and
// then stamped with drawImage, which is a blit rather than a shader setup. Same picture,
// a fraction of the cost, and it scales to whatever radius the surge wants.
const _glowSprites = {};
function glowSprite(rgb) {
    let s = _glowSprites[rgb];
    if (s) return s;
    const R = 64;
    s = document.createElement('canvas');
    s.width = s.height = R * 2;
    const g2 = s.getContext('2d');
    const grad = g2.createRadialGradient(R, R, 0, R, R, R);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.45, `rgba(${rgb},0.45)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g2.fillStyle = grad;
    g2.fillRect(0, 0, R * 2, R * 2);
    _glowSprites[rgb] = s;
    return s;
}

function nightAmt() {
    const n = window.WATER_CONFIG && window.WATER_CONFIG.night;
    return (typeof n === 'number' && n > 0) ? Math.min(1, n) : 0;
}
// Where the moon stands, as a compass bearing the glitter path runs along. Authored beside
// `night`; the default puts it off the starboard bow of a boat beating north.
function moonBearing() {
    const m = window.WATER_CONFIG && window.WATER_CONFIG.moonDir;
    return ((typeof m === 'number') ? m : 25) * Math.PI / 180;
}

// MOONLIGHT BELONGS TO THE WATER, so it is drawn with the surface — before the wakes, the
// wind waves and the fleet, and BEFORE the ambient wash, which then knocks it back like
// everything else. It lived in the emissive pass at first and that was wrong twice over: it
// floated on top of the boats, and it kept full brightness while the world around it dimmed,
// which is exactly what made it feel pasted on rather than lying on the sea.
//
// No water test is needed here: the land is drawn later and simply covers it.
function drawNightWater(ctx) {
    const n = nightAmt();
    if (n <= 0) return;
    const cam = state.camera, t = state.time;
    const halfW = ctx.canvas.width * 0.5 + 120, halfH = ctx.canvas.height * 0.5 + 120;
    const inView = (x, y) => Math.abs(x - cam.x) < halfW && Math.abs(y - cam.y) < halfH;
    const mb = moonBearing();
    const mx = Math.sin(mb), my = -Math.cos(mb);
    const px = -my, py = mx;
    const reach = Math.max(halfW, halfH) * 1.5;
    const band = 165;
    const mAng = Math.atan2(my, mx);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(cam.x, cam.y);
    ctx.rotate(mAng);
    // ⚠️ THE WATER IN THE PATH IS LIT, and that is what a chain of dashes alone could not
    // say. An early attempt at a soft band read as FOG and was cut — but that one lived in
    // the EMISSIVE pass at full brightness, floating above the scene. Down here it is part
    // of the surface and the ambient wash knocks it back with the rest of the water, so it
    // reads as sea catching the moon rather than haze lying on it. Kept faint: the glints
    // are still the effect, this only gives them water to sit on.
    // BAKED: a gradient fillRect under rotation + 'lighter' over ~0.9M px was ~2 ms a
    // frame for a strip that only changes with the night level or a resize. Rasterized
    // once at quarter scale, blitted — the gradient is smooth, so the upscale is free.
    if (!window._moonBand || window._moonBand.n !== n || window._moonBand.reach !== reach) {
        const bs = 0.25;
        const c = document.createElement('canvas');
        c.width = Math.max(2, Math.ceil(reach * 2 * bs));
        c.height = Math.max(2, Math.ceil(band * 2 * bs));
        const bg = c.getContext('2d');
        const g2 = bg.createLinearGradient(0, 0, 0, c.height);
        g2.addColorStop(0, 'rgba(214,230,255,0)');
        g2.addColorStop(0.5, `rgba(214,230,255,${(0.15 * n).toFixed(3)})`);
        g2.addColorStop(1, 'rgba(214,230,255,0)');
        bg.fillStyle = g2;
        bg.fillRect(0, 0, c.width, c.height);
        window._moonBand = { cv: c, n, reach };
    }
    ctx.drawImage(window._moonBand.cv, -reach, -band, reach * 2, band * 2);

    // The flash, as a BAKED SPRITE. Each flash was a beginPath/ellipse/fill — path setup
    // and rasterization for ~300 tiny shapes a frame, ~3 ms of Glowtide's budget. One
    // baked lozenge drawn at (wide, len) is the same picture (the sprite's antialiased
    // edge downscales into the same soft rim) for a fraction of the cost.
    if (!window._moonLozenge) {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 48;
        const lg = c.getContext('2d');
        lg.fillStyle = MOON_COLOR;
        lg.beginPath();
        lg.ellipse(8, 24, 8, 24, 0, 0, Math.PI * 2);
        lg.fill();
        window._moonLozenge = c;
    }
    const loz = window._moonLozenge;
    // One matrix per flash instead of save/translate/rotate/restore — four state-stack
    // ops on ~300 draws was a measurable slice of the loop itself.
    const M0 = ctx.getTransform();
    // ⚠️ DASHES ACROSS THE PATH, IN A NARROW COLUMN — taken off the venue card rather than
    // invented. Two earlier cuts got this wrong in instructive ways. A soft gradient band
    // read as FOG, because a moon path has no haze in it. Then streaks elongated TOWARD the
    // moon read as RAIN, because Glowtide already draws pale diagonal wind streaks and a
    // second diagonal field just joined them.
    for (let i = 0; i < 700; i++) {
        const u = ((i * 97.13) % 1000) / 1000;
        const vr = ((i * 43.71) % 1000) / 1000 - 0.5;
        // ⚠️ NORMALISE THE CURVE, or the crowding silently narrows the path: with vr in
        // [-0.5, 0.5], `vr*|vr|*2*band` peaks at a QUARTER of band, so an earlier cut spread
        // its flashes over a 210u thread nobody could see.
        const across = (vr < 0 ? -1 : 1) * (vr * vr * 4) * band;
        const drift = (t * (9 + (i % 11) * 2.4)) % (reach * 2);
        const along = -reach + ((u * reach * 2) + drift) % (reach * 2);
        const x = cam.x + mx * along + px * across;
        const y = cam.y + my * along + py * across;
        if (!inView(x, y)) continue;
        const s0 = Math.sin(t * (3.1 + (i % 7) * 0.9) + i * 2.399) * 0.5 + 0.5;
        const tw = 0.4 + 0.6 * s0 * s0;
        // Cubed falloff: the column has a defined, dense spine and thins out fast, which
        // is what makes it a reflection rather than a scatter. PLAYABILITY LIVES HERE —
        // peak alpha stays moderate on purpose and the read comes from density, so the
        // path never competes with a hull, a mark or a nav light for attention.
        // Squared, not cubed: cubing collapsed the column to a hair-thin spine that barely
        // read at all. Squared keeps a defined dense centre with the edges thinning out —
        // a reflection rather than a scatter — while still leaving the path present.
        const fade = 1 - Math.min(1, Math.abs(across) / band);
        const a = 0.92 * n * tw * fade * fade;
        if (a < 0.03) continue;
        // ⚠️ VARY EVERYTHING, OR IT IS A LADDER. Bars of one width and near-one length,
        // evenly spaced down a straight column, read as rungs — a drawn object rather than
        // light on water. Two independent hashes per flash spread the length over an order
        // of magnitude, thicken some and thin others, and tilt each one off square; the
        // column survives because the POSITIONS still crowd the axis, but nothing in it
        // repeats.
        const h1 = ((i * 0.618034) % 1);
        const h2 = ((i * 0.381966) % 1);
        // RIPPLE LOZENGES, DENSELY STACKED — the shape the references actually show. Hard
        // rectangles read as debris; an ellipse lying across the path reads as a wave face
        // catching light. Length varies over an order of magnitude so nothing repeats.
        const len = 5 + tw * (6 + h1 * h1 * 52);
        const wide = 1.6 + h2 * 2.4;
        const tilt = (h1 - 0.5) * 0.42;
        ctx.globalAlpha = Math.min(1, a);
        const cT = Math.cos(tilt), sT = Math.sin(tilt);
        ctx.setTransform(
            M0.a * cT + M0.c * sT, M0.b * cT + M0.d * sT,
            -M0.a * sT + M0.c * cT, -M0.b * sT + M0.d * cT,
            M0.a * along + M0.c * across + M0.e, M0.b * along + M0.d * across + M0.f);
        ctx.drawImage(loz, -wide * 0.5, -len * 0.5, wide, len);
    }
    ctx.setTransform(M0);
    ctx.restore();
}

// ── JELLYFISH DRIFTS ────────────────────────────────────────────────────────
// One placement is a DRIFT of several animals. The members are DERIVED from the placement
// rather than stored: a hash of the prop's own position seeds count, offsets, sizes, tints
// and phases, so the same bloom comes back identical every session and the document stays
// one line per drift instead of one line per jellyfish.
//
// Two passes, for the same reason everything else here has two. The BELLS are physical —
// drawn on the seabed plane with the water over them, and dimmed by the ambient wash like
// any other object. The LIGHT is emissive and goes on after the wash, along with the
// trailing arms, which are drawn rather than baked so they can stream with the current.
const JELLY_TINTS = ['#5aa9ff', '#a879ff', '#ff9247', '#ff62a8'];   // blue, purple, orange, pink
const JELLY_PERIOD = 10.5;        // seconds for a full rise and fall
const JELLY_SPREAD = 190;         // how far members scatter from the placement

function jellyHash(a, b) {
    const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return h - Math.floor(h);
}
function jellyMembers(p) {
    if (p._jelly) return p._jelly;
    const n = 3 + Math.floor(jellyHash(p.x, p.y) * 5);        // 3..7 animals
    const out = [];
    for (let i = 0; i < n; i++) {
        const h1 = jellyHash(p.x + i * 13.7, p.y - i * 7.3);
        const h2 = jellyHash(p.y + i * 29.1, p.x + i * 5.9);
        const h3 = jellyHash(p.x * 0.7 + i * 3.1, p.y * 1.3 - i * 11.7);
        const ang = h1 * Math.PI * 2, rad = (0.2 + 0.8 * h2) * JELLY_SPREAD;
        out.push({
            ox: Math.cos(ang) * rad, oy: Math.sin(ang) * rad,
            // Mostly the big moon jelly, a few small blooms filling in — a real
            // aggregation is mixed, and it buys silhouette variety for nothing.
            small: h3 > 0.62,
            scale: 0.72 + h1 * 0.55,
            tint: JELLY_TINTS[Math.floor(h2 * 997) % JELLY_TINTS.length],
            phase: h3 * Math.PI * 2,
            spin: (h1 - 0.5) * 1.2,
            // A moon jelly pulses roughly every couple of seconds; spread it so a drift
            // never beats in unison, which is the tell of a repeated sprite.
            pulse: 1.7 + h2 * 1.3,
            beat: h1,
            head: h1 * Math.PI * 2,     // which way it is swimming
            v: 0, sx: 0, sy: 0, _sq: 0, // speed and accumulated swim offset
            // ⚠️ CALIBRATED, NOT GUESSED. The first figure swam 12 u/s — 26x a real Aurelia's
            // few cm/s, faster than a drifting boat, and it emptied the bloom across the map
            // in a minute. This lands near 1.5 u/s average: visible movement over a race
            // (a few boat lengths) with the drift still a drift at the finish.
            push: 4.5 + h2 * 3,         // thrust per unit of squeeze
        });
    }
    p._jelly = out;
    return out;
}
// 0 = deep and dim, 1 = just under the surface. Drives scale, alpha AND glow together,
// because depth in water changes all three at once — a jelly does not merely get smaller.
function jellyDepth(m, t) {
    return 0.5 + 0.5 * Math.sin((t / JELLY_PERIOD) * Math.PI * 2 + m.phase);
}

// ── HOW A JELLYFISH ACTUALLY MOVES ──────────────────────────────────────────
// Researched, and the research threw away the first two attempts.
//
// It is BURST AND COAST, in three phases, not a bell that breathes:
//   CONTRACT  the power stroke. The bell closes fast, ejects a vortex ring, and the animal
//             ACCELERATES. This is the short phase.
//   RELAX     the recovery stroke, and it is PASSIVE — elastic energy stored in the bell
//             during the squeeze reopens it. Peak drag lives here, so the animal is
//             DECELERATING even though the bell is still moving.
//   COAST     the interpulse. Nothing moves and it still travels: 32% of the distance
//             covered per pulse happens here, after all kinematic motion has ceased.
//
// That third phase is what the earlier versions were missing entirely. A waveform that
// relaxes straight into the next contraction has no rest in it, and a creature with no rest
// in it reads as a pumping machine. The pause is the animal.
//
// The bell also moves less than you would guess: exumbrellar area grows about 1.3x from full
// contraction, which is only ~14% on the DIAMETER — the earlier 20% was a squeeze-box.
const JELLY_CONTRACT = 0.22;      // fraction of the cycle in the power stroke
const JELLY_RELAX = 0.38;         // then the passive reopening
                                  // and the rest is coast: bell still, animal still gliding
const JELLY_SQUEEZE = 0.14;       // diameter change, from the 1.3x area figure
const JELLY_ARM_LAG = 0.16;       // seconds the arms answer the bell late

// Where in its own cycle a member is, 0..1.
function jellyCycle(m, t) {
    let u = ((t / m.pulse) + m.beat) % 1;
    return u < 0 ? u + 1 : u;
}
// Squeeze 0..1 (1 = fully contracted), with a real flat COAST at the end of the cycle.
function jellySqueezeAt(m, t) {
    const u = jellyCycle(m, t);
    if (u < JELLY_CONTRACT) return Math.sin((u / JELLY_CONTRACT) * Math.PI / 2);
    if (u < JELLY_CONTRACT + JELLY_RELAX)
        return Math.cos(((u - JELLY_CONTRACT) / JELLY_RELAX) * Math.PI / 2);
    return 0;                                             // coasting, bell fully open
}
function jellySqueeze(m, t) {
    return { sq: jellySqueezeAt(m, t), lag: jellySqueezeAt(m, t - JELLY_ARM_LAG) };
}

// 0 = deep and dim, 1 = just under the surface. Drives scale, alpha AND glow together,
// because depth in water changes all three at once — a jelly does not merely get smaller.
function jellyDepth(m, t) {
    return 0.5 + 0.5 * Math.sin((t / JELLY_PERIOD) * Math.PI * 2 + m.phase);
}

// ── SWIMMING, INTEGRATED ONCE A FRAME ───────────────────────────────────────
// ⚠️ NOT in a draw function. Both passes draw every member, so integrating there would
// advance each animal twice per frame and tie its speed to the frame rate.
//
// A previous version dodged that by making the position two slow sines — bounded, cheap, and
// wrong: it slides continuously, which is the one thing burst-and-coast is not. Real thrust
// integrates fine here because the animals are SLOW. An Aurelia does a few cm/s; over a
// three-minute race that is metres, tens of units, so a drift stays a drift instead of
// swimming off the map. The worry that sent me to sines was unfounded.
// Clocked like updateDriftingProps, its neighbour in the same call: this runs from draw(),
// where there is no ambient dt to borrow, and owning the clock keeps the integration honest
// whatever the frame rate does.
let _jellyClock = 0;
function updateJellyDrifts(now) {
    const dt = _jellyClock ? Math.min(0.1, (now - _jellyClock) / 1000) : 0;
    _jellyClock = now;
    if (!(dt > 0)) return;
    const props = state.course && state.course.props;
    if (!props || !props.length) return;
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const t = state.time;
    for (const p of props) {
        const k = reg[p.kind];
        if (!k || k.scatter !== 'jelly') continue;
        for (const m of jellyMembers(p)) {
            // They turn slowly and never hold a straight line for long.
            m.head += (Math.sin(t * 0.19 + m.beat * 6.28) * 0.5 + Math.sin(t * 0.07 + m.phase) * 0.3) * dt;
            const sq = jellySqueezeAt(m, t);
            // THRUST ONLY WHILE CLOSING. The reopening is passive and draggy, so nothing is
            // added there — the glide that follows is the coast, and it is most of the trip.
            const closing = sq > (m._sq || 0);
            if (closing) m.v += (sq - (m._sq || 0)) * m.push;
            m._sq = sq;
            // Drag: gentle, or the coast would not exist. This is the phase that carries a
            // third of the distance.
            m.v *= Math.pow(0.62, dt);
            m.sx += Math.sin(m.head) * m.v * dt;
            m.sy += -Math.cos(m.head) * m.v * dt;
        }
    }
}

// The bells are authored WHITE precisely so they can be coloured here. Same multiply-then-
// destination-in bake `getTintedBoatPart` uses for hulls, cached per sprite and colour, so
// four hues cost four bakes once rather than a composite every frame.
const _jellyTintCache = new Map();
function jellyTinted(img, color) {
    const key = img.src + '|' + color;
    let c = _jellyTintCache.get(key);
    if (c) return c;
    const size = img.naturalWidth;
    if (!size) return null;
    c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = color;
    g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = 'destination-in';   // multiply paints transparent pixels too
    g.drawImage(img, 0, 0);
    _jellyTintCache.set(key, c);
    return c;
}

function eachJelly(fn) {
    const props = state.course && state.course.props;
    if (!props || !props.length) return;
    const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
    const t = state.time, cam = state.camera;
    const halfW = canvas.width * 0.5 + 260, halfH = canvas.height * 0.5 + 260;
    for (const p of props) {
        const k = reg[p.kind];
        if (!k || k.scatter !== 'jelly') continue;
        const px = p.x + (p._dx || 0), py = p.y + (p._dy || 0);      // drifted position
        if (Math.abs(px - cam.x) > halfW + JELLY_SPREAD || Math.abs(py - cam.y) > halfH + JELLY_SPREAD) continue;
        for (const m of jellyMembers(p)) {
            const x = px + m.ox + m.sx, y = py + m.oy + m.sy;
            if (Math.abs(x - cam.x) > halfW || Math.abs(y - cam.y) > halfH) continue;
            fn(m, x, y, jellyDepth(m, t), t, jellySqueeze(m, t));
        }
    }
}

// PASS 1 — the bodies, with the water. Called from the seabed plane.
function drawJellyDrifts(ctx) {
    eachJelly((m, x, y, d, t, pz) => {
        const kind = m.small ? 'glowtide-jelly-bloom' : 'glowtide-jelly';
        const s = propSprite(kind);
        if (!s || !s.img.complete || !s.img.naturalWidth) return;
        const img = jellyTinted(s.img, m.tint) || s.img;
        // Nearer the surface is bigger, brighter and sharper; deeper is smaller and fainter,
        // and the bell squeezes about a fifth of its width on every contraction.
        const w = s.world * m.scale * (0.82 + 0.3 * d) * (1 - JELLY_SQUEEZE * pz.sq);
        ctx.save();
        ctx.globalAlpha = 0.30 + 0.45 * d;
        ctx.translate(x, y);
        ctx.rotate(m.spin);
        ctx.drawImage(img, -w / 2, -w / 2, w, w);
        ctx.restore();
    });
}

// PASS 2 — the light and the arms, after the ambient wash so neither is dimmed.
// Everything floating ON the surface, as holes to punch out of what is drawn UNDER it.
//
// ⚠️ WOUND FOR 'nonzero', NOT 'evenodd'. The bio-wake mask gets away with even-odd because
// hulls rarely overlap, but a boat needs TWO shapes here — the waterline hull and a disc for
// the rig, which sweeps well outside it — and under even-odd their overlap would cancel and
// punch a hole in the hole. With every occluder wound opposite to the frame and 'nonzero',
// shapes may overlap as much as they like and still subtract.
function surfaceOccluders(cam, halfW, halfH) {
    const mask = new Path2D();
    mask.rect(cam.x - halfW - 300, cam.y - halfH - 300, (halfW + 300) * 2, (halfH + 300) * 2);
    const near = (x, y, pad) => Math.abs(x - cam.x) < halfW + pad && Math.abs(y - cam.y) < halfH + pad;
    const hole = (x, y, r) => { mask.moveTo(x + r, y); mask.arc(x, y, r, 0, Math.PI * 2, true); };
    for (const b of state.boats) {
        if (b.opacity !== undefined && b.opacity <= 0.1) continue;
        if (!near(b.x, b.y, 90)) continue;
        // The hull, exactly — reversed, so it winds against the frame.
        const poly = getHullPolygon(b);
        mask.moveTo(poly[poly.length - 1].x, poly[poly.length - 1].y);
        for (let k = poly.length - 2; k >= 0; k--) mask.lineTo(poly[k].x, poly[k].y);
        mask.closePath();
        // The RIG. A sail is canvas over the water and hides what is beneath it just as the
        // hull does, but it swings out past the gunwale and is not the hull's shape, so it
        // gets its own disc rather than a bigger hull.
        hole(b.x, b.y, 34);
    }
    const props = state.course && state.course.props;
    if (props) {
        const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
        for (const pr of props) {
            const k = reg[pr.kind];
            if (!k || k.plane !== 'surface' || k.scatter) continue;
            const x = pr.x + (pr._dx || 0), y = pr.y + (pr._dy || 0);
            if (!near(x, y, 80)) continue;
            hole(x, y, (k.world || 40) * (pr.scale || 1) * 0.42);
        }
    }
    for (const mk of (state.course.marks || [])) {
        if (!near(mk.x, mk.y, 60)) continue;
        hole(mk.x, mk.y, Math.max(14, (mk.radius || 12) * 1.1));
    }
    return mask;
}

function drawJellyGlow(ctx) {
    const n = nightAmt();
    if (n <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // ⚠️ A JELLY IS UNDER THE WATER, so nothing of it shows through a boat, a sail, a buoy or
    // a mark floating over it. This pass runs after the fleet is drawn, so without the mask
    // an additive bell painted straight over a hull and the animal appeared to be INSIDE the
    // boat. The bodies are fine — they draw on the seabed plane and the fleet covers them —
    // it is only the light that had to be told.
    const _cam = state.camera;
    ctx.clip(surfaceOccluders(_cam, ctx.canvas.width * 0.5 + 120, ctx.canvas.height * 0.5 + 120), 'nonzero');
    eachJelly((m, x, y, d, t, pz) => {
        const kind = m.small ? 'glowtide-jelly-bloom' : 'glowtide-jelly';
        const s = propSprite(kind);
        const world = (s ? s.world : 24) * m.scale;
        const rgb = m.tint;
        // THE HALO. Sized off the bell and the depth together, so a jelly rising toward the
        // surface swells and brightens at once.
        // THE LIGHT ANSWERS THE MUSCLE. A bioluminescent jelly brightens as it contracts,
        // so the halo tightens and flares on the squeeze instead of pulsing independently
        // of the body — which is what ties the glow to the animal rather than laying it on.
        const R = world * (0.55 + 0.42 * d) * (1 - JELLY_SQUEEZE * 0.8 * pz.sq);
        const flare = 1 + 0.5 * pz.sq;
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, rgb);
        g.addColorStop(0.4, rgb);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = Math.min(1, (0.07 + 0.24 * d) * flare * n);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fill();
        // ── THE ARMS ────────────────────────────────────────────────────────
        // ⚠️ DRAWN BEFORE THE BELL, so the bell covers their roots and they read as hanging
        // UNDER the animal. On top they looked stuck to its back.
        //
        // ⚠️ AND THEY UNDULATE ALONG THEIR LENGTH. A quadratic curve swinging about its root
        // is a rigid whisker being waved; a real oral arm carries a wave DOWN it, so each
        // arm is walked in segments with a travelling sine whose amplitude grows toward the
        // tip — the root barely moves, the end whips. That, and the lag behind the bell's
        // squeeze, is the whole difference between seaweed and an animal.
        //
        // Trailing downstream is why these are drawn and not baked: a sprite locks one
        // direction (props rotate by a static authored heading) and these have to stream
        // with whatever the tide is doing, which on this venue reverses in the eddies.
        // ⚠️ THEY TRAIL BEHIND THE ANIMAL, NOT DOWN THE TIDE. Earlier they streamed with
        // getCurrentAt, which is wrong for something that DRIFTS: a jelly carried by the
        // stream has no water moving past it, so there is nothing to stream in. What the
        // arms lag behind is the creature's own swimming — so they trail opposite its
        // heading, and stretch with how hard it is going.
        const flow = m.head + Math.PI;
        const pull = Math.min(1, m.v / 6);
        const len = world * (0.62 + 0.5 * d) * (0.8 + 0.45 * pull) * (1 + 0.28 * pz.lag);
        const arms = m.small ? 5 : 4;
        const fx = Math.sin(flow), fy = -Math.cos(flow);          // downstream
        const px = Math.cos(flow), py = Math.sin(flow);           // across the flow
        const SEG = 7;
        ctx.globalAlpha = Math.min(1, (0.07 + 0.20 * d) * n);
        ctx.strokeStyle = rgb;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = m.small ? 1.2 : 1.8;
        for (let a = 0; a < arms; a++) {
            const u = arms > 1 ? (a / (arms - 1) - 0.5) : 0;      // -0.5..0.5 across the bell
            // Roots sit UNDER the bell, well inside its rim.
            const rx = x + px * u * world * 0.2;
            const ry = y + py * u * world * 0.2;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            for (let k = 1; k <= SEG; k++) {
                const f = k / SEG;                                 // 0 at the root, 1 at the tip
                // The wave travels outward; amplitude grows with the cube of the distance
                // along, so the root is nearly still and only the last third really moves.
                const wave = Math.sin(f * 4.2 - t * 3.1 + m.beat * 6.28 + a * 1.5);
                const amp = world * 0.16 * f * f * (0.6 + 0.6 * pz.lag);
                // Arms gather together as the bell fires and spread as it opens.
                const spread = u * (0.5 - 0.28 * pz.lag) * world * 0.5 * f;
                const dx = fx * len * f + px * (spread + wave * amp);
                const dy = fy * len * f + py * (spread + wave * amp);
                ctx.lineTo(rx + dx, ry + dy);
            }
            ctx.stroke();
        }
        // ⚠️ THE BELL IS ALSO A LIGHT, and leaving it out of this pass was the whole reason
        // a drift read as coloured BLOBS. The body alone is dimmed twice — once for being
        // under water on the seabed plane, again by the ambient wash — so all that survived
        // was the halo, and a halo without structure is a firework. Drawing the tinted bell
        // additively here puts the clover and the corona back into the light, which is what
        // makes it a glowing jellyfish rather than a glowing dot.
        const sp = propSprite(kind);
        if (sp && sp.img.complete && sp.img.naturalWidth) {
            const img = jellyTinted(sp.img, rgb) || sp.img;
            const w = world * (0.82 + 0.3 * d) * (1 - JELLY_SQUEEZE * pz.sq);
            ctx.save();
            ctx.globalAlpha = Math.min(1, (0.16 + 0.5 * d) * flare * n);
            ctx.translate(x, y);
            ctx.rotate(m.spin);
            ctx.drawImage(img, -w / 2, -w / 2, w, w);
            ctx.restore();
        }
    });
    ctx.restore();
}

function drawNightWash(ctx) {
    const n = nightAmt();
    if (n <= 0) return;
    const cam = state.camera;
    const r = Math.hypot(ctx.canvas.width, ctx.canvas.height) * 0.5 + 240;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = n;
    ctx.fillStyle = NIGHT_TINT;
    ctx.fillRect(cam.x - r, cam.y - r, r * 2, r * 2);
    ctx.restore();
}

function drawNightGlow(ctx) {
    const n = nightAmt();
    if (n <= 0) return;
    const cam = state.camera, t = state.time;
    const halfW = ctx.canvas.width * 0.5 + 120, halfH = ctx.canvas.height * 0.5 + 120;
    const inView = (x, y) => Math.abs(x - cam.x) < halfW && Math.abs(y - cam.y) < halfH;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // ── BIOLUMINESCENT WAKES ────────────────────────────────────────────────
    // Two parts, for the reason in BIO_TRAIL_LIFE: a bright churn where the shear is well
    // over threshold, and a long dim band where it is only just tripping cells.
    //
    // ⚠️ AND IT MUST NOT SHINE THROUGH THE HULL. This pass runs after the fleet is drawn, so
    // an additive blob centred a few units aft of the transom bleeds straight over the boat
    // above it — the glow appeared to be INSIDE the hull. Skipping samples whose centre is
    // on the boat does not fix it either, because the blobs are wider than that and the
    // bleed comes from their edges. So the hulls are punched OUT of the clip region: one
    // path of the view rect plus every visible hull, filled even-odd, which makes each hull
    // a hole. Exact, and one clip for the whole fleet.
    ctx.save();
    const hullMask = new Path2D();
    hullMask.rect(cam.x - halfW - 300, cam.y - halfH - 300, (halfW + 300) * 2, (halfH + 300) * 2);
    for (const boat of state.boats) {
        if (boat.opacity !== undefined && boat.opacity <= 0.1) continue;
        if (!inView(boat.x, boat.y)) continue;
        const poly = getHullPolygon(boat);
        hullMask.moveTo(poly[0].x, poly[0].y);
        for (let k = 1; k < poly.length; k++) hullMask.lineTo(poly[k].x, poly[k].y);
        hullMask.closePath();
    }
    // BUOYS ARE HOLES IN IT TOO. They are solid objects floating ON the water and they draw
    // before this pass, so without a hole a passing boat's trail glows straight through the
    // buoy and it stops reading as an object at all.
    const _props = state.course && state.course.props;
    if (_props) {
        const reg = (window.VenueDoc && window.VenueDoc.PROP_KINDS) || {};
        for (const pr of _props) {
            if (pr.kind !== 'buoy-channel-red' && pr.kind !== 'buoy-channel-green') continue;
            if (!inView(pr.x, pr.y)) continue;
            const rr = ((reg[pr.kind] && reg[pr.kind].world) || 28) * (pr.scale || 1) * 0.42;
            hullMask.moveTo(pr.x + rr, pr.y);
            hullMask.arc(pr.x, pr.y, rr, 0, Math.PI * 2);
        }
    }
    ctx.clip(hullMask, 'evenodd');
    for (const boat of state.boats) {
        if (boat.opacity !== undefined && boat.opacity <= 0.1) continue;
        const bio = boat.bioTrail;
        if (!bio || bio.length < 2) continue;

        // THE LONG BAND, as one tapering stroke rather than a bead per sample. Eighty
        // radial gradients a boat was both slower and worse-looking — a chain of blobs
        // instead of a band of light.
        for (let i = 1; i < bio.length; i++) {
            const a0 = bio[i - 1], a1 = bio[i];
            if (!inView(a0.x, a0.y) && !inView(a1.x, a1.y)) continue;
            const life = 1 - Math.min(1, a1.age / BIO_TRAIL_LIFE);
            // Squared, so the band thins away rather than ending on a visible stub.
            const a = 0.40 * n * life * life * Math.min(1, a1.str || 0);
            if (a < 0.012) continue;
            ctx.globalAlpha = Math.min(1, a);
            ctx.strokeStyle = BIO_COLOR;
            ctx.lineCap = 'round';
            ctx.lineWidth = 5 + (1 - life) * 26;      // spreads as it ages, like a real wake
            ctx.beginPath();
            ctx.moveTo(a0.x, a0.y);
            ctx.lineTo(a1.x, a1.y);
            ctx.stroke();
        }
        // THE CHURN: the first second and a half, where the shear is well over threshold.
        // This is the part that is genuinely bright, and it carries the pale core.
        for (let i = 0; i < bio.length; i++) {
            const s = bio[i];
            if (s.age > BIO_CHURN_LIFE) break;
            if (!inView(s.x, s.y)) continue;
            const life = 1 - s.age / BIO_CHURN_LIFE;
            const a = 0.85 * n * life * Math.min(1, s.str || 0);
            if (a < 0.02) continue;
            const r = 9 + (1 - life) * 14;
            ctx.globalAlpha = Math.min(1, a);
            ctx.drawImage(glowSprite('43,157,255'), s.x - r, s.y - r, r * 2, r * 2);
            ctx.globalAlpha = Math.min(1, a * 0.7);
            const cr = r * 0.45;
            ctx.drawImage(glowSprite('207,233,255'), s.x - cr, s.y - cr, cr * 2, cr * 2);
        }
    }
    ctx.globalAlpha = 1;
    ctx.restore();                      // hulls stop masking here

    // ── THE WIND WAVES ONLY LIGHT UP WHERE THEY BREAK ───────────────────────
    // ⚠️ THE FIRST VERSION LIT EVERY CAT'S PAW, and that is physically backwards. The
    // shear threshold for a dinoflagellate is 0.02-0.3 N/m^2 by species, and the review
    // literature is blunt about what that means: with the exception of BREAKING waves,
    // those thresholds are "several orders of magnitude larger than typical oceanic ambient
    // flows". The orbital motion under an unbroken ripple does not come close. A uniform
    // glow on every wind wave was inventing light the sea does not make.
    //
    // What rescues the venue's own promise — "the dark hides the breeze, the glow gives it
    // away" — is WHITECAPS. Whitecapping sets in around 3-3.5 m/s (6-7 kt) and is what
    // actually breaks a crest offshore, so above that threshold the tops genuinely do fire
    // cells. That makes the glow a PRESSURE cue rather than a wind cue: it marks the strong
    // patches specifically, which is better information than lighting everything.
    //
    // And it is SPARSE. Turbulence is intermittent, and the modelling result is that those
    // intermittent bursts of extreme strain give flashes that are brighter but rarer than
    // steady straining would. So a few crests wink hard rather than all of them glowing
    // faintly — which is both the physics and the better picture.
    const WHITECAP_KT = 7;
    for (const wave of state.waveStates.values()) {
        if (wave.windSpeed < WHITECAP_KT) continue;
        const dx = Math.sin(wave.angle) * wave.dist, dy = -Math.cos(wave.angle) * wave.dist;
        const x = wave.x + dx, y = wave.y + dy;
        if (!inView(x, y)) continue;
        // Steep ramp above onset: at 7 kt the odd crest tips over, by 14 it is general.
        const cap = Math.min(1, (wave.windSpeed - WHITECAP_KT) / 7);
        // A stable per-wave phase off its origin, so a given crest keeps its own rhythm.
        const h = Math.abs(Math.sin(wave.x * 12.9898 + wave.y * 78.233)) * 43758.5453 % 1;
        const wink = Math.sin(t * (2.6 + h * 2.2) + h * 31.4) * 0.5 + 0.5;
        // Cubed: mostly dark, occasionally bright — the intermittency, not a dimmer switch.
        const burst = wink * wink * wink;
        const cyc = Math.max(0, Math.sin((wave.dist / 150) * Math.PI));
        const a = 0.95 * n * cap * burst * cyc;
        if (a < 0.02) continue;
        const w = Math.max(20, Math.min(70, wave.windSpeed * 3.6)) * (0.5 + 0.5 * burst);
        ctx.globalAlpha = Math.min(1, a);
        ctx.strokeStyle = BIO_COLOR;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(wave.angle + (wave.tilt || 0));
        ctx.beginPath();
        ctx.moveTo(-w * 0.5, 0);
        ctx.lineTo(w * 0.5, 0);
        ctx.stroke();
        // The hottest winks show a pale core, like a breaking crest does.
        if (burst > 0.55) {
            ctx.globalAlpha = Math.min(1, a * 0.8);
            ctx.strokeStyle = BIO_CORE;
            ctx.lineWidth = 1.1;
            ctx.stroke();
        }
        ctx.restore();
    }
    ctx.globalAlpha = 1;

    // ── SURF ALONG THE SHORE ────────────────────────────────────────────────
    // Breaking water is where bioluminescence is most spectacular in life, so the coast
    // gets a pulsing rim rather than a static outline. The pulse runs along the shore
    // rather than blinking the whole island at once, which is what a set of waves does.
    // ── SURF ALONG THE SHORE ────────────────────────────────────────────────
    // ⚠️ NOT A STROKE ON THE COASTLINE. Stroking the island polygon drew a hard neon
    // OUTLINE — straight runs, sharp corners, even brightness — and it read as a CAD
    // wireframe or a selection highlight, not as water breaking. Three things were wrong
    // with it: surf is a BAND with width, it sits just OFFSHORE rather than on the land
    // edge, and it has no hard edges anywhere.
    //
    // So it is painted as a field instead: soft radial blobs stepped along the coast and
    // pushed seaward, overlapping into a continuous wash with no corners in it. A narrow
    // core rides the same path for the breaking line the photographs show, but its alpha
    // swings hard with the passing sets, so it breaks into surges instead of closing up
    // into an outline again.
    const isls = state.course.islands || [];
    for (const isl of isls) {
        // ⚠️ NOTHING SUBMERGED BREAKS WATER. Same three exclusions the DAYTIME surf makes
        // (updateSurf, and surfDryEdges' probe) — a bar, a coral reef and a sunken rock all
        // lie under the surface, so there is no coastline for a wave to break on. Glowtide's
        // `sunkenrock` is the kind that made this bite: it is the hazard you are NOT warned
        // about, and a ring of bioluminescent surf would have advertised it perfectly.
        if (isl.isFloe || isl.awash || isl.reef) continue;
        // ⚠️ A HIDDEN ISLAND IS NOT A COAST. `compileVenueDoc` turns every hard fixed prop
        // into a hidden 12-gon collider so physics, the router and the chart all meet it as
        // an ordinary shape — the doc calls them "a collider behind something that draws the
        // coast". They have vertices like any island, so this loop happily broke surf on all
        // eighteen channel buoys: a 12-gon at contactR 13 is twelve edges of 6.7 u, each one
        // chunk, so each buoy got a ring of twelve 34-60 u blue blobs. Additively that came to
        // roughly twice the alpha of the buoy's own lamp, which is how a RED light ended up
        // reading as a blue ball. Anything hidden draws no coastline, so it breaks no water.
        if (isl.hidden) continue;
        const v = isl.vertices;
        if (!v || v.length < 3) continue;
        if (Math.abs(isl.x - cam.x) > halfW + isl.radius || Math.abs(isl.y - cam.y) > halfH + isl.radius) continue;
        // Walked by ARC LENGTH in short chunks, so the pulse runs ALONG the coast at a
        // steady speed and each chunk is small enough that its midpoint is an honest cull.
        // Culling whole EDGES by their midpoint went dark exactly when you sailed up to a
        // shore: this landmass is 33 vertices across the whole map, so one edge can be
        // thousands of units long and its midpoint far off-screen.
        // ⚠️ SPACING MUST BE UNDER THE CORE DIAMETER OR THE BRIGHT LINE BEADS. At 46u with
        // 9-16u cores the surges came out as a string of evenly spaced pearls — the wash
        // overlapped fine (it is 68-120u wide) but the cores never touched. 24u is inside
        // the core diameter, so a surge reads as a continuous run of light.
        const CHUNK = 24;
        let run = 0;
        for (let i = 0; i < v.length; i++) {
            const a0 = v[i], a1 = v[(i + 1) % v.length];
            const ex = a1.x - a0.x, ey = a1.y - a0.y;
            const elen = Math.hypot(ex, ey);
            if (elen < 1) continue;
            const steps = Math.max(1, Math.round(elen / CHUNK));
            for (let k = 0; k < steps; k++) {
                const f = (k + 0.5) / steps;
                let x = a0.x + ex * f, y = a0.y + ey * f;
                const s = run + elen * f;
                if (!inView(x, y)) continue;
                // Seaward, along the outward normal from the island's own centre — surf
                // breaks OFF the beach, and an on-the-boundary glow reads as a rim on the
                // land instead of water in front of it.
                const ox = x - isl.x, oy = y - isl.y;
                const ol = Math.hypot(ox, oy) || 1;
                // Jittered per chunk, so the band is not a perfect offset curve of the
                // polygon — a shoreline's break line wanders.
                const jit = 10 + 14 * (Math.abs(Math.sin(s * 0.021)) );
                x += (ox / ol) * jit; y += (oy / ol) * jit;
                // Sets, not a uniform blink: a slow pulse travelling down the shore, with a
                // second slower beat over it so successive surges differ in size.
                const ph = Math.sin(t * 1.35 - s / 190) * 0.5 + 0.5;
                const set = 0.65 + 0.35 * (Math.sin(t * 0.5 - s / 640) * 0.5 + 0.5);
                const str = ph * ph * set;
                // THE WASH — wide, soft, always present. Breaking waves are the one natural
                // flow that clears the dinoflagellate shear threshold by a wide margin, so
                // this is the brightest thing in the venue, over the churn behind a hull.
                const R = 34 + 26 * str;
                const a = (0.18 + 0.62 * str) * n;
                ctx.globalAlpha = Math.min(1, a);
                ctx.drawImage(glowSprite('43,157,255'), x - R, y - R, R * 2, R * 2);
                // THE BREAKING LINE — only where a set is actually up, so it appears as
                // surges along the beach rather than a continuous edge.
                if (str > 0.42) {
                    const cR = 14 + 9 * str;      // >= CHUNK, so surges join up
                    ctx.globalAlpha = Math.min(1, (str - 0.42) * 1.5 * n);
                    ctx.drawImage(glowSprite('207,233,255'), x - cR, y - cR, cR * 2, cR * 2);
                }
            }
            run += elen;
        }
    }
    ctx.globalAlpha = 1;

    // ── LIT CHANNEL BUOYS ───────────────────────────────────────────────────
    // A lateral mark carries a light of its own colour — red on a red buoy, green on a
    // green one — and the venue card promises "rocky shores & LIT MARKS". Glowtide already
    // lines its channel with 18 of them, so this is the piece of the night that does the
    // most navigational work: in the dark the buoys are the channel.
    //
    // THEY FLASH, and that is not decoration. A real lateral mark shows a rhythmic flash
    // rather than a steady light, and here the rhythm also solves a playability problem:
    // eighteen steady lamps would be eighteen competing highlights on a dark map. A flash
    // draws the eye once and then gets out of the way.
    //
    // But a flash that goes fully dark takes the buoy with it, and a channel you can only
    // see for a fifth of each cycle is worse than useless when you are threading it at
    // speed. So each carries a dim EMBER that never goes out — locatable at all times —
    // with the flash on top. Phase comes from the buoy's own position, so a line of them
    // twinkles down the channel instead of blinking in unison like a string of fairy
    // lights, which is also what a real channel looks like.
    const props = state.course && state.course.props;
    if (props && props.length) {
        for (const pr of props) {
            const red = pr.kind === 'buoy-channel-red';
            if (!red && pr.kind !== 'buoy-channel-green') continue;
            if (!inView(pr.x, pr.y)) continue;
            // QUICK-FLASHING. A 4 s rhythm was too languid to read as a working light — at
            // racing speed you pass a buoy before it has flashed twice. 1.6 s is close to
            // the "Q" (quick) character real marks use, so the channel visibly ticks.
            const ph = (Math.abs(Math.sin(pr.x * 0.0173 + pr.y * 0.0291)) * 1.6);
            const cyc = (t + ph) % 1.6;
            const flash = cyc < 0.5 ? Math.sin((cyc / 0.5) * Math.PI) : 0;
            const amp = 0.22 + 0.85 * flash;                  // ember, plus the flash over it
            const glow = red ? '255,30,30' : '0,255,110';
            const core = red ? '255,205,205' : '205,255,220';
            // ⚠️ THE HALO HAS TO REACH PAST THE BUOY. At radius 9-18 it sat INSIDE the 28u
            // body and the thing read as a glowing buoy rather than a buoy with a light on
            // it. A lamp throws light onto the water around it, so the halo now clears the
            // hull and the tight core stays the lamp itself.
            const gr = 21 + 17 * flash;
            ctx.globalAlpha = Math.min(1, amp * n);
            ctx.drawImage(glowSprite(glow), pr.x - gr, pr.y - gr, gr * 2, gr * 2);
            const cR = 2.4 + 1.8 * flash;
            ctx.globalAlpha = Math.min(1, (0.35 + 0.6 * flash) * n);
            ctx.drawImage(glowSprite(core), pr.x - cR, pr.y - cR, cR * 2, cR * 2);
        }
        ctx.globalAlpha = 1;
    }

    // ── NAV LIGHTS ──────────────────────────────────────────────────────────
    // RRS aside, this is COLREGs: sidelights are red to port and green to starboard, each
    // showing from dead ahead round to abaft the beam. From directly overhead both are
    // visible on every boat, which is exactly what makes them useful here — at a glance you
    // can tell which way a rival is pointing in the dark, and that is information the day
    // venues give you from the sail. A dim white sternlight closes the picture.
    for (const boat of state.boats) {
        if (boat.opacity !== undefined && boat.opacity <= 0.1) continue;
        if (!inView(boat.x, boat.y)) continue;
        const s = Math.sin(boat.heading), c = Math.cos(boat.heading);
        // A POINT LIGHT, NOT A DISC OF COLOUR. Two draws, and the split is the whole
        // difference: a LAMP is a tiny over-exposed core with a coloured halo bleeding out
        // of it, so the core is drawn near-white and the glow carries the colour. Earlier
        // cuts held the saturated colour flat out to a third of the radius, which on a 55u
        // hull is a painted dot — bright, but obviously paint rather than a light. Drawn
        // additively, the core blows out through the halo on its own.
        // ⚠️ THE SAME TRANSFORM hullPolygonAt USES, and it has to be, or the lights are not
        // on the boat. A first cut wrote `+ ly*(sin, -cos)`, which negates the aft axis: the
        // sidelights came out amidships and the stern light landed on the STEM. HULL_LOCALS
        // puts the bow at y = -25 and the transom at y = +30, so local +y is aft and this is
        // the plain rotation that goes with it.
        const lamp = (lx, ly, core, glow, gr, amp) => {
            const x = boat.x + (lx * c - ly * s);    // local +x starboard, +y aft
            const y = boat.y + (lx * s + ly * c);
            const g = ctx.createRadialGradient(x, y, 0, x, y, gr);
            g.addColorStop(0, glow);
            g.addColorStop(0.28, glow);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            // ⚠️ THE GLOW CARRIES THE COLOUR, THE CORE ONLY BRIGHTENS IT. First attempt had
            // a near-white core at high additive alpha over a thin halo, and the hue washed
            // straight out — ten boats with white dots on the bow, which loses the one thing
            // sidelights are for. So the halo is the strong, saturated element and the core
            // is small and only lightly tinted toward white.
            ctx.globalAlpha = Math.min(1, amp * n);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, gr, 0, Math.PI * 2);
            ctx.fill();
            // The filament: small and hard, just enough to read as a lamp rather than a dot.
            const k = ctx.createRadialGradient(x, y, 0, x, y, 2.1);
            k.addColorStop(0, core);
            k.addColorStop(0.5, core);
            k.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = Math.min(1, amp * 0.8 * n);
            ctx.fillStyle = k;
            ctx.beginPath();
            ctx.arc(x, y, 2.1, 0, Math.PI * 2);
            ctx.fill();
        };
        // SIDELIGHTS ONLY — red to port, green to starboard, both on the bow. No stern
        // light, no steaming light, no anchor light: a boat racing under sail carries the
        // pair and nothing else here, and three lamps on a 55u hull was clutter that made
        // the one thing they are for — which way is he pointing — harder to read, not easier.
        // Bow is local y = -25 (HULL_LOCALS), so these sit just abaft the stem.
        lamp(-5, -20, 'rgba(255,190,190,1)', 'rgba(255,26,26,1)', 11, 0.95);    // port, red
        lamp(5, -20, 'rgba(198,255,214,1)', 'rgba(0,255,106,1)', 11, 0.95);     // starboard
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawWater(ctx) {
    if (window.WaterRenderer) {
        window.WaterRenderer.draw(ctx, state);
    }
}

// ── A PUFF IS A PATCH OF DIFFERENT-COLOURED WATER, AND NOTHING ELSE ─────────
//
// A cat's-paw is the water going dark and rough; a hole is the water going glassy and pale.
// That is the whole visual. It does NOT get its own wind graphic — the wind it carries is
// already in the field, so the comet layer draws it: inside a puff the streaks run longer,
// wider, denser and warmer, because `getWindAt` says the wind there is stronger. Two layers
// drawing "wind" is two layers to reconcile, and they never agreed.
//
// ── WHY IT IS A FACETED PATCH AND NOT A SOFT GRADIENT ──────────────────────
//
// It was a baked radial-gradient sprite, and three things were wrong with it, all measured
// (eval/_puff_tone.js, eval/_puff_read.js):
//
//   TOO STRONG      the core ran to 13-18% of full scale on Stillwater. The guide for a
//                   "just perceptible" step on a flat field is 1-2%; 5% already reads as an
//                   overlay laid on the picture rather than as the water being different.
//   INCONSISTENT    the same code gave 4.4% on Bluewater, 0.0% on Redrock and 17.7% on
//                   Stillwater, because the delta was an authored COLOUR at a fixed alpha
//                   over ten different waters. Whether you could see a puff at all depended
//                   on the venue's palette.
//   WRONG IDIOM     a smooth radial falloff has no edge, and the edge is the thing. What a
//                   sailor actually looks for is the boundary — "you can see the breeze on
//                   the water AND its edges" — because that is what tells you when it
//                   arrives. It is also the one gradient left in a style guide whose third
//                   pillar is that this game never blurs.
//
// So: two flat tonal bands on the cell's own intensity contours, with torn edges, at an
// alpha CALIBRATED per venue to land on a fixed perceptual step. The tone is now a
// supporting cue — the comet density is the primary one, which is the honest ordering,
// because density is what survives a cell bigger than the screen.
//
// ⚠️ THE MINIMAP IS A SEPARATE DRAW and keeps its gradient. Two different jobs: the chart is
// read as a weather map, where a soft blob is the right idiom and there is no water for it
// to be a property of. Nothing here touches it.
//
// ⚠️ OVERLAPPING CELLS COMPOUND HERE AND ARE CLAMPED IN THE PHYSICS, and that is a known,
// bounded divergence rather than an oversight. getWindAt limits stacked same-sign puffs to
// the strongest single cell's worth ("two patches of the same descended air overlapping is
// still that air, not twice it"); these are independent polygon fills, so where cells
// overlap their alphas composite. Measured on flat water with all fourteen of Stillwater's
// cells in frame: p1 -3.1% of full scale, p99 +1.6%, worst pixel 5.1% against the 2.2%
// target, and 5.4% of pixels past 2.5%. Matching the clamp exactly needs the layer rendered
// through an offscreen max-composited mask — a full-screen clear and composite every frame
// to correct a 5% worst case on a small fraction of pixels. Not worth the frame for that;
// revisit if cell counts per venue go up.
function drawIslandShadows(ctx) {
    if (!state.course.islands) return;
    const windDir = state.wind.direction;
    const shadowAngle = Math.atan2(Math.cos(windDir), -Math.sin(windDir));

    // Viewport Culling
    const camX = state.camera.x;
    const camY = state.camera.y;
    // Approx viewport radius
    const viewRadius = Math.max(ctx.canvas.width, ctx.canvas.height);

    for (const isl of state.course.islands) {
        // Culling (Simple distance check including shadow length)
        const distSq = (isl.x - camX)**2 + (isl.y - camY)**2;
        if (distSq > (viewRadius + isl.radius * 9)**2) continue;

        ctx.save();
        ctx.translate(isl.x, isl.y);
        ctx.rotate(shadowAngle);

        const shadowLen = isl.radius * 5;
        const startWidth = isl.radius;
        const endWidth = isl.radius * (1.0 + shadowLen / 500);

        const grad = ctx.createLinearGradient(0, 0, shadowLen, 0);
        // Lull color: rgba(92, 201, 255, alpha)
        grad.addColorStop(0, 'rgba(92, 201, 255, 0.25)');
        grad.addColorStop(1, 'rgba(92, 201, 255, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -startWidth);
        ctx.lineTo(shadowLen, -endWidth);
        ctx.quadraticCurveTo(shadowLen + endWidth * 0.5, 0, shadowLen, endWidth);
        ctx.lineTo(0, startWidth);
        ctx.quadraticCurveTo(-startWidth * 0.5, 0, 0, -startWidth);
        ctx.fill();
        ctx.restore();
    }
}

function drawMarkShadows(ctx) {
    for (const m of state.course.marks) {
        if (m.kind === 'none') continue;          // nothing there to cast one
        ctx.save(); ctx.translate(m.drawX != null ? m.drawX : m.x, m.drawY != null ? m.drawY : m.y);
        // Sized to the mark's VISIBLE width (~29px at W=30), so it reads as a contact
        // shadow rather than a disc sticking out from under it. Cosmetic only.
        const body = m.body;
        if (body) {
            // A hull is not a disc: shadow the capsule, or the boat floats on a coin.
            ctx.rotate(m.heading || 0);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            for (const d of [-22, 0, 22]) { ctx.beginPath(); ctx.arc(3, -d + 3, 19, 0, Math.PI * 2); ctx.fill(); }
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(3, 3, 13, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
}

function drawMarkBodies(ctx) {
    const player = state.boats[0];
    // EVERY mark in the array is part of the course. This used to skip all but the
    // first two on an island course, because `islandRound` parked two placeholder
    // marks that were not real — they are long gone, and the skip was hiding the
    // rounding mark itself once roundings became ordinary marks.
    for (let i = 0; i < state.course.marks.length; i++) {
        const m = state.course.marks[i];
        // A mark with no buoy is a POSITION — an island you round, a transit — so it
        // gets an indicator rather than a sprite. Drawn in drawMarkZones, which already
        // owns the "here is what the course asks of you" layer.
        if (m.kind === 'none') continue;
        const sp = markSprite(m.kind);
        // The sprite is fill-normalized at ingest, so the frame size IS the declared
        // world size and the art's own fill decides what you see: 30 -> ~29px for the
        // tetrahedron, 92 -> 37x85px for the committee boat.
        const W = sp.world, H = W * (sp.img.naturalHeight / (sp.img.naturalWidth || 1)) || W;
        // A committee boat is drawn at its outboard nudge, clear of the line; a buoy
        // sits on its point.
        ctx.save(); ctx.translate(m.drawX != null ? m.drawX : m.x, m.drawY != null ? m.drawY : m.y);
        // Very subtle bob: slow breathing scale + faint rotation wobble, phased
        // per mark by position (deterministic — no RNG in the render path)
        const phase = m.x * 0.013 + m.y * 0.007;
        const bob = 1 + Math.sin(state.time * 7 + phase) * 0.02;
        // gentle circular sway at anchor + a slow rotation wobble
        ctx.translate(Math.sin(state.time * 4.1 + phase) * 2.2, Math.cos(state.time * 3.4 + phase * 1.7) * 2.2);
        // A buoy has no "up", so its angle is an arbitrary per-position scramble. A
        // VESSEL has one, frozen by orientCourseMarks() from the line it defines — the
        // scramble would point a 30ft boat wherever its coordinates happened to land.
        // The wobble stays either way: on a hull it reads as lying to an anchor.
        const base = (m.heading != null) ? m.heading : (m.x * 7.3 + m.y * 3.1) % 6.283;
        ctx.rotate(base + Math.sin(state.time * 5.3 + phase) * 0.06);
        ctx.scale(bob, bob);

        let active = false;
        if (state.race.status !== 'finished') {
            const act = legMarks(player.raceState.leg) || [];
            if (act.indexOf(i) !== -1) active = true;
            // A ROUNDING leg has no `marks` pair — legMarks() is null — so the very mark
            // being rounded was failing this test and drawing grey while active.
            const e = routeLeg(player.raceState.leg);
            if (e && e.kind === 'round' && e.mark && e.mark.markIdx === i) active = true;
        }
        // The slate tint says "not the mark you are sailing to". That is a statement
        // about a piece of course furniture, and a crewed vessel is not one — a greyed
        // committee boat reads as a rendering fault, and its orange flag marks where the
        // line is for the whole race, not just while you are on the line. Vessels stay
        // in colour; buoys still grey out.
        if (m.body) active = true;

        if (sp.img.complete && sp.img.naturalWidth) {
            const img = active ? sp.img : (getMarkImgGray(m.kind) || sp.img);
            if (!active) ctx.globalAlpha = 0.92;
            ctx.drawImage(img, -W / 2, -H / 2, W, H);
        } else {
            // fallback while the sprite loads
            ctx.fillStyle = active ? '#f97316' : '#94a3b8';
            ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

// ── THE SAILING LIMIT ───────────────────────────────────────────────────────
// The club-branded band: a wide white stroke with the burgee and "Salty Critter Yacht Club"
// repeating along it. It used to be drawn as a CIRCLE of `b.radius` — which is the arena's
// BOUNDING circle, so on a designed course with a polygon arena it painted a huge ellipse
// well outside the water anyone could sail to, while the real limit was invisible.
//
// So it walks the RING instead. One polyline covers both shapes: a polygon uses its own
// points, a circle is sampled into some, and everything below — the band, the cull, the
// lettering — is arc-length work along that line. A circle therefore looks exactly as it did.
// Cached in a WeakMap rather than on the boundary itself: the compiled boundary is compared
// and serialised elsewhere, and a renderer has no business leaving fields on it.
const _ringCache = new WeakMap();
function boundaryRing(b) {
    const hit = _ringCache.get(b);
    if (hit) return hit;
    let pts;
    if (b.poly && b.poly.length >= 3) {
        pts = b.poly.map(p => ({ x: p[0], y: p[1] }));
        // Wound so the walk always goes the same way round. Text laid along a ring reads
        // upside down if the author happened to draw it the other way, and which way a
        // designer clicked out their arena is not something the lettering should depend on.
        let a2 = 0;
        for (let i = 0; i < pts.length; i++) {
            const q = pts[(i + 1) % pts.length];
            a2 += pts[i].x * q.y - q.x * pts[i].y;
        }
        if (a2 < 0) pts.reverse();
    } else {
        pts = [];
        const n = 96;                       // fine enough that the band reads as smooth
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            pts.push({ x: b.x + Math.cos(a) * b.radius, y: b.y + Math.sin(a) * b.radius });
        }
    }
    // Cumulative arc length, so a position along the perimeter is one lookup.
    const seg = [];
    let total = 0;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        const len = Math.hypot(q.x - p.x, q.y - p.y);
        seg.push({ p, q, len, at: total, ang: Math.atan2(q.y - p.y, q.x - p.x) });
        total += len;
    }
    const ring = { pts, seg, total };
    _ringCache.set(b, ring);
    return ring;
}

function drawBoundary(ctx) {
    const b = state.course.boundary;
    if (!b) return;
    const ring = boundaryRing(b);
    if (!ring || ring.total <= 0) return;

    // Viewport cull, per SEGMENT rather than per arc: mid-course most of the limit is off
    // screen, and the band plus its glow plus per-character lettering is not cheap.
    const camX = state.camera.x, camY = state.camera.y;
    const viewR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6 + 260;
    const viewR2 = viewR * viewR;
    const nearCam = (p, q) => {
        const dx = q.x - p.x, dy = q.y - p.y;
        const l2 = dx * dx + dy * dy;
        let t = l2 ? ((camX - p.x) * dx + (camY - p.y) * dy) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = p.x + t * dx - camX, ey = p.y + t * dy - camY;
        return ex * ex + ey * ey < viewR2;
    };

    ctx.save();

    // The band. Only the visible runs are stroked, each as its own subpath so a gap in the
    // middle of the ring does not get closed across the course.
    //
    // ⚠️ THE HALO IS LAYERED STROKES, NOT `shadowBlur`. A blurred 80px stroke measured 1.72 ms
    // of a 1.89 ms visible boundary — 91% of it — and up to 7 ms on a venue with more of its
    // limit in view, which was half the frame. Canvas shadow is a full Gaussian pass over the
    // stroke's bounding box; three plain strokes of decreasing width and rising alpha give
    // the same soft white edge for the cost of three ordinary fills.
    //
    // Cheap because the path is built ONCE and stroked three times: the segment walk and the
    // cull below it do not repeat.
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    let open = false;
    for (const sg of ring.seg) {
        if (nearCam(sg.p, sg.q)) {
            if (!open) { ctx.moveTo(sg.p.x, sg.p.y); open = true; }
            ctx.lineTo(sg.q.x, sg.q.y);
        } else open = false;
    }
    for (const [w, a] of [[124, 0.13], [102, 0.30], [80, 1]]) {
        ctx.lineWidth = w;
        ctx.strokeStyle = a === 1 ? '#ffffff' : `rgba(255,255,255,${a})`;
        ctx.stroke();
    }

    // Where along the perimeter, and which way is the path pointing there.
    const atDist = (d) => {
        d = ((d % ring.total) + ring.total) % ring.total;
        let lo = 0, hi = ring.seg.length - 1;
        while (lo < hi) {                       // the segment containing d
            const mid = (lo + hi + 1) >> 1;
            if (ring.seg[mid].at <= d) lo = mid; else hi = mid - 1;
        }
        const sg = ring.seg[lo];
        const t = sg.len ? (d - sg.at) / sg.len : 0;
        return { x: sg.p.x + (sg.q.x - sg.p.x) * t, y: sg.p.y + (sg.q.y - sg.p.y) * t, ang: sg.ang };
    };

    const text = "Salty Critter Yacht Club";
    ctx.font = FONT.brand(50);
    ctx.textBaseline = 'middle';

    // Static text metrics: measure once, ever (was per-char per-frame)
    if (!drawBoundary._metrics || drawBoundary._metricsReady !== FONTS_READY) {
        const charWidths = [];
        let textWidth = 0;
        for (const char of text) {
            const w = ctx.measureText(char).width;
            charWidths.push(w);
            textWidth += w;
        }
        drawBoundary._metrics = { charWidths, textWidth };
        drawBoundary._metricsReady = FONTS_READY;
    }
    const charWidths = drawBoundary._metrics.charWidths;
    const textWidth = drawBoundary._metrics.textWidth;

    const imgH = 40;
    const imgW = imgH * (649 / 462);
    const gap = 60;
    const segmentLen = imgW + gap + textWidth + gap;

    // Whole repeats only, stretched to close exactly — otherwise the last one runs into the
    // first at whatever angle the ring happens to end on.
    const count = Math.max(1, Math.round(ring.total / segmentLen));
    const step = ring.total / count;

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';

    for (let i = 0; i < count; i++) {
        const base = i * step;
        // Cheap reject: if the middle of this repeat is far off screen, neither its burgee
        // nor its lettering can be on it.
        const mid = atDist(base + (imgW + gap + textWidth) / 2);
        const mdx = mid.x - camX, mdy = mid.y - camY;
        if (mdx * mdx + mdy * mdy > (viewR + segmentLen) ** 2) continue;

        const burgeeAt = atDist(base + imgW / 2);
        ctx.save();
        ctx.translate(burgeeAt.x, burgeeAt.y);
        ctx.rotate(burgeeAt.ang);
        if (burgeeImg.complete && burgeeImg.naturalWidth > 0) {
            ctx.drawImage(burgeeImg, -imgW / 2, -imgH / 2, imgW, imgH);
        }
        ctx.restore();

        let run = base + imgW + gap;
        for (let j = 0; j < text.length; j++) {
            const w = charWidths[j];
            const at = atDist(run + w / 2);
            ctx.save();
            ctx.translate(at.x, at.y);
            ctx.rotate(at.ang);
            ctx.fillText(text[j], 0, 0);
            ctx.restore();
            run += w;
        }
    }

    ctx.restore();
}

// ── WHAT A MATERIAL READS AS ON THE CHART ───────────────────────────────────
//
// ⚠️ THESE ROWS ARE OVERRIDES, NOT THE REGISTRY. What a material looks like is
// ISLAND_STYLES' answer, and a row here earns its place only where the CHART wants a
// different one than the water does: ice pale enough to read as ice against dark glass,
// coral sand kept sand-coloured in both slots. Everything else DERIVES, which is what
// makes a new kind correct on the map the day it is added instead of the day somebody
// remembers this table exists.
//
// It used to fall through to ICE, and that is precisely the failure a second colour table
// produces. Gatorgrass Bayou's banks are `mud` and `marsh`, neither of which had a row, so
// all 24 of them drew #f2f9ff — snow white — and the braided channels the whole venue is
// built around read as a glacier on an olive chart.
//
// At module scope rather than inside drawMinimap, where it was rebuilt on every frame:
// this is a lookup table and a pure function of a style name, so it is neither per-frame
// state nor something a test should have to redraw a chart to ask about.
const MINIMAP_ISLAND = {
    tropical: { body: '#fde6b1', top: '#84cc16' },
    grass:    { body: '#7aaa1d', top: '#4d7c0f' },
    swampgrass: { body: '#a09453', top: '#4d7c0f' },
    ice:      { body: '#b8dcf5', top: '#f2f9ff' },
    redrock:  { body: '#cc6533', top: '#d98e57' },
    granite:  { body: '#4b5563', top: '#374151' },
    // Coral sand: the lagoon's beaches, kept sand-coloured in both slots — a mask
    // isle full of cream sand IS its own cap.
    coralsand: { body: '#efe4cf', top: '#efe4cf' },
    // Gatorgrass Bayou's banks, and the clearest case yet for why this table exists: the
    // CHART wants them darker than the water does.
    //
    // On the course, mud reads against textured olive water in daylight and its own material
    // colour is right. The minimap paints water as a flat 0.9-alpha wash of the venue's base
    // — no texture, no light — and against that the derived values arrived at only -27 luma
    // for mud and -7 for marsh. Seven is nothing: the braided banks the whole venue is built
    // around were dissolving into the channel at chart size, which is precisely the size at
    // which you need to see where the maze is.
    //
    // Taken down to about -50 and -32 against the water, and kept inside the olive-brown
    // family so they still read as the same two materials — and 18 luma apart from each
    // other, so marsh still reads as the lighter margin between sward and bank.
    mud:      { body: '#37301f', top: '#37301f' },
    marsh:    { body: '#4b4228', top: '#4b4228' },
    // ── SOCKEYE RUN'S FOREST, AND WHY THE CHART DISAGREES WITH THE GROUND ───────────
    // Same argument as mud and marsh above, arrived at from the other end. `humus` and
    // `mossfloor` both carry `trees: true`, so the chart was taking their VEG colour — the
    // forest floor's own green — and drawing #4E5A34 and #7EA02A. Two problems with that.
    //
    // Humus at #4E5A34 sat only -10 luma against the water: the venue's biggest landform,
    // the thing the whole river runs through, was dissolving into the channel at chart size.
    // And mossfloor at #7EA02A was +45, BRIGHTER than the water and nearly as bright as the
    // meadow — so the wettest, darkest forest on the map was charting as its most open
    // ground, which is backwards.
    //
    // What a player needs off this chart is where the WOOD is, and a Southeast Alaska wood
    // seen from above is the colour of Sitka spruce. So humus takes the shipped
    // river-spruce-sitka sprite's own measured mean, #26382E, and mossfloor sits a shade
    // greener and lighter as the damper variant — 15 luma apart and dE 16.9, so a designer
    // can still tell the two forests apart, which at #4E5A34 vs #7EA02A they could (dE 45)
    // but for the wrong reason.
    //
    // Against the water they now land at -42 and -19 luma, bracketing the bayou note's own
    // -50/-32 finding. Meadow takes the recoloured tile's mean so the chart and the ground
    // agree, and at +58 luma it is the brightest thing on the venue — which is the read:
    // dark forest, bright meadow, pale gravel, and the river threading between them.
    humus:     { body: '#26382E', top: '#26382E' },
    mossfloor: { body: '#33563B', top: '#33563B' },
    meadow:    { body: '#8DAD32', top: '#8DAD32' },
    // Fallback only. A bar's real chart colour is DERIVED per shape (shoalTintFor), so a
    // tan bar and a coral-white bar read differently here exactly as they do on the course.
    shoal:    { body: 'rgba(232,220,177,0.45)', top: 'rgba(232,220,177,0.45)' }
};
// An explicit row wins; otherwise the material's own colours, so the map cannot disagree
// with the water about what a thing is.
//
// `top` is the fill a DOC venue actually uses — compiled shapes are `fromMask`, which
// takes the top slot and skips the cap pass entirely — so the choice between veg and body
// is the whole picture, not a detail of the middle. A wooded island shows its CANOPY from
// above; bare ground shows the GROUND. `trees` is the flag that already knows which is
// which, so it decides here rather than a second list of exceptions.
function minimapIsland(style) {
    const row = MINIMAP_ISLAND[style];
    if (row) return row;
    const st = ISLAND_STYLES[style];
    if (!st) return MINIMAP_ISLAND.ice;      // an unknown style keeps the old default
    return { body: st.body, top: st.trees ? (st.veg || st.body) : st.body };
}

function drawMinimap() {
    if (!minimapCtx) { const c = document.getElementById('minimap'); if(c) minimapCtx = c.getContext('2d'); }
    const ctx = minimapCtx;
    if (!ctx || !state.boats.length) return;

    const width = ctx.canvas.width, height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);

    const player = state.boats[0];
    // Bounds centered on player but including marks?
    // Let's use logic from before: Bounds of marks + player
    let minX = player.x, maxX = player.x, minY = player.y, maxY = player.y;
    for (const m of state.course.marks) {
        minX = Math.min(minX, m.x); maxX = Math.max(maxX, m.x);
        minY = Math.min(minY, m.y); maxY = Math.max(maxY, m.y);
    }
    // Mask venues show the WHOLE map: the geography is authored and fixed, so a
    // minimap cropped to player+marks hides most of it and reads nothing like
    // the painted mask.
    if (state.course.doc) {
        // Follows the ARENA rather than MASK_WORLD, so it tracks a scaled map and a
        // polygon boundary instead of a constant that no longer describes either. THE
        // ARENA'S LONG AXIS JUST FITS: the chart is for racing, so the water you may
        // sail claims the whole frame, and the scenery beyond the limit shows only as
        // far as the frame's own margins let it (the whole-canvas water fill below is
        // what keeps that cropped scenery sitting on sea rather than on glass). This
        // deliberately reverts an experiment that grew the extent to take in all
        // scenery — an atoll ring 3x the arena shrank the racing to a postage stamp.
        const e = Arena.extent(state.course.boundary);
        minX = e.minX; maxX = e.maxX; minY = e.minY; maxY = e.maxY;
    }
    const pad = state.course.doc ? 0 : 200;
    minX-=pad; maxX+=pad; minY-=pad; maxY+=pad;
    const scale = (width - (state.course.doc ? 0 : 20)) / Math.max(maxX-minX, maxY-minY);
    const cx = (minX+maxX)/2, cy = (minY+maxY)/2;
    const t = (x, y) => ({ x: (x-cx)*scale + width/2, y: (y-cy)*scale + height/2 });

    // Boundary (a designed course draws its own arena, so only a generated one needs this)
    const b = state.course.boundary;
    if (!state.course.doc) {
        const bp = t(b.x, b.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(bp.x, bp.y, b.radius*scale, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    }


    // ── THE VENUE'S OWN WATER, AND WHAT LIES IN IT ──────────────────────────
    // A doc venue's chart paints in the venue's real colours: the open water as a rect
    // over the glass, the painted zones in the signature water, everything on the
    // bottom in the same derived tints the course draws it with — so the minimap is a
    // small true picture of the venue, not a diagram in chart-sand. Generated venues
    // keep the bare glass: they have no authored geography to show.
    const mmPoly = (verts) => {
        ctx.beginPath();
        if (verts.length) {
            const p0 = t(verts[0].x, verts[0].y);
            ctx.moveTo(p0.x, p0.y);
            for (let i = 1; i < verts.length; i++) { const p = t(verts[i].x, verts[i].y); ctx.lineTo(p.x, p.y); }
        }
        ctx.closePath();
    };
    if (state.course.doc && window.WATER_CONFIG) {
        const rgbOf = (h, fb) => {
            const s = String(h || '').replace('#', '');
            return /^[0-9a-f]{6}$/i.test(s) ? [0, 2, 4].map(i => parseInt(s.substr(i, 2), 16)) : fb;
        };
        const base = rgbOf(window.WATER_CONFIG.baseColor, [14, 79, 134]);
        // The WHOLE canvas, not the extent rect: the frame's spare margins show cropped
        // scenery from beyond the arena, and that scenery must sit on sea, not on glass.
        ctx.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},0.9)`;
        ctx.fillRect(0, 0, width, height);
        // Painted zones, in document order: shallows in the hero water, meadows in the
        // same submerged olive the course bakes.
        const hero = rgbOf(window.WATER_CONFIG.heroColor || window.WATER_CONFIG.baseColor, base);
        for (const isl of state.course.islands || []) {
            if (!isl.paint || isl.hidden || !isl.vertices) continue;
            mmPoly(isl.vertices);
            // A vegetated zone shows in its own plant's darkest tone; a bare tint zone
            // shows in the hero water. Reads the same VEG_STYLES row the bed itself
            // bakes from, so the map and the world cannot drift apart.
            const spec = isl.veg ? VEG_STYLES[isl.veg] : null;
            ctx.fillStyle = spec
                ? `rgba(${vegTone(spec.tones[0], spec).join(',')},0.55)`
                : `rgba(${hero[0]},${hero[1]},${hero[2]},0.9)`;
            ctx.fill('evenodd');
        }
    }

    // ── PUFFS: WATER, SO THEY GO UNDER THE LAND ─────────────────────────────
    // Drawn here rather than after the islands, which is where they used to be — a puff
    // whose centre sits on a berg painted a violet blob across the ice, and a patch of
    // rough water on a glacier is not a thing. Land is painted next and covers them, the
    // same way the main view already handles it.
    //
    // Tinted from the venue's own `palette.gusts` rather than a hardcoded navy/cyan, so a
    // cat's-paw here is the same water it is out on the course (race-view.md §4, §8) — but
    // the CHART under them is dark slate, not this venue's water, so the tint keeps its HUE
    // and has its lightness floored to stay legible there. `gustDark` painted literally was
    // invisible ink: ten gusts on Open Ocean's minimap and not one of them on screen.
    //
    // And the fill is the same radial falloff the course sprite bakes, not a flat disc. A
    // hard-edged ellipse at one alpha read as a fog bank on Stillwater Lake, where a lull
    // outgrows the arm of the lake it sits in — strong at the centre and gone at the rim is
    // both how the course draws it and what keeps a big cell from swallowing the chart.
    const _gc = (typeof activeGustColors !== 'undefined' && activeGustColors) || null;
    if (_gc) {
        const _lift = (c, floor) => {
            const [h, s, l] = rgbToHsl(c[0], c[1], c[2]);
            return l >= floor ? c : hslToRgb(h, s, floor);
        };
        const gustC = _lift(_gc.gustMid, 0.42);
        const lullC = _gc.lullBright;                    // authored bright; already legible
        for (const g of state.gusts) {
            const pos = t(g.x, g.y);
            const R = g.radiusX * scale;
            if (R < 1.5) continue;                       // sub-2px cell: nothing to read
            const strength = Math.min(1.0, Math.abs(g.speedDelta) / (state.wind.baseSpeed * 0.5));
            // Stays under the boats: these are the CENTRE alphas, and the rim is zero. They
            // run higher than the old flat fill dared, because the chart is frosted glass
            // with the moving race behind it — at 0.3 a cell loses to the blur noise.
            let peak = g.type === 'gust' ? 0.30 + strength * 0.45 : 0.22 + strength * 0.33;
            // A cell's ink shrinks with the SQUARE of its on-chart radius, so the same puff
            // that reads on Stillwater Lake is a faint dot on Open Ocean's big arena. Small
            // cells get their alpha handed back — capped where a strong cell already sits.
            const small = Math.max(0, Math.min(1, (10 - R) / 10));
            peak = Math.min(0.8, peak * (1 + small * 0.6));
            const c = g.type === 'gust' ? gustC : lullC;
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(g.rotation);
            ctx.scale(1, g.radiusY / g.radiusX);
            // Same upwind shift as the main draw — the minimap is the one place you read the
            // whole fleet against the whole pressure field, so it is the last place the two
            // should disagree. (Drawn in the scaled frame, so the offset scales with it.)
            const ox = -PUFF_SKEW * g.radiusX * scale;
            const grad = ctx.createRadialGradient(ox, 0, 0, ox, 0, R);
            grad.addColorStop(0, `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${peak.toFixed(3)})`);
            grad.addColorStop(0.55, `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(peak * 0.45).toFixed(3)})`);
            grad.addColorStop(1, `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0)`);
            ctx.beginPath();
            ctx.arc(ox, 0, R, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            // A thin ring at the cell's true extent, weather-chart style. The soft core
            // alone loses on Open Ocean, whose chart is the same navy as its gusts — a
            // rim is the one mark that survives any backdrop without adding real ink.
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Math.min(0.7, (0.20 + strength * 0.25) * (1 + small)).toFixed(3)})`;
            ctx.stroke();
            ctx.restore();
        }
    }

    // Squalls: the weather worth planning around, drawn as its shadow — a dark cell
    // with a rim, heavier than a puff because it IS heavier than a puff.
    if (state.squalls) {
        for (const q of state.squalls) {
            const pos = t(q.x, q.y);
            const R = Math.max(q.rx, q.ry) * scale;
            if (R < 2) continue;
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(q.course);
            ctx.scale(q.rx / Math.max(q.rx, q.ry), q.ry / Math.max(q.rx, q.ry));
            ctx.beginPath();
            ctx.arc(0, 0, R, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(16, 26, 44, 0.45)';
            ctx.fill();
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = 'rgba(120, 150, 190, 0.6)';
            ctx.stroke();
            ctx.restore();
        }
    }

    if (state.course.islands) {
        // Body first. Shoals draw their body and are then skipped by the cap pass below:
        // the cap is vegetation or snow, and a bar under water has neither. Paint zones
        // are not islands at all — they were drawn with the water above.
        //
        // ⚠️ `hidden`, NOT `isBank` — see the note in drawIslands. isBank is "out of the
        // router", which is a different question from "do not draw", and the chart has to
        // agree with the water about what is there.
        for (const isl of state.course.islands) {
            if (isl.hidden || isl.paint) continue;
            ctx.fillStyle = isl.reef
                ? `rgba(${submergedTint(REEF_RUBBLE[1]).join(',')},0.6)`   // the band's own drowned khaki
                : isl.awash
                ? `rgba(${shoalTintFor(isl).join(',')},0.6)`
                : isl.fromMask
                ? minimapIsland(isl.style).top
                : minimapIsland(isl.style).body;
            ctx.beginPath();
            if (isl.vertices.length > 0) {
                const p0 = t(isl.vertices[0].x, isl.vertices[0].y);
                ctx.moveTo(p0.x, p0.y);
                for(let i=1; i<isl.vertices.length; i++) {
                    const pi = t(isl.vertices[i].x, isl.vertices[i].y);
                    ctx.lineTo(pi.x, pi.y);
                }
            }
            ctx.closePath();
            // even-odd: mask rings are keyholed (the sound is a hole in the land)
            ctx.fill('evenodd');
        }
        // Center cap (vegetation on land, snow on ice)
        for (const isl of state.course.islands) {
            if (isl.hidden || isl.awash) continue;
            // Mask shapes are keyholed; an inset "cap" ring is meaningless and
            // paints blobs across the water.
            if (isl.fromMask) continue;
            ctx.fillStyle = minimapIsland(isl.style).top;
            ctx.beginPath();
            if (isl.vegVertices.length > 0) {
                const p0 = t(isl.vegVertices[0].x, isl.vegVertices[0].y);
                ctx.moveTo(p0.x, p0.y);
                for(let i=1; i<isl.vegVertices.length; i++) {
                    const pi = t(isl.vegVertices[i].x, isl.vegVertices[i].y);
                    ctx.lineTo(pi.x, pi.y);
                }
            }
            ctx.closePath();
            ctx.fill();
        }
    }

    // Trace (Player Only)
    if (player.raceState.trace.length) {
         ctx.lineWidth = 1.5;
         // Draw whole trace
         // Simplify: Draw all points
         ctx.beginPath();
         const p0 = t(player.raceState.trace[0].x, player.raceState.trace[0].y);
         ctx.moveTo(p0.x, p0.y);
         for (const p of player.raceState.trace) {
             const tp = t(p.x, p.y);
             ctx.lineTo(tp.x, tp.y);
         }
         const curr = t(player.x, player.y);
         ctx.lineTo(curr.x, curr.y);
         ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
         ctx.stroke();
    }

    // ── WHERE TO GO NEXT ────────────────────────────────────────────────────
    //
    // This is what the minimap is FOR. Everything else on it — the coastline, the fleet,
    // the rest of the course — is context for one question, so the active target gets the
    // strongest treatment on the map and everything inactive gets out of its way.
    //
    // Two things were wrong. `legMarks()` returns null for a ROUNDING (a rounding entry
    // carries `markId`, not `marks`), so on an island course — Glacier Sound's whole race —
    // nothing was highlighted at all and the mark you were sailing to drew as one more grey
    // pip. And on a document venue every mark is scaled by 0.6, so even a gate's "active"
    // dot was 2.4px: emphasis that shrank exactly when the map got busy.
    const legNow = player.raceState.leg;
    const entry = routeLeg(legNow);
    const racing = state.race.status !== 'finished';
    const active = (racing && legMarks(legNow)) || [];
    const roundMark = (racing && entry && entry.kind === 'round') ? entry.mark : null;

    // Gates come from the ROUTE, not from the hardcoded pairs (0,1) and (2,3). A
    // course with one line and a rounding has no second gate, and reading marks[2]
    // on a two-mark course crashed the whole minimap.
    const drawG = (i1, i2, a) => {
        const m1 = state.course.marks[i1], m2 = state.course.marks[i2];
        if (!m1 || !m2) return;
        const p1 = t(m1.x, m1.y), p2 = t(m2.x, m2.y);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        // Inactive geometry is nearly gone. It still says "there is a gate here" for
        // orientation, and says nothing louder than that. MID-SLATE rather than a dim
        // white: this minimap is pale ice on Glacier Sound and deep blue on Lighthouse
        // Cove, and a near-white line at 0.14 disappears completely on the first one.
        ctx.strokeStyle = a ? '#fde047' : 'rgba(148, 163, 184, 0.5)';
        ctx.lineWidth = a ? 2.5 : 1;
        ctx.stroke();
    };
    const drawn = {};
    for (const e of (state.course.route || [])) {
        if (!e.marks) continue;
        const key = e.marks.join(',');
        if (drawn[key]) continue;
        drawn[key] = true;
        drawG(e.marks[0], e.marks[1], active.indexOf(e.marks[0]) !== -1);
    }

    // Every other mark: small, cool and quiet.
    const mkR = state.course.doc ? 0.6 : 1;
    for (let i = 0; i < state.course.marks.length; i++) {
        if (active.includes(i)) continue;
        const m = state.course.marks[i];
        if (roundMark && m === roundMark) continue;
        const p = t(m.x, m.y);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.6 * mkR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.55)'; ctx.fill();
    }

    // ── THE BEACON ──────────────────────────────────────────────────────────
    // Drawn last so nothing buries it, and deliberately NOT scaled by `mkR` — the same
    // rule the player arrow follows: the one thing you are hunting for must not shrink
    // when the map gets harder to read. The halo PULSES, which makes it the only moving
    // thing on the map besides the boats; the eye goes to it without being told to.
    const beacon = (px, py, coreR) => {
        const pulse = 0.5 + 0.5 * Math.sin(state.time * 3.0);
        ctx.beginPath(); ctx.arc(px, py, coreR + 4 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(253, 224, 71, ${(0.30 + pulse * 0.45).toFixed(3)})`;
        ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, coreR, 0, Math.PI * 2);
        ctx.fillStyle = '#f97316'; ctx.fill();
        ctx.strokeStyle = '#0b1c2b'; ctx.lineWidth = 1.4; ctx.stroke();
    };
    for (const i of active) {
        const m = state.course.marks[i];
        if (m) { const p = t(m.x, m.y); beacon(p.x, p.y, 4.2); }
    }
    if (roundMark) {
        const p = t(roundMark.x, roundMark.y);
        // A rounding's zone is the thing you have to get inside, so draw it: the ring is
        // the instruction, not decoration. Floored in pixels so it survives a whole-map
        // venue where the real zone is a few pixels across.
        const zoneR = Math.max(9, (roundMark.zone || 0) * scale);
        ctx.beginPath(); ctx.arc(p.x, p.y, zoneR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.35)';
        ctx.lineWidth = 1.2; ctx.stroke();
        beacon(p.x, p.y, 4.6);
    }

    // Boats
    // Marker size. These were tuned when the minimap framed player+marks; a
    // mask venue shows the WHOLE map, where a fixed 8px arrow is a boat the size
    // of an island and the fleet becomes one coloured smear. Shrink to match.
    const mk = state.course.doc ? 0.55 : 1;

    // COMPETITORS ARE DOTS. Ten rotating triangles a few pixels tall encode a heading
    // nobody can read at this size — they just made the fleet a field of similar shapes
    // you had to pick your own arrow out of. A dot says the one thing a rival pip is for:
    // where they are. It also leaves the ARROW shape meaning exactly one thing on this
    // map, which is what makes the player findable at a glance.
    for (const boat of state.boats) {
        if (boat.isPlayer) continue;
        const pos = t(boat.x, boat.y);
        // Ink outline: hull colors alone don't separate from water or gust blobs
        // at this size, and dark hulls disappeared entirely.
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 4.6 * mk, 0, Math.PI * 2);
        ctx.fillStyle = isVeryDark(boat.colors.hull) ? boat.colors.spinnaker : boat.colors.hull;
        ctx.fill();
        ctx.strokeStyle = 'rgba(11, 28, 43, 0.85)'; ctx.lineWidth = 1.4 * mk; ctx.stroke();
    }

    // THE PLAYER IS A LARGE WHITE ARROW — drawn last, so it is never buried under a rival.
    if (player) {
        const pos = t(player.x, player.y);
        ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(player.heading);

        // Deliberately NOT scaled by `mk`. The fleet shrinks on a whole-map venue so it
        // does not smear; the one marker you are hunting for must stay the same size, or
        // it shrinks exactly when the map gets hard to read.
        ctx.shadowBlur = 6 + Math.sin(state.time * 8) * 2;
        ctx.shadowColor = 'rgba(15, 30, 45, 0.95)';

        ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(8.5, 10); ctx.lineTo(0, 6); ctx.lineTo(-8.5, 10);
        ctx.closePath();
        // White, against a fleet of saturated hull colours. Shape and value both separate
        // it now, so it no longer needs the gold that used to be doing that job alone.
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#0b1c2b'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.restore();
    }
}

let frameCount = 0;

// ── DISTANCE MADE ON COURSE ─────────────────────────────────────────────────
// How far round the course a boat is, in world units, measured along the shared per-leg
// path (CoursePath in planner.js). Finished legs contribute their whole length; the
// current leg contributes the boat's furthest projection onto it.
//
// This is a RANKING number and the leaderboard's distance deltas. It is deliberately
// measured on the course, not on the water the boat actually sailed: two boats on
// opposite tacks up the same beat are then directly comparable, which is the entire
// reason the metric exists and is what race telemetry reports.
//
// The straight-axis version this replaces only worked on alternating windward/leeward
// courses. See the note on CoursePath for what it did to an island rounding.
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

function updateLeaderboard() {
    if (UI.resultsOverlay && !UI.resultsOverlay.classList.contains('hidden')) {
        showResults();
        return;
    }
    if (!UI.leaderboard || !state.boats.length) return;

    // Store previous ranks
    state.boats.forEach(b => b.prevRank = b.lbRank);

    // Calculate L for distance estimates
    const _ax = courseAxis();
    const c1x = _ax.start.x, c1y = _ax.start.y;
    const c2x = _ax.windward.x, c2y = _ax.windward.y;
    const dx = _ax.dx, dy = _ax.dy;
    const len = _ax.len;
    // THE WHOLE COURSE, measured on the path DMC is read against — not `legs x axis length`,
    // which is the straight-line axis and understates any course with land on it. The
    // "distance to finish" delta has to be in the same units as the progress it subtracts.
    const totalRaceDist = (state.course.dmc && state.course.dmc.total) || (state.race.totalLegs * len);


    if (state.race.status === 'prestart') {
         UI.leaderboard.classList.add('hidden');
         return;
    }
    UI.leaderboard.classList.remove('hidden');

    // Sort boats
    const sorted = [...state.boats].sort((a, b) => {
        // Scoring helper: 0=Finished, 1=DNF, 2=DNS, 3=Racing
        const getScore = (boat) => {
            if (!boat.raceState.finished) return 3;
            if (boat.raceState.resultStatus === 'DNS') return 2;
            if (boat.raceState.resultStatus === 'DNF') return 1;
            return 0;
        };

        const scoreA = getScore(a);
        const scoreB = getScore(b);

        if (scoreA !== scoreB) return scoreA - scoreB;

        if (scoreA === 0) return a.raceState.finishTime - b.raceState.finishTime;

        // 2. Leg (For Racing)
        if (a.raceState.leg !== b.raceState.leg) return b.raceState.leg - a.raceState.leg;

        // 3. Progress within leg (For Racing or DNF/DNS tiebreak)
        const pA = getBoatProgress(a);
        const pB = getBoatProgress(b);
        return pB - pA;
    });

    const leader = sorted[0];
    const leaderProgress = getBoatProgress(leader);

    // Update Header
    // The pips carry the count, so the label is just a label. `2/4` beside four bars with
    // two lit was the same fact twice.
    if (UI.lbLeg) UI.lbLeg.textContent = "LEG";

    // Leg pips: one per leg, showing where YOU are — not the leader. This is the player's
    // own panel, and "which leg am I on" is the question it is being asked.
    //
    // Three states rather than two, so it says the leg rather than a count of finished ones:
    // the leg you are ON is lit, the ones behind you are dimmed, the ones ahead are dark.
    if (UI.lbPips) {
        const legs = Math.max(1, state.race.totalLegs);
        const me = state.boats.find(b => b.isPlayer) || leader;
        const cur = me.raceState.finished ? legs + 1 : Math.max(1, me.raceState.leg);
        if (UI.lbPips.childElementCount !== legs) {
            UI.lbPips.innerHTML = '';
            for (let i = 0; i < legs; i++) {
                const pip = document.createElement('span');
                pip.style.cssText = 'display:block;height:4px;border-radius:2px;transition:background .3s,width .3s;';
                UI.lbPips.appendChild(pip);
            }
        }
        [...UI.lbPips.children].forEach((pip, i) => {
            const n = i + 1;
            pip.style.width = n === cur ? '20px' : '14px';
            pip.style.background = n === cur ? '#5eead4' : n < cur ? '#5eead459' : '#475569';
        });
    }

    // Render Rows
    if (UI.lbRows) {
        const ROW_HEIGHT = 44;
        UI.lbRows.style.height = (sorted.length * ROW_HEIGHT + 12) + 'px';

        sorted.forEach((boat, index) => {
            let row = UI.boatRows[boat.id];

            // Create if missing
            if (!row) {
                row = document.createElement('div');
                row.className = "lb-row flex items-center";

                // Rank. Italic display rather than mono: the whole row is one voice, and a
                // monospaced numeral beside an italic name read as two different panels.
                const rank = document.createElement('div');
                rank.className = "lb-rank t-display w-5 text-right mr-2.5 shrink-0";
                rank.style.cssText = "font-size:15px; font-style:italic;";

                // Portrait / Icon
                const iconContainer = document.createElement('div');
                iconContainer.className = "w-9 h-9 mr-2.5 flex items-center justify-center shrink-0";

                // EVERY ROW SHOWS A FACE, yours included. The player used to get a star
                // because the player had no portrait — but the player IS a character now, and
                // showing whose boat you picked is the point of picking one. Which row is
                // yours is already said by the ring around the row and its type, so the star
                // was carrying a meaning that was no longer its own.
                //
                // No ring and no fill behind it: the portraits are cut-outs, so a disc of
                // panel-coloured background WAS the circle. The src is set in the update
                // pass, not here — see the note there.
                const img = document.createElement('img');
                img.className = "lb-face w-9 h-9 rounded-full object-cover";
                iconContainer.appendChild(img);

                const nameDiv = document.createElement('div');
                nameDiv.className = "lb-name t-display flex-1 truncate uppercase";
                nameDiv.style.cssText = "font-size:16px;";
                nameDiv.textContent = boat.name;

                // Which way this boat is going, shown only while it is still worth saying.
                const trendDiv = document.createElement('div');
                trendDiv.className = "lb-trend shrink-0 mr-1.5 text-center";
                trendDiv.style.cssText = "width:12px; font-size:10px; line-height:1;";

                const distDiv = document.createElement('div');
                distDiv.className = "lb-dist t-mono text-right shrink-0";
                distDiv.style.cssText = "font-size:11.5px; min-width:52px;";

                row.appendChild(rank);
                row.appendChild(iconContainer);
                row.appendChild(nameDiv);
                row.appendChild(trendDiv);
                row.appendChild(distDiv);

                UI.lbRows.appendChild(row);
                UI.boatRows[boat.id] = row;
                boat.lbRank = index;
            }

            // Update Content
            const rankDiv = row.querySelector('.lb-rank');
            const distDiv = row.querySelector('.lb-dist');
            const nameDiv = row.querySelector('.lb-name');
            const trendDiv = row.querySelector('.lb-trend');
            const faceImg = row.querySelector('.lb-face');

            // ⚠️ THE FACE FOLLOWS THE BOAT'S IDENTITY, WHICH CAN CHANGE UNDER A LIVE ROW.
            // Picking a new character does not rebuild the fleet — `applyPlayerCharacter`
            // renames boat 0 in place (and `swapClashingOpponent` can re-identify an AI) —
            // so a src set once at row creation left the OLD portrait on the row while the
            // name beside it updated. Cheap to re-check: a string compare per row per draw.
            if (faceImg && faceImg.dataset.face !== boat.name) {
                faceImg.dataset.face = boat.name;
                faceImg.src = "assets/images/competitors/" + boat.name.toLowerCase() + ".png";
            }

            const dnx = boat.raceState.leg === 0 && !boat.raceState.finished;
            let rowClass = "lb-row flex items-center transition-colors duration-500";
            if (boat.isPlayer) rowClass += " lb-me";
            row.className = rowClass;

            // YOU ARE YOUR OWN COLOUR, not gold — the same hue the results page rings your
            // row with and the same one your gap marker carries there. Gold had to mean two
            // things at once on a panel that also ranks a fleet.
            const me = boat.isPlayer
                ? deepBandFor(boat.colors.hull, boat.colors.spinnaker, boat.colors.spinAccent) : null;
            if (me) row.style.boxShadow = `inset 0 0 0 2px ${me}`;

            // Only MEANINGFUL rows carry a fill — you, and anyone who has finished. The
            // zebra striping was a third fill that said nothing, and on the dark panel it
            // read as banding rather than as rows.
            row.style.background = boat.isPlayer ? boatGlow(boat, 0.12)
                                 : boat.raceState.finished ? 'rgba(16,185,129,0.14)'
                                 : 'transparent';

            rankDiv.style.color = me ? me : dnx ? '#475569' : '#64748b';
            nameDiv.style.color = boat.raceState.penalty ? '#f87171'
                                : me ? me
                                : dnx ? '#64748b' : '#ffffff';
            nameDiv.textContent = boat.name;
            rankDiv.textContent = index + 1;

            // A MOVE IS NEWS FOR A FEW SECONDS. Comparing ranks frame to frame would flash
            // the arrow for one update and vanish; this holds it long enough to be seen and
            // then stops, so a settled fleet is a quiet panel.
            if (boat.prevRank !== undefined && boat.prevRank !== index) {
                boat.lbTrendDir = index < boat.prevRank ? 1 : -1;
                boat.lbTrendUntil = state.race.timer + 2.5;
            }
            const showTrend = boat.lbTrendUntil !== undefined && state.race.timer < boat.lbTrendUntil;
            trendDiv.textContent = showTrend ? (boat.lbTrendDir > 0 ? '\u25B2' : '\u25BC') : '';
            trendDiv.style.color = boat.lbTrendDir > 0 ? '#34d399' : '#f87171';

            if (index === 0 && !boat.raceState.resultStatus) {
                // The leader has no gap to report, so the column says what it IS.
                distDiv.textContent = boat.raceState.finished ? formatTime(boat.raceState.finishTime) : 'LEADER';
                distDiv.style.color = '#5eead4';
            } else {
                distDiv.style.color = dnx ? '#64748b' : '#a5b4fc';
                if (boat.raceState.resultStatus) {
                    distDiv.textContent = boat.raceState.resultStatus;
                } else if (leader.raceState.finished) {
                    if (boat.raceState.finished) {
                        distDiv.textContent = "+" + (boat.raceState.finishTime - leader.raceState.finishTime).toFixed(1) + "s";
                    } else {
                        const diff = Math.max(0, totalRaceDist - getBoatProgress(boat));
                        distDiv.textContent = "+" + Math.round(diff * 0.2) + "m";
                    }
                } else {
                    const diff = Math.max(0, leaderProgress - getBoatProgress(boat));
                    distDiv.textContent = "+" + Math.round(diff * 0.2) + "m";
                }
            }

            // Update Position
            row.style.transform = `translate3d(0, ${index * ROW_HEIGHT}px, 0)`;

            // Handle Rank Change Animation
            if (boat.lbRank !== index) {
                boat.lbRank = index;
            }
        });
    }

    // Sayings Checks
    const player = state.boats[0];
    const playerRank = player.lbRank;
    const playerPrevRank = player.prevRank;

    for (const boat of state.boats) {
        if (boat.isPlayer) continue;

        // Moved into First
        if (boat.lbRank === 0 && boat.prevRank !== 0) {
            Sayings.queueQuote(boat, "moved_into_first");
        }

        // Moved into Last
        if (boat.lbRank === state.boats.length - 1 && boat.prevRank !== state.boats.length - 1) {
            Sayings.queueQuote(boat, "moved_into_last");
        }

        // Passing Player (AI was behind, now ahead)
        // Lower rank is better. Behind means rank > playerRank. Ahead means rank < playerRank.
        if (boat.prevRank > playerPrevRank && boat.lbRank < playerRank) {
            Sayings.queueQuote(boat, "they_pass_player");
        }

        // Player Passed AI (AI was ahead, now behind)
        if (boat.prevRank < playerPrevRank && boat.lbRank > playerRank) {
            Sayings.queueQuote(boat, "player_passes_them");
        }
    }
}



function drawBoatIndicator(ctx, boat) {
    if (boat.isPlayer) return;
    if (boat.opacity !== undefined && boat.opacity <= 0) return;

    // One line: rank pip + name. The label's only job on the water is IDENTITY —
    // binding "that pink boat" to "Splat". Rank and name are already in the
    // leaderboard, so the pip reuses that panel's ring-plus-rank language and the
    // two views teach each other. Speed was removed deliberately: a rival's
    // ABSOLUTE boatspeed changes no decision (the fleet sits inside ~1.5kn), and
    // reading it meant holding a number while glancing at your own instrument.
    const rank = (boat.lbRank !== undefined) ? String(boat.lbRank + 1) : "-";
    const showRank = boat.raceState.leg !== 0;   // no standings before the gun
    const name = boat.name.toUpperCase();
    const idColor = isVeryDark(boat.colors.hull) ? boat.colors.spinnaker : boat.colors.hull;

    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(state.camera.rotation);
    ctx.translate(0, 46); // below the boat, camera-upright

    // The pip is always present — it is the identity carrier, and identity matters
    // most in the prestart scrum. It just holds no digit until there are standings.
    const PIP_R = showRank ? 8 : 4.5;
    const padX = 7;
    ctx.font = FONT.label(11);
    const nameW = ctx.measureText(name).width;
    const pipSlot = PIP_R * 2 + 5;
    const boxW = padX + pipSlot + nameW + padX;
    const boxH = 22;
    const x = -boxW / 2, y = 0;

    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 6);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    let cursor = x + padX;

    // Filled pip in the boat's identity color; digit picks whichever of
    // ink/white actually reads on it.
    const pcx = cursor + PIP_R, pcy = y + boxH / 2;
    ctx.fillStyle = idColor;
    ctx.beginPath();
    ctx.arc(pcx, pcy, PIP_R, 0, Math.PI * 2);
    ctx.fill();

    if (showRank) {
        ctx.font = FONT.mono(10);
        ctx.fillStyle = isVeryDark(idColor) ? '#f8fafc' : '#0b1c2b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rank, pcx, pcy + 0.5);
        ctx.font = FONT.label(11);
    }
    cursor += PIP_R * 2 + 5;

    // Penalty is the one state that overrides identity — red means penalty here
    // exactly as it does everywhere else.
    ctx.fillStyle = boat.raceState.penalty ? '#ef4444' : '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, cursor, y + boxH / 2 + 0.5);

    ctx.restore();
}

// Edge-clamped indicator for an active gate mark (or, with markIndex null, the
// closest point on the start/finish line). The mini arc mirrors the in-world
// rounding arrows of drawRoundingArrows: same start/end/ccw per mark index,
// rotated into screen space so it always agrees with what you'll see at the mark.
function drawMarkEdgeIndicator(ctx, x, y, label, markIndex, screenRot) {
    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fillStyle = '#22c55e'; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

    if (markIndex !== null) {
        let start, end, ccw;
        // A rounding leg passes the SIDE ('port'/'starboard') instead of a gate index —
        // same chirality convention as drawRoundingArrows: port rounds are the ccw ones.
        if (markIndex === 'port' || markIndex === 'starboard') {
                                    start = 0;       end = Math.PI; ccw = markIndex === 'port'; }
        else if (markIndex === 0) { start = 0;       end = Math.PI; ccw = false; }
        else if (markIndex === 1) { start = Math.PI; end = 0;       ccw = true; }
        else if (markIndex === 2) { start = 0;       end = Math.PI; ccw = true; }
        else                      { start = Math.PI; end = 0;       ccw = false; }

        ctx.save();
        ctx.rotate(state.wind.baseDirection + screenRot);
        ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, 15, start, end, ccw); ctx.stroke();
        const tipX = 15 * Math.cos(end), tipY = 15 * Math.sin(end);
        const tangent = end + (ccw ? -Math.PI/2 : Math.PI/2);
        ctx.translate(tipX, tipY); ctx.rotate(tangent);
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, 0); ctx.lineTo(-5, 5); ctx.lineTo(-3, 0); ctx.fill();
        ctx.restore();
    }

    ctx.fillStyle = '#ffffff'; ctx.font = FONT.label(15); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
    ctx.fillText(label, 0, markIndex !== null ? -21 : -12);
    ctx.restore();
}

// Edge-clamped indicator for a nearby off-screen competitor: hull-colored dot
// with the boat's current rank inside and its name above.
function drawNpcEdgeIndicator(ctx, x, y, boat) {
    const color = isVeryDark(boat.colors.hull) ? boat.colors.spinnaker : boat.colors.hull;
    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = boat.raceState.penalty ? '#ef4444' : '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

    if (state.race.status === 'racing' && boat.lbRank !== undefined) {
        ctx.fillStyle = isVeryDark(color) ? '#ffffff' : '#0f172a';
        ctx.font = FONT.mono(10); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(boat.lbRank + 1), 0, 0.5);
    }

    ctx.fillStyle = '#ffffff'; ctx.font = FONT.label(10); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
    ctx.fillText(boat.name.toUpperCase(), 0, -13);
    ctx.restore();
}

// ── THE INSTRUMENTS THAT LIVE ON THE BOAT ───────────────────────────────────
//
// SOG, TWS and TWA in a small panel under the player's own hull, instead of in a dial in
// the far corner of the screen. The three numbers a sailor reads constantly were 900 px
// from the thing they describe: you cannot watch your boat and your speed at once, so you
// alternate, and every glance at the corner is a glance away from the water you are
// sailing into. Anchored to the hull they are read with the same fixation as the boat.
//
// DRAWN ON THE CANVAS RATHER THAN AS DOM, like the competitor tags and the edge indicators
// it sits beside — a DOM node chasing a moving world point lags the canvas by a frame and
// shears visibly whenever the camera rotates.
//
// SCREEN SPACE, NOT WORLD SPACE. The panel tracks the hull's position but never its
// rotation: text that rolls over with the camera is unreadable exactly when you are busiest.
// A single unlabelled number, so the box is only as big as it. 34 keeps it clear of the
// transom and its wake without drifting off into water the eye is not already on.
const BI_W = 52, BI_H = 24, BI_DROP = 34;
// Panel colours track the HUD's own (slate-900/60 body, slate-400/30 rim) so this reads as
// the same instrument family as the panels it was moved out of.
const BI_BG = 'rgba(15,23,42,0.62)';
const BI_RIM = 'rgba(148,163,184,0.30)';

// Everything the panel shows, in one place, because two of these numbers are not the raw
// quantity they look like.
function boatInstrumentData(player) {
    const w = getWindAt(player.x, player.y);
    // ⚠️ SOG, NOT BOAT SPEED, and on a tidal venue they are different numbers. `boat.speed`
    // is speed through the WATER — what a log reads — and it says nothing about whether the
    // stream is carrying you or holding you. `boat.velocity` is already the ground vector:
    // the physics adds the current and the swell drift into it and deliberately keeps them
    // out of `boat.speed` (see the note there — "the log reads the same while the sea
    // carries you sideways"). So the honest speed over ground is just its magnitude, and it
    // picks up every set and drift for free rather than re-deriving them here.
    const v = player.velocity || { x: 0, y: 0 };
    const sog = Math.hypot(v.x, v.y) * 4;
    const twa = Math.round(Math.abs(normalizeAngle(player.heading - w.direction)) * (180 / Math.PI));
    // TWS colour, carried over from the retired rose: MORE OR LESS PRESSURE THAN NORMAL FOR
    // THIS COURSE, against the course's own p10/p90 rather than a single centroid sample.
    // Dirty air outranks the field — the number is down because of the boat in front, which
    // is a thing to sail out of rather than a patch of water to look for.
    const P = state.wind.pressure;
    const refMed = P ? P.med : state.wind.speed;
    const refLo = P ? P.lo : refMed - 0.1;
    const refHi = P ? P.hi : refMed + 0.1;
    const badAir = player.badAirIntensity > 0.05;
    const eff = w.speed * (1.0 - player.badAirIntensity);
    let twsCol = '#ffffff';
    if (badAir) twsCol = '#fda4af';
    else if (eff > refHi) twsCol = '#6ee7b7';
    else if (eff < refLo) twsCol = '#fda4af';
    let sogCol = '#ffffff';
    if (player.raceState.penalty || badAir) sogCol = '#f87171';
    else if (player.raceState.isPlaning) sogCol = '#67e8f9';
    const surf = window.Swell && window.Swell.active() ? window.Swell.hud(player) : null;
    // VMG off the GROUND vector too, not through the water — otherwise the rose would show
    // an SOG that includes the tide beside a VMG that ignores it, which is the disagreement
    // this whole refactor exists to prevent. Projected on the wind axis, same convention the
    // physics uses (heading and wind both point the way they are going).
    const vmg = Math.abs(v.x * Math.sin(w.direction) - v.y * Math.cos(w.direction)) * 4;
    return {
        sog, vmg, tws: w.speed, twa, twsCol, sogCol, badAir,
        planing: !!player.raceState.isPlaning,
        surfing: !!(surf && surf.surfing)
    };
}

// ── THE ROSE, WHEN IT IS THE CHOSEN FACE ────────────────────────────────────
// The corner dial, driven from boatInstrumentData — the SAME function the boat panel reads.
// The two faces show one set of numbers computed once, so they cannot drift apart, and it is
// how the rose's speed became SOG without a second definition of SOG existing anywhere.
//
// Transforms run every frame (they track the camera and would judder at 6 Hz); the text runs
// at 6 Hz, as it always did, because a digit flickering at 60 Hz is unreadable.
function roseCue(id, cls, text, on) {
    let el = document.getElementById(id);
    if (!el && UI.speed && UI.speed.parentElement) {
        el = document.createElement('div');
        el.id = id;
        el.className = cls;
        el.textContent = text;
        UI.speed.parentElement.style.position = 'relative';
        UI.speed.parentElement.appendChild(el);
    }
    if (el) el.classList.toggle('hidden', !on);
}

function updateRoseHud(player, localWind) {
    if (UI.compassRose) UI.compassRose.style.transform = `rotate(${-state.camera.rotation}rad)`;
    if (UI.windArrow) UI.windArrow.style.transform = `rotate(${localWind.direction}rad)`;
    if (UI.waypointArrow) UI.waypointArrow.style.transform = `rotate(${player.raceState.nextWaypoint.angle}rad)`;
    if (UI.headingArrow) UI.headingArrow.style.transform = `rotate(${player.heading - state.camera.rotation}rad)`;
    if (frameCount % 10 !== 0) return;
    const d = boatInstruments(player);
    // style.color rather than swapping Tailwind classes: the colour is already decided as a
    // hex by boatInstrumentData, and a class list that has to be scrubbed before every write
    // is how the old block grew a six-name remove() call.
    if (UI.speed) { UI.speed.textContent = d.sog.toFixed(1); UI.speed.style.color = d.sogCol; }
    if (UI.vmg) UI.vmg.textContent = d.vmg.toFixed(1);
    if (UI.windSpeed) { UI.windSpeed.textContent = d.tws.toFixed(1) + (d.badAir ? ' \u2193' : ''); UI.windSpeed.style.color = d.twsCol; }
    if (UI.windAngle) UI.windAngle.textContent = `${d.twa}\u00b0`;
    roseCue('hud-planing-label', 'absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] font-black tracking-widest text-cyan-400 hidden', 'PLANING', d.planing);
    roseCue('hud-surfing-label', 'absolute -top-9 left-1/2 transform -translate-x-1/2 text-[10px] font-black tracking-widest text-amber-300 hidden', 'SURFING', d.surfing);
}

// Show the chosen face and hide the others. The chart moves rather than being toggled: it is
// the one panel you look AT rather than through, so it takes the corner whenever the rose is
// not there and drops below it when it is.
function hudShowsBoat() { const m = settings.hudMode || 'boat'; return m === 'boat' || m === 'both'; }
function hudShowsRose() { const m = settings.hudMode || 'boat'; return m === 'rose' || m === 'both'; }

function applyHudMode() {
    const m = settings.hudMode || 'boat';
    if (UI.hudRose) UI.hudRose.classList.toggle('hidden', !hudShowsRose());
    if (UI.minimapWrap) UI.minimapWrap.classList.toggle('mt-4', hudShowsRose());
}

// ⚠️ ONE SAMPLE, SHARED BY BOTH FACES, AT SIX HZ. Two things forced this. In 'both' mode
// the panel and the rose are on screen together, and they were reading the same quantity at
// different instants — 1.7 under the boat beside 1.9 in the corner, which looks exactly like
// a bug in one of them. And a speed digit recomputed at 60 Hz churns its tenths continuously;
// the rose has always written text at 6 Hz for that reason, so this is the panel adopting the
// rose's cadence rather than the rose being dragged up to the panel's.
//
// Only the NUMBERS are held. The panel's position still tracks the hull every frame — that
// has to be smooth, and it is not what the eye is trying to read.
let _biCache = null, _biBucket = -1, _biWho = null;
function boatInstruments(player) {
    const bucket = Math.floor(frameCount / 10);
    if (_biCache && _biBucket === bucket && _biWho === player) return _biCache;
    _biBucket = bucket; _biWho = player;
    _biCache = boatInstrumentData(player);
    return _biCache;
}

function drawBoatInstruments(ctx, player) {
    if (!hudShowsBoat()) return;
    if (!player || !player.raceState) return;
    if (player.raceState.finished) return;              // nothing left to sail by
    const rot = -state.camera.rotation;
    const dx = player.x - state.camera.x, dy = player.y - state.camera.y;
    const sx = canvas.width / 2 + dx * Math.cos(rot) - dy * Math.sin(rot);
    const sy = canvas.height / 2 + dx * Math.sin(rot) + dy * Math.cos(rot);
    const top = sy + BI_DROP;
    const left = sx - BI_W / 2;
    const d = boatInstruments(player);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(left, top, BI_W, BI_H, 7);
    ctx.fillStyle = BI_BG;
    ctx.fill();
    ctx.strokeStyle = BI_RIM;
    ctx.lineWidth = 1;
    ctx.stroke();

    // ⚠️ ONE NUMBER, AND NO LABEL. This panel sits ON the boat, in the water you are looking
    // at, so every glyph is bought with attention and with pixels of the racecourse. TWA is
    // the one that steers the boat continuously — it is what you trim and what you tack on —
    // and it is the reading that has to be there in peripheral vision. SOG and TWS are
    // consulted rather than watched, and they live on the rose for players who want them.
    //
    // A label would say what a single number already says by being the only one, and it cost
    // as much height again as the number. Same for the dirty-air arrow (an annotation on TWS,
    // meaningless beside a heading angle) and for PLANING and SURFING: those are LATCHED
    // states, so as text they sat lit for seconds at a time, and a caption that is often on
    // stops being read at all.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.font = FONT.mono(15);
    ctx.fillStyle = '#bfdbfe';
    ctx.fillText(d.twa + '°', sx, top + BI_H / 2 + 0.5);
    ctx.restore();
}

// Screen-space snowfall (Arctic): soft flakes drifting down with a light wind
// slant and a per-flake flutter. Own seeded PRNG (`snowRand`) — never
// Math.random (would desync the eval RNG stream). Draw-side only: nothing in
// the sim reads or depends on it.
let SNOW = null;
let SNOW_SPRITE = null;
// One soft radial blob, baked once and drawImage'd per flake — fuzzy edges
// without paying for per-flake gradients or shadowBlur.
function snowFlakeSprite() {
    if (SNOW_SPRITE) return SNOW_SPRITE;
    const s = 32, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    SNOW_SPRITE = c;
    return c;
}
function drawSnowOverlay(ctx) {
    if (!state.race.venueFx || !state.race.venueFx.snowfall) { SNOW = null; return; }
    const w = ctx.canvas.width, h = ctx.canvas.height;

    // draw() has no dt; derive one (clamped so tab-switches don't teleport flakes)
    const now = performance.now();
    const dt = SNOW ? Math.min(0.05, Math.max(0, (now - SNOW.t) / 1000)) : 1 / 60;

    if (!SNOW || SNOW.w !== w || SNOW.h !== h) {
        SNOW = { w, h, t: now, flakes: [] };
        for (let i = 0; i < 160; i++) {
            SNOW.flakes.push({
                x: snowRand() * w, y: snowRand() * h,
                spd: 35 + snowRand() * 55,           // px/sec fall — snow floats, rain doesn't
                size: 3 + snowRand() * 6,            // sprite draw size, px
                sway: snowRand() * Math.PI * 2,      // flutter phase
                flut: 0.8 + snowRand() * 1.6,        // flutter frequency
                amp: 8 + snowRand() * 18,            // flutter amplitude, px/sec
                depth: 0.4 + snowRand() * 0.6        // parallax-ish alpha/speed/size tier
            });
        }
    }

    SNOW.t = now;
    const spr = snowFlakeSprite();
    const slant = 0.18; // gentle wind drift — a steeper diagonal reads as sleet
    ctx.save();
    for (const f of SNOW.flakes) {
        f.y += f.spd * f.depth * dt;
        f.x += (f.spd * slant * f.depth + Math.cos(state.time * f.flut + f.sway) * f.amp) * dt;
        if (f.y > h + 8) { f.y = -8; f.x = snowRand() * w; }
        if (f.x > w + 8) f.x = -8;
        else if (f.x < -8) f.x = w + 8;

        const d = f.size * (0.6 + f.depth);
        ctx.globalAlpha = 0.45 + f.depth * 0.45;
        ctx.drawImage(spr, f.x - d / 2, f.y - d / 2, d, d);
    }
    ctx.restore();
}

function draw() {
    frameCount++;

    // Draw Water Background (Screen Space)
    drawWater(ctx);

    const player = state.boats[0];
    if (!player) return;

    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.rotate(-state.camera.rotation);
    ctx.translate(-state.camera.x, -state.camera.y);

    // all lay over a submerged animal, which is most of what sells the depth.

    // SHOALS BEFORE THE SWELL — the only thing in the world that is genuinely BELOW the
    // surface, so it is the only thing the surface layers are allowed to run across. See
    // drawShoals. Painted shallows go first of all: a shoal inside a lagoon is still a
    // bar, so its sand draws over the zone's tint.
    updateDriftingProps(performance.now());
    updateJellyDrifts(performance.now());
    // Moonlight lies ON the water, under the waves, the wakes and the fleet.
    drawNightWater(ctx);
    // Shallows, shoals, bottom vegetation, reefs and the seabed props — in that stacking
    // order (grass grows ON the bar, the reef mass sits over sand and weed, a coral head
    // placed on a reef draws over it) — all come out of one cached world-anchored
    // composite: static content that was five full-screen passes a frame. See
    // drawSeabedUnderlay. Every layer of the moving surface runs across it all.
    drawSeabedUnderlay(ctx);
    // Jellyfish bodies ride with the seabed layer so the water draws over them — that is
    // what sells the depth they are rising and falling through. Their light comes later.
    drawJellyDrifts(ctx);

    // SWELL FIRST, under everything else on the water. It is the shape of the sea itself —
    // the biggest, slowest structure there is — so the wakes, the cat's-paws and the
    // wind-wave crests all ride ON it. Drawing it over them would read as a decal.
    if (window.Swell) window.Swell.draw(ctx, state);

    // Rapids whitewater: a texture ON the water, so over the swell shape and under the
    // wakes — a boat's wash is disturbed water on top of whatever the river is doing.
    drawRapidsFoam(ctx);

    drawWakes(ctx);
    // On the water with the fleet's wakes and under everything else, which is where a wake
    // belongs. Separate from drawWakes because it shares none of its machinery: no trail,
    // no per-frame sampling, and a shape the boat ribbon does not have.
    drawTrafficWakes(ctx);
    drawParticles(ctx, 'surface');
    drawGusts(ctx);
    drawWindWaves(ctx);
    // OVER the wind-wave crests, because a whitecap is one of those crests breaking, and
    // over the cat's-paw tints, because foam floats on whatever colour the water is. Still
    // UNDER the fleet: the hull silhouette stays clean (race-view.md §7).
    if (window.SeaFX) window.SeaFX.draw(ctx, state);

    // ...but a fin cutting the surface and the bubbles behind it are ON the
    // water, so they go over the crests the body sits beneath.
    // drawIslandShadows(ctx);
    drawParticles(ctx, 'current');
    // The nav aids used to draw HERE, and they now draw over the floating stratum instead —
    // see the block after drawPropWash for why.
    // ── Everything physical, in ONE pass, in document order ─────────────────
    // It used to be two passes with three layers wedged between them — all land, then
    // disturbed air, the boundary and brash, then all floes. That put every floe in front
    // of every landmass by construction, so a floe could not be tucked behind a headland
    // however the venue was authored, and it left land and ice disagreeing about whether
    // the boundary line was drawn over them.
    //
    // So: paint on the water first (the nav aids above), then the sailing limit over all of
    // it, then the wind shadow and the shapes in the order the document stacks them.
    //
    // THE LIMIT SITS ON TOP OF THE WATER AND UNDER THE WORLD. Everything painted ON the
    // surface — wakes, gusts, wind waves, the gate line, the ladder rungs, the laylines —
    // passes beneath it, because they are all marks on the same water and the limit is the
    // one that says where the water ends. Everything that stands IN the water — the wind
    // shadow, the land, the marks, the boats — passes over it, because a band of club
    // branding running across a coastline is exactly what it used to look like.
    drawBoundary(ctx);

    // FLOATING PROPS — on the water, behind the land. Placed here and nowhere else, and the
    // two neighbours are both load-bearing:
    //   after drawBoundary, because a pad is a thing floating IN the water rather than a mark
    //   painted ON it, and the limit's own rule is that what stands in the water passes over
    //   it (the wind shadow, the land, the marks and the fleet all do);
    //   before drawIslands, which is what actually keeps water objects off the land — the
    //   bank paints over whatever part of a cluster laps onto it, for free.
    // Everything the water does (swell, wakes, gusts, wind waves) is already finished above,
    // so nothing ripples across a pad that is floating on top of it.
    //
    // FLOATING WEED SHARES THIS SLOT, and that is the point of putting them together: a lily
    // bed and a cluster of pad SPRITES are the same substance answering to the same rule, so
    // they belong in one stratum rather than two. Everything the water does — the swell, the
    // wakes, the cat's-paws, the wind waves — is finished above, so a wake never runs across a
    // mat and say it was painted on the surface rather than floating on it. The bed draws
    // first and the props over it, because a placed cluster sits on top of the bed it is part
    // of.
    //
    // ⚠️ THE WEED USED TO DRAW AFTER THE LAND, ON PURPOSE, and this reverses it. The old
    // reasoning was that weed piles up against a bank and laps onto the mud, so a hard
    // coastline cutting a mat off is the wrong picture. That is true of the mat's EDGE and
    // false of everything behind it: what it actually produced was lily pads floating in the
    // middle of a dry mud bank, several pad-widths inland, which is a worse picture than a
    // trimmed one and reads as a bug rather than as weed. A water plant is not on land, so
    // the coastline trims it — the same rule the float props follow, by the same mechanism,
    // costing nothing. If the hard trim ever needs softening, the fix is the mat's own edge
    // ramp (bakeVegSprite already feathers on distance-to-edge), NOT drawing it over the land.
    // Surface vegetation and float props come out of one cached world tile (they are
    // static; only drifting flotsam draws live, over the beds) — see
    // drawFloatStratumCached. The stacking inside the stratum is unchanged: bed first,
    // props over it.
    drawFloatStratumCached(ctx);
    // The lap at the foot of anything standing IN the water. Here rather than beside the
    // trunk sprite for the same reason the float props are here: it is a mark on the WATER,
    // so the land has to be able to cover it — a trunk set back on a bank gets no waterline,
    // which is correct and free. The sprite it belongs to draws later, on `surface`, over it.
    drawPropWash(ctx);

    // ── THE COURSE'S OWN GEOMETRY, OVER EVERYTHING FLOATING ON THE WATER ────
    // Start/finish line, ladder rungs, laylines, mark zones, rounding arrows.
    //
    // These are not scenery. They are the only thing on screen saying where the course IS,
    // and a player who cannot see the start line cannot start. So they sit above every
    // floating thing: a lily bed, a hyacinth mat, a raft of pad sprites.
    //
    // ⚠️ THEY MOVED DOWN FROM ABOVE drawBoundary, and what moved them is the floating
    // stratum that now sits between. Weed and float props draw AFTER the limit — a pad is a
    // thing in the water rather than a mark painted on it — so nav aids left in their old
    // slot were painted over by every bed they crossed, and on Gatorgrass Bayou the start
    // line disappeared under a raft.
    //
    // STILL UNDER THE LAND, which was the original reason they sat early: drawn after
    // drawIslands they ran across the coastline, and a layline over a headland says you can
    // sail there. Land is the one thing that must occlude them, and it still does — that is
    // the whole distinction, and it is not arbitrary. Nav aids go OVER what you can sail
    // through (weed, bars, painted zones) and UNDER what you cannot (land).
    //
    // WHAT THIS REVERSES, stated plainly: the limit's own rule that "everything painted on
    // the surface — the gate line, the ladder rungs, the laylines — passes beneath it". They
    // now pass OVER it. Deliberate, and the same trade as the weed: a start line erased by a
    // band of club branding is no better than one erased by a lily pad, the limit is a
    // static edge while these are what you steer by, and the overlap is peripheral anyway —
    // the limit is at the arena rim and only a long layline ever reaches it.
    //
    // Gate line, ladder rungs and laylines are all derived from a windward GATE and mean
    // nothing on an island rounding, so they are skipped there.
    drawActiveGateLine(ctx);
    // Ladder rungs measure progress up a windward leg and have no meaning on a
    // single island rounding. The start/finish line and the laylines do, so they
    // stay — skipping drawActiveGateLine took the start line with it.
    if (state.course.type !== 'islandRound') drawLadderLines(ctx);
    drawLayLines(ctx);
    drawMarkZones(ctx);
    drawRoundingArrows(ctx);

    drawDisturbedAir(ctx);
    // Cached world tile on floe-free courses; the arctic (floes drift, spin, and may be
    // authored behind headlands) draws live in document order as before.
    drawIslandsCached(ctx);
    // Surf sits ON the shore, so it goes over the land and under the air layer.
    drawSurf(ctx);
    // Surface props: over the land they stand on, under everything that races. This is the
    // plane for a thing the GROUND holds up — a trunk, a beached log — as against `float`
    // above, which is for a thing the WATER holds up and which the land therefore covers.
    // Cached world tile; drifters draw live — see drawSurfacePropsCached.
    drawSurfacePropsCached(ctx);
    drawTraffic(ctx);
    drawMarkShadows(ctx);
    drawMarkBodies(ctx);
    drawRulesOverlay(ctx);

    // Draw All Boats (viewport cull: mid-race most of the fleet is off-screen)
    const boatViewR = Math.sqrt(canvas.width ** 2 + canvas.height ** 2) * 0.6 + 90;
    const boatViewR2 = boatViewR * boatViewR;
    for (const boat of state.boats) {
        const bdx = boat.x - state.camera.x, bdy = boat.y - state.camera.y;
        if (bdx * bdx + bdy * bdy > boatViewR2) continue;
        ctx.save();
        ctx.translate(boat.x, boat.y);
        ctx.rotate(boat.heading);
        // RIDING THE SWELL, as parallax. A hull on a crest is nearer the camera than one in a
        // trough. Strictly this is a couple of percent of scale from a realistic camera
        // height — and a couple of percent turned out to be invisible. Pushed to 7.5%, which
        // reads as a fleet heaving over a big sea and gives you the lift under the bow as you
        // climb one. Picture only; the physics never reads it. No-op off the ocean.
        if (window.Swell && window.Swell.active()) {
            const s = 1 + window.Swell.lift(boat.x, boat.y) * 0.075;
            ctx.scale(s, s);
        }
        drawBoat(ctx, boat);
        ctx.restore();
    }

    // Canopy props: the crowns a hull sails beneath, so they go over the fleet — and
    // under the air layer, because a wind comet passes over a treetop too. Split by
    // what can fade: on-land crowns from a cached world tile, over-water crowns live.
    drawCanopyCached(ctx);

    // Spindrift is AIR — wind-torn snow streaming off the ice, so it passes over hulls
    // and sails like the comets do (owner's call: over the boats). Gated on
    // fx.spindrift inside the layer; a no-op everywhere else. See icefx.js.
    if (window.IceFX) window.IceFX.draw(ctx, state);

    // The cloud is ABOVE the world, so its shadow falls on everything under it — water,
    // sand, palms, hulls alike. Drawing it at the surface layer left islands and props
    // standing in sunlight inside a squall, which read as a hole in the weather. It is
    // still the physics ellipse exactly: the darkened world is the changed wind.
    drawSquallShadows(ctx);
    // Rain falls past the camera: a boat in a squall is a boat seen through it.
    drawSquallRain(ctx);

    // Wind comets are air, not water — they pass over hulls and sails, not under them.
    drawParticles(ctx, 'air');

    // ── THE LIGHT COMES DOWN, THEN WHAT MAKES ITS OWN GOES BACK UP ──────────
    // Placed here, after the last PHYSICAL layer and before the indicators: everything in
    // the world dims together, and the HUD-ish overlays that follow stay legible. No-op on
    // every venue that authors no `palette.night`.
    drawNightWash(ctx);
    drawJellyGlow(ctx);
    drawNightGlow(ctx);

    // Draw Indicators
    for (const boat of state.boats) {
        if (boat.opacity === undefined || boat.opacity > 0.1) {
             ctx.save();
             if (boat.opacity !== undefined) ctx.globalAlpha = boat.opacity;
             drawBoatIndicator(ctx, boat);
             ctx.restore();
        }
    }

    drawDebugWorld(ctx);

    ctx.restore();

    // Screen-space weather (Arctic snowfall) — over the world, under the UI
    drawSnowOverlay(ctx);

    // Camera Message
    if (state.camera.messageTimer > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1.0, state.camera.messageTimer*2);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
        ctx.font = FONT.label(28); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const txt = "CAMERA: " + state.camera.message;
        ctx.fillText(txt, canvas.width/2, canvas.height/3);
        ctx.restore();
    }

    // Edge indicators: next mark(s) and nearby competitors.
    if (state.race.status !== 'finished') {
        const m = 40, hw = Math.max(10, canvas.width/2-m), hh = Math.max(10, canvas.height/2-m);
        const rot = -state.camera.rotation;
        // THE HUD SITS ON TOP OF THE CANVAS, and that is fine: indicators track
        // the edge band honestly and pass under the panels. The instruments
        // (top right) are translucent, so an indicator sliding behind them stays
        // readable; the leaderboard is near-opaque, so IT is the one that yields —
        // it sits inset from the left edge (see index.html) leaving the band
        // clear. No dodging: every scheme that slid indicators around the panels
        // flickered, because near a corner the choice of escape side is unstable.
        // Project a world point into screen space, clamped to the screen edge band.
        const toScreen = (wx, wy) => {
            const dx = wx - state.camera.x, dy = wy - state.camera.y;
            const rx = dx*Math.cos(rot) - dy*Math.sin(rot);
            const ry = dx*Math.sin(rot) + dy*Math.cos(rot);
            let t = 1.0;
            if (Math.abs(rx)>0.1 || Math.abs(ry)>0.1) t = Math.min(hw/Math.abs(rx), hh/Math.abs(ry));
            const f = Math.min(t, 1.0);
            return { x: canvas.width/2 + rx*f, y: canvas.height/2 + ry*f, onScreen: t >= 1.0 };
        };

        if (state.showNavAids) {
            const leg = player.raceState.leg;
            const marks = state.course.marks;
            // ROUTE-DRIVEN, not shape-guessed. The old split ("gate legs if the course has
            // four marks, otherwise the single waypoint") left every ROUNDING leg with no
            // indicator at all — legMarks() is null there — and gave the start and finish
            // lines a single pip at the nearest point instead of one per end.
            const e = routeLeg(Math.min(leg, state.race.totalLegs));
            if (e && e.kind === 'round' && e.mark) {
                // Rounding leg: point straight at the mark, whatever the path to it looks
                // like — the indicator answers "where is it", not "how do I get there".
                const rm = e.mark;
                const p = toScreen(rm.x, rm.y);
                // AN EDGE INDICATOR IS FOR THINGS OFF THE EDGE. Once the mark itself is
                // in view it is the better thing to look at.
                if (!p.onScreen) {
                    const d = Math.sqrt((rm.x-player.x)**2 + (rm.y-player.y)**2) * 0.2;
                    drawMarkEdgeIndicator(ctx, p.x, p.y, Math.round(d) + 'm', rm.side || null, rot);
                }
            } else if (e && e.marks && marks) {
                // A line or a gate: BOTH ends get an indicator — a line's whole span is
                // crossable, and which end you favour is a tactical choice the display
                // should not make for you. Mid-race gate marks also carry the mini
                // rounding-direction arc; the start and finish ends do not.
                const isGate = e.kind === 'gate' && !e.finish && leg > 0 && leg < state.race.totalLegs;
                for (const idx of e.marks) {
                    const mk = marks[idx];
                    if (!mk) continue;
                    const p = toScreen(mk.x, mk.y);
                    if (p.onScreen) continue;
                    const d = Math.sqrt((mk.x-player.x)**2 + (mk.y-player.y)**2) * 0.2;
                    drawMarkEdgeIndicator(ctx, p.x, p.y, Math.round(d) + 'm', isGate ? idx : null, rot);
                }
            } else {
                // No route entry to read (defensive): the single waypoint pip, as before.
                const wp = player.raceState.nextWaypoint;
                const p = toScreen(wp.x, wp.y);
                if (!p.onScreen) drawMarkEdgeIndicator(ctx, p.x, p.y, Math.round(wp.dist) + 'm', null, rot);
            }
        }

        // Competitors: off-screen but close-ish. On-screen boats already carry
        // name tags; distant boats live on the minimap.
        const NPC_EDGE_RANGE = 1500; // world units (~300 m)
        for (const boat of state.boats) {
            if (boat.isPlayer) continue;
            if (boat.opacity !== undefined && boat.opacity <= 0.1) continue;
            const bdx = boat.x - player.x, bdy = boat.y - player.y;
            if (bdx*bdx + bdy*bdy > NPC_EDGE_RANGE*NPC_EDGE_RANGE) continue;
            const p = toScreen(boat.x, boat.y);
            if (p.onScreen) continue;
            drawNpcEdgeIndicator(ctx, p.x, p.y, boat);
        }
    }

    drawBoatInstruments(ctx, player);
    drawMinimap();
    drawWindDebug(ctx);

    // UI Updates (Player Data)
    const localWind = getWindAt(player.x, player.y);

    if (hudShowsRose()) updateRoseHud(player, localWind);


    // OCS banner: persistent while the flag is up (the transient race message is
    // easy to miss, and a correct OCS hold then reads as a missed crossing). The
    // arrow tracks the nearest point of the start line every frame so it stays
    // honest under camera rotation.
    if (UI.ocsBanner) {
        const ocsOn = state.race.status === 'racing' && player.raceState.ocs && !player.raceState.finished;
        UI.ocsBanner.classList.toggle('hidden', !ocsOn);
        if (ocsOn && UI.ocsArrow) {
            try {
                const [mo0, mo1] = startLinePts();
                const cl = getClosestPointOnSegment(player.x, player.y, mo0.x, mo0.y, mo1.x, mo1.y);
                const ang = Math.atan2(cl.x - player.x, -(cl.y - player.y));
                UI.ocsArrow.style.transform = `rotate(${ang - state.camera.rotation}rad)`;
            } catch (e) {}
        }
    }

    if (frameCount % 10 === 0) {
        updateLeaderboard();

        // Show when the player's boat is overpowered (>18kn effective wind costs speed,
        // scaled by heavyAir) — turns an invisible tax into a readable condition to sail
        // around. No venue gate any more: it asks the same question the physics asks, which
        // is whether THIS boat is in too much breeze right now, so it lights up wherever
        // that is true rather than only in the Arctic.
        // Asks the SAME question the physics asks, which is now heel and not wind speed. On
        // the old true-wind test the badge lit for the whole of a windy race — including
        // dead downwind, where the boat is at her fastest and nothing is wrong — so it read
        // as "it is breezy" rather than "you are pressing too hard right now". Keyed on
        // heel it goes out the moment the player bears away, which is what makes it a cue
        // rather than a label.
        if (UI.overpoweredBadge) {
            const op = (player.heel || 0) > OVERPOWERED.heelThreshold
                && state.race.status === 'racing' && !player.raceState.finished;
            UI.overpoweredBadge.classList.toggle('hidden', !op);
        }

        // The speed / VMG / TWS / TWA readouts and their PLANING and SURFING labels used to
        // be written into the wind rose here. The rose is gone and all of it now draws on the
        // canvas under the player's boat — see drawBoatInstruments. The logic went with it
        // rather than being dropped: SOG's planing and penalty colours, the TWS pressure
        // comparison against the course's own p10/p90, and the dirty-air arrow are all in
        // boatInstrumentData. VMG is the one number that did not survive the move.
        if (UI.timer) {
            let displayTime = state.race.timer;
            let timerClass = 'text-white';

            if (state.race.status === 'prestart') {
                displayTime = -state.race.timer;
                if (state.race.timer < 10) timerClass = 'text-orange-400';
            } else if (player.raceState.finished) {
                displayTime = player.raceState.finishTime;
                timerClass = 'text-green-400';
            } else if (state.race.status === 'finished') {
                timerClass = 'text-green-400';
            }

            UI.timer.textContent = formatTime(displayTime);
            UI.timer.className = `t-mono text-4xl tracking-widest drop-shadow-md ${timerClass}`;
        }

        if (UI.startTime) {
            if (player.raceState.legSplitTimer > 0) {
                UI.startTime.textContent = formatSplitTime(player.raceState.lastLegDuration);
                UI.startTime.classList.remove('hidden');
            } else if (player.raceState.startTimeDisplayTimer > 0) {
                UI.startTime.textContent = '+' + player.raceState.startTimeDisplay.toFixed(3) + 's';
                UI.startTime.classList.remove('hidden');
            } else {
                UI.startTime.classList.add('hidden');
            }
        }

        if (UI.legInfo) {
             const vn = venueDisplayName(settings.venue);
             UI.legInfo.textContent = vn ? vn.toUpperCase() : "";
        }

        if (UI.legTimes) {
            // legTimes is its own positioned container now, so it no longer inherits
            // the venue caption's hidden state — it has to gate on 'waiting' itself
            // or stale splits would show over the venue picker.
            const legTimesHidden = state.race.status === 'prestart' || state.race.status === 'waiting';
            UI.legTimes.classList.toggle('hidden', legTimesHidden);
            if (!legTimesHidden) {
                 let html = "";
                 const getMoves = (i) => player.raceState.legManeuvers[i] || 0;
                 const getDist = (i) => Math.round(player.raceState.legDistances[i] || 0);
                 const getTop = (i) => (player.raceState.legTopSpeeds[i] || 0).toFixed(1);

                 // Split times are for the player; Top/Dist/Moves is telemetry
                 // and reads as dev output on screen, so it rides F8 debug.
                 const tele = (i) => settings.debugMode
                     ? ` <span class="t-mono text-slate-500" style="font-size:10px;">Top:${getTop(i)}kn Dist:${getDist(i)}m Moves:${getMoves(i)}</span>`
                     : '';
                 const CHIP = 'bg-slate-900/60 px-2 py-0.5 rounded border-r-2 border-slate-500 shadow-md flex justify-between gap-4';

                 if (player.raceState.startLegDuration !== null) {
                     html += `<div class="${CHIP}"><span class="t-mono text-slate-300" style="font-size:11px;">Start ${formatSplitTime(player.raceState.startLegDuration)}</span>${tele(0)}</div>`;
                 }
                 player.raceState.legTimes.forEach((t, i) => {
                     html += `<div class="${CHIP}"><span class="t-mono text-slate-300" style="font-size:11px;">Leg ${i+1} ${formatSplitTime(t)}</span>${tele(i+1)}</div>`;
                 });
                 if ((state.race.status==='racing' || state.race.status==='prestart') && player.raceState.leg <= state.race.totalLegs) {
                     const cur = player.raceState.leg;
                     const t = (cur===0) ? state.race.timer : (state.race.timer - player.raceState.legStartTime);
                     const lbl = (cur===0) ? "Start" : `Leg ${cur}`;
                     const teleCur = settings.debugMode
                         ? ` <span class="t-mono text-white/50" style="font-size:10px;">Top:${getTop(cur)}kn Dist:${getDist(cur)}m Moves:${getMoves(cur)}</span>`
                         : '';
                     html += `<div class="bg-slate-900/80 px-2 py-0.5 rounded border-r-2 border-green-500 shadow-md flex justify-between gap-4"><span class="t-mono text-white" style="font-size:11px;">${lbl} ${formatSplitTime(t)}</span>${teleCur}</div>`;
                 }
                 UI.legTimes.innerHTML = html;
            }
        }
    }
}

let lastTime = 0;
function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (!state.paused) {
        let iterations = 1;
        if (UI.resultsOverlay && !UI.resultsOverlay.classList.contains('hidden')) {
            iterations = 10;
        }

        const step = Math.min(dt, 0.1) * (state.gameSpeed || 1.0);
        // ⚠️ A SLOW FRAME IS SUB-STEPPED, NOT SWALLOWED WHOLE. This used to hand the entire
        // catch-up to one update() call, so a 100 ms hitch integrated 100 ms of physics in a
        // single step: at 15 knots that is 22 units of travel applied at once, which reads as
        // the boat TELEPORTING rather than as a dropped frame, and it is why a render stall
        // was reported as "the game jumps" rather than "the game stutters". Every rate in the
        // sim — turn authority, acceleration, the swell's forcing, collision separation — is
        // integrated once per call, so one huge call is also less accurate than several small
        // ones covering the same span.
        //
        // Capped at SUB_MAX so a hitch cannot multiply itself into a death spiral: past that
        // the world runs slightly slow for a frame instead of trying to catch up, which is
        // the better failure. update() measures ~1 ms (eval/_ocean_perf.js: p50 0.9, max 4.5),
        // so four of them is affordable where the alternative is a visible jump.
        //
        // ⚠️ NO-OP AT A HEALTHY FRAME RATE, and that is load-bearing: at dt = 1/60 the ceil
        // gives exactly one sub-step of exactly `step`, so this is bit-identical to what it
        // replaced. The eval harness drives update(1/60) directly and never reaches this
        // function at all, so no recorded race moves.
        const SUB_DT = 1 / 60, SUB_MAX = 4;
        const subs = Math.min(SUB_MAX, Math.max(1, Math.ceil(step / SUB_DT)));
        const sub = step / subs;
        for (let i = 0; i < iterations * subs; i++) {
            update(sub);
        }
        draw();
    }
    requestAnimationFrame(loop);
}

const ISLAND_STYLES = {
    // Sand body measured off aerial beach reference, not picked: the mean of the dry
    // sand in the Varkala plate (p5-p95 #cdb79f..#ecd6b7). The old #fde6b1 was a
    // buttery yellow no beach is. It is ALSO the sand tile's own mean, deliberately —
    // with base and tile equal, LAND_TEXTURES' alpha scales contrast without moving
    // colour, so the mean-luma shift the arctic textures have to warn about cannot
    // happen here.
    tropical: { body: '#ddc39a', stroke: '#b89b78', veg: '#84cc16', rock: '#9ca3af', trees: true },
    // Caribbean coral sand — the `tropicsand` kind's look, markedly whiter and cooler
    // than `tropical`'s tan. Body is the lagoon-coralsand texture's SPEC mean (#efe6d5);
    // when that tile is delivered, reset it to the DELIVERED tile's own mean, the same
    // base-equals-tile-mean move bay-sand made, so LAND_TEXTURES' alpha stays a pure
    // contrast knob. Palms belong on it, hence trees: true.
    // Colour-matched to the lagoon reference plate (2026-08-08): warm cream rather than
    // the near-white first spec, and the stroke pulled CLOSE to the body on purpose —
    // the reference beaches melt into their bars, so the coastline line stays quiet and
    // the tone ladder (ocean -> lagoon -> bar -> sand) does the separating.
    coralsand: { body: '#efe4cf', stroke: '#ddd0ad', veg: '#84cc16', rock: '#9ca3af', trees: true },   // body = coralsand tile mean
    // ── BLUEWATER BONANZA'S TWO NEW GROUNDS ─────────────────────────────────
    // Coral limestone — uplifted reef rock (makatea), the hard rim of a reef island. BOTH
    // TILES DELIVERED 2026-08-14, so both bodies below are now their DELIVERED tile's own
    // mean (the coralsand / bay-rock move) and both LAND_TEXTURES alphas are MEASURED. With
    // base equal to tile mean the blend cannot move the colour, only the spread around it,
    // so each alpha is a pure contrast knob. The other three tones on each row are the
    // spec's own offsets carried onto the delivered body, the bayou-mud precedent.
    //
    // THE ROCK'S BODY IS SQUEEZED BETWEEN TWO NEIGHBOURS AND THE IN-VENUE ONE WINS. It has
    // to separate from `coralsand` at race scale, because sand and reef rock share every
    // shoreline on this venue and the player reads them apart at speed: measured dE 22.4,
    // against the cove's accepted sand-vs-rock 23.9. Its nearest cross-venue neighbours are
    // `coastalrock` at 9.0 and `lane` at 10.4, and that is accepted on coastalrock's own
    // two-tier rule — cross-venue separation is a picker-swatch concern only, since neither
    // can ever be in the same race, and 19.2 was called fine there where 5.3 was not. The
    // `lane` collision is the most honest of the three: a crushed-shell village road IS
    // pulverised coral limestone, so the two materials genuinely are near neighbours.
    //
    // COOLER AND GREYER THAN coastalrock ON PURPOSE (hue 53 / sat 0.09 against 44 / 0.19).
    // Calcium carbonate is a neutral stone; the Cape's glacial rock is a warm grey-tan. That
    // is the axis the two are told apart on where they cannot be told apart by value.
    //
    // veg is a paler DRY STONE, not a green, and rock a darker dab of the same — the
    // granite/redrock/coastalrock convention for a look with nothing growing on it. No
    // trees: bare rock. The stroke carries coastalrock's own offsets onto this body (the
    // bayou-mud precedent), which lands an 18.2 L* drop against coastalrock's 18.6, so the
    // coastline holds the same weight and does not wash out.
    //
    // ⚠️ THE DELIVERY CAME BACK WARMER THAN SPECCED AND THE PICKER PAID FOR IT. Spec was a
    // NEUTRAL #ABA99B at hue 53; delivered is #A7A193 at hue 41.7, which is coastalrock's
    // own hue (44). In-venue that cost nothing and in fact GAINED — dE from `coralsand`, the
    // sand it shares every shoreline with, went 22.4 -> 24.8, now past the cove's accepted
    // sand-vs-rock 23.9. Cross-venue it went the other way: dE from `coastalrock` fell 9.0 ->
    // 6.1, close to the 5.3 that note calls a genuine collision. Accepted, because the two
    // can never be in the same race (bay vs ocean) so it is a picker-swatch concern only,
    // and because base-equals-delivered-mean is worth more than a tidier chip. The LABELS
    // now do all the work: 'Coral Limestone' against 'Coastal Rock'.
    //
    // THE DELIVERY CHECK THAT MISSED IT WAS WATCHING THE WRONG AXIS, and that is the
    // transferable bit. The manifest note said to reject if saturation went over ~0.14,
    // because that is how a neutral stone turns into a warm tan — delivered saturation is
    // 0.12 and sailed through, while the drift happened on HUE. Check both, or check hue.
    coralrock: { body: '#A7A193', stroke: '#757268', veg: '#BAB6A9', rock: '#878478', trees: false },  // body = ocean-coralrock DELIVERED tile mean
    // Tropic Scrub — the sun-dried sward of a small island's interior.
    //
    // ⚠️ THE BODY IS LIGHTER THAN EVERY CROWN TONE THE VENUE'S TREES ARE MADE OF, and that
    // is the constraint that picked it rather than any of the separations below. This is
    // what ocean-palm-coconut, ocean-pandanus and ocean-almond-tropical stand on, and a
    // ground sitting inside the crowns' value range makes three trees dissolve into their
    // own lawn. Measured: this body is L* 73.0 against the trees' lit tones at 74.3 / 66.0 /
    // 59.3 and their mid tones at 61.9 / 48.1 / 42.7, so every crown reads DARK against it.
    // Lighthouse Cove works the same way and is the precedent — ground L* 66.4 under crowns
    // at 59.7 and 46.1. Anyone darkening this row has to re-check it against those seven
    // numbers first; the obvious "lusher tropical green" is L* 56 and it fails.
    //
    // A FOURTH SWARD, AND IT IS THE LIGHTEST AND YELLOWEST OF THEM. dE 18.8 from
    // `coastalscrub`, 14.8 from `grass`, 36.2 from `swampgrass` — all cross-venue and so
    // picker-only, per coastalrock's two-tier rule. In-venue, which is what the player
    // actually reads, it is 60.5 from the sand it sits behind and 60.8 from the rock it
    // sits against.
    //
    // SUN-BLEACHED IS LIGHTER AND YELLOWER, NEVER GREYER, which is the cove's hardest-won
    // colour lesson applied ahead of time: coastalscrub's first answer cut saturation to
    // 0.54 to buy "sun-faded", landed with the CURED DEAD sward `swampgrass` (0.48) and read
    // army-olive. This holds chroma at 0.74 — above coastalscrub (0.62), below `grass`
    // (0.83) — and buys the fading with value instead. The olive the brief asks for lives in
    // the TILE's darker phase, not in the mean.
    //
    // `rock` is the venue's OWN stone rather than the generic #8a8a7a, so a scrub isle's
    // rock dabs are made of the same limestone as the shelf next door — coastalscrub's move,
    // and the same reason.
    //
    // DELIVERED #A9AF2A against a spec of #AABD31 — 4 L* darker and a little less yellow.
    // ⚠️ THE CROWN CONSTRAINT SURVIVES, AND CHECKING IT PROPERLY IS THE LESSON. Against the
    // spec HEX LIST the delivery looks like a failure: at L* 68.9 the ground is 5.3 DARKER
    // than the palm's lit frond tone (#94C701, L* 74.3), which the paragraph above forbids.
    // It is not a failure, because a lit tone is a HIGHLIGHT on a minority of a crown's
    // pixels and never what the crown reads as. Measured on the real sprites instead: the
    // shipped lagoon palms average L* 47.8 and 46.8, so this ground sits +21.2 above them —
    // in family with the cove, where bay-scrub at L* 66.3 sits +26.0 / +37.2 / +32.2 above
    // its own three trees. Compare crown MEANS to ground MEANS; a spec hex ladder is for
    // writing a prompt, not for judging one.
    tropicscrub: { body: '#A9AF2A', stroke: '#838621', veg: '#61711F', rock: '#A7A193', trees: true },  // body = ocean-scrub DELIVERED tile mean
    // Brightened 2026-08-08: `grass` is fresh MEADOW green now. The tan-olive it used
    // to be moved wholesale to `swampgrass` below — the bayou keeps its sun-cured look
    // (its docs were re-kinded), and everything else's grass isles read alive.
    grass:    { body: '#7aaa1d', stroke: '#5c8438', veg: '#4d7c0f', rock: '#8a8a7a', trees: true },   // body = grass tile mean
    swampgrass: { body: '#a09453', stroke: '#7d7048', veg: '#4d7c0f', rock: '#8a8a7a', trees: true },   // body = swampgrass tile mean
    // ── LIGHTHOUSE COVE'S TWO GROUNDS ───────────────────────────────────────
    // Coastal scrub upland. Body is the bay-scrub tile's SPEC mean; reset it to the DELIVERED
    // tile's own mean on ingest, per coralsand.
    //
    // DELIBERATELY NOT THE VENUE CARD'S TURF, and that is the decision worth recording.
    // Measured off bay.png across three separate headlands, the card's sunlit turf runs hue
    // 73-75 deg at saturation 0.92-0.99 — almost fully saturated yellow-green. Correct for a
    // 1254px illustration, wrong for a ground: this is the surface every boat, mark and prop
    // draws on top of, and the texture class exists to make it LOSE that contrast fight. So
    // the hue family is the card's (71 deg) and the value is lifted instead.
    //
    // ⚠️ CORRECTED 2026-08-10, AND THE FIRST ANSWER IS THE LESSON. It was #8ca24a: same hue,
    // saturation cut nearly in half to 0.54 to buy "sun-faded". That lands with `swampgrass`
    // (0.48), which is a CURED DEAD sward, and next to the card it read army-olive. Every
    // shipped land body that is meant to be alive holds its chroma — grass 0.83, redrock 0.75
    // — so cutting saturation is how a ground leaves the family, not how it gets weathered.
    // Sun-bleached grass is LIGHTER and YELLOWER, not greyer: this holds saturation at 0.62
    // and lifts L* from 63 to 71. Same mistake, same session, as the cedar's "grey-green",
    // and the cedar's note already states the rule — when a colour should read muted, move
    // along hue or value and say which way, because chroma is the one axis that kills it.
    //
    // A THIRD ANSWER, NOT A NUDGE OF EITHER EXISTING SWARD: dE 22.9 from `grass` (bright
    // meadow) and 18.2 from `swampgrass` (cured tan-olive). Against what it actually touches
    // in the cove it is far clearer — 35.1 from the sand, 40.6 from the rock below.
    //
    // `rock` is the cove's OWN rock colour rather than the generic #8a8a7a the other swards
    // use, so a scrub isle's rock dabs are made of the same stone as the headland next door.
    coastalscrub: { body: '#a3a745', stroke: '#7d7e3c', veg: '#5b693a', rock: '#a19481', trees: true },  // body = bay-scrub DELIVERED tile mean
    // Weathered coastal rock — rounded, salt-worn, grey-tan glacial stone.
    //
    // ⚠️ THE CARD MEAN WAS THE WRONG NUMBER, which is the transferable finding. Sampling the
    // card's three rock areas with water, foam and foliage masked gives #7d6f56 — and that
    // collides at dE 5.3 with the bayou's `mudflat` and 11.0 with `marsh`, two rows a
    // designer picks from the same list. The card mean is dragged dark and warm by the
    // shadow CREVICES between boulders, which are not what the material looks like; the
    // stone reads at the lit end. The spec was #9d9080; the tile landed at #a19481, 5.8 RGB
    // units warmer and lighter, and the BODY IS NOW THAT DELIVERED MEAN — with base equal to
    // tile mean the blend cannot move the colour, only the spread around it, so alpha is a
    // pure contrast knob and the mean-luma-shift the arctic textures warn about cannot
    // happen. The other three tones are the SPEC's own offsets carried onto the new body
    // rather than left where they were (the bayou-mud precedent), so the stroke keeps its
    // 50/47/43 drop and the coastline does not wash out.
    //
    // ALPHA 0.35 KEPT, and now measured rather than pre-registered: the delivered tile has
    // luma sd 8.10 at 256, so 0.35 lands on-screen sd 2.83 — between the two shipped rocks
    // (sandstone 1.38, granite 4.91) and inside the whole set's 1.38-6.75 band.
    //
    // SEPARATION WAS SCORED IN TWO TIERS AND THE DISTINCTION IS REUSABLE. In-venue separation
    // is what matters in play, because sand and rock share a shoreline and the player has to
    // read them apart at race scale: 23.9 from the cove's sand, 52.0 from the scrub above.
    // Cross-venue separation is only a picker-swatch concern — mudflat and this can never be
    // in the same race — so 19.2 there is fine where 5.3 was not.
    //
    // veg is a paler DRY STONE, not a green: the granite/redrock/mud convention for a look
    // with no vegetation on it. No trees — bare rock.
    coastalrock:  { body: '#a19481', stroke: '#6f6556', veg: '#b4a997', rock: '#817766', trees: false },  // body = bay-rock DELIVERED tile mean
    // The village lane. body = the DELIVERED tile's own mean, so alpha stays a pure contrast
    // knob; the other three are the spec's offsets carried onto it (the bayou-mud precedent).
    // veg and rock are drier and paler shell rather than a green — the granite/redrock/mud
    // convention for a look that has no vegetation on it. No trees on a road.
    lane:     { body: '#cac2ad', stroke: '#afa898', veg: '#e0dbcc', rock: '#a29a8d', trees: false },  // body = bay-lane DELIVERED tile mean
    // ── STILLWATER LAKE'S THREE GROUNDS ─────────────────────────────────────
    // ALL THREE DELIVERED 2026-08-14, so every body below is its DELIVERED tile's own mean
    // and every LAND_TEXTURES alpha is measured. With base equal to tile mean the blend
    // cannot move the colour, only the spread around it. The other three tones on each row
    // are the spec's own offsets carried onto the delivered body, the bayou-mud precedent.
    //
    // THE IN-VENUE TRIANGLE IS WHAT THESE WERE PICKED FOR, because all three share a
    // shoreline and the player reads them apart at speed: floor-to-sand 22.9, floor-to-rock
    // 28.9, sand-to-rock 22.7, against the cove's accepted sand-vs-rock 23.9.
    //
    // ⚠️ THE FLOOR IS LIGHTER THAN A NORTHWOODS TREE AND THAT IS DELIBERATE. At L* 50.9 it
    // sits +22 above a white pine crown and +29 above a balsam fir, inside the cove's
    // accepted +26/+37 band, so dark conifers read against it. It also sits 13-19 L* BELOW a
    // paper birch or aspen crown, which is the same relationship the other way — this is the
    // first ground in the game with light trees AND dark trees on it, and a medium value is
    // what lets both read. Do not darken it toward the swamp's browns to look richer.
    // `mud` is dE 21 away and `marsh` 12; both are cross-venue, so picker-only.
    // ⚠️ THE DELIVERY IS 7.5 L* DARKER THAN SPEC AND THE TREE MARGINS TIGHTENED WITH IT.
    // Spec was #8A7752 at L* 50.9, picked so a dark conifer would read against it; delivered
    // is #7C633D at L* 43.4, so the white pine's margin fell from +22.1 to +14.7 and the
    // balsam fir's from +28.1 to +20.8. Accepted, and the numbers are recorded so nobody
    // re-derives them: both still clear on dE (33.8 and 37.3), and the darker floor IMPROVED
    // the half of the problem that was always harder — the light half. Paper birch went from
    // -9.2 to -16.5 and bracken fern from -2.4 to -9.8, so this venue's light trees now stand
    // out where they were marginal. A floor carrying both light and dark canopy is a
    // compromise by construction; this delivery moved the compromise toward the weaker side.
    forestfloor: { body: '#7C633D', stroke: '#543F21', veg: '#40571F', rock: '#7E746B', trees: true },   // body = lake-forestfloor DELIVERED tile mean
    // Coarse glacial beach. GREYER AND COOLER THAN `isle`, the shared ocean-beach tan it
    // replaces here — dE 13.5 apart, against the 16.8 that separates `coralsand` from the
    // same `isle`, so this is the same size of statement the lagoon's white sand already
    // makes. Its nearest neighbour is bay's `lane` at 7.4, which is honest: crushed shell and
    // glacial gravel are both pale mixed aggregate, and they can never share a race.
    lakesand:    { body: '#B7A487', stroke: '#958469', veg: '#698A23', rock: '#958C7E', trees: true },   // body = lake-sand DELIVERED tile mean
    // Ice-worn gneiss. veg is a paler DRY STONE and rock a darker one — the
    // granite/redrock/coastalrock convention for a look with nothing growing on it, and the
    // stroke carries coastalrock's own offsets onto this body (an 18.7 L* drop against its
    // 18.6), so the coastline holds the same weight. No trees: bare rock.
    gneiss:      { body: '#847F81', stroke: '#4E4B54', veg: '#938F95', rock: '#605D64', trees: false },  // body = lake-gneiss DELIVERED tile mean (2nd slab, 2026-08-15; was #807A7F)

    // ── SOCKEYE RUN, 2026-08-16 ─────────────────────────────────────────────
    // Declared with the art still at `slot`, on purpose: a style with no LAND_TEXTURES entry
    // draws as its flat `body` colour, which is exactly art-pipeline 6's placeholder stage —
    // the venue becomes drawable and playable now, and the tiles land on top later. Four
    // existing styles (karst, mudflat, coralshoal, shoal) already run textureless, so this is
    // the supported path and not a gap.
    //
    // ⚠️ EVERY `body` BELOW IS PROVISIONAL AND MUST BE RESET TO ITS TILE'S DELIVERED MEAN on
    // ingest, the same step the three lake grounds went through. The LAND_TEXTURES alpha is a
    // pure CONTRAST knob only while body equals the tile's own mean; if they disagree, raising
    // alpha shifts the colour instead of the spread, and that is how the two arctic textures
    // ended up carrying a mean-luma-shift warning.
    //
    // SEPARATION IS MEASURED, not eyeballed, and the four were re-picked once because of it: a
    // first pass put cobble at #85868A, which measured dE 9.8 from outcrop — far too close for
    // two grounds that share a race, and 3.5 from the lake's gneiss. The set below has a worst
    // in-venue pair of dE 23.8 (cobble vs outcrop, cobble vs meadow) against the 30.6 the lake
    // ships forestfloor-to-sand at, and every one clears dE 23 from the river's own water so
    // land never smears into it. Cross-venue neighbours are accepted and named in each
    // manifest note: cobble sits 9.7 from `gneiss` and humus 5.7 from `mud`, both picker-only.
    cobble:      { body: '#6E6B65', stroke: '#4E4C48', veg: '#7C8C46', rock: '#8A8580', trees: false },  // body = river-cobble DELIVERED tile mean
    meadow:      { body: '#929738', stroke: '#5E6C38', veg: '#A8B04E', rock: '#8A8580', trees: false },  // body = river-meadow DELIVERED tile mean
    outcrop:     { body: '#999C9E', stroke: '#5E656D', veg: '#8D9689', rock: '#7C838B', trees: false },  // body = river-outcrop DELIVERED tile mean
    humus:       { body: '#352B19', stroke: '#221C10', veg: '#4E5A34', rock: '#6B665E', trees: true  },  // body = river-humus DELIVERED tile mean
    // ⚠️ THE COLOUR IS THE SHADED REFERENCE, NOT THE LIT ONE, and that is a separation decision.
    // The owner's two photographs measure #487618 in shaded forest and #819E31 in a lit clearing;
    // the bright value sits dE 11.8 from `meadow`, which would make a moss floor and an open
    // terrace the same colour on the map. The shaded one clears it at 23.3 and is the honest value
    // for a floor under a closed canopy.
    mossfloor:   { body: '#618414', stroke: '#3E5A0E', veg: '#7EA02A', rock: '#6B665E', trees: true  },  // body = river-mossfloor DELIVERED tile mean
    // THE SAME STONE as `cobble`, exactly as `coralshoal` is the same sand as `coralsand`: a
    // bar is the ground continuing under the water, so each ground look has its bar look and
    // the two are kept equal on purpose. shoalTintFor derives what the water does to it per
    // shape. No stroke worth the name and no trees — a crisp shoreline is the cue that says
    // "this is land", and a bar must not have one; its edge is a gradient.
    cobbleshoal: { body: '#6E6B65', stroke: '#4E4C48', veg: '#6E6B65', rock: '#4E4C48', trees: false },  // = cobble, kept equal
    ice:      { body: '#e6f2fb', stroke: '#7fb2d9', veg: '#ffffff', rock: '#8fc2e8', trees: false },
    redrock:  { body: '#cc6533', stroke: '#8a4a26', veg: '#d98e57', rock: '#7c4a2d', trees: false },   // body = sandstone tile mean
    // Bare granite: dark, cold and jagged. Traced angular like ice (see the
    // tracer pick below) because it is broken rock, not a rounded sandbank.
    granite:  { body: '#4b5563', stroke: '#1f2937', veg: '#5b6673', rock: '#374151', trees: false },
    // Dark karst limestone — Glowtide Strait's rock.
    //
    // NEUTRAL-COOL, AND THAT WAS MEASURED RATHER THAN PICKED. The first pick was a warm
    // buff (#646057) on the reasoning that limestone is warm and a warm rock separates
    // from cool water. Rendered against the strait's three water bands it read as MUD —
    // simultaneous contrast against #1a2560 pushes any warm grey olive, so the material
    // that is supposed to be stone came out as an earth bank. Neutral survives the same
    // surround and still reads as rock, so the warm cast is gone and the separation from
    // granite is carried by value and saturation instead: this is lighter (luma 97 vs 84)
    // and far less blue than granite's #4b5563.
    //
    // "DARK" IS RELATIVE TO LIMESTONE, WHICH IS NEAR-WHITE. It cannot also be dark against
    // the water: base #1a2560 is luma 39, deep #0a0f30 is 16, and a hazard below those
    // disappears on the one venue that most needs its rocks seen. The tightest case is the
    // SHALLOW band (#27407e, luma 63) — the water rocks actually sit in — and this holds
    // ~1.5x there, which the darker candidates did not.
    //
    // No LAND_TEXTURES row, so it fills flat with lit facets over it. Fine at race scale,
    // and where granite started; add a tile at the venue's art pass.
    karst:    { body: '#5d6068', stroke: '#24262b', veg: '#414a44', rock: '#7d8087', trees: false },
    // The same limestone, drowned, and DARK — a rock you have to look for. These are IN-AIR
    // colours like every other style; submergedTint puts the water column over them at bake
    // time (see sunkenGround), so the body arrives on screen a good deal closer to the water
    // than it looks here. This row is the single source for the material: the bake, the
    // minimap and the editor chip all read it, so darkening the rock is this one hex.
    sunkenrock: { body: '#565f6f', stroke: '#1a1d23', veg: '#3a423d', rock: '#6d7078', trees: false },
    // Sandy shoal — WET sand, deliberately darker than the dry beach above it.
    //
    // This used to be set equal to `tropical` on the principle that a bar is the beach
    // continuing under the water, so giving it its own hue would claim a different material
    // rather than the same one at a different depth. That principle is right about MATERIAL
    // and wrong about VALUE: dry and wet sand are the same grains at different reflectance,
    // and a wet bar is visibly darker before the water column over it is accounted for at
    // all. Matching the dry-beach plate exactly made every bar read a shade too bright.
    //
    // ⚠️ THE BODY HAS LESS AUTHORITY HERE THAN IT LOOKS. `submergedTint` mixes SHOAL_IN_WATER
    // (0.38) of the water's own colour into this and then applies a luma gain, so a change
    // of 14 in the red channel moves the drawn bar by about 3 luma. This value is ~25 down
    // from the dry-beach sand to land ~12 luma down on screen; do not read the hex as if it
    // were the pixel. The editor's "Sand Shoal" swatch (#cfc09a) was a third, separate
    // answer that had never been reconciled with either.
    //
    // ⚠️ NOT the same change as `coralshoal`, which stays keyed to `coralsand`: Tropic Sand
    // bars are genuinely a paler, cooler sand, and that pairing is deliberate.
    //
    // ⚠️ THIS ENTRY IS THE SAND BAR ALONE, despite `shallows`, `seagrass` and the bayou's
    // four weeds all naming `shoal` as their look. None of them reads a colour from here:
    // every one is `paint: true`, so drawShoals skips them, and every one is `awash`, so
    // drawIslands skips them too — the shallows take WATER_CONFIG.shallowColor and the
    // vegetated zones take their VEG_STYLES row's tones. Editing body/stroke/veg/rock here
    // therefore moves sand bars and nothing else. Verified by flipping this value and
    // re-reading every drawn shape on all ten venues: 9 `shoal` shapes moved, the 8
    // `tropicshoal` were byte-identical, nothing else was touched. If any of those is ever
    // rewired to read the style, that stops being true.
    //
    // No trees, no rocks and no stroke worth the name — the crisp shoreline is exactly the
    // cue that says "this is land", so a shoal must not have one. Its edge is a gradient.
    shoal:    { body: '#d0ad74', stroke: '#bb9760', veg: '#d0ad74', rock: '#bb9760', trees: false },
    // Coral-white shoal — THE SAME SAND as `coralsand`, exactly as `shoal` is the same
    // sand as `tropical`: a bar is the beach continuing under the water, so each beach
    // look has its bar look. shoalTintFor derives what the water does to it per shape.
    coralshoal: { body: '#efe4cf', stroke: '#ddd0ad', veg: '#efe4cf', rock: '#ddd0ad', trees: false },  // same sand as coralsand, kept equal
    // ── THE BAYOU'S GROUND ──────────────────────────────────────────────────
    // Bare swamp mud — body is the bayou-mud tile's DELIVERED mean (2026-08-09), which came
    // in at #524731 against a spec of #5a5140: about 8 luma darker and appreciably warmer
    // (the blue channel dropped 15 against the red's 8). The other three are the spec's own
    // offsets from its body carried onto the new one rather than left where they were —
    // stroke was 21/19/16 below the body and stays 21/19/16 below it, and likewise veg and
    // rock above. Left unmoved, the stroke's blue channel would have landed within 1 of the
    // body's and the coastline would have washed out. No trees: cypress stands in the water
    // and on the hummocks, not out on a bare bank. `veg` and `rock` are drier mud rather
    // than a green — the granite/redrock convention for a look that has no vegetation of
    // its own, which is what keeps a mud bank from sprouting a meadow fringe it never had.
    mud:      { body: '#524731', stroke: '#3d3421', veg: '#635741', rock: '#675d45', trees: false },
    // The transition ground, and its body is literally the average of its two
    // neighbours' means — which is what the marsh tile's own note asks for: the three
    // grounds have to read as one place grading through itself rather than three
    // materials butted together. This one DOES carry vegetation, so `veg` is the swamp's
    // sedge green.
    //
    // SUPERSEDED 2026-08-09 by the delivered tile's own mean (#685c37), per the recipe —
    // the average-of-neighbours rule above was only ever the stand-in for a tile that had
    // not arrived, and once one has, base-equals-tile-mean is what keeps LAND_TEXTURES'
    // alpha a pure contrast knob. stroke and rock carry their previous offsets from the
    // body (-27/-25/-19 and -7/-5/+4); veg stays the swamp's absolute sedge green.
    //
    // ⚠️ THE LADDER IS LOPSIDED AND THE ART IS WHY, not this hex. Measured on the delivered
    // tiles, the three grounds run swampgrass 145 -> marsh 92 -> mud 72 in luma, where an
    // even grade would put the middle at 108: the marsh sits 17 luma low, so it reads much
    // closer to the bank than to the sward. The cause is one phase, not the whole tile —
    // split by luma, the marsh's MUD phase is #594f32 against the delivered bank's #524731
    // (7 luma, an excellent match, the two genuinely read as one material continuing) while
    // its SEDGE phase is #7e6f3d against the sward's #a09454, fully 35 luma dark. The
    // clumps do not read as the same sawgrass thinning out; they read as a darker plant.
    // Raising this hex would NOT fix that — it would lift the mud phase away from the bank
    // it currently matches and lose the one thing the tile got right. The fix, if it is
    // worth one, is a regenerated tile with the sedge range restated; the manifest note
    // carries the numbers.
    marsh:    { body: '#685c37', stroke: '#4d4324', veg: '#4d7c0f', rock: '#61573b', trees: false },
    // The mud BAR — dark mud, like the bank it continues, and NOT the pale silt this
    // entry painted from the venue's first build until 2026-08-09.
    //
    // ⚠️ JUDGE ANY CHANGE BY THE COMPOSITE, NOT BY WHETHER THE HEX LOOKS LIKE MUD. That
    // warning is the one thing the old note got right and it is restated here unchanged:
    // between this value and the pixel sit submergedTint's mix and luma gain (0.77 on this
    // venue's water) and then SHOAL_ALPHA_CORE's 0.62 over the water itself. #6e6449
    // arrives on screen at (88,89,55).
    //
    // ── WHY IT USED TO BE PALE, AND WHY THAT STOPPED BEING TRUE ─────────────
    // The old argument ran: the bayou's water is dark olive, so a dark bar would be a
    // 0.9-drag trap nobody can see, therefore paint the pale silt that settles on a flat.
    // That was CORRECT ARITHMETIC ON A MIX THAT NO LONGER APPLIES. It was measured when
    // every bar took SHOAL_IN_WATER (0.38), which drags a bottom two-thirds of the way to
    // the water and eats its saturation — under that mix the original #6e6449 really did
    // land ~9-14 luma off the channel, and pale really was the only way out. Bare sediment
    // was later split onto SHOAL_SAND_IN_WATER (0.16) precisely because 0.38 was destroying
    // these colours, and that fix silently inverted this entry's premise: at 0.16 the body
    // survives the column, so dark now reads as dark. Nobody re-derived the hex afterwards.
    //
    // ── WHY THIS VALUE ──────────────────────────────────────────────────────
    // The bar has TWO neighbours and a hex has to clear both. Against the WATER it must be
    // visible; against the BANK it must not read as land, or a boat sails around a shape it
    // was entitled to cross (the shoal contract's second half — "unmistakably there, and
    // unmistakably NOT land"). Sweeping the bank's own hue ramp through the composite and
    // scoring the WORST of the three separations picks this tone. Note the constraint that
    // binds has flipped: pale bars lose the water, dark bars lose the bank, and the two
    // failures are a few hex apart.
    //     body      vs base   vs shallow   vs bank    worst
    //     #c5b28f    +18.5       +0.6       +45.2       0.6   <- what used to ship
    //     #6e6449    -13.5      -31.4       +13.2      13.2   <- this
    //     #675d45    -16.2      -34.0       +10.5      10.5
    //     #524731    -24.8      -42.6        +1.9       1.9   <- = the bank, reads as land
    //
    // ⚠️ THAT TABLE IS MODELLED, AND THE MODEL IS ONLY GOOD FOR RANKING. It composites
    // against the WATER_CONFIG hexes, and the water actually drawn around this bar renders
    // near luma 92 — well below shallowColor's 127 — because depth blending and the surface
    // layers (swell, gusts, wind waves, rain) all sit over it. So do not read those margins
    // as on-screen values. MEASURED on the real frame, camera parked on the bar and both
    // variants shot against the same water:
    //     #c5b28f  bar luma 98.5 vs water 92.8  ->  +5.7   low contrast, but NOT invisible
    //     #6e6449  bar luma 83.4 vs water 92.0  ->  -8.6   half again the separation, dark
    // The honest summary is that the pale bar was weak rather than broken, and this one is
    // both stronger and the right material. An earlier draft of this note called the pale
    // value invisible on the strength of the modelled +0.6; the render does not support that
    // and it is corrected here.
    //
    // #6e6449 IS THE VALUE THIS ENTRY ORIGINALLY HELD, chosen as "mud, a bit lighter" and
    // abandoned for a mix that has since been fixed. The editor's Mud Flat chip was never
    // migrated to the pale value and so has been showing this one the whole time — the
    // chip-vs-renderer drift closes itself here rather than needing a third answer.
    //
    // The crisp-shoreline cue still does the heavy lifting on the land question: a bar has
    // no stroke worth the name and fades out at its rim, so the bank margin is a margin on
    // top of a structural difference, not the only thing separating bar from bank.
    //
    // ⚠️ IF THIS BAR NEEDS TO READ HARDER, THE BODY HEX IS THE WRONG LEVER — it is worth
    // about 14 luma of swing across its whole usable range, and both ends of that range hit
    // a different neighbour. What actually caps the contrast is that only the bar's very
    // centre reaches SHOAL_ALPHA_CORE: this shape is 183x169 units against a 60-unit
    // feather, so the drag field it rasterises is mostly rim. Measured on the baked sprite,
    // peak alpha is the full 0.62 but the MEAN over the covered area is 0.269. Widen the
    // shape, shorten `feather`, or raise SHOAL_ALPHA_CORE — do not chase it with the hex.
    mudflat:  { body: '#6e6449', stroke: '#5f563f', veg: '#6e6449', rock: '#5f563f', trees: false }
};

// How a bar comes through the water. Two numbers, because a shoal has to answer two
// questions at once: it must be unmistakably there (you cannot decide to cross something
// you did not see) and unmistakably NOT land (a boat that thinks it is land sails a longer
// course for no reason). So the sand is bright but never opaque, and the fill fades out to
// nothing at the rim across the SAME band the drag feathers over — the picture and the
// physics are the same shape, and the edge you can see is the edge you can feel.
const SHOAL_ALPHA_CORE = 0.62;    // over the shallowest water, where the drag is at its floor
const SHOAL_ALPHA_RIM  = 0.0;     // at the outline, where the water is deep and free again

// ── WHAT COLOUR A SUBMERGED BAR IS ──────────────────────────────────────────
//
// Not the colour of sand. The colour of sand LIT BY WHATEVER LIGHT REACHES IT, which is the
// same light that decides what colour the water is — so the tint is derived from the
// venue's own water rather than fixed.
//
// This is not a nicety. Painted as flat #ddc39a it was right on Lighthouse Cove, whose
// bright tropical water is the palette it was picked against, and badly wrong on Glowtide,
// where a beige patch at 0.62 over near-black night water read as a spotlight pointed at
// the seabed — brighter than the sea around it, and the one object on screen outside the
// venue's palette. A sandbar at night is a dark warm smudge, and every venue past the first
// would have needed its own hand-tuned exception.
//
// Two steps, both about light and neither about taste. MIX toward the water, because you
// are looking at the bottom through a column of it and the water colours everything you see
// down there. Then SCALE by how bright that water is against the tropical reference, because
// the same bottom under less light is simply darker. The result stays inside whatever
// palette a venue authored, automatically, on venues that do not exist yet.
const SHOAL_IN_WATER = 0.38;      // how much of the column's own colour you see the sand through
const SHOAL_REF_LUMA = 128;       // luma of the bright tropical water the sand was picked against
// ── A SAND BAR NEEDS TO READ AS SAND ────────────────────────────────────────
// 0.38 was picked against BRIGHT TROPICAL water, where mixing in over a third of the column
// still leaves a warm bar. Over Sockeye Run's dark teal (#3f6f5f) the same mix drags the
// sand two-thirds of the way to the water and it comes out grey-olive: not a lighter sand,
// a DESATURATED one, which reads as a smudge on the bottom rather than a bank.
//
// ⚠️ THE BODY COLOUR CANNOT FIX THIS, and trying is how this went wrong once already.
// Darkening the sand makes a grey bar into a darker grey bar — value and saturation are
// different axes, and it is saturation that was missing. Compare, on river water:
//     mix 0.38, body #ddc39a -> #777961     grey-olive
//     mix 0.38, body #b8a67e -> #666b55     darker grey-olive (worse)
//     mix 0.16, body #d0ad74 -> #8b7a54     reads as sand
//
// BARE SEDIMENT UNDER DARK WATER — sand bars, and now the bayou's mud flats. Coral bars,
// reef rubble and the seagrass meadows keep SHOAL_IN_WATER: they sit under bright lagoon
// water where 0.38 was right, and Tropic Sand Shoals are deliberately out of scope here.
// Passing the mix per call rather than editing the shared constant is what keeps it that
// way.
//
// The mud flat was added to this list AFTER FAILING EXACTLY THE FAILURE DESCRIBED ABOVE.
// Rendered on Gatorgrass Bayou at 0.38 over olive water (luma 98) it composited to within
// 9 luma of the water around it — a 0.9-drag bar, the most expensive object in the game,
// effectively invisible. Same diagnosis as the river's sand: the mix had eaten the
// saturation, and no body colour was going to buy it back.
const SHOAL_SAND_IN_WATER = 0.16;
// Which looks are bare bottom sediment rather than something living on it. A set, because
// there are two of them now and there will be more the first time another venue authors a
// bar of its own material.
//
// ⚠️ `coralshoal` JOINED 2026-08-14, AND THE CLAUSE ABOVE THAT EXCLUDED IT HAS BEEN LEFT
// STANDING BECAUSE IT EXPLAINS WHY. It reads "Coral bars ... keep SHOAL_IN_WATER: they sit
// under BRIGHT LAGOON WATER where 0.38 was right, and Tropic Sand Shoals are deliberately
// out of scope here." Every word of that was true when Pearl Lagoon was the only venue with
// coral bars. Bluewater Bonanza then grew six tropicshoal shapes under deep open-ocean
// cobalt, and the premise expired: 0.38 over water at luma 81 dragged the coral-white bar to
// #5E7378, a dark slate that read as mud beside its own #efe4cf beach. That is the exact
// failure the sand-bar note above describes — the mix ate the saturation, and no body colour
// buys it back — so this is the same fix applied to the same defect, not a new policy.
//
// CORAL SAND IS BARE SEDIMENT BY ANY PLAIN READING, which is what makes this the right list
// rather than a special case: it is ground shell and coral rubble lying on the bottom, the
// same category as the tan sand it sits next to and the mud flat below it. What genuinely
// still belongs at 0.38 is what LIVES on the bottom — the seagrass meadows and the reef —
// because a plant or a coral head really is seen through more column than flat sediment is.
const BARE_SEDIMENT_LOOKS = { shoal: true, mudflat: true, coralshoal: true };
// The derivation, factored out because it is true of ANYTHING on the bottom — the sand
// bar and the seagrass meadow are the same physics under the same light, so they go
// through the same two steps and can never disagree about what the water does to them.
function submergedTint(bottom, mix) {
    const W = window.WATER_CONFIG || {};
    const rgb = (h, fb) => {
        const s = String(h || '').replace('#', '');
        if (s.length !== 6) return fb;
        return [parseInt(s.substring(0, 2), 16), parseInt(s.substring(2, 4), 16), parseInt(s.substring(4, 6), 16)];
    };
    // The water you SEE THE BOTTOM THROUGH. Where a venue authors a heroColor — its
    // signature shallow water, the lagoon inside the reef — that is the column over
    // every bar and meadow, and deriving from the open-ocean base instead made them
    // impossibly dark (the lagoon split left baseColor at luma 67, gain 0.52: no body
    // colour in gamut could reach the bright mint a Caribbean bar actually is). Venues
    // without a heroColor are unchanged: one water, same answer as always.
    //
    // ⚠️ shallowColor IS NOW THE MIDDLE TERM, AND IT CLOSES THE CASE THE NOTE ABOVE OPENED.
    // That note diagnosed the defect exactly — deriving a bar from the open-ocean base makes
    // it impossibly dark — and then fixed it for ONE venue by having the lagoon author a
    // heroColor, leaving every other venue on the broken derivation ("Venues without a
    // heroColor are unchanged: one water, same answer as always"). Bluewater Bonanza is what
    // showed that was a deferral rather than a decision: its coral bars painted #5E7378, a
    // dark slate, next to their own #efe4cf beach.
    //
    // A BAR IS SHALLOW WATER BY DEFINITION, so the column over it is the venue's SHALLOW
    // water, not its deep base — and every venue already authors shallowColor, so this asks
    // for nothing new from a document. heroColor still wins where a venue has one, because
    // that is a deliberate statement about signature water; baseColor survives as the last
    // resort for a palette with no shallowColor at all.
    //
    // MEASURED ACROSS THE ROSTER, this only ever moves a bar LIGHTER, which is the direction
    // the original diagnosis says is correct: ocean shoal #6F664E -> #B0AB86, bay #938969 ->
    // #ABA07A, swamp #927D52 -> #C2A66D, river #897953 -> #BAA573, glowtide #4B402F ->
    // #5A4D3A. Pearl Lagoon is untouched by this line — it has a heroColor.
    const water = rgb(W.heroColor || W.shallowColor || W.baseColor, [14, 165, 233]);
    const luma = 0.299 * water[0] + 0.587 * water[1] + 0.114 * water[2];
    // Floored well above zero: a bar you cannot see is a bar you cannot decide about, and
    // Glowtide's night water would otherwise take it to nearly black. Capped just over 1 so
    // an unusually bright venue cannot blow the sand out past white.
    const gain = Math.max(0.42, Math.min(1.12, luma / SHOAL_REF_LUMA));
    const k = (mix != null) ? mix : SHOAL_IN_WATER;
    return bottom.map((c, i) => Math.round((c * (1 - k) + water[i] * k) * gain));
}
// Per MATERIAL, not one global sand: a shoal's look names its ISLAND_STYLES entry
// (`shoal` is the tan bar, `coralshoal` the coral-white one), and the body of that
// entry is the bottom the light derivation starts from. One bar off a Cape-Cod beach
// and one off a Tropic Sand beach are different sands under the same water.
function shoalTintFor(isl) {
    const rgb = (h, fb) => {
        const s = String(h || '').replace('#', '');
        if (s.length !== 6) return fb;
        return [parseInt(s.substring(0, 2), 16), parseInt(s.substring(2, 4), 16), parseInt(s.substring(4, 6), 16)];
    };
    const st = (isl && ISLAND_STYLES[isl.style]) || ISLAND_STYLES.shoal || {};
    // Bare sediment sees less of the column than the shared default assumes — see
    // SHOAL_SAND_IN_WATER. Everything else on the bottom keeps the original mix.
    const mix = (isl && BARE_SEDIMENT_LOOKS[isl.style]) ? SHOAL_SAND_IN_WATER : undefined;
    return submergedTint(rgb(st.body, [221, 195, 154]), mix);
}

// ── SHOALS ──────────────────────────────────────────────────────────────────
//
// A bar is drawn as ITS OWN DRAG FIELD, rasterised. Not "a polygon with a soft edge that
// approximately matches" — the alpha of every pixel is VenueDoc.shoalMul at that point,
// the same call the boat's speed model makes and the same one the router prices cells
// with. So the sand you can see fading out is exactly the water that stops costing you,
// to the pixel, and the three of them cannot drift apart as the constants are tuned.
//
// The alternative was an inset polygon or a blurred fill. Both are approximations of a
// number this file can simply ask for, and a picture that lies about where the slow water
// starts is worse than no picture: the player would learn the wrong edge.
//
// Baked ONCE per shoal per race, like every other island sprite — the per-pixel cost is a
// point-in-polygon plus a distance to every segment, which is fine once and hopeless per
// frame. 2.5 units per pixel: this is a smooth gradient with no detail to lose, and it
// upscales for free (the same trade water.js makes at resolutionScale 0.5).
const SHOAL_UNITS_PER_PX = 2.5;
function bakeShoalSprite(isl) {
    const R = isl.radius;
    const px = Math.max(32, Math.min(512, Math.ceil((R * 2) / SHOAL_UNITS_PER_PX)));
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const g = cv.getContext('2d');
    const img = g.createImageData(px, px);
    const d = img.data;
    const [sr, sg, sb] = shoalTintFor(isl);
    // The multiplier at the heart is what "fully shallow" means for THIS shoal, so a
    // gentler bar reads as a fainter one and a 0-drag shoal is invisible rather than
    // dividing by zero. That is the honest picture: no drag, nothing to warn about.
    const span = 1 - isl.shoalMul;
    const step = (R * 2) / px;
    for (let j = 0; j < px; j++) {
        const wy = isl.y - R + (j + 0.5) * step;
        for (let i = 0; i < px; i++) {
            const wx = isl.x - R + (i + 0.5) * step;
            const t = span > 1e-6 ? (1 - window.VenueDoc.shoalMul(isl, wx, wy)) / span : 0;
            const o = (j * px + i) * 4;
            d[o] = sr; d[o + 1] = sg; d[o + 2] = sb;
            d[o + 3] = Math.round(255 * (SHOAL_ALPHA_RIM + (SHOAL_ALPHA_CORE - SHOAL_ALPHA_RIM) * t));
        }
    }
    g.putImageData(img, 0, 0);
    // Keyed on the TINT, so the bake follows the water. resetGame applies the venue's
    // palette, and the water panel can move it live — either way a sprite baked against
    // the previous venue's light rebakes itself rather than sitting there in the wrong
    // colour. Same reason applyVenuePalette drops the gust sprites.
    isl._shoalSprite = { canvas: cv, r: R, tint: `${sr},${sg},${sb}` };
}

// ── PAINTED SHALLOWS ────────────────────────────────────────────────────────
//
// A `shallows` zone is a POLYGON WITH A SOFT EDGE, baked once like every other island
// sprite. It is NOT a drag field — zero drag is the kind's whole point — so unlike a
// shoal there is no number to rasterise: the fill is flat and the rim is a blur, sized
// by the same feather the shoals use so the two transitions read as one water.
//
// The alpha is deliberately well under 1: the zone is a TINT OVER the venue's water,
// not a replacement for it. The ripple lattice beneath still shows through, and the
// swell, wakes, gusts and wind waves are all drawn after, so they run across the zone
// unbroken — which is most of what keeps it reading as water rather than paint. The
// venue palette authors the two colours as a pair: `baseColor` is the open water (for
// a lagoon, the deep ocean outside the reef) and `shallowColor` is what this zone
// lays over it, picked knowing the blend (final ≈ 0.72·shallow + 0.28·base).
const SHALLOWS_ALPHA = 0.72;
function bakeShallowsSprite(isl) {
    const tint = (window.WATER_CONFIG && window.WATER_CONFIG.shallowColor) || '#38bdf8';
    // The blur bleeds outward, so give the sprite room for it past the outline.
    const margin = isl.shoalFeather + 20;
    const R = isl.radius + margin;
    const px = Math.max(32, Math.min(1024, Math.ceil((R * 2) / SHOAL_UNITS_PER_PX)));
    const scale = px / (R * 2);
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const g = cv.getContext('2d');
    // Geometry mapped to device pixels by hand rather than ctx.scale: canvas filter
    // units interact with the current transform inconsistently across browsers, and a
    // feather that renders at two different widths is exactly the seam this bake exists
    // to avoid.
    const pts = isl.vertices.map(v => ({
        x: (v.x - isl.x + R) * scale,
        y: (v.y - isl.y + R) * scale
    }));
    // Half the feather each side of the authored edge ≈ a transition the feather wide,
    // matching the shoals' smoothstepped rim.
    g.filter = `blur(${Math.max(1, (isl.shoalFeather / 2) * scale)}px)`;
    g.globalAlpha = SHALLOWS_ALPHA;
    g.fillStyle = tint;
    traceRoundedPoly(g, pts);
    g.fill();
    isl._shallowsSprite = { canvas: cv, r: R, tint };
}

// UNDER THE SHOALS, AND UNDER EVERYTHING ON THE WATER. A zone says "the water here is
// a different water"; a bar inside it is still a bar, so the shoal's sand paints over
// the tint, and everything AT the surface paints over both.
function drawShallows(ctx) {
    if (!state.course || !state.course._hasShallows) return 0;
    const tint = (window.WATER_CONFIG && window.WATER_CONFIG.shallowColor) || '#38bdf8';
    const viewRadius = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;
    const camX = state.camera.x, camY = state.camera.y;
    let drawn = 0;
    for (const isl of state.course.islands) {
        // A vegetated zone is also `paint`, but it is drawVegetation's layer — it goes
        // OVER the shoal sand (or over the finished water, if it floats), and this pass
        // runs under both. Keyed on `veg` rather than on the kind name, so a new plant
        // does not have to be remembered here.
        if (!isl.paint || isl.hidden || isl.veg) continue;
        const limit = viewRadius + isl.radius;
        if ((isl.x - camX) ** 2 + (isl.y - camY) ** 2 > limit ** 2) continue;
        // Keyed on the tint like the shoal bake: a venue swap or a live palette edit
        // rebakes rather than leaving last venue's water painted on this one.
        if (!isl._shallowsSprite || isl._shallowsSprite.tint !== tint) bakeShallowsSprite(isl);
        const s = isl._shallowsSprite;
        ctx.drawImage(s.canvas, isl.x - s.r, isl.y - s.r, s.r * 2, s.r * 2);
        drawn++;
    }
    return drawn;
}

// ── VEGETATION ZONES ────────────────────────────────────────────────────────
//
// A bed is the painted zone's opposite fill: where shallows is one flat tint with a
// blurred rim, vegetation is HUNDREDS OF SMALL CLUMPS and no tint at all — because from
// this camera's altitude a bed is not a surface, it is patchy mass. The clumps are
// scattered in code from the shape's own seeded PRNG (never Math.random — render must not
// touch the eval RNG stream, and a bed that rearranged itself every reload would read as
// a bug): arrangement is code's job, which is the compose.py argument applied at runtime.
//
// The edge is DENSITY, not blur. A bed peters out — clumps thin and shrink over the same
// feather band the other zones use — so the rim stays crisp per-clump and soft as a mass,
// which is exactly how the aerial references read. A few larger holes are carved the same
// way, so the interior is patchwork rather than carpet.
//
// ONE BAKER, FIVE PLANTS. This was seagrass alone and the renderer keyed on the literal
// string 'seagrass'. The bayou then wanted four more beds, every one needing the same
// machinery — seeded scatter, density rim, carved holes — with a different plant stamped
// into it. So the STRUCTURE lives here once and VEG_STYLES holds what differs, with
// SHAPE_KINDS' `veg` naming the spec: the same one-list rule MARK_KINDS and PROP_KINDS
// already follow. Adding a plant is a row, not a renderer.
//
// PLANE IS THE LOAD-BEARING AXIS, and it is physics rather than decoration:
//
//   'bottom'   the plant is UNDER the water. It takes submergedTint, it draws with the
//              seabed layers, and every surface layer — wake, gust, wind wave, cat's-paw
//              — runs across it, because all of those are happening above it.
//   'surface'  the plant is ON the water. NO submergedTint, because nothing stands between
//              it and the sun; and it draws AFTER the surface layers, because a wake does
//              not run across a hyacinth raft — the raft is what the wake stops at.
//              Getting that backwards is exactly what would make a floating mat read as a
//              stain on the water instead of a thing lying on top of it.
//
// Every clump function owns its own drawing, because THE CLUMP IS THE PLANT: a seagrass
// tussock, a lily pad and a fleck of duckweed are different objects, and one parameterised
// ellipse could only ever have been one of them wearing the others' colours.

// A tussock: a few overlapped ellipses, mostly dark, the light tone rare — large clean
// value masses, not per-blade noise. UNCHANGED from the original seagrass bake, RNG draw
// for RNG draw, so every existing meadow bakes byte-identically across this refactor.
function clumpTussock(g, cx, cy, scale, rand, tones, alpha) {
    const cs = (7 + rand() * 9) * scale;
    const n = 3 + Math.floor(rand() * 3);
    for (let b = 0; b < n; b++) {
        const t = rand();
        const tone = tones[t < 0.55 ? 0 : t < 0.86 ? 1 : 2];
        g.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha})`;
        g.beginPath();
        g.ellipse(cx + (rand() - 0.5) * cs, cy + (rand() - 0.5) * cs,
                  cs * (0.32 + rand() * 0.3), cs * (0.2 + rand() * 0.24),
                  rand() * Math.PI, 0, Math.PI * 2);
        g.fill();
    }
}

// Hydrilla and coontail — a submerged CANOPY, not a tussock. It grows up off the bottom
// in fine whorled strands and from above reads as a soft dark cloud with no edge of its
// own, so this is more ellipses, smaller, stretched every which way, and the light tone
// nearly absent. What keeps it faint is the layer alpha and the wash, NOT the clump:
// draw the clump pale and the bed disappears at the rim first, which is the wrong half to
// lose — the rim is where a sailor decides whether to cross.
function clumpCanopy(g, cx, cy, scale, rand, tones, alpha) {
    const cs = (9 + rand() * 11) * scale;
    const n = 4 + Math.floor(rand() * 4);
    for (let b = 0; b < n; b++) {
        const t = rand();
        const tone = tones[t < 0.62 ? 0 : t < 0.92 ? 1 : 2];
        g.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha})`;
        g.beginPath();
        g.ellipse(cx + (rand() - 0.5) * cs * 1.3, cy + (rand() - 0.5) * cs * 1.3,
                  cs * (0.2 + rand() * 0.26), cs * (0.14 + rand() * 0.2),
                  rand() * Math.PI, 0, Math.PI * 2);
        g.fill();
    }
}

// A lily pad, and THE NOTCH IS THE WHOLE SILHOUETTE: Nymphaea and Nuphar both carry a
// wedge cut from one side in to the centre, and at this size that single feature is what
// separates a pad from a blob of algae. Drawn as an arc closed through its own centre — a
// filled circle minus a wedge — at an arbitrary rotation, because a bed of pads all
// notched the same way is the tell that they were stamped rather than grown.
//
// SIZE follows the art pipeline's own answer instead of a fresh guess: bayou-lilypad is
// declared at world 18, so pads here run 11..19 across and the composed sprite and the
// procedural bed agree about how big a lily pad is.
//
// One in sixteen is in flower. It is the venue's only bright accent, and it is worth
// having: olive on olive on olive is what this place looks like, and a white star in it
// is how you notice the bed at all.
function clumpPad(g, cx, cy, scale, rand, tones, alpha) {
    const n = 1 + (rand() < 0.55 ? 1 : 0);
    for (let b = 0; b < n; b++) {
        const r = (5.5 + rand() * 4) * scale;
        const t = rand();
        const tone = tones[t < 0.5 ? 0 : t < 0.85 ? 1 : 2];
        const a0 = rand() * Math.PI * 2;
        const notch = 0.28 + rand() * 0.2;          // radians of missing wedge
        const px = cx + (rand() - 0.5) * r * 2.4, py = cy + (rand() - 0.5) * r * 2.4;
        g.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha})`;
        g.beginPath();
        g.moveTo(px, py);
        g.arc(px, py, r, a0 + notch, a0 + Math.PI * 2 - notch);
        g.closePath();
        g.fill();
        if (rand() < 0.0625) {
            g.fillStyle = `rgba(238,236,220,${alpha})`;
            g.beginPath();
            g.arc(px, py, r * 0.3, 0, Math.PI * 2);
            g.fill();
        }
    }
}

// Water hyacinth — a RAFT, so the read is coverage rather than clumps: the rosettes touch
// each other and the mat carries a hard outer edge where wind has shoved it up against
// something. Each rosette is a round leaf cluster with a lighter crown, and roughly one in
// twenty carries the lavender flower spike that makes hyacinth unmistakable at any scale.
function clumpRosette(g, cx, cy, scale, rand, tones, alpha) {
    const cs = (6 + rand() * 6) * scale;
    const n = 3 + Math.floor(rand() * 3);
    for (let b = 0; b < n; b++) {
        const t = rand();
        const tone = tones[t < 0.45 ? 0 : t < 0.85 ? 1 : 2];
        g.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha})`;
        g.beginPath();
        g.ellipse(cx + (rand() - 0.5) * cs * 1.6, cy + (rand() - 0.5) * cs * 1.6,
                  cs * (0.42 + rand() * 0.3), cs * (0.38 + rand() * 0.28),
                  rand() * Math.PI, 0, Math.PI * 2);
        g.fill();
    }
    if (rand() < 0.05) {
        g.fillStyle = `rgba(178,158,214,${alpha})`;
        g.beginPath();
        g.ellipse(cx + (rand() - 0.5) * cs, cy + (rand() - 0.5) * cs,
                  cs * 0.2, cs * 0.3, rand() * Math.PI, 0, Math.PI * 2);
        g.fill();
    }
}

// Lemna. An individual duckweed plant is about 3 mm across, so at this altitude it is not
// objects at all — it is a FILM. Many tiny flecks at a tight spacing, near-uniform in
// tone, which buys the one property this plant is here for: an unbroken green surface,
// against which anything that opens a lane through it is instantly legible.
function clumpFleck(g, cx, cy, scale, rand, tones, alpha) {
    const cs = (3 + rand() * 3) * scale;
    const n = 5 + Math.floor(rand() * 4);
    for (let b = 0; b < n; b++) {
        const t = rand();
        const tone = tones[t < 0.5 ? 0 : t < 0.85 ? 1 : 2];
        g.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha})`;
        g.beginPath();
        g.ellipse(cx + (rand() - 0.5) * cs * 3, cy + (rand() - 0.5) * cs * 3,
                  cs * 0.5, cs * 0.42, rand() * Math.PI, 0, Math.PI * 2);
        g.fill();
    }
}

// tones      dark / mid / light, PRE-submersion. A bottom plant's three greens go through
//            submergedTint like the shoal's sand — grass and bar are the same bottom under
//            the same light, so Pearl Lagoon shows bright olive through turquoise and a
//            night venue shows a dark smudge, automatically. A surface plant's do not.
// wash       bottom only: how far past submergedTint the tones are pulled toward the
//            water. A bed is a stain on the seabed and a stain is mostly water.
// layerAlpha the whole baked layer's opacity — the knob for how much this plant asserts.
// clumpAlpha per-clump; overlap is what builds the darker heart of a patch.
// spacing    world units between scatter candidates. Small = dense = a mat, not a bed.
// cover      the density ceiling in the bed's own interior, before rim and holes thin it.
// holeEvery  one carved hole per this many units of radius (min 2), so a big bed is
//            patchwork rather than carpet.
// mass       optional {tone, alpha}: a soft-edged fill of the whole shape laid down BEFORE
//            the clumps. Absent for a BED, where the water between plants is the point —
//            present for a SURFACE, where it is not.
//
//            This is the difference between a raft and a scatter, and scatter is what you
//            get without it: the first hyacinth mat was clumps alone at cover 0.97, and it
//            still read as confetti on open water, because however tight the spacing gets,
//            round clumps on a transparent ground leave channels between them. A mat has
//            no channels — that is what makes it a mat and what makes ploughing one cost
//            three-quarters of your speed. Same device the reef mass uses, same reason.
const VEG_STYLES = {
    // Pearl Lagoon's meadow. Every number here is the one the seagrass bake shipped with.
    seagrass: { plane: 'bottom', clump: clumpTussock,
                tones: [[43, 74, 45], [58, 94, 52], [74, 112, 58]],
                wash: 0.3, layerAlpha: 0.66, clumpAlpha: 0.85,
                spacing: 24, cover: 0.9, holeEvery: 150 },

    // ── THE BAYOU'S FOUR ────────────────────────────────────────────────────
    // Submerged hydrilla — the keel-grabber, and the one you are meant to half-see. It is
    // FAINT ON PURPOSE AND VISIBLE ON PURPOSE: a 0.6-drag bed you cannot see at all is
    // the unfair trap the mudflat note argues against, and a bed as loud as a lily pad
    // would stop being the thing you notice a beat too late. These two numbers are the
    // whole dial — layerAlpha for how much of it survives, wash for how much water is
    // mixed into it — and they are the first place to go if it reads wrong on screen.
    weedbed:  { plane: 'bottom', clump: clumpCanopy,
                tones: [[30, 52, 32], [42, 68, 40], [56, 86, 48]],
                wash: 0.4, layerAlpha: 0.45, clumpAlpha: 0.8,
                spacing: 20, cover: 0.95, holeEvery: 190 },
    // Rooted lilies: pads ON the surface, bed FIXED to the bottom. NO mass — discrete
    // objects with open water between them, so the spacing is loose and the cover never
    // closes. Seeing the black channel between pads is what a lily bed looks like, and it
    // is also the one thing keeping it from reading as a hyacinth mat.
    //
    // Tones were raised a full step after the first render: a pad in sunlight is
    // distinctly brighter and yellower than the water it floats on, and picked at the
    // water's own value the whole bed came out as a texture rather than as objects. What
    // sells a floating leaf is that it is LIT and the water is not.
    //
    // unitsPerPx 1 — THE ONLY STYLE THAT ASKS FOR IT, and the reason is the pad itself. Every
    // other row here is a texture, where the shared 2.5 costs nothing you can see. A pad is an
    // OBJECT with a hard edge and a notch cut in it, and at 2.5 it was rasterised 6px across
    // to be displayed at 15 — soft blobs with the notch smeared out, which is the one feature
    // separating a lily bed from algae. See bakeVegSprite for the full argument; the cost is
    // one 1786px canvas baked once per race.
    lilybed:  { plane: 'surface', clump: clumpPad, unitsPerPx: 1,
                tones: [[92, 124, 58], [122, 156, 74], [152, 186, 96]],
                wash: 0, layerAlpha: 0.95, clumpAlpha: 0.95,
                spacing: 26, cover: 0.82, holeEvery: 170 },
    // The hyacinth raft: a MASS with rosettes worked over it, tightest spacing and highest
    // cover in the table. Every one of those says the same thing — this is a surface you
    // plough, not a garden you sail between. Few holes for the same reason.
    weedmat:  { plane: 'surface', clump: clumpRosette,
                tones: [[70, 104, 52], [100, 134, 68], [132, 166, 92]],
                mass: { tone: [112, 148, 70], alpha: 0.88 },
                wash: 0, layerAlpha: 0.96, clumpAlpha: 0.94,
                spacing: 13, cover: 0.97, holeEvery: 220 },
    // The film, and a film is nothing BUT mass — the flecks are the grain on top of it.
    // Brightest tones in the table, because Lemna is a vivid yellow-green and is the
    // lightest thing on this venue's water: its entire job is contrast against the
    // tannin-dark channel it lies on, so that a lane opened through it is unmissable.
    duckweed: { plane: 'surface', clump: clumpFleck,
                tones: [[112, 146, 62], [132, 166, 76], [150, 182, 92]],
                mass: { tone: [126, 160, 74], alpha: 0.8 },
                wash: 0, layerAlpha: 0.82, clumpAlpha: 0.9,
                spacing: 9, cover: 0.98, holeEvery: 260 }
};

function vegTone(base, spec) {
    // ON the water: lit by the sky directly, so nothing is done to it. A floating mat put
    // through submergedTint would be a mat painted the colour of the bottom.
    if (spec.plane === 'surface') return base.slice();
    const t = submergedTint(base);
    const W = window.WATER_CONFIG || {};
    const hex = String(W.heroColor || W.baseColor || '#0ea5e9').replace('#', '');
    const w = [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
    return t.map((c, i) => Math.round(c * (1 - spec.wash) + w[i] * spec.wash));
}

function bakeVegSprite(isl, spec) {
    const tones = spec.tones.map(t => vegTone(t, spec));
    const R = isl.radius + 10;
    // ── HOW FINE TO BAKE, AND WHY IT IS A PER-STYLE QUESTION ────────────────
    // This used to borrow SHOAL_UNITS_PER_PX outright, and that constant carries its own
    // justification: 2.5 is safe "because this is a smooth gradient with no detail to lose,
    // and it upscales for free". That is TRUE OF A SHOAL and true of the mass below — and
    // false of anything with an edge in it. A lily bed is discrete objects: at 2.5 a 15-unit
    // pad was rasterised 6px across and then blown back up to 15 on screen, so every pad
    // arrived as a soft blob and the notch that is supposed to say "lily pad rather than
    // algae" was the first thing to dissolve.
    //
    // So the number belongs to the STYLE. Anything that reads as a texture keeps 2.5 and
    // costs what it always did; a style made of objects asks for 1 and gets rasterised at
    // the size it is drawn, with no upscale between the arc and the screen.
    //
    // The cap moves 1024 -> 2048 to let that happen: the biggest bed in the game needs
    // 1786px at 1 unit/px. It is inert for every style still on 2.5 — the largest of those
    // asks for 715px — so nothing that did not opt in changes size, cost or appearance.
    const upp = spec.unitsPerPx || SHOAL_UNITS_PER_PX;
    const px = Math.max(32, Math.min(2048, Math.ceil((R * 2) / upp)));
    const scale = px / (R * 2);
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const g = cv.getContext('2d');

    // Seeded from the shape's id, so the layout is the venue's, not the session's.
    let seed = 2166136261;
    for (const ch of String(isl.id || 'seagrass')) seed = ((seed ^ ch.charCodeAt(0)) * 16777619) >>> 0;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

    // The unkeyholed rings (outer + holes), same source of truth the shoal depth read
    // uses — the keyholed trace's zero-width slit would put a false edge across the bed.
    const rings = isl.shoalRings || [isl.vertices.map(v => [v.x, v.y])];
    const inRing = (x, y, ring) => {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i], [xj, yj] = ring[j];
            if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    };
    const edgeDist = (x, y) => {
        let d2 = Infinity;
        for (const ring of rings) {
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const [x1, y1] = ring[j], [x2, y2] = ring[i];
                const dx = x2 - x1, dy = y2 - y1;
                const L2 = dx * dx + dy * dy || 1;
                const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L2));
                const px_ = x1 + t * dx - x, py_ = y1 + t * dy - y;
                const dd = px_ * px_ + py_ * py_;
                if (dd < d2) d2 = dd;
            }
        }
        return Math.sqrt(d2);
    };
    const inside = (x, y) => {
        if (!inRing(x, y, rings[0])) return false;
        for (let h = 1; h < rings.length; h++) if (inRing(x, y, rings[h])) return false;
        return true;
    };

    // Open-water holes: a handful of soft low-density ellipses, scaled to the bed. These
    // are what keep a big bed from reading as one stamped carpet.
    const holeN = Math.max(2, Math.round(isl.radius / spec.holeEvery));
    const holes = [];
    for (let i = 0; i < holeN; i++) {
        holes.push({ x: isl.x + (rand() * 2 - 1) * isl.radius * 0.7,
                     y: isl.y + (rand() * 2 - 1) * isl.radius * 0.7,
                     r: isl.radius * (0.12 + rand() * 0.14) });
    }
    const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const feather = isl.shoalFeather || 120;

    // THE MASS, under the clumps, for the plants that are a surface rather than a bed.
    //
    // RASTERISED FROM THE SHAPE'S OWN EDGE RAMP, not blurred, and the difference is not
    // cosmetic. A canvas blur is a fixed number of PIXELS while the ramp is a distance in
    // the WORLD, so the two agree at exactly one sprite size and nowhere else — the first
    // attempt asked for blur(feather/2.5 * scale) and got 15px of smear on a 160px sprite,
    // which erased the mass it was meant to soften. Rasterising uses the same
    // distance-to-edge the clump density uses, so the mat's opacity, its thinning rosettes
    // and its drag all feather over one band: the edge you see is the edge you feel.
    //
    // Baked small and scaled up. A mass is a smooth gradient with no detail to lose, so the
    // upscale is free and it keeps the per-pixel ring walk cheap.
    if (spec.mass) {
        const m = vegTone(spec.mass.tone, spec);
        const mp = Math.max(24, Math.min(96, px));
        const mc = document.createElement('canvas');
        mc.width = mc.height = mp;
        const mg = mc.getContext('2d');
        const img = mg.createImageData(mp, mp);
        const d = img.data;
        const step = (R * 2) / mp;
        for (let j = 0; j < mp; j++) {
            const wy = isl.y - R + (j + 0.5) * step;
            for (let i = 0; i < mp; i++) {
                const wx = isl.x - R + (i + 0.5) * step;
                const o = (j * mp + i) * 4;
                d[o] = m[0]; d[o + 1] = m[1]; d[o + 2] = m[2];
                d[o + 3] = inside(wx, wy)
                    ? Math.round(255 * spec.mass.alpha * smooth(edgeDist(wx, wy) / feather))
                    : 0;
            }
        }
        mg.putImageData(img, 0, 0);
        g.imageSmoothingQuality = 'high';
        g.drawImage(mc, 0, 0, px, px);
    }

    // Jittered-grid scatter over the bbox: even coverage without Poisson bookkeeping.
    const minX = isl.x - isl.radius, minY = isl.y - isl.radius;
    const cells = Math.max(1, Math.ceil((isl.radius * 2) / spec.spacing));
    for (let gy = 0; gy < cells; gy++) {
        for (let gx = 0; gx < cells; gx++) {
            const wx = minX + (gx + 0.15 + rand() * 0.7) * spec.spacing;
            const wy = minY + (gy + 0.15 + rand() * 0.7) * spec.spacing;
            if (!inside(wx, wy)) continue;
            // Rim thinning: full density a feather in from the edge, none at the rim.
            let p = smooth(edgeDist(wx, wy) / feather) * spec.cover;
            for (const h of holes) {
                const hd = Math.hypot(wx - h.x, wy - h.y);
                if (hd < h.r) p *= 0.12 + 0.88 * smooth(hd / h.r);
            }
            if (rand() >= p) continue;
            const cx = (wx - isl.x + R) * scale, cy = (wy - isl.y + R) * scale;
            spec.clump(g, cx, cy, scale, rand, tones, spec.clumpAlpha);
        }
    }
    isl._vegSprite = { canvas: cv, r: R, tint: tones[0].join(',') };
}

// ── CORAL REEF ──────────────────────────────────────────────────────────────
//
// The third painted bottom, and the first that is also a WALL (its collision comes from
// the shape itself — soft by kind, so you grind along it rather than sticking to it).
// The picture: a dark reef-rock mass with a tight feathered rim, worked over with a
// DENSE field of touching coral clumps in the six pastel families the coral-head
// sprites established, each clump sitting on its own relief shadow. Submersion comes
// from ONE submergedTint wash plus the translucency that lets the ripple lattice read
// through — the reef's own job is structure, and it must stay legible as the one
// bottom you cannot sail into.
// Palette and structure matched to the owner's reference plate (sampled 2026-08-08):
// the reef BAND is olive-khaki RUBBLE — dark seams #4f6148, mid #747f63, pale #9da795
// on screen — and the pinks/lavenders/purples arrive as clustered COLONIES inside it,
// patches the size of a coral garden, never an even confetti. Occasional pale sand
// pockets open inside the band. Bases below are pre-wash: submergedTint plus the 0.7
// draw alpha green them toward the reference's own drowned reading.
const REEF_RUBBLE = [
    [110, 96, 48],     // dark seam khaki
    [168, 146, 92],    // mid rubble
    [204, 190, 146]    // pale worn rubble
    // A notch warmer than the reference's own screen values on purpose: submergedTint
    // pulls everything toward the turquoise hero, so the bases must overshoot brown to
    // land on the plate's olive.
];
// Colony accents, tuned for what they become AFTER the wash — the hero water adds
// roughly +119 green-over-red to everything, so a base keeps its identity only by
// overshooting its own hue (a pink needs R-G >= ~110 at base to still read pink).
// Post-wash these land as dusty rose, periwinkle, gold-green and bright mint: four
// distinct gardens, every one of them pulled toward the green by the water itself,
// which is what keeps the band reading as one reef rather than confetti.
const REEF_ACCENTS = [
    [245, 108, 124],   // -> dusty rose
    [150, 125, 195],   // -> periwinkle
    [225, 175, 85],    // -> gold-green
    [140, 210, 170]    // -> bright mint
];
const REEF_SAND = [225, 214, 178];   // the pockets that open inside the band
const REEF_DARK = [40, 44, 30];      // relief shadow under every clump
const REEF_BASE = [70, 66, 44];      // the rock mass the rubble sits on
const REEF_ALPHA = 0.7;
// ── THE SAME BAKE, IN STONE ─────────────────────────────────────────────────
// A `sunkenrock` is a reef in every structural sense — a submerged solid drawn on the
// bottom — so it shares the geometry (blurred mass, feathered rim, clump field) and
// differs only in palette and in how colour is DISTRIBUTED. A coral reef is a garden:
// colour arrives in patches, because colonies and sand pockets are separate organisms
// and separate ground. A drowned rock is ONE material, so the patch grid is bypassed
// entirely and the clumps just read as boulders and shadow. Patching stone would look
// like lichen, which is the one thing a thing underwater cannot have.
//
// Bases overshoot COOL here where the coral bases overshoot warm, and for the mirror
// reason: these sit under Glowtide's indigo, not a turquoise lagoon, and karst is a
// neutral-cool grey that goes olive the moment anything warm is left in it. Same
// simultaneous-contrast trap the karst body colour hit in air (see ISLAND_STYLES.karst).
// ⚠️ THE FOUR PLANES ARE GRANITE'S OWN, BRIGHTENED — not a stone-coloured clump field. A
// drowned rock got the reef's rubble treatment first and read exactly like a reef, because
// rubble is what that field draws. What makes granite read as granite is bakeIslandSprite's
// FACET FAN: flat-shaded triangles from the summit to every edge, four greys, hard edges,
// no gradient anywhere. So this is that same fan, and the only thing the water changes is
// the palette it is painted in.
//
// The values overshoot bright for the same reason the coral bases overshoot warm: they are
// read through submergedTint, which on Glowtide multiplies the spread by ~0.28 and drags
// everything toward a near-black indigo. Granite's literal greys land at luma 19-33 there,
// i.e. a black hole with a slightly less black hole in it. These are pitched so the band
// STRADDLES the water's own ~40: shadowed faces come out near 27, the lit crown near 54.
// That is what makes it a lit stone mass rather than a silhouette.
// ONE SOURCE FOR WHAT THIS ROCK IS MADE OF: ISLAND_STYLES.sunkenrock. The bake used to
// carry its own base colour beside the style's, which meant the minimap, the editor chip
// and the rock itself could drift to three answers about the same stone — the exact split
// the shoal swatch note in editor.js was written about. The style row is the material; this
// is only the water going over it.
//
// ⚠️ THE STYLE BODY IS THE ROCK IN AIR, so it is read UNSUBMERGED and tinted here. Three
// multipliers stand between it and the screen — submergedTint compresses the range to ~0.28
// of itself, the draw alpha takes a cut, and the night wash roughly halves what is left —
// which is why a body that looks like ordinary dark slate in the picker arrives as something
// a good deal closer to the water.
function hexToRgb(h, fb) {
    const s = String(h || '').replace('#', '');
    return s.length === 6
        ? [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
        : fb;
}
// ⚠️ THE WINDOW IS NARROW, AND BOTH ENDS OF IT WERE FOUND THE HARD WAY. The body hex is a
// far weaker knob than it looks, because submergedTint LERPS TOWARD THE WATER: past a point,
// a darker body just buys more water colour. Swept on Glowtide, re-baking between each and
// measuring the MEDIAN over the rock (point samples are useless here — they land on moon
// glitter and wind streaks and swing 20 luma frame to frame):
//
//     bodyLuma  62 -> 22.6      100 -> 27.1      142 -> 31.7
//     fit: on-screen luma = 0.118 * bodyLuma + 15.2, against water at ~24
//
// Owner-judged, and this is the part no measurement gives you: bodyLuma 124 read as TOO
// LIGHT (a rock brighter than the sea it is under) and bodyLuma 24 as TOO DARK (a hole, not
// a stone). The value below is the midpoint of that bracket. Anything under ~26 on screen is
// wasted effort in any case: the rock is UNDER the surface, so the moon wash, the glitter
// and the wind waves paint over it afterwards, and past that point you are looking at the
// water and not at the rock.
// ⚠️ HOW DARK THE ROCK READS, and it is the ONLY knob that really moves it. Applied as a
// multiplier on the finished sprite — see the note at the fill site for why the body colour
// cannot do this job.
//
// ⚠️ MEASURE AGAINST *LOCAL* WATER. The first sweep of this compared the slab to a wide ring
// around it, which on this venue catches the karst islands' bio-surf glow and reads ~6 luma
// bright — so every figure came out flattering and two rounds of "too dark" followed a table
// that said the rock was nearly neutral. The numbers below use a ring just outside the slab
// on its open-water side, which is what the eye actually compares it with:
//
//     depth 0.42 -> -8.7   owner: "still too dark"
//     depth 0.60 -> -3.5   <- here: plainly darker than the water, granite still legible
//     depth 0.75 -> +0.9
//     depth 0.88 -> +5.9
//     depth 1.00 -> ~+9    owner: "don't appear dark" (the original bug)
//
// ⚠️ THE CURVE ALSO MOVES WITH THE TILE ALPHA, so re-sweep if that changes: getLandPattern
// draws the granite RAW over the base, and a lighter tile has to be paid for with more
// depth. These are at alpha 0.30.
let SUNKEN_DEPTH = 0.60;
function sunkenGround() {
    return submergedTint(hexToRgb((ISLAND_STYLES.sunkenrock || {}).body, [86, 95, 111]));
}
// ⚠️ NOT REEF_ALPHA. 0.7 is right for coral — a garden is a thing you see INTO, and the
// lost 30% is water over the top of it. A rock is opaque, and at 0.7 nearly a third of the
// facet contrast that survives submergedTint is thrown away again on the way to the screen.
const SUNKEN_ALPHA = 0.95;
const REEF_SPACING = 13;             // dense: the clumps have to TOUCH to read as rubble
const REEF_PATCH = 90;               // world units — the size of a colony or a sand pocket
const REEF_UNITS_PER_PX = 2.0;       // crisper than the drag-field bakes: this is texture, not gradient
function bakeReefSprite(isl) {
    const stone = isl.style === 'sunkenrock';
    const rubble = REEF_RUBBLE.map(t => submergedTint(t));
    const accents = REEF_ACCENTS.map(t => submergedTint(t));
    const sand = submergedTint(REEF_SAND);
    const dark = submergedTint(REEF_DARK);
    const ground = stone ? sunkenGround() : submergedTint(REEF_BASE);
    const R = isl.radius + 80;
    const px = Math.max(32, Math.min(1024, Math.ceil((R * 2) / REEF_UNITS_PER_PX)));
    const scale = px / (R * 2);
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const g = cv.getContext('2d');

    // The reef MASS: dark rock, a tight blurred rim — soft enough to sit in the water,
    // firm enough to read as a thing with an edge.
    const pts = isl.vertices.map(v => ({ x: (v.x - isl.x + R) * scale, y: (v.y - isl.y + R) * scale }));
    const feather = Math.min(40, isl.radius * 0.3);
    const css = (c, a) => a == null ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;

    // ── STONE: A FLAT DARK ROCK IN THE GRANITE TEXTURE ──────────────────────
    // Everything below this block is the coral bake — a clump field, which is the correct
    // drawing of rubble and the wrong drawing of a rock. A drowned head is much simpler than
    // either that or the island bake's lit plane fan: one flat dark body, the granite tile
    // over it, and nothing else. It got the plane fan first and that was over-rendered — a
    // fan is a MOUNTAIN cue, the summit-to-edge shading of something standing up in the air,
    // and there is no summit here to catch light.
    //
    // The granite tile is shared with the arctic's rock rather than reproduced, so the two
    // are literally the same stone; only the base colour under it differs, which is what
    // getLandPattern's per-base cache is for. No coastline STROKE — an outline is the single
    // strongest "this is land" cue, and drawing one would undo the whole object.
    if (stone) {
        const base = css(ground);
        // ⚠️ WORLD SPACE FROM HERE, not sprite pixels, and the reason is the TEXTURE. A
        // pattern tiles in the space it is filled in, so filling in sprite pixels would size
        // the 256px granite tile by the sprite's own scale — coarser on a big rock, finer on
        // a small one, and never matching a granite island. Under this transform the tile is
        // 256 WORLD units wide on every rock, exactly as it is on land.
        g.save();
        g.scale(scale, scale);
        g.translate(R - isl.x, R - isl.y);
        const bx = isl.x - R, by = isl.y - R, bw = R * 2;

        // A soft rim, so the silhouette is a mass in the water rather than a shoreline. It
        // is the one soft thing here; the body inside it is flat.
        g.filter = `blur(${Math.max(1.5, (feather / 1.8) * scale)}px)`;
        g.fillStyle = base;
        traceAngularPoly(g, isl.vertices);
        g.fill();
        g.filter = 'none';

        g.save();
        traceAngularPoly(g, isl.vertices);
        g.clip();
        g.fillStyle = base;
        g.fillRect(bx, by, bw, bw);
        const pat = getLandPattern(g, 'sunkenrock', base);
        if (pat) { g.fillStyle = pat; g.fillRect(bx, by, bw, bw); }
        g.restore();

        // ⚠️ DEPTH, AND IT HAS TO BE APPLIED HERE RATHER THAN IN THE BASE COLOUR. Darkening
        // the body hex barely moves the rock, for two compounding reasons: submergedTint
        // LERPS TOWARD THE WATER, so past a point a darker body just buys more water colour,
        // and getLandPattern draws the granite tile RAW over the base — the tile is a light
        // grey, so it adds a fixed lift that no base colour can take back. Measured, the body
        // hex only buys 0.118 luma of screen per luma of body.
        //
        // A source-atop black scales every pixel already laid down — rim, base and tile
        // together — so the texture keeps its RELATIVE contrast while the whole thing sinks.
        // source-atop and not a plain fill because it must leave the transparent margin alone;
        // a normal fill would paint a black square over the water.
        if (SUNKEN_DEPTH < 1) {
            g.globalCompositeOperation = 'source-atop';
            g.fillStyle = `rgba(0,0,0,${(1 - SUNKEN_DEPTH).toFixed(3)})`;
            g.fillRect(bx - R, by - R, bw * 2, bw * 2);
            g.globalCompositeOperation = 'source-over';
        }

        // THE EDGE. Stroked AFTER the clip is released, so the outer half of the line is not
        // shaved off — clipping to the outline and stroking it inside that clip is how you
        // get a line that looks half its width and reads soft.
        //
        // The same dark-stroke idiom as every land kind, taken from the style table so the
        // two follow each other, and submerged like everything else here. It works for the
        // opposite reason it does on land: there a dark line separates a LIGHT body from
        // darker water, here the body and the water are close in value (41 against 36) and
        // the line is darker than both, so it is the edge that carries the shape.
        const stEdge = (ISLAND_STYLES[isl.style] || {}).stroke;
        g.strokeStyle = css(submergedTint(hexToRgb(stEdge, [22, 24, 28])));
        g.lineWidth = 2.5;
        g.lineJoin = 'round';
        traceAngularPoly(g, isl.vertices);
        g.stroke();
        g.restore();
        // ⚠️ DO NOT CACHE AN UNTEXTURED BAKE. The tile arrives asynchronously, and a sprite
        // baked before it lands would keep its flat fill for the whole race — the sprite is
        // only rebuilt when the key changes. A key that cannot match forces one more attempt
        // next frame, and it stops as soon as the image is in.
        isl._reefSprite = { canvas: cv, r: R, tint: pat ? ground.join(',') : '__untextured' };
        return;
    }

    g.filter = `blur(${Math.max(1, (feather / 3) * scale)}px)`;
    g.globalAlpha = 0.95;
    g.fillStyle = css(ground);
    traceRoundedPoly(g, pts);
    g.fill();
    g.filter = 'none';
    g.globalAlpha = 1;

    // The rubble and its colonies: seeded, dense, chunky, every clump on its own shadow.
    // COLOUR ARRIVES IN PATCHES — a coarse REEF_PATCH grid is hashed per cell, and a
    // cell is either plain rubble, one accent colony (rose, lavender or purple —
    // the whole cell leans that one way), or a pale sand pocket. That patching is the
    // reference plate's structure: gardens inside a khaki band, never even confetti.
    let seed = 2166136261;
    for (const ch of String(isl.id || 'reef')) seed = ((seed ^ ch.charCodeAt(0)) * 16777619) >>> 0;
    const seed0 = seed;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const cellHash = (cx2, cy2) => {
        let h = (seed0 ^ Math.imul(cx2, 73856093) ^ Math.imul(cy2, 19349663)) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const ring = isl.vertices.map(v => [v.x, v.y]);
    const inRing = (x, y) => {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i], [xj, yj] = ring[j];
            if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    };
    const edgeDist = (x, y) => {
        let d2 = Infinity;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [x1, y1] = ring[j], [x2, y2] = ring[i];
            const dx = x2 - x1, dy = y2 - y1;
            const L2 = dx * dx + dy * dy || 1;
            const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L2));
            const qx = x1 + t * dx - x, qy = y1 + t * dy - y;
            if (qx * qx + qy * qy < d2) d2 = qx * qx + qy * qy;
        }
        return Math.sqrt(d2);
    };
    const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const minX = isl.x - isl.radius, minY = isl.y - isl.radius;
    const cells = Math.max(1, Math.ceil((isl.radius * 2) / REEF_SPACING));
    for (let gy = 0; gy < cells; gy++) {
        for (let gx = 0; gx < cells; gx++) {
            const wx = minX + (gx + 0.15 + rand() * 0.7) * REEF_SPACING;
            const wy = minY + (gy + 0.15 + rand() * 0.7) * REEF_SPACING;
            if (!inRing(wx, wy)) continue;
            if (rand() >= smooth(edgeDist(wx, wy) / feather) * 0.95) continue;
            const pc = cellHash(Math.floor(wx / REEF_PATCH), Math.floor(wy / REEF_PATCH));
            let tone;
            const r0 = rand();
            if (pc < 0.06) {
                // Sand pocket: pale floor with worn rubble at its edges.
                tone = r0 < 0.7 ? sand : rubble[2];
            } else if (pc < 0.28) {
                // Colony cell: the whole cell leans ONE accent, cut with mid rubble.
                const acc = accents[Math.floor(pc * 997) % accents.length];
                tone = r0 < 0.68 ? acc : rubble[1 + (r0 < 0.84 ? 0 : 1)];
            } else {
                // Plain band: dark seams, mid mass, pale wear.
                tone = r0 < 0.25 ? rubble[0] : r0 < 0.7 ? rubble[1] : rubble[2];
            }
            const cx = (wx - isl.x + R) * scale, cy = (wy - isl.y + R) * scale;
            const cs = (11 + rand() * 16) * scale;
            const n = 2 + Math.floor(rand() * 3);
            for (let b = 0; b < n; b++) {
                const ex = cx + (rand() - 0.5) * cs, ey = cy + (rand() - 0.5) * cs;
                const rx = cs * (0.3 + rand() * 0.3), ry = cs * (0.22 + rand() * 0.25);
                const rot = rand() * Math.PI;
                g.fillStyle = `rgba(${dark[0]},${dark[1]},${dark[2]},0.47)`;
                g.beginPath();
                g.ellipse(ex + 3.6 * scale, ey + 6 * scale, rx, ry, rot, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},0.92)`;
                g.beginPath();
                g.ellipse(ex, ey, rx, ry, rot, 0, Math.PI * 2);
                g.fill();
            }
        }
    }
    isl._reefSprite = { canvas: cv, r: R, tint: ground.join(',') };
}

// With the bottom layers: over the sand and the weed, under the seabed props (a coral
// HEAD placed on a reef draws over it) and under everything at the surface.
function drawReefs(ctx) {
    if (!state.course || !state.course._hasReefs) return 0;
    // ⚠️ THE KEY IS PER MATERIAL. The bake stamps the sprite with the tint of the ground it
    // used, and this test re-bakes when the water has moved under it. A stone reef bakes
    // from the sunkenrock style, so checking every shape against the coral key would find a
    // permanent mismatch and re-bake a full sprite EVERY FRAME — invisible on screen and
    // ruinous off it.
    const tintKey = submergedTint(REEF_BASE).join(',');
    const stoneKey = sunkenGround().join(',');
    const viewRadius = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;
    const camX = state.camera.x, camY = state.camera.y;
    let drawn = 0;
    for (const isl of state.course.islands) {
        if (!isl.reef || isl.hidden) continue;
        const limit = viewRadius + isl.radius;
        if ((isl.x - camX) ** 2 + (isl.y - camY) ** 2 > limit ** 2) continue;
        const isStone = isl.style === 'sunkenrock';
        const want = isStone ? stoneKey : tintKey;
        if (!isl._reefSprite || isl._reefSprite.tint !== want) bakeReefSprite(isl);
        const s = isl._reefSprite;
        ctx.save();
        ctx.globalAlpha = isStone ? SUNKEN_ALPHA : REEF_ALPHA;
        ctx.drawImage(s.canvas, isl.x - s.r, isl.y - s.r, s.r * 2, s.r * 2);
        ctx.restore();
        drawn++;
    }
    return drawn;
}

// Called twice per frame, once per plane, and the two calls sit in very different places
// in the render order — see the VEG_STYLES header for why that is the whole point.
//
// 'bottom' runs OVER THE SHOAL SAND (grass grows on the bar) and under everything at the
// surface, like the other seabed layers. 'surface' runs after the water is finished being
// water: the mat is the last thing between the sea and the fleet.
function drawVegetation(ctx, plane) {
    if (!state.course || !state.course._hasVeg) return 0;
    const viewRadius = cullRadius(ctx);
    const camX = state.camera.x, camY = state.camera.y;
    const view = viewBoxWorld(ctx);
    let drawn = 0;
    for (const isl of state.course.islands) {
        if (!isl.veg || isl.hidden) continue;
        const spec = VEG_STYLES[isl.veg];
        if (!spec || spec.plane !== plane) continue;
        const limit = viewRadius + isl.radius;
        if ((isl.x - camX) ** 2 + (isl.y - camY) ** 2 > limit ** 2) continue;
        // Keyed on the tint like the shoal bake: a venue swap or a live palette edit
        // rebakes rather than leaving last venue's light on this one. A surface plant's
        // tones do not depend on the water, so its key is constant and it never rebakes,
        // which is correct — nothing about it changed.
        const tintKey = vegTone(spec.tones[0], spec).join(',');
        if (!isl._vegSprite || isl._vegSprite.tint !== tintKey) bakeVegSprite(isl, spec);
        const s = isl._vegSprite;
        ctx.save();
        ctx.globalAlpha = spec.layerAlpha;
        drawZoneSprite(ctx, s.canvas, isl.x, isl.y, s.r, view);
        ctx.restore();
        drawn++;
    }
    return drawn;
}

// UNDER EVERYTHING ON THE WATER, and that is the whole statement the layer makes. The
// swell, the wakes, the cat's-paws, the wind waves and the nav aids are all things
// happening AT the surface; the bar is beneath it, so it is painted before all of them and
// they run across it unbroken. Draw it with the land instead and it acquires a coastline
// the moment a wake stops at its edge.
// ── DRAW ONLY THE PART OF A BAKED SPRITE THAT IS ON SCREEN ──────────────────
// A baked zone sprite covers a world square, and the biggest ones are enormous: a weed bed
// bakes up to 1786px at one unit per pixel, so a bed whose corner clips the viewport still
// costs a full 1786x1786 composite. Culling by radius only decides WHETHER to draw it; this
// decides HOW MUCH.
//
// Measured on the planted bayou, the weed layers were 51% of the frame — drawVegetation 8.9 ms
// and drawShoals 4.9 ms of a 27 ms frame — on a venue that is 106 weed shapes over 16 mudflats.
// Most of those shapes are larger than the screen.
//
// The visible region is a ROTATED rectangle, because the race camera turns with the boat, so
// the box below is its circumscribed AABB: conservative, cheap, and never clips something the
// player can see. Sub-rect drawImage maps source to destination one-to-one, so nothing moves.
function viewBoxWorld(ctx) {
    const R = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.5 + 8;
    return { x0: state.camera.x - R, y0: state.camera.y - R,
             x1: state.camera.x + R, y1: state.camera.y + R };
}

function drawZoneSprite(ctx, canvas, cx, cy, r, view) {
    const x0 = cx - r, y0 = cy - r, size = r * 2;
    const ix0 = Math.max(x0, view.x0), iy0 = Math.max(y0, view.y0);
    const ix1 = Math.min(x0 + size, view.x1), iy1 = Math.min(y0 + size, view.y1);
    if (ix1 <= ix0 || iy1 <= iy0) return;
    if (ix1 - ix0 >= size && iy1 - iy0 >= size) {   // fully visible: the plain path
        ctx.drawImage(canvas, x0, y0, size, size);
        return;
    }
    const k = canvas.width / size;
    ctx.drawImage(canvas, (ix0 - x0) * k, (iy0 - y0) * k, (ix1 - ix0) * k, (iy1 - iy0) * k,
                  ix0, iy0, ix1 - ix0, iy1 - iy0);
}

// ── WORLD-ANCHORED LAYER TILES ──────────────────────────────────────────────
// A stratum whose content is STATIC IN WORLD SPACE — the seabed zones, the land, the
// forest interior's canopy — does not need repainting every frame; it needs repainting
// when the camera has moved far enough that new world enters the view. So such a stratum
// renders ONCE into an offscreen tile a margin bigger than the view circle, and the frame
// pays one drawImage. On Pearl Lagoon the seabed alone was four full-screen composites a
// frame (shoals 14.5 ms, veg 13.3, reefs 13.2, shallows 7.5 of a 51 ms frame: the venue
// was fill-rate bound on its own static bottom).
//
// The tile is axis-aligned in WORLD space and blitted through the camera transform, so
// camera rotation costs nothing and never exposes an edge — the tile radius covers the
// view circle at any heading. Rebakes happen when the camera nears the margin, when the
// key changes (palette inputs live in the key), or when an image that was still loading
// at bake time lands (`pending` — sprite art loads lazily, and a tile baked before the
// palms arrived would otherwise stay treeless until the next camera rebake).
//
// The bake drives the REAL layer functions against the tile's own context, so there is
// exactly one drawing of each stratum. Their culls keep working untouched: each culls
// around state.camera — which IS the tile centre at bake time — with a radius derived
// from ctx.canvas dims, and the tile being square makes that radius 1.41x its half-side,
// covering the whole tile.
//
// `bake` may return a draw count; a tile that drew nothing skips its per-frame blit
// (a full-screen drawImage is not free, and most venues lack most strata).
// ⚠️ THE COST MODEL THAT SHAPES ALL OF THIS: in the 2d rasterizer, a full-screen
// drawImage is 0.4 ms AXIS-ALIGNED and ~6 ms under the camera's ROTATION — a 15x cliff,
// measured (eval/_blit_matrix.js), source size nearly irrelevant. Rotation is also why
// the live strata were expensive in the first place: every big zone sprite drawn
// through the rotated camera pays the generic path.
//
//   master   world-axis-aligned, view + 400u margin. Baked by the real layer functions,
//            whose sprite blits land axis-aligned = all fast path. Rebakes on camera
//            margin, key change, course change, or a lazily-loaded image landing.
//   frame    ONE drawImage of the master through the LIVE camera transform, bilinear.
//            Exact rotation, exact position, every frame — pixel-equivalent to drawing
//            the original sprites, so motion stays smooth by construction.
//
// ⚠️ THERE IS DELIBERATELY NO SCREEN-ORIENTED CACHE OF THE ROTATED RESULT. One was
// built (derive once per rotation change, translation-only fast blits after) and it
// benched beautifully on a frozen camera — and JUMPED in play, twice, because this
// game's camera rotation NEVER settles: it exponentially tracks a heading that wobbles
// every frame, so any rotation-quantized cache draws the world at a slightly stale
// angle and then snaps it, forever. The owner saw it immediately ("the water jumps
// around"). A per-frame rotated blit is the cheapest thing that is CORRECT here; where
// even that costs more than the live layer it replaces, the adaptive chooser below
// keeps the live path instead. eval/_water_motion.js is the smoothness gate.
const WORLD_TILE_MARGIN = 400;

function ensureWorldTile(tile, ctx, keyPart, bake) {
    const cam = state.camera;
    const rView = Math.ceil(Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.5);
    const key = rView + '|' + keyPart;
    const moved = (cam.x - tile.cx) ** 2 + (cam.y - tile.cy) ** 2
                > (WORLD_TILE_MARGIN - 8) ** 2;
    const landed = tile.pending && tile.pending.length && tile.pending.some(i => i.complete);
    if (tile.course === state.course && tile.key === key && !moved && !landed) return;
    const r = rView + WORLD_TILE_MARGIN, size = r * 2;
    if (!tile.cv || tile.cv.width !== size) {
        tile.cv = document.createElement('canvas');
        tile.cv.width = tile.cv.height = size;
        tile.g = tile.cv.getContext('2d');
    }
    const g = tile.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, size, size);
    g.setTransform(1, 0, 0, 1, r - cam.x, r - cam.y);   // world -> tile
    tile.pending = [];
    window.__wtBakes = (window.__wtBakes || 0) + 1;   // probe hook: rebake thrash shows here
    const drew = bake(g, tile.pending);
    tile.content = drew === undefined || !!drew;
    tile.drawn = typeof drew === 'number' ? drew : -1;
    tile.course = state.course; tile.key = key;
    tile.cx = cam.x; tile.cy = cam.y; tile.r = r;
}

// Called with ctx in WORLD space (the camera transform applied), like the live layers.
// One bilinear drawImage at the live transform — exact and smooth every frame.
function blitWorldTile(tile, ctx) {
    if (!tile.content) return;
    ctx.drawImage(tile.cv, tile.cx - tile.r, tile.cy - tile.r);
}

// ── THE ADAPTIVE CHOOSER ────────────────────────────────────────────────────
// A rotated master blit costs one screen of the rasterizer's generic path (~6-9 ms
// software, ~free on a GPU); the live path costs one screen PER ZONE STACKED OVER THE
// VIEW — Pearl Lagoon sails between five bars of 13-29 screens each, so its seabed
// paints 4-5 screenfuls a frame (40 ms software), while the open ocean's one vast
// painted zone is a single screenful however huge it is. So the decision is that
// number, computed directly each frame: the summed screen-clamped area of the
// stratum's zone shapes overlapping the view (~30 circle tests, free), smoothed, with
// hysteresis. Above the threshold the stratum blits its tile; below it draws live.
// Both modes render the identical picture, so a mid-race switch is invisible.
//
// ⚠️ Estimators that DID NOT survive, so nobody rebuilds them: per-call performance.now
// (canvas commands queue — it times RECORDING, not raster; locked the wrong mode
// everywhere); whole-frame dt A/B (rAF cadence and vsync swamp the signal whenever the
// frame fits the budget); bake-time item counts and summed sprite areas (hollow rings,
// margin-padded sprites and course-clustered content each mispriced some venue).
// ⚠️ Only the SEABED and FLOAT strata are ever tiled — large, dense, mostly-static
// content. Land, canopy and surface props always draw live: cheap on a GPU, and their
// fades and floes are per-frame anyway.
const STRATUM_FILL_ON = 2.6;    // smoothed screenfuls of zone fill to switch to blit
const STRATUM_FILL_OFF = 2.0;   // ...and back to live (hysteresis)

function adaptiveStratum(tile, ctx, keyPart, bakeFn, liveAllFn, liveDriftFn, fillFn) {
    const c = state.course;
    if (tile.calCourse !== c || tile.calKey !== keyPart) {
        tile.calCourse = c; tile.calKey = keyPart;
        tile.mode = 'live'; tile.fillAvg = null;
    }
    const fill = fillFn(ctx);
    tile.fillAvg = tile.fillAvg === null ? fill : tile.fillAvg * 0.95 + fill * 0.05;
    if (tile.mode === 'live' && tile.fillAvg > STRATUM_FILL_ON) tile.mode = 'blit';
    else if (tile.mode === 'blit' && tile.fillAvg < STRATUM_FILL_OFF) tile.mode = 'live';
    if (tile.mode === 'live') { liveAllFn(ctx); return; }
    ensureWorldTile(tile, ctx, keyPart, bakeFn);
    blitWorldTile(tile, ctx);
    if (liveDriftFn) liveDriftFn(ctx);
}

// Screen-clamped area (in screenfuls) of the given zone class overlapping the view.
function zoneViewFill(ctx, isBottomPlane) {
    const c = state.course;
    if (!c || !c.islands) return 0;
    const S = ctx.canvas.width * ctx.canvas.height;
    const viewR = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.5;
    const cam = state.camera;
    let fill = 0;
    for (const isl of c.islands) {
        if (isl.hidden) continue;
        let zone;
        if (isl.veg) {
            const spec = VEG_STYLES[isl.veg];
            zone = spec && (spec.plane === 'bottom') === isBottomPlane;
        } else {
            zone = isBottomPlane && (isl.paint || isl.awash || isl.reef);
        }
        if (!zone) continue;
        const lim = viewR + isl.radius;
        if ((isl.x - cam.x) ** 2 + (isl.y - cam.y) ** 2 > lim * lim) continue;
        fill += Math.min(Math.PI * isl.radius * isl.radius, S) / S;
    }
    return fill;
}

// THE SEABED UNDERLAY: shallows, shoals, bottom vegetation, reefs — in their stacking
// order. Every tint in these strata derives from the WATER_CONFIG colors in the key
// (see submergedTint), so the tile rebakes exactly when a component sprite would.
const _seabedTile = {};
function drawSeabedUnderlay(ctx) {
    const c = state.course;
    if (!c) return;
    if (!(c._hasShallows || c._hasShoals || c._hasVeg || c._hasReefs)
        && !(c.props && c.props.length)) return;
    const W = window.WATER_CONFIG || {};
    const key = 'seabed|' + (W.heroColor || '') + '|' + (W.shallowColor || '')
              + '|' + (W.baseColor || '');
    adaptiveStratum(_seabedTile, ctx, key,
        (g, pending) =>
            // Seabed props (coral heads and their kin) are static too; they close out
            // the bottom inside the same tile. Drifters draw live after the blit.
            drawShallows(g) + drawShoals(g)
            + drawVegetation(g, 'bottom') + drawReefs(g)
            + drawProps(g, 'seabed', p => p.motion !== 'drift', pending),
        (g) => {
            drawShallows(g);
            drawShoals(g);
            drawVegetation(g, 'bottom');
            drawReefs(g);
            drawProps(g, 'seabed');
        },
        (g) => drawProps(g, 'seabed', p => p.motion === 'drift'),
        (g) => zoneViewFill(g, true));
}

// THE LAND: island sprites and mask landmasses are static; the mask fills in particular
// were live many-vertex pattern-filled paths every frame (Sockeye Run's whole shoreline).
// Floes drift and spin, and the one-pass document order deliberately lets an authored
// venue tuck a floe behind a headland — so a course carrying ANY floe draws live, exactly
// as before (the arctic). The pending images are the palm (island sprites bake treeless
// before it lands and mark themselves unbaked) and the land texture tiles (mask fills
// fall back to flat color until theirs arrive).
// Land, canopy and surface props draw LIVE — see the chooser's header for why their
// area estimates could not be trusted. The wrappers stay so draw() reads as strata.
function drawIslandsCached(ctx) {
    drawIslands(ctx);
}

// THE CANOPY draws live: canopyAlpha is player-relative and its range (20 hulls)
// exceeds the view radius, so ANY crown that overhangs water can be mid-fade on any
// frame — there is nothing static enough here to be worth a tile.
function drawCanopyCached(ctx) {
    drawProps(ctx, 'canopy');
}

// THE FLOATING STRATUM: surface vegetation (a lily bed, a hyacinth mat) and float props
// are static too; only a drifting prop moves, and it draws live OVER the beds — flotsam
// floats over a mat, which is where a drifting thing belongs.
// SURFACE PROPS: a trunk, a beached log — things the ground holds up. Static, same
// split as the canopy: non-drifters bake, drifters draw live over the tile.
function drawSurfacePropsCached(ctx) {
    drawProps(ctx, 'surface');
}

const _floatTile = {};
function drawFloatStratumCached(ctx) {
    const c = state.course;
    if (!c || (!c._hasVeg && !(c.props && c.props.length))) return;
    adaptiveStratum(_floatTile, ctx, 'float',
        (g, pending) =>
            (drawVegetation(g, 'surface') || 0)
            + drawProps(g, 'float', p => p.motion !== 'drift', pending),
        (g) => { drawVegetation(g, 'surface'); drawProps(g, 'float'); },
        (g) => drawProps(g, 'float', p => p.motion === 'drift'),
        (g) => zoneViewFill(g, false));
}

function drawShoals(ctx) {
    if (!state.course || !state.course._hasShoals) return 0;
    const viewRadius = cullRadius(ctx);
    const camX = state.camera.x, camY = state.camera.y;
    const view = viewBoxWorld(ctx);
    let drawn = 0;
    for (const isl of state.course.islands) {
        // Paint zones are drawShallows' business — a 0-drag bake here would be invisible.
        if (!isl.awash || isl.hidden || isl.paint) continue;
        const limit = viewRadius + isl.radius;
        if ((isl.x - camX) ** 2 + (isl.y - camY) ** 2 > limit ** 2) continue;
        // Per island, because the tint is per MATERIAL now (tan bar vs coral-white bar).
        const tint = shoalTintFor(isl).join(',');
        if (!isl._shoalSprite || isl._shoalSprite.tint !== tint) bakeShoalSprite(isl);
        const s = isl._shoalSprite;
        drawZoneSprite(ctx, s.canvas, isl.x, isl.y, s.r, view);
        drawn++;
    }
    return drawn;
}

// Ice is faceted, not rounded — the style guide asks for literal low-poly
// facets and crisp edges, and the aerial references are all hard planes and
// snapped corners. Straight segments where land gets smoothed curves.
function traceAngularPoly(g, vertices) {
    if (vertices.length < 3) return;
    g.beginPath();
    g.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) g.lineTo(vertices[i].x, vertices[i].y);
    g.closePath();
}

function traceRoundedPoly(g, vertices) {
    if (vertices.length < 3) return;
    g.beginPath();
    const last = vertices[vertices.length - 1];
    const first = vertices[0];
    let midX = (last.x + first.x) / 2;
    let midY = (last.y + first.y) / 2;
    g.moveTo(midX, midY);
    for (let i = 0; i < vertices.length; i++) {
        const p = vertices[i];
        const next = vertices[(i + 1) % vertices.length];
        midX = (p.x + next.x) / 2;
        midY = (p.y + next.y) / 2;
        g.quadraticCurveTo(p.x, p.y, midX, midY);
    }
    g.closePath();
}

// Bake one island (glow, body, veg, rocks, trees) into an offscreen sprite.
// Islands are static, so this runs ONCE per island per race. The live path
// previously paid a 30px shadowBlur glow, three curve fills, and double
// ctx.filter tree draws PER FRAME — ablation showed drawIslands alone took the
// swamp from 58 to 12 FPS.
//
// Floes now SPIN, which they could not before. Their sprite is therefore baked
// in the floe's own local frame (origin at its centre, spin zero) and rotated at
// draw time; baking world-space geometry would freeze whatever heading the floe
// happened to hold at bake time and then rotate it a second time on screen.
// The drawn outline is the art shape, not the convex collider.
function bakeIslandSprite(isl) {
    const st = ISLAND_STYLES[isl.style] || ISLAND_STYLES.tropical;
    const isFloe = !!isl.isFloe;
    const VERTS = isFloe ? isl.localArt : isl.vertices;
    const VEG = isFloe ? isl.localVeg : isl.vegVertices;
    const ox = isFloe ? 0 : isl.x, oy = isFloe ? 0 : isl.y;
    // Karst joins ice and granite on the angular tracer: limestone weathers into fissures
    // and sharp ribs, and the rounded tracer would draw it as a sandbank.
    //
    // Coral limestone joins them on the same argument, one island over: makatea is old reef
    // lifted into the air and etched by rain into pinnacles and knife-edged pits, and it is
    // the sharpest natural rock in the game. It also has the most to lose from the rounded
    // tracer of anything here — it shares every shoreline with `coralsand`, so a rounded
    // reef shelf reads as one more sandbar and the venue's hard rim disappears into its own
    // beach. Note this is the ONLY tropical kind on the angular list: `coralsand` and
    // `tropicshoal` stay rounded, which is what makes the rim legible.
    //
    // `coastalscrub`, `tropicscrub` and every other sward stay rounded too — a sward drapes.
    const trace = (isl.style === 'ice' || isl.style === 'granite' || isl.style === 'karst'
                   || isl.style === 'coralrock')
        ? traceAngularPoly : traceRoundedPoly;

    let maxR = isl.radius;
    for (const v of VERTS) {
        const d = Math.sqrt((v.x - ox) ** 2 + (v.y - oy) ** 2);
        if (d > maxR) maxR = d;
    }
    // Glow blur + tree canopy overhang margin; ice needs room for the
    // underwater shelf ring (vertices scaled ~1.3)
    const spriteR = isl.style === 'ice' ? maxR * 1.35 + 60 : maxR + 100;
    // Cap texture size; big islands render slightly downscaled (soft look anyway)
    const scale = Math.min(1, 900 / spriteR);
    const size = Math.max(8, Math.ceil(spriteR * 2 * scale));

    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.scale(scale, scale);
    g.translate(spriteR - ox, spriteR - oy); // shape coords -> sprite space

    if (isl.style === 'ice') {
        // Underwater ice shelf: the drowned shoulder that glows pale turquoise
        // around a real berg — the signature of every aerial reference. Two
        // translucent rings scaled out from the outline.
        const ring = (k) => VERTS.map(v => ({ x: ox + (v.x - ox) * k, y: oy + (v.y - oy) * k }));
        g.save();
        g.fillStyle = 'rgba(74, 144, 200, 0.45)';
        trace(g, ring(1.28));
        g.fill();
        g.fillStyle = 'rgba(120, 180, 226, 0.42)';
        trace(g, ring(1.12));
        g.fill();
        g.restore();
    } else if (window.WATER_CONFIG && window.WATER_CONFIG.shorelineGlowSize > 0) {
        // Shoreline Glow
        g.save();
        g.shadowColor = window.WATER_CONFIG.shorelineColor || '#4ade80';
        g.shadowBlur = window.WATER_CONFIG.shorelineGlowSize * 20;
        g.fillStyle = window.WATER_CONFIG.shorelineColor || '#4ade80';
        g.globalAlpha = window.WATER_CONFIG.shorelineGlowOpacity || 0.5;
        trace(g, VERTS);
        g.fill();
        g.restore();
    }

    // Body
    g.strokeStyle = st.stroke;
    g.lineWidth = 2;
    g.fillStyle = st.body;
    trace(g, VERTS);
    g.stroke();
    g.fill();

    // Vegetation (snow cap on ice)
    g.fillStyle = st.veg;
    trace(g, VEG);
    g.fill();

    // Ice facets: angular translucent blue planes radiating from the centre —
    // the low-poly faceting the style guide asks for, and what reads as relief
    // on the aerial references.
    // Granite: a full fan of flat-shaded faces from the summit to every edge,
    // so the mountain reads as low-poly relief rather than a grey blob. Four
    // flat tones, hard edges, no gradients — the reference art's language.
    if ((isl.style === 'granite' || isl.style === 'karst') && isl.facets && isl.facets.length) {
        const GREY = ['#2a323d', '#39424f', '#4b5563', '#5d6775'];
        for (const f of isl.facets) {
            const v1 = VERTS[f.i % VERTS.length];
            const v2 = VERTS[(f.i + 1) % VERTS.length];
            const step = Math.min(3, Math.max(0, Math.floor((f.lit + 1) * 2)));
            g.fillStyle = GREY[step];
            g.beginPath();
            g.moveTo(ox, oy);              // summit
            g.lineTo(v1.x, v1.y);
            g.lineTo(v2.x, v2.y);
            g.closePath();
            g.fill();
        }
        // Snow catching on the highest faces
        g.fillStyle = 'rgba(226, 240, 252, 0.9)';
        trace(g, VEG);
        g.fill();
    }

    if (isl.style === 'ice' && isl.facets && isl.facets.length) {
        for (const f of isl.facets) {
            const v1 = VERTS[f.i % VERTS.length];
            const v2 = VERTS[(f.i + 1) % VERTS.length];
            g.fillStyle = f.shade < 0.5 ? 'rgba(122, 176, 222, 0.4)' : 'rgba(78, 138, 194, 0.35)';
            g.beginPath();
            g.moveTo(ox + (v1.x - ox) * f.depth, oy + (v1.y - oy) * f.depth);
            g.lineTo(v1.x, v1.y);
            g.lineTo(v2.x, v2.y);
            g.closePath();
            g.fill();
        }
    }

    // Pressure cracks (ice only): thin glacial-blue fractures. Clipped to the
    // outline — a crack is a fracture IN the ice, so none of it may hang in open
    // water. Only this block is clipped, not the whole sprite: land islands let
    // their tree canopies overhang on purpose, and the sprite reserves margin
    // for exactly that.
    if (isl.cracks && isl.cracks.length) {
        g.save();
        trace(g, VERTS); g.clip();
        g.strokeStyle = 'rgba(64, 125, 180, 0.7)';
        g.lineWidth = 3;
        g.lineCap = 'round';
        for (const cr of isl.cracks) {
            g.beginPath();
            g.moveTo(ox + cr.ax, oy + cr.ay);
            g.quadraticCurveTo(ox + cr.mx, oy + cr.my, ox + cr.bx, oy + cr.by);
            g.stroke();
        }
        g.restore();
    }

    // Rocks
    if (isl.rocks) {
        g.fillStyle = st.rock;
        for (const rock of isl.rocks) {
            g.beginPath();
            g.arc(rock.x, rock.y, rock.size, 0, Math.PI * 2);
            g.fill();
            g.save();
            g.clip();
            g.fillStyle = 'rgba(0,0,0,0.1)';
            g.beginPath();
            g.arc(rock.x - rock.size * 0.2, rock.y + rock.size * 0.2, rock.size * 0.8, 0, Math.PI * 2);
            g.fill();
            g.restore();
            g.fillStyle = st.rock;
        }
    }

    // Trees
    if (st.trees && palmImg.complete && palmImg.naturalWidth > 0) {
        for (const t of isl.trees) {
            const tSize = t.size * 4.0;
            g.save();
            g.translate(t.x + 5, t.y + 5);
            g.rotate(t.rotation || 0);
            g.globalAlpha = 0.2;
            g.filter = "brightness(0)";
            g.drawImage(palmImg, -tSize / 2, -tSize / 2, tSize, tSize);
            g.restore();
            g.save();
            g.translate(t.x, t.y);
            g.rotate(t.rotation || 0);
            g.drawImage(palmImg, -tSize / 2, -tSize / 2, tSize, tSize);
            g.restore();
        }
    }

    isl._sprite = { canvas: c, r: spriteR, baked: palmImg.complete && palmImg.naturalWidth > 0 };
}

// `which`: 'land' for static geometry, 'floe' for drifting ice, omitted for all.
// The two are drawn in separate passes so the nav aids can sit BETWEEN them —
// ladder lines and laylines are paint on the water, and ice floats over paint.
function drawIslands(ctx) {
    if (!state.course || !state.course.islands) return 0;

    // Viewport Culling
    const viewRadius = Math.sqrt(ctx.canvas.width ** 2 + ctx.canvas.height ** 2) * 0.6;
    const camX = state.camera.x;
    const camY = state.camera.y;

    let drawn = 0;
    for (const isl of state.course.islands) {
        // Invisible colliders: the river banks draw as one continuous mass in
        // drawRiverShore instead. Awash shapes were already painted UNDER the water by
        // drawShoals — this pass is the world standing above it. A reef collides like
        // land but LIVES on the bottom (drawReefs painted it with the water layers),
        // so drawing it here would stand it up out of the sea as a sand island.
        //
        // ⚠️ THE TEST IS `hidden`, AND IT USED TO BE `isBank`. Those are two different
        // questions and the flag names only one of them: isBank is `!nav` — "keep this
        // out of the visibility graph" — while `hidden` is "do not draw". They agreed
        // for as long as `bank` was the only unrouted DRAWN kind (it is hidden too, so
        // banks are still skipped here), and stopped agreeing the moment the cove got
        // its lane: inland scenery no boat can reach, deliberately unrouted, and
        // deliberately visible. Asking isBank made all three of Lighthouse Cove's
        // village lanes invisible. Anything unrouted that should stay off the screen
        // says so with `hidden`.
        if (isl.hidden || isl.awash || isl.reef) continue;
        const distSq = (isl.x - camX) ** 2 + (isl.y - camY) ** 2;
        const limit = viewRadius + isl.radius;
        if (distSq > limit ** 2) continue;

        // Mask landmasses draw as direct paths, never baked sprites, for two
        // reasons. They are huge — the main one has a 9388-unit radius, far past
        // bakeIslandSprite's 900px cap, so it would come back a blurred postage
        // stamp. And their rings are KEYHOLED: the trace walks into the sound and
        // back out, so the water is a hole in the polygon. Canvas fills nonzero by
        // default, which fills that hole solid and paints the sea white — this
        // has to be 'evenodd'.
        if (isl.fromMask) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(isl.vertices[0].x, isl.vertices[0].y);
            for (let i = 1; i < isl.vertices.length; i++) ctx.lineTo(isl.vertices[i].x, isl.vertices[i].y);
            ctx.closePath();
            const st = ISLAND_STYLES[isl.style] || ISLAND_STYLES.ice;
            // A style with a LAND_TEXTURES entry gets the tiling surface; everything
            // else stays a flat fill. This is the FIXED-land path, so a floe never
            // reaches it — bergs keep their faceted sprite and underwater shelf.
            ctx.fillStyle = getLandPattern(ctx, isl.style, st.body) || st.body;
            ctx.fill('evenodd');
            ctx.strokeStyle = st.stroke;
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.restore();
                drawn++;
            continue;
        }

        // Bake lazily; rebake once the palm image finishes loading. Floes carry
        // no trees and their sprite is spin-canonical, so they never rebake —
        // a rebake would capture their current heading and double it on screen.
        if (!isl._sprite || (!isl.isFloe && !isl._sprite.baked && palmImg.complete && palmImg.naturalWidth > 0)) bakeIslandSprite(isl);
        const s = isl._sprite;
        if (isl.isFloe) {
            ctx.save();
            ctx.translate(isl.x, isl.y);
            ctx.rotate(isl.spin);
            ctx.drawImage(s.canvas, -s.r, -s.r, s.r * 2, s.r * 2);
            ctx.restore();
        } else {
            ctx.drawImage(s.canvas, isl.x - s.r, isl.y - s.r, s.r * 2, s.r * 2);
        }
        drawn++;
    }
    return drawn;
}






// Init
// ─── COURSE ROUTE ────────────────────────────────────────────────────────────
//
// A course is MARKS (physical objects) plus a ROUTE (ordered passage
// instructions). `route[n]` describes leg n: which marks bound it, which way a
// boat must cross, and whether that crossing finishes the race.
//
// This exists to replace `leg % 2 !== 0 ? [2,3] : [0,1]`, which was repeated at
// about a dozen sites. That arithmetic IS a windward-leeward course encoded as a
// formula: marks [0,1] are the start/leeward line and [2,3] the windward gate,
// forever. No other course shape can satisfy it — which is why `islandRound` has
// to park two unused marks at [2] and [3] purely so the formula does not throw,
// and why it once drew a phantom gate at them.
//
// Route entry:
//   { kind: 'line'|'gate', marks: [i, j], dir: +1|-1, beat: bool, finish?: bool }
//   { kind: 'round', side: 'starboard'|'port' }              (mark is course.roundMark)
//
// `dir` is the sign of the crossing against the gate normal n = (dy, -dx), which
// is why mark ORDER within a pair is load-bearing and not cosmetic.
function resetGame() {
    // The compile cache exists so ONE reset's many compile consumers (the editor's
    // checks, stats and inspectors) pay for one compile. A new reset may follow a
    // document edited in place — the editor's, or a test's — so the cache dies here,
    // at the one gate every rebuild passes through.
    if (window.VenueDoc && window.VenueDoc.invalidateCompile) window.VenueDoc.invalidateCompile();
    loadSettings();
    if (UI.resultsOverlay) UI.resultsOverlay.classList.add('hidden');
    state.camera.target = 'boat';
    state.wind.baseSpeed = 8 + Math.random()*10;
    state.wind.speed = state.wind.baseSpeed;
    state.wind.baseDirection = Math.random() * Math.PI * 2;
    state.wind.direction = state.wind.baseDirection; // Random phase
    state.wind.history = [];
    state.wind.debugTimer = 0;
    state.gusts = [];

    // Persistent shift for this race: a slow, one-way veer (+) or back (-) of
    // ~18-28° total over the race, at ~2-4°/min. Creates the "pick the right side"
    // gamble. Sign/rate are randomized per race so neither player nor AI can
    // foresee it; the AI infers it from the wind's low-frequency trend.            // 18-28 deg // deg/sec

    // Randomized Biases for New Wind Model



    // Direction Bias (Variability 5-10% roughly)
    // +/- 0.1 to 0.2 radians
    const directionBias = (Math.random() < 0.5 ? -1 : 1) * (0.1 + Math.random() * 0.1);

    // Current Generation
    // Default to no current
    let currentData = null;

    state.race.conditions = {
        directionBias,
        current: currentData
    };

    // Venue overrides (no-op for Bay — see applyVenueConditions)
    applyVenueConditions();


    // Seed for island generation
    state.race.seed = Math.floor(Math.random() * 1000000);
    state.time = 0;
    if (window.Rules) window.Rules.init();
    state.race.status = 'waiting'; // Wait for user to start

    // Defaults for Race Config (can be overridden by UI)
    // Preserve existing config if set, otherwise use defaults
    state.race.legLength = state.race.legLength || 4000;
    // The player's lap count is a SETTING; a designed course's leg count is a property
    // of the course. Keeping them in one field meant racing Glacier Sound (2 legs) left
    // every later venue on 2 laps instead of 4 — the same shape of leak as legLength.
    state.race.userLegs = state.race.userLegs || state.race.totalLegs || 4;
    state.race.totalLegs = state.race.userLegs;
    state.race.startTimerDuration = state.race.userStartTime || 30.0;

    state.race.timer = state.race.startTimerDuration;

    initCourse();

    // Init Water Renderer
    if (window.WaterRenderer) window.WaterRenderer.init();

    // Pre-populate the sources' cells, so a race opens with its puffs already on the water
    // rather than fading in over the first minute. No sources means none to populate.
    const gregs = state.course.gustRegions;
    if (gregs && gregs.length) {
        let want = 0;
        for (const r of gregs) want += r.count;
        for (let i = 0; i < want; i++) spawnRegionGust(gregs, true);
    }

    state.boats = [];
    if (UI.lbRows) UI.lbRows.innerHTML = '';
    UI.boatRows = {};
    if (UI.resultsList) UI.resultsList.innerHTML = '';
    UI.resultRows = {};
    // The hero and the splits redraw only when their signature changes (they run six times
    // a second), so a new race has to invalidate that signature — otherwise the next
    // results page opens showing the last race's finish. The venue best is likewise
    // decided once per race, on the first render.
    for (const id of ['res-hero', 'res-splits']) {
        const el = document.getElementById(id);
        if (el) delete el.dataset.sig;
    }
    state.race.bestChecked = false;
    state.race.legRecordsSet = [];
    state.race.recordResults = null;
    state.race.bestOutcome = null;

    // Create Boats (Initialized at 0,0, positioned by repositionBoats)
    const pc = playerCharacter();
    const player = new Boat(0, true, 0, 0, pc.name, pc);
    // applySettings() only runs on load/save, so a boat built after that would
    // otherwise ignore a stored Auto Trim = off and start the race auto-trimming.
    player.manualTrim = !settings.autoTrim;
    player.heading = state.wind.direction; // Head to wind
    player.prevHeading = player.heading;
    player.lastWindSide = 0;
    state.boats.push(player);

    // Create AI Boats
    const opponents = [];
    // NEVER RACE YOURSELF. Two boats with one name and one face makes the leaderboard
    // unreadable and the edge indicators ambiguous. The draw count is unchanged at 9, so
    // the rng stream is the same length; only which nine come out differs.
    const available = AI_CONFIG.filter(c => c.name !== settings.character);
    for (let i = 0; i < 9 && available.length > 0; i++) {
        const idx = Math.floor(Math.random() * available.length);
        opponents.push(available[idx]);
        available.splice(idx, 1);
    }

    // Determine favored end for start positioning bias
    const favoredEnd = getFavoredEnd(); // 0 = mark 0 (low pct), 1 = mark 1 (high pct)
    const favorBias = favoredEnd === 1 ? 0.15 : -0.15; // Shift spread toward favored end

    for (let i = 0; i < opponents.length; i++) {
        const config = opponents[i];
        const ai = new Boat(i + 1, false, 0, 0, config.name, config);

        // Initial setup props
        ai.prevHeading = ai.heading;
        ai.lastWindSide = 0;

        // Start Setup: Evenly spaced with small jitter, biased toward favored end
        const numAI = opponents.length;
        const basePos = numAI > 1 ? 0.1 + 0.7 * (i / (numAI - 1)) : 0.5;
        const jitter = (Math.random() - 0.5) * 0.10; // ±5%
        ai.ai.startLinePct = Math.max(0.05, Math.min(0.90, basePos + jitter + favorBias));
        ai.ai.setupDist = 250 + Math.random() * 100;

        state.boats.push(ai);
    }

    repositionBoats();
    // THE CAMERA IS PART OF SETTING THE COURSE. It follows the player by lerping 10% a
    // frame, so a race that starts with it parked over the LAST race's finish line spends
    // its first seconds flying across the water and spinning to the new wind — which is
    // what a Rematch looked like. Boats placed, course built, camera put where the boats
    // are: only then is there anything worth drawing.
    snapCameraToStart();

    state.particles = [];
    state.waveStates.clear();

    // Reset the AI quote system. Its update() consumes Math.random() for quote
    // selection; if its queue/timers carry over between races the number and
    // timing of those random draws leaks across runs, desynchronising any
    // seeded RNG (and leaving stale quotes on screen on a real restart).
    if (!window.__DNS_KEEP_SAYINGS_LEAK) {
        Sayings.queue = [];
        Sayings.current = null;
        Sayings.timer = 0;
        Sayings.silenceTimer = 0;
    }

    hideRaceMessage();

    setupPreRaceOverlay();

    if (settings.soundEnabled || settings.musicEnabled) Sound.init();
    else Sound.updateMusic();
}

// Put the view where the race is, with no travel: the same answer the follow camera would
// converge on a second or two later, taken as the starting value instead. Rotation is read
// from the mode the player chose, so North stays north.
function snapCameraToStart() {
    const p = state.boats[0];
    if (!p) return;
    state.camera.target = 'boat';
    // `fx, fy` is the smoothed FOLLOW point the look-ahead is measured from; the view centre
    // is derived from it every frame. Snapping one without the other would leave the follow
    // point wherever the last race ended and the camera would travel back to the start line
    // over the first second — the exact travel this function exists to avoid.
    state.camera.fx = p.x;
    state.camera.fy = p.y;
    state.camera.rotation = state.camera.mode === 'north' ? 0 : p.heading;
    const look = state.camera.mode === 'heading' ? canvas.height * CAM_LOOK_AHEAD : 0;
    state.camera.x = p.x + Math.sin(state.camera.rotation) * look;
    state.camera.y = p.y - Math.cos(state.camera.rotation) * look;
}

function restartRace() { resetGame(); togglePause(false); }

// Same venue, same fleet, straight back onto the water — the results page's primary
// action, since without a series there is no "next race" to send anyone to. It goes
// through `startRace()` rather than setting the status itself, so the prestart, the audio
// and the leaderboard all come up exactly as they do from the clubhouse.
function rematchRace() { resetGame(); togglePause(false); startRace(); }

resetGame();
requestAnimationFrame(loop);

// Water Debug Logic
function toggleWaterDebug() {
    if (!UI.waterDebug) return;
    UI.waterDebug.classList.toggle('hidden');
    if (!UI.waterDebug.classList.contains('hidden')) {
        initWaterDebugUI();
    }
}

function initWaterDebugUI() {
    if (!UI.waterDebugControls || !window.WATER_CONFIG) return;
    UI.waterDebugControls.innerHTML = ''; // Clear

    const createControl = (key, label, type, min, max, step) => {
        const div = document.createElement('div');
        div.className = "flex flex-col gap-1";

        const header = document.createElement('div');
        header.className = "flex justify-between items-end";

        const lbl = document.createElement('label');
        lbl.textContent = label;
        lbl.className = "text-slate-400 font-bold uppercase text-[10px] tracking-wide";

        const valDisp = document.createElement('span');
        valDisp.className = "t-mono text-cyan-400";
        valDisp.textContent = window.WATER_CONFIG[key];

        header.appendChild(lbl);
        header.appendChild(valDisp);
        div.appendChild(header);

        let input;
        if (type === 'color') {
            input = document.createElement('input');
            input.type = 'color';
            input.value = window.WATER_CONFIG[key];
            input.className = "w-full h-6 bg-slate-800 rounded cursor-pointer border border-slate-600";
        } else {
            input = document.createElement('input');
            input.type = 'range';
            input.min = min;
            input.max = max;
            input.step = step;
            input.value = window.WATER_CONFIG[key];
            input.className = "w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500";
        }

        input.addEventListener('input', (e) => {
            window.WATER_CONFIG[key] = (type === 'range') ? parseFloat(e.target.value) : e.target.value;
            valDisp.textContent = window.WATER_CONFIG[key];
        });

        div.appendChild(input);
        UI.waterDebugControls.appendChild(div);
    };

    createControl('baseColor', 'Base Color', 'color');
    createControl('depthGradientStrength', 'Vignette Strength', 'range', 0, 1, 0.05);
    createControl('contourOpacity', 'Contour Opacity', 'range', 0, 1, 0.05);
    createControl('contourScale', 'Contour Scale', 'range', 0.5, 3.0, 0.1);
    createControl('contourSpacing', 'Contour Spacing', 'range', 10, 100, 5);
    createControl('contourWarp', 'Contour Warp', 'range', 0, 2.0, 0.1);
    createControl('contourSpeed', 'Flow Speed', 'range', 0, 0.1, 0.005);
    createControl('causticOpacity', 'Caustic Opacity', 'range', 0, 1, 0.05);
    createControl('causticScale', 'Caustic Scale', 'range', 0.5, 5.0, 0.1);
    createControl('grainOpacity', 'Grain Opacity', 'range', 0, 0.2, 0.01);
    createControl('shorelineGlowSize', 'Island Glow Size', 'range', 1.0, 3.0, 0.1);
    createControl('shorelineGlowOpacity', 'Island Glow Opacity', 'range', 0, 1, 0.05);
    createControl('shorelineColor', 'Glow Color', 'color');
}

if (UI.waterReset) {
    UI.waterReset.addEventListener('click', () => {
        // Simple reload for defaults or store defaults separately?
        // Let's just reload page for now or hardcode reset if needed.
        // Or store defaults in water.js
        window.location.reload();
    });
}
if (UI.waterClose) UI.waterClose.addEventListener('click', () => {
    if (UI.waterDebug) UI.waterDebug.classList.add('hidden');
});

window.state = state; window.UI = UI; window.updateLeaderboard = updateLeaderboard; window.CONFIG = CONFIG;
// Roster sheet (competitor.html) reads the fleet straight out of the game
window.AI_CONFIG = AI_CONFIG; window.ARCHETYPES = ARCHETYPES;
window.competitorProfileHTML = competitorProfileHTML; window.renderProfileBoat = renderProfileBoat;
