const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const scan = fs.readFileSync(path.join(root, 'modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/PageScan.kt'), 'utf8');
const browser = fs.readFileSync(path.join(root, 'modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/MaglevBrowserView.kt'), 'utf8');
const pipNative = fs.readFileSync(path.join(root, 'modules/maglev-engine/android/src/main/java/com/maglev/engine/watch/MaglevWatchModule.kt'), 'utf8');
const pipUi = fs.readFileSync(path.join(root, 'app/browser.tsx'), 'utf8');
const pipTypes = fs.readFileSync(path.join(root, 'modules/maglev-engine/src/MaglevEngine.types.ts'), 'utf8');
const required = [
  'mseSeen = false, mseSent = false',
  'MediaSource.prototype',
  'ms.addSourceBuffer',
  'SourceBuffer.prototype',
  'vs.appendBuffer',
  'post({ items: list, blob: blob, mse: mse })',
  'o.optBoolean("mse", false)',
  'val mse: Boolean',
];
for (const needle of required) {
  if (!scan.includes(needle)) throw new Error('PageScan MSE observer contract missing: ' + needle);
}
if (!browser.includes('if (report.mse)') || !browser.includes('onPageNote(mapOf("note" to "mse"))')) {
  throw new Error('Browser UI event path does not surface MSE detection');
}
if (!pipNative.includes('requestedAspectRatio: Double') || !pipNative.includes('requestedAspectRatio.coerceIn(0.42, 2.39)')) throw new Error('Native PiP does not accept/clamp video aspect ratio');
if (!pipUi.includes('enterBrowserPictureInPicture(aspectRatio)') || !pipUi.includes('video.width! / video.height!')) throw new Error('Browser PiP does not pass detected video aspect ratio');
if (!pipTypes.includes('enterBrowserPictureInPicture(aspectRatio: number)')) throw new Error('PiP aspect ratio is missing from native TypeScript contract');
if (!browser.includes('fullscreenPipButton') || !browser.includes('setAutoEnterEnabled(autoEnter)') || !browser.includes('activeVideoAspectRatioKnown')) throw new Error('Fullscreen video does not expose intrinsic-ratio PiP and auto-enter');
if (!scan.includes('explicitMime') || !scan.includes('explicitType') ||
    scan.includes('videoplayback|video|videos|media|stream|segment|chunk')) {
  throw new Error('MSE candidates still use broad opaque-URL keyword matching');
}
if (!browser.includes('youtubeAdScript') || !browser.includes('ytp-ad-skip-button') ||
    !browser.includes('ytd-display-ad-renderer')) {
  throw new Error('YouTube ad surface/skip-button handler is missing');
}
if (!pipNative.includes('MaglevBrowserView.measureActiveVideoForPip') ||
    !pipNative.includes('activity.enterPictureInPictureMode(params)') ||
    !pipNative.includes('PIP_DENIED') || !pipNative.includes('VIDEO_NOT_FOUND') ||
    !pipNative.includes('activity.runOnUiThread')) {
  throw new Error('Browser-menu PiP must validate active video and enter Android Activity PiP directly');
}
if ((!browser.includes('v.getClientRects().length > 0') && !browser.includes('v.getClientRects().length>0')) ||
    (!browser.includes("s.visibility !== 'hidden'") && !browser.includes("s.visibility!=='hidden'")) ||
    !browser.includes('setSeamlessResizeEnabled(true)') ||
    !pipNative.includes('activity.enterPictureInPictureMode(params)') ||
    !pipNative.includes('if (!MaglevBrowserView.fullscreenVideoActive)') ||
    !pipNative.includes('MaglevBrowserView.measureActiveVideoForPip') ||
    !pipNative.includes('PIP_DENIED') ||
    !browser.includes('private fun measureActiveVideoForPipInternal') ||
    !browser.includes('!v.paused&&!v.ended&&v.readyState>=2')) {
  throw new Error('Browser-menu PiP must enter the Activity directly instead of relying on a synthetic fullscreen gesture');
}
// Regression guard for Samsung/WebView black PiP: attach the untouched custom media
// view at the Activity window root, not android.R.id.content, and do not paint over it.
if (!browser.includes('val decor = activity.window.decorView as ViewGroup') ||
    !browser.includes('decor.addView(container, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))') ||
    !browser.includes('customViewHost = decor') ||
    browser.includes('view.setBackgroundColor(Color.BLACK)') ||
    browser.includes('val contentRoot = activity.findViewById<ViewGroup>(android.R.id.content)')) {
  throw new Error('PiP custom video view must remain untouched and attached to the Activity decor root');
}
const pipModule = fs.readFileSync(path.join(root, 'modules/maglev-engine/android/src/main/java/com/maglev/engine/MaglevEngineModule.kt'), 'utf8');

if (!pipUi.includes('videos.sort((a, b) => ((b.width ?? 0) * (b.height ?? 0))')) {
  throw new Error('PiP fallback does not select the largest known video');
}
const mediaMenu = fs.readFileSync(path.join(root, 'components/browser/MediaMenu.tsx'), 'utf8');
const mediaHit = fs.readFileSync(path.join(root, 'utils/browser/mediaHit.ts'), 'utf8');
if (!mediaMenu.includes("case 'analyze-page'") || !mediaHit.includes("id: 'analyze-page'") ||
    !pipUi.includes("onAnalyzePage={(pageUrl) => router.push({ pathname: '/youtube-download', params: { url: pageUrl } })}")) {
  throw new Error('Blob/MSE page analysis is not connected to the extractor route');
}
console.log('PASS: MSE observation and fullscreen-video PiP contract');
