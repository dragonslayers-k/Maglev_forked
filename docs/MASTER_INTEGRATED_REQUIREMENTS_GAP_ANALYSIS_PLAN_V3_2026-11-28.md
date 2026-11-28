# 통합 미디어 다운로더 마스터 통합 요구사항 · 코드 현황 · Gap 분석 · 수정 개발계획

- 문서 버전: **V3 / 2026-11-28**
- 저장소: `dragonslayers-k/Maglev_forked`
- 안전 기준선: `recovery/2026-11-28-user-baseline-702` / commit `45e685603a3a23507b61cb49398a78380d5db7a5`
- 목적: Maglev, YTDLnis, LJ Video Downloader, MPMux, Barrel 1.1.2, Morphe/BitChord Android의 핵심 역량을 **하나의 Maglev 기반 Android 미디어 앱**으로 통합하기 위한 단일 개발 기준
- 문서 상태: 소스·문서 정적 조사 결과를 반영한 설계/감사 기준. 이 문서 작성으로 GitHub 코드가 변경되거나 APK가 새로 검증된 것은 아님.

> **이번 V3에서 바로잡은 사항**  
> 이전 정정 문서는 제품 원천별 우선순위를 바로잡는 데 집중했으며, Barrel Smart Connect 별도 명세, 브라우저 페이지별 상세 설정, 광고 필터 엔진의 실질적 한계, MediaSession 기반 백그라운드 재생, 한국어 자막 공급망, 현재 저장소의 기존 부분 구현과 잘못된 이식 상태를 충분히 묶지 못했다. V3는 이 항목들을 별도 기능군으로 추가하고, 각각 원천 근거 → 현재 소스 경로 → 상태 → 수정 설계 → 완료 판정으로 연결한다.

---

# 1. 제품 목표와 절대 원칙

## 1.1 최종 제품

최종 결과물은 여러 앱을 병렬로 붙인 앱이 아니다. **Maglev를 단일 제품의 UI/UX와 실행 기반으로 삼고, 나머지 원천의 강한 기능을 전용 엔진/어댑터로 이식한 하나의 Android 앱**이다.

- 앱의 외형·Navigation·Browser·Transfers·Settings·Storage·Notification·Player는 Maglev 디자인 시스템을 따른다.
- YouTube와 yt-dlp 지원 사이트의 추출·포맷 선택·다운로드 실행은 YTDLnis/yt-dlp를 주력 기준으로 한다.
- 브라우저 미디어 탐지·요청 컨텍스트 수집은 LJ 계열 설계를 적용한다.
- HLS Live 녹화와 MSE 실제 바이트 수집은 MPMux의 기능 구조를 기준으로 신규 구현한다.
- Direct Range·분할·이어받기·HLS/DASH VOD 신뢰성은 Barrel 분석 자료를 참고하되 Maglev 기존 엔진을 우선 재사용한다.
- 네트워크 우회 정책은 Barrel Smart Connect 분석을 반영하고, 실제 transport는 별도 Proxy/WireGuard/DNS 모듈이 담당한다.
- 앱 내부 WireGuard는 Morphe/BitChord Android의 userspace 구성과 fail-closed 원칙을 참고한다.

## 1.2 원천별 책임 고정표

| 원천 | 통합 앱에서 맡는 책임 | 가져오면 안 되는 방식 |
|---|---|---|
| **Maglev** | 단일 앱의 기반, UI/UX, Browser, Transfers, 저장·알림, 기존 Torrent/Direct/HLS/DASH 엔진 | Maglev UI를 버리고 다른 앱 UI를 따로 붙이는 방식 |
| **YTDLnis** | YouTube/yt-dlp 주력 실행 파이프라인, 런타임 관리, 전체 포맷 정보, 선택·필터·정렬, Playlist/Batch, 큐·Worker·재시도·후처리 | 포맷 선택 화면만 참고하거나 NewPipe를 주력으로 두는 방식 |
| **LJ Video Downloader** | WebView/페이지/네트워크에서 실제 미디어 URL과 요청 컨텍스트를 찾는 탐지 계층 | URL 문자열만 넘기고 Cookie/Referer/UA/Range 등 요청 조건을 버리는 방식 |
| **MPMux** | HLS Live 녹화, MSE SourceBuffer 실제 비보호 데이터 수집과 재구성 | MSE 사용 여부만 감지하고 캡처가 된 것처럼 표시하는 방식 |
| **Barrel 1.1.2** | Range Resume, 분할 다운로드, Manifest/Segment Resume, 병합·검증의 신뢰성 기준, 브라우저 설정, 미디어를 재생하며 다운로드 기능 | 이미 있는 Maglev 다운로드 엔진을 복제하는 방식 |
| **Barrel Smart Connect 명세** | OFF/AUTO/ALWAYS, DNS/Proxy/Site Rule, 실패 분류와 정책 우선순위 설계 참고 | Smart Connect를 WireGuard·Proxy·DNS 자체로 오해하는 방식 |
| **Morphe / BitChord Android** | wireguard-go + userspace netstack + 인증된 loopback proxy, 암호화 프로필, route 적용, fail-closed | 시스템 VPN처럼 모든 앱 트래픽을 자동 터널링한다고 주장하는 방식 |

## 1.3 불변 개발 원칙

1. 기준선 `#702`는 보호한다. 기준선 변경 전 파일별 diff와 회귀 테스트가 있어야 한다.
2. PR #1 또는 PR #10의 변경을 통째로 합치지 않는다. 파일별로 채택/수정/보류/폐기를 판단한다.
3. 기능이 이미 존재하면 우선 정상 동작을 복구하고 테스트를 보강한다. 대체 구현은 기존 기능을 제거하지 않는다는 증거가 있을 때만 적용한다.
4. 화면에 버튼이 있다는 것과 기능이 작동한다는 것을 구분한다.
5. CI 성공은 코드/빌드 검증이다. Galaxy 실기기 성공과 동일하게 표시하지 않는다.
6. 네트워크 route는 클라이언트별로 연결한다. 하나의 프록시 상태값만으로 앱 전체 트래픽이 터널링된다고 간주하지 않는다.
7. Cookies, Authorization, Proxy password, 서명 URL, 민감 헤더는 로그·진단 보고서에서 마스킹한다.

---

# 2. 현재 저장소 상태와 판단 기준

## 2.1 확인한 Git 기준선 및 개발 후보

| 항목 | 확인 상태 | 취급 원칙 |
|---|---|---|
| 기준선 #702 | commit `45e685603a3a23507b61cb49398a78380d5db7a5` | 변경 전 기준으로 고정. 이번 분석의 소스 해시 대조점 |
| PR #1 `feature/p1-video-detection-observer` | Draft, 대규모 변경 트랙(이전 점검 당시 232개 파일) | 통합 승인된 구현으로 취급 금지. 파일 단위 평가만 가능 |
| PR #10 `recovery/youtube-selection-reconcile-ci` | Draft, #702 복구 기준의 YouTube/브라우저 관련 후보(이전 점검 당시 26개 파일) | #702와 별도 후보. Galaxy 검증 전 릴리즈 금지 |
| CI 산출물 | 빌드/정적 테스트 결과가 존재 | 실기기 승인 증거로 간주 금지 |

**주의:** 위 PR 파일 수와 상태는 2026-11-28 조사 시점의 기록이다. 이후 GitHub 상태가 바뀌었는지는 별도로 확인해야 한다. 이 문서는 GitHub에 커밋·머지·릴리즈를 수행하지 않았다.

## 2.2 상태 용어

- **존재**: 해당 기능의 코드와 호출 경로가 기준선 소스에서 확인됨.
- **부분 구현**: 기능의 일부 또는 UI만 있으며 전체 요구를 충족하지 않음.
- **잘못된 우선순위/이식**: 구성요소는 있지만 제품에서 맡아야 할 책임과 다른 방식으로 연결됨.
- **미구현**: 기준선에서 실질적인 처리 경로를 확인하지 못함.
- **기기 검증 필요**: 코드상 경로가 존재하나 실제 Galaxy에서 동작/호환성이 확인되지 않음.
- **미확인**: 현재 확인한 파일만으로 결론을 확정할 수 없음.

---

# 3. 통합 앱의 목표 아키텍처

```text
Share Intent / Browser URL / Clipboard / Manual URL / File
                         │
                         ▼
              Media Intake & URL Classifier
                         │
            ┌────────────┴─────────────┐
            ▼                          ▼
      Browser Page Context       Source / Format Resolver
      URL, UA, Referer,          ├─ YTDLnis-compatible yt-dlp (PRIMARY)
      Cookie ref, Origin,        ├─ NewPipe (secondary/fallback)
      Range, MIME, status        ├─ LJ media request detector
            │                    ├─ HLS/DASH parser
            │                    └─ MPMux Live/MSE detector+capture
            └────────────┬─────────────┘
                         ▼
              Unified Media Task Model
                         │
             ┌───────────┴────────────┐
             ▼                        ▼
       Network Policy          Engine Registry
       & Route Resolver        ├─ yt-dlp Worker
       ├─ Direct                ├─ Rust Direct/HLS/DASH
       ├─ Smart Connect         ├─ Torrent
       ├─ HTTP/SOCKS             └─ MPMux recorder
       ├─ App WireGuard                │
       └─ DNS                          ▼
                               Unified Transfers Queue
                         Pause / Resume / Retry / Cancel
                         Progress / Notifications / Logs
                                      │
                                      ▼
                           Verify → Mux → Subtitle attach
                                      │
                                      ▼
                              Storage / Media Library
                                      │
                         Browser Player / Media3 Player
                           Inline / Fullscreen / PiP
                           Background / MediaSession
```

## 3.1 공통 Task 모델

모든 엔진이 내부적으로 자기 Resume 상태를 가질 수 있지만 사용자 화면은 하나여야 한다.

```kotlin
data class MediaTask(
    val taskId: String,
    val sourceId: String,
    val engineId: String,
    val engineTaskId: String?,
    val sourceUrl: String,
    val pageContextId: String?,
    val title: String?,
    val selectedFormatId: String?,
    val outputUri: String?,
    val state: TaskState,
    val bytesDone: Long,
    val bytesTotal: Long?,
    val speedBytesPerSec: Long,
    val createdAt: Long,
    val updatedAt: Long
)
```

공통 상태 최소값: `RESOLVING`, `QUEUED`, `RUNNING`, `PAUSING`, `PAUSED`, `RETRY_WAIT`, `VERIFYING`, `MUXING`, `COMPLETED`, `FAILED`, `CANCELED`.

공통 제어는 `pause/resume/retry/cancel`을 제공한다. 다만 개별 엔진이 지원하지 않는 제어는 지원하는 척하지 않고 UI에 이유를 표시한다. 예를 들어 MSE Live 세션이 이미 지나간 Segment를 서버에서 회수할 수 없는 경우에는 과거 구간 재개를 보장하지 않는다.

## 3.2 요청 컨텍스트 모델

미디어 요청을 감지했을 때 URL 외에 아래 정보를 함께 보존한다.

- page URL / page origin / top-level site
- HTTP method / request URL / response URL
- User-Agent / Referer / Origin
- Cookie는 원문을 일반 DB/로그에 넣지 않고 암호화된 세션 참조로 저장
- 필요한 custom headers 및 authorization의 secure reference
- Range / If-Range / Accept / Accept-Language
- response status / MIME / Content-Length / Content-Range / ETag / Last-Modified
- redirect chain, detection method, confidence, detected timestamp
- 해당 사이트에 적용할 Browser Site Rule 및 Network Route profile

요청 컨텍스트가 만료된 경우(로그인 세션 만료, 서명 URL 만료 등) 원본 페이지/추출기로 다시 얻을 수 있도록 한다. 만료된 헤더를 무한 재사용하지 않는다.

---

# 4. 브라우저: 제품의 핵심 기능으로 확장

브라우저는 URL 입력창만 제공하는 부속 기능이 아니다. 사용자가 영상을 찾고, 재생하고, 감지하고, 다운로드하고, 페이지 동작을 조절하는 핵심 진입점이다.

## 4.1 현재 이미 존재하는 Maglev Browser UI

기준선에서 다음 화면/컴포넌트가 확인된다.

- `app/browser.tsx`: 주소창, 탭, WebView, 페이지 이벤트, 미디어 발견 tray, 메뉴와 각종 상태 연결.
- `components/browser/StartPage.tsx`: 시작 화면.
- `TabSwitcher.tsx`: 전체 탭 목록/새 탭/탭 닫기/모두 닫기.
- `LinkMenu.tsx`: 새 탭/백그라운드 탭/복사/공유/다운로드/토렌트 추가.
- `MediaMenu.tsx`: 이미지·영상 저장, 재생, HLS/DASH 스트림 다운로드, 새 탭/복사/공유.
- `FoundTray.tsx`, `FoundDownload.tsx`, `StreamSheet.tsx`, `BatchSheet.tsx`: 발견 미디어·다운로드·일괄 처리 UI.
- `BookmarkSheet.tsx`, `HistorySuggestions.tsx`, `FindBar.tsx`, `TextSizeSheet.tsx`, `PopupCard.tsx`, `ClearHistorySheet.tsx` 등.

**판단:** 브라우저 UI를 새로 만들거나 다른 앱의 외형으로 교체하면 안 된다. 기존 Maglev 흐름을 유지하면서 페이지별 설정과 부족한 사이트 컨트롤을 확장한다.

## 4.2 전역 Browser 설정 중 이미 존재하는 것

`app/settings/browser.tsx`, `utils/prefs/browser.ts` 기준:

| 설정 | 현재 확인 상태 | 다음 조치 |
|---|---|---|
| 광고 차단 On/Off | 존재 | 필터 소스/유형별 제어로 확장 |
| Blocklist 주소 추가/삭제/업데이트 | 존재 | 리스트 유형, 버전, 실패/롤백, 규칙 카운트 강화 |
| 사이트별 광고 허용목록 | 존재 | 현재 사이트 빠른 예외/예외 만료/예외 이유 추가 |
| Popup Ask/Block/Allow | 존재 | redirect와 새 창 구분, 사이트별 정책 확장 |
| 검색엔진 DDG/Google/Bing/Brave | 존재 | 사용자 검색엔진 URL 템플릿 추가 |
| 탭 스와이프 | 존재 | 동작/민감도 옵션 검토 |
| 다크 페이지 | 존재 | 사이트별 예외, 색상 강제 여부 및 미디어 색상 보존 |
| 데스크톱 모드 | 존재 | UA 프로필 선택과 사이트별 override 추가 |
| 텍스트 확대 | 존재 | 페이지 확대/텍스트 전용 확대 분리 검토 |
| 시크릿 모드 | 부분 | 별도 Cookie/Storage partition 보장 여부 점검 |
| 기록/기록 제안/종료 시 삭제 | 존재 | 시크릿 탭과 일반 탭 저장 경계 테스트 |
| 북마크/기록/브라우징 데이터 삭제 | 존재 | Export/Import·검색·폴더/태그 확장 검토 |

이 목록이 있다는 사실만으로 모든 설정이 Android WebView에 정확히 반영된다고 보장하지 않는다. UI 값 → React prop → Native WebView 설정/콜백 → 실제 페이지 변화까지 확인해야 한다.

## 4.3 페이지별 상세 설정 (신규 P1 요구사항)

전역 설정과 별도로 현재 호스트에만 적용되는 **Site Settings / Page Controls**를 제공한다. 브라우저 주소창의 사이트 아이콘 또는 페이지 메뉴에서 한 번의 조작으로 열 수 있어야 한다.

| 영역 | 상세 옵션 | 기본 정책 |
|---|---|---|
| 페이지 동작 | JavaScript, 팝업, 자동 리디렉션, 새 창, 자동 새로고침 | JavaScript는 기본 허용이 일반적이나, 사이트별 차단 가능. 위험 권한은 묻기 |
| 개인정보 | 제3자 쿠키, 추적기 차단, 쿠키/사이트 데이터 삭제, 저장소 허용 | 최소 권한. 제3자 쿠키는 전역 무조건 허용 금지 |
| 광고/필터 | 광고 차단, 트래커 차단, 성가신 요소 차단, 언어 필터, 사용자 규칙, 사이트 예외 | 전역 규칙을 상속하고 사이트별 override 허용 |
| 미디어 | 자동재생, 인라인 재생, 전체화면, 백그라운드 오디오, PiP 허용, 음소거 자동재생 | 사용자가 명시한 정책을 우선 |
| 호환성 | UA 프로필(Default/Android/Desktop/iOS/Custom), 데스크톱 사이트, User-Agent 문자열 | 사이트별 저장 가능 |
| 표시 | 페이지 확대, 텍스트 크기, 다크 모드, 이미지 표시, 글꼴/가독성 | 사이트별 설정 가능 |
| 권한 | 카메라, 마이크, 위치, 알림, 파일 업로드 | 현재는 일부 권한을 무조건 거부하는 상태이므로 Ask/Allow once/Allow on site/Block 제공 검토 |
| 다운로드 | 저장 위치, 파일명 템플릿, 미디어 자동 감지, 파일 형식 제외 | 사이트별 다운로드 규칙 적용 |
| 요청 헤더 | Referer, Origin, User-Agent, 사용자 지정 Header | 해당 Host로만 전송, 민감 Header는 암호화/마스킹 |
| 연결 | Smart Connect override, Proxy profile, DNS profile, WireGuard route | Network Policy Resolver를 통해 적용 |
| 사이트 데이터 | 쿠키 보기/삭제, 캐시 삭제, 권한 초기화, 페이지별 설정 초기화 | 현재 사이트 단위로 수행 |

### 페이지 메뉴 UX

```text
[사이트 아이콘]  사이트 정보 / 연결 상태
 ├─ 광고·추적기 차단 상태 / 이 사이트에서 끄기
 ├─ JavaScript / 쿠키 / 팝업 / 자동재생
 ├─ 데스크톱 보기 / User-Agent
 ├─ 페이지 확대 / 텍스트 크기 / 다크 페이지
 ├─ 카메라·마이크·위치·알림 권한
 ├─ Smart Connect / Proxy / DNS / WireGuard 경로
 ├─ 이 사이트의 쿠키·캐시 삭제
 └─ 사이트 설정 초기화
```

설정 우선순위는 `현재 요청에 한정된 사용자 동작 → 사이트별 명시 설정 → 전역 설정 → 기본값`으로 정의한다. 이는 통합 앱의 권장 정책이며 Barrel APK 내부 우선순위가 확인됐다는 뜻은 아니다.

## 4.4 브라우저 품질 기능 추가 후보

우선순위 높은 항목:

- 탭 그룹/고정 탭/백그라운드 탭/실수로 닫은 탭 복구.
- 사이트 정보/권한 센터, 페이지 내 찾기, URL 복사/공유, 이미지·링크 메뉴.
- 다운로드 tray 및 현재 페이지에서 감지한 미디어 후보의 상태 표시.
- 독자 모드(Reader), 페이지 번역, 페이지 저장/오프라인 읽기, 화면 캡처/긴 페이지 캡처.
- 사용자 검색엔진 추가 및 검색 별칭.
- 사이트별 다운로드 디렉터리/파일명 규칙.
- 사이트 설정 가져오기/내보내기 및 기본값 복구.

기능을 많이 넣되 브라우저 상단과 페이지 메뉴는 과밀하게 만들지 않는다. 자주 쓰는 동작은 주소창 주변의 짧은 메뉴에, 세부 옵션은 페이지 설정 시트의 그룹별 화면에 배치한다.

## 4.5 Browser의 현재 기술적 한계와 수정점

- `MaglevBrowserView.kt`는 Android WebView 기반이다. `shouldInterceptRequest`만으로 모든 웹 요청/응답 본문과 모든 redirect를 확보할 수 없다.
- `ServiceWorker` 요청은 별도 `ServiceWorkerClient` 경로가 필요하므로 일반 WebView callback과 같은 것으로 취급하지 않는다.
- JavaScript URL, `blob:` URL, 내부 자원은 일반 네트워크 URL처럼 가로챌 수 없다.
- 현재 `PageScan.kt`는 DOM, fetch/XHR 응답 메타데이터, Resource Timing 등 후보를 보고한다. 이는 사이트 요청의 모든 헤더/응답 본문을 캡처하는 완전한 LJ 구현과 같지 않다.
- 현재 권한 요청은 `onPermissionRequest`에서 거부되고 Geolocation도 거부된다. 사이트별 권한 UI를 추가하기 전까지 카메라/마이크/위치가 필요한 웹 기능은 제한된다.
- 현재 third-party cookie는 비활성화하는 경로가 확인된다. 로그인/임베디드 미디어가 깨질 수 있으므로 전역 허용으로 단순 해결하지 말고 사이트별 설정으로 제어한다.
- 시크릿 모드는 실제 별도 프로필/쿠키 저장소 분리인지 검증한다. 창 닫을 때 전체 CookieManager를 지우는 수준이면 일반 탭 세션까지 영향을 줄 수 있다.

---

# 5. 광고·추적기 차단: 단순 도메인 목록에서 필터 엔진으로

## 5.1 현재 구현 수준

기준선 `Blocklist.kt`의 parser 설명 및 코드에서 확인된 범위:

- `hosts` 형식: `0.0.0.0 domain`, `127.0.0.1 domain`.
- 단순 도메인 라인.
- 제한된 `||domain^` 규칙(경로/옵션이 없는 형태).
- Cosmetic rule과 path rule, 복잡한 옵션/modifier는 무시.
- `BlocklistStore.kt`는 내장 목록과 사용자 목록을 읽고 도메인 matcher를 갱신한다.
- `MaglevBrowserView.kt`에는 흔한 광고 컨테이너용 CSS와 YouTube 광고 화면을 숨기고 노출된 Skip 컨트롤을 누르는 보조 스크립트가 있다.

**현재 상태: 호스트 기반 차단 + 일부 cosmetic/YouTube 보조 처리. 완전한 Adblock Plus/uBlock Origin 필터 호환 엔진이 아니다.**

## 5.2 목표 필터 카테고리

| 카테고리 | 예시 원천 | 목적 | 적용 단계 |
|---|---|---|---|
| 광고 기본 | EasyList, AdGuard Base | 광고 요청/광고 도메인 차단 | P1 |
| 추적/분석 | EasyPrivacy, AdGuard Tracking Protection | Analytics, tracking pixel, telemetry | P1 |
| 성가신 요소 | Fanboy Annoyances, AdGuard Annoyances | 팝업/오버레이/쿠키 배너/소셜 위젯 | P2 |
| 언어/지역 | 신뢰 가능한 한국어 지역 목록 등 | 국내 광고·추적 도메인 보강 | P2, 목록 검증 후 |
| 사용자 규칙 | 사용자 추가/예외 규칙 | 개인 맞춤 차단/허용 | P1 |
| 악성/피싱 도메인 | 검증 가능한 threat list | 위험 도메인 탐색 차단 | P2, 오탐 관리 필요 |

목록을 많이 연결하는 것보다 각 목록의 라이선스, 갱신 주기, 규칙 형식, 유지보수 상태, 중복, 오탐률을 확인해야 한다.

## 5.3 필터 엔진 계층

1. **Network request filter**: Host/URL/Resource type/Party context/Initiator/Method 기준 차단.
2. **Cosmetic filter**: CSS selector 기반 요소 숨김. 사이트별 스타일 충돌 감지.
3. **Extended cosmetic subset**: 별도 파서와 allowlist로 검증한 확장 selector.
4. **Scriptlet/HTML filtering**: 보안·호환성 위험이 높으므로 초기에는 제한된 공식 규칙만 별도 검증 후 채택.
5. **Exception engine**: 전역/사이트별/일시 예외, 특정 리소스 허용, 차단 해제 이유.
6. **Diagnostics**: 차단 건수, 최근 차단 URL(민감 쿼리 마스킹), 적용 필터, 규칙 ID, 사이트 파손 신고.

### 최소 ABP 호환 단계

- 도메인 규칙과 `||host^`.
- URL/경로 패턴과 `*`, `^` 처리.
- `@@` 예외 규칙.
- Resource type (`script`, `image`, `media`, `stylesheet`, `font`, `xmlhttprequest` 등).
- Third-party/first-party context.
- Domain include/exclude 옵션.
- Cosmetic `##` 기본 규칙 및 도메인별 적용.
- Filter option 미지원 시 무시하는 대신 unsupported count/진단을 남긴다.

전체 uBO 스크립틀릿/확장 문법을 한 번에 지원한다고 약속하지 않는다. 파서 테스트에 통과한 문법만 지원 목록으로 공개한다.

## 5.4 필터 목록 관리 UI

- 권장 프리셋: 기본 광고 / 광고+추적 / 엄격 차단 / 사용자 지정.
- 개별 리스트 ON/OFF, 마지막 업데이트, 규칙 개수, 파일 크기, 오류·서명·체크섬 상태.
- 리스트 업데이트는 임시 파일로 받기 → 크기/형식 검증 → 파싱 → 최소 규칙 개수 확인 → 원자적 교체. 실패 시 마지막 정상본 유지.
- 사용자 지정 URL은 HTTPS만 허용하는 기본 방침 유지. 외부 주소/리다이렉트/대용량 파일 제한.
- 사이트별 `이 사이트에서 일시중지`, `이 페이지에서 요소 숨기기`, `차단 내역 보기` 제공.
- 차단 목록 업데이트만으로 브라우저 전체가 멈추지 않게 background parse/atomic swap 사용.

## 5.5 오탐·사이트 파손 대응

- 로그인, 결제, 동영상 플레이어, CAPTCHA, 다운로드 버튼이 깨지면 사이트별 예외를 쉽게 설정할 수 있어야 한다.
- 필터 원천·규칙 ID를 확인할 수 있어야 한다.
- 사이트에서 광고 차단 감지 경고가 뜨는 경우 무조건 모든 차단을 해제하지 않고 페이지 단위로 예외를 선택할 수 있게 한다.
- 광고 숨김 CSS가 실제 광고 네트워크 요청을 차단한 것처럼 잘못 표시되지 않게 Network block과 Cosmetic hide를 구분한다.
- YouTube 광고 DOM 조작은 사이트 UI 변경에 취약하므로 별도 호환 테스트와 on/off fallback을 둔다. 비건너뛰기 광고를 완전 제거한다고 표현하지 않는다.

---

# 6. 네트워크 기능과 Barrel Smart Connect 통합

## 6.1 현재 네트워크 설정에 이미 있는 것

`app/settings/network.tsx`, `app/settings/network-advanced.tsx`, `MaglevSettings.types.ts` 기준:

- Wi-Fi only, mobile data에서 seeding 제한, VPN only, SSID allowlist.
- Torrent listening port, UPnP, DHT, PEX, Local Peer Discovery.
- Torrent/웹 요청에 사용한다고 설명된 Proxy UI와 host/port/user/password 필드.
- IP filter 파일 지정/적용.
- Download/Upload speed cap, active transfer 수, Torrent peer 수, seeding ratio/duration, auto retry.
- 앱 내부 WireGuard 설정 화면.

이 기능들은 상당 부분 다운로드/토렌트 거버넌스에 초점이 있다. Barrel Smart Connect의 DNS와 사이트별 네트워크 정책까지 이미 구현됐다고 볼 수 없다.

## 6.2 Smart Connect는 Network Policy Layer

Barrel의 별도 `Barrel_1.1.2_SmartConnect_기능구조_이식명세.md`에 명시된 범위를 기준으로 아래를 구현한다.

### Smart Connect Mode

| 모드 | 통합 앱 동작 정의 |
|---|---|
| OFF | 요청의 기본 직접 연결/선택된 전역 route만 사용. 장애가 나도 Smart retry는 하지 않음 |
| AUTO | 정상 경로를 먼저 사용. DNS failure/connection timeout/refused/reset 등 정책상 eligible한 실패에서만 대체 전략을 제한 횟수 적용 |
| ALWAYS | 적용 대상 요청에 지정된 alternate route를 요구. route 준비/인증/연결 실패 시 직접 연결로 묵시적 fallback 금지 |

`AUTO`의 오류 분류는 보수적으로 한다. 네트워크 Offline, 잘못된 URL, 401, 404, TLS 인증서 오류, 5xx 일반 장애를 차단 사이트로 단정하지 않는다. 403은 사이트 권한·인증·지리적 제한을 구분하기 어려워 별도 분류 후 사용자가 선택할 수 있게 한다.

Smart Connect는 사용자의 IP를 숨기거나 IP 차단을 해결하는 기능이라고 표현하지 않는다. 선택한 alternate route가 실제로 다른 egress를 제공하는 경우에만 해당 효과가 발생한다.

## 6.3 DNS 기능

| 모드 | 기능 |
|---|---|
| System | Android 시스템/현재 네트워크 DNS |
| AdGuard | 검증한 AdGuard DNS preset |
| Cloudflare | Cloudflare resolver preset |
| Google | Google resolver preset |
| Custom | 사용자가 입력한 지원 transport의 DNS endpoint |

설계 주의:

- Custom URL을 받는다고 DoH/DoT가 구현된 것은 아니다. DNS transport(DoH/DoT/기타), bootstrap resolver, 인증서, fallback을 실제 코드로 확인한다.
- HTTP proxy/WireGuard route와 DNS만 따로 터널링되는 상황을 구분한다.
- DNS 변경 결과는 새 연결에 적용하고 기존 connection pool을 안전하게 갱신한다.
- DNS 오류는 TLS 인증서 오류로 오인하지 않는다.

## 6.4 Proxy 기능

지원 후보: HTTP CONNECT, SOCKS4, SOCKS5.

- Enable/Disable, 타입 선택, Host, Port, Username, Password.
- Proxy bypass host list / domain glob.
- 연결 테스트: SUCCESS / AUTH_FAILED / TIMEOUT / UNREACHABLE / TLS_FAILURE / DNS_FAILURE / UNKNOWN.
- 자격증명은 Android Keystore 기반 암호화 저장.
- UI에서는 비밀번호 마스킹, 로그에서는 Authorization 완전 제거.
- 사용자 프록시를 사용할 때 프록시 endpoint DNS와 목적지 DNS가 어느 쪽에서 해석되는지 분명히 표시한다.
- 프록시 적용 실패 시 `직접 연결로 계속`이 자동 실행되지 않도록 route binding을 보존한다.

## 6.5 Site Rules

Barrel Smart Connect 문서에서 확인된 사이트별 항목:

- Host / Domain.
- Smart Connect override: Default / On / Off.
- Proxy override: Default / On / Off.
- Simultaneous connection count.
- User-Agent.
- Referer.
- Custom headers.

통합 앱에서는 다음 필드를 추가하는 것을 권장한다.

```kotlin
data class SiteConnectionRule(
    val id: String,
    val hostPattern: String,
    val includeSubdomains: Boolean,
    val smartConnectOverride: OverrideMode,
    val proxyProfileId: String?,
    val proxyOverride: OverrideMode,
    val dnsProfileId: String?,
    val userAgentProfileId: String?,
    val refererPolicy: RefererPolicy,
    val customHeadersSecureRef: String?,
    val maxConnections: Int?,
    val enabled: Boolean
)
```

Host 매칭은 URL substring 비교를 금지한다. Exact host, suffix boundary, 명시적인 wildcard, subdomain 포함 옵션을 분리한다. `example.com.attacker.invalid`가 `example.com` 규칙에 매칭되면 안 된다.

## 6.6 App-local WireGuard 적용 범위

WireGuard는 연결 정책이 선택할 수 있는 transport 중 하나다. Smart Connect의 대체 판단 로직과 WireGuard transport를 한 모듈로 섞지 않는다.

| 네트워크 클라이언트 | 현재 조사 상태 | 완료 조건 |
|---|---|---|
| Rust Direct/HLS/DASH HTTP client | EngineHost의 HTTP download proxy 적용 경로 확인 | 실제 GET/Range/redirect/timeout/headers/egress를 각각 검증 |
| Android WebView | ProxyController 기반 적용 경로가 baseline source에 존재 | Galaxy WebView provider와 407 인증 challenge/redirect/ServiceWorker 검증 |
| yt-dlp/Python subprocess | CLI 요청에 `--proxy`를 주입하는 공통 경로가 확인되지 않음 | proxy URL·인증을 안전하게 전달하고 실행 로그에서 비밀 제거 |
| NewPipe OkHttp | 자체 `OkHttpClient.Builder()`가 독립 생성되며 proxy/authenticator 연결 확인 안 됨 | 공통 NetworkRouteProvider 주입 및 실제 extractor 요청 검증 |
| Media3 Player | 별도 Activity prototype에서 OkHttp proxy가 연결된 후보가 있음. 기준선 #702에서는 해당 Activity 파일 확인 안 됨 | 기준선으로 통합, MediaSession과 동일 route 적용 |
| Subtitle/API/image/metadata clients | 클라이언트별 route 적용 여부 미확인 | 공통 client factory 또는 명시적 adapter, route coverage test |
| Torrent/DHT/PEX/LSD | UDP/peer socket 계열. HTTP CONNECT proxy로 자동 포함되지 않음 | 별도 지원 여부 표시; WG 강제 시 torrent를 pause/block하는 fail-closed 정책 유지 |
| QUIC/HTTP3/UDP | TCP HTTP proxy만으로 자동 터널링 불가 | client 별 QUIC disable/지원 여부와 fallback 정책 명시 |

**완료 판정:** WireGuard switch가 ON이라는 사실만으로 “앱 전체 트래픽이 VPN으로 나간다”고 표기하지 않는다. 각 client의 proxy route applied, handshake, HTTPS egress 확인을 분리한다.

## 6.7 네트워크 진단 화면

Network Diagnostics에 다음 상태를 각각 표시한다.

- active network (Wi-Fi/Cellular/Roaming/Metered), system VPN 존재 여부.
- DNS resolution과 응답시간.
- Proxy reachable/authenticated 상태.
- WireGuard local tunnel 상태, peer handshake age, endpoint, 실제 HTTPS egress country/IP.
- Rust / yt-dlp / NewPipe / WebView / Media3 / Subtitle clients의 route 적용 결과.
- Download 속도/응답코드/Range 지원·실패 원인.
- 개인정보가 제거된 진단 내보내기.

---

# 7. YouTube 및 yt-dlp: YTDLnis를 주력으로 재정렬

## 7.1 현재 잘못된 우선순위

기준선 `YoutubeDownload.kt`에서 아래 코드 경로가 확인된다.

- YouTube URL에서 `NewPipeYoutube.get()`을 먼저 호출한다.
- NewPipe에서 video + audio 포맷이 발견되면 해당 형식 목록을 즉시 반환한다.
- NewPipe가 실패/불완전할 때만 `prepareYtDlp()` 및 yt-dlp player client 탐색으로 넘어간다.
- `add()`에서 `playerClient == "newpipe"`면 NewPipe 전용 실행 경로로 분기한다.
- `NewPipeYoutube.kt` 자체 `HttpDownloader`는 `OkHttpClient.Builder().readTimeout(...).build()`를 별도 생성한다. 공통 WireGuard proxy/auth 연결이 확인되지 않았다.
- `requestFor()`는 `--no-playlist`, `--no-warnings`, extractor args 등을 지정하지만 현재 조사 구간에서 `--proxy` 주입을 확인하지 못했다.

이는 사용자가 지정한 **YTDLnis/yt-dlp 주력** 구조와 반대다. NewPipe가 빠른 보조 extractor일 수는 있지만 primary format inventory/source of truth가 되면 안 된다.

## 7.2 목표 YTDLnis 파이프라인

1. URL/share/browser intake 및 playlist/URL canonicalization.
2. RuntimeManager: Python, yt-dlp, JS runtime(필요한 엔진), FFmpeg, Aria2c의 설치/버전/경로/health 관리.
3. yt-dlp metadata/extractor로 모든 이용 가능한 format/subtitle/playlist 정보를 수집.
4. Format 모델에서 format_id, ext/container, video/audio codec, resolution, fps, bitrate, filesize, language, dynamic range, protocol, audio track 정보를 보존.
5. Maglev 디자인의 Format Selector에서 정렬/필터/검색/오디오 only/비디오 only/합본/코덱/화질/예상 크기 선택.
6. playlist 및 batch selection, 다운로드 옵션, subtitle embed/sidecar, chapter/thumbnail/metadata/SponsorBlock 같은 지원 옵션 적용.
7. 공통 MediaTask를 생성하고 yt-dlp Worker에서 실행.
8. Progress, cancel, retry, resume 지원 가능 여부, logs redaction 관리.
9. FFmpeg merge/convert/subtitle embed 수행.
10. 출력 파일 probe, audio/video track, duration, container, subtitle language, file integrity 검증.
11. Unified Transfers에 진행·완료·실패를 반영.

## 7.3 YTDLnis에서 이식할 기능

| 모듈 책임 | 가져올 동작 | Maglev 적용 형태 |
|---|---|---|
| RuntimeManager | runtime 설치/갱신/경로/버전/실행 상태 | Maglev 설정/유지보수에서 관리, 첫 화면에서 자동 업데이트 대기 금지 |
| Python + yt-dlp | extractor와 지원 사이트 | primary extraction/download engine |
| JS runtimes | 사이트별 extractor 요구 사항 충족 | 필요할 때만 설치·선택 |
| FFmpeg | 병합/변환/자막 mux | 공통 post-process worker |
| Aria2c | 적합한 direct transfer accelerator | 선택 가능. 기존 Range engine과 중복/충돌 측정 후 사용 |
| Format model/selector | 완전한 format inventory, filters/sort | Maglev sheet/card 스타일로 재구현 |
| Download Repository/ViewModel | config, format selection, task lifecycle | Unified MediaTask 어댑터 |
| DownloadWorker | foreground execution, queue, retry, progress, notification | Maglev unified Transfers worker에 연결 |

## 7.4 Format Selector 요구사항

- 모든 포맷을 무조건 보여주는 “수백 개 목록” 대신 해상도별 최적 선택, 전체 포맷 보기, 고급 필터를 나눈다.
- 해상도, codec, fps, HDR, bitrate, filesize, audio codec/language, muxed/adaptive, extension, protocol 표시.
- 실측/서버 제공값과 추정값 구분.
- audio-only, video-only, best combined, 특정 codec, 특정 container, 최대 화질/파일 크기 조건.
- format ID를 task에 저장해 나중에 다른 format으로 바뀌지 않게 한다.
- URL/서명 주소는 장기간 캐시하지 않는다. 다운로드 직전에 URL을 재획득한다.

## 7.5 Playlist / Batch

- single video, playlist, channel/list, batch URLs를 구분.
- playlist 전체/일부 체크, duplicate 제거, 순서 유지, 최대 동시 실행 제한.
- 하나의 Playlist 작업이 여러 child task를 만들되 parent-child 관계를 Transfers에서 표시.
- 개별 항목 retry/cancel과 전체 playlist retry/cancel을 제공.

---

# 8. 한국어 자막 공급망 확장

## 8.1 현재 코드와 한계

`utils/subtitles/providers/index.ts`는 BATCH_1~5 등록 구조를 가지고 있다. 현재 목록은 21개 provider 모듈이다.

| Batch | 현재 provider |
|---|---|
| 1 | Gestdown, Napisy24, Regielive, Subtis, Vladoon |
| 2 | Subf2m, YIFY Subtitles, SubtitleCat, MovieSubtitles, TVSubtitles |
| 3 | Kitsunekko |
| 4 | Subsunacs, Subtitrarinoi, Supersubtitles, Titrari |
| 5 | Soustitreseu, Subsynchro, Subclub, Nekur, Subtitlestar, Subtitulamostv |

기존 주석에는 공급원 일부가 HTTP 500, 522, 403, 사이트 유지보수/세션 문제로 제외되었다고 기록되어 있다. 이는 소스 수가 많다는 것과 실제 한국어 자막 적중률이 높다는 것이 다르다는 뜻이다.

현재 설정에는 자막 master switch, 새 동영상 자동 검색(동의 화면), 선호 언어, hearing-impaired preference, provider source 설정, OpenSubtitles 계정 설정 진입점이 있다. Hash/name matching, episode matching, provider ranking, retry와 user pick 흐름의 코드/테스트도 존재한다.

## 8.2 한국어 자막 공급원 조사 결과와 권한 수준

| 후보 | 확인한 내용 | 앱 연동 방침 |
|---|---|---|
| **SubDL** | 공식 API 문서에 제목/파일명/IMDb/TMDB, 시즌·에피소드, 언어 필터, 자막 검색/다운로드 경로 명시 | 공식 API key/Quota/언어 코드 확인 후 P1 adapter |
| **OpenSubtitles** | 공식 API 문서 및 API key 기반 검색·다운로드 안내 존재. 기존 앱 설정에도 계정 진입점 존재 | 정식 API 기준으로 검색·다운로드 통합하고 quota/credit/키 보호 적용 |
| **GOM 자막자료실** | 공개 카탈로그/한국어 분류 및 다량의 게시 자료가 확인됨. 저작권 보호 콘텐츠 관련 별도 안내 존재 | 공식 API/제휴/자동화 허가 확인 전 자동 크롤링 금지. 웹페이지 열기와 사용자가 받은 자막 파일 가져오기 제공 |
| **씨네스트** | 한국어 자막 커뮤니티 자료가 공개적으로 검색되지만 자동화 권한/API는 확인되지 않음 | 허가 없는 scraping 금지. 외부 페이지 열기·수동 다운로드 후 가져오기 경로만 제공 |
| **SubtitleCenter** | 커뮤니티 기반 자막 서비스 관련 이용 조건/크레딧 언급 확인 | API 제공 여부, 자동화 조건, 번역자 credit 정책을 확인한 후 검토 |
| 기존 21개 provider | 구현된 parser/provider adapter가 있음 | 제거하지 말고 실제 응답률, HTTP 상태, 한국어 hit-rate를 측정해 유지/교체 |

**중요:** 공개 페이지가 보인다는 사실은 자동 수집·재배포 허가를 의미하지 않는다. 국내 자료실은 저작권 보호 목록과 사이트 약관, API/robots 조건을 확인하고 연동한다. 무단 scraping을 전제로 구현하지 않는다.

## 8.3 자막 검색 엔진 개선

우선순위:

1. 한국어(`ko`) 우선, 사용자 선호 언어 순서대로 검색.
2. 파일명/릴리즈명 정규화, 제목 alias, 연도, 시즌/에피소드.
3. 미디어 파일 hash(정확한 파일), IMDb/TMDB, 파일명/릴리즈명 기반 교차 검색.
4. provider별 parallel search를 제한하고 concurrency/rate limit/timeout을 적용.
5. 언어·자막 형식·SDH/HI·Forced·FPS·릴리즈명·업로더 credit을 표시.
6. 검색 결과를 한국어 정확 매칭 → hash exact → episode exact → release similarity → title similarity 순으로 랭킹.
7. 한국어 결과가 없을 때 영어/기타 언어 결과를 한국어인 것처럼 표시하지 말고 “한국어 결과 없음”을 분명히 표시.
8. 여러 provider 결과의 같은 파일·같은 hash를 deduplicate하고 원본 provider·translator credit을 유지.

## 8.4 자막 파일 및 플레이어 기능

- Local subtitle picker: SRT, ASS/SSA, VTT, SMI 등 실제 파서/Media3 호환 범위만 노출. SUP/이미지 자막은 별도 지원 여부 확인.
- UTF-8, UTF-16, CP949/EUC-KR 등의 인코딩 감지 및 변환. 잘못 추정하면 사용자가 인코딩을 바꿀 수 있어야 함.
- 자막 싱크 지연/앞당김, 폰트 크기, 색상, outline/shadow, 위치, 줄 간격.
- 한국어/영어/기타 다중 자막 트랙 전환.
- SRT/ASS/VTT sidecar 저장과 원본 영상에 mux/embed 옵션 구분. Burn-in은 재인코딩이므로 원본 화질 보존 mux와 분리.
- 파일명·시즌/에피소드 규칙으로 기존 자막을 자동 탐색.
- autoNewVideos는 사용자가 동의한 이후에만 동작하고 API 호출량/개인정보를 고지.
- API 키/토큰은 Keystore 암호화 저장, 요청 로그에서 제거.

## 8.5 한국어 자막 acceptance

- 한국어 영화 20건 + 드라마/애니 각 20건 이상의 실제 query benchmark.
- hash exact / release exact / episode exact의 정답률을 따로 측정.
- provider별 성공률·빈 결과율·실패코드·응답시간 기록.
- 언어 코드가 각 API에서 실제 지원되는지 확인. SubDL 문서의 언어 코드 링크가 안정적으로 노출되지 않는 경우 공식 endpoint에서 canonical list를 확인하고 mapping을 테스트한다.
- GOM/씨네스트는 승인 전 자동화 테스트를 작성하지 않는다. 외부 페이지 열기 및 사용자 파일 선택만 테스트한다.

---

# 9. 브라우저 미디어 재생: PiP + 백그라운드 + 통합 플레이어

## 9.1 반드시 지원할 사용자 경험

브라우저에서 영상을 발견하면 다음 흐름이 가능해야 한다.

1. 페이지 안에서 인라인 재생.
2. 웹사이트의 전체화면 플레이어.
3. Android Picture-in-Picture (PiP).
4. 앱을 벗어나도 가능한 오디오/지원 영상 백그라운드 재생.
5. 잠금화면/알림/이어폰/블루투스 미디어 버튼으로 재생·일시정지·이전·다음 제어.
6. Media3 Native Player로 URL을 넘길 수 있는 영상은 별도 플레이어로 이어 재생.
7. 가능한 한 브라우저에서 전달한 Cookie/UA/Referer/required headers를 Native Player에도 전달.
8. 재생 중인 파일/스트림을 다운로드 중인 task와 연결할 수 있으면 우선순위 높은 segment scheduling 지원.
9. Barrel apk 에서 지원하는 "재생하면서 저장 : 이 영상은 다운로드할 주소가 없어 페이지에서 재생되는 동안 저장합니다. 시작하면 페이지를 다시 불러옵니다. 영상을 끝까지 재생한 뒤 저장을 누르십시오. 재생하지 않은 부분은 저장되지 않습니다." 기능은 꼭 구현되어야함.

## 9.2 현재 구현 상태

- `MaglevBrowserView.kt`에서 WebChromeClient `onShowCustomView()`/`onHideCustomView()`를 처리하고, HTML5 `<video>`의 fullscreen view를 다루는 경로가 있다.
- Fullscreen WebView player에 PiP 버튼과 ratio calculation/Android PiP 호출 경로가 포함된 소스가 있다.
- 기존 master spec/이전 기기 검증 기록에는 Galaxy에서 browser video recording/playback PiP가 불안정하거나 실패한 판정이 있다. 코드 존재만으로 완료 처리할 수 없다.
- 별도 `MaglevMediaPlayerActivity.kt` Media3/ExoPlayer + PiP prototype은 PR #1 feature branch에서 확인되지만, #702 기준선에서는 해당 파일을 확인하지 못했다. 따라서 #702에 이미 통합되었다고 취급하지 않는다.
- #702 `AndroidManifest.xml`에는 Torrent foreground service가 있지만 `MediaSessionService` 또는 media playback foreground service type을 확인하지 못했다.

**판정: 브라우저 fullscreen/PiP는 부분 구현 및 실기기 검증 미완료. Native player는 후보 브랜치 prototype. 백그라운드 미디어 재생은 기준선에서 미구현.**

## 9.3 백그라운드 재생 구현 구조

Android Media3 권장 구조에 맞춰 Player와 MediaSession을 별도 `MediaSessionService` 내부에서 소유한다.

- `MediaPlaybackService : MediaSessionService`
- ExoPlayer/MediaSession lifecycle을 Service가 소유.
- Android Manifest foreground service media playback 권한 및 `foregroundServiceType="mediaPlayback"` 선언.
- Media notification, lock screen controls, audio focus, noisy audio (headphone disconnect), Bluetooth/headset actions.
- Queue/playlist/next/previous/seek/speed/repeat/shuffle.
- Activity 재생 화면과 Browser가 같은 Session을 제어.
- 화면 회전/Activity 재생성/앱 전환 뒤 Service player 유지.
- 앱에서 사용자가 Stop을 누르면 foreground service 종료 및 notification 제거.
- 다운로드 service와 playback service의 foreground lifecycle을 혼합하지 않는다.

Android 공식 Media3 설명은 백그라운드 재생 시 Player와 MediaSession을 MediaSessionService/MediaLibraryService에 두는 패턴을 제시한다. `MaglevTorrentService`를 이름만 바꾸거나 데이터 다운로드 서비스에 플레이어를 추가하는 방식은 피한다.

## 9.4 PiP 검증 요구사항

- Android 8+ PiP 기본 경로, Android 12+ auto-enter transition.
- PiP 진입 시 실제 재생 중인 video surface 유지, 검은 화면/재생 중단 방지.
- 올바른 aspect ratio와 resize.
- PiP controls: Play/Pause, close, 필요한 경우 next.
- WebView custom view, iframe, orientation, tab switch, app background, fullscreen exit 경로.
- Samsung Galaxy One UI에서 내비게이션 제스처, 화면 회전, multi-window, battery saver 상황 확인.
- `blob:`/MSE/DRM/사이트 자체 커스텀 player는 PiP가 안 되는 경우 원인을 구분해 표시한다.

## 9.5 백그라운드 제한과 UX

모든 웹사이트 video가 백그라운드 재생된다고 보장할 수 없다. MediaSession/URL/headers를 확보할 수 있는 미디어는 Native Media3로 승격할 수 있고, WebView 내부에서만 가능한 보호/브라우저 플레이어는 사이트가 허용하는 범위에서 유지한다. 불가능한 경우 지원하지 않는 이유를 표시한다.

---

# 10. LJ 기반 브라우저 미디어 감지 개선

## 10.1 현재 구현

`PageScan.kt` / `MaglevBrowserView.kt` / `TabWebView.tsx`에서 확인:

- `<video>`, `<audio>`, `<source>`, poster, `data-src`/`data-url`, meta OpenGraph URL, embed/object/iframe/link 후보.
- fetch/XHR의 GET 응답 URL과 Content-Type metadata 보고.
- Resource Timing 후보 수집.
- MIME/URL 정규화, 중복 제거, 크기 제한, nonce 확인.
- MSE 사용 신호 및 EME/DRM 신호를 보고하는 코드가 있음.

## 10.2 미완료 영역

- 감지 대상 요청에 대한 완전한 Request/Response Context 유지가 부족하다.
- ServiceWorker request observer 별도 경로 필요.
- `shouldInterceptRequest`만으로 모든 응답 body/redirect chain을 수집할 수 없다.
- fetch/XHR wrapper는 response body 소비/교체를 피하도록 되어 있어 raw media bytes capture가 아니다.
- MSE 사용 감지와 MSE buffer capture는 다른 기능이다.
- iframe cross-origin 경계, isolated world/content script 지원, script injection timing을 별도 검증해야 한다.
- Cookie는 민감정보이므로 일반적인 WebView 전체 cookie dump를 하지 말고 해당 request에 필요한 context와 보안 참조로 관리해야 한다.

## 10.3 목표 detection pipeline

```text
Navigation + Frame identity
  → DOM observer
  → fetch/XHR metadata observer
  → ServiceWorker observer
  → WebView native request callback
  → Resource Timing
  → media element events
  → MSE SourceBuffer observation
  → candidate normalization & confidence
  → request context attachment
  → media resolver (Direct / HLS / DASH / yt-dlp / MSE recorder)
```

각 후보의 `DetectionMethod`/`Confidence`를 UI에 표시하고, 같은 영상으로 확인되지 않으면 임의로 합치지 않는다.

---

# 11. MPMux: HLS Live 및 MSE 실제 데이터 캡처

## 11.1 현재 Maglev의 한계

- HLS parser `hls.rs`는 VOD 중심이며 `#EXT-X-ENDLIST`가 없는 media playlist를 live로 거부한다.
- DASH parser `dash.rs`는 VOD 중심이고 `type="dynamic"`, ContentProtection, 여러 Period 등 일부 범위를 거부한다.
- PageScan은 MSE를 감지하는 표식을 낼 수 있지만 SourceBuffer에 들어가는 실제 byte array를 수집/파일화하지 않는다.

따라서 HLS Live 녹화 및 MSE capture는 “이미 지원”이 아니라 신규 기능이다.

## 11.2 HLS Live Recorder

필요한 state:

- Master playlist/variant/audio/subtitle rendition 선택.
- Live media playlist polling interval/target duration.
- `MEDIA-SEQUENCE`, `DISCONTINUITY-SEQUENCE`, segment URL/byterange, `EXT-X-MAP`, `EXT-X-KEY`, `EXT-X-PROGRAM-DATE-TIME`, `EXT-X-DATERANGE`, `EXT-X-ENDLIST`.
- Sliding window에서 이미 사라진 segment, gap, duplicate, sequence reset, reconnect.
- 최대 녹화 시간/용량/저장 공간 guard.
- Stop → pending segment drain → track validation → mux/finalize → output probe.

## 11.3 MSE Capture

- `MediaSource`, `ManagedMediaSource`(지원 시), `SourceBuffer`, `addSourceBuffer`, `appendBuffer`, `remove`, `abort`, `endOfStream` life cycle.
- Init segment와 media segment를 실제 데이터 경계/track MIME/sequence/time 정보와 함께 관찰.
- `appendBuffer(ArrayBuffer|ArrayBufferView)`를 bounded copy하며 main thread를 block하지 않음.
- 최대 메모리/큐 크기, backpressure, write failure, tab close, app background 처리.
- track별 순서, timestamp offset, discontinuity, coded frame/group 정렬.
- 추출한 비보호 데이터가 일반 MP4/fragmented MP4 등으로 재구성 가능한지 probe.
- 재구성 불가 시 `지원 제한`으로 남기며 무리하게 손상 파일을 완료 처리하지 않음.

## 11.4 테스트

- HLS Live가 계속 갱신되는 test server; sliding playlist, segment disappear, sequence gap, discontinuity, init map, reconnect, user stop.
- MSE test pages for MP4/fMP4/WebM, audio+video, different append sizes, repeated append, memory pressure, pause.

---

# 12. Barrel 1.1.2 다운로드 엔진 분석자료 반영

Barrel 다운로드 분석서는 Smart Connect 문서와 별개다. 다음 두 원본을 모두 통합 기준에 포함해야 한다.

1. `Barrel_1.1.2_APK_심층분석_다운로드기능_이식설계서.md` (중복 파일명 버전 포함, APK static analysis)
2. `Barrel_1.1.2_SmartConnect_기능구조_이식명세.md`

## 12.1 다운로드 엔진 분석에서 가져올 항목

- Direct download resume: Range probe, 206/Content-Range, ETag/Last-Modified, actual file length, server ignores Range fallback.
- Split download: 적절한 크기/서버/네트워크일 때만 병렬 구간 사용, 각 part length/range/validator 검증, 속도 악화 시 connection 수 감소.
- Download sidecar/task metadata: source URL, file size, validator, part/segment state, selected quality/playlist signature.
- HLS VOD: variants, audio/subtitle tracks, segments, init/map, byte range, key/discontinuity, mux validation.
- DASH VOD: Representation, SegmentTemplate/Timeline/List/BaseURL, audio/video/subtitle track mapping.
- Resume: manifest/segment signature를 비교하고 변경된 경우 과거 완료 구간을 무조건 재사용하지 않는다.
- Download during playback: player가 요구한 segment 우선 처리, 일반 download segment보다 높은 scheduler priority.
- Subtitle URL/format/language/selected track는 resume/quality model과 연결한다.
- 재생하면서 저장 : 이 영상은 다운로드할 주소가 없어 페이지에서 재생되는 동안 저장합니다. 시작하면 페이지를 다시 불러옵니다. 영상을 끝까지 재생한 뒤 저장을 누르십시오. 재생하지 않은 부분은 저장되지 않습니다. (이 기능 꼭 구현 필요)

## 12.2 Maglev와의 역할 분담

| 기능 | Maglev 기준선 | Barrel이 제공하는 가치 | 판단 |
|---|---|---|---|
| Direct Range/split | 구현 존재(검증된 Range 조건 및 fallback 로직) | 실패/서버 변동/part 복구 edge case 벤치마크 | 유지 + gap 테스트 |
| Direct resume | sidecar/part state 코드 존재 | validator/partial file reconciliation 보강 | 유지 + 보강 |
| HLS VOD | parser/segment/mux 경로 존재 | 특수 tag/byterange/playlist resume 검증 | 제한사항 명시 + 보강 |
| DASH VOD | parser/representation/segment 경로 존재 | segment signature/resume/track edge case | 제한사항 명시 + 보강 |
| HLS Live | 현재 parser가 미지원 | Live playlist/recording 설계 근거 | 신규 구현 |
| MSE actual capture | 실제 bytes capture 미구현 | MSE/Blob/bridge 흔적과 기능 계층 | 신규 구현 |
| Playback while download | 일부 개념/Player prototype | segment priority와 cache 협력 | 구현/검증 필요 |

**중복 엔진 금지:** Barrel 설계 내용을 이유로 Direct/HLS/DASH downloader를 새로 복제하지 않는다. 기존 Maglev Rust 엔진의 contract tests를 먼저 작성하고 빠진 동작을 파일 단위로 보강한다.

---

# 13. 기존 코드 현황과 수정 책임 매핑

아래는 2026-11-28 기준선 `#702`에서 확인한 경로 중심이다. “존재”는 기능 완성/실기기 성공이라는 뜻이 아니다.

| 기능 | 현재 소스 기준 증거 | 상태 | 반드시 할 일 |
|---|---|---|---|
| Browser settings | `app/settings/browser.tsx`, `utils/prefs/browser.ts` | 상당 부분 존재 | 페이지별 설정과 native 적용 검증 추가 |
| Browser screen | `app/browser.tsx`, `components/browser/*` | 존재, 복합 UI | 보존하면서 site controls/UX 확장 |
| WebView media scan | `PageScan.kt`, `MaglevBrowserView.kt` | 부분 구현 | LJ 수준 request context, ServiceWorker, lifecycle 보강 |
| Ads host blocking | `Blocklist.kt`, `BlocklistStore.kt` | 부분 구현 | ABP parser/filter engine로 단계 확장 |
| Cosmetic ad hide | `PageScan.kt`의 CSS/YouTube script | 부분/취약 | 규칙 엔진과 사이트별 예외/테스트 |
| Browser PiP | `MaglevBrowserView.kt` fullscreen custom view 경로 | 부분 구현, Galaxy 검증 실패/불안정 기록 | Galaxy 실기기 재검증·iframe/resize/transition 처리 |
| Native Media3 PiP | PR #1 branch의 `MaglevMediaPlayerActivity.kt` | 후보 prototype, #702 파일 미확인 | 기준선에 채택 전 diff/테스트/route 검증 |
| Background player | #702 Manifest에 MediaSessionService/mediaPlayback FGS 없음 | 미구현 | MediaSessionService, Media notification, audio focus |
| Network basic | `app/settings/network.tsx`, `network-advanced.tsx` | 부분 구현 | UI 값의 실제 client coverage 측정 |
| Smart Connect | 별도 문서는 있으나 #702의 Smart Connect policy resolver 미확인 | 미구현 또는 미확인 | mode/site rules/failure classifier 구현 |
| DNS profiles | #702의 관련 NetworkSettings fields에서 확인 불충분 | 미확인/미구현 | DNS transport부터 확인/설계 |
| Proxy | `NetworkSettings.proxy`; WG controller; route-specific path | 부분 구현 | proxy type/client마다 적용 증명 |
| App-local WG | `WireGuardController.kt`, native wireguard module, profile store | 핵심 transport 존재, client coverage 부분 | per-client route coverage test, fail-closed |
| YouTube extractor | `YoutubeDownload.kt`, `NewPipeYoutube.kt` | 구현 우선순위가 요구와 반대 | yt-dlp/YTDLnis primary로 수정 |
| YTDLnis complete runtime | runtime/format/worker full port 미확인 | 부분/미완료 | RuntimeManager, format inventory, worker lifecycle 이식 |
| Subtitle engine | `utils/subtitles/*`, `components/subtitles/*`, provider registry | 부분 구현 | 한국어 검색 적중률/official API/provider status 보강 |
| HLS VOD | `native/maglev-core/src/http_dl/stream/hls.rs` | 구현, 제한사항 존재 | Barrel test cases와 gap 보강 |
| DASH VOD | `native/maglev-core/src/http_dl/stream/dash.rs` | 구현, 제한사항 존재 | multi-period/live/protected limitations 명시 및 테스트 |
| HLS Live | `hls.rs`의 live 거부 로직 | 미구현 | MPMux Live recorder 신규 |
| MSE capture | PageScan MSE marker | 감지만 부분 구현 | `appendBuffer` data capture/ordering/mux 신규 |
| Unified tasks | Transfers가 존재하나 엔진별 lifecycle 매핑 전체 감사 필요 | 부분/미확인 | Engine Registry + task state mapping 확정 |

## 13.1 특히 잘못되거나 위험한 연결

1. **YTDLnis 주력 기준 역전:** NewPipe가 먼저 완전 포맷을 내놓으면 즉시 반환하고 yt-dlp는 fallback. 이는 제품 요구에 맞지 않는다.
2. **MSE 감지 ≠ MSE 다운로드:** `mse=true` 같은 신호로 실제 녹화 기능을 표시하면 안 된다.
3. **PiP 버튼/Activity 존재 ≠ 안정적인 재생:** Galaxy에서 PiP 진입/복귀/영상 surface 유지 검증 전 완료 처리 금지.
4. **WireGuard local proxy ready ≠ 모든 client route:** NewPipe/yt-dlp/process/API/Media3 별도 통합이 필요하다.
5. **Host blocklist ≠ 상세 광고 필터:** CSS로 요소를 숨긴 것과 실제 request 차단을 구분한다.
6. **Subtitles provider count ≠ 한국어 품질:** 언어별·작품 유형별 benchmark가 필요하다.
7. **Browser UI toggle ≠ native permission:** React state와 실제 WebView setting/callback을 end-to-end 검증한다.

---

# 14. 개발 순서와 완료 gate

## P0 — 기준선 보존 및 회귀 방지

- #702 baseline tag/commit/hash를 보존.
- PR #1 / #10 변경 파일을 기능 단위로 나눠 비교하고 파일별 채택 결정.
- Browser/Network/Subtitle/Transfer/Player의 현재 contract tests를 먼저 통과시킴.
- 기존 기능 inventory와 regression matrix 작성.
- baseline APK와 후보 APK의 package/version/source SHA를 manifest로 기록.

**Gate:** baseline 재현 빌드, unit/contract/Rust/JS 테스트, 기존 기능 목록과 known gaps 문서화.

## P1 — 앱의 핵심 목표를 바로잡기

- YouTube source of truth를 yt-dlp/YTDLnis로 변경.
- Format model/selector와 playlist/batch/task lifecycle 통합.
- NetworkRouteProvider를 만들어 Rust, yt-dlp, NewPipe, WebView, Media3, Subtitle/API 클라이언트별 적용.
- Browser page-level settings model/UI와 native props 연결.
- Ads filter parser를 최소 ABP subset부터 단계 적용.
- MediaSessionService 기반 background playback을 구현.
- PiP current code를 Galaxy에서 재검증하고 실패 경로를 수정.
- SubDL/OpenSubtitles official API와 한국어 검색 adapter/benchmark 구축.

**Gate:** YouTube yt-dlp-primary contract, format selection end-to-end, route coverage matrix, browser page settings test, ad filter parser suite, lockscreen/background/pip device test.

## P2 — 고급 미디어 감지·녹화

- LJ request context 강화 + ServiceWorker 별도 observer.
- MPMux HLS Live recorder.
- MSE real bytes capture/track reconstruction.
- playback/download shared segment scheduler.
- HLS/DASH Barrel edge case 및 resume reconciliation.

**Gate:** test HLS Live stream 녹화 결과, MSE fixture 파일 재생/검증, memory/backpressure, DRM refusal tests.

## P3 — 브라우저/네트워크 고급 기능

- Smart Connect OFF/AUTO/ALWAYS.
- DNS presets/custom transport.
- Site Rules editor, per-host proxy/WG/UA/referer/headers/connection limits.
- Filter categories/region lists/cosmetic filters/user selector.
- page translation/reader/offline page/tab groups/permission manager.

**Gate:** network policy precedence tests, DNS/proxy authentication tests, filter update rollback, site permission/privacy test.

## P4 — 한국어 콘텐츠 품질·편의

- GOM/씨네스트/SubtitleCenter 등은 권한/정식 API 확인 이후 adapter 여부 결정.
- 사용자 수동 자막 import/인코딩/싱크/스타일 완성.
- subtitle ranking/duplicate/provider credit.
- media queue/playlist/chapters/bookmarks/auto next.

**Gate:** Korean subtitle benchmark, license/permission checklist, player subtitle synchronization.

## P5 — 릴리즈 승인

- SBOM/license/security/leak scan.
- Android permissions/foreground service declarations review.
- no sensitive logs; API key/proxy creds encrypted.
- Galaxy physical test: Wi-Fi/Cellular/roaming, Wi-Fi transition, screen off, app switch, battery saver, app process kill/restart, reboot.
- test sites: YouTube, normal progressive, HLS VOD/live, DASH, supported MSE, authenticated media, redirects, ad-heavy pages.
- regression: direct/torrent/playlist/resume/storage/notification/share/URL input/browser tabs/settings.
- Test report records device model, One UI/Android version, app version, network condition, expected vs actual.

**Gate:** CI all green + Galaxy test evidence + release manifest + documented unsupported cases. CI alone is insufficient.

---

# 15. 반드시 작성할 테스트 세트

## 15.1 Browser & Site Settings

- global defaults, per-site override, inheritance, reset-to-default.
- exact host/subdomain/wildcard boundary and spoofed suffix cases.
- private tab data isolation; clear history on close; cookies not leaked across normal/private sessions.
- third-party cookie required site; per-site enable/disable.
- camera/mic/location/notifications Ask/Allow once/Allow site/Block flows.
- popup open/redirect/blocked count/always allow.
- UA desktop mode, zoom/dark mode on normal pages and media pages.
- background tabs and tab restore.

## 15.2 Ad blocker

- hosts, ABP domain, wildcard, exception, resource type, first/third party, domain include/exclude, cosmetic filter.
- unsupported modifier, malformed list, >10 MB list, redirect loop, invalid host, duplicate rule.
- update failure keeps previous list; rollback.
- allowlist precedence, current-site temporary disable, user custom filter.
- false positive regression on login/payment/video/captcha/download sites.

## 15.3 Smart Connect / Network route

- OFF/AUTO/ALWAYS expected route.
- AUTO eligible DNS/timeout/reset; no retry on Offline/401/404/TLS/invalid URL.
- 403 classification not automatic certainty; 5xx server retry separated.
- Site override Default/On/Off precedence.
- Proxy connection/auth/bypass; DNS system/custom; WG peer handshake and real egress.
- per-client actual request through route (Rust, yt-dlp, NewPipe, WebView, Media3, subtitles).
- route unavailable with strict route policy must fail closed, not direct fallback.
- HTTP CONNECT vs SOCKS5; IPv4/IPv6; redirects; DNS bootstrap; TLS validation; QUIC/UDP explicitly reported.

## 15.4 YouTube/YTDLnis

- yt-dlp primary invocation without NewPipe request first.
- NewPipe only fallback/secondary; route integration verified.
- formats show quality/codec/fps/size/language and selected IDs persist.
- playlist full/partial; batch; retry/cancel; expired URL refresh.
- audio extraction, video+audio merge, format convert, subtitle sidecar/embed, chapter/thumbnail metadata.
- cookies/session/age/region restrictions follow supported extractor policies, no authorization bypass.

## 15.5 Playback

- Browser inline/fullscreen/PiP and Activity recreation.
- MediaSessionService persists while Activity closed; notification/lockscreen/Bluetooth.
- audio focus, headphone unplug, incoming call, audio route change.
- HLS/DASH/MP4, subtitle track changes, custom headers.
- WebView PiP for HTML5 video, iframe limitation, MSE/DRM refusal behavior.
- playback during download with segment priority and storage pressure.

## 15.6 MPMux & Barrel

- Live playlist window shift, reconnect, segment sequence, discontinuity, init segment, byte range, stop/finalize.
- MSE appendBuffer byte types, tracks, ordering, buffer limits, memory, tab close.
- HLS/DASH VOD: master/media, variant/audio/subtitle, map, key, byte range, segment signature, resume.
- Direct Range: server returns 206, ignores Range with 200, 416, ETag drift, content length change, 429/503, network resume, disk full.

---

# 16. 위험·상호작용·결정 사항

| 위험 | 영향 | 대응 |
|---|---|---|
| 기존 브라우저/다운로드 기능 회귀 | 이미 되던 기능이 다시 깨짐 | #702 불변, PR 단위 merge 대신 file-level adoption, regression suites |
| 광고 필터 과도 차단 | 로그인/영상/결제 사이트 파손 | 카테고리·사이트별 예외·규칙 ID·rollback |
| WebView request interception 한계 | 일부 미디어/ServiceWorker가 누락 | observer를 여러 층으로 구현, 불가능한 경우 명시 |
| third-party cookies/permission 정책 | 로그인/플레이어 동작 불가 또는 privacy 약화 | per-site settings와 안전한 기본값 |
| Smart Connect가 모든 오류를 blocked로 판정 | 불필요한 우회·retry loop | failure classifier, retry budget, diagnostics |
| Proxy/WG route 누락 | 일부 요청이 direct로 빠져 IP 노출 | client coverage matrix, explicit fail-closed |
| yt-dlp runtime package 크기/업데이트 | 저장공간·초기 분석 지연 | 사용자 동의/별도 관리, 분석 중 자동 업데이트 금지 |
| 한국어 자막 소스의 비공식 자동 수집 | 저작권/약관/차단 위험 | official API/허가 adapter, 외부 페이지 열기·사용자 import |
| PiP/백그라운드 FGS 제약 | OS 정책/배터리 정책에 따라 종료 | MediaSessionService, Galaxy device validation |
| MSE 캡처 메모리 | 앱 OOM, 페이지 멈춤 | bounded buffer, backpressure, max size/time, cancellation |

---

# 17. 외부 원천/공식 문서 및 참고 링크

## 원천 문서

- `Barrel_1.1.2_APK_심층분석_다운로드기능_이식설계서.md` — APK 정적 분석 다운로드 엔진 기준.
- `Barrel_1.1.2_SmartConnect_기능구조_이식명세.md` — 별도 Network Policy/Site Rules 기준.
- `통합_미디어_다운로더_전수조사_종합_설계기준서.md` — 앞선 종합 조사/원천 매핑.
- `통합_미디어_다운로더_총괄_개발가이드.md` — 기존 개발 가이드. 본 V3와 충돌하면 원천 책임·기능 gap 기준은 V3에서 수정/보완한다.

## YTDLnis / 자막

- YTDLnis: https://github.com/deniscerri/ytdlnis
- SubDL API: https://subdl.com/ko/api-doc
- OpenSubtitles API: https://ai.opensubtitles.com/api-docs
- GOM 자막 자료실: https://www.gomlab.com/subtitle
- Cineaste: https://cineaste.co.kr/
- SubtitleCenter: https://subtitle.center/

## 브라우저/광고 필터

- Android WebView WebViewClient: https://developer.android.com/reference/android/webkit/WebViewClient
- Android WebView ServiceWorkerClient: https://developer.android.com/reference/android/webkit/ServiceWorkerClient
- AdGuard filter lists: https://adguard.com/kb/general/ad-filtering/adguard-filters/
- EasyList: https://easylist.to/
- EasyPrivacy: https://easylist.to/easylist/easyprivacy.txt

## Media3 playback/PiP

- Media3 background playback: https://developer.android.com/media/media3/session/background-playback
- Android PiP: https://developer.android.com/develop/ui/views/picture-in-picture

## WireGuard

- BitChord Android: https://github.com/04pril/BitChord-Android
- BitChord app-local proxy design: https://github.com/04pril/BitChord-Android/blob/main/docs/APP_LOCAL_PROXY.md
- Morphe WireGuard patches: https://github.com/04pril/morphe-wireguard-patches
- WireGuard userspace: https://www.wireguard.com/embedding/

---

# 18. 실행 지시 요약

다음 개발 작업은 아래 순서대로 진행한다.

1. #702 baseline을 불변 기준으로 유지하고 PR #1/#10의 파일별 diff와 테스트를 정리한다.
2. `YoutubeDownload.kt`의 NewPipe-first 경로를 YTDLnis/yt-dlp-primary로 바꾸는 설계를 확정하고, Runtime/Format/Worker 전체 책임을 이식한다.
3. `NetworkPolicyResolver`와 `NetworkRouteProvider`를 분리한다. Smart Connect, DNS, Proxy, app-local WireGuard를 동일 개념으로 취급하지 않는다.
4. 브라우저 전역 설정은 유지하고, Host별 Page Settings/Permission/Media/Network override를 추가한다.
5. 광고 차단을 host list만으로 끝내지 않고 필터 유형/규칙 parser/exception/diagnostics를 단계적으로 구현한다.
6. Media3 `MediaSessionService`와 PiP 경로를 통합하고 Galaxy에서 실제 검증한다.
7. SubDL/OpenSubtitles 공식 API의 한국어 검색을 우선 연결하고, 국내 자료실은 사용 권한/API 확인 후 별도 adapter 여부를 결정한다.
8. MPMux Live/MSE는 별도 capture engine으로 구현한다.
9. Barrel 다운로드 분석의 Direct/HLS/DASH edge case를 기존 Maglev Rust engine test에 반영하고 중복 엔진은 만들지 않는다.
10. 모든 client route/브라우저/자막/플레이어/다운로드를 실제 Galaxy에서 테스트한 뒤에만 release 승인한다.

**릴리즈 금지 조건:** CI만 통과, PiP 버튼만 노출, `mse=true`만 반환, WireGuard switch만 ON, 한국어 자막 source count만 확보한 상태는 완료가 아니다. 각 기능은 실제 동작과 실패 경로까지 확인되어야 한다.