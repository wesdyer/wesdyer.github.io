#!/bin/zsh
cd /Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta/eval/rl
run() { node ocean_bench.js $1 $2 $3 $4 $5 > _pa_$3.log 2>&1; echo "done $3 $(date +%H:%M)" >> _pa_done.log; }
export -f run 2>/dev/null
cat _pa_queue.txt | xargs -P 6 -L 1 zsh -c 'cd /Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta/eval/rl; node ocean_bench.js $0 $1 $2 $3 $4 > _pa_$2.log 2>&1; echo "done $2 $(date +%H:%M)" >> _pa_done.log'
echo "ALL DONE $(date +%H:%M)" >> _pa_done.log
