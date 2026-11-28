# Finalization tracker — 2026-11-28

This tracker follows the recovery rule: keep the user-approved #702 APK/source as the comparison baseline; do not promote unverified changes to main/dev or a release.

## Accepted working baseline

- User-confirmed APK: CI #702, version 0.33, ARM64.
- Commit: `45e685603a3a23507b61cb49398a78380d5db7a5`
- SHA-256: `065d29dfcb19ad630c6bc906bfadecb2bd31395edc707ad3e35cf1f54b10c2de`
- Recovery branch: `recovery/2026-11-28-user-baseline-702`
- WireGuard and YouTube download: user reports recovered and working; preserve these paths while changing adjacent browser/media features.

## Current selective change

PR #10 is a draft and targets the recovery baseline, not main/dev:
https://github.com/dragonslayers-k/Maglev_forked/pull/10

- YouTube format selection reconciliation and contract coverage.
- Browser long-press media detection now walks nested elements and shadow-root hosts, to catch media in custom-player wrappers.
- Regression test added for nested video detection.
- Earlier CI #742 passed before the latest media-detection commits. Latest commits require a fresh CI run and device verification; do not call them validated until that happens.

## Remaining work, in priority order

1. **Media detection reliability:** test direct MP4/WebM, HLS (.m3u8), DASH (.mpd), lazy-loaded sources, custom/shadow-DOM players, and pages whose player uses blob/MSE. Improve scan refresh and source selection without breaking ordinary links or the download tray.
2. **PIP:** verify actual native Android PiP lifecycle on Samsung and other Android versions: enter from playing video, preserve playback/audio, handle exit/resume, and recover cleanly on failure. A detected media item alone must not imply the page is currently playing.
3. **Playback and download flow:** ensure detected streams reach the existing quality/audio selector and transfer queue, with headers/user-agent preserved; test pause/resume/retry.
4. **Recording/capture message:** browser recording is not currently supported. Do not describe blob/MSE or DRM as recordable unless a tested implementation exists. For opaque MSE, offer a useful detection/analyze/download fallback where the source is extractable; DRM remains out of scope.
5. **Korean localization and UI:** audit remaining user-visible strings, especially unsupported/failure states and media/PiP controls.
6. **Repository hygiene:** keep one recovery baseline, scoped draft PRs, meaningful commit titles, CI evidence and APK hashes; do not bulk-merge PR #1 or delete historical recovery branches/artifacts without explicit approval.
7. **Release gate:** run full CI, inspect job logs and artifact, verify APK signing/version/ABI, install on device, and complete the user acceptance checklist before merging or publishing.

## Device acceptance checklist

- [ ] WireGuard connect/disconnect, reconnect and background behavior unchanged.
- [ ] YouTube video quality selection, audio-only quality, container choice and real transfer work.
- [ ] Direct video and HLS/DASH are detected and can be downloaded.
- [ ] Custom-player/shadow-DOM long press identifies the correct video.
- [ ] PiP enters, continues playback, exits and returns to browser without stuck compact UI.
- [ ] Korean strings and error messages are complete and accurate.
- [ ] CI and release artifact are verified; no untested commit promoted to baseline.


## Latest CI failure and correction (2026-11-28)

- CI #774 run https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46111565801: Rust tests, contract tests, ABI plan and ARM64 native build passed; JS unit/contract tests failed in `scripts/test-page-scan-mse.js`. APK build was skipped.
- Root cause: the regression test still required the superseded synthetic fullscreen handoff (`requestFullscreenVideoForPip`, `pipPendingFromBrowserMenu`, and the old pending callback), while the current native path validates the active visible playing video and directly calls Android Activity PiP.
- Corrected the regression contract in commit `b890479c51f8548c5c1d8facbba6aa349edb3a57`; it now checks direct Activity PiP entry and active-video validation. Awaiting a fresh CI run on this head.
- This is a test-contract correction, not proof of Galaxy runtime PiP. Keep #702 baseline, PR #10 Draft, and release gate unchanged.


## Latest follow-up — CI #777 and blueprint reconciliation (2026-11-28)

- Latest source head before this tracker-only update: `11db5fa9583865593ec5f031bc9c8009fc569b20`.
- CI #777: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46113115786. ABI plan passed; Contract tests, JS checks, Rust tests and ARM64 native build were in progress at tracker update. No APK/build or device success claimed yet.
- #774 failure log pinpointed stale test assertion at `scripts/test-page-scan-mse.js:29`: it still required `requestFullscreenVideoForPip` and pending fullscreen promotion. Current branch had already switched to direct Activity PiP with active-video validation. Contract test was corrected in `b890479c51f8548c5c1d8facbba6aa349edb3a57`; UI stale pending success handling was removed in `11db5fa9583865593ec5f031bc9c8009fc569b20`.
- Compared V2 with the Library's latest `통합 미디어 다운로더 총괄 개발 가이드.md` and `통합_미디어_다운로더_전수조사_종합_설계기준서.md`: V2 remains consistent on one shared MediaIntake/Candidate/Task pipeline, browser observer rather than unsupported “recording” placeholder, active video native PiP, Korean-first subtitle provider adapters, user-supplied/licensed lyrics, and strict release/device gates. The newer comprehensive guide expands unified media identity, shared queue, session/header scoping, engine-specific proxy adapters and Galaxy E2E acceptance; these are incorporated as execution priorities rather than claiming implemented.
- Next execution order after CI: (1) get a fresh signed ARM64 APK and hash, (2) validate PiP native lifecycle and callbacks / no stale compact UI, (3) browser observer candidate refresh and candidate-to-existing-queue handoff for direct/HLS/DASH, (4) supported HLS live recording state/finalization/recovery, (5) Korean subtitle search/download/attach/play workflow, (6) Korean lyrics/LRC and metadata, (7) full localization and regression.
- Keep PR #10 Draft, #702 baseline immutable, and no release until user device acceptance. CI green is not Galaxy runtime acceptance.


## CI #778 completed — artifact verified (2026-11-28)

- Run: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46113157116
- Head: `5e4cedbe026f6e42171238023a94b43240cfff6b`
- Contract tests, JS checks/typecheck/tests, Rust tests, ABI plan, ARM64 native build, Android APK build, CI APK signing verification and versionCode verification: **success**.
- ARM64 APK artifact: `app-arm64-v8a-release.apk`; downloaded from artifact `apks` (ID `15250773316`). APK SHA-256: `877be6af72b4f34421dbd236938b7770b0accbebfeb1395ab468b5ef6a7fa052`. Artifact ZIP SHA-256: `670759538acded10a59ff2d3da121747444173bae18b72d4d2b03876fa146d7f`.
- This is a CI/build candidate only. Galaxy PiP lifecycle, media detection/selection, transfer and playback acceptance remain pending. Keep PR #10 Draft and #702 baseline unchanged.

## Latest master-guide comparison and next implementation gate

Compared the 2026-11-28 V2 execution blueprint with the newer user Library master guide and comprehensive survey (both updated 2026-11-27). The master documents add/clarify a single MediaIntake → Normalize → Discovery → Candidate merge → Capability resolver → user choice → EngineRouter → TaskOrchestrator pipeline, metadata-rich candidate records, request-context-scoped headers, observer refresh/debounce/deduplication, manifest analysis, and separate live-recording task lifecycle. These are not completed by CI #778 or the existing long-press/shadow-DOM patch.

Next code gate: browser observer/candidate pipeline. Implement bounded, debounced DOM/media/resource observation and refresh; classify direct/HLS/DASH and collect only safe metadata; merge/dedupe candidates; preserve page-scoped referer/user-agent/auth context without logging secrets; feed candidate selection into the existing FoundDownload/StreamSheet and shared Transfers queue. Treat blob/MSE as opaque unless a source/segment path is demonstrably extractable. Keep live HLS recording as a separate later task state machine. Add fixture/contract tests and full CI before claiming this gate; then verify on Galaxy.


## CI #781 completed — latest resource-observer candidate (2026-11-28)

- Run: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46114427733
- Head: `4a4a3a824ce3180619fe8a2f4779dc73eeb10249`
- Contract tests, JS checks/typecheck/tests/assistant eval, Rust tests, ABI plan, ARM64 native build and APK build: **success**.
- Artifact `apks` ID `15251800507`; ARM64 APK `app-arm64-v8a-release.apk` downloaded and inspected. APK SHA-256: `7537002de32d806a4903dd21a322776bf305411e4b32656710e8283840ed981e`. Artifact archive digest reported by Actions: `sha256:9e8de9044f61553009b301961b9741fd6206ffefa52bddc75dbcbbc480d9111d`.
- Build/automated CI evidence only; no Galaxy PiP/media candidate/E2E acceptance recorded.

## Corrected next gate after rereading the newest master documents

The 2026-11-27 comprehensive survey and total development guide are newer/authoritative over the V2 task sequence. They explicitly say **do not continue feature implementation from the ad-hoc branch sequence** until WP0 source/baseline audit and WP1 architecture ADR approval are complete. Therefore the previous tracker suggestion to immediately proceed with more browser observer features is superseded. The Resource Timing observer is now a CI-verified candidate change, not a baseline promotion.

Next work is WP0/WP1 evidence only: inventory repository branches/PRs/workflows/changed files/dependencies and baseline tests; record exact upstream Maglev commit/version; map existing Direct/Torrent/HLS/DASH/browser flows and failure cases; draft ADR-001..013 with context/options/decision/consequences/rejected alternatives/evidence/tests/review date. Keep PR #10 Draft and #702 immutable. No merge/release and no further feature scope until the blockers are reviewed/approved. After WP0/WP1, proceed in the master guide's WP2 core task/direct recovery gate, then WP3 discovery, then extractor/HLS/media processing/playback in sequence; P2 proxy/WireGuard/live recording remains deferred until P0/P1 contracts stabilize.
