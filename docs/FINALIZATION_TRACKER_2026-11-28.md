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


## WP0 inventory snapshot — GitHub checked 2026-11-28

- Repository: public `dragonslayers-k/Maglev_forked`, default branch `main`, repo size reported 13,173 KB; write/admin permission available.
- Branches returned by GitHub (12): `main`, `dev`, `development/video-detection`, `feature/p1-video-detection-observer`, `fix/arm64-only-apk-delivery`, `fix/ci-wireguard-test-timeout`, `fix/wg-peer-handshake-status`, `fix/youtube-share-deeplink`, `fix/ytdlp-stable-auto-update`, `recovery/youtube-selection-reconcile-ci`, `recovery/2026-11-27-rebaseline`, `recovery/2026-11-28-user-baseline-702`. No branch deletion performed.
- Open PRs returned: #1 (broad 230-file integration, Draft/hold per its body) and #10 (Draft recovery candidate, base `recovery/2026-11-28-user-baseline-702`, head `4a4a3a824ce3180619fe8a2f4779dc73eeb10249`). This conflicts with the latest master spec and Issue #8 which say PR #1 is the only integration track; PR #10 must remain a separate recovery candidate and not merge or be stacked into #1 without explicit reconciliation.
- Canonical open runtime issue #8: current reported verdict is CI green/user Galaxy fail; acceptance order G1 engine/direct → G2 playback → G3 PiP → G4 detection → G5 direct/HLS/DASH → G6 MSE → G7 extractor → G8 app-local WG → G9 Korean/regression → G10 release. Keep as source of gate order; its text also says only PR #1 active.
- Newest repository master file: `docs/MASTER_MEDIA_DOWNLOADER_SPEC_KO.md`, version 1.0.1, updated 2026-11-27 on `feature/p1-video-detection-observer` (SHA `642b3b916ec8fd4746925fb0a57020401933bf32`). It explicitly makes this file + Issue #8 the current development reference and requires gate-by-gate execution. V2 is a scoped recovery execution plan, not higher authority than this master/issue.
- Existing complete PR #1 changed-file inventory from recovery audit: 230 files (+16,689/−2,516); the audit says main/dev remained upstream v0.33 SHA `baaf83f0f3afd65d2eac135cce8b8bbabea8fbb3` at that snapshot. PR #1 commit listing was partial (250 of 740), so do not claim full commit inventory. Existing recovery audit and file inventory should be reused rather than recreating a shallow audit.
- The current PR #10 head has 15 changed files, 43 commits, +537/−66 (GitHub PR metadata). Keep #702 base SHA `6fcf8872225426b085d8e4d72f113076cca9dcd6` and approved commit `45e685603a3a23507b61cb49398a78380d5db7a5` unchanged.

## WP0/WP1 execution next

1. Reconcile branch/PR ownership: PR #1 is canonical integration per master/Issue #8; PR #10 is a scoped recovery candidate only. Do not merge either until user-approved gates.
2. Reuse `recovery/2026-11-27-rebaseline` audit and 230-file inventory; classify the 15-file PR #10 diff against #702 and check no baseline regressions.
3. Verify exact upstream main/tag v0.33 SHA and compare current upstream changelog; record source license/provenance.
4. Draft ADR-001..013 in the master spec's format; prioritize ADR-006 unified task DB/state, ADR-002 engine reuse, ADR-003/004 HLS/DASH provider, ADR-007 browser scope, ADR-009 playback/PiP, ADR-010/011 network routing. Feature coding remains blocked until WP0/WP1 review.


## WP0/WP1 reconciliation document created

- Detailed inventory, PR #10 file-by-file classification, upstream SHA proof and ADR-001..013 draft proposals: [`docs/WP0_WP1_RECONCILIATION_2026-11-28.md`](https://github.com/dragonslayers-k/Maglev_forked/blob/recovery/youtube-selection-reconcile-ci/docs/WP0_WP1_RECONCILIATION_2026-11-28.md)
- Document commit: `f8210e4a770204eb0c03900a2aef2e84b419f7b3`.
- Official upstream `Kaos599/Maglev` v0.33 SHA `baaf83f0f3afd65d2eac135cce8b8bbabea8fbb3` verified. Fork `main` and `dev` each compare **identical** to that exact upstream SHA (0 ahead/0 behind). This closes the upstream/main/dev identity check, not the full WP0/WP1 gate.
- PR #10 description updated to reflect CI #781 and the newer master gate; PR remains Draft.
- CI #781 APK signing verification, versionCode verification and 16 KB LOAD alignment all passed; exact APK SHA recorded above.


## CI #787 complete + cancellation policy fixed (2026-11-28)

- Current head: `3835f6f56a84b87b8c9a2a7ebc2ef9b4efad3ec6`.
- CI #787: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46117853265 — Contract tests, JS typecheck/unit/contract/assistant tests, Rust tests, ABI plan, ARM64 native build (including 16 KB LOAD alignment), APK build, signing, versionCode and upload all succeeded.
- Downloaded ARM64 APK artifact ID `15252424631`; SHA-256 `03b6742acc4105b106c42e68ce53ec0db48408900cc5530c13a65b6c859ca259`. CI build evidence only; no Galaxy runtime acceptance is claimed.
- Repeated canceled runs #782–#785 were caused by workflow concurrency `cancel-in-progress: true` while rapid follow-up commits entered the same branch group. Changed `.github/workflows/ci.yml` in commit `3835f6f`: concurrency group v4 and `cancel-in-progress: false`. This lets active full builds finish; GitHub may still replace a pending queued run in the same group.
- #786 also passed before the concurrency fix; #787 is the first full run on the corrected policy and is green.
- Current next gate remains the master spec/Issue #8 ordered acceptance: complete baseline regression review and WP0/WP1 ADR approval, then WP2 core task/direct recovery. Do not add unrelated features, merge PR #10, alter #702, or release before Galaxy acceptance.


## WP2-A core/direct automated gate — CI #788 reviewed (2026-11-28)

- CI #788 run https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46118938309 completed successfully on `b2c27cc63f86f3db695366fa98370decf67067e0`; all required contract/JS/Rust/ARM64/APK/signing/version/upload steps passed.
- Audited native Direct code and its existing regression coverage in `http_dl/machine.rs`, `driver.rs`, `sidecar.rs`, and `driver/segments.rs`: state transitions, request headers/cookies, pause/resume, persistence/restore, validator/range behavior, exact segment layout, fallback, speed limiting and local HTTP integration tests are already present.
- **WP2-A automated test portion: PASS on #788.** No duplicate test or engine code was added because the existing coverage is broad and passed.
- Added `docs/WP2_DIRECT_CORE_GATE_2026-11-28.md` (commit `a79ae3c5be9ce06a5064aafa54c7def4f4cb7dc4`) with the precise automated evidence and Galaxy acceptance checklist.
- **WP2-B Galaxy acceptance: OPEN.** Need exact APK hash + Samsung device tests for real file/hash, Range resume, ignored Range restart, redirect/auth headers, failure/retry, process restore, segmented transfer and Torrent/HLS/DASH regressions. CI is not device acceptance.
- Keep #702 baseline immutable, PR #10 Draft, and no merge/release until WP2-B passes.


## CI #789 / #790 completion audit — 2026-11-28

- CI #789 run https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46120147574 completed successfully on source head `a79ae3c5be9ce06a5064aafa54c7def4f4cb7dc4`. Contract, JS/typecheck/tests, Rust, ABI plan, ARM64 native build/16 KB alignment, APK build, signing, versionCode and artifact upload passed. APK artifact ID `15254195597`; extracted ARM64 APK SHA-256: `492fe2144e4a34e9d418b83e748402157daa26ce7725e514a84170c1ed1104da`.
- CI #790 run https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46120157400 completed successfully on tracker update head `d9ee991e33387f6e0692807690eae4131a8f5b4c`. All required contract/JS/Rust/ABI/ARM64/APK/signing/version/upload jobs succeeded; PR APK reuse and Accrescent APK-set steps were skipped by workflow conditions. APK artifact ID `15253253710`; extracted ARM64 APK SHA-256: `891186de835de622e506a01e4ed9a9c79c69de2d895e2e73a15e1f42bc23e3e9`.
- #789 and #790 APKs have the same size (63,676,983 bytes) and identical `classes.dex` and `AndroidManifest.xml` hashes. #790 head is a tracker-only follow-up to #789, not a new feature implementation; do not claim new runtime functionality from #790.
- Both are CI candidates only. No Galaxy test evidence is attached. WP2-A remains PASS; WP2-B remains OPEN. Preserve #702 baseline, keep PR #10 Draft, and do not merge/release. Next executable gate is Galaxy acceptance of the exact APK; once accepted, proceed to WP3 Discovery per master spec/Issue #8.


## User Galaxy acceptance — CI #790 / #791 rejected (2026-11-28)

User installed CI #790 and reported:
- WireGuard works correctly.
- YouTube video downloads work, but audio-only transfer is extremely slow (20–30 KB/s).
- PiP still only shows a popup and does not play; picture is cropped/black on the previously reported video sample.
- Background media playback is unavailable.
- Browser capture still shows “브라우저 녹화는 아직 지원되지 않습니다. 직접 미디어 주소나 HLS/DASH를 확인하세요.” and cannot recognize media on tested Barrel/MPMux-style pages.

Verdict: **Galaxy acceptance FAIL**. Preserve the working WireGuard and YouTube video paths. Treat audio throughput, real playback/PiP lifecycle, background MediaSession, browser candidate discovery, and supported capture as separate blocking regressions/gates. This feedback supersedes any earlier optimistic source-level or CI-only status.

## CI #791 audited (2026-11-28)

- Run: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46122175068; completed success on head `39c9b55c179c2158124fa2daf38592de51251d6a`.
- Contract, JS/typecheck/tests, Rust, ABI plan, ARM64 native build/16 KB alignment, APK build, signing, versionCode and artifact upload passed; conditional PR APK reuse and Accrescent APK set were skipped.
- Artifact `apks` ID `15255125010`; extracted ARM64 APK size 63,676,983 bytes; SHA-256 `2370f8381132ea46de21779d7e426397b93414f4927a0b9688cedc49c131d246`.
- Compared #790 and #791 APKs: `classes.dex` and `AndroidManifest.xml` are byte-identical (same SHA-256). #791 is a documentation-only rebuild, **not a fix for the reported failures**. Do not ask the user to install #791 as if it contained a repair.

## Corrected execution priorities after actual device failure

1. **P0 preserve known-good**: keep #702 baseline immutable; retain the user-confirmed working WireGuard and YouTube video download. PR #10 remains Draft; no merge/release.
2. **P1 playback foundation before PiP**: inspect the existing browser playback path and the native Media3 player/activity, ensure one actual video surface is attached, correct aspect/crop and black-frame behavior, request headers/cookies and lifecycle; test direct MP4, HLS and DASH. PiP must be offered only after the selected media is genuinely playing.
3. **P1 background playback**: add a foreground MediaSession/Media3 service with audio focus, notification controls, task persistence and lifecycle; verify playback survives app backgrounding and screen-off. A PiP popup alone is not playback.
4. **P1 audio throughput**: instrument the NewPipe/yt-dlp audio-only path to distinguish extractor URL, transfer engine, proxy/WireGuard route, throttling and conversion. Record bytes/sec, elapsed, provider, format, request headers and retries with secrets/URL tokens redacted. Compare identical source and network to video download; do not arbitrarily change bitrate or route around enabled WireGuard.
5. **P1 browser discovery/selection**: page observer must produce media candidates from DOM, resource metadata and HLS/DASH manifests, with refresh/dedupe and correct source/quality; route the chosen candidate to existing transfer queue. Current message proves candidate pipeline is not user-usable.
6. **P2 capture**: implement a separate supported HLS-live task state machine and finalization; MSE SourceBuffer capture only for accessible, non-DRM media with bounded native staging. Remove generic refusal only when an actual supported capture path exists; never claim DRM support or bypass.
7. Barrel/MPMux feature audit: do not rebuild existing Range/HLS VOD engines. The latest MPMux audit identifies HLS Live and MSE SourceBuffer byte capture as gaps; integrate with shared queue/storage instead of creating duplicate downloaders.

Do not continue document-only “feature progress.” Next source commits must fix one of these P1 runtime gates, include targeted tests and full CI, then be reported with the exact changed APK and acceptance status. CI green alone remains insufficient.


## CI #795 / #796 and V3 replan — 2026-11-28

- #795 failed in JS UI assertions because the active WebView/PiP test regex was incorrectly escaped; APK build skipped. Corrected the test expressions in commit `42b20264c484844b082dad5f431d4aee6e1c8ee9`.
- CI #796 run https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46128517642 completed successfully on that head: Contract tests, Rust tests, JS typecheck/unit/assistant eval, ABI plan, ARM64 native build/16 KB alignment, APK build, signing, versionCode and APK upload passed. PR APK reuse and Accrescent APK-set steps skipped by condition.
- APK artifact ID `15257306995`; archive digest `sha256:5f982c851c45ed7b2aedde276f25d0abe87c8032a1bd000f820b3d3d920f1de6`. This commit corrects tests, not the user's runtime issues; do not recommend #796 as a functional fix or claim Galaxy acceptance.
- Reconfirmed user #790 device verdict: WireGuard and YouTube video download work; audio-only is 20–30 KB/s, PiP black/frozen, background playback unavailable, browser media detection/capture not user-usable. #791 APK native classes.dex/manifest identical to #790; not a fix.
- Re-read V2 against current master spec v1.0.1 (2026-11-27) and Issue #8. V2 is subordinate; master gate order and CI-vs-device acceptance remain controlling. V2's feature order is updated by new `docs/FINAL_REPLAN_V3_2026-11-28.md`.
- V3 separates not-done items and reorders work runtime-first: Gate A preserve/reproduce; Gate B diagnose/fix audio throughput; Gate C actual playback + MediaSession background before PiP; Gate D observer→candidate selection→existing queue; Gate E supported HLS live capture/MSE only with proven byte path; Gate F Korean-first subtitles and lyrics. No baseline promotion, merge or release before exact APK Galaxy acceptance.
- Next code action: Gate B audio-only end-to-end trace/repair. Do not ask user to install #796 as a feature fix. Report the next candidate only after full CI, APK identity/hash, and clear distinction between CI and device status.


## Gate B source audit — 2026-11-28 (not yet a code fix)

- Inspected PR #10 source `NewPipeYoutube.kt`, `YoutubeDownload.kt`, and native `http_dl/driver/segments.rs`.
- Both direct audio paths already request `segments=8`; HLS/DASH mux path uses 1 connection by design. Native split cap is 8 and only activates for >=8 MiB when a 206 byte-range probe and strong ETag/Last-Modified validator pass. Otherwise native transfer safely falls back to one connection.
- Conclusion: do **not** merely increase segment count. Next source change must instrument selected audio format and transfer engine decision (range probe pass/fail, split count/fallback reason, bytes/time, speed limit/proxy state) with signed URL query/cookies/headers redacted; reproduce the reported 20–30 KB/s before changing behavior. Add fixture tests for the root cause, then full CI.
- V3 doc updated with this source evidence in commit `1c81afd1c7b4370254a2104839fe460a20607b09`. No audio runtime fix or Galaxy acceptance claimed yet.


## Latest recheck / V4 plan — 2026-11-28 19:13 KST

- Checked branch Actions through #799: #799 SUCCESS (run https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46129694336, head `4080a533cd121e67f5602d8c70e46af4a10e197a`). Contract/Rust/JS/typecheck/unit/assistant eval, ABI plan, ARM64 native + 16 KB alignment, APK build/sign/versionCode/upload passed. PR APK reuse and Accrescent APK set skipped conditionally.
- Artifact `apks` ID `15258036827`, archive digest `sha256:3101d83fa1754332debc6bc4dfa80d464ec46dd82dffd07928b33df45e8174f2`. This is ZIP artifact digest, not APK SHA-256. No Galaxy acceptance. #799 is not a new functional fix; it validates the current candidate build/tests.
- #798 cancelled due branch advancement; #797/#796 success; #795/#794 failed; #793 cancelled; #792/#791/#790 success. Failures #794/#795 were UI contract assertions; #796 fixed regex; #799 revalidated green.
- V3 was superseded in execution order by the newer repository WP0/WP1 reconciliation + PR1/#702 full-tree audit. V4 now recognizes user Library master guides + repo master spec v1.0.1 + Issue #8 as controlling and PR #1 as canonical integration. PR #10 remains recovery-only Draft.
- Accurate PR #1 vs #702 tree comparison: 1,588 identical / 39 modified / 4 added / 4 deleted (47 paths). Previous 187/36/4/0 calculation was incomplete and is invalid. Deleted paths include `scripts/test-page-scan-mse.js` and `scripts/test-wireguard-decoupled.js`; these regression tests must be restored or replaced with equivalent stronger coverage before broad feature work. Preserve the 2 deleted docs via history/reference.
- V4 plan saved: `docs/FINAL_EXECUTION_PLAN_V4_2026-11-28.md`. Immediate next stage is WP0 regression restoration and targeted tests on canonical PR #1 branch, then complete WP1 ADR review; only then selectively reconcile PR #10 candidate code. V3 audio diagnosis remains a later runtime gate, not a license to bypass WP0/WP1.
- User #790 acceptance remains unchanged: WireGuard and YouTube video work; audio 20–30 KB/s; PiP black/frozen; background playback and usable media detection/capture fail. Do not claim these resolved by #799.


## WP0 test restoration execution — 2026-11-28

- On canonical PR #1 branch `feature/p1-video-detection-observer`, restored exact #702 regression scripts from baseline commit `45e685603a3a23507b61cb49398a78380d5db7a5`:
  - `scripts/test-page-scan-mse.js` — commit `3092a7349df13827344bfba5567cc89a5ae62837`.
  - `scripts/test-wireguard-decoupled.js` — commit `7e64c1fe390969768c45ebbea51828a11454ae0b`.
- CI #802 is running against head `7e64c1fe390969768c45ebbea51828a11454ae0b`: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46134223904. Latest checked jobs are in progress; result not yet known.
- V4 plan was updated with exact commits and the warning not to weaken legacy MSE/WireGuard contracts without equivalent evidence: commit `91680ace1ac2033bd25a524fe0ec40e1df27dec0`.
- Do not mark WP0 complete until #802 result and any exposed regression are resolved; no merge/release/baseline promotion.


## CI #802/#800/#804 final results + WP1 ADR draft — 2026-11-28

- Actions latest audit: #804 SUCCESS (run 46134280830); #802 SUCCESS (run 46134223904); #800 SUCCESS (run 46134178615). #803 and #801 CANCELLED due branch advancement, not test failures.
- #802 individual jobs all passed: JS checks/typecheck/tests/assistant eval, Contract tests, Rust tests, ABI plan, ARM64 native build and APK build. APK artifact ID `15259079950`; archive digest `sha256:38cab77b9891f97745334b0446286f43f9eeac47dbe15bee64641be2fc551765` (ZIP artifact digest, not APK SHA-256). No Galaxy acceptance is claimed.
- Restored exact #702 regression scripts on canonical PR #1: `scripts/test-page-scan-mse.js` and `scripts/test-wireguard-decoupled.js`. WP0 regression restore CI gate PASS; do not weaken these contracts without equivalent stronger tests.
- Added WP1 ADR proposal register `docs/ADR_DRAFT_REGISTER_WP1_2026-11-28.md`, commit `03f30b3d78a831232d8ba4eb7161003e5cf7378c`. ADR-001..013 are explicitly **draft/unapproved**. Proposed decisions cover baseline promotion, engine reuse, HLS/DASH, shared task model/persistence, browser observer/candidate queue, playback/MediaSession/PiP, network context, HLS live/MSE, and artifact/device release gate.
- Updated V4 execution plan with this evidence in commit `badc99cdbe38a393a4ea497792ce3cadf9d95d3c`. V3 remains a user-device symptom/diagnostic reference; newer master spec + Issue #8 + WP0/WP1 reconciliation control the execution sequence.
- Next action: review WP0/WP1 and selectively reconcile PR #10 candidate code into canonical PR #1; then instrument Gate B audio path and fix only evidence-supported root cause. Preserve #702 and user-confirmed working WG/YouTube video; PR #10 stays Draft; no merge/release/baseline promotion until exact candidate passes Galaxy acceptance.
- #790 device failures still OPEN: audio-only 20–30 KB/s, PiP black/frozen, background playback unavailable, browser media detection/capture unusable. CI #802/#804 are not runtime fixes.


## CI #805/#807 completed and latest V4 recheck — 2026-11-28 20:18 KST

- Actions API latest: #807 SUCCESS (run 46137066679, head `ddb19f92aa71523fd9dd46d2ce8a3d780be88e1c`); #805 SUCCESS (run 46137042443, head `03f30b3d78a831232d8ba4eb7161003e5cf7378c`); #806 CANCELLED due branch advancement. #805 and #807 each completed JS checks/typecheck/tests/assistant eval, Contract tests, Rust tests, ABI plan, ARM64 native build and APK build successfully. These runs validate documentation/ADR commits against CI; they do not implement audio/player/capture fixes.
- The newer execution reference remains V4 + WP0/WP1 reconciliation + repo master spec v1.0.1 + Issue #8. V3 is retained as device-failure symptom and runtime diagnostic checklist, not as the controlling task order.
- WP0 restored test gate: PASS (#802). Exact #702 `test-page-scan-mse.js` and `test-wireguard-decoupled.js` are restored on canonical PR #1 branch. WP1 ADR-001..013 are drafted in `docs/ADR_DRAFT_REGISTER_WP1_2026-11-28.md`, but not yet approved. Do not report WP1 as closed.
- Source-level Gate B audit remains: audio paths request 8 segments, native segmenter caps at 8 and requires file >=8 MiB plus successful byte-range probe/validator; no root cause of 20–30 KB/s has been proven. The next runtime code change must add redacted diagnostics for selected format/engine, range/split/fallback, transfer rate/time, proxy/limit/retry, and test the decision branches before behavior is changed.
- User acceptance still FAILS on the exact #790 device report: audio-only 20–30 KB/s, PiP black/frozen, background media unavailable, browser media detection/capture not usable. WireGuard and YouTube video download remain known-good and must not regress.
- No baseline promotion, PR merge or release. Next sequence: complete WP0/WP1 review and selective PR #10-vs-PR #1/#702 file reconciliation; then Gate B instrument+reproduce+root-cause+fix, full CI and exact APK verification; then playback/MediaSession before PiP; then candidate-to-queue, supported HLS recording, Korean subtitle/lyrics E2E.
