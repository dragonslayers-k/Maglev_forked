import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { maglevEngine, type YouTubeFormat, type YouTubeInfo } from 'maglev-engine';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors, spacing, type } from '../constants/theme';
import { formatBytes } from '../constants/format';
import { haptic } from '../constants/haptics';
import { Button, Chip, ListRow, Screen, SectionHeader, Sheet } from '../components/ui';
import { Card } from '../components/settings/SettingsParts';
import { parseYouTubeLink } from '../utils/browser/youtube';

const formatKey = (format: YouTubeFormat) => format.playerClient + ':' + format.formatId;
const codecName = (format: YouTubeFormat) => (format.format || '').split(/[·,|]/).map((s) => s.trim()).filter(Boolean).slice(-1)[0] || '';
const formatTitle = (format: YouTubeFormat, recommended = false) => {
  const quality = format.kind === 'audio'
    ? (format.formatId === 'bestaudio' ? '오디오만 · 최고 음질' : (format.abr > 0 ? '오디오 · ' + Math.round(format.abr) + ' kbps' : '오디오'))
    : (format.height > 0 ? format.height + 'p' + (format.height >= 2160 ? ' · 4K' : format.height >= 1440 ? ' · QHD' : format.height >= 1080 ? ' · FHD' : format.height >= 720 ? ' · HD' : '') : '동영상');
  return recommended ? '추천 · ' + quality : quality;
};
const formatSubtitle = (format: YouTubeFormat) => {
  const codec = codecName(format);
  const rate = format.kind === 'audio'
    ? (format.abr > 0 ? Math.round(format.abr) + ' kbps' : '')
    : (format.tbr > 0 ? (format.tbr >= 1000 ? (format.tbr / 1000).toFixed(1) + ' Mbps' : Math.round(format.tbr) + ' kbps') : '');
  const audio = format.kind === 'video' ? (format.hasAudio === true ? '오디오 포함' : format.hasAudio === false ? '영상 전용 · 오디오 병합 필요' : '') : '';
  return [format.ext.toUpperCase(), codec, format.kind === 'video' && format.fps > 0 ? Math.round(format.fps) + ' fps' : '', rate, audio].filter(Boolean).join(' · ') || '세부 형식 정보 없음';
};
const formatSize = (format: YouTubeFormat) => {
  const raw = format.size && format.size > 0 ? formatBytes(format.size) : '용량 확인 필요';
  return format.sizeEstimated ? '예상 ' + raw : raw;
};

const VIDEO_OUTPUT_CONTAINERS = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'flv', 'gif'] as const;
const AUDIO_OUTPUT_CONTAINERS = ['mp3', 'm4a', 'aac', 'alac', 'flac', 'opus', 'wav', 'vorbis'] as const;

export default function YouTubeDownloadScreen() {
  const router = useRouter();
  const { url } = useLocalSearchParams<{ url?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [info, setInfo] = useState<YouTubeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingMoreFormats, setLoadingMoreFormats] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [selectedVideoExt, setSelectedVideoExt] = useState('all');
  const [selectedAudioExt, setSelectedAudioExt] = useState('all');
  const [videoContainer, setVideoContainer] = useState('original');
  const [audioContainer, setAudioContainer] = useState('original');
  const [videoContainerSheet, setVideoContainerSheet] = useState(false);
  const [audioContainerSheet, setAudioContainerSheet] = useState(false);
  const [videoFormatsExpanded, setVideoFormatsExpanded] = useState(false);
  const [audioFormatsExpanded, setAudioFormatsExpanded] = useState(false);
  const isYouTube = Boolean(parseYouTubeLink(String(url || '')));
  const screenTitle = parseYouTubeLink(String(url || '')) ? 'YouTube 다운로드' : '웹사이트 동영상 다운로드';

  useEffect(() => {
    let alive = true;
    const rawUrl = String(url || '');
    setInfo(null);
    setError(null);
    setLoading(true);
    if (!rawUrl) {
      setError('웹페이지 주소가 없습니다.');
      setLoading(false);
      return () => { alive = false; };
    }
    void maglevEngine.getYouTubeInfo(rawUrl)
      .then((result) => {
        if (!alive) return;
        if (result.ok) {
          setInfo(result);
          const initialVideo = result.formats.filter((format) => format.kind === 'video').sort((a, b) => b.height - a.height || b.tbr - a.tbr)[0];
          const initialAudio = result.formats.filter((format) => format.kind === 'audio').sort((a, b) => b.abr - a.abr)[0];
          setSelectedVideo(initialVideo ? formatKey(initialVideo) : null);
          setSelectedAudio(initialAudio ? formatKey(initialAudio) : null);
        } else setError(result.message || '동영상 정보를 가져오지 못했습니다.');
      })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause.message : '동영상 정보를 조회하지 못했습니다.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [url]);

  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const loadMoreFormats = useCallback(async () => {
    const rawUrl = String(url || '');
    if (!rawUrl || loadingMoreFormats || busy) return;
    setLoadingMoreFormats(true);
    setError(null);
    try {
      const [base, fragment] = rawUrl.split('#', 2);
      const queryUrl = base + (base.includes('?') ? '&' : '?') + 'maglev_ytdlp=1' + (fragment ? '#' + fragment : '');
      const result = await maglevEngine.getYouTubeInfo(queryUrl);
      if (!result.ok) {
        setError(result.message || '추가 형식을 가져오지 못했습니다.');
        return;
      }
      setInfo((current) => {
        if (!current) return result;
        const merged = Array.from(new Map([...current.formats, ...result.formats].map((format) => [formatKey(format), format])).values());
        return { ...current, formats: merged };
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '추가 형식을 조회하지 못했습니다.');
    } finally {
      setLoadingMoreFormats(false);
    }
  }, [url, loadingMoreFormats, busy]);

  const start = useCallback(async (format: YouTubeFormat, audioBitrateKbps?: number, outputContainer = 'original') => {
    if (!url || busy) return;
    setBusy(true);
    setError(null);
    haptic('tap');
    try {
      const result = await maglevEngine.addYouTubeDownload(String(url), format.formatId, format.playerClient, format.kind, audioBitrateKbps ?? null, outputContainer);
      if (!result.ok) {
        setError(result.message || '다운로드를 전송 목록에 추가하지 못했습니다.');
        return;
      }
      haptic('done');
      // YouTube transfers use the same native queue as links and streams.
      // Returning to Transfers lets the existing controls manage pause/retry/remove.
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '다운로드를 시작하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [url, busy, router]);

  const formats = info?.formats ?? [];
  // Keep provider identity in the key: yt-dlp and NewPipe can reuse IDs for different
  // streams. Collapsing by formatId alone can silently discard the selected provider.
  const uniqueFormats = Array.from(new Map(formats.map((format) => [formatKey(format), format])).values());
  const bestByDisplay = (items: YouTubeFormat[], keyOf: (f: YouTubeFormat) => string, score: (f: YouTubeFormat) => number) => {
    const map = new Map<string, YouTubeFormat>();
    for (const item of items) {
      const key = keyOf(item);
      const prior = map.get(key);
      if (!prior || score(item) > score(prior)) map.set(key, item);
    }
    return [...map.values()];
  };
  const videos = bestByDisplay(
    uniqueFormats.filter((format) => format.kind === 'video'),
    (f) => f.height + '|' + f.ext + '|' + codecName(f).toLowerCase() + '|' + String(f.hasAudio),
    (f) => f.tbr,
  ).sort((a, b) => b.height - a.height || b.tbr - a.tbr);
  const audios = bestByDisplay(
    uniqueFormats.filter((format) => format.kind === 'audio'),
    (f) => f.ext + '|' + codecName(f).toLowerCase() + '|' + Math.round(f.abr) + '|' + (f.format || '').split('·')[0].trim(),
    (f) => f.abr,
  ).sort((a, b) => b.abr - a.abr);
  const videoExtensions = Array.from(new Set(videos.map((format) => format.ext.toLowerCase()).filter(Boolean))).sort();
  const audioExtensions = Array.from(new Set(audios.map((format) => format.ext.toLowerCase()).filter(Boolean))).sort();
  const visibleVideos = selectedVideoExt === 'all' ? videos : videos.filter((format) => format.ext.toLowerCase() === selectedVideoExt);
  const visibleAudios = selectedAudioExt === 'all' ? audios : audios.filter((format) => format.ext.toLowerCase() === selectedAudioExt);
  // Always offer yt-dlp's bestaudio selector even when the selected player client
  // does not expose audio-only formats in its metadata response.
  const audioFallbacks: YouTubeFormat[] = [
    { formatId: 'bestaudio', playerClient: 'android_vr', kind: 'audio', ext: '원본', height: 0, width: 0, fps: 0, tbr: 0, abr: 0, size: null, format: '오디오만 · 최고 음질' },
    ...[320, 256, 192, 128].map((kbps) => ({
      formatId: `bestaudio_${kbps}`, playerClient: 'android_vr', kind: 'audio' as const,
      ext: '원본', height: 0, width: 0, fps: 0, tbr: 0, abr: 0, size: null, format: `최대 ${kbps} kbps`,
    })),
  ];
  const selectedVideoFormat = visibleVideos.find((format) => formatKey(format) === selectedVideo) ?? null;
  const audioChoices = visibleAudios.length > 0 ? visibleAudios : selectedAudioExt === 'all' ? audioFallbacks : [];
  const selectedAudioFormat = audioChoices.find((format) => formatKey(format) === selectedAudio) ?? null;
  // Preset rows (bestaudio_320, etc.) carry the bitrate ceiling in their ID,
  // not in `abr`. Resolve it here so video downloads actually receive the
  // selected audio-quality ceiling through the native bridge.
  const selectedAudioBitrateKbps = selectedAudioFormat?.abr && selectedAudioFormat.abr > 0
    ? selectedAudioFormat.abr
    : Number(/^bestaudio_(\d+)$/.exec(selectedAudioFormat?.formatId ?? '')?.[1]) || undefined;

  return (
    <Screen title={screenTitle} onBack={back} scroll contentStyle={styles.content}>
      {loading ? <Text style={styles.muted}>YouTube 형식과 오디오 음질을 확인하고 있습니다…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? (
        <>
          <Text style={styles.title}>{info.title}</Text>
          <Text style={styles.muted}>
            {[info.uploader, info.duration > 0 ? `${Math.floor(info.duration / 60)}:${String(Math.floor(info.duration % 60)).padStart(2, '0')}` : null]
              .filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.section}>
            <SectionHeader title="동영상 형식 · 화질" />
            <Text style={styles.muted}>원본 확장자로 화질 목록을 필터링하고, 아래 출력 컨테이너에서 실제 저장 형식을 선택합니다. 원본 유지가 기본값입니다.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="전체" count={videos.length} selected={selectedVideoExt === 'all'} disabled={busy} onPress={() => { setSelectedVideoExt('all'); setVideoFormatsExpanded(false); }} />
              {videoExtensions.map((ext) => (
                <Chip key={'video-ext-' + ext} label={ext.toUpperCase()} count={videos.filter((format) => format.ext.toLowerCase() === ext).length} selected={selectedVideoExt === ext} disabled={busy}
                  onPress={() => { setSelectedVideoExt(ext); setVideoFormatsExpanded(false); const first = videos.filter((format) => format.ext.toLowerCase() === ext).sort((a, b) => b.height - a.height || b.tbr - a.tbr)[0]; if (first) setSelectedVideo(formatKey(first)); }} />
              ))}
            </ScrollView>
            <Card>
              <ListRow icon="download" title="출력 컨테이너" subtitle={videoContainer === "original" ? "원본 컨테이너 유지" : videoContainer.toUpperCase()} value="변경" disabled={busy} onPress={() => setVideoContainerSheet(true)} />
            </Card>
            <Card>
              {selectedVideoFormat ? (
                <ListRow icon="check" title={formatTitle(selectedVideoFormat)} subtitle={[formatSubtitle(selectedVideoFormat), formatSize(selectedVideoFormat)].join(' · ')} value="선택됨" disabled={busy} onPress={() => setVideoFormatsExpanded((open) => !open)} />
              ) : <Text style={styles.muted}>선택 가능한 화질이 없습니다.</Text>}
              {visibleVideos.length > 1 ? (
                <ListRow icon="list" title={videoFormatsExpanded ? "화질 목록 접기" : `다른 화질 보기 · ${visibleVideos.length}개`} value={videoFormatsExpanded ? "접기" : "보기"} disabled={busy} onPress={() => setVideoFormatsExpanded((open) => !open)} />
              ) : null}
              {videoFormatsExpanded ? visibleVideos.map((format) => (
                <ListRow key={formatKey(format)} icon={selectedVideo === formatKey(format) ? "check" : "download"} title={formatTitle(format)}
                  subtitle={[formatSubtitle(format), formatSize(format)].join(' · ')} value={selectedVideo === formatKey(format) ? "선택됨" : undefined} disabled={busy}
                  onPress={() => { setSelectedVideo(formatKey(format)); setVideoFormatsExpanded(false); }} />
              )) : null}
              {videos.length === 0 ? <Text style={styles.muted}>다운로드 가능한 동영상 형식이 없습니다.</Text> : null}
            </Card>
            <Button fullWidth size="lg" disabled={busy || !visibleVideos.some((format) => formatKey(format) === selectedVideo)} loading={busy}
              label={busy ? "다운로드 추가 중…" : "선택한 동영상 다운로드"}
              onPress={() => { const chosen = visibleVideos.find((format) => formatKey(format) === selectedVideo); if (chosen) void start(chosen, selectedAudioBitrateKbps, videoContainer); }} />
            {isYouTube ? (
              <Button fullWidth size="md" variant="secondary" disabled={busy || loadingMoreFormats}
                loading={loadingMoreFormats} label={loadingMoreFormats ? '추가 형식 조회 중…' : '추가 화질·오디오 형식 조회'}
                onPress={() => void loadMoreFormats()} />
            ) : null}
          </View>
          <View style={styles.section}>
            <SectionHeader title="오디오 형식 · 음질" />
            <Text style={styles.muted}>목록에서 원본 코덱·음질을 선택합니다. 영상 다운로드 시 선택한 오디오 음질은 분리 오디오 트랙에 적용됩니다. 오디오 전용 다운로드는 선택한 형식과 음질을 그대로 사용합니다.</Text>
            <Text style={styles.muted}>원본 확장자로 오디오 형식을 필터링하고, 아래에서 실제 출력 컨테이너를 선택합니다.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="전체" count={audios.length} selected={selectedAudioExt === 'all'} disabled={busy} onPress={() => { setSelectedAudioExt('all'); setAudioFormatsExpanded(false); }} />
              {audioExtensions.map((ext) => (
                <Chip key={'audio-ext-' + ext} label={ext.toUpperCase()} count={audios.filter((format) => format.ext.toLowerCase() === ext).length} selected={selectedAudioExt === ext} disabled={busy}
                  onPress={() => { setSelectedAudioExt(ext); setAudioFormatsExpanded(false); const first = audios.filter((format) => format.ext.toLowerCase() === ext).sort((a, b) => b.abr - a.abr)[0]; if (first) setSelectedAudio(formatKey(first)); }} />
              ))}
            </ScrollView>
            <Card>
              <ListRow icon="download" title="출력 컨테이너" subtitle={audioContainer === "original" ? "원본 컨테이너 유지" : audioContainer === "alac" ? "ALAC · M4A" : audioContainer === "vorbis" ? "VORBIS · OGG" : audioContainer.toUpperCase()} value="변경" disabled={busy} onPress={() => setAudioContainerSheet(true)} />
            </Card>
            <Card>
              {selectedAudioFormat ? (
                <ListRow icon="check" title={formatTitle(selectedAudioFormat, audioChoices.indexOf(selectedAudioFormat) === 0)} subtitle={[formatSubtitle(selectedAudioFormat), formatSize(selectedAudioFormat)].join(' · ')} value="선택됨" disabled={busy} onPress={() => setAudioFormatsExpanded((open) => !open)} />
              ) : <Text style={styles.muted}>선택 가능한 오디오 형식이 없습니다.</Text>}
              {audioChoices.length > 1 ? (
                <ListRow icon="list" title={audioFormatsExpanded ? "오디오 목록 접기" : `다른 음질 보기 · ${audioChoices.length}개`} value={audioFormatsExpanded ? "접기" : "보기"} disabled={busy} onPress={() => setAudioFormatsExpanded((open) => !open)} />
              ) : null}
              {audioFormatsExpanded ? audioChoices.map((format, index) => (
                <ListRow key={formatKey(format)} icon={selectedAudio === formatKey(format) ? "check" : "download"} title={formatTitle(format, index === 0)}
                  subtitle={[formatSubtitle(format), formatSize(format)].join(' · ')} value={selectedAudio === formatKey(format) ? "선택됨" : undefined} disabled={busy}
                  onPress={() => { setSelectedAudio(formatKey(format)); setAudioFormatsExpanded(false); }} />
              )) : null}
            </Card>
            <Button fullWidth size="lg" disabled={busy || !((visibleAudios.length > 0 ? visibleAudios : selectedAudioExt === 'all' ? audioFallbacks : []).some((format) => formatKey(format) === selectedAudio))} loading={busy}
              label={busy ? "다운로드 추가 중…" : "선택한 오디오 다운로드"}
              onPress={() => { const chosen = audioChoices.find((format) => formatKey(format) === selectedAudio); if (chosen) void start(chosen, selectedAudioBitrateKbps, audioContainer); }} />
          </View>
        </>
      ) : null}
      {busy ? <Text style={styles.muted}>선택한 형식을 전송 목록에 추가하고 있습니다…</Text> : null}
      <Text style={styles.note}>
        로그인·세션·지역 제한·추출기 변경·PO Token/JavaScript 런타임 요구에 따라 일부 페이지나 형식은 분석되지 않을 수 있습니다.
        분리된 영상·오디오 트랙은 병합 호환성이 확인된 형식만 표시합니다. 추가된 작업은 기존 전송 목록에서 관리합니다.
      </Text>
      <Sheet visible={videoContainerSheet} onClose={() => setVideoContainerSheet(false)} title="동영상 출력 컨테이너" subtitle="선택한 형식으로 변환 저장합니다. 원본 유지는 변환하지 않습니다.">
        <ListRow icon={videoContainer === "original" ? "check" : "download"} title="원본 컨테이너 유지" subtitle="원본 형식을 그대로 저장" value={videoContainer === "original" ? "선택됨" : undefined} onPress={() => { setVideoContainer("original"); setVideoContainerSheet(false); }} />
        {VIDEO_OUTPUT_CONTAINERS.map((ext) => (
          <ListRow key={"video-output-" + ext} icon={videoContainer === ext ? "check" : "download"} title={ext.toUpperCase()} subtitle={ext === "gif" ? "GIF 애니메이션 변환" : "컨테이너 변환 · 필요 시 재인코딩"} value={videoContainer === ext ? "선택됨" : undefined} onPress={() => { setVideoContainer(ext); setVideoContainerSheet(false); }} />
        ))}
      </Sheet>
      <Sheet visible={audioContainerSheet} onClose={() => setAudioContainerSheet(false)} title="오디오 출력 컨테이너" subtitle="선택한 코덱과 컨테이너로 변환 저장합니다.">
        <ListRow icon={audioContainer === "original" ? "check" : "download"} title="원본 컨테이너 유지" subtitle="원본 오디오 형식을 그대로 저장" value={audioContainer === "original" ? "선택됨" : undefined} onPress={() => { setAudioContainer("original"); setAudioContainerSheet(false); }} />
        {AUDIO_OUTPUT_CONTAINERS.map((ext) => (
          <ListRow key={"audio-output-" + ext} icon={audioContainer === ext ? "check" : "download"} title={ext === "alac" ? "ALAC · M4A" : ext === "vorbis" ? "VORBIS · OGG" : ext.toUpperCase()} subtitle="선택한 오디오 코덱·컨테이너로 변환" value={audioContainer === ext ? "선택됨" : undefined} onPress={() => { setAudioContainer(ext); setAudioContainerSheet(false); }} />
        ))}
      </Sheet>
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.md },
    title: { ...type.heading, color: c.text, fontSize: type.size.xl },
    heading: { ...type.bodyStrong, color: c.text, fontSize: type.size.base, marginBottom: spacing.sm },
    muted: { ...type.body, color: c.textMuted, fontSize: type.size.base },
    error: { ...type.body, color: c.danger, fontSize: type.size.base },
    note: { ...type.body, color: c.textMuted, fontSize: type.size.sm, lineHeight: 18 },
    section: { gap: spacing.sm },
    chips: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  });
}
