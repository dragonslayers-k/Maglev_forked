# Maglev+ 최종 목표 제품 명세 및 작업 기준

> 기준일: 2026-11-26 (KST). 제품 목표와 검수 기준을 정의하는 기준 문서. 요구사항 임의 축소 금지.

## 1. 최종 목표
**Maglev를 기반 앱/UI/다운로드 관리/브라우저/기존 기능의 기준으로 삼고, LJ Video Downloader 수준을 넘어서는 범용 미디어 자동 감지·다운로드 기능과 YTDLnis 계열 온라인 영상 추출·다운로드 기능을 통합한 완전 한국어 Android 다운로더 Maglev+를 개발한다.**

- 제품: Maglev+ / 저장소: `dragonslayers-k/Maglev_forked` / upstream: `Kaos599/Maglev`
- applicationId `com.maglev.plus`, 원본 GPL-3.0 및 라이선스/저작권 고지 유지
- Maglev의 UX와 기존 기능이 기준이며 새 다운로드 기능은 책임별 모듈로 확장해 기존 queue/storage/notification에 통합
- 화면 또는 라이브러리 추가가 아닌 **실제 다운로드 파일 생성·검증**이 완료 기준
- 사용자가 권한을 가진 콘텐츠/서비스가 허용하는 일반 미디어만. DRM, 유료 접근제어, 인증·보호 우회는 제외

## 2. 필수 기능

### A. 기존 Maglev 기능 보존
기존 브라우저, 다운로드 엔진·큐·목록, 저장소, 진행률, 일시정지/재개/취소, HLS/DASH, 자막, 알림, 설정 등 회귀 없이 유지. upstream 수정 반영 시에도 검증한다.

### B. LJ Video Downloader 계열 범용 미디어 감지·다운로드 확장
LJ를 기능 참고 기준으로 독립 구현하며 수동 URL 입력보다 자동 탐지를 우선한다.
- 자체 브라우저 및 Chrome/Samsung Internet 등 외부 브라우저 공유·열기 연동
- DOM video/source, network requests, fetch/XHR, WebView, ServiceWorker, Resource Timing 관찰
- 확장자 없는/dynamic URL도 MIME, response headers, request context 등으로 후보 식별
- MP4/WebM 등 직접 영상, HLS/M3U8, DASH/MPD 식별·분석·다운로드
- 품질/해상도/비트레이트/크기 정보와 스트림 선택
- 분리 오디오/비디오 처리 및 호환 병합, HLS 오디오 트랙/자막 선택(가능한 경우)
- 필요 헤더·Referer·사용자 세션 내 cookie 전달
- 동시 작업, 진행률, 재시도, 오류복구, 취소, 재개
- 합법적으로 접근 가능한 범위의 AES-128 HLS 처리
- 광고·이미지·추적·짧은 세그먼트 오탐 억제, 진단 로그
- 직접 URL 및 M3U8/MPD 수동 입력은 보조 기능

### C. YTDLnis 계열 기능 통합
YTDLnis/yt-dlp의 사용자 기능을 Maglev+ UX에 단계적으로 통합한다. 현재 저장소에는 YouTube 전용 yt-dlp adapter가 있으며 일반적인 1,000+ 사이트 전체 라우팅은 미완료다. wrapper dependency나 metadata 화면만으로 이식 완료로 보지 않는다.
- YouTube 도메인: youtube.com/www/m, youtu.be, Shorts, Live, 정상 공유 URL 인식
- 앱 공유·외부 브라우저 공유·paste·내장 브라우저에서 전용 다운로드 흐름으로 전달
- metadata: 제목, 썸네일, 작성자/채널, 길이, formats
- video/audio-only/merge 가능한 format 분류
- 해상도/품질/codec/container/가능한 filesize 선택
- 허용된 콘텐츠 실제 다운로드, 속도/진행률/상태
- 기존 Maglev queue/storage/notifications에 통합; pause/resume/cancel/retry/complete 관리. YouTube adapter는 선택한 media를 EngineHost.addDownload로 넘기며 별도 queue를 두지 않음
- yt-dlp/runtime init·extract·format listing·download lifecycle 안정화, 원인별 오류와 로그
- cold-start 공유, URL parse, native bridge, format ID 전달, 저장 및 queue 전체 파이프라인 E2E
- 일반 yt-dlp 사이트는 브라우저 메뉴 또는 NOT_A_FILE 상태에서 사용자가 명시적으로 분석을 요청하는 경로 제공
- 지원 형식은 사이트·추출기·런타임에 따라 다르며, format 목록에 나타난 형식 중 Maglev가 처리 가능한 direct/muxed/HLS/DASH만 큐에 등록
- 분리된 고화질 video/audio direct URL의 병합은 별도 mux compatibility gate 통과 전 지원 완료로 표기하지 않음
- playlist/multi-URL은 별도 검증 후 지원
- YTDLnis 브랜드/UI를 복사하지 않고 기능을 Maglev+ UI로 재구현

### C-1. MPMux PC 대체 안내

- 브라우저에서 blob/MSE buffer형 후보 또는 보호된 스트림을 감지했을 때 공식 MPMux 사용 안내와 Chrome Web Store 링크를 제공
- PC Chrome/Edge에서 비암호화 MediaSource/HLS 버퍼를 캡처하는 보조 경로이며 Android Maglev+에 MPMux를 내장한 것으로 표시하지 않음
- DRM/Widevine/FairPlay 암호화·라이선스 보호를 해제하지 않으며 MPMux도 복호화할 수 없다고 명시
- 안내 URL: https://mpmux.com/ko
- Chrome Web Store: https://chromewebstore.google.com/detail/video-downloader-mpmux/mbflpfaamifmmmkdjkcmpofpccfmlmap

### D. 완전 한국어화
앱 전체 사용자 노출 문구 전수 검사: onboarding/permissions, tabs/home/browser/search/share, download queue/status/error/notifications, media detection/format selection/YouTube, subtitles/playback/file management, settings/advanced/help, dialogs/toasts/empty/loading/validation/accessibility. 문장·버튼·설명은 자연스러운 한국어, 고유 프로토콜/코덱/서비스 명칭은 적절히 유지. 번역 누락/영어 잔존 자동 검사와 실제 화면 QA 필요. 일부 번역만 완료로 보고 금지.

### E. Upstream 유지관리
Maglev upstream Release/commit/security/dependencies/features 월 1회 review 목표. 변경·영향·반영/미반영 사유를 기록하고 선택 반영(자동 merge 금지). upstream version/SHA와 적용 commit/date 기록. main은 안정 기준선, feature/PR/CI로 개발.

## 3. 설계 원칙
Detector (browser/network observation), extractor (yt-dlp), protocol download (HTTP/HLS/DASH), mux/post-process를 역할별로 분리하되 기존 Maglev engine/Transfers 큐를 단일 소유자로 유지합니다. YouTube extractor는 getYouTubeInfo / addYouTubeDownload를 통해 기존 EngineHost.addDownload로 handoff합니다. 별도 다운로드 큐·별도 저장소/알림 lifecycle을 중복 구현하지 않습니다. Pipeline: detect/parse → validate → details/format selection → existing transfer creation → progress → file/metadata registration → completion/error. Session/context는 최소 권한; DRM/유료 접근제어 우회 금지.

## 4. 완료 기준 (DoD)
각 기능마다: automated tests/typecheck/build pass; Galaxy device install; Chrome + Samsung Internet share test; 실제 detect/extract/download 파일 생성 확인; file opens/plays and format/path/size verified; error/cancel/retry/resume tested; Maglev regression tests; Korean UI screen audit; CI SHA + APK SHA256 recorded. Release는 signing/version/license/security/SBOM 및 사용자 승인 후.

## 5. 현재 사용자 실기기 결과 (2026-11-25)
- 전체 한글화: 거의 적용되지 않음 → FAIL
- YouTube share URL 인식: FAIL
- YouTube 실제 다운로드: FAIL
- YTDLnis 수준 기능: yt-dlp Android wrapper 및 일부 adapter/UI만 존재; end-to-end 기능 미검증
- 범용 자동탐지 성공률/오탐: 미검증
- Galaxy QA: 미완료

## 6. 재작업 로드맵
**P0 진단/재현:** 설치 APK SHA 확인; share intent → redirect → URL parse → screen → engine readiness → native bridge → yt-dlp init/extract → formats → job/queue → storage trace; CI green과 기능검증 구분; 오류 원인을 숨기지 않고 진단화.
**P1 YouTube/YTDLnis:** 모든 URL/share 경로, cold-start/lifecycle, extraction/format list, selected format ID 전달, 실제 download + queue/storage/progress/cancel/retry, E2E & Galaxy.
**P2 범용 미디어:** 탐지 coverage/false-positive; DOM/fetch/XHR/Timing/WebView/SW; direct/HLS/DASH, quality/audio/subtitle, headers/session, retry/resume/concurrency, diagnostics.
**P3 한국어:** locale/default 확인, 문자열 inventory, 전수 번역, leakage test, 화면 QA.
**P4 Maglev/upstream:** 기존 기능 regression suite, upstream 최신 비교, 선택 sync, 충돌/회귀 확인, sync report.
**P5 릴리스:** clean CI SHA, Galaxy QA, signing/update chain, SHA256/release notes/readme/handoff, 승인 후 merge/release.

## 7. 즉시 수정·CI 기록
- `c3f3912`: YouTube route를 engine-first cold launch 대기 대상으로 추가
- `1ff5ae4`: 해당 계약 테스트
- `ab91a55`: 사용자 실기기 실패/미완료 상태 기록
- Actions `45585266120`: 성공, SHA `ab91a558ae773abce8a8b78f8d3303839ebe0f9d`. 이는 automated CI 성공이며 실기기 YouTube/한국어 기능 성공을 보증하지 않음.

## 8. 개발 규율
요구사항 축소 금지; automated CI와 실제 기능검증 분리; 실패는 실패/미완료로 표기; 매 변경 branch/head 확인·commit·handoff 갱신; main 보호; 불필요한 CI run/cancel 줄이기; 사용자 승인 없는 자동화/merge/release 금지; artifact는 검증 SHA와 일치할 때만 배포.


## 2026-11-25 배포 기준 갱신
- 기본 APK는 ARM64 단일 APK이며 Universal APK 생성은 기본 비활성화한다. PR #5 패키징 변경은 feature 브랜치에 병합되었다.
- Debug signing은 테스트용이다. 정식 배포/업데이트는 고정된 keystore 서명이 필요하다.
- YouTube는 parser, dedicated route, extractor client fallback, HLS/DASH stream queue를 각각 검증한다. PO Token provider와 Galaxy E2E는 아직 완료 조건이다.


## 9. MPMux 기능 비교 및 추가 범위 (2026-11-26)
- Static Range split과 HLS VOD는 Maglev에 이미 존재하므로 신규 모듈을 만들지 않고 hash/회귀/성능 테스트로 확인합니다.
- HLS Live recording은 현재 STREAM_LIVE로 거절되므로 신규 구현 대상입니다. playlist cursor/sequence/stop/finalize/rotation/기존 Transfers 통합이 필요합니다.
- MediaSource buffer capture는 현재 실제 SourceBuffer bytes를 저장하지 않으므로 신규 구현 대상입니다. 기본 OFF, 사용자 opt-in, bounded native binary staging, backpressure, timestamp/track/A/V remux, EME/DRM 거절을 필수로 합니다.
- MPMux 공개 문서와 현 소스 대조는 MPMUX_BENCHMARK_INTEGRATION_KO.md를 기준으로 합니다.
- 완료 상태는 CI_PASS, DEVICE_PASS, ACCEPTED를 구분합니다. 브라우저 진입·metadata·CI 성공만으로 제품 완료를 선언하지 않습니다.

## 2026-11-26 #163 재검토 및 수정 기준
- Actions #163(run `45645790936`)은 automated CI success였지만 사용자가 설치 후 확인한 실제 결과는 전체 한글화 FAIL / YouTube 다운로드 FAIL입니다.
- #163 APK SHA-256: `61362ab5611965194e661fe66926f07e9da1d6e9edccc1c7a2054fe94e5db3de`. 해당 APK는 최종본이 아닙니다.
- 기존 YouTube adapter가 YouTube URL만 받아 일반 yt-dlp 사이트를 분석하지 못했던 점, NOT_A_FILE 화면과 브라우저 메뉴에 일반 yt-dlp 진입점이 없던 점, separate audio track ID 미전달을 수정 대상으로 명시합니다.
- 새 변경의 목표는 기존 Maglev Transfers 큐에 일반 HTTP(S) 페이지의 명시적 yt-dlp 분석을 추가하고, MPMux PC 대안 안내를 제공하는 것입니다. 변경 후 새 CI/Galaxy 검증 전에는 완료로 처리하지 않습니다.
- Python 3.8/yt-dlp Python 3.11+ 호환성, yt-dlp-ejs/JS runtime, PO Token Provider, 실제 YouTube 및 일반 사이트 E2E는 여전히 미검증.


## 2026-11-26 기능 보존 정책 보강
- 원천별 기존 기능을 임의로 제거하지 않습니다. 중복은 공통 구현으로 통합하되, 대체 기능이 검증되기 전까지 기존 고유 기능은 유지하거나 명시적으로 BLOCKED/PLANNED 상태로 기록합니다.
- MPMux Video Buffer Muxer는 화면 녹화가 아니라 MediaSource SourceBuffer 미디어 버퍼를 수집·재패키징하는 기능입니다. 비암호화 MSE capture와 HLS Live를 신규 개발 대상으로 유지합니다.
- EME/DRM 보호 스트림은 감지·분류·오류 안내를 추가하되, Widevine/FairPlay 키/라이선스 추출·복호화·우회는 하지 않습니다. MSE buffer capture도 암호화된 미디어를 복호화하지 않습니다.
- MediaProjection 화면 녹화는 별도 opt-in 기능으로 검토할 수 있지만 DRM/secure surface/HDCP 제한을 우회하는 기능으로 사용하지 않습니다.
- 상세 기준: [기능 보존·다중 엔진 통합·보호 미디어 처리 기준](FEATURE_PRESERVATION_AND_PROTECTED_MEDIA_KO.md).
