#!/bin/zsh
# C4 ship-gate battery (2026-08-22): every venue at its ar1* anchor protocol,
# on treeD3B (== shipped HEAD, byte-verified). 5 parallel lanes, sequential
# within a lane. Labels c4*.
set -e
cd "$(dirname "$0")"
lane1() {
  for s in 9400 9500 9600 9700 9800 9900; do
    node ocean_bench.js 8 $s c4rr$s treeD3B redrock > _c4rr$s.log 2>&1
  done; echo "LANE1 (redrock) DONE"
}
lane2() {
  node ocean_bench.js 20 9400 c4bay9400 treeD3B bay > _c4bay9400.log 2>&1
  node ocean_bench.js 20 9600 c4bay9600 treeD3B bay > _c4bay9600.log 2>&1
  echo "LANE2 (bay) DONE"
}
lane3() {
  node ocean_bench.js 20 6100 c4lk6100 treeD3B lake > _c4lk6100.log 2>&1
  node ocean_bench.js 20 6200 c4lk6200 treeD3B lake > _c4lk6200.log 2>&1
  echo "LANE3 (lake) DONE"
}
lane4() {
  node ocean_bench.js 8 9400 c4riv9400 treeD3B river > _c4riv9400.log 2>&1
  node ocean_bench.js 8 9408 c4riv9408 treeD3B river > _c4riv9408.log 2>&1
  node ocean_bench.js 8 9500 c4riv9500 treeD3B river > _c4riv9500.log 2>&1
  node ocean_bench.js 8 9400 c4sw9400 treeD3B swamp > _c4sw9400.log 2>&1
  node ocean_bench.js 8 9500 c4sw9500 treeD3B swamp > _c4sw9500.log 2>&1
  node ocean_bench.js 8 9600 c4sw9600 treeD3B swamp > _c4sw9600.log 2>&1
  echo "LANE4 (river+swamp) DONE"
}
lane5() {
  node ocean_bench.js 16 9400 c4glow treeD3B glowtide > _c4glow.log 2>&1
  node ocean_bench.js 8 9400 c4lag treeD3B lagoon > _c4lag.log 2>&1
  node ocean_bench.js 16 9400 c4oc treeD3B ocean > _c4oc.log 2>&1
  node ocean_bench.js 16 9400 c4st treeD3B seatrials > _c4st.log 2>&1
  echo "LANE5 (glow/lag/oc/st) DONE"
}
lane1 & lane2 & lane3 & lane4 & lane5 &
wait
echo "C4 BATTERY COMPLETE"
