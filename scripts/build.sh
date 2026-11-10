#!/bin/sh
# Build the Firefox version from the Chrome source: copy ../aigifmaker-chrome/src (or ./src if vendored), swap the
# manifest's background for background.scripts, add browser_specific_settings.gecko, lint, zip.
set -e
cd "$(dirname "$0")/.."
SRC=${SRC:-../aigifmaker-chrome/src}
[ -d src ] && SRC=src
rm -rf build && mkdir build && cp -R "$SRC"/. build/
find build -name .DS_Store -delete
node -e '
const fs=require("fs");const m=JSON.parse(fs.readFileSync("build/manifest.json"));const ff=JSON.parse(fs.readFileSync("manifest.firefox.json"));
delete m.background; delete m.minimum_chrome_version;
m.options_ui={page:m.options_ui.page,open_in_tab:true};
Object.assign(m,ff);fs.writeFileSync("build/manifest.json",JSON.stringify(m,null,2)+"\n");'
# per-store tracking and the policy URL in this repository
for f in build/*.js build/manifest.json; do sed -i.bak -e 's/utm_source=chrome/utm_source=firefox/g' -e 's#hanshs474/aigifmaker-chrome/blob#hanshs474/aigifmaker-firefox/blob#g' "$f" && rm "$f.bak"; done
grep -rq 'utm_source=chrome' build && { echo "chrome utm left in build" >&2; exit 1; }
V=$(node -p "require('./build/manifest.json').version")
OUT="aigifmaker-firefox-$V.zip"
rm -f "$OUT"
npx -y web-ext@latest lint --source-dir build --self-hosted=false --warnings-as-errors 2>&1 | tail -20
(cd build && zip -r -X -q "../$OUT" . -x '.*')
echo "$OUT"
