#!/bin/zsh
set -e
cd "$(dirname "$0")"
lane1() { for s in 9400 9500 9600 9700 9800 9900; do node ocean_bench.js 8 $s t1rr$s treeT1 redrock > _t1rr$s.log 2>&1; done; echo "T1-LANE1 rr DONE"; }
lane2() { node ocean_bench.js 8 9400 t1riv9400 treeT1 river > _t1riv9400.log 2>&1; node ocean_bench.js 8 9408 t1riv9408 treeT1 river > _t1riv9408.log 2>&1; node ocean_bench.js 8 9500 t1riv9500 treeT1 river > _t1riv9500.log 2>&1; echo "T1-LANE2 riv DONE"; }
lane3() { node ocean_bench.js 16 9400 t1arc9400 treeT1 arctic > _t1arc9400.log 2>&1; echo "T1-LANE3 arc9400 DONE"; }
lane4() { node ocean_bench.js 16 9600 t1arc9600 treeT1 arctic > _t1arc9600.log 2>&1; echo "T1-LANE4 arc9600 DONE"; }
lane1 & lane2 & lane3 & lane4 &
wait
echo "T1 BENCH COMPLETE"
