window.VENUE_DOC = window.VENUE_DOC || {};
window.VENUE_DOC["duckling"] = {
  "schema": 1,
  "venue": "duckling",
  "note": "Interactive Sailing School at Duckling Pond.",
  "card": {
    "name": "Duckling Pond",
    "tag": "Sailing School",
    "blurb": "Learn to steer, trim sails, and tack upwind under the gentle guidance of Paddle the Mallard.",
    "conditions": "Calm & steady",
    "hazards": "None"
  },
  "palette": {
    "deepColor": "#0e7490",
    "baseColor": "#38bdf8"
  },
  "world": {
    "size": 16000,
    "boundary": {
      "poly": [
        [-6000, -6000],
        [6000, -6000],
        [6000, 6000],
        [-6000, 6000]
      ],
      "circle": null
    }
  },
  "shapes": [],
  "course": {
    "description": "Sailing School course",
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
      { "kind": "gate", "lineId": "sf", "dir": -1 }
    ],
    "cutoff": 600
  },
  "wind": {
    "regions": [
      {
        "id": "wind-all",
        "name": "Pond wind",
        "poly": [[-16000, -16000], [16000, -16000], [16000, 16000], [-16000, 16000]],
        "falloff": 400,
        "direction": 0,
        "dirVar": 0,
        "speed": 7,
        "speedVar": 0,
        "period": 30
      }
    ]
  }
};
