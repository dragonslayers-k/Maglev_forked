# Maglev+ 기반 동영상 다운로더

이 저장소는 **Maglev+** (독립 설치 패키지)이며 [Kaos599/Maglev](https://github.com/Kaos599/Maglev)을 기반으로 동영상·스트리밍 감지 성공률과 한국어 사용성을 개선하는 공개 개발 포크입니다.

- 원본 프로젝트: [Kaos599/Maglev](https://github.com/Kaos599/Maglev)
- 기준 원본 버전: Maglev v0.33
- 기준 커밋: baaf83f0f3afd65d2eac135cce8b8bbabea8fbb3
- 라이선스: GPL-3.0 (원본 라이선스와 저작권 고지 유지)
- 현재 작업: feature/p1-video-detection-observer
- 통합 브랜치: dev
- 릴리스 기준: main

## 최종 제품 목표

상세 목표·필수 기능·완료 기준·단계별 작업 순서는 [최종 목표 제품 명세](docs/PRODUCT_TARGET_KO.md)를 기준으로 합니다. Maglev 기존 기능과 하나의 Transfers 큐를 보존하면서 LJ/MPMux 기능 중 실제 누락된 미디어 감지·HLS Live·MediaSource buffer capture와 YouTube yt-dlp 다운로드를 통합합니다. 전체 한국어화 및 upstream 업데이트 검토도 진행합니다.

**#163 APK 설치 테스트에서 전체 한글화와 YouTube 실제 다운로드 실패가 확인됐습니다.** #163 CI success는 자동 빌드/테스트 결과일 뿐이며 기능 승인으로 계산하지 않습니다. 현재 수정 작업은 일반 HTTP(S) 사이트의 명시적 yt-dlp 페이지 분석 경로를 기존 Transfers에 연결하고, MPMux PC 대안 안내를 추가하는 것입니다. 새 CI 및 Galaxy 실기기 검증 전에는 완료로 취급하지 않습니다.

**중요:** 모든 웹사이트의 모든 영상을 100% 저장할 수 있다고 보장하지 않습니다. DRM 보호, 서비스 정책, 로그인 세션, 만료된 URL, 사이트별 플레이어 구현, 브라우저 보안 경계와 추출기 런타임에 따라 감지 또는 저장이 제한될 수 있습니다. DRM/Widevine/FairPlay 보호 해제는 구현하지 않습니다. 비암호화 MSE/HLS 버퍼형 플레이어는 PC MPMux 안내를 제공할 수 있지만, MPMux도 DRM을 복호화하지 못합니다.

## 자체 업데이트 경로

설치한 포크 APK의 업데이트 확인은 이 저장소의 GitHub Releases를 조회하도록 구성합니다. 원본 Maglev Release를 직접 설치 대상으로 안내하지 않습니다. 원본의 새 버전은 월간 검토·선별 병합 후 이 포크에서 새 버전으로 빌드하고 게시해야 앱 내 업데이트가 감지됩니다.

- 업데이트 소스: [이 포크의 Releases](https://github.com/dragonslayers-k/Maglev_forked/releases)
- 태그 규칙: `v주버전.부버전` (예: `v0.34`)
- ABI별 APK와 SHA-256 digest가 포함된 정식 Release만 앱 내 자동 업데이트 대상으로 인식합니다.
- 현재는 아직 자체 Release가 없으므로 앱 내 업데이트 경로의 배포 검증은 남아 있습니다.

## APK 독립 식별

- 표시 이름: **Maglev+**
- Android applicationId: `com.maglev.plus` (원본 `com.maglev`과 다름)
- Android versionCode: `34` / app version: `0.34`
- 원본 Maglev과 별도 설치·데이터 공간을 사용합니다. 원본 앱을 덮어쓰지 않습니다.
- Release APK는 포크의 전용 서명 키로 서명하여 업데이트 체인을 분리합니다. CI의 테스트 APK는 debug 서명일 수 있으므로 정식 배포 APK와 구분하십시오.

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
| 언어 | 앱 전체 사용자 노출 문자열 완전 한국어화 (현재 미완료/실기기 실패 확인) |
| YouTube / yt-dlp | YouTube 및 사용자가 명시한 일반 HTTP(S) 페이지 metadata/format 분석을 기존 Transfers 큐에 연결하는 수정 진행 중 (새 CI/Galaxy E2E 미검증); PO Token/JS runtime 및 분리 A/V merge 미완료 |
| upstream | Maglev 원본 변경 월간 검토, 선택적 통합 및 regression 검증 |

## 현재 구현 진행 내용

현재 기능 브랜치에서 다음 변경을 작업했습니다.

1. 확장자 없는 스트림을 위해 응답 MIME 기반으로 HLS·DASH·직접 동영상·오디오를 구분합니다.
2. 페이지의 fetch/XHR 응답 URL과 Content-Type을 관찰합니다. 응답 본문을 읽거나 변경하지 않습니다.
3. Resource Timing에서 미디어 리소스 후보를 재검사합니다.
4. Android WebView Service Worker 요청을 관찰합니다. 프로세스 전역 API 특성에 맞춰 활성 탭과 출처 호스트를 제한합니다.
5. 동일 URL이 나중에 더 풍부한 정보(MIME, 스트림 종류, 크기, 해상도)를 제공하면 기존 감지 항목을 보강합니다.
6. HLS/DASH 매니페스트를 확인한 뒤 알려진 세그먼트 URL이 파일 목록을 채우는 현상을 줄입니다.
7. 감지 파일 목록과 스트림 다운로드의 핵심 화면 문구를 한국어로 바꿉니다.
8. YouTube 포맷 선택은 기존 maglevEngine.getYouTubeInfo / addYouTubeDownload API를 사용해 새 별도 큐 없이 기존 Transfers로 전달합니다.
9. MPMux 비교 결과 static Range/HLS VOD는 기존 엔진을 재사용하고, HLS Live 및 MediaSource byte capture를 신규 갭으로 분리했습니다.
10. 브라우저의 blob/DRM/보호 스트림 거절 시 PC MPMux 안내를 제공하되, 비암호화 MSE/HLS만 대상으로 하고 DRM 우회 불가를 한국어로 고지하도록 수정 중입니다.

아직 최종 APK나 실기기 기능 합격을 선언하지 않습니다. Actions #163(`45645790936`, SHA `e2aaee3b2b15b852df11ce13b5e2806de4aa9bae`)은 CI success였으나 사용자가 설치해 YouTube 다운로드와 전체 한글화 실패를 확인했습니다. #163 APK SHA-256은 `61362ab5611965194e661fe66926f07e9da1d6e9edccc1c7a2054fe94e5db3de`이며 최종본이 아닙니다. 새 수정의 CI/Galaxy E2E, HLS Live, MediaSource capture, 전체 한국어화가 남아 있습니다.

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

- [최종 목표 제품 명세 및 검수 기준](docs/PRODUCT_TARGET_KO.md)
- [프로젝트 인수인계](docs/PROJECT_HANDOFF_KO.md)
- [영상 감지 계약](docs/STREAM_DETECTION_CONTRACT_KO.md)
- [LJ Downloader 분석 검토](docs/LJ_ANALYSIS_REVIEW_KO.md)
- [Galaxy 실기기 검증 계획](docs/GALAXY_TEST_PLAN_KO.md)
- [개발 로드맵](docs/ROADMAP.md)
- [원본 Maglev 월간 업데이트 정책](docs/UPSTREAM_SYNC_POLICY_KO.md)
- [MPMux 기능 벤치마크 및 Maglev 이식 설계](docs/MPMUX_BENCHMARK_INTEGRATION_KO.md)
- [통합 개발 기준 및 현재 검증 게이트](docs/INTEGRATED_PRODUCT_PLAN_KO.md)

## 라이선스와 출처

Maglev 원본의 GPL-3.0 라이선스와 저작권 고지를 유지합니다. 이 포크의 Maglev 기반 수정본 역시 GPL-3.0 조건에 따라 배포합니다.

LJ Downloader 1.1.79의 비공개 구현 코드는 복사하거나 재배포하지 않습니다. 사용자가 제공한 분석 내용은 기능 요구사항과 테스트 시나리오로만 사용하며, 동작은 독립적으로 구현합니다. 제3자 라이브러리를 추가할 때에는 라이선스와 배포 의무를 별도 검토합니다.
