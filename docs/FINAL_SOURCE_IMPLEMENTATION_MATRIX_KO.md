# Maglev+ 원천 프로그램별 구현 대조 및 최종화 게이트

> **CURRENT STATUS OVERRIDE — 2026-11-26 (supersedes older status lines below):** Actions #535 PASS and APK artifact uploaded, but this is CI/build only. User's Galaxy test remains FAIL for YouTube target extension/output and WireGuard tunnel. FFmpegKit converter/postprocess code exists but target-file conversion is not accepted. WireGuard userspace/proxy/profile code exists; hostname Endpoint import/resolution is now supported, but peer handshake and tunneled HTTPS remain unverified/failed. Barrel 1.1.2 static-analysis report is stored; feature parity is not integrated. Android MSE/SourceBuffer byte capture and live recording are not implemented. Do not treat source registration, CI green, or UI selection as runtime completion. See [integrated audit and port plan](INTEGRATED_FEATURE_AUDIT_AND_PORTING_PLAN_KO.md).

작성 기준: 2026-11-26  
현재 개발 트랙: `feature/p1-video-detection-observer` / PR #1  
현재 상태: **최종본 아님 — CI 및 Galaxy 실기기 E2E 미완료**

## 1. 원천 프로그램·자료 목록과 실제 반영 상태

| 원천 | 확인 대상·역할 | 현재 Maglev+ 반영 | 남은 작업 / 판정 |
|---|---|---|---|
| [Maglev upstream](https://github.com/Kaos599/Maglev) | 앱 구조, 기존 torrent/direct download/Transfers/저장/알림/브라우저/자막/검색/RSS 기반 | 기존 Maglev 엔진을 유지. 새 YouTube 및 브라우저 미디어 기능은 기존 `EngineHost.addDownload`/Transfers로 연결 | 기존 기능 전체 회귀 및 upstream 최신 변경 diff 검토 필요. **기반 통합, 제품 최종 검증 전** |
| LJ Video Downloader 1.1.79 APK (사용자 제공 APK/분석 자료) | WebView request 감지, MIME/헤더·사이트별 추출, HLS/MP4 대응 레퍼런스 | Maglev WebView request observer, active-tab ServiceWorker 관찰, DOM/video/audio, fetch/XHR, Resource Timing, MIME 후보 분류, URL 중복 보강 일부 반영 | LJ의 사이트별 qreq/qscrape 플러그인 체계, 완전한 헤더 복원(Sec-Fetch/Accept-Language), 독립 MediaMetadataRetriever probe는 미구현 또는 일부. 원본 APK 디컴파일 매핑은 추정이 포함됨 |
| [YTDLnis](https://github.com/deniscerri/ytdlnis) / 사용자 제공 APK 분석 | yt-dlp 기반 다운로드 UX, URL 공유, format 선택, 오디오/영상, queue·설정 기능 레퍼런스 | 한국어 Maglev UI를 별도 구현, YouTube 공유/URL 전용 화면, format 선택, 기존 Transfers에 추가 | playlist/batch/preset, 후처리, MP3 변환, 자막/챕터/metadata embed, runtime manager 등 YTDLnis 전체 기능을 이식한 상태 아님 |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | 사이트 추출기 및 format metadata 엔진 | youtubedl-android wrapper를 통한 YouTube 추출 및 사용자가 명시한 generic HTTP(S) 페이지 분석 경로 | 모든 yt-dlp 지원 사이트가 Maglev에서 작동한다고 보장하지 않음. Python/yt-dlp 버전, JS/EJS runtime, PO Token, 로그인/지역 제한 및 사이트별 실기기 검증 필요 |
| [youtubedl-android](https://github.com/yausername/youtubedl-android) | Android Python/yt-dlp 런타임 wrapper | `YoutubeDL.getInfo`/format 추출과 선택 format 재조회 경로에 사용 | FFmpeg/aria2c package 및 후처리 파이프라인은 현재 완전 통합되지 않음. 실제 bundled runtime version·ABI·JS runtime 조합 검증 필요 |
| [NewPipe Extractor](https://github.com/TeamNewPipe/NewPipeExtractor) | 빠른 YouTube metadata 및 adaptive audio/video format 추출 | `NewPipeYoutube.kt`에서 우선 조회. PO Token provider 연결. NewPipe audio format ID `npa<itag>`, video `npv<height>` 사용 | 초기 format 목록은 NewPipe가 제공하는 범위에 한정될 수 있어 기본 화면에 360p만 보일 수 있음. Galaxy에서 로그인/지역 제한·PO Token·직접 URL·재생성 URL 검증 필요 |
| PO Token / JS challenge 지원 | YouTube 추출기에서 요구하는 token/runtime 보조 | NewPipe에 Maglev의 WebView 기반 PO Token provider 연결 | yt-dlp의 EJS/JS runtime 전체 요구사항과 상호 호환되는지는 미검증. provider 연결 코드 존재만으로 모든 영상 지원을 의미하지 않음 |
| [MPMux](https://mpmux.com/ko) / Chrome extension | Static downloader, HLS downloader, Video Buffer Muxer 기능 벤치마크 | Static Range split, HLS VOD 및 Maglev StreamMuxer 기존 기능을 재사용 | HLS Live recording 및 실제 MediaSource SourceBuffer byte capture/MSE remux는 **미구현**. MPMux는 Android에 포팅된 것이 아님. DRM/EME 우회 금지 |
| FFmpeg / encoder runtime | MP3 변환, codec/container conversion, 후처리 | 현재 APK에 검증된 FFmpeg post-processing pipeline 없음 | MP3 output, Opus→AAC/M4A 변환, audio re-encode는 **미지원**. 확장자만 바꾸는 방식 금지. 16 KB page size·ABI·라이선스·재생 검증 후 별도 도입 |

## 2. 사용자가 제공한 YouTube format 화면의 기술 판정

### 오디오
- 145 kbps WEBM / Opus / 약 19.7 MB: 원본 Opus audio stream을 WEBM 컨테이너로 직접 저장하는 구성.
- 131 kbps M4A / AAC / 약 19.2 MB: AAC/MP4 계열 audio stream을 M4A 컨테이너로 직접 저장하는 구성.
- 74/58 kbps WEBM Opus, 51 kbps M4A AAC도 동일한 원본 audio stream 선택 방식.
- NewPipe 경로는 선택한 stream URL을 기존 Maglev direct-download 큐에 전달하고, codec/container에 따라 `.webm` 또는 `.m4a` 확장자를 사용합니다. 실제 변환은 하지 않습니다.
- 표시된 비트레이트와 예상 용량은 audio-only format으로 합리적인 범위입니다. 다만 현재 화면 수치만으로 실제 저장 파일의 codec, byte count, playback 및 네트워크 속도를 검증한 것은 아닙니다.

### 동영상
- 초기 360p MP4 DASH는 빠른 NewPipe format set에 포함된 항목일 수 있습니다.
- 추가 화질 조회는 `maglev_ytdlp=1`로 yt-dlp client 조회를 수행합니다. 기존 코드는 세 client를 순차적으로 끝까지 조회해 불필요한 대기시간을 만들었습니다.
- 2026-11-26 commit `d7715414`에서 충분한 품질(720p 이상)과 audio format을 확보하면 조회를 조기 종료하도록 수정했습니다. 1080p 이상이 있으면 더 일찍 종료하고, 360p만 있으면 계속 탐색합니다.
- 실제 선택한 1080/720/480/360p가 요청한 height와 일치하는지, 분리 A/V가 정상 병합되는지, 최종 MP4가 재생되는지는 Galaxy E2E에서 확인해야 합니다.

## 3. 앱 내부 업데이트 기능 정리

앱 자체의 새 버전 확인·APK 다운로드·설치 기능은 upstream 원천 업데이트 검토와 별개입니다. 해당 기능은 앱 내 UI 및 자동 검사에서 제거했습니다.

- 설정에서 앱 자체 업데이트 항목 제거
- 앱 시작 시 자체 업데이트 자동 검사 제거
- 앱 정보의 업데이트 안내 및 업데이트 화면 연결 제거
- 앱 업데이트 화면을 제거하고 별도의 **목록 업데이트** 화면으로 재구성: 광고 차단 목록·검색 사이트 목록의 데이터 업데이트만 관리
- Native updater 구현 파일/bridge/test는 현 단계에서 dormant code로 남아 있습니다. 사용자 경로와 자동 검사는 끊었으며, 최종 정리 단계에서 bridge·receiver·test·contract를 함께 제거할지 compile dependency audit 후 처리합니다.

## 4. 한글화 결함과 수정 기준

현재 구조는 `plugins/babel-plugin-korean-text.js`가 React Native `Text`를 `KoreanText`로 바꾸고 `constants/korean.ts`의 exact-string dictionary를 적용합니다. dictionary에 등록된 정확한 문자열은 번역되지만, 동적 조합·누락 문자열·native Android/third-party text는 그대로 남을 수 있습니다.

기존 `scripts/test-korean-text.js`는 wrapper wiring과 소수 필수 문구만 확인합니다. 따라서 현재 CI green은 전체 한국어화의 증거가 아닙니다.

최종화 전 필수:
1. app/routes/components/settings/browser/transfers/YouTube/onboarding/error/permission/native string inventory 전수 추출.
2. 사용자 입력, URL, codec/container 명칭, 브랜드/고유명사만 예외로 두고 UI 문자열은 한국어 locale key로 처리.
3. native error code는 한국어 사용자 문구와 별도 diagnostic으로 분리.
4. 미등록 사용자 노출 문자열을 CI에서 실패 처리하고 화면별 snapshot/E2E 확인.
5. Galaxy에서 설정·다운로드·오류·권한·빈 상태 화면의 영어 잔여 문구 확인.

## 5. 현재 저장소 정리 상태

2026-11-26 GitHub branch/release 조회 결과:
- `main` 및 `dev`는 동일 commit `baaf83f0...`이며 upstream baseline 역할.
- `development/video-detection`도 같은 commit으로, `dev`와 중복된 기준 브랜치.
- `feature/p1-video-detection-observer`는 PR #1의 현재 작업 브랜치이며 main 대비 408 commits ahead로 통합 변경 전체가 포함됨.
- `fix/arm64-only-apk-delivery`, `fix/youtube-share-deeplink`, `fix/ytdlp-stable-auto-update`는 현재 feature 브랜치와 분기되어 각각 고유 commit이 남아 있습니다. 먼저 diff/필요한 cherry-pick 확인 없이 삭제하면 기능 수정이 유실될 수 있으므로 보류.
- GitHub Releases는 현재 비어 있음. 최종 APK release는 아직 없음.
- Workflow 목록에는 CI, Android Rust build reusable workflow, E2E, monthly upstream review, release APK, audit, Pages가 있습니다. 기능/배포/문서 목적이 달라 단순 중복으로 일괄 삭제하지 않습니다.
- 현재 연결된 GitHub 작업 인터페이스는 branch ref 삭제 기능을 제공하지 않아 duplicate ref 삭제는 실행하지 않았습니다. 중복 branch는 목록화했으며, 기능 고유 commit 검토 후 GitHub에서 삭제해야 합니다.

## 6. 최종 APK DoD (완료 선언 조건)

- [ ] PR #1 최신 commit의 모든 CI job 성공, cancelled/old run이 아닌 exact SHA 확인
- [ ] arm64 APK artifact, versionCode/versionName, signing certificate, SHA-256 기록
- [ ] 앱 설치/실행, 설정 업데이트 화면에서 앱 self-update 항목이 없는지 확인
- [ ] YouTube initial metadata 및 extra format query 시간 측정
- [ ] 1080/720/480/360p 선택별 실제 stream resolution 및 audio 존재 검증
- [ ] audio-only WEBM/Opus 및 M4A/AAC 각각 저장 후 MediaInfo/ffprobe 또는 Android codec probe로 실제 container/codec/byte count 확인
- [ ] audio/video 파일 로컬 재생, pause/resume/retry/cancel 및 앱 background/restart
- [ ] 전체 UI 한국어화 audit 통과
- [ ] 기존 torrent/direct link/HLS VOD/DASH/subtitle/browser/Transfers regression
- [ ] HLS Live와 MSE buffer capture는 별도 기능으로 구현·검증되기 전까지 미지원으로 명시
- [ ] obsolete duplicate docs/branches/workflows의 보존·삭제 결정을 문서화하고, 필요한 기능 commit을 통합한 후 정리
