#!/usr/bin/env python3
"""Assemble a generation prompt for one manifest asset.

    python3 regatta/art/prompt.py bayou-cypress
    python3 regatta/art/prompt.py --venue swamp        # every slot for a venue
    python3 regatta/art/prompt.py --all-slots

The prompt is built, never hand-written: base style (visual-style.md 11) +
class add-on + role add-on + venue palette commitment (venue-art.md) + the
per-asset subject from the manifest. Hand-writing prompts is how a library
drifts, so this is the only supported way to make one.
"""
import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
MANIFEST = ROOT / "manifest.json"

# venue-art.md palette registry. Dominant hue is a commitment, not a suggestion.
VENUES = {
    "bay":       ("coastal azure and green headlands", "red/green channel buoys, white lighthouse"),
    "lake":      ("deep lake blue and pine green", "warm cabin lights, red/green buoys"),
    "lagoon":    ("pale glowing turquoise and sand", "coral pinks and purples under water"),
    "swamp":     ("olive and yellow-green throughout", "rust roof metal, cattail brown"),
    "river":     ("whitewater teal and tan rock", "stone bridge grey, foam swirls"),
    "ocean":     ("deep open-ocean cobalt", "white cloud, whale blow"),
    "redrock":   ("orange and rust sandstone", "turquoise water"),
    "glowtide":  ("near-black indigo night", "electric cyan bioluminescence, red lit buoy, moon gold"),
    "arctic":    ("steel navy and faceted ice blue-white", "penguin yellow, orca black"),
    "seatrials": ("plain honest blue", "one orange mark"),
    "flats":     ("warm amber-gold drying sandbars", "deep saturated slate-blue channel water, rust-red withy markers"),
}

# The base style was written for top-down props and asserts flat two-tone shading. Portraits
# deliberately go the other way (see the portrait class add-on, decision 3), so a portrait
# built from the unmodified base ARGUES WITH ITSELF — and a generator resolves that by
# ignoring one half at random. One stated substitution beats a contradiction.
BASE_PROP_SHADING = "hard two-tone shading and no soft gradients; "
BASE_PORTRAIT_SHADING = "soft controlled shading modelled inside large clean value masses; "

# ── A MASTER THE ENGINE COLOURS, NOT THE GENERATOR ──────────────────────────
# Same shape of problem as the portrait and texture substitutions above, and the same fix.
# An asset flagged `tintedMaster` is authored WHITE so the game can tint it per instance
# (the multiply-and-cache path `getTintedBoatPart` uses for hulls) — one master supplying
# every hue instead of one master per colour. But the unmodified base demands "vivid
# saturated jewel-toned color" and the venue paragraph closes with "render it in its own
# correct local colour", so the prompt would carry an instruction and its exact opposite.
# This library has already paid for that once: the portrait note records that a prompt
# arguing with itself gets resolved by the generator ignoring one half AT RANDOM.
#
# So the contradiction is removed at the source rather than argued down in the subject.
BASE_TINTED_COLOR = ("painted in WHITE and pale neutral grey only, with the form carried "
                     "entirely by value and no hue anywhere")

# Same reasoning for a TILING TEXTURE, which contradicts the base on three counts. A tile
# has no silhouette (it is a surface, not an object); a baked light direction repeats as
# visible banding every tile width; and jewel-toned saturation is wrong for the thing every
# boat, mark and prop is drawn ON TOP of. Faceted planes and minimal microtexture survive
# unchanged — they are exactly the language a low-poly ground wants.
BASE_TEXTURE_SUBS = (
    ("crisp readable silhouette; ",
     "no silhouette and no single subject — a continuous surface; "),
    ("consistent directional lighting; ",
     "flat even ambient light with no light direction; "),
    ("vivid saturated jewel-toned color",
     "restrained color held in a narrow value range"),
)

# Portrait-only negatives: reinforce the uniform, and the two failures both trial
# generations shared.
PORTRAIT_NEGATIVE = (
    ", hat, cap, sunglasses, hoodie, leather jacket, moto jacket, tactical vest, armour, "
    "badge, patch, insignia, glossy specular highlight, wet plastic sheen, pure black outline, "
    # the first Talon return curved the whole body into a disc (silhouette-vs-disc IoU 0.78)
    # because the framing clause said the figure sits "inside a circle". Say it here too.
    "circular crop, circle frame, round frame, ring border, outer rim, roundel, medallion, coin, "
    "badge shape, emblem, sticker die-cut, rounded blob body, body clipped to a circle, vignette, "
    "smooth unbroken curved bottom edge, shoulderless torso, glossy highlight, shiny, "
    "reflective, lacquered, plastic, true black, human hand, five-fingered hand, fingers, "
    "thumb, palm, human arm, hand on a fin, anthropomorphic hands, vinyl, latex, wet look, "
    "neutral black, black outline, mismatched fins, one limb shorter than the other, "
    "scalloped shading, overlapping crescent strokes, busy repeating texture, "
    "individually drawn scales, camouflaged garment, jacket blending into the body, "
    "rainbow, prismatic, iridescent, many-coloured, colour spectrum, tie-dye, "
    # the Lunker trial: head sat on the jacket, collar opening filled with jacket, one strap
    # floating with no shoulder under it, dorsal line passing over the vest instead of out of it
    "bib, apron, jacket pasted flat on the front of the body, jacket butted against the chin, "
    "collar opening filled with jacket, head resting on top of the jacket, back lying on top "
    "of the jacket, floating shoulder strap, strap with no shoulder under it, "
    "jacket stopping at the near flank, "
        # (9) bust crop, (10) opaque jacket, (11) two eyes — 38 of 68 rerolls in the first review
        "legs, feet, paws, standing figure, full body, tail, tail curling into frame, lower body, "
        "hips, ground, floor, cast shadow beneath, hood, hooded jacket, collar turned up, cowl, "
        "body visible through the jacket, markings drawn over the jacket, fin overlapping the chest "
        "panels, spine through the vest, four eyes, extra eyes, second pair of eyes, mismatched "
        "fins, one fin and one arm, arm where a fin belongs, elbow, wrist, shoulder joint on a fish, "
    # (6) bounded silhouette and (7) accent drift — see the decision notes on the add-on
    "tall narrow figure, long thin silhouette, wide flat silhouette, stretched silhouette, "
    "bill pointing straight up, snout sticking straight out of the frame, limb extending past "
    "the body, small head on a large body, head dwarfed by the shoulders, "
    "jacket tinted with the body colour, jacket harmonised with the animal, tone-on-tone "
    "jacket, panel the same colour as the creature, jacket in the animal's own hue, "
    # Plunge: both wings held out despite a GESTURE line reading "wings swept back close to
    # the body", and vest straps landing dE 34 from the bird's own golden crown.
    "wings held away from the body, wings opened out to the sides, outstretched wings, "
    "spread wingspan, wings framing the character, "
    "jacket matching the animal's markings, strap the same colour as a crest or crown, "
    # Sharks and Fathom kept coming back as bodybuilders — see decision (8)
    "muscular shoulders, deltoids, defined pectoral muscles, biceps, bodybuilder torso, "
    "V-taper torso, broad chest tapering to a narrow waist, anatomical human musculature, "
    "gym physique, fin drawn as a muscular arm"
)

BASE = (
    "Stylized polished 2D game art for SaltyCritter Yacht Club; colorful nautical "
    "adventure; vivid saturated jewel-toned color; bold simplified shapes with crisp "
    "chunky faceted brush planes; hard two-tone shading and no soft gradients; crisp "
    "readable silhouette; storybook clarity over realism; friendly sophisticated tone; "
    "consistent directional lighting; minimal microtexture; no text; no UI; no photorealism."
)

# ── ASKING FOR A VIEW THE TRAINING DATA BARELY CONTAINS ─────────────────────
# Every generator defaults to the three-quarter hero shot, and no amount of insisting on
# "top-down orthographic" reliably beats that, because the phrase names a CAMERA the model
# has almost no examples of. Measured on the 2026-08-09 tree batch, which was generated
# against a clause that already said "Strict TOP-DOWN ORTHOGRAPHIC ... no side of the object
# visible": the three canopies came back 1.44, 1.46 and 1.77 times wider than tall, i.e.
# shot from 46, 47 and 56 degrees off vertical. The instruction was ignored, politely.
#
# So this clause stops naming the camera and does three other things instead.
#
# 1. IT NAMES A GENRE THE DATA ACTUALLY HAS. Straight-down imagery exists in bulk — drone
#    survey, orthophoto, satellite tile — just not filed under "orthographic". Asking for
#    that picture gives the model a real distribution to sample instead of a view it has to
#    infer.
# 2. IT GIVES AN ACCEPTANCE TEST ON THE PICTURE, NOT THE CAMERA. "Directly above" is
#    unfalsifiable to a generator; "as tall as it is wide" is not. A round thing shot from
#    straight above is round, and the instant the camera tips it flattens into an oval — so
#    the outline is the one property that cannot be faked, and it is the same number ingest
#    measures on delivery.
# 3. IT NAMES THE DEFAULT AS THE FAILURE, in the negatives, so "three-quarter view" is a
#    thing being refused rather than a thing left unmentioned.
#
# ── AND THE GENERATOR IS ITSELF A VARIABLE ──────────────────────────────────
# Worth knowing before blaming a prompt: the models differ markedly on this one axis, and on
# the evidence so far Gemini holds the nadir view best. The cove cargo family was generated
# twice against the same manifest subject, and the tell is what happened to the parts that
# stand UP off the deck — round 1 returned the funnel as a cylinder with a visible side and
# the deckhouse as a block with its front face showing, while round 2 returned both as flat
# plan shapes, a circle and a rectangle, seen square from above. Same words, different model.
#
# So a returned three-quarter view is not automatically a prompt defect. If the wording
# already carries this clause and the result is still tilted, changing generator is the
# cheaper experiment than rewriting the subject again — and the ingest checks (`planRound`
# for anything round in plan) will tell you which of the two you got, in a number, before you
# have to decide by eye.
ORTHO_BASE = (
    "AN AERIAL SURVEY PHOTOGRAPH: a drone hovering directly over the subject, camera pointing "
    "straight down at the ground. That is the picture — the geometry of an orthophoto or a "
    "satellite tile, not a 'top-down look' applied as a style. "
    "NOTHING OF ANY SIDE MAY APPEAR: no length of trunk, no bark surface running away from "
    "you, no face, no chest, no flank of a hull. You see the top surface and the ground "
    "immediately around it, and nothing else. A head seen from above is the back of a skull, "
    "with the nose or beak foreshortened and pointing away, never a face looking at the "
    "viewer. Every part of the subject is the SAME distance from the camera, so nothing is "
    "larger for being nearer and no edge converges. "
)
# ⚠️ THE ROUNDNESS TEST IS NOT UNIVERSAL, and asserting it as though it were was a real bug:
# for one afternoon every world-prop and element carried "the silhouette must be AS TALL AS IT
# IS WIDE" and a matching "wider than tall" negative. That is the correct test for a tree crown
# and flat nonsense for a cargo ship at 4:1 or a bridge at 10:1 — it instructs the generator to
# square up a subject that is honestly long, which is a worse defect than the tilt it was
# written to catch.
#
# So it is gated on the SAME `planRound` flag ingest measures against, and there is no third
# state: an asset either claims to be round in plan, and gets the outline test in the prompt
# and the ratio check on delivery, or it does not and gets the test that IS true of a long
# subject — parallel sides and no convergence, which is exactly how a tilt shows up on a hull
# or a deck.
ORTHO_ROUND = (
    "THE ACCEPTANCE TEST IS THE OUTLINE, because it is the one thing a tilted camera cannot "
    "fake: a roughly round subject seen from straight above is ROUND, and the moment the "
    "camera tips it flattens into an oval. The subject's silhouette must therefore be AS TALL "
    "AS IT IS WIDE. If it comes back wider than it is tall, the camera was tilted and the "
    "image is wrong however good it looks. "
)
ORTHO_LONG = (
    "THE ACCEPTANCE TEST IS THE SIDES, because that is where a tilt shows on a long subject: "
    "this one is much longer than it is wide, and its two long edges must run PARALLEL for its "
    "whole length. The far end is exactly as wide as the near end, nothing tapers, narrows or "
    "converges, and no end face is visible. If one end is smaller than the other the camera was "
    "tilted and the image is wrong however good it looks. "
)
ROUND_NEGATIVE = ", oval silhouette, elliptical crown, squashed circle, flattened disc, wider than tall"

CLASS_ADDON = {
    "world-prop": (
        "{ortho}{bg} "
        "The object alone: no water, no ground, no cast scenery, no baked drop shadow. "
        "Anything with a front faces the TOP of the frame — the engine rotates these and "
        "treats sprite-up as zero heading. Leave a clear margin of at least 8% of the "
        "image on all four sides so the sprite has room to rotate; the subject must not "
        "touch or approach any edge. Simplified geometric construction, strong outer "
        "silhouette, limited shading, designed to stay legible when reduced to roughly "
        "{display}px."
    ),
    "element": (
        "{ortho}{bg} "
        "EXACTLY ONE subject, alone, centred, filling most of the frame, facing the TOP. "
        "No second copy, no group, no companion, no reflection. Nothing else in frame: no "
        "ground, no scenery, no cast shadow. This art gets scaled down and scattered into "
        "groups by code, so it must read as a single clean silhouette from any rotation, "
        "and it will finally be drawn at roughly {display}px."
    ),
    "terrain": (
        "Strict top-down orthographic terrain tile, transparent background, crisp faceted "
        "edges, no baked water and no shoreline foam (the engine draws those)."
    ),
    # A tile fails in ways a sprite cannot, and every clause here is one of them:
    #   - it is not an object, so "one clear subject, centred" is exactly wrong;
    #   - the player sees the same square dozens of times, so any distinctive feature
    #     becomes a countable stamp — repetition is read as a bug, not as texture;
    #   - the four edges have to wrap, which no other class asks for;
    #   - a light direction, a vignette or any across-frame gradient repeats as banding
    #     on a fixed period, which is the single most obvious tiling tell;
    #   - it is the surface everything else is drawn ON, so it must lose the contrast
    #     fight with boats, marks and props on purpose.
    "texture": (
        "SEAMLESS TILING GROUND TEXTURE, not an object. Strict top-down orthographic view "
        "of a flat surface, filling the whole square edge to edge, fully opaque, no "
        "background and no transparency anywhere. There is no subject, no focal point and "
        "no composition: the engine fills a whole landmass with this one square repeated "
        "over and over, so ANY distinctive feature — one big rock, one dark hollow, one "
        "bright patch — becomes a stamped-out repeat the player can count. Spread the "
        "detail evenly at roughly the same density everywhere, and keep every feature "
        "small: nothing may run more than about a third of the way across the frame. "
        "IT MUST WRAP. The right edge continues the left edge exactly and the bottom edge "
        "continues the top edge exactly, so anything crossing an edge reappears at the "
        "matching point on the opposite side, unbroken and at the same size and angle. No "
        "border, no frame, no vignette, no darkened or lightened edges, no corner shading, "
        "no gradient across the frame, and no feature deliberately centred. "
        "FLAT EVEN AMBIENT LIGHT, no light direction, no cast shadows, no highlights from a "
        "sun — a baked light direction repeats as visible banding every tile. Relief comes "
        "from the material's own tone changes alone. "
        "QUIET AND LOW CONTRAST: this is the surface every boat, mark and prop is drawn on "
        "top of, so it must lose the contrast fight with them. Hold the whole image inside "
        "a narrow value range. "
        "SCALE: the square covers {tileworld} world units and draws at about {tileworld}px "
        "on screen, so the smallest feature that matters must be at least {minfeature}px "
        "across in this image or it dissolves into grey noise when reduced."
    ),
    "illustration": (
        "Square aerial-oblique venue illustration, opaque, no text or lettering, no humans. "
        "Give the eye a path through the water. One focal element; corners quiet; bottom "
        "fifth simple enough for a name scrim."
    ),
    # Rewritten after a review of all 82 portraits plus one generated trial. Seven decisions,
    # each of which the roster was measurably failing:
    #
    # (1) THE PFD IS A UNIFORM. ~18 of 82 wore leather, moto, tactical or hoodie garments. The
    #     vest is the only shared element making 82 unrelated species read as one CLUB, and it
    #     is where the hull colour lives — the sole visual link from a portrait to the boat.
    # (2) ONE PROPORTION SYSTEM. The roster was bimodal, chibi blob vs leather-jacket hero, and
    #     both poles sit on visual-style.md 3's Avoid list.
    # (3) ILLUSTRATION, NOT STICKER. Set beside the venue cards, the flattest portraits read as
    #     stickers and the modelled ones sit closer to the cards. Soft modelling is WANTED here;
    #     the no-gloss rule belongs to props drawn at 26-92px, not to a 128px profile portrait.
    # (4) FORELIMBS STAY CLOSE. Measured on a Bruce trial: adding shoulders and arms shrank the
    #     head and the portrait lost ink against the leaderboard plate versus the art it
    #     replaced (0.128 vs 0.164). The old limbless-blob convention was partly a legibility
    #     adaptation to a circular crop. Limbs are allowed; widening the silhouette is not.
    # (5) THE JACKET IS WORN, NOT PASTED ON. Added after the Lunker trial. The add-on specified
    #     the PFD's construction, colour separation, material and shading, and said nothing
    #     about how it MEETS the body — so the generator butted the jacket flat against the
    #     underside of the jaw, filled the collar opening with more jacket, and left a shoulder
    #     strap floating with no shoulder under it. FISH FAIL THIS HARDEST: there is no neck to
    #     hang a collar on, so the head simply rests on top of the vest and the dorsal line
    #     passes over it. Mammals and birds get the joint for free, which is why 82 portraits
    #     shipped before anyone noticed the clause was missing.
    # (6) THE SILHOUETTE IS BOUNDED. The portrait is fitted on its LONGEST dimension, so a
    #     silhouette stretched in either direction spends its 64 pixels on empty frame and
    #     shrinks the head. Measured on the shipped roster the tight silhouette runs aspect
    #     0.78-1.23; two trials fell outside it and both lost the face — Spar at 0.67 with the
    #     bill raised (43px wide at display size, head ~20px), Bruce at 1.11 with the pectoral
    #     fins spread. The fix is orientation, not size: Torrent solves the identical bill
    #     problem at 1.22 by laying it ACROSS the frame, and Spar's own second roll came back
    #     at 0.95 doing the same. Needle is the accepted edge at 1.37, allowed because a
    #     needle-thin snout is nearly all transparent frame and the body keeps its area.
    #     STRENGTHENED after Plunge: the first roll under the clause to fail it, at 1.11 with
    #     both wings held out, even though his own GESTURE line reads "wings swept back close
    #     to the body". Stating the bound was not enough — the clause now says the widest
    #     points belong to the BODY, describes what a folded wing actually looks like, and
    #     makes a folded/close/swept-back GESTURE line binding over the animal's usual pose.
    # (7) THE JACKET IS NOT A SHADE OF THE ANIMAL. Six trials in a row returned a jacket accent
    #     pulled toward the creature's own hue — Snag amber-on-brown, Lunker chartreuse 6deg off
    #     its olive, Spar blue-on-blue, Bloom magenta 4deg off its violet and invisible at 64px.
    #     The subjects were NOT at fault: measured in CIELAB, every one of those pairs is well
    #     separated, so the model was harmonising the kit to the animal on its own. It is worth
    #     stating because these two colours become the boat's hull and spinnaker, and a kite
    #     that matches the hull is the one thing `npm run test:livery` exists to prevent.
    #     EXTENDED after Plunge, whose vest straps came back dE 34 from the bird's own golden
    #     crown: the drift lands on a species MARKING as readily as on the base colour, and a
    #     yoke the same note as the crest erases the marking that identifies the animal.
    # (8) NO INVENTED MUSCULATURE. The framing clause said the character "keeps its own natural
    #     bust silhouette, with real shoulders" — which, on an animal that has no shoulders,
    #     reads as an instruction to draw deltoids. Fathom came back a bodybuilder in a wetsuit
    #     and a Blaze trial had pectoral fins drawn as biceps. It does not hit every shark:
    #     Stripes, Dozer and Spike are clean, because their subjects lead with blunt, sleepy or
    #     heavy reads. It hits the ones whose species says FAST or PREDATOR, where the model
    #     supplies an athletic build to match. "Real shoulders" is now conditional, and the
    #     smooth-taper body plan is stated for fish, sharks, rays and cetaceans.
    "portrait": (
        "Anthropomorphic sailing competitor, upper-body three-quarter "
        "portrait, turned slightly off-centre with enough asymmetry to carry personality. "
        "{bg} "
        "PROPORTIONS: a large expressive head on a "
        "compact upper body. Not a baby and not a limbless chibi blob; not a realistic "
        "naturalistic bust either. Personality is carried by the FACE, the gaze and the "
        "gesture — never by making the body rounder and cuter or squarer and tougher. "
        "The creature has exactly the limbs and the body covering described for it here, and no "
        "others. It borrows no anatomy and no surface texture from any other kind of animal. A "
        "creature described with no limbs has none — nothing to raise or wave, and its pose is "
        "the set of the head and the curve of the body, with the jacket sitting around it. No "
        "A FIN IS NOT AN ARM. Where the subject says this creature has pectoral fins, flippers or no limbs at all, it does not get arms: no shoulder joint, no elbow, no forearm, no wrist, no hand. A pectoral fin is one flat blade hinged flush to the side of the body, and a limbless animal has nothing at all in that position. Draw the limb the subject names and no other. No "
        "human hands, no human fingers, no thumbs and no palms. "
        "PAIRED LIMBS MATCH, AND THIS IS CHECKED LAST. If this creature has two of the same limb "
        "— two pectoral fins, two wings, two flippers, two forelegs — then before finishing, compare "
        "them: same length, same width, same outline, same number of rays or feathers, same colour. "
        "The three-quarter turn may foreshorten the far one, but it still reads as the twin of the "
        "near one. Never give one side a fin and the other an arm, never draw one large and one "
        "stunted, never leave one half-drawn when the pose shows both, and never grow a third. "
        "FORELIMBS ARE PRESENT BUT HELD CLOSE to the body — folded, resting forward, or one "
        "raised near the chin. They must NOT widen the silhouette or push the head smaller: "
        "the head occupies roughly half the total height. "
        "THE PICTURE STOPS AT THE WAIST. It is a BUST: head, shoulders, chest and the top of the belly, cut off cleanly at the bottom edge of the frame just below the jacket's waist belt. NOTHING BELOW THAT IS DRAWN — no hips, no legs, no feet, no paws or claws resting on anything, no tail, no lower body curling round into shot, and no ground underneath. A fish, an eel or a snake is cut at the waist exactly as a mammal is; its tail is simply not in the picture. The only thing that may cross that cut is a limb already raised into the upper body, such as a fin held near the chin. "
        "FRAMING IS A RULE ABOUT WHERE THINGS SIT, NOT ABOUT SHAPE. Keep the head and face "
        "near the centre of the square and leave the four corners quiet, because one part of "
        "the interface later masks this image to a circle. That masking is done afterwards by "
        "software and MUST NOT be drawn. The character keeps its own natural bust silhouette, "
        "with real shoulders WHERE THE ANIMAL HAS THEM. "
        "A CREATURE WITH NO SHOULDERS IS NOT GIVEN ANY. On a fish, a shark, a ray, a whale or a "
        "dolphin the body is ONE SMOOTH CONTINUOUS TAPER from head to tail: no shoulder mass, no "
        "deltoid bulge, no pectoral muscle, no arm muscle, no broad chest narrowing to a waist. "
        "A pectoral fin meets a smooth flank flush, as a flat blade hinged to the side of a tube "
        "— it is never the end of an arm and never sits on a rounded shoulder cap. Any shoulder "
        "visible in the picture belongs to the JACKET, which is padded and sits on top of the "
        "animal; the animal underneath stays smooth. Draw the creature's real build, not an "
        "athletic one: a fast species is fast because it is streamlined, not because it is "
        "muscular. THE LOWER HALF OF THE OUTLINE IS BUILT FROM ANATOMY: "
        "going down each side, the contour CHANGES DIRECTION at least twice — out across the shoulder, in at the notch where the "
        "limb meets the body, then down along the flank. A silhouette whose bottom is one "
        "smooth unbroken curve from side to side is WRONG, however well the face is drawn: it "
        "reads as a coin or a sticker rather than as a creature. Do NOT curve the body into a "
        "disc or a round blob, do NOT let a mass of body covering fill out a circle, do NOT "
        "trim the shoulders to an arc, and do NOT draw any circular border, ring, outer rim, "
        "badge, emblem, medallion, coin or die-cut sticker edge. There is no frame in this "
        "picture — there is a character, and there is transparent background. "
        "THE WHOLE CHARACTER STAYS ROUGHLY AS WIDE AS IT IS TALL, and fills that square. It is "
        "drawn large and shown small, scaled to fit whichever dimension is longer, so a "
        "silhouette stretched tall or stretched wide spends its size on empty frame and the "
        "head comes out too small to read. A LONG PART — a bill, a snout, a beak, a horn, an "
        "antenna, a tail, a trailing fin or tentacle — is TURNED so it lies ACROSS the picture "
        "on a diagonal, crossing in front of or behind the body, instead of pointing straight "
        "up or straight out and stretching the outline after it. "
        "THE WIDEST POINTS OF THE PICTURE BELONG TO THE BODY, never to a limb. Wings, fins, "
        "flippers and arms are held IN against the flanks: a wing folds so its leading edge "
        "lies flat down the side and the tip comes to rest near the tail, and it is not lifted "
        "away from the body, not opened out to either side, and not arranged so it frames the "
        "character. The single exception is a subject that explicitly asks for a limb to be "
        "spread or fanned. Where the GESTURE line says folded, close, swept back or tucked, "
        "that wording is binding and it outranks the pose this animal is usually drawn in. "
        "When a long part will not fit, turn it further across the frame — never answer by "
        "shrinking the head. "
        "THE LIFE JACKET IS SPECIFIED EXACTLY, and it is safety equipment rather than fashion: "
        "a front-zip sailing PFD with a full-length centre zipper, two or "
        "three clearly panelled foam sections, a horizontal webbing waist belt, and one "
        "visible buckle at the centre of that belt. NO leather, no "
        "moto or biker styling, no tactical or armoured plating, no hoodie, no jacket, no "
        "badges, patches or insignia, and no hats, sunglasses or accessories of any kind. "
        "THE JACKET IS OPAQUE AND HIDES WHAT IS BEHIND IT. It is solid fabric over foam: the chest, belly and back it covers are NOT visible through it and NOT drawn on top of it. No spine, dorsal ridge, fin, scale pattern, stripe, fur or marking continues across the jacket, and no part of the animal floats in front of the chest panels. Above the collar you see the head and throat; below the hem you see nothing, because the picture ends there. "
        "THE JACKET IS WORN, AND IT WRAPS THE WHOLE TORSO. The body goes INSIDE it, entering "
        "from the top and leaving at the bottom. At the top, the throat and shoulders pass "
        "THROUGH the collar opening: the collar and the shoulder straps run BEHIND the head and "
        "disappear behind it, and a clear wedge of the animal's own body — throat and upper "
        "chest, in the animal's own colour — is visible inside the V of the open jacket. At the "
        "back, the spine, dorsal ridge or dorsal fin rises out from BEHIND the jacket's shoulder "
        "line, and the far side of the collar shows over the far shoulder, so the jacket clearly "
        "continues around the far side of the body instead of stopping at the near flank. On a "
        "creature with no neck — a fish, a seal, a squid — the jaw, gill line and dorsal contour "
        "still overlap the collar, and the collar still passes behind them. Do NOT butt the "
        "jacket flat against the underside of the head, do NOT let the head or the back rest on "
        "top of the jacket, do NOT fill the collar opening with more jacket, and do NOT leave a "
        "shoulder strap floating with no shoulder beneath it. "
        "RENDERING IS POLISHED GAME ILLUSTRATION: model the form with soft, controlled "
        "shading INSIDE each shape rather than "
        "leaving flat sticker fills. EVERY SURFACE IS MATTE, like gouache or coloured paper — the creature's own surface and the jacket fabric both absorb light rather than reflecting it. Highlights are broad, soft and dull, never a bright spot. ABSOLUTELY NO glossy specular "
        "highlights or wet-plastic sheen ANYWHERE on the creature or on the jacket. "
        "PALETTE DISCIPLINE. The whole picture is built from a small controlled set: the "
        "creature's own two or three colours, the two jacket colours named in the subject, and "
        "charcoal plus off-white for the hardware. That is the entire palette. Do not introduce "
        "hues beyond it, do not run any surface through a spectrum, and do not add a rainbow, "
        "an iridescent sheen or a colour gradient across the body. A colour-changing animal "
        "shows that as ONE extra accent hue in a few bold patches, never a band of many colours. "
        "THE JACKET SEPARATES CLEARLY FROM THE CREATURE. Where jacket and animal are close in "
        "colour — a green jacket on a green animal — the animal's own colour deepens behind and "
        "around the jacket, and a clean dark contour runs along the whole edge of it, so there "
        "is an unmistakable value step where garment meets body. The jacket reads as a separate "
        "object at a glance. "
        "THE TWO JACKET COLOURS ARE NOT SHADES OF THE ANIMAL. Each is named in the subject and "
        "each belongs to a different part of the spectrum from the creature's own colour. "
        "Neither may drift toward it: do not warm a green jacket toward an olive animal, do not "
        "lighten a dark panel until it sits at the same value as pale skin, do not tint the "
        "foam with the body colour so the two agree. They are supposed to clash slightly — this "
        "is issued safety kit pulled from a bin, not the creature's own markings, and the same "
        "two colours get painted on this character's boat, where they have to be picked out "
        "across open water. If a named jacket colour is starting to look like the animal, push "
        "it FURTHER from the animal rather than meeting it halfway. This covers the creature's "
        "MARKINGS as much as its main colour: where the animal has a golden crown, a coloured "
        "stripe, a bright patch or a crest, the jacket does not pick that colour up either. "
        "The markings say which animal this is and the jacket says which boat is his, and the "
        "two must never land on the same note. "
        "THE JACKET IS MADE OF CLOSED-CELL FOAM "
        "UNDER A DRY MATTE NYLON SHELL: a dusty, slightly fibrous fabric that scatters light "
        "completely. It is not vinyl, not latex, not leather and not wet. Shade it with flat "
        "steps of value across the panels, never with a bright band down the middle. "
        "ANY REPEATING SURFACE PATTERN IS DRAWN AS A FEW LARGE GROUPS, never unit by unit. "
        "Suggest the pattern in two or three places where the form turns and leave the rest of "
        "the surface clean. Detail finer than about one-fortieth of the image height does not "
        "survive reduction — it turns to grey mush and costs the silhouette. "
        "SHADE WITH LONG STROKES THAT FOLLOW THE FORM. Do NOT build a surface out of rows of "
        "small overlapping scallops, crescents, leaf shapes or chevrons: that mark-making "
        "invents a texture the creature does not have, whatever the covering is said to be. "
        "A surface described as smooth is drawn with unbroken planes and clean value steps. "
        "Build on large clean value masses first and put the modelling inside "
        "them, so the silhouette and the three or four main value groups still read when the "
        "whole image is reduced to a small thumbnail. "
        "THE DARKEST INK IN THIS PICTURE IS A COLOUR, NOT A BLACK: every outline, every shadow "
        "and every dark marking is drawn in a deep desaturated BLUE-GREY, the colour of wet "
        "slate or a navy work coat in shade (#23262E). Nothing in the image is neutral black. "
        "The outer contour is that blue-grey, confident and continuous at roughly "
        "4-8px on a 500px master; interior lines thinner and only where they clarify form. "
        "THE CREATURE HAS EXACTLY TWO EYES, one either side of the midline — however many the real animal has and however wide or strange the head is. A hammerhead has two, at the ends of the hammer. A mantis shrimp has two, on its stalks. Never add a second pair. "
        "Eyes large and clear with one simple highlight. "
        "THE FIGURE FILLS THE FRAME — it reaches close to the top and bottom edges with only a "
        "small margin, and never floats small in the middle of a large empty square. No "
        "scenery, no ground, no cast shadow, no props, no text."
    ),
    "ui-icon": (
        "Flat interface icon, transparent background, heavy optical padding, one clear "
        "idea, readable at 32px over both dark navy and bright water."
    ),
}

# ⚠️ THE HAZARD CLAUSE USED TO MANDATE A SPIKY SILHOUETTE AND THAT WAS ONE VENUE'S ANSWER
# MISTAKEN FOR THE RULE. It read "it needs an aggressive, spiky or heavy silhouette", which is
# a fair description of a coral head or a reef and flatly contradicts several honest hazards:
# a glacial boulder is ice-SMOOTHED by definition, and a swim raft is a square wooden
# platform. Stillwater Lake declared both and the assembled prompt then argued with its own
# subject — the same defect this file has now been bitten by three times (see the venue-colour
# clauses above), and the portrait note records what a generator does with a contradiction: it
# resolves it by dropping one half AT RANDOM.
#
# What art-pipeline 2 actually requires is narrower than spikiness: an `ambient` prop must
# never be confusable with a `hazard`, and the distinction has to survive with COLOUR REMOVED
# — different silhouette FAMILIES, not different hues. Spikiness is one way to be a different
# family. Being dense and hard-edged where the vegetation is ragged and textured is another,
# and it is the one a boulder uses. So the clause now states the requirement and lets the
# subject choose how to meet it.
ROLE_ADDON = {
    "hazard": (
        "This is a HAZARD the player must avoid. It must telegraph that before contact and "
        "hold strong contrast against both pale turquoise and near-black water. Its "
        "silhouette must belong to a plainly different FAMILY from the soft ragged "
        "vegetation around it — heavy, dense and hard-edged, whether that hardness comes "
        "from spikes, from angular planes or from one smooth solid mass. The distinction "
        "has to survive with the colour removed."
    ),
    "ambient": (
        "This is AMBIENT decoration with no collision. Its silhouette must be soft, "
        "rounded or organic so it can never be mistaken for a hazard — that distinction "
        "has to survive at race scale with color removed."
    ),
    "landmark": (
        "This is a fixed LANDMARK carrying venue identity. It may be the largest and most "
        "detailed thing in the venue, but it never reads as an obstacle in the water."
    ),
    "traffic": (
        "This is a NON-RACING boat. It must be instantly distinguishable from a racing "
        "sailboat: no racing sail plan, different hull proportion, working-boat character."
    ),
    "nav": (
        "This is a NAVIGATION AID the player is meant to read. Use canonical buoyage "
        "shape and color coding; exaggerate the top shape slightly for recognition."
    ),
}

NEGATIVE = (
    "photorealistic, cinematic realism, 3D render, heavy painterly brushwork, watercolor "
    "wash, gritty, horror, military, generic vector clip art, excessive texture, excessive "
    "bloom, thin fragile details, cluttered background, drop shadow, ground plane, "
    "perspective view, isometric, text, logo, watermark, "
    # THE DEFAULT, NAMED. "isometric" and "perspective view" were already here and the tree
    # batch still came back at 46-56 degrees, because the thing it actually produced has its
    # own vocabulary and none of these words were in it. A model refuses what it can name.
    "three-quarter view, 3/4 view, 45 degree angle, oblique view, tilted camera, angled "
    "camera, hero angle, hero shot, product shot, eye level, low angle, dutch angle, "
    # the measurable symptom for a ROUND subject moves to ROUND_NEGATIVE, added per asset
    "depth, receding ground, vanishing point, foreshortening"
)

# Arrangement negatives, added after two penguin huddles came back as rosettes. They are
# about how MULTIPLE objects are laid out, not about an object's own form — a racing mark
# is deliberately three-fold symmetric, and forbidding symmetry would make the prompt
# argue with itself. Suppress with "allowSymmetry": true on the asset.
ARRANGEMENT_NEGATIVE = (
    ", mandala, kaleidoscope, radial symmetry, symmetrical arrangement, circular "
    "arrangement, ring formation, evenly spaced, rosette, compass rose, snowflake "
    "pattern, tiled pattern"
)

# Textures take these INSTEAD of ARRANGEMENT_NEGATIVE, which forbids "tiled pattern" and
# "evenly spaced" — the two things a tile is required to be. A class-level swap, not an
# `allowSymmetry` flag: the contradiction belongs to the class, not to any one asset.
TEXTURE_NEGATIVE = (
    ", seam, visible seam, tile edge, grid lines, border, frame, vignette, darkened "
    "corners, cast shadow, drop shadow, sun glare, specular highlight, light direction, "
    "gradient across the image, single focal feature, one large object, centred "
    "composition, object on a background, subject, silhouette, transparent background, "
    "alpha channel, checkerboard, horizon, sky, perspective, isometric, photographic "
    "noise, film grain, footprints, tracks, wildlife, high contrast, deep black shadow"
)

# How to ask for the background, per generator. Some models cannot produce real
# alpha and instead PAINT a transparency checkerboard into the pixels — asking
# them harder yields more checkerboards, so ask for a flat key color and remove
# it with dekey.py. Never key on white: too many props carry near-white markings.
BACKGROUNDS = {
    "transparent": (
        "Transparent background — a real alpha channel, not a drawn checkerboard "
        "pattern."
    ),
    # Gemini's subject quality measurably drops on a magenta field, and a proper
    # background remover has no trouble with white — the leak risk was specific to
    # dekey.py's flood fill. Cost: cutting against white leaves a light edge fringe
    # (measured 1.7x the body luminance on arctic-orca-calf), so check the edge on
    # the contact sheet over dark water.
    "white": (
        "Place the subject on a completely flat, uniform pure white background "
        "(hex #FFFFFF), edge to edge, with no gradient, vignette, texture, shadow "
        "or checkerboard. Keep a crisp, clean silhouette edge against the white — "
        "no soft glow, feathering or light halo around the subject."
    ),
    "magenta": (
        "Place the subject on a completely flat, uniform pure magenta background "
        "(hex #FF00FF), edge to edge, with no gradient, vignette, texture, shadow "
        "or checkerboard. The magenta is a chroma key that will be removed — no "
        "part of the subject may be magenta or pink."
    ),
    "green": (
        "Place the subject on a completely flat, uniform pure green background "
        "(hex #00FF00), edge to edge, with no gradient, vignette, texture, shadow "
        "or checkerboard. The green is a chroma key that will be removed — no part "
        "of the subject may be green."
    ),
}


def tile_world(asset, prof):
    """World units one texture tile spans. The camera is 1:1, so this is also its px size."""
    return asset.get("tileWorld", prof.get("tileWorld", 512))


def build(asset, profiles, bg="transparent"):
    prof = profiles[asset["class"]]
    display = asset.get("world", prof.get("reduceTest", 64))
    base = BASE
    if asset["class"] == "portrait":
        base = base.replace(BASE_PROP_SHADING, BASE_PORTRAIT_SHADING)
    elif asset["class"] == "texture":
        for old, new in BASE_TEXTURE_SUBS:
            base = base.replace(old, new)
    if asset.get("tintedMaster"):
        base = base.replace("vivid saturated jewel-toned color", BASE_TINTED_COLOR)
    tile = tile_world(asset, prof)
    # A feature has to survive the master -> screen reduction; 4 screen px is the floor
    # the reduction ladder shows detail dying below.
    minfeature = max(4, round(4 * prof["master"] / tile))
    # The camera clause, plus WHICHEVER acceptance test is true of this subject — see the
    # ORTHO_ROUND / ORTHO_LONG note. Same `planRound` flag ingest measures against, so the
    # prompt and the delivery check can never disagree about what shape this thing is.
    ortho = ORTHO_BASE + (ORTHO_ROUND if asset.get("planRound") else ORTHO_LONG)
    parts = [base, CLASS_ADDON[asset["class"]].format(
        display=display, bg=BACKGROUNDS[bg], tileworld=tile, minfeature=minfeature,
        ortho=ortho)]

    if asset.get("role"):
        parts.append(ROLE_ADDON[asset["role"]])

    if asset.get("venue") in VENUES:
        dominant, accent = VENUES[asset["venue"]]
        if asset["class"] == "illustration":
            # Venue cards DO commit — that is what venue-art.md's registry is for.
            parts.append(
                f"Palette is committed to {dominant}, with {accent} as the only accent. "
                "Do not introduce hues outside that commitment."
            )
        elif asset["class"] == "texture":
            # REWRITTEN when the second texture was declared. The first version had textures
            # COMMIT to the venue's dominant hue, like a venue card. That was right for
            # arctic-snow only by coincidence — snow IS ice blue-white. Granite is dark grey
            # rock in the same venue, and committing would have asked for blue rock.
            #
            # A ground is a MATERIAL, so its colour comes from what it is made of, exactly
            # as a prop's does. What a texture DOES still take from the venue is the accent
            # EXCLUSION, which the prop clause has no reason to state: an accent belongs to
            # the objects standing on the ground, and one spread across the whole landmass
            # identifies nothing. (Re-running the arctic-snow prompt through this is safe —
            # its subject already names its own colours in three places, so the old commit
            # clause was never doing the work there.)
            #
            # ⚠️ "nothing neon or tropical" WAS THE EXCLUSION HERE AND IT HAD THE SAME DEFECT
            # the prop branch's "tropical green" had: it names a real material family as the
            # thing to avoid, in a library whose tropical venues are half the roster. It went
            # out with lagoon-coralsand, and it would go out with Bluewater Bonanza's reef
            # limestone and island scrub — grounds that ARE tropical and are supposed to be.
            # The exclusion only ever meant "no synthetic pigment", so it now says that.
            parts.append(
                f"VENUE CONTEXT, NOT A COLOUR INSTRUCTION: this ground is seen against "
                f"{dominant} and has to belong in that world — nothing neon or fluorescent. "
                "But a ground is a MATERIAL, and the material's own true colour is always "
                "right, even when it looks nothing like the venue's dominant hue: bare rock "
                "is rock-coloured next to blue ice. Take the colour from the subject below, "
                f"not from the venue. The venue's accents ({accent}) belong to the objects "
                "placed on this ground and appear NOWHERE in it — an accent repeated across "
                "the whole landmass stops identifying anything."
            )
        elif asset.get("tintedMaster"):
            # The venue clause below ends with "render it in its own correct local colour",
            # which is exactly what a tinted master must NOT do. It still gets the venue's
            # world for context — the ANIMAL has to belong to this water — but the colour
            # instruction is replaced rather than contradicted.
            parts.append(
                f"VENUE CONTEXT, AND THIS ONE IS COLOURED BY THE GAME: it will be seen "
                f"against {dominant}, with {accent} as the venue's accents, and it has to "
                "belong in that world in FORM. Its COLOUR is not decided here — the engine "
                "tints this sprite per instance, so the master is painted white and pale "
                "neutral grey and nothing else. Do not choose a local colour for it, do not "
                "tint it toward the venue, and do not add a colour cast of any kind: any hue "
                "baked in multiplies against the tint and comes out muddy."
            )
        else:
            # A prop is an OBJECT IN a venue, not a picture OF one. Telling it to
            # commit to the venue's dominant hue makes it out of the venue's colour,
            # which is how three orcas came back navy instead of black and a snow
            # petrel came back with navy wings.
            #
            # ⚠️ THE ALIEN-HUE EXAMPLES MUST BE HUES NOTHING IN THE LIBRARY IS HONESTLY
            # MADE OF, and "tropical green" was not one. It sat here as an example for
            # every venue, which put it in the prompt for Pearl Lagoon's palms, the
            # bayou's whole canopy and Bluewater Bonanza's three cay trees — every one
            # of which is correctly made of exactly that hue. A prompt carrying an
            # instruction and its opposite gets resolved by the generator dropping one
            # half AT RANDOM (the portrait note records the same failure), so a bad
            # example here is not a harmless one. The replacements are all synthetic
            # pigments: no plant, animal, rock or working boat in this game is any of
            # them, in any venue, so the clause can never argue with a subject.
            parts.append(
                f"VENUE CONTEXT, NOT A COLOUR INSTRUCTION: this will be seen against "
                f"{dominant}, and the venue's signature accents are {accent}. That is "
                "the world it has to belong to — avoid hues that would look alien in "
                "it, like neon, hot pink or fluorescent orange. But the subject is NOT "
                "made of the venue's colours and must NOT be tinted toward them. "
                "Render it in its own correct local colour. Any colour that carries "
                "real information — a species' true plumage or hide, a beak, a "
                "navigation aid's canonical coding, a painted hull — is always right "
                "even if that colour appears nowhere else in the venue, and must not "
                "be shifted toward the venue palette."
            )

    parts.append("SUBJECT: " + asset["subject"] + ".")
    return "\n\n".join(parts)


def emit(asset, profiles, bg="transparent"):
    prof = profiles[asset["class"]]
    print("=" * 72)
    bg_note = "n/a (full-bleed)" if asset["class"] == "texture" else bg
    print(f"{asset['key']}  [{asset['class']}/{asset.get('role', '-')}]  "
          f"venue={asset.get('venue', '-')}  status={asset['status']}  bg={bg_note}")
    # Per-asset master/gen, or the header lies to whoever hand-runs this: the cove
    # cargo family is generated 1024x1536 onto a 1536 master, not the profile's 1024.
    m = asset.get("master", prof["master"])
    line = f"master {m}x{m} {prof['background']}"
    if "gen" in asset:
        line += f"   generate at {asset['gen']}"
    if asset["class"] == "texture":
        t = tile_world(asset, prof)
        line += f"   tile {t} world units ({prof['master'] / t:g}x supersample)"
    if "world" in asset:
        line += f"   world {asset['world']}px"
    if "anchor" in asset:          # elements carry no anchor; they are composed, not placed
        line += f"   anchor {asset['anchor']}"
    if "compose" in asset:
        line += f"   COMPOSED {asset['compose']['count']} x {asset['compose']['from']}"
    print(line)
    print("=" * 72)
    print(build(asset, profiles, bg))
    if asset["class"] == "portrait":
        neg = NEGATIVE.replace("perspective view, ", "") + PORTRAIT_NEGATIVE
    elif asset["class"] == "texture":
        # "ground plane" is a prop negative and the one thing a ground texture must be.
        neg = NEGATIVE.replace("ground plane, ", "") + TEXTURE_NEGATIVE
    else:
        neg = NEGATIVE if asset.get("allowSymmetry") else NEGATIVE + ARRANGEMENT_NEGATIVE
        # Only a subject that claims to be round in plan can be faulted for not being round.
        if asset.get("planRound"):
            neg += ROUND_NEGATIVE
    print("\nNEGATIVE: " + neg)
    if asset.get("rework"):
        # AFTER the prompt, never inside it: this is a note to whoever is running the queue,
        # and pasting "the existing art wears a leather jacket" into a generator turns a
        # generation request into an edit request.
        print(f"\n[operator note] REWORK {asset['rework']['priority']} — "
              f"{asset['rework']['why']}. The prompt above is a fresh generation, not an edit.")
    key = asset["key"]
    if asset["class"] == "texture":
        # No background to key out — the tile IS the whole image, so --bg never applies.
        print(f"\n-> save master as regatta/art/inbox/{key}.png, "
              f"then: python3 regatta/art/ingest.py {key}"
              f"\n   CHECK THE WRAP FIRST: roll the image by half its width and half its "
              f"height and look at the two seams that land in the middle.\n")
    elif bg == "transparent":
        print(f"\n-> save master as regatta/art/inbox/{key}.png, "
              f"then: python3 regatta/art/ingest.py {key}\n")
    else:
        print(f"\n-> save the raw file anywhere, then:"
              f"\n   python3 regatta/art/dekey.py <file> {key}"
              f"\n   python3 regatta/art/ingest.py {key}\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("keys", nargs="*")
    ap.add_argument("--venue")
    ap.add_argument("--all-slots", action="store_true")
    ap.add_argument("--rework", action="store_true",
                    help="every asset carrying a `rework` block, worst first (P0, P1, P2). "
                         "These are SHIPPED assets with a recorded defect, so they do not "
                         "appear under --all-slots, which only lists undrawn work.")
    ap.add_argument("--bg", choices=sorted(BACKGROUNDS), default="transparent",
                    help="how to ask for the background. 'transparent' for models "
                         "with real alpha (OpenAI); 'magenta'/'green' for models "
                         "that paint a fake checkerboard (Gemini) — then run dekey.py")
    args = ap.parse_args()

    m = json.loads(MANIFEST.read_text())
    assets, profiles = m["assets"], m["profiles"]

    if args.rework:
        sel = sorted((a for a in assets if a.get("rework")),
                     key=lambda a: (a["rework"]["priority"], a["key"]))
    elif args.venue:
        sel = [a for a in assets if a.get("venue") == args.venue]
    elif args.all_slots:
        sel = [a for a in assets if a["status"] == "slot"]
    else:
        by_key = {a["key"]: a for a in assets}
        missing = [k for k in args.keys if k not in by_key]
        if missing:
            sys.exit(f"unknown key(s): {', '.join(missing)}")
        sel = [by_key[k] for k in args.keys]

    if not sel:
        sys.exit("no assets matched")
    for a in sel:
        emit(a, profiles, args.bg)


if __name__ == "__main__":
    main()
