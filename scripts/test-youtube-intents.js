#!/usr/bin/env node
// Regression tests for YouTube links delivered through Android/Expo native intents.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const { parseYouTubeIntent, parseYouTubeLink } = await import('../utils/browser/youtube.ts');
  const id = 'dQw4w9WgXcQ';
  const canonical = 'https://www.youtube.com/watch?v=' + id;
  const cases = [
    ['full watch URL', canonical],
    ['non-www watch URL', 'https://youtube.com/watch?v=' + id],
    ['www host without scheme', 'www.youtube.com/watch?v=' + id],
    ['short URL', 'https://youtu.be/' + id],
    ['scheme-less short URL', 'youtu.be/' + id],
    ['short URL with trailing slash', 'youtu.be/' + id + '/'],
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
  assert.equal(parseYouTubeLink('youtu.be/' + id)?.videoId, id, 'direct parser must accept scheme-less short URL');
  assert.equal(parseYouTubeIntent('/watch?v=bad'), null, 'reject malformed video id');
  assert.equal(parseYouTubeIntent('/article?id=' + id), null, 'do not normalize arbitrary paths');
  assert.equal(parseYouTubeIntent('https://youtube.com.evil.example/watch?v=' + id), null, 'reject lookalike host');

  const root = path.join(__dirname, '..');
  const nativeIntent = fs.readFileSync(path.join(root, 'app/+native-intent.tsx'), 'utf8');
  const quickShare = fs.readFileSync(path.join(root, 'modules/maglev-engine/android/src/main/java/com/maglev/engine/share/QuickShareActivity.kt'), 'utf8');
  assert.ok(nativeIntent.includes('return stripShareMarker(internalPath)'), 'router must preserve the internal YouTube route');
  assert.match(nativeIntent, /parseYouTubeIntent\(raw\)\s*\?\?\s*parseYouTubeIntent\(internalPath\)/, 'router must accept full and path-only intent URLs');
  assert.match(quickShare, /maglev:\/\/youtube-download\?url=/, 'QuickShare must launch the direct internal download route');

  const browser = fs.readFileSync(path.join(root, 'app/browser.tsx'), 'utf8');
  assert.match(browser, /parseYouTubeIntent\(text\)/, 'browser paste must recognize YouTube URLs before generic navigation');
  assert.match(browser, /pathname: '\/youtube-download'/, 'browser paste must open the dedicated downloader screen');

  const youtubeAdapter = fs.readFileSync(path.join(root, 'modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/YoutubeDownload.kt'), 'utf8');
  const nativeModule = fs.readFileSync(path.join(root, 'modules/maglev-engine/android/src/main/java/com/maglev/engine/MaglevEngineModule.kt'), 'utf8');
  assert.ok(youtubeAdapter.includes('PLAYER_CLIENTS = listOf("web_safari", "android_vr", "web_embedded")'), 'extractor keeps explicit YouTube client fallback');
  assert.ok(youtubeAdapter.includes('playerClient != "generic"'), 'generic extraction does not force a YouTube player client');
  assert.ok(youtubeAdapter.includes('httpMediaUrl(rawUrl)'), 'generic extraction validates HTTP(S) page URLs');
  assert.ok(youtubeAdapter.includes('playerClient == "generic"'), 'generic page formats are tagged separately from YouTube clients');
  assert.ok(youtubeAdapter.includes('EngineHost.probeStream'), 'HLS/DASH formats must use Maglev stream engine');
  assert.ok(youtubeAdapter.includes('youtube:player_client='), 'selected format must be re-extracted with its original client');
  assert.match(nativeModule, /formatId: String, playerClient: String/, 'native bridge must carry the selected extractor client');
  assert.match(youtubeAdapter, /updateYoutubeDL\(app, YoutubeDL\.UpdateChannel\.STABLE\)/, 'adapter must update the stable yt-dlp binary');
  assert.match(youtubeAdapter, /UPDATE_INTERVAL_MS = 24 \* 60 \* 60 \* 1000L/, 'stable update checks must be throttled to daily');
  assert.match(youtubeAdapter, /RETRY_INTERVAL_MS = 6 \* 60 \* 60 \* 1000L/, 'failed update checks must retry later');
  assert.match(youtubeAdapter, /safeDiagnostic\(e\)/, 'extractor errors must surface a sanitized diagnostic');

  const nativeModuleSource = fs.readFileSync(path.join(root, 'modules/maglev-engine/android/src/main/java/com/maglev/engine/MaglevEngineModule.kt'), 'utf8');
  assert.ok(nativeModuleSource.includes('Native IO call failed:'), 'native IO failures must be logged with exception type');
  assert.ok(nativeModuleSource.includes('cause=${root.javaClass.name}'), 'native IO failures must expose the root cause type');
  assert.ok(nativeModuleSource.includes('root.message ?: root.javaClass.simpleName'), 'native IO failures must not collapse to generic Engine call failed');
  assert.ok(nativeModuleSource.includes('Regex("""https?://[^\\s]+""", RegexOption.IGNORE_CASE)'), 'native diagnostics must redact complete URLs including query tokens');
  const screen = fs.readFileSync(path.join(root, 'app/youtube-download.tsx'), 'utf8');
  assert.ok(screen.includes('maglevEngine.getYouTubeInfo'), 'YouTube screen must use the existing native extractor');
  assert.ok(screen.includes('maglevEngine.addYouTubeDownload'), 'selected formats must enter the shared native transfer queue');
  assert.ok(screen.includes('format.playerClient'), 'the selected extractor client must be preserved');
  assert.ok(!screen.includes('ytdlpEngine.download'), 'screen must not create a second standalone download queue');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(packageJson.dependencies?.['ytdlp-engine'], undefined, 'do not install a second yt-dlp Expo module/queue');
  assert.ok(!fs.existsSync(path.join(root, 'modules/ytdlp-engine')), 'the standalone duplicate prototype must stay out of the product tree');
  assert.ok(screen.includes('maglevEngine.addYouTubeDownload'), 'YouTube formats must be added through the existing Maglev queue');
  const addDownload = fs.readFileSync(path.join(root, 'app/add-download.tsx'), 'utf8');
  assert.ok(addDownload.includes('yt-dlp로 페이지 분석'), 'NOT_A_FILE pages expose explicit yt-dlp analysis');
  const browserScreen = fs.readFileSync(path.join(root, 'app/browser.tsx'), 'utf8');
  assert.ok(browserScreen.includes('yt-dlp로 페이지 분석'), 'browser page menu exposes explicit generic site analysis');
  assert.ok(browserScreen.includes('MPMux 사용 안내'), 'DRM/blob refusal offers MPMux information');
  assert.ok(browserScreen.includes('MPMux도 DRM을 복호화하거나 보호를 우회하지 못합니다'), 'MPMux is not described as a DRM bypass');
  assert.ok(!browserScreen.includes('decryptDrm') && !browserScreen.includes('widevineDecrypt'), 'no DRM decryption adapter is shipped');
  console.log('test-youtube-intents: all assertions passed');
}
main().catch((e) => { console.error(e); process.exit(1); });
