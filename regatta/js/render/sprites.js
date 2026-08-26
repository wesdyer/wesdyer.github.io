// regatta/js/render/sprites.js — sprite assets and bakes: land textures, the
// boat part sprites and hull/spinnaker shading bakes, spinnaker patterns and
// looks, mark and prop sprites, submerged-sprite bake. Pure asset plumbing —
// no per-frame drawing. Classic script; global scope. Extracted verbatim from
// script.js (refactor 2026-08-24).
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
    sunkenrock:   { src: 'assets/images/terrain/arctic/granite.png', tile: 128, alpha: 0.30 },
    // ── THE FIRST GROUND TILE ON A NIGHT VENUE, AND THE ALPHA IS A DIFFERENT SUM ───
    // Delivered 2026-08-25. Every alpha above is judged on the COMPOSITED pattern, because on
    // every other venue that is what reaches the eye. Here drawNightWash multiplies the whole
    // scene afterwards, and it takes a second cut out of the CONTRAST as well as the colour —
    // measured on this tile's own luma variation, a factor of 0.591. So the tile is quieter on
    // screen than its alpha says, and the usual reflex of cutting the alpha would land it at
    // nothing.
    //
    // 0.85 IS MEASURED AND IT IS DELIBERATELY HIGH. Tile sd is 7.53 at 128, so composited it
    // lands 6.40 — the top of the shipped band, beside river mossfloor's 6.69 — and AFTER the
    // wash it lands 3.78, beside lake forestfloor's 3.14 and bay-sand's 3.93, which is where a
    // forest floor belongs. Both readings are inside the band, and that is the point of picking
    // it this way: judge only the post-wash number and the alpha silently breaks the day
    // someone turns `night` down.
    //
    // ⚠️ THE USUAL CEILING IS ABSENT HERE, WHICH IS WHY IT CAN GO THIS HIGH. Raising an alpha
    // normally re-exposes a seam (see coralrock, pinned at 0.20 by exactly that). This tile
    // wraps at 1.06x horizontal and 1.05x vertical against an interior neighbour difference —
    // the cleanest wrap in the game, where the rest run 1.07 to 2.04 — and its periodicity is
    // 2.25 peak/mean, under lake forestfloor's 2.75, which the note there calls the lowest in
    // the game. There is no seam and no repeat to protect, so the only question left was how
    // much of the litter to keep, and the answer is most of it.
    jungle:       { src: 'assets/images/terrain/glowtide/jungle.png', tile: 128, alpha: 0.85 },
    // ── REDROCK RESERVOIR'S TWO NEW GROUNDS — SLOTS, ART NOT YET DELIVERED ──
    // Wired at spec time, the Lighthouse Cove pattern: getLandPattern falls back to the
    // flat body fill until the file lands, so these rows cost nothing today and make
    // delivery a pure asset drop. Both alphas are PRE-REGISTERED, not measured — a guess
    // about a tile that does not exist yet is a starting point and never a spec (the
    // bay-scrub/marsh lesson, learned twice) — so retune each on its delivered luma sd.
    //
    // slickrock: tile 256 with the rocks (granite, sandstone, bay-rock) — bleached benches
    // and domes are metre-scale features. alpha 0.35, the rock precedent. desertsand: tile
    // 128 with the sands, which puts pebbles and chips at true size per bay-sand's measured
    // argument; alpha 0.7, the sand precedent — its structure is broad tonal drift.
    slickrock:    { src: 'assets/images/terrain/redrock/slickrock.png',  tile: 256, alpha: 0.35 },
    desertsand:   { src: 'assets/images/terrain/redrock/desertsand.png', tile: 128, alpha: 0.7 }
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
