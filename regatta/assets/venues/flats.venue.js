// FIRST CUT by hand (Sep 2 2026) — now the SOURCE OF TRUTH.
// Emitted as JS, not JSON: the eval harness loads over file://, where fetch is blocked.
// Edited in editor.html.
window.VENUE_DOC = window.VENUE_DOC || {};
window.VENUE_DOC["flats"] = {
  "schema": 1,
  "venue": "flats",
  "note": "FIRST CUT, Sep 2 2026 — a hand-laid loop around a central sandbar so the venue exists, opens in editor.html and races: beat up the west channel, reach across the top, run down the east side (inner lane past the spit is shoaled and slow, outer lane is clear), reach back to the line. The tide — drying bars, building flow, the slack window — is NOT built (guidelines/venues.md §11); the shoals here are static. Redesign freely — nothing here is measured.",
  "card": {
    "name": "Spoonbill Flats",
    "tag": "Tidal Flats",
    "blurb": "A wide estuary emptying itself. The tide falls all race — bars surface, channels narrow, and the water runs harder through what's left. Is the shortcut still open, and is it still worth it?",
    "conditions": "Falling tide, moderate breeze",
    "hazards": "Drying sandbars & withies"
  },
  "world": {
    "size": 13000,
    "boundary": {
      "poly": [
        [
          -2700,
          -4200
        ],
        [
          3100,
          -4200
        ],
        [
          3100,
          1000
        ],
        [
          -2700,
          1000
        ]
      ],
      "circle": null
    }
  },
  "shapes": [
    {
      "id": "west-bank",
      "kind": "marsh",
      "outer": [
        [
          -2489,
          -5200
        ],
        [
          -2455.9,
          -4900
        ],
        [
          -2443.1,
          -4600
        ],
        [
          -2315.9,
          -4300
        ],
        [
          -2227.7,
          -4000
        ],
        [
          -2263.3,
          -3700
        ],
        [
          -2221.2,
          -3400
        ],
        [
          -2269.8,
          -3100
        ],
        [
          -2191.2,
          -2800
        ],
        [
          -2249.1,
          -2500
        ],
        [
          -2328.2,
          -2200
        ],
        [
          -2352.3,
          -1900
        ],
        [
          -2464.7,
          -1600
        ],
        [
          -2488.9,
          -1300
        ],
        [
          -2490.5,
          -1000
        ],
        [
          -2504.1,
          -700
        ],
        [
          -2460,
          -400
        ],
        [
          -2388.5,
          -100
        ],
        [
          -2270.5,
          200
        ],
        [
          -2306.7,
          500
        ],
        [
          -2257.3,
          800
        ],
        [
          -2215.1,
          1100
        ],
        [
          -2246.1,
          1400
        ],
        [
          -4200,
          1600
        ],
        [
          -4200,
          -5200
        ]
      ],
      "holes": [],
      "height": 4,
      "c": [
        -2492,
        -1892
      ],
      "r": 3887.3
    },
    {
      "id": "east-bank",
      "kind": "marsh",
      "outer": [
        [
          3053.1,
          -5200
        ],
        [
          3015.6,
          -4900
        ],
        [
          3001.2,
          -4600
        ],
        [
          2930,
          -4300
        ],
        [
          2862.2,
          -4000
        ],
        [
          2848.1,
          -3700
        ],
        [
          2856.8,
          -3400
        ],
        [
          2802.3,
          -3100
        ],
        [
          2794.1,
          -2800
        ],
        [
          2845.3,
          -2500
        ],
        [
          2957.1,
          -2200
        ],
        [
          3037,
          -1900
        ],
        [
          3041.6,
          -1600
        ],
        [
          3107.5,
          -1300
        ],
        [
          3122,
          -1000
        ],
        [
          3081,
          -700
        ],
        [
          3024.6,
          -400
        ],
        [
          2996.1,
          -100
        ],
        [
          2960.6,
          200
        ],
        [
          2876.2,
          500
        ],
        [
          2791.2,
          800
        ],
        [
          2843,
          1100
        ],
        [
          2825.2,
          1400
        ],
        [
          4400,
          1600
        ],
        [
          4400,
          -5200
        ]
      ],
      "holes": [],
      "height": 4,
      "c": [
        3058.9,
        -1892
      ],
      "r": 3740.7
    },
    {
      "id": "bar-shoal",
      "kind": "shoal",
      "outer": [
        [
          730.9,
          -1900
        ],
        [
          632.5,
          -1604.5
        ],
        [
          581.6,
          -1305.3
        ],
        [
          479.8,
          -1019
        ],
        [
          295.5,
          -870.7
        ],
        [
          97.2,
          -824.1
        ],
        [
          -90.3,
          -901.3
        ],
        [
          -291.9,
          -883.1
        ],
        [
          -432.9,
          -1105.1
        ],
        [
          -531.2,
          -1356.9
        ],
        [
          -585.3,
          -1626.6
        ],
        [
          -600.8,
          -1900
        ],
        [
          -653.2,
          -2205.1
        ],
        [
          -590.1,
          -2503.3
        ],
        [
          -451.4,
          -2728.8
        ],
        [
          -283.3,
          -2887
        ],
        [
          -94.3,
          -2943.7
        ],
        [
          92.8,
          -2927.3
        ],
        [
          243.9,
          -2749.6
        ],
        [
          408.4,
          -2649.8
        ],
        [
          599.7,
          -2513.1
        ],
        [
          632.9,
          -2195.6
        ]
      ],
      "holes": [],
      "height": 0,
      "c": [
        8.7,
        -1890.9
      ],
      "r": 1070.4
    },
    {
      "id": "bar",
      "kind": "lakesand",
      "outer": [
        [
          416.1,
          -1900
        ],
        [
          392.4,
          -1664.3
        ],
        [
          339.5,
          -1453.7
        ],
        [
          322.9,
          -1137.7
        ],
        [
          195.3,
          -1025.1
        ],
        [
          65.1,
          -973.7
        ],
        [
          -70,
          -904.4
        ],
        [
          -195.1,
          -1026
        ],
        [
          -261.9,
          -1281.8
        ],
        [
          -375.8,
          -1405.9
        ],
        [
          -377.9,
          -1673
        ],
        [
          -465.8,
          -1900
        ],
        [
          -403.9,
          -2142.6
        ],
        [
          -331.7,
          -2336.1
        ],
        [
          -259.2,
          -2511.8
        ],
        [
          -177.1,
          -2693.4
        ],
        [
          -64.6,
          -2818.4
        ],
        [
          68.3,
          -2872.1
        ],
        [
          197.9,
          -2786.6
        ],
        [
          312.3,
          -2637.1
        ],
        [
          359.7,
          -2372.9
        ],
        [
          442.8,
          -2166
        ]
      ],
      "holes": [],
      "height": 3,
      "c": [
        5.9,
        -1894.7
      ],
      "r": 993.1
    },
    {
      "id": "spit-shoal",
      "kind": "shoal",
      "outer": [
        [
          1874.3,
          -1900
        ],
        [
          1825.8,
          -1582.4
        ],
        [
          1726.7,
          -1366.6
        ],
        [
          1628.7,
          -1168.8
        ],
        [
          1500,
          -1122.6
        ],
        [
          1378.1,
          -1207.7
        ],
        [
          1259.5,
          -1334.2
        ],
        [
          1223.3,
          -1630.3
        ],
        [
          1174.7,
          -1900
        ],
        [
          1209.5,
          -2183.1
        ],
        [
          1250.6,
          -2486.9
        ],
        [
          1382.3,
          -2568.7
        ],
        [
          1500,
          -2690.1
        ],
        [
          1641.3,
          -2702.5
        ],
        [
          1732.2,
          -2446.2
        ],
        [
          1826.5,
          -2218.2
        ]
      ],
      "holes": [],
      "height": 0,
      "c": [
        1508.3,
        -1906.8
      ],
      "r": 806.7
    },
    {
      "id": "spit",
      "kind": "lakesand",
      "outer": [
        [
          1674.4,
          -1900
        ],
        [
          1682.1,
          -1633.8
        ],
        [
          1612.9,
          -1501.6
        ],
        [
          1557.5,
          -1409.8
        ],
        [
          1500,
          -1247.2
        ],
        [
          1426.9,
          -1277.1
        ],
        [
          1382.4,
          -1485.1
        ],
        [
          1348.9,
          -1679.1
        ],
        [
          1318.4,
          -1900
        ],
        [
          1357.2,
          -2108.8
        ],
        [
          1383.5,
          -2311
        ],
        [
          1437,
          -2437.1
        ],
        [
          1500,
          -2449
        ],
        [
          1561.6,
          -2425.1
        ],
        [
          1606.7,
          -2276.6
        ],
        [
          1668.3,
          -2146.1
        ]
      ],
      "holes": [],
      "height": 2,
      "c": [
        1501.1,
        -1886.7
      ],
      "r": 639.5
    },
    {
      "id": "inner-entrance-shoal",
      "kind": "shoal",
      "outer": [
        [
          1270.5,
          -2400
        ],
        [
          1272.5,
          -2285.5
        ],
        [
          1116.1,
          -2237.1
        ],
        [
          975,
          -2194.4
        ],
        [
          798.6,
          -2196.3
        ],
        [
          713.5,
          -2299.4
        ],
        [
          628.8,
          -2400
        ],
        [
          724.9,
          -2496.3
        ],
        [
          810.6,
          -2589.8
        ],
        [
          975,
          -2592.9
        ],
        [
          1161.3,
          -2615.1
        ],
        [
          1225.3,
          -2496.3
        ]
      ],
      "holes": [],
      "height": 0,
      "c": [
        972.7,
        -2400.3
      ],
      "r": 343.9
    },
    {
      "id": "mud-1",
      "kind": "mud",
      "outer": [
        [
          -1921.4,
          -3400
        ],
        [
          -1918.7,
          -3184.3
        ],
        [
          -2036.1,
          -3081.4
        ],
        [
          -2150,
          -2902.4
        ],
        [
          -2266.4,
          -3074.3
        ],
        [
          -2386.2,
          -3179.7
        ],
        [
          -2460.1,
          -3400
        ],
        [
          -2398,
          -3631.3
        ],
        [
          -2289,
          -3788.8
        ],
        [
          -2150,
          -3785.4
        ],
        [
          -1999.6,
          -3820.8
        ],
        [
          -1917.8,
          -3616.6
        ]
      ],
      "holes": [],
      "height": 1,
      "c": [
        -2157.8,
        -3405.4
      ],
      "r": 503.1
    },
    {
      "id": "mud-2",
      "kind": "mud",
      "outer": [
        [
          2938.1,
          -900
        ],
        [
          2890.6,
          -709.9
        ],
        [
          2831.8,
          -505.7
        ],
        [
          2700,
          -465.4
        ],
        [
          2593.8,
          -582.3
        ],
        [
          2485.8,
          -686.4
        ],
        [
          2493.9,
          -900
        ],
        [
          2487.9,
          -1111.5
        ],
        [
          2573.6,
          -1278.2
        ],
        [
          2700,
          -1204.7
        ],
        [
          2799.7,
          -1198.2
        ],
        [
          2923.4,
          -1122.8
        ]
      ],
      "holes": [],
      "height": 1,
      "c": [
        2701.5,
        -888.8
      ],
      "r": 423.4
    }
  ],
  "course": {
    "description": "Loop round the bar, 2 laps: beat up the west channel, reach across the top, run down the east side past the spit, reach home. Start and finish on the same line.",
    "marks": [
      {
        "id": "sf-pin",
        "name": "Pin",
        "x": -1900,
        "y": 250,
        "kind": "inflatable"
      },
      {
        "id": "sf-boat",
        "name": "Boat",
        "x": -800,
        "y": 250,
        "kind": "committee"
      },
      {
        "id": "mark-a",
        "name": "North-west mark",
        "x": -1350,
        "y": -3050,
        "kind": "inflatable"
      },
      {
        "id": "mark-b",
        "name": "North-east mark",
        "x": 700,
        "y": -3050,
        "kind": "inflatable"
      },
      {
        "id": "mark-c",
        "name": "South-east mark",
        "x": 1400,
        "y": -150,
        "kind": "inflatable"
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
        "markId": "mark-a",
        "side": "starboard"
      },
      {
        "kind": "round",
        "dir": 1,
        "pass": "through",
        "markId": "mark-b",
        "side": "starboard"
      },
      {
        "kind": "round",
        "dir": 1,
        "pass": "through",
        "markId": "mark-c",
        "side": "starboard"
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
        "markId": "mark-a",
        "side": "starboard"
      },
      {
        "kind": "round",
        "dir": 1,
        "pass": "through",
        "markId": "mark-b",
        "side": "starboard"
      },
      {
        "kind": "round",
        "dir": 1,
        "pass": "through",
        "markId": "mark-c",
        "side": "starboard"
      },
      {
        "kind": "gate",
        "lineId": "sf",
        "dir": -1,
        "pass": "through"
      }
    ],
    "cutoff": 450,
    "paths": {
      "sig": "v2-80096324-1w8",
      "legs": [
        {
          "pts": []
        },
        {
          "pts": [
            [
              -1350,
              250
            ],
            [
              -1440,
              -3047.5
            ],
            [
              -1436,
              -3076.7
            ],
            [
              -1422.7,
              -3103
            ],
            [
              -1401.8,
              -3123.6
            ],
            [
              -1375.3,
              -3136.4
            ],
            [
              -1346,
              -3139.9
            ]
          ],
          "roundSweep": 1.642,
          "roundZone": 90
        },
        {
          "pts": [
            [
              -1346,
              -3139.9
            ],
            [
              700,
              -3140
            ],
            [
              730.1,
              -3134.8
            ],
            [
              756.7,
              -3119.9
            ],
            [
              776.8,
              -3096.9
            ],
            [
              788.1,
              -3068.5
            ]
          ],
          "roundSweep": 1.3642,
          "roundZone": 90
        },
        {
          "pts": [
            [
              788.1,
              -3068.5
            ],
            [
              1487.5,
              -171.1
            ],
            [
              1489.5,
              -140.8
            ],
            [
              1481.4,
              -111.6
            ],
            [
              1464,
              -86.7
            ],
            [
              1439.2,
              -69
            ],
            [
              1410.1,
              -60.6
            ]
          ],
          "roundSweep": 1.6956,
          "roundZone": 90
        },
        {
          "pts": [
            [
              1410.1,
              -60.6
            ],
            [
              -1350,
              250
            ]
          ]
        },
        {
          "pts": [
            [
              -1350,
              250
            ],
            [
              -1440,
              -3047.5
            ],
            [
              -1436,
              -3076.7
            ],
            [
              -1422.7,
              -3103
            ],
            [
              -1401.8,
              -3123.6
            ],
            [
              -1375.3,
              -3136.4
            ],
            [
              -1346,
              -3139.9
            ]
          ],
          "roundSweep": 1.642,
          "roundZone": 90
        },
        {
          "pts": [
            [
              -1346,
              -3139.9
            ],
            [
              700,
              -3140
            ],
            [
              730.1,
              -3134.8
            ],
            [
              756.7,
              -3119.9
            ],
            [
              776.8,
              -3096.9
            ],
            [
              788.1,
              -3068.5
            ]
          ],
          "roundSweep": 1.3642,
          "roundZone": 90
        },
        {
          "pts": [
            [
              788.1,
              -3068.5
            ],
            [
              1487.5,
              -171.1
            ],
            [
              1489.5,
              -140.8
            ],
            [
              1481.4,
              -111.6
            ],
            [
              1464,
              -86.7
            ],
            [
              1439.2,
              -69
            ],
            [
              1410.1,
              -60.6
            ]
          ],
          "roundSweep": 1.6956,
          "roundZone": 90
        },
        {
          "pts": [
            [
              1410.1,
              -60.6
            ],
            [
              -1350,
              250
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
        "name": "Estuary breeze",
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
        "dirVar": 0.1,
        "speed": 11,
        "speedVar": 2,
        "period": 45
      }
    ]
  },
  "palette": {
    "baseColor": "#3a6394",
    "deepColor": "#274a72",
    "shallowColor": "#7aa6d4",
    "shorelineColor": "#e0b866"
  },
  "props": []
};
