import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { maglevEngine, type YouTubeFormat, type YouTubeInfo } from 'maglev-engine';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors, spacing, type } from '../constants/theme';
import { formatBytes } from '../constants/format';
import { haptic } from '../constants/haptics';
import { Button, Screen } from '../components/ui';
import { parseYouTubeLink } from '../utils/browser/youtube';

const formatKey = (format: YouTubeFormat) => format.playerClient + ':' + format.formatId;
const formatLabel = (format: YouTubeFormat) => {
  const quality = format.formatId === 'bestaudio'
    ? '오디오만 · 최고 음질'
    : format.kind === 'audio'
      ? (format.abr > 0 ? `${Math.round(format.abr)} kbps` : '오디오')
    : (format.height > 0 ? `${format.height}p` : '동영상');
  const size = format.size && format.size > 0 ? formatBytes(format.size) : '용량 미상';
  const codec = format.format ? ` · ${format.format}` : '';
  return `${quality} · ${format.ext.toUpperCase()}${codec} · ${size}`;
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
  const uniqueFormats = Array.from(new Map(formats.map((format) => [format.formatId, format])).values());
  const videos = uniqueFormats.filter((format) => format.kind === 'video')
    .sort((a, b) => b.height - a.height || b.tbr - a.tbr);
  const audios = uniqueFormats.filter((format) => format.kind === 'audio')
    .sort((a, b) => b.abr - a.abr);
  // Always offer yt-dlp's bestaudio selector even when the selected player client
  // does not expose audio-only formats in its metadata response.
  const audioFallback: YouTubeFormat = {
    formatId: 'bestaudio', playerClient: formats[0]?.playerClient ?? 'android_vr', kind: 'audio',
    ext: 'm4a', height: 0, width: 0, fps: 0, tbr: 0, abr: 0, size: null, format: '원본 오디오',
  };

  return (
    <Screen title={screenTitle} onBack={back} scroll contentStyle={styles.content}>
      {loading ? <Text style={styles.muted}>yt-dlp로 영상과 오디오 형식을 분석하고 있습니다…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? (
        <>
          <Text style={styles.title}>{info.title}</Text>
          <Text style={styles.muted}>
            {[info.uploader, info.duration > 0 ? `${Math.floor(info.duration / 60)}:${String(Math.floor(info.duration % 60)).padStart(2, '0')}` : null]
              .filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.section}>
            <Text style={styles.heading}>동영상</Text>
            {videos.map((format) => (
              <Button key={formatKey(format)} fullWidth size="md" disabled={busy}
                label={formatLabel(format)} onPress={() => void start(format)} />
            ))}
            {videos.length === 0 ? <Text style={styles.muted}>다운로드 가능한 동영상 형식이 없습니다.</Text> : null}
          </View>
          <View style={styles.section}>
            <Text style={styles.heading}>오디오</Text>
            {[...audios, audioFallback].map((format) => (
              <Button key={formatKey(format)} fullWidth size="md" variant="secondary" disabled={busy}
                label={formatLabel(format)} onPress={() => void start(format)} />
            ))}
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
