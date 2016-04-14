#!/bin/sh
#
# This script updates the index files list.js and list.txt in the bin directory,
# as well as the soljson-latest.js files.
#

set -e

(
cd bin
FILES=$(ls soljson-v*)

ls -r soljson-v* > list.txt
(
echo "var soljsonSources = ["
for f in $(ls -r soljson-v*)
do
  echo "  '$f',"
done
echo "];"
cat <<EOF
var soljsonReleases = {};
(function() {
  var version = '';
  for (var i = soljsonSources.length - 1; i >= 0; --i) {
    var thisVersion = soljsonSources[i].match(/soljson-v([0-9.]*)-.*.js/)[1];
    if (thisVersion === version)
      continue;
    version = thisVersion;
    soljsonReleases[version] = soljsonSources[i];
  }
})();

if (typeof(module) !== 'undefined')
  module.exports = {
    'allVersions': soljsonSources,
    'releases': soljsonReleases
  };
EOF
) > list.js
LATEST=$(ls -r soljson-v* | head -n 1)
cp "$LATEST" soljson-latest.js
cp soljson-latest.js ../soljson.js
)
