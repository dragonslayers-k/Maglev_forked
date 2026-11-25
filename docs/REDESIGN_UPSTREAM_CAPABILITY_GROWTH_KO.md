# Maglev+ 재설계 및 업스트림 기능 확장 운영 기준

> 작성 기준: 2026-11-26 (KST)
> 저장소: dragonslayers-k/Maglev_forked
> 적용 트랙: PR #1 / feature/p1-video-detection-observer
> 성격: 설계·분석·운영 기준. 이 문서는 기능 완성 또는 실기기 통과를 의미하지 않는다.

## 1. 재설계 결론

Maglev를 단순 UI/큐로 축소하지 않는다. Maglev는 이미 일반 파일 Range 다운로드, 재개·복구, 브라우저 감지, HLS/DASH VOD, 토렌트, Transfers, 저장 및 백그라운드 관리 기능을 제공한다. 검증된 기존 기능은 유지하고, 전문 앱의 강점은 독립적인 capability/provider로 연결한다.

목표는 **한 앱·한 UX·한 Transfers 큐 + 여러 전문 분석/추출/스트림 provider**다. Provider는 내부 구현과 업데이트 주기를 분리하지만 사용자는 엔진 이름을 선택하지 않고 일관된 흐름을 사용한다.

## 2. 원천별 강점과 경계

| 원천 | 흡수할 강점 | 적용 원칙 |
|---|---|---|
| Maglev upstream | UX, 브라우저, URL/파일 감지, Range, HLS/DASH VOD, torrent, queue, storage, resume | 기본 제품 및 공통 Transfers 소유자. 기존 기능 중복 구현 금지 |
| LJ Video Downloader 1.1.79 APK 분석 | WebView/ServiceWorker 요청 관찰, header/cookie/referrer 문맥, probe, 후보 dedupe, 사이트별 규칙 아이디어 | APK는 바이너리 분석 자료. 디컴파일 추정과 직접 확인 구분. 공개 동작을 독립 구현 |
| YTDLnis | format/playlist UX, runtime/package updater, cookies, audio-only, subtitles/metadata/post-process, queue UX | Kotlin/XML 화면 복사 금지. 기능과 runtime 운영 모델만 RN UX로 재설계 |
| yt-dlp | 사이트별 extractor, metadata/formats, playlist, subtitles, audio/video selection, postprocessor | 앱 내 extractor provider. 실제 지원은 번들 버전·runtime에서 확인된 사이트만 표시 |
| youtubedl-android | Android에서 yt-dlp/Python/native runtime 실행 | 실제 artifact/API/ABI 고정 및 runtime compatibility matrix 관리 |
| FFmpeg/ffprobe | 분리 A/V merge, remux, audio extraction, post-processing | 공통 media post-process service로 호출 |
| MPMux Chrome extension | 브라우저 미디어 감지, 정적 파일 Range, HLS VOD/live, MSE SourceBuffer buffer muxer | 공개 기능 benchmark. 코드·비공개 API·바이너리 복제 금지. Android 방식으로 clean-room 구현 |

## 3. 현재 확인된 위험과 설계 변경

1. **yt-dlp runtime은 단순 dependency가 아니다.** Upstream README는 Python 3.11+를 지원 기준으로 제시하며 FFmpeg/ffprobe, yt-dlp-ejs 및 JS runtime을 full YouTube support에 권장/필요 항목으로 설명한다. YTDLnis v1.9.0은 Python 3.14, curl-cffi 및 BGUtils PO Token provider를 package/update 기능으로 소개한다. 기존 youtubedl-android 0.18.1 runtime을 그대로 고정하면 최신 extractor 요구사항과 차이가 생길 수 있다.
2. **YouTube adapter와 전체 yt-dlp 사이트 라우팅은 별개다.** Extractor가 metadata/formats를 반환하고 선택 format을 실제 다운로드해 저장·재생할 때만 해당 사이트를 통과 처리한다.
3. **MPMux 기능 중 Maglev에 이미 있는 기능은 재작성하지 않는다.** Static Range 및 HLS VOD는 기존 Maglev 엔진을 regression test한다. 신규 공백으로 확인된 HLS Live 및 MSE SourceBuffer byte capture만 별도 설계한다.
4. **MSE/DRM 경계.** Capture는 기본 OFF, 사용자 명시적 시작, bounded native staging/backpressure, 파일 회전, A/V timeline 보존으로 구현한다. EME/Widevine/FairPlay 및 보호된 키/세션은 거절하고 우회하지 않는다.
5. **LJ 분석의 불확실성.** APK version/package/hash와 분석 도구 결과를 재확인하고 각 항목을 APK 직접 확인, 디컴파일 관찰, 2차 문서 분석, 가설로 태깅한다. 추정 로직은 fixture 없이 확정 요구사항으로 승격하지 않는다.

## 4. 목표 아키텍처

Maglev+ UX (Browser / Share / Paste / Downloads / Settings)
→ URL + page-context classifier / user-intent gate
→ Media Candidate Observer (Maglev observer + LJ-inspired probe/rules)
→ Capability Router (provider registry, confidence, site/runtime capability)
→ Maglev Link/Range | Maglev HLS/DASH VOD | yt-dlp Extractor | HLS Live/MSE Capture
→ Shared Transfer Contract / EngineHost
→ Maglev Transfers (single queue, state, notifications, retry, pause/resume)
→ Storage + MediaStore + optional FFmpeg post-process

### Provider contract

각 provider는 다음 공통 결과를 반환한다.

- providerId, capabilityId, sourceUrl의 민감정보 제거 표시형, confidence
- MediaDescriptor: title, thumbnail, duration, resolution, codecs, container, bitrate, language
- FormatDescriptor: stable format key, audio/video track IDs, protocol (DIRECT, HLS, DASH, LIVE, MSE_CAPTURE), size estimate, required headers/cookie context
- TransferRequest: selected format, safe request context, output intent, resume strategy, provider/version provenance
- CapabilityResult: SUPPORTED, UNSUPPORTED, PROTECTED, AUTH_REQUIRED, TEMPORARY_FAILURE, EXTRACTOR_FAILURE 및 sanitized diagnostic

Provider는 파일을 독립 큐에 저장하지 않는다. 최종 byte transfer는 기존 Maglev Transfers로 넘긴다. Provider별 process ID는 공통 Transfer ID에 연결해 취소·재시도·복구 상태를 하나로 유지한다.

### Routing policy

1. magnet/torrent → Maglev torrent.
2. 확정 direct file + valid HTTP metadata → Maglev link/Range.
3. 확인된 HLS/DASH VOD → Maglev stream parser/muxer.
4. YouTube 및 yt-dlp 지원 사이트 → yt-dlp provider. Generic extractor는 사용자가 “페이지 분석/영상 추출”을 명시적으로 실행했을 때만 호출.
5. 브라우저에서 직접 media URL이 보이지 않고 사용자가 요청한 경우 → MSE/live provider가 지원 여부 확인.
6. DRM/EME/접근 제한/보호 스트림 → 우회하지 않고 미지원 또는 인증 안내.
7. Provider 실패 시 read-only metadata probe만 fallback 허용. 중복 다운로드나 보호 경계 우회 금지.

## 5. UX 흐름

- Home: 주소 입력, 붙여넣기, 공유 인텐트, 최근 감지 항목 및 진행 중 Transfers.
- In-app Browser: 미디어 감지 tray에 후보 수·유형·해상도·길이·확신도 표시. 오탐 숨기기 및 사이트별 무시.
- Media detail: title/thumbnail, video/audio 선택, playlist item 선택, 저장 위치 및 자막/후처리 옵션.
- Download: 사용자는 엔진 이름을 선택하지 않음. 자동 선택하고 필요할 때만 “다른 분석 방법 시도” 제공.
- Transfers: 모든 provider가 동일한 진행률, pause/resume, cancel, retry, completed/failed, file open/share 사용.
- Failure: 미지원, runtime/사이트 변경, 인증 필요, 보호 콘텐츠를 구분. 로그에서 URL query, Cookie, Authorization, token 제거.

## 6. 업스트림 기능 확장 정책

### 감시 대상

| 프로젝트 | 비교 대상 | 앱 영향 |
|---|---|---|
| Maglev upstream | release/tag, browser observer, transfer/storage API, stream parser, UX | 기반 기능/회귀/새 capability |
| yt-dlp | stable/nightly changelog, extractor changes, dependencies, breaking options | 사이트 지원, format, runtime/JS/POT 요구 |
| youtubedl-android | Maven release, API changes, bundled Python/yt-dlp/FFmpeg/native ABI | Android runtime, init/download/cancel |
| YTDLnis | release notes, package updater, Python/JS/curl-cffi/PO Token | 기능 요구사항과 runtime/package 관리 |
| FFmpeg/ffprobe | release/security fixes, codec/container/mux, Android ABI | merge/remux/format support |
| MPMux | Chrome Web Store version, official feature pages/FAQ | 기능 benchmark, browser capture gap |
| LJ APK/reference | 확보 APK version/hash 및 분석 자료 | detection/probe heuristics regression |

### 정기·이벤트 기반 비교

- 매월 upstream audit 및 release/security/breaking change 발생 시 추가 확인.
- 앱의 현재 pin과 upstream 최신 안정 버전을 비교하고 commit/tag/date/changelog 기록.
- 각 기능을 CURRENT, UPSTREAM_NEW, REGRESSION_RISK, INCOMPATIBLE, NOT_RELEVANT, NEEDS_DEVICE_TEST로 분류.
- 기능 확장은 기존 capability set에 추가하는 방향을 목표로 한다. 기존보다 기능을 줄이는 업데이트는 보안·안정성·법적/라이선스 이유를 명시하고 대체 경로를 평가.
- Update는 자동으로 main/release에 승격하지 않는다. version pin → isolated branch/PR → unit/fixture/contract → emulator → Galaxy E2E → artifact hash → accepted baseline 순으로 검증.
- 기존 기능이 사라지거나 runtime 요구가 높아지는 업데이트는 compatibility shim, feature flag, rollback을 평가. 사용자 기능 축소를 승인받기 전 baseline에서 제거하지 않는다.
- MPMux처럼 소스 비공개 자료는 공개 동작만 fixture로 benchmark하며 코드 복사/비공개 API 의존 금지.
- Audit report는 source URL, version/tag/commit, check date, capability delta, decision, test evidence, rollback ref를 기록한다.

### 기능 비교 기준

- URL/page detection: precision/recall, false-positive, request-context correctness.
- Extractor: site/URL variant, metadata, formats, playlist, subtitle, audio-only.
- Transfer: speed, Range, retry, resume, cancellation, memory, disk staging.
- Stream: HLS VOD/live, DASH, separate A/V, AES-128 identity, discontinuity, MSE buffer.
- Runtime: Python, yt-dlp, yt-dlp-ejs, JS runtime, curl-cffi, PO Token provider, FFmpeg/ffprobe, ABI/page alignment.
- UX: steps to download, format choice clarity, detection tray accuracy, error explanation, Korean localization.
- Reliability: cold start, app kill/restart, network loss, storage full, authenticated page, expired signed URL.

## 7. 기능 상태 및 acceptance

상태는 NOT_STARTED, IN_PROGRESS, CI_PASS, DEVICE_PASS, ACCEPTED, BLOCKED로 기록한다. Build success와 feature success를 혼동하지 않는다.

- CI_PASS: compile, lint/typecheck, unit, contract, native tests.
- DEVICE_PASS: 실제 Android 기기에서 metadata → format select → shared Transfers → saved file → playback 및 background/restart.
- ACCEPTED: regression suite 포함, 설치 가능한 정확한 APK artifact hash 확인, 한국어 UX 검수 완료.
- 사이트 지원 목록은 bundled extractor version과 smoke test date를 표시하고 upstream site count를 앱의 실제 지원 수로 복사하지 않는다.

## 8. 단계별 재설계/작성 계획

1. Baseline inventory: PR #1 head, upstream Maglev base, docs/source tree, CI/artifacts, installed APK/hash.
2. Source audit: Maglev, LJ APK analysis, YTDLnis/yt-dlp/youtubedl-android, FFmpeg, MPMux feature matrix. Evidence grade와 license inventory.
3. Architecture freeze: provider contract, URL routing, shared Transfers lifecycle, browser observer, runtime/package updater, storage/diagnostics.
4. Runtime compatibility: yt-dlp Python/JS/ejs/POT requirements와 Android wrapper/native ABI pin 및 Galaxy smoke test.
5. Provider validation: YouTube, generic extractor, direct, HLS/DASH VOD, separate A/V, LJ-inspired detection 각각 fixture/device test.
6. MPMux gap implementation: HLS Live와 MSE buffer capture만 isolated module로 구현. Static/HLS VOD 재작성 금지.
7. UX polish + localization: detection tray, format chooser, queue, errors, settings, full Korean string audit.
8. Release gate: regression, emulator install/launch, Galaxy E2E, file playback, hash/signature/ABI/page alignment, source/license/notice audit.

## 9. Evidence and license rules

- Maglev is GPL-3.0; fork/distribution must preserve GPL obligations and source availability.
- Each third-party component records repository, license, pinned version, modified status, notices and source obligations.
- MPMux is a functional benchmark only; no proprietary source or binary copying.
- LJ APK reverse-engineering observations are separated from copied code. Do not redistribute APK assets/code unless rights permit.
- YTDLnis feature inspiration does not mean copying its UI, branding or proprietary assets.
- No DRM/Widevine/FairPlay circumvention; no cookies, tokens, signed URL or authorization values in logs/reports.

## 10. Primary references (verify versions during each audit)

- Maglev upstream: https://github.com/Kaos599/Maglev
- Current integration fork: https://github.com/dragonslayers-k/Maglev_forked
- YTDLnis: https://github.com/deniscerri/ytdlnis and https://ytdlnis.org/download
- yt-dlp: https://github.com/yt-dlp/yt-dlp and https://github.com/yt-dlp/yt-dlp/releases
- youtubedl-android: https://github.com/yausername/youtubedl-android
- FFmpeg: https://ffmpeg.org/
- MPMux: https://mpmux.com/ko and Chrome Web Store https://chromewebstore.google.com/detail/mpmux-online-video-downlo/mbflpfaamifmmmkdjkcmpofpccfmlmap?hl=ko
- LJ Video Downloader: user-provided APK/XAPK analysis; version/hash must be re-verified from actual artifact before binary findings are direct evidence.

## 11. Current status

This is a revised architecture and upstream capability-growth policy. It does not claim HLS Live, MSE capture, full yt-dlp site coverage, current YouTube runtime, or Galaxy E2E are implemented. Existing PR #1 remains Draft and must pass current build/device gates before release or accepted baseline.
