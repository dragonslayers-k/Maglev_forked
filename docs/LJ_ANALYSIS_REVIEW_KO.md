# LJ Downloader 1.1.79 분석 내용 검토

## 자료의 성격

이 문서는 사용자가 제공한 XAPK와 사용자가 붙여 넣은 Claude의 JADX 분석 요약을 기능 요구사항으로 정리한 것입니다.

- 대상 패키지: com.leavjenn.m3u8downloader
- 대상 버전: 1.1.79 / versionCode 4202
- 제공 자료: APKPure XAPK와 사용자 제공 역공학 요약
- 확인 수준: XAPK의 패키지·버전 메타데이터는 별도 확인했으나, Claude 요약에 등장한 클래스·메서드·정규식·플러그인 코드를 이 문서 작성 과정에서 원본 디컴파일 트리와 대조하지는 않았습니다.

따라서 아래의 LJ 구현 세부사항은 **사용자 제공 분석에 근거한 참고 정보**이며, 독립 검증된 코드 사실로 취급하지 않습니다. 비공개 원본 코드나 디컴파일 결과를 복사하지 않고, 기능 요구사항과 테스트 사례만 독립적으로 구현합니다.

## 1. 기능 비교

| 항목 | 사용자 제공 LJ 분석 | Maglev 원본 및 이번 포크 |
|---|---|---|
| WebView 요청 감지 | WebViewClient와 ServiceWorkerClient를 공통 처리 | 원본에는 WebViewClient 요청 관찰이 있었음. 이번 포크에서 활성 탭으로 제한하는 Service Worker 관찰 추가 |
| 확장자 없는 스트림 | 요청 재구성 후 미디어 여부를 검증 | 응답 MIME, fetch/XHR, Resource Timing, DOM 힌트로 후보 분류 추가 |
| URL/중복 처리 | URL 기준 중복 제거 및 항목 갱신 | FoundTracker와 화면 merge 로직이 늦게 도착한 MIME·스트림·해상도 정보로 기존 항목 보강 |
| 요청 헤더 | UA, Referer, Origin, Accept-Language, Sec-Fetch-* 등을 복원한다고 분석됨 | 기존 다운로드 경로가 UA, Referer, Origin 및 호스트별 CookieManager 쿠키를 전달. Sec-Fetch-* 및 Accept-Language 복원은 미구현 |
| 영상 메타데이터 | MediaMetadataRetriever로 썸네일·길이·해상도 검증한다고 분석됨 | 현재는 DOM videoWidth/videoHeight와 MIME을 활용. 독립적인 메타데이터 프로브는 후속 과제 |
| 사이트별 플러그인 | 정규식과 JS 스니펫, OkHttp/HtmlUnit 요청·스크래핑 방식으로 분석됨 | 비공개 JS 스니펫을 복사하지 않음. 필요할 경우 앱에 포함되는 검토 가능한 사이트 어댑터를 별도 설계 |
| HLS | master/media, audio, key, map, byterange 처리 | Maglev Rust HLS 파서와 다운로드 경로 유지 |
| DASH | MPD 파싱과 분리 오디오 처리 | Maglev Rust DASH 파서와 다운로드 경로 유지 |
| 병렬 다운로드·병합 | Fetch2와 FFmpegKit 조합이라고 분석됨 | Maglev의 기존 Rust 엔진·전송 상태 머신을 우선 사용. 새 FFmpegKit 의존성은 추가하지 않음 |

## 2. Maglev에서 이미 제공하는 기능

### HLS

원본 Rust HLS 파서는 다음을 처리합니다.

- Master playlist의 화질 변형 및 오디오 그룹
- Media playlist의 세그먼트
- EXT-X-KEY 및 METHOD=NONE
- 초기화 맵과 byte range
- HLS AES-128 identity key 방식

암호화 키가 없을 때 IV를 임의의 고정 값으로 대체하지 않습니다. 플레이리스트에 IV가 없으면 HLS media sequence 번호를 128비트 big-endian IV로 사용합니다.

다음은 저장을 거부합니다.

- SAMPLE-AES, SAMPLE-AES-CTR
- identity가 아닌 KEYFORMAT
- 지원하지 않는 키 URL/키 형식
- 종료 표시가 없는 실시간 미디어 플레이리스트
- 지원하지 않는 playlist 구조와 과도한 세그먼트 수

### DASH

Maglev의 DASH 파서는 정적 VOD를 대상으로 하며 SegmentTemplate, SegmentList, BaseURL 기반 리소스를 처리합니다. ContentProtection이 포함된 매니페스트와 dynamic live MPD는 거부합니다.

위 동작은 DRM 우회가 아니라 저장 가능한 비보호 스트림만 지원하는 정책입니다.

## 3. 이번 포크에서 채택한 LJ 분석의 핵심 아이디어

1. 요청을 한 경로에서만 보지 않고 WebView, Service Worker, fetch, XHR, Resource Timing, DOM을 함께 관찰합니다.
2. URL 확장자만으로 판단하지 않고 응답 MIME을 이용해 확장자 없는 HLS·DASH·직접 동영상 후보를 찾습니다.
3. 같은 URL에 대해 늦게 도착한 응답 MIME이나 해상도를 기존 항목에 합칩니다.
4. 스트림이 확인된 뒤 세그먼트 URL이 감지 파일 목록에 과도하게 표시되지 않도록 억제합니다.
5. 다운로드는 기존 호스트별 쿠키와 Referer/Origin/User-Agent 전달 경로를 유지합니다.

## 4. 채택하지 않은 방식

### MediaMetadataRetriever를 모든 URL의 필수 관문으로 사용하지 않음

직접 MP4/WebM 파일에는 유용할 수 있지만 HLS/DASH 매니페스트, MSE/blob 플레이어, 인증 헤더가 필요한 URL에 동일하게 적용하면 검증 실패가 실제 영상 후보를 숨길 수 있습니다. 현재는 MIME과 DOM 메타데이터를 우선 사용하고, 추후 직접 파일에 한해 제한 시간·동시성·호스트 제한을 둔 선택적 프로브를 평가합니다.

### 외부에서 실행되는 원격 JavaScript 플러그인을 바로 추가하지 않음

사이트별 지원을 위해 원격 스니펫을 앱 브리지에서 실행하면 임의 코드 실행, 쿠키 접근, 앱 내부 기능 호출 위험이 생깁니다. 후속 사이트 어댑터는 코드 리뷰·고정된 권한·엄격한 URL 호스트 검증·응답 크기 제한·테스트 fixture를 갖춘 앱 코드로 관리합니다.

### LJ 전용 라이브러리를 그대로 가져오지 않음

사용자 제공 요약에 나온 Fetch2, FFmpegKit, HtmlUnit, RxJava 등을 그대로 추가하지 않습니다. 동일 기능을 위해 중복 다운로드 엔진을 추가하지 않고 기존 Maglev Rust 엔진을 확장합니다. 새 네이티브·서드파티 라이브러리가 꼭 필요해질 때만 라이선스, 유지보수 상태, APK 크기, 취약점, 재배포 조건을 먼저 검토합니다.

## 5. 라이선스 원칙

Maglev는 GPL-3.0-only로 표시되어 있습니다. 이 포크는 원본 저작권·라이선스 고지를 유지하고 수정 사항을 구분하며 GPL-3.0 조건에 따라 배포합니다.

LJ Downloader의 APK가 공개되어 있다는 사실만으로 그 내부 코드의 복제·공개 배포 권한이 생기지는 않습니다. 개인적인 사용 목적이어도 이 저장소는 Public이므로 비공개 코드나 디컴파일 코드를 복사해 커밋하지 않습니다. 사용자 제공 분석은 기능 설계와 독립 테스트를 만드는 데만 사용합니다.
