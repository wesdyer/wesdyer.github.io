# Port the HELM-OWNER tagging onto any tree (2026-08-13).
#
# `_glow_box.js`, `_glow_slow.js` and the rest of the ownership family read
# `controller.__ovOwner`, which only ever existed in `treeGTW` — an instrumented tree
# built from an older HEAD. On a plain tree those probes report **"0 helm samples"**
# rather than failing, which is the plan's probe caveat 3 in its zero-statistic form
# (rule 4). This ports the same eight sites onto whatever tree you name, matching by
# CONTENT rather than line number so it survives the drift.
#
# ⚠️ THE `off` COLUMN OF THE LOG IS DEGENERATE AND ALWAYS HAS BEEN. `gridPath` is
# rebuilt FROM THE BOAT'S OWN POSITION, so "distance from its own plan" reads ~0
# everywhere, inside a rock box and out. The HELM OWNER column is the useful one;
# measure displacement against the GRID instead.
#
#   python3 _mk_helm.py <treeName>
import io, sys

tree = sys.argv[1] if len(sys.argv) > 1 else 'treeHELM'
path = f'/Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta/eval/rl/{tree}/regatta/js/script.js'
src = io.open(path, encoding='utf-8').read()

EDITS = [
    # (anchor, replacement, expected count)
    ("            desiredHeading = this.getStrategicHeading(nav);",
     "            desiredHeading = this.getStrategicHeading(nav);\n            this.__ovOwner = 'nav';", 1),
    ("        desiredHeading = this.applyAvoidance(desiredHeading, speedRequest);",
     "        const __preAv = desiredHeading;\n        desiredHeading = this.applyAvoidance(desiredHeading, speedRequest);\n"
     "        if (window.__ownLog && Math.abs(normalizeAngle(desiredHeading - __preAv)) > 0.01) this.__ovOwner = 'avoid';", 1),
    ("            if (tj != null) { desiredHeading = tj; this._trajFloe = true; }",
     "            if (tj != null) { desiredHeading = tj; this._trajFloe = true; if (window.__ownLog) this.__ovOwner = 'floetraj'; }", 1),
    ("                 this.iceEscapeTimer = 2.0;",
     "                 this.iceEscapeTimer = 2.0;\n                 if (window.__ownLog) this.__ovOwner = 'reflex';", 1),
    ("             desiredHeading = this.iceEscapeHeading;",
     "             desiredHeading = this.iceEscapeHeading; if (window.__ownLog) this.__ovOwner = 'iceEsc';", 1),
    ("             desiredHeading = this.markEscapeHeading;",
     "             desiredHeading = this.markEscapeHeading; if (window.__ownLog) this.__ovOwner = 'markEsc';", 1),
]
LOGGER = """        if (window.__ownLog && isRacing && !this.boat.raceState.finished) {
            // ⚠️ `off` is DEGENERATE — gridPath is rebuilt from the boat's own position.
            // Kept only so the log shape matches treeGTW's. Use the OWNER column.
            window.__ownLog.push([this.boat.raceState.leg, Math.round(this.boat.x), Math.round(this.boat.y),
                this.__ovOwner || 'nav', +(this.boat.speed * 60).toFixed(0), -1]);
        }
        this.targetHeading = desiredHeading;"""

for anchor, repl, n in EDITS:
    if src.count(anchor) != n:
        print(f'⛔ anchor found {src.count(anchor)}x (expected {n}): {anchor[:70]}'); sys.exit(1)
    src = src.replace(anchor, repl, 1)

# the logger goes on the LAST `this.targetHeading = desiredHeading;` in the controller
# update (there is an earlier one inside the penalty-spin path that must not be used)
i = src.rindex("        this.targetHeading = desiredHeading;")
src = src[:i] + LOGGER + src[i + len("        this.targetHeading = desiredHeading;"):]

io.open(path, 'w', encoding='utf-8').write(src)
print(f'{tree}: helm-owner tagging ported ({len(EDITS)} sites + the logger)')
