# Maglev+ 실제 구현 범위·결함 감사 및 보수 계획 (2026-11-26)

> 적용 대상: `dragonslayers-k/Maglev_forked`, `feature/p1-video-detection-observer`, PR #1  
> 목적: 원본 Maglev/MALREV 업데이트가 아닌 독립 앱 Maglev+의 실제 코드·배포·사용자 보고 오류를 기준으로 구현 여부와 한계를 구분한다.  
> 상태: 코드 정적 감사 1차. Galaxy 실기기 YouTube 다운로드 및 업데이트 설치는 아직 통과로 간주하지 않는다.

## 1. 독립 앱 식별 및 업데이트

- 앱 표시 이름: Maglev+
- Android applicationId/package: `com.maglev.plus`
- 현재 소스 버전: `0.33`, base versionCode `33`; ABI split은 arm64 APK에 ABI digit 4를 붙이는 구조.
- 앱 내 업데이트 UI/state machine: `app/settings/updates.tsx`, `utils/update/*`
- Android updater: `modules/maglev-engine/android/src/main/java/com/maglev/engine/update/AppUpdater.kt`
- 조회 endpoint: 이 저장소의 `https://api.github.com/repos/dragonslayers-k/Maglev_forked/releases/latest`. 원본 upstream/MALREV의 release endpoint가 아니다.
- 설치 전 검증 코드: APK SHA-256, package name, 설치된 버전보다 높은 versionCode, 현재 앱과 동일한 signing certificate(허용된 signing lineage 포함)를 검사하고 Android PackageInstaller로 전달한다.
- 실제 배포 결함/차단: 감사 시점 GitHub API에서 이 저장소의 latest release가 없어 endpoint가 설치 가능한 업데이트를 제공하지 않는다. 따라서 updater UI/native code가 있어도 정식 update cycle은 아직 운영되지 않는다.
- Release workflow는 tag push로 실행되고 app.json version/tag, release notes, APK ABI 이름, SHA256SUMS, signing을 확인해 GitHub Release를 만든다. Release signing secrets가 없으면 debug signing으로 떨어지고 tag release 검증 단계에서 거부된다.
- 완료 조건: 이 앱 전용 서명키로 Release APK 게시 → latest endpoint가 해당 ABI APK와 GitHub asset digest를 반환 → 기존 설치본에서 다운로드/해시/패키지/버전/서명 검증 → Android 설치 승인 및 성공 → 앱 재실행/version 확인. 앱 ID와 서명은 정식 배포 이후 변경 금지.

## 2. YouTube 분석·형식 선택·다운로드

### 현재 소스 구조
- 빠른 형식 조회: NewPipe Extractor + PO Token provider.
- 보조/추가 형식 조회: youtubedl-android/yt-dlp. YouTube player clients: `android_vr`, `web_safari`, `web_embedded`.
- UI: `app/youtube-download.tsx`; native adapter: `YoutubeDownload.kt`, `NewPipeYoutube.kt`.
- 선택한 형식은 기존 Maglev `EngineHost.addDownload` / stream probe에 넘겨 공통 Transfers queue에서 관리하도록 설계됨.
- 초기 NewPipe 형식이 video/audio 모두 존재하면 빠른 결과를 즉시 반환한다. 따라서 초기에 표시되는 화질은 NewPipe가 노출한 progressive/adaptive 후보에 한정될 수 있다.
- “추가 형식 조회”는 `maglev_ytdlp=1`로 yt-dlp를 강제한다. 현재 코드에서는 forced query일 때 client loop의 early-break가 비활성화되어 3개 client를 순차 호출한다. 이 경로가 추가 형식 조회 지연의 주요 코드상 원인 후보이며, 충분한 format coverage가 확보되면 중단하도록 개선해야 한다.

### 확인된 오디오 오류
- NewPipe format object는 `playerClient: "newpipe"`로 반환한다.
- download validation의 allow-list에는 `android_vr/web_safari/web_embedded`만 있었고 `newpipe`가 빠져 있었다. 이후 코드에 NewPipe download branch가 있어도 validation에서 먼저 `INVALID_ARGUMENT` / “선택한 형식이 올바르지 않습니다.”로 종료될 수 있었다.
- 수정 커밋: `d67af240` — NewPipe client validation helper에 `newpipe` 허용.
- 회귀 테스트 커밋: `1babf1a8` — NewPipe YouTube 허용, generic/비YouTube 조합 거부 테스트.
- CI #352는 해당 commit에서 실행 중이며, 결과 확인 전 수정 성공으로 선언하지 않는다.

### 오디오 출력의 실제 한계
- NewPipe `npa<itag>` 경로는 선택한 원본 오디오 stream URL을 직접 Transfers에 추가한다. WEBM/Opus는 WEBM, AAC/MP4 계열은 M4A로 저장하는 원본 컨테이너 방식이다.
- 현재 구현은 MP3 인코딩/트랜스코딩을 수행하지 않는다. 파일 확장자만 `.mp3`로 바꾸는 것은 금지(파일 손상/잘못된 MIME).
- yt-dlp Android wrapper는 `ffmpegPath`를 native library directory로 재설정하고, 현재 빌드에는 실행 가능한 `libffmpeg.so` post-processing runtime이 포함되지 않는다. 기존 FFmpeg AAR은 16 KB page-size/안전성 문제로 의도적으로 제외되어 있다.
- 따라서 현재의 “오디오 다운로드”는 source audio stream 직접 저장이 가능한 형식만 지원하는 상태다. MP3 output, Opus→M4A 변환, container/codec conversion은 아직 구현 완료가 아니다.
- 후속 구현: FFmpeg/encoder 후보를 16 KB page-size, arm64, license, Android API, 재생·파일 크기·metadata·tag·album art로 검증하고 post-process pipeline으로 추가. 사용자에게 output format(MP3/M4A/source) 선택을 제공하되, 선택 codec/container 조합이 실제 변환 가능한 경우에만 활성화한다. MP3/M4A를 요구하면 source audio extraction → temp file → conversion/remux → output verify → final transfer completion을 하나의 작업 상태로 연결해야 한다.

## 3. 비디오 화질 및 분리 A/V

- 초기 360p만 표시되는 것은 빠른 NewPipe 조회가 반환한 format set에 한정될 수 있다. 추가 yt-dlp 조회는 별도 호출이며 현재 3개 client를 순차 탐색한다.
- 추가 조회 후 360p 외 형식이 활성화되는 것은 코드 흐름상 예상 가능하지만, 대기시간이 길고 사용자 경험이 미흡하다.
- 현재 native adapter는 format ID/client를 재조회하고 direct URL 또는 manifest URL을 선택한다. adaptive DASH는 Maglev stream probe와 variant/audio track selection을 사용한다.
- 실제 Galaxy 검증이 필요한 항목: 360/480/720/1080p 각각 선택, 선택 ID와 실제 stream height 일치, audio track 존재, DASH mux, 최종 MP4 재생, size/progress, pause/resume/retry, app background/force-stop 복구.
- 단독 video-only track을 audio 포함 파일로 잘못 표시하지 않는다. 병합할 수 없는 형식은 UI에서 disable/설명하거나 오류를 명확히 보여야 한다.

## 4. 한글화 현황과 결함

- 현재 한글화는 `plugins/babel-plugin-korean-text.js`가 React Native `Text`를 `KoreanText` wrapper로 교체하고 `constants/korean.ts`의 exact-string dictionary를 적용하는 방식.
- 이 방식은 dictionary에 정확히 등록된 문자열만 변환한다. 누락 문자열, 문장 조합/동적 문자열, native Android message, 일부 third-party component text는 자동 번역되지 않는다.
- 현재 `scripts/test-korean-text.js`는 wrapper wiring과 소수의 필수 문자열을 확인하지만 전체 UI string coverage를 검사하지 않는다. 따라서 CI green이어도 앱 곳곳에 영어가 남을 수 있다.
- 필요한 개정: app/routes/components/settings/browser/transfers/YouTube/updates/onboarding/error states 전수 문자열 inventory; 사용자 입력/URL/provider name은 제외; 모든 UI 문구를 locale key로 통합; native error code를 한국어 사용자 문구에 매핑하고 상세 diagnostic은 별도 접기; test에 미등록 UI string failure 및 snapshot/screen inventory를 추가. 화면마다 영어/한국어 혼용이 남으면 localization gate fail.

## 5. 통합 앱 기능의 현재 범위

| 기능 | 코드상 현재 상태 | 완료로 인정하기 위한 검증 |
|---|---|---|
| Maglev torrent/link/Transfers | 기존 엔진·큐 유지 | 회귀: add/pause/resume/retry/remove/save/restart |
| HLS/DASH VOD | 기존 Maglev stream path 사용 | 실기기 저장·재생·복구 |
| YouTube fast formats | NewPipe + PO Token path | 여러 공개 영상/shorts, format/metadata latency |
| YouTube fallback formats | yt-dlp clients 순차 탐색 | 360–1080p, audio, format/client consistency |
| Audio source download | direct stream path 일부 구현 | AAC/M4A 및 Opus/WEBM 다운로드·재생 |
| MP3 output/transcode | 미구현 | 검증된 encoder/postprocessor 필요 |
| Generic yt-dlp sites | 명시적 사용자 실행 경로만 | site-by-site extraction→download→playback matrix; 전체 사이트 지원 주장 금지 |
| LJ downloader capabilities | 관찰/설계 아이디어만 일부 반영 | WebView/ServiceWorker/request observer 및 cookie/header context별 구현·테스트 |
| MPMux HLS live/MSE capture | 설계/비교 대상, 완성 기능 아님 | consent, bounded buffer, audio/video mux, file integrity, DRM rejection |
| In-app app update | UI/state/native verification implemented; no published latest release | signed release lifecycle + actual update install test |
| Korean UI | exact-string dictionary partial | full string inventory and zero untranslated UI gate |

## 6. 수정·검증 우선순위

1. CI #352에서 NewPipe validation regression test와 APK build를 확인한다. 실패하면 로그 기반으로 수정하고 새 run을 검증한다.
2. 오디오 direct-download E2E: NewPipe AAC/M4A 및 Opus/WEBM 각각 실제 다운로드·파일 검사·재생. MP3는 FFmpeg runtime 선정/검증 전 지원으로 표시하지 않는다.
3. 추가 format query를 sequential-all-clients에서 adaptive fallback으로 변경: 첫 client에서 충분한 unique heights/audio candidates를 얻으면 stop; 부족할 때만 다음 client. 결과 cache, timeout/cancel, progress/status를 추가한다.
4. 한글 문자열 inventory를 생성하고 dictionary 미등록 UI 문자열을 CI에서 실패 처리한다. 사용자 제공 title/URL/filename은 번역하지 않는다.
5. update release: custom package/signature/ABI/version scheme을 고정하고 signed APK + SHA256 digest를 GitHub Release에 게시; existing install update test.
6. 전체 capability matrix를 emulator smoke + Galaxy E2E로 통과시키기 전에는 “통합 완성/최종 APK”라고 표기하지 않는다.

## 7. 엄격한 완료 정의

CI success = source/test/build success only. Feature success requires a test record containing device/API, source URL category (private tokens/cookies redacted), selected format/client, output extension/container/codec, byte size, SHA-256, playback result, Transfers controls, and restart recovery. Do not include signed URLs, cookies, authorization headers, PO tokens, or account data in logs.
