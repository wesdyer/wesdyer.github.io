// The SCYC scenario library — one file, every scenario.
// Written by scenario.html; JS not JSON so it loads over file://.
window.SCENARIO_DOC = {
  "Tack onto STBD 1": {
    "v": 1,
    "durationS": 10,
    "windKt": 12,
    "boats": [
      {
        "x": -425,
        "y": 479,
        "headingDeg": 40,
        "speedKt": 6,
        "plan": [
          {
            "t": 5,
            "headingDeg": 320
          }
        ]
      },
      {
        "x": -637,
        "y": 460,
        "headingDeg": 40,
        "speedKt": 6
      }
    ],
    "marks": [],
    "sands": [],
    "lines": [],
    "asserts": [
      { "kind": "row", "of": 1, "over": 0, "rule": "13", "t": 5.9 },
      { "kind": "row", "of": 0, "over": 1, "rule": "10", "t": 6.3 },
      { "kind": "penalty", "who": 0, "rule": "15" }
    ]
  },
  "Tack onto STBD 2": {
    "v": 1,
    "durationS": 10,
    "windKt": 12,
    "boats": [
      {
        "x": -425,
        "y": 479,
        "headingDeg": 40,
        "speedKt": 6,
        "plan": [
          {
            "t": 5,
            "headingDeg": 320
          }
        ]
      },
      {
        "x": -548,
        "y": 468,
        "headingDeg": 40,
        "speedKt": 6
      }
    ],
    "marks": [],
    "sands": [],
    "lines": [],
    "asserts": [
      { "kind": "row", "of": 1, "over": 0, "rule": "13", "t": 5.9 },
      { "kind": "row", "of": 0, "over": 1, "rule": "10", "t": 6.3 },
      { "kind": "penalty", "who": 0, "rule": "15" }
    ]
  }
};
