# PR #1 복기 및 사용자 실기기 실패 추적 (2026-11-25)

## 기준
PR #1: https://github.com/dragonslayers-k/Maglev_forked/pull/1
PR #1의 Maglev+ 제품 목표와 Release gate를 기능 기준으로 유지합니다. PR #1은 Draft/WIP이며 기능 완료나 릴리즈 승인을 뜻하지 않습니다.

## PR #1에서 반드시 이어갈 항목
- 원본 Maglev 기능/다운로드 큐/재개/HLS-DASH/자막/브라우저 회귀 방지
- WebView fetch/XHR, Resource Timing, DOM media, Service Worker 요청 관찰 및 HLS/DASH 후보 분류
- Chrome/Samsung Internet/YouTube 공유 및 붙여넣기 경로
- YouTube watch, youtu.be, Shorts, Live, embed/mobile 링크 파싱
- yt-dlp 형식 선택 → 기존 Maglev 다운로드 큐 → 저장/진행/취소/재개까지 end-to-end 연결
- 전체 앱 화면의 완전한 한국어화
- upstream 변경 선택 반영, 자동 병합 금지
- APK package/signature/size/native 16 KB alignment 및 Galaxy 실기기 release gate

## 사용자가 최신 설치 APK에서 재현한 실패
- youtu.be 링크 인식 및 다운로드 실패
- 전체 한국어화가 사실상 적용되지 않음
- 따라서 YouTube P1과 전체 한국어화는 실패/미완료로 유지하며, parser 테스트나 APK build success만으로 완료 처리하지 않습니다.

## 코드 원인과 후속 수정
- utils/browser/youtube.ts의 parseYouTubeLink는 new URL(raw)를 직접 호출해 youtu.be/<id>처럼 scheme 없는 붙여넣기 URL을 거부할 수 있었습니다.
- PR #3 branch에서 parseYouTubeLink가 알려진 YouTube hostname 형태에만 https://를 보완하도록 수정했습니다.
- scripts/test-youtube-intents.js에 scheme-less youtu.be/<id> 및 trailing slash 케이스, direct parser assertion을 추가했습니다.
- Android native-intent/QuickShare 경로도 PR #3에서 별도 내부 maglev://youtube-download route로 연결했습니다. 이 라우팅은 actual extraction/download 성공과 별개로 실기기 검증이 필요합니다.

## Actions 상태 해석
- PR #1 run #45580170442: Rust tests, JS checks, contract tests, arm64 Rust build, Build APK, Kotlin unit tests가 성공했습니다.
- PR #5 run #45606903560: Rust tests (no JNI feature)와 Build APK도 성공했습니다.
- 이 두 실행에서는 Rust test exit code 101이 재현되지 않았습니다. 사용자가 본 annotation이 다른 run이면 해당 run URL/ID가 있어야 정확한 실패 로그를 특정할 수 있습니다. Exit code 101은 무시할 warning이 아니라 Rust test process failure입니다.
- GitHub Actions의 warnings/notice는 각각 별도 검토하지만, failed job/error는 반드시 해결 전까지 gate를 막습니다.

## PR/워크플로/릴리즈 정리 원칙
- PR #2는 PR #5와 중복인 ARM64 packaging 변경이므로 닫힌 중복 PR로 유지합니다.
- PR #1은 제품 기능 통합 PR이므로 유지합니다.
- PR #3은 YouTube share/deep-link fix, PR #4는 yt-dlp stable update, PR #5는 ARM64-only packaging입니다. PR #3/#4는 PR #1의 P1에 종속된 검증용 변경이며, 독립적으로 최종 릴리즈하지 않습니다.
- 불필요한 workflow/release/tag 삭제는 실제 참조와 artifact 의존성을 확인한 뒤에만 수행합니다. 현재 연결 도구로 workflow/release delete를 실행할 수 있는 명확한 작업이 확인되지 않아 삭제 완료라고 보고하지 않습니다.
- Universal APK는 용량 문제로 기본 생성하지 않고 ARM64 APK를 기본 배포 대상으로 유지합니다.

## 완료 판정
1. Scheme-less / www / youtu.be / watch / Shorts / Live / embed / mobile links regression tests green.
2. YouTube app, Chrome, Samsung Internet share/paste on Galaxy opens dedicated downloader.
3. yt-dlp returns metadata and usable formats; selected format is actually downloaded into Maglev queue.
4. File appears in downloads, plays, and pause/resume/cancel work.
5. Korean UI coverage test passes across app screens; no claim of full localization until screen inventory is complete.
6. All CI jobs green, APK identity/signature/size/native alignment checked, then real-device test passed.
