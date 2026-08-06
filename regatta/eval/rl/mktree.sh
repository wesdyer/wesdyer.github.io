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
ln -s $SRC/regatta/assets $DST/regatta/assets
cp $SRC/regatta/eval/eval_harness.js $DST/regatta/eval/
echo "built $DST"
