# Maglev 기반 동영상 다운로더

이 저장소는 [Kaos599/Maglev](https://github.com/Kaos599/Maglev)을 기반으로 동영상·스트리밍 감지 성공률과 한국어 사용성을 개선하는 공개 개발 포크입니다.

- 원본 프로젝트: [Kaos599/Maglev](https://github.com/Kaos599/Maglev)
- 기준 원본 버전: Maglev v0.33
- 기준 커밋: baaf83f0f3afd65d2eac135cce8b8bbabea8fbb3
- 라이선스: GPL-3.0 (원본 라이선스와 저작권 고지 유지)
- 현재 작업: feature/p1-video-detection-observer
- 통합 브랜치: dev
- 릴리스 기준: main

## 프로젝트 목표

Maglev의 화면 구성과 다운로드 엔진을 유지하면서 일반 동영상 파일과 비암호화 스트리밍의 탐지 범위를 넓힙니다.

**중요:** 모든 웹사이트의 모든 영상을 100% 저장할 수 있다고 보장하지 않습니다. DRM 보호, 서비스 정책, 로그인 세션, 만료된 URL, 사이트별 플레이어 구현, 브라우저 보안 경계에 따라 감지 또는 저장이 제한될 수 있습니다. DRM 우회 기능은 개발 범위에 포함하지 않습니다.

## 주요 지원 방향

| 구분 | 목표 |
|---|---|
| 직접 파일 | MP4, M4V, WebM, MKV, MOV 등 |
| HLS | M3U8 마스터·미디어 플레이리스트, 화질·오디오 트랙 선택 |
| DASH | MPD 정적 VOD, 화질·오디오 트랙 선택 |
| 동적 감지 | WebView 요청, Service Worker, fetch, XHR, Resource Timing, DOM 미디어 |
| 요청 정보 | 가능한 범위의 User-Agent, Referer, Origin, 사이트별 쿠키 |
| 다운로드 | 일시정지·재개, 재시도, 분할 스트림 처리 및 병합 |
| 브라우저 연동 | 앱 내부 브라우저 및 외부 브라우저 공유 전달 |
| 언어 | 한국어를 기본 화면 언어로 단계적으로 적용 |

## 현재 구현 진행 내용

현재 기능 브랜치에서 다음 변경을 작업했습니다.

1. 확장자 없는 스트림을 위해 응답 MIME 기반으로 HLS·DASH·직접 동영상·오디오를 구분합니다.
2. 페이지의 fetch/XHR 응답 URL과 Content-Type을 관찰합니다. 응답 본문을 읽거나 변경하지 않습니다.
3. Resource Timing에서 미디어 리소스 후보를 재검사합니다.
4. Android WebView Service Worker 요청을 관찰합니다. 프로세스 전역 API 특성에 맞춰 활성 탭과 출처 호스트를 제한합니다.
5. 동일 URL이 나중에 더 풍부한 정보(MIME, 스트림 종류, 크기, 해상도)를 제공하면 기존 감지 항목을 보강합니다.
6. HLS/DASH 매니페스트를 확인한 뒤 알려진 세그먼트 URL이 파일 목록을 채우는 현상을 줄입니다.
7. 감지 파일 목록과 스트림 다운로드의 핵심 화면 문구를 한국어로 바꿉니다.

아직 빌드 성공·실기기 정상 동작을 확정한 릴리스가 아닙니다. PR CI와 Galaxy 실기기 시험이 통과되어야 다음 단계로 진행합니다.

## 빌드 및 테스트

개발 환경은 원본 Maglev 기준을 따릅니다.

- Node.js 22.18 이상
- Android SDK 및 JDK 17
- Android 기기 또는 에뮬레이터
- Rust/Android 네이티브 라이브러리는 저장소 CI에서 빌드

    git clone https://github.com/dragonslayers-k/Maglev_forked.git
    cd Maglev_forked
    git checkout dev
    npm ci --legacy-peer-deps
    npm run typecheck
    npm test

기기 설치 개발 빌드는 원본의 Expo 개발 빌드 절차를 따릅니다. 릴리스용 APK는 GitHub Actions CI가 실제 네이티브 엔진을 포함해 빌드한 결과만 사용합니다. JS mock 엔진이 포함된 개발 화면은 다운로드 성공 증거가 아닙니다.

## 문서

- [영상 감지 계약](docs/STREAM_DETECTION_CONTRACT_KO.md)
- [LJ Downloader 분석 검토](docs/LJ_ANALYSIS_REVIEW_KO.md)
- [Galaxy 실기기 검증 계획](docs/GALAXY_TEST_PLAN_KO.md)
- [개발 로드맵](docs/ROADMAP.md)

## 라이선스와 출처

Maglev 원본의 GPL-3.0 라이선스와 저작권 고지를 유지합니다. 이 포크의 Maglev 기반 수정본 역시 GPL-3.0 조건에 따라 배포합니다.

LJ Downloader 1.1.79의 비공개 구현 코드는 복사하거나 재배포하지 않습니다. 사용자가 제공한 분석 내용은 기능 요구사항과 테스트 시나리오로만 사용하며, 동작은 독립적으로 구현합니다. 제3자 라이브러리를 추가할 때에는 라이선스와 배포 의무를 별도 검토합니다.
