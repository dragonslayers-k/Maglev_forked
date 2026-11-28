# MAGLEV+ 최종 재설계 업데이트 V3 — 사용자 #790 실기기 실패 기준
작성: 2026-11-28 KST
상태: 실행 순서 재조정 및 미완료 기준 저장. 최종본/릴리즈 아님.
상위 기준: `docs/MASTER_MEDIA_DOWNLOADER_SPEC_KO.md` v1.0.1 (2026-11-27) + Issue #8. V2는 상세 요구사항 참고 문서이며 최신 상위 기준보다 우선하지 않는다.

## 1. 기준선과 최신 CI 확인
- 승인 baseline: CI #702 / commit `45e685603a3a23507b61cb49398a78380d5db7a5` / APK SHA-256 `065d29dfcb19ad630c6bc906bfadecb2bd31395edc707ad3e35cf1f54b10c2de`. 변경·승격 금지.
- PR #10 Draft, base `recovery/2026-11-28-user-baseline-702`; merge/release 금지.
- CI #795 실패: JS UI 계약 테스트 3개가 active WebView/PiP 관련 정규식 이스케이프 오류로 실패, APK build skip.
- CI #796 성공: run https://github.com/dragonslayers-k/Maglev_forked/actions/runs/46128517642, head `42b20264c484844b082dad5f431d4aee6e1c8ee9`.
  - Contract, Rust, JS/typecheck/unit/assistant eval, ABI plan, ARM64 native + 16 KB alignment, APK build/sign/version/upload 성공.
  - APK artifact ID `15257306995`, archive digest `sha256:5f982c851c45ed7b2aedde276f25d0abe87c8032a1bd000f820b3d3d920f1de6`.
  - CI #796의 기능 코드가 아닌 테스트 정규식 수정으로 인해 APK는 설치 후보 기능 수정본이 아니다. APK 내부 SHA/설치 검증을 완료한 것으로 주장하지 않는다.
- #790 사용자 Galaxy verdict: WireGuard 정상, YouTube video download 정상. Audio-only 20–30 KB/s, PiP 검은/정지 화면, background playback 불가, media detection/capture 실패. #791은 APK native classes.dex/manifest가 #790과 동일하여 기능 개선 증거가 아니다.

## 2. 아직 안 된 것 — 완료로 표시 금지
1. Audio-only: 병목 계측/원인 확인/실제 속도 개선 없음.
2. Playback: browser/native player surface 및 실제 영상 렌더링/크롭/검은 화면 문제 해결 미확인.
3. PiP: Android Activity 진입, 재생 지속, exit/restore 전체 실기기 통과 증거 없음.
4. Background: MediaSession/foreground service/audio focus/notification/control + screen-off 지속 재생 없음.
5. Discovery: DOM + resource + manifest observation이 실제 후보 목록/quality sheet/Transfers queue에 안정적으로 연결되지 않음.
6. Browser recording: HLS live recording start→segment ledger→finalize→validate→storage commit 구현/검증 없음. MSE SourceBuffer는 관찰만; bytes capture/mux 완료 아님.
7. Korean subtitle: Korean-first provider search/download/attach/player/sync E2E 미구현·미검증. GOM/OpenSubtitles를 실제 provider로 연결할 때 API/terms/quota/auth/attribution 확인.
8. Korean lyrics/metadata: provider/local LRC import/sync/sidecar E2E 미검증.
9. Galaxy acceptance: 현재 변경 후보 전반 미통과. CI green만으로 기능 완료 아님.

## 3. 재설정된 구현 순서 (실기기 실패에 맞춰 runtime-first)
### Gate A — 보호 및 재현 (최우선)
- #702 baseline 및 사용자 확인된 WireGuard/YouTube video 경로 freeze.
- #790 exact APK 기준 audio-only / playback / PiP / background / detection 실패를 각각 독립 테스트 케이스로 기록.
- 동일 URL·동일 네트워크에서 audio/video bytes/sec, elapsed, format/codec/container, engine, retries, headers, proxy/WireGuard route를 계측. URL query/token/cookie/headers는 로그에서 redaction.
- 기존 코드/업스트림/PR #1/#10 diff와 최신 master/Issue #8 gate를 대조. feature branches에서 최신 상위 문서가 존재할 때 recovery branch에 사본/링크로 반영.

### Gate B — Audio-only transfer diagnosis + repair
- Extractor format selection → resolved URL → transfer engine → request headers/range → proxy/network route → retry/throttle/conversion 경로를 end-to-end trace.
- YTDLnis와 같은 품질 선택 기준을 유지하되, 오디오가 느린 원인을 확인하기 전 무작위 parallelism/bitrate/network bypass 변경 금지.
- Add deterministic fixture tests for audio format selection and transfer contracts; instrument byte progress/throughput.
- CI APK is a candidate only; same sample real-device throughput comparison required.

### Gate C — Real playback + background foundation (PiP after playback)
- Single selected media identity and one actual video surface; verify source URI, MIME, request headers/cookies, aspect ratio/crop and lifecycle.
- Media3/native playback path for direct MP4 then HLS/DASH; verify rendered frames and audio, not merely player popup.
- Add foreground MediaSession service, audio focus, notification controls, resume state, screen-off/background survival.
- Only after playing video passes: native PiP enter/change/exit callbacks, selected active element ratio, surface ownership, return-to-browser restore; never optimistic JS flag as proof.
- If WebView playback path cannot maintain surface, route selected candidate to Media3 rather than attempting to keep an opaque WebView popup.

### Gate D — Browser discovery → selection → queue
- Bounded observer: DOM video/audio/source/currentSrc/lazy attrs; MutationObserver and custom/shadow roots; fetch/XHR/Resource Timing metadata; HLS/DASH manifest parser.
- Candidate schema: URL, source page, MIME, type, quality/size/duration/tracks, request context, provider, confidence, capability. Deduplicate and refresh/debounce.
- Blob/MSE opaque: label as opaque and show analysis/capability fallback; do not invent direct URL or claim captured bytes.
- Selection sheet must feed existing transfer queue, preserve scoped Referer/User-Agent/auth headers with redaction. Test direct MP4/WebM, HLS, DASH, lazy/custom/shadow player and ordinary-page false positives.

### Gate E — Supported capture, not placeholder
- HLS live separate task state machine: ready/recording/stopping/finalizing/validating/completed/failed/recoverable.
- Segment sequence/discontinuity/retry/disk threshold/process restore; temp output, mux/finalize, validation then atomic storage commit.
- MSE byte capture only if accessible non-DRM SourceBuffer append bytes can be safely staged and ordering/timestamps/container mux proven by fixtures. DRM/EME/protected content bypass remains explicitly out of scope.
- Keep UI honest until actual path is implemented; remove generic refusal only when supported capture can be launched.

### Gate F — Korean subtitles and lyrics
- Subtitle provider adapters, Korean-first query (ko/kor/ko-KR), title/year/season/episode/release/hash matching, provider/language/format/HI/forced/sync metadata.
- Implement actual search→result→download→safe archive extraction→SRT/VTT/ASS/SSA/TTML parse→attach/play→delay/sync tests. Sidecar default; mux/burn only with user choice and verified capability.
- GOM Lab public search/provider behavior and OpenSubtitles.com official API only after current API/terms/auth/quota/attribution verification; no obsolete OpenSubtitles.org XML-RPC.
- Lyrics: licensed provider or user-local import; Hangul normalization/aliases; LRC offset and sidecar; no unauthorized full-lyrics scraping/redistribution.

## 4. Validation contract for every next change
- One runtime gate per scoped commit; include source file/function evidence, root cause, test fixture, expected behavior and regression risk.
- Run targeted test locally/CI before commit where environment permits; never say local tests ran if not run.
- Full CI: Contract, JS typecheck/tests, Rust, ABI plan, ARM64 build + 16 KB alignment, APK build/sign/version/upload.
- Inspect failed job logs; do not stack next source change on unresolved failed run.
- Record exact head SHA, run URL, skipped jobs, artifact ID, APK SHA-256, version/ABI/signature.
- Device acceptance must use exact APK/hash and the #790 failure cases. Keep user feedback as authoritative.
- No baseline promotion, PR merge or release until WP0/WP1/Issue #8 gates and Galaxy acceptance pass.

## 5. Immediate next action
Do not ask user to install #796 as a fix. Begin Gate B audio-only trace/repair, because #790's audio speed is reproducible user-visible failure and the current #796 change only corrected tests. In parallel inspect Gate C playback architecture only after the audio change is isolated. Once one actual runtime fix is committed, run full CI and report exact artifact + what is and is not fixed.
