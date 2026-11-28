# WP0/WP1 Reconciliation — 2026-11-28

Status: **working audit / ADR proposals only; not approved architecture, not release evidence**.

## Authority and sequence

1. User-approved #702 ARM64 APK/source remains immutable comparison baseline.
2. Repository `docs/MASTER_MEDIA_DOWNLOADER_SPEC_KO.md` v1.0.1 (2026-11-27) and Issue #8 are the current implementation gate. They designate PR #1 as canonical integration and require WP0 then WP1 before further ad-hoc features.
3. User Library `통합_미디어_다운로더_총괄_개발_가이드.md` and `통합_미디어_다운로더_전수조사_종합_설계기준서.md` (2026-11-27) are the newer master design source; V2 is a recovery execution plan, subordinate to those.
4. PR #10 remains Draft recovery candidate. No merge, release, branch deletion, or baseline promotion.

## WP0 — current inventory evidence

- Repository: `dragonslayers-k/Maglev_forked`; default branch `main`; public; admin/write permission.
- GitHub branch listing returned 12 branches: `main`, `dev`, `development/video-detection`, `feature/p1-video-detection-observer`, `fix/arm64-only-apk-delivery`, `fix/ci-wireguard-test-timeout`, `fix/wg-peer-handshake-status`, `fix/youtube-share-deeplink`, `fix/ytdlp-stable-auto-update`, `recovery/youtube-selection-reconcile-ci`, `recovery/2026-11-27-rebaseline`, `recovery/2026-11-28-user-baseline-702`. No branch deleted.
- Open PRs: #1 (Draft, broad 230-file integration; canonical track per master/Issue #8) and #10 (Draft, 15-file scoped recovery candidate; base `recovery/2026-11-28-user-baseline-702`). Reconcile #10 as a recovery-only branch, not a competing integration PR.
- Open issue #8 is the canonical runtime acceptance tracker. It reports CI green/user Galaxy fail and specifies G1–G10 gate order.
- Existing recovery audit `recovery/2026-11-27-rebaseline/docs/RECOVERY_REBASELINE_AUDIT_2026-11-27.md` and `PR1_CHANGED_FILES_INVENTORY_2026-11-27.md` are reused. PR #1 file inventory is 230 files (+16,689/−2,516); GitHub exposed only 250 of 740 commit records, so commit history inventory is partial.
- Latest repository master spec: `docs/MASTER_MEDIA_DOWNLOADER_SPEC_KO.md`, v1.0.1, updated 2026-11-27, blob SHA `642b3b916ec8fd4746925fb0a57020401933bf32` on `feature/p1-video-detection-observer`.
- #702 approved commit `45e685603a3a23507b61cb49398a78380d5db7a5`, APK SHA-256 `065d29dfcb19ad630c6bc906bfadecb2bd31395edc707ad3e35cf1f54b10c2de`; recovery base branch currently records base SHA `6fcf8872225426b085d8e4d72f113076cca9dcd6`.

## PR #10 — 15 changed-file classification against #702

### User-visible/native feature changes — candidate, not accepted
- `app/browser.tsx`: delay compact browser PiP state until native PiP returns accepted; success notice follows native accepted result.
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/MaglevEngineModule.kt`: primary native module fallback for PiP entry.
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/watch/MaglevWatchModule.kt`: validate active video before Activity PiP; distinct error responses.
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/MaglevBrowserView.kt`: inspect visible, actively playing video (including open shadow roots), measure ratio, enter native PiP directly; preserve fullscreen custom view.
- `modules/maglev-engine/src/MaglevNativeBridge.ts`: optional PiP module fallback to primary native module.
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/PageScan.kt`: bounded Resource Timing observer for explicit media/manifest URL extensions; metadata only, no arbitrary response-body capture.
- `utils/browser/mediaHitScript.ts`: long-press traversal across nested elements and open shadow-root hosts.

### Throughput/lifecycle change — risk needs baseline comparison
- `native/maglev-core/src/http_dl/stream/mod.rs`: HLS/DASH segment in-flight cap changed 3 → 4. Automated contract checks pass; compare memory/throughput, ordering, cancellation, retry, and existing stream regression before accepting.

### Test-only changes
- `native/wireguard/engine_test.go`: test server lifecycle cleanup to avoid concurrent shutdown hang; no production WG source change in this file.
- `scripts/test-media-hit.js`: nested/shadow-root media hit regression.
- `scripts/test-page-scan-mse.js`: direct Activity PiP contract + Resource Timing presence/bounds.
- `scripts/test-stream-contract.js`: expects stream concurrency cap 4.
- `scripts/test-youtube-format-selector.js`: selection reconciliation effects regression.

### Documentation
- `docs/FINALIZATION_TRACKER_2026-11-28.md`: current tracker.
- `docs/FINAL_IMPLEMENTATION_BLUEPRINT_KO_2026-11-28_V2.md`: scoped execution plan, subordinate to master spec/Issue #8.

### Required review before any promotion
- PiP: native bridge result timing, activity lifecycle, surface visibility, request rejection and exit/re-entry.
- PageScan: Resource Timing privacy/referrer behavior, browser compatibility, duplicate handling, observer lifetime, resource cap and candidate false positives. CI is not a precision/recall result.
- Stream cap 4: memory envelope and cancellation/order/recovery tests; retain 3 if performance gain is not measured and safe.
- All user-visible failure strings must be Korean and actionable.
- Compare each production diff to the exact #702 source and record keep/revert/modify with evidence.

## WP1 — ADR proposals (not decisions)

Each ADR must be reviewed and completed with Context, Options, Decision, Consequences, Rejected alternatives, Evidence, Tests, Review date.

1. **ADR-001 baseline/fork:** preserve upstream v0.33 main/dev; scoped recovery branches; promotion only after accepted regression matrix.
2. **ADR-002 engine reuse:** keep Maglev torrent/direct/queue/storage; add adapters and avoid replacing working core absent measured gap.
3. **ADR-003 HLS primary:** compare existing Rust stream engine with Media3 using fixture and Galaxy matrix; select one primary per capability, explicit fallback.
4. **ADR-004 DASH primary:** same evidence-driven provider decision, track/representation and mux validation.
5. **ADR-005 extractor runtime:** pin exact yt-dlp + Python/JS/EJS package compatibility; isolated process, versioned JSON contract, cancellation, update/rollback and APK size/ABI gate.
6. **ADR-006 unified task model:** single persistent task DB/state machine for direct, stream, extractor, torrent, live capture; define idempotency, restart recovery, event/segment ledger and storage commit.
7. **ADR-007 browser discovery:** provider event schema, candidate identity/dedupe/confidence, page/session context scope, bounded observer; no opaque MSE/DRM claims.
8. **ADR-008 media processing:** exact FFmpeg/Media3 processing choice, licensing, mux/remux, output validation and scheduler.
9. **ADR-009 playback/PiP:** Media3/MediaSession owner, same-player continuity, foreground/background and PiP lifecycle; no WebView PiP claim without Galaxy proof.
10. **ADR-010 app-local WG:** separate optional module, explicit local proxy scope and fail-closed behavior; never claim system-wide VPN.
11. **ADR-011 network ClientFactory:** per-client route coverage for JS/Rust/Direct/Media3/Python/WebView/FFmpeg/aria2c; egress evidence per client.
12. **ADR-012 update automation:** source registry, scheduled review, compatibility branch, tests, report-only promotion and rollback.
13. **ADR-013 license/provenance:** exact upstream commits, notices/source archive, component SBOM, package licensing, no DRM/access-control circumvention.

## Gate status

- WP0: **in progress** — branch/PR/issue inventory and PR #10 file classification captured; exact upstream SHA/changelog verification and baseline golden test execution still required.
- WP1: **draft only** — ADR proposals prepared; no architecture decision approved.
- WP2+ feature work: **blocked by master spec until WP0/WP1 review**.
- Galaxy acceptance: **not recorded** for CI #781 APK.
- Release: **not eligible**.
