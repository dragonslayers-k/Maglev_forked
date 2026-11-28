# Maglev+ 프로젝트 인수인계 / 개발 기준 (2026-11-25)

## 목적
원본 Kaos599/Maglev 기반의 독립 앱 **Maglev+** 개발. 원본 main은 보존. 앱 식별, 미디어 감지, 한국어 UI, 브라우저 공유, upstream 선택 동기화가 핵심.

## Git 상태
- main: upstream fork baseline, 수정 금지
- dev: 통합 baseline (main과 동일 SHA)
- feature/p1-video-detection-observer: 작업 브랜치
- PR #1: draft, base dev, 검증 전 merge 금지
- development/video-detection: baseline SHA와 동일한 중복 브랜치. Connector 삭제 API 미지원으로 삭제 보류
- Releases: 아직 없음

## APK 식별 / 브랜딩
- Application ID/package name은 원본과 달라야 함. 최종 APK에서 검증.
- 앱 표시 이름은 **Maglev+** (앱 서랍, 런처, 공유 target, About 등).
- 서명 키는 원본과 달라야 함. package + signer 차이로 원본과 별도 설치 가능. 최종 package, label, signer, SHA-256 기록.
- CI signing secret은 안전하게 보관, 공개 저장소에 포함하지 않음.

## 목표 및 작업 범위
1. **다운로드 엔진**: HTTP, magnet/torrent, HLS/DASH 등 원본 기능 회귀 방지. Native core는 테스트 우선.
2. **브라우저 미디어 탐지**: video/audio/source, lazy-loaded data-src/data-url/data-video, Resource Timing, fetch/XHR, WebView 요청, ServiceWorker 요청, HLS/DASH manifest/segment 후보. MIME·URL·페이지 컨텍스트 검증 및 dedupe.
3. **브라우저 공유**: 내장 브라우저, Chrome, Samsung Internet share intent 지원. 기존 구현을 먼저 확인하고 중복 필터 추가 금지. Galaxy 실기기 테스트 필수.
4. **한국어 UI**: 화면/설정/메뉴/오류/접근성 copy까지 번역하고 UI copy 테스트를 맞춘다. 기술 식별자, provider명, 형식코드는 예외.
5. **YouTube URL 지원**:
   - youtu.be short, youtube.com/watch, /shorts/, /live/, m.youtube 등 parser/canonicalizer로 인식.
   - redirect 처리, query/playlist/time parameters 보존 정책 테스트.
   - Maglev 일반 URL path에서 실패하면 전용 YouTube resolver/extractor path로 분기.
   - yt-dlp 등 extractor 후보의 라이선스, Android 런타임/ABI, 업데이트, 보안, 용량, format/audio/subtitle 선택, error UX 평가.
   - DRM·유료·로그인/연령/지역 제한 우회는 구현하지 않는다. 사용 권한이 있는 영상과 서비스가 허용하는 다운로드 방식만 지원.
   - 먼저 URL parser + short-link normalization + metadata fallback을 구현·검증하고, downloader integration은 별도 모듈로 개발.
6. **Upstream sync**: 매월 1일 KST 자동 비교 Issue. Auto-merge 금지. 변경 분류→선택 반영→CI/device check.
7. **Release**: CI green, APK identity/signature/SHA 검증, Galaxy 실기기 checklist 통과 전 stable APK 금지.

## 완료된 코드 (검증 상태는 별도)
- Maglev+ app identity/label changes (CI test assertion adjusted).
- Page scanner / WebView request observer / ServiceWorker observer / classifier and contract tests.
- HLS/DASH는 기존 Maglev native core를 사용, 중복 엔진 구현하지 않음.
- Korean README, detection contract, upstream sync policy, roadmap, analysis notes, Galaxy test checklist.
- Monthly upstream review workflow.
- Subtitle UI localization started in utils/subtitles/copy.ts; assertion updates in progress. CI JS failure at last run was English copy assertions stale after Korean copy, not Android/Rust compile.

## 최신 실패 / 현 상태 (2026-11-25)
- Run #45567864409: Contract PASS, Rust PASS, ABI plan PASS, arm64 Rust build PASS, APK build PASS; JS checks FAIL on subtitle English assertions.
- Latest assertion fix commit 52b848112f075f8dfd68f037641eb5762726702f; next CI triggered. Verify latest run before claiming.
- Workflow concurrency uses cancel-in-progress=true; frequent pushes cancel prior runs. Group related edits; avoid tiny commits.
- PR #1 draft. No release APK verified.

## 다음 작업 순서
1. 최신 CI 확인; 실패 job/assertions만 추려 확인.
2. Korean subtitle copy assertions 수정 (UI는 영어로 원복하지 말 것).
3. Korean copy coverage test with technical/provider allowlist.
4. Browser scanner: lazy media/embed/object/iframe detection, bounded scan, classifier filtering, test. Verify code commit before marking done.
5. YouTube URL parser/canonicalizer tests: youtu.be, watch, shorts, live, m.youtube, invalid URLs, redirect handling, playlist/time.
6. Dedicated extractor integration design/implementation; Android runtime, license, maintenance, formats, failure handling.
7. Chrome + Samsung Internet share intents on Galaxy.
8. APK identity test (package, Maglev+ label, signer, SHA) and install coexistence with original.
9. PR/docs/changelog. Keep draft until CI + device validation. Delete redundant branch only when supported.

## Release gate
Latest HEAD CI green; verified APK artifact; package/label/signer validated; coexistence install; Galaxy browser/share tests; YouTube short-link recognition + authorized workflow; no regression in torrent/magnet/HTTP/HLS/DASH/browser/download queue; docs and upstream policy complete.

## Continuation rules
- Main untouched.
- CI failure: diagnose → fix → commit grouped change → rerun; do not stop at reporting.
- Summarize failures, no huge raw logs.
- No "done" without commit and evidence.
- Do not make background-work promises. Continue within active turns and record the handoff here.
