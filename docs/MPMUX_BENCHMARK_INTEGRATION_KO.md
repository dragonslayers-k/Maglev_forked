# MPMux 기능 벤치마크 및 Maglev+ 이식 설계

> 분석 기준일: 2026-11-26 (KST)  
> 대상: MPMux Chrome Web Store 확장 프로그램 v1.2 및 공식 기능 문서  
> 적용: `dragonslayers-k/Maglev_forked` / `feature/p1-video-detection-observer`  
> 원칙: 공개 기능을 벤치마킹한 독립 구현. 비공개 코드·바이너리·API 복제 금지.

## 1. 결론
Maglev에 MPMux 기능을 통째로 복제하면 안 됩니다. 정적 파일 Range 분할과 HLS VOD 다운로드·병합은 기존 Rust/Android 엔진에 구현돼 있습니다. 실질적인 기능 공백은 HLS Live 녹화와 MediaSource SourceBuffer 버퍼 캡처입니다. 두 기능도 기존 Transfers, 저장소, 알림, 재시작 정책에 연결해야 하며 독립 큐를 추가하지 않습니다.

## 2. MPMux에서 확인한 공개 기능
### Static Video Downloader
MP4/WebM/Ogg 등의 정적 파일을 HTTP Range로 나눠 병렬 다운로드하고 하나로 저장합니다. 공식 안내의 최대 동시 요청 수는 3개이며, 서버가 요청을 거절할 경우 재시도/요청 수 축소를 안내합니다.

### HLS Downloader
- VOD playlist/segment를 모아 MP4로 재패키징합니다.
- VOD 동시 요청은 최대 3개이고 live는 순차 수집합니다.
- live 출력은 약 2GB 단위로 분할 저장한다고 설명합니다.
- 공식 FAQ는 encrypted HLS를 지원하지 않는다고 명시합니다.

### Video Buffer Muxer
- 화면 녹화나 시스템 오디오 녹음이 아니라 HTML5 MediaSource API 버퍼를 수집합니다.
- HLS/fMP4 및 live에서 버퍼를 받아 MP4로 재패키징한다고 설명합니다.
- 화질 전환 시 timestamp 기준으로 파일에 병합하는 동작을 설명합니다.
- 메모리 한계 때문에 약 1GB마다 파일을 나눠 저장합니다.
- 비표준 또는 암호화된 buffer는 잘못되거나 짧은 출력이 될 수 있다고 경고합니다.
- 최대 5배 재생은 VOD에만 유효하다고 하나 페이지 화질/안정성에 영향을 줄 수 있으므로 Maglev는 자동 적용하지 않습니다.

## 3. 공식 자료
- [Chrome Web Store — MPMux](https://chromewebstore.google.com/detail/video-downloader-mpmux/mbflpfaamifmmmkdjkcmpofpccfmlmap?hl=en-US)
- [Static Video Downloader](https://mpmux.com/staticdownloader)
- [HLS Downloader](https://mpmux.com/hlsdownloader)
- [Video Buffer Muxer](https://mpmux.com/buffermuxer)
- [한국어 안내](https://mpmux.com/ko)

## 4. Maglev 소스 직접 대조

| 기능 | 소스 경로 | 확인된 구현 |
|---|---|---|
| Static Range split | `native/maglev-core/src/http_dl/driver/segments.rs` | 8 MiB 이상, Range probe 206, strong ETag/Last-Modified validator, 최대 8 parts, offset write, sidecar resume |
| Range 복구 | `segments.rs`, `driver.rs` | 429/503 대기·동시성 축소, Content-Range/validator drift 시 single-connection fallback |
| HLS VOD parser | `native/maglev-core/src/http_dl/stream/hls.rs` | master/media playlist, variant/audio group, BYTERANGE, MAP, AES-128 identity 지원; SAMPLE-AES/비표준 KEYFORMAT 거절 |
| HLS/DASH transfer | `native/maglev-core/src/http_dl/driver/stream_run.rs` 및 stream 모듈 | VOD segment 전송, 진행/재개 메타데이터 |
| A/V mux | `modules/maglev-engine/android/src/main/java/com/maglev/engine/storage/StreamMuxer.kt` | MediaExtractor/MediaMuxer 기반 트랙 병합 |
| Browser request observer | `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/MaglevBrowserView.kt` | WebView request 및 active-tab ServiceWorker 요청 관찰, 원 응답은 교체하지 않음 |
| Page observer | `modules/maglev-engine/android/src/main/java/com/maglev/engine/browser/PageScan.kt` | DOM video/audio, Resource Timing, fetch/XHR MIME, EME/Blob 징후 |
| MSE byte capture | 현재 없음 | Blob/MSE note는 SourceBuffer append byte를 저장하는 기능이 아님 |
| HLS Live | 현재 미지원 | ENDLIST 없는 media playlist는 `STREAM_LIVE`로 거절 |

### Static/HLS VOD를 다시 만들지 않는 이유
Maglev Range split은 1~8 연결, validator, sidecar resume, 서버 거절 대응을 이미 갖습니다. HLS VOD도 variant/audio track, segment 처리, mux, 표준 AES-128 기능이 있습니다. 별도 MPMux downloader를 추가하면 URL 헤더·쿠키·취소·진행률·저장·재시도 상태가 이중화되어 회귀 위험이 커집니다.

## 5. 신규 구현 설계

### 5.1 HLS Live Recording
- VOD parser와 분리한 live state machine.
- `EXT-X-MEDIA-SEQUENCE`로 중복 제거, `TARGETDURATION`에 맞춰 playlist polling.
- `EXT-X-MAP`, `BYTERANGE`, `DISCONTINUITY`, key rotation, timestamp를 보존.
- live는 순차 수집을 기본으로 하며 과도한 병렬 요청을 하지 않음.
- Stop은 신규 segment 수집을 멈추고, 현재 파일 flush/remux/finalize 후 기존 Transfers의 completed로 전이.
- 네트워크 단절로 playlist window에서 사라진 segment는 복구 불가로 기록. 누락을 감추고 정상 완료로 표시하지 않음.
- 약 1GiB 또는 저장공간 임계치에서 파일 회전. sidecar에는 sequence cursor, 파일 파트, 마지막 확정 segment를 저장.
- 앱 재시작 복구는 cursor와 원본 live window가 유효할 때만 허용. 지나간 segment 재요청을 보장하지 않음.

### 5.2 MediaSource Buffer Capture
- 기본 OFF, 브라우저 화면에서 사용자가 명시적으로 시작.
- `MediaSource`/`SourceBuffer`의 addSourceBuffer, appendBuffer, remove, abort, changeType 및 timestamp/track 정보를 관찰하되 원래 page playback API 동작/반환값을 보존.
- SourceBuffer별 MIME/codecs, init/media fragment, append order, timestampOffset, appendWindow, abort/discontinuity 기록.
- 전체 버퍼를 RN JSON/base64 또는 JS heap에 모으지 않음. bounded binary chunk와 backpressure로 네이티브 app-private staging에 바로 기록.
- audio/video SourceBuffer를 분리 보관하고 timeline을 보존한 뒤 기기 검증된 remuxer로 결합. 재인코딩은 기본적으로 금지.
- 약 1GiB 또는 저장공간 임계치에서 rotation하고 이전 파트는 즉시 안전하게 보관.
- EME/encrypted key system/DRM 신호는 capture 중지 및 미지원 안내. 키·세션 추출 및 DRM 우회 금지.
- 자동 5x 재생, 자동 화질 변경, 페이지 외부로의 데이터 전송은 구현하지 않음.

## 6. 보안·저장 규칙
1. URL query, Cookie, Authorization, 서명 토큰은 로그에서 제거.
2. Request observer는 기존 WebView response를 읽거나 소비하지 않는 관찰 원칙 유지.
3. Page→native bridge는 nonce, origin, payload size, rate limit, capture session ID 검증.
4. Capture는 bounded queue/backpressure, staging 파일 flush, storage quota를 강제.
5. MediaStore publish가 끝나기 전 원본 staging 삭제 금지.
6. DRM/보호 콘텐츠 기술 제한 우회 금지.

## 7. 검증 매트릭스
| 테스트 | 기대 결과 |
|---|---|
| Static MP4 Range + strong ETag | 조각 총합과 파일 hash 일치 |
| Range 미지원/200 응답 | 기존 단일 연결 fallback |
| Range 429/503 | 동시성 축소/대기, 바이트 중복·누락 없음 |
| HLS VOD TS/fMP4 + separate audio | 영상/오디오 병합 후 재생 |
| HLS AES-128 identity | 표준 범위에서 유효한 출력 |
| SAMPLE-AES/DRM/non-identity KEYFORMAT | STREAM_PROTECTED, 우회 금지 |
| Live sequence 증가 | 순서 보존, 중복 방지, Stop 후 정상 finalize |
| Live disconnect/window expiry | 누락 범위 명시, 손상 파일 completed 처리 금지 |
| MSE fragmented MP4 | init/media fragment 저장 후 재생 |
| MSE separate A/V | timestamp 정렬 및 A/V sync 검사 |
| MSE changeType/quality switch | track/timeline 유지 또는 안전한 분할 |
| EME/encrypted | capture 중지 및 미지원 메시지 |
| App kill/storage full | flush된 파트 보존, recoverable/failed 구분 |
| Galaxy device | Actions APK hash와 설치본 일치, MediaStore 저장·로컬 재생 |

## 8. 완료 판정
Static Range/HLS VOD는 기존 엔진 회귀검증 결과를 사용합니다. HLS Live와 MSE capture는 기존 Transfers 목록·알림·저장·재시작 정책을 통합하고, 파일 무결성·메모리 한계·DRM 거절·실기기 재생까지 통과해야 합니다. CI pass나 UI 진입만으로 device-pass를 선언하지 않습니다.
## 9. 앱 내 MPMux 대체 안내 (2026-11-26)

Maglev+ 브라우저에서 직접 미디어 URL이 확인되지 않고 blob/MediaSource 계열 재생이 의심되거나 STREAM_PROTECTED가 반환될 때, 사용자에게 PC용 MPMux 안내를 제공할 수 있습니다.

- 공식 안내: https://mpmux.com/ko
- Chrome Web Store: https://chromewebstore.google.com/detail/video-downloader-mpmux/mbflpfaamifmmmkdjkcmpofpccfmlmap
- 대상은 **암호화되지 않은** MediaSource/HLS 버퍼형 플레이어입니다. PC Chrome 또는 Edge에서 확장 프로그램 설치 → 영상 페이지 재생 → Video Buffer Muxer 녹화 시작 → 녹화 종료까지 해당 탭 유지 → MP4 결과 저장 순서입니다.
- 이 안내는 Android 앱의 기능 이식이 아니며 PC 브라우저용 외부 대안입니다. MPMux는 DRM 암호화 미디어를 복호화하거나 Widevine/FairPlay 보호를 해제하지 않습니다. DRM 콘텐츠에는 공식 제공자의 다운로드/오프라인 기능만 안내합니다.
- MPMux 안내를 표시하는 경우 DRM 우회, 보호 해제, 모든 영상 저장이라는 표현을 사용하지 않습니다.