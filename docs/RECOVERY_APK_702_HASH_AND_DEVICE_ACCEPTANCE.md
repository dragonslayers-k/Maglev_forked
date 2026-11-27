# Downloaded and hashed recovery APK — #702

- Source workflow run: [#702](https://github.com/dragonslayers-k/Maglev_forked/actions/runs/45980241030)
- Source commit: `45e685603a3a23507b61cb49398a78380d5db7a5`
- Artifact ID: `15189688044`
- Artifact archive name: `run702-apk.zip`
- Archive SHA-256: `88234ef47df1e887aa389cc3c6359fc901879abde0bf9f6f0378b21bbf3cd86e`
- Extracted file: `app-arm64-v8a-release.apk`
- APK size: `63,671,691 bytes`
- APK SHA-256: `065d29dfcb19ad630c6bc906bfadecb2bd31395edc707ad3e35cf1f54b10c2de`
- ABI: `arm64-v8a` (confirmed by native library directory)
- Included native FFmpeg libraries and React Native bundle; exact package/version metadata not decoded in this environment.
- GitHub Actions jobs: Contract tests, JS checks, Rust tests, ABI planning, Rust Android arm64 build and Build APK all success; PR APK reuse skipped.
- Local checks: ZIP integrity and SHA-256 verified. No Android SDK/adb/apktool available in this environment, so package ID/version/signature scheme and install-launch cannot be independently verified here.
- `jarsigner` reports no JAR/v1 signature; that does **not** determine APK v2/v3 signing status. Verify with Android `apksigner verify --verbose --print-certs` before production use.

## Classification

**RECOVERY BASELINE APK / INSTALL CANDIDATE — NOT FINAL ACCEPTED RELEASE.**

It is the exact #702 CI output and is preserved for rollback and device comparison. The user's subsequent report on later builds includes regressions, and #702 itself has not been confirmed by a complete Galaxy test matrix in this conversation. Do not claim the candidate fixes those regressions.

## Required Galaxy comparison

Install as a separate test step (avoid version downgrade if a newer package is installed; uninstalling may erase app data). Record:
- package/version and install result;
- first launch and engine readiness;
- Korean strings/screens;
- YouTube share and pasted URL for watch/shorts/youtu.be;
- analysis time against YTDLnis on same URL/network/device;
- format list, selected format ID, audio-only and quality option;
- complete download, output codec/container, file size/hash and playback;
- browser media detection, download while playback;
- background audio and PiP actual frames/orientation/return;
- WireGuard start, handshake, real egress and route coverage;
- logs for each failure, with tokens/cookies/keys redacted.

Only the exact APK SHA above can be marked device-tested if this file is installed. Any rebuilt APK requires a new hash and a new acceptance record.
