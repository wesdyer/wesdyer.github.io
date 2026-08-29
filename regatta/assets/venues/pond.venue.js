// Duckling Pond — the Sailing School venue. Hidden from the clubhouse picker (not in
// VENUE_ORDER); reached through Sailing School only. See guidelines/tutorial.md and
// guidelines/venues.md §15. Editable in editor.html like any other document.
//
// THE POND PROPER: a small bounded water around the graduation course. Sailing School's
// First Sail does not run here — school.js derives an open-water twin (`pond-open`: same
// palette and wind, no shapes, no props, arena lifted to the horizon) from this document at
// load, so the lawn, pontoon and dock drawn here never intrude on that first lesson.
window.VENUE_DOC = window.VENUE_DOC || {};
window.VENUE_DOC["pond"] = {
  "schema": 1,
  "venue": "pond",
  "note": "The tutorial pond. Seven knots from due north, no shifts, no gusts, flat water: when the boat stalls it is because you pointed too high, never because the wind moved. The graduation course is a one-lap windward-leeward at a third of standard leg length.",
  "card": {
    "name": "Duckling Pond",
    "tag": "Sailing School",
    "blurb": "The smallest water in the game. A club pond ringed by mown lawn — nowhere is far from shore, and nothing here can hurt you.",
    "conditions": "7 kn, steady",
    "hazards": "None"
  },
  "world": {
    "size": 6000,
    "boundary": {
      "poly": null,
      "circle": { "x": 0, "y": -650, "r": 2600 }
    }
  },
  "shapes": [],
  "course": {
    "description": "Graduation race: windward-leeward, 2 legs. Start and finish on the same line, the instructor's launch as committee boat.",
    "marks": [
      { "id": "sf-pin",  "name": "Pin",       "x": -220, "y": 0,     "kind": "can" },
      { "id": "sf-boat", "name": "Launch",    "x": 220,  "y": 0,     "kind": "committee" },
      { "id": "wg-port", "name": "Port",      "x": -130, "y": -1300, "kind": "can" },
      { "id": "wg-stbd", "name": "Starboard", "x": 130,  "y": -1300, "kind": "can" }
    ],
    "lines": [
      { "id": "sf", "name": "Start / finish line", "marks": ["sf-pin", "sf-boat"] },
      { "id": "wg", "name": "Windward gate",       "marks": ["wg-port", "wg-stbd"] }
    ],
    "route": [
      { "kind": "line", "lineId": "sf", "dir": 1 },
      { "kind": "gate", "lineId": "wg", "dir": 1 },
      { "kind": "gate", "lineId": "sf", "dir": -1 }
    ],
    "startTime": 20,
    "cutoff": 420
  },
  "wind": {
    "regions": [
      { "id": "wind-all", "name": "Pond breeze",
        "poly": [[-9000, -9000], [9000, -9000], [9000, 9000], [-9000, 9000]],
        "falloff": 400, "direction": 0, "dirVar": 0, "speed": 7, "speedVar": 0, "period": 60 }
    ]
  },
  "palette": {
    "baseColor": "#2a7f8c",
    "deepColor": "#1d5f6e",
    "shallowColor": "#4aa39b",
    "shorelineColor": "#9bd35a"
  }
};
