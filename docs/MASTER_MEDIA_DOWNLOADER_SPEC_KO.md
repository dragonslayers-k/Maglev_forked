# Maglev+ 통합 미디어 다운로더 — 실행 기준서

> 버전 1.0.1 · 갱신일 2026-11-27 KST  
> **이 문서와 Issue #8이 현재 개발 기준점입니다. CI green, APK 생성, 코드 존재를 기능 합격으로 간주하지 않습니다.**

## 1. 제품 목표

Maglev+를 기존 Maglev의 torrent/direct/HLS/DASH/queue/storage/browser 기능을 보존하는 단일 Android 미디어 다운로더로 완성합니다. URL 공유·페이지 미디어 자동 감지 → 정보/포맷 선택 → 다운로드 → 무결성/컨테이너 검증 → 저장 → 앱 재생·PiP·백그라운드까지 end-to-end로 연결합니다.

핵심 기준:
- 기존 Maglev 기능 회귀 금지. 모든 엔진은 기존 Transfers와 저장/알림/재시도/복구 모델을 사용합니다.
- 앱에 표시되는 기능은 실제 동작 경로와 테스트가 있어야 합니다. placeholder, 감지만 되는 UI, unsupported 안내를 구현 완료로 표시하지 않습니다.
- 사용자 권한이 있는 콘텐츠의 정상적인 미디어 접근·저장만 지원합니다. DRM/access-control을 해제하거나 우회하는 기능은 구현하지 않습니다.
- 원본 Maglev main baseline을 보호합니다. 통합 개발은 PR #1의 단일 작업 트랙과 Issue #8의 순서에 따릅니다.

## 2. 현재 상태 / 2026-11-27 재평가

**#707: CI PASS, 사용자 Galaxy 기능 FAIL. 최종/Release 불가.**

- Workflow: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45998561035
- Commit: 2ed8d64af6cb98c7f132006352b661cde14c36fc
- APK artifact: apks, ARM64 APK 63,671,711 bytes
- APK SHA-256: 5de8fbdfab25e5bb5de55001b07cbd5b331ae9526c2489f497df304701fdbf9d
- CI artifact SHA-256 digest: 1025fe7b1dc4c62264a01ee198202cd33f3764766f33328a8ad85ec1560a8d1a
- Signing: CI 로그의 apksigner 검증 성공, Android debug certificate. Release signing 아님.
- app.json/package.json 기준 app version 0.33 / base versionCode 33. ABI suffix 검증값 334. README의 version 0.34 표기는 정정 대상.
- 사용자 설치 결과: browser recording unsupported; direct URL/HLS/DASH 수동 입력을 안내; PiP 미작동/불안정; 미디어 재생 실패; WireGuard 기능 개선 없음. 사용자 검증을 CI 결과보다 우선하여 FAIL 처리.

## 3. 현재 코드 사실과 Gap

### Browser/media discovery
- PageScan.kt는 DOM, fetch/XHR, Resource Timing, MIME, HLS/DASH 후보 및 MSE 사용 여부를 관찰합니다.
- MSE hook은 MediaSource.addSourceBuffer / SourceBuffer.appendBuffer 호출을 표시하는 관찰용 hook입니다. 현재 실제 media byte capture, segment byte persistence, ordering, mux/finalize가 구현됐다고 볼 증거가 없습니다.
- 발견된 직접 URL·M3U8·MPD는 개별 resolver/downloader 경로를 이용할 수 있지만 이것은 브라우저 녹화와 같지 않습니다.
- Blob/MSE를 후보로 분류하는 것만으로 다운로드 가능한 media source를 얻었다고 처리하지 않습니다.

### Playback / PiP
- 현재 PiP 진입은 WebView의 실제 재생 중 HTML video를 찾아 fullscreen을 요청하고, Android WebChromeClient의 fullscreen custom view를 이용해 PiP로 전환하는 구조입니다.
- player가 iframe/custom UI/MediaSource/WebView fullscreen 지원을 하지 않으면 경로가 실패할 수 있습니다. 사용자 보고가 FAIL이므로 현재 구현은 합격이 아닙니다.
- 별도 native playback/PiP lifecycle의 실기기 검증 증거가 없습니다. Manifest PiP 설정은 플레이어 동작을 보장하지 않습니다.

### App-local WireGuard
- 현재 구현은 userspace WireGuard + loopback HTTP proxy / WebView Proxy Override입니다. Android system-wide VPN/TUN VpnService가 아닙니다.
- proxy ready, peer handshake, tunneled HTTP request, exit-IP 확인을 별도 상태로 표시해야 합니다. running/enabled만으로 VPN 연결 성공이라 표현하지 않습니다.
- WebView와 downloader가 각각 실제 proxy를 사용했는지 Galaxy에서 검증되지 않았습니다. 사용자 보고 FAIL.

## 4. Target architecture

~~~
URL / Share / Browser
       |
 Media Intake + Discovery
       |-- DOM + media tags
       |-- Network metadata (fetch/XHR/Resource Timing)
       |-- ServiceWorker / WebView request observation
       |-- Direct MP4/WebM
       |-- HLS/M3U8 & DASH/MPD
       |-- MSE/Blob (observe first; capture only with supported byte path)
       |
 Media Resolver + Capability Registry
       |
 Download Orchestrator / Persistent Transfers
       |-- Maglev existing direct/torrent
       |-- HLS/DASH VOD/live adapter
       |-- yt-dlp adapter
       |-- Range/resume/parallel scheduler
       |
 Verify -> mux/remux -> Storage commit
       |
 Media playback (Media3/native player) + MediaSession
       |-- background audio
       |-- PiP
       |-- playback/download shared cache where safe
~~~

모듈 간 직접 구현 종속 금지: 공통 task/result contract, capability-based routing, storage/queue ownership은 중앙 orchestrator에 둡니다.

## 5. 단계별 작업 순서 (게이트 통과 전 다음 단계 금지)

### G0 — Repository baseline / cleanup
- 원본 main/upstream SHA 보존, 기존 PR 코드/branch를 삭제하지 않고 inventory 및 archive/close.
- PR #1 하나를 기능 통합 PR로 유지, Issue #8을 단일 acceptance tracker로 유지.
- 문서의 version/branch/CI/status를 실제 manifest와 맞춤.
- PR이 중첩되어 같은 기능을 여러번 CI/build하지 않도록 정리.

### G1 — Engine + basic media playback
- native engine init 오류를 단계별로 분리: library load → JNI → config → engine ready → real transfer.
- direct MP4/WebM를 앱 player에서 실제 재생; pause/seek/volume/orientation/return/resume.
- 미디어 다운로드 파일의 MIME/extension/signature/codec/container 검증.
- Android Media3 player / DataSource adapter 결정, 기존 Maglev playback/download 회귀.

### G2 — Browser playback + PiP
- 재생 중 실제 player/video surface와 lifecycle을 기준으로 PiP 진입.
- WebView fullscreen callback과 PiP transition의 race/Surface recreation 처리.
- PiP 창에는 영상 surface만 보이고 toolbar/tab/modal이 겹치지 않음.
- foreground/background, screen lock, rotation, return-to-app, media end, audio focus.
- Galaxy acceptance: 실제 MP4, HTML5 player, iframe player(지원 범위) 3개 유형.

### G3 — Media detection
- 자동 감지를 수동 URL 입력보다 우선.
- DOM video/source, fetch/XHR response headers, Resource Timing, ServiceWorker, MIME, extensionless URLs, referer/cookies (허용되는 request context).
- HLS/DASH manifest는 variant/audio/subtitle tracks를 분류; segment URL을 별도 media 후보로 중복 노출하지 않음.
- 정확한 title, duration, resolution, bitrate, size/estimated flag, file type.
- cross-site test matrix. Naver Clip은 단일 special-case test로 취급.

### G4 — Download / HLS-DASH
- direct Range 206/Content-Range validation, ETag/Last-Modified resume, single-stream fallback, concurrency/merge integrity.
- HLS VOD/live: master/media playlist, variants, audio/subtitles, segment ordering, discontinuity, encryption where supported, recording finalization.
- DASH VOD: MPD representations, init/media segments, separated audio/video, mux and verify.
- Queue pause/resume/retry/cancel/restart recovery and storage commit.
- No item marked complete until actual playable file is produced and tested.

### G5 — MSE capture (supported non-protected streams)
- Current MSE detection is observation-only; implement capture only as a distinct byte pipeline.
- Capture supported media initialization and media segment bytes with bounded memory, ordering, metadata and timestamps; stream to temp storage, not unbounded JS memory.
- Detect when source is not capturable and give truthful unsupported reason. Do not imply capture or offer fake download.
- Assemble/mux only supported, non-protected media; validate output signature, duration, tracks and playback.
- Tests: byte sequence/order, missing init segment, duplicate append, quota/abort, navigation, memory pressure, finalization, partial failure/recovery.

### G6 — YouTube / extractor runtime
- Separate adapter/runtime and version/ABI checks, metadata/format selection, audio/video track routing, merge, subtitles and queue.
- Exact Galaxy test for share/paste, metadata, format selection, download, output and playback.
- Current YouTube support must not be assumed complete from parser tests.

### G7 — App-local WireGuard
- Secure profile store, hostname Endpoint DNS, IPv4/IPv6, MTU/AllowedIPs and lifecycle.
- Peer handshake timestamp/RX-TX, proxy health, browser proxy applied, downloader proxy applied, actual HTTPS egress are distinct.
- Browser and download clients each need a route test. Fail closed, no direct fallback.
- If user expects system-wide VPN, that is a separate VpnService scope and must not be mislabeled app-local proxy.

### G8 — Integrations / polish
- Barrel Smart Connect, LJ-style request context/site adapters, MPMux Range/HLS/MSE features, subtitles, format conversion.
- Korean localization, accessibility, filenames, notifications, settings and About/reference.
- Upstream monthly review only, selective integration and regressions.

## 6. Definition of done (required evidence)

| Test | Pass condition |
|---|---|
| URL/Share | external share and paste route into correct media analysis |
| Browser playback | target media actually plays and controls work |
| PiP | video visible and continuous; return restores state |
| Detection | several unrelated sites; no false-positive segment rows |
| Direct download | real file saved, integrity and playable |
| HLS/DASH | manifest/track selection, one valid output, playback |
| MSE | captured bytes and assembled output, not merely “MSE seen” |
| YouTube | metadata + formats + selected transfer + output + playback |
| WG | handshake + proxy request + egress proof; browser/downloader tested separately |
| Korean | full visible UI/errors/notifications reviewed |
| Regression | Maglev torrent/direct/queue/storage/history unaffected |
| Release | CI green for exact commit; APK verified package/version/ABI/signing/hash; device acceptance evidence |

## 7. CI policy

CI #707 automated success is a build-quality gate, not runtime acceptance. Add/maintain tests that check real outputs rather than code presence. APK upload must be conditional on blocking jobs passing. Device tests are a separate explicit gate and must report not run if no physical device is available.

CI artifact in #707 was debug-signed. Do not distribute it as Release. Version source is app.json/package.json; README must not drift.

## 8. Repository governance

- main: upstream baseline only.
- dev: integration target, but no divergence until PR-approved.
- **Active implementation:** PR #1 branch feature/p1-video-detection-observer.
- **Active tracker:** Issue #8.
- Close stacked/failed PRs when code is preserved and rework is folded into #1. Keep branch pointers until explicit branch cleanup can be performed.
- Workflows: keep one CI, one tag/manual Release workflow, one monthly upstream review. Remove duplicates only after confirming no dependency/trigger.
- PR body must carry checklist + CI artifact + device status; issue updates with evidence. No “final” label without all critical checks.

## 9. Immediate execution order

1. Stop merging PR #7/#9: their tested runtime changes did not fix the user's symptoms. Preserve branch commits, close the stacked PRs, and rework on PR #1.
2. Fix browser capture contract: UI says unsupported because byte capture/finalization is not implemented. Add feature flag only after real byte path and file tests.
3. Fix playback before PiP. Establish a reliable native/Media3 player and media source; use it for downloaded/direct files.
4. Fix PiP as a player lifecycle feature, not an arbitrary WebView fullscreen shortcut.
5. Build cross-site detection/download matrix.
6. WireGuard is a separate gate; stop claiming connected from local proxy running.
7. Final candidate only after all critical Galaxy tests; signed Release and version update.

## 10. Source reference and full research report

The detailed research report delivered separately is the supporting research record. This file is the shorter implementation baseline and current acceptance authority. Update this document and Issue #8 together whenever status changes.


## 11. Implementation update — native player first (2026-11-27)

A native playback path has been added on the active PR #1 branch, pending exact-commit CI:
- AndroidX Media3 1.11.1 dependencies: ExoPlayer, UI, HLS, DASH, OkHttp DataSource.
- Native MaglevMediaPlayerActivity and typed Expo bridge; direct URL, content/file URI, HLS and DASH source factory.
- Browser long-press media menu adds “앱에서 재생” for resolvable direct/HLS/DASH URLs. Request cookies, Referer/Origin and page User-Agent are forwarded when available.
- Native PiP uses actual Media3 player/video size, activity PiP and auto-enter support. This is distinct from WebView's existing fullscreen-PiP path.
- Media3 requests use the app-local WireGuard authenticated proxy when enabled; enabled-but-not-ready returns a closed proxy instead of direct routing.
- This is a code-level prototype. No Galaxy playback/PiP test has passed. Background MediaSession service, media queue, MSE byte capture, and browser-native capture remain unimplemented.
- CI #720 typecheck failed due two syntax mistakes; #722 player source contract failed because the test expected a different proxy call form; both were corrected. #723 JS/contract jobs passed but the run was cancelled by the next push before Rust/Android/APK completion. CI #724 for the latest commit is in progress.
- Do not mark playback/PiP complete until a test file and a direct URL/HLS/DASH are played on Galaxy, PiP video remains visible, return-to-app works, and app-local WG egress is verified separately.

Media3 version reference: https://developer.android.com/jetpack/androidx/releases/media3 (stable 1.11.1 as checked 2026-11-27).
