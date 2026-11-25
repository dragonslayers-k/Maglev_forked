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


## 12. 최종 제품 목표 문서 고정 — 2026-11-25

- 단일 기준 문서: [docs/PRODUCT_TARGET_KO.md](PRODUCT_TARGET_KO.md)
- 요구사항은 Maglev 기반/기존 기능 보존 + LJ Video Downloader 계열 자동 탐지 및 HTTP/HLS/DASH 다운로드 확대 + YTDLnis/yt-dlp 계열 실제 영상 추출·형식 선택·다운로드 queue 통합 + 앱 전체 완전 한국어화 + Maglev upstream 정기 review/sync를 포함합니다.
- 이번 사용자 피드백에서 한국어·YouTube share recognition·download는 모두 실패로 확정 기록. CI run #45585266120 성공은 automated tests/build만 뜻하며 실기기 기능 성공을 뜻하지 않습니다.
- 로드맵: P0 실패 재현/진단 → P1 YouTube end-to-end → P2 범용 탐지/다운로드 → P3 전체 한국어 → P4 upstream/회귀 → P5 안정화/릴리스. 목표 명세를 먼저 고정하고 이 문서의 DoD 기준으로 작업/보고합니다.


## 13. 문서 상호 참조 및 README 정정 — 2026-11-25
- 최종 목표 명세 신규: `docs/PRODUCT_TARGET_KO.md` (commit `9c39dd2`)
- 인수인계 링크 추가: commit `6e4f32b`
- README를 목표에 맞게 수정하고 현 실패를 명시: commit `e1594ab`
- README는 이제 기능 목표를 축소해서 “단계적 한국어”로만 표현하지 않고, 전체 한글화/YouTube 기능을 목표로 명시하며 현재 실기기 실패를 공개합니다.


## 2026-11-25 latest handoff (supersedes older run status)
- PR #5 ARM64-only packaging merged into feature branch; PR #2 duplicate packaging PR closed. PR #3 was closed as superseded by PR #4 to reduce duplicate builds.
- User's runs #45606903560, #45606626661, #45606620684, #45611626303 and #45611432139: cargo test itself reported 541 passed; exit 101 came from Clippy -D warnings, which promoted existing lints. CI now runs Clippy without -D warnings.
- ARM64 package verification run #45616085260 completed with JS, Rust, contract, Rust Android, APK build and Kotlin unit tests successful. Artifact archive is about 37.7 MB; this run predates the final YouTube integration and is not a device-test APK.
- PR #4 is the consolidated YouTube integration branch: scheme-less youtu.be parsing, QuickShare raw-text fallback, browser paste route, yt-dlp stable updater, client-specific extraction and HLS/DASH handoff.
- PO Token provider remains a known YTDLnis feature gap. No YouTube download or full Korean localization completion is claimed yet.
- Gradle 9.4.1 outdated warning and debug-certificate warning remain to address/verify; debug-signed APK is test-only.
## 2026-11-26 #163 사용자 설치 결과와 재작업 기준 (기존 최신 상태 기록 대체)

### #163의 사실관계
- Actions #163 / run ID `45645790936` / commit `e2aaee3b2b15b852df11ce13b5e2806de4aa9bae`: 7개 job CI success, APK artifact 생성.
- arm64 APK SHA-256: `61362ab5611965194e661fe66926f07e9da1d6e9edccc1c7a2054fe94e5db3de`.
- 사용자가 해당 APK를 Galaxy에 설치해 확인한 결과 **전체 한글화 실패, YouTube 다운로드 실패**. 따라서 #163은 CI_PASS만 해당하며 DEVICE_PASS/ACCEPTED가 아닙니다.

### 소스 원인과 수정 지침
1. 기존 `YoutubeDownload.kt`는 `YouTubeUrl.parse()` 성공만 허용해 YouTube 이외 yt-dlp 지원 사이트를 처리하지 못했습니다.
2. 일반 웹페이지가 Maglev direct-file probe에서 `NOT_A_FILE`을 반환하면 기존 화면에는 브라우저 열기만 있어 yt-dlp page extractor로 이동할 수 없었습니다.
3. 브라우저 page menu에도 일반 사이트에 대한 명시적 yt-dlp 분석 진입점이 없었습니다.
4. HLS/DASH 선택에서 variant audio가 separate인 경우 stream의 `audioId`를 전달하지 않아 해당 조합을 놓칠 수 있었습니다.
5. 현재 client fallback은 `web_safari/android_vr/web_embedded`이며 PO Token Provider와 최신 yt-dlp-ejs/JS runtime 준비 여부는 검증되지 않았습니다. youtubedl-android 0.18.1 bundled Python 3.8과 최신 yt-dlp Python 3.11+ 요구의 호환 위험도 남아 있습니다.

### 새 변경 요구사항
- YouTube와 일반 HTTP(S) 페이지의 yt-dlp metadata/format 분석을 동일 adapter에서 처리하되, 일반 페이지는 사용자가 명시적으로 선택할 때만 실행합니다.
- 선택 가능한 muxed direct video, direct audio, 검증 가능한 HLS/DASH만 기존 `EngineHost.addDownload` / Maglev Transfers로 전달합니다. 분리된 direct A/V URL은 호환 mux 검증 없이 표시하지 않습니다.
- 별도 `ytdlp-engine` queue, 별도 transfer store, 별도 foreground service를 만들지 않습니다.
- Browser page menu와 Add download의 NOT_A_FILE 오류에서 `yt-dlp로 페이지 분석` 경로를 제공합니다.
- DRM/Widevine/FairPlay 우회·복호화 코드를 만들지 않습니다. 보호 영상은 이유를 표시하고, 비암호화 MSE/HLS에 한해 PC MPMux 대체 안내를 표시합니다. MPMux도 DRM을 복호화하지 못한다고 사용자 화면에서 명시합니다.
- MPMux 안내: https://mpmux.com/ko ; Chrome Web Store: https://chromewebstore.google.com/detail/video-downloader-mpmux/mbflpfaamifmmmkdjkcmpofpccfmlmap

### 검증 전 금지사항
- 이 변경은 새 CI, Galaxy 실제 공유/paste → 추출 → 형식 선택 → Transfers → 저장 → 재생 → 취소/재시도/재시작 검증을 통과하기 전까지 완료/최종본으로 표시하지 않습니다.
- PO Token provider, yt-dlp-ejs/JS runtime, runtime/Python compatibility, playlist, separate direct A/V mux, non-YouTube site coverage, full Korean localization are still pending.
- CI success and APK artifact generation do not equal device acceptance.

## 2026-11-26 기능 보존·MPMux 녹화·보호 미디어 인계 보강

### 요구사항 변경 금지 원칙
- 여러 원천 프로젝트의 기능을 합치는 것이 목표이며, 중복 구현은 공통 엔진으로 통합하되 원천별 고유 기능이나 기존 Maglev 기능을 임의로 삭제하지 않습니다.
- 대체 기능이 동등하게 구현·검증되기 전에는 기존 기능을 제거하지 않습니다. 미구현/제약 기능은 PLANNED, IN_PROGRESS, BLOCKED, UNSUPPORTED_WITH_REASON으로 남깁니다.
- 기능 제거/축소가 불가피한 경우 사전 영향 분석, 대체 경로, 회귀 테스트, 사용자에게 보이는 변경 기록이 필요합니다.
- 새 엔진은 별도 전송 큐를 만들지 않고 기존 Maglev Transfers, 저장, 알림, 취소/재시도/복구를 공유합니다.

### MPMux 기능 정확한 해석
- MPMux Static Downloader: MP4/WebM 등의 Range 병렬 다운로드. Maglev Rust 엔진에 이미 Range split/validator/resume/fallback 구현이 있으므로 재작성하지 않고 회귀 검증합니다.
- MPMux HLS Downloader: VOD segment 취합 및 remux. Maglev HLS VOD 구현을 재사용하고 오디오 트랙/암호화 범위/재생 결과를 검증합니다.
- MPMux HLS Live: Maglev의 현재 live 거절 경로와 별개인 신규 기능. sequence cursor, playlist polling, segment 중복 방지, Stop/finalize, 저장공간 기반 파트 회전, 기존 Transfers 통합이 필요합니다.
- MPMux Video Buffer Muxer: 일반 화면 녹화가 아닙니다. HTML5 MediaSource SourceBuffer에 append되는 미디어 버퍼(init/media fragment)를 수집해 MP4로 재패키징하는 기능입니다.
- MSE capture는 기본 OFF이며 사용자가 명시적으로 시작해야 합니다. SourceBuffer별 MIME/codec, A/V track, append 순서, timestampOffset, appendWindow, changeType, discontinuity를 보존하고, bounded native staging/backpressure로 메모리 폭증을 막아야 합니다. 파일 파트 회전과 A/V sync 검증 후에만 완료 처리합니다.
- Android MediaProjection 화면 녹화는 MSE buffer mux와 별도 기능입니다. 사용자가 시스템 캡처 권한을 직접 승인한 경우 일반 화면 녹화 기능으로 검토할 수 있으나, DRM/secure surface/HDCP 보호 제한을 우회하거나 검은 화면을 제거하는 기능으로 사용하지 않습니다.

### DRM/EME 보호 콘텐츠 처리
- DRM 감지 자체를 제거하지 않습니다. EME, Widevine, FairPlay, SAMPLE-AES, 보호된 key format을 식별하고 일반 MSE와 구분합니다.
- Widevine/FairPlay 키·라이선스·세션 추출, 복호화, 보호 플래그 해제, DRM 우회 기능은 구현하지 않습니다.
- 암호화된 SourceBuffer bytes를 수집해도 암호문은 복호화되지 않습니다. 컨테이너 변경만으로 재생 가능한 MP4가 되지 않습니다.
- UI는 보호 상태와 실패 원인을 분명히 표시하고, 해당 서비스의 공식 오프라인 저장/다운로드 기능 및 고객지원 경로를 안내합니다.
- PC MPMux 안내는 비암호화 MSE/HLS buffer형 플레이어에 한정된 대안입니다. DRM 해제 기능이라고 설명하지 않습니다.

### 현재 저장소 변경 및 CI 기록
- 기능 보존 정책 상세: `docs/FEATURE_PRESERVATION_AND_PROTECTED_MEDIA_KO.md`
- 제품 수용 기준 갱신: `docs/PRODUCT_TARGET_KO.md`
- README 한국어 안내 링크 추가: `README_KO.md`
- 문서 변경 commit: `7c768ee4405ed9b9e10efac726dc5c377a1b65e0`
- 해당 commit CI: run #167 / ID `45708688002`, 기록 시점 in_progress. 성공/실패를 확인한 후 별도 기재할 것.
- #163(run `45645790936`)은 CI success였으나 사용자 설치 결과 전체 한국어화 FAIL / YouTube 다운로드 FAIL. DEVICE_PASS가 아닙니다.
- #166(run `45655252729`)은 test-only commit `508fc49e64adda9f0f1d4655f842873ed5836ee8`의 CI success이며 Galaxy E2E/최종 APK 기능 검증 증거가 아닙니다.

### 다음 구현 순서
1. MSE capture native staging bridge와 사용자 opt-in lifecycle 구현 및 단위/contract 테스트.
2. HLS Live recorder state machine 및 기존 Transfers 연결.
3. DRM/EME 탐지 결과를 보호 유형별 한국어 UI로 노출하고 공식 저장 안내 제공.
4. YouTube runtime(Python/yt-dlp/JS runtime/PO Token) 실제 단말 검증 및 format/download pipeline 수정.
5. 전체 UI 한국어 문자열 inventory, 자동 검사 및 Galaxy 화면 검수.
6. 기존 Maglev torrent/direct/Range/HLS VOD/DASH/browser/subtitle/settings regression.
7. CI artifact SHA/서명/ABI/16KB alignment 확인 후 Galaxy에서 실제 파일 저장·재생·백그라운드/취소/재시도/재시작을 검증.
8. 위 항목을 통과한 commit만 최종 후보로 지정합니다.

이 문서의 추가는 요구사항과 검증 기준을 보강한 것이며, MSE capture/HLS Live/DRM detection UX/YouTube E2E/전체 한국어화가 구현 완료되었다는 뜻이 아닙니다.
