// GENERATED ONCE by art/freeze_venue_doc.js — now the SOURCE OF TRUTH.
// Emitted as JS, not JSON: the eval harness loads over file://, where fetch is blocked.
// Edited in editor.html.
window.VENUE_DOC = window.VENUE_DOC || {};
window.VENUE_DOC["seatrials"] = {
  "schema": 1,
  "venue": "seatrials",
  "note": "The measuring stick. Deliberately the plainest course on the card: no land, a rectangular arena, one steady breeze from due north, and an 800 m beat. Every AI change is judged here, so anything that makes it interesting makes it worse.",
  "world": {
    "size": 13000,
    "boundary": {
      "poly": [
        [
          -3150,
          -5800
        ],
        [
          3150,
          -5800
        ],
        [
          3150,
          1600
        ],
        [
          -3150,
          1600
        ]
      ],
      "circle": null
    }
  },
  "shapes": [],
  "course": {
    "description": "Windward-leeward, 4 legs. Start and finish on the same line.",
    "marks": [
      {
        "id": "sf-pin",
        "name": "Pin",
        "x": -550.0,
        "y": 0.0,
        "kind": "inflatable"
      },
      {
        "id": "sf-boat",
        "name": "Boat",
        "x": 550.0,
        "y": 0.0,
        "kind": "inflatable"
      },
      {
        "id": "wg-port",
        "name": "Port",
        "x": -550.0,
        "y": -4000.0,
        "kind": "can"
      },
      {
        "id": "wg-stbd",
        "name": "Starboard",
        "x": 550.0,
        "y": -4000.0,
        "kind": "can"
      }
    ],
    "lines": [
      {
        "id": "sf",
        "name": "Start / finish line",
        "marks": [
          "sf-pin",
          "sf-boat"
        ]
      },
      {
        "id": "wg",
        "name": "Windward gate",
        "marks": [
          "wg-port",
          "wg-stbd"
        ]
      }
    ],
    "route": [
      {
        "kind": "line",
        "lineId": "sf",
        "dir": 1,
        "role": "start"
      },
      {
        "kind": "gate",
        "lineId": "wg",
        "dir": 1,
        "role": "windward"
      },
      {
        "kind": "gate",
        "lineId": "sf",
        "dir": -1,
        "role": "leeward"
      },
      {
        "kind": "gate",
        "lineId": "wg",
        "dir": 1,
        "role": "windward"
      },
      {
        "kind": "gate",
        "lineId": "sf",
        "dir": -1,
        "role": "leeward",
        "finish": true
      }
    ]
  },
  "wind": {
    "regions": [
      {
        "id": "wind-all",
        "name": "Course wind",
        "poly": [
          [
            -13000,
            -13000
          ],
          [
            13000,
            -13000
          ],
          [
            13000,
            13000
          ],
          [
            -13000,
            13000
          ]
        ],
        "falloff": 400,
        "direction": 0.0,
        "dirVar": 0,
        "speed": 13,
        "speedVar": 0,
        "period": 30
      }
    ]
  }
};
