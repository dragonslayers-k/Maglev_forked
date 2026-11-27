# Maglev+ 통합 다운로더 — #702 복구 기준 최종 통합 설계·구현 청사진

> **문서 종류:** 제품 기준선 복구 / 전수조사 / 아키텍처 재설계 / 파일 단위 구현 지시서  
> **버전:** Recovery Blueprint 1.0  
> **작성 기준:** 2026-11-28 (KST)  
> **복구 기준 Actions:** [#702](https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45980241030)  
> **복구 기준 commit:** `45e685603a3a23507b61cb49398a78380d5db7a5`  
> **복구 기준 APK:** `Downloader-recovery-baseline-702-arm64.apk`  
> **APK SHA-256:** `065d29dfcb19ad630c6bc906bfadecb2bd31395edc707ad3e35cf1f54b10c2de`  
> **GitHub 복구 브랜치:** `recovery/2026-11-28-user-baseline-702`  
> **상태:** 설계 및 소스 감사 기준 확정 초안. 앱 소스 변경·병합·릴리즈는 아직 하지 않음.

---

# 0. 가장 중요한 복구 지시

## 0.1 개발 기준은 GitHub #702다

이 프로젝트의 복구 출발점은 가장 최근에 사용자가 지정한 GitHub Actions **#702**다. 다음 사항을 고정한다.

- `main`과 `dev`는 upstream Maglev 기준선을 보존한다. 이번 복구를 이유로 수정하거나 강제 푸시하지 않는다.
- 애플리케이션 소스의 복구 기준은 Actions #702가 빌드한 정확한 commit `45e685603a3a23507b61cb49398a78380d5db7a5`다.
- 테스트 기준 APK는 해당 Actions의 `apks` artifact에 들어 있던 `app-arm64-v8a-release.apk`다.
- 사용자가 올린 APK와 Actions artifact의 SHA-256이 일치하므로, 파일명이나 설명만 같은 다른 APK가 아니라 동일한 바이너리임을 확인했다.
- `recovery/2026-11-28-user-baseline-702`는 #702 소스 트리를 바꾸지 않고 복구 조사 문서만 추가한 브랜치다. 이 브랜치에서 설계·증거·복구 기록을 관리한다.
- 다른 GPT가 #702 이후 추가한 코드는 무조건 이어받지 않는다. #702와의 정확한 파일 차이를 읽고, 기능별로 검증한 뒤 선택적으로 이식한다.

**금지:** 조사와 설계 승인 전 앱 코드 변경, PR 병합, 릴리즈 생성, 기준선 승격, 브랜치·PR·태그·워크플로 일괄 삭제.

## 0.2 작업 원칙

1. **작동하던 기능은 먼저 보호한다.** 대체 구현의 실기기 성공 전 기존 경로를 삭제하지 않는다.
2. **기능이 코드에 있다는 것과 실제 기기에서 된다는 것을 분리한다.** 파일·클래스·문자열은 소스/정적 증거일 뿐 실기기 통과 증거가 아니다.
3. **CI 성공은 기능 승인과 다르다.** 빌드·단위 테스트·에뮬레이터·Galaxy 실기기 테스트를 별도의 증거로 남긴다.
4. **기존 Maglev Rust 엔진을 우선 재사용한다.** Direct/Range/Resume/HLS/DASH를 Kotlin이나 신규 Python 런타임으로 중복 구현하지 않는다.
5. **현재 #702의 YouTube 경로부터 진단한다.** NewPipe + PO Token + yt-dlp fallback + 기존 다운로드 큐 연결이 이미 포함되어 있으므로, 새로운 두 번째 추출 엔진을 먼저 만들지 않는다.
6. **WireGuard는 #702 경로를 보존한다.** 현재 후속 브랜치에서 축소된 WebView Proxy/다운로드 일시중지/시작 복원 경로를 기능 단위로 복구한다.
7. **새로운 기능은 어댑터 뒤에 둔다.** 공통 Task Orchestrator와 저장 경로를 공유하되 프로토콜별 파서와 실행기는 독립시킨다.
8. **미검증 변경은 기준선에 올리지 않는다.** 모든 개선은 `NOT_STARTED / IN_PROGRESS / CI_PASS / DEVICE_PASS / ACCEPTED / BLOCKED`로 관리한다.

## 0.3 현재 확정된 사실과 아직 모르는 것

| 구분 | 현재 확인 | 아직 확인하지 않은 것 |
|---|---|---|
| #702 빌드 | 모든 CI job 성공, ARM64 APK artifact 존재 | 사용자가 해당 APK에서 모든 기능을 다시 수용했는지 |
| #702 APK | 업로드 APK와 Actions artifact SHA 일치 | 실기기에서 기능 전체를 재현한 결과 |
| Rust Direct/Stream | 소스와 단위 테스트가 성숙한 구현을 포함 | 현재 사용자 환경에서 모든 서버/스트림 변형이 되는지 |
| YouTube | NewPipe/PO Token/yt-dlp fallback과 native handoff 코드 포함 | 실제 단말의 초기화→정보 조회→형식→파일 저장→재생 전체 성공 |
| Browser scan | DOM/fetch/XHR/Resource Timing/MSE 상태 관찰/ServiceWorker 관찰 코드 존재 | MSE/Blob 실제 바이트 캡처 성공 여부. 현재 코드는 바이트 캡처 아님 |
| WireGuard | #702 controller, AES-GCM profile store, Go userspace engine 코드 존재 | Samsung WebView proxy challenge, 각 client egress, 재시작·실패 시 fail-closed 실기기 수용 |
| 한국어 | 공통 텍스트 변환 플러그인과 사전·테스트 존재 | 모든 화면/네이티브/알림/오류의 완전한 한국어화 |
| Player/PiP | #702 브라우저 fullscreen PiP 경로 존재 | Media3 신규 Activity와 기존 WebView fullscreen 간 통합은 후속 단계 검증 필요 |

---

# 1. #702 복구 기준의 증거 기록

## 1.1 Actions 및 commit

- Actions: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45980241030
- Run number: `702`
- Run ID: `45980241030`
- Branch: `fix/wg-peer-handshake-status`
- Head commit: `45e685603a3a23507b61cb49398a78380d5db7a5`
- Run conclusion: `success`
- 생성 시각: 2026-11-27 10:13:17 UTC (한국시간 2026-11-27 19:13:17)
- artifact: `apks` / artifact ID `15189688044`
- artifact archive size: `59,167,961 bytes`
- 내부 ARM64 APK: `app-arm64-v8a-release.apk`, `63,671,691 bytes`

#702에서 다음 job이 성공한 것을 확인했다.

- Contract tests
- JS checks / TypeScript checks / JS tests
- Rust tests (no JNI feature)
- Rust Android plan / ABI / ARM64 native build
- Build APK
- Kotlin unit tests (schedule/feed/restart policy)
- APK artifact upload

**주의:** #702의 CI 성공은 소스·테스트·빌드 성공이다. 이 문서에서 S5 실기기 수용을 의미하지 않는다.

## 1.2 사용자 업로드 APK와 artifact 동일성

사용자가 이번 대화에 업로드한 파일을 직접 읽어 SHA-256과 ZIP 구조를 재검사했다.

| 항목 | 값 |
|---|---|
| 파일 | `Downloader-recovery-baseline-702-arm64.apk` |
| 크기 | `63,671,691 bytes` |
| SHA-256 | `065d29dfcb19ad630c6bc906bfadecb2bd31395edc707ad3e35cf1f54b10c2de` |
| ZIP/APK archive | 정상적으로 열림 |
| ZIP entries | 974 |
| DEX | `classes.dex` 1개, 8,487,168 bytes |
| ABI | `arm64-v8a` native libraries |
| universal APK | 이 artifact의 APK에는 없음 |

이 SHA-256은 #702 artifact 안의 ARM64 APK SHA-256과 동일하다. 따라서 #702가 복구 기준인 것은 파일명 추정이 아니라 실제 바이너리 동일성으로 확인되었다.

## 1.3 APK 정적 구성 확인

업로드 APK에서 `lib/arm64-v8a/` 아래 40개 파일을 확인했다.

대표 구성:

| 구성 | 파일 | 크기 |
|---|---|---:|
| Maglev Rust core | `libmaglev_core.so` | 9,566,280 |
| App-local WireGuard | `libmorphewireguard.so` | 10,403,944 |
| Python runtime | `libpython.so`, `libpython.zip.so` | 4,384 / 14,305,904 |
| QuickJS 계열 | `libqjs.so` | 916,104 |
| FFmpeg | `libavcodec.so`, `libavfilter.so`, `libavformat.so`, `libavutil.so`, `libswresample.so`, `libswscale.so`, `libffmpegkit.so` 등 | 다수 |
| React Native / Hermes / Expo | `libreactnative.so`, `libhermesvm.so`, `libexpo-modules-core.so` 등 | 다수 |

정렬 검사 결과:

- 실제 ELF 형식인 39개 `.so` 파일의 모든 `PT_LOAD` segment에서 `p_align >= 16384`를 확인했다.
- `libpython.zip.so`는 파일명이 `.so`지만 ELF가 아니라 ZIP 데이터(`PK\x03\x04`)다. ELF 정렬 검사 대상에 포함하면 안 된다.
- 따라서 확인 범위에서 **39개 ELF native library의 16KB 정렬 실패는 0건**이다.

APK의 앱 식별·서명에 관한 이전 #702 검사 기록:

- package: `com.maglev.plus`
- versionName: `0.33`
- ABI: arm64-v8a
- Android Debug 인증서로 서명된 테스트 artifact
- 인증서 SHA-256 fingerprint: `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`

이 파일은 복구·비교용 테스트 APK다. 최종 배포용 release keystore 서명본으로 간주하지 않는다. Binary AndroidManifest/DEX의 method-level full decompilation은 이번 검사에서 수행하지 않았으며, package/version 관련 세부는 기존 #702 산출물 검사 기록과 소스 설정을 함께 대조한 값이다.

## 1.4 증거 등급

본 문서의 주장에는 다음 등급을 사용한다.

- **S1 — Source verified:** 해당 기준 commit의 파일·메서드·계약을 직접 읽음.
- **S2 — CI verified:** 정확한 run의 job/step가 성공함.
- **S3 — Binary static:** APK archive, DEX 문자열·리소스·native library·manifest 흔적.
- **S4 — Design proposal:** 요구사항/표준/분석에 근거한 설계이며 아직 구현 전.
- **S5 — Device verified:** 정확한 APK SHA를 Galaxy 기기에 설치하고 재현 절차·로그·파일 결과를 보관함.

#702는 S2와 일부 S3가 확인되었다. 이 문서 작성 시점에는 신규 S5 실기기 검증을 주장하지 않는다.

---

# 2. GitHub 저장소 복구 지도

## 2.1 기준 브랜치와 현재 작업 상태

| 항목 | 상태 | 지시 |
|---|---|---|
| `main` | `baaf83f0...` upstream v0.33 baseline | 보존, 수정 금지 |
| `dev` | `baaf83f0...` upstream v0.33 baseline | 보존, 수정 금지 |
| PR #1 | 열린 Draft, head `2820b4d...`, base `dev` | Recovery HOLD 유지, 병합 금지 |
| PR #7 | 닫힘, WG route 작업 branch head `8927b18...` | 변경 이력 보존, #702 기준 선별 비교 |
| `recovery/2026-11-27-rebaseline` | 이전 인벤토리 문서 branch | 과거 audit evidence로 보존 |
| `recovery/2026-11-28-user-baseline-702` | #702 소스에 docs-only recovery commits 3개 | 이번 최종 설계문서 저장 위치 |
| `fix/wg-peer-handshake-status` | #702 commit lineage 및 후속 WG 변경 | 삭제하지 말고 비교용 유지 |
| `fix/youtube-share-deeplink` | YouTube share/URL 변경 | 삭제하지 말고 비교용 유지 |
| `fix/ytdlp-stable-auto-update` | yt-dlp updater 변경 | 삭제하지 말고 비교용 유지 |
| `fix/arm64-only-apk-delivery` | ARM64 package 설정 | #702 설정과 대조하고 필요한 설정만 보존 |

열린 PR은 조사 시점에 #1 하나다. 종료 PR·브랜치는 코드/테스트 근거를 잃지 않도록 이번 설계 작업에서 삭제하지 않는다.

## 2.2 #702에서 PR #1 현재 head까지의 실제 변경량

#702 source tree와 PR #1 head commit `6a03adf6b3e6b6fc41fa32c039a04a60b0d38a6e`의 Git tree blob SHA를 비교했다.

- #702 tree entries: 1,836
- actual differing paths: 45
- modified: 37
- added: 4
- deleted: 4

이 수치는 PR #1이 upstream `dev`에 표시하는 230-file broad diff와 다르다. 230-file diff의 상당 부분은 #702 이전 시점부터 feature branch에 존재하던 역사적 변경이다. 현재 퇴보 판단은 반드시 **#702 → 현재 head** 차이를 기준으로 해야 한다.

### 45개 차이 — 수정 파일

- `.github/workflows/ci.yml`
- `README_KO.md`
- `app/browser.tsx`
- `app/settings/about.tsx`
- `app/settings/wireguard.tsx`
- `components/browser/MediaMenu.tsx`
- `components/browser/StreamSheet.tsx`
- `constants/copy.ts`
- `modules/maglev-engine/android/build.gradle`
- `modules/maglev-engine/android/src/main/AndroidManifest.xml`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/EngineHost.kt`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/MaglevEngineModule.kt`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/FoundClassifier.kt`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/MaglevBrowserView.kt`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/PageScan.kt`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/watch/MaglevWatchModule.kt`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/wireguard/NativeTunnel.java`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/wireguard/WireGuardController.kt`
- `modules/maglev-engine/android/src/test/java/com/maglev/engine/browser/FoundClassifierTest.kt`
- `modules/maglev-engine/android/src/test/java/com/maglev/engine/browser/PageScanTest.kt`
- `modules/maglev-engine/src/MaglevBrowser.tsx`
- `modules/maglev-engine/src/MaglevEngine.types.ts`
- `modules/maglev-engine/src/MaglevMockEngine.ts`
- `modules/maglev-engine/src/MaglevNativeBridge.ts`
- `native/maglev-core/src/config.rs`
- `native/maglev-core/src/engine.rs`
- `native/maglev-core/src/http_dl/driver.rs`
- `native/wireguard/cmd/jni/jni.c`
- `native/wireguard/cmd/jni/main.go`
- `native/wireguard/engine.go`
- `native/wireguard/engine_test.go`
- `package.json`
- `scripts/test-app-wireguard-isolation.js`
- `scripts/test-browser-tabs-ui.js`
- `scripts/test-media-hit.js`
- `utils/browser/mediaHit.ts`
- `utils/settingsIndex.ts`

### 추가 파일

- `docs/CI707_RUNTIME_FAILURE_TRIAGE_KO.md`
- `docs/MASTER_MEDIA_DOWNLOADER_SPEC_KO.md`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/player/MaglevMediaPlayerActivity.kt`
- `scripts/test-in-app-player-contract.js`

### 삭제 파일

- `docs/FINAL_PRODUCT_REFERENCE_AND_IMPLEMENTATION_MASTER.md`
- `docs/RUNTIME_FIRST_STABILIZATION_PLAN.md`
- `scripts/test-page-scan-mse.js`
- `scripts/test-wireguard-decoupled.js`

**즉시 처리:** 삭제된 문서와 테스트는 먼저 다시 검토해 복구한다. 같은 목적의 새 문서/테스트가 존재한다는 이유만으로 삭제하지 않는다. 테스트를 삭제하려면 대체 테스트가 동일하거나 더 넓은 계약을 검증한다는 증거가 필요하다.

## 2.3 현재 변경 중 우선 보수 대상

| 파일/영역 | #702에서 확인한 책임 | 후속 변경 | 분류 |
|---|---|---|---|
| `WireGuardController.kt` | tunnel start, Browser Proxy install/clear, proxy credentials, engine proxy 적용, startup recovery, active download pause/resume | 약 27.1KB/514 lines에서 약 9.7KB/182 lines로 크게 축소. `startTunnel`, `installBrowserProxy`, `clearBrowserProxy`, `browserProxyCredentials`, `ensureBrowserProxy`, `applyTunnelToEngine`, `pauseDownloadsForAppWireGuard`, `resumeDownloadsAfterAppWireGuard` 계열 제거/변경 | **RESTORE 우선** |
| `EngineHost.kt` | 앱 WG startup hold, engine proxy 적용, 다운로드 pause/resume 연결 | `releaseAppWireGuardStartupHold`, `pauseDownloadsForAppWireGuard`, `resumeDownloadsAfterAppWireGuard` 빠짐 | **RESTORE 우선** |
| `MaglevBrowserView.kt` | `onReceivedHttpAuthRequest`에서 오직 loopback WG proxy challenge만 credential 제공 | 해당 callback 제거 | **RESTORE 후보** — 기본 인증/Proxy 인증 fixture로 확인 |
| `MaglevBrowserView.kt` PiP | WebView fullscreen custom view와 브라우저 PiP 경로 | 후속 브랜치에서 pending request/result callback 추가 | **SELECTIVE PORT** — 검증 후 반영 |
| `MaglevWatchModule.kt` | browser PiP request + watch notifications/network state | Media3 Activity `playInAppMedia` 진입 추가 | **EXPERIMENTAL** — 기존 browser PiP와 별도 평가 |
| `native/wireguard/engine_test.go` | WG lifecycle/peer tests | test goroutine scheduling change | **TEST ONLY 후보** — production Go code와 분리해 평가 |
| `PageScan.kt` / `FoundClassifier.kt` | DOM/fetch/XHR/Resource Timing/MSE-state/MIME classification | classification/test additions | **SELECTIVE PORT** — precision/recall fixture 통과 시 |
| `http_dl/driver.rs` | Range/parallel/resume/refusal logic | changes in current branch | **HIGH RISK** — Rust regression + local server integration required |
| `MaglevMediaPlayerActivity.kt` | #702에 없는 새 Media3 Activity | 신규 추가 | **EXPERIMENTAL ISOLATION** — 기존 Browser video path 대체 금지 |
| `build.gradle` / manifest | #702 native deps/permissions | Media3, service, permissions 변화 | **AUDIT FIRST** — 불필요 dependency/permission 추가 금지 |

---

# 3. 원천 자료 통합 및 증거 경계

## 3.1 자료군 전체와 적용 방식

### A. Maglev upstream / fork source

- upstream `Kaos599/Maglev` v0.33, commit `baaf83f0f3afd65d2eac135cce8b8bbabea8fbb3`.
- 기존 화면, Browser, Torrent, Direct HTTP, HLS/DASH, `EngineHost`, Rust task state, file storage, notifications, API contracts를 기반으로 유지한다.
- v0.33 baseline 대비 fork 변경은 #702를 기준으로 복구한다.
- upstream update를 자동 merge하지 않고 변경점/영향/테스트/rollback을 기록한다.

### B. Claude 제공 `종합 다운로더 APK 개발 착수 문서.md`

- Maglev + Expo/RN + Rust 기반 유지.
- youtubedl-android를 native module로 연결한다는 초기 계획.
- YTDLnis feature reference: format selection, audio, playlist, queue, retry, cookies, subtitles, metadata, SponsorBlock, custom options, backup.
- LJ behavior spec을 갭 체크리스트로 이용하고 APK 코드를 그대로 복제하지 않는다.
- WP0–WP7과 YouTube/HLS/Android storage 검증 기준.
- 0.16.0 dependency/API sketch는 작성 당시 예시이며 #702 source는 실제 youtubedl-android `0.18.1`을 포함한다. 최신 변경은 다시 확인하되 blind bump 금지.

### C. `통합_미디어_다운로더_전수조사_종합_설계기준서.md` (2026-11-27)

다음 범위를 최상위 요구사항으로 흡수한다.

- Input→Intake→Normalize→Discovery→Candidate merge→Capability resolve→Engine Router→Task Orchestrator→Scheduler→Network Policy→Transfer→Validate→Process→Storage→Library/Playback.
- Direct Range/Resume, MSE/Blob detection, HLS/DASH segment lifecycle, subtitle/mux, Media3 playback/MediaSession/PiP, app-local WireGuard, Smart Connect, runtime package update, upstream source monitoring.
- Evidence tiers S1–S5, ADR-001~013, WP0–WP10, P0/P1/P2, Galaxy acceptance and repository hygiene.
- New design proposals must be mapped to existing #702 files before creating new modules.

### D. `Video-Downloader-Preflight.zip`

새 통합 기준서에서 다음 파일군을 사전점검 자료로 명시한다.

- `FEATURE_REQUIREMENTS`
- `ROADMAP`
- `UPSTREAM_MAGLEV_AUDIT`
- `QA_SECURITY_PLAN`
- `LICENSE_AND_PROVENANCE`
- `LJ_XAPK_ANALYSIS`

현재 조사에서는 이 ZIP의 압축 내부 파일을 다시 열어 모든 항목을 재검증했다고 주장하지 않는다. 원본 ZIP과 해당 파일들이 이번 런타임의 파일 도구에 재노출될 때, 이 기준 문서의 요구사항과 교차해 **증거/계획/구현/검증**을 업데이트한다. 새 종합 기준서가 요약한 내용은 통합 대상이지만, 요약만으로 ZIP 원본의 모든 세부 내용을 확인한 것은 아니다.

### E. Barrel 1.1.2 APK + 분석 문서

- 정적 증거로 보고된 Bridge 이름: `HaulMediaBridge`, `HaulMseBridge`, `HaulBlobBridge`, `HaulGrabberBridge`.
- `Content-Range`, HLS `BYTERANGE`, `segmentsSignature`, playlist/manifest ID, resume snapshot, worker/service 등 구조 흔적.
- Media3/PiP API 흔적.
- APK DEX/class/string evidence는 실제 동작 흐름 증거가 아니다. 전체 method tracing이나 device runtime 성공으로 과장하지 않는다.
- 이식 대상은 **Range·part 상태·MSE/Blob candidate의 honest state·media mux/playback** 요구사항이다. 코드를 복제하는 것이 아니다.

### F. Barrel Smart Connect 문서

- `OFF`: 직접 route.
- `AUTO`: 사용자 규칙/host/client/route readiness 기준으로 정책 선택.
- `ALWAYS`: 지정 route를 요구하고 실패 시 block/error. Direct fallback 금지.
- site rules, profile selection, DNS/bootstrap behavior, precedence와 client coverage를 별도 Policy Resolver로 관리한다.
- Smart Connect는 tunnel transport가 아니라 policy layer다.

### G. LJ Video Downloader 1.1.79 XAPK/분석

업로드된 XAPK의 실제 base APK archive 정보는 기존 검사 기록에 있다.

- package `com.leavjenn.m3u8downloader`
- versionName `1.1.79`, versionCode `4202`
- XAPK base + armv7 + English + xhdpi split
- base SHA-256 `f65a847504c8e9587c9f173bb5b23125de8563770aaf28897a4c0ef143ab047b`
- 기능 참고: WebView 및 ServiceWorker 관찰, site regex/JS rule, header augmentation, probe, HLS segment download, AES-128, FFmpeg concat/remux, foreground service/SAF.
- permission list는 manifest evidence일 뿐, 우리 앱에 그대로 복사하지 않는다.
- 난독화 및 디컴파일 실패가 있는 메서드는 추정으로 표시하고, 내부 알고리즘 복제로 간주하지 않는다.

### H. YTDLnis / youtubedl-android / yt-dlp

- YTDLnis는 Kotlin/XML app을 통째 이식할 대상이 아니라 기능·runtime package 관리 레퍼런스다.
- #702에는 이미 NewPipe Extractor, NewPipe PO Token generator, youtubedl-android, Python/QuickJS/FFmpeg native payload 흔적이 존재한다.
- **새 `ytdlp-engine`을 별도 복제해서 추가하지 않는다.** 기존 `YoutubeDownload.kt`와 module API의 initialization/getInfo/add route를 실기기로 진단하고, 필요하면 그 내부 provider abstraction만 정리한다.
- Runtime upgrade는 Python/yt-dlp/EJS/JS runtime/PO Token/ABI/size compatibility matrix로 판단한다. #702 번들의 Python/QuickJS가 실제 어떤 extractor request에서 사용되는지 확인 후 결정한다.
- YTDLnis `packages` 형태의 독립 package catalog, signed manifest, staged update, rollback은 참고 가능하지만 runtime 2개를 중복 bundle하지 않는다.

### I. WireGuard / Proxy source

- Laya/BitChord: wireguard-go + userspace stack + authenticated loopback proxy, AndroidKeyStore AES-GCM profile storage, OkHttp/Media3/WebView per-client route adapter, proxy change/process restart semantics.
- Morphe WG patches: source build/patch provenance, not the runtime app architecture.
- BitChord NordVPN `.conf` converter: offline parse UX, file/text validation, DNS endpoint lookup optional; preserve all WG config values, don't mutate private keys/AllowedIPs/endpoint silently.
- App-local proxy is not Android system VPN. UDP/QUIC/DHT/raw sockets only claim supported where proven.

### J. MPMux

- Static download, HLS/live and concurrent request public feature claims are reference ideas only.
- No public source repo was verified in the source dossier; do not claim code/algorithm audit.

## 3.2 기능별 증거 등급

| 자료 | 코드/정적 근거 | 기기 근거 | 적용 |
|---|---|---|---|
| #702 source | S1 | S2 CI | baseline code |
| #702 APK | S3 archive/ELF | S5 not yet | binary comparison |
| Maglev Rust HTTP/HLS/DASH | S1 + unit tests in source | S5 not yet | keep/reuse |
| YouTube NewPipe/yt-dlp | S1 | S5 not yet | diagnose first |
| PageScan MSE/Blob | S1 observer only | S5 not yet | preserve truthful detection; actual capture future gate |
| LJ XAPK | S3 package/hash | S5 not our app | behavior reference |
| Barrel APK | S3 static evidence in report | not verified on our app | standard-based independent design |
| YTDLnis | S2 README/release/source evidence in source dossier | not our app | feature/runtime reference |
| WG Laya/BitChord | S1 source/doc evidence | their own reports still require runtime checks | route adapter reference |
| #703–#707 changes | S1 + S2 CI | not automatically S5 | selective candidates |

---

# 4. #702에서 이미 보유한 기능 — 보존 목록

## 4.1 Maglev Rust core (KEEP)

기준 source paths:

- `native/maglev-core/src/http_dl/driver.rs`
- `native/maglev-core/src/http_dl/driver/segments.rs`
- `native/maglev-core/src/http_dl/stream_run.rs`
- `native/maglev-core/src/http_dl/stream/hls.rs`
- `native/maglev-core/src/http_dl/stream/dash.rs`
- `native/maglev-core/src/http_dl/stream/plan.rs`
- `native/maglev-core/src/http_dl/sidecar.rs`
- `native/maglev-core/src/http_dl/machine.rs`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/EngineHost.kt`

확인된 구현 계약:

- Direct HTTP URL probe와 redirect/headers/content disposition handling.
- Range 지원 판단, `206`, `Content-Range`, ETag/Last-Modified strong validator, `If-Range` 검증.
- 큰 파일 및 서버가 지원하는 경우 bounded parallel part transfer; segment sidecar를 저장하고 `pwrite` 기반 위치 쓰기.
- 부분 Range 거절/파일 drift/불일치 시 분할을 중단하고 안전한 단일 연결 fallback.
- 429/503 `Retry-After`, 408/5xx/연결 종료 backoff; retry limit과 stall handling.
- 다운로드 pause/remove 시 active child tasks 취소, sidecar flush, app restart recovery.
- Disk-full/storage governance, link expired/refused, re-resolve, per-download/global speed governance.
- HLS parser/plan: master/media playlist, variants, audio groups, track selection, init map, byte range, encrypted AES-128 segment support.
- DASH parser/plan: Period, AdaptationSet, Representation, SegmentTemplate/Timeline/List/Base, separate video/audio, unsupported/protected manifest behavior.
- stream segment scheduler, bounded concurrent segments, per-track part state, resume snapshot, retry, mux completion separate state.

**결정:** Direct/Torrent/HLS/DASH를 새 Kotlin/Media3 downloader로 전면 교체하지 않는다. 기존 Rust 기능을 fixture + local server + Galaxy로 측정한 뒤 실제 결함이 확인된 부분만 보완한다.

## 4.2 Unified existing task owner (KEEP)

기존 `EngineHost` 및 `MaglevEngineModule`가 Rust engine과 DownloadSnapshot 상태를 연결한다. 새 task DB를 만든 뒤 기존 task를 별도로 복제하지 않는다.

- Existing EngineHost owns engine start/restart, persisted native tasks, `probeUrl`, `probeStream`, `addDownload`, task actions, notifications, storage and processing.
- TS bridge `MaglevNativeBridge.ts` exposes these methods to RN.
- `DownloadSnapshot` is already typed in `MaglevEngine.types.ts`.

향후 Unified Task Orchestrator는 먼저 **기존 native task authority 위의 adapter/repository**로 시작한다. 실제 여러 비동기 엔진에서 persistent task store가 필요한 경우에만 저장소 통합 ADR을 승인하고 확장한다.

## 4.3 YouTube existing route (KEEP AND DIAGNOSE)

기준 source files:

- `utils/browser/youtube.ts`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/YouTubeUrl.kt`
- `app/+native-intent.tsx`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/share/QuickShareActivity.kt`
- `app/youtube-download.tsx`
- `modules/maglev-engine/src/MaglevEngine.types.ts`
- `modules/maglev-engine/src/MaglevNativeBridge.ts`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/MaglevEngineModule.kt`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/YoutubeDownload.kt`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/NewPipeYoutube.kt`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/MediaContainerConverter.kt`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/potoken/NewPipePoTokenGenerator.kt`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/potoken/PoTokenWebView.kt`

기존 소스에서 확인된 연결:

1. Share Intent/QuickShare/native-intent로 YouTube 주소 정규화.
2. Dedicated `youtube-download` route open.
3. RN 화면이 `maglevEngine.getYouTubeInfo(url)` 호출.
4. Native `MaglevEngineModule.getYouTubeInfo` → `YoutubeDownload.info`.
5. NewPipe 우선 경로, PO Token provider, 필요 시 yt-dlp client fallback.
6. Format list (video/audio, resolution, codec, size estimation, client identity) → UI selection.
7. `addYouTubeDownload` → `YoutubeDownload.add`.
8. Direct/progressive audio/video는 `EngineHost.addDownload`에 기존 Maglev queue task로 삽입; selected adaptive/manifest path는 `probeStream` 후 Rust HLS/DASH transfer path로 삽입.
9. Conversion/mux가 필요한 경우 `MediaContainerConverter` postprocess를 거쳐 최종 output.

이 경로에 대해 신규 독립 ytdlp-engine/Task DB를 먼저 추가하지 않는다. 우선 G2에서 단말 로그와 동일한 public test video를 써서 단계별 success/error code를 측정한다.

## 4.4 Browser discovery existing path (KEEP, WITH LIMITS)

- `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/PageScan.kt`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/FoundClassifier.kt`
- `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/MaglevBrowserView.kt`
- `utils/browser/mediaHit.ts`
- `utils/browser/mediaHitScript.ts`
- `components/browser/FoundTray.tsx` and `FoundDownload.tsx`

기존 signals:

- DOM `<video>/<audio>/<source>`, src/currentSrc, poster, links and metadata.
- MutationObserver + page rescan; performance Resource Timing.
- fetch GET response URL/content-type and XMLHttpRequest GET responseURL/content-type observation.
- URL extension + MIME + Accept/Range + query mime/type classification.
- HLS/DASH manifest candidate and segment-noise suppression.
- candidate dedupe/upgrade (later MIME/size/dimensions enrich previous item); bounded list.
- ServiceWorkerController observer hook installed once and reports request into active WebView observer.
- MSE: `MediaSource.addSourceBuffer` and `SourceBuffer.appendBuffer` wrappers only call `markMse()`; `blob:` is flagged and does not return downloadable media URL.
- Page scan does not consume/replace response body.

**중요 한계:** MSE/Blob 감지는 현재 “존재/재생 방식” 감지이며, appendBuffer의 미디어 바이트를 수집·복원해 파일로 조립하는 구현이 아니다. UI는 다운로드 가능한 후보가 아닌 “MSE/Blob — 별도 캡처 불가/추가 분석 필요” 상태를 보여줘야 한다.

## 4.5 WireGuard #702 route (KEEP AND RESTORE)

기준 source files:

- `WireGuardController.kt` (baseline 514 lines)
- `WireGuardProfileStore.java`
- `NativeTunnel.java`
- `native/wireguard/engine.go`
- `native/wireguard/config.go`
- `native/wireguard/netstack/tun.go`
- `EngineHost.kt` WG proxy and download hold methods
- `MaglevBrowserView.kt` WebView `onReceivedHttpAuthRequest`

#702 controller responsibilities include tunnel start, original proxy snapshot/restore, authenticated loopback proxy credentials, browser proxy install/clear, engine proxy set, active task pause/resume and startup hold/recovery. Keep these as the protected baseline.

`WireGuardProfileStore` uses AndroidKeyStore AES/GCM and no-backup private storage. `native/wireguard/engine.go` owns wireguard-go + gVisor userspace stack + authenticated loopback HTTP CONNECT proxy, route/DNS enforcement and peer/egress diagnostics. It is **app-local proxy routing**, not Android `VpnService` or full device routing.

## 4.6 Korean text support (KEEP, COMPLETE)

- `constants/korean.ts`
- `components/ui/KoreanText.tsx`
- `plugins/babel-plugin-korean-text.js`
- `scripts/test-korean-text.js`

Current Babel plugin replaces imported `Text` from `react-native` in app source with `KoreanText`. Exact-string dictionary has extensive common UI keys. `test-korean-text.js` checks a small React Native transform sample, wrapper helpers and selected dictionary entries. It does **not** prove every app screen, custom component, native dialog, Android notification, WebView text, accessibility label, logs or runtime error is Korean. Full UI inventory and screenshot test remain required.

---

# 5. 최종 제품 아키텍처 결정안

## 5.1 설계 원칙: 하나의 Orchestrator, 기존 Engine 우선, adapter로 확장

새 문서의 logical architecture는 유효하나, 모듈 이름을 맞추려고 폴더를 대량 생성하면 안 된다. #702에는 이미 실제 Task/Engine 경로가 있으므로 다음과 같이 단계적 적용한다.

```text
Maglev+ UI / Browser / Android Share
            │
            ▼
       MediaIntake (TS)
            │
            ▼
  URL Normalize + Source Context
            │
            ▼
  MediaDiscovery / Candidate Registry
  ├─ DOM / Media Element
  ├─ fetch / XHR / Resource Timing
  ├─ Service Worker observer
  ├─ MIME / manifest / header probe
  ├─ site rule / extractor metadata
  └─ share / file / torrent source
            │
            ▼
 Capability Registry + Engine Router
            │
            ▼
 Existing Engine Adapters (do not duplicate)
  ├─ Maglev Torrent Adapter     → existing Rust torrent
  ├─ Maglev Direct Adapter      → existing Rust HTTP/Range
  ├─ Maglev Stream Adapter      → existing Rust HLS/DASH
  ├─ YouTube/Extractor Adapter  → existing NewPipe + PO Token + yt-dlp
  ├─ Browser Candidate Adapter  → existing FoundClassifier/FoundTracker
  └─ future site/provider adapters only after proof
            │
            ▼
 Existing EngineHost + Transfer Repository
  ├─ native task state / pause / resume / retry / remove
  ├─ existing sidecar / segment / transfer snapshots
  ├─ common UI DownloadSnapshot and event adapters
  └─ foreground service / notification lifecycle
            │
            ├──────────► NetworkPolicy / ClientFactory
            │                ├─ Direct
            │                ├─ HTTP/SOCKS Proxy
            │                └─ App-local WG proxy (only compatible clients)
            ▼
 Validation → Media Processing → Storage Commit
            │
            ▼
 Library / Playback Center
  ├─ existing browser fullscreen player/PiP path (protect)
  ├─ future Media3 local/stream playback (isolated)
  └─ MediaSession/background service (after ADR)
```

## 5.2 기존 task owner와 새로운 모듈의 관계

최종 방향은 공통 task truth이지만, #702 Rust EngineHost 이미 native persistent transfer status의 owner다. 당장 Room DB에 별도 Direct/HLS/yt-dlp task를 복제하지 않는다.

1. RN screens continue to consume `DownloadSnapshot` and existing EngineHost list/actions.
2. New extractor task initially registers as one regular existing link/stream task via `EngineHost.addDownload` or `probeStream`, as #702 already does.
3. Media processing gets its own explicit phase/id mapping only where existing native postprocess contract requires it; never pretend processing-complete when native download ended but conversion unfinished.
4. Only when an engine cannot be safely represented in the current native task model (e.g., long-lived live capture or separate background extractor process) propose an additional versioned task snapshot and adapter. It must map one-to-one into existing Transfers view and lifecycle.
5. New modules are introduced only after ADR/contract tests demonstrate a real boundary problem. No duplicate second `maglev-engine`, `ytdlp-engine`, database or notification service by default.

## 5.3 Responsibilities and non-responsibilities

| Layer | Main responsibility | Must not do |
|---|---|---|
| MediaIntake | parse URL/share/file input, attach source context, dedupe intake | start downloader processes directly |
| MediaDiscovery | gather candidate evidence and metadata | own transfer state |
| Candidate Registry | merge provider evidence, record provenance/confidence | automatically download without user action |
| Capability Registry | capability/runtime/health matrix | route based only on “code exists” |
| Engine Router | choose provider based on verified capability, policy and explicit user choice | write output files directly |
| Maglev Existing Engine | torrent/direct/range/streams/tasks/persistence | own UI navigation |
| Extractor Adapter | NewPipe/yt-dlp analysis, format selection and handoff | create duplicate Transfer queue |
| Browser Observer | observe page signals; report candidate state | claim MSE data downloaded without bytes |
| Scheduler | concurrency/priority/resource budget where cross-engine needed | duplicate protocol parsers |
| NetworkPolicy | select direct/proxy/app-local WG per client/request | claim all Android traffic routes through proxy |
| Processing | mux/remux/convert/subtitles and output validation | own download lifecycle |
| Storage | stage, final commit, reconciliation, cleanup | delete files without ownership proof |
| Playback | Media3 or existing WebView player lifecycle | mutate download state except playback linkage |
| Upstream Monitor | diff source, compatibility, decision and rollback | auto-promote untested versions |

## 5.4 Engine selection rule

`Capability` states are `SUPPORTED`, `SUPPORTED_WITH_CONDITIONS`, `UNSUPPORTED`, `UNKNOWN`, `NOT_TESTED`. Unknown/not-tested is not presented as available.

Routing precedence:

1. User explicit engine / task route.
2. Source scheme/protocol (magnet/torrent, direct file, HLS, DASH, known extractor site).
3. Verified engine capability for exact input/format/features.
4. Runtime readiness and process health.
5. Network route support for this client.
6. Cost/stability/resource usage.

Fallback is a new explicit routing decision. It must revalidate existing part/manifest identity before reusing files. Required `ALWAYS` proxy mode may not silently fallback to Direct.

---

# 6. Data contracts and state machines

These are conceptual contracts to map onto #702 structures first. Do not add new DB tables/classes until the implementation mapping is complete.

## 6.1 IntakeRequestV1

```typescript
type IntakeSource = 'manual' | 'share' | 'clipboard' | 'browser' | 'file' | 'torrent';
interface IntakeRequestV1 {
  id: string;
  source: IntakeSource;
  rawText?: string;               // short-lived; sanitize before persistence
  normalizedUrl?: string;
  localUri?: string;               // content:// or file:// only
  pageUrl?: string;
  pageTitle?: string;
  receivedAt: number;
  userGesture: boolean;
  requestedRoute?: 'auto' | 'direct' | 'stream' | 'extractor' | 'torrent';
}
```

Rules: raw source text is not automatically stored; share payload may have multiple links/files; invalid URI scheme produces typed Korean error; query token/credential values are redacted from logs/display.

## 6.2 MediaCandidateV1

```typescript
interface MediaCandidateV1 {
  id: string;
  sourcePage?: string;
  sourceTitle?: string;
  sourceProvider: string;           // DOM, MIME, fetch, XHR, SW, yt-dlp, NewPipe, user
  resourceRef?: string;             // secure ref, not raw sensitive headers
  canonicalResourceKey: string;
  mediaType: 'video' | 'audio' | 'image' | 'document' | 'torrent' | 'unknown';
  protocol: 'direct' | 'hls' | 'dash' | 'extractor' | 'torrent' | 'blob' | 'mse' | 'unknown';
  mime?: string;
  extension?: string;
  title?: string;
  durationMs?: number;
  width?: number;
  height?: number;
  bitrate?: number;
  codecs?: string;
  sizeBytes?: number;
  sizeIsEstimate: boolean;
  tracks?: MediaTrackV1[];
  confidence: 'high' | 'medium' | 'low' | 'unusable';
  state: 'observed' | 'analyzing' | 'downloadable' | 'requires_extractor' | 'requires_capture' | 'unsupported' | 'expired';
  observedAt: number;
  evidenceIds: string[];
}
```

Merge key includes canonical URL/normalized host+path, source page, resource metadata, track/format identity and observation time. Do not collapse different formats/track variants to only `formatId`; keep provider/client identity. Candidate state `blob/mse` can be `requires_capture` but not `downloadable` unless a real byte source/manifest is identified.

## 6.3 EngineCapabilityV1

```typescript
interface EngineCapabilityV1 {
  engineId: string;
  engineVersion: string;
  ready: boolean;
  supportedInputs: string[];
  capabilities: Record<string, 'supported'|'conditional'|'unsupported'|'unknown'|'not_tested'>;
  supportedAbis: string[];
  runtimeIds: string[];
  routeKinds: Array<'direct'|'http_proxy'|'socks_proxy'|'app_wg'>;
  lastHealthCheckAt?: number;
  lastHealthErrorCode?: string;
}
```

## 6.4 RouteDecisionV1

```typescript
interface RouteDecisionV1 {
  id: string;
  intakeId: string;
  candidateId?: string;
  engineId: string;
  providerId?: string;
  routeKind: 'direct'|'http_proxy'|'socks_proxy'|'app_wg';
  policyMode: 'OFF'|'AUTO'|'ALWAYS';
  reasonCode: string;
  capabilityEvidence: string[];
  explicitUserChoice: boolean;
  decidedAt: number;
}
```

Persist route decision snapshot with task; do not silently reinterpret queued tasks after app restart if the user's mode changed.

## 6.5 Task lifecycle mapping

Target conceptual phases:

`CREATED → ANALYZING → READY → QUEUED → PREPARING → RUNNING → VERIFYING → PROCESSING → COMMITTING → COMPLETED`.

Optional transitional states: `PAUSING`, `PAUSED`, `RETRY_WAIT`, `CANCEL_REQUESTED`, `CANCELLED`, `FAILED`, `NEEDS_USER_ACTION`, `NEEDS_LINK`.

Mapping to existing Rust state machine is required before coding. Existing Rust link state machine already has `Resolving`, `Queued`, `Downloading`, `Paused`, `Verifying`, `NeedsLink`, `Error`, `Gone` plus retry/pause/governance events. HLS/DASH has a mux/verify stage. Build an explicit mapping table; do not add a second competing status field without a migration plan.

## 6.6 Error model

All failures include:

```typescript
interface MediaFailureV1 {
  taskId?: string;
  correlationId: string;
  phase: 'intake'|'discovery'|'runtime'|'routing'|'network'|'transfer'|'stream'|'extractor'|'processing'|'storage'|'playback'|'pip';
  code: string;
  retryable: boolean;
  userMessageKo: string;
  safeDiagnostic?: string;
  suggestedAction?: string;
  engineId?: string;
  engineVersion?: string;
}
```

Core error taxonomy: `INPUT_INVALID`, `DISCOVERY_EMPTY`, `DISCOVERY_TIMEOUT`, `ENGINE_UNAVAILABLE`, `RUNTIME_NOT_READY`, `RUNTIME_INIT_FAILED`, `EXTRACTOR_FAILED`, `PO_TOKEN_REQUIRED`, `JS_RUNTIME_MISSING`, `NETWORK_ROUTE_UNAVAILABLE`, `PROXY_AUTH_FAILED`, `TUNNEL_START_FAILED`, `DNS_FAILED`, `HTTP_TIMEOUT`, `HTTP_RESPONSE_INVALID`, `RANGE_UNSUPPORTED`, `RESOURCE_CHANGED`, `TRANSFER_INTERRUPTED`, `SEGMENT_FAILED`, `MANIFEST_PARSE_FAILED`, `TRACK_SELECTION_INVALID`, `PROCESSING_FAILED`, `OUTPUT_INVALID`, `STORAGE_PERMISSION`, `STORAGE_FULL`, `TASK_RECOVERY_FAILED`, `PLAYBACK_UNSUPPORTED`, `PIP_TRANSITION_FAILED`.

`Engine call failed` is not a useful final message. Preserve root cause type, but redact URL query strings, signed URLs, cookies, Authorization, private keys, output private paths and user data.

---

# 7. YouTube/extractor repair plan — use existing #702 pipeline first

## 7.1 Exact call chain to instrument

1. Android `ACTION_SEND`/QuickShare or clipboard/browser paste.
2. `QuickShareActivity`/`app/+native-intent.tsx` extracts source.
3. `YouTubeUrl.kt` and `utils/browser/youtube.ts` normalize URL.
4. `app/youtube-download.tsx` mounts with normalized URL.
5. RN bridge `maglevEngine.getYouTubeInfo(url)`.
6. `MaglevEngineModule.getYouTubeInfo` resolves `context` and dispatches `io`.
7. `YoutubeDownload.info` calls `NewPipeYoutube.get` first; if insufficient/errors, falls back to yt-dlp player clients.
8. Format normalization and dedup to typed `YouTubeInfo`.
9. UI format picker maintains provider/client identity (`formatKey` must not dedup only by format ID).
10. `maglevEngine.addYouTubeDownload(url, formatId, playerClient, formatKind, audioBitrate, container)`.
11. Native `YoutubeDownload.add`: re-fetch format/URL, headers, route, start engine/foreground service.
12. Progressive media → `EngineHost.addDownload` (Rust Direct/Range).
13. HLS/DASH media → `EngineHost.probeStream` → Rust stream parser/segment transfer.
14. Selected conversion → `MediaContainerConverter`/postprocessing.
15. Native task reports final file → storage commit / library / playback.

**Each edge gets a unique correlation ID and typed stage event.** On error, record last successful stage, native method, exception class/root cause, process exit status/stderr category, yt-dlp/NewPipe version, selected client/formatKind, proxy mode, but never record secret URLs or cookies.

## 7.2 G1 runtime smoke tests

On a device or emulator with the #702 APK, run one fixed public non-DRM sample and record:

- `YoutubeDL.getInstance().init(context)` actual result;
- `versionName` and Python runtime details if obtainable;
- QuickJS runtime presence/bridge readiness;
- NewPipe initialization and extractor version;
- PO Token provider initialization, visitor data/token acquisition, timeout and expiration behavior;
- `getYouTubeInfo` returns title/uploader/duration/formats with counts;
- one known direct/progressive format and one adaptive HLS/DASH format metadata;
- native handoff returns a real task ID;
- output file is created, validated, muxed if needed, and playable;
- cancellation and restart cleanup.

Run different source types to distinguish NewPipe success vs yt-dlp fallback. A Kotlin compile test or metadata-only pass does not pass G1.

## 7.3 Why no second ytdlp-engine yet

The #702 APK already bundles Python and QuickJS runtime assets, youtubedl-android, NewPipe, PO Token and FFmpeg, and the source already bridges `getYouTubeInfo`/`addYouTubeDownload` into existing Maglev transfer engine. A second module/runtime could duplicate 14MB+ Python payload, PO Token providers, ffmpeg, process lifecycle, storage and task queue, while leaving the real bug in initialization or handoff untouched.

**Decision:** keep `YoutubeDownload.kt` as the existing provider facade initially. Only refactor into `ExtractorProvider`/`RuntimeAdapter` interfaces after G1 reveals a concrete responsibility problem. If current bundled Python/yt-dlp cannot satisfy current extractor requirements, compare a verified runtime/package upgrade with YTDLnis-style package management; do not add it speculatively.

## 7.4 Extractor P0 requirements

- YouTube watch/share/youtu.be/shorts/live/playlist/mobile/embed route.
- metadata and formats.
- video and audio format selectors.
- best / 1080p / 720p / MP3 / M4A presets.
- selected client identity preserved.
- playlist item selection and partial failure.
- direct/adaptive download handoff.
- FFmpeg remux/encode only when required.
- process cancellation, timeout, stderr redaction, child process cleanup.
- stable runtime/update pin, last-known-good, rollback.
- typed error messages in Korean.

P1: subtitles, thumbnails, metadata/chapter embed, cookie import, filename template, aria2 (only if ABI/route tested), SponsorBlock, backup/restore. P2: custom templates/commands/terminal, trim/chapter split, schedule, incognito. No UI mock counts as functionality.

---

# 8. Browser Media Discovery and LJ/Barrel/MPMux gaps

## 8.1 Existing #702 observer already provides

- DOM `video/audio/source`, URL/hint metadata, dimensions and title.
- dynamic DOM MutationObserver and rescanning.
- Resource Timing recent resources.
- `fetch` GET observation: response URL/content-type.
- XHR GET observation: responseURL/content-type.
- Service Worker `shouldInterceptRequest` callback into active view.
- extension/MIME/query classification, HLS/DASH detection, segment suppression, dedup and metadata upgrade.
- long-press media candidate menu and Found tray.
- EME/DRM signal flagging.

## 8.2 Honest limitation: Blob/MSE

In #702 `PageScan.kt` wraps `MediaSource.addSourceBuffer` and `SourceBuffer.appendBuffer`, but wrapper only calls `markMse()` and delegates the original call. `blob:` URLs are recorded as unusable; bytes are not captured. This prevents false claims and avoids interfering with the WebView player.

New design:

- `OBSERVED_DIRECT`: verified HTTP resource or actual manifest.
- `OBSERVED_MSE`: MSE exists, but no extractable source/bytes captured.
- `OBSERVED_BLOB`: blob URL only; no usable source.
- `OBSERVED_EME`: encrypted media signal; do not bypass DRM.
- `CAPTURE_READY`: only when a genuine media byte stream or manifest is captured and validated.

MSE capture is an isolated research task: evaluate instrumentation overhead, page compatibility, bounded memory/disk, cross-origin, SourceBuffer append semantics, encryption/DRM, sequence ordering, worker/transfer support and failure fallback. Do not make it block direct/HLS/yt-dlp P0.

## 8.3 LJ gap check, not duplicate implementation

| LJ design feature | #702 status | Next action |
|---|---|---|
| WebView + ServiceWorker request observer | existing hook | test on SW fixture; confirm single install + correct lifecycle |
| UA/Referer/Origin/Cookie | some existing request contexts | audit each request/redirect and download path; preserve original headers, add only missing |
| Sec-Fetch-* reconstruction | not confirmed complete | add only if local test server proves needed |
| MediaMetadataRetriever probe | optional/partial | compare false positives and probe resource/time limits |
| static asset filter | existing classifier/scan filter | extend only with corpus and regression |
| site-specific rule registry | plugins exist; coverage not established | safe versioned JSON rule + allowlist; no arbitrary remote JS execution by default |
| googlevideo | current route policy needs audit | YouTube page goes to extractor; raw googlevideo candidate not automatic generic URL |
| HLS AES-128 | existing Rust stream code | fixture verifies key/IV/BYTERANGE/resume, don't duplicate in Kotlin |
| FFmpeg concat/remux | existing `MediaContainerConverter` + Rust stream mux | compare output/codec/track; don't add second converter |
| foreground service + SAF | existing Maglev service/storage | keep task owner and file commit consistent |

## 8.4 MPMux mapping

MPMux public claims become requirements to test: static file Range/parallel parts, HLS segments, live buffer recording, concurrent request behavior. No MPMux internals are claimed as source-verified. Independent implementation must use standard protocol behavior and Maglev's existing core.

---

# 9. Direct HTTP and HLS/DASH final design

## 9.1 Direct HTTP

The existing Rust implementation should remain authoritative. Required golden tests:

- 100MB, 1GB and multi-GB local server fixtures;
- Range supported (`206`) + `Content-Range` exactness;
- Range unsupported (`200`) fallback to one connection;
- server sends `Accept-Ranges` inconsistently;
- strong/weak ETag and Last-Modified;
- `If-Range` mismatch/file replaced;
- redirects, signed query, auth/referer/cookie header propagation;
- 401/403/404/416/429/503/Retry-After;
- partial part failure / network change / process kill / reboot;
- pause/resume retains valid part, user pause survives governance clear;
- disk full, permission loss, insufficient storage;
- corrupt/short/overlong part and sidecar reconciliation;
- duplicate name/collision and output commit atomicity.

Only edit `native/maglev-core/src/http_dl/driver.rs`, `segments.rs`, `sidecar.rs`, machine state when a failing fixture pinpoints a defect. Changes require before/after test counts and no regression of existing Rust suite.

## 9.2 HLS/DASH

Preserve existing separate protocol parsers and common task/segment/storage services.

HLS fixtures:

- master + multiple variants + separate audio/subtitle group;
- media playlist only;
- `EXT-X-MAP`, `EXT-X-BYTERANGE`, discontinuity;
- AES-128 with explicit IV and default sequence IV using generated local sample;
- segment timeout/429/503/manifest expiration;
- changed manifest fingerprint and restart resume;
- VOD finalization; live is a separate task type with stop/finalize/retention.

DASH fixtures:

- Period/AdaptationSet/Representation;
- SegmentTemplate, SegmentTimeline, SegmentList, SegmentBase;
- initialization ranges; separate audio/video; codec changes;
- dynamic/live MPD; unsupported ContentProtection/DRM clearly rejected.

## 9.3 Media3 selection ADR

Do not replace Rust HLS/DASH because Media3 is newer. Build a comparative suite (same fixtures, tracks, resume, segment error recovery, storage, proxy, file output, APK size, 16KB compatibility, Galaxy device). Use Maglev Rust as primary unless Media3 demonstrably closes a tested gap and migration has no regression. Media3 remains the playback candidate separately.

---

# 10. Playback, PiP and MediaSession

## 10.1 Keep the existing browser fullscreen video path

#702 includes custom WebView fullscreen surface and a browser PiP action. Do not replace this with an empty/fixed-ratio player Activity. It is the baseline browser player experience.

#703/#705 callback changes can be considered selectively:

- JS/native request waits for fullscreen surface acceptance.
- Android `enterPictureInPictureMode()` success is returned only after platform call result.
- request times out/cleans pending state.
- no PiP success UI before actual OS acceptance.

These are promising fixes but still require Galaxy acceptance; the user has previously reported black/partial PiP video.

## 10.2 Separate Media3 playback

`MaglevMediaPlayerActivity.kt` and `playInAppMedia` bridge are not in #702; they are later additions. Keep isolated and test as an optional player for local files/direct URLs/HLS/DASH. Before making it default, decide via ADR:

- local/remote media source and authenticated headers;
- playback queue and resume position;
- MediaSessionService background playback;
- PiP transitions;
- audio focus and notification controls;
- app restart/activity recreation;
- route policy for player DataSource;
- no duplicated player state with Browser fullscreen.

Media3 playback success does not replace browser PiP acceptance. If Media3 is used, its `MediaSessionService` owns its player lifecycle; Task Orchestrator owns transfer lifecycle.

## 10.3 Download-while-play

Future capability, not a reason to alter Direct transfer now:

- Progressive: expose only verified readable byte ranges; player must not read incomplete ranges as complete.
- HLS/DASH: shared segment cache only when manifest fingerprint, selected tracks and URL identity match.
- scheduler prioritizes playback buffer but avoids transfer starvation.
- task has `PLAYING_FROM_PARTIAL` state distinct from downloading/completed.

---

# 11. WireGuard / Proxy recovery and Smart Connect

## 11.1 Restore the #702 contract first

Current PR #1 head removed a significant part of the baseline controller. First port back from #702, then consider enhancements.

Restore checklist:

- `WireGuardController.startTunnel` / stop and lifecycle.
- loopback listener readiness and authenticated credentials.
- original engine proxy snapshot; store/restore.
- `installBrowserProxy` + `clearBrowserProxy` using AndroidX WebView ProxyController.
- `browserProxyCredentials` and `MaglevBrowserView.onReceivedHttpAuthRequest` limited to the dedicated loopback challenge. Never reuse proxy credentials for destination website HTTP Auth.
- `EngineHost.setAppWireGuardProxy` or exact baseline setter.
- `EngineHost.pauseDownloadsForAppWireGuard`, `resumeDownloadsAfterAppWireGuard`, `releaseAppWireGuardStartupHold`.
- startup closed-proxy hold until WireGuard is restored.
- process restart recovery and fail-closed.
- actual peer handshake/RX/TX status distinct from local listener-ready.
- `testConnection` uses tunneled HTTP(S) egress, not a UI toggle alone.

Do not port as one giant file replace without diff review. Make a small restore commit with a method-level diff, then run unit/instrumented/device tests. The new `mediaPlaybackProxy` path is a separate client integration experiment and must not overwrite the browser route.

## 11.2 Correct network semantics

Three modes are different:

1. External HTTP/HTTPS/SOCKS proxy.
2. App-local WireGuard: userspace tunnel + authenticated loopback proxy, only for clients explicitly configured to use it.
3. Android system VPN: Android `VpnService`, system VPN slot, broader routing, separate mode and conflict behavior.

This product's #702 implementation is mode 2, not mode 3. Do not claim all phone traffic is tunneled.

## 11.3 Smart Connect policy

- `OFF`: Direct for applicable clients.
- `AUTO`: host + client + capability + route health rules choose route; decision reason is visible and reproducible.
- `ALWAYS`: require configured Proxy/WG route for applicable request/client; if unavailable, block with `NETWORK_ROUTE_UNAVAILABLE`, no silent Direct fallback.
- precedence: task explicit route → user host/client rule → mode default → Direct only when policy permits.
- DNS bootstrap for WireGuard endpoint is separate from DNS for proxied destination; do not leak route DNS without documenting the policy.

## 11.4 Route coverage matrix

| Client | Required implementation | Proof |
|---|---|---|
| Browser WebView | AndroidX WebView ProxyController + auth challenge | Samsung WebView HTTPS egress via WG |
| Rust reqwest direct | Engine proxy adapter/setter | Range/direct request egress |
| yt-dlp/NewPipe process | supported proxy API/args/header; validate runtime behavior | metadata + actual transfer egress |
| Media3 DataSource | route-aware HTTP factory | manifest/segments/player egress |
| FFmpeg | explicit proxy option only if supported | processing/network test |
| thumbnails/Coil | shared route client | image fetch egress |
| app updates/package manager | selected update route | integrity + route log |
| Torrent | TCP and UDP/DHT separately tested | peer/DHT egress; no assumptions |

Do not tick all clients just because the loopback proxy is listening. For raw UDP/QUIC/DHT clients without a supported adapter, report unsupported or direct by explicit policy.

## 11.5 Profile import

The provided offline NordVPN `.conf` converter is reference for file/paste parsing, BOM/newline normalization, size cap, supported-field validation and optional endpoint DNS lookup. Keep all Key/Address/DNS/AllowedIPs/Endpoint values intact; reject unknown/unsupported directives with field names only. Store profile via AndroidKeyStore AES-GCM in no-backup storage. Never display or log private keys.

---

# 12. Korean localization — real scope, not false completion

Current `KoreanText` Babel plugin wraps imported React Native `Text` only. Its unit test verifies a tiny transform and eight dictionary literals. It does not prove:

- custom Maglev text controls not imported from `react-native`;
- strings in components using their own text components;
- native Kotlin dialogs/toasts/notifications/service messages;
- WebView JS/player page text;
- accessibility labels, TalkBack, content descriptions;
- runtime error messages returned by Rust/Go/Python/FFmpeg;
- dynamically generated English strings and text assembled from fragments;
- release/permission/update screens;
- external intents and Android system permission UI.

Required work:

1. enumerate every user-facing text by screen and native module;
2. route stable messages through translation keys / error code mapping, not just arbitrary exact-string replacements;
3. retain technical identifiers/URLs/codecs as appropriate, translate surrounding explanatory text;
4. scan string literals in app/components/modules/native/notifications;
5. run static untranslated-string lint plus screenshot/device QA of every screen and error/empty/loading path;
6. confirm font, wrapping, truncation, dialog/button height, accessibility.

Acceptance: 0 unreviewed English user-facing strings in the screen inventory, screenshots, native dialogs, notifications and errors; English names/URLs/protocol tokens are documented exceptions.

---

# 13. File-level blueprint — keep / restore / select / isolate / add later

## 13.1 Existing files to protect

| Path | Role | Change rule |
|---|---|---|
| `native/maglev-core/src/http_dl/driver.rs` | Direct transfer task, HTTP probe/redirect/headers/resume/governance | keep; modify only failing fixture |
| `native/maglev-core/src/http_dl/driver/segments.rs` | safe Range parallel parts, retry/fallback | keep; protect sidecar and pwrite invariants |
| `native/maglev-core/src/http_dl/stream_run.rs` | HLS/DASH probe/segment transfer/mux/resume | keep; do not create duplicate Kotlin scheduler |
| `native/maglev-core/src/http_dl/stream/{hls,dash,plan}.rs` | protocol parsers and selection | keep, fixture-driven gap only |
| `modules/maglev-engine/android/.../EngineHost.kt` | engine/task/service/storage/network lifecycle | protected owner; compare to #702 before changing |
| `modules/maglev-engine/src/MaglevEngine.types.ts` | shared native API/data contracts | keep API version aligned with Kotlin and mock engine |
| `modules/maglev-engine/src/MaglevNativeBridge.ts` | JS/Native bridge + restart/retry | keep; add contract tests for every method |
| `.../youtube/YoutubeDownload.kt` | NewPipe/yt-dlp selection and Maglev handoff | keep; instrument and repair based on stage failure |
| `.../youtube/NewPipeYoutube.kt` | fast extractor, cookies, PO Token and stream formats | keep; test cache/signature expiry/proxy |
| `.../youtube/potoken/*` | NewPipe token generation | keep; test concurrency, timeout, WebView lifecycle, token expiry |
| `.../youtube/MediaContainerConverter.kt` | remux/convert/audio processing | keep; test source validity, filenames, cancellation and output |
| `.../browser/PageScan.kt` | DOM/fetch/XHR/ResourceTiming/MSE observation | keep; no claim of MSE byte capture |
| `.../browser/FoundClassifier.kt` | URL/MIME/extension/manifest classification and dedup | keep; expand tests with fixture matrix |
| `.../browser/MaglevBrowserView.kt` | WebView lifecycle, interception, ServiceWorker, auth and fullscreen | #702 behavior protected; selectively restore methods |
| `.../wireguard/WireGuardController.kt` | app-local proxy/tunnel lifecycle | restore #702 base before feature work |
| `.../wireguard/WireGuardProfileStore.java` | secure AES-GCM profile store | keep; security tests |
| `native/wireguard/engine.go` | userspace WireGuard, gVisor, auth proxy, peer status | keep if Go tests pass; no broad routing claims |
| `app/youtube-download.tsx` | existing format UI | keep; verify call chain and render states |
| `app/browser.tsx` + `components/browser/*` | browser intake/candidate actions | preserve baseline UX; route candidates to correct engine |
| `constants/korean.ts`, `KoreanText`, Babel plugin | shared localization foundation | keep and extend to full app/native scope |

## 13.2 Restore candidates from #702

- `WireGuardController.kt`: restore missing browser proxy and engine lifecycle methods.
- `EngineHost.kt`: restore startup hold and download pause/resume functions.
- `MaglevBrowserView.kt`: restore `onReceivedHttpAuthRequest` callback limited to local proxy challenge.
- Restore `scripts/test-page-scan-mse.js` and `scripts/test-wireguard-decoupled.js` or demonstrate equivalent/higher coverage before removal.
- Restore deleted master/product documents by retaining recovery copies or linking to their superseding master. Do not lose the previous contract history.

## 13.3 Selective features from later branches

- Browser PiP acceptance callback from #703/#705: review and port only after existing browser fullscreen test.
- Browser media classifier/PageScan enhancements: use fixture quality report and false-positive rate.
- Media3 `MaglevMediaPlayerActivity.kt`: keep isolated until Playback ADR and Galaxy tests; do not replace Browser PiP.
- WG Go test scheduling change #707: test-only possible, no runtime feature claim.
- Runtime diagnostics changes: keep redaction and structured root cause only after verify no sensitive data leak.
- Build/ABI/Gradle config: compare exact #702; ARM64-only artifact already proven for user size requirement; universal stays off.

## 13.4 New files/modules — only after corresponding ADR

Potential future layout (names are logical boundaries, not mandatory directories):

```text
modules/maglev-engine/                  # existing native owner; preserve
  existing Rust Direct/Torrent/HLS/DASH
  existing YouTube adapter facade

modules/media-contracts/                # only if TS/Kotlin/Rust schemas need shared generated contract
modules/media-runtime-manager/          # only if runtime/package lifecycle exceeds existing YoutubeDownload
modules/network-policy/                 # host/client route rules + decision record
modules/media-processing/               # if processing task lifecycle must be explicitly separated
modules/playback/                        # Media3 player/session service after ADR

docs/recovery/
docs/architecture/ADR-*.md
docs/source-audits/
docs/qa/
tests/fixtures/
tests/integration/
tests/device/
```

Do not create `direct-engine`, `stream-engine`, `torrent-engine` copies merely to match a target diagram. Existing code can satisfy those responsibilities behind adapter wrappers.

---

# 14. ADRs to approve before app code implementation

Each ADR includes Context, Options, Decision, Consequences, Rejected Alternatives, Source Evidence, Tests, Rollback and Review Date.

| ADR | Decision required | Provisional #702-based stance |
|---|---|---|
| ADR-001 baseline/fork | upstream tag and source baseline | #702 commit as recovery base; main/dev unchanged |
| ADR-002 Direct | Maglev Rust vs replacement | keep Rust Direct as primary |
| ADR-003 HLS | Maglev Rust vs Media3 downloader | keep Rust primary until comparison fixtures show gap |
| ADR-004 DASH | Maglev Rust vs Media3 | keep Rust primary until comparison fixtures show gap |
| ADR-005 extractor runtime | NewPipe/yt-dlp/youtubedl-android/runtime packages | retain existing NewPipe/PO Token + yt-dlp path; smoke test before refactor |
| ADR-006 task store | EngineHost/Rust vs new DB | native EngineHost is baseline task authority; do not duplicate |
| ADR-007 browser discovery | PageScan/LJ/Barrel/MSE capture | keep observer; real MSE byte capture remains separate R&D |
| ADR-008 processing | FFmpegKit/MediaMuxer/Rust mux | keep current path; define output validation and task phase |
| ADR-009 playback/PiP | WebView fullscreen vs Media3 | preserve browser fullscreen path; evaluate Media3 as a separate player |
| ADR-010 network | app-local WG vs system VpnService | #702 app-local proxy only; system VPN is different product feature |
| ADR-011 client factory | direct/proxy/WG client coverage | explicit per-client adapters and fail-closed semantics |
| ADR-012 upstream | update cadence/promotion | weekly extractor/runtime, biweekly Maglev/Media3/WG, monthly YTDLnis/Laya/BitChord; review not auto-merge |
| ADR-013 release/licensing | GPL, source notices, SBOM, signing | release only after exact dependency/license + signed artifact evidence |

---

# 15. Recovery development gates — sequential, no parallel feature pile-on

## R0 — Freeze and evidence ledger (BLOCKER)

- [x] exact #702 commit and APK hash verified.
- [x] #702 Actions job summary captured.
- [x] #702 source tree captured.
- [x] 45-path #702→PR1 current-head diff computed.
- [x] APK archive and native library inventory rechecked.
- [ ] record exact Galaxy/Android/WebView details and user-described last-good functions.
- [ ] add artifact metadata file with SHA, size, package, version, signature, ABI.

**Gate:** recovery branch docs complete; no runtime code touched.

## R1 — Existing-feature golden tests (BLOCKER)

- [ ] torrent: add, pause, resume, complete, restart, file open.
- [ ] direct: 206 Range parts, single-connection fallback, redirect/auth/referer, resume after process kill, changed ETag, disk full.
- [ ] HLS: master/media, audio group, BYTERANGE, AES-128 fixture, retry, restart/mux.
- [ ] DASH: representations, separate audio, timeline/ranges, protected/unsupported rejection.
- [ ] browser: DOM/fetch/XHR/ResourceTiming/SW and candidate selection.
- [ ] YouTube: NewPipe info, PO Token, yt-dlp fallback, selected formats, real task ID and file output.
- [ ] WG: profile import/encryption/start/handshake/egress/browser proxy/engine proxy/stop/restart and no direct leakage.
- [ ] localization: screen inventory and common controls.

**Gate:** each baseline test records #702 APK SHA or source commit and explicit PASS/FAIL/BLOCKED.

## R2 — Restore regressions against #702

Priority order:
1. Restore WireGuardController / EngineHost startup hold, WebView proxy and download pause/resume.
2. Restore WebView local proxy auth challenge.
3. Restore deleted test coverage or prove replacement coverage.
4. Audit HTTP auth behavior and preserve website auth semantics.
5. Review Media3 Activity separation and browser PiP callback candidate.

**Gate:** unit/contract/Kotlin/Rust tests pass; no regression in unaffected modules.

## R3 — YouTube runtime diagnosis and repair

- Instrument call chain from intent to stored file.
- Distinguish NewPipe success, PO token failure, yt-dlp fallback, format missing, runtime missing, native module error, EngineHost rejection, probe failure, transfer error, postprocess error, storage error.
- Run same fixed public sources using #702 artifact and current source candidate.
- Provide a diagnostic APK only if test is needed and clearly label; user's installation request only after unit/integration pass.

**Gate:** public YouTube video in 1080p or documented supported fallback format saves, validates and plays; MP3/M4A audio saves; user share and clipboard route works.

## R4 — Browser detection and LJ gaps

- Build local fixture pages for DOM, lazy video, fetch/XHR MIME, Service Worker, extensionless MP4, HLS/DASH, duplicate candidates, Range and cookies.
- Record precision/recall/false positives.
- Ensure candidate state separates OBSERVED_MSE/OBSERVED_BLOB from CAPTURE_READY.
- Implement missing headers/probe/rules only where fixture demonstrates benefit.

**Gate:** no existing Maglev candidate regression; every download action points to a fetchable source.

## R5 — Stream and media processing review

- run fixture suite; compare Rust HLS/DASH with Media3 only if concrete gap exists.
- verify output streams/codec/container/tracks, mux output and file playback.
- Live recording is separate later task requiring time/space/segment limits and finalize recovery.

**Gate:** HLS/DASH VOD plus selected audio track saved and plays; protected streams fail clearly, no DRM bypass.

## R6 — Playback/PiP

- keep browser custom view; port callback changes only after Galaxy.
- Media3 local player can be separate; MediaSessionService and background service have explicit ownership.
- tests include Galaxy fullscreen, PiP transitions, controls, orientation, activity recreation, player close/reopen, audio focus.

**Gate:** actual video remains visible and playing in PiP, no black surface or wrong aspect; background audio survives expected lifecycle.

## R7 — NetworkPolicy/Smart Connect

- restore baseline #702 WG routes; add `OFF/AUTO/ALWAYS` policy layer and site overrides only after client matrix.
- verify browser and Rust downloader egress through tunnel, DNS route, IPv4/IPv6, proxy auth, stop restores original route.
- document UDP/QUIC/DHT coverage honestly.

**Gate:** every supported client produces actual egress proof; ALWAYS does not silently fallback direct.

## R8 — Full Korean UI / UX

- screen-by-screen and native string inventory.
- remove missing dictionary assumptions; all dynamic errors map by error code.
- check all dialogs/notifications/settings, browser menus, permission prompts, empty/loading/error states.
- provide screenshots from Galaxy.

**Gate:** no unreviewed English in user-facing inventory.

## R9 — Upstream/package maintenance

- create `docs/upstream/SOURCE_WATCH_REGISTRY.md`, `config/upstream-sources.json` only after sources are inventoried.
- exact source version/commit pins, changelog diff, ABI/API/security/license, benchmark/test report, adopt/defer/reject decision, rollback.
- cadence: weekly yt-dlp/runtime/security; biweekly Maglev/Media3/WG; monthly YTDLnis/Laya/BitChord/MPMux listings; before release full SBOM/provenance.

**Gate:** automation creates review report, never automatically promotes untested update.

## R10 — Release acceptance

- all baseline and new tests green;
- emulator install/launch smoke and Galaxy full E2E;
- ARM64 only by default; no Universal APK;
- APK identity, versionCode, ABI, 16KB ELF, size, certificate, SHA-256;
- release keystore (debug cert is test-only);
- SBOM, GPL notices/source archive, changelog, known issues;
- exact installed APK hash equals published artifact hash.

**Gate:** user explicitly accepts tested build, then release approval.

---

# 16. Test and QA matrix

## 16.1 Direct / HTTP

- 100MB/1GB/multi-GB;
- Range 206 valid/invalid, range ignored, ETag/If-Range mismatch;
- redirects with cookies/referer/origin;
- single/multiple parts, per-host/global concurrency, fairness;
- server 401/403/404/416/429/503 + Retry-After;
- network loss, Wi-Fi↔mobile, proxy start/stop, process kill/reboot;
- disk full/permission/SAF revoked/collision;
- pause/resume/retry and sidecar/file consistency;
- output integrity, actual file opens.

## 16.2 YouTube/extractor

- URL: `youtube.com/watch`, `youtu.be`, scheme-less `youtu.be`, `shorts`, `live`, playlist, mobile/embed, share URL, trailing punctuation.
- app share + Chrome + Samsung Internet + manual paste + clipboard.
- NewPipe metadata/PO Token provider; yt-dlp fallback clients; JS runtime readiness; PO Token missing/expired; private/login/age/restricted cases.
- formats: progressive, adaptive video + audio, MP3/M4A and output conversions.
- playlist partial errors and selection.
- cancel/timeout/process cleanup/app restart.
- exact file path, byte length, MIME/container, playback and metadata.

## 16.3 Browser detection

- `<video>`, `<audio>`, `<source>`, dynamic src, lazy-load, SPA, iframe.
- fetch/XHR MIME response; extensionless URL; Resource Timing.
- Service Worker request; duplicate resources; HLS/DASH manifest and segments.
- `blob:`/MSE observed vs actual capture.
- DRM/EME detection; no bypass.
- noise: CSS/JS/images/TS segments; false-positive measurement.
- Referer/Cookie/Origin/Accept-Language/Range header tests against controlled server.

## 16.4 HLS/DASH

- Master/Media, track group, language, codecs, variants;
- BYTERANGE/init map/discontinuity;
- AES-128 key/IV (generated local test);
- segment timeout/refusal/retry/manifest change/resume;
- DASH SegmentTemplate/Timeline/List/Base;
- separate video/audio and mux;
- Live stop/finalize/recovery;
- protected/DRM signals rejected safely;
- completed file playable.

## 16.5 Playback/PiP

- local completed file, direct URL, stream, adaptive track.
- play/pause/seek/track selection/subtitle.
- app background/foreground, notification, audio focus, screen lock.
- fullscreen browser video → PiP; no blank/black frame; correct aspect ratio.
- return from PiP, close/reopen, activity destroy/recreate.
- download while play and shared scheduler priorities.

## 16.6 WireGuard / Proxy

- `.conf` parser with supported/unsupported directives, BOM, CRLF, oversized, duplicate fields; secrets redacted.
- AES-GCM store/create/read/delete and key invalidation.
- tunnel starting/listener ready/peer handshake/egress distinct.
- loopback proxy credentials, authentication success/failure, DNS/AllowedIPs/IPv4/IPv6.
- WebView before/after route and HTTP Auth callback; network change; process restart.
- EngineHost download pause/hold/resume; no request leaks direct in ALWAYS.
- UDP/QUIC/DHT documented as supported/unsupported per engine.

## 16.7 Korean and UX

- all navigation tabs, Browser, Search, Transfers, settings, about, WG, YouTube format UI, dialogs, sheets, native notifications, errors, permissions.
- no clipping/overlap, Korean typography and dynamic text wrapping.
- accessibility labels, TalkBack, content description.
- app launch, onboarding, empty/loading/failure/success states.

## 16.8 Evidence template

Every test record:

```yaml
id: QA-...
source_commit: 45e685603a3a23507b61cb49398a78380d5db7a
apk_sha256: 065d29dfcb19ad630c6bc906bfadecb2bd31395edc707ad3e35cf1f54b10c2de
action_run: 45980241030
artifact_id: 15189688044
device_model: required
android_version: required
webview_version: required
abi: arm64-v8a
scenario: required
route: required
expected: required
actual: required
result: PASS | FAIL | BLOCKED
logs_redacted: required
screen_recording_or_capture: optional_but_required_for_visual_behavior
issue: required_if_fail
```

---

# 17. Repository and CI control

## 17.1 One active implementation track

PR #1 remains Draft/Recovery Hold. No parallel feature PRs. Work should be done as small, auditable commits on a new recovery implementation branch forked from the #702 recovery docs branch only after R1/R2 test plan is ready. PR #1 current branch remains a historical comparison target until the restore plan is approved.

## 17.2 Workflow layout

Keep purpose separate:

1. Fast JS/TS/unit/contract gate.
2. Rust tests / Rust Android ABI builds.
3. Kotlin/native compile and unit tests.
4. ARM64 APK packaging and integrity checks.
5. Emulator/device smoke and Galaxy acceptance evidence.
6. Release/signing workflow.
7. Scheduled upstream source watch (report only).

Do not create duplicated workflows for each tiny code fix. Do not delete current workflows during recovery; record purpose, triggers, dependencies, artifact consumers and secrets first. APK step `skipped` is not build pass.

## 17.3 APK policy

- Default ABI `arm64-v8a` only.
- `universalApk false`.
- No universal APK to save user bandwidth/storage.
- Record exact `versionCode`, package name and upgrade compatibility. Do not unexpectedly bump versionName/Code outside chosen scheme.
- Debug-signed APK can be a test artifact only. Release needs configured keystore secrets and signature verification.
- Native ELF `PT_LOAD p_align >= 16384` for all packaged ELF libraries.
- Record archive SHA, size, artifact ID, certificate fingerprint and tested device.

## 17.4 Branch/PR cleanup

- Don't delete `main`, `dev`, #702 source branch, recovery audit branches, active PR history or known baseline commits.
- Only after R0 inventory and user approval: delete proven duplicate/stale branches and old artifacts; do not delete as a way to hide failures.
- Releases/tags: inspect all assets and downstream install dependencies; no releases should be created for diagnostic builds.

---

# 18. Upstream maintenance registry

Create registry after baseline audit, with each entry:

`sourceId, name, upstreamUrl, sourceType, license, latestTag/commit, currentPin, updateChannel, lastChecked, cadence, affectedModules, tests, compatibilityRisks, decision, rollbackRef`.

Initial source set:

- Maglev upstream.
- yt-dlp.
- NewPipe Extractor.
- youtubedl-android.
- YTDLnis + `ytdlnis-packages`.
- FFmpegKit maintained / Media3.
- wireguard-go / gVisor / Morphe patches.
- Laya / BitChord Android.
- MPMux Chrome listing/public behavior.
- LJ/Barrel APK references (manual version check; no public source auto-update).

Each source update: release/commit + changelog → feature/API/ABI/security/license/build classification → impact map → compatibility branch → tests → decision Adopt/Port/Defer/Reject → rollback. No auto-merge/auto-release.

---

# 19. ADR status and decisions not yet approved

This document defines provisional recovery choices but does not silently approve the unresolved decisions.

- ADR-001 baseline: #702 fixed recovery source (decision for this recovery scope).
- ADR-002 Direct engine: provisional keep Rust, acceptance requires golden tests.
- ADR-003 HLS: provisional keep Rust; compare Media3 before any replacement.
- ADR-004 DASH: provisional keep Rust; compare Media3 before any replacement.
- ADR-005 Extractor runtime: preserve existing NewPipe+PO Token+yt-dlp; G1 smoke before refactor/runtime package changes.
- ADR-006 Task DB: reuse EngineHost/native source of truth; no duplicate DB.
- ADR-007 Browser discovery: PageScan/FoundClassifier observer; MSE capture research separate.
- ADR-008 Media processing: keep existing FFmpegKit/MediaMuxer conversion; validate cancellation/output.
- ADR-009 Playback: retain Browser custom fullscreen/PiP path; Media3 separate player candidate.
- ADR-010 Network: app-local WG only; system VPN separate proposal.
- ADR-011 Client routing: per-client route adapters and coverage matrix.
- ADR-012 Upstream: stable pins + scheduled report + rollback.
- ADR-013 License/release: GPL notices/source/SBOM/signing/provenance.

Each ADR must include Context, Options, Decision, Consequences, Rejected alternatives, Evidence, Tests, Review date.

---

# 20. Immediate next work instruction (the new handoff prompt)

> Start from the exact #702 source and APK identified in `docs/RECOVERY_APK_702_HASH_AND_DEVICE_ACCEPTANCE.md`. Do not start from the current PR #1 head and do not merge new branches.
>
> First complete R0/R1: inspect source, tests, workflows, exact #702 artifact, and record which functions are known-good versus only present. Compare #702 to PR #1 current head per file. In particular audit the 514-line baseline WireGuardController against the 182-line current version; inspect EngineHost's removed WG startup/download hold methods; restore WebView proxy challenge callback; review browser HTTP auth behavior; inspect test files deleted by PR #1.
>
> Do not alter the #702 YouTube extractor architecture before instrumenting the existing call chain. Preserve NewPipe fast path, PO Token provider, yt-dlp fallback and existing Maglev task handoff. Diagnose each stage and test output file end-to-end.
>
> Preserve Rust Direct Range/Resume and Rust HLS/DASH. Build local golden fixtures before touching them. MSE/Blob currently reports observation only; do not display it as downloadable. Keep Browser fullscreen PiP; Media3 Activity is experimental and must not replace it until Galaxy acceptance.
>
> Work one recovery gate at a time, in small, reviewable commits. Before modifying files, list exact path, baseline function(s) to preserve, observed defect, expected change, test and rollback. After each change, compare with #702, run all related tests and the full regression suite, then build ARM64 APK. No Universal APK. Do not delete anything. No PR merge/release until the user accepts the integrated Galaxy build.

---

# 21. Sources and artifact links

## Repository baseline

- Actions #702: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45980241030
- Baseline commit: https://github.com/dragonslayers-k/Maglev_forked/commit/45e685603a3a23507b61cb49398a78380d5db7a5
- Current PR #1 historical comparison: https://github.com/dragonslayers-k/Maglev_forked/pull/1
- Recovery branch: https://github.com/dragonslayers-k/Maglev_forked/tree/recovery/2026-11-28-user-baseline-702

## Primary design/material sources

- Uploaded `통합_미디어_다운로더_전수조사_종합_설계기준서.md` (2026-11-27).
- Uploaded `종합 다운로더 APK 개발 착수 문서.md` (Claude handoff).
- Prior `Maglev_종합_개발착수_인계기준서.md` and its GitHub source.
- `Video-Downloader-Preflight.zip` (FEATURE_REQUIREMENTS, ROADMAP, UPSTREAM_MAGLEV_AUDIT, QA_SECURITY_PLAN, LICENSE_AND_PROVENANCE, LJ_XAPK_ANALYSIS; archive interior not re-opened in this specific recovery pass).
- Barrel 1.1.2 APK + `Barrel_1.1.2_APK_심층분석_다운로드기능_이식설계서.md`.
- `Barrel_1.1.2_SmartConnect_기능구조_이식명세.md`.
- `App_Local_WireGuard_Proxy_Integration_Deep_Report_KO.md` and `App_Local_WireGuard_Proxy_Porting_Guide_KO.md`.
- `BitChord_NordVPN_Offline_Conf_Converter.html`.
- LJ 1.1.79 XAPK and its analysis.
- YTDLnis source/package repository and youtubedl-android source.

## Upstream code references

- Maglev: https://github.com/Kaos599/Maglev
- YTDLnis: https://github.com/deniscerri/ytdlnis
- YTDLnis packages: https://github.com/deniscerri/ytdlnis-packages/
- youtubedl-android: https://github.com/yausername/youtubedl-android
- yt-dlp: https://github.com/yt-dlp/yt-dlp
- NewPipe Extractor: https://github.com/TeamNewPipe/NewPipeExtractor
- Laya: https://github.com/04pril/Laya
- BitChord Android: https://github.com/04pril/BitChord-Android
- Morphe WG patches: https://github.com/04pril/morphe-wireguard-patches
- Media3: https://developer.android.com/media/media3

---

# 22. 현재 복구 체크포인트

| 항목 | 상태 | 근거 |
|---|---|---|
| #702 Actions success | PASS | run 45980241030 all core jobs success |
| user APK == #702 artifact | PASS | exact SHA-256 match |
| ARM64 only package | PASS | 40 arm64 files in APK, no universal APK |
| native 16KB ELF | PASS in checked archive | 39 ELF libraries aligned; `libpython.zip.so` is ZIP blob, not ELF |
| release signing | NOT ACCEPTED | Android Debug certificate, test baseline only |
| existing Direct/Range | SOURCE_PRESENT / DEVICE_NOT_VERIFIED | Rust driver and tests exist |
| existing HLS/DASH | SOURCE_PRESENT / DEVICE_NOT_VERIFIED | parser/stream_run/plan exist |
| YouTube NewPipe/PO token/yt-dlp | SOURCE_PRESENT / DEVICE_NOT_VERIFIED | native code path exists; G1 required |
| Browser DOM/fetch/XHR/SW | SOURCE_PRESENT / DEVICE_NOT_VERIFIED | PageScan and observer exist |
| MSE/Blob byte extraction | NOT IMPLEMENTED in baseline | observer flags only; no capture pipeline |
| WireGuard #702 browser/engine route | SOURCE_PRESENT / DEVICE_NOT_VERIFIED | baseline controller/store/Go engine exist |
| WireGuard current PR1 route | REGRESSION SUSPECTED | controller shrunk and methods removed vs #702 |
| full Korean localization | INCOMPLETE / DEVICE_NOT_VERIFIED | Text wrapper + dictionary only partial coverage |
| Media3 standalone player | NOT IN #702 | later addition; experimental |
| Galaxy full E2E | BLOCKED / NOT RECORDED | must test exact #702 or restored build |
| final signed release | NOT STARTED | wait R10 |

**Final instruction:** restore and protect #702 behavior first. Only then selectively promote fixes and new capabilities. The final APK must be measurably better than #702 without losing any feature that worked in #702.