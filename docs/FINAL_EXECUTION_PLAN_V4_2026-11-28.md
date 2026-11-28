# MAGLEV+ 최종 실행계획 V4 — 최신 WP0/WP1 및 CI #799 대조
작성: 2026-11-28 KST
상태: 최신 상위 설계에 맞춘 작업 순서 정정. 최종 제품/릴리즈 아님.

## 1. 문서 우선순위 정정
- 사용자 제공 2026-11-27 Library 문서 `통합_미디어_다운로더_총괄_개발_가이드.md` 및 `통합_미디어_다운로더_전수조사_종합_설계기준서.md`가 상위 제품 설계.
- 저장소 `docs/MASTER_MEDIA_DOWNLOADER_SPEC_KO.md` v1.0.1 + Issue #8이 실행 게이트이며 PR #1이 canonical integration track.
- `docs/WP0_WP1_RECONCILIATION_2026-11-28.md`와 `docs/PR1_VS_702_SELECTIVE_FILE_AUDIT_2026-11-28.md`는 V3보다 최신/구체적. V3의 runtime-first Gate B 우선 제안은 WP0/WP1 통과 전의 직접 코드 작업 지시로 적용하지 않는다. V3는 실기기 실패 목록/진단 아이디어로 유지하고, 실제 다음 단계는 아래 WP0/WP1이다.
- PR #10은 #702 기반 recovery-only Draft이며 canonical PR #1과 경쟁 통합 트랙으로 사용하지 않는다. merge/release/baseline promotion 금지.

## 2. 최신 Actions 기록
- #799 run https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46129694336 — SUCCESS, head `4080a533cd121e67f5602d8c70e46af4a10e197a`.
  - Contract tests, Rust tests, JS typecheck/unit/assistant eval, ABI plan, ARM64 native build + 16 KB alignment, APK build/signing/versionCode/upload passed.
  - APK artifact ID `15258036827`, archive digest `sha256:3101d83fa1754332debc6bc4dfa80d464ec46dd82dffd07928b33df45e8174f2`. This is CI artifact archive digest, not APK file SHA-256.
  - PR APK reuse and Accrescent signed APK-set steps skipped by condition. No Galaxy device acceptance.
- #798 cancelled when branch advanced; no failure diagnosis required.
- #797 SUCCESS, #796 SUCCESS; #795 and #794 FAILURE; #793 CANCELLED; #792/#791/#790 SUCCESS.
- #799 head is doc audit commit, and run's PR merge checkout reflects current PR head source. Do not call #799 a new functional fix; it confirms build/tests for current candidate only.
- User #790 device verdict remains authoritative: WG + YouTube video work; audio-only 20–30 KB/s; PiP black/frozen; background playback fails; media detection/capture not user-usable.

## 3. WP0 — audit closeout / missing regression restoration
### Confirmed exact PR #1 vs #702 tree comparison
- 1,588 same; 39 modified; 4 added; 4 deleted = 47 paths different.
- Exact deleted from #702: `docs/FINAL_PRODUCT_REFERENCE_AND_IMPLEMENTATION_MASTER.md`, `docs/RUNTIME_FIRST_STABILIZATION_PLAN.md`, `scripts/test-page-scan-mse.js`, `scripts/test-wireguard-decoupled.js`.
- Older 187/36/4/0 estimate is explicitly invalid; do not reuse.
- The two deleted scripts are regression coverage, not disposable cleanup. Next concrete code task: restore the #702 MSE/PageScan and WG decoupling tests to canonical PR #1 branch or provide equivalent tests with stronger assertions, then run targeted JS test suite. Preserve existing #702 source behavior until the test suite proves any change safe.
- Recover deleted docs in history/reference; do not erase their content. New master docs must link or supersede them clearly.

## 4. WP1 — architecture approval required before broad implementation
Complete each ADR with Context, Options, Decision, Consequences, Rejected alternatives, Evidence, Tests, review date:
1. Baseline/fork and promotion policy (#702 frozen; PR #1 canonical).
2. Engine reuse (Maglev torrent/direct/queue/storage retained).
3. HLS engine selection and fallback.
4. DASH engine selection and fallback.
5. Browser observer/candidate schema/privacy and queue bridge.
6. Playback/MediaSession/background/PiP surface ownership.
7. Network client routing/request context/WireGuard fail-closed semantics.
8. Artifact provenance/version/signing/device acceptance.
Status: WP1 proposals only, no approval recorded. Do not invent approved decisions.

## 5. Ordered execution after WP0/WP1
Gate 0: Restore deleted regression tests and prove baseline #702 behaviors.
Gate 1: Complete ADRs and reconcile PR #10 candidate changes into canonical PR #1 selectively (no wholesale merge).
Gate 2: Audio-only transfer diagnosis: exact format/engine, range probe, split/fallback, bytes/time, retry/throttle/proxy; redacted diagnostics. No blind segment-count increase.
Gate 3: Real player surface + actual rendering, then MediaSession foreground playback/background/screen-off, then native PiP enter/exit/restore.
Gate 4: Browser observer→candidate list→quality/audio selector→existing Transfers queue, tests for MP4/WebM/HLS/DASH/lazy/shadow/blob/MSE; opaque source must not be called downloadable.
Gate 5: Supported HLS live recording state machine and finalize/validate/commit; MSE capture only if bytes/timestamps/mux are proven. DRM bypass out of scope.
Gate 6: Korean-first subtitle search/download/parse/attach/sync E2E and LRC/lyrics with lawful provider/source and attribution.

## 6. Every candidate's acceptance evidence
- One scoped change per commit, source path + root cause + test + risk recorded.
- Targeted tests before full CI where available; no false claim of local execution.
- Full CI job results + artifact ID + archive digest + APK SHA-256 separately identified + version/ABI/signature.
- Exact candidate installed and #790 cases retested on Galaxy. CI green alone is not feature completion.
- Keep #702, PR #10 Draft, canonical PR #1, issue gates and releases unchanged until user acceptance.

## Immediate next action
Restore `scripts/test-page-scan-mse.js` and `scripts/test-wireguard-decoupled.js` from exact #702 into canonical PR #1 branch (or implement equivalent tests if incompatible), then run targeted tests and full CI. Do not stack audio/PiP/capture feature commits before this regression gate is green.


## WP0 execution started — regression tests restored

- Canonical PR #1 branch `feature/p1-video-detection-observer` was verified at head `2820b4dff15773ce835a43a3ea4936aa6e7b26ad`; both #702 regression tests were absent from its tree.
- Restored exact #702 file contents from approved commit `45e685603a3a23507b61cb49398a78380d5db7a5`:
  - `scripts/test-page-scan-mse.js` commit `3092a7349df13827344bfba5567cc89a5ae62837`
  - `scripts/test-wireguard-decoupled.js` commit `7e64c1fe390969768c45ebbea51828a11454ae0b`
- CI #802 started on latest PR #1 head `7e64c1fe390969768c45ebbea51828a11454ae0b`: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46134223904. At this note, Typecheck and native/contract jobs are running; no conclusion yet.
- Important: the MSE test is a legacy #702 contract and may expose current PR #1 regression; do not weaken it just to make CI green. If source architecture intentionally changed, replace it with equivalent runtime/contract coverage, and document the reason.


## CI #802 / #800 / #804 final audit and WP1 advancement — 2026-11-28 19:xx KST

- Rechecked Actions API latest runs: #804 SUCCESS (run 46134280830, head 4c69d1347b9ea2b60d86427303ca397f1071d213); #802 SUCCESS (run 46134223904, head 7e64c1fe390969768c45ebbea51828a11454ae0b); #800 SUCCESS (run 46134178615, head 7b838450641ca1cce2fd2f38b95299ffa17d1c30). #803 and #801 CANCELLED due branch advancement; these are not failures of their tests.
- #802 jobs verified individually: JS typecheck/tests/assistant eval, Contract tests, Rust tests, ABI plan, ARM64 native build, APK build all SUCCESS. Artifact `apks` ID `15259079950`, archive digest `sha256:38cab77b9891f97745334b0446286f43f9eeac47dbe15bee64641be2fc551765`. This digest is the artifact archive, not the extracted APK SHA-256. The APK was generated, but no new device acceptance is available.
- WP0 regression restoration is now CI PASS: exact #702 MSE/PageScan and WireGuard-decoupled test scripts are present on canonical PR #1 and the full workflow passed. This does not by itself establish all WP0/WP1 review gates.
- Added `docs/ADR_DRAFT_REGISTER_WP1_2026-11-28.md` (commit `03f30b3d78a831232d8ba4eb7161003e5cf7378c`) with ADR-001..013 proposed direction and explicit unapproved status. It records evidence, current device failure, and review/implementation order. No proposal is represented as user-approved.
- Next: finish review of WP0/WP1 and selectively reconcile PR #10 vs canonical PR #1/#702; then runtime Gate B instrumentation/diagnosis of audio transfer. Do not increase segment count blindly. Preserve #702, keep PR #10 Draft, no merge/release/baseline promotion.
- #790 Galaxy verdict remains FAIL for audio-only speed, PiP playback, background playback, and browser media detection/capture. #802/#804 are regression/documentation CI, not runtime repairs.


## CI #809 failure audit + corrected source — 2026-11-28

- CI #809 run https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46139361816: JS checks, Rust tests, contract tests, ABI plan and ARM64 native build passed; `Build APK` failed at `:maglev-engine:compileReleaseKotlin`.
- Root cause from compiler log: malformed Kotlin diagnostic string in `NewPipeYoutube.kt` (`requestedSegments=8` was missing its closing quote), causing syntax errors around lines 178–187. This was introduced by the audio diagnostic edit, not an Android SDK/NDK or dependency failure.
- Corrected diagnostic to Kotlin string interpolation and corrected stale comment from four to up to eight bounded parts. Fix commit on canonical PR #1 branch `feature/p1-video-detection-observer`: `28579afc8ffec3e9cbe5a4ccf01b5dc0443e9e4f`.
- CI #809 has no APK artifact; do not install or report it as a candidate. A new full Actions run is required on `28579af...`; validate APK build/artifact before device test.
- V3 vs latest: V3 Gate B audio diagnosis is still the active user-facing runtime issue, but V4 + master spec v1.0.1 + Issue #8 + WP0/WP1 reconciliation control task ordering. #802 restored test gate passed; ADR-001..013 remain drafts, not approvals. Preserve #702; PR #10 Draft; PR #1 canonical.
- Next: wait for full CI on the syntax fix. If green, verify APK identity and provide exact artifact; Galaxy test must capture MaglevAudioDiag and throughput. If native segmentation falls back, instrument native Range/probe/split reason before changing behavior. Keep playback/MediaSession, PiP, browser discovery/capture, Korean subtitles as separate unfinished gates.


## CI completion update — 2026-11-28 (runs #811–#813)

- **#811 PR #1 source build SUCCESS**: run https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46141623006, head `28579afc8ffec3e9cbe5a4ccf01b5dc0443e9e4f`. Rust tests, JS checks, contract tests, ABI planning, ARM64 native build and APK build all passed. APK artifact `apks`, id `15262790510`, archive digest `sha256:b02c1fc30037017139f4fb24a4a4a897e10a75d23efc9f107dec889912ebc2cb`, expires 2026-12-05. This is a build candidate, not Galaxy runtime-verified.
- **#812 recovery-doc CI SUCCESS**: run https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46141637500, commit `76959f258ee490a6b0e377fa840542a773c82cd6`; all checks and APK build passed. Artifact id `15262681374`, digest `sha256:07c14654b9ad82576e15af3bbb5ac922474cc71faf0e494b36ca72143b437d04`.
- **#813 recovery-doc CI SUCCESS**: run https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46141639787`, commit `cf9af736a81e7dbf5c16e8d2104ee66fa6ce07e0`; all checks and APK build passed. Artifact id `15261939939`, digest `sha256:2b981824fde8e0a608d74f355c065463ae9cbafa4e1c8957801114f93e3b0bfd`. This branch APK is not automatically the canonical PR #1 source candidate; prefer #811 for the audio source patch.
- #809 remains failed due the Kotlin syntax issue now corrected; #811 proves the correction builds. #808/#810 docs/regression CI passed; #806 was cancelled due branch movement, not test failure.
- V3 vs current execution: V3 remains diagnostic reference; V4/master spec v1.0.1/Issue #8/WP0-WP1 define task sequence. Actual source improvement is now included and compiles. Segment count change alone is not confirmed to fix 20–30 KB/s; device runtime must collect `MaglevAudioDiag` and native range/probe/split fallback reason.
- **Next action**: install/test #811 artifact on Galaxy, check audio speed and logcat; if still slow, instrument native transfer decision and address fallback/root cause. Then work through PiP black/frozen, MediaSession/background playback, browser media capture, and Korean subtitle source integration. Preserve known-working WireGuard/video, keep PR #10 Draft, no release or baseline promotion until acceptance.
