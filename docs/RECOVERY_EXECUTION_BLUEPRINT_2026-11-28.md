# Maglev+ #702 복구 기준선 감사 및 재설계 실행안

- 작성일: 2026-11-28 (KST)
- 저장소: https://github.com/dragonslayers-k/Maglev_forked
- 복구 표본: 사용자 제공 Downloader-recovery-baseline-702-arm64.apk
- 문서 상태: 실행 설계 / R0 감사 진행 중 / 앱 소스 변경 없음
- 상위 기준: 통합_미디어_다운로더_전수조사_종합_설계기준서.md

> 이 문서는 확인된 Git 소스, CI 결과, APK 정적 정보, 기기 녹화 관찰, 미검증 설계 제안을 분리한다. CI 성공을 실기기 합격으로 표현하지 않는다.

---

## 0. 복구 결론

1. Maglev 기반은 유지한다. 기존 앱 셸, Browser, Torrent, Direct, HLS/DASH, Transfers, 저장·알림 경로를 우선 보존하고 실제 기능별 수용 상태는 다시 검증한다.
2. 사용자가 제공한 #702 APK를 변경 불가 비교 표본으로 고정한다.
3. #702 이후 개발 브랜치를 통째로 병합하거나 단순히 최신 커밋으로 교체하지 않는다. #702와 현재 통합 브랜치는 Git 이력이 분기되어 있으므로 파일·기능 단위로 선별 이식한다.
4. #702도 최종 완성품이라고 선언하지 않는다. 복구 기준선이며 YouTube, audio-only, browser discovery, PiP, WireGuard, 한국어, 결과 파일 재생은 각자 합격 기준이 필요하다.
5. R0/R1 기준선 테스트와 아키텍처 결정이 끝나기 전에는 새 기능을 병렬로 구현하지 않는다.
6. 기존 브랜치, PR, 태그, 릴리즈, Actions workflow와 산출물을 정리한다는 이유로 삭제하거나 force-push하지 않는다.

## 1. #702 복구 기준선 식별

### 1.1 APK 식별 결과

| 항목 | 확인값 |
|---|---|
| Actions run | https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45980241030 |
| Run ID | 45980241030 |
| Build commit | 45e685603a3a23507b61cb49398a78380d5db7a5 |
| Build branch | fix/wg-peer-handshake-status |
| APK 크기 | 63,671,691 bytes |
| APK SHA-256 | 065d29dfcb19ad630c6bc906bfadecb2bd31395edc707ad3e35cf1f54b10c2de |
| 앱 이름 | Maglev+ |
| Android package | com.maglev.plus |
| 앱 버전 / versionCode | 0.33 / 33 |
| ABI | ARM64 |
| 포함 라이브러리 관찰 | libmaglev_core.so, libmorphewireguard.so 및 FFmpeg 계열 |

사용자 첨부 APK의 SHA-256을 직접 계산했고 #702 복구 기록의 hash와 일치했다. APK 내부 app.config에서 앱 이름, 버전, package, versionCode를 확인했다. 라이브러리 포함 여부는 정적 관찰이며 이 정보만으로 런타임 성공을 보증하지 않는다.

### 1.2 #702 CI 판정

#702에서 Contract tests, JavaScript/typecheck/tests, Rust no-JNI tests, WireGuard userspace core tests, Android ABI 계획, ARM64 native build, APK build 및 signing verification이 성공했다. APK artifact가 생성됐다. 일부 별도 배포용 signed set 및 reuse 단계는 skip됐다.

**판정: 빌드·계약·단위 테스트 결과 PASS. Galaxy 실기기 E2E PASS는 아님.** 계약 테스트에는 아직 구현 전인 일부 P3 범위를 비차단 처리하는 규칙도 있으므로, #702 CI만으로 모든 제품 요구사항이 정상이라고 판단하지 않는다.

### 1.3 안전 복구 브랜치

recovery/2026-11-28-user-baseline-702는 #702 commit에서 정확히 분기했다. #702 대비 3개 commit ahead이며 변경 파일은 복구 문서 3개뿐이다. 앱 소스는 #702와 동일하다. 이 브랜치는 감사 문서와 이후 복구 작업의 안전한 기준으로 유지한다.

### 1.4 현재 저장소 상태 스냅샷

- main 및 dev는 upstream Maglev v0.33 기준 commit baaf83f0f3afd65d2eac135cce8b8bbabea8fbb3에 있다.
- PR #1은 Draft / 미병합이며 230개 파일 변경의 대규모 통합 브랜치다. 실기기 회귀가 기록되어 복구 검토 상태다.
- Issue #8은 runtime-first 수용 추적 이슈다.
- 최신 확인 CI #739는 성공했으며 Rust, Contract, JavaScript, ARM64 native, APK build 단계가 통과했다. 이 결과는 기기 수용을 뜻하지 않는다.
- PR #7/#9는 닫혔지만 미병합이다. 연결된 브랜치와 이력은 감사 자료이므로 유지한다.

#702 commit 45e685603a3a23507b61cb49398a78380d5db7a5와 현재 PR #1 head 2820b4dff15773ce835a43a3ea4936aa6e7b26ad 비교는 diverged다. merge-base는 5fb9af93c13f7397f745639f2b9776ece5eaae20이며 각 측에 서로 다른 고유 commit이 있다. 따라서 “#702 뒤에 PR #1 변경이 차례로 누적됐다”는 단순 가정은 성립하지 않는다. 전체 history와 파일별 영향 검토 전까지 대형 merge, rebase, 일괄 cherry-pick을 금지한다.

참조:
- #702 Actions: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45980241030
- 최신 확인 CI #739: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46024619575
- PR #1: https://github.com/dragonslayers-k/Maglev_forked/pull/1
- Runtime 수용 추적 Issue #8: https://github.com/dragonslayers-k/Maglev_forked/issues/8
- #702 commit: https://github.com/dragonslayers-k/Maglev_forked/commit/45e685603a3a23507b61cb49398a78380d5db7a5

---

## 2. 조사 범위와 증거 등급

### 2.1 확인한 자료

- 새로 제공된 전수조사 종합 설계기준서.
- 통합 미디어 다운로더 총괄 개발 가이드.
- Maglev 종합 개발착수·인계 기준서.
- 종합 다운로더 APK 개발 착수 문서.
- Barrel 1.1.2 APK 심층 분석 및 다운로드 기능 이식 설계서, 제공된 Barrel APK.
- App-local WireGuard Proxy Integration Deep Report.
- LJ Video Downloader XAPK에 관한 이전 메타데이터 및 정적 분석 기록.
- GitHub의 #702 및 현재 PR #1 소스 트리, 주요 Kotlin/TypeScript/Go 파일, PR, Issue, Actions 기록.
- 2026-11-26 및 2026-11-27 Maglev+ 화면 녹화.

### 2.2 원본이 별도 확인되지 않은 자료

종합 설계기준서에는 Video-Downloader-Preflight.zip, Barrel Smart Connect 상세 이식명세, App-local WireGuard Proxy Porting Guide가 참조자료로 기재돼 있다. 현재 열람 가능한 Library 목록에서 이 세 원본 파일은 별도 파일로 확인되지 않았다. 따라서 관련 내용은 새 종합 설계기준서와 열람 가능한 WireGuard 보고서에 요약된 범위까지만 사용한다. 원본 문서 전체를 다시 열어 검토했다고 주장하지 않는다.

### 2.3 증거 레이블

- S1 Source verified: 실제 저장소 파일·메서드·계약 비교.
- S2 Build/CI verified: 특정 commit에서 job이 실제 실행되어 통과.
- S3 Binary verified: APK/XAPK의 package/config/library/hash 등 정적 정보.
- S4 Device observation: 실제 화면 녹화 또는 사용자 관찰. exact APK hash와 연결되지 않으면 특정 commit의 합격 증거로 쓰지 않는다.
- S5 Device accepted: exact APK hash를 기록하고 Galaxy 실기기에서 테스트한 수용 결과.

현재 #702는 S2/S3 복구 표본이다. 11월 26~27일 화면 녹화는 S4 관찰이다. 소스에 코드가 있다는 사실과 Galaxy에서 정상 동작한다는 사실을 섞지 않는다.

---

## 3. #702와 후속 소스 비교: 확인된 퇴보와 보존 후보

### 3.1 Browser PageScan / MSE 관찰 — 일부 퇴보 확인 (S1)

#702 PageScan은 ScanReport에 entries, EME, Blob, MSE 상태를 별도 보유했다. MediaSource.addSourceBuffer 및 SourceBuffer.appendBuffer 사용 흔적을 관찰하고, Fetch/XHR resource observation과 MIME/type query를 이용한 제한적 candidate 분류 경로가 있었다.

현재 PR #1 head PageScan에서는 MSE 상태 필드 및 observer hooks, 관련 resource candidate 경로가 제거됐다. FoundClassifier에서도 일부 MIME/type query 기반 video/audio 분류가 사라졌다.

**복구 결정**
- #702의 MSE observer와 MIME-aware candidate classification을 복구 후보로 둔다.
- MSE 감지는 실제 media bytes 확보 또는 저장을 의미하지 않는다.
- MSE capture는 appendBuffer bytes, init/media segment ordering, storage bound, cancellation, finalize/mux, output inspection, playback 검증 전까지 “브라우저 녹화 지원”으로 표시하지 않는다.
- ptracking, qoe, 광고/telemetry, 단순 세그먼트 요청을 미디어 파일처럼 노출하지 않도록 source provenance, MIME, manifest, initiator, candidate confidence를 함께 판단한다.
- 감지됨 / 분석 가능 / 다운로드 가능 / 실제 저장 검증됨 상태를 UI에서 구분한다.

11월 27일 화면 녹화에서는 YouTube 페이지 후보 목록에 8~10개 항목이 표시되고 ptracking, qoe, videoplayback 등의 잡음 후보가 보인다. 이는 감지 파이프라인의 오탐 필터링 문제가 남아 있음을 보여주는 S4 관찰이다. 녹화가 exact #702 APK hash에 연결되지는 않았다.

### 3.2 WireGuard Controller / WebView Proxy — 구조적 퇴보 확인 (S1)

#702 WireGuardController는 약 27.1 KB이며 다음 경로를 보유했다.

- userspace tunnel lifecycle과 EngineHost initialization 의존성을 분리하는 시작 흐름.
- 기존 Torrent 및 Download 일시정지와 실패 시 rollback/resume.
- 기존 engine proxy 설정 저장 및 복원.
- 시작 중 Browser 요청을 closed proxy로 전환하는 보호 경로.
- AndroidX WebView ProxyController 적용/해제.
- loopback proxy authentication challenge에만 별도 credentials 전달.
- Browser proxy 준비·상태·연결 시험.
- peer status, handshake, RX/TX 진단 경로.

현재 PR #1 head의 WireGuardController는 약 9.7 KB로 축소됐다. setEnabled(true) 경로에서 EngineHost.ensureStarted()를 먼저 요구한다. #702에 있던 WebView ProxyController/authentication/Browser route 및 일부 transfer rollback/status 경로가 빠졌다. 대신 Media3 playback용 proxy accessor와 closed-proxy 동작이 추가돼 있다.

MaglevBrowserView에서도 #702의 ensureBrowserProxy 시작, proxy auth challenge 처리, MSE page note가 현재 head에서 빠져 있다.

**복구 결정**
- Browser 및 Download lifecycle을 #702 구조를 기준으로 복원한다.
- native tunnel start, local proxy listener, proxy authentication, peer handshake, real HTTPS egress를 각각 독립 상태로 측정한다.
- EngineHost.ensureStarted() 실패가 WG 터널 시작 자체를 선행 차단하지 않도록 lifecycle 경계를 분리한다. 단, 이 구조 차이는 원인 후보이지 Galaxy 오류의 확정 원인은 아니다.
- Browser와 downloader 각 network client에 route를 적용하고 client별 egress 증거를 만든다.
- proxy/tunnel에 고정된 작업은 자동 Direct fallback을 금지한다.
- App-local proxy는 system VPN 또는 모든 Android 앱 트래픽 라우팅이 아니다.
- Smart Connect OFF/AUTO/ALWAYS는 실제 터널 엔진과 분리된 NetworkPolicyResolver 정책으로 관리한다.

### 3.3 PiP / Media3 — 후속 개선은 선별, 새 Player는 보류

#702 Browser PiP는 현재 HTML video fullscreen custom surface, aspect ratio 및 Android PiP 전환 경로를 보유했다. #703~#705 후속 변경에는 WebView가 fullscreen custom view를 실제 attach했는지, Android가 PiP 전환을 허용했는지 확인한 뒤 성공을 보고하는 handshake 보강이 있다. 이 작은 개선은 회귀 테스트와 함께 선별 보존할 가치가 있다.

다만 11월 27일 기기 녹화 및 Issue #8에는 PiP 창이 검게 표시되거나 실제 영상 표면이 올바르게 배치되지 않는 문제가 기록돼 있다. fullscreen callback이 발생했다는 이유만으로 PiP 합격 처리하지 않는다.

PR #1에서 새로 추가된 MaglevMediaPlayerActivity는 Activity 단위 ExoPlayer prototype이다. 현재 소스에서 독립적인 MediaSessionService 기반 background playback이 완성됐다고 볼 증거는 없다. 이 Activity prototype을 완성된 playback platform으로 승격하지 않는다.

**복구 결정**
- Browser HTML video PiP와 앱 내 Media3 player PiP를 완전히 분리해 시험한다.
- Browser PiP는 선택된 실제 재생 video surface, custom view attach/layout, Android PiP accepted state, 회전, background/foreground, 복귀를 확인한다.
- Media3는 Local file → Direct MP4 → HLS/DASH 순서로 검증하고, 백그라운드는 MediaSessionService로 Activity와 분리한다.
- 영상 표면이 실제로 유지되지 않으면 PiP 성공을 표시하지 않는다.
- Browser playback과 별도 Media3 Player 전환은 명확한 사용자 동작으로 분리한다.

### 3.4 YouTube / format selector / audio — UI 개선 후보, 전송 재검증

#702 소스에는 NewPipe fast extraction과 yt-dlp fallback, format metadata, video/audio format selection, bitrate, output container, DASH audio track 및 mux 경로가 있다. 현재 PR #1 head에서도 YoutubeDownload.kt 및 NewPipeYoutube.kt의 blob은 #702와 동일했다. 즉, 현재 native YouTube download core가 #702 이후 본질적으로 개선됐다고 볼 수 없다.

현재 app/youtube-download.tsx에는 provider dedupe/format filtering 이후 선택된 format이 목록에서 사라지면 첫 유효 항목을 선택하는 reconciliation 로직이 추가돼 있다. 이는 UI 선택 상태 문제를 줄이는 후보로 보존하되, actual transfer/device test를 거쳐 채택한다.

11월 26일 화면 녹화에는 video format list와 audio-only bitrate 선택 UI, 한 작업의 100% 완료 화면이 보인다. 같은 녹화에는 링크 만료 또는 사이트 거부로 보이는 실패도 있다. exact APK hash와 연결되지 않으며 100%는 codec/container/duration/playability 검증이 아니다.

**복구 결정**
- YouTube share/paste → metadata → full format list → user selection → download → mux/convert → saved file inspection → playback 순서로 검증한다.
- Video-only DASH는 오디오 트랙 선택과 mux를 확인한다.
- Audio-only 선택은 결과 파일에 실제 audio stream만 포함됐는지 확인한다.
- 사용자가 선택한 최대 bitrate를 넘는 audio stream으로 묵시적 fallback하지 않는다.
- NewPipe와 yt-dlp는 provider별로 유지하되 metadata/format schema는 공통 normalize한다.
- YTDLnis와 같은 URL, 같은 네트워크, 같은 포맷으로 분석 시간, 첫 바이트, 평균 throughput, 전체 소요 시간, 실패율을 측정한다. 화면 로딩 속도와 파일 전송 속도를 구분한다.
- 확장자와 실제 container/codec이 일치하는지 inspect하고 변환 실패 시 원본을 보존한다.

### 3.5 Blob / DRM 경계

- Blob URL 관찰은 다운로드 가능한 원본 데이터 확보를 의미하지 않는다.
- MSE observer는 segment capture가 아니다.
- EME/DRM 보호 콘텐츠는 감지·진단만 한다. DRM bypass/decryption은 범위 밖이다.
- 실제 MSE 저장은 byte capture부터 재생 가능한 최종 결과물 검증까지 전체 gate 통과 후 별도 기능으로 표시한다.

---

## 4. 기능별 결정: 보존 / 복구 / 보류

| 영역 | 결정 | 기준 |
|---|---|---|
| Maglev app shell/navigation | 보존 | 기존 navigation, history, tabs, share 회귀 테스트 |
| Torrent/magnet | 보존 | 기존 native engine, transfer lifecycle, DB 보존 |
| Direct download | 보존 후 보수 | Range/ETag/Last-Modified, retry, process restart 검증 |
| HLS/DASH | 보존 후 비교 | Maglev와 Media3 fixture/device 결과로 protocol별 primary 1개 선택 |
| YouTube format/audio UI | 보존·수정 | provider identity, format 선택 안정성, 결과 파일과 선택값 일치 |
| NewPipe | 후보 유지 | YouTube fast provider, 실패 시 yt-dlp fallback 검증 |
| yt-dlp runtime | Adapter 격리 | exact version, ABI, process lifecycle, package update/rollback |
| Browser DOM/resource discovery | 복구·개선 | PageScan + FoundClassifier + confidence/provenance |
| MSE/Blob | Observer 복구 / byte capture 보류 | 감지와 실제 저장을 분리 표시 |
| Native Media3 Activity prototype | 보류 | Local/direct playback 우선 검증, MediaSessionService 설계 뒤 통합 |
| Browser PiP | 선택 보존·실기기 재검증 | 실제 video surface + Android PiP accepted handshake |
| App-local WireGuard | lifecycle 복구 | #702 Browser proxy/auth/rollback/peer status 기준 |
| Smart Connect | policy module 분리 | OFF/AUTO/ALWAYS, site rules, DNS, priority, fail-closed |
| Korean UI/branding | P0 | Settings, dialogs, errors, loading, empty, notifications 전체 |
| Barrel/LJ/MPMux references | 요구사항만 활용 | APK static evidence나 공개 설명을 구현 완료 근거로 사용 금지 |
| Release/update | 마지막 | exact commit, signed artifact, hash, Galaxy acceptance |

---

## 5. 최종 목표 아키텍처

~~~text
Share / URL / Browser / File / Magnet
                |
             MediaIntake
                |
       MediaDiscovery Providers
 DOM / MIME / Resource / Manifest / Extractor
                |
      Candidate Merge + Confidence
                |
       Capability Registry / Router
       |          |          |          |
     Direct     HLS/DASH   Extractor   Torrent
       |          |          |          |
       +----------+----------+----------+
                          |
              Unified Task Orchestrator
                 Task DB + Snapshots
                          |
                 Transfer Scheduler
                          |
          NetworkPolicyResolver / ClientFactory
          Direct / External Proxy / App-local WG
                          |
          Transfer → Validate → Process/Mux
                          |
                 Atomic Storage Commit
                          |
                  Library / Playback
                          |
             MediaSessionService / Media3 / PiP

 Browser HTML video PiP = separate browser lifecycle
 App-local WG engine/profile/proxy = separate network subsystem
 Upstream/runtime package monitor = release promotion과 분리
~~~

### 아키텍처 불변 규칙

1. UI는 엔진별 구현을 직접 소유하지 않는다.
2. 모든 입력은 MediaIntake를 통과하며 다운로드 실행은 Unified Task Manager를 통해서만 시작한다.
3. Discovery candidate와 transfer task를 구분한다.
4. HLS/DASH parser는 protocol-specific, scheduler/storage/recovery만 실제 공통 동작으로 공유한다.
5. 하나의 Task Orchestrator만 task status의 진실 공급원이다.
6. Playback lifecycle과 Download lifecycle을 분리하되 media/task metadata를 공유한다.
7. Network route는 engine/client별로 명시한다. listener ready, handshake, egress verified는 별도 상태다.
8. 새 runtime/package는 staged install, hash/signature, smoke test, rollback을 갖춘다.
9. DRM 보호 콘텐츠를 우회하지 않는다.

---

## 6. 단계별 재개 계획 및 gate

### R0 — Baseline freeze / 감사 (BLOCKER, 진행 중)

- [x] 사용자 제공 #702 APK hash, package, version 식별.
- [x] #702 Actions의 개별 job과 artifact 생성 확인.
- [x] #702 기준 recovery branch가 source 변경 없이 문서만 추가했는지 확인.
- [x] main/dev, 주요 branch, PR #1/#7/#9, Issue #8, Actions #739 상태 확인.
- [x] #702와 PR #1 head의 PageScan / FoundClassifier / MaglevBrowserView / WireGuardController 비교.
- [x] #702 → #707 source diff 범위 확인.
- [ ] PR #1 전체 230개 파일을 기능별로 분류하고 보존/복구/보류/폐기 후보 기록.
- [ ] workflow별 실행 job과 skip된 job을 기능 gate에 매핑.
- [ ] #702 baseline test corpus 및 Galaxy device evidence를 exact APK hash에 연결.

**R0 gate:** 파일·기능·테스트·실기기 증거가 연결된 baseline matrix 완성 전 앱 기능 코딩 금지.

### R1 — Maglev Core Regression Lock

- 기존 app shell, browser tabs/history/share, Torrent, Direct, HLS/DASH, Transfers, notification, storage를 golden test로 고정한다.
- Task DB schema 및 resume snapshot을 조사하고 불필요한 migration을 금지한다.
- emulator install → launch → permission → core navigation → torrent/direct smoke를 CI에 포함한다.
- 기존 기능을 대체하는 변경은 기존/신규 구현을 나란히 테스트한다.

**R1 gate:** 새 APK에서 기존 핵심 흐름 통과, 기능 축소·삭제 회귀 0건.

### R2 — Native Engine / Direct Transfer

- EngineHost/JNI load/Rust init/config/session start/proxy init을 분리해서 진단한다.
- 일반적인 “Engine call failed” 대신 sanitized cause/code를 제공한다.
- direct file, redirects, query URL, Range 지원/미지원, ETag 변경, pause/resume, retry, process kill, restart, storage permission을 테스트한다.
- container signature, stream type, duration, size, checksum 확인 후 완료 처리한다.

**R2 gate:** Galaxy에서 Direct file 저장·중단 복구·재생까지 성공.

### R3 — YouTube / Extractor Runtime

- youtu.be, watch, shorts, live, playlist 및 ACTION_SEND/ACTION_VIEW 공유 입력 fixture.
- NewPipe와 yt-dlp provider를 공통 metadata/format schema로 normalize.
- provider identity 포함 format ID, dedupe, format selection 검증.
- video/audio-only, bitrate ceiling, DASH audio mux, playlist, expired signed URL refresh 테스트.
- FFmpeg/MediaMuxer output과 child-process cancellation/rollback 검증.
- YTDLnis와 동일 URL·포맷 기준 throughput/latency 측정.

**R3 gate:** Galaxy에서 share → metadata → format select → transfer → correct output → playback가 video/audio-only 각각 PASS.

### R4 — Browser Discovery / HLS / DASH

- HTMLMediaElement, DOM mutation, resource observer, response MIME, manifest probe를 분리한다.
- candidate별 source, MIME, dimensions, duration, confidence, downloadability를 관리한다.
- tracking/qoe/ads/telemetry와 실제 media를 구분한다.
- HLS master/media playlist와 DASH MPD를 각각 fixture test하고 variant/track selection, segment resume, mux를 검증한다.
- MSE/Blob은 observer 상태로만 표시한다. byte capture가 없으면 다운로드 가능한 후보로 노출하지 않는다.

**R4 gate:** false-positive/precision/recall corpus report와 Galaxy 저장 파일 검증. MSE는 별도 gate 전에 지원 표시 금지.

### R5 — Media Processing / Playback / PiP

- Local file → Direct MP4 → HLS/DASH 순서로 playback.
- MediaSessionService를 통해 Activity와 독립적인 Player lifecycle, notification/lockscreen/Bluetooth controls, audio focus, resume position.
- PiP 영상 프레임과 오디오 연속성 검증.
- portrait/landscape, home/recents, screen lock, orientation, PiP exit/re-entry, Activity recreation, playback error, concurrent download.
- Download-while-play는 verified byte ranges 또는 동일 HLS/DASH segment cache일 때만 공유한다.

**R5 gate:** Galaxy에서 올바른 video surface/audio 유지, PiP/복귀/백그라운드 lifecycle PASS. 검은 화면 또는 chrome만 표시되면 FAIL.

### R6 — App-local WireGuard / Smart Connect

- Strict .conf parser, supported fields, AndroidKeyStore AES-GCM encrypted noBackup storage.
- Tunnel start, proxy listener, authentication, handshake, transfer, egress를 분리 검증.
- #702 WebView ProxyController/auth challenge와 downloader client proxy를 각각 검증.
- OkHttp/Rust/Media3/extractor/WebView/FFmpeg/Torrent client coverage table.
- OFF/AUTO/ALWAYS와 site rules, priority, profile selection, DNS/bootstrap, fail-closed를 policy resolver에서 처리.
- Browser/download/player/image fetch 등에 실제 HTTPS egress 확인.
- UDP/QUIC/DHT/native socket은 검증 전까지 NOT TESTED/UNSUPPORTED 명시.
- Process restart, network switch, DNS changes, peer disconnect, profile deletion/re-import, proxy rollback 테스트.

**R6 gate:** client별 real egress proof. local listener readiness 또는 handshake만으로 연결 성공 처리 금지.

### R7 — Korean-first UX / branding

- Navigation, settings, menu, candidate, dialogs, buttons, errors, empty states, download states, notifications, playback/PiP, Smart Connect 사용자 표시 문자열 전수 조사.
- raw native error는 접을 수 있는 기술 상세로 제공하고 기본 오류는 실행 가능한 한국어로 표시.
- app name/icon/branding/package identity 검사.
- Korean wrapping, small screen, accessibility labels, contrast, loading/error state screenshot test.

**R7 gate:** 일반 사용자 UI의 미번역 문자열 0건(기술 identifier와 사용자 입력은 제외).

### R8 — Release Acceptance

- exact commit SHA, workflow run ID, artifact ID, APK SHA-256, package/version/versionCode, ABI, signature, native payload, file size를 release manifest로 기록.
- clean source/provenance, SBOM, GPL-3.0 notices/source obligations 확인.
- 필수 job executed/pass 여부 확인. 필수 skip은 PASS로 계산 금지.
- emulator 및 Galaxy E2E를 같은 APK hash에 연결.
- Maglev regression, YouTube video/audio, Direct/Range/Resume, HLS/DASH, Browser discovery, PiP/MediaSession, WireGuard routes, Korean UI를 release checklist로 고정.

**R8 gate:** CI + artifact identity + Galaxy acceptance가 동일 commit/APK에 연결된 경우에만 release candidate.

---

## 7. CI 및 branch 통제

### Branch policy

- main: upstream Maglev baseline 보존.
- dev: upstream/base tracking 또는 별도 승인된 integration 기준.
- recovery/2026-11-28-user-baseline-702: #702 기반 감사·설계 전용 branch.
- 실제 구현은 R0/R1과 ADR 승인 후 #702 기반 scoped branch에서 시작한다.
- PR #1은 Draft/review hold로 유지하고 파일·기능별로 선별한다. main/dev에 merge하지 않는다.
- 기존 branch/PR/history/artifacts/tags/workflows를 삭제하거나 force-push하지 않는다.
- PR 하나는 하나의 gate에 집중한다.

### Required CI stages

1. TypeScript, typecheck, JS/unit/contract.
2. Rust core 및 WireGuard tests.
3. Kotlin/native tests, JNI load, ABI validation.
4. ARM64 native build.
5. Android Gradle APK build, package/version checks.
6. APK archive integrity, signing verification, hash/ABI report.
7. Emulator install, launch, critical smoke.
8. Artifact upload, evidence manifest.

필수 job이 skip되면 gate 미통과다. APK build job이 skip되면 빌드 완료로 보고하지 않는다. Emulator smoke는 Galaxy acceptance를 대체하지 않는다.

---

## 8. 즉시 실행할 작업 순서

1. #702 APK/source commit/hash를 immutable baseline으로 유지한다.
2. PR #1 230-file inventory를 파일별·기능별로 분류한다. 이 단계에서는 delete/merge/rebase 금지.
3. R1 golden tests를 먼저 만들고 기존 Maglev baseline을 검증한다.
4. Native engine startup 및 Direct transfer를 안정화하고 Galaxy에서 원인을 재현한다.
5. YouTube format/audio native output을 검증하고 YTDLnis 대비 throughput을 계측한다.
6. Browser detector false positives를 줄이고 HLS/DASH를 각각 안정화한다.
7. Browser PiP와 Media3 Player를 별도 경로로 수용하고 MediaSessionService를 완성한다.
8. 마지막으로 Browser/Downloader client별 WireGuard routing과 Smart Connect policy를 통합한다.
9. 한국어 UI와 기존 기능 회귀를 확인하고 동일 APK hash로 release acceptance를 수행한다.

이 순서는 기능 폭을 줄이려는 것이 아니라, 각 기능이 다른 기능의 장애 원인이 되지 않게 통합 순서를 통제하기 위한 것이다.

---

## 9. 최종 제품 수용 조건

최종 앱은 Galaxy에서 아래 흐름을 재현해야 한다.

- Browser 또는 외부 앱 Share → URL 식별 → candidate/metadata → engine route → format/track 선택 → download → file validation → library → playback.
- YouTube video/audio-only/playlist에서 선택 품질·코덱·컨테이너와 저장 파일이 일치.
- Direct file의 Range/Resume/Retry/reboot recovery 및 output integrity.
- HLS/DASH VOD variant/track selection, segment resume, mux 및 playable output.
- Browser discovery가 실제 media와 tracking/telemetry/ads를 구분.
- PiP가 실제 video surface와 audio를 유지하며 복귀가 정상.
- Background playback은 MediaSession lifecycle로 Activity 종료와 분리.
- WireGuard policies가 해당 Browser/Downloader/Player client에 적용되고 route 실패 시 Direct leak이 없음.
- 한국어 UX와 Torrent/Direct/Browser/Storage regression pass.
- 테스트한 exact APK hash와 배포 APK hash 일치.

---

## 10. 금지 사항 및 현재 진행 경계

- #702 APK, source commit, hash를 덮어쓰거나 새 빌드 결과로 대체하지 않는다.
- CI 녹색만으로 기능 완료 또는 Release 승격을 하지 않는다.
- MSE detected, blob seen, proxy listener ready, handshake initiated, PiP Activity opened를 기능 완료로 표시하지 않는다.
- baseline test 없이 기존 기능을 삭제하거나 대체하지 않는다.
- 모든 network client가 WireGuard route를 사용한다고 가정하지 않는다.
- 사용자가 선택한 format과 다른 결과로 조용히 fallback하지 않는다.
- 무검증 최신 dependency/runtime을 도입하지 않는다.
- APK 정적 분석의 class/string 흔적을 실제 기능 동작 증거로 과장하지 않는다.
- DRM 우회는 구현하지 않는다.

현재 완료된 것은 #702 artifact identity/CI job 확인, recovery branch source 미변경 확인, 주요 후속 파일의 source-level regression 비교, 기능별 설계 및 gate 정리다.

아직 완료되지 않은 것은 PR #1 전체 230파일의 파일별 분류, R1 golden test 구현/실행, emulator 및 Galaxy 테스트, #702 기능의 전체 실기기 합격, 최종 APK 제작 및 Release다. **이 문서는 앱 완성 선언이 아니라, 다음 개발이 다시 기능을 퇴보시키지 않도록 하는 실행 기준이다.**
