#!/usr/bin/env node
// Regression tests for YouTube links delivered through Android/Expo native intents.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const { parseYouTubeIntent } = await import('../utils/browser/youtube.ts');
  const id = 'dQw4w9WgXcQ';
  const canonical = 'https://www.youtube.com/watch?v=' + id;
  const cases = [
    ['full watch URL', canonical],
    ['non-www watch URL', 'https://youtube.com/watch?v=' + id],
    ['www host without scheme', 'www.youtube.com/watch?v=' + id],
    ['short URL', 'https://youtu.be/' + id],
    ['shorts URL', 'https://youtube.com/shorts/' + id],
    ['live URL', 'https://m.youtube.com/live/' + id],
    ['scheme-less host', 'youtube.com/watch?v=' + id],
    ['path-only watch', '/watch?v=' + id],
    ['path-only shorts', '/shorts/' + id],
    ['custom-scheme direct route', 'maglev://youtube-download?url=' + encodeURIComponent(canonical)],
  ];
  for (const [name, input] of cases) {
    const parsed = parseYouTubeIntent(input);
    assert.equal(parsed?.videoId, id, name);
    assert.equal(parsed?.canonicalUrl, canonical, name + ' canonical URL');
  }
  assert.equal(parseYouTubeIntent('/watch?v=bad'), null, 'reject malformed video id');
  assert.equal(parseYouTubeIntent('/article?id=' + id), null, 'do not normalize arbitrary paths');
  assert.equal(parseYouTubeIntent('https://youtube.com.evil.example/watch?v=' + id), null, 'reject lookalike host');

  const root = path.join(__dirname, '..');
  const nativeIntent = fs.readFileSync(path.join(root, 'app/+native-intent.tsx'), 'utf8');
  const quickShare = fs.readFileSync(path.join(root, 'modules/maglev-engine/android/src/main/java/com/maglev/engine/share/QuickShareActivity.kt'), 'utf8');
  const youtubeAdapter = fs.readFileSync(path.join(root, 'modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/YoutubeDownload.kt'), 'utf8');
  assert.ok(nativeIntent.includes('return stripShareMarker(internalPath)'), 'router must preserve the internal YouTube route');
  assert.match(nativeIntent, /parseYouTubeIntent\(raw\)\s*\?\?\s*parseYouTubeIntent\(internalPath\)/, 'router must accept full and path-only intent URLs');
  assert.match(quickShare, /maglev:\/\/youtube-download\?url=/, 'QuickShare must launch the direct internal download route');

  assert.match(youtubeAdapter, /updateYoutubeDL\(app, YoutubeDL\.UpdateChannel\.STABLE\)/, 'adapter must update the stable yt-dlp binary');
  assert.match(youtubeAdapter, /UPDATE_INTERVAL_MS = 24 \* 60 \* 60 \* 1000L/, 'stable update checks must be throttled to daily');
  assert.match(youtubeAdapter, /RETRY_INTERVAL_MS = 6 \* 60 \* 60 \* 1000L/, 'failed update checks must retry later');
  assert.match(youtubeAdapter, /safeDiagnostic\(e\)/, 'extractor errors must surface a sanitized diagnostic');

  console.log('test-youtube-intents: all assertions passed');
}
main().catch((e) => { console.error(e); process.exit(1); });
