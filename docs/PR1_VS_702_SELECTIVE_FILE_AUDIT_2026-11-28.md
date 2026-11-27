> **2026-11-28 정정 기록:** 이 문서의 최초 작성 시 PR API 230개 changed-file 목록만 비교해 #702-only 삭제 파일 4개를 놓친 계산(187 same / 36 modified / 4 added / 0 deleted)을 포함했다. 전체 #702 tree와 현재 PR #1 head tree의 직접 비교로 확정한 결과는 1,588 same / 39 modified / 4 added / 4 deleted = 47 changed paths다. 아래 Section 1.2와 3이 정정된 최종값이며, 과거 계산은 재사용하지 않는다.

# PR #1 ↔ #702 파일 단위 차이 감사

- 작성일: 2026-11-28 (KST)
- 저장소: https://github.com/dragonslayers-k/Maglev_forked
- 복구 기준 commit: 45e685603a3a23507b61cb49398a78380d5db7a5 (#702)
- 비교 대상 commit: 2820b4dff15773ce835a43a3ea4936aa6e7b26ad (PR #1 head)
- PR base: dev
- 문서 목적: PR #1 변경 230개 경로를 #702 Git tree의 실제 존재 여부와 blob SHA-1 기준으로 대조한다.
- 상태: 경로별 대조 완료 / 중요 소스 차이 감사 부분 완료 / 코드 변경 없음

> 주의: PR API의 230개 changed-file 수는 PR base인 dev와의 diff 수다. 이것을 그대로 #702 이후 변경량으로 해석하면 안 된다. #702와 PR head의 Git tree를 직접 대조한 결과를 아래에 별도로 기록한다.

---

## 1. 정확한 파일 수 비교

### 1.1 PR #1이 dev에 제출한 변경 통계

| GitHub PR API 기준 | 파일 수 |
|---|---:|
| modified | 157 |
| added | 70 |
| removed | 3 |
| 합계 | 230 |

### 1.2 #702와 PR head 전체 Git tree/blob 비교 — 최신 정확값

비교:
- #702: 45e685603a3a23507b61cb49398a78380d5db7a5
- PR #1 head: 2820b4dff15773ce835a43a3ea4936aa6e7b26ad

PR API의 230개 파일은 base=dev 기준이다. #702 전용 파일의 삭제 여부를 놓치지 않도록 양쪽 Git tree의 전체 blob path와 SHA를 직접 비교했다.

| #702 대비 PR head | 파일 수 |
|---|---:|
| 내용 동일 | 1,588 |
| 양쪽에 존재하지만 내용 변경 | 39 |
| PR head에만 추가 | 4 |
| #702에서 PR head로 삭제 | 4 |
| 전체 차이 | 47 |
| 양쪽 tree의 blob 수 | 각각 1,631 |

PR API의 base=dev 기준 changed files는 별도로 modified 157, added 70, removed 3, 합계 230이다. 이 숫자를 #702 대비 변경 수와 혼용하지 않는다.

정확한 #702-only 삭제 4개:
- docs/FINAL_PRODUCT_REFERENCE_AND_IMPLEMENTATION_MASTER.md
- docs/RUNTIME_FIRST_STABILIZATION_PLAN.md
- scripts/test-page-scan-mse.js
- scripts/test-wireguard-decoupled.js

앞서 작성한 초안에서 PR API 230개 목록을 바탕으로 187 same / 36 changed / 4 added / 0 deleted라고 계산한 값은 #702 전용 파일 4개가 누락된 불완전한 대조였다. 전체 tree 대조가 최종 수치다.

## 2. PR #1의 230개 경로 분포

아래 분류는 파일 경로 목적에 따른 목록 정리이며 기능 합격 수나 코드 품질 점수가 아니다.

| 경로 영역 | 파일 수 |
|---|---:|
| CI / build / package / plugin | 14 |
| README | 2 |
| App UI / settings / components | 52 |
| Browser / discovery / stream | 16 |
| WireGuard / proxy | 18 |
| YouTube / extractor | 10 |
| Documentation | 23 |
| Native core / storage / share | 15 |
| Playback / PiP | 1 |
| Tests / test scripts | 79 |
| 합계 | 230 |

## 3. #702와 내용이 달라지거나 추가/삭제된 47개 경로

### 3.1 #702 대비 수정된 39개 파일

1. .github/workflows/ci.yml
2. README_KO.md
3. app/browser.tsx
4. app/settings/about.tsx
5. app/settings/wireguard.tsx
6. app/youtube-download.tsx
7. components/browser/MediaMenu.tsx
8. components/browser/StreamSheet.tsx
9. constants/copy.ts
10. modules/maglev-engine/android/build.gradle
11. modules/maglev-engine/android/src/main/AndroidManifest.xml
12. modules/maglev-engine/android/src/main/java/com/maglev/engine/EngineHost.kt
13. modules/maglev-engine/android/src/main/java/com/maglev/engine/MaglevEngineModule.kt
14. modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/FoundClassifier.kt
15. modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/MaglevBrowserView.kt
16. modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/PageScan.kt
17. modules/maglev-engine/android/src/main/java/com/maglev/engine/watch/MaglevWatchModule.kt
18. modules/maglev-engine/android/src/main/java/com/maglev/engine/wireguard/NativeTunnel.java
19. modules/maglev-engine/android/src/main/java/com/maglev/engine/wireguard/WireGuardController.kt
20. modules/maglev-engine/android/src/test/java/com/maglev/engine/browser/FoundClassifierTest.kt
21. modules/maglev-engine/android/src/test/java/com/maglev/engine/browser/PageScanTest.kt
22. modules/maglev-engine/src/MaglevBrowser.tsx
23. modules/maglev-engine/src/MaglevEngine.types.ts
24. modules/maglev-engine/src/MaglevMockEngine.ts
25. modules/maglev-engine/src/MaglevNativeBridge.ts
26. native/maglev-core/src/config.rs
27. native/maglev-core/src/engine.rs
28. native/maglev-core/src/http_dl/driver.rs
29. native/wireguard/cmd/jni/jni.c
30. native/wireguard/cmd/jni/main.go
31. native/wireguard/engine.go
32. native/wireguard/engine_test.go
33. package.json
34. scripts/test-app-wireguard-isolation.js
35. scripts/test-browser-tabs-ui.js
36. scripts/test-media-hit.js
37. scripts/test-youtube-format-selector.js
38. utils/browser/mediaHit.ts
39. utils/settingsIndex.ts

### 3.2 #702 이후 신규 추가된 4개

1. docs/CI707_RUNTIME_FAILURE_TRIAGE_KO.md
2. docs/MASTER_MEDIA_DOWNLOADER_SPEC_KO.md
3. modules/maglev-engine/android/src/main/java/com/maglev/engine/player/MaglevMediaPlayerActivity.kt
4. scripts/test-in-app-player-contract.js

### 3.3 #702에는 있으나 현재 PR head에서 삭제된 4개

1. docs/FINAL_PRODUCT_REFERENCE_AND_IMPLEMENTATION_MASTER.md
2. docs/RUNTIME_FIRST_STABILIZATION_PLAN.md
3. scripts/test-page-scan-mse.js
4. scripts/test-wireguard-decoupled.js

**복구 처리:** MSE observer 회귀와 WG lifecycle decoupling 회귀를 다시 테스트해야 하므로 2개 스크립트는 우선 복구하거나 동일/상위 coverage의 실행 가능한 대체 테스트를 만든다. 삭제된 문서 2개는 새 문서가 전체 내용을 대체하는지 확인하고 원본을 history 또는 recovery docs로 보존한다. 이 네 경로를 단순히 삭제된 것으로 넘기지 않는다.

## 4. 추가 파일 수용 기준

#702 이후 신규 추가 4개는 Section 3.2에 열거했다. 문서 2개는 이후 재설계 참고자료로 유지한다. Player Activity는 Activity 단위 Media3 prototype으로 분류하며 MediaSessionService 기반 완성된 background playback으로 승격하지 않는다. Player contract test는 유지하되 정적 계약 검사만으로 런타임 기능을 증명하지 않는다.

## 5. 핵심 변경의 source-level 판정

### 5.1 PageScan / FoundClassifier

확인된 내용:
- #702 PageScan은 ScanReport에 EME, Blob, MSE 상태를 분리해 보유한다.
- #702는 MediaSource.addSourceBuffer / SourceBuffer.appendBuffer observation을 포함한다.
- #702 resource candidate는 initiator, MIME, type/format query를 이용해 opaque XHR를 함부로 영상으로 승격하지 않도록 한다.
- PR head에서는 MSE 상태·observer hooks 및 연관 XHR candidate path가 빠졌다.
- FoundClassifier에서도 일부 explicit MIME/type query 분류가 제거됐다.

결정:
- #702의 MSE observer와 MIME/type-aware candidate logic을 복구 후보로 둔다.
- tracking/qoe/telemetry를 미디어로 오인하지 않도록 source/initiator/MIME/manifest/confidence 검증을 추가한다.
- observer만 복구해도 MSE byte capture가 되는 것은 아니다. 실제 byte capture/finalize/output validation은 별도 gate다.

### 5.2 MaglevBrowserView / Browser Proxy / PiP

확인된 내용:
- #702 BrowserView에는 WireGuardController.ensureBrowserProxy 호출, loopback proxy HTTP auth challenge credential 처리, MSE page-note 전달이 있다.
- PR head에서 해당 Browser proxy 연동 및 MSE note가 빠졌다.
- PR head에는 PiP 요청 callback을 보유하고, fullscreen custom view가 실제로 붙고 Android PiP 전환이 수락된 뒤 결과를 resolve하는 흐름이 추가됐다.

결정:
- Browser proxy 준비와 WebView 인증 경로를 복구 후보로 둔다.
- PiP result handshake 개선은 보존 후보로 둔다.
- PiP 검증은 실제 video surface/frame, audio continuity, 회전/복귀까지 포함한다. callback 성공만으로 합격하지 않는다.

### 5.3 WireGuardController / NativeTunnel / Go-JNI status contract

확인된 내용:
- #702 Controller는 약 27.1 KB, PR head는 약 9.7 KB다.
- #702에는 AndroidX ProxyController, Browser proxy credentials, proxy install/clear, Browser proxy ensure, Download pause/resume rollback, 기존 proxy save/restore, tunnel test/status 및 peer handshake/RX/TX 보고 경로가 있다.
- PR head에는 Media3 playback용 proxy accessor 및 closed-proxy 경로가 추가됐다.
- PR head setEnabled 경로는 EngineHost.ensureStarted()를 먼저 요구하며, #702에 있던 Browser ProxyController/authentication 경로 및 기존 transfer rollback 상태 상당 부분이 사라졌다.
- NativeTunnel.java, JNI C, Go main 및 Go Engine에서 peerStatus API가 제거됐다.
- MaglevEngineModule / TypeScript bridge의 WG status shape도 상세 peer handshake/RX/TX/browserProxyApplied/handshake age에서 enabled/profile/running 위주로 축소됐다.

결정:
- #702의 tunnel lifecycle, Browser proxy/auth, transfer pause/rollback, peer status API를 기준으로 복구 설계한다.
- Media3 playback proxy 추가는 client-specific adapter로 보존할 수 있지만 Browser/Downloader의 proxy coverage를 대체해서는 안 된다.
- setEnabled에서 EngineHost 초기화 실패가 터널 시작을 선행 차단하는 dependency는 분리 검증한다. 이는 source regression이자 원인 후보이지, Galaxy 오류의 확정 root cause는 아니다.
- listener ready / peer handshake / authenticated proxy request / HTTPS egress를 각각 다른 state로 구현한다.

### 5.4 EngineHost / Rust native config

확인된 내용:
- #702 NativeConfig에는 Torrent peer proxy 목적의 proxy_url과 HTTP(S) link-download 목적의 http_download_proxy_url이 별도 존재했다.
- PR head에서는 별도 http_download_proxy_url field가 제거되고 일반 proxy_url에 app-local HTTP loopback proxy validation 경로가 추가됐다.
- EngineHost의 get/set App WireGuard proxy와 config migration/startup handling도 이 필드 계약 변경에 맞춰 달라졌다.

결정:
- 이를 단순 rename으로 취급하지 않는다. Torrent SOCKS5와 HTTP link download proxy의 client coverage 및 우선순위를 명세한다.
- 필드 통합을 채택할지, #702처럼 분리할지 ADR에서 결정한다.
- 두 protocol이 동시에 설정되는 fixture, WG startup fail-closed, restart/restore, Torrent peer route, Direct HTTP route를 테스트하기 전에는 설정 contract를 바꾸지 않는다.

### 5.5 Native bridge diagnostics

확인된 내용:
- #702 MaglevNativeBridge에는 native initialization exception의 class/message 일부를 사용자 진단 경로에 노출하는 로직이 있었다.
- PR head에서는 해당 상세 오류 경로가 제거된 흔적이 있고, WG status 타입도 요약 상태로 축소됐다.

결정:
- 원인을 알 수 없는 일반 오류 문구로 다시 회귀하지 않도록 sanitized native cause/code를 복구한다.
- private key, proxy password, URL credentials, session tokens는 메시지·Logcat·crash report에 포함하지 않는다.

### 5.6 YouTube format selector / MediaMenu / StreamSheet

확인된 내용:
- app/youtube-download.tsx에는 provider dedupe/filter 결과에서 선택된 format이 visible list에서 사라지면 첫 유효 항목으로 재선택하는 reconciliation 코드가 추가됐다.
- YoutubeDownload.kt와 NewPipeYoutube.kt는 #702와 PR head의 blob이 동일하다. 따라서 native extractor/download core는 이 차이에서 새로 개선된 것으로 볼 수 없다.
- Browser mediaHit.ts에는 앱 내 재생 action과 MIME hint helper가 추가됐다.
- app/browser.tsx 및 StreamSheet에는 native player open action, metadata 및 display path가 추가됐다.

결정:
- YouTube selector reconciliation은 unit/contract 및 실제 포맷 변경 시나리오 통과 후 보존한다.
- NewPipe/yt-dlp native transfer는 별도 속도·성공률·결과 파일 테스트를 한다.
- 앱 내 재생 action은 Direct/HLS/DASH client별 proxy, referer/user-agent, protected-stream behavior를 검사한 뒤 채택한다.
- audio-only와 선택 bitrate는 native output의 실제 codec/bitrate와 대조한다.

### 5.7 CI / 테스트 변경

확인된 내용:
- #702 workflow는 Go WireGuard test에 명시적인 test timeout 및 verbose output, step timeout을 사용했다.
- PR head workflow는 Go test invocation의 명시적 timeout/verbose flag와 step timeout 일부가 제거됐다.
- engine_test.go에서 IPv6/AllowedIPs 관련 및 일부 동시 요청 테스트 코드가 달라졌다.

결정:
- 긴 테스트를 skip하거나 무작정 timeout을 늘리지 않는다.
- gVisor cleanup/keep-alive 문제는 원인을 테스트 fixture에서 재현해 해결한다.
- 기본 Go test suite에는 bounded timeout과 충분한 로그를 적용한다.
- IPv6/AllowedIPs, DNS, TLS, concurrency, lifecycle cleanup coverage를 유지한다.

---

## 6. 신규 파일과 기존 파일의 채택 결정

| 경로 | 결정 | 이유 |
|---|---|---|
| CI707_RUNTIME_FAILURE_TRIAGE_KO.md | 보존 | 실패 원인과 runtime gate의 이력 |
| MASTER_MEDIA_DOWNLOADER_SPEC_KO.md | 통합 참고 | 새 종합 설계기준서와 충돌을 검토해 단일 명세로 정리 |
| MaglevMediaPlayerActivity.kt | 보류 | Activity prototype. MediaSessionService 및 Galaxy 검증 필요 |
| test-in-app-player-contract.js | 보존·보강 | contract test는 필요하나 실제 playback 증거를 대체하지 않음 |

### 변경된 파일별 기본 처리

- Browser/MSE: #702 MSE observer와 MIME-aware classification을 복구하고 현재 PiP handshake 개선만 선별 보존.
- WireGuard: #702 Browser proxy/auth, independent lifecycle, rollback 및 peer status를 기준으로 adapter contract 복원.
- NativeConfig: Torrent SOCKS5와 HTTP download route의 분리/통합을 ADR로 결정하기 전 변경 금지.
- YouTube: selector reconciliation만 보존 후보. native extractor core는 별도 검증.
- Player: prototype은 격리해 Local file/Direct MP4부터 검증.
- CI/tests: build gate는 유지하고 실기기 수용과 skip semantics를 더 엄격히 한다.
- Localization/settings: 번역과 검색 기능은 기존 동작 회귀가 없는지 테스트 후 보존한다.
- Documentation: 중복 제안은 하나의 승인된 실행 명세로 통합하되 과거 증거 문서는 이력으로 보존한다.

## 7. 작업 우선순위

1. R1: #702 앱 셸·Torrent·Direct·Browser·storage golden tests.
2. R2: EngineHost/JNI/Rust startup error 진단 및 Direct transfer.
3. R6 foundation: WG native lifecycle와 peer status contract를 Browser/Download route로부터 분리.
4. R3: YouTube video/audio native output, mux, filename, speed tests.
5. R4: Browser candidate false-positive filtering과 HLS/DASH.
6. R5: Browser PiP 및 Media3 playback/MediaSessionService.
7. R7: 한국어 UI 전수검사.
8. R8: exact artifact 기반 emulator + Galaxy acceptance 및 release.

기능을 병렬로 쌓지 말고 한 단계의 수용 조건을 확인한 뒤 다음 단계로 이동한다. Direct/Torrent baseline과 기존 다운로드 lifecycle은 항상 보호한다.

## 8. 다음 코드 작업 전에 필요한 결정

- [ ] #702의 native config proxy field split을 기준으로 할지 결정.
- [ ] EngineHost startup ordering과 WireGuard tunnel lifecycle을 분리.
- [ ] Browser proxy와 downloader proxy의 network client coverage matrix 작성.
- [ ] peerStatus handshake/RX/TX API를 Go → JNI → NativeTunnel → MaglevEngineModule → TS UI까지 일관되게 복구.
- [ ] PageScan MSE observer 및 MIME candidate contracts 복원.
- [ ] MSE byte capture 지원 여부는 별도 ADR로 분리.
- [ ] Media3 Activity prototype 채택 여부를 Local file/Direct MP4 test 이후 결정.
- [ ] workflow에서 Go tests timeout/verbose, emulator smoke, artifact hash record를 확정.

---

## 9. 현재 실행 경계

본 감사는 #702와 PR #1의 Git tree/blob을 비교하고 중요 소스의 변경점을 식별한 결과다. PR #1 전체 230개 PR API 경로와 #702→head 전체 tree 차이 47개 경로를 별도로 확인했다. 39개 수정 파일 중 3개(MaglevBrowser.tsx, native/maglev-core/src/engine.rs, native/maglev-core/src/http_dl/driver.rs)는 후속 상세 함수별 감사가 남아 있으며, 나머지 변경 파일도 전체 test behavior review는 아직 끝나지 않았다. 특히 UI, Watch service, build plugin, app update, sharing, settings, subtitles 관련 diff는 추가 검토가 필요하다.

이 문서 및 같은 복구 branch의 상위 실행 설계서는 문서만 추가한다. #702 앱 소스, main/dev, PR #1, 기존 releases/tags/workflows는 수정하지 않았다. **이 감사 결과만으로 새 APK를 만들거나 어떤 기능을 완료 처리하지 않는다.**
