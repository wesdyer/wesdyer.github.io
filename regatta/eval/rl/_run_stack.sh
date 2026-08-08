#!/bin/zsh
# Full gate stack for $TREE (turn-feasibility governor).
# Usage: ./_run_stack.sh <label> <tree>   (e.g. tg2)
set -e
L=${1:-ff}
TREE=${2:-treeP4FF}
cd "$(dirname "$0")"
# redrock: six disjoint 8-seed sets (pooled-finishers protocol)
for s in 9400 9500 9600 9700 9800 9900; do
  node ocean_bench.js 8 $s ${L}rr$s $TREE redrock > /dev/null 2>&1 &
done
wait
# lake 20x2 (nonlocal rule), bay 20x2, ocean 20
node ocean_bench.js 20 9100 ${L}lakeA $TREE lake > /dev/null 2>&1 &
node ocean_bench.js 20 9200 ${L}lakeB $TREE lake > /dev/null 2>&1 &
wait
node ocean_bench.js 20 9100 ${L}bayA $TREE bay > /dev/null 2>&1 &
node ocean_bench.js 20 9200 ${L}bayB $TREE bay > /dev/null 2>&1 &
wait
node ocean_bench.js 20 9300 ${L}oc $TREE ocean > /dev/null 2>&1 &
# river has ONE round leg — the governor is live there; r0 pair
node ocean_bench.js 16 9100 ${L}rivA $TREE river > /dev/null 2>&1 &
node ocean_bench.js 16 9200 ${L}rivB $TREE river > /dev/null 2>&1 &
wait
echo STACK_DONE
