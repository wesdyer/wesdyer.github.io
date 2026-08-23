#!/bin/zsh
# C4 ship-gate battery (2026-08-22): every venue at its ar1* anchor protocol,
# on treeBOTH3 (== shipped HEAD, byte-verified). 5 parallel lanes, sequential
# within a lane. Labels c4*.
set -e
cd "$(dirname "$0")"
lane1() {
  for s in 9400 9500 9600 9700 9800 9900; do
    node ocean_bench.js 8 $s b3rr$s treeBOTH3 redrock > _b3rr$s.log 2>&1
  done; echo "LANE1 (redrock) DONE"
}
lane2() {
  node ocean_bench.js 20 9400 b3bay9400 treeBOTH3 bay > _b3bay9400.log 2>&1
  node ocean_bench.js 20 9600 b3bay9600 treeBOTH3 bay > _b3bay9600.log 2>&1
  echo "LANE2 (bay) DONE"
}
lane3() {
  node ocean_bench.js 20 6100 b3lk6100 treeBOTH3 lake > _b3lk6100.log 2>&1
  node ocean_bench.js 20 6200 b3lk6200 treeBOTH3 lake > _b3lk6200.log 2>&1
  echo "LANE3 (lake) DONE"
}
lane4() {
  node ocean_bench.js 8 9400 b3riv9400 treeBOTH3 river > _b3riv9400.log 2>&1
  node ocean_bench.js 8 9408 b3riv9408 treeBOTH3 river > _b3riv9408.log 2>&1
  node ocean_bench.js 8 9500 b3riv9500 treeBOTH3 river > _b3riv9500.log 2>&1
  node ocean_bench.js 8 9400 b3sw9400 treeBOTH3 swamp > _b3sw9400.log 2>&1
  node ocean_bench.js 8 9500 b3sw9500 treeBOTH3 swamp > _b3sw9500.log 2>&1
  node ocean_bench.js 8 9600 b3sw9600 treeBOTH3 swamp > _b3sw9600.log 2>&1
  echo "LANE4 (river+swamp) DONE"
}
lane5() {
  node ocean_bench.js 16 9400 b3glow treeBOTH3 glowtide > _b3glow.log 2>&1
  node ocean_bench.js 8 9400 b3lag treeBOTH3 lagoon > _b3lag.log 2>&1
  node ocean_bench.js 16 9400 b3oc treeBOTH3 ocean > _b3oc.log 2>&1
  node ocean_bench.js 16 9400 b3st treeBOTH3 seatrials > _b3st.log 2>&1
  echo "LANE5 (glow/lag/oc/st) DONE"
}
lane1 & lane2 & lane3 & lane4 & lane5 &
wait
echo "C4 BATTERY COMPLETE"
