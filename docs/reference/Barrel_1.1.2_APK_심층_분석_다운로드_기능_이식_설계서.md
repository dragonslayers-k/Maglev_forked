# Barrel 1.1.2 APK 기능 심층 분석 및 다운로드 엔진 이식 설계서

- 대상 APK: `배럴_1.1.2.apk`
- 분석 기준: APK 정적 분석(DEX 문자열·클래스명·구성 흔적) + 기능 설명 + Android 공식 Media3 문서 교차검토
- 목적: Maglev+에 다운로드 이어받기, 분할 다운로드, 웹 미디어 감지, 화질 선택, HLS/DASH, 자막, 병합, 다운로드 중 재생 기능을 안정적으로 구현하기 위한 설계 기준
- APK SHA-256: `ba8da1226de50d0c2b990b0407175799bc140581377258137e8a8d3a9d5afdd1`

> **분석 범위 주의:** 이 문서는 APK의 정적 분석 결과를 기반으로 합니다. DEX 내부 문자열·클래스·데이터 구조 흔적은 실제 코드 구성의 증거이지만, 모든 기능이 실제 기기에서 정상 작동한다는 뜻은 아닙니다. 디컴파일된 전체 소스, 런타임 네트워크 캡처, 실제 사이트 테스트가 없으므로 구현 세부사항 중 일부는 `확인`, `추정`, `권장 설계`로 구분합니다.

---

## 1. Executive Summary

### 1.1 분석 결론

Barrel 1.1.2는 단순한 URL 파일 다운로드 방식이 아니라 다음을 조합한 미디어·파일 처리 구조를 가진 것으로 확인됩니다.

1. **일반 파일 다운로드**
   - HTTP Range 관련 구현 흔적
   - `Accept-Ranges`, `Content-Range`
   - 범위 요청/구간 처리
   - 이어받기 상태 및 Resume 데이터
2. **웹 미디어 감지**
   - WebView에 삽입되는 JavaScript Hook
   - `HaulMediaBridge`
   - `HaulMseBridge`
   - `HaulBlobBridge`
   - `HaulGrabberBridge`
3. **HLS**
   - M3U8 Playlist
   - Variant/Quality 선택
   - Segment 및 Byte Range
   - Resume 상태
4. **DASH**
   - MPD / Manifest
   - Video·Audio Representation
   - Segment 기반 Resume
5. **자막**
   - Subtitle URL / Format / Language / Track 관련 구조
   - Subtitle fetch 흔적
6. **다운로드 상태**
   - Resume JSON
   - Segment 완료 상태
   - Quality 선택 ID
   - Playlist URL
   - Segment signature 등 상태 데이터
7. **미디어 재생/처리**
   - Android Media3/ExoPlayer 계열 라이브러리 흔적
   - MediaSource / SourceBuffer 감지
   - 컨테이너 및 미디어 타입 처리

### 1.2 구현 권장 결론

Maglev+에서는 기능을 하나의 거대한 Downloader로 구현하지 말고 아래 엔진으로 분리합니다.

```text
Media Detection
    └─ WebView / Network / MSE / Blob

Download Orchestrator
    ├─ Direct / Progressive
    │   ├─ Single stream
    │   ├─ HTTP Range
    │   └─ Parallel parts
    ├─ HLS
    │   ├─ Playlist parser
    │   ├─ Variant selector
    │   ├─ Segment scheduler
    │   └─ Resume
    └─ DASH
        ├─ MPD parser
        ├─ Representation selector
        ├─ Segment scheduler
        └─ Resume

Media Processing
    ├─ Track / Container validation
    ├─ Muxing
    └─ Subtitle export

Persistence
    ├─ Room database
    ├─ Task metadata
    ├─ Segment/Part state
    └─ Recovery

Execution
    ├─ Foreground service
    ├─ Coroutine workers
    └─ Retry / concurrency control
```

---

# 2. APK 정적 분석 결과

## 2.1 확인된 주요 클래스·패키지 흔적

DEX 문자열에서 다음 애플리케이션 패키지 및 클래스 흔적을 확인했습니다.

| 흔적 | 의미 / 해석 |
|---|---|
| `com.dooly.haul` | APK 앱 코드 패키지 |
| `com.dooly.haul.download.AutoRetryWorker` | 자동 재시도 Worker 흔적 |
| `com.dooly.haul.service.DownloadJobService` | 다운로드 실행 서비스 흔적 |
| `com.dooly.haul.browser.WebMediaKeepAliveService` | 웹 미디어/브라우저 작업 유지 관련 서비스 흔적 |
| `com.dooly.haul.schedule.BootCompletedReceiver` | 부팅 이벤트 수신 구조 흔적 |
| `com.dooly.haul.schedule.ScheduleAlarmReceiver` | 예약/알람 처리 구조 흔적 |
| `com.dooly.haul.notify.NotificationActionReceiver` | 다운로드 알림 액션 수신 흔적 |
| `com.dooly.haul.notify.OpenCompletedActivity` | 완료 작업 열기 액티비티 흔적 |
| `com.dooly.haul.data.DownloadEntity` | 다운로드 DB Entity 흔적 |
| `com.dooly.haul.data.HaulDatabase` | Room/DB 구조 흔적 |
| `com.dooly.haul.browser.BrowserDatabase` | 브라우저 데이터베이스 흔적 |

### 해석

다운로드 실행과 브라우저 기능이 단순 화면 Activity에 묶이지 않고 Service, Worker, DB, Receiver를 사용하는 구조임을 뒷받침합니다.

다만 정확한 실행 우선순위·작업 재개 규칙·DB 스키마 전체는 정적 문자열만으로 확정할 수 없습니다.

## 2.2 감지 Bridge 흔적

DEX에서 확인된 JS Bridge 이름:

| Bridge | 확인된 목적 또는 역할 |
|---|---|
| `HaulMediaBridge` | HTML 미디어 요소 감지 보고 |
| `HaulMseBridge` | MediaSource / SourceBuffer 계열 감지 |
| `HaulBlobBridge` | Blob 관련 미디어/데이터 처리 감지 |
| `HaulGrabberBridge` | 페이지에서 미디어 후보를 수집·보고하는 Grabber 계열 |

JS 문자열에서 `window.HaulMediaBridge`, `window.HaulMseBridge`, `window.HaulBlobBridge` 접근 흔적과 오류 보고 함수가 확인됩니다.

### 중요한 차이

- **HTML Video 감지**: `<video>`, `<source>`, `currentSrc` 등의 미디어 요소 중심
- **MSE 감지**: JavaScript가 MediaSource 및 SourceBuffer를 이용해 데이터를 조립하는 스트리밍 방식의 흔적 추적
- **Blob 감지**: `blob:` URL 및 Blob 객체 관련 데이터 연결
- **Grabber**: 페이지 내 URL/미디어 후보를 탐색하고 네이티브에 전달하는 수집 계층

따라서 단순히 `video.src`를 읽는 수준만으로는 Barrel과 유사한 감지 범위를 구현할 수 없습니다.

## 2.3 HLS / DASH / Resume 문자열 흔적

확인된 주요 키워드:

```text
CombinedHlsResume(video=
CombinedDashResume(video=
HlsResume(segmentsDone=
DashResume(segmentsDone=
Dash(manifest=
DashManifest(video=
DashResume(segmentsDone=
DashSegmentItem(url=
Content-Range
Unexpected Content-Range
#EXT-X-BYTERANGE
#EXT-X-BYTERANGE:(\d+(?:@\d+)?)\b
mediaPlaylistUrl=
dashManifestUrl=
hlsVariants=
selectedQualityId=
qualityOptions=
qualityLabel=
selectedSubtitleTrack=
subtitleCount=
subtitleFormat=
subtitleLanguage=
subtitleUri=
subtitleUrl=
segmentsSignature=
resumeJson=
rangeSupported=
byteRange=
initRange=
initByteRange=
```

이 흔적은 HLS/DASH의 Resume 상태가 단순 URL만이 아니라 **선택된 화질, Playlist/Manifest, Segment 완료 상태, Byte Range, 자막 상태 등 여러 정보를 포함**할 가능성이 높음을 보여줍니다.

## 2.4 HLS Playlist 처리 흔적

확인된 HLS 관련 항목:

- `.m3u8`
- `/HLSPlaylist.m3u8`
- `auth_master_playlist.m3u8`
- `auth_playlist.m3u8`
- `#EXT-X-BYTERANGE`
- `#EXT-X-DATERANGE`
- `#EXT-X-PLAYLIST-TYPE`
- `#EXT-X-INDEPENDENT-SEGMENTS`

### 해석

단순히 TS Segment를 나열하는 수준이 아니라 다음을 고려해야 합니다.

- Master Playlist / Media Playlist
- 인증 Playlist 형태
- Byte Range Segment
- Playlist Type
- 날짜/시간 메타데이터
- 독립 재생 Segment 선언
- Playlist 갱신 및 Segment 상태 변경

## 2.5 자막 관련 흔적

확인된 문자열:

```text
subtitleUrl
subtitleFormat
subtitleLanguage
subtitleUri
subtitleCount
selectedSubtitleTrack
subtitleTracks
```

또한 다음과 같은 오류 문구 흔적이 확인됩니다.

```text
has a subtitleUrl but no usable subtitleFormat -- skipping subtitle fetch
```

### 해석

자막 URL만 존재한다고 무조건 다운로드하는 것이 아니라, 포맷 식별 가능 여부 등을 검사하는 로직이 있을 수 있습니다. 정확한 자막 지원 형식은 추가 디컴파일 또는 런타임 검증이 필요합니다.

---

# 3. 기능 범위 및 용어 정의

## 3.1 Direct / Progressive Download

단일 파일 URL에서 MP4, WebM, ZIP 등 파일 데이터를 연속적으로 다운로드하는 방식.

- 서버가 Range를 지원하면 이어받기 및 병렬 구간 다운로드 가능
- Range 미지원 시 단일 스트림 방식으로 처리
- 파일 크기 및 ETag/Last-Modified 검증 필요

## 3.2 HLS

M3U8 Playlist가 Segment URL과 재생 정보를 제공하는 스트리밍 방식.

- Variant 화질
- Audio Rendition
- Subtitle Rendition
- Segment
- Init Segment
- Byte Range
- VOD / Live
- 암호화 여부

## 3.3 DASH

MPD가 AdaptationSet 및 Representation을 설명하는 스트리밍 방식.

- Video Representation
- Audio Representation
- Subtitle Representation
- SegmentTemplate
- SegmentTimeline
- SegmentList
- BaseURL
- Initialization Segment

## 3.4 MSE

Media Source Extensions.

웹페이지가 MediaSource/SourceBuffer를 사용해 미디어 데이터를 브라우저에 직접 추가하는 방식. 실제 다운로드 원본 URL이 하나의 MP4로 노출되지 않을 수 있습니다.

## 3.5 Blob URL

`blob:` URL은 브라우저 세션 내에서 생성된 객체 주소일 수 있습니다. 그 주소만 외부 HTTP Downloader에 전달해도 다운로드할 수 없는 경우가 많습니다.

따라서 Blob 감지는 URL만 확보하는 것이 아니라 생성 원본 데이터·MediaSource 연결·세그먼트 데이터의 관계를 파악해야 합니다.

---

# 4. 기능 A — 다운로드 이어받기

## 4.1 목표

앱 종료, 네트워크 중단, 사용자의 Pause, Android 프로세스 종료 등으로 작업이 멈춰도 이미 저장한 데이터를 검증한 뒤 이어받습니다.

## 4.2 Resume 지원 판정

1. URL의 HEAD 요청 또는 작은 Range Probe
2. 응답 상태 검사
3. `Accept-Ranges` 참고
4. 실제 `Range: bytes=0-...` 요청 검증
5. `206 Partial Content` 확인
6. `Content-Range` 검증
7. 전체 파일 크기 확인
8. ETag / Last-Modified 확보

**헤더 하나만 보고 Range 지원으로 확정하지 않습니다.**

## 4.3 서버 응답 판정표

| 응답 | 처리 |
|---|---|
| 206 + 정확한 Content-Range | Range 가능 |
| 200 + Range 무시 | Single stream fallback |
| 416 | 저장 offset 재검증, 필요하면 재시작 |
| 403 | 인증/Referer/Cookie/URL 만료 검사 |
| 404 | URL 유효성 실패 |
| 5xx | 지수형 재시도 |
| ETag 변경 | 기존 Resume 데이터 무효화 검토 |
| Content-Length 변경 | 기존 작업 검증 후 재시작 |

## 4.4 파일 Resume 모델

```kotlin
data class DirectResumeState(
    val taskId: String,
    val sourceUrl: String,
    val fileSize: Long?,
    val etag: String?,
    val lastModified: String?,
    val mimeType: String?,
    val rangeSupported: Boolean,
    val downloadedBytes: Long,
    val outputPath: String,
    val stateUpdatedAt: Long
)
```

## 4.5 Range Request

```http
GET /media/file.mp4
Range: bytes=5242880-
If-Range: "etag-value"
```

- `Range`: 시작 offset부터 요청
- `If-Range`: 원본이 동일한 경우에만 이어받도록 검증
- 서버가 원본 변경을 감지하면 전체 응답을 반환할 수 있으므로 상태코드와 헤더를 확인해야 함

## 4.6 Resume 알고리즘

```text
1. DB에서 Resume 상태 로드
2. 실제 파일 크기 확인
3. DB 기록과 파일 크기 불일치 검사
4. 원본 URL 재검증
5. ETag / Last-Modified / 크기 비교
6. 동일 파일 확인
7. Range 요청으로 이어받기
8. 응답 Content-Range 검사
9. 파일에 Append
10. 진행상태 저장
11. 완료 시 전체 크기 및 무결성 검사
12. 최종 파일로 Commit
```

## 4.7 저장 안전성

작업 파일과 최종 파일을 구분합니다.

```text
filename.mp4.download
filename.mp4
```

완료 전 `.download`를 사용하고 검증 완료 후 최종 이름으로 원자적 Rename을 시도합니다. Rename이 실패하는 Storage에서는 별도 복사·완료 마커 전략을 사용합니다.

---

# 5. 기능 B — 병렬 분할 다운로드

## 5.1 목적

서버가 Range를 정확하게 지원하고 네트워크가 병렬 연결을 허용하는 경우 파일을 여러 구간으로 나눠 동시에 다운로드합니다.

## 5.2 구간 계산

파일 크기 `S`, 구간 수 `N`:

```text
chunkSize = floor(S / N)

part[i].start = i * chunkSize

part[i].end =
    (i == N - 1)
    ? S - 1
    : start + chunkSize - 1
```

마지막 구간이 남는 바이트를 포함합니다.

## 5.3 예시

1GB 파일, 4개 구간:

```text
Part 0: 0 - 249,999,999
Part 1: 250,000,000 - 499,999,999
Part 2: 500,000,000 - 749,999,999
Part 3: 750,000,000 - 999,999,999
```

## 5.4 Part 모델

```kotlin
data class DownloadPartEntity(
    val taskId: String,
    val partIndex: Int,
    val startByte: Long,
    val endByte: Long,
    val downloadedBytes: Long,
    val status: PartStatus,
    val retryCount: Int,
    val tempPath: String
)

enum class PartStatus {
    QUEUED,
    RUNNING,
    PAUSED,
    RETRYING,
    COMPLETED,
    FAILED
}
```

## 5.5 Part별 요청

```http
GET /file
Range: bytes=0-249999999
```

응답 검증:

- HTTP 206
- Content-Range 시작/끝 일치
- 전체 크기 일치
- 응답 Body 실제 크기
- ETag 일치

## 5.6 병렬 동시성

기본값 예시:

| 파일 크기 | Part 개수 |
|---|---:|
| 50MB 미만 | 1 |
| 50~200MB | 2 |
| 200MB~1GB | 4 |
| 1GB 이상 | 4~8 |

이는 시작점일 뿐이며 서버 제한, 네트워크 및 저장장치 속도에 따라 동적으로 조정해야 합니다.

## 5.7 병렬 다운로드가 오히려 느려지는 경우

- 서버 연결 제한
- CDN에서 Range별 처리 비용 증가
- 모바일 네트워크
- 낮은 저장장치 쓰기 속도
- TLS 연결 오버헤드
- 서버가 Range 요청을 무시
- 각 연결의 속도 제한

따라서 자동 최적화는 1 → 2 → 4 Part 등 단계적으로 적용하고 속도 측정 결과를 기반으로 선택해야 합니다.

## 5.8 Part 병합

병합 전 검사:

- 모든 Part가 완료 상태인가?
- 각 Part 파일 길이가 예상 길이와 일치하는가?
- Part 인덱스 누락이 없는가?
- 동일 Task에 다른 원본 ETag가 섞이지 않았는가?

병합 순서:

```text
part_000
part_001
part_002
...
part_N
```

Binary concat으로 임시 최종 파일 생성 후 길이 검증, 파일 시그니처/MIME 검사, 최종 Rename.

---

# 6. 기능 C — 웹페이지 미디어 감지

## 6.1 감지 단계

```text
Browser Navigation
    ↓
Page Load
    ↓
Media Detector Injection
    ↓
DOM Media Scan
    ├─ video
    ├─ audio
    └─ source
    ↓
Player Event Monitoring
    ↓
Network/URL Candidate Discovery
    ↓
MSE / Blob Hook
    ↓
Native Bridge
    ↓
Candidate Normalize + Deduplicate
    ↓
Media List UI
```

## 6.2 HTML 요소 감지

대상:

```html
<video src="...">
<video>
  <source src="...">
</video>

<audio src="...">
<source src="...">
```

관찰 속성:

- `src`
- `currentSrc`
- `poster`
- `videoWidth`
- `videoHeight`
- `duration`
- `readyState`
- `networkState`
- `title`

이벤트:

- `loadedmetadata`
- `durationchange`
- `loadeddata`
- `play`
- `playing`
- `canplay`

## 6.3 동적 DOM

사이트는 영상 요소를 나중에 생성할 수 있으므로 최초 1회 Scan으로 끝내면 안 됩니다.

권장:

- MutationObserver
- 페이지 이동 감지
- Video Element 재탐색
- 이벤트 Listener 중복 방지
- URL 변경 감지
- 주기적 Scan은 제한적으로 사용
- Bridge 전송 데이터 Debounce

## 6.4 URL 분류기

```kotlin
enum class MediaKind {
    DIRECT_VIDEO,
    DIRECT_AUDIO,
    HLS,
    DASH,
    MSE,
    BLOB,
    UNKNOWN
}
```

분류 근거를 여러 개 조합합니다.

1. MIME Type
2. URL 확장자
3. Manifest 내용
4. HTML Element
5. MediaSource API Hook
6. HTTP 응답 헤더
7. 페이지 Context

URL 확장자만으로 분류하면 오탐이 발생할 수 있습니다.

## 6.5 감지 후보 데이터

```kotlin
data class DetectedMedia(
    val id: String,
    val pageUrl: String,
    val title: String?,
    val sourceUrl: String,
    val mediaKind: MediaKind,
    val mimeType: String?,
    val width: Int?,
    val height: Int?,
    val durationMs: Long?,
    val bitrate: Long?,
    val posterUrl: String?,
    val detectedAt: Long,
    val requestHeaders: Map<String, String>?,
    val confidence: DetectionConfidence
)
```

민감한 인증 Header/Cookie는 일반 DB나 로그에 평문으로 저장하지 않습니다.

## 6.6 중복 후보 통합

동일 영상에서 다음 후보가 동시에 감지될 수 있습니다.

- Video src
- Current src
- Source element
- Manifest URL
- MSE 내부 Segment URL
- 다른 CDN URL

정규화 기준:

- URL query를 무조건 제거하지 않음 (서명·토큰일 수 있음)
- fragment는 필요에 따라 제거
- 제목·길이·해상도·Manifest 정보
- 동일 페이지 및 미디어 요소 식별자
- 후보 유형 및 감지 시각

같은 영상임을 확실히 판단하지 못하면 하나로 합치지 않고 후보로 유지합니다.

---

# 7. 기능 D — MSE 및 Blob 감지

## 7.1 왜 필요합니까?

일부 웹페이지는 영상 URL을 `video.src`에 직접 넣지 않습니다.

```text
Page JS
    ↓
MediaSource
    ↓
SourceBuffer
    ↓
appendBuffer()
    ↓
Browser Decoder
```

브라우저는 이미 데이터를 받아 조각 단위로 조립하지만 앱의 감지 스크립트는 실제 원본 URL을 찾지 못할 수 있습니다.

## 7.2 MSE Hook 개념

관찰 대상:

- `MediaSource`
- `ManagedMediaSource` (기기/브라우저 지원 여부에 따라)
- `SourceBuffer`
- `addSourceBuffer(mimeType)`
- `appendBuffer(data)`
- `remove()`
- `endOfStream()`

Barrel APK에는 `MediaSource.prototype`, `SourceBuffer.prototype`, `addSourceBuffer`를 탐색하는 Hook 문자열 흔적이 확인됩니다.

## 7.3 Hook의 한계

Hook이 알아낼 수 있는 것:

- SourceBuffer MIME/Codec
- 데이터가 추가되는 순서
- MediaSource/SourceBuffer 관계
- 일부 Segment 처리 패턴

Hook만으로 항상 알 수 없는 것:

- 원본 서버 URL
- Segment의 인증정보
- 암호화된 데이터의 복호화 키
- 영상 전체를 원래 파일로 재구성할 수 있는지
- 사이트 자체 DRM 정책

MSE Hook은 감지 기능이지 DRM 우회 도구로 설계하지 않습니다.

## 7.4 Blob URL

`blob:` URL은 일반 HTTP URL처럼 다운로드 요청할 수 없는 경우가 있습니다.

권장 정책:

- Blob URL을 직접 Downloader에 넘기지 않음
- 생성 원본 또는 실제 Network URL 탐색
- 앱이 허용된 범위에서 Blob 데이터의 존재와 MIME을 감지
- 원본 확보가 불가능하면 `지원 제한`으로 표시
- 페이지 JS를 통한 Blob 데이터 무제한 복사로 메모리 고갈시키지 않음

---

# 8. 기능 E — 화질 선택

## 8.1 Quality 항목

```kotlin
data class MediaQualityOption(
    val id: String,
    val label: String,
    val width: Int?,
    val height: Int?,
    val bitrate: Long?,
    val codecs: String?,
    val container: String?,
    val videoUrl: String?,
    val audioUrl: String?,
    val streamType: MediaKind,
    val estimatedSize: Long?,
    val isMuxed: Boolean
)
```

## 8.2 표시 Label 생성

우선순위:

1. 실제 해상도
2. Manifest의 Quality Label
3. Bitrate
4. Codec
5. 예상 용량

예:

```text
2160p · 4K
1440p
1080p
720p
480p
360p
Audio only
```

해상도 정보가 없으면 임의로 `1080p` 등을 표시하지 않습니다.

## 8.3 Quality Grouping

같은 영상의 Variant를 하나의 Media Group으로 묶습니다.

```text
Video Group
 ├─ 1080p
 ├─ 720p
 ├─ 480p
 └─ Audio
```

Grouping 근거:

- 같은 Manifest
- 같은 페이지/Media Element
- 유사 Duration
- Codec/Track 관계
- Manifest Variant 구조

URL 문자열만 비슷하다는 이유로 그룹화하지 않습니다.

## 8.4 Quality 선택 저장

Resume 시 원래 선택한 화질을 유지합니다.

```json
{
  "selectedQualityId": "variant-1080",
  "qualityLabel": "1080p",
  "sourceManifest": "manifest-url",
  "selectionUpdatedAt": 0
}
```

Manifest가 변경되면 Quality ID가 사라질 수 있으므로 재매핑 또는 사용자 재선택을 요청합니다.

---

# 9. 기능 F — HLS

## 9.1 Playlist 종류

### Master / Multivariant Playlist

다른 화질, 오디오, 자막 Playlist를 참조합니다.

### Media Playlist

실제 Segment URL과 재생 정보를 포함합니다.

## 9.2 HLS Parser

Parser는 문자열을 단순 Split하는 방식보다 Tag별 State Machine 형태로 구현합니다.

주요 Tag:

- `#EXTM3U`
- `#EXT-X-STREAM-INF`
- `#EXT-X-MEDIA`
- `#EXTINF`
- `#EXT-X-MAP`
- `#EXT-X-BYTERANGE`
- `#EXT-X-KEY`
- `#EXT-X-DISCONTINUITY`
- `#EXT-X-ENDLIST`
- `#EXT-X-PLAYLIST-TYPE`
- `#EXT-X-DATERANGE`

## 9.3 HLS 데이터 모델

```kotlin
data class HlsMasterPlaylist(
    val url: String,
    val variants: List<HlsVariant>,
    val audioRenditions: List<HlsRendition>,
    val subtitleRenditions: List<HlsRendition>
)

data class HlsVariant(
    val id: String,
    val playlistUrl: String,
    val bandwidth: Long?,
    val averageBandwidth: Long?,
    val width: Int?,
    val height: Int?,
    val codecs: String?,
    val audioGroup: String?,
    val subtitleGroup: String?
)

data class HlsMediaPlaylist(
    val url: String,
    val targetDuration: Double?,
    val isLive: Boolean,
    val endList: Boolean,
    val segments: List<HlsSegment>,
    val initSegment: HlsInitSegment?,
    val encryption: HlsEncryption?
)

data class HlsSegment(
    val index: Int,
    val url: String,
    val durationSeconds: Double,
    val byteRangeOffset: Long?,
    val byteRangeLength: Long?,
    val discontinuity: Boolean,
    val sequenceNumber: Long
)
```

## 9.4 Segment 다운로드

각 Segment 작업 상태:

```text
QUEUED
RUNNING
COMPLETED
RETRYING
FAILED
```

다운로드 시:

- URL 상대경로 해석
- Query Token 유지
- Referer/Cookie 필요 시 세션 전달
- Byte Range 적용
- Segment 크기 검증
- Hash는 가능하면 검증
- 실패 재시도
- 완료 DB 기록

## 9.5 HLS Resume

HLS는 일반 파일처럼 단순 Byte Offset Resume보다 Segment 완료 상태 기반 복구를 사용합니다.

```json
{
  "type": "HLS",
  "manifestUrl": "...",
  "selectedVariantId": "...",
  "playlistUrl": "...",
  "playlistSignature": "...",
  "completedSegments": [0, 1, 2, 3, 4],
  "segmentCount": 180,
  "initSegmentCompleted": true,
  "status": "PAUSED"
}
```

### Playlist Signature

Resume 안정성을 위해 다음 정보로 Signature를 생성할 수 있습니다.

- Playlist URL (Token은 저장 정책 적용)
- Segment URL/Sequence
- Segment Byte Range
- Init Segment
- Variant 선택
- Manifest 변경 시각/내용 일부

Signature가 변경되면 완료 Segment를 무조건 재사용하지 않습니다.

## 9.6 VOD와 Live 구분

### VOD

- Playlist 종료 여부 확인
- 전체 Segment가 확정된 경우
- 전체 용량 계산 가능할 수 있음
- 완료 후 Mux

### Live

- Playlist가 계속 갱신
- 전체 크기 미확정
- Segment가 사라질 수 있음
- 다운로드 기간/종료 시점 설정 필요
- Resume 시 Playlist가 이동했을 수 있음

Live는 VOD와 별도 작업 정책으로 처리합니다.

## 9.7 HLS 병합

단순 TS Concatenation은 모든 HLS에 적용할 수 없습니다.

처리 단계:

1. Segment 완료 검사
2. Segment 순서/Sequence 확인
3. Init Segment 확인
4. Discontinuity 처리
5. Container/Codec 확인
6. Muxer 또는 적합한 Container 처리
7. 출력 파일 검사
8. 자막/Track 메타데이터 처리
9. 최종 파일 Commit

---

# 10. 기능 G — DASH

## 10.1 MPD Parser

MPD는 XML Parser로 읽어야 하며, 문자열 검색만으로 파싱하지 않습니다.

주요 요소:

- `MPD`
- `Period`
- `AdaptationSet`
- `Representation`
- `BaseURL`
- `SegmentTemplate`
- `SegmentTimeline`
- `SegmentList`
- `SegmentBase`
- `Initialization`
- `Role`
- `ContentProtection`

## 10.2 Representation 선택

Video:

- Resolution
- Bandwidth
- Codec
- Frame Rate
- HDR/SDR

Audio:

- Language
- Role
- Codec
- Bandwidth
- Channel

Subtitle:

- Language
- MIME
- Format
- Role

## 10.3 DASH 데이터 모델

```kotlin
data class DashManifestInfo(
    val manifestUrl: String,
    val durationMs: Long?,
    val periods: List<DashPeriod>
)

data class DashPeriod(
    val id: String?,
    val durationMs: Long?,
    val video: List<DashRepresentation>,
    val audio: List<DashRepresentation>,
    val subtitles: List<DashRepresentation>
)

data class DashRepresentation(
    val id: String,
    val mimeType: String?,
    val codecs: String?,
    val bandwidth: Long?,
    val width: Int?,
    val height: Int?,
    val language: String?,
    val baseUrl: String?,
    val initialization: DashSegment?,
    val segments: List<DashSegment>
)

data class DashSegment(
    val index: Int,
    val url: String,
    val rangeStart: Long?,
    val rangeLength: Long?,
    val time: Long?,
    val duration: Long?
)
```

## 10.4 DASH Resume

```json
{
  "type": "DASH",
  "manifestUrl": "...",
  "selectedVideoRepresentation": "video-1080",
  "selectedAudioRepresentation": "audio-ko",
  "videoSegmentsDone": [0, 1, 2],
  "audioSegmentsDone": [0, 1, 2, 3],
  "initializationDone": true,
  "manifestSignature": "...",
  "status": "PAUSED"
}
```

Video/Audio Segment 완료 상태는 별도로 저장해야 합니다.

## 10.5 DASH Merge

```text
Video Initialization + Video Segments
Audio Initialization + Audio Segments
                  ↓
Track Validation
                  ↓
Timestamp / Duration Validation
                  ↓
Muxer
                  ↓
Final Container
```

모든 DASH가 MP4로 출력 가능한 것은 아닙니다. 코덱/Container 조합에 따라 원본 Container 유지 또는 다른 처리 경로가 필요합니다.

---

# 11. 기능 H — 자막

## 11.1 자막 소스

- HTML Track
- HLS Subtitle Rendition
- DASH Subtitle Representation
- 외부 Subtitle URL
- Manifest Metadata

## 11.2 Subtitle 모델

```kotlin
data class SubtitleTrackInfo(
    val id: String,
    val language: String?,
    val displayName: String?,
    val mimeType: String?,
    val format: SubtitleFormat,
    val sourceUrl: String?,
    val isDefault: Boolean
)

enum class SubtitleFormat {
    SRT,
    WEBVTT,
    TTML,
    UNKNOWN
}
```

## 11.3 저장 정책

- 원본 자막 별도 파일 저장 기본
- 파일명에 언어 suffix
- 자막이 여러 개면 각각 저장
- 다운로드 완료 후 자막 연결 정보 기록
- 지원하지 않는 포맷은 원본 저장 또는 명시적 미지원
- 자막 Burn-in은 기본 기능에서 제외

예:

```text
Movie.mp4
Movie.ko.vtt
Movie.en.srt
Movie.metadata.json
```

---

# 12. 기능 I — 영상/음성 Muxing

## 12.1 Mux와 Transcode 구분

| 처리 | 설명 | 재인코딩 |
|---|---|---|
| Mux | 여러 Track을 하나의 Container로 결합 | 보통 없음 |
| Transcode | Codec/해상도/Bitrate 변경 | 있음 |
| Concatenate | 파일/Segment를 순서대로 결합 | 형식에 따라 가능/불가 |

원본 화질 유지 목표라면 Muxing을 우선합니다.

## 12.2 Mux 전 검사

- Video Track 유효
- Audio Track 유효
- Codec 지원
- Container 지원
- Timestamp 정상
- Duration 차이 허용 범위
- Init Segment 존재
- Discontinuity 처리
- Subtitle Track 처리 정책

## 12.3 Media3 우선 검토

Android 공식 Media3에는 Offline Download Manager 및 HLS/DASH Downloader 구현이 제공됩니다. 자체 Parser/Downloader를 처음부터 만드는 것보다 Media3의 DownloadHelper/Downloader 계층을 검토하고, Maglev+에 필요한 사용자 선택·Resume·UI·정책만 별도 계층으로 구현하는 전략이 유리할 수 있습니다.

단, Barrel APK가 Media3를 사용한다고 해서 모든 내부 기능이 Media3 표준 구현이라고 확정할 수는 없습니다.

---

# 13. 기능 J — 다운로드 중 재생

## 13.1 Direct File

Progressive MP4의 파일 구조에 따라 다운로드 중 재생 가능 여부가 달라집니다.

- MP4 Metadata 위치
- Moov Atom 위치
- 이미 다운로드된 범위
- Player의 Seek 요청
- 파일 동시 읽기/쓰기 안정성

다운로드 중인 파일을 무조건 MediaPlayer에 직접 열어 재생하는 것은 보장하지 않습니다.

## 13.2 HLS/DASH

가능한 접근:

- 완료된 Segment를 Player가 읽도록 Cache 기반 처리
- Segment 완료 상태 공유
- Player가 요청한 Segment를 우선 다운로드
- 다운로드 Scheduler와 Playback Scheduler 협력

## 13.3 우선순위

```text
Playback-required segment
       ↓
High Priority

Normal download segments
       ↓
Normal Priority
```

Player가 재생 중인 Segment를 요청하면 해당 Segment를 우선 처리하는 구조가 필요합니다.

---

# 14. 공통 Download Manager

## 14.1 책임

Download Manager는 각 Engine을 직접 구현하지 않고 작업을 분배하고 상태를 통합 관리합니다.

```kotlin
interface DownloadEngine {
    suspend fun enqueue(task: DownloadTask)
    suspend fun pause(taskId: String)
    suspend fun resume(taskId: String)
    suspend fun cancel(taskId: String)
    fun observe(taskId: String): Flow<DownloadProgress>
}
```

## 14.2 Engine Registry

```kotlin
class DownloadEngineRegistry(
    private val direct: DirectDownloadEngine,
    private val hls: HlsDownloadEngine,
    private val dash: DashDownloadEngine
) {
    fun resolve(type: DownloadType): DownloadEngine {
        return when (type) {
            DownloadType.DIRECT -> direct
            DownloadType.HLS -> hls
            DownloadType.DASH -> dash
        }
    }
}
```

## 14.3 공통 상태

```kotlin
enum class DownloadStatus {
    DETECTED,
    QUEUED,
    PREPARING,
    RUNNING,
    PAUSING,
    PAUSED,
    RETRYING,
    MERGING,
    VERIFYING,
    COMPLETED,
    FAILED,
    CANCELED
}
```

상태 전환을 명시적으로 관리하여 UI와 DB의 상태가 서로 달라지지 않도록 합니다.

---

# 15. DB 설계

## 15.1 테이블

```text
download_task
    ├── direct_part
    ├── hls_segment
    ├── dash_segment
    ├── selected_track
    ├── subtitle_track
    └── download_event
```

## 15.2 DownloadTask

필드:

- Task ID
- Page URL
- Media URL/Manifest URL
- Title
- Filename
- Media Type
- Selected Quality
- Output URI
- Status
- Total Bytes
- Downloaded Bytes
- ETag
- Last-Modified
- MIME
- Retry Count
- Created/Updated Time
- Error Code/Message

## 15.3 Segment/Part 공통 상태

- Parent Task ID
- Index
- Source URL
- Byte Range
- Expected Bytes
- Actual Bytes
- Status
- Retry Count
- Temp Path
- Hash (선택)
- Completed At

## 15.4 Resume 데이터

Resume JSON을 DB에 통째로 저장하는 방식은 빠르게 시작할 수 있지만, Segment가 많아지면 개별 상태를 Room Entity로 관리하는 편이 조회·복구·부분 업데이트에 유리합니다.

---

# 16. HTTP 및 인증 세션

## 16.1 요청 Context

웹페이지에서 감지된 URL을 다운로드할 때 필요한 요청 Context:

- Referer
- User-Agent
- Cookie
- Authorization (필요 시)
- Origin
- Accept
- Custom Headers

이 정보를 무조건 모든 다운로드에 복사하면 안 됩니다. URL Host 및 요청 목적에 맞게 필요한 Header만 사용합니다.

## 16.2 세션 연결

```text
WebView Session
    │
    ├── Cookie Store
    ├── User Agent
    └── Page Context
          ↓
Download Request Context
          ↓
HTTP Client
```

Cookie를 Android 로그나 평문 파일에 저장하지 않습니다.

## 16.3 URL 만료

Manifest/Segment URL은 Token이 포함되어 있고 시간이 지나면 만료될 수 있습니다.

Resume 실패 시:

1. HTTP 상태 검사
2. 인증 실패/URL 만료 분류
3. Browser 페이지 Context 확인
4. Media 재감지
5. 동일 콘텐츠의 새 Manifest/URL 확보
6. 기존 Segment 완료 상태와 새 Manifest 비교
7. 동일 Segment만 안전하게 재사용
8. 나머지 재다운로드

---

# 17. 저장 공간 / 파일 시스템

## 17.1 사전 검사

다운로드 시작 전:

- 예상 용량
- 현재 저장 공간
- 병합 시 추가 공간
- Temporary Part 저장 공간
- SAF/MediaStore 쓰기 권한

대용량 병렬 다운로드는 최종 파일과 Part 임시 파일이 동시에 존재할 수 있으므로 실제 필요 공간을 보수적으로 계산해야 합니다.

## 17.2 저장 정책

사용자 선택:

- 앱 전용 저장
- Downloads
- SAF 선택 폴더
- MediaStore

권장:

- DB에는 URI 및 내부 작업 파일 경로 저장
- Android 10+ Scoped Storage 정책 준수
- 파일 이름 sanitize
- 동일 파일명 충돌 방지
- 임시 파일 정리
- 완료 파일 삭제 시 DB 상태 동기화

---

# 18. Background / Lifecycle

## 18.1 구성

```text
Download Orchestrator
       │
       ├── Foreground Service
       │       └── Ongoing Notification
       │
       ├── Room
       │
       ├── Worker
       │       └── Retry / Recovery
       │
       └── Boot / App Launch Recovery
```

## 18.2 Foreground Service

긴 다운로드 작업은 Android 정책에 맞는 Foreground Service 및 Notification을 검토합니다. Android 버전에 따라 Service Type 및 Permission 요구사항을 확인합니다.

## 18.3 WorkManager

적합한 작업:

- 실패한 다운로드 재시도 예약
- 상태 복구
- 완료 후 후처리
- 네트워크 조건 대기
- 오래된 임시 파일 청소

실시간 Download Engine을 WorkManager의 짧은 작업 실행에만 종속시키지 않습니다.

## 18.4 프로세스 종료 복구

앱 실행:

```text
Recovery Coordinator
    ↓
DB 작업 조회
    ↓
RUNNING / PAUSING 상태 확인
    ↓
Storage 상태 확인
    ↓
Part/Segment 검사
    ↓
Manifest/ETag 검증
    ↓
Resume 가능한 작업 재등록
    ↓
불가능한 작업은 사용자에게 오류 설명
```

---

# 19. 오류 분류 및 재시도

## 19.1 오류 분류

```kotlin
enum class DownloadErrorCode {
    NETWORK_TIMEOUT,
    CONNECTION_RESET,
    HTTP_403,
    HTTP_404,
    HTTP_416,
    HTTP_429,
    HTTP_5XX,
    RANGE_UNSUPPORTED,
    CONTENT_CHANGED,
    URL_EXPIRED,
    AUTH_REQUIRED,
    STORAGE_FULL,
    FILE_IO,
    MANIFEST_PARSE,
    SEGMENT_MISSING,
    MUX_FAILED,
    UNSUPPORTED_FORMAT,
    USER_CANCELED,
    UNKNOWN
}
```

## 19.2 Retry Policy

| 오류 | 자동 재시도 |
|---|---|
| Timeout | 가능 |
| Connection Reset | 가능 |
| 5xx | 가능 |
| 429 | Retry-After 준수 |
| 403 | 무조건 반복하지 않음 |
| 404 | 반복하지 않음 |
| Range Unsupported | Single Mode 전환 |
| ETag Changed | 재검증 후 Restart |
| Storage Full | 사용자 공간 확보 요청 |
| Parse Error | 자동 재시도 제한 |
| Mux Error | 원본/Track 검사 후 제한 |

## 19.3 Backoff

```text
Retry 1: 1 sec
Retry 2: 2 sec
Retry 3: 4 sec
Retry 4: 8 sec
Retry 5: 16 sec
```

Jitter를 추가하고 Retry 횟수 상한을 설정합니다. 사용자가 수동 Retry를 누르면 별도 재시도 정책을 적용할 수 있습니다.

---

# 20. UI/UX 상세

## 20.1 감지 Media Sheet

표시:

- Thumbnail
- 제목
- 사이트/페이지
- Media Type
- 감지된 화질
- Duration
- 예상 용량
- 다운로드 가능 상태

Action:

- 다운로드
- 화질 선택
- 자막 선택
- 상세

## 20.2 Quality Picker

```text
영상
 ├─ 2160p
 ├─ 1440p
 ├─ 1080p
 ├─ 720p
 ├─ 480p
 └─ Audio Only

Audio
 ├─ 한국어
 ├─ 영어
 └─ 원본

Subtitle
 ├─ 한국어
 ├─ 영어
 └─ 없음
```

실제 존재하지 않는 화질/언어 옵션은 표시하지 않습니다.

## 20.3 Download Queue

상태별 탭:

- 진행 중
- 대기
- 실패
- 완료

Task 카드:

- Title
- Thumbnail
- Quality
- Type
- Progress
- Speed
- ETA
- Size
- Status

Action:

- Pause
- Resume
- Retry
- Cancel
- Delete
- Play
- Open

## 20.4 상세 화면

- 원본 URL
- 페이지 URL
- Download Type
- Quality
- Size
- Progress
- Speed
- ETA
- Segment/Part
- Retry Count
- Save Path
- Error Detail

오류는 사용자에게 이해 가능한 설명과 기술 상세를 분리합니다.

---

# 21. 보안 및 개인정보

## 21.1 웹 Bridge 보안

- 신뢰할 수 있는 Browser WebView에서만 Native Bridge 활성화
- 외부 링크 이동 시 Bridge 노출 정책 재평가
- Bridge Payload 크기 제한
- URL Scheme 검증
- JavaScript 메시지 검증
- 입력 JSON 검증
- Native API 최소 노출
- 감지 URL 로그 마스킹

## 21.2 URL 및 Header

- Token이 포함된 URL 로그 금지
- Cookie 로그 금지
- Authorization 로그 금지
- URL query에 민감정보가 있는 경우 UI/기록에서 마스킹
- Resume 저장 시 인증 Header를 암호화 또는 재획득 정책으로 관리

## 21.3 DRM

DRM 보호 콘텐츠의 키 추출·복호화·보호 우회는 구현 범위에 포함하지 않습니다.

- DRM 콘텐츠는 DRM 지원 플레이어의 정상 재생 경로
- 다운로드는 서비스가 허용한 공식 Offline 경로가 있는 경우만
- DRM 감지 시 Unsupported/Protected Content 표시

---

# 22. 구현 파일 구조 권장

```text
feature/
├── browser/
│   ├── BrowserScreen.kt
│   ├── BrowserViewModel.kt
│   ├── WebViewController.kt
│   ├── MediaDetectorScript.kt
│   ├── MediaBridge.kt
│   └── WebSessionContext.kt
│
├── media_detection/
│   ├── MediaDetectionEngine.kt
│   ├── HtmlMediaDetector.kt
│   ├── MseDetector.kt
│   ├── BlobDetector.kt
│   ├── NetworkMediaDetector.kt
│   ├── MediaUrlClassifier.kt
│   ├── MediaCandidate.kt
│   └── MediaDeduplicator.kt
│
├── download/
│   ├── DownloadManager.kt
│   ├── DownloadOrchestrator.kt
│   ├── DownloadEngineRegistry.kt
│   ├── DownloadTask.kt
│   ├── DownloadStatus.kt
│   ├── DownloadProgress.kt
│   ├── DownloadSettings.kt
│   │
│   ├── direct/
│   │   ├── DirectDownloadEngine.kt
│   │   ├── RangeSupportProbe.kt
│   │   ├── RangeDownloader.kt
│   │   ├── PartPlanner.kt
│   │   ├── PartDownloader.kt
│   │   ├── PartMerger.kt
│   │   └── DirectResumeManager.kt
│   │
│   ├── hls/
│   │   ├── HlsParser.kt
│   │   ├── HlsPlaylistModels.kt
│   │   ├── HlsQualitySelector.kt
│   │   ├── HlsSegmentDownloader.kt
│   │   ├── HlsResumeManager.kt
│   │   └── HlsAssembler.kt
│   │
│   ├── dash/
│   │   ├── DashMpdParser.kt
│   │   ├── DashModels.kt
│   │   ├── DashRepresentationSelector.kt
│   │   ├── DashSegmentDownloader.kt
│   │   ├── DashResumeManager.kt
│   │   └── DashAssembler.kt
│   │
│   ├── subtitle/
│   │   ├── SubtitleDetector.kt
│   │   ├── SubtitleDownloader.kt
│   │   ├── SubtitleFormatResolver.kt
│   │   └── SubtitleConverter.kt
│   │
│   ├── mux/
│   │   ├── MuxCoordinator.kt
│   │   ├── TrackValidator.kt
│   │   ├── ContainerValidator.kt
│   │   └── MuxResult.kt
│   │
│   ├── persistence/
│   │   ├── DownloadDatabase.kt
│   │   ├── DownloadTaskDao.kt
│   │   ├── PartDao.kt
│   │   ├── SegmentDao.kt
│   │   ├── DownloadRecovery.kt
│   │   └── ResumeSnapshot.kt
│   │
│   ├── service/
│   │   ├── DownloadForegroundService.kt
│   │   ├── DownloadNotification.kt
│   │   ├── DownloadWorker.kt
│   │   └── RetryWorker.kt
│   │
│   ├── storage/
│   │   ├── DownloadStorage.kt
│   │   ├── TemporaryFileManager.kt
│   │   ├── StorageSpaceChecker.kt
│   │   └── OutputCommitter.kt
│   │
│   └── playback/
│       ├── DownloadPlaybackController.kt
│       ├── CachePlaybackSource.kt
│       └── SegmentPriorityScheduler.kt
│
└── ui/
    ├── DetectedMediaSheet.kt
    ├── QualityPicker.kt
    ├── SubtitlePicker.kt
    ├── DownloadQueueScreen.kt
    ├── DownloadTaskCard.kt
    ├── DownloadDetailScreen.kt
    └── DownloadPlayerScreen.kt
```

---

# 23. 구현 단계별 작업 계획

## Phase 0 — 현재 프로젝트 조사

- Maglev+ 현재 branch 확인
- 기존 Download 관련 코드 검색
- 현재 Browser/WebView 구조 파악
- URL 감지 코드 확인
- Player/Media3 의존성 확인
- 기존 DB 및 저장 구조 확인
- 기존 UI 기능과 충돌 위험 확인
- 현재 빌드/테스트 기준선 확보

**이 단계에서는 코드 수정하지 않습니다.**

## Phase 1 — Direct Download

- Task Model
- Room DB
- Single Download
- Range Probe
- Resume
- Part Planner
- Parallel Part Download
- Part Merge
- Retry
- Pause/Cancel
- Recovery

### 완료 조건

- Range 지원 서버에서 이어받기 성공
- Range 미지원 서버는 단일 방식으로 자동 전환
- 앱 강제 종료 후 복구
- Part 손상 검출
- ETag 변경 대응
- 최종 파일 길이 검증

## Phase 2 — Media Detection

- HTML Video/Audio
- Source
- MutationObserver
- WebView Bridge
- URL Classifier
- Duplicate Merge
- Detection UI
- Cookie/Referer Context

### 완료 조건

- 페이지 로드 후 영상 감지
- 늦게 생성되는 영상 감지
- 같은 영상 중복 표시 억제
- URL/MIME 분류
- 페이지 전환 시 감지 상태 관리

## Phase 3 — HLS

- Master Playlist
- Variant 선택
- Audio/Subtitles
- Media Playlist
- Segment Download
- Segment Resume
- Byte Range
- Init Segment
- VOD
- 기본 Live 정책
- Mux/Output Validation

## Phase 4 — DASH

- MPD XML Parser
- Representation
- SegmentTemplate
- SegmentTimeline
- SegmentList
- BaseURL
- Audio/Video 선택
- Segment Resume
- Mux
- Subtitle

## Phase 5 — MSE / Blob 고급 감지

- MediaSource Hook
- SourceBuffer Hook
- Blob URL 감지
- Media 데이터 흐름 후보
- 제한된 데이터 수집
- 사이트별 호환성 검증

## Phase 6 — Playback Integration

- Download Cache
- Completed Segment Playback
- Progressive Playback
- Playback Segment Priority
- Player/Download 상태 동기화

## Phase 7 — Hardening

- Storage Full
- Network Flapping
- HTTP 429
- URL Expiry
- Session Expiry
- Crash Recovery
- Corrupt Part
- Manifest Changed
- Duplicate Tasks
- Security Review
- SAST/Dependency Scan
- Real-device Test

---

# 24. 테스트 시나리오

## 24.1 Direct

| ID | 테스트 | 기대 결과 |
|---|---|---|
| D-01 | Range 지원 파일 | Range Probe 통과 |
| D-02 | Range 미지원 파일 | Single Mode |
| D-03 | 다운로드 중 Pause | 상태 및 파일 유지 |
| D-04 | 앱 강제 종료 | 재실행 후 Resume |
| D-05 | ETag 변경 | 기존 파일 무결성 보호 |
| D-06 | 서버 416 | Offset 재검증 |
| D-07 | Part 하나 실패 | 해당 Part만 재시도 |
| D-08 | Part 병합 | 순서 및 전체 길이 검증 |
| D-09 | 저장공간 부족 | 안전 중단 |
| D-10 | URL 만료 | 오류 분류 및 재감지 안내 |

## 24.2 Media Detection

| ID | 테스트 | 기대 결과 |
|---|---|---|
| M-01 | HTML MP4 | Direct 후보 |
| M-02 | Video + Source | 중복 제거 |
| M-03 | 동적 Video 생성 | MutationObserver 감지 |
| M-04 | HLS URL | HLS 분류 |
| M-05 | DASH URL | DASH 분류 |
| M-06 | Blob URL | Blob 상태 표시 |
| M-07 | MSE | MSE 감지 정보 |
| M-08 | 페이지 이동 | 이전 후보 정리/정책 적용 |
| M-09 | 동일 미디어 여러 URL | Grouping 검증 |
| M-10 | Cookie 필요 사이트 | 세션 Context 유지 |

## 24.3 HLS

| ID | 테스트 | 기대 결과 |
|---|---|---|
| H-01 | Master Playlist | Variant 목록 |
| H-02 | 1080p 선택 | 해당 Variant 선택 |
| H-03 | Audio Rendition | 선택/다운로드 |
| H-04 | Subtitle | 언어 선택 |
| H-05 | Segment 실패 | Segment Retry |
| H-06 | Resume | 완료 Segment 유지 |
| H-07 | Byte Range | 정확한 범위 다운로드 |
| H-08 | Init Segment | 정상 처리 |
| H-09 | Discontinuity | 처리 또는 명시적 제한 |
| H-10 | Live Playlist | Live 정책 동작 |

## 24.4 DASH

| ID | 테스트 | 기대 결과 |
|---|---|---|
| A-01 | MPD parse | Representation |
| A-02 | Video quality select | 선택 Track |
| A-03 | Audio language | 선택 Track |
| A-04 | SegmentTemplate | URL 계산 |
| A-05 | SegmentTimeline | 시간/번호 처리 |
| A-06 | Resume | Segment 완료 상태 복구 |
| A-07 | Video/Audio Mux | 정상 출력 |
| A-08 | Subtitle | 처리/저장 |
| A-09 | Manifest 변경 | 기존 상태 재검증 |
| A-10 | DRM 표시 | 지원 제한 |

## 24.5 기기 테스트

- Android Emulator
- 실제 Samsung Galaxy
- Wi-Fi
- LTE/5G
- 네트워크 전환
- Background
- 화면 꺼짐
- 앱 강제 종료
- 기기 재부팅
- 저장 공간 부족
- 외부 저장소/SAF
- 장시간 다운로드
- 저전력/배터리 제한

---

# 25. APK 기능과 Maglev+ 구현의 매핑

| Barrel APK에서 확인된 흔적 | Maglev+ 적용 방향 |
|---|---|
| `HaulMediaBridge` | Native Media Detection Bridge |
| `HaulMseBridge` | MSE Hook 계층 |
| `HaulBlobBridge` | Blob 감지/분석 계층 |
| `HaulGrabberBridge` | 페이지 미디어 후보 수집기 |
| `CombinedHlsResume` | HLS Resume Snapshot |
| `CombinedDashResume` | DASH Resume Snapshot |
| `HlsResume(segmentsDone=...)` | Segment 완료 상태 |
| `DashResume(segmentsDone=...)` | DASH Segment 완료 상태 |
| `Content-Range` | Range Response 검증 |
| `#EXT-X-BYTERANGE` | HLS Byte Range 처리 |
| `selectedQualityId` | 화질 선택 상태 저장 |
| `mediaPlaylistUrl` | HLS Resume 정보 |
| `dashManifestUrl` | DASH Resume 정보 |
| `subtitleUrl` | Subtitle Source |
| `subtitleFormat` | Subtitle Format Resolver |
| `segmentsSignature` | Manifest/Segment 변경 검증 |
| `AutoRetryWorker` | Retry Worker |
| `DownloadJobService` | Background Download 실행 계층 |
| `DownloadEntity` | Room Task Entity |
| `BootCompletedReceiver` | 재부팅 후 복구 정책 검토 |

---

# 26. 재사용 vs 신규 구현 판단

## 재사용 우선

Maglev+ 기존 코드에서 존재하는 기능을 먼저 조사합니다.

- WebView 및 Browser State
- Media3 Player
- HTTP Client
- Cookie 관리
- Download UI
- File Picker
- MediaStore
- Room DB
- Coroutine Scope
- Notification
- Theme/Design System

기존 구현이 정상 동작한다면 새로 만들지 않습니다.

## 신규 구현 가능성이 높은 영역

- Range Capability Probe
- Parallel Part Planner
- Part State Persistence
- Download Recovery Coordinator
- Media URL Classifier
- MSE Detection Hook
- Blob Detection
- HLS Resume Snapshot
- DASH Resume Snapshot
- Segment Signature
- Download Engine Registry
- Quality Picker
- Track Selection
- Merge Validation

---

# 27. 권장 라이브러리 전략

Android 공식 Media3는 HLS/DASH Playback 및 Offline Download 관련 기능을 제공합니다.

우선 조사할 API/모듈:

- Media3 ExoPlayer
- Media3 HLS
- Media3 DASH
- Media3 Offline
- DownloadHelper
- DownloadManager
- DownloadService
- DownloadIndex
- HlsDownloader
- DashDownloader
- ProgressiveDownloader
- CacheDataSource
- MediaSource

### 권장 판단

**자체 구현이 필요한 부분**

- Browser Media Detection
- 사용자 화질 선택 UI
- 다운로드 목록 및 UX
- 사이트별 Header/Session Context
- Download Resume 정책
- 파일 저장 정책
- 통합 Task Model
- 앱 특화 Recovery

**Media3 활용 우선 부분**

- HLS/DASH 미디어 구조 처리
- Track 선택 지원
- Offline Stream Download
- Player
- Cache
- Playback

자체 Parser/Downloader를 만드는 것이 필요하다면, Media3 지원 범위와 한계를 먼저 확인한 뒤 구현합니다. 같은 기능을 두 엔진으로 중복 구현하지 않습니다.

---

# 28. 최종 구현 기준 / Definition of Done

기능을 완료했다고 판단하려면 단순히 빌드 성공만으로는 부족합니다.

## Direct Download

- [ ] Range Probe 검증
- [ ] Single fallback
- [ ] Parallel Parts
- [ ] Resume
- [ ] Pause/Cancel
- [ ] Retry
- [ ] ETag 변경 보호
- [ ] Part Integrity
- [ ] Final Merge
- [ ] Storage Full 대응

## Detection

- [ ] HTML Video/Audio
- [ ] Source
- [ ] Dynamic DOM
- [ ] HLS
- [ ] DASH
- [ ] MSE Hook
- [ ] Blob 인식
- [ ] 중복 제거
- [ ] 세션/Referer

## HLS

- [ ] Master
- [ ] Variant
- [ ] Segment
- [ ] Byte Range
- [ ] Init Segment
- [ ] Resume
- [ ] Audio
- [ ] Subtitle
- [ ] VOD
- [ ] Live 제한
- [ ] Output Validation

## DASH

- [ ] MPD
- [ ] Representation
- [ ] SegmentTemplate
- [ ] SegmentTimeline
- [ ] SegmentList
- [ ] Audio
- [ ] Video
- [ ] Subtitle
- [ ] Resume
- [ ] Mux
- [ ] DRM 제한

## App Lifecycle

- [ ] Background
- [ ] Foreground Service
- [ ] Notification
- [ ] Force Kill Recovery
- [ ] Reboot Recovery 정책
- [ ] DB/File consistency

## Release

- [ ] Unit Test
- [ ] Integration Test
- [ ] Real Device Test
- [ ] Security Review
- [ ] Dependency Scan
- [ ] Crash/ANR 확인
- [ ] README
- [ ] 인수인계 문서
- [ ] Release Notes

---

# 29. 결론 및 권장 작업 순서

Barrel 1.1.2 APK 정적 분석에서 일반 다운로드뿐 아니라 HLS/DASH Resume 모델, MSE/Blob 감지 Bridge, Segment 및 Quality 관련 상태 구조의 흔적을 확인했습니다.

Maglev+에서는 기능을 아래 순서로 구현하는 것이 가장 안정적입니다.

1. **기존 Maglev+ 코드 조사 및 Baseline 확보**
2. **Direct Downloader + Range + Resume + Parallel Parts**
3. **DB 기반 복구 + Foreground Download**
4. **WebView HTML 미디어 감지 및 Media UI**
5. **HLS Variant/Segment/Resume**
6. **DASH Representation/Segment/Resume**
7. **Subtitle**
8. **Muxing 및 Output 검증**
9. **MSE/Blob 감지 고도화**
10. **다운로드 중 재생 및 Playback 우선순위**
11. **실기기 안정성·보안·릴리즈 검증**

가장 큰 실패 위험은 HLS/DASH/MSE 기능을 동시에 구현하는 것입니다. Direct 다운로드의 복구·DB·Scheduler를 먼저 안정화한 뒤 스트리밍 엔진을 하나씩 추가해야 합니다.

---

# 30. 참고 자료

## APK 분석 자료

- 대상 파일: `배럴_1.1.2.apk`
- SHA-256: `ba8da1226de50d0c2b990b0407175799bc140581377258137e8a8d3a9d5afdd1`
- 분석 방식: ZIP/APK 구조, DEX 문자열 및 클래스 흔적 정적 분석
- 분석 한계: 전체 Kotlin/Java 소스 디컴파일, 동작 캡처, 서버 테스트는 수행하지 않음

## Android 공식 자료

- Media3 Offline Download:
  https://developer.android.com/media/media3/exoplayer/downloading-media
- Media3 Downloader API:
  https://developer.android.com/reference/androidx/media3/exoplayer/offline/Downloader
- Media3 HLS:
  https://developer.android.com/media/media3/exoplayer/hls
- Media3 Playback:
  https://developer.android.com/media/implement/playback-app

---

**문서 상태:** APK 정적 분석 기반 기능/설계 분석서  
**다음 단계:** Maglev+ 현재 저장소를 기준으로 기존 코드와 이 문서의 설계를 대조하여 파일 단위 구현 계획 및 이식 우선순위를 확정