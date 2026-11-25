# Maglev+ 통합 개발 기준 및 재정렬 (2026-11-25)

## 최종 목표
Maglev의 브라우저·토렌트·직접 링크·HLS/DASH·자막·전송 목록을 유지하면서, yt-dlp 기반 YouTube 및 지원 사이트 추출을 한 APK에 통합한다. 앱 전체 한국어 UI를 제공하고 Galaxy 실기기에서 실제 저장·재생까지 확인한다. CI 성공, 화면 진입, 메타데이터 수신만으로 기능 완료를 선언하지 않는다.

## 단일 통합 흐름
- 작업 PR은 PR #1 하나만 유지한다. PR #3/#4는 #1에 적용 후 닫았고, PR #5의 ARM64 패키징은 #1 브랜치에 반영됐다. 새 기능을 PR로 분리해 APK를 반복 생산하지 않는다.
- PR #1의 feature branch를 작업 기준으로 삼고, dev/main에 병합하거나 릴리즈하지 않는다. 사용자가 설치 확인할 APK는 각 검증 게이트를 통과한 하나만 제공한다.
- Universal APK는 기본 생성하지 않는다. 기본 배포는 arm64-v8a; 필요 ABI는 별도 요청/검증으로 추가한다. APK의 debug certificate는 테스트 전용이며 릴리즈 서명은 별도 게이트다.

## 목표 아키텍처
1. URL classifier: magnet/torrent → Maglev torrent; direct file → Maglev link; direct HLS/DASH → Maglev stream; yt-dlp-supported site → ytdlp-engine; unknown page → browser media detection and explicit “이 페이지 다운로드”.
2. `modules/maglev-engine` remains the existing torrent/link/stream native engine and queue owner.
3. New `modules/ytdlp-engine` owns yt-dlp/Python runtime, metadata/formats, download/cancel, progress, updates, FFmpeg/aria2 integration. Do not make YouTube extraction depend on undocumented internal EngineHost calls.
4. Shared transfer interface/adapters register yt-dlp tasks in Transfers with durable IDs, progress, speed/ETA, pause/cancel/retry, completion and file location. Where Maglev queue cannot safely own a Python process, a dedicated foreground dataSync service owns it and exposes the same UI model.
5. Browser detection uses existing Maglev detector first; implement only verified gaps from LJ analysis: Service Worker, fetch/XHR/Resource Timing/DOM media, extensionless media, static-resource filter, headers/cookies, site JSON rules. No duplicate detector implementation.
6. DRM streams are detected and reported clearly; no DRM circumvention.

## Implementation gates (must be sequential)
- G0 Baseline audit: inventory PR #1 source, current upstream diff, existing workflows/releases/tags. Preserve useful history; remove only confirmed duplicate/unreferenced PR branches and redundant workflows.
- G1 Native extractor smoke test: on device, yt-dlp init/version, public video getInfo JSON, format list, process log/error. Must pass before UI work.
- G2 Actual downloader module: standalone Expo module API init/version/getInfo/download/cancel/update; foreground service, safe app-private staging, MediaStore/SAF finalization. Validate public progressive MP4 and audio extraction.
- G3 Transfer integration: one shared Transfers presentation with progress/speed/ETA, pause/resume/cancel/retry, persistence after app restart, correct notification and output file.
- G4 YouTube route: YouTube app/Chrome/Samsung Internet share and paste; watch, youtu.be (scheme and no scheme), Shorts, Live, embed, mobile. Verify URL normalization then route then metadata then transfer.
- G5 Korean localization: app-wide string inventory, central ko-KR resources and key-based translation; screens, dialogs, menus, settings, empty/error/loading states. No hard-coded English in changed user-facing UI; add a leakage test and screen review.
- G6 Browser media detection: compare current Maglev implementation with LJ matrix; add only missing capabilities and regression tests using controlled test pages/streams.
- G7 Feature parity: P0 format/audio/playlist/queue/retry/update; P1 subtitles/metadata/cookies/template/aria2/SponsorBlock/backup; P2 custom commands, trimming/chapter split, schedule, incognito.
- G8 Release QA: JS/typecheck/tests, Rust tests and lint, Kotlin tests, arm64 build, artifact identity/signature/size/16 KB native alignment, emulator install/launch, Galaxy share→extract→format→download→save→play, Korean UI, existing torrent/link/HLS regression.

## Current confirmed status (not a completion claim)
- CI run #45619670719 passed all jobs and built an ARM64 APK, but user installed it and confirmed Korean localization and YouTube download both fail. Therefore this artifact is rejected for functional validation.
- Earlier Rust exit 101 runs were Clippy warnings promoted to errors; unit tests passed. CI Clippy configuration was adjusted.
- Native `io()` wrapper previously hid exceptions with empty messages as generic “Engine call failed”. Diagnostic now exposes sanitized exception/root-cause types; use the next Galaxy log to identify the actual runtime failure.
- Existing YouTube implementation is an incomplete adapter inside maglev-engine. It is not the final architecture and does not yet satisfy ytdlnis functionality.
- Full Korean localization, PO Token provider, real YouTube transfer and Galaxy end-to-end QA remain incomplete.

## Repository hygiene
- Keep one active feature PR and one CI/release workflow per purpose.
- Keep upstream monthly review workflow; it must report upstream changes and never auto-merge.
- Keep CI, emulator/device QA, release workflow, audit and Pages only if actively used. Before deleting any workflow/release/tag, verify references and artifact/release consumers.
- Do not create test releases. Do not publish debug-signed APKs as final releases.
- Update this document and PR #1 body after each verified gate; record exact run URL and artifact only when produced.


## 진행 재개 기록 — CI #148 확인 (2026-11-25)
- Run #148 [45625614864](https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45625614864) / commit `1dea9d0af7a5534ab1b837572394747256f57894`: CI completed successfully. Rust, contract, JS/typecheck, ARM64 + 16 KB alignment, Android APK/signature/version checks, Kotlin unit tests passed.
- Run #147은 후속 run에 의해 취소됨. CI run number #148은 PR number가 아니며, 활성 PR은 Draft #1이다.
- CI 성공은 실기기 기능 합격이 아니다. Galaxy에서 init/version, 공개 영상 metadata/formats, 실제 download/save/playback 확인은 여전히 미수행.
- G0 재점검에서 yt-dlp adapter와 dependency가 `modules/maglev-engine`에 결합되어 있음을 확인. 목표 `modules/ytdlp-engine` 독립화 및 기존 transfer handoff 정리 필요.
- G1 실기기 evidence → G2 isolated engine → G3 persistent shared Transfers → G4 share/paste → G5 Korean audit → G6 LJ gaps → G7 parity → G8 regression/release QA 순서 유지. No release until G8 acceptance.


## G2 scaffold progress (2026-11-25)
- Standalone Expo package and Kotlin native bridge created. TS typecheck and contract test passed on the latest validation attempt; Expo prebuild/autolinking passed. APK compile remains pending.
- Corrected the generated runtime license inventory for local `ytdlp-engine` package.
- APIs currently stage downloads in app-private files and emit progress/completion/failure. This does not satisfy shared Transfers, foreground service, restart persistence, MediaStore/SAF finalization, FFmpeg postprocessing or physical-device QA. Keep G2/G3 open.
