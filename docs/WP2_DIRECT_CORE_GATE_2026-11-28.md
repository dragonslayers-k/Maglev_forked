# WP2 — Core Task / Direct Download Gate (2026-11-28)

## Scope and decision

This is the first execution gate after WP0/WP1 reconciliation. Preserve the user-approved #702 source/APK as the immutable comparison baseline. PR #10 remains Draft and is not merged into main/dev or the canonical PR #1 integration track.

WP2 is split into:
- **WP2-A automated core/direct regression:** native state machine, request/response behavior, persisted task state, sidecar/resume, direct HTTP and segmented Range transfer.
- **WP2-B device acceptance:** install exact candidate APK on Galaxy, exercise user-visible task lifecycle and inspect output files.

A green CI can close WP2-A only. It cannot close WP2-B.

## Evidence inspected

- CI #788, commit `b2c27cc63f86f3db695366fa98370decf67067e0`: Contract tests, JS tests/typecheck, Rust tests, ABI plan, ARM64 native build, APK build, signing/version checks and artifact upload succeeded.
- The native direct-download implementation is `native/maglev-core/src/http_dl/` and is built around a pure `machine::step(state,event)` state machine plus an IO driver.
- Existing direct core test coverage includes:
  - `machine.rs`: URL admission, probe/auth/status, queue/slot/governance, pause/resume, retry/backoff, resume 200 restart, validator change, 416 handling, auth loss, storage/permission, checksum completion, restore, secret loss, local redirect/LAN address, stream refusal.
  - `driver.rs`: request headers and cookies, browser page headers, download finalization/rename, persistence/restore, damaged-list recovery, secret-query redaction, storage/network governance, proxy setup, and local HTTP fixtures.
  - `sidecar.rs`: single/split resume offsets, round-trip persistence, legacy record compatibility, contiguous-prefix recovery, query/credential redaction.
  - `driver/segments.rs`: exact contiguous split plan, 8 MiB threshold, max 8 parts, 206/Content-Range validation, validator drift fallback, 429/503 refusal handling, parallel writes, per-segment resume, shared speed limit, pause/resume, and local HTTP integration fixtures.
- These are source-level test inventory observations. No #702-vs-candidate Galaxy comparison was performed in this CI run.

## WP2-A automated verdict

**PASS for the current #788 source head's automated core/direct regression suite.** The full Rust test job completed successfully. This means the tests currently present passed; it does not prove every protocol/server/device combination works.

No new direct engine implementation was added in this step because the audited code already contains broad state-machine and local HTTP integration tests. Avoid duplicating tests without a demonstrated uncovered failure; proceed to exact-device acceptance instead.

## WP2-B Galaxy acceptance — OPEN

Install candidate #788 (or the next exact tested APK) and record APK SHA-256 before testing. Compare against #702 where practical.

1. Add a plain HTTP/HTTPS direct file; confirm filename, size and final playable/openable output.
2. Test server with Range support: pause/resume and verify byte continuity and final hash.
3. Test a server that ignores Range (200 on resume): verify safe restart rather than corrupt append.
4. Test redirect with required Referer/User-Agent/cookie context; ensure host-scoped cookies do not leak across redirect.
5. Test 401/403, expired link, 404, network loss, storage full and retry; confirm clear Korean error and preserved partial data where appropriate.
6. Test app background/force-stop/reopen; verify unfinished task restores and resumes safely.
7. Test multi-connection download on a Range-capable server; verify exact file hash, no gaps/overlap, and pause/resume.
8. Test HLS VOD and DASH regression separately after Direct gate; inspect actual saved container/codec and playback.
9. Test existing torrent/magnet and Transfers list for regressions.
10. Attach exact APK hash, device/Android version, source URL category (no signed tokens), expected/actual result, and evidence to Issue #8.

## Exit criteria

WP2 is fully accepted only when WP2-A is green **and** the Galaxy checklist passes on an exact identified APK. Until then, retain #702 as baseline; do not merge PR #10, promote a baseline, or publish a release.
