# MAGLEV+ 통합 미디어 다운로더 — 최종 기능 복구·이식·검증 실행 기준 v2
작성: 2026-11-28 KST
상태: #702 기준선에서의 실행 명세. 기능 완료/실기기 통과를 주장하지 않음.
기준 문서: `통합_미디어_다운로더_전수조사_종합_설계기준서.md` (사용자 제공, 2026-11-27)

## 0. 사용자 설치 #745 피드백 — 필수 재현 항목
사용자 실기기 설치 결과:
- Browser PiP: “지원 안함”
- Browser capture: “브라우저 녹화는 아직 지원되지 않습니다. 직접 미디어 주소나 HLS/DASH를 확인하세요.”

판정: 이전 변경은 이 요구를 만족하지 못함. 미디어 hit detection 일부 보강은 PiP 구현/브라우저 녹화 구현과 동등하지 않다. #745는 사용자 수용 기준 통과로 취급하지 않는다. 기능 완료는 실제 Galaxy에서 재현 가능한 시나리오를 통과해야 한다.

## 1. Baseline / release control
- 사용자 승인 baseline: CI #702, commit `45e685603a3a23507b61cb49398a78380d5db7a5`, v0.33 ARM64.
- SHA-256: `065d29dfcb19ad630c6bc906bfadecb2bd31395edc707ad3e35cf1f54b10c2de`.
- Preserve baseline and recovery branches. Do not bulk merge PR #1. Keep PR #10 draft until full CI and device acceptance.
- Every PR: exact scope, tests, build artifact, APK hash, device acceptance status, known limitations.
- Never say “done” for CI green alone; distinguish source, compile, automated tests, emulator, and Galaxy device evidence.

## 2. Target architecture from the user’s master design
One intake pipeline:
`URL/share/browser/file → MediaIntake → Normalize → Discovery → Candidate merge → Capability resolver → user choice → EngineRouter → TaskOrchestrator → Scheduler/NetworkPolicy → Transfer → Validate → Process → Storage commit → Library/Playback`

Keep Maglev UI/task/storage/torrent/direct/HLS/DASH baseline where verified. Add adapters, not parallel uncoordinated download implementations:
- Direct HTTP / Range
- HLS and DASH (existing Rust path or Media3 after a fixture-based comparison; select one primary per capability)
- yt-dlp extractor/runtime (versioned JSON contract, isolated process, readiness/timeout/cancel/stderr redaction)
- Browser observer/candidate provider
- Live/recording task provider
- Torrent/magnet existing adapter

Candidate must show source page, resolved resource, MIME, dimensions/duration/bitrate/tracks, provider, confidence, and capability. Keep auth headers/cookies in scoped protected session storage; never log secrets. Blob detection alone is not source extraction.

## 3. Browser media detection / source feature port
Implement an observer, not a “recording” placeholder:
1. DOM video/audio/source + currentSrc + lazy attributes + metadata + playback state.
2. Resource observer: performance entries and fetch/XHR metadata where permitted; capture URL, MIME, response status/length/range, initiator and timestamp.
3. Native WebView observer: shouldInterceptRequest is metadata/request observation only; do not claim it can read arbitrary response bodies.
4. HLS/DASH manifest analyzer: variant/representation, audio/subtitle groups, codecs, duration/live status, segment URI, headers and candidate confidence.
5. Custom player and Shadow DOM traversal; MutationObserver and bounded rescan; debounce/deduplicate and avoid scanning arbitrary page text as media.
6. Blob/MSE: distinguish blob URL from recoverable segment/source. If page-owned MediaSource is opaque, show accurate “source not exposed” status; do not invent a direct URL or claim recording. Provide extractor/manifest fallback when detectable.
7. Candidate tap/long-press opens a unified selection sheet with source, type, quality/tracks, engine, request context and “Analyze / Download / Open / Copy”. No forced immediate download.
8. Route selected candidate through existing download queue; preserve referer, user-agent and required scoped headers. Header forwarding must be explicit and redacted in UI/logs.

## 4. Browser capture / live recording
Separate user-initiated task type from file download:
- states: ready → recording → stopping → finalizing → validating → completed / failed / recoverable.
- start/stop, elapsed time, segment count, bytes, available disk, live manifest refresh, discontinuity, retry, stop reason, finalization progress.
- limits: duration, storage threshold, concurrency, network policy; user confirmation and notification for long-running capture.
- HLS live: playlist polling, media sequence/window, discontinuity, AES-128 where supported; never claim DRM support.
- MSE: only implement page/native bridge capture when an accessible segment/append path is proven and bounded. Must not bypass DRM/EME or protected content. Opaque blob fallback must explain limitation and offer analysis, not the current generic “go find URL” as the sole UX.
- recover after app process death/network loss using manifest fingerprint + completed segment ledger; validate output before commit.
- Use independent provider; MPMux is public-feature reference, not source code. Barrel/LJ are static-analysis references only; implement independently, preserve license/provenance.

## 5. PiP must be real native playback
Current JS has a `pipRequested` compact-layout state and calls `maglevEngine.enterBrowserPictureInPicture(aspectRatio)`; this is not proof the device enters PiP. #745 failure means inspect the native method and runtime conditions end-to-end.
Required path:
- Verify Android manifest Activity supports PiP, Android API/target flags and Samsung behavior.
- Native Activity enters PiP only with valid visible/playing video and supported lifecycle; provide clear native refusal reason.
- Browser WebView must preserve playback and view ownership during Activity resize/background; do not unmount/pause the active tab on PiP transition.
- PiP aspect ratio from the active visible playing element, not largest discovered ad/preview. Include active element identity and playback state.
- Native callbacks: entering, mode changed, exiting, failed; JS compact chrome follows native PiP mode callback, not optimistic request flag.
- On exit restore full browser chrome/focus and playback; back/home/tab changes must not strand compact UI.
- If WebView PiP cannot be supported reliably on a device, provide in-app Media3 playback of the resolved media candidate with native MediaSession/PiP. Do not label unsupported as a successful PiP feature.
- Acceptance: active video enters PiP from browser/menu, continues playback/audio, resize/layout stable, return restores page, stop exits cleanly, portrait/landscape, Samsung One UI, API-supported emulator.

## 6. Subtitles — Korean-first provider architecture
Add a dedicated “자막” workflow reachable from video details, player and download task:
- search by exact title + year + season/episode + release/filename; optionally hash-based match when file exists.
- Korean (ko/kor) priority, show language/provider/format/sync/HI/forced/quality; user can change language and providers.
- providers as adapters, not hardcoded site scraping:
  1. GOM Lab Subtitle Home: Korean search link/provider adapter, use supported public page/API behavior and terms; do not assume undocumented endpoints.
  2. OpenSubtitles Korean: official API adapter where API credentials/terms permit; link to Korean UI `https://www.opensubtitles.org/ko` for fallback. Respect quotas, auth, attribution and provider response.
  3. Add configurable providers only after source/API/terms review. Provider failure must not hide other results.
- Search result download: verify archive safely, reject path traversal/zip bombs, extract only subtitle formats, sanitize filenames, save beside media or app subtitle folder; record source and license/attribution where available.
- Formats: SRT, VTT, ASS/SSA, TTML/DFXP; convert only with tested parser. Language tag `ko-KR` / `kor`.
- Player: load external subtitle, select track, delay +/- ms, encoding fallback/UTF-8, size/style, remember per file.
- Download selection: sidecar default; mux/embed soft subtitle when container supports; burn-in only after explicit user choice and FFmpeg capability check. Preserve original file; write new output to temp then validate/commit.
- HLS/DASH subtitle tracks: list manifest-provided tracks and route through stream adapter.
- No “Korean supported” claim until Korean query, results, download, attach/play and sync are tested on device.

## 7. Korean lyrics and audio metadata
- Add a lyrics/metadata panel in audio detail/player: track title, artist, album, duration, tags, artwork and lyrics availability.
- Search Korean title/artist aliases and Hangul normalization; display provider and source link.
- Use licensed/official APIs or user-supplied LRC/TXT/SRT. Do not scrape or redistribute full copyrighted lyrics without provider authorization.
- Support timed LRC sidecar and synced display; allow local lyrics import, offset adjustment and save alongside audio.
- Embed metadata/lyrics only when format and provider/license permit; otherwise sidecar. Keep original audio untouched; tag-write to a copy/temp and validate.
- Provider adapters must return source, language, license/terms status, plain/synced format, confidence and attribution. Korean-first defaults with fallback language.
- Include Korean search tests with mixed Hangul/English titles, spacing, punctuation, artist/title swaps and romanized aliases.

## 8. PIP, playback, subtitle, lyrics and downloads share one media identity
Media asset identity should link:
- discovery candidates and source page
- selected video/audio/quality/subtitle tracks
- download/recording tasks and output file
- player resume position, external subtitles, lyrics and metadata
- diagnostics and source/provider attribution

Avoid separate unrelated screens and duplicate task records.

## 9. Required source audits / port map
Before porting each upstream feature, record source URL + exact tag/commit, license, file/class/method evidence, feature behavior, dependencies, changes ported, tests, and whether it is source-verified or static/reference-only.
- Maglev upstream: preserve base shell and existing proven engines.
- yt-dlp / YTDLnis: extractor/format/audio/subtitle/playlist/runtime features through isolated adapter.
- Barrel: smart connect, media recognition, playback/download while watching, MSE/HLS/DASH behavior as independently implemented requirements; supplied APK is static evidence, not source.
- LJ: request/manifest/stream behavior from supplied XAPK is reference only.
- MPMux: static Range, HLS, live recording, buffer mux public feature reference; no source repository assumed.
- Media3: playback, MediaSession, PiP and track selection candidate; compare with Maglev before selecting duplicate parser/engine.
- WireGuard: keep user-confirmed working path unchanged; network route coverage tests per engine.

## 10. Repository and release hygiene
- Keep the #702 baseline, recovery audit docs, historical PRs and artifacts. Do not delete history without approval.
- Maintain one active implementation branch and scoped Draft PRs; do not create PRs that stack large unrelated changes.
- Keep docs/roadmap, source registry, test fixtures, PR body and CI acceptance evidence synchronized.
- Add Korean UI strings to centralized localization; no raw English fallback for user-facing failure messages.
- On every candidate APK: CI run URL + head SHA + jobs actually run/skip + APK hash + ABI/version + install/device checklist.
- CI pass is not Galaxy acceptance. Never release until full CI and device checklist pass.

## 11. Release acceptance gates
A release candidate is acceptable only when:
- [ ] Existing #702 features preserved; WireGuard connect/disconnect and YouTube quality/audio download pass on Galaxy.
- [ ] Browser detects direct MP4/WebM, HLS, DASH, audio, lazy/custom/shadow player, and gives honest source/capability state.
- [ ] Selected browser candidate downloads through shared queue with quality/track options and headers.
- [ ] Live recording start/stop/finalize/recovery validated on a supported test stream.
- [ ] PiP actually enters/continues/exits/restores on device; no “unsupported” for declared supported target.
- [ ] Korean subtitle search providers, download, attach/play, timing and optional mux/burn tested.
- [ ] Korean lyrics search/local import/LRC sync and metadata sidecar tested.
- [ ] Complete Korean UI audit, source/license inventory, runtime/update rollback and privacy/log redaction.
- [ ] Full CI, APK signature/version/ABI, install, device acceptance, artifact SHA and release notes recorded.

## 12. Immediate execution order
1. Reproduce #745 PiP refusal and trace JS → native bridge → Android Activity/manifest → WebView lifecycle; fix one end-to-end path.
2. Replace generic browser capture refusal with capability-aware analysis and source/manifest candidate UI; implement supported HLS live capture provider and task lifecycle.
3. Implement Korean-first subtitle provider/search/download/player integration (GOM + OpenSubtitles adapter/fallback).
4. Implement Korean lyrics provider/local LRC and metadata integration.
5. Port Barrel/YTDLnis/Maglev source features selectively with source evidence and tests.
6. Run full CI and Galaxy acceptance, update repo docs/PR/artifact. No baseline promotion until all gates pass.
