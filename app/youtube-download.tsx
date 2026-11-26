import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { maglevEngine, type YouTubeFormat, type YouTubeInfo } from 'maglev-engine';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors, spacing, type } from '../constants/theme';
import { formatBytes } from '../constants/format';
import { haptic } from '../constants/haptics';
import { Button, ListRow, Screen, SectionHeader } from '../components/ui';
import { Card } from '../components/settings/SettingsParts;
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
        if (result.ok) setInfo(result);
        else setError(result.message || '동영상 정보를 가져오지 못했습니다.');
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

  const start = useCallback(async (format: YouTubeFormat) => {
    if (!url || busy) return;
    setBusy(true);
    setError(null);
    haptic('tap');
    try {
      const result = await maglevEngine.addYouTubeDownload(String(url), format.formatId, format.playerClient);
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
  // Always offer yt-dlp's bestaudio selector even when the selected player client
  // does not expose audio-only formats in its metadata response.
  const audioFallbacks: YouTubeFormat[] = [
    { formatId: 'bestaudio', playerClient: 'android_vr', kind: 'audio', ext: '원본', height: 0, width: 0, fps: 0, tbr: 0, abr: 0, size: null, format: '오디오만 · 최고 음질' },
    ...[320, 256, 192, 128].map((kbps) => ({
      formatId: `bestaudio_${kbps}`, playerClient: 'android_vr', kind: 'audio' as const,
      ext: '원본', height: 0, width: 0, fps: 0, tbr: 0, abr: 0, size: null, format: `최대 ${kbps} kbps`,
    })),
  ];

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
            <Card>
              {videos.map((format) => (
                <ListRow key={formatKey(format)} icon="download" title={formatTitle(format)}
                  subtitle={formatSubtitle(format)} value={formatSize(format)} disabled={busy}
                  onPress={() => void start(format)} />
              ))}
              {videos.length === 0 ? <Text style={styles.muted}>다운로드 가능한 동영상 형식이 없습니다.</Text> : null}
            </Card>
            {isYouTube ? (
              <Button fullWidth size="md" variant="secondary" disabled={busy || loadingMoreFormats}
                loading={loadingMoreFormats} label={loadingMoreFormats ? '추가 형식 조회 중…' : '추가 화질·오디오 형식 조회'}
                onPress={() => void loadMoreFormats()} />
            ) : null}
          </View>
          <View style={styles.section}>
            <SectionHeader title="오디오 형식 · 음질" />
            <Card>
              {(audios.length > 0 ? audios : audioFallbacks).map((format, index) => (
                <ListRow key={formatKey(format)} icon="download" title={formatTitle(format, index === 0)}
                  subtitle={formatSubtitle(format)} value={formatSize(format)} disabled={busy}
                  onPress={() => void start(format)} />
              ))}
            </Card>
          </View>
        </>
      ) : null}
      {busy ? <Text style={styles.muted}>선택한 형식을 전송 목록에 추가하고 있습니다…</Text> : null}
      <Text style={styles.note}>
        로그인·세션·지역 제한·추출기 변경·PO Token/JavaScript 런타임 요구에 따라 일부 페이지나 형식은 분석되지 않을 수 있습니다.
        분리된 영상·오디오 트랙은 병합 호환성이 확인된 형식만 표시합니다. 추가된 작업은 기존 전송 목록에서 관리합니다.
      </Text>
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
  });
}
