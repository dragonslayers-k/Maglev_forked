# Maglev 통합 다운로더 — 종합 개발 착수·인계 기준서

> 문서 버전: 1.1  
> 기준일: 2026-11-26 (KST)  
> 저장소: [dragonslayers-k/Maglev_forked](https://github.com/dragonslayers-k/Maglev_forked)  
> 단일 구현 트랙: [PR #1](https://github.com/dragonslayers-k/Maglev_forked/pull/1), `feature/p1-video-detection-observer`  
> 상태: **개발 착수 기준 확정 / 기능 완성 아님 / 실기기 E2E 미통과**

이 문서는 사용자 제공 클로드 분석자료 「종합 다운로더 APK 개발 착수 문서」, 그 문서에 포함된 LJ Video Downloader 1.1.79 디컴파일 분석, Maglev 원본·포크 작업 기록, YTDLnis 기능 분석, youtubedl-android 엔진 설계 초안을 통합한 장기 인계 기준이다. 이 문서는 원본 APK 바이너리 자체를 대신하지 않는다. APK가 별도 업로드 또는 저장소에 확보되지 않은 항목은 “원본 바이너리 재확인 필요”로 표시하며, 디컴파일 분석에서 확인된 내용과 추정 내용을 구분한다.

## 0. 인계 규칙과 현재 사실

### 0.1 기준 원칙
1. 하나의 제품, 하나의 통합 구현 PR(#1), 하나의 기준 문서로 진행한다. 기능별로 불필요한 PR·브랜치·시험 릴리스를 계속 늘리지 않는다.
2. 기능은 Maglev의 기존 기능을 보존하면서 엔진을 분류·라우팅한다. UI는 Maglev의 React Native/Expo 구조와 테마를 재사용한다.
3. CI 성공은 APK 기능 성공을 뜻하지 않는다. 사용자 보고에서 한국어 UI 누락, `youtu.be/` 인식/다운로드 실패, “Engine call failed”가 확인된 APK는 기능 합격으로 간주하지 않는다.
4. 사용자에게 설치를 요청하는 APK는 빌드 ID, Actions URL, ABI, 서명 종류, SHA-256, 검증 범위를 함께 제시한다. 진단용 APK는 사용자가 설치할 필요가 없는 한 설치 요청하지 않는다.
5. 미검증 구현은 완료로 승격하지 않는다. 기능 상태는 `NOT_STARTED`, `IN_PROGRESS`, `CI_PASS`, `DEVICE_PASS`, `ACCEPTED`, `BLOCKED` 중 하나로 기록한다.
6. 원본 APK·소스 코드의 라이선스와 앱 이름/상표 조건을 보존한다. DRM 우회는 범위 밖이며 DRM 감지 시 명확한 미지원 메시지를 제공한다.

### 0.2 현재 저장소 상태 — 2026-11-25 확인
- PR #1은 열린 Draft 통합 PR이며 head SHA `da9e6518f7bf24b939fbbbfe7bec35045e651cc6`.
- PR #3/#4는 중복/대체 작업으로 종료되었고, PR #5의 ARM64 패키징 변경은 PR #1 트랙에 반영된 상태로 기록되어 있다.
- 기존 PR #1에 parser/share intent/yt-dlp 관련 변경이 누적되어 있으나, 사용자 실기기 기능 검증에서는 실패 보고가 있었다.
- 진단 래퍼는 generic “Engine call failed” 대신 예외/근본 원인 타입을 반환하고, URL query string을 로그에서 가리도록 수정했다. 이 수정은 오류 원인을 밝히기 위한 관측성 개선이며 다운로드 기능 구현 완료가 아니다.
- 이전 Actions에서 Rust tests exit 101, universal APK, Gradle/패키징 경고 등 실패 이력이 있다. 실패 기록은 삭제·은폐하지 않고 원인과 후속 수정에 연결한다.
- 현재까지 독립 `ytdlp-engine` 모듈, 완전한 YouTube 다운로드, 전체 한국어 현지화, PO Token 지원, Galaxy 실기기 E2E는 완료로 판정되지 않았다.
- 최근 작업 문서 `docs/INTEGRATED_PRODUCT_PLAN_KO.md`는 단계별 게이트의 간단한 계획이다. 본 문서는 이를 확장한 상세 기준서다.

## 1. 제품 목표

Maglev를 기반으로 토렌트, 직접 파일 링크, 브라우저에서 감지한 HLS/DASH, 자막, 그리고 yt-dlp가 지원하는 YouTube 및 다수 사이트 다운로드를 하나의 Android APK에서 제공한다. 사용자는 공유 메뉴, URL 붙여넣기, 앱 내부 브라우저에서 자연스럽게 다운로드를 시작하고, 한곳에서 진행률·취소·재시도·완료 파일을 관리한다.

### 1.1 최종 사용자 경험
- YouTube 앱/Chrome/Samsung Internet에서 공유 또는 링크 복사 → Maglev에서 URL 인식 → 메타데이터/포맷 조회 → 사용자가 화질/오디오 선택 → 다운로드 → Download/Maglev 위치 저장 → 갤러리/플레이어에서 재생.
- 브라우저에서 HLS/DASH/MP4 등 미디어를 감지하고, 오탐을 줄이면서 적절한 다운로드 엔진으로 전송.
- torrent, direct link, stream, yt-dlp 다운로드가 하나의 Transfers 화면과 알림 체계에 표시.
- UI 전반이 자연스러운 한국어로 표시되며, 설정·대화상자·오류·로딩·빈 상태·권한 설명도 빠짐없이 번역.
- 백그라운드 다운로드는 포그라운드 서비스와 알림으로 유지되며 앱 재시작 후 작업 상태를 복구.
- APK는 기본 ARM64 빌드로 유지하여 universal APK의 과도한 용량을 피한다.

### 1.2 성공 기준
제품은 단순히 “빌드됨”이 아니라 다음을 모두 충족해야 한다.
1. Android 실기기에서 yt-dlp 엔진 초기화/버전/정보 조회가 실제로 동작.
2. YouTube 공유/붙여넣기부터 저장·재생까지 전 구간 성공.
3. Maglev 기존 torrent/direct/HLS/DASH 기능 회귀 없음.
4. 전체 UI의 한국어 완성도 검수 통과.
5. 취소·재시도·백그라운드·재시작 복구·파일 저장 위치가 정상.
6. APK ABI, 서명, 크기, 16 KB page alignment 등 빌드 품질 확인.
7. 사용자에게 전달한 정확한 APK artifact가 테스트한 바이너리와 동일함을 SHA-256으로 증명.

## 2. 원천 자료와 신뢰도 구분

### 2.1 자료 분류
| 자료 | 역할 | 신뢰도/한계 |
|---|---|---|
| Maglev 원본 저장소/코드/릴리스 | 기반 구조, 기존 기능, 실제 integration point | 코드와 해당 commit을 직접 확인해야 함 |
| PR #1 및 Actions 기록 | 현재 포크 변경/실패/통합 진행 | PR의 구현 주장과 실제 APK 동작은 별도 |
| 사용자 제공 Claude 분석 문서 | 요구사항, WP0–WP7, LJ 분석, 엔진 설계 초안 | 2차 분석 자료; 코드/API/실기기 검증 필요 |
| LJ Video Downloader 1.1.79 APK 분석 | 브라우저 감지·헤더·probe·HLS 처리 동작 레퍼런스 | 난독화 및 일부 디컴파일 실패; 일부 로직은 추정 |
| YTDLnis Android 소스/APK | UX 및 기능 범위의 레퍼런스 | Kotlin/XML UI를 Maglev에 그대로 합치지 않고 기능을 RN으로 재구현 |
| youtubedl-android 소스 | 실제 yt-dlp/Python Android 엔진 | 버전별 API/ABI/네이티브 패키징/런타임 요구사항 검증 필요 |
| yt-dlp upstream | 추출기/지원 사이트/옵션/업데이트 | 사이트 변경으로 지속 업데이트 필요 |
| Galaxy 실기기 테스트 | 최종 사용자 수용 기준 | 현재 미완료 |

### 2.2 확인되지 않은 원본 바이너리
이 대화에서 재열람 가능한 실제 LJ/YTDLnis APK 바이너리와 SHA-256은 확인되지 않았다. 클로드 문서에 기록된 디컴파일 분석은 통합했으나, APK의 실제 클래스·리소스·manifest·라이브러리 목록을 새로 역공학했다고 주장하지 않는다. 원본 APK가 확보되면 다음 정보를 추가로 기록한다.
- 파일명, 버전Name/versionCode, packageName, 파일 크기, SHA-256
- APK Analyzer/apktool/jadx 결과 경로
- manifest permissions/services/receivers/providers
- native libs ABI 목록과 포함된 Python/FFmpeg/yt-dlp 구성
- 화면·intent·다운로드 서비스·엔진 클래스의 실제 매핑
- 클로드 분석과 APK 직접 확인이 다른 항목 및 판정 근거

## 3. Maglev 기반 분석

### 3.1 기술 구조
Maglev는 Expo/React Native + TypeScript UI와 Rust 기반 다운로드 엔진(librqbit 수정본)을 사용하는 Android 앱이다. 주요 영역은 `app/`, `components/`, `modules/maglev-engine/`, `native/maglev-core/`, `plugins/` 등이다. 저장소 라이선스는 GPL-3.0으로 확인된다.

### 3.2 보존할 기존 기능
- 토렌트/magnet 다운로드
- 직접 파일 링크 다운로드, pause/resume, 만료 링크 갱신
- 브라우저 탭, 기록, 북마크, 팝업 차단, 비공개 모드
- 페이지 영상/파일 감지, 크기 표시, 다중 선택, 롱프레스 다운로드
- HLS/DASH 화질 선택 및 저장
- 스트림 요청/리다이렉트의 Cookie, Referer, Origin 전달(기존 v0.32 변경 기록)
- 자막, 40개 이상 검색 소스, RSS 자동 다운로드, 제한 옵션, 테마
- 공유 인텐트와 기존 Transfers/알림/저장 UX

Maglev README에서 미해결로 언급된 YouTube류, DRM, live 항목은 별도 검증 대상이다. “Maglev가 모든 스트림을 이미 처리한다”는 가정은 하지 않는다.

### 3.3 기반에 대한 결정
Maglev의 UI와 다운로드 관리자 경험을 유지한다. 기존 `maglev-engine`에 yt-dlp의 Python/native process를 억지로 섞지 않는다. YouTube 추출은 공개·명시적인 독립 `ytdlp-engine` API로 제공하고, 기존 엔진은 torrent/link/stream 책임을 유지한다.

## 4. LJ Video Downloader 분석 및 Maglev 이식 명세

대상 분석 문서: package `com.leavjenn.m3u8downloader`, version 1.1.79. 분석 보고서에는 Fetch2, FFmpegKit, OkHttp, HtmlUnit, Gson, RxJava 사용이 기록되어 있다. 난독화되어 있고 DownloadService의 일부 메서드는 디컴파일되지 않았으므로 내부 구현 세부는 일부 추정이다.

### 4.1 미디어 감지 pipeline
1. WebView `WebViewClient.shouldInterceptRequest`와 `ServiceWorkerClient.shouldInterceptRequest`에서 동일한 감지 경로로 요청을 관찰한다. 응답을 가로채 변조하지 않고 null 반환으로 관찰 전용 처리.
2. 먼저 사이트별 정규식/JS 핸들러 적용.
3. GET 요청만 검토.
4. 정적 리소스 확장자(ts, css, gif, ico, jpg, m4s, mp3, png, svg 등)는 노이즈로 제외. `googlevideo.com`은 LJ에서 제외 대상이며 Maglev에서는 YouTube를 yt-dlp로 라우팅하는 정책과 함께 다뤄야 한다.
5. 원본 요청 헤더를 복사하고 누락된 헤더만 보충:
   - User-Agent: 현재 WebView UA
   - Referer: 현재 페이지 URL
   - Origin: 페이지 scheme://host
   - Sec-Fetch-Site: same-origin/same-site/cross-site 계산
   - Sec-Fetch-Dest: m3u8/mpd는 empty, 영상 파일은 video
   - Sec-Fetch-Mode: same-origin, cors, no-cors 규칙
   - Cookie: Android CookieManager에서 해당 URL 쿠키
   - Accept-Language, Connection: close, Range: bytes=0-255
6. `MediaMetadataRetriever.setDataSource(url, headers)`로 첫 프레임/길이/해상도를 확인. 성공하면 미디어 항목 생성, 실패하면 후보 제외.
7. 생성 항목은 name, thumbnail, URL, headers, resolution, duration을 보관하고 URL 기준 중복 제거/기존 항목 갱신.
8. UI에서 영상 N개 버튼 숫자를 갱신하고 발견 시 애니메이션을 제공.

### 4.2 LJ 사이트별 JS 규칙
정규식과 JS snippet을 매핑하는 규칙 테이블이 존재한다는 분석이다. 브리지:
- `qreq(url, method, headersJson, body, callbackJs)`: OkHttp API 요청 후 응답으로 callback JS 실행
- `qscrape(url, headersJson, body, regex, callbackJs)`: HtmlUnit으로 페이지를 가져와 정규식으로 설정 JSON 추출
- `wefhf(resultJson)`: name/url/ext/thumbnail/duration/resolution 결과 배열을 앱에 등록
- 예시: Vimeo player config에서 HLS CDN URL을 추출해 m3u8 후보로 등록.
- 규칙 업데이트용 웹페이지가 있어 원격 규칙 갱신 구조로 보인다는 분석이 있으나, 직접 APK 재검증 전에는 확정 사실로 취급하지 않는다.

Maglev 적용: 기존 `plugins/` 구조와 비교하여 규칙 스키마를 확정한다. 안전한 JSON 규칙/버전/캐시/rollback을 우선하고, 임의 원격 JS 실행을 그대로 복제하지 않는다. 필요한 API/스크래핑 기능은 도메인별 allowlist와 명시적 테스트를 거친다.

### 4.3 LJ 다운로드 pipeline
1. m3u8 master/media playlist 파싱: STREAM-INF, MEDIA, KEY, MAP, BYTERANGE.
2. 분리 오디오 스트림은 별도 폴더로 다운로드.
3. Fetch2로 세그먼트를 병렬 다운로드(분석상 기본 5개, 설정 가능), 사용자 지정 헤더 지원.
4. AES-128 HLS: KEY URI 수신 후 AES/CBC/PKCS5Padding으로 세그먼트 복호화. IV는 playlist 값, 없으면 HLS 기본 IV 규칙. 분석 문서에 원본을 nonDecrypted에 보관한다고 기록되어 있음.
5. FFmpegKit으로 재인코딩 없이 concat/copy 병합. 일반 concat 및 TS concat 경로를 구분.
6. 포그라운드 dataSync 서비스, SAF URI 저장, 용량 부족·재시도·알림·진동 처리.

Maglev 적용: 기존 HLS/DASH 엔진이 처리하는 항목은 재구현하지 않고, probe/헤더/Service Worker/오디오 병합 등 검증된 gap만 보완한다. HLS AES-128 지원은 자체 테스트 playlist로 확인. DRM(FairPlay/Widevine)은 우회하지 않고 명시적 미지원 안내.

## 5. YTDLnis 및 yt-dlp 엔진 분석/이식

### 5.1 YTDLnis의 역할
YTDLnis는 Kotlin 기반 앱이며 yt-dlp를 `youtubedl-android` 계열 엔진으로 사용한다. 기능 레퍼런스로서 다음을 포함한다.
- 1000개 이상 사이트 지원(yt-dlp extractor에 의존)
- 공유 시트/인텐트 진입, URL/메타데이터/포맷 선택
- playlist item별 선택, 공통 포맷/일괄 설정
- queue, 예약, 동시 다운로드, retry, 재다운로드
- 커스텀 커맨드/템플릿/터미널, 로그
- 쿠키 로그인, 오디오 추출, 구간 컷/챕터 분할
- SponsorBlock, subtitle/metadata/chapter/thumbnail embed
- 빠른 다운로드, 시크릿 모드, backup/restore
- Python, JS runtime(NodeJS/Deno), FFmpeg, aria2c를 앱 내에서 관리/업데이트하는 package ecosystem

YTDLnis의 Kotlin/XML UI는 Maglev UI로 복사하지 않는다. 사용자 기능을 요구사항으로 추출해 React Native/Expo에서 재구현한다. YTDLnis 이름/브랜딩을 파생 앱 이름에 사용하지 않는다.

### 5.2 엔진 소스: youtubedl-android
분석 문서 기준 artifact coordinates:
- `io.github.junkfood02.youtubedl-android:library`
- `:ffmpeg`
- `:aria2c`
문서에서 예시로 본 버전은 0.16.0이며 실제 착수 시 upstream 최신 안정 버전, API signature, Android Gradle/NDK 호환성을 확인하고 고정한다. API sketch는 compile-verified가 아니다.

예상 엔진 API:
- `YoutubeDL.getInstance().init(context)`
- `FFmpeg.getInstance().init(context)`
- `Aria2c.getInstance().init(context)`
- metadata: `getInfo(url)` 또는 `execute(YoutubeDLRequest)`
- download: `execute(request, processId, progressCallback)`
- cancel: `destroyProcessById(processId)`
- update: `updateYoutubeDL(context, STABLE/NIGHTLY)`
- aria2: `--downloader libaria2c.so`

검증 필수: 실제 artifact version의 callback signature, update enum, process cancel semantics, native libs ABI, Python runtime version, yt-dlp build, FFmpeg/aria2 integration, `extractNativeLibs`/legacy packaging, Android 10+ storage, 16 KB page alignment.

### 5.3 독립 Expo 모듈
목표 경로 `modules/ytdlp-engine/`:
- Android Kotlin module: init/version/getInfo/download/cancel/update
- TS wrapper: strongly typed result/options/events
- events: progress, ETA, speed, output, done, error, cancelled
- native process ID와 JS transfer ID를 명확히 매핑
- process lifecycle, duplicate ID, cancellation race, module destroy 처리
- URL/headers/cookies/logging 개인정보 보호
- engine init 실패 원인을 사용자용 메시지와 상세 diagnostic으로 분리

모듈은 기존 `maglev-engine` 내부 private host method에 의존하지 않는다. Expo autolinking/config plugin, package.json, Gradle dependency, manifest, Proguard/R8, ABI packaging을 함께 검증한다.

### 5.4 PO Token / JS runtime / 사이트 변화
YouTube 추출은 yt-dlp extractor와 YouTube 정책/사이트 변경에 영향을 받는다. PO Token provider, JS runtime, player client 요구사항은 현 시점의 yt-dlp 문서/릴리스 기준으로 조사 후 구현한다. 단순 “yt-dlp가 들어있다”는 것으로 YouTube 지원을 보장하지 않는다. yt-dlp 업데이트 채널은 stable 기본, nightly는 선택/진단으로 둔다. 업데이트 실패 시 마지막 정상 버전을 보존하고 rollback을 제공한다.

## 6. 통합 아키텍처와 URL routing

```
Maglev React Native UI
 ├─ URL classifier / intent parser
 ├─ Existing maglev-engine
 │   ├─ torrent / magnet
 │   ├─ direct file / attachment
 │   └─ HLS / DASH / browser detected stream
 ├─ New ytdlp-engine (Expo Kotlin module)
 │   ├─ yt-dlp + bundled Python
 │   ├─ FFmpeg / aria2c (only verified compatible)
 │   └─ metadata / formats / download / cancel / update
 ├─ Browser detection adapter
 │   ├─ WebView request observer
 │   ├─ ServiceWorker request observer
 │   ├─ LJ-derived headers + probe
 │   └─ site-specific rule registry
 └─ Shared transfer repository + foreground notification/service
```

### 6.1 Routing table
| 입력 유형 | 엔진 | 정책 |
|---|---|---|
| magnet: / .torrent | maglev-engine | 기존 torrent route 유지 |
| 확장자 파일 URL / Content-Disposition attachment | maglev-engine | 직접 링크 우선 |
| .m3u8 / .mpd 직접 URL | maglev-engine | 기존 HLS/DASH 우선, 실패 시 사용자 선택으로 yt-dlp fallback |
| yt-dlp 지원 도메인 (youtube.com, youtu.be 등) | ytdlp-engine | 도메인/URL parser를 테스트로 검증 |
| 공유 intent의 plain text/URL | classifier | URL 추출·정규화·중복 제거 |
| unknown web page | browser | 페이지 열기 + “yt-dlp로 분석/다운로드” 명시 버튼 |
| browser detected media | stream/link | header-preserving transfer로 전송 |
| googlevideo URL | policy | 직접 감지에 의존하지 않고 YouTube URL을 yt-dlp route로 처리 |

도메인 목록에 없는 모든 페이지에 yt-dlp getInfo를 자동 실행하지 않는다. 분석은 사용자가 명시적으로 선택했을 때만 실행해 응답 지연과 불필요한 process startup을 줄인다.

### 6.2 공유/URL 처리 수용
- `https://youtu.be/<id>`, `youtube.com/watch?v=`, `/shorts/`, `/live/`, playlist URL, URL query/fragment, trailing punctuation.
- Android ACTION_SEND, ACTION_VIEW, clipboard paste, in-app browser menu.
- host parsing은 subdomain과 scheme normalization을 처리하며, `www.youtube.com` 포함.
- intent가 여러 URL을 포함할 때 preview/selection; invalid URL은 Korean error.
- intent URL의 query string은 로그/analytics에서 redact.

## 7. 공통 Transfers 모델

각 작업은 최소한 다음 정보를 저장한다.
- id, source (`torrent | link | stream | ytdlp`), originalUrl (보안 저장/로그 redact), title, thumbnail, mime/ext
- status (`queued | preparing | downloading | merging | completed | failed | cancelled`)
- progress, totalBytes, downloadedBytes, speed, ETA
- outputUri/path, createdAt, updatedAt, retryCount, lastErrorCode, userFacingError
- engine-specific options (versioned schema), selected format, playlist index
- resumability flag, headers/cookie reference (secure reference, not raw logs)

큐는 영속 저장하며 앱 재시작 후 상태를 재구성한다. 완료 후 앱 전용 staging 폴더에서 MediaStore/SAF Download/Maglev로 이동하고 갤러리 숨김 옵션을 존중한다. 파일 이동 실패 시 원본 staging 파일을 삭제하지 않고 재시도 안내한다.

## 8. 상세 작업 패키지와 게이트

### G0 — Baseline / repository audit
- [ ] PR #1 head와 dev base SHA 기록
- [ ] package.json, Expo module autolinking, maglev-engine contract, existing browser detection, transfer model, foreground service map
- [ ] Actions workflow/branches/releases/artifacts inventory; delete only reviewed obsolete items
- [ ] clean build + existing torrent/direct/HLS baseline
**Gate:** baseline commit/Actions/functional evidence captured.

### G1 — Native yt-dlp engine smoke test
- [ ] Confirm upstream artifact/version/API and license
- [ ] Create minimal isolated module spike, no UI yet
- [ ] init → version → getInfoJson on known public test URL
- [ ] capture exact root exception, process exit code, stderr, redacted URL
- [ ] check ABI/native library load and APK size
**Gate:** real device returns metadata/formats; not merely Kotlin compile.

### G2 — Standalone `ytdlp-engine`
- [ ] stable API and TS types
- [ ] progress/ETA/speed/error/done/cancel events
- [ ] lifecycle/cancel/retry process safety
- [ ] stable/nightly updater with rollback
- [ ] config plugin, manifest, extractNativeLibs, ABI packaging
**Gate:** test download, cancel, repeat, app background, no crash/leaked process.

### G3 — Shared queue / persistence / storage
- [ ] shared transfer schema and source discriminator
- [ ] queue concurrency limits and retry policy
- [ ] foreground service/notification integration
- [ ] persisted queue, app restart recovery
- [ ] staging-to-MediaStore/SAF move, storage permission UX
**Gate:** background and restart tests pass.

### G4 — URL and intent routing
- [ ] YouTube host/path test matrix incl youtu.be and www
- [ ] share from YouTube app/Chrome/Samsung Internet
- [ ] paste, ACTION_VIEW, browser action
- [ ] playlist and invalid/multi-URL behavior
**Gate:** all accepted URLs route to correct engine, no generic engine-call failure.

### G5 — Full Korean localization
- [ ] string inventory across app/, components/, settings, dialogs, errors, loading/empty states
- [ ] remove user-facing hardcoded English; preserve technical identifiers only
- [ ] Korean font/spacing/line wrapping; TalkBack labels
- [ ] screenshots across primary screens and error paths
**Gate:** no untranslated user-facing strings in full UI audit.

### G6 — LJ media detection gap closure
- [ ] determine actual WebView implementation and hook points
- [ ] ServiceWorker request observation if missing
- [ ] preserve original headers, add only missing context headers
- [ ] static resource filtering and googlevideo policy
- [ ] MediaMetadataRetriever probe with authenticated headers
- [ ] URL dedupe/update and accurate detected item count
- [ ] site-specific rule schema, versioning/cache/rollback
- [ ] HLS AES-128 and separated audio tests; FFmpeg remux fallback
**Gate:** local test server and known public media cases pass; false positives measured.

### G7 — YTDLnis P0 parity
- [ ] format selector (video/audio/custom)
- [ ] best quality, 1080p, 720p, MP3, M4A presets
- [ ] playlist item selection and batch format
- [ ] queue concurrency, retry, progress, cancel
- [ ] yt-dlp version/update UI
**Gate:** all P0 workflows complete on device.

### G8 — P1/P2 feature scope
P1: subtitle/thumbnail/metadata embed, cookie import, filename template, aria2c, SponsorBlock, backup/restore.  
P2: custom command/template/terminal, chapter split/trim, scheduled download, incognito.
Each feature is implemented only after P0 stability and each has its own tests. Do not mark the whole feature tier complete from a UI mock.

### G9 — Release validation
- [ ] CI unit/contract/JS/Rust tests
- [ ] ARM64 APK, package/version identity, signature, size, 16 KB alignment
- [ ] emulator install/launch/navigation smoke
- [ ] Galaxy physical device end-to-end
- [ ] YouTube single video 1080p mp4 download/save/play
- [ ] audio extraction MP3 + thumbnail metadata
- [ ] playlist selection and batch download
- [ ] background, cancel, retry, app restart recovery
- [ ] torrent/direct/HLS/DASH regression
- [ ] Korean localization audit
- [ ] artifact SHA-256 equals installed/tested artifact
**Gate:** only then release/merge and provide installation link.

## 9. UI/UX scope
- Reuse Maglev theme, OLED/Dim/Light and existing design tokens.
- Add format selection sheet with Video / Audio / Custom tabs; show format_id, ext, resolution, fps, codec, filesize (unknown size handled).
- Presets: best, 1080p, 720p, MP3, M4A.
- Playlist screen: checkbox per item, select all, common format, batch edits.
- Settings: default quality, filename template, cookie import, update channel, aria2c, concurrency.
- Entry points: home URL add, Android share, clipboard paste, browser menu.
- Transfer row: source icon, title, progress, speed, ETA, status, pause/cancel/retry, details/log.
- All errors: short Korean actionable message + optional technical details. “Engine call failed” is not an acceptable terminal error.
- Keep user-facing wording consistent; distinguish analysis, downloading, merging, saving, and completed states.

## 10. Test matrix and required evidence

### 10.1 YouTube / yt-dlp
- URL forms: youtu.be, youtube.com/watch, shorts, live, playlist, share URL.
- Public video metadata/formats, selected format, merged video/audio, audio-only, thumbnail, subtitles.
- Error categories: unavailable/private/age/login/PO Token/runtime/network/unsupported/format/permission/storage.
- Verify file exists, MediaStore entry, playable output and correct duration/resolution.

### 10.2 LJ-derived media detection
- direct MP4 with/without extension, m3u8 master/media, mpd, cross-origin media, cookies/referer-required media.
- Service Worker page, site-specific player config, duplicate requests, static assets false positive.
- HLS AES-128 test stream; separated audio; remux without re-encode.
- DRM sample must report unsupported; no bypass.

### 10.3 Existing Maglev regression
- torrent start/pause/resume/complete
- direct link pause/resume/expired link
- HLS/DASH resolution selection and output
- subtitles, RSS, browser tabs/history/bookmarks
- share link, storage move, notification, app restart

### 10.4 Device evidence
Every acceptance record includes:
- device model / Android version / ABI
- app versionName/versionCode and commit SHA
- Actions run + artifact ID
- APK SHA-256, signature cert, size
- steps performed and actual outcome
- logs with URL query/cookies/tokens redacted
- screenshots or screen recording where UI behavior matters

## 11. Build, packaging, release
- Default ARM64 APK; do not produce Universal by default.
- Record per-ABI native libraries and APK size; avoid shipping unused Python runtimes/ABIs.
- Verify `android:extractNativeLibs` or modern packaging configuration as required by selected engine.
- Sign test builds consistently; debug-signed APK is test-only and must be labeled.
- Release notes must state supported features and known limitations.
- Never delete old release/artifact until replacement is verified and user approves cleanup policy.
- Keep workflow purpose distinct: CI, Android build, emulator/E2E, release, audit/monthly compatibility. Remove only genuinely duplicate/obsolete workflows after review.

## 12. License, naming, privacy and unsupported media
- Maglev, YTDLnis, and referenced engine are GPL-3.0 according to the source analysis; confirm exact upstream license files at the selected commit and satisfy source distribution obligations.
- Do not use YTDLnis product name/logo as the fork brand; preserve required notices.
- Cookies and auth headers must be stored securely, not printed in logs or included in crash reports.
- URL query strings, signed URLs, tokens and personal file paths must be redacted.
- DRM-protected streams are not bypassed. Explain unsupported DRM and provide a clear user message.
- Do not promise “download anything”; support is constrained by extractor compatibility, authentication, site changes, network, DRM, and device runtime.

## 13. Repository hygiene and single-track workflow
- PR #1 remains the single integration track while implementation is active.
- PR #3/#4 closed as superseded; PR #5 ARM64 changes integrated.
- No release/tag before G9.
- Branch cleanup: list branches and compare reachable commits before deletion; do not delete source of PR #1 or baseline refs.
- Workflow cleanup: identify trigger, artifact, secrets, and dependency for each workflow before deletion. Preserve workflows that perform independent required gates.
- Release cleanup: inventory assets and downloads; remove only after verified replacement and explicit approval.
- Every implementation commit updates this document’s “Current status / resume pointer” section or a linked progress ledger.

## 14. Current progress / resume pointer
**At document creation**
- [x] PR #1 established as single active implementation PR.
- [x] Prior parser/share/yt-dlp work consolidated on PR #1.
- [x] Integrated product plan added.
- [x] Native error wrapper improved to expose sanitized root-cause type.
- [x] URL query redaction assertion added.
- [ ] Independent ytdlp-engine module — not complete.
- [ ] Real device init/getInfo/download — not complete.
- [ ] Full Korean UI — not complete.
- [ ] PO Token / runtime verification — not complete.
- [ ] LJ detection gap implementation — not complete.
- [ ] Galaxy E2E — not complete.
- [ ] Release acceptance — not complete.

**Resume order:** G0 → G1 → G2 → G3 → G4 → G5 → G6 → G7 → G8 → G9. If a gate fails, fix that gate and rerun it; do not jump to release or declare success from a downstream build.

## 15. Reference sources
- Maglev upstream: https://github.com/Kaos599/Maglev
- Maglev Discussion #85 (yt-dlp embed discussion): https://github.com/Kaos599/Maglev/discussions/85
- YTDLnis source: https://github.com/deniscerri/ytdlnis
- YTDLnis packages/runtime ecosystem: https://github.com/deniscerri/ytdlnis-packages/
- youtubedl-android source: https://github.com/yausername/youtubedl-android
- yt-dlp supported sites: https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md
- Current integrated PR: https://github.com/dragonslayers-k/Maglev_forked/pull/1
- Current repository plan: https://github.com/dragonslayers-k/Maglev_forked/blob/feature/p1-video-detection-observer/docs/INTEGRATED_PRODUCT_PLAN_KO.md

## Appendix A. Source document carry-forward
The user-provided Claude analysis document is preserved conceptually in this integrated specification: original target Maglev v0.32; WP0–WP7; LJ 1.1.79 behavior; ytdlnis feature priorities P0/P1/P2; youtubedl-android API sketch; architecture and routing; test acceptance; and 2–3 week estimate as an unverified initial estimate only. The original schedule must be recalculated after G0/G1 because actual repository integration points and device failures may change effort.

## Appendix B. Engine option examples (initial reference; verify against current yt-dlp)
- Best video: `-f 'bv*+ba/b' --merge-output-format mp4`
- MP3: `-x --audio-format mp3 --audio-quality 0`
- Embed metadata/thumbnail/subtitles: `--embed-metadata --embed-thumbnail --embed-subs`
- SponsorBlock: `--sponsorblock-remove sponsor,selfpromo`
- aria2c: `--downloader libaria2c.so`
- Cookie file: `--cookies <file>`

Options must be built as typed argument arrays, not shell-string concatenation. Confirm option availability and compatibility with the packaged yt-dlp version before exposing them in UI.


## Appendix C. 직접 확보한 LJ APK 바이너리 증거 — 2026-11-25 추가

현재 대화의 업로드 파일에서 LJ XAPK를 실제 확인했다.
- XAPK: `Lj+Video+Downloader+(m3u8,mp4)_1.1.79_APKPure (1).xapk`
- XAPK 내부 base APK: `com.leavjenn.m3u8downloader.apk` (12,069,682 bytes)
- base APK SHA-256: `f65a847504c8e9587c9f173bb5b23125de8563770aaf28897a4c0ef143ab047b`
- XAPK 내부 split: `config.armeabi_v7a.apk` (18,638,168 bytes), `config.en.apk` (65,945 bytes), `config.xhdpi.apk` (80,196 bytes)
- base APK archive inventory: `classes.dex`, `classes2.dex`, `classes3.dex`; HtmlUnit resource tree present; base APK archive에 `lib/` native library directory는 발견되지 않음.
- XAPK base APK를 ZIP 구조로 열고 파일 목록·크기·SHA-256을 확인했다. 현재 실행환경에는 jadx/apktool이 없어 manifest binary decode 및 DEX method-level decompilation은 아직 수행하지 않았다. 따라서 위 직접 확인은 파일/패키지 구성 수준이며, 4장 LJ 동작 설명은 Claude 분석자료 기반으로 유지한다.

### Appendix D. YTDLnis APK/source evidence

YTDLnis Android source reference: https://github.com/deniscerri/ytdlnis ; package ecosystem: https://github.com/deniscerri/ytdlnis-packages/ . This conversation's mounted uploads did not include a YTDLnis APK binary, so its APK manifest/DEX/native-library inventory and SHA-256 are not yet independently inspected. The current engine integration design relies on the separately referenced youtubedl-android source, not on copying the YTDLnis APK binary. If a YTDLnis APK is later supplied, record package/version/hash and inspect manifest, service/receiver/intent, runtime package manager, Python/JS/FFmpeg/aria2 assets, downloader command construction, and storage/notification flow before changing this document.


## Appendix E. Upstream source snapshot — 2026-11-25

This section supplements the original 2026-11-25 Claude analysis with a current upstream README/changelog check. It does not mean the integration has been implemented.

### youtubedl-android
- Current upstream README lists dependency version `0.18.1` for `library`, `ffmpeg`, and optional `aria2c`; release page shows 0.18.1 dated 2026-11-16 and 0.18.0 includes 16 KB page-size support. This supersedes the original Claude document's illustrative 0.16.0 coordinate; implementation must pin and test 0.18.1 (or a newer verified version), not blindly copy 0.16.0.
- README documents bundled yt-dlp executable + Python 3.8, init, getInfo, execute progress callback, process ID cancellation, stable/nightly updater, FFmpeg init for post-processing, optional Aria2c and `--downloader libaria2c.so`.
- README requires `android:extractNativeLibs="true"`, ABI filters/splits, and describes Android scoped-storage constraints. Verify against current target SDK and actual Maglev storage implementation.
- References: https://github.com/yausername/youtubedl-android/blob/master/README.md ; https://github.com/yausername/youtubedl-android/releases

### yt-dlp upstream runtime requirements
- Current yt-dlp README says supported Python versions are 3.11+ and recommends `ffmpeg`, `ffprobe`, `yt-dlp-ejs`, and a supported JavaScript runtime; yt-dlp-ejs is required for full YouTube support. The engine library README's bundled Python 3.8 is therefore a compatibility risk to test against the exact packaged yt-dlp/lazy-extractor build. Do not assume the latest upstream yt-dlp can simply be swapped into the bundled Python 3.8 environment.
- Reference: https://github.com/yt-dlp/yt-dlp/blob/master/README.md

### YTDLnis current source/release notes
- Current official README lists audio/video/custom commands, playlists/batch editing, queue/schedule/concurrency, retry, file editing, cookies, custom templates/terminal, share card, logs, incognito, backup/restore, MVVM + WorkManager, and plugin management for Python/JS runtimes/FFmpeg/aria2c.
- Current changelog/release notes mention package integration (separate package repository), a rewritten/integrated YoutubeDL engine, Python 3.14 with curl-cffi and related packages, and BGUtils PO Token provider using Deno/Node package runtime. These are current source observations and supersede the older analysis where it differs; they are **feature/runtime references**, not code copied into Maglev.
- References: https://github.com/deniscerri/ytdlnis/blob/main/README.md ; https://github.com/deniscerri/ytdlnis/blob/main/CHANGELOG.md ; https://github.com/deniscerri/ytdlnis-packages/

### Architecture decision after this source check
- Keep youtubedl-android as a candidate engine integration, but G1 must validate whether its bundled Python 3.8/lazy yt-dlp package satisfies current YouTube requirements. If not, evaluate (a) upstream-compatible runtime/package upgrade path, (b) YTDLnis-style managed Python/JS/runtime packages, or (c) a different maintained Android embedding. Decision requires a reproducible device spike, APK size measurement, 16 KB ABI validation, and update/rollback strategy.
- YouTube acceptance explicitly includes yt-dlp-ejs/JS runtime and PO Token behavior. “getInfo works for a public URL” is not enough to claim current YouTube compatibility.


## Appendix F. CI run #148 재검증 및 작업 재개 기록 — 2026-11-25

- GitHub Actions run **#148**: [45625614864](https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45625614864), commit `1dea9d0af7a5534ab1b837572394747256f57894`, 완료 / success.
- Run #147 ([45625278310](https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45625278310))는 새 실행에 의해 취소된 이전 작업이며 실패로 계산하지 않는다.
- #148 성공 작업: Rust tests, Contract tests, JS checks/typecheck, ARM64 Rust build 및 16 KB alignment, APK build/signature/versionCode checks, Kotlin unit tests.
- #148은 PR #1에 대한 CI run이며 **PR 번호가 아니다**. 현재 PR은 Draft PR #1, feature branch head는 위 SHA이다.
- CI 성공은 코드/빌드 검증이다. Galaxy 실기기에서 yt-dlp 초기화, 공개 영상 metadata/formats, 실제 다운로드·재생을 확인한 증거는 없다. 이 APK는 기능 승인/최종 배포본이 아니다.
- G0 재점검: 현재 YouTube adapter `YoutubeDownload.kt`가 여전히 `modules/maglev-engine` 안에 있고 해당 모듈 Gradle이 `youtubedl-android:library:0.18.1`에 직접 의존한다. 목표 독립 `modules/ytdlp-engine` 구조와 불일치한다. 기존 add flow가 내부 `EngineHost`에 연결돼 있으므로 분리 시 transfer handoff/공통 목록 contract를 함께 설계해야 한다.
- G1 상태: cold-start engine wait와 native exception/root-cause 진단 개선은 코드에 반영됐지만 실기기 테스트는 미수행이므로 `IN_PROGRESS` 유지.
- 재개 순서: (1) G0 transfer/native contract audit → (2) G1 Galaxy init/version/getInfo/format smoke evidence → (3) G2 standalone module download/cancel/progress/update → (4) G3 shared Transfers persistence/foreground/background/restart → (5) G4 share/paste routing → (6) G5 app-wide Korean → (7) G6 LJ gap audit/implementation → (8) G7 parity → (9) G8 regression/release QA. Gate failure must be fixed before advancing.


## Appendix G. Standalone engine scaffold / CI findings — 2026-11-25

- Added `modules/ytdlp-engine` as a separate Expo local package; its Kotlin module does not reference `EngineHost`. Public TS API: init/getInfo/download/cancel/update plus progress/completed/failed events. Root dependency and lockfile updated.
- CI run #152 exposed TS event emitter type errors; corrected by typing the emitter as a native event emitter bridge. The next run passed TypeScript typecheck.
- CI run #154: standalone module contract tests and existing contract job passed; JS test suite then failed because generated `constants/licenses.generated.ts` did not yet list the newly added local runtime dependency. Added its GPL-3.0-only entry to the generated list.
- Expo prebuild/autolinking step completed successfully on #154. APK Gradle compilation was still running when this correction was committed; run was superseded by the new commit. This is not a Kotlin compile pass.
- This scaffold is intentionally not yet connected to the existing YouTube screen or Transfers. The legacy adapter remains until the separate engine-to-transfer handoff, durable queue and media finalization are implemented, to avoid breaking existing Maglev behavior prematurely.


## Appendix H. MPMux 벤치마크 및 통합 재설계 — 2026-11-26

이 부록은 기존 Appendix G의 standalone `modules/ytdlp-engine` scaffold 이력을 삭제하지 않고, 최신 제품 아키텍처 결정을 추가한다.

### H.1 MPMux 공개 기능
- Static Downloader: HTTP Range로 정적 MP4/WebM/Ogg 등을 최대 3개 연결로 분할 요청해 저장.
- HLS VOD: playlist/segment를 읽어 MP4로 재패키징, VOD 동시 요청 최대 3개.
- HLS Live: 실시간 전달이므로 순차 수집, 약 2GB 단위 분할 저장.
- Video Buffer Muxer: 화면 녹화가 아니라 HTML5 MediaSource API의 버퍼를 받아 MP4로 재패키징. VOD/live, timestamp 기준 화질 전환 병합, 약 1GB 단위 분할 저장을 설명. 암호화/비표준 버퍼는 결과가 잘못될 수 있음.
- v1.2의 최대 5배 buffering은 VOD 한정이며 페이지 화질/재생 안정성 부작용 가능성이 있어 Maglev는 자동 적용하지 않음.
- 공식 근거: https://chromewebstore.google.com/detail/video-downloader-mpmux/mbflpfaamifmmmkdjkcmpofpccfmlmap?hl=en-US ; https://mpmux.com/staticdownloader ; https://mpmux.com/hlsdownloader ; https://mpmux.com/buffermuxer

### H.2 Maglev 직접 대조
- `segments.rs`: Range 206 probe, 최소 8MiB, strong ETag/Last-Modified, 최대 8 part, offset write, sidecar resume, 429/503 거절 대기/동시성 축소, validator/content-range drift 시 단일 연결 fallback.
- `hls.rs`: VOD variant/audio group, BYTERANGE/MAP, AES-128 identity parser. SAMPLE-AES/비표준 KEYFORMAT 등은 미지원.
- `StreamMuxer.kt`: MediaExtractor/MediaMuxer 기반 A/V track 병합.
- `MaglevBrowserView.kt`: WebView request observer 및 active-tab ServiceWorker observer.
- `PageScan.kt`: DOM media, Resource Timing, fetch/XHR MIME, EME/Blob 징후 관찰. Blob note 자체가 MSE byte 저장을 의미하지 않음.
- 현재 HLS parser는 ENDLIST 없는 playlist를 STREAM_LIVE로 거부하며 SourceBuffer byte capture는 없음.

### H.3 최적 구현 결정
1. Static Range/HLS VOD는 기존 Maglev 엔진을 그대로 사용하며 중복 downloader를 만들지 않음.
2. HLS Live는 Rust stream engine에 live playlist polling/cursor를 추가하고 순차 다운로드, Stop/Finalize, 약 1GiB rotation, sidecar/persistence를 구현.
3. MSE buffer capture는 명시적 사용자 opt-in. SourceBuffer별 init/media fragment와 timestamp를 bounded binary bridge로 native staging에 기록하고 backpressure/rotation을 적용.
4. 별도 audio/video track은 시간축을 유지해 remux; DRM/EME는 차단, 재인코딩/DRM 우회/자동 5x는 범위 밖.
5. 신규 기능 모두 기존 Transfers·알림·MediaStore·재시작 정책에 연결. 독립 큐 금지.
6. MPMux 코드·바이너리·상표·비공개 API는 복제하지 않고 공개 동작만 clean-room 방식으로 구현.

### H.4 YouTube 경로 정렬
- `YoutubeDownload.kt`에 기존 extractor와 `MaglevEngineModule.kt`의 `getYouTubeInfo`, `addYouTubeDownload`가 존재한다.
- `addYouTubeDownload`는 선택한 direct/HLS/DASH URL을 `EngineHost.addDownload`에 넣어 기존 Transfers가 소유한다.
- 별도 `modules/ytdlp-engine`은 중복 staging/queue를 만든 실험용 scaffold였으므로 제품 dependency/autolinking에서 제거. 소스 이력은 Git 과거 commit으로 보존.
- YouTube 화면은 `maglevEngine.getYouTubeInfo`와 `maglevEngine.addYouTubeDownload`를 사용하고 성공하면 Transfers로 복귀. 실기기 추출/저장/재생은 별도 device acceptance.

### H.5 CI #159 실패 및 수정
- Run #159 / ID `45639676759`는 `app/youtube-download.tsx:27`의 실제 줄바꿈 대신 들어간 리터럴 `\\n`로 TypeScript/Metro parse 실패.
- commit `2458a27e6ee79ce511865d3d6864538e7013ed2e`에서 구문과 View import 수정.
- commit `2a5d1b8fde95bff01e53eb367b9667fcaab2c871`에서 YouTube 화면의 shared Transfers 연결 및 source regression assertions 반영.
- Run #161 / ID `45643449600`: JS/typecheck/tests, contract tests, Rust tests, ARM64 Rust build 및 16KB alignment는 성공. APK Gradle build는 확인 시점 진행 중이었음.
- #161 최종 APK build result와 Galaxy 실기기 테스트는 이 부록 작성 시점에 별도 확인 필요. 이 기록만으로 최종/DEVICE_PASS를 선언하지 않음.
