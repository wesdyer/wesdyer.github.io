// The SCYC scenario library — one file, every scenario.
// Written by scenario.html; JS not JSON so it loads over file://.
window.SCENARIO_DOC = {
  "Rule 10": {
    "v": 1,
    "durationS": 10,
    "windKt": 12,
    "seeds": [
      541267420,
      3541459374,
      3612285626,
      1376908003,
      552101227,
      1226319115,
      1003982263,
      1167025257,
      1560206834,
      2476808982
    ],
    "tags": [
      "rule-10"
    ],
    "asserts": [
      {
        "kind": "penalty",
        "who": -1
      },
      {
        "kind": "proper",
        "who": 0,
        "tol": 1
      },
      {
        "kind": "nocollide"
      }
    ],
    "boats": [
      {
        "x": 167,
        "y": 485,
        "headingDeg": 320,
        "speedKt": 7.5,
        "aiAtS": 0
      },
      {
        "x": -548,
        "y": 485,
        "headingDeg": 40,
        "speedKt": 7.5,
        "aiAtS": 0
      }
    ],
    "marks": [],
    "sands": [],
    "lines": [],
    "savedAt": 1787043958885
  },
  "Rule 11": {
    "v": 1,
    "durationS": 10,
    "windKt": 12,
    "seeds": [
      2654435769,
      1832409043,
      843002054,
      800078553,
      2637715775,
      547193122,
      638942517,
      1920682214,
      3747048161,
      1966458350
    ],
    "tags": [
      "rule-11"
    ],
    "asserts": [
      {
        "kind": "nocollide"
      },
      {
        "kind": "penalty",
        "who": -1
      },
      {
        "kind": "proper",
        "who": 0,
        "tol": 1
      }
    ],
    "boats": [
      {
        "x": -223,
        "y": 571,
        "headingDeg": 40,
        "speedKt": 7,
        "aiAtS": 0
      },
      {
        "x": -305,
        "y": 514,
        "headingDeg": 45,
        "speedKt": 7,
        "aiAtS": 0
      }
    ],
    "marks": [],
    "sands": [],
    "lines": [],
    "savedAt": 1787045704310
  },
  "Rule 12": {
    "v": 1,
    "durationS": 10,
    "windKt": 12,
    "seeds": [
      2654435769,
      2503965664,
      1148205893,
      2090525083,
      2731891493,
      293900821,
      1192392577,
      633061919,
      3238600644,
      3658407038
    ],
    "tags": [
      "rule-12"
    ],
    "asserts": [
      {
        "kind": "nocollide"
      },
      {
        "kind": "penalty",
        "who": -1
      },
      {
        "kind": "proper",
        "who": 0,
        "tol": 1
      }
    ],
    "boats": [
      {
        "x": 0,
        "y": 200,
        "headingDeg": 90,
        "speedKt": 2,
        "aiAtS": 0
      },
      {
        "x": -250,
        "y": 201,
        "headingDeg": 90,
        "speedKt": 7.5,
        "aiAtS": 0
      }
    ],
    "marks": [],
    "sands": [],
    "lines": [],
    "savedAt": 1787046627663
  },
  "Rule 13": {
    "v": 1,
    "durationS": 10,
    "windKt": 12,
    "seeds": [
      2654435769,
      3477523577,
      3961374258,
      3911852695,
      2852591194,
      1400071019,
      2747798493,
      4156243761,
      1934674241,
      4038481126
    ],
    "tags": [
      "rule-13"
    ],
    "asserts": [
      {
        "kind": "nocollide"
      },
      {
        "kind": "penalty",
        "who": -1
      },
      {
        "kind": "proper",
        "who": 1,
        "tol": 1
      }
    ],
    "boats": [
      {
        "x": 1,
        "y": 236,
        "headingDeg": 320,
        "speedKt": 7,
        "plan": [
          {
            "t": 0,
            "headingDeg": 49
          }
        ],
        "aiAtS": 0.7,
        "goals": [
          {
            "k": "p",
            "x": 418,
            "y": -590
          }
        ]
      },
      {
        "x": 205,
        "y": 238,
        "headingDeg": 320,
        "speedKt": 7.5,
        "aiAtS": 0,
        "goals": [
          {
            "k": "p",
            "x": -435,
            "y": -519
          }
        ]
      }
    ],
    "marks": [],
    "sands": [],
    "lines": [],
    "savedAt": 1787119374723
  },
  "Rule 13 Both": {
    "v": 1,
    "durationS": 10,
    "windKt": 12,
    "seeds": [
      2654435769,
      3477523577,
      3961374258,
      3911852695,
      2852591194,
      1400071019,
      2747798493,
      4156243761,
      1934674241,
      4038481126
    ],
    "tags": [
      "rule-13"
    ],
    "asserts": [
      {
        "kind": "nocollide"
      },
      {
        "kind": "penalty",
        "who": -1
      },
      {
        "kind": "proper",
        "who": 1,
        "tol": 10
      }
    ],
    "boats": [
      {
        "x": 1,
        "y": 236,
        "headingDeg": 320,
        "speedKt": 7,
        "plan": [
          {
            "t": 0,
            "headingDeg": 40
          }
        ],
        "aiAtS": 0.7,
        "goals": [
          {
            "k": "p",
            "x": 418,
            "y": -590
          }
        ]
      },
      {
        "x": 196,
        "y": 248,
        "headingDeg": 40,
        "speedKt": 7.5,
        "plan": [
          {
            "t": 0,
            "headingDeg": 320
          }
        ],
        "aiAtS": 0.7,
        "goals": [
          {
            "k": "p",
            "x": -269,
            "y": -552
          }
        ]
      }
    ],
    "marks": [],
    "sands": [],
    "lines": [],
    "savedAt": 1787119232636
  },
  "Around Mark": {
    "v": 1,
    "durationS": 10,
    "windKt": 12,
    "seeds": [
      2654435769
    ],
    "tags": [
      "mark-rounding"
    ],
    "boats": [
      {
        "x": -607,
        "y": 541,
        "headingDeg": 39,
        "speedKt": 7.5,
        "aiAtS": 0,
        "goals": [
          {
            "k": "m",
            "i": 0
          },
          {
            "k": "p",
            "x": 173,
            "y": 843
          }
        ]
      }
    ],
    "marks": [
      {
        "x": -185,
        "y": 298,
        "side": "starboard",
        "zone": 165
      }
    ],
    "sands": [],
    "lines": [],
    "savedAt": 1787121861285
  }
};
