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
  const newPipe = fs.readFileSync(path.join(root, 'modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/NewPipeYoutube.kt'), 'utf8');
  const ytdlGradle = fs.readFileSync(path.join(root, 'modules/maglev-engine/android/build.gradle'), 'utf8');
  const poToken = fs.readFileSync(path.join(root, 'modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/potoken/NewPipePoTokenGenerator.kt'), 'utf8');
  assert.ok(newPipe.includes('info.dashMpdUrl'), 'NewPipe adaptive DASH manifest supplies selectable high-resolution formats');
  assert.ok(newPipe.includes('EngineHost.probeStream') && newPipe.includes('"audioId"'), 'selected video quality must mux a separate audio track in the existing queue');
  assert.ok(newPipe.includes('info.audioStreams'), 'audio-only choices must enumerate real NewPipe audio formats and bitrates');
  assert.ok(ytdlGradle.includes('NewPipeExtractor:v0.26.5'), 'use the same NewPipe extractor version as YTDLnis');
  assert.ok(poToken.includes('NewPipePoTokenGenerator') && poToken.includes('getWebClientPoToken'), "generate Web PO tokens to avoid YouTube's 360p-only fallback");

  assert.ok(youtubeAdapter.includes('PLAYER_CLIENTS = listOf("newpipe", "android_vr", "web_safari")'), 'fast NewPipe extraction is primary with two yt-dlp fallbacks');
  assert.ok(youtubeAdapter.includes('playerClient != "generic"'), 'generic extraction does not force a YouTube player client');
  assert.ok(youtubeAdapter.includes('httpMediaUrl(rawUrl)'), 'generic extraction validates HTTP(S) page URLs');
  assert.ok(youtubeAdapter.includes('playerClient == "generic"'), 'generic page formats are tagged separately from YouTube clients');
  assert.ok(youtubeAdapter.includes('EngineHost.probeStream'), 'HLS/DASH formats must use Maglev stream engine');
  assert.ok(youtubeAdapter.includes('youtube:player_client='), 'selected format must be re-extracted with its original client');
  assert.match(nativeModule, /formatId: String, playerClient: String/, 'native bridge must carry the selected extractor client');
  assert.match(youtubeAdapter, /private fun prepareYtDlp\(context: Context\)\s*\{\s*YoutubeDL\.getInstance\(\)\.init\(context\.applicationContext\)\s*\}/, 'interactive analysis must initialize the bundled yt-dlp without blocking on an update download');
  assert.ok(youtubeAdapter.includes('groupBy { it["formatId"].toString() }'), 'duplicate format IDs from different player clients must collapse to one row');
  assert.ok(youtubeAdapter.includes('formatId == "bestaudio"'), 'yt-dlp fallback still recognizes its bestaudio selector');
  assert.ok(youtubeAdapter.includes('availableFormats.filter'), 'audio fallback selects an actual audio-only format from the extractor metadata');
  assert.ok(youtubeAdapter.includes('NewPipeYoutube.get(app, sourceUrl)'), 'YouTube metadata uses the fast NewPipe extractor first');
  assert.ok(youtubeAdapter.includes('NewPipeYoutube.add(app, sourceUrl, formatId)'), 'NewPipe format selection is handled by the native adapter');
  assert.ok(youtubeAdapter.includes('--ffmpeg-location'), 'override the wrapper stale FFmpeg path when FFmpeg package is absent');
  assert.ok(youtubeAdapter.includes('YOUTUBE_AUDIO_FORMAT_UNRESOLVED'), 'audio-only must fail explicitly when yt-dlp did not resolve an audio-only requested format');
  assert.ok(youtubeAdapter.includes('YOUTUBE_AUDIO_URL_MISSING'), 'audio-only must not fall back to the default video URL');
  assert.ok(youtubeAdapter.includes('if (hasVideo) break'), 'metadata extraction must stop after a usable video client to avoid slow redundant client calls');
  assert.ok(youtubeAdapter.includes('"sizeEstimated" to (exactBytes == null && estimatedBytes != null)'), 'unknown extractor sizes must be estimated from bitrate and duration when possible');
  assert.ok(youtubeAdapter.includes('fallbackKbps = when'), 'missing bitrate must still get a labeled resolution-based estimate');
  assert.ok(youtubeAdapter.includes('height <= 360 -> 750.0') && youtubeAdapter.includes('height <= 1080 -> 5_500.0'), 'resolution fallback must cover common YouTube qualities');
  assert.ok(youtubeAdapter.includes('toFormat(format, client, current.duration)'), 'format size estimates must use the actual media duration');

  assert.ok(youtubeAdapter.includes('!hasVideo && hasAudio -> "audio"'), 'audio-only formats must be recognized even when exposed as a manifest');
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
  assert.ok(screen.includes("formatId: 'bestaudio'"), 'a bestaudio fallback remains available only when no real audio formats were extracted');
  assert.ok(screen.includes('audios.length > 0 ? audios : [audioFallback]'), 'real audio bitrate/format choices replace the placeholder selector');
  assert.ok(screen.includes('오디오만 · 최고 음질'), 'audio-only fallback label is Korean');
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
