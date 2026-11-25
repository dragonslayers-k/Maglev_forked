# ytdlp-engine (experimental)

Standalone Expo native bridge for the Android yt-dlp runtime. This package is an early G2 scaffold; it is not yet wired to the YouTube screen or the shared Maglev Transfers list.

## API
- `init()`: initialize bundled runtime and report version.
- `getInfo(url)`: return sanitized video metadata and format properties (never expose format URLs to JS).
- `download(id, url, selector)`: start in app-private staging and emit progress/completion/failure events.
- `cancel(id)`: cancel the native yt-dlp process by ID.
- `update('stable' | 'nightly')`: update the bundled yt-dlp executable.

## Current limitations / acceptance still required
- No shared Transfers persistence, foreground-service ownership, restart recovery, MediaStore/SAF finalization, or retry policy yet.
- No FFmpeg integration in this module; split video/audio formats and MP3 post-processing are not accepted until the runtime/post-processing package is validated.
- youtubedl-android 0.18.1 bundles Python 3.8; compatibility with current yt-dlp YouTube requirements, yt-dlp-ejs and PO Token/runtime behavior must be verified on Galaxy.
- Native API compile, install, init, public metadata/formats, download, progress, cancellation and saved-file playback must be validated on a physical Galaxy device. CI is not device acceptance.
- Do not label this package or the app final until the G1–G8 gates in the handoff document pass.
