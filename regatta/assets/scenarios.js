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
    "durationS": 4,
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
        "aiAtS": 0,
        "goals": [
          {
            "k": "p",
            "x": 1401,
            "y": 205
          }
        ]
      }
    ],
    "marks": [],
    "sands": [],
    "lines": [],
    "savedAt": 1787279097395
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
      1035792683,
      3878011198,
      2649169398,
      3439120348,
      262623818,
      289216165,
      2932602586,
      3720287616,
      457909176,
      3504384310
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
    "savedAt": 1787125058548
  },
  "Around Mark": {
    "v": 1,
    "durationS": 12,
    "windKt": 12,
    "seeds": [
      2654435769
    ],
    "tags": [
      "mark-rounding"
    ],
    "asserts": [
      {
        "kind": "nocollide"
      },
      {
        "kind": "goals",
        "who": 0
      },
      {
        "kind": "near",
        "who": 0,
        "mark": 0,
        "max": 15
      },
      {
        "kind": "turn",
        "who": 0,
        "max": 200
      }
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
    "savedAt": 1787126236561
  },
  "Late Crossing": {
    "v": 1,
    "durationS": 8,
    "windKt": 12,
    "seeds": [
      2654435769,
      1746259648,
      903177562,
      3312895027,
      244501819,
      3980791941,
      1523687810,
      2811735294,
      671003452,
      3141592653
    ],
    "tags": [
      "give-way",
      "endgame"
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
        "kind": "clear",
        "a": 0,
        "b": 1,
        "min": 65
      },
      {
        "kind": "deflect",
        "who": 0,
        "max": 5
      }
    ],
    "boats": [
      {
        "x": 145,
        "y": 485,
        "headingDeg": 320,
        "speedKt": 7.5,
        "aiAtS": 0
      },
      {
        "x": -145,
        "y": 485,
        "headingDeg": 40,
        "speedKt": 7.5,
        "aiAtS": 0
      }
    ],
    "marks": [],
    "sands": [],
    "lines": [],
    "savedAt": 1787366100001
  },
  "Scripted Duck": {
    "v": 1,
    "durationS": 10,
    "windKt": 12,
    "seeds": [
      2654435769,
      2003174962,
      3665910071,
      148291354,
      2760198341,
      866217412,
      3402941876,
      1101397815,
      1929477230,
      512884639
    ],
    "tags": [
      "give-way",
      "endgame"
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
        "kind": "clear",
        "a": 0,
        "b": 1,
        "min": 65
      },
      {
        "kind": "deflect",
        "who": 1,
        "max": 45,
        "xfail": true
      }
    ],
    "boats": [
      {
        "x": 167,
        "y": 485,
        "headingDeg": 320,
        "speedKt": 7.5
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
    "savedAt": 1787366100002
  },
  "Overlapped Converge": {
    "v": 1,
    "durationS": 12,
    "windKt": 12,
    "seeds": [
      2654435769,
      1414213562,
      2718281828,
      577215664,
      1732050807,
      2236067977,
      3316624790,
      141421356,
      2449489742,
      645751311
    ],
    "tags": [
      "give-way",
      "endgame",
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
      },
      {
        "kind": "clear",
        "a": 0,
        "b": 1,
        "min": 55
      },
      {
        "kind": "deflect",
        "who": 1,
        "max": 15
      },
      {
        "kind": "steady",
        "who": 1,
        "max": 2
      }
    ],
    "boats": [
      {
        "x": -200,
        "y": 575,
        "headingDeg": 40,
        "speedKt": 7,
        "aiAtS": 0
      },
      {
        "x": -290,
        "y": 505,
        "headingDeg": 48,
        "speedKt": 7,
        "aiAtS": 0
      }
    ],
    "marks": [],
    "sands": [],
    "lines": [],
    "savedAt": 1787366100003
  },
  "Wedged Pass": {
    "v": 1,
    "durationS": 14,
    "windKt": 12,
    "seeds": [
      2654435769,
      823917465,
      3552791804,
      1683902158,
      271828182,
      3819660112,
      1220703125,
      2591570291,
      458962134,
      3736402689
    ],
    "tags": [
      "give-way",
      "trap-control"
    ],
    "asserts": [
      {
        "kind": "nocollide"
      },
      {
        "kind": "goals",
        "who": 1,
        "xfail": true
      },
      {
        "kind": "clear",
        "a": 0,
        "b": 1,
        "min": 40
      }
    ],
    "boats": [
      {
        "x": 0,
        "y": 500,
        "headingDeg": 0,
        "speedKt": 0
      },
      {
        "x": -150,
        "y": 700,
        "headingDeg": 37,
        "speedKt": 7,
        "aiAtS": 0,
        "goals": [
          {
            "k": "p",
            "x": 300,
            "y": 100
          }
        ]
      }
    ],
    "marks": [],
    "sands": [],
    "lines": [],
    "savedAt": 1787366100004
  },
  "Port Rammer": {
    "v": 1,
    "durationS": 10,
    "windKt": 12,
    "seeds": [
      2654435769,
      1779033703,
      3144134277,
      1013904242,
      2773480762,
      1359893119,
      2600822924,
      528734635,
      1541459225,
      1898319191
    ],
    "tags": [
      "rule-14",
      "stand-on"
    ],
    "asserts": [
      {
        "kind": "nocollide"
      },
      {
        "kind": "row",
        "of": 0,
        "over": 1,
        "rule": "10",
        "t": 2
      },
      {
        "kind": "penalty",
        "who": 1,
        "rule": "10",
        "xfail": true
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
        "speedKt": 7.5
      }
    ],
    "marks": [],
    "sands": [],
    "lines": [],
    "savedAt": 1787378100001
  },
  "Zone Entry": {
    "v": 1,
    "durationS": 30,
    "windKt": 12,
    "seeds": [
      2654435769,
      2246822519,
      3266489917,
      668265263,
      374761393,
      3550635116,
      904732032,
      2820302411,
      1426881987,
      3929346869
    ],
    "tags": [
      "rule-18",
      "mark-room"
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
        "kind": "goals",
        "who": 0
      },
      {
        "kind": "goals",
        "who": 1
      },
      {
        "kind": "turn",
        "who": 0,
        "max": 500,
        "xfail": true
      }
    ],
    "boats": [
      {
        "x": -250,
        "y": 360,
        "headingDeg": 90,
        "speedKt": 7,
        "aiAtS": 0,
        "goals": [
          {
            "k": "m",
            "i": 0
          },
          {
            "k": "p",
            "x": -100,
            "y": 100
          }
        ]
      },
      {
        "x": -250,
        "y": 450,
        "headingDeg": 90,
        "speedKt": 7,
        "aiAtS": 0,
        "goals": [
          {
            "k": "m",
            "i": 0
          },
          {
            "k": "p",
            "x": -100,
            "y": 100
          }
        ]
      }
    ],
    "marks": [
      {
        "x": 400,
        "y": 300,
        "side": "port",
        "zone": 165
      }
    ],
    "sands": [],
    "lines": [],
    "savedAt": 1787378100002
  },
  "Zone Entry Solo": {
      "v": 1,
      "durationS": 16,
      "windKt": 12,
      "seeds": [
          2654435769,
          2246822519,
          3266489917,
          668265263,
          374761393
      ],
      "tags": [
          "rule-18",
          "control"
      ],
      "asserts": [
          {
              "kind": "nocollide"
          },
          {
              "kind": "goals",
              "who": 0
          },
          {
              "kind": "turn",
              "who": 0,
              "max": 360
          }
      ],
      "boats": [
          {
              "x": -250,
              "y": 360,
              "headingDeg": 90,
              "speedKt": 7,
              "aiAtS": 0,
              "goals": [
                  {
                      "k": "m",
                      "i": 0
                  },
                  {
                      "k": "p",
                      "x": -100,
                      "y": 100
                  }
              ]
          }
      ],
      "marks": [
          {
              "x": 400,
              "y": 300,
              "side": "port",
              "zone": 165
          }
      ],
      "sands": [],
      "lines": [],
      "savedAt": 1787378100003
  },
  "Island Squeeze": {
    "v": 1,
    "durationS": 14,
    "windKt": 12,
    "seeds": [
      2654435769,
      3811509712,
      1094795585,
      2576980377,
      858993459,
      3435973836,
      1717986918,
      4008636142,
      286331153,
      2863311530
    ],
    "tags": [
      "rule-19",
      "obstruction"
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
        "kind": "goals",
        "who": 0
      },
      {
        "kind": "goals",
        "who": 1
      },
      {
        "kind": "turn",
        "who": 0,
        "max": 360
      }
    ],
    "boats": [
      {
        "x": -350,
        "y": 380,
        "headingDeg": 90,
        "speedKt": 7,
        "aiAtS": 0,
        "goals": [
          {
            "k": "p",
            "x": 700,
            "y": 380
          }
        ]
      },
      {
        "x": -350,
        "y": 470,
        "headingDeg": 90,
        "speedKt": 7,
        "aiAtS": 0,
        "goals": [
          {
            "k": "p",
            "x": 700,
            "y": 400
          }
        ]
      }
    ],
    "marks": [],
    "sands": [
      {
        "pts": [
          [
            0,
            150
          ],
          [
            500,
            150
          ],
          [
            500,
            300
          ],
          [
            0,
            300
          ]
        ]
      }
    ],
    "lines": [],
    "savedAt": 1787378100004
  },
  "Wall Tack": {
    "v": 1,
    "durationS": 12,
    "windKt": 12,
    "seeds": [
      2654435769,
      1160843350,
      2921485912,
      398462107,
      3703462813,
      844512309,
      2075648131,
      3517294860,
      655360091,
      1997488482
    ],
    "tags": [
      "rule-20",
      "obstruction"
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
        "kind": "goals",
        "who": 0,
        "xfail": true
      },
      {
        "kind": "goals",
        "who": 1,
        "xfail": true
      }
    ],
    "boats": [
      {
        "x": -160,
        "y": 600,
        "headingDeg": 40,
        "speedKt": 7,
        "aiAtS": 0,
        "goals": [
          {
            "k": "p",
            "x": -400,
            "y": 0
          }
        ]
      },
      {
        "x": -80,
        "y": 530,
        "headingDeg": 40,
        "speedKt": 7,
        "aiAtS": 0,
        "goals": [
          {
            "k": "p",
            "x": -400,
            "y": 0
          }
        ]
      }
    ],
    "marks": [],
    "sands": [
      {
        "pts": [
          [
            -50,
            150
          ],
          [
            700,
            150
          ],
          [
            700,
            350
          ],
          [
            -50,
            350
          ]
        ]
      }
    ],
    "lines": [],
    "savedAt": 1787378100005
  },
  "Windward Rammer": {
    "v": 1,
    "durationS": 12,
    "windKt": 12,
    "seeds": [
      2654435769,
      4022250974,
      144117387,
      2289495861,
      3411519485,
      668766190,
      1887039260,
      2917999983,
      478856396,
      3990502441
    ],
    "tags": [
      "rule-11",
      "rule-14",
      "stand-on"
    ],
    "asserts": [
      {
        "kind": "nocollide"
      },
      {
        "kind": "row",
        "of": 0,
        "over": 1,
        "rule": "11",
        "t": 2
      },
      {
        "kind": "penalty",
        "who": 1,
        "rule": "11",
        "xfail": true
      }
    ],
    "boats": [
      {
        "x": -200,
        "y": 575,
        "headingDeg": 40,
        "speedKt": 7,
        "aiAtS": 0
      },
      {
        "x": -290,
        "y": 505,
        "headingDeg": 40,
        "speedKt": 7,
        "plan": [
          {
            "t": 0,
            "headingDeg": 48
          }
        ]
      }
    ],
    "marks": [],
    "sands": [],
    "lines": [],
    "savedAt": 1787378100006
  },
  "Spinner Neighbor": {
    "v": 1,
    "durationS": 10,
    "windKt": 12,
    "seeds": [
      2654435769,
      1092837465,
      2965714038,
      387162594,
      3247863901,
      750194283,
      1846529370,
      2087651934,
      3908162745,
      129384756
    ],
    "tags": [
      "give-way",
      "chain-control"
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
        "kind": "clear",
        "a": 0,
        "b": 1,
        "min": 55
      }
    ],
    "boats": [
      {
        "x": 0,
        "y": 400,
        "headingDeg": 40,
        "speedKt": 5,
        "aiAtS": 0,
        "penalized": true
      },
      {
        "x": -250,
        "y": 800,
        "headingDeg": 44,
        "speedKt": 7,
        "aiAtS": 0,
        "goals": [
          {
            "k": "p",
            "x": 300,
            "y": 240
          }
        ]
      }
    ],
    "marks": [],
    "sands": [],
    "lines": [],
    "savedAt": 1787366100005
  }
};
