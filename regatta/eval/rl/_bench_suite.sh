#!/bin/zsh
# _bench_suite.sh <tree> <prefix> [venues...]
# Runs the n1-width bench suite for a candidate tree with labels <prefix><venue-set>.
# Widths match the standing n1 anchors exactly (rr 6x8, arc 4x16, riv 3x8,
# sw 3x8, bay 2x20, lake 2x20, glow 16, lag 8, oc 16, st 16).
# Each venue runs sequentially inside one process line; venues run in parallel
# only if launched separately by the caller.
set -e
TREE=$1
PFX=$2
shift 2
VENUES=${@:-"redrock bay lake river glowtide lagoon ocean arctic swamp seatrials"}
run() { node ocean_bench.js $1 $2 $3 $TREE $4 > /dev/null 2>&1 && echo "done $3"; }
for V in ${=VENUES}; do
  case $V in
    redrock)   for S in 9400 9500 9600 9700 9800 9900; do run 8 $S ${PFX}rr$S redrock; done ;;
    bay)       for S in 9400 9600; do run 20 $S ${PFX}bay$S bay; done ;;
    lake)      for S in 6100 6200; do run 20 $S ${PFX}lk$S lake; done ;;
    river)     for S in 9400 9408 9500; do run 8 $S ${PFX}riv$S river; done ;;
    glowtide)  run 16 9400 ${PFX}glow glowtide ;;
    lagoon)    run 8 9400 ${PFX}lag lagoon ;;
    ocean)     run 16 9400 ${PFX}oc ocean ;;
    arctic)    for S in 9100 9200 9400 9600; do run 16 $S ${PFX}arc$S arctic; done ;;
    swamp)     for S in 9400 9500 9600; do run 8 $S ${PFX}sw$S swamp; done ;;
    seatrials) run 16 9400 ${PFX}st seatrials ;;
  esac
done
echo "SUITE DONE: $TREE $PFX $VENUES"
