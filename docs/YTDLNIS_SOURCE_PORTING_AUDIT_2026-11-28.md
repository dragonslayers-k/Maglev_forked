# YTDLnis / Maglev+ 원천 기능·구조 대조 감사 — 2026-11-28

## 목적과 기준
사용자 요청에 따라 YTDLnis 실제 저장소의 현재 main 소스와 Maglev+ recovery branch head `59d341d467abffcaf947db4247b9100c6151f26c`를 대조했다. 이 문서는 코드 구조/기능 존재 확인이며, Galaxy 실기기 성공을 의미하지 않는다. 원천 링크와 라이선스를 보존하고, upstream 코드를 wholesale 복사하지 않고 Maglev의 기존 Transfers/저장/네트워크 엔진에 선택적으로 연결한다.

## YTDLnis의 실제 구성
원천: https://github.com/deniscerri/ytdlnis (GPL-3.0)

- **Extractor/runtime**: `core/RuntimeManager.kt`, `core/packages/Python.kt`, `FFmpeg.kt`, `Aria2c.kt`, `NodeJS.kt`, `Deno.kt`, `QuickJS.kt`. RuntimeManager가 필요한 실행 패키지들을 초기화·추출하고 실행 환경을 준비한다. yt-dlp는 단독 Kotlin metadata API가 아니라 관리되는 Python/runtime process와 JS challenge runtime을 포함하는 구조다.
- **Format inventory/selection**: `database/viewmodel/FormatViewModel.kt`, `database/models/Format.kt`, `ui/adapter/FormatAdapter.kt`, `ui/downloadcard/FormatSelectionBottomSheetDialog.kt`. Format metadata를 모델화하고 오디오/영상 구분, codec/container/size 정렬, Suggested/Smallest 필터, 다중 선택을 제공한다.
- **Audio/video download UI**: `ui/downloadcard/DownloadAudioFragment.kt`, `DownloadVideoFragment.kt`, `FormatSelectionBottomSheetDialog.kt`. 원본 format 선택과 함께 bitrate, chapter split, thumbnail/metadata, filename, output options 등 task options를 구성한다.
- **Task/queue/persistence**: `database/repository/DownloadRepository.kt`, `database/viewmodel/DownloadViewModel.kt`, `work/DownloadWorker.kt`, download DB/DAO/model. Format 선택과 실제 작업은 task model·repository·worker를 통해 지속/재시도/queue로 연결된다.
- **Post-processing**: FFmpeg package와 YTDLP options가 conversion, metadata/chapter/thumbnail/lyrics/subtitle 관련 postprocessor와 연동된다. 이 기능은 단순히 output filename/extension만 바꾸는 UI가 아니다.

## Maglev+에서 확인된 현재 구현
- `YoutubeDownload.kt`: NewPipe fast extraction 우선, fallback으로 youtubedl-android/yt-dlp의 `getInfo`를 player clients별로 호출한다. 형식은 `toFormat`에서 URL/manifest, codec, kind, size/estimated size를 매핑하고, client별 결과를 합쳐 dedupe한다.
- `NewPipeYoutube.kt`: NewPipe format list를 간략화해 video는 높이별 대표 1개, audio는 stream/itag별로 만든다. add 시 URL을 다시 가져와 선택 itag로 직접 다운로드한다. direct audio에는 segments=8 요청이 있으나 실제 분할은 native Range/probe/validator/size 조건에 종속된다.
- `app/youtube-download.tsx`: 별도 YouTube URL/format 선택 화면은 있으나 YTDLnis의 전체 format/task/preset/postprocess/runtime control surface와 동등하지 않다.
- `MediaContainerConverter.kt`와 후처리 연결은 존재하지만, YTDLnis의 bundled runtime manager + FFmpeg/aria2 + yt-dlp postprocessor 전체 구조를 동등하게 포팅한 것은 아니다. Maglev의 기존 direct/stream/Torrent engine을 유지하는 방향은 맞지만, 선택된 format과 실제 URL/transfer parameters의 E2E 계약을 더 엄격히 검증해야 한다.
- `components/browser/FoundDownload.tsx`는 직접 파일 후보를 probe 후 existing Transfers queue에 넣는다. `StreamSheet.tsx`는 HLS/DASH 후보의 quality/audio track 선택 후 queue로 보낸다. `TabWebView.tsx`의 media hit callback/long-press observer는 browser playback state, MediaSession, continuous source discovery, recorder를 의미하지 않는다.
- `plugins/withPictureInPicture.js`는 Activity manifest flags (`supportsPictureInPicture`, resizeable, configChanges)만 설정한다. Manifest enablement alone is not a complete PiP implementation: current audited app source has no dedicated playback surface/player controller and no explicit MediaSession playback service/lifecycle integration.
- `MaglevTorrentService.kt`는 downloads/torrents를 위한 foreground service다. 이는 media playback service/MediaSession과 동일하지 않다.

## User-observed failure → source-level work required
1. **Audio preset (320 kbps ceiling) error**: Yt-dlp add path filters audio-only formats by abr <= requested ceiling and emits `YOUTUBE_AUDIO_BITRATE_UNAVAILABLE` when no format resolves. Multi-client fallback exists in the current recovery source, but the user still reports the error. Must instrument safe per-client format count, codec/audio-only classification, abr availability, selected client/format ID and failure stage (no signed URLs/cookies/tokens); then correct mapping/resolution and test real fixture + Galaxy. Do not silently select above ceiling.
2. **Audio speed**: both paths request up to 8 segments for direct audio; native segmented Range requires successful probe, valid 206 Content-Range, stable validator and eligible size. A request for 8 segments is not proof of 8 connections. Inspect native decision/fallback reason and transfer throughput; preserve safe single-connection fallback.
3. **Slow first format detection**: NewPipe `StreamInfo.getInfo` is cached for 180 s, but the fast path still depends on extractor/network/PO-token behavior. yt-dlp fallback may iterate three player clients. Add stage timing and early-stop only after a complete useful inventory; don't hide required formats by returning incomplete metadata.
4. **PiP**: manifest flags alone are insufficient. Need actual playing-video selection, native Activity PiP enter/exit/restore callbacks, WebView thread-safe measurement, playback continuity, Samsung lifecycle handling, and UI state cleanup.
5. **Background playback**: no app-owned playback engine/MediaSession service was found in the audited Maglev source tree. Download foreground service is not playback. Need a real playback surface + foreground media playback service + MediaSession/notification/audio focus/lifecycle; then test screen-off and app background.
6. **Media recognition**: current browser hit/long-press and resource observer paths are not a complete always-on candidate inventory. Implement bounded/debounced observer, DOM/video/audio/resource/network candidate merge, refresh, direct/HLS/DASH capability classification, page-scoped request context, and candidate-to-quality-selector-to-Transfers E2E. Treat blob/MSE as opaque unless bytes/segments are demonstrably accessible.
7. **Playback capture/recording**: no verified MediaSource SourceBuffer byte capture or HLS live-recording state machine is present. Implement supported non-DRM HLS live recording with segment timeline, discontinuity, finalize/validate/recover; browser playback capture only where source bytes are legitimately accessible. DRM/EME circumvention remains out of scope; do not claim recording when only a media URL was detected.
8. **Korean subtitles**: existing Maglev subtitle provider/test infrastructure is substantial, but the user-facing YouTube subtitle search/download/attach/sync workflow must be traced and tested end-to-end; provider registration/fixture tests alone are not acceptance.

## Porting/validation rules
- One source feature per scoped commit: source path, upstream reference, adapter/interface, preserved Maglev engine, tests, risk, license attribution.
- Build a feature matrix with statuses **present in source / wired in UI / wired to task engine / automated test / Galaxy accepted**. Never collapse these into one “implemented” label.
- Do not copy GPL-3.0 code into a differently licensed module without resolving license compatibility and preserving notices/source obligations. Prefer documented behavior/architecture port or GPL-compatible component integration.
- Release gate: exact APK SHA-256 + signed/version/ABI checks, full CI, then Galaxy acceptance for #814/#815 and baseline regressions. CI green is not feature acceptance.

## Next scoped implementation order
A. WP2 direct core/device gate and native Range fallback reason instrumentation.
B. Fix audio format metadata/resolution and preset fallback; regression tests for abr missing/0, exact/under/over ceiling, player-client differences, expired URL refresh.
C. PiP lifecycle implementation (not just manifest); test enter/exit/restore.
D. Add actual playback + MediaSession/background service.
E. Browser observer candidate pipeline and candidate-to-queue E2E.
F. HLS live recording state machine and lawful accessible-source capture.
G. Korean subtitle search/download/attach/sync acceptance.

## Primary source files
- YTDLnis: https://github.com/deniscerri/ytdlnis/tree/main/app/src/main/java/com/deniscerri/ytdl
- Runtime manager: https://github.com/deniscerri/ytdlnis/blob/main/app/src/main/java/com/deniscerri/ytdl/core/RuntimeManager.kt
- FormatViewModel: https://github.com/deniscerri/ytdlnis/blob/main/app/src/main/java/com/deniscerri/ytdl/database/viewmodel/FormatViewModel.kt
- Audio UI: https://github.com/deniscerri/ytdlnis/blob/main/app/src/main/java/com/deniscerri/ytdl/ui/downloadcard/DownloadAudioFragment.kt
- Download worker: https://github.com/deniscerri/ytdlnis/blob/main/app/src/main/java/com/deniscerri/ytdl/work/DownloadWorker.kt
- Maglev NewPipe adapter: https://github.com/dragonslayers-k/Maglev_forked/blob/recovery/youtube-selection-reconcile-ci/modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/NewPipeYoutube.kt
- Maglev yt-dlp adapter: https://github.com/dragonslayers-k/Maglev_forked/blob/recovery/youtube-selection-reconcile-ci/modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/YoutubeDownload.kt
- Maglev PiP manifest plugin: https://github.com/dragonslayers-k/Maglev_forked/blob/recovery/youtube-selection-reconcile-ci/plugins/withPictureInPicture.js
