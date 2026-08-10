#!/bin/zsh
# _battery.sh <tree> <labelPrefix>
# The full venue battery at the exact protocol each a2* anchor was recorded at
# (trials/seed0 read off the anchors' .meta.json). Land venues first, because
# they are where a contact-reflex change can act; ocean/seatrials last, where it
# should be inert. Arctic uses fleet_leg2.js, not ocean_bench.js.
#   node _pool_rr.js / _p0_identity.js compare the results against a2*.
set -e
TREE=$1
P=$2
cd "$(dirname "$0")"
run() { echo "--- $2 ($1) ---"; node ocean_bench.js $3 $4 "$P$2" "$TREE" "$1"; }

run lake   lakeA 20 9100
run lake   lakeB 20 9200
run bay    bayA  20 9100
run bay    bayB  20 9200
run lagoon lagA   8 9100
run lagoon lagB   8 9200
run river  rivchk 6 9100
echo "--- arctic ---"; node fleet_leg2.js 8 9100 "${P}arcchk" "$TREE"
run ocean     oc    16 9300
run seatrials seaid  4 9300
echo "BATTERY DONE for $TREE ($P)"
