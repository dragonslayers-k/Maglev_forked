import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { maglevEngine, type YouTubeFormat, type YouTubeInfo } from 'maglev-engine';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors, spacing, type } from '../constants/theme';
import { formatBytes } from '../constants/format';
import { haptic } from '../constants/haptics';
import { Button, EmptyBlock, Screen } from '../components/ui';

function durationText(value: number): string {
  const seconds = Math.max(0, Math.floor(value || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatText(f: YouTubeFormat): string {
  const quality = f.kind === 'video' ? (f.height > 0 ? `${f.height}p` : '동영상') : (f.abr > 0 ? `${f.abr} kbps` : '오디오');
  const size = f.size && f.size > 0 ? formatBytes(f.size) : '용량 미상';
  return `${quality} · ${f.ext.toUpperCase()} · ${size}`;
}

export default function YouTubeDownloadScreen() {
  const router = useRouter();
  const { url } = useLocalSearchParams<{ url?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [info, setInfo] = useState<YouTubeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!url) {
      setLoading(false);
      setError('YouTube 링크가 없습니다.');
      return () => { active = false; };
    }
    setLoading(true);
    setError(null);
    maglevEngine.getYouTubeInfo(url)
      .then((result) => {
        if (!active) return;
        if (result.ok) setInfo(result as YouTubeInfo);
        else setError(result.message || 'YouTube 영상 정보를 가져오지 못했습니다.');
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'YouTube 영상 정보를 가져오지 못했습니다.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [url]);

  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const start = useCallback(async (format: YouTubeFormat) => {
    if (!url || busy) return;
    haptic('tap');
    setBusy(format.formatId);
    setError(null);
    try {
      const result = await maglevEngine.addYouTubeDownload(url, format.formatId);
      if (result.ok && result.id) {
        haptic('done');
        router.replace({ pathname: '/download/[id]', params: { id: result.id } });
      } else {
        setError(result.message || '다운로드를 시작하지 못했습니다.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '다운로드를 시작하지 못했습니다.');
    } finally {
      setBusy(null);
    }
  }, [url, busy, router]);

  const videos = info?.formats.filter((f) => f.kind === 'video') ?? [];
  const audios = info?.formats.filter((f) => f.kind === 'audio') ?? [];

  return (
    <Screen title="YouTube 다운로드" onBack={back} scroll contentStyle={styles.content}>
      {loading ? <Text style={styles.muted}>영상 정보를 확인하고 있습니다…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? (
        <>
          <Text style={styles.title}>{info.title}</Text>
          <Text style={styles.muted}>{[info.uploader, durationText(info.duration)].filter(Boolean).join(' · ')}</Text>
          <View style={styles.section}>
            <Text style={styles.heading}>동영상 다운로드</Text>
            {videos.length ? videos.map((f) => (
              <Button key={f.formatId} fullWidth size="md" disabled={!!busy} loading={busy === f.formatId}
                label={formatText(f)} onPress={() => void start(f)} />
            )) : <Text style={styles.muted}>이 영상에는 현재 지원되는 합본 동영상 형식이 없습니다.</Text>}
          </View>
          <View style={styles.section}>
            <Text style={styles.heading}>오디오 다운로드</Text>
            {audios.length ? audios.map((f) => (
              <Button key={f.formatId} fullWidth size="md" variant="secondary" disabled={!!busy} loading={busy === f.formatId}
                label={formatText(f)} onPress={() => void start(f)} />
            )) : <Text style={styles.muted}>다운로드 가능한 오디오 형식이 없습니다.</Text>}
          </View>
          <Text style={styles.note}>현재는 영상과 음성이 합쳐진 형식 및 오디오 전용 형식을 지원합니다. 별도 트랙 병합은 후속 개선 대상입니다.</Text>
        </>
      ) : null}
      {!loading && !info && !error ? (
        <EmptyBlock icon="video" title="영상을 찾지 못했습니다" body="공개 YouTube 동영상 링크인지 확인해 주세요." primary={{ label: '돌아가기', onPress: back }} />
      ) : null}
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.md },
    title: { color: c.text, fontSize: type.title, fontWeight: '700' },
    heading: { color: c.text, fontSize: type.body, fontWeight: '700', marginBottom: spacing.sm },
    muted: { color: c.muted, fontSize: type.body },
    error: { color: c.danger, fontSize: type.body },
    note: { color: c.muted, fontSize: type.caption, lineHeight: 18 },
    section: { gap: spacing.sm },
  });
}
