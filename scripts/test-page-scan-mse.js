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
if (!pipNative.includes('MaglevBrowserView.requestFullscreenVideoForPip') || !pipNative.includes('"pending" to true')) throw new Error('Inline video PiP does not request a fullscreen video surface before entering PiP');
if (!browser.includes('pipPendingFromBrowserMenu') || !browser.includes('v.requestFullscreen') || !browser.includes('.ytp-fullscreen-button')) throw new Error('Browser PiP cannot promote an inline player to its fullscreen video surface');
if (!pipUi.includes('(result as any).pending !== true')) throw new Error('PiP UI announces success before the native pending transition completes');
if (!scan.includes('explicitMime') || !scan.includes('explicitType') ||
    scan.includes('videoplayback|video|videos|media|stream|segment|chunk')) {
  throw new Error('MSE candidates still use broad opaque-URL keyword matching');
}
if (!browser.includes('youtubeAdScript') || !browser.includes('ytp-ad-skip-button') ||
    !browser.includes('ytd-display-ad-renderer')) {
  throw new Error('YouTube ad surface/skip-button handler is missing');
}
if (!browser.includes('v.getClientRects().length > 0') ||
    !browser.includes("s.visibility !== 'hidden'") ||
    !browser.includes('setSeamlessResizeEnabled(true)') ||
    !browser.includes('requestFullscreenVideoForPipInternal(requestedAspectRatio, onResult)') ||
    !pipNative.includes('MaglevBrowserView.requestFullscreenVideoForPip(requestedAspectRatio)')) {
  throw new Error('PiP does not validate visible video and pass ratio through native promotion');
}
if (!browser.includes('pipRequestResult: ((Boolean) -> Unit)? = null') ||
    !browser.includes('resolvePipRequest(true)') ||
    !browser.includes('resolvePipRequest(false)') ||
    !browser.includes('Do not report success yet')) {
  throw new Error('PiP reports success before WebChromeClient attaches a fullscreen surface or has no timeout failure');
}
if (!browser.includes('window.__mgYtAdObserverInstalled') ||
    !browser.includes('if(window.__mgYtAdObserverInstalled)return')) {
  throw new Error('YouTube ad observer can be injected repeatedly and accumulate observers/timers');
}

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
