const fs = require('node:fs');
const source = fs.readFileSync('app/youtube-download.tsx', 'utf8');
const converter = fs.readFileSync('modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/MediaContainerConverter.kt', 'utf8');
const nativeAdapter = fs.readFileSync('modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/YoutubeDownload.kt', 'utf8');
const newPipeAdapter = fs.readFileSync('modules/maglev-engine/android/src/main/java/com/maglev/engine/youtube/NewPipeYoutube.kt', 'utf8');
const engineHost = fs.readFileSync('modules/maglev-engine/android/src/main/java/com/maglev/engine/EngineHost.kt', 'utf8');
const checks = [
  ['video source extension filter remains', source.includes('selectedVideoExt') && source.includes('visibleVideos')],
  ['audio source extension filter remains', source.includes('selectedAudioExt') && source.includes('visibleAudios')],
  ['all seven requested video output containers are selectable', source.includes("VIDEO_OUTPUT_CONTAINERS = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'flv', 'gif']")],
  ['all eight requested audio output containers are selectable', source.includes("AUDIO_OUTPUT_CONTAINERS = ['mp3', 'm4a', 'aac', 'alac', 'flac', 'opus', 'wav', 'vorbis']")],
  ['format kind and output container are passed to native download', source.includes('format.formatId, format.playerClient, format.kind, audioBitrateKbps ?? null, outputContainer')],
  ['native adapter stores postprocess metadata for real output conversion', nativeAdapter.includes('options["postprocess"] = linkedMapOf')],
  ['FFmpegKit is executed for output conversion', converter.includes('FFmpegKit.execute(command)')],
  ['audio and video conversion codecs are present', converter.includes('libmp3lame') && converter.includes('libx264') && converter.includes('libopus')],
  ['container conversion writes to a temporary file before replacing output', converter.includes('maglev-convert.tmp') && converter.includes('temp.renameTo(output)')],
  ['selected audio bitrate reaches FFmpeg postprocessing from both extractors', nativeAdapter.includes('audioBitrateKbps') && newPipeAdapter.includes('audioBitrateKbps') && engineHost.includes('spec["audioBitrateKbps"]') && converter.includes('audioRate')],
];
let failed = false;
for (const [name, ok] of checks) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name);
  failed ||= !ok;
}
if (failed) process.exit(1);