#!/bin/zsh
# mktree.sh <treeName> [srcRepoRoot]
# Builds a light candidate tree: real copies of the code (js/, css/, index.html,
# eval harness) and a symlink to the shared assets/ dir, which is 190M and never
# edited by a probe. A full cp -R of regatta/ pulls in eval/ (100G+) and recurses.
set -e
NAME=$1
SRC=${2:-/Users/wesdyer/Documents/GitHub/wesdyer.github.io}
DST=$SRC/regatta/eval/rl/$NAME
rm -rf $DST
mkdir -p $DST/regatta/eval
cp $SRC/regatta/index.html $DST/regatta/
cp $SRC/regatta/editor.html $DST/regatta/ 2>/dev/null || true
cp -R $SRC/regatta/js $DST/regatta/js
cp -R $SRC/regatta/css $DST/regatta/css
# Assets: symlink every subdir EXCEPT venues/. Venues are linked per-file, and a
# venue frozen in eval/venues (the benchmark copies — see eval/venues/README.md)
# wins over the shipping file: a tree benches the venue the anchors were made on,
# even after the shipping venue is redesigned (redrock, 2026-08-08).
mkdir $DST/regatta/assets
for d in $SRC/regatta/assets/*; do
  b=$(basename $d)
  [ "$b" = "venues" ] && continue
  ln -s $d $DST/regatta/assets/$b
done
mkdir $DST/regatta/assets/venues
for f in $SRC/regatta/assets/venues/*.venue.js; do
  v=$(basename $f)
  if [ -f $SRC/regatta/eval/venues/$v ]; then
    ln -s $SRC/regatta/eval/venues/$v $DST/regatta/assets/venues/$v
  else
    ln -s $f $DST/regatta/assets/venues/$v
  fi
done
cp $SRC/regatta/eval/eval_harness.js $DST/regatta/eval/
echo "built $DST"
