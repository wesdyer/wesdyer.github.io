// THE LAB — the Scenario Lab's stage (scenario.html), not a racing venue.
// Deliberately NOT in VENUE_ORDER: a doc the picker list does not name loads
// under its own key but gets no clubhouse tile, which is exactly right for a
// dev stage. Same water as Sea Trials (no palette authored = the default
// blues), no land, no props, one steady breeze, and a big circular arena.
// The course below is the minimum a race boot needs (the lab parks every
// stock mark and boat offstage the moment the world is up).
window.VENUE_DOC = window.VENUE_DOC || {};
window.VENUE_DOC["lab"] = {
  "schema": 1,
  "venue": "lab",
  "note": "The Scenario Lab's blank canvas. Open water in a circular arena; everything interesting is placed by the lab page at runtime.",
  "card": {
    "name": "The Lab",
    "tag": "Lab",
    "blurb": "A blank sheet of water for constructing rules and AI scenarios.",
    "conditions": "Whatever you dial in",
    "hazards": "Only the ones you place"
  },
  "world": {
    "size": 16000,
    "boundary": {
      "poly": null,
      "circle": { "x": 0, "y": 0, "r": 6000 }
    }
  },
  "shapes": [],
  "course": {
    "description": "Boot scaffolding: one windward-leeward pair, parked offstage by the lab.",
    "marks": [
      { "id": "sf-pin",  "name": "Pin",       "x": -550, "y": 0,     "kind": "can" },
      { "id": "sf-boat", "name": "Boat",      "x": 550,  "y": 0,     "kind": "can" },
      { "id": "wg-port", "name": "Port",      "x": -550, "y": -4000, "kind": "can" },
      { "id": "wg-stbd", "name": "Starboard", "x": 550,  "y": -4000, "kind": "can" }
    ],
    "lines": [
      { "id": "sf", "name": "Start / finish line", "marks": ["sf-pin", "sf-boat"] },
      { "id": "wg", "name": "Windward gate",       "marks": ["wg-port", "wg-stbd"] }
    ],
    "route": [
      { "kind": "line", "lineId": "sf", "dir": 1 },
      { "kind": "gate", "lineId": "wg", "dir": 1 },
      { "kind": "gate", "lineId": "sf", "dir": -1 },
      { "kind": "gate", "lineId": "wg", "dir": 1 },
      { "kind": "gate", "lineId": "sf", "dir": -1 }
    ],
    "cutoff": 600
  },
  "wind": {
    "regions": [
      {
        "id": "wind-all",
        "name": "Course wind",
        "poly": [[-16000, -16000], [16000, -16000], [16000, 16000], [-16000, 16000]],
        "falloff": 400,
        "direction": 0,
        "dirVar": 0,
        "speed": 12,
        "speedVar": 0,
        "period": 30
      }
    ]
  }
};
