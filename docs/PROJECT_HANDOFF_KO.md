# Maglev+ 프로젝트 인계 문서

> 최종 갱신: 2026-11-25 (KST)
> 이 문서를 새 대화의 첫 기준으로 사용합니다. 기존 결정을 임의로 되돌리거나 완료되지 않은 항목을 완료 처리하지 않습니다.

## 1. 제품 목표

Maglev v0.33을 기반으로 원본 앱과 별도로 설치되는 **Maglev+**를 개발합니다.

- Android 표시 이름: Maglev+
- applicationId: `com.maglev.plus` (원본과 별도 설치)
- 원본 기준 저장소: `Kaos599/Maglev`
- 사용자 저장소: `dragonslayers-k/Maglev_forked`
- 원본 기준 커밋: `baaf83f0f3afd65d2eac135cce8b8bbabea8fbb3`
- 라이선스: GPL-3.0. 원본 저작권·라이선스 및 의존성 고지를 유지합니다.
- 원본의 APK 서명키가 없으므로 원본 앱 업데이트 체인을 재사용할 수 없습니다. Maglev+는 별도 패키지 ID와 별도 자체 서명키를 사용해야 정식 업데이트가 가능합니다.
- 앱 이름/패키지 ID만 바꾼 상태를 기능 완성으로 보지 않습니다.

## 2. 사용자 요구사항 (변경 금지)

1. Maglev의 기존 다운로드 엔진, 큐, 재개, HLS/DASH, 자막 및 브라우저 기능을 회귀 없이 유지합니다.
2. 브라우저가 페이지에서 실제 미디어 요청을 감지하는 성공률을 개선합니다. 확장자 없는 URL, fetch/XHR, Resource Timing, WebView/Service Worker 관찰을 포함합니다.
3. Chrome 및 Samsung Internet에서 공유 메뉴로 Maglev+에 URL을 전달하고 앱에서 처리할 수 있어야 합니다.
4. 화면과 핵심 동작을 한국어로 제공합니다. 단순 일부 문구만 번역한 상태를 전체 한글화로 표현하지 않습니다.
5. **YouTube 공유 URL을 Maglev+로 전달해 동영상/오디오를 선택하고 실제 다운로드**할 수 있어야 합니다. `youtu.be` 단축 URL, `youtube.com/watch`, Shorts, Live, 모바일 도메인을 포함합니다. 단순히 URL을 정규화하거나 브라우저에서 페이지를 여는 것으로 완료 처리하지 않습니다.
6. 다운로드 가능한 일반 비보호 미디어만 대상으로 합니다. DRM, 유료 접근제어, 인증 우회 및 보호된 스트림 우회는 개발하지 않습니다. 사용자가 권한을 가진 콘텐츠 또는 서비스가 허용한 다운로드에 한해 사용하도록 안내합니다.
7. 원본 Maglev upstream 변경은 월간 확인 후 필요한 항목만 선별 반영합니다. 자동 병합하지 않습니다.
8. CI 녹색, APK 생성, 실기기 검증, 정식 서명은 각각 별도 기준으로 관리합니다.

## 3. 브랜치 및 기준선

- `main`: 원본 기준선 보존. 기능 작업 금지.
- `dev`: 통합 기준선.
- `feature/p1-video-detection-observer`: 현재 기능 개발 브랜치.
- PR #1: feature → dev, Draft 상태 유지. CI와 Galaxy 실기기 검증 전에는 병합/릴리스하지 않습니다.
- 중복 브랜치 정리는 GitHub 연결 도구에 삭제 작업이 노출되지 않아 아직 완료됐다고 보고하지 않습니다.

## 4. 최근 실패 실행의 원인 — Actions #45573899795

실행: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45573899795
Head: `d13e7105691c025043fa1d291645b84454044535`

확인 결과:
- Contract tests: 성공
- Rust tests (no JNI): 성공. 이번 실행에서 Rust exit code 101은 발생하지 않았습니다.
- JS checks: Typecheck 성공, `npm test`의 `scripts/test-subtitles-row.js`에서 4개 assertion 실패
- Rust Android arm64-v8a: 성공
- APK `assembleRelease`: 성공
- APK signing 확인: PR 빌드이므로 debug 서명 경고 수준
- APK 업로드: 성공
- Kotlin `:maglev-engine:testDebugUnitTest`: 303개 중 `YouTubeUrlTest.timeFormatsAndBounds` 1개 실패
- 전체 Actions 결론: failure

### 실패 원인 분석

**JS 4건**
- 테스트가 번역된 코드와 맞지 않는 오래된 표시 문자열을 기대했습니다.
- `languageName()`은 English 이름을 반환하므로 `French에서만 찾음`, `German 자막 있음`이 올바른 현재 계약입니다.
- 버튼 텍스트는 `Pick one`이 아니라 `선택`입니다.
- 테스트의 season pack 문구도 현재 한국어 계약과 일치하도록 재검증합니다.

**Kotlin 1건**
- `YouTubeUrl.parse(...)`는 잘못된 timestamp를 가진 URL 자체를 거부하지 않고, URL은 인식하되 `startSeconds=null`로 처리합니다.
- 테스트가 전체 VideoLink 객체에 `assertNull`을 적용한 것이 잘못입니다. `?.startSeconds`가 null인지 확인하도록 테스트를 수정했습니다.

## 5. 방금 반영한 CI 수정 커밋

- `47dcd9bccf5a3ec88803635cec5027b0fb9dcc19`: subtitle row 테스트의 현행 문구 계약 반영
- `228cf4e498919e0ac36d75890f6412abc86b4792`: 잘못된 YouTube timestamp 테스트의 null 검증 대상 수정

이 두 변경 후 새 CI가 통과했는지 반드시 확인합니다. 새 실행 결과를 확인하기 전에는 CI 성공이라고 보고하지 않습니다.

## 6. 현재 구현 상태와 미완료 사항

### 이미 코드가 있는 부분 (실기기 검증 전)
- WebView의 fetch/XHR, Resource Timing, DOM 미디어 및 Android Service Worker 요청 관찰
- HLS/DASH 및 직접 미디어 MIME 분류, 세그먼트 노이즈 억제
- 브라우저 미디어 감지 계약 테스트
- 주요 브라우저·다운로드 화면의 일부 한국어화
- Android 공유 인텐트 및 Quick Share 카드의 기존 경로
- `YouTubeUrl.kt` 및 `utils/browser/youtube.ts`: YouTube URL 형식 파서와 단축 URL 정규화
- `YoutubeDownload.kt`: yt-dlp로 공개 영상 메타데이터/합본 동영상/오디오 형식을 추출하고 기존 Rust 다운로드 큐에 등록하는 네이티브 어댑터 (CI·Galaxy 검증 대기)
- `app/youtube-download.tsx`: YouTube 형식 선택 화면 (CI·Galaxy 검증 대기)
- Chrome/Samsung Internet 및 YouTube 앱 공유 인텐트를 전용 다운로드 화면으로 연결

### 중요한 결함
- YouTube 추출기는 yt-dlp Android wrapper를 통해 연결했습니다. 첫 단계는 별도 오디오·영상 병합이 필요 없는 합본 동영상 형식과 오디오 전용 형식만 노출합니다. 분리된 고화질 트랙 병합은 후속 작업입니다.
- 공유·붙여넣기 라우팅과 기존 Rust 전송 큐 연결은 구현했으나, 최신 CI 및 Galaxy 실기기 검증 전에는 기능 완료로 간주하지 않습니다.
- FFmpeg 패키지는 현재 의도적으로 포함하지 않았습니다. upstream 0.18.1의 FFmpeg zip 내부 WebP 라이브러리에서 16 KB 페이지 정렬 문제가 보고되어, 이를 해결하기 전에는 해당 모듈을 넣지 않습니다.
- README의 versionCode 정보는 실제 `app.json`과 일치하는지 다시 확인해야 합니다.
- 전체 화면 한국어화는 미완료입니다.
- Galaxy 실기기 Chrome/Samsung Internet, 외부 공유, 직접 파일/HLS/DASH, YouTube 다운로드 검증은 아직 수행되지 않았습니다.
- 정식 Release APK와 자체 서명키 설정은 미완료입니다. PR의 debug-signed APK는 최종 배포물로 취급하지 않습니다.

## 7. YouTube 다운로드 구현 계획 (P1 우선)

YTDLnis의 동작을 참고하되 YTDLnis 앱의 소스/브랜드/전용 UI를 복사하지 않습니다. 독립적으로 yt-dlp 엔진을 연결합니다.

후보 기술:
- `yausername/youtubedl-android` Android wrapper. yt-dlp 실행, `getInfo()`, `execute()`, 진행률 콜백 및 취소 API를 제공합니다.
- 현재 upstream README의 Maven 좌표 예시는 `io.github.junkfood02.youtubedl-android:library:0.18.1`이며, ffmpeg는 별도 모듈입니다. 실제 도입 시 최신 릴리스, Android Gradle/Kotlin 호환성, ABI 및 라이선스를 다시 검증합니다.
- yt-dlp는 추출기/플레이어 변경에 따라 실패할 수 있으므로 버전 고정만 하지 말고 업데이트·진단 정책을 포함합니다.
- Maglev 기존 Rust 다운로드 큐와의 통합은 임시 디렉터리 결과 파일을 기존 저장소 추상화로 가져오는 방식과 네이티브 큐로 URL/포맷을 넘기는 방식의 비용·회귀 위험을 비교한 뒤 결정합니다. 중복 다운로드 엔진을 무계획하게 병렬 도입하지 않습니다.

구현 단계:
1. ShareClassify Kotlin/TypeScript 양쪽에서 YouTube URL을 별도 유형으로 인식하고 fixture 동기화
2. `youtu.be`, watch, shorts, live, embed, music, 모바일 링크 정규화 테스트
3. YouTube QuickShare 카드에 제목/썸네일/길이/포맷 로딩 상태와 동영상·오디오 선택 UI 구현
4. yt-dlp Android 실행 어댑터 및 앱 생명주기 초기화, 진행률, 취소, 오류 분류 구현
5. 기존 다운로드 목록/저장 위치/알림/취소·재시도 체계와 연결
6. 영상·오디오 포맷, 병합, FFmpeg 필요성, 자막/썸네일 옵션을 검증
7. 권한이 있는 공개 테스트 영상으로 Galaxy 실기기 테스트. 로그인/DRM/연령/지역 제한 우회는 구현 범위에서 제외
8. CI에서 유닛·계약·Android 빌드 통과 후 APK 해시와 서명 확인

## 8. 다음 작업 순서

1. 최신 Actions에서 자막 행·기존 자막·검색 사이트 한국어 문구 테스트 수정이 해결됐는지 확인합니다. 실패하면 실제 실패 assertion만 고칩니다.
2. YouTube URL 파서의 앱 연결부를 구현합니다. parser 단위 테스트만 추가하고 완료 표시하지 않습니다.
3. yt-dlp Android 의존성 0.18.1을 추가했습니다. 최신 CI에서 Kotlin/Gradle 빌드, ABI, APK 크기, 16 KB LOAD alignment를 확인하고 Galaxy에서 실제 추출·다운로드를 검증합니다.
4. 전체 한국어 문자열 인벤토리를 만들어 화면 단위로 번역하고 회귀 테스트를 추가합니다.
5. 미디어 감지의 false positive/false negative를 fixture로 확장하고 외부 브라우저 실기기 시험을 수행합니다.
6. Release 서명키를 Maglev+ 전용으로 구성하고 정식 서명 APK를 생성합니다. 원본 키를 찾거나 재사용하려 하지 않습니다.
7. 모든 기능·CI·실기기 검증을 마친 뒤 PR #1 정리 및 Release를 진행합니다.

## 9. 작업 규칙

- 각 커밋은 한 목적에 집중하고, 수정 직후 관련 테스트를 실행합니다.
- 같은 실패를 assertion 문자열만 무작정 바꿔 숨기지 않습니다. 실제 UI 계약과 테스트 중 무엇이 잘못됐는지 코드 근거로 결정합니다.
- APK assemble 성공과 Kotlin unit test 성공을 별도로 보고합니다.
- 실행 중인 GitHub Actions 로그를 확인할 때 대량 로그 전체를 출력하지 말고 실패 구간만 추출합니다.
- 사용자가 새 대화에서 이 문서를 주면 이 문서와 현재 GitHub 상태를 함께 확인하고 이어서 진행합니다.


## 10. 2026-11-25 CI 검증 결과 / 다음 세션 기준

- Latest verified workflow: [#45580170442](https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45580170442)
- Result: **SUCCESS**, 7 jobs: Contract tests, ABI plan, Rust tests, JS/typecheck/tests, arm64 Rust build, Build APK all passed; PR APK reuse was skipped as expected.
- Run SHA and feature branch HEAD matched: `26759a694852c7ec7d6707a4b21e4647818ad0dd`. Do not report older cancelled runs as current failures; they were superseded by this successful run.
- Release APK artifact `apks` was produced (arm64 and universal). Signing verification and versionCode verification steps passed in the workflow; Kotlin unit tests passed.
- APK archive integrity checked locally. 30 arm64 shared libraries in each APK were inspected; no ELF PT_LOAD alignment below 16 KiB was found. Local `apksigner` was unavailable, so independent local signature verification was not performed; rely only on the successful CI signing step.
- CI artifact ZIP SHA-256: `ebb3e5b80520bc41af9c55cb7b31c6c2462ad7dc3853bbd4c3a0d4bb835715af`.
- arm64 APK SHA-256: `1774032323e2a74b8e55fb72467011189e26a1d140a6419eb30a14778452fa0f`.
- universal APK SHA-256: `8308642e248969d71cf5e6e5b14d962731bddbf9fd7994daa4c85c09fa8b6990`.
- PR #1 remains **Draft** to `dev`; not merged/released. APK is a CI test artifact, not final public release.
- The ChatGPT monthly-review automation was created unintentionally and then **disabled**. It must not be re-enabled without explicit user approval. The repository workflow `.github/workflows/monthly-upstream-review.yml` is a separate GitHub Action and may create a review issue; disclose its schedule and side effects before changing it.
- Next: check remaining Korean localization by screen coverage (not only strings already translated), add missing coverage and tests; review media detection behavior; audit YouTube share/extraction for authorized content use only and limitations (muxed formats only, no separate DASH merge); update test checklist; then run CI on final HEAD and test on Galaxy. Do not mark complete without real-device verification.


## 11. 사용자 실기기 검증 결과 — 2026-11-25 (중요한 정정)

사용자가 최신 설치 APK에서 직접 확인한 결과:
- 한국어화: 체감상 거의 적용되지 않음 — 전체 한글화 미완성 상태가 실제 UI에서 확인됨.
- YouTube URL 인식: 작동하지 않음.
- YouTube 다운로드: 작동하지 않음.
- YTDLnis 기능 이식 여부: 실제 앱 기능 수준의 이식/검증은 완료되지 않았음. 현재 확인된 것은 yt-dlp Android wrapper `youtubedl-android 0.18.1` 의존성 및 얇은 네이티브 어댑터임. YTDLnis 자체 앱 기능을 통째로 이식했다고 주장하지 않음.

### 즉시 확인된 잠재 원인 / 수정
- `app/_layout.tsx`의 cold-launch 엔진 대기 라우트(`ENGINE_FIRST_ROUTE`)에 `youtube-download`가 누락되어 전용 화면이 엔진 준비 전에 추출 API를 호출할 수 있음.
- 수정 커밋: `c3f39126107f683e2fb165c0b45662a3d2b9de13` (YouTube route 엔진 대기 포함)
- 계약 테스트 추가 커밋: `1ff5ae4990f0622040a11f0125985608b5c1f748` (엔진 컨텍스트 테스트에서 route 포함 확인)
- 이 수정은 잠재적인 race condition 한 건을 보완한 것이며, YouTube 공유 인식·추출·다운로드 성공을 증명하지 않습니다. 새 CI 및 실기기 재시험 전 완료로 표시하지 않습니다.

### 다음 검증 필수
1. 공유 인텐트가 YouTube URL을 실제 `redirectSystemPath`로 전달하는지, Chrome/Samsung Internet/YouTube 앱 각각 확인.
2. `YouTubeUrl.parse` JS/Kotlin 구현 간 모든 형식 동기화 및 테스트.
3. 엔진 준비 대기 뒤 yt-dlp 초기화·추출 호출의 실제 예외 로그 확보. 오류를 숨기는 generic 메시지 대신 진단 코드를 사용자에게 표시.
4. 선택한 format ID가 실제 다운로드 요청에서 유지되는지, 요청된 format URL/headers와 Maglev 큐 처리의 호환 여부 확인. 오디오 포맷은 오디오 전용 파일 타입으로 정상 처리되는지 점검.
5. 다운로드가 기존 목록에 실제 생성되고 파일 저장·재생·완료·취소 동작 확인.
6. 한국어화는 화면별 문자열 인벤토리와 기본 언어 전환을 점검하고, 영어 잔존을 체크하는 자동 테스트를 추가. 일부 화면만 번역된 것을 완료로 보고하지 않음.

현재 기능 상태는 사용자 실기기 결과를 최우선으로 하여 **YouTube 기능 실패 / 전체 한글화 실패 / P1 재작업**으로 관리합니다.
