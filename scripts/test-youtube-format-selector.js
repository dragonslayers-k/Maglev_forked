const fs = require('node:fs');
const source = fs.readFileSync('app/youtube-download.tsx', 'utf8');
const converter = fs.readFileSync('modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/MediaContainerConverter.kt', 'utf8');
const nativeAdapter = fs.readFileSync('modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/YoutubeDownload.kt', 'utf8');
const checks = [
  ['video extension selector state', /selectedVideoExt/],
  ['audio extension selector state', /selectedAudioExt/],
  ['video formats filtered by selected extension', /visibleVideos\s*=\s*selectedVideoExt\s*===\s*'all'\s*\?\s*videos\s*:/],
  ['audio formats filtered by selected extension', /visibleAudios\s*=\s*selectedAudioExt\s*===\s*'all'\s*\?\s*audios\s*:/],
  ['video download uses visible selected format', /const chosen = visibleVideos\.find\(\(format\) => formatKey\(format\) === selectedVideo\)/],
  ['audio download uses visible selected format', /const chosen = \(visibleAudios\.length > 0 \? visibleAudios : selectedAudioExt === 'all' \? audioFallbacks : \[\]\)\.find/],
  ['source-container choice clearly distinguished from conversion', /원본 컨테이너만 표시합니다\. 다른 컨테이너로 재인코딩하는 기능은 별도입니다/],
];
let failed = false;
for (const [name, pattern] of checks) {
  const ok = pattern.test(source);
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name);
  failed ||= !ok;
}
if (failed) process.exit(1);
