# Maglev+ 최종 제품 기준 · 참고자료 · 구현 추적서

> 이 문서는 Maglev+ 개발의 지속 기준이다. 대화 요약이나 임시 작업 메모보다 이 문서와 연결된 GitHub Issue/PR의 현재 상태를 우선한다. 기능 구현은 아래 순서를 따른다. 미검증 항목을 완료로 승격하지 않는다.

## 0. 작업 규칙

- 최종 제품은 Maglev+ 단일 앱이다. 기존 torrent/direct/HLS/DASH 기능을 회귀시키지 않는다.
- WireGuard는 WireGd +AdG 앱의 기능과 별개인 **앱 내부 userspace WireGuard + 로컬 프록시**로 구현한다. Android 시스템 VPN으로 가장하지 않는다.
- "시작됨"은 엔진/로컬 프록시 준비만 의미한다. 원격 peer handshake, tunneled request, 실제 egress 확인을 각각 별도 상태로 보고한다.
- 실패 원인과 예외를 숨기지 않는다. 사용자에게는 안전하게 정제한 오류를, 진단 로그에는 단계·원인·native/JNI load/init 결과를 남긴다.
- 터널이 준비되지 않으면 해당 앱 내부 경로는 fail-closed이며 직접 연결로 조용히 우회하지 않는다.
- APK를 사용자에게 전달하기 전에 CI 결과, APK artifact, versionCode/versionName, 서명, SHA-256을 확인한다. 에뮬레이터/실기기 검증을 수행하지 않았다면 했다고 표현하지 않는다.
- 참고 앱의 UI/브랜드를 복제하지 않는다. 기능과 동작을 분석하고 Maglev UI/구조에 맞게 재구현한다. 라이선스 및 출처를 확인한다.
- 구현 후 이 문서의 체크 항목과 Issue #8을 업데이트한다. 완료는 테스트 증거가 있을 때만 체크한다.

## 1. 현재 구현 순서 (P0 → P1)

### P0-1 엔진 시작 실패 원인 제거
- 앱 진입/React Native 초기화 실패와 Android native library load, JNI init, WireGuard core init, local proxy bind를 분리한다.
- `System.loadLibrary("maglev_core")` 및 `System.loadLibrary("morphewireguard")`의 실패 원인, ABI/library missing, JNI linkage, init exception을 숨기지 않는다.
- WireGuard device logger의 silent 설정을 진단 가능한 수준으로 바꾸되 비밀키·토큰·전체 설정은 기록하지 않는다.
- 시작/중지/재시작 상태 전이를 테스트한다.

### P0-2 앱 내부 WireGuard 실제 연결 복구
- userspace WireGuard peer handshake timestamp, RX/TX counters, peer endpoint, proxy request success를 구분한다.
- 로컬 proxy ready ≠ remote peer connected ≠ internet egress verified.
- authenticated loopback HTTP CONNECT/SOCKS (현재 설계에 맞는 proxy API)로 WebView 및 앱의 지정 HTTP client만 라우팅한다.
- 실제 tunneled HTTPS request와 외부 egress IP 검증을 수행한다.
- 실패 시 direct fallback 금지. 누수 검증을 추가한다.
- IPv6 runtime transport/egress는 현재 미검증으로 표시한다. #646에서 IPv6 in-memory integration test hang을 피하기 위해 해당 테스트를 isolated profile/DNS/AllowedIPs assertions로 바꿨으므로, 이를 IPv6 runtime TCP 검증으로 간주하지 않는다.

### P0-3 미디어 인식 및 재생 중 다운로드
- DOM media뿐 아니라 fetch/XHR, Resource Timing, ServiceWorker, blob URL, MSE/SourceBuffer, HLS/DASH manifest 및 segment를 관찰한다.
- blob/data URL은 직접 다운로드 가능한 URL로 오인하지 않는다. MSE는 실제 source/segment를 추적한다.
- 사이트별 extractor/provider를 추가하고, 실패 시 진단 가능한 이유와 일반 URL fallback을 제공한다.
- playback 중 다운로드는 재생에 필요한 segment의 우선순위와 다운로드 queue를 조정한다.

### P0-4 실제 PiP 및 백그라운드 재생
- Android PiP 진입만 호출하는 것을 완료로 보지 않는다.
- 영상 Surface/Player가 PiP 전환 중 유지되는지, 오디오 포커스, 화면 회전, 앱 복귀, 백그라운드 지속을 확인한다.
- PiP에서 실제 영상이 표시되고 재생/일시정지/복귀가 동작하는 E2E 검증을 통과시킨다.

### P1-5 참고 앱 기능 통합
- Smart Connect, 사이트별 인식/규칙, 재생 중 다운로드, 품질/음질 선택, 오디오 추출, 자막, playlist/queue/retry 등 아래 자료의 기능을 우선순위별로 통합한다.
- 기능 이름만 UI에 노출하거나 placeholder를 두지 않는다. 각 항목에 실제 동작 테스트를 연결한다.

## 2. 참고 소스 및 기능 이식 매핑

### LJ Video Downloader (APK 분석)
- 사용자 제공 분석 대상: `Lj+Video+Downloader+(m3u8,mp4)_1.1.79_APKPure (1).xapk`
- 기존 분석 문서: `Barrel_1.1.2_APK_심층분석_다운로드기능_이식설계서.md`는 Barrel 분석 문서이며 LJ 자료와 혼동하지 말 것.
- 참고 기능: WebView/ServiceWorker 기반 요청 관찰, request headers/cookies/referer, 사이트별 extractor, probe, URL dedupe, HLS AES-128, audio/video 분리 및 remux.
- 이식 방식: Maglev browser/media pipeline에 공통 request-context와 extractor/provider layer로 구현.

### YTDLnis / yt-dlp
- YTDLnis: https://github.com/deniscerri/ytdlnis
- YTDLnis packages: https://github.com/deniscerri/ytdlnis-packages
- yt-dlp: https://github.com/yt-dlp/yt-dlp
- yt-dlp Android wrapper: https://github.com/yausername/youtubedl-android
- Supported sites: https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md
- 참고 기능: extractor coverage, format/quality selection, audio-only/MP3, playlist, subtitles, cookies/auth context, metadata, queue, retry, engine update.
- 이식 방식: 기존 Maglev UI를 유지하고 독립 native module `ytdlp-engine`으로 연결. YTDLnis UI/Kotlin/XML을 통째로 복제하지 않는다.

### Barrel 1.1.2 (사용자 제공 APK 정적 분석)
- APK: `배럴_1.1.2.apk`
- SHA-256: `ba8da1226de50d0c2b990b0407175799bc140581377258137e8a8d3a9d5afdd1`
- 분석 문서: `Barrel_1.1.2_APK_심층분석_다운로드기능_이식설계서.md`
- 분석된 bridge/service 명칭: `HaulMediaBridge`, `HaulMseBridge`, `HaulBlobBridge`, `HaulGrabberBridge`, `WebMediaKeepAliveService`.
- 참고 기능: Smart Connect, media recognition, MSE/SourceBuffer, Blob, HLS/DASH resume, subtitle, mux, playback-priority segment scheduling.
- 검증 한계: APK 정적 분석 결과이며 각 기능의 전체 runtime 동작을 독립적으로 입증한 것은 아니다. Smart Connect는 사용자 요구 기능으로 구현 추적하되 실제 사용성/E2E 테스트로 검증한다.

### MPMux Video Downloader / Chrome extension
- Website: https://mpmux.com/ko
- Chrome extension: https://chromewebstore.google.com/detail/video-downloader-mpmux/mbflpfaamifmmmkdjkcmpofpccfmlmap
- Static downloader: https://mpmux.com/ko/staticdownloader
- HLS downloader: https://v1.mpmux.com/hlsdownloader
- 참고 기능: HLS VOD/live, static MP4/WebM Range concurrency, video buffer recording/mux, quality selection.
- 이식 방식: Chrome extension을 Android에 그대로 넣지 않고, 핵심 네트워크/manifest/segment 동작을 Android media pipeline으로 재구현.

### FFmpeg / Android Media3
- FFmpeg: https://ffmpeg.org/
- Media3 download: https://developer.android.com/media/media3/exoplayer/downloading-media
- Media3 HLS: https://developer.android.com/media/media3/exoplayer/hls
- Downloader API: https://developer.android.com/reference/androidx/media3/exoplayer/offline/Downloader
- 참고 기능: mux/remux, container conversion, native HLS/DASH download/playback, offline download management.
- 이식 방식: 가능한 경우 Media3 native API를 활용하고, FFmpeg는 필요한 mux/codec 작업에 한정하며 license/build footprint를 확인한다.

### App-local WireGuard / Laya / BitChord
- User-requested patch reference: https://github.com/seo-rii/morphe-wireguard-patches
- Related: https://github.com/04pril/morphe-wireguard-patches
- Laya: https://github.com/04pril/Laya
- BitChord Android: https://github.com/04pril/BitChord-Android
- App-local proxy design: https://github.com/04pril/BitChord-Android/blob/main/docs/APP_LOCAL_PROXY.md
- Laya engine: https://github.com/04pril/Laya/blob/main/WireGuard/engine.go
- Laya bridge: https://github.com/04pril/Laya/blob/main/WireGuard/bridge.go
- Laya profile: https://github.com/04pril/Laya/blob/main/WireGuard/profile.go
- App integration: https://github.com/04pril/Laya/blob/main/app/src/main/java/com/music/laya/proxy/AppWireGuard.kt
- Profile store: https://github.com/04pril/Laya/blob/main/app/src/main/java/com/music/laya/proxy/WireGuardProfileStore.kt
- WebView: https://github.com/04pril/Laya/blob/main/app/src/main/java/com/music/laya/proxy/AppProxyWebView.kt
- Shared HTTP: https://github.com/04pril/Laya/blob/main/shared/src/jvmSharedMain/kotlin/com/music/laya/data/Http.kt
- 참고 기능: app-local userspace WG, gVisor TCP/IP, authenticated loopback HTTP CONNECT/SOCKS, shared OkHttp, WebView Proxy Override, Android Keystore + AES-GCM profile storage, handshake/egress verification, fail-closed.
- 이식 방식: Maglev의 앱 내부 routing module로 구현. WireGd +AdG 앱과 별개이며 system-wide VPN으로 표현하지 않는다.

### Community/reference notes
- https://m.dcinside.com/board/vanced/35988
- https://gall.dcinside.com/mgallery/board/view/?id=vanced&no=36007
- https://gall.dcinside.com/mgallery/board/view/?id=vanced&no=36388
- https://gall.dcinside.com/mgallery/board/view/?id=vanced&no=36610
- https://m.dcinside.com/board/vanced/36915
- https://m.dcinside.com/board/vanced/37069?recommend=1
- https://m.dcinside.com/board/vanced/37108?recommend=1
- 참고: community notes are supplementary leads, not authoritative proof. Verify source code, license, and behavior before porting.

## 3. Current code areas to maintain / extend

- `PageScan.kt`: DOM/lazy URL/Resource Timing/fetch/XHR/blob; extend MSE/source observation.
- `MaglevBrowserView.kt`: WebView and ServiceWorker observation, Proxy Override.
- `YoutubeDownload.kt`: yt-dlp engine integration.
- `hls.rs`: HLS VOD/BYTERANGE/AES-128.
- `StreamMuxer.kt`: audio/video merge.
- Existing engine: torrent/direct/HLS/DASH; preserve regression coverage.
- New modules proposed: `ytdlp-engine`, `media-detection`, `app-local-routing`.

## 4. Required release acceptance tests

1. Samsung device: share URL from YouTube, Chrome, Samsung Internet → Maglev recognizes it.
2. Metadata/formats load; user selects video quality/audio quality/container.
3. Download completes, file is saved, and output is playable.
4. Playlist, audio-only, subtitles/cookies where supported, background, pause/resume, cancel/retry, app restart.
5. Direct, torrent, HLS, DASH regression tests.
6. Browser media recognition during playback and playback-priority download.
7. PiP actual video continuity and return-to-app.
8. WireGuard: native load/init diagnostics, peer handshake, tunneled HTTPS request, egress IP, no direct leak.
9. Korean localization for all visible user-facing strings.
10. App Info → References screen lists source app/project, linked source URL, and concise feature area; detailed notes remain in this document.
11. CI APK identity: artifact URL, version, ABI, signing, SHA-256. Device/emulator verification status stated accurately.

## 5. App Settings → Information → References (user-visible)
Keep this concise and useful:
- YTDLnis / yt-dlp — supported-site extraction, format/audio selection, playlist and subtitle workflow.
- LJ Video Downloader — request-aware media detection, HLS handling, headers/cookies/referer.
- Barrel — Smart Connect and playback-aware media capture (feature behavior to be runtime-verified).
- MPMux — HLS and static media download, quality selection and segment handling.
- FFmpeg / Android Media3 — mux/remux and media download/playback components.
- WireGuard userspace / Laya / BitChord / Morphe patches — app-local encrypted tunnel and proxy routing.
For each entry show name, short role, source link, and optionally license/notice. Do not claim endorsement or imply the source project authored Maglev. Include third-party licenses/notices screen.

## 6. Progress ledger
- [x] #646 root cause recorded: IPv6 in-memory HTTP/TLS test hung in gVisor cleanup; not an APK build.
- [x] #647 follow-up test containment commit recorded: `1379a0c36d062c555d0a7efe8433075ece7c6d62`.
- [x] #648 APK artifact built; user runtime acceptance failed, so it is not final.
- [ ] P0-1 native startup error surfaced and tested.
- [ ] P0-2 actual peer handshake + tunneled request + egress + leak test.
- [ ] P0-3 site media detection/MSE and playback download.
- [ ] P0-4 actual PiP video continuity/background test.
- [x] Settings → Information → References list includes source links and concise feature status (Barrel Smart Connect, Laya/BitChord added).
- [ ] Full release acceptance tests passed.

## 7. Latest workflow state at time of this document
Workflow #647: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45944019383
Last checked: JS checks, contract tests, Rust tests, Rust Android arm64 library build all succeeded; **Build APK job was still running at Gradle release APK build**. This is not yet a successful final APK and no artifact should be claimed until the workflow completes and artifact/signing/version checks pass.


## 8. #648 실기기 실패 복기 및 후속 구현 (2026-11-27)

- #648 workflow run `45944878988`는 APK 빌드/서명/아티팩트 단계까지 성공했지만, 사용자가 설치 후 확인한 실제 기능은 실패: WireGuard enable에서 `The download engine couldn't start`, PiP 실제 영상 표시/유지 실패, 사이트 동영상 인식 실패. #648은 runtime 기능 완료나 최종본으로 인정하지 않는다.
- 정확한 오류 문자열은 `native/maglev-core/src/engine.rs`의 `session_start_error()`에서 생성됐다. `Session::new_with_opts`의 구체적인 원인을 generic message로 숨기고 있었다. 후속 코드에서 bounded sanitized native cause를 반환하고 URL user-info를 redact하도록 수정했다. 실제 기기 원인은 다음 진단 메시지/로그에서 확인해야 하며 아직 특정 원인으로 단정하지 않는다.
- MSE/SourceBuffer 관찰 hook을 `PageScan.kt`에 추가하고 browser note event로 전달한다. fetch/XHR 응답 MIME 또는 manifest/segment URL이 식별되는 경우 기존 Found list/stream path로 들어갈 수 있다. MSE byte capture, arbitrary blob byte extraction, full site extractor coverage는 여전히 미완료다.
- PiP API에 detected video aspect ratio를 전달하고 Android-supported range로 clamp한다. 이것은 ratio/transition parameter 개선일 뿐, actual WebView video surface continuity, background playback, real device PiP acceptance를 증명하지 않는다.
- Updated app/settings/about.tsx with Barrel Smart Connect and Laya/BitChord source entries; added matching utils/settingsIndex.ts entries and FocusAnchor targets so Settings search can find them.
- Added native engine session startup smoke test with network disabled in Rust CI (commit 36b9cc010f974394c8ec4fbffc2086a090e005cb); its CI result is still pending and it does not replace Android device validation.
- **Do not ask the user to reinstall another APK until CI passes and internal validation gates are run.** Never call a build final unless peer handshake + tunneled HTTPS/egress, site media recognition + download, and actual PiP video continuity have evidence.


## 9. #665 follow-up

- #665 JS typecheck passed, but the UI contract test rejected the two new About rows because Settings search requires a utils/settingsIndex.ts entry and a FocusAnchor for each row. This was a test/registration failure, not a runtime failure.
- Follow-up commit adds both index entries and FocusAnchor wrappers. The next CI run must pass typecheck, unit/contract tests, Rust startup smoke, arm64 native build, APK signing/version checks and artifact upload before any APK is considered for internal validation.
- #648 remains rejected by runtime acceptance. No final APK claim until WireGuard peer handshake + tunneled HTTPS/egress, actual site media detection/download and actual PiP video continuity are demonstrated.


## 10. WireGuard/downloader startup decoupling

- #648 showed the WireGuard enable path was blocked by EngineHost.ensureStarted(), because setEnabled() called prepareDownload() before NativeTunnel.start(). This coupled the app-local tunnel to a separate downloader native session and surfaced the downloader generic error as a WireGuard configuration failure.
- Follow-up source refactor starts the userspace WireGuard tunnel and WebView proxy independently. The downloader engine is started only when a download is prepared; until its authenticated proxy is applied, its startup hold remains fail-closed. Browser tunnel status and HTTPS egress test no longer require downloader initialization.
- Preserve the original downloader proxy encrypted before nulling it in EngineHost.initLocked(); restore it before disabling the tunnel. If the engine cannot be started to restore the original proxy, keep WireGuard enabled rather than silently route direct.
- This removes the startup dependency but does not prove the user's peer handshake or NordVPN egress; those remain runtime acceptance gates.


## 11. PiP playback continuity and tunnel disable recovery

- PiP compact mode is driven by the actual PiP request plus Android Activity resize/background state, not landscape aspect ratio alone. The selected WebView remains active during the PiP transition so its native hidden-tab pause path does not call video.pause() while the Activity is in PiP. When the Activity returns to full width, the compact request state resets.
- When restoring the original downloader proxy after process recreation, release the native startup hold only after the original proxy is applied. If release fails, reapply the tunnel proxy and keep the browser route/tunnel active; do not leave downloads blocked or fall back direct.
- These are code-level lifecycle fixes. Actual PiP video surface continuity and user-configured peer handshake/egress still require Android runtime acceptance.
