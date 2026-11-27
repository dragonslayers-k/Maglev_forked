# #702 → #707 selective comparison

- Date: 2026-11-28 KST
- Source commit: #702 `45e685603a3a23507b61cb49398a78380d5db7a5`
- Candidate commit: #707 `2ed8d64af6cb98c7f132006352b661cde14c36fc`
- GitHub compare: 5 commits ahead, 0 behind; 3 changed files (35 additions, 6 deletions overall).
- Decision: **retain #702 as recovery baseline; preserve #707 as a selective candidate, not accepted release.**

## Commit-by-commit verified changes

1. #703 `45ef304d5e22a4e3368000bbe9cde35c2b3558dd`, “Fix PiP success handshake and prevent duplicate YouTube ad observers”
   - Adds a one-shot PiP callback, reports failure if fullscreen surface never attaches, and prevents duplicate YouTube ad observer/timer injection.
2. #704 `214adc8c6a0867489858bd0ec86abbe4553bcbf4`, “Add regression contract for PiP fullscreen handshake”
   - Adds source-contract assertions for the callback and duplicate-observer guard. This is a contract assertion, not device evidence.
3. #705 `b118f67017df664ce4214d55a53811f3e7bd4089`, “Resolve browser PiP only after Android accepts PiP mode”
   - Moves success resolution until after Android accepts `enterPictureInPictureMode`; resolves failure on false/exception and timeout.
4. #706 `8927b1821b5d3735e74314c7749e314da824be4f`, “Assert PiP success follows Android PiP acceptance”
   - Adds a source-order contract checking that PiP success follows Android's enter call.
5. #707 `2ed8d64af6cb98c7f132006352b661cde14c36fc`, “Stabilize WireGuard concurrency integration test”
   - Replaces a 3-round × 8-worker keep-alive stress loop with one bounded run of 3 overlapping requests, disables keep-alive and caps host connections, then checks idempotent concurrent close. Rationale: pinned gVisor test stack can retain FIN_WAIT2 endpoints under heavy keep-alive churn.

## Evidence and decision

- #702 run `45980241030` passed CI and built/uploaded APK artifact `15189688044`; the artifact ZIP digest is `88234ef47df1e887aa389cc3c6359fc901879abde0bf9f6f0378b21bbf3cd86e`.
- #707 run `45998561035` passed CI. It validates the bounded test configuration and source contracts, not Galaxy PiP video-surface correctness or actual WireGuard egress.
- Later user-rejected #727 reported WireGuard startup, playback and PiP regression. Therefore #703–#706 are promising PiP lifecycle fixes but **PiP remains DEVICE_FAIL/NOT_ACCEPTED** until exact candidate APK passes real video-surface tests.
- #707's WireGuard test change is a test stability fix; it does not by itself repair native startup, handshake, WebView proxy, or every client egress route.
- Do not wholesale reset to #707 or cherry-pick the entire 5-commit range before baseline tests. Keep #702 intact, compare source behavior against the known #707 changes, then port each change with a regression test and record commit/APK hash.

## Required validation for selective port

- PiP: inline video → fullscreen custom surface → Android PiP accepted → real frames in window; preserve aspect/crop; rotate; return to browser; no black/partial surface; success callback only after OS acceptance.
- YouTube ad observer: repeated navigation/injection does not accumulate MutationObservers/timers; no false download candidates from ad surfaces.
- WireGuard: bounded CI test remains stable; separate tests cover engine startup, native exception diagnostics, peer handshake, proxy auth, WebView proxy challenge/rollback, and actual egress per client.
