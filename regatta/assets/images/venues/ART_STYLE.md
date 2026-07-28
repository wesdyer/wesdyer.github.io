# Regatta Venue Art — Style Guide

How to generate new art that fits the established venue-card collection (the ten
images in this folder). Use this when prompting for any new venue, loading
screen, or backdrop so it reads as the same artist's work.

## The style in one sentence

Vivid, jewel-toned painterly game art built from crisp chunky shapes and
faceted brush planes — flat colors with hard 1–2 tone shading, no gradients
except sky and water bands, cheerful storybook clarity over realism.

## Core rules (apply to every piece)

1. **Format**: square (~1250×1250), no text, no lettering, no humans.
   Wildlife yes; people at most as a tiny implied figure (e.g. the committee
   boat's sailor silhouette).
2. **Color**: commit to ONE dominant hue family per piece, saturated and
   confident, plus one accent (a complement or a warm point against cool).
   Every venue owns a color the others don't.
3. **Shapes**: chunky and faceted. Rocks are 2–3 tone angular blobs; foliage
   is clustered leaf-mass blobs, not individual leaves; ice is literal
   low-poly facets. Edges crisp — this style never blurs.
4. **Water**: built from interlocking angular ripple patches, darker and
   lighter planes of the venue hue. Whitecaps are clean white curling strokes.
   Shallows glow pale turquoise over sand. Foam lines hug every shoreline.
5. **Sky** (when present): flat saturated blue; cartoon cumulus — rounded
   white blob-stacks with a single flat shade tone — plus thin horizontal
   streak clouds. Horizon sits in the upper third.
6. **Light**: bright unclouded daylight, hard shadow edges, minimal
   atmospheric haze (distant land = one flatter, bluer tone). Night pieces
   (Glowtide) invert to near-black water and make every light source glow.
7. **Composition**: aerial-oblique (roughly 30–60° down-angle) or low
   horizon. Always give the eye a PATH through the water — a channel, a river
   bend, a moon trail. One focal element (landmark or creature), corners kept
   quiet. Keep the bottom ~20% simple: the UI name-scrim overlays it.
8. **One witness**: include a single charming wildlife element where natural —
   whale, orca + penguins, gator, eagle, jellyfish. Simplified but correctly
   proportioned; never cartoon-eyed mascots.

## Base prompt (prepend to every generation)

> Stylized painterly game art, vivid saturated jewel-toned colors, crisp
> chunky shapes with faceted brush planes, hard two-tone shading and no soft
> gradients, angular rippled water patches, flat cartoon cumulus clouds,
> storybook clarity, square composition, aerial-oblique view, no text, no
> people.

Then add the venue-specific scene description (subject, palette commitment,
eye-path, focal element, wildlife witness).

## Palette registry (owned hues — new venues must claim unclaimed territory)

| Venue | Dominant | Accent |
|---|---|---|
| Lighthouse Cove | coastal azure + green headlands | red/green channel buoys, white lighthouse |
| Stillwater Lake | deep lake blue + pine green | warm cabin lights, red/green buoys |
| Pearl Lagoon | pale glowing turquoise + sand | coral pinks/purples under water |
| Gatorgrass Bayou | olive/yellow-green everything | rust roof, cattail brown |
| Otter Run | whitewater teal + tan rock | stone bridge, foam swirls |
| Bluewater Bonanza | deep open-ocean cobalt | white clouds, whale blow |
| Redrock Reservoir | orange/rust sandstone | turquoise water (the inverted lagoon) |
| Glowtide Strait | near-black indigo night | electric cyan biolume + red lit buoy + moon gold |
| Glacier Sound | steel navy + faceted ice blue-white | penguin yellow, orca black |
| Sea Trials | plain honest blue | one orange mark + committee boat |

Unclaimed hue territory for future venues: warm golds/ambers (sunset), greys
(storm/fog), volcanic black + ember red, spring pastels.

## Delivery pipeline

1. Save the full-size original: `regatta/assets/images/venues/<key>.png`
   (the `<key>` matches the `VENUES` config key in script.js).
2. Generate the picker thumbnail:
   `sips -Z 256 <key>.png --out thumbs/<key>.png`
3. The picker card and detail panel pick it up by key automatically.

## Quality checklist before accepting a piece

- [ ] Reads instantly at 256px thumbnail size (squint test)
- [ ] Dominant hue is committed, not muddy; pops against neighbors on the grid
- [ ] Eye-path through the water exists
- [ ] Bottom fifth is simple enough for the name scrim
- [ ] Exactly one focal creature/landmark; corners quiet
- [ ] Style match: chunky facets, hard shading, zero blur/photo-realism
