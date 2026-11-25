# Maglev+ 최종 목표 제품 명세 및 작업 기준

> 기준일: 2026-11-25 (KST). 제품 목표와 검수 기준을 정의하는 기준 문서. 요구사항 임의 축소 금지.

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
YTDLnis/yt-dlp 기능을 Maglev+ UX에 통합한다. 현재 wrapper dependency만 추가한 상태를 이식 완료로 보지 않는다.
- YouTube 도메인: youtube.com/www/m, youtu.be, Shorts, Live, 정상 공유 URL 인식
- 앱 공유·외부 브라우저 공유·paste·내장 브라우저에서 전용 다운로드 흐름으로 전달
- metadata: 제목, 썸네일, 작성자/채널, 길이, formats
- video/audio-only/merge 가능한 format 분류
- 해상도/품질/codec/container/가능한 filesize 선택
- 허용된 콘텐츠 실제 다운로드, 속도/진행률/상태
- Maglev queue/storage/notifications에 통합; pause/resume/cancel/retry/complete 관리
- yt-dlp/runtime init·extract·format listing·download lifecycle 안정화, 원인별 오류와 로그
- cold-start 공유, URL parse, native bridge, format ID 전달, 저장 및 queue 전체 파이프라인 E2E
- playlist/multi-URL은 별도 검증 후 지원
- YTDLnis 브랜드/UI를 복사하지 않고 기능을 Maglev+ UI로 재구현

### D. 완전 한국어화
앱 전체 사용자 노출 문구 전수 검사: onboarding/permissions, tabs/home/browser/search/share, download queue/status/error/notifications, media detection/format selection/YouTube, subtitles/playback/file management, settings/advanced/help, dialogs/toasts/empty/loading/validation/accessibility. 문장·버튼·설명은 자연스러운 한국어, 고유 프로토콜/코덱/서비스 명칭은 적절히 유지. 번역 누락/영어 잔존 자동 검사와 실제 화면 QA 필요. 일부 번역만 완료로 보고 금지.

### E. Upstream 유지관리
Maglev upstream Release/commit/security/dependencies/features 월 1회 review 목표. 변경·영향·반영/미반영 사유를 기록하고 선택 반영(자동 merge 금지). upstream version/SHA와 적용 commit/date 기록. main은 안정 기준선, feature/PR/CI로 개발.

## 3. 설계 원칙
Detector (browser/network observation), extractor (yt-dlp class), protocol download (HTTP/HLS/DASH), mux/post-process를 분리. 모든 결과는 공통 DownloadItem/Queue/Storage/Notification으로 통합. Pipeline: detect/parse → validate → details/format selection → job create → progress → file/metadata registration → completion/error. Session/context는 최소 권한; protection bypass 금지.

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
