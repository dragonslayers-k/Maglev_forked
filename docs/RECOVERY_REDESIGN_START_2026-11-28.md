# 다운로더 복구 재설계 착수 기록

- 기준일: 2026-11-28 (KST)
- 상태: **복구/설계 단계. 기능 완성 또는 실기기 합격 아님**
- 목적: 다른 작업으로 발생한 회귀를 분리하고, 사용자가 실제 확인한 기능을 보존한 최종 제품을 다시 설계한다.

## 1. 안전한 복구 기준

- 사용자가 마지막으로 지목한 후보 #702: workflow run `45980241030`, commit `45e685603a3a23507b61cb49398a78380d5db7a5`, CI success.
- 이 branch `recovery/2026-11-28-user-baseline-702`는 위 commit에서 분기했다. #702 APK artifact는 `15189688044` (apks ZIP, SHA-256 `88234ef47df1e887aa389cc3c6359fc901879abde0bf9f6f0378b21bbf3cd86e`)이며 artifact는 2026-12-04까지 유효한 것으로 조회되었다.
- #702는 CI success이지, 사용자 실기기 기능 합격으로 자동 승격하지 않는다. #702의 정확한 APK를 확보해 설치/기능 결과와 SHA-256을 연결해야 한다.
- #707 commit `2ed8d64af6cb98c7f132006352b661cde14c36fc`는 #702 이후 5 commits, 3 files changed. 변경을 별도 검토하고 사용자 확인/기능 회귀 결과에 따라 필요한 수정만 선별한다.
- #737 / current PR #1 head `6a03adf6b3e6b6fc41fa32c039a04a60b0d38a6e`는 자동 빌드 성공했지만 사용자 보고 회귀를 해결한 최종본이 아니다.
- 기존 PR #1은 Draft / open / unmerged 유지. recovery/2026-11-27-rebaseline branch 및 원본 branches, commits, artifacts는 삭제·강제 덮어쓰기 금지.
- upstream Maglev v0.33 baseline commit: `baaf83f0f3afd65d2eac135cce8b8bbabea8fbb3`; main/dev는 이 기준으로 보존한다.

## 2. 사용자에게서 확인된 실패 / acceptance blockers

1. UI 한국어화 누락.
2. YouTube URL/공유 감지 및 다운로드 경로가 실제로 안정적으로 작동하지 않음.
3. YouTube 분석/다운로드 속도가 YTDLnis보다 느림.
4. 화질·포맷별 다운로드 선택 기능이 사라지거나 제공되지 않음.
5. 오디오 다운로드 및 음질 선택 설정이 추가되었으나 실제 동작 불량.
6. 브라우저 영상 인식/재생 중 다운로드, Smart Connect, 백그라운드 재생 및 PiP 기능은 Barrel 분석자료와 사용자가 요구한 수준에 맞춰 실제 동작 검증 필요.
7. 사용자 거부한 #727: WireGuard startup, playback/PiP regression. 이 결과는 자동 테스트 성공보다 우선한다.
8. MSE 감지 알림/URL 후보만으로 실제 byte capture·세그먼트 조립·재생 가능한 파일 생성이라고 주장하지 않는다.

## 3. 최신 설계 문서 적용

최신 Library 문서 `통합_미디어_다운로더_전수조사_종합_설계기준서.md` (2026-11-27)와 `통합 미디어 다운로더 총괄 개발 가이드.md`를 설계 상위 기준으로 한다. 최신 기준서의 통제:
- 설계·변경 분류·테스트 기준 승인 전 기능 PR 병합/릴리즈/기준선 승격 금지.
- 현재 구현은 삭제하지 않고 file-by-file inventory 및 evidence classification.
- S1 source / S2 official docs-release / S3 binary static / S4 proposal / S5 target-device verified 구분.
- CI green, APK build, static strings는 Galaxy DEVICE_PASS가 아니다.
- upstream update는 blind bump 금지; source diff, compatibility, performance, license, regression, rollback 기록.

## 4. 목표 구조와 보존 원칙

- Maglev v0.33의 UI shell, browser, torrent, direct downloads, existing Transfers/notification/storage, HLS/DASH VOD, subtitle/search/RSS/backup 등 기존 기능은 golden tests를 확보하고 보존한다.
- 기존 maglev-engine / EngineHost를 single queue owner로 유지한다. yt-dlp/YTDLnis 기반 extractor는 metadata/format resolve 및 media handoff adapter로 연결하며 duplicate queue/service를 만들지 않는다.
- URL intake/classifier → media discovery providers → extractor/format resolver → capability-based engine router → one persistent transfer queue → file verify/save → playback/PiP pipeline.
- browser discovery: existing observer/DOM/request paths first; LJ/Barrel/MPMux behavior only as references. Preserve Cookie/Referer/Origin/request context when permitted; distinguish direct/HLS/DASH/opaque Blob/MSE and report confidence/source.
- yt-dlp runtime (Python, JS runtime, yt-dlp-ejs, FFmpeg/aria2 where needed) must be versioned and tested as packages; initialization/readiness and native errors must not be hidden.
- Smart Connect is a route policy (OFF/AUTO/ALWAYS/site rules), not the tunnel engine. Direct vs app-local WireGuard/proxy route must be explicit; no silent direct fallback for ALWAYS/tunnel-required tasks. WireGuard and PiP regressions are separate tracks.
- Korean string inventory covers every screen, dialog, error, empty/loading state, settings, permission prompt and diagnostics; no English leftovers without explicit rationale.

## 5. Work gates — do not skip

### R0 — Artifact and history forensic
- Download #702 APK artifact before expiry; record APK filename, package/version, ABI, signature, SHA-256.
- Inspect #702 run logs/artifacts and compare #702 → #707 → #727 rejected → #737.
- Read recovery audit and complete 230-file PR1 inventory; classify each file KEEP / RESTORE / PORT / REWORK / DROP with evidence.
- Preserve the #707 accepted WireGuard lifecycle source comparison point, but do not blindly cherry-pick.

### R1 — Baseline golden tests
- torrent, direct link, range/resume, queue persistence, notifications, storage, HLS/DASH VOD, browser, search/RSS/subtitles, app start.
- YouTube share/paste/watch/youtu.be/Shorts route, engine init, info/formats, format selection, output and playback.
- Record exact failure, log, device/OS, APK SHA and test steps.

### R2 — Restore core regressions
- Fix engine startup separately from native runtime loading.
- Restore video quality/format list and audio-only format/quality selection; validate actual selected format ID and output codec/container.
- Restore reliable YouTube metadata extraction and benchmark latency vs YTDLnis using the same URLs/network/device; no unsupported speed claims.
- Fix Korean localization inventory.

### R3 — Browser media and playback
- Smart Connect route policy and diagnostics.
- Barrel-style media recognition and download-while-playing only via supported browser/request context.
- MSE byte capture is a distinct feature gate with bounded memory/backpressure, fragment/timestamp/track handling, mux and playable output; detection alone fails gate.
- Background playback/MediaSession and PiP must keep the same active video surface, show real frames, correct crop/aspect, rotate/return without black surface.

### R4 — Device acceptance and release
- CI: unit/contract, JS typecheck, Rust/native, Android build/signature/version, emulator install-launch-smoke, artifact integrity.
- Galaxy E2E on exact release candidate: share → analyze → select format → download → verify file/hash/play; browser detect → download while playback; background/PiP; route/egress; Korean UI.
- Report Actions link, run ID, commit, APK SHA-256, ABI/signing and PASS/FAIL/NOT TESTED for each gate.
- Only exact tested APK may be marked ACCEPTED or released.

## 6. Immediate next action
Do not modify main/dev or merge PR #1. Continue on this recovery branch: establish exact #702 artifact + test results, then create the evidence-based regression matrix and selectively port fixes. No new feature code until R0/R1 identify the safe baseline.
