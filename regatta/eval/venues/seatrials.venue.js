// GENERATED ONCE by art/export_venue_doc.js — now the SOURCE OF TRUTH.
// Emitted as JS, not JSON: the eval harness loads over file://, where fetch is blocked.
// Edited in editor.html.
window.VENUE_DOC = window.VENUE_DOC || {};
window.VENUE_DOC["seatrials"] = {
  "schema": 1,
  "venue": "seatrials",
  "note": "The measuring stick. Deliberately the plainest course on the card: no land, a rectangular arena, one steady breeze from due north, and an 800 m beat. Every AI change is judged here, so anything that makes it interesting makes it worse.",
  "card": {
    "name": "Clubhouse Point",
    "tag": "Clubhouse",
    "blurb": "Round the cans off the clubhouse — same course, same evening breeze, every week all season. Nothing out here is trying to beat you, which leaves only your own boatspeed to blame.",
    "conditions": "Calm, standard",
    "hazards": "None"
  },
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
        "x": -550,
        "y": 0,
        "kind": "can"
      },
      {
        "id": "sf-boat",
        "name": "Boat",
        "x": 550,
        "y": 0,
        "kind": "can"
      },
      {
        "id": "wg-port",
        "name": "Port",
        "x": -550,
        "y": -4000,
        "kind": "can"
      },
      {
        "id": "wg-stbd",
        "name": "Starboard",
        "x": 550,
        "y": -4000,
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
        "dir": 1
      },
      {
        "kind": "gate",
        "lineId": "wg",
        "dir": 1
      },
      {
        "kind": "gate",
        "lineId": "sf",
        "dir": -1
      },
      {
        "kind": "gate",
        "lineId": "wg",
        "dir": 1
      },
      {
        "kind": "gate",
        "lineId": "sf",
        "dir": -1
      }
    ],
    "cutoff": 360,
    "paths": {
      "sig": "v1-b8df0e76-er",
      "legs": [
        {
          "pts": []
        },
        {
          "pts": [
            [
              0,
              0
            ],
            [
              0,
              -4000
            ]
          ]
        },
        {
          "pts": [
            [
              0,
              -4000
            ],
            [
              0,
              0
            ]
          ]
        },
        {
          "pts": [
            [
              0,
              0
            ],
            [
              0,
              -4000
            ]
          ]
        },
        {
          "pts": [
            [
              0,
              -4000
            ],
            [
              0,
              0
            ]
          ]
        }
      ]
    }
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
        "direction": 0,
        "dirVar": 0,
        "speed": 13,
        "speedVar": 0,
        "period": 30
      }
    ]
  }
};
