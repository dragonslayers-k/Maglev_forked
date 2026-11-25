# Maglev+ 통합 개발 기준 및 재정렬 (2026-11-26)

## 최종 목표
Maglev의 브라우저·토렌트·직접 링크·HLS/DASH·자막·전송 목록을 보존하면서 YouTube 및 yt-dlp 지원 사이트 다운로드를 같은 APK에 통합합니다. MPMux의 정적 파일 분할, HLS VOD, 라이브 녹화, MediaSource 버퍼 캡처를 기능별로 비교하되 기존 Maglev 구현과 겹치는 기능은 재작성하지 않습니다. Galaxy 실기기에서 실제 저장·재생·백그라운드 복구까지 확인하기 전에는 최종본으로 선언하지 않습니다.

## 단일 구현 원칙
- PR #1과 `feature/p1-video-detection-observer`를 유일한 구현 트랙으로 유지합니다. `main`은 upstream Maglev 기준선으로 보존하고 `dev` 또는 릴리즈로 임의 병합하지 않습니다.
- 기존 Maglev 엔진을 큐 소유자로 유지합니다. torrent, link, HLS/DASH, YouTube 모두 하나의 Transfers 목록과 네이티브 작업 상태를 사용합니다.
- 기본 배포 ABI는 arm64-v8a이며 universal APK는 기본 산출물로 만들지 않습니다.
- CI 성공은 빌드/정적 검증 통과일 뿐, 사이트별 추출·다운로드·저장·재생 성공의 증거가 아닙니다.
- 설치용 APK는 정확한 Actions artifact, commit SHA, ABI, 서명, APK SHA-256을 확인한 뒤 전달합니다.

## 확정 아키텍처
1. URL classifier: magnet/torrent → Maglev torrent; direct file → Maglev link; HLS/DASH → Maglev stream; YouTube URL → 기존 Maglev YouTube extractor; 그 외 지원 사이트 → 사용자가 명시적으로 요청했을 때 yt-dlp.
2. `modules/maglev-engine`은 기존 torrent/link/stream과 Transfers 상태를 소유합니다.
3. YouTube adapter는 `modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/YoutubeDownload.kt`에 이미 있습니다. `MaglevEngineModule.kt`의 `getYouTubeInfo`와 `addYouTubeDownload`는 yt-dlp로 포맷을 조회하고 선택한 URL/playlist를 `EngineHost.addDownload`로 넘깁니다.
4. UI는 `maglevEngine.getYouTubeInfo()` 및 `maglevEngine.addYouTubeDownload()`를 사용합니다. 추가된 작업은 Transfers의 기존 pause/resume/retry/remove, 진행률, 알림, 영속화 정책을 사용합니다.
5. 별도 `modules/ytdlp-engine` 프로토타입은 같은 yt-dlp 런타임을 중복 연결하고 별도 staging·진행·완료 상태를 만들어 이중 큐 위험이 있어 제품 의존성 및 autolinking에서 제외합니다. 실험 이력은 Git commit으로 보존합니다.
6. 브라우저는 기존 Maglev 감지기를 우선 사용합니다. WebView request observer, active-tab ServiceWorker observer, DOM media, fetch/XHR, Resource Timing을 중복 구현하지 않습니다.
7. DRM/Widevine/FairPlay 또는 표준 MediaSource 버퍼가 아닌 보호 콘텐츠의 우회는 범위 밖입니다. 감지 시 미지원 원인을 표시합니다.

## MPMux 벤치마킹 결과와 구현 결정

| 기능 | MPMux 공개 동작 | 현재 Maglev 소스 대조 | 결정 |
|---|---|---|---|
| 정적 MP4/WebM/Ogg | HTTP Range 분할, 최대 3개 병렬 요청, 완료 후 파일 저장 | Rust link engine은 8 MiB 이상, Range 206 확인, 강한 ETag/Last-Modified 검증 후 최대 8개 segment로 offset-write. sidecar 재개, 429/503 대기·동시성 축소, validator 변경 시 단일 연결 fallback | **이미 구현. 재작성 금지.** 현재 설정/기기 성능/fixture를 검증 |
| HLS VOD | playlist/segment 수집, 병렬 요청 최대 3개, MP4 재패키징 | HLS/DASH parser, segment 수집·재개, 분리 오디오/비디오 선택 및 StreamMuxer가 존재. 표준 AES-128 identity 지원, SAMPLE-AES 등 보호 방식은 거절 | **이미 구현. 재작성 금지.** 회귀 및 오디오/화질 선택 검증 |
| HLS Live | 실시간 playlist/segment를 순차 수집, 약 2 GB 단위로 파일 분할 | 현재 parser는 ENDLIST 없는 live media playlist를 STREAM_LIVE로 거부 | **신규 구현 대상.** playlist polling, sequence cursor, Stop/Finalize 및 파일 회전 |
| Video Buffer Muxer | HTML5 MediaSource SourceBuffer 버퍼 데이터를 수집해 fragmented MP4 등을 재패키징; VOD/live 가능 | Maglev는 Blob/MSE 징후를 알릴 뿐 appendBuffer의 실제 byte를 파일로 보관하지 않음 | **신규 구현 대상.** 사용자 opt-in, bounded capture, A/V remux, DRM 거절 |

MPMux는 정적/HLS VOD에 최대 3개 요청을 사용하고, live는 실시간이므로 병렬 설정을 쓰지 않는다고 설명합니다. Video Buffer Muxer는 화면 녹화가 아니라 MediaSource 표준 미디어 버퍼를 받으며, 메모리 문제로 약 1GB 단위 분할 저장을 설명합니다. 암호화되거나 비표준 버퍼는 올바른 결과가 아닐 수 있습니다. Maglev는 기능 동작만 벤치마킹하고 MPMux 코드·바이너리·상표·비공개 API를 복제하지 않는 clean-room 구현을 원칙으로 합니다.

## 신규 기능 설계 규칙

### HLS Live
- 기존 VOD parser와 분리된 live state machine을 추가합니다.
- `EXT-X-MEDIA-SEQUENCE`로 중복을 제거하고 `TARGETDURATION`, `EXT-X-MAP`, `BYTERANGE`, `DISCONTINUITY`, key rotation 및 timestamp를 보존합니다.
- live는 순차 수집을 기본으로 하며 무리한 병렬 요청을 하지 않습니다.
- 사용자 Stop 시 신규 segment를 멈추고 현재 파일을 flush/remux/finalize합니다.
- 네트워크 단절 후 playlist window에서 사라진 segment는 복구 불가로 기록하며 정상 완료로 위장하지 않습니다.
- 파일 회전은 약 1 GiB 또는 저장공간 임계치 기준으로 설계하고, staging/sidecar를 통해 앱 메모리에 대용량 버퍼를 두지 않습니다.
- 앱 재시작 복구는 cursor 및 원본 playlist 상태가 유효한 경우에만 가능하다고 표시합니다.

### MediaSource Buffer Capture
- 기본 OFF, 브라우저의 명시적 사용자 동작으로만 시작합니다.
- `MediaSource`/`SourceBuffer`의 `addSourceBuffer`, `appendBuffer`, `remove`, `abort`, `changeType` 및 timestamp/track 변경을 관찰하되 페이지 재생 동작을 바꾸지 않습니다.
- SourceBuffer별 MIME/codecs, init/media fragment, append 순서, timestampOffset, appendWindow, discontinuity를 보존합니다.
- 전체 버퍼를 JS heap/JSON/base64로 모으지 않습니다. bounded chunk + backpressure로 네이티브 staging 파일에 순차 기록합니다.
- 별도 audio/video track은 타임라인 정보를 유지하고 검증된 remuxer로 결합합니다. 재인코딩은 기본값으로 하지 않습니다.
- 약 1 GiB 또는 저장공간 임계치에서 파일을 회전하고 완료된 조각을 안전하게 보관합니다.
- EME/encrypted key-system/명확한 DRM 신호가 있으면 중단하고 미지원 안내를 합니다. 키 추출·복호화·DRM 우회는 하지 않습니다.
- 재생속도 5배 강제나 페이지 화질 조작은 하지 않습니다.

## 구현 게이트
- G0 Baseline: PR #1, feature branch, upstream diff, workflow, artifact, app ID/ABI/signature 확인.
- G1 YouTube native smoke: Galaxy에서 yt-dlp init/version, 공개 영상 metadata/formats, 제한 영상 오류 원인 확인.
- G2 YouTube UI/queue: YouTube 공유·붙여넣기 → 포맷 선택 → 기존 Transfers 등록 → pause/resume/retry/remove/재시작 복구/저장 검증.
- G3 한국어 UI: 변경 화면과 공통 오류·로딩·빈 상태까지 ko-KR 검사.
- G4 기존 미디어 회귀: direct link, Range split, HLS VOD, DASH, 분리 오디오, AES-128, torrent, 브라우저 감지.
- G5 MPMux static/HLS matrix: 기존 코드가 실제로 충족하는지 fixture로 확인. 중복 구현 금지.
- G6 HLS Live: polling, sequence, Stop/Finalize, 파일 회전, 공통 Transfers, process restart.
- G7 MSE Buffer: opt-in, bounded capture, A/V sync, 저장공간 복구, EME 거절, 기기 재생.
- G8 사이트 호환: YouTube watch/youtu.be/Shorts/live, Chrome/Samsung Internet 공유, 기타 yt-dlp 지원 URL.
- G9 Release QA: JS/typecheck/tests, Rust tests/lint, Kotlin tests, arm64 APK, 16 KB alignment, signature/hash, emulator launch, Galaxy E2E 및 기존 기능 회귀.

## 현재 검증 상태 — 2026-11-26
- #159 / run `45639676759`는 `app/youtube-download.tsx:27`의 리터럴 `\\n` 구문 오류로 실패했습니다. commit `2458a27e6ee79ce511865d3d6864538e7013ed2e`에서 줄바꿈과 View import를 수정했습니다.
- commit `2a5d1b8fde95bff01e53eb367b9667fcaab2c871`에서 YouTube UI를 기존 Maglev API/shared Transfers에 연결하고 source-contract 테스트를 추가했습니다.
- 해당 commit의 run #161 / ID `45643449600`은 JS, contract, Rust tests, ARM64 Rust/16 KB alignment가 통과했고, 이 기록 시점에는 APK Gradle build가 진행 중이었습니다.
- 빌드와 실기기 YouTube 실제 저장·재생 여부는 별도 검증이 필요합니다. 이 문서만으로 최종 또는 device-pass를 선언하지 않습니다.

## 저장소 관리
- Draft PR #1 하나의 통합 흐름을 유지합니다.
- 중복 실험 모듈은 package dependency, lockfile, license inventory에서 제거하고 이력을 Git으로 보존합니다.
- CI/QA/Release workflow는 목적별로 유지하며 중복 workflow/시험 release를 늘리지 않습니다.
- CI_PASS, DEVICE_PASS, ACCEPTED를 구분하고, 확인되지 않은 기능을 완료로 표시하지 않습니다.
