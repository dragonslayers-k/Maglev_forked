# 기능 보존·다중 엔진 통합·보호 미디어 처리 기준

> 기준일: 2026-11-26 (KST)  
> 적용 저장소: dragonslayers-k/Maglev_forked  
> 상태: 구현 기준 확정. 이 문서는 기능 완료 선언이 아니며, 각 항목은 소스/자동 테스트/실기기 검증 증거로 별도 판정합니다.

## 1. 절대 원칙: 기존 기능을 임의로 제거하지 않음

사용자가 요청한 제품 목표는 원천 프로젝트별 강점을 하나의 Maglev+ 앱에 통합하는 것입니다. 따라서 기능 중복은 공통 엔진으로 합칠 수 있지만, 기존에 존재하던 사용자 기능이나 원천별 고유 기능을 조용히 삭제·축소하지 않습니다.

- 기능을 제거하거나 동작을 바꾸는 변경은 사전 영향 분석, 대체 경로, 회귀 테스트, 변경 기록을 요구합니다.
- 구현 난이도·기술 제약·보호 미디어 제한으로 당장 완성할 수 없는 기능은 삭제하지 않고 `PLANNED`, `BLOCKED`, `UNSUPPORTED_WITH_REASON` 중 하나로 추적합니다.
- UI에서 숨기는 것과 기능 제거를 동일하게 취급하지 않습니다. 비활성 기능은 이유와 조건을 표시합니다.
- 신규 엔진은 기존 Transfers, 저장소, 알림, 재시도/취소 체계를 재사용합니다. 별도 큐·저장 lifecycle을 만들어 사용자 기능을 분리하지 않습니다.
- README, 제품 명세, 상세 벤치마크, handoff, release note의 기능 상태를 같은 commit에서 갱신합니다.

## 2. 보존 대상 기능 인벤토리

| 원천/영역 | 보존할 기능 | 통합 경로 | 검증 기준 |
|---|---|---|---|
| Maglev 기본 앱 | 브라우저, 탭, 기록, 북마크, 광고 차단, 비공개 모드, 설정/테마 | 기존 RN UI 및 browser module | 기존 UI/브라우징 회귀 |
| Maglev 다운로드 | torrent/magnet, direct HTTP, Range 분할, pause/resume/retry/remove, 알림, 저장 | 기존 Rust/Android engine + 단일 Transfers | 기존 fixture와 Galaxy 다운로드 |
| Maglev 스트림 | HLS VOD, DASH VOD, variant/audio track, 표준 AES-128 identity, mux | 기존 stream parser + StreamMuxer | 저장 파일 재생·A/V sync·회귀 |
| LJ Video Downloader 분석 | WebView/SW 요청 관찰, header context, MIME/probe, URL dedupe, site rules, HLS segment 처리 | 기존 browser observer/stream engine의 gap만 확장 | 사이트 fixture, header-required 테스트, 오탐 검사 |
| yt-dlp/YTDLnis 기능 | YouTube 및 지원 사이트 추출, metadata/format, audio, playlist, cookies, subtitle, metadata, retry, concurrency, updater 등 | yt-dlp adapter → 기존 EngineHost/Transfers | 사이트별 E2E 및 기능별 DoD |
| MPMux | static Range, HLS VOD, HLS Live, MediaSource buffer mux | static/VOD는 기존 코드, Live/MSE는 신규 구현 | 원본 기능별 별도 검증 |
| 보조 처리 | 파일명 규칙, 메타데이터, 썸네일/자막, 무결성, 백업/복원, 진단 | 공통 저장/후처리 모듈 | round-trip/복원/파일 hash |

표의 항목은 기능 보존/구현 요구사항입니다. 현재 코드에 이미 구현된 기능과 미구현 기능을 혼동하지 않으며, 제품 명세의 상태 표와 연결합니다.

## 3. MPMux 녹화 기능의 정확한 기술 범위

MPMux의 Video Buffer Muxer는 일반적인 화면 녹화 기능과 다릅니다. 공개 설명상 HTML5 MediaSource API의 SourceBuffer에 들어가는 미디어 buffer를 수집해 MP4로 재패키징하는 방식입니다. 화면 전체나 시스템 오디오를 녹음하는 기능으로 오해하지 않습니다.

### 3.1 Maglev+에 이식할 기능
1. **HLS Live Recording**: ENDLIST가 없는 live playlist를 sequence cursor로 추적하고 segment를 순서대로 저장합니다. 중복·누락을 기록하고 사용자의 Stop 시 flush/finalize합니다.
2. **MediaSource Buffer Capture**: 사용자가 브라우저에서 명시적으로 시작한 세션에서만 SourceBuffer의 init/media segment를 수집합니다.
3. **MSE track/timeline 보존**: MIME/codecs, SourceBuffer별 track, append 순서, timestampOffset, appendWindow, changeType, remove/abort/discontinuity를 기록합니다.
4. **Bounded native staging**: 대용량 byte 배열을 JS heap, JSON, base64 이벤트에 쌓지 않습니다. 크기 제한이 있는 binary chunk queue와 backpressure를 사용해 app-private staging으로 씁니다.
5. **Mux/rotation**: 분리된 A/V 트랙을 지원 코덱과 timestamp를 검증한 뒤 remux합니다. 약 1 GiB 또는 저장공간 임계치에서 파트를 회전합니다. 기본은 재인코딩이 아닙니다.
6. **기존 Transfers 연결**: 사용자 시작/중지, 진행률, 파일 파트, 실패·복구 상태를 기존 Transfers 카드에 표시합니다.
7. **실패의 정직한 표시**: 브라우저가 SourceBuffer 접근을 차단하거나 비표준 codec/fragment, timestamp discontinuity, storage 부족이 발생하면 원인을 표시하고 불완전 파일을 정상 완료로 처리하지 않습니다.

### 3.2 DRM/EME 경계 및 안내
- EME, Widevine, FairPlay, encrypted key system, SAMPLE-AES 또는 보호된 라이선스 경로가 감지되면 보호 상태를 분류하고 일반 다운로드/버퍼 캡처와 구분합니다.
- DRM 키·라이선스·세션 추출, 복호화, 보호 플래그/출력 제한 해제, DRM 우회는 구현하지 않습니다.
- 보호된 스트림을 MSE byte capture로 수집해도 암호문은 복호화되지 않습니다. 확장자만 MP4로 바꾸거나 컨테이너에 넣는 것으로 정상 재생 파일이 되지 않습니다.
- UI는 `보호된 콘텐츠(EME/DRM)`, `일반 MSE 버퍼`, `직접 URL 미확인`, `추출기 미지원`을 별도 상태로 표시합니다.
- 사용자에게 해당 서비스의 공식 다운로드/오프라인 저장 기능, 구매/대여 후 제공되는 다운로드, 서비스 고객지원 경로를 안내합니다.
- MPMux PC 안내는 DRM 우회 수단이 아닙니다. 비암호화 MSE/HLS buffer형 미디어에만 해당할 수 있음을 명시합니다.

### 3.3 화면 녹화 대안의 범위
Android MediaProjection 기반 화면 녹화는 사용자가 화면·오디오 캡처를 명시적으로 승인한 경우 일반 화면 기록 기능으로 제공할 수 있습니다. 이는 원본 미디어 파일 추출이나 MSE mux와 다른 별도 기능이며, 품질/프레임/오디오 손실이 있을 수 있습니다. Android의 secure surface, 보호 영상, HDCP/DRM 출력 제한을 우회하거나 검은 화면을 제거하는 용도로 구현하지 않습니다. 보호 화면이 캡처되지 않으면 그 상태를 그대로 안내합니다.

## 4. 소스 라우팅 — 하나의 입력, 여러 합법적 경로

| 입력/감지 결과 | 우선 처리 | 대체/보조 경로 |
|---|---|---|
| magnet/torrent | Maglev torrent | 사용자 선택 가능한 검색/추가 |
| 직접 MP4/WebM/파일 | Maglev HTTP/Range | single-connection fallback |
| HLS VOD | Maglev HLS parser | 명시적 yt-dlp fallback if supported |
| DASH VOD | Maglev DASH parser | 명시적 yt-dlp fallback if supported |
| HLS Live | 신규 Live recorder | yt-dlp live support가 실제 검증된 경우만 대체 |
| YouTube URL | 전용 yt-dlp extractor | 로그인/PO Token/JS runtime 오류 진단 |
| 일반 웹페이지 | DOM/network/SW 감지 | 사용자가 선택한 generic yt-dlp 분석 |
| 비암호화 MSE | 신규 SourceBuffer capture | PC MPMux 안내 |
| DRM/EME | 보호 상태 안내 | 공식 offline/download 기능 안내 |
| 감지 불가 | 페이지/브라우저 context 진단 | URL 수동 입력 및 지원 사이트 확인 |

여러 원천의 처리 방식이 겹치면 하나의 작업으로 정규화합니다. 특정 원천이 지원하는 별도 기능은 동등한 대체 기능이 검증되기 전까지 제거하지 않습니다.

## 5. 수용 기준과 기능 상태

각 기능은 아래 중 하나로 기록합니다.
- `PASS_CI`: 자동 테스트/빌드 통과
- `PASS_DEVICE`: Galaxy 실기기에서 파일 생성·저장·재생 검증
- `ACCEPTED`: 회귀 및 사용자 수용 기준까지 완료
- `IN_PROGRESS`: 코드 일부 존재
- `BLOCKED`: 기술/런타임/서비스 제약으로 진행 불가, 이유와 다음 조치 명시
- `UNSUPPORTED_WITH_REASON`: DRM 보호 등 명시적 기술 경계

최종본은 필수 기능의 상태가 명확하고, 모든 필수 `PASS_DEVICE` 및 기존 기능 회귀가 확인되어야 합니다. CI 성공, 화면 진입, metadata 반환만으로 완료 처리하지 않습니다.

## 6. MPMux 공식 근거
- Chrome Web Store: https://chromewebstore.google.com/detail/video-downloader-mpmux/mbflpfaamifmmmkdjkcmpofpccfmlmap
- 공식 개요: https://mpmux.com/ko
- Static downloader: https://mpmux.com/staticdownloader
- HLS downloader: https://mpmux.com/hlsdownloader
- Video Buffer Muxer: https://mpmux.com/buffermuxer

## 7. 개발자 체크리스트
- [ ] 기존 기능 baseline inventory와 테스트 결과를 먼저 기록했는가?
- [ ] 기능 삭제 없이 공통 엔진으로 중복을 통합했는가?
- [ ] 신규 기능이 기존 Transfers/저장/알림 lifecycle을 사용하는가?
- [ ] MPMux MSE capture를 화면 녹화나 DRM 복호화로 잘못 구현하지 않았는가?
- [ ] EME/DRM 감지와 일반 MSE 캡처를 구분하는가?
- [ ] 사용자가 명시적으로 시작/중지할 수 있고 대용량 메모리 제한이 있는가?
- [ ] 앱 종료/저장공간 부족/네트워크 단절 시 손상 파일을 완료로 위장하지 않는가?
- [ ] 한국어 안내, 오류 사유, handoff, README, tests를 같은 변경에 갱신했는가?
