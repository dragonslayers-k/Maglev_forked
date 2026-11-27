/**
 * Static contract checks for the native Media3 player integration.
 * These checks do not replace Android/Galaxy playback and PiP runtime tests.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const activity = read('modules/maglev-engine/android/src/main/java/com/maglev/engine/player/MaglevMediaPlayerActivity.kt');
const manifest = read('modules/maglev-engine/android/src/main/AndroidManifest.xml');
const gradle = read('modules/maglev-engine/android/build.gradle');
const watch = read('modules/maglev-engine/android/src/main/java/com/maglev/engine/watch/MaglevWatchModule.kt');
const bridge = read('modules/maglev-engine/src/MaglevNativeBridge.ts');
const types = read('modules/maglev-engine/src/MaglevEngine.types.ts');
const menu = read('components/browser/MediaMenu.tsx');
const hit = read('utils/browser/mediaHit.ts');
const browser = read('app/browser.tsx');

function check(name, fn) {
  try { fn(); console.log('ok   ' + name); }
  catch (e) { console.error('FAIL ' + name + '\n     ' + e.message); process.exitCode = 1; }
}

check('Media3 ExoPlayer, UI, HLS, DASH and OkHttp DataSource dependencies', () => {
  for (const dep of ['media3-exoplayer', 'media3-exoplayer-hls', 'media3-exoplayer-dash', 'media3-ui', 'media3-datasource-okhttp']) assert(gradle.includes(dep), dep);
  assert(gradle.includes('1.11.1'), 'Media3 version pinned');
});
check('player Activity is private and PiP-enabled', () => {
  assert(manifest.includes('.player.MaglevMediaPlayerActivity'));
  assert(manifest.includes('android:supportsPictureInPicture="true"'));
  assert(manifest.includes('android:exported="false"'));
  assert(manifest.includes('android:resizeableActivity="true"'));
});
check('native playback supports ExoPlayer media source factory and actual player view', () => {
  assert(activity.includes('ExoPlayer.Builder'));
  assert(activity.includes('DefaultMediaSourceFactory'));
  assert(activity.includes('PlayerView'));
  assert(activity.includes('setMediaItem(item)') && activity.includes('prepare()') && activity.includes('playWhenReady = true'));
  assert(activity.includes('OkHttpDataSource.Factory'));
});
check('PiP follows the actual player and video aspect ratio', () => {
  assert(activity.includes('enterPictureInPictureMode'));
  assert(activity.includes('onUserLeaveHint'));
  assert(activity.includes('onPictureInPictureModeChanged'));
  assert(activity.includes('setAutoEnterEnabled'));
  assert(activity.includes('videoSize.width') && activity.includes('videoSize.height'));
});
check('app-local WireGuard playback route fails closed when enabled', () => {
  assert(activity.includes('WireGuardController.mediaPlaybackProxy'));
  assert(activity.includes('builder.proxy(proxy)'));
  assert(activity.includes('Proxy-Authorization'));
  assert(activity.includes('127.0.0.1', 'closed proxy'));
  assert(watch.includes('playInAppMedia'));
});
check('typed bridge and browser media menu connect native playback', () => {
  assert(types.includes('playInAppMedia(url: string'));
  assert(bridge.includes('PictureInPictureModule.playInAppMedia'));
  assert(menu.includes("case 'play-video'"));
  assert(browser.includes('maglevEngine.playInAppMedia'));
});
check('media menu offers playback for direct, HLS and DASH links', () => {
  assert(hit.includes("id: 'play-video'"));
  assert(hit.includes("cls === 'direct' || cls === 'hls' || cls === 'dash'"));
});
console.log('test-in-app-player-contract: source contract only; physical playback/PiP remains unverified');
