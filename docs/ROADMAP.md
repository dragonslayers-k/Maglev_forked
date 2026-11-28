# 개발 로드맵

> 이 문서만 프로젝트 작업 우선순위를 관리합니다. 완료 표시는 관련 코드, 테스트, CI, 실기기 근거가 모두 확인된 경우에만 변경합니다.

## 기준선과 브랜치

- 원본: Kaos599/Maglev
- 원본 기준: Maglev v0.33, baaf83f0f3afd65d2eac135cce8b8bbabea8fbb3
- 사용자 포크: dragonslayers-k/Maglev_forked
- main: 원본 기준선 보존
- dev: 통합 브랜치
- feature/p1-video-detection-observer: 현재 기능 작업 브랜치

## P0 — 포크·라이선스·기준선

- [x] 원본과 fork 관계 및 공개 범위 확인
- [x] 원본 v0.33 커밋과 GPL-3.0-only 고지 확인
- [x] 원본 main 보존
- [ ] 저장소 이름을 최종 제품명으로 정리
- [x] 원본 Maglev 월간 비교·선별 반영 정책 문서화
- [ ] PR 이후 브랜치 및 Actions 상태 확인
- [ ] GitHub Actions 실행 활성화 및 PR CI 확인

## P1 — 미디어 감지 성공률

- [x] 응답 MIME으로 extensionless HLS/DASH/direct video/audio 분류
- [x] fetch GET 응답의 URL과 Content-Type 관찰
- [x] XHR GET 응답의 responseURL과 Content-Type 관찰
- [x] Resource Timing 재검사
- [x] WebView Service Worker 요청 관찰 경로 추가
- [x] 같은 URL의 기존 Found Item에 뒤늦은 MIME·스트림·해상도 정보 보강
- [x] HLS/DASH 매니페스트 감지 후 알려진 세그먼트 파일 노이즈 억제
- [x] MIME·감지 보고·항목 보강에 대한 단위/계약 테스트 추가
- [ ] PR CI 녹색 확인 (2026-11-25 run #45573899795 실패; assertion fixes committed, rerun pending)
- [x] 앱 내 업데이트 조회를 이 포크의 Releases로 전환
- [ ] Galaxy 실기기 G-01~G-18 수행
- [ ] iframe·MSE·blob 및 사이트별 실패 패턴을 실제 로그로 분류
- [~] YouTube 공유·붙여넣기 URL을 yt-dlp 추출 화면에 연결 (단축 URL, watch, Shorts/live/embed 포함); CI 및 실기기 검증 대기
- [~] 합본 동영상/오디오 형식을 기존 Rust 전송 큐에 연결; 분리 트랙 병합·고화질 포맷은 후속 구현

## P1.5 — YouTube URL 지원

- [x] YouTube URL parser: youtu.be/watch/shorts/live/embed/mobile/music URL 식별 및 canonicalization (단독 parser)
- [ ] Parser를 native intent/share 및 Add Download UI 흐름에 연결
- [ ] 단축 URL·watch·shorts 링크가 일반 direct-file probe에서 NOT_A_FILE로 종료되지 않도록 별도 UX 처리
- [ ] 권리자가 소유하거나 다운로드를 허가한 콘텐츠 지원 방식의 기술·라이선스·정책 검토
- [ ] extractor/다운로드 엔진 구현과 테스트 (DRM/접근제한 우회는 범위 제외)

## P2 — 다운로드 호환성

- [x] 기존 호스트별 CookieManager 쿠키 전달 경로 보존
- [x] 기존 User-Agent, Referer, Origin 전달 경로 보존
- [ ] 원본 WebView 요청 헤더 중 안전하게 전달 가능한 허용 목록 정의
- [ ] Accept-Language 및 세션별 헤더 필요성을 사이트 fixture로 검증
- [ ] 직접 미디어 파일에 한해 제한된 메타데이터 프로브 검토
- [ ] 만료 URL 재탐색과 인증 실패 진단 개선
- [ ] 사이트별 어댑터는 코드 내장형·테스트형으로만 추가 검토
- [x] 기존 Android ACTION_SEND / ACTION_VIEW 공유 카드와 Maglev 브라우저 인계 경로 확인
- [x] Quick Share 카드 문구를 Kotlin·TypeScript 양쪽에서 한국어화
- [ ] Galaxy의 Chrome 및 Samsung Internet에서 공유 메뉴 노출·페이지 인계 실기기 검증

## P3 — 한국어 UX

- [x] 주요 하단 탭 라벨과 브라우저 핵심 조작 문구 한국어 적용
- [x] 외부 브라우저 공유 카드의 상태·동작 문구 한국어 적용
- [x] Found Files 목록과 스트림 화질 선택·다운로드 화면 한국어 적용
- [x] 미디어 컨텍스트 메뉴와 주요 감지 오류 한국어 적용
- [ ] 온보딩·설정·다운로드 목록·상세 화면 전체 문자열 정리
- [ ] 한국어 문구 회귀 검사와 접근성 라벨 검사

## P4 — 보안·배포·실기기 검증

- [x] 페이지 보고 JSON의 nonce·크기·URL·타입·MIME 검증 유지
- [x] 미디어 감지 JavaScript에서 응답 본문·쿠키·인증 헤더를 전송하지 않도록 설계
- [x] Service Worker 관찰을 GET 및 현재 페이지 출처 일치 조건으로 제한
- [ ] PR CI에서 typecheck·JS 계약·Kotlin/Rust 빌드 성공 확인
- [ ] 의존성 보안 감사 결과 확인
- [ ] SAST 및 SBOM 적용 범위 확인
- [ ] DRM·Live 거부 정책 검증
- [ ] Galaxy 실기기 설치, 다운로드, 병합 및 최종 파일 재생 검증
- [ ] 릴리스 APK 해시·서명·소스 아카이브·라이선스 고지 확인

## 현재 상태

P1 미디어 감지 코드는 기능 브랜치에 커밋했으나 PR CI와 Galaxy 실기기 검증은 미완료입니다. YouTube yt-dlp 어댑터와 전용 형식 선택 화면을 구현 브랜치에 추가했습니다. CI와 Galaxy 실기기 검증이 끝나기 전까지는 완료로 표시하지 않습니다. P1 기능을 완료 또는 릴리스 가능으로 표시하지 않습니다.
