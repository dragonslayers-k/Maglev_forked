# MAGLEV+ Downloader — Recovery & Rebaseline Audit
- Date: 2026-11-27 (KST)
- Status: **Recovery checkpoint / no feature code changed**
- Purpose: prevent further regression; preserve current work and establish a source-evidence-driven restoration plan.

## 0. Immediate protective action
- PR #1 was converted back to **Draft** during this recovery checkpoint. It remains open and unmerged.
- No branch, commit, release, workflow, APK, or application source was deleted or rewritten.
- New branch `recovery/2026-11-27-rebaseline` was created from current feature head `6a03adf6b3e6b6fc41fa32c039a04a60b0d38a6e` so the complete current implementation snapshot remains available for forensic comparison.
- This recovery branch is documentation/audit only. Do not merge it until the recovery matrix and baseline are approved.

## 1. Source materials re-opened / evidence inventory
The project materials are treated as source evidence, not as proof that every described feature is implemented:
1. User-supplied Claude kickoff `종합 다운로더 APK 개발 착수 문서.md` (WP0–WP7, initial architecture, LJ behavior analysis, YTDLnis priorities, youtubedl-android API sketch).
2. Earlier `통합 미디어 다운로더 총괄 개발 가이드.md` and generated `Maglev_종합_개발착수_인계기준서.md`.
3. New user-supplied `통합_미디어_다운로더_전수조사_종합_설계기준서.md` (97,285 bytes; sections on source inventory, S1–S5 evidence grades, architecture, intake/candidates, capability routing, direct/range, HLS/DASH, runtime/package manager, processing, playback/PiP, app-local WG/proxy, smart connect, diagnostics, CI/release, ADRs and WP gates).
4. `Video-Downloader-Preflight.zip` document set referenced in the master audit: FEATURE_REQUIREMENTS, ROADMAP, UPSTREAM_MAGLEV_AUDIT, QA_SECURITY_PLAN, LICENSE_AND_PROVENANCE, LJ_XAPK_ANALYSIS.
5. `Barrel_1.1.2_APK_심층분석_다운로드기능_이식설계서.md` and original `배럴_1.1.2.apk`; static evidence and proposed behavior are not runtime proof.
6. `Barrel_1.1.2_SmartConnect_기능구조_이식명세.md`; OFF/AUTO/ALWAYS, per-site/client route policy and fallback semantics.
7. `App_Local_WireGuard_Proxy_Integration_Deep_Report_KO.md`, `App_Local_WireGuard_Proxy_Porting_Guide_KO.md`, `BitChord_NordVPN_Offline_Conf_Converter.html`.
8. LJ Video Downloader 1.1.79 XAPK (actual archive inventory/hash previously checked); Claude's decompilation details remain separate from the archive-level facts.
9. MPMux public website/Chrome listing and static/HLS/live/buffer-mux descriptions; no source code presumed available.
10. Maglev upstream v0.33, fork, PR/Actions/issues, user-provided Galaxy screen recordings/APKs, YTDLnis source and package ecosystem, yt-dlp, youtubedl-android, Laya, BitChord and Morphe WG patch references.

Evidence rules: S1 source code, S2 official README/release, S3 APK/static evidence, S4 design proposal, S5 target-device verification. A static class/string, CI green, or APK build is never S5.

## 2. Repository snapshot — directly checked
- Repository: `dragonslayers-k/Maglev_forked`.
- `main` and `dev`: both point to upstream Maglev v0.33 baseline `baaf83f0f3afd65d2eac135cce8b8bbabea8fbb3`.
- Current feature head: `6a03adf6b3e6b6fc41fa32c039a04a60b0d38a6e`.
- PR #1: 740 commits shown by GitHub, 230 changed files, +16,689 / −2,516; open, now Draft, base `dev`. This is a very broad integration diff, not a safe merge candidate without file-by-file audit.
- PR #7 and #9 are closed; their source branches remain. PR #3/#4/#5 are closed/superseded; their branches remain. No branch deletion performed.
- Latest CI #737 / run `46015051889`: JS/typecheck/tests, contracts, Rust/WG tests, ARM64 native build, APK build/signature/version checks all succeeded. It produced a build candidate; it does **not** override user runtime rejection or prove Galaxy acceptance.
- Prior user-installed #727 was explicitly rejected: WireGuard startup error, playback/PiP regression. #728 failed WG lifecycle test timeout and APK was skipped. #735 failed TypeScript; #736 failed stale PiP contracts and APK was skipped; #737 corrected those assertions and CI passed. Test assertion correction is not runtime repair.
- PR #1 includes unrelated/scope-wide changes (e.g. Assistant screens removal, Updates screen rewrite, branding/locale edits, downloader, browser, player, WG, workflows, large docs). Each must be justified against baseline and user requirements; do not assume all are wanted or safe.

## 3. User-verified behavior ledger (highest priority)
### Known positive / preserve
- User confirmed WireGuard ON/OFF worked on their device at #682; this was a scoped lifecycle pass, not proof of all egress clients.
- #707 commit `2ed8d64af6cb98c7f132006352b661cde14c36fc` is the source comparison point documented as the Galaxy-accepted WireGuard lifecycle/browser-route baseline. Preserve its independent tunnel start, rollback, proxy challenge/browser routing, native diagnostics and peer status path until a tested replacement exists.
- Preserve upstream Maglev browser, torrent, direct downloads, queue/storage, existing HLS/DASH and UX unless baseline tests prove a specific regression and replacement passes.

### Known failures / do not mark complete
- #644/#648/#671 reported `The download engine couldn't start`; exact native cause must be retained from logs, not hidden.
- #671/#673 reported reqwest proxy URI parse failure for credential-bearing loopback HTTP proxy. A source fix was committed, but route/client coverage still needs tests.
- #727 user reported WG failure, playback/PiP regression and worse playback compatibility.
- Media detection repeatedly showed MSE notice without a real downloadable item. MSE observation/URL heuristics are not actual appendBuffer byte capture, segment assembly or playable output.
- PiP repeatedly showed black/partial/wrong content; direct Activity PiP or fixed 16:9 is not a valid media-surface handoff. Real active video, fullscreen/custom surface, playback continuity and return must be tested.
- YouTube share/youtu.be, format selection, actual output and full Korean UI were earlier rejected. Keep these as acceptance blockers until reverified on exact APK.

## 4. Source-level regression findings already documented
Compare current feature head with #707 before changing anything:
1. WG enable path was changed to require `EngineHost.ensureStarted()` before starting NativeTunnel, introducing a dependency absent from the working baseline.
2. WebView `ProxyController` route / authenticated loopback challenge / rollback path was removed or reduced in current controller.
3. Native start exception and peer handshake/RX/TX diagnostics were swallowed or reduced.
4. PiP video-aware fullscreen/custom-view handshake from #707 was downgraded in #727 to direct fixed-ratio Activity PiP; user reported actual video surface broken.
5. WG integration test was expanded from bounded low-concurrency/no-keepalive setup to 8 parallel keepalive requests × 3 rounds and timed out in gVisor shutdown. The bounded #707 setup was restored in `6f22a142d5fc47dde69c4cc76baa00f11e8e252a`; verify current source/tests.
6. Media-hit bridge mismatch was fixed in commits `8add3d20...` / `984d8c59...`; retain those fixes only if native tests confirm.
7. Later MSE code remains candidate observation/heuristics; do not label it capture/download.

## 5. Recovery classification policy
Every changed file in PR #1 and every feature branch commit is assigned one of:
- **KEEP**: demonstrably working or upstream behavior that must remain.
- **RESTORE**: regression against user-verified baseline.
- **REPAIR**: desired behavior but implementation faulty.
- **REFACTOR**: correct behavior, wrong coupling/ownership.
- **REFERENCE ONLY**: static evidence/design not copied as code.
- **REMOVE LATER**: demonstrably unrelated/duplicate/dead, only after dependency and baseline tests.
- **UNKNOWN**: not tested; cannot be promoted.

No blanket revert, no blanket merge, no deletion based only on branch name or CI status.

## 6. Target architecture (approved direction pending ADRs)
`MediaIntake → Discovery Providers → Candidate Registry → Capability Registry → Engine Router → Unified Task Orchestrator → Scheduler → Network Policy/ClientFactory → Engine Adapter → Validate → Process → Atomic Storage Commit → Library/Playback`.

Adapters: existing Maglev Torrent; Direct/Range; HLS; DASH; Extractor runtime (yt-dlp/YTDLnis-inspired); browser candidate observer; Media3 playback; media processing; app-local WireGuard/proxy. Protocol parsers remain separate; task lifecycle, retry, storage, diagnostics are shared. Orchestrator alone owns final task state. No engine directly writes final library files or mutates UI state.

Network constraints:
- App-local WireGuard .conf route is limited to the app's browser/downloader clients explicitly supported.
- Never alter system-wide VPN, APN, or other apps' traffic.
- WireGuard+AdGuard remains a separate product/feature.
- Smart Connect OFF/AUTO/ALWAYS is a policy resolver, not tunnel code.
- No silent Direct fallback when a user-required proxy/tunnel fails; fail closed and show recoverable state.
- Each client (WebView, Rust/reqwest, OkHttp, Media3, extractor process, FFmpeg, torrent TCP/UDP) needs separate route/e2e proof.

## 7. Work order — freeze scope, restore, then build
**R0 — Protect:** PR #1 stays Draft; preserve branches/artifacts; no release/tag/main/dev mutation.
**R1 — Baseline inventory:** enumerate every PR #1 changed file, all commits, workflows, dependencies, native modules, APK artifacts and user recordings. Hash/source-link each artifact; classify each file KEEP/RESTORE/REPAIR/REFACTOR/REFERENCE/REMOVE/UNKNOWN.
**R2 — Golden tests:** extract user-verified workflows into repeatable tests: app launch; Maglev torrent/direct/queue/storage; WG ON/OFF and startup rollback; browser proxy route; existing stream handling; active video PiP; localization smoke.
**R3 — Restore regressions:** first restore #707 WG lifecycle/browser proxy/status/diagnostics and #707 PiP surface handshake; fix only with focused tests. Do not stack MSE, Media3, new runtime and UI redesign in same patch.
**R4 — Core download contract:** intake, candidate, capability, task state machine, Range/resume identity, retry, validation, atomic storage. Preserve old engine behind adapters.
**R5 — Media providers:** HLS/DASH primary engine selected by measured Maglev-vs-Media3 comparison; metadata/track/quality selection; output inspection and playable-file tests.
**R6 — Extractor:** runtime compatibility proof (yt-dlp, Python/JS/EJS/PO token as applicable), stable package pin/update/rollback, share→metadata→format→download→save→play.
**R7 — Browser/LJ/MPMux/Barrel:** implement only verified behavior gaps: header/session context, MIME/manifest discovery, Range/segment resume, HLS AES-128 where lawful and supported, mux/metadata, MSE/Blob only with actual byte capture/finalization. Protected/DRM streams are not bypassed.
**R8 — Playback:** Media3 Player + MediaSessionService + background + PiP, independently from download service; actual surface continuity and portrait/landscape acceptance.
**R9 — Network:** app-local WG/proxy and Smart Connect after task/network contracts stabilize; per-client egress matrix.
**R10 — Localization/release:** full Korean UI/diagnostics, regression matrix, signed APK, artifact hash, SBOM/license notices, Galaxy evidence. Release only after every P0/P1 gate and scoped P2 network tests pass.

## 8. Mandatory evidence and reporting
For each change report: exact baseline/head SHA, files changed, reason, preserved behavior, tests run and results, skipped tests, artifact identity, known limitations. CI build success, emulator smoke, and Galaxy E2E are separate statuses. Never ask the user to install a candidate unless it contains a concrete fix and internal validation passed; give exact Actions run and APK artifact.

## 9. Next immediate action
Start R1 against the recovery branch snapshot and #707 reference: create a file-by-file change ledger for all 230 PR #1 files and a commit-level ledger for the 740 listed commits; identify the minimal set of known-good code paths and exact regressions. Do not write application code until this ledger and golden tests exist.

## 10. Latest user-provided Galaxy screen recording — direct evidence

Materialized and inspected the Library video `Screen_Recording_20261127_183013_Maglev+.mp4`:
- Duration: 22.274156 seconds; 1080×2340.
- SHA-256: `12f931f2c9577ab56a03094bd35856382d80a43a85c42dfb7d2f1ea9b9243f2d`.
- The recording shows YouTube page in the app browser and the media candidate tray. During PiP transition around 16 s, the video appears in an oversized black PiP surface with large black regions and incorrect content layout. At around 18–20 s on the launcher, the PiP surface is black with no visible video frame. This is direct evidence that the recorded build fails video PiP continuity; it is not a pass.
- A user-library ARM64 APK `app-arm64-v8a-release(1).apk` was also materialized: 63,655,235 bytes, SHA-256 `31e48a24219bad8b3d56f9aef4e8f4b44a11369174cf7618b216da9f1a1c8b66`. Its run/commit identity was not independently established from the APK, so do not label it as #737 or any other CI run without matching metadata.

This screen recording should be attached to the PiP golden test as a failing reference. Acceptance requires video frames continuing in the PiP window on home screen, correct aspect/crop, no black surface, rotate/return, and a playback state tied to the same active video.
