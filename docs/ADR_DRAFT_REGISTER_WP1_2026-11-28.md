# WP1 ADR 초안 등록부 — 2026-11-28

상태: **제안 초안 / 승인 전**. 이 문서는 설계 검토를 진행하기 위한 결정을 정리합니다. 사용자 승인이나 실제 구현 완료를 의미하지 않습니다. #702 기준 APK/소스는 동결하며, PR #1만 canonical integration track으로 유지하고 PR #10은 recovery-only Draft로 둡니다.

각 ADR은 Context, Options, Proposed decision, Consequences, Rejected alternatives, Evidence, Tests, Review date를 갖춰야 합니다. 본 등록부의 제안은 최신 master spec v1.0.1, Issue #8, 2026-11-27 사용자 총괄 가이드/전수조사, WP0/WP1 reconciliation과 #790 Galaxy 실패 증거를 기준으로 합니다.

| ADR | 범위 | 제안 방향 | 상태 |
|---|---|---|---|
| 001 | Baseline / promotion | #702 immutability, candidate APK exact hash, Galaxy acceptance 후에만 promote | 초안 |
| 002 | Engine reuse | 기존 Direct/Torrent/queue/storage 재사용, 중복 엔진 금지 | 초안 |
| 003 | HLS VOD | 기존 parser/downloader 우선, capability-based fallback | 초안 |
| 004 | DASH | 기존 manifest/engine 경로 재사용, unsupported capability를 명시 | 초안 |
| 005 | Shared task model | MediaIntake→Normalize→Discovery→Candidate merge→Resolver→User choice→EngineRouter→TaskOrchestrator | 초안 |
| 006 | Task persistence | durable state, pause/resume/retry/restore, stable task identity | 초안 |
| 007 | Browser observer | bounded/debounced DOM+resource observation; safe candidate metadata; page-scoped request context | 초안 |
| 008 | Candidate-to-queue | explicit user selection; existing transfer queue; no auto-download of opaque/unknown media | 초안 |
| 009 | Playback/PiP | real Media3/player surface and MediaSession background first; PiP only while actually playing | 초안 |
| 010 | Network routing | scoped headers/cookies/referer; proxy/WireGuard route preserved; fail-closed where required | 초안 |
| 011 | HLS live recording | separate recording task state machine, finalize/validate/commit/recover | 초안 |
| 012 | MSE capture | only accessible non-DRM bytes with verified timestamps/mux; blob is not presumed downloadable | 초안 |
| 013 | Provenance/release | CI green + artifact identity/hash/signature/version/ABI + Galaxy checklist; no release from CI alone | 초안 |

## Evidence and gate status

- WP0 comparison: PR #1 vs #702 = 1,588 identical, 39 modified, 4 added, 4 deleted (47 paths); older incomplete count is superseded.
- Restored from exact #702 commit `45e685603a3a23507b61cb49398a78380d5db7a5` to canonical PR #1 branch:
  - `scripts/test-page-scan-mse.js`
  - `scripts/test-wireguard-decoupled.js`
- CI #802 (run 46134223904, head `7e64c1fe390969768c45ebbea51828a11454ae0b`) passed JS checks/tests, Contract tests, Rust tests, ABI plan, ARM64 native build and APK build; APK artifact ID `15259079950`.
- CI #800 and #804 passed; #801/#803 were cancelled by branch advancement. #804 is a documentation/tracker run, not a feature implementation.
- The restored tests preserve the legacy #702 MSE/WireGuard contracts; they must not be weakened to green without equivalent stronger coverage.
- User #790 device feedback remains a hard failure: WG and YouTube video work; audio-only 20–30 KB/s; PiP black/frozen; background playback and useful browser media detection/capture fail.

## Review / implementation order

1. Close WP0 with #802 green and verify restored test files remain in canonical PR #1.
2. Review/approve the ADR proposals; until approval, no broad architecture change.
3. Selectively reconcile PR #10 against PR #1/#702, file by file; no wholesale merge.
4. Proceed to runtime Gate B audio diagnosis with redacted transfer decision telemetry; do not blindly increase segment count.
5. Playback surface + MediaSession background; then PiP; then browser candidates→existing queue; then supported HLS live and Korean subtitle/lyrics E2E.

Approval required from project owner before these proposed decisions become binding.