import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ytdlpEngine, type YtdlpInfo, type YtdlpFormat, type YtdlpProgress, type YtdlpCompletion, type YtdlpFailure } from 'ytdlp-engine';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors, spacing, type } from '../constants/theme';
import { formatBytes } from '../constants/format';
import { haptic } from '../constants/haptics';
import { Button, Screen } from '../components/ui';

const key = (f: YtdlpFormat) => f.formatId || 'unknown';
const quality = (f: YtdlpFormat) => f.hasVideo ? (f.height ? `${f.height}p` : '동영상') : '오디오';
const sizeText = (f: YtdlpFormat) => f.size ? formatBytes(f.size) : '용량 미상';
const label = (f: YtdlpFormat) => `${quality(f)} · ${(f.ext || '파일').toUpperCase()} · ${sizeText(f)}`;
const selector = (f: YtdlpFormat) => f.hasVideo && !f.hasAudio ? `${f.formatId}+bestaudio/best` : f.formatId || 'best';

export default function YouTubeDownloadScreen() {
  const router = useRouter();
  const { url } = useLocalSearchParams<{ url?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [info, setInfo] = useState<YtdlpInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<YtdlpProgress | null>(null);
  const [completed, setCompleted] = useState<YtdlpCompletion | null>(null);

  useEffect(() => {
    if (!ytdlpEngine.available) { setError('yt-dlp 모듈이 설치된 빌드가 아닙니다.'); setLoading(false); return; }
    let alive = true;
    const load = async () => {
      try {
        await ytdlpEngine.init();
        const result = await ytdlpEngine.getInfo(String(url || ''));
        if (!alive) return;
        if (result.ok) setInfo(result);
        else setError(result.message || '영상 정보를 가져오지 못했습니다.');
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : '영상 정보를 조회하지 못했습니다.'); }
      finally { if (alive) setLoading(false); }
    };
    if (!url) { setError('YouTube 링크가 없습니다.'); setLoading(false); }
    else void load();
    const p = ytdlpEngine.onProgress(e => { if (alive) setProgress(e); });
    const c = ytdlpEngine.onCompleted(e => { if (alive && e.id === busy) { setCompleted(e); setBusy(null); haptic('done'); } });
    const f = ytdlpEngine.onFailed(e => { if (alive && e.id === busy) { setError(e.message); setBusy(null); } });
    return () => { alive = false; p.remove(); c.remove(); f.remove(); };
  }, [url, busy]);

  const back = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace('/'); }, [router]);
  const start = useCallback(async (f: YtdlpFormat) => {
    if (!url || busy) return;
    const id = `yt_${Date.now()}`;
    setBusy(id); setProgress(null); setCompleted(null); setError(null); haptic('tap');
    try { await ytdlpEngine.download(id, String(url), selector(f)); }
    catch (e) { setBusy(null); setError(e instanceof Error ? e.message : '다운로드 시작 실패'); }
  }, [url, busy]);

  const formats = info?.formats ?? [];
  const videos = formats.filter(f => f.hasVideo).sort((a,b)=>(b.height||0)-(a.height||0));
  const audios = formats.filter(f => f.hasAudio && !f.hasVideo).sort((a,b)=>(b.audioBitrate||b.bitrate||0)-(a.audioBitrate||a.bitrate||0));
  return <Screen title="YouTube 다운로드" onBack={back} scroll contentStyle={styles.content}>
    {loading ? <Text style={styles.muted}>yt-dlp로 영상 정보를 가져오는 중…</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {info ? <>
      <Text style={styles.title}>{info.title}</Text>
      <Text style={styles.muted}>{[info.uploader, info.durationSeconds ? `${Math.floor(info.durationSeconds/60)}:${String(Math.floor(info.durationSeconds%60)).padStart(2,'0')}` : null].filter(Boolean).join(' · ')}</Text>
      <View style={styles.section}><Text style={styles.heading}>동영상</Text>
        {videos.map(f=><Button key={key(f)} fullWidth size="md" disabled={!!busy} label={label(f)} onPress={()=>void start(f)}/>)}
        {!videos.length?<Text style={styles.muted}>동영상 형식 없음</Text>:null}
      </View>
      <View style={styles.section}><Text style={styles.heading}>오디오</Text>
        {audios.slice(0,8).map(f=><Button key={key(f)} fullWidth size="md" variant="secondary" disabled={!!busy} label={label(f)} onPress={()=>void start(f)}/>)}
        {!audios.length?<Text style={styles.muted}>오디오 형식 없음</Text>:null}
      </View>
    </>:null}
    {busy?<View style={styles.section}><Text style={styles.heading}>다운로드 중 · {progress?.percent?.toFixed(1) ?? '0'}%</Text><Text style={styles.muted}>{progress?.speed || ''} {progress?.etaSeconds ? `· 남은 시간 ${progress.etaSeconds}초` : ''}</Text><Button fullWidth variant="secondary" label="취소" onPress={()=>{ytdlpEngine.cancel(busy);setBusy(null);}}/></View>:null}
    {completed?<View style={styles.section}><Text style={styles.success}>다운로드 완료</Text>{completed.files.map(f=><Text key={f.name} style={styles.muted}>{f.name} · {formatBytes(f.bytes)}</Text>)}<Text style={styles.note}>파일은 Download/Maglev+에 저장되었습니다.</Text></View>:null}
    <Text style={styles.note}>YouTube 측 접근 제한(PO Token·로그인·연령 제한 등)에 따라 일부 영상이나 형식은 다운로드되지 않을 수 있습니다.</Text>
  </Screen>;
}
function makeStyles(c: ThemeColors) { return StyleSheet.create({content:{padding:spacing.lg,gap:spacing.md},title:{...type.heading,color:c.text,fontSize:type.size.xl},heading:{...type.bodyStrong,color:c.text,fontSize:type.size.base,marginBottom:spacing.sm},muted:{...type.body,color:c.textMuted,fontSize:type.size.base},error:{...type.body,color:c.danger,fontSize:type.size.base},success:{...type.bodyStrong,color:c.success,fontSize:type.size.base},note:{...type.body,color:c.textMuted,fontSize:type.size.sm,lineHeight:18},section:{gap:spacing.sm}}); }
