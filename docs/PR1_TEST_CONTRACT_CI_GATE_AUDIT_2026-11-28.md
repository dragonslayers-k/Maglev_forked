# PR #1 테스트 계약 및 CI gate 회귀 감사

- 작성일: 2026-11-28 (KST)
- Repo: dragonslayers-k/Maglev_forked
- #702 baseline: 45e685603a3a23507b61cb49398a78380d5db7a5
- PR #1 head / Run #739: 2820b4dff15773ce835a43a3ea4936aa6e7b26ad / 46024619575
- 상태: 정적 테스트·workflow 비교 완료 / 앱 소스 수정 없음

---

## 1. 결론

CI가 green이라는 사실은 유효하지만, #739의 통과만으로 브라우저·WireGuard·미디어·PiP 런타임 동작이 Galaxy에서 합격했다고 판단할 수 없다.

특히 #702에서 실제 동작 계약을 정적 테스트로 보호하던 WireGuard test가 PR #1에서 축소되어 Browser proxy/authentication 및 HTTP proxy 적용, 기존 다운로드 pause/resume에 대한 일부 assertion이 사라졌다. 이는 테스트 범위가 낮아졌다는 뜻이며, 실제 기능의 성공/실패는 별도다.

반대로 YouTube format selector reconciliation과 Browser MIME hint / in-app playback menu를 확인하는 테스트는 유효한 개선 후보이므로 보존한다.

## 2. WireGuard isolation contract test 축소

### #702의 test-app-wireguard-isolation.js가 확인하던 계약

- Android VpnService를 사용하지 않는 app-local proxy 모드.
- AndroidKeyStore AES/GCM/NoPadding 및 noBackup profile storage.
- Browser WebView request를 tunnel startup 중 fail-closed로 유지하고 proxy-applied state를 보고.
- AndroidX WebView ProxyController로 loopback HTTP proxy override.
- WebView의 dedicated loopback proxy HTTP auth challenge만 별도 credential로 처리.
- 화면에 “앱 브라우저 + HTTP/HTTPS 다운로드” 및 다른 Android 앱/시스템 network는 터널에 포함하지 않는다고 표시.
- EngineHost에서 app-local HTTP proxy를 별도의 http_download_proxy_url 필드에 적용하고 restart_required를 처리.
- WG start 중 기존에 진행 중인 download를 안전하게 pause하고 성공/실패 시 원래 활성 상태만 복원.
- 연결 시험 요청이 인증된 local proxy를 통과하도록 OkHttp proxy + credentials 사용.
- Rust native config에서 HTTP download route와 Torrent SOCKS5 peer route의 구분.
- Go userspace network stack, loopback proxy, netstack shutdown synchronization 및 JNI 원래 오류 코드 유지.

### PR #1 head에서 test가 줄인 부분

PR #1 head의 test-app-wireguard-isolation.js는 32줄에서 25줄로 축소됐다. 비교상 다음 검사가 사라졌다.

- WebView dedicated auth challenge / credentials 확인.
- app-only vs system/other-app routing 안내 문구.
- HTTP download 전용 config field 확인.
- WebView ProxyController 및 browserProxyApplied의 구체적 연결 계약.
- active downloads pause/resume의 호출 계약.
- 연결 시험용 authenticated OkHttp proxy 사용 확인.
- Torrent SOCKS5와 HTTP download proxy 분리 확인.

대신 controller의 CLOSED_PROXY/direct HTTP 문구, prepareDownload 및 generic proxy field 등 축약된 assertion이 들어갔다.

**판정:** PR #1의 테스트는 이전보다 일부 네트워크 수용 계약을 덜 검사한다. 이것만으로 runtime failure의 원인을 단정하지 않는다. 복구 작업에서는 #702 assertion을 기준으로 하되, 현재 Media3 playback route와 fail-closed behavior까지 client별 테스트로 확장한다.

## 3. YouTube selector test 변경

PR #1의 test-youtube-format-selector.js에는 다음 검사가 새로 추가됐다.

- provider dedupe 후 선택된 format이 visible list에서 사라졌을 때 첫 유효 video format을 선택.
- audio format도 동일하게 선택을 복구.
- 품질/오디오 선택 sheet가 비활성 상태로 고립되지 않도록 한다.

이는 app/youtube-download.tsx에 추가된 selection reconciliation 코드와 맞물린다.

**판정:** 기능 회귀가 없는지 UI state transition tests를 보강해서 보존한다. 이 검사는 포맷 선택 화면 상태를 확인할 뿐 실제 다운로드한 stream이나 mux 결과 파일을 보증하지 않으므로 Galaxy E2E는 별도다.

## 4. Browser media hit test 변경

PR #1의 test-media-hit.js에는 다음이 추가됐다.

- HLS, DASH, MP4, WebM URL별 MIME hint 분류.
- Direct video 메뉴에서 앱 내 재생 action 노출.
- HLS 메뉴에서 앱 내 재생 및 stream download action을 함께 노출.
- Blob 후보는 직접 저장 버튼을 제공하지 않고 안내/Found tray로 제한.

**판정:** 올바른 UX 개선 후보로 보존한다. 단, URL suffix 추정만으로 server MIME/실제 codec을 보증하지 않는다. MIME unknown 및 extensionless manifest/redirect response는 native probe로 보완해야 한다. Static menu test는 Media3 실제 재생 및 PiP 성공의 증거가 아니다.

## 5. P3 Reality Contract gate의 정확한 의미

test-p3-reality-contracts.js 자체는 #702와 PR #1 head에서 동일 blob으로 확인됐다. 소스 상단에 아래 정책이 명시돼 있다.

- red-phase TDD suite.
- 대응 기능이 구현될 때까지 fail을 예상하는 계약 모음.
- P0, P1, P2 계약을 함께 정의.
- 프로세스 exit code 1은 P0 contract fail일 때만 발생.

#739 Contract tests job log에서 확인된 예:

- P0 engine, persistence, foreground service, notification action, permission, SAF, magnet, config 관련 체크가 실행됐다.
- C-ENG-2는 로컬 checkout에 .so가 없으므로 SKIP됐고 CI native build/size/alignment gate에서 별도로 검사한다고 기록됐다.
- 일부 문서 경로 검사는 private docs가 CI에 없다는 이유로 SKIP됐다.
- P1/P2 계약도 실행 로그에 출력됐지만, 테스트 suite 전체의 non-zero exit 조건은 P0 fail이다.

**판정:** “Contract tests job success”는 P0 계약 suite가 fail하지 않았다는 의미다. 모든 P1/P2 기능의 필수 수용이나 Android 실기기 E2E, YouTube 저장 결과, 실제 peer handshake, PiP frame continuity를 증명하지 않는다. 필수 제품 gate는 별도 job으로 분리하고 skip을 fail/blocked로 처리해야 한다.

## 6. Go WireGuard test command 변경

#702 CI의 WireGuard Go unit test step:
- test command: go test -count=1 -timeout 2m -v .
- step-level timeout: 3 minutes.
- 이후 go vet.

PR #1 head에서는 go test -count=1 .만 수행하며 해당 step에 있던 명시적 timeout 및 verbose 옵션이 빠졌다.

**판정:** PR #1에서 timeout guard가 약해졌다. #702처럼 bounded, verbose test로 복구하되, 테스트를 건너뛰지 않는다. 이전에 관찰된 gVisor shutdown/cleanup hang의 원인을 먼저 재현해 수정하고, race/parallel request/lifecycle cleanup coverage를 유지한다.

## 7. 복구할 필수 test layers

### Static/contract (빠른 단계)

- PageScan/FoundClassifier: DOM, MIME, manifest, fetch/XHR provenance, MSE observer, candidate confidence.
- WireGuard: controller lifecycle, WebView ProxyController/auth, EngineHost proxy field, Torrent vs HTTP routes, peer status mapping, rollback.
- YouTube: format ID/provider identity, video/audio choice, bitrate and extension/container selection reconciliation.
- Media hit: URL normalize, MIME hint, HLS/DASH/Direct menu, Blob/DRM boundary.
- Native bridge: JNI/Go/Rust API contract, status/error mapping, secrets redaction.

### Native/unit/integration

- Go userspace engine: config parser, DNS, TLS, proxy auth, handshake status, concurrent requests, shutdown/race/cleanup.
- Rust engine: Direct Range/Resume, HLS/DASH parser, transfer/DB persistence, output and storage commit.
- Kotlin: WebView proxy/auth, lifecycle and Media3 data source/player.
- Android integration: app process restart, notifications, storage SAF, share intent, network switch.

### Device E2E (Galaxy required)

- Browser route: page open → media candidate → clean candidate list → correct selected media → saved playable output.
- YouTube: external Share + URL entry → formats → video-only, muxed, audio-only → correct output file inspection and playback.
- Direct: Range/parallel, sequential fallback, pause/resume, process kill/relaunch recovery.
- HLS/DASH: variants, audio/subtitle tracks, resume, mux, final playback.
- PiP: real video surface/audio continuity; home/recents/rotate/return.
- WG: import, start, listener, handshake, Browser HTTPS egress, Downloader egress, route drop/fail-closed, restore original state.
- Korean UI: all visible strings, error messages, loading/empty state, dialogs, notifications.

Every device result must include exact APK SHA-256, device model/Android version, test URL/fixture, operation sequence, expected/actual result, relevant sanitized logs and resulting file metadata.

---

## 8. CI acceptance contract for the recovery line

A required feature gate is PASS only when:

1. The corresponding test ran (not skip).
2. The exact commit SHA is known.
3. Artifact was actually built, not only reused from an unverified commit.
4. APK package/version/ABI/signing/hash inspection passed.
5. Native/runtime feature tests passed.
6. Emulator install/launch/smoke passed where applicable.
7. Galaxy acceptance for device-specific behavior is separately recorded.
8. No protected feature is silently downgraded or routed to an unverified fallback.

The branch may merge one focused PR only after its gate passes. PR #1 as a whole remains a historical integration container, not an accepted release candidate.

## 9. Current boundary

This audit is source/test/workflow review only. No app source, native code, CI workflow, main/dev, PR #1 or release was changed in this work. The recovery branch contains documentation only. No new APK has been built, and no Galaxy device test has been performed by this audit.
