# Maglev+ 통합 기능 감사·실제 이식 계획 (2026-11-26)

## 사용자 실기기 검증 상태 — FAIL

사용자가 제공한 44초 Galaxy 녹화 확인:
- YouTube에서 영상 출력 MP4와 오디오 출력 MP3 선택 UI는 보인다.
- 오디오 source는 WEBM/Opus로 표시되고 target MP3가 선택되어 있다.
- 완료된 전송 카드에는 최종 파일 확장자/코덱/변환 완료 결과가 노출되지 않는다.
- 별도 전송은 `Site refused · Paste new link` 오류로 실패했다.
따라서 선택 UI 표시만으로 확장자 변환 성공으로 인정하지 않는다. 사용자 보고대로 YouTube target container는 FAIL.
- WireGuard는 사용자 기기에서 계속 실패한다고 보고됨. CI/native start와 원격 handshake·실제 tunneled HTTP request는 별개이므로 FAIL.
- Barrel 기능은 실질 이식이 부족하고 About 통합 원천 설명도 코드와 맞지 않음. FAIL.
- Android MSE/SourceBuffer recording은 현재 미구현. 안내 팝업 제거는 녹화 기능이 아님.

## CI 상태
- Actions #532 PASS: https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45833851437
- Head: `240d42b6680eb8245cd33ab6253aee9447a7b0c6`
- JS/Rust/contracts/arm64 APK build 통과. **Galaxy E2E나 사용자 기능 수용을 의미하지 않음.** PR #1은 Draft, final release 승인 아님.

## P0 — YouTube 실제 출력 컨테이너

코드 위치:
- UI `app/youtube-download.tsx`
- extractor/format add `modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/YoutubeDownload.kt`
- FFmpegKit `modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/MediaContainerConverter.kt`
- completion queue `modules/maglev-engine/android/src/main/java/com/maglev/engine/EngineHost.kt`

소스에는 7 video/8 audio target options, converter 및 postprocess queue가 있다. 그러나 사용자 저장 결과는 실패했으므로 code presence는 acceptance가 아니다.

필수:
1. UI selected formatId/playerClient/kind/container/bitrate를 JS bridge→native add→transfer ID→postprocess metadata까지 추적하고 default/original overwrite 금지.
2. source container와 실제 downloaded intermediate container를 구분(특히 DASH/HLS mux output).
3. transfer ID에 postprocess spec을 원자적으로 기록하고, real native finished + nonempty file일 때만 convert.
4. 상태를 Downloading → Converting → Converted/Conversion failed로 분리. 변환 전 Done 표시 금지.
5. 변환 후 output exists/size/signature/container/codec 검사, MediaStore scan, transfer filename/open/share path를 final outputName으로 갱신.
6. 실패·cancel·process death 후 원본 보존, failure reason 명시. extension rename만으로 conversion 금지.
7. expired/site-refused URL은 fresh URL 재조회, format/container selection은 보존.
8. source != target test 필수; MP4 source→MP4 test만으로 conversion pass 금지.

Acceptance:
- WEBM/Opus→MP3 192 kbps: signature=MP3, codec/bitrate probe, Android playback.
- M4A/AAC→MP3 actual transcode.
- MP4→MKV actual Matroska remux.
- incompatible source→MP4 encode fallback playable.
- original preserves original ext/container.
- conversion fail/cancel/restart: source retained, state correct, no false Done.
- final name consistent in transfer card, folder, share/open.

## P0 — WireGuard real handshake and proxy

Code:
- UI `app/settings/wireguard.tsx`
- `WireGuardController.kt`, `WireGuardProfileStore.java`, `NativeTunnel.java`
- `native/wireguard/cmd/jni/main.go`, `engine.go`, `proxy.go`
- download routing `EngineHost.addDownload`

Present in source: .conf import/validation, Android Keystore AES-256-GCM no-backup storage, wireguard-go userspace tunnel, authenticated loopback HTTP proxy, fail-closed setup. Native Start currently returns local proxy port; this **does not prove peer handshake, DNS, AllowedIPs route or internet request**. User device failure = FAIL.

Required:
1. Expose separate states: native process started / handshake confirmed / proxy request succeeded / download tunneled. Do not label process start as connected.
2. Add safe handshake/peer stats if upstream supports; otherwise show “handshake unconfirmed” and test actual outbound request.
3. Validate config fields and supported directives; clear error for unsupported directives.
4. Check endpoint DNS/UDP and userspace DNS/AllowedIPs without system route change.
5. Real HTTPS CONNECT/download through proxy; IPv4/IPv6, DNS, network change, stop/restart.
6. Any failure must keep closed proxy and reject; no direct fallback.
7. Clearly show coverage: Maglev HTTP/HTTPS downloader only; torrent/DHT and browser WebView excluded.
8. Test profile import/replace, app process death, reboot, proxy restore and tunnel stop.

Acceptance: valid config → handshake + HTTPS request succeeds; bad key/unreachable endpoint/DNS/AllowedIPs fail without direct leak; disable restores previous proxy; no VpnService/APN/device-wide routing.

## Barrel 1.1.2 — clean-room port plan

Full original static-analysis report is stored at:
`docs/reference/Barrel_1.1.2_APK_심층_분석_다운로드_기능_이식_설계서.md`

The report is APK static analysis (class/package/string traces), not complete runtime proof. Do not bundle Barrel APK/binary or copy private implementation. Reuse Maglev code where equivalent; implement only gaps clean-room after license/privacy/security review.

| Barrel analysis area | Port target | Maglev+ current state |
|---|---|---|
| Direct/progressive | HEAD/Range probe, 206 + Content-Range, ETag/Last-Modified/size check, safe resume | Range path exists; Barrel parity and real server resume not accepted |
| Parallel parts | stable identity, per-part state/retry/backoff, merge validation | segmented path exists partially; parity and integrity not accepted |
| Web media detection | WebView request + DOM + MIME + manifest + headers + page context + dedupe | partial request/DOM detection; site plugins/session-header restore incomplete |
| HLS | master/media playlist, variant, init/byterange, sequence, resume signature, VOD/live, mux | VOD path partial; live record/resume not accepted |
| DASH | MPD representations/templates/lists, audio/video selection, segment resume/mux | path partial; full matrix/mux not accepted |
| MSE/Blob | MediaSource/SourceBuffer hooks, appendBuffer chunks, init/media ordering, bounded disk spool, final mux | detection/notice only; byte capture/recording not implemented |
| subtitles | track/language/format, export, filename association, resume | path/UI partial; source coverage/resume incomplete |
| lifecycle | keepalive, progress, retry, cancel, playback | shared Transfers retained; Barrel parity not proven |

## MPMux browser recording — real feature, not popup

Current app does not record browser buffers. Implement:
- trusted active WebView origin observer for MediaSource/SourceBuffer lifecycle and appendBuffer payloads;
- init segment + media segment order/time/sequence;
- bounded native file spool with backpressure, storage limits, consent, cancel/cleanup;
- mux/finalize, transfer entry, file signature and playback verification;
- HLS live rolling playlist and stop/finalize path;
- no DRM/EME decrypt, key extraction, license bypass or protected capture; refuse protected content;
- scoped request headers only, no credential logging.

## About → 통합 구성·참고 원천

Must state code presence and validation separately:
- YTDLnis/yt-dlp/NewPipe: extraction/format paths exist; target-container output currently failed user test.
- FFmpegKit + postprocess queue exists; MP3/M4A/Opus/container conversion not accepted until actual file validation.
- WireGuard userspace/proxy code exists; remote handshake and actual download path failed/unverified.
- Barrel analysis is present; functional port is per-feature, not complete.
- MPMux static Range/HLS vs MSE/live capture must be distinguished; MSE/live not implemented.
- LJ site plugins/header/session reconstruction partial.
- About links to this audit and the original Barrel analysis.

## Release gate
1. Exact head CI green; no stale/cancelled artifact.
2. APK signature/version and install/launch on Galaxy.
3. YouTube source≠target container tests pass; actual bytes/codec/name match.
4. WireGuard handshake + tunneled HTTP/HTTPS pass; fail tests prove no direct leak.
5. Barrel features individually implemented and tested; no blanket parity claim.
6. MSE recording from permitted non-DRM fixture creates playable file; HLS live finalize works.
7. Korean sweep of About/YouTube/WireGuard/browser/errors.
8. User confirms candidate works; only then baseline/release.

## Work order
P0 YouTube output postprocess state/file integrity → P0 WireGuard stage diagnostics and real tunnel request → P1 truthful About/source register → P1 Barrel Range/Resume/Parts → P1 HLS/DASH/subtitle gaps → P1 MSE/Blob recording → P2 site plugins/header reconstruction and full Korean sweep.

## Handoff
2026-11-26: user rejected candidate due selected extension not applying, WireGuard failure, Barrel feature gap, inaccurate/empty About reference section, and missing browser recording. Screen recording reviewed; final output extension is not exposed and a transfer reports Site refused. #532 CI passed but does not resolve user-reported runtime failures. Update this document only with actual test evidence.
