// FIRST CUT by hand (Sep 1 2026) — now the SOURCE OF TRUTH.
// Emitted as JS, not JSON: the eval harness loads over file://, where fetch is blocked.
// Edited in editor.html.
window.VENUE_DOC = window.VENUE_DOC || {};
window.VENUE_DOC["otter"] = {
  "schema": 1,
  "venue": "otter",
  "note": "FIRST CUT, Sep 1 2026 — a hand-laid coastal triangle so the venue exists, opens in editor.html and races. Land is a granite coast down the east side with a rocky point, and an offshore islet (Otter Rock) that is rounded as a mark. Kelp beds, the building sea breeze and the fog bank are NOT built (see guidelines/venues.md §16); swell reuses Bluewater's trains. Redesign freely — nothing here is measured.",
  "card": {
    "name": "Otter Point",
    "tag": "Kelp Coast",
    "blurb": "A granite coast under a wall of fog. Kelp beds flatten the swell and grab your keel; outside them the sets roll through and the breeze builds all afternoon. Hug the rocks or go wide — the otters are watching.",
    "conditions": "Long Pacific swell, building sea breeze",
    "hazards": "Kelp beds, rocks & breaking surf"
  },
  "world": {
    "size": 13000,
    "boundary": {
      "poly": [
        [
          -4600,
          -6300
        ],
        [
          4600,
          -6300
        ],
        [
          4600,
          1900
        ],
        [
          -4600,
          1900
        ]
      ],
      "circle": null
    }
  },
  "shapes": [
    {
      "id": "coast-granite",
      "kind": "granite",
      "outer": [
        [
          2758.5,
          -6600
        ],
        [
          2784.1,
          -6300
        ],
        [
          2867.9,
          -6000
        ],
        [
          3009.3,
          -5700
        ],
        [
          3002.5,
          -5400
        ],
        [
          3073.3,
          -5100
        ],
        [
          3041.3,
          -4800
        ],
        [
          2539.9,
          -4500
        ],
        [
          2566.3,
          -4200
        ],
        [
          2922.2,
          -3900
        ],
        [
          3012.2,
          -3600
        ],
        [
          3063,
          -3300
        ],
        [
          3032.7,
          -3000
        ],
        [
          2966.5,
          -2700
        ],
        [
          2826.8,
          -2400
        ],
        [
          2869.6,
          -2100
        ],
        [
          2662.4,
          -1800
        ],
        [
          2707.8,
          -1500
        ],
        [
          2771.3,
          -1200
        ],
        [
          2713.1,
          -900
        ],
        [
          2845.3,
          -600
        ],
        [
          3012.3,
          -300
        ],
        [
          3028.9,
          0
        ],
        [
          3117,
          300
        ],
        [
          3183,
          600
        ],
        [
          3320,
          900
        ],
        [
          3340.1,
          1200
        ],
        [
          3331.3,
          1500
        ],
        [
          3239.2,
          1800
        ],
        [
          3175.6,
          2100
        ],
        [
          3001.7,
          2400
        ],
        [
          4600,
          2400
        ],
        [
          4600,
          -6600
        ]
      ],
      "holes": [],
      "height": 12,
      "c": [
        3060.2,
        -2100
      ],
      "r": 4756.2
    },
    {
      "id": "coast-scrub",
      "kind": "coastalscrub",
      "outer": [
        [
          3273,
          -6600
        ],
        [
          3363.9,
          -6300
        ],
        [
          3405.3,
          -6000
        ],
        [
          3489.5,
          -5700
        ],
        [
          3530.8,
          -5400
        ],
        [
          3483.5,
          -5100
        ],
        [
          3316.9,
          -4800
        ],
        [
          3052.1,
          -4500
        ],
        [
          2962.4,
          -4200
        ],
        [
          3273,
          -3900
        ],
        [
          3414,
          -3600
        ],
        [
          3595.2,
          -3300
        ],
        [
          3400.1,
          -3000
        ],
        [
          3409.1,
          -2700
        ],
        [
          3300.6,
          -2400
        ],
        [
          3251.4,
          -2100
        ],
        [
          3253.4,
          -1800
        ],
        [
          3147.2,
          -1500
        ],
        [
          3202.2,
          -1200
        ],
        [
          3241.2,
          -900
        ],
        [
          3334.2,
          -600
        ],
        [
          3287,
          -300
        ],
        [
          3537.1,
          0
        ],
        [
          3553.2,
          300
        ],
        [
          3672.6,
          600
        ],
        [
          3563.1,
          900
        ],
        [
          3677.8,
          1200
        ],
        [
          3627,
          1500
        ],
        [
          3555.3,
          1800
        ],
        [
          3490,
          2100
        ],
        [
          3433.6,
          2400
        ],
        [
          4600,
          2400
        ],
        [
          4600,
          -6600
        ]
      ],
      "holes": [],
      "height": 5,
      "c": [
        3463.5,
        -2100
      ],
      "r": 4641.3
    },
    {
      "id": "point-rock",
      "kind": "granite",
      "outer": [
        [
          2346.6,
          -4320
        ],
        [
          2288.6,
          -4236.2
        ],
        [
          2224.8,
          -4145.6
        ],
        [
          2080,
          -4126.9
        ],
        [
          1970.6,
          -4188.2
        ],
        [
          1874.3,
          -4237.4
        ],
        [
          1811.7,
          -4320
        ],
        [
          1843.2,
          -4415.1
        ],
        [
          1946,
          -4481.4
        ],
        [
          2080,
          -4497.2
        ],
        [
          2206,
          -4471.8
        ],
        [
          2357.1,
          -4431.3
        ]
      ],
      "holes": [],
      "height": 6,
      "c": [
        2085.7,
        -4322.6
      ],
      "r": 292.3
    },
    {
      "id": "point-rock-2",
      "kind": "granite",
      "outer": [
        [
          1881.5,
          -4180
        ],
        [
          1842.4,
          -4127.7
        ],
        [
          1798,
          -4077.8
        ],
        [
          1728.3,
          -4090.5
        ],
        [
          1705.8,
          -4153
        ],
        [
          1675.7,
          -4217.9
        ],
        [
          1730.8,
          -4265.3
        ],
        [
          1793.2,
          -4255
        ],
        [
          1837.3,
          -4228
        ]
      ],
      "holes": [],
      "height": 4,
      "c": [
        1777,
        -4177.3
      ],
      "r": 109.1
    },
    {
      "id": "otter-rock",
      "kind": "granite",
      "outer": [
        [
          -2005.2,
          -2700
        ],
        [
          -2091,
          -2625.6
        ],
        [
          -2107.2,
          -2521.3
        ],
        [
          -2253.2,
          -2548.3
        ],
        [
          -2347.5,
          -2546.1
        ],
        [
          -2486.2,
          -2527.5
        ],
        [
          -2590.6,
          -2596.6
        ],
        [
          -2546.6,
          -2700
        ],
        [
          -2550,
          -2789
        ],
        [
          -2442.3,
          -2831.9
        ],
        [
          -2363,
          -2904
        ],
        [
          -2232.7,
          -2918.1
        ],
        [
          -2150.4,
          -2838.7
        ],
        [
          -2075.2,
          -2780
        ]
      ],
      "holes": [],
      "height": 8,
      "c": [
        -2302.9,
        -2701.9
      ],
      "r": 306.4
    },
    {
      "id": "otter-rock-2",
      "kind": "granite",
      "outer": [
        [
          -3044,
          -3150
        ],
        [
          -3066.7,
          -3080.1
        ],
        [
          -3133.3,
          -3055.3
        ],
        [
          -3199.7,
          -3064
        ],
        [
          -3257.3,
          -3111
        ],
        [
          -3232.3,
          -3180
        ],
        [
          -3208,
          -3250.5
        ],
        [
          -3131,
          -3257.9
        ],
        [
          -3082.5,
          -3206.6
        ]
      ],
      "holes": [],
      "height": 4,
      "c": [
        -3150.5,
        -3150.6
      ],
      "r": 115.2
    }
  ],
  "course": {
    "description": "Coastal triangle, 2 laps: beat up the kelp line to the point mark, reach out to Otter Rock and round it, run home down the swell. Start and finish on the same line.",
    "marks": [
      {
        "id": "sf-pin",
        "name": "Pin",
        "x": -550,
        "y": 0,
        "kind": "inflatable"
      },
      {
        "id": "sf-boat",
        "name": "Boat",
        "x": 550,
        "y": 0,
        "kind": "committee"
      },
      {
        "id": "mark-1",
        "name": "Point mark",
        "x": 900,
        "y": -3600,
        "kind": "inflatable"
      },
      {
        "id": "otter-rock-mark",
        "name": "Round Otter Rock",
        "x": -2300,
        "y": -2700,
        "kind": "none"
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
      }
    ],
    "route": [
      {
        "kind": "line",
        "lineId": "sf",
        "dir": 1
      },
      {
        "kind": "round",
        "dir": 1,
        "pass": "through",
        "markId": "mark-1",
        "side": "port"
      },
      {
        "kind": "round",
        "dir": 1,
        "markId": "otter-rock-mark",
        "side": "port",
        "zone": 1000,
        "radius": 480
      },
      {
        "kind": "gate",
        "lineId": "sf",
        "dir": -1,
        "pass": "through"
      },
      {
        "kind": "round",
        "dir": 1,
        "pass": "through",
        "markId": "mark-1",
        "side": "port"
      },
      {
        "kind": "round",
        "dir": 1,
        "markId": "otter-rock-mark",
        "side": "port",
        "zone": 1000,
        "radius": 480
      },
      {
        "kind": "gate",
        "lineId": "sf",
        "dir": -1,
        "pass": "through"
      }
    ],
    "cutoff": 420,
    "paths": {
      "sig": "v2-9b786bfc-1qa",
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
              986.8,
              -3576.1
            ],
            [
              989.9,
              -3603.3
            ],
            [
              984.8,
              -3630.2
            ],
            [
              971.7,
              -3654.4
            ],
            [
              952,
              -3673.4
            ],
            [
              927.5,
              -3685.7
            ],
            [
              900.4,
              -3690
            ],
            [
              873.3,
              -3685.9
            ]
          ],
          "roundSweep": 2.1413,
          "roundZone": 90
        },
        {
          "pts": [
            [
              873.3,
              -3685.9
            ],
            [
              -2374,
              -3245
            ],
            [
              -2545.7,
              -3192.1
            ],
            [
              -2691.2,
              -3086.6
            ],
            [
              -2794.9,
              -2939.9
            ],
            [
              -2845.8,
              -2767.6
            ],
            [
              -2838.5,
              -2588.1
            ],
            [
              -2773.7,
              -2420.5
            ],
            [
              -2658.3,
              -2282.7
            ]
          ],
          "roundSweep": 2.2971,
          "roundZone": 550
        },
        {
          "pts": [
            [
              -2658.3,
              -2282.7
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
              986.8,
              -3576.1
            ],
            [
              989.9,
              -3603.3
            ],
            [
              984.8,
              -3630.2
            ],
            [
              971.7,
              -3654.4
            ],
            [
              952,
              -3673.4
            ],
            [
              927.5,
              -3685.7
            ],
            [
              900.4,
              -3690
            ],
            [
              873.3,
              -3685.9
            ]
          ],
          "roundSweep": 2.1413,
          "roundZone": 90
        },
        {
          "pts": [
            [
              873.3,
              -3685.9
            ],
            [
              -2374,
              -3245
            ],
            [
              -2545.7,
              -3192.1
            ],
            [
              -2691.2,
              -3086.6
            ],
            [
              -2794.9,
              -2939.9
            ],
            [
              -2845.8,
              -2767.6
            ],
            [
              -2838.5,
              -2588.1
            ],
            [
              -2773.7,
              -2420.5
            ],
            [
              -2658.3,
              -2282.7
            ]
          ],
          "roundSweep": 2.2971,
          "roundZone": 550
        },
        {
          "pts": [
            [
              -2658.3,
              -2282.7
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
        "name": "Sea breeze",
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
        "dirVar": 0.14,
        "speed": 13,
        "speedVar": 3,
        "period": 40
      }
    ]
  },
  "palette": {
    "baseColor": "#0f7a6a",
    "deepColor": "#0a4f4a",
    "shallowColor": "#3fb8a0",
    "shorelineColor": "#c79a4b"
  },
  "swell": {
    "strength": 0.8,
    "trains": [
      {
        "id": "primary",
        "periodS": 12.5,
        "heightM": 2.4,
        "speedKt": 14.5,
        "fromWind": 30
      },
      {
        "id": "windsea",
        "periodS": 7.5,
        "heightM": 0.5,
        "speedKt": 18,
        "fromWind": 10,
        "force": 0.3
      }
    ]
  },
  "props": []
};
