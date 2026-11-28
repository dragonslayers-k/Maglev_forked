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
