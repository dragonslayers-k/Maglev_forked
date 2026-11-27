# Maglev+ 최종 인수 기준 — 미디어 엔진 / Android VPN / Barrel Smart Connect

상태: 미완성 릴리즈 차단 목록. 소스 존재·화면 표시·APK 빌드 성공만으로 완료 처리하지 않는다.

기준 자료: Library의 `Barrel_1.1.2_APK_심층분석_다운로드기능_이식설계서.md`. 이 문서는 APK 정적 분석(DEX 문자열·클래스·구성 흔적)이며 런타임 정상 동작을 보증하지 않는다는 한계를 함께 따른다.

## 1. 모든 사이트 공통 미디어 인식·저장

- [ ] HTML `video/audio/source`, dynamic DOM, WebView network metadata, HLS/M3U8, DASH/MPD를 공통 후보 파이프라인으로 감지한다. Naver Clip 전용 해결 코드만으로 완료하지 않는다.
- [ ] 후보별 페이지 URL, media element/manifest 식별자, 제목, duration, MIME/codec, 해상도/bitrate, Referer 및 필요한 세션 헤더를 보존한다.
- [ ] 동일 미디어는 근거 기반으로 묶고, 확실하지 않으면 별도 후보로 둔다. 비슷한 URL 문자열만으로 합치지 않는다.
- [ ] 기본 파일명은 provider/page title 우선, 안전한 NFKC 정규화 및 금지문자 제거, 실제 컨테이너 확장자 정확히 한 번. 제목이 없을 때 안정적 fallback. 사용자가 지정한 이름/컨테이너 선택은 보존한다.
- [ ] 직접 다운로드: Range probe, 서버 206/Content-Range 검증, ETag/파일 변경 보호, Resume, 지원 서버에 한한 Parallel Parts, 단일 스트림 fallback, pause/cancel/retry, part integrity/final merge.
- [ ] HLS: master/variant/quality, media segment, byte range, init segment, audio/subtitle tracks, VOD resume, output validation; live 정책은 명확히 표시.
- [ ] DASH: MPD representation, SegmentTemplate/Timeline/List, 별도 audio/video, resume, mux 및 output validation.
- [ ] MSE/Blob: MediaSource/SourceBuffer/addSourceBuffer/appendBuffer 관찰, MIME/codec 및 bounded segment capture. blob URL을 HTTP URL처럼 직접 넘기지 않는다. 원본/인증 세그먼트를 찾지 못하면 제한 사유를 정확히 보여준다. DRM 우회는 하지 않는다.
- [ ] 재생 중 다운로드 및 백그라운드 playback/media session. PiP는 실제 audio/video 재생 중에만 노출하며 native compact window에서 browser chrome/sheet/tray가 캡처되지 않아야 한다.

## 2. Android 시스템 WireGuard VPN

현재 app-local HTTP(S) download proxy는 시스템 VPN이 아니다. 최종 구현은 다음을 만족해야 한다.

- [ ] Android `VpnService` lifecycle, user consent, foreground notification, TUN routing 및 DNS policy를 지원되는 WireGuard userspace backend/reference integration으로 구현.
- [ ] .conf import, encrypted private key/config storage, handshake/peer state, latest handshake, RX/TX bytes, keepalive, reconnect, MTU, IPv4/IPv6, DNS leak handling.
- [ ] Browser/WebView와 download engine이 동일한 tunnel route를 사용한다. split tunnel/exclusions는 사용자 선택으로만.
- [ ] 진단은 tunnel interface up, peer handshake, HTTPS egress IP/country를 각각 구분한다. toggle enabled만으로 connected 표시 금지.
- [ ] 실제 Samsung device에서 foreign egress country와 blocked-site reachability를 확인한다.

## 3. Barrel Smart Connect (VPN과 별도)

- [ ] OFF/AUTO/ALWAYS. AUTO는 bounded failure detection 후 대체 연결 방식으로 재시도.
- [ ] DNS: System/AdGuard/Cloudflare/Google/Custom.
- [ ] HTTP/SOCKS4/SOCKS5 proxy, auth, bypass, connection test.
- [ ] Site rules: host/domain, Smart Connect override, proxy override, connections, User-Agent, Referer, custom headers.
- [ ] 정확한 한계 안내: DNS/SNI/transport 기반 차단은 개선될 수 있으나 IP-block을 보장해 해결하지 않으며, VPN/proxy 없이 IP를 숨기지 않는다.

## 4. Localization, branding, share flow

- [ ] UI 및 오류/권한/공유/설정 문구 전수 한국어 검수.
- [ ] Maglev+ 표기와 앱 아이콘의 + 마크 전수 점검.
- [ ] Android share/chooser는 사용자가 대상 앱을 선택하는 올바른 흐름이어야 하며, 앱 자체를 잘못 선택하라고 안내하지 않는다.

## 5. Release verification

- [ ] Typecheck, unit/contract tests, Android build.
- [ ] Emulator: install, launch, navigation, permission and core smoke tests.
- [ ] Samsung Galaxy: 여러 unrelated site에서 video/audio detection, playback PiP, title/extension, direct/HLS/DASH output, background behavior.
- [ ] VPN: actual peer handshake, egress IP/country, browser route and download route, blocked-site test.
- [ ] 각 항목을 Implemented / CI-tested / Emulator-tested / Real-device-tested로 분리 보고. 미확인 항목은 완료라고 쓰지 않는다.

## 6. Implementation order from Barrel analysis

1. Direct Downloader + Range + Resume + Parallel Parts.
2. DB-based recovery + foreground execution.
3. WebView HTML/network media detection + media UI.
4. HLS variant/segment/resume.
5. DASH representation/segment/resume.
6. Subtitle.
7. Muxing/output validation.
8. MSE/Blob detection.
9. Download while playing and playback priority.
10. Real-device stability/security/release.

Barrel APK static analysis evidence is not runtime acceptance; test each feature on real sites and devices.
