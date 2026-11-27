# CI #707 및 Galaxy 실기기 실패 분석 — 2026-11-27

## 1. 결론

- CI #707 success; all blocking CI jobs and APK build passed.
- User installed the #707 APK and reported no meaningful feature improvement. Browser recording unavailable, direct URL/HLS/DASH manual paths only, PiP unreliable, media playback fails, WireGuard improvement not observed.
- Therefore #707 is a failed product acceptance candidate, not a release candidate.
- CI is testing compilation, static/contract/unit tests and native build; it does not run actual browser playback, MSE byte recording, PiP video continuity, or Galaxy tunnel egress tests.

## 2. CI evidence

- Workflow: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45998561035
- Commit: 2ed8d64af6cb98c7f132006352b661cde14c36fc
- All jobs success: Contract tests; Rust tests (no JNI); JS checks/typecheck/unit/assistant eval; ABI plan; ARM64 native build; APK build.
- APK artifact: apks / ARM64; 63,671,711 bytes.
- APK SHA-256 (downloaded and locally computed): 5de8fbdfab25e5bb5de55001b07cbd5b331ae9526c2489f497df304701fdbf9d.
- Artifact ZIP digest: 1025fe7b1dc4c62264a01ee198202cd33f3764766f33328a8ad85ec1560a8d1a.
- Build logs verify APK signature and versionCode 334; it is signed with Android debug certificate, not release keystore. Do not publish as Release.
- app.json/package.json version 0.33 / base versionCode 33; ABI encoded versionCode 334. README 0.34 mismatch must be corrected.
- Locally inspected archive contains ARM64 native libs and classes.dex; no installed-device runtime can be simulated from APK.

## 3. User-reported failures and source findings

### 3.1 Browser recording
Observed by user: “브라우저 녹화는 아직 지원되지 않습니다. 직접 미디어 주소나 HLS/DASH를 확인하세요.”

Confirmed source gap: PageScan observes DOM/network/MIME and MSE use. Its MSE wrapper only marks addSourceBuffer / appendBuffer observation; comments explicitly say it does not consume/replace media bytes. No complete capture → ordered segment storage → finalization → mux → output validation path was confirmed. The current notice is therefore honest, but the feature requirement is unfulfilled.

Fix: Implement a bounded streaming byte capture subsystem for supported non-protected sources, separate from detection. Track source ID, MIME/container, init segment, ordered media chunks, timing, append success/abort, and storage temp file. Finalize only after a validated complete capture; otherwise expose an exact limitation. Add unit tests and file-level output tests.

### 3.2 PiP
Confirmed source: app/browser.tsx calls native PiP request. Native request scans visible, actively playing HTML video and tries player fullscreen control / requestFullscreen / webkitEnterFullscreen. Android enters PiP after WebChromeClient fullscreen custom view is attached and delayed layout. This depends on site/player-specific fullscreen behavior and WebView Surface lifecycle.

Observed by user: still does not work properly.

Fix: Stop using WebView fullscreen as the sole playback/PiP implementation. Implement/verify a real player path for direct media and download outputs using Media3/Android media session; PiP belongs to that player lifecycle. For in-page WebView playback, keep a separately tested adapter; do not claim universal PiP. Tests: inline→fullscreen→PiP→return, Surface continuity, portrait/landscape, screen-off, app background, audio focus, player end, navigation, Samsung Galaxy.

### 3.3 Playback
Observed: media playback not working/accepted.

Gap: No separate app-level Media3 playback screen/implementation path was found in the inspected source paths; browser PiP code relies on WebView's HTML video fullscreen. Treat this as a missing/insufficient playback acceptance layer, not a cosmetic UI issue.

Fix: Establish player implementation and DataSource for direct URLs, completed files, partial files and HLS/DASH as supported. Start with a known test MP4 (local), then direct HTTP MP4, then HLS VOD, then DASH. Validate file/container/codec before playback. Add play/pause, seek, audio focus, orientation, notification/media session, background and PiP. Do not proceed to MSE capture/live until baseline playback passes.

### 3.4 WireGuard
Confirmed architecture: userspace WireGuard engine + authenticated loopback HTTP proxy + AndroidX WebView Proxy Override. Not Android system VPN. Local engine/proxy running does not prove remote peer handshake or successful tunneled request.

Observed: #707 user sees no functional improvement.

Fix: Instrument separate statuses: native init, local listener, peer latest handshake, peer RX/TX, proxy auth, WebView proxy applied, downloader proxy applied, real HTTPS egress. Test browser and downloader independently. Do not label “connected” from toggle/proxy alone. DNS endpoint, AllowedIPs, keys, UDP and route are diagnosed using sanitized evidence. Fail-closed.

## 4. Earlier CI failures (recurring pattern)

| Run | Failure | Corrective change | Remaining risk |
|---|---|---|---|
| #620 | Kotlin MethodTooLargeException: MaglevEngineModule.definition() | split module registration | compile fixed, not runtime |
| #645 | unresolved Log import in WG controller | import added | compile only |
| #646 | IPv6 gVisor integration test hung on stack close | test changed to config/route assertions | IPv6 runtime TCP not tested |
| #706 | TestConcurrentTrafficAndLifecycle 2-min timeout, gVisor/TCP close lifecycle under concurrent traffic | PR #9 reduced stress and disabled keepalive | CI now green, but test no longer proves high-load shutdown robustness |
| #707 | automated suite/build all pass | APK produced | user-facing functionality still failed |

Other repeated test failures in earlier runs were stale assertions after Korean copy/UI changes; tests were corrected to source expectations rather than validating runtime behavior. This is a weakness in contract tests: they sometimes track implementation text instead of feature outcome.

## 5. Corrective work priorities

P0 — do not feature-stack until playback baseline:
1. Engine native startup + real basic direct download.
2. Native player (Media3) local file and direct MP4 playback.
3. PiP/MediaSession lifecycle and Galaxy acceptance.
4. Browser MSE capture bytes + playable output (supported non-protected cases).
5. Cross-site discovery → source resolution → download output validation.
6. HLS/DASH VOD; live recording after VOD is stable.
7. WireGuard route/handshake/egress checks as separate gate.
8. YouTube extractor, format selection, merge, playback.
9. Korean strings and regression.
10. Barrel/MPMux/LJ feature parity last.

## 6. Repository/PR/workflow cleanup

### PR consolidation
- PR #1 remains the single implementation/integration PR.
- PR #7 (app-local WireGuard routing) and #9 (test timeout adjustment) are stacked branches and did not deliver accepted user-facing improvement. Close both as blocked/superseded for rework, preserve source branches/commits, and move actionable tasks into Issue #8/PR #1. Do not merge them.
- PR #3/#5 already closed/superseded. No need reopen.
- Issue #8 becomes the sole active runtime acceptance tracker. Close Issue #6 as duplicate and link to #8; preserve its detailed requirements in the new tracker.

### Branches
Current inventory: main, dev, feature/p1-video-detection-observer, development/video-detection, fix/arm64-only-apk-delivery, fix/ci-wireguard-test-timeout, fix/wg-peer-handshake-status, fix/youtube-share-deeplink, fix/ytdlp-stable-auto-update.

Canonical:
- main: upstream Maglev baseline, no feature commits.
- dev: integration target, currently identical to main.
- feature/p1-video-detection-observer: sole active implementation branch / PR #1.
- all other feature/fix branches: archive-only until cherry-picked/reviewed, no new commits.

The available GitHub connector exposes branch listing/creation/ref updates but no branch-delete operation. I cannot physically delete stale branch refs with this connector; leave them intact rather than risk deleting source commits. The user can delete listed archive branches in GitHub UI after confirming they are no longer needed.

### Workflows
Three workflows on active feature branch:
1. .github/workflows/ci.yml: keep as the sole CI/build validation; it builds ARM64 APK only after blocking tests/native build pass.
2. .github/workflows/release-apk.yml: keep, tag/manual release only. Debug-signed artifacts must fail release acceptance.
3. .github/workflows/monthly-upstream-review.yml: keep; monthly review is useful, but issue creation should deduplicate and its generated review is advisory, not auto-merge.

No redundant workflow is identified for deletion from the active feature branch. Add emulator/device acceptance separately; do not make a green build falsely represent runtime acceptance.

### Issues
- #8: canonical, update to the actual status and ordered gates.
- #6: duplicate, close after linking to #8.
- No automatic closure of unrelated upstream issues.

### Releases
Release assets/tags cannot be fully enumerated with the available GitHub connector. No Release is authorized based on #707. Do not create or publish a release. Check Releases page manually before final cleanup.

## 7. Developer directive

Work only on the active PR #1 branch, and only one gate at a time. Before each change inspect the source + prior failed logs. After commit, wait for the exact CI run, inspect all jobs/logs/artifacts/signature/version/hash. Do not request another user installation until the APK contains the intended runtime feature and internal validation has passed. Report honestly: implemented / automated-tested / APK-built / emulator-tested / Galaxy-tested / accepted are separate states.


## 8. Native Media3 playback prototype added after #707

- Commit series on active PR #1: new native Media3 Activity, ExoPlayer/UI/HLS/DASH/OkHttp DataSource dependencies, PiP params based on actual video aspect ratio, Expo bridge, browser long-press “앱에서 재생” action, MIME hinting, and WireGuard proxy/fail-closed route for Media3 requests.
- Current intended path: browser long press a direct/HLS/DASH source → app Media3 player → actual playback controls → PiP. Cookie/Referer/Origin/User-Agent headers are forwarded when available.
- CI #720 failed TypeScript syntax; corrected. #722 failed a newly added static player contract assertion; corrected. #723 JS/contract passed but run was cancelled before native/APK jobs by the next push. CI #724 is the latest commit's validation run.
- **Not verified:** Android Gradle compile, install, actual Media3 playback, PiP surface continuity, background MediaSession, WebView PiP, MSE byte capture, and Galaxy WireGuard egress.
- Media3 stable 1.11.1 reference: https://developer.android.com/jetpack/androidx/releases/media3.
