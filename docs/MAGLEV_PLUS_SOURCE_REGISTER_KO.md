# Maglev+ 통합 다운로더 원천 프로그램 등록부

작성: 2026-11-26  
목적: 원천별 기능을 무작정 복사하지 않고, 라이선스·기술 경로·실제 반영 코드·검증 상태를 구분해 통합 기준으로 사용한다.  
주의: 이 문서는 소스 등록부이며, 등록되었다는 사실은 기능이 구현·검증되었다는 뜻이 아니다.

## 원천 및 레퍼런스 목록

| 원천 | 종류 / 적용 대상 | 차용 원칙 | 현재 상태 / 완료 검증 |
|---|---|---|---|
| [Maglev](https://github.com/Kaos599/Maglev) | 오픈소스 기반 앱, torrent/direct download, Transfers, browser, HLS/DASH, subtitle, RSS | 앱 구조와 기존 다운로드 코어 유지. 기능 중복 엔진을 새로 만들지 않고 공통 Transfers로 연결 | 통합 기반. 원본 기능 회귀·Galaxy 실기기 검증은 완료 전 |
| [YTDLnis](https://github.com/deniscerri/ytdlnis) | yt-dlp 기반 Android downloader UX / format selector / queue / presets | UX와 format selection 기준으로 분석; 코드를 복사하기 전 라이선스와 의존성 확인 | format UI 일부 적용. 전체 기능 parity 아님; playlist/preset/post-processing 등 개별 감사 필요 |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | 사이트 추출·format metadata·fallback engine | yt-dlp Android runtime에서 지원되는 범위로 호출. client/runtime/token 조건을 기록하고 사이트별 검증 | 일부 YouTube 추가 format 및 fallback. 모든 supported site가 Maglev+에서 동작한다고 보장하지 않음 |
| [youtubedl-android](https://github.com/yausername/youtubedl-android) | Android Python/yt-dlp wrapper, runtime/ABI integration | Android wrapper/실행환경 레퍼런스. bundled version, ABI, JS runtime, license, package size 확인 | adapter 경로 존재. FFmpeg post-process/MP3 변환은 검증된 포함 상태 아님 |
| [NewPipe Extractor](https://github.com/TeamNewPipe/NewPipeExtractor) | 빠른 YouTube metadata 및 adaptive format extraction | 빠른 조회 경로. yt-dlp fallback과 format identity/selection 기준을 통일 | NewPipe 경로 존재. 실기기에서 source format, resolution, A/V merge 및 playback 확인 필요 |
| [LJ Video Downloader](사용자 제공 APK 분석 자료) | 비공개 APK 레퍼런스: WebView/network media detection, site-specific extraction | APK에서 관찰 가능한 동작만 참고. 출처가 확인되지 않은 decompiled mapping을 확정 사실로 취급하지 않음 | WebView observer·DOM/resource/request 감지 일부 구현. site-specific plugin/qreq/qscrape 전체 이식 아님 |
| [MPMux Video Downloader Chrome extension](https://chromewebstore.google.com/detail/video-downloader-mpmux/mbflpfaamifmmmkdjkcmpofpccfmlmap?hl=ko) | Chrome 확장: MP4/WEBM, HLS, 라이브 녹화, concurrent/Range 다운로드 | extension behavior as reference only; no direct extension code port without license/source audit | 현재 Maglev+에는 static Range/HLS 일부 흐름만 존재. extension’s complete live buffer capture/mux is not integrated or verified |
| [MPMux Static Downloader](https://mpmux.com/ko/staticdownloader) | 브라우저 확장/웹 미디어 다운로드 레퍼런스 | Range, segmented download, manifest/file workflow의 설계 비교 | 일부 static Range/HLS 기능을 Maglev 코어로 사용. MPMux 자체 코드의 Android port로 간주하지 않음 |
| [MPMux Video Buffer Muxer](https://mpmux.com/buffermuxer) | MSE/SourceBuffer media capture 및 muxing 레퍼런스 | browser buffer lifecycle, bounded capture, muxing behavior 분석 | 현재 구현 branch의 live/MSE work는 CI 및 runtime 검증 필요. DRM/EME bypass 금지 |
| [seo-rii/morphe-wireguard-patches](https://github.com/seo-rii/morphe-wireguard-patches) | app-local WireGuard/proxy architecture patch reference | 시스템 VPN/APN 변경 없는 앱 내부 proxy/tunnel 구조만 분석; 각 downloader engine이 proxy를 실제 사용하도록 명시 연결 | 설계 참고 단계. MAGLEV+의 통합 WireGuard 기능 구현·engine coverage 검증 전 |
| [04pril/morphe-wireguard-patches](https://github.com/04pril/morphe-wireguard-patches) | BitChord/Morphe related patch reference (user-supplied) | user-supplied patch/source review; do not assume same implementation as seo-rii fork | Separate research reference; verify exact code/commit before adoption |
| WireGuard Android / wireguard-go upstream | WireGuard userspace tunnel libraries | License, Android compatibility, app-local routing/proxy integration and ABI review | Not declared integrated until dependency + config lifecycle + data path tests pass |
| FFmpeg / Android encoder candidates | audio transcode, remux, metadata/post-processing | Only add a 16 KB page-size compatible, licensed, ABI-verified runtime; never rename extensions as conversion | MP3/transcode support not complete/verified |
| User-provided Claude analysis, source notes and APKs | project requirements and reverse-engineering references | Treat as evidence/lead; cross-check against repository code and executable behavior | Inputs for audit; not a substitute for source implementation or E2E proof |

## Integration architecture (required)

1. One shared download queue/Transfers model for direct HTTP, torrent, HLS/DASH, YouTube and browser-detected media.
2. Extraction engines are adapters, not separate download managers: NewPipe fast path → yt-dlp fallback; browser observer → classifier → dedupe → user selection → shared Transfers.
3. Each adapter must preserve selected format/client/codec/container, audio presence, headers/cookies when permitted, expiry/refresh behavior, and cancellation/error state.
4. App-local WireGuard/proxy is a separate opt-in network path. It must not call Android system VPN APIs, modify APN, or silently switch the phone-wide route. Each engine needs a proxy-routing test; unsupported engines must be explicitly marked rather than falsely covered.
5. No unsupported claims: MP3 conversion, MSE live capture, universal yt-dlp site support, or LJ feature parity are not complete until tested on output files/device.

## Final acceptance matrix

For each source-derived feature record: upstream URL + exact commit/version, license, files/adapters changed, test ID, CI run + exact SHA, Galaxy test outcome, output file metadata (container/codec/resolution/size/hash), and known limitations. CI success alone is not feature acceptance. No source is promoted to “integrated and verified” without executable evidence.

## Current known source gaps

- YTDLnis UX and format handling are not full parity.
- yt-dlp client/runtime/token/site compatibility is partial and needs per-site coverage.
- LJ's site-specific extraction/plugin behavior is not fully ported.
- MPMux live/MSE implementation needs source-to-code audit and actual captured output validation.
- FFmpeg conversion/post-processing is not currently a verified feature.
- App-local WireGuard is a separate feature and not currently an integrated, verified downloader route.
