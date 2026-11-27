# Maglev: Runtime-First Stabilization Plan

This document is the persistent execution order for Maglev. Do not add unrelated features or advance to a later gate until the current gate's acceptance criteria are met. A successful CI build is necessary but never sufficient for runtime completion.

## Execution protocol

- Work on the active stabilization PR/branch; keep changes focused and avoid overlapping commits that cancel Actions runs.
- For every change: inspect source and failure history; implement a focused fix; add/adjust automated regression tests; commit; wait for the exact GitHub Actions run to finish; inspect all jobs and artifacts; report the run URL and result.
- If Actions fails or is cancelled, inspect the failed/cancelled job logs, correct the cause, and rerun. Do not report a cancelled run as validation.
- After CI succeeds, inspect the produced APK artifact and install/launch it in emulator/device automation where available. Report separately: source committed, CI result, APK produced, emulator install/launch, feature runtime checks, and user-device verification.
- If a real Samsung-device check is required and cannot be performed remotely, state exactly what the user should install/test and request the concrete result (including full Copy details diagnostic where relevant). Do not claim that the user tested it until they report back.
- Keep the app fail-closed for app-local WireGuard: never silently bypass the configured tunnel/proxy to direct networking on failure.
- Maintain a gate checklist in PR/issue comments with evidence links, test results, unresolved blockers, and next action. Only mark a gate complete when evidence meets its criteria.

## Gate 1 — Engine startup and native initialization

Separate app-entry/navigation failures from native engine loading and initialization failures.

Acceptance:
- App reaches the usable shell without a startup crash or indefinite loading state.
- Native library load, JNI symbol/version check, native init, config parsing, and post-init governance/limit calls have distinct error codes and preserve exception class, root cause, and useful message (redacting credentials/tokens/URLs with secrets).
- A native failure is not mislabeled as an app navigation failure; a navigation failure is not mislabeled as native engine failure.
- Failed initialization resets retry state and allows an explicit retry without a stale single-flight promise.
- Automated tests cover structured native failure, rejected bridge call/exception, missing or stale native library, and retry after failure.
- APK installs and launches; downloader engine reports ready and a basic real download/torrent operation completes on a supported test source.

## Gate 2 — App-local WireGuard connection recovery

Acceptance:
- UI state reflects actual tunnel and peer state, not merely the switch value.
- Verify peer handshake timestamp/age and endpoint/transfer counters where the engine exposes them.
- Make a real authenticated request through the local proxy and verify the response.
- Verify browser traffic uses the WebView proxy and determine the browser exit IP independently from the downloader proxy exit IP.
- Test enable, disable, reconnect, network change, app foreground/background, and engine restart.
- On tunnel/proxy failure, both downloader and browser remain fail-closed; no direct-network fallback or credential leakage.
- UI diagnostics clearly distinguish tunnel started, peer handshake, downloader proxy, WebView proxy application, proxy request, and browser exit-IP check.

## Gate 3 — Browser media detection and download while playing

Acceptance:
- Inspect and instrument actual WebView media paths: ordinary media elements, MSE, HLS, and DASH; identify manifests, segment requests, blob/media-source handling, and limitations per path.
- Implement detection/download support for each viable path rather than showing only an unsupported notice.
- Preserve authorization headers, cookies, referer, selected quality/audio, and safe URL refresh as required by the source.
- Validate on representative real sites/samples for progressive, HLS, DASH, and MSE; verify downloaded output is playable and complete.
- Unsupported cases must be accurately identified with a specific reason, not a generic catch-all.

## Gate 4 — Picture-in-Picture and background playback

Acceptance:
- Verify actual playback enters PiP from the player/browser UI and returns to the correct screen/state.
- Test rotation during playback and PiP, foreground/background transitions, lock/screen-off behavior where supported, audio focus, notification controls, and lifecycle recreation.
- Confirm playback continues as intended and does not silently stop or restart.
- Manifest/service declarations alone do not count; capture test evidence from runtime.

## Gate 5 — Barrel / MPMUX / LJ Downloader integration

Acceptance:
- Analyze the supplied Barrel APK/source/reference material and MPMUX/LJ Downloader sources separately; record component architecture, licenses, APIs, dependencies, and exact feature behavior before porting.
- Integrate by independently testable feature units: Smart Connect; site-specific connection rules; media recognition; download engine/format-quality selection; playback/download handoff.
- Keep app-local WireGuard integration isolated from the separate WireGuard + AdGuard project and avoid device-wide VPN/APN changes.
- Add integration and regression tests for each feature unit and the combined browser/downloader/WireGuard flows.
- Only report a feature as integrated when the real runtime behavior is verified.

## Current status (2026-11-27)

- Gate 1: BLOCKED / investigation in progress. A startup exception-reporting change was committed to PR #7 (0ce93666a41216b070ea95dfeab7539f769c956b); it is not yet validated by Actions or runtime.
- Gate 2: NOT PASSED. Previous proxy tests do not prove peer handshake plus browser exit-IP and fail-closed behavior end-to-end.
- Gates 3–5: NOT STARTED as acceptance gates; no new feature work until Gates 1 and 2 pass.

## Required report format after each change

1. Root cause or hypothesis, clearly labeled.
2. Exact files and commit SHA.
3. Actions run URL, final status, failed/cancelled job details if applicable.
4. Artifact availability and exact APK identity/version.
5. Automated/emulator/runtime evidence and what remains unverified.
6. Next concrete action. If user-device testing is needed, ask for the exact test and full diagnostic text only after CI and install checks have completed.
