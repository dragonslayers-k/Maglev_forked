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
  ['NewPipe refreshes signed stream URLs when the user adds a download, not from the 3-minute metadata cache', newPipeAdapter.includes('private fun getFresh(context: Context, url: String): StreamInfo') && newPipeAdapter.includes('val info = StreamInfo.getInfo(url)') && newPipeAdapter.includes('val info = getFresh(context, url)')],
  ['YouTube source extension filters open compact selection sheets', source.includes('setVideoExtensionSheet(true)') && source.includes('setAudioExtensionSheet(true)') && source.includes('videoExtensions.map((ext) => (') && source.includes('audioExtensions.map((ext) => (')],
  ['video and audio quality lists open dedicated selection sheets', source.includes('setVideoFormatsSheet(true)') && source.includes('setAudioFormatsSheet(true)') && source.includes('visibleVideos.map((format) => (') && source.includes('audioChoices.map((format, index) => (') && !source.includes('videoFormatsExpanded') && !source.includes('audioFormatsExpanded')],
  ['output container selection opens dedicated sheets, not inline expanding lists', source.includes('<Sheet visible={videoContainerSheet}') && source.includes('<Sheet visible={audioContainerSheet}') && !source.includes('videoContainerExpanded') && !source.includes('audioContainerExpanded')],
  ['selected format reconciles after provider dedupe so actions stay enabled', source.includes('if (selectedVideo && visibleVideos.some((format) => formatKey(format) === selectedVideo)) return;') && source.includes('if (selectedAudio && audioChoices.some((format) => formatKey(format) === selectedAudio)) return;') && source.includes('setSelectedVideo(first ? formatKey(first) : null);') && source.includes('setSelectedAudio(first ? formatKey(first) : null);')],
];
let failed = false;
for (const [name, ok] of checks) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name);
  failed ||= !ok;
}
if (failed) process.exit(1);