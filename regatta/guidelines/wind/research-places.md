# How the wind behaves at real sailing venues: a field guide for venue wind design

*Research compiled 1 Nov 2026 for the design of distinct wind fields in a top-down 18 ft dinghy racing game (races of 5–10 min on 0.3–2 km courses). This covers places only. General wind physics and race tactics are covered by a separate researcher.*

## How to read this

- **Sourced vs. estimated.** Figures with a link come from that source. Many sources are race reports, kite/windsurf spot guides and forum posts rather than met-agency climatologies, and they often disagree, so I give ranges and say when sources conflict. Published sources almost never give shift amplitudes or periods in degrees and minutes. Where I give them, they are marked **[est.]**: a designer's estimate drawn from the source's description (for example "very shifty", "flukey", "steady, moving only 180–190°") and from common racing experience. Treat them as starting values for tuning, not measurements.
- **Units.** Knots throughout; mph and km/h are converted (1 kt ≈ 1.15 mph ≈ 1.85 km/h; 1 m/s ≈ 1.94 kt).
- **Gust factor** means peak gust ÷ mean wind. Typical rough values: about 1.2 over open water in a steady sea breeze, 1.4–1.6 offshore or over land, 2+ for katabatic or downslope bursts.
- **Game scale.** A 2 km course fits inside one feature of most of these systems (the Slot, the Gorge, a Canary acceleration zone). At game scale, a venue's personality comes from the **edges** of those features (shadow lines, the edge of a jet, a headland's compression zone) and from the **time evolution** (onset, veer, build, collapse), more than from their full extent.

---

## 1. Sea-breeze bays

### San Francisco Bay: the Slot, Berkeley Circle, Treasure Island, Angel Island
- **Season and strength:** About mid-May to early October, inland heating draws marine air through the Golden Gate at **20–30 kt** ([Brickyard Marina](https://brickyardmarina.com/?p=6688); [Bay Crossings](https://www.baycrossings.com/the-winds-of-summer/)). Mornings are usually **under 10 kt**, building to **15–30 kt** by afternoon and easing toward sunset ([Modern Sailing](https://www.modernsailing.com/article/keys-successful-summer-sailing-sf-bay)). By mid-afternoon the Berkeley Circle and the City-front Slot can reach **30 kt** ([Scuttlebutt](https://www.sailingscuttlebutt.com/?p=110602)). Bay Crossings gives the strength of the driver: about 55°F in SF against 105°F in Vacaville at the same moment.
- **Mechanism:** A thermal low over the Central Valley sits on top of the Pacific High gradient. The Gate is a gap, so the flow is a gap jet that fans out across the Central Bay ("the Slot", roughly 8 nm from the bridge east to the Berkeley flats).
- **Spatial features:** The jet runs down the Slot. **Lees** form behind Angel Island and Tiburon (gentler wind and sunshine; Modern Sailing) and in Clipper Cove behind Treasure Island, which is fully sheltered from the NW-W breeze. The **South Bay often blows 15 kt when the central bay blows 25** (sea.net SF guide). Past the Bay Bridge the city skyline knocks the breeze back to the low 20s on flatter water. One sailor notes that once the westerly is in, the right gains from a **bend around Angel Island**.
- **Water interaction:** Wind against ebb tide makes short, steep chop, and the ebb out of the Gate is the roughest place.
- **Gusts and shifts:** A strong, quite steady jet (gust factor about 1.2–1.3) **[est.]**. Shifts come from geography more than oscillation. They are persistent bends near islands and the City front, roughly 10–20° **[est.]**.
- **Key tactical question:** Which shore gives current relief (the cityfront in the ebb) versus how far to stay in the jet; and when to get out of an island's lee.
- **Summer vs. winter:** In winter the thermal machine switches off. Expect light, variable winds with occasional frontal southerlies and post-frontal NW.

### Long Beach / Alamitos Bay (also typical of San Diego and Marina del Rey)
- Typical race days open with **light SW, 6–8 kt**, and the sea breeze fills to **12–14 kt**, with summer days of **12–18 kt** and top days touching **18–20+** ([Sailing World, Congressional Cup](https://www.sailingworld.com/racing/unpredictable-conditions-at-congressional-cup); [Seabreeze](https://www.seabreeze.com.au/News/Sailing/Congressional-Cup-2010-Berntsson-SWE-all-alone-at-50-after-Day-1)).
- It is a classic thermal sea breeze under the marine layer. When it fails, it fails abruptly: one report has the breeze going **from 16 kt to 3 kt** after a sudden shift.
- **Shape [est.]:** It veers right from SSW toward WSW as it builds. Oscillations are 5–10° on a period of several minutes, with a modest gust factor of about 1.2. A persistent veer of about 20–30° over the afternoon is the usual Southern California pattern.
- **Key question:** "When does it fill and from where?" Early on, the side that sees the new breeze first wins. Later the day becomes a drag race with the shifts played.
- Long Beach will host sailing at LA 2028 ([US Sailing](https://www.ussailing.org/news/winners-crowned-at-long-beach-us-open-sailing-series/)).

### Perth / Fremantle: the "Fremantle Doctor"
- **Season:** Strongest **December–January (20–25 kt afternoons)**, fading to **15–20 kt by late February** ([Seabreeze WA seasonal](https://www.seabreeze.com.au/Articles/Weather/WAs-Seasonal-Shift-Seabreeze-to-Frontal)). In winter (Jun–Aug) frontal westerlies replace the thermal regime.
- **Timing and direction:** It usually reaches the coast around midday, anywhere from about 10:00 to 15:00. It arrives **WSW**, peaks at **SW–SSW**, and by early evening has **backed to S** (Southern Hemisphere: counter-clockwise), per [Wikipedia: Fremantle Doctor](https://en.wikipedia.org/wiki/Fremantle_Doctor). That is a persistent rotation of roughly 40–60° over the afternoon.
- **Driver:** The BoM describes a 4–6 day **west-coast trough cycle**. Hot easterlies blow for 3–4 days and the cycle ends with westerlies that bring "very strong sea breezes in the first day or two" ([BoM](https://media.bom.gov.au/social/blog/2132/meet-the-locals-when-the-weather-gives-the-place-character/)). Doctor strength therefore depends on where in the cycle you are.
- **Failure mode:** At the 2011 ISAF Worlds the Doctor failed to arrive on several days and match racing was postponed. Racing in the morning easterly was "very shifty". On another day strong **20+ kt offshore easterlies** caused ten 49er capsizes ([World Sailing 2011](https://www.sailing.org/2011/12/03/womens-match-racers-battle-tricky-winds-on-perths-inner-harbour)).
- **Key question:** In the morning, a shifty, puffy offshore easterly. In the afternoon, a strong, steady, slowly backing sea breeze where you sail to the persistent shift (left in Southern Hemisphere terms as it goes S).

### Sydney Harbour: NE sea breeze versus the southerly buster
- **Summer NE sea breeze:** Per Yachting World, it is "the best and most consistent… 15 knots plus (sometimes plus quite a lot)… by far the steadiest in strength and bearing". On 18 ft skiff days it often runs **18–25 kt** and has reached 25–30 kt ([Yachting World](https://www.yachtingworld.com/news/british-team-leads-skiffs-in-sydney-45053); [Y&Y](https://yachtsandyachting.com/news/281446/18ft-Skiffs-Blasting-on-Sydney-Harbour)).
- **Southerly buster:** By the BoM definition it is an abrupt change in which southerly winds exceed **29 kt** and the temperature drops at least 5 °C within 3 h, following hot NW days ([BoM](https://media.bom.gov.au/social/blog/2132/meet-the-locals-when-the-weather-gives-the-place-character/)). At the 2015 Sydney Hobart start it was a **180° shift**, from strong NE to S ([Rolex Sydney Hobart](https://www.rolexsydneyhobart.com/race/2015/news/day-1/southerly-buster-causes-havoc/)). It arrives as a visible roll-cloud gust front.
- **Spatial:** **Compression off Bradleys Head** makes boats drag-race into the shore for a port-tack lift. There are holes in the **lee of North Head**. The run to Shark Island is famous for capsizes. Tide splits around Shark Island ([SailGP preview](https://sailing.org/2026/02/27/sailgp-mother-nature-sets-the-stage-for-an-unusual-sydney-showdown/)). Westerlies and easterlies over land make disturbed, uneven pressure and quick shifts.
- **Key question:** On NE days, use the headland compression and lifts. On westerly or offshore days, play the puffs. On buster days, be on the right side when the front arrives.

### Auckland: Waitematā Harbour
- **Prevailing:** SW in summer, with a "solid gust range". The harbour is sheltered by Rangitoto and Waiheke ([Boating NZ](https://www.boatingnz.co.nz/2026/02/sailgp-waitemata-harbour-weather-report)). In northerlies the wind **splits around Rangitoto**, leaving dead spots and a calm "no-man's land" ([Boating NZ](https://www.boatingnz.co.nz/?p=169962)). Bean Rock readings can differ from the rest of the harbour.
- **Character:** ETNZ's Outteridge compared it with Barcelona's stable sea breeze and called it **"puffy, shifty… around Auckland's islands"** ([Y&Y Cup Spy](https://yachtsandyachting.com/news/264325/Cup-Spy-July-15-Kiwi-Cup-testing-starts)). Commentators have named shifts, such as the **"Nga Pipi shift"** off a headland. The Motuihe Channel is notorious for wind-against-tide waves.
- **[est.]** SW gradient of 12–20 kt with a gust factor of about 1.3–1.4. Oscillations are about ±10–15°, with puffs arriving off the land on the left or right of the course.

### Hong Kong: Victoria Harbour
- **Seasons:** NE monsoon from October to March, SW monsoon from April to September ([HKO](https://www.hko.gov.hk/en/publica/gen_pub/sms.htm)). The Strong Monsoon Signal is raised above 40 km/h (about 22 kt).
- **Character:** The NE monsoon is **blocked and bent by the Kowloon Peninsula**, so inside the harbour it is "patchy and shifty". Northerly pressure "comes over the mountains into the harbour", which is shifty and unpredictable ([Y&Y HKRNVR Vase 2025](https://yachtsandyachting.com/news/282772/HKRNVR-Memorial-Vase-2025)). Light SE days run 6–8 kt ([Outimage 2011](https://outimage.net/yachting/11yacht/110514_spring_regatta/110514_spring_reg.htm)).
- **Key question:** Where the pressure spills down off the hills and around Kowloon. It is an urban canyon of water with a lot of current and traffic chop.

### Valencia
- **Pattern:** Gradient NW in the morning dies, then a **SE sea breeze** fills from about 13:00, builds from 10 to 15 kt in the afternoon, and fades after about 18:00. There is an overnight land breeze ([Scuttlebutt archive](https://www.sailingscuttlebutt.com/newsletter-archive/archived_Detail6539.html?key=3649); [Yachting World](https://www.yachtingworld.com/news/americas-cup-good-prospects-today-9142)).
- **Fragility:** In spring it does not fire because the sun lacks power, and high cloud near noon kills it. In Valencia, "shifts less than 10 degrees" count as steady.
- **Key question:** Will the thermal beat the gradient? Expect a dead transition zone between the morning NW and the afternoon SE.

### Barcelona
- **September–October:** Breezes of 9–15 kt. The sea breeze is often very stable: one session's southerly stayed between **180° and 190°** while speed varied from **6 to 13 kt** ([Y&Y Cup Spy](https://yachtsandyachting.com/news/264325/Cup-Spy-July-15-Kiwi-Cup-testing-starts)). That is a ±5° direction band with large pressure (velocity) variation, a good model for "**velocity-driven, not shift-driven**" racing.
- Atlantic systems bring swell of up to 2 m in autumn. Meteorologists said models failed more than expected.

### Marseille (Paris 2024)
- **Summer sea breeze:** Starts **around noon as a southerly and turns through the day to finish from the west**, a persistent veer of about 45–90° over the afternoon.
- **Mistral:** About every two weeks a light Mistral of 15–25 kt sets in. Natural barriers slow it, so it struggles to reach the southern roadstead. Frioul island gives flat water in the Mistral. The **south bay is disturbed by the Calanques mountains**: "very shifty and often cloudy" ([Boatnews meteorologist piece](https://www.boatnews.com/story/46624/olympic-games-2024-what-wind-conditions-will-the-athletes-encounter-on-the-marseilles-race-course)).
- There were four race areas (Corniche, Marseille, Frioul, Calanques). "The wind often doesn't quite reach the shore", and locals say many things in Marseille are "left-handed" ([Yacht.de](https://www.yacht.de/en/regatta/olympic-games/2024-olympic-games-the-nasty-traps-in-the-area-outside-marseille)).
- **Key question:** On sea-breeze days, the veer. On Mistral days, the lee of the islands and coast. Near the Calanques, the mountain disturbance.

### Palma de Mallorca: the "embat"
- **Embat:** A SW sea breeze of about **8–12 kt that builds from midday** and reaches 15–17 kt with sharp, steep waves on good days ([Sail-World](https://www.sail-world.com/news/273149/53rd-Trofeo-Princesa-Sof%C3%ADa-Mallorca-Day-1); [Pressmare](https://pressmare.it/en/regattas/trofeo-princesa-sofia/2025-03-31/the-bay-of-palmas-perfect-start-82781)).
- **Battle zone:** A morning NW gradient (it gusted over **25 kt** in 2023) fights the thermal. In 2025 the thermal "did its best to kill off the brisk NW'ly gradient wind resulting in an interlude of light, shifty winds". This is the dead zone between two winds.
- **Key question:** Will the gradient or the embat win, and in which part of the bay first?

### Cádiz Bay
- **Levante (E):** A gradient wind between high pressure to the north and a low over Morocco. It can blow **25–30 kt** (no Star racing) or a moderate 10–15 kt and is gusty. **Poniente (W):** cleaner and less powerful, dominant November–April. Mean is about 14–18 kt, with tide and current on the course ([52 Super Series](https://www.52superseries.com/venue/puerto-sherry/); [Yachting World](https://www.yachtingworld.com/?p=44406)).

### Kiel (Kieler Woche)
- Mostly **westerly**, an offshore gradient breeze off the land. It swings from cancelled racing ("sea breeze never filled in", gusts of 5 kt) to "survival mode" squall days ([Yacht.de](https://www.yacht.de/en/regatta/kiel-week/kieler-woche-adrenalised-wild-survival-mode-rock-n-roll-on-the-fjord/)). The inner fjord is sheltered and more stable. Courses near Kiel Lighthouse are exposed.
- **[est.]** A W offshore wind over the Baltic coast typically oscillates ±10–20° on a period of 3–8 minutes with a gust factor of 1.4–1.5, and the puffs are visible as dark patches. This is the textbook "offshore puffy, play every shift" venue.

### Weymouth / Portland Harbour (2012 Olympics)
This is the best source anywhere for **direction-specific** geography ([SailJuice venue guide](https://www.sailjuice.com/venue-guide-weymouth/)):
- **SW (prevailing):** "Compression and a bend off the Bill. **Top left is always good, a hard right never pays**. Tack off the line onto the port-tack shift."
- **S:** The wind bends around Portland Bill. The east side is "very light and patchy". Sail middle-right.
- **SE:** Portland shadows the course. There is a wind shadow near the Academy and a left-hander at the top of the beat.
- **NW:** "Gusty, shifts as the wind rolls off Weymouth and the hills."
- **N:** It bends round the Nothe, giving a right-hander in the NW of the bay, and it oscillates off the land.
- **W:** Clean, with **pulses rolling over the causeway**.
- **Sea breeze:** Sets in around **210° and slowly veers to 240°**.
- **Tide:** Under 0.75 kt in the harbour, strongest at the wall gaps. A true southerly "has to go over Portland Island and so is very gusty and full of holes" ([windsurf.co.uk](https://www.windsurf.co.uk/beach-guide/weymouth-portland-harbour/)).
- **Key question:** This depends on direction. Each wind direction has its own permanent geographic bend.

### Solent / Cowes
- **Sea breeze:** The Isle of Wight delays it. It **arrives first in the eastern Solent as a SE**, works past Ryde toward Cowes, and later becomes S/SW. Cumulus over the mainland and **a long calm** come before it ([Yachting World](https://www.yachtingworld.com/5-tips/cowes-week-tactics-western-solent-65617)).
- **Tide dominates:** "Sailing up the middle of the western Solent against the tide rarely pays", so head for a shore. The breeze is stronger near the Island shore, and there is acceleration just west of the East Cowes headland. One crew went from first to last when an early SW sea breeze arrived before the first mark ([YW "last to almost first"](https://www.yachtingworld.com/uncategorized/from-last-to-almost-first-23330)).
- **Key question:** Wind against tide versus shore shelter and current relief. Sea-breeze arrival is a 60–90° persistent shift that comes from one end of the course.

### Rio de Janeiro: Guanabara Bay (Rio 2016)
- **Sea breeze** of **7–12 kt, filling about 12:00** ([Scuttlebutt](https://www.sailingscuttlebutt.com/?p=25799)). It differs a lot inside versus outside the bay and across the six or seven course areas.
- **Inside:** The wind comes over land and mountains. "The wind shifts a lot" (Maegli), and the Niterói mountains "were really affecting the wind" (Scheidt). The **Pão de Açúcar (Sugarloaf, 396 m) course is "very flukey" in 220–230° winds as the breeze bends around the mountain** (PRO Nino Shmueli). Current is strong at the narrow mouth, with back-eddies around the island ([Scuttlebutt "Complicated Sailing"](https://www.sailingscuttlebutt.com/?p=56786)).
- **Outside (ocean courses off Copacabana and Niterói):** "Steadier breeze", rounder swell, and simpler current.
- **Key question:** Inside, it is mountain-bent flukes plus current lanes. Outside, it is a swell-and-breeze drag race.

### Qingdao (2008 Olympics)
- **Light air, fog and current:** The RS:X was postponed when wind was under about **1.6 kt**, and one day was lost to **sea fog and no breeze** ([World Sailing](https://www.sailing.org/2008/08/14/no-racing-on-day-six-in-qingdao/)). The current pushed fleets over the line and **sometimes reversed day to day**. The sea and land breeze is the main local system, with frequent thunderstorms, and occasionally 20–25 kt breaks through after fog ([Y&Y](https://www.yachtsandyachting.com/news/142544/Potential-Olympic-Winds)).
- **Key question:** Current first. In near-calm, find the patches of pressure.

### Enoshima / Sagami Bay (Tokyo 2020)
- Mostly **southerly-quadrant ocean breezes**. Sea state, not wind, is the problem ("no place to hide offshore") ([Scuttlebutt](https://www.sailingscuttlebutt.com/?p=95077)). **Closer to shore the breeze is "shifty and weak"; offshore it is "much more stable and stronger"** ([World Sailing 2018](https://sailing.org/2018/09/11/day-1-morning-report-how-to-follow-world-cup-series-round-1-enoshima/)). The topography around Enoshima Bay strongly shapes onshore winds ([SNAME 2022](https://iris.polito.it/bitstream/11583/2973853/1/sname-jst-2022-09.pdf)). Typhoon days bring big swell ("Big Wave Wednesday").
- **Key question:** Swell technique, plus the inshore-offshore pressure gradient.

### Hyères
- **Mistral:** Days of near-calm, then **three days of back-to-back Mistral**, with the 2023 Olympic Week opening at 25 kt. The Mistral is strongest between Marseille and the Hyères islands and fades east of them. In summer the afternoon thermal is a light **SE** ([Figaro Nautisme](https://figaronautisme.meteoconsult.fr/actus-nautisme-flash/2023-04-24/66648-semaine-olympique-francaise-de-hyeres-du-mistral-pour-ouvrir-la-semaine-olympique)). The Giens peninsula shelters some areas from the Mistral.

### Quiberon Bay (Brittany)
- A 2006 experiment studied it as a **semicircular inshore racing bay** ([AMS paper](https://ams.confex.com/ams/pdfpapers/126544.pdf)). Sea-breeze strength was **negatively correlated with synoptic wind speed**, and with an offshore synoptic flow **the surface wind can rotate clockwise through a full 360° during the day**. Some days start NE and **veer all day**. The afternoon breeze typically arrives SW and veers W. A land breeze starts around **midnight** and grows to a fresh NE ([RCC Pilotage](https://rccpf.org.uk/notice-item/1582/)).
- **Key question:** "How far has the clock hand turned?" Quiberon is the purest example of a rotating persistent shift.

### Kingston, Ontario (CORK, 1976 Olympics)
- A **SW afternoon thermal** on eastern Lake Ontario, normally **10–15 kt** and sometimes building from 12–14 to 17–19 kt. It can fail completely on cloudy or synoptic days ([CORK](https://www.cork.org/sailing-venue/); [Techno293](https://techno293.org/?p=548)).

### Miami: Biscayne Bay (winter circuit)
- Flat water with "**shifty, lake-like conditions**". The local rule: "if the wind's to the left of the south end of Key Biscayne, you go left" ([North Sails](https://www.northsails.com/sailing/en/2019/12/biscayne-bay-local-knowledge-north-sails)). Winter fronts bring 20 kt at sunrise, **25+ gusting low 30s** by 09:00 ([Scuttlebutt](https://www.sailingscuttlebutt.com/?p=61830)), then a NE-E clocking afterwards.

### Port Phillip (Melbourne)
- The sea breeze peaks around **15:00**. The Bass Strait sea breeze interacts with, and usually wins over, the bay breeze in the early afternoon. On "change days" a cold front swings the wind from **NW to SW, the temperature drops 15 °C in minutes**, and squalls follow ([BoM](https://media.bom.gov.au/social/blog/2132/meet-the-locals-when-the-weather-gives-the-place-character/)). The Rip's tidal stream runs **4–7 kt** ([AHO](https://www.hydro.gov.au/n2m/2011/blocks/aus144_1312_2011.pdf)).

---

## 2. Trade winds, lagoons and the tropics

### Antigua (and the Caribbean generally, with the BVI similar)
- **Trades:** Usually **12–20 kt**, between NE and SE. On the south coast the wind bends toward ESE. Winter (Dec–May) is steady at about 18–20 kt; the "Christmas winds" are the strong early-winter pulse.
- **Squalls:** "Winds will usually **increase by 15–20 kt in a squall**, sometimes considerably more, with heavy rain" ([Dockwalk regatta weather](https://www.dockwalk.com/news/antigua-regatta-weather)). A squall is a moving **pressure-and-direction cell**. Typically the wind veers and builds ahead of and under the cloud, and there is a lull behind it.
- **[est.]** Between squalls the trade oscillates about ±5–10° on a 5–15 min period, with a gust factor of about 1.2. Squalls are about 1–5 km across and pass in 10–30 min. The key question is "**which side of the squall do I want?**": the leading edge gives a lift and pressure, the trailing hole kills you.

### Hawaii: channels, tip jets, wakes and Kailua
- **Trades:** Typical summer ENE trades run **7–8 m/s (14–16 kt)** upstream. In the **ʻAlenuihāhā Channel the fastest winds (>9 m/s, 18+ kt) are at the channel exit**, fed by a **tip jet** off NE Big Island. Under SE flow, orographic blocking on Haleakalā turns the channel winds NE ([Hitzl et al., NSF PAR](https://par.nsf.gov/search/author:"Hitzl, David Eugene"); [NWS marine text](https://mesonet.agron.iastate.edu/api/1/nwstext/202002040129-PHFO-WHHW70-MWWHFO)). Gale warnings for Pailolo and ʻAlenuihāhā cite **25–35 kt** when the trades are strong ([Maui Now](https://mauinow.com/2013/06/24/small-craft-advisory-for-rough-winds-and-seas-2/)).
- **Wakes:** Lee-side wake zones change orientation and extent with the trade direction. Behind the big volcanoes (Kona) there are calm or reverse-flow wakes tens of km long.
- **Kailua Bay (windward Oʻahu):** Onshore-cross ENE trades of roughly **13–19 kt** on good days, gusty with windward chop. Outside the trade season the wind is unpredictable, frontal or nothing for months ([Kiteforum](https://se.kiteforum.com/kitesurf/spot/oahu___kailua_bay); [HawaiiYeah](https://www.hawaiiyeah.com/oahu/updates/2026-04-23-windy-day)).
- **Key question:** In the channel, is the jet core on the left or right, and where does it end? Behind the island, how far does the wake extend?

### Bermuda: Great Sound (AC35, 2017)
- "**There aren't many days here when you see a steady day**", and the Kiwis "worked through a minefield of wind shifts" (Burling). Conditions run from 6 kt one day to 20 the next. Fronts swing the wind and force course moves. Small islands and headlands all around the Sound bend and break up the flow ([Scuttlebutt](https://www.sailingscuttlebutt.com/?p=34935); [SI/AP](https://www.si.com/olympics/2017/06/17/ap-sai-americas-cup)).
- **[est.]** Shifts of ±10–20° on short periods (2–5 min) with patchy pressure. It is enclosed water: an "archipelago lake".

### Tahiti, the Society Islands and Bora Bora
- **Dry season (May–Oct):** Trades of about 10–15 kt (some sources say 15–25), from the E-SE. The **Maraamu** is a strong SE surge of **25–35 kt** lasting **3–5 days** (June–Sept). Lagoons are flat. Passes run **up to 4 kt outgoing** ([Tahiti Tourisme](https://www.tahititourisme.com/preparing-you-trip/getting-from-island-to-island/navigating-in-the-islands-of-tahiti/); [Yacht Warriors](https://yachtwarriors.com/destinations/tahiti/cruising-conditions)). The wet season (Nov–Apr) is lighter, with cyclones.
- **Spatial:** Behind each high island (Bora Bora's Otemanu rises 727 m) there is a lee and gusty downdrafts. Over a lagoon behind a reef the wind is the clean ocean trade on flat water, the best of both.

### Mauritius: Le Morne
- **SE trades, May–October (prime Jul–Oct):** About **15–35 kt** depending on source, with a mean of about 20–25 kt ([IKSurf/thatch guide](https://thatch.co/guide/2j1gltk3gck4n/view); [IKO](https://www.ikointl.com/iko-kite-School-detail/about?nid=1913)). The wind wraps around the SW corner of the island and the Le Morne Brabant massif (556 m), making accelerated, gusty cross-shore wind. There is a shallow lagoon with the reef pass (One Eye) beyond.

### Nouméa, New Caledonia
- **SE–E trades (alizé) of 15–20 kt**, with **calmer mornings and breezy afternoons**: the thermal reinforces the trade over the land. Sailing is on flat lagoon water ([NC Tourism](https://www.newcaledonia.travel/en/lagoon/boardsports); [Seabreeze forum](https://www.seabreeze.com.au/forums/Windsurfing/General/windsurfing-in-New-Caledonia?page=1)).
- **Personality:** "Trade plus thermal". It is predictable, builds by 5–8 kt from morning to afternoon **[est.]**, and is steady in direction (±5°).

---

## 3. Gap, funnel and acceleration-zone winds

### Columbia River Gorge / Hood River
- **Mechanism:** Pressure difference across the Cascades. Summer westerlies come when the Pacific High sits offshore and a thermal low forms inland, and are strongest in the **afternoon**. Researchers find the Venturi effect secondary; stability, shear and hydraulic effects matter ([Mass, UW gap-flow papers](https://atmos.washington.edu/~cliff/gorge.html)).
- **Strength:** Typical summer **18–25 mph (16–22 kt)**, often about 25 mph, with **35+ mph (30+ kt)** days. A single day can run 10–30+ mph. May–September ([MacKite](https://www.mackiteboarding.com/news/kiteboarding-travel-guide-hood-river-oregon-usa-destinations-ep-03/); [IKSurf](https://www.iksurfmag.com/travel-guides/americas/usa/hood-river)). Riders report gusts of up to 50 kt in narrow spots.
- **Water:** The **current runs west, downstream with the wind**, so the "swell" faces upstream and stands up. Where the river runs against the westerly in a bend, you get steep wind-against-current rollers.
- **Spatial [est.]:** It is a channel about 1–1.5 km wide with a jet core of roughly 25 kt. Wind is lighter in the lee near the Oregon bank at Hood River and in holes behind the bluffs. It is stronger in the "**Swell City**" and "**Doug's Beach**" reaches. In winter the gradient reverses into an **easterly gap wind** (cold, from the interior high).
- **Key question:** Where is the jet core and where are the holes along the walls? Downwind, ride the current.

### Strait of Gibraltar / Tarifa: Levante and Poniente
- **Frequency:** The Levante blows about **110–130 days a year** and the Poniente about **135–155 days a year** (AEMET reanalysis, [AEMET repo](https://repositorio.aemet.es/handle/20.500.11765/17804?mode=full)).
- **Strength:** The **Levante usually reaches about 30 kt and can blow 50+ for days, very gusty**. The Poniente is about 20 kt and smoother ([Surfski wiki](https://www.surfski.wiki/tarifa); [Kite & Windsurf guide](https://www.kite-and-windsurfing-guide.com/en/continents/countries/regions/strait-of-gibraltar-tarifa-)).
- **Mechanism:** A gap between two continents. The Levante accelerates westward through the narrows and comes off the land at Tarifa (offshore, gusty, with downslope bursts off the sierra). The Poniente comes in off the Atlantic (onshore, steady).
- **Personality:** **The same venue with two opposite personalities**: offshore and bursty (gust factor about 1.5+) versus onshore and smooth (about 1.2).

### Canary Islands: acceleration zones and wakes
- **Acceleration:** The NE trades funnel around the high islands and **accelerate on their SE and NW corners**. Between Tenerife and Gran Canaria the wind rose **from 18 to 25 kt**, and forecasts underestimate it ([Mailasail](https://blog.mailasail.com/caramor/posts/2014/11/7/53-tenerife-to-gran-canaria); [Hello Canary Islands](https://www.hellocanaryislands.com/experiences/the-best-sailing-routes-in-the-canary-islands/)).
- **Wake:** "With NE wind the lee can extend roughly **ten island heights** downwind, up to about 20 nm for Tenerife", with becalming risk ([World Sailing 2004](https://www.sailing.org/2004/10/12/latest-news-9/)). SAR satellite images show **wind shear lines** (the wake edges) downstream of Gran Canaria, with wake length set by island height ([Scientia Marina](https://scientiamarina.revistas.csic.es/index.php/scientiamarina/article/download/712/728/727)).
- **Season:** July is the windiest month and the trades are nearly constant (about 14 kt mean, more in the zones). Lanzarote shelters Fuerteventura's north a little ([Fuerteventura Guide](https://www.fuerteventuraguide.com/?p=3378)).
- **Personality:** A **hard-edged jet beside a dead wake**. The edge (the shear line) is sharp, from a few hundred metres to 1 km wide, with 15–25 kt on one side and 0–8 kt on the other **[est.]**.

### Wellington / Cook Strait
- **Funnel:** Cook Strait is the gap between the North and South Islands. Wellington averages **173 days a year with gusts above about 32 kt**. **October** is the windiest month (27 days over 15 kt, 19 over 20 kt) and July the least windy. About 37% of wind is from the north ([CruisersWiki](https://www.CruisersWiki.org/wiki/Wellington)).
- **Local:** "The NW funnels down the hills around Karori Rock and Sinclair Head, much stronger than surrounding". In a strong northerly, the northern harbour has few waves but "**very strong gusts coming out of the gullies and valleys**" ([Greater Wellington Skippers Guide](https://concessions.gw.govt.nz/assets/Documents/2023/11/Harbours-Skippers-Guide-v7_web.pdf)). NW gales are localised, while S gales cover the whole strait.
- **Personality:** A northerly gap wind with **valley-mouth bullets**, gusts arriving in fixed lanes from the gullies.

### Strait of Magellan
- Steady **westerlies funnelled** from Pacific to Atlantic, plus **williwaws**: sudden katabatic gusts off the mountains, "most common in the Strait of Magellan" ([WeatherOnline](https://www.weatheronline.pl/reports/wind/The-Williwaw.htm)). Punta Arenas sits on flat ground with frequent strong winds. See also §9.

### Bass Strait
- Westerly flow is "tunnelled/channelled such that in **eastern Bass Strait wind speeds can nearly double those further west**". Fronts come every **1–2 days** when the westerly belt is active, and SE gales are rare and mostly in autumn ([RYCT Tasmania summer weather](https://ryct.org.au/wp-content/uploads/2021/04/Tasmania-summer-weather.pdf)). Wind against the Rip ebb is dangerous.

### Mistral (Rhône valley to the Gulf of Lion)
- Météo-France describes it as cold, dry, **averaging about 27 kt (50 km/h) with gusts to about 54 kt (100 km/h)**, and it often exceeds 52 kt in the lower Rhône ([AMS Glossary](https://glossary.ametsoc.org/wiki/mistral/); [Wikipedia](https://en.wikipedia.org/wiki/Mistral_(wind))). It lasts **several days, up to a week**, sometimes with lulls. In exposed spots it blows about 100–150 days a year (unsourced estimates).
- **Character:** It comes out of a valley under a clear sky, gusty and cold. At sea it is NW and steady in direction but **gusty (gust factor about 1.6–2.0)** with short, steep seas. It **fans out and weakens** toward the east (Marseille to Hyères).

### Tramontane (Roussillon / Leucate)
- A **N–NW** mountain gap wind between the Pyrenees and the Massif Central. "Strong, dry, cold, **gusty at times**", **up to 50 kt**, and the marketing claim is "300 days over force 4" ([Ultimate France](https://ultimatefrance.com/kitesurfing/south-france/leucate-la-franqui)). It blows **cross-offshore** at Leucate over flat lagoons (La Palme), which gives gusty flat-water speed sailing. The marine SW alternative is steadier and lighter.

### Bora (Trieste / Adriatic)
- A cold, gusty **NE katabatic/downslope** wind over the Dinaric Alps. **Trieste city gusts usually exceed 65 kt (120 km/h), with maxima near 108 kt (200 km/h)**. Winter gusts regularly exceed 54 kt, and the record is 99 kt (183 km/h, Feb 2012) ([Wikipedia: Bora](https://en.wikipedia.org/wiki/Bora_(wind)); [EGU24](https://meetingorganizer.copernicus.org/EGU24/EGU24-19086.html)).
- **Structure:** It is famously **pulsating**. The *refoli* are individual bursts separated by lulls. In the meteorological literature the pulsations have periods of about **3–11 minutes** (Belušić et al.; general literature, **[est.]** from memory). The mean is moderate and the gusts are double it (**gust factor about 2**). It is also **jet-and-wake banded** along the coast: jets below the passes (Senj, Trieste) and calmer gaps between.
- **Key question for a game:** A periodic, predictable heartbeat of bursts, plus fixed jet lanes downwind of the mountain gaps.

### Meltemi (Aegean)
- **June–September (peak Jul–Aug):** N–NNE. Typically **Beaufort 4–5 (11–21 kt), reaching 7–8 (28–40 kt)**. It **starts early afternoon and dies at sunset**, lasts days (one account: 7 days), and **accelerates between islands** while being weaker near the coasts. About 15 mb of pressure difference gives about Force 7 over open sea ([Sailing Issues](https://sailingissues.com/meltemi.html); [Dream Yacht](https://www.dreamyachtcharter.com/mastering-the-meltemi-for-exhilarating-aegean-sailing-in-greece/)).
- **Spatial:** Strong channels (Mykonos–Tinos, Andros–Evia "Cavo Doro") alternate with **violent downslope gusts in the lees** of high islands (the south coasts get bullets, not calm).

---

## 4. Lakes and mountain lakes

### Lake Garda: Pelèr and Ora (the archetype of the mountain lake)
- **Pelèr (N):** Blows from **night until late morning** (about 05:00–11:00/12:00), **about 20 kt and often 30** (Visit Malcesine). It is strongest on the **west (Brescia) side near Capo Reamol** and strengthens as it flows south down the lake. It is a summer good-weather wind ([Visit Malcesine](https://www.visitmalcesine.com/en/the-winds-of-lake-garda); [Fraglia Vela Malcesine](https://www.fragliavela.org/en/wind-lake-garda-race-course-fraglia-vela-malcesine/)).
- **Transition:** A calm around **11:00–13:00**.
- **Ora (S):** Starts **12:00–13:00 and dies at sunset**. It is normally **about 14–15 kt at Malcesine** and **stronger the farther north you go**: at Torbole, Hotel Pier gets 18–20 kt against 12–14 at the beach ([Surf-magazin](https://www.surf-magazin.de/en/spots-and-areas/international/italy/wingfoiling-on-lake-garda-between-ora-vento-and-endless-foil-sessions-the-best-spots-on-lake-garda/)). It is strongest in spring and early summer, weakened by cloud and by small day-night temperature ranges. It makes a small wave.
- **Which side pays:** At Malcesine, "boats sailing close to the coast… get wind from the left: the coast advantage, to be exploited at maximum" (Fraglia Vela). The pro tip on the end of the breeze: "If the wind enters from the right and moves to the centre, then centre-left, the wind is about to end."
- **Storm inversions:** Clouds over Monte Baldo or Limone bring **violent bursts lasting 5–10 min** with a temperature drop. Inversions usually flip S to N. Peler can hit **35–40 kt** in storms, and the Balin builds from light to **about 40 kt** quickly ([360 Garda Life](https://360gardalife.com/en/magazine/lake-garda-winds-ora-peler-balin/)).
- **Personality:** Morning one way, afternoon the other, a calm in between, and **shore-side pressure and bend lanes** along the 2–3 km wide steep-walled lake.

### Silvaplana: the Maloja wind
- **Thermal:** It reaches the lake from the SW down the valley. It "**picks up shortly before midday and then rapidly increases**", peaks **15:00–17:00 at 20–25 kt**, and drops at **18:00–19:00** when the sun goes behind the mountains. Typical days are **Bft 4–5 with peaks of 6**; westerly flow aloft pushes it to 6–7. It is windy about **80% of days June–Sept**. A **north foehn below −6 hPa suppresses it**. One session showed **alternating phases**, good late morning, weaker early afternoon and a climax of 15:00–16:15 with gusts of **29 kt** ([Kitesailing.ch](https://kitesailing.ch/en/spot/weather-kitesurfing); [Waterwind](https://www.waterwind.it/new/en/windsurfing/reports-and-photos/session-reports/983-silvaplana-engadin-switzerland-12-august-2018.html)).
- **Personality:** A clockwork afternoon thermal on a small lake (about 3 km) at 1,800 m, with pulses.

### Lake Como: Breva and Tivano
- **Tivano (N, morning):** Usually done by about **08:30–09:00**, 2–4 Bft (7–10 kt), stronger in the southern arms.
- **Breva (S, afternoon):** Arrives early afternoon, **about 15 kt and up to 25** when reinforced from the Po plain, Bft 5 in the north basin (Domaso). It is strongest where the lake narrows (Dervio, Cremia). The Livo valley adds a SW component near Domaso late in the day ([Waterwind Domaso](https://www.waterwind.it/new/en/windsurfing/spots/spots-reviews/240-domaso-the-windsurf-spot-on-como-lake-best-loved-by-foreign-riders.html); [Yacht.de](https://www.yacht.de/en/travel-and-charter/italy/destination-lake-como-italy-at-its-best/)).
- **Personality:** The same flip as Garda, but **side valleys inject cross-wind** at known points.

### Lake Geneva (Léman)
- "**Usually light in the extreme**, but violent gusts can bowl down from the surrounding mountains." Light air has bred huge-sail boats. In the 2025 Bol d'Or, light breezes on Saturday turned into strong gusty storms ([Yacht.de](https://www.yacht.de/en/regatta/races/lake-geneva-realteam-spirit-triumphs-at-the-86th-bol-d-or-du-leman/)). The local named winds (well documented elsewhere) are the **Bise** (NE, cold, steady for days, it can reach 30–40 kt down the length of the Petit Lac), the **Vent** (SW, frontal) and the **Joran** (NW, a sudden evening downslope squall off the Jura), plus the summer morning/evening **séchard/morget** land breezes.
- **Personality:** Hours of nothing, then a **downslope squall front** that hits within minutes.

### Lake Constance (Bodensee)
- Usually light. There is an official two-tier warning: **40 flashes/min for gusts 25–33 kt, 90/min for gusts over 33 kt**. **Föhn** can bring storm-force gusts under a blue sky "within minutes", and summer thunderstorms from the W can build **in 20 min** ([Boote magazin](https://www.boote-magazin.de/en/travel-and-charter/charter/thunderstorms-and-the-foehn-wind-on-alpine-lakes-how-the-storm-warning-service-works/)).

### Lake Tahoe
- **Washoe Zephyr:** An afternoon W–SW wind, mid-afternoon into the evening, "**veering from west to southwest and becoming quite gusty**", with sustained winds up to about 20 kt ([AMS](https://glossary.ametsoc.org/wiki/washoe-zephyr/); [Skybrary](https://skybrary.aero/articles/washoe-zephyr)). Lake Wind Advisories cover SW **13–22 kt gusting about 40 kt** with 2–4 ft waves.
- **Personality:** A clear high-altitude lake, glassy mornings and a gusty afternoon downslope westerly coming off the Sierra crest onto the lake.

### Lake Taupō
- MetService lake forecasts show **SW 25 kt gusting 35** days and NE 15–20 kt days ([NZ Herald](https://www.nzherald.co.nz/weather/taupo)). It is a big (about 600 km²) volcanic caldera lake that builds waves quickly. The steep western cliffs and bays give gusty offshore sections in the westerlies **[est.]**.

### Lake Balaton
- A shallow lake (mean about 3 m). Summer **storms build suddenly, usually as a N or NW wind, raising 2–3 m waves on the south shore**. There is a storm-warning system from April 1 to Oct 31, with red issued above about 62 km/h (33 kt). Kékszalag forecasts mention NW gusts of **24–27 kt** ([CruisersWiki](https://www.CruisersWiki.org/wiki/Balaton_Cruising_Guide); [RSOE](https://www.rsoe.hu/en/viharjelzes)).
- **Personality:** Shallow, fast-building chop. The north shore is the high, wooded, gusty offshore side and the south shore is flat and gets the waves.

### Inland US club lakes ("shifty, puffy")
- "**Trees and man-made features cause wind shadows and holes, but also create sweet spots** with more wind, more often." Shifts of "**25 degrees or more**" relative to the mark are common, so courses are skewed ([US Sailing Lake Tips](https://www.ussailing.org/news/lake-sailing-tips); [Sailing World](https://www.sailingworld.com/?p=72246)). In Sunfish NA champion Conner Blouin's experience, shiftier courses produce higher average scores ([Sunfish Class](https://www.sunfishclass.org/shiftyconditions-connerblouin)).
- **[est.]** Mean 6–12 kt, gust factor 1.5–1.8, shifts ±15–25° every 1–3 min, puffs about 50–200 m across that **fan out** (a puff from the left lifts port tack at its left edge, the "fan" effect). Wind shadows extend about **5–10× tree height** (a 20 m tree line casts a 100–200 m dead zone), and the **upwind shore** stays light for up to 30× height **[est.]**.

### Lake Powell and desert reservoirs
- Afternoon winds build through midday and peak in the afternoon, often ahead of fronts, with **SW gusts of 35–52 kt** in advisories. One **August storm swamped 13 vessels with gusts to 47 kt and 6–7 ft waves**. Narrow canyons can be worse, not sheltered ([St George News](https://www.stgeorgeutah.com/news/archive/2016/03/22/wind-advisory-issued-for-lake-powell-small-watercraft-warning); [NPS via National Parks Traveler](https://nationalparkstraveler.org/node/20711)).
- **Personality:** Canyon channelling, so wind blows along the canyon axis whatever the gradient. There are **thunderstorm outflow/microburst** events, a radial gust front of 30–50 kt arriving from a visible cell.

### Lake Titicaca (3,812 m)
- **Glass at dawn and chop by mid-afternoon.** "Strong **westerly** winds blow across Titicaca in most months", and the **wind is channelled between steep-sided islands** ([NASA Earth Observatory](https://earthobservatory.nasa.gov/images/89403/sunglint-on-lake-titicaca); [HowToPeru](https://howtoperu.com/answers/lake-titicaca-what-felt-worth-it-what-id-skip-next-time/)). The wet season (Dec–Feb) brings afternoon storms.

---

## 5. Rivers and estuaries

### General river pattern (Norfolk Broads, Thames and others)
- **Wind follows the banks:** "As the river bends and twists, the wind may begin to blow from the wrong direction", so **sail up the inside of each bend**. Faster current runs on the **outside of bends**, slower on the inside ([PBO Broads tips](https://www.pbo.co.uk/cruising/12-tips-sailing-norfolk-broads-17423)). "Single buildings and trees cause a narrow shadow, so pass close. For larger blockages pass **about two-thirds of the way across**." Stay "mid-river away from the dirty wind along the shorelines".
- **[est.] for a game:** The wind field is **steered by the channel**. Inside about 3–5 channel widths of a bend, the wind direction rotates partly with the channel (by roughly 30–60% of the bend angle). Tree-lined banks make 30–100 m light bands. Gaps between woods, at side creeks or fields, let **jets** across the river.

### Hudson River
- "Can flip from sheltered to choppy as winds **funnel between buildings or around headlands**." Watch for **sudden shifts near the Palisades and channel openings**. Steadier sea breezes come late morning, gusty near tidal points ([Adventure Collective](https://app.advcollective.com/destinations/cliffside-park-new-jersey/water-activities)). Strong tidal current with wind-against-tide waves ([SailNet](https://www.sailnet.com/threads/sail-report-hudson-means-currents.351100/)).
- **Personality:** A **cliff-walled river**. The Palisades (150–160 m cliffs) bend the wind along the river axis and make downdrafts and holes near the wall.

### Elbe (Hamburg–Blankenese)
- Tidal: current, river inflow, wind and North Sea level all shape the flow, and the BAW publishes **current-edge** charts ([Yacht.de](https://www.yacht.de/en/north-sea-week-2013-detailed-current-data/)). Charter departures follow the tide. **Key question:** current edges and lanes; the wind is secondary.

### Columbia (see Gorge, §3) and the St Lawrence
- The St Lawrence at Kingston is the outflow end of Lake Ontario's SW thermal (§1). Downstream (the Thousand Islands) island lees and current are everywhere.

---

## 6. Swamps, bayous and sheltered tree-lined water

### Louisiana: Lake Pontchartrain and the bayous
- In summer the background wind is light and thermal, then **afternoon thunderstorms** hit. NWS marine warnings for the lake cite **gust fronts of 30 kt**, gusts of **34–40+ kt**, clusters **over 50 kt**, and **waterspouts** ([NWS via WMO](https://wwmiws.wmo.int/index.php/metareas/display/bulletin_download/WHUS54_KLIX/20260707214311299239); [AllisonHouse](https://warnings.allisonhouse.com/2026061923.MWS)).
- **Bayou proper [est.]:** Narrow, tree-walled water (cypress about 15–30 m tall) sits almost entirely inside wind shadows. Expect 0–5 kt with **zephyrs and cat's-paws** where gaps open. The only real wind is the gust front from a storm cell, which arrives through the canopy as a sudden, radial, 90–180° direction change.

### Florida inland lakes (Lake Monroe, etc.)
- Light mornings, then **shifting breeze**, then thunderstorms. The second day of one Sanford Sailfest was cancelled for forecast **storm gusts to 35 kt** ([Y&Y RS Aero](https://www.yachtsandyachting.com/news/212999/?source=rss)). Late fall to spring is steadier with fewer storms.

### Everglades and mangrove water
- (No sailing-specific source found.) The pattern is the same as the bayou, with lower vegetation (mangrove 3–10 m), so shadows are shorter. The sea breeze from both coasts can meet inland and touch off afternoon convection.

---

## 7. Open ocean

### Southern Ocean
- **Climatological mean 15–24 kt** between 40° and 60°S, strongest at 45–55°S and in July–August ([SEOS](https://seos-project.eu/oceancurrents/oceancurrents-c02-p05.html)). Vendée Globe fleets report gusts of **45–47 kt** in squalls, and Ellen MacArthur described squalls going "**from 15 to 30 knots in one hit**" ([Yachting World](https://www.yachtingworld.com/news/anatomy-of-a-southern-ocean-storm-1601)).
- **Personality:** Big, long-period swell and a frontal sequence. Ahead of a front the wind is NW and building; at the front it veers to W–SW with squalls; behind it come cold SW and squalls. The **pre-frontal/post-frontal veer of about 60–90°** is the big persistent shift.

### Trade-wind passages
- Steady trades of about 15–20 kt with **squall lines** (see Antigua). At night squalls are more frequent over the open ocean (maritime convection peaks around dawn).

### Ocean courses at Olympic venues
- **Rio outside (Copacabana and Niterói):** A steadier breeze than inside, with rounder ocean swell ([Scuttlebutt](https://www.sailingscuttlebutt.com/?p=56786)).
- **Enoshima offshore:** "Much more stable and stronger" than inshore, with typhoon swell. Here the race is about waves and rhythm, not shifts.

---

## 8. Rocky headland coasts

### Monterey Bay and Point Pinos
- **Summer:** Glassy mornings (June–July fogged in until late morning). By noon the **NW fills at 10–20 kt**, building to **15–25 kt** by early afternoon and dying at sunset. It is reliable enough for race scheduling in July–August. "**Point Pinos creates an acceleration zone: boats rounding the point from the south should expect the breeze to abruptly double**" ([sea.net Monterey guide](https://www.sea.net/blog/sailing-monterey-bay-guide)). NWS small-craft advisories cite **NW 15–25 kt gusting 30** ([NWS PZZ535/560](https://forecast.weather.gov/shmrn.php?mz=PZZ560)).
- **Spatial:** The south side of the peninsula (Carmel and Big Sur) gets acceleration around the point. **Inside the bay, behind the point (Monterey Harbor and Cannery Row), it is lighter and backed**, an expansion lee. The coastal jet is strongest off headlands.

### Point Conception
- "**A 15-knot offshore breeze reaches 25 kt at the cape**", so round early in the morning ([sea.net Santa Barbara](https://www.sea.net/destinations/santa-barbara)). It is the corner where the California coast turns east. North of it the NW is often 25–35 kt; inside the Santa Barbara Channel it is frequently light. The **Sundowner** is a gusty evening downslope (offshore N) wind off the Santa Ynez Mountains, with three regimes ([SWEX](https://impacts.ucar.edu/en/publications/the-sundowner-winds-experiment-swex-in-santa-barbara-california-a/); [Klimczak & Dorman 2002](https://sbbotanicgarden.org/wp-content/uploads/2022/08/Klimczak_-Dorman-2002-Downslope_wind_events_SB_Channel.pdf)).
- **Personality:** A headland with a **hard on/off line**: it blows 25+ outside and is calm inside, separated by a sharp edge.

### Cape Town: the Cape Doctor
- **Strong, persistent, dry SE, roughly September–March** (peak Nov–Feb), "often for days on end". It forms the **tablecloth** on Table Mountain ([Wikipedia](https://en.wikipedia.org/wiki/Cape_Doctor); [AMS](https://glossary.ametsoc.org/wiki/tablecloth/)). Gusts of about **86 kt (160 km/h)** have been quoted around Table Bay (a travel magazine, so treat with caution).
- **Spatial (well known locally):** The SE spills over Table Mountain and the Twelve Apostles as **downslope gusts**, making violent, variable bullets in the City Bowl and Table Bay near shore. Out at Blouberg and Big Bay the flow is steadier (25–35 kt), and it is cross-onshore at Blouberg.

### Langebaan Lagoon (West Coast)
- **Summer S–SE/SW, about November to March.** It "stays at 25 kt but often goes up to 40". SE days start in the morning, around 07:00 by one account; **SW days start midday**. **Tidal currents up to 8 kt** "really screw with your apparent wind" (claimed) ([Seabreeze forum](https://www.seabreeze.com.au/forums/Kitesurfing/General/Langebaan?page=1); [Kiteforum Shark Bay](https://se.kiteforum.com/kitesurf/spot/shark_bay)).

### Falmouth / Carrick Roads (Cornwall)
- Carrick Roads is relatively sheltered. **SW is offshore and very gusty** at the St Mawes side ([windsurf.co.uk](https://www.windsurf.co.uk/beach-guide/st-mawes/)). This is an archetypal ria (drowned river valley): wooded high banks, gusts down the creeks.

### Brittany (Quiberon, see §1)
- A strong, complex sea breeze that rotates through the day. On the outer coast, rocky headlands and tide races.

### Cape Hatteras / Pamlico Sound
- **SW is most common in late spring and summer.** Thermals and fronts give **15–30 kt**. The sound is flat and waist-deep. **SW winds increase along the Salvo → Slick downwinder run** ("windier at the finish"). In autumn the dominant wind shifts to NE ([Real Watersports](https://www.realwatersports.com/blogs/news/cape-hatteras-wind-stats)).
- **Personality:** A long, flat barrier-island sound with a **gradient that builds along its length**.

---

## 9. Volcanic islands

### Canary Islands (see §3)
Acceleration corners, ten-height wakes and wake shear lines.

### Lanzarote / Fuerteventura
NE trades peak in July and are "nearly constant". Costa Teguise and Costa Calma are the windiest spots. **Dark lava fields heat strongly and add a thermal component**: the trade is often stronger in the afternoon **[est.]**.

### Hawaii (see §2)
Tip jets, channel exits and Kona-side wakes.

### Azores (Horta, Faial–Pico)
- The season runs **June to mid-September**, with westerlies early, SW in the west in August and N further east ([Noonsite](https://move.noonsite.com/place/azores/view/weather)). Faial–Pico channel tides are strong. Sailing logs report gusts of **40–50 kt** in SW blows near Horta ([Mailasail](https://blog.mailasail.com/cat-man-do/posts/2008/5/30/59-the-good-the-bad-and-to-be-honest-rather-ugly)). **Pico (2,351 m)** throws a big lee and corner jets in the Faial channel **[est.]**.

### Aeolian Islands / Stromboli
- N–NW Tramontana/Maestrale, usually **Bft 2–4**, with **afternoon thermals near coasts and between islands**. In the lee of Stromboli (924 m), Middle Sea Race fleets see the wind "**die completely, down to 3–4 knots**", then pick up beyond it ([Yachting World](https://www.yachtingworld.com/?p=19035); [Yacht.de](https://www.yacht.de/en/travel-and-charter/italy/aeolian-islands-stromboli-itinerary-la-dolce-vita-and-volcanic-spectacle/)).
- **Personality:** A **cone-shaped lee hole** behind a symmetric volcano, with acceleration around both flanks.

### Iceland (Westfjords)
- **Katabatic winds descend from the glaciers.** The Icelandic Met Office warns of "**violent gusts near mountains reaching 40 m/s (78 kt) or more**" in gale situations, and boats broke free in Ísafjörður ([IMO](https://en.vedur.is/about-imo/news/nr/2576)). Sailors report that the breeze **drops inside a fjord while gusts outside stay over 20 kt** ([IWDG](https://iwdg.ie/leg-3-west-fjords-weather-not-doing-us-many-favours/)).
- **Personality:** Calm fjord water broken by **downslope gust bursts** off the walls and glaciers.

---

## 10. Fjords, arctic coasts and glaciers

### Norwegian fjords
- "**Huge gusts to no breeze in a span of seconds**" (charter sailor). Wind **channels along the fjord axis** into the main fetch directions ([UiS fjord wind study](https://uis.brage.unit.no/uis-xmlui/handle/11250/3032561)). Summer has the sea breeze **up-fjord in the afternoon**; nights bring **down-fjord drainage (fallvind)** from glaciers and high plateaus **[est., from the general literature]**.
- **Personality:** The wind is **always along the fjord**, up or down, never across. Side valleys deliver cross-gusts.

### Greenland: the piteraq (Tasiilaq)
- Low-pressure systems off East Greenland trigger downslope storms off the ice sheet, funnelled by the Tasiilaq valley. The onset is **near-instant**: "the calm breaks almost instantly", and a sudden clearing of the sky is the warning. **Gusts were estimated at 72–90 m/s (140–175 kt) in the 1970 event.** A 2026 preprint proposes a **15 m/s (29 kt)** threshold at Tasiilaq. Strong events happen up to about 15 times a year ([ESKP](https://www.eskp.de/en/natural-hazards/piteraqs-downslope-wind-storms-in-southeast-greenland/); [WHOI Oceanus](https://www.whoi.edu/oceanus/feature/piteraqs); [EGUsphere 2026](https://egusphere.copernicus.org/preprints/2026/egusphere-2026-3687/egusphere-2026-3687.pdf)).

### Svalbard (Kongsfjorden / Isfjorden)
- Wind fields are driven by **terrain and thermal contrasts** between water, ice and bare ground. **Low-level jets regularly come from katabatic flow**, with near-surface katabatic flow measured **up to about 5 m/s (10 kt)**. Isfjorden has a **sea-breeze-like circulation** that can persist for days in July ([Polar Research](https://polarresearch.net/index.php/polar/article/download/7884/14996)).
- **Personality:** A gentle, steady **down-glacier drainage breeze (5–10 kt)** off each glacier front, colliding with the up-fjord breeze. It is a mild version of the fjord pattern and good for a quiet arctic venue.

### Patagonia / Tierra del Fuego: williwaws
- Cold air from the ice fields drops down the slopes and "can take an anchorage **from flat calm to over 100 kt within a minute or two**" (estimates range from 100 to 130 kt). They are "too small to show on synoptic charts" and come "often under blue sky" ([Yachting Monthly](https://www.yachtingmonthly.com/cruising/cruising-life/sailing-patagonia-exploring-a-stunning-barren-landscape-by-boat-92791); [Boatnews](https://www.boatnews.com/story/47852/katabatic-winds-understanding-the-risks-to-navigation)). They are visible as **spray columns and dark water racing across a bay**.
- **Personality:** Calm water with **random, violent, short-lived bombs** (tens of seconds to minutes), coming down off the cliffs in arbitrary directions.

### Alaska: Taku winds (Juneau)
- These are a **mountain-wave** phenomenon, not simple drainage. A critical layer aloft traps the wave energy. **Weak waves give 30–43 kt gusts and strong waves 52–87 kt**, and surface speeds have exceeded 50 m/s. They are winter events, with freezing spray in Douglas harbour (64 kt, Dec 2007) ([NWS Juneau Taku brochure](https://www.weather.gov/media/ajk/brochures/Taku_Winds.pdf)). The gusts are **localised to Gastineau Channel near downtown and Douglas**; elsewhere can be much quieter.
- **Prince William Sound:** Gap winds blast out of the Copper River and Valdez Arm in winter (from general knowledge).

### South Georgia
- "Katabatics **accelerate down the mountains to scour the coast**". Stromness logged **41–93 kt NNW**. At Elsehul, "bullets" reached about **60 kt (crew estimate 80)**. The arms of Cumberland Bay can stay calm and sunny while winds jump over the Allardyce Range ([PBS NOVA](https://www.pbs.org/wgbh/nova/shackletonexped/dispatches/19991103.html); [Peter Smith](https://petersmith.net.nz/photos/south-georgia-9.php)).

### Antarctic Peninsula (Gerlache Strait)
- "**Within minutes of leaving the protection of Cierva Cove the winds built to 40 mph and soon sustained 50 mph, gusts into the 70s**" (35 → 43 kt, gusts 60–70 kt). Gerlache gusts have reached **83 kt (95 mph)**. "The closer to land, the more violent the wind." Sheltered coves stay calm while the strait rages ([Lindblad](https://uk.expeditions.com/expedition-stories/daily-expedition-reports/cierva-cove-the-gerlache-strait-and-the-enterprise-islands); [Duke blog](https://blogs.nicholas.duke.edu/antarctica/category/students/page/2)). **Barrier winds** run along the east side, where the peninsula blocks stable Weddell air.
- **Personality:** **Cove-calm versus strait-gale**, a binary spatial field with a sharp edge at each headland.

---

## 11. Tidal flats and estuaries

### Wadden Sea
- Most of it **dries at low water**. Buoyed channels run **up to about 3 kt** and the channels move ([Noonsite](https://www.noonsite.com/report/netherlands-the-swatchways-around-the-frisian-islands/)). The wind is the open North Sea wind over flat ground (little shelter, steady, gust factor about 1.2–1.3) **[est.]**. The game is **water, not wind**: the course changes shape with the tide, and wind against tide over shoals makes short, steep chop.

### Morecambe Bay
- Historically there are only about **2 h of sailing per tide** (HW ±1 h). The channels change and a **tidal bore** runs on springs (it is best in SW wind under Force 3). A wind off the fells slows the flood ([Recording Morecambe Bay](https://www.recordingmorecambebay.org.uk/content/stories/leisure-boat-sailing-morecambe-bay); [Liverpool MARLIN](https://www.liverpool.ac.uk/~cmi/boat/morec19/morec19.html)).

### Bay of Fundy
- Fog is the summer hazard, prevalent in **light southerlies under 10 kt**, about **30% of the time in July**. The tidal range is 16.3 m at Burntcoat Head. Wind against the big currents makes **steep, unruly waves**, worst in the narrows (Minas Channel) ([Good Old Boat](https://goodoldboat.com/bay-of-fundy-fundamentals/); [Maine Coast Guide](https://mainecoastguide.com/fundy-and-st-john)).

### Chesapeake (Annapolis)
- July–August are the **"Summer Doldrums"**: S–SW at **4–9 kt (5–10 mph)**, with afternoon thermals and **afternoon thunderstorms**. Spring and fall are the best seasons, frontal and "anything goes" ([Sailing World Annapolis](https://www.sailingworld.com/regatta-series/annapolis-weather-for-the-lands-end-nood); [Quantum](https://www.quantumsails.com/en/resources-and-expertise/articles/local-knowledge-for-annapolis)). There is current plus motorboat chop.

---

## 12. Night and still conditions

- **Nocturnal land breezes:** Quiberon's land breeze starts **around midnight**, gentle, building to a **fresh NE** ([RCC Pilotage](https://rccpf.org.uk/notice-item/1582/)). Valencia has an overnight cool flow off the land into the gulf. These are the reverse of the sea breeze: weak (3–10 kt), shallow, **offshore**, strongest near the shore and at valley mouths, and fading a few km out.
- **Drainage and gully winds:** **Adelaide gully winds** are nocturnal SE winds that "start suddenly in the evening" and run down the western slopes of the Mount Lofty Ranges, sometimes stronger than the prevailing wind ([BoM](https://media.bom.gov.au/social/blog/2132/meet-the-locals-when-the-weather-gives-the-place-character/)). Garda's **Pelèr starts at night**. Lake Geneva's Joran is an evening downslope squall.
- **Bioluminescent bays (Mosquito Bay, Vieques):** Best on **calm, moonless nights with little or no wind**. A mangrove-ringed lagoon with a narrow mouth keeps both the water and the dinoflagellates in. One theory blames a wind shift for the bay going dark in 2014 ([Atlas Obscura](https://atlasobscura.com/places/mosquito-bay); [Margaritaville blog](https://blog.margaritaville.com/?p=1390)). **For a game:** near-calm (0–5 kt) from the land breeze, zephyrs through mangrove gaps, every puff visible as glowing ripples. The race is **pressure-finding in the dark**.

---

## (a) Comparison table

| Place | Archetype | Season / time | Mean kt | Gust character | Shift character | Key tactical question |
|---|---|---|---|---|---|---|
| SF Bay, the Slot | Sea-breeze gap jet | May–Oct, pm | 18–25 (30 peak) | Steady jet, GF ~1.2 | Geographic bends near islands, little oscillation | Jet vs. current relief; island lees |
| Long Beach | Sea breeze | Spring–summer, pm | 8–16 | Mild | Slow veer SW→W, small oscillations [est.] | When and from where it fills |
| Perth (Doctor) | Sea breeze | Dec–Feb, pm | 15–25 | Steady, strong | Persistent back WSW→S (~45°) | Morning shifty offshore vs. pm persistent shift |
| Sydney Harbour | Sea breeze + fronts | Summer pm | 15–25 NE | NE steady; buster gust front >29 kt | NE steady; buster ~180° flip | Headland compression; front timing |
| Auckland | Gradient + islands | Summer SW | 12–20 | Puffy, "solid gust range" | ±10–15° island-driven [est.] | Splits around islands, named headland shifts |
| Hong Kong | Monsoon + terrain | NE Oct–Mar | 10–20 | Patchy | Bent by Kowloon / hills | Where pressure spills off the hills |
| Valencia | Sea breeze vs gradient | Summer pm | 10–15 | Steady | <10° = steady | Will the thermal beat the gradient |
| Barcelona | Sea breeze | Sep–Oct | 9–15 | Velocity swings 6–13 | Direction ±5° | Pressure, not shifts |
| Marseille | Sea breeze + Mistral | Summer | 8–15 / 15–25 | Mistral gusty | Sea breeze veers S→W | Veer; island lee; Calanques chaos |
| Palma | Sea breeze vs NW gradient | Spring pm | 8–15 | Steep chop | Dead transition zone | Which wind wins where |
| Cádiz | Gradient E/W | All year | 14–18 | Levante gusty | Bimodal | Levante or Poniente; current |
| Kiel | Offshore gradient | Jun | 8–18 | Puffy, GF ~1.4–1.5 [est.] | Oscillating ±10–20°, 3–8 min [est.] | Play every shift and puff |
| Weymouth | Bay + headland | Summer SW | 10–18 | Clean SW; S gusty/holes | Fixed bends by direction | Direction-specific bend (SW: top left) |
| Solent | Tidal + delayed sea breeze | Summer | 8–18 | Moderate | Sea-breeze arrival = big persistent | Tide vs. shore; who gets the new breeze |
| Rio inside | Mountain-bent sea breeze | Winter (Aug) pm | 7–12 | Flukey | Big, irregular | Mountain flukes + current |
| Qingdao | Light sea breeze | Aug | 0–8 | Fog, calms | Random | Current; finding any pressure |
| Enoshima | Ocean sea breeze + swell | Summer | 8–20 | Steady offshore | Shifty inshore only | Waves; inshore vs offshore |
| Quiberon | Rotating sea breeze | Summer | 6–15 | Moderate | Persistent clockwise veer, up to 360°/day | How far has it veered |
| Kingston | Lake thermal | Jul–Aug pm | 10–15 | Moderate | Thermal veer [est.] | Will the thermal fire |
| Antigua | Trades + squalls | Dec–May | 12–20 | Squalls +15–20 kt | Squall-driven | Which side of the squall |
| Hawaii channels | Tip jet / channel | Summer trades | 15–30 | Strong at exits | Steady direction | Where the jet ends; wakes |
| Bermuda | Archipelago sound | May–Jun | 6–20 | Variable | "Minefield" of shifts | Constant shift-playing |
| Tahiti / Bora Bora | Trades + lagoon | May–Oct | 10–20 (Maraamu 25–35) | Gusty lees off peaks | Steady | Island lee vs. reef-pass clean air |
| Le Morne | Trades round massif | May–Oct | 18–25 | Gusty wrap | Steady | Distance from the mountain |
| Nouméa | Trades + thermal | Most of year | 15–20 pm | Steady | ±5° | Ride the afternoon build |
| Columbia Gorge | Gap jet | May–Sep pm | 16–25 (30+) | Gusty, GF ~1.3–1.5 | Axial | Jet core vs. wall holes; current |
| Tarifa | Strait gap | All year | 20–30 (50) | Levante bursty, Poniente smooth | Bimodal E/W | Which wind today |
| Canaries | Acceleration + wake | Summer | 15–25 zone / 0–8 wake | Hard shear line | Steady | Which side of the shear line |
| Wellington | Strait funnel | Spring windiest | 15–30 | Gully bullets | Lanes | Gully-mouth lanes |
| Mistral | Valley outflow | Winter–spring | 20–35 | GF 1.6–2 | Steady NW | Shelter vs. fanning jet |
| Tramontane | Gap, offshore | Spring–autumn | 15–30 | Gusty on flat water | Steady NW | Offshore gust lanes |
| Bora / Trieste | Downslope katabatic | Winter | 20–40 (gusts 60–100) | Pulsing refoli GF ~2 | Steady NE; jet bands | Pulse timing; jet bands below gaps |
| Meltemi | Etesian + channels | Jul–Aug pm | 15–30 | Downslope bullets in lees | Steady N | Channel jet vs. lee bullets |
| Garda | Mountain-lake flip | Summer | Pelèr 15–25 am / Ora 12–20 pm | Storm bursts 5–10 min | Morning/afternoon 180° flip | Shore side (left at Malcesine); when it ends |
| Silvaplana | Valley thermal | Jun–Sep pm | 15–25 | Pulsing phases | Steady | Peak window 15–17 h |
| Como | Mountain-lake flip | Summer | Breva 12–20 | Moderate | Side-valley injections | Narrows and side valleys |
| Geneva / Constance | Light lake + squalls | Summer | 0–8, squalls 25–40 | Sudden fronts | Random light | Survive the squall; find zephyrs |
| Tahoe | Afternoon zephyr | Summer pm | 10–20 | Gusty | Veers W→SW | Timing; gust lanes off the crest |
| Balaton | Shallow lake storms | Summer | 8–15, storms 25–35 | Fast chop | N–NW storms | Shore side |
| Inland US lake | Shifty puffy | All | 6–12 | GF 1.5–1.8 | ±15–25°, 1–3 min [est.] | Puff-to-puff; avoid shore holes |
| Lake Powell | Canyon + outflows | Summer pm | 8–20, outflows 30–50 | Microbursts | Canyon-axial | Which canyon; storm outflow |
| Rivers (Broads/Hudson) | Channel-steered | All | 4–15 | Bank gusts | Follows bends | Inside of bends; current |
| Bayou / Pontchartrain | Light + thunderstorm | Summer pm | 0–6, fronts 30–50 | Gust fronts, waterspouts | Random | Find zephyrs; survive outflow |
| Southern Ocean | Frontal westerlies | All | 15–25 (squalls 30–47) | Squalls 15→30 | Frontal veers 60–90° | Swell; front timing |
| Monterey / Point Pinos | Headland + sea breeze | Jul–Sep pm | 12–22 | Doubles at the point | Steady NW | Inside lee vs. point acceleration |
| Point Conception | Headland corner | Spring–summer | 25+ outside, light inside | Sharp edge | Steady | Hard on/off line |
| Cape Town | Downslope trade | Nov–Feb | 20–35 | Mountain bullets | Steady SE | Distance from mountain |
| Langebaan | Venturi lagoon + tide | Nov–Mar | 20–30 (40) | Strong | Steady | Tide vs. apparent wind |
| Hatteras sound | Long flat sound | Summer SW | 15–25 | Steady | Builds along length | Gradient along course |
| Stromboli / Aeolians | Volcanic cone lee | Summer | 8–15 | Lee to 3–4 kt | Flank acceleration | Around the flank, not through the lee |
| Iceland / Westfjords | Fjord katabatic | All | 10–25 | Bursts up to 78 kt | Down-fjord | Fjord-wall bursts |
| Norway fjords | Axial channelling | Summer | 5–20 | "Gust to nothing in seconds" | Up-fjord pm / down-fjord night | Axial; side-valley gusts |
| Piteraq / Greenland | Extreme katabatic | Autumn–winter | 30–100+ | Near-instant onset | Down-valley | Don't be there |
| Svalbard | Glacier drainage | Summer | 5–10 | Gentle LLJ | Down-glacier vs up-fjord | Glacier front breezes |
| Patagonia | Williwaws | All | 10–30 bg | 0→100 kt in a minute | Random direction bursts | Spot the spray column |
| Taku / Juneau | Mountain-wave | Winter | 30–80 gusts | Localised | Downchannel | Where the wave touches down |
| Antarctic Peninsula | Cove/strait binary | Summer | 0 cove / 35–45 strait | Gusts 60–80 | Sharp headland edges | Hop cove to cove |
| Wadden / Morecambe | Tidal flats | Summer | 10–18 | Steady | Steady | Tide opens/closes the course |
| Fundy | Fog + mega-tide | Summer | 5–15 | Mild | Steady | Current lanes; fog |
| Chesapeake | Doldrums + storms | Jul–Aug | 4–9 | Thunderstorm gusts | Light shifty | Patience; current |
| Mosquito Bay | Night calm lagoon | Night | 0–5 | Cat's-paws | Random | Find any pressure |

---

## (b) Distinct wind personalities

Numbers marked **[est.]** are design starting points derived from the descriptions above, not measurements. "Scale" means the size of the feature relative to a 0.3–2 km course.

1. **Clockwork sea breeze that veers and builds**
   - *Where:* Long Beach, Valencia, Kingston, Marseille (S→W), Weymouth (210→240°), Fremantle (WSW→S, backing in the Southern Hemisphere).
   - *Numbers:* Fills from 4–6 kt to 12–18 kt over about 30–60 min of real time (compress to the race). Persistent rotation of 20–45° per afternoon. Small oscillations of ±5° on about 5 min periods. Gust factor 1.15–1.25.
   - *Scale:* The whole course.
   - *Tactics:* Play the persistent shift ("sail toward the new direction") and cash in on velocity.

2. **The full-circle rotator**
   - *Where:* Quiberon Bay.
   - *Numbers:* The wind rotates clockwise steadily, up to 360° per day (about 15–30° per hour), at 6–15 kt. It is the clockwork sea breeze turned into the whole story: every leg's favoured side keeps moving.

3. **Gradient-versus-thermal dead zone**
   - *Where:* Palma (NW vs embat), Valencia (NW vs SE), the Solent (morning calm before the SE), Garda between Pelèr and Ora.
   - *Numbers:* Two winds from opposite or perpendicular directions. Between them is a 300–1,000 m band of 0–4 kt with random 30–90° wiggles that sweeps across the course.
   - *Scale:* Course-sized boundary.
   - *Tactics:* "Get to the new wind first."

4. **Mountain-lake morning/afternoon flip**
   - *Where:* Garda (Pelèr N 15–25 kt in the morning, calm, Ora S 12–20 kt from 12–13 h), Como (Tivano and Breva), Silvaplana (Maloja), Titicaca (calm dawn, W afternoon).
   - *Numbers:* A 180° flip with a calm between. The afternoon wind strengthens up-valley (Ora 15 kt at Malcesine, 18–20 kt at Torbole). It is stronger along one steep shore: Garda's left-shore "coast advantage" gives about 2–4 kt more and a 5–10° bend **[est.]**.
   - *Scale:* Lake 2–4 km wide, so the shore lanes are on the course.

5. **Shifty, puffy inland lake**
   - *Where:* US club lakes, Bermuda's Great Sound, Biscayne Bay ("lake-like"), Auckland in the SW.
   - *Numbers:* 6–12 kt with a gust factor of 1.5–1.8. Shifts of ±15–25° every 1–3 min. Puffs 50–200 m across that drift downwind and fan out. Tree-line holes 5–10× tree height deep.
   - *Scale:* Many features per leg.
   - *Tactics:* Puff-to-puff, tack on headers.

6. **Offshore oscillating gradient**
   - *Where:* Kiel westerlies, Perth's morning easterly, Weymouth NW and N, Sydney westerlies.
   - *Numbers:* 10–20 kt, gust factor 1.4–1.5. Regular oscillations of ±10–15° on a 3–8 min period. Dark puff patches 100–300 m. Puffs arrive lifted on one tack.
   - *Tactics:* Textbook oscillating-shift racing.

7. **Gap jet with a hard edge**
   - *Where:* Columbia Gorge, the Golden Gate/Slot, Tarifa, Cook Strait, ʻAlenuihāhā exit, the Tenerife–Gran Canaria acceleration zone.
   - *Numbers:* The jet core is 1.5–2× the ambient wind (Gorge 20–30 kt; Canaries 18→25 kt). The jet is about 1–3 km wide with fairly steady direction (±5°). The edge goes from full to half strength over 100–300 m. It is strongest at the gap **exit**, not the narrowest point (Hawaii).
   - *Tactics:* Where the core is versus the slower margins; current along the axis.

8. **Island wake and shear line**
   - *Where:* Canary wakes (up to 10 island heights long), Kona, the lee of Stromboli (3–4 kt), Maui.
   - *Numbers:* Inside the wake 0–6 kt with random direction; outside 15–25 kt. The shear line is sharp (100–500 m). Acceleration "horns" on both flanks run about +30–50%.
   - *Tactics:* Never sail into the lee. Round the flank.

9. **Headland acceleration and lee hole**
   - *Where:* Point Pinos ("breeze abruptly doubles"), Point Conception (15→25 kt), Portland Bill (SW compression, "top left always good"), Bradleys Head compression, Sugarloaf (flukey 220–230°), Cape Point.
   - *Numbers:* About 1.5–2× at the tip. Wind bends 10–30° to follow the shore. An expansion lee behind the point at 30–60% of the strength, backed by 20–40°.
   - *Scale:* The point is about 200–800 m.
   - *Tactics:* Get into the compression on the right tack; avoid the expansion lee.

10. **Trade wind with squall lines**
    - *Where:* Antigua, the BVI, trade passages, Tahiti in the wet season, Southern Ocean squalls.
    - *Numbers:* Base trade 14–18 kt, steady (±5–10°, gust factor 1.2). Squall cells 1–5 km wide move with the wind. Under or ahead of a cell, +15–20 kt and a 20–40° shift (often a veer). Behind the cell, a lull of 3–8 kt. Cell passage takes 5–20 min.
    - *Tactics:* Which side of the squall to be on.

11. **Steady trade over a flat lagoon, building through the afternoon**
    - *Where:* Nouméa (15–20 kt afternoon build), Le Morne, Bora Bora lagoon, Langebaan.
    - *Numbers:* Direction ±5°. Speed builds 5–8 kt from morning to afternoon. Gust factor about 1.15. A high island gives local downslope bullets (Le Morne, Otemanu) and reef passes have current.
    - *Tactics:* Pure speed and boat-handling, plus local bullets near the mountain.

12. **Downslope bursts off a mountain (a mountain "spilling over")**
    - *Where:* Cape Doctor over Table Mountain, the Meltemi in island lees, Wellington's gully bullets, Iceland's fjord walls, Hong Kong's NE over Kowloon, Lake Geneva's Joran.
    - *Numbers:* Background 15–25 kt. Bullets 1.5–2.5× the mean, about 100–400 m across, lasting 10–60 s. They hit the water at a steep angle, spreading radially, with direction swings of ±30°. They come from **fixed source points** (gullies and saddles).
    - *Tactics:* Learn the lanes.

13. **Katabatic bombs off ice (williwaws)**
    - *Where:* Patagonia and the Beagle Channel (calm to 100 kt in a minute), South Georgia (41–93 kt), the Antarctic Peninsula (gusts 60–80 kt), Westfjords (78 kt), the extreme piteraq.
    - *Numbers for a game (scaled down):* Calm background (0–6 kt). Random, rare bursts of 25–40 kt game-equivalent about 50–150 m across, lasting 5–30 s, coming down off the cliffs with visible spray columns 3–5 s before arrival. Direction is radial from the slope.
    - *Tactics:* Read the spray. Use a burst for speed or get flattened.

14. **Pulsing katabatic heartbeat (Bora)**
    - *Where:* Trieste and Senj.
    - *Numbers:* Mean 20–30 kt with refoli gusts about 2× the mean, arriving **periodically every few minutes** (pulsations of about 3–11 min in the literature) **[est.]**. Fixed jet bands below the mountain passes alternate with calmer bands 1–3 km apart.
    - *Tactics:* Unlike random puffs this is **predictable rhythm**: time manoeuvres to the beat.

15. **Fjord/valley axial channelling**
    - *Where:* Norwegian fjords, Hudson/Palisades, Columbia, Garda, Lake Powell canyons, Titicaca's island channels.
    - *Numbers:* The wind direction is locked to the channel axis whatever the gradient. It reverses diurnally (up-valley afternoon, down-valley night). Strength runs 0.5× in the bays and 1.5× in the narrows. Side valleys inject cross-gusts at fixed points. Near the walls, "huge gusts to no breeze in seconds".
    - *Tactics:* At game scale, the venue's channel *shape* is the wind map.

16. **Cove calm versus strait gale (binary shelter)**
    - *Where:* the Antarctic Peninsula (Cierva Cove vs Gerlache), Cumberland Bay, Wellington harbour vs the strait, Point Conception inside/outside, Clipper Cove (Treasure Island) vs the Slot.
    - *Numbers:* Two regimes, 0–5 kt and 25–40 kt, with **headland-sharp edges** (50–200 m transitions).
    - *Tactics:* A course that crosses the line forces an all-in commitment.

17. **Frontal flip / gust front (the southerly buster)**
    - *Where:* the Sydney southerly buster (NE→S, about 180°, >29 kt, −5 °C), Melbourne change days (NW→SW, −15 °C), Garda storm inversions (S→N, 5–10 min bursts), Pontchartrain and Florida thunderstorm outflows (30–50 kt), Lake Powell (47 kt and 6–7 ft waves), Balaton.
    - *Numbers:* A visible roll cloud or dark line advances across the course at 15–30 kt. At the line the wind jumps 90–180° and +15–30 kt within seconds to a minute. Behind it, a gusty new regime.
    - *Tactics:* One mid-race event; position before it hits.

18. **Light, patchy calm with zephyrs (swamp, bayou, still lagoon at night)**
    - *Where:* Louisiana bayous, Everglades, Qingdao fog days, Chesapeake doldrums, Mosquito Bay nights, Lake Geneva most days.
    - *Numbers:* 0–5 kt. Isolated cat's-paw patches 20–80 m across drifting slowly, random directions, lifetime 30–120 s. Tree walls make most of the water dead and the gaps (side bayous, clearings) carry the only breeze.
    - *Tactics:* Pressure-finding. Current and drag matter as much as wind.

19. **Night land breeze / drainage**
    - *Where:* Quiberon (NE from about midnight), Valencia, Adelaide gully winds (sudden evening onset), Garda's Pelèr (starts at night), Svalbard glacier drainage (5–10 kt).
    - *Numbers:* Offshore, 3–10 kt, strongest within 0.5–1 km of shore and at valley mouths, fading seaward. Gentle and steady in direction but with a sharp outer edge. Valley-mouth jets are 1.5–2× the rest.
    - *Tactics:* Hug the shore and the valley mouths. The open middle dies.

20. **Tide-dominated venue (wind secondary)**
    - *Where:* the Solent, the Wadden Sea, Morecambe Bay (2 h windows), Fundy, the Elbe, Qingdao (reversing current), Langebaan (8 kt tide claimed), Rio's bay mouth.
    - *Numbers:* Moderate, steady wind (10–15 kt, ±5–10°) with currents of 1–4 kt and lanes and eddies. Wind against tide over shoals makes short, steep chop.
    - *Tactics:* "Head for the shore against an adverse tide." The course physically changes as flats cover and uncover.

21. **Big ocean swell with steady breeze**
    - *Where:* Enoshima offshore, Rio outside, Kailua Bay, Southern Ocean.
    - *Numbers:* Steady 12–25 kt (±5–10°) and long-period swell (1–3 m+). In the Southern Ocean, frontal veers of 60–90° and squalls going 15→30 kt in one hit.
    - *Tactics:* Waves, not shifts.

22. **Same venue, two opposite personalities**
    - *Where:* Tarifa (Levante bursty about 30 kt offshore vs Poniente smooth about 20 kt onshore), Cádiz, Sydney (steady NE vs gusty W), Hood River in summer vs winter (westerly vs easterly gap flow).
    - *Use:* One venue map with two wind presets, so the same geometry gives different races.

---

### Notes on source quality

- **Strongest sources:** the met agencies (BoM, NWS Juneau, AEMET, HKO, Icelandic Met Office), the AMS Glossary, peer-reviewed or conference work (UW Gorge gap flow, the Hawaii channel study, the Quiberon 2006 experiment, Svalbard *Polar Research*, the Canaries *Scientia Marina*), and expert venue guides (Fraglia Vela Malcesine, SailJuice Weymouth, Yachting World Solent).
- **Weaker sources:** kite and charter marketing pages (Tramontane "300 days", Le Morne ranges, Cape Doctor "160 km/h") and forum posts. Their numbers are indicative only.
- **No source found:** I found no published per-venue shift periods or amplitudes except qualitative statements ("very flukey", "180–190°", "<10° is steady"). The [est.] figures are judgement calls meant to be tuned against playtests.
