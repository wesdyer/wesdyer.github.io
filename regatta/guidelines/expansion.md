# Expansion — two more cups, eight more venues (Sep 28–29 2026)

*Options only. Nothing here is decided or built. The beta ships with the thirteen venues
that exist today; this is the shortlist for when content is added after it.*

Companions: [venues.md](venues.md) (the specs of every venue, built or not),
[achievements.md](achievements.md) (the four unbuilt sketches — Fallwater Fjord, Flamingo
Reach, Reef 2, Tide Pool — and their reserved characters), [venue-art.md](venue-art.md)
(the palette and sky registries every new venue must claim territory in).

**The shape of the expansion.** Two new cups of four, like the three that exist
(`js/game/series.js` `CUPS`: Commodore's, Explorer's, Swirl). Eight venues.

---

## What is already owned

A new venue has to bring something none of these has.

| Venue | Mechanic it owns | Hue it owns |
|---|---|---|
| Lighthouse Cove | harbour traffic, the ship | coastal azure + green headlands |
| Stillwater Lake | island puffs and glass | deep lake blue + pine |
| Pearl Lagoon | rain squalls and their dead-air wake, reef gaps | pale turquoise + sand |
| Gatorgrass Bayou | dead air, weed, gators and logs | olive/yellow-green |
| Sockeye Run | current, rapids, eddies | whitewater teal + tan rock |
| Bluewater Bonanza | swell sets, pressure cells | deep cobalt |
| Redrock Reservoir | spires, canyon lees, traffic | orange/rust sandstone |
| Glowtide Strait | night, glow, information scarcity | near-black indigo + cyan |
| Glacier Sound | drifting floes, calving | steel navy + ice |
| Otter Point | rocky coast, kelp, arches | cold teal-green kelp water, ice-plant magenta |
| Spoonbill Flats | the tide, the cut ladder | amber-gold sandbars |
| Emberfall Isle | eruptions, ash, vents, lightning | volcanic black + ember red |
| Clubhouse Point | the frozen time trial | plain blue |

**Unclaimed hue territory:** grey (storm, fog), purple, pink, lemon yellow, vermilion.

**Geography:** nothing in Africa, Asia or South America yet.

---

## How the candidates were scored

Six axes, 1–5 each, total out of 40.

| | Axis | Weight |
|---|---|---|
| **M** | Mechanic — a rule no venue has, that asks a question every lap | ×2 |
| **U** | Uniqueness — distance from the thirteen in place, look and animals | ×2 |
| **L** | Look — claims an unclaimed hue; the sky can advertise the mechanic | ×1 |
| **T** | Theme — readable at a glance, a real sailing story | ×1 |
| **W** | Wildlife — four real, at least part-aquatic animals; homes for reserved characters (Strut, Gape, Spray, Banks, Blacktip, Fizz, Sovereign, Nook's set, Goblin, Relic) | ×1 |
| **B** | Build — how much the engine already has (current fields, `tide.js`, floes, bridge/arch composites, prop-height lees, ships, wildlife hunts) | ×1 |

Where two candidates share a mechanic only the stronger is kept in the shortlist:
whirlpools go to Naruto (not Corryvreckan or Lofoten), the wind clock to Garda (not
Sydney or Perth), drifting land to Titicaca (not Inle).

---

## The recommended eight

| Venue | Real model | Owns | Hue claim | Score |
|---|---|---|---|---|
| **Whirlpool Strait** | Naruto, Seto Inland Sea | vortex current | jade tidal water + torii vermilion (sakura an accent only) | 37 |
| **Hippo Delta** | Okavango | animals as the hazard | papyrus lime + golden-hour haze (**weakest claim** — savanna gold sits near the Flats' amber) | 36 |
| **Ora Lake** | Lake Garda | the wind reverses on a clock | lemon yellow + cypress green | 36 |
| **Stormbay Passage** | Sydney–Hobart | a three-act passage race with a storm crossing | storm slate, sunset-gold finish | 36 |
| **Reedwater** | Lake Titicaca | the islands (and marks) drift | high-altitude ultramarine + totora straw | 35 |
| **Haar Isles** | Hebrides | fog and visibility | heather purple + fog grey | 34 |
| **Salt Mistral** | Camargue | passing junctions, mistral bursts, the flock | salt-pan pink + salt white | 33 |
| **Sunwall Reef** | Red Sea fringing reef | reading the water; glare hides the coral | rose-granite mauve at golden hour | 33 |

**Left out of the eight, and why:**
- **Tide Pool (35)** gave its slot to Sunwall Reef. It is the riskiest build (it breaks
  `scale.md`, 1 u = 10 cm) and a rocky-shore cousin of Otter Point's tide pools. Its five
  characters (Nook, Surge, Scar, Trinket, Plate) stay designed and benched.
- **Serenissima (33)** was bumped by Stormbay Passage: the most expensive art of the set.
  It would be the game's only city, which is the one reason to bring it back.
- **Várzea (33)** would be a fourth wetland, and its pink collides with Salt Mistral.
- **Fallwater Fjord (31)**: its palette overlaps Glacier Sound, its downdrafts overlap
  Redrock, and Haar Isles takes its characters. If the fjord is wanted anyway, the cleanest
  swap is Fjord in for whichever of the eight proves hardest to build; its card art exists
  (`assets/images/venues/_next-fjord.png`).

### Two cups

| Cup | Venues | Blurb |
|---|---|---|
| **The Weather Cup** | Ora Lake, Salt Mistral, Haar Isles, Stormbay Passage | *A wind switch, a mistral, a fog, a storm. The weather turns in every race.* |
| **Far Water** | Whirlpool Strait, Hippo Delta, Reedwater, Sunwall Reef | *A whirlpool, hippos, drifting islands, a reef you have to remember. The place fights back.* |

Trophy forms not yet used: salver, ewer, shield.

---

## The eight in more detail

### Whirlpool Strait — Naruto

Tidal whirlpools up to 20–30 m across under a suspension bridge, in the fastest tidal
current in Japan. Ride the rim and get slung round; get pulled into the centre and stall.
**Course:** Round the Cans through the strait, under the bridge, and through a torii gate
as a mark. **Build:** Sockeye Run's current field with a rotational term, driven by the
`tide.js` clock; the bridge is a composite like Otter's arches. **Animals:** finless
porpoise, horseshoe crab, red sea bream, octopus.

### Hippo Delta — Okavango

Papyrus channels and open lagoons. Territorial hippos surface and charge your lane; an
elephant herd wading across a channel is a moving wall. **Course:** a Loop through the
channels. **Build:** the gator and shark hunt behaviours in `js/wildlife.js`. **Open
issue:** the palette.

### Ora Lake — Lake Garda

The Pelèr blows from the north from before dawn and dies around midday; the Ora fills
from the south between noon and 1:30 and blows until sunset. Compressed into one race:
a calm band sweeps down the lake and the beat becomes the run. **Course:** a long W/L
laid so the switch rewards anticipating it. **Build:** needs a wind field that changes
over time — the same system Otter Point's unbuilt building sea breeze needs, and
Stormbay Passage's v2 front, so it pays three times. **Animals:** thin — Garda's endemic
carpione trout, pike, eel, grebe.

### Stormbay Passage — a mini Sydney–Hobart

The game's only passage race: one harbour to another, three acts.

| Act | Model | Wind | The question |
|---|---|---|---|
| **1. Down the coast** | Out of the Heads and south along NSW; spectator fleet at the start | NE sea breeze, a kite run or reach | inshore, or out on a south-setting current band (the East Australian Current) with eddies at its edge? |
| **2. The strait** | Bass Strait | the storm: backs south, pressure spikes, a steep sea, rain | where to cross it — the narrow side quickly in a header, or the core lifted and fast but brutal? `heavyAir` decides races here |
| **3. Capes, bay, river** | Tasman Island under the Organ Pipes, Storm Bay, the Iron Pot light, up the Derwent | strong at the capes, then the breeze dies at dusk up the river | can you hold the lead through the parking lot? |

The sky runs morning → storm slate → golden dusk, so it tells you which act you are in.
**Signature moment:** rounding Tasman Island under the columns with the storm clearing
behind, the Iron Pot light across the bay.

**The storm, in two versions.** Everything downstream assumes wind that does not change
over time — the goal field, the baked `course.paths`, the estimate, bot routing.
- **v1, stationary:** a fixed wind region over the strait (veered, heavy, gusty, shifts
  inside the band) with a rain curtain and steep swell sets. No new systems; paths still
  bake.
- **v2, moving (optional):** a roll-cloud front crossing the strait on a clock, so the
  leaders meet it first. Needs Ora Lake's time-varying wind.

**Build:** current band and eddies from Sockeye Run, storm seas from Bluewater's swell
sets, rain from the Lagoon's squall visuals, the Iron Pot light and Tasman Island as
hero props, optionally the Bass Strait ferry as a Lighthouse Cove ship. **Risks:** length
(aim for 6–8 minutes — the longest race, inside the 10:00 objective limit) and three
coastlines against the ~2.5k vertex budget.

**Animals and characters:** spotted handfish (found only in the Derwent; walks on its
fins — first win or explorer), Port Jackson shark (a Shark Pack addition), weedy
seadragon, shy albatross (the storm rung), Australian fur seals on Tasman Island,
humpbacks along the act-1 coast, a southern right whale in the Derwent. **Rung ideas:**
ride the current band its full length; cross the strait without dropping below a speed;
sail the inside passage between Tasman Island and Cape Pillar.

### Reedwater — Lake Titicaca

Floating reed islands drift with the wind, and the marks sit on them, so the course
moves during the race. Reed boats, snow peaks, thin bright air. **Course:** a Triangle.
**Build:** the islands are big, slow Glacier Sound floes. **Animals:** Titicaca water
frog, flightless Titicaca grebe, Orestias killifish, Andean gull.

### Haar Isles — Hebrides

The haar rolls in and shortens how far you can see; you steer by standing stones and a
light. **Course:** a distance loop round several islands (see the circumnavigation
option below). **Build:** Glowtide's information scarcity plus Otter Point's unbuilt fog
bank. **Characters:** absorbs the fjord's — basking sharks (**Gape**) and reintroduced
white-tailed eagles (**Spray**) are Hebridean icons, and **Banks** (cod) fits. Scottish
sea lochs are fjords geologically.

### Salt Mistral — Camargue

Flamingo Reach rescued. The spec's question is kept — *where can I possibly pass?*,
braids narrower than the fleet and a few junctions where passing is possible — but the
palette moves off Bayou olive and Lagoon turquoise to pink salt-pan water. Sluice gates
between the pans, mistral gust bursts, the flock going up across your bow. **Strut**
gets his home.

### Sunwall Reef — Red Sea fringing reef

The second reef venue, built to be the Lagoon's opposite: **there the weather is the
race; here the reef is, and the weather is quiet.**

A fringing reef along a desert coast, the Sinai ridges rose and mauve at golden hour, the
water past the edge dropping straight down to ultramarine. Natural inlets (*marsas*) cut
through the reef into small hidden lagoons. A steady, strong northerly.

**The mechanic — reading the water.** Reef sailors navigate by colour: *brown brown, run
aground; white white, you might; green green, nice and clean; blue blue, sail on
through.* Coral heads show as brown-gold patches in turquoise. The sun sits low and in a
fixed direction; any leg heading toward it gets a glare cone on the water ahead, and the
heads inside it vanish.

**Course:** Out & Back along the wall. Out with the sun behind you, every head visible,
choosing a line through heads and marsa shortcuts. Back into the glare, the same heads
gone — sail the line you remember, or pay to go out onto the deep side. *Do you trust the
line you remember?* The `memory` stat finally matters.

| | Pearl Lagoon | Sunwall Reef |
|---|---|---|
| Where | inside the reef | along its outer wall |
| What decides it | squalls — a weather gamble | the reef, and what you can see of it |
| Wind | gusty cells, dead-air wakes | steady and strong |
| Setting | atoll, palm cays | desert mountains meeting the reef |
| Sky | a squall curtain | a low, hazy sun |

**Characters:** **Sovereign** (Napoleon wrasse, iconic in the Red Sea), **Fizz** (sea
goldie — the orange anthias clouds of Red Sea reefs), **Blacktip** (reserved for "Reef
2"). **Animals:** dugong on seagrass inside a marsa, spinner dolphins resting in a
horseshoe reef, hammerheads on the drop-off, lionfish or bumphead parrotfish on the
flats. **Explorer rung:** thread a marsa end to end.

**Build:** coral heads as hard props with traced outline colliders; water bands are
shallows shapes; the glare is a render cone toward the sun and the sim is unchanged.
**Open question:** the bots know where the heads are and will sail the glare leg
perfectly — either a memory-stat penalty on that leg, or accept it and set the target
from Wes's own run.

**Reef alternatives considered:** *The Pass* (a Tuamotu atoll pass: out through the pass
to an ocean mark and back, tide reversing mid-race, standing waves, dolphins surfing,
sharks massed in the pass — a strong mechanic but the Lagoon's palette exactly, and
current/tide overlap with Sockeye and the Flats). *Outer Break* (Cloudbreak: swell
breaking on the reef edge, shoot the gaps between sets — overlaps Bluewater's swell and
the Tide Pool's surge).

---

## Open: a Middle Sea–style circumnavigation

The Rolex Middle Sea Race starts and finishes in Valletta and runs ~606 nm anticlockwise
round Sicily: the Strait of Messina, Stromboli, the Aeolian and Egadi islands,
Pantelleria, Lampedusa. It is decided by the huge holes in the lee of big islands and the
wind accelerating round capes.

As its own venue it scores **29**: the theme is superb, but its best features are owned —
the erupting volcano by Emberfall, Messina's current and whirlpools by Whirlpool Strait,
island pressure by Stillwater Lake and the hand-authored regions at Redrock and Otter
Point, the long race by Stormbay Passage, and the Mediterranean hues by the Flats (amber)
and Ora Lake (lemon).

**The question it should ask at every island:** *through the gap, tight under the lee, or
wide?* The wind funnels between islands, holes behind each one (sized by height and
shape — the prop-height lees), and stays steady offshore. Going all the way round meets
every island at a different angle, so the answer changes each time — the Loop type as
`venues.md` defines it.

**Two options, undecided:**
1. **Give the shape to Haar Isles** (recommended). Its loop becomes a circuit of three or
   four islands, standing stones marking the side to leave them; in fog, choosing a gap
   you cannot see is a real gamble. No extra slot; a real model in the round-Mull island
   racing.
2. **Its own venue, "Middle Sea Circuit"**, without the volcano and whirlpool. It displaces
   Salt Mistral (Strut can move to the salt pans at Trapani). The catch: two long
   offshore races in one expansion, both leaning on hand-authored wind regions.

---

## All candidates, ranked

Fifty from the first brainstorm, plus Sunwall Reef, Stormbay Passage and Middle Sea
Circuit added after.

| # | Venue (real model) | Hook | M | U | L | T | W | B | Total |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Whirlpool Strait (Naruto) | tidal whirlpools, bridge, torii mark | 5 | 5 | 5 | 5 | 4 | 3 | **37** |
| 2 | Hippo Delta (Okavango) | hippos charge your lane, elephant crossing | 5 | 5 | 3 | 5 | 5 | 3 | **36** |
| 3 | Ora Lake (Garda) | Pelèr → Ora switch, calm band sweeps the lake | 5 | 5 | 4 | 5 | 3 | 4 | **36** |
| 4 | Stormbay Passage (Sydney–Hobart) | coast, storm strait, river finish | 5 | 5 | 4 | 5 | 5 | 2 | **36** |
| 5 | Reedwater (Titicaca) | drifting reed islands carry the marks | 5 | 5 | 4 | 4 | 4 | 3 | **35** |
| 6 | Tide Pool (sketch) | the scale joke; surge sets on a rhythm | 5 | 5 | 4 | 4 | 5 | 2 | **35** |
| 7 | Haar Isles (Hebrides) | fog, standing stones, basking sharks | 4 | 4 | 5 | 5 | 5 | 3 | **34** |
| 8 | Salt Mistral (Camargue) | pink salt pans, sluices, mistral, the flock | 4 | 4 | 5 | 4 | 4 | 4 | **33** |
| 9 | Serenissima (Venice lagoon) | pile-marked channels, water buses, building lees | 4 | 5 | 5 | 5 | 3 | 2 | **33** |
| 10 | Sunwall Reef (Red Sea) | reading the water; glare hides the coral | 4 | 4 | 4 | 4 | 5 | 4 | **33** |
| 11 | Várzea (Amazon) | drowned forest, tidal bore, pink river dolphins | 5 | 3 | 4 | 5 | 5 | 3 | 33 |
| 12 | Southerly Harbour (Sydney) | roll-cloud front, ferries, spectator fleet | 4 | 4 | 3 | 5 | 5 | 3 | 32 |
| 13 | Levante Strait (Tarifa) | gap wind; Iberian orcas take your rudder | 5 | 4 | 3 | 4 | 4 | 3 | 32 |
| 14 | Ice Regatta (Baikal) | iceboats, pressure ridges, open leads | 5 | 5 | 4 | 4 | 3 | 1 | 32 |
| 15 | Fallwater Fjord (sketch) | waterfall downdrafts, the cave behind the fall | 4 | 3 | 3 | 5 | 5 | 4 | 31 |
| 16 | Tablecloth Bay (Cape Town) | the cloud over the mountain warns of the gust | 4 | 3 | 4 | 5 | 4 | 4 | 31 |
| 17 | Doctor's Reach (Perth) | sea-breeze front, black swans | 4 | 4 | 3 | 4 | 4 | 4 | 31 |
| 18 | Meltemi Isles (Cyclades) | venturi between islands, monk seals | 4 | 4 | 3 | 5 | 3 | 4 | 31 |
| 19 | Maelstrom (Lofoten) | tidal vortex, red huts, cod racks | 5 | 3 | 4 | 4 | 4 | 3 | 31 |
| 20 | Inle Lake | floating gardens, leg-rowers | 5 | 4 | 4 | 4 | 2 | 3 | 31 |
| 21 | Canal City (Amsterdam) | drawbridges on a cycle, street-canyon gusts | 4 | 5 | 4 | 4 | 2 | 2 | 30 |
| 22 | Red Lotus Sea (Thailand) | lotus fields drag, pink everywhere | 3 | 4 | 5 | 4 | 3 | 4 | 30 |
| 23 | Silver Dragon (Qiantang) | a tidal bore sweeps the course | 5 | 4 | 3 | 3 | 3 | 3 | 30 |
| 24 | Desert Fjords (Musandam) | fjords in desert, dhows, dolphins | 3 | 4 | 4 | 4 | 4 | 4 | 30 |
| 25 | Kochi Backwaters (Kerala) | Chinese fishing nets dip like timed gates | 4 | 4 | 3 | 4 | 3 | 3 | 29 |
| 26 | Middle Sea Circuit (Malta/Sicily) | gap, lee or wide at every island | 4 | 3 | 3 | 5 | 4 | 3 | 29 |
| 27 | Bosphorus | two-way current, shipping, minarets | 3 | 3 | 4 | 4 | 3 | 3 | 28 |
| 28 | Fragrant Harbour (Hong Kong) | junks, ferries, pink dolphins | 3 | 4 | 4 | 4 | 3 | 3 | 28 |
| 29 | The Pass (Tuamotu; "Reef 2") | reversing pass current, standing waves, shark wall | 4 | 2 | 2 | 4 | 5 | 4 | 27 |
| 30 | Golden Gate (SF Bay) | fog through the Gate; too close to Otter Point | 4 | 2 | 4 | 5 | 3 | 3 | 27 |
| 31 | Williwaw Channel (Beagle Channel) | williwaws skating over the water | 4 | 2 | 3 | 4 | 4 | 4 | 27 |
| 32 | Skerry Garden (Stockholm) | skerries, red cottages, midnight sun | 3 | 3 | 4 | 4 | 3 | 4 | 27 |
| 33 | Chesapeake | crab-pot fields foul the rudder | 4 | 2 | 2 | 4 | 4 | 4 | 26 |
| 34 | Mont-Saint-Michel | galloping tide, the abbey as a mark | 3 | 3 | 4 | 5 | 2 | 3 | 26 |
| 35 | Florida Keys | wandering waterspouts | 4 | 2 | 3 | 3 | 4 | 4 | 26 |
| 36 | Aswan Nile | feluccas, granite islands, dust wind | 3 | 3 | 4 | 5 | 2 | 3 | 26 |
| 37 | Whitsundays (Hill Inlet) | silica sand swirls | 3 | 2 | 4 | 4 | 4 | 4 | 26 |
| 38 | The Solent | the Needles as a mark, huge mixed fleet | 3 | 3 | 3 | 5 | 3 | 3 | 26 |
| 39 | Sargasso | drifting weed rafts, eels | 3 | 3 | 3 | 3 | 4 | 4 | 26 |
| 40 | Kornati (Croatia) | bora gusts over bare white islands | 3 | 3 | 3 | 3 | 3 | 4 | 25 |
| 41 | Columbia Gorge | wind-against-current chop, sturgeon | 3 | 2 | 3 | 4 | 4 | 4 | 25 |
| 42 | Rapa Nui | moai as marks | 2 | 4 | 3 | 4 | 2 | 4 | 25 |
| 43 | Caldera (Santorini) | wind swirling in a crater bowl | 3 | 2 | 4 | 5 | 2 | 4 | 25 |
| 44 | Flamingo Reach (as specced) | superseded by Salt Mistral | 3 | 2 | 3 | 3 | 4 | 4 | 24 |
| 45 | Sundarbans | swimming tigers; too close to the Bayou | 3 | 2 | 3 | 4 | 4 | 3 | 24 |
| 46 | Salt Pillars (Dead Sea) | salt chimneys | 2 | 4 | 4 | 3 | 1 | 4 | 24 |
| 47 | Bermuda | reef boilers, pink sand | 2 | 2 | 4 | 4 | 3 | 4 | 23 |
| 48 | Reversing Falls (Saint John) | rapids that reverse with the tide | 3 | 2 | 2 | 3 | 3 | 4 | 22 |
| 49 | Bay of Fundy | flowerpot rocks | 2 | 2 | 3 | 4 | 3 | 4 | 22 |
| 50 | Ha Long Bay | karst; Glowtide owns it | 3 | 1 | 3 | 4 | 3 | 4 | 22 |
| 51 | Erie Canal | locks | 3 | 3 | 2 | 2 | 2 | 3 | 21 |
| 52 | Maine fog coast | too close to Lighthouse Cove | 3 | 1 | 3 | 3 | 3 | 4 | 21 |
| 53 | Great Lakes | freighters, sea caves | 2 | 2 | 3 | 3 | 3 | 4 | 21 |

---

## Open decisions

- Middle Sea: fold into Haar Isles, or its own venue in place of Salt Mistral.
- Fallwater Fjord: out, or swapped in for the hardest of the eight.
- Hippo Delta's palette claim.
- Stormbay's storm: v1 stationary only, or v2 moving front (and with it Ora Lake's
  time-varying wind).
- Sunwall Reef: how the bots handle the glare leg.
- Cup names and trophy forms.

## Sources (Sep 28 2026)

- Garda winds: [360gardalife](https://360gardalife.com/en/magazine/lake-garda-winds-ora-peler-balin/), [Garda Trentino](https://www.gardatrentino.it/en/outdoor/water-sports/winds)
- Naruto: [Wikipedia](https://en.wikipedia.org/wiki/Naruto_whirlpools), [ANA](https://www.ana.co.jp/en/us/japan-travel-planner/tokushima/0000001.html)
- Iberian orcas: [Wikipedia](https://en.wikipedia.org/wiki/Iberian_orca_attacks), [Noonsite](https://www.noonsite.com/cruising-resources/orcas-and-yachts/)
- Cape Town: [weather.com](https://weather.com/news/weather/news/2023-03-08-weather-words-tablecloth), [Cape Town Data](https://capetowndata.com/en/products/blogpost/761/)
