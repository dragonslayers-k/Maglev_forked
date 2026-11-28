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
