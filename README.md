# AI GIF Maker for Firefox: selected text to an animated GIF

Turn text into animated GIFs with AI GIF Maker. Native GIF generation — no video conversion. Type what you want and download your GIF in about a minute.

This Firefox add-on is the official [AI GIF Maker](https://aigifmaker.ai/?utm_source=firefox&utm_medium=extension) client for your browser: select text on any page, right-click, choose **Make a GIF of "…"**, and a notification links to the finished GIF about a minute later.

- Right-click selected text → **Make a GIF of "…"**
- Toolbar popup: type a prompt, see recent GIFs (with previews) and your remaining credits
- Settings page: your API key, stored only in `storage.local`
- Talks only to `https://aigifmaker.ai` (`/api/ai/generate`, `/api/ai/query`, `/api/user/get-user-credits`)

Each GIF costs 1 credit on your AI GIF Maker account, the same as on the website. New accounts get one free GIF (it carries a small aigifmaker.ai badge), and a failed GIF gives its credit back. Get a key at https://aigifmaker.ai/settings/apikeys; credit packs are on the [pricing](https://aigifmaker.ai/pricing?utm_source=firefox&utm_medium=extension) page.

## Build

`src/` is the same source as the [Chrome extension](https://github.com/hanshs474/aigifmaker-chrome). `./scripts/build.sh` copies it to `build/`, switches the manifest to `background.scripts`, adds `browser_specific_settings.gecko` from `manifest.firefox.json` (Firefox 142+, data collection: authentication info and website content), runs `web-ext lint` and writes `aigifmaker-firefox-<version>.zip`. `node scripts/smoke.mjs` checks the API client against the live site (wrong key and missing key both land on the auth error; nothing is generated).

Load locally: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → `build/manifest.json`.

Privacy policy: [PRIVACY.md](PRIVACY.md). MIT licensed. Questions: support@aigifmaker.ai.
