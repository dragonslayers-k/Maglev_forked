# Maglev+ 프로젝트 인계 및 재개 기록

기준일: 2026-11-25 (KST)
저장소: https://github.com/dragonslayers-k/Maglev_forked
작업 브랜치: `feature/p1-video-detection-observer`
Draft PR: #1 → `dev`
제품 표시 이름: **Maglev+**

## 프로젝트 목표
1. 원본 Maglev을 보존하면서 독립 패키지 ID·앱 표시명·앱 업데이트 경로를 가진 별도 설치 APK.
2. 한국어 UI를 확장하고, Chrome/Samsung Internet 등 외부 브라우저 공유와 내장 브라우저에서 미디어 감지·다운로드를 개선.
3. 기존 다운로드·Torrent·HLS/DASH·자막 기능을 회귀 없이 유지.
4. YouTube 공유 URL 및 youtu.be 단축 링크를 정확히 식별하고 정규화. 이후 권리자가 소유하거나 다운로드 허가된 콘텐츠에 대한 합법적 다운로드 지원을 검토. DRM/접근제한 우회 기능은 구현하지 않음.
5. Upstream Maglev 변경을 매월 확인하고 필요한 변경만 검토·통합.
6. 문서/테스트/CI/실기기 검증 후 APK와 Release를 생성.

## 브랜치 보호 원칙
- `main`: 원본 기준선 보존, 직접 개발 금지.
- `dev`: 검증된 변경 통합.
- `feature/p1-video-detection-observer`: 기능 작업.
- PR #1은 Draft이며 CI/실기기 검증 전에 merge하지 않음.
- 원본 Maglev: `Kaos599/Maglev`, 기준 v0.33 / SHA `baaf83f0f3afd65d2eac135cce8b8bbabea8fbb3`.
- GPL-3.0 및 upstream copyright notices 유지.

## 2026-11-25 최근 실패 재현 기록
Run: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45573899795
Commit: `d13e7105691c025043fa1d291645b84454044535`
결과: Failure

- Contract tests: 성공
- Rust tests (no JNI): 성공
- Rust Android Plan ABIs: 성공
- Rust Android arm64-v8a: 성공
- JS checks: 실패 — subtitle row test가 한국어 UI 문구와 불일치하는 4개 기대값을 검사.
- Build APK: 실패 — `YouTubeUrlTest.timeFormatsAndBounds`의 52행 테스트가 시간값이 범위 밖이면 URL 전체가 null일 것으로 잘못 기대. 실제 parser는 동영상 ID를 유효하게 유지하고 잘못된 timestamp만 무시하므로 테스트 assertion 오류.

## 바로잡은 작업 (run 45573899795 이후)
- YouTube URL timestamp 범위 테스트: URL 전체가 null이 아닌 `startSeconds == null`을 검사하도록 변경.
- subtitle-row contract test: 구현된 UI copy에 맞춰 프랑스어/독일어 label, `선택` 버튼, 10/10 pack summary assertion 정정.
- 수정 commits:
  - `5276145cfaca1f47ffd1b0d17c82425426e42cb5`
  - `c78ff271656b1a7cacccdc42488e63bef72d6de2`
- 두 수정은 CI 재검증 전 상태. 새 run이 생성되면 해당 run의 실패 로그를 보고 남은 문제만 수정할 것.

## YouTube 기능 현황 (중요)
- `YouTubeUrl.kt` parser는 존재하나 현재 코드 검색상 실제 UI/공유/다운로드 흐름에 연결되지 않았음.
- URL forms: `youtu.be`, `youtube.com/watch?v=`, `/shorts/`, `/live/`, `/embed/`, mobile/music domains; canonical URL; playlist ID and start-time parsing.
- Parser는 URL 식별/정규화만 수행. 현재 실제 YouTube media extraction/download는 미구현.
- Next: Android/iOS share/native intent와 Add Download flow에서 YouTube URL을 인식하고 짧은 링크를 canonicalize, UI에서 일반 direct-download probe와 분리. 이후 다운로드 구현 방식/라이선스/서비스 정책을 검토하고, 권리자가 허가한 콘텐츠만 지원하는 범위에서 extractor/API feasibility를 조사. DRM·access control bypass 및 private/authenticated content extraction은 금지.
- YouTube CI tests must test canonicalization and invalid hosts, URL size, timestamp bounds, playlist semantics.

## Next priority order
### P0: CI stabilization (avoid repeated full runs)
1. Latest branch SHA and CI run status check.
2. Re-run/trigger CI after the two assertion fixes.
3. If JS fails, inspect exact assertion and source copy, do not blindly alter UI.
4. If Gradle tests fail, inspect failing test XML/log and fix source or test with root cause.
5. Build APK only once CI tests pass; inspect artifact and report hash/package identity.

### P1: Real user-facing improvements
1. Integrate YouTube URL parser into share/native-intent and Add Download route; preserve direct URL path for non-YouTube.
2. Handle YouTube short links and watch/shorts/live links without false NOT_A_FILE failure; give distinct, clear UI.
3. Continue Korean localization on screens that are still English; use string catalog, avoid hardcoded copy.
4. Validate media detection: extensionless video, MIME, HLS/DASH, fetch/XHR, Resource Timing, Service Worker; reduce false positives.
5. External share test: Chrome + Samsung Internet share page/link to Maglev+; record exact behavior.

### P2: QA and release
- Galaxy device checklist G-01–G-18
- install side-by-side with original Maglev
- download permitted direct video, HLS, DASH; pause/resume; storage permission; external-share
- APK applicationId, app label, version, signing certificate, SHA-256, artifact
- GPL notices, SBOM/security review, release notes, APK release in fork Releases

## Definition of Done
A feature is not marked complete merely because CI passes. It must have code, a relevant automated test, CI evidence, and (where Android behavior matters) device test evidence. No release claims before artifact inspection and device validation.

## Resume note
Start by checking branch HEAD, latest PR #1 checks, and the two commits above. Do not stop at a failure summary: retrieve failed job logs, identify the first root-cause failure, patch, and continue. Keep main untouched.