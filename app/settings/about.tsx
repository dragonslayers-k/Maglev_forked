import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, type Href } from 'expo-router';
import Constants from 'expo-constants';
import { maglevEngine } from 'maglev-engine';
import { ThemeColors, spacing, touch, type } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { Button, Dialog, ListRow, SectionHeader, Toggle } from '../../components/ui';
import { useMaglevEngine } from '../../context/EngineContext';
import { Card, SettingsPage } from '../../components/settings/SettingsParts';
import { FocusAnchor, rowKey } from '../../components/settings/settingsFocus';
import { Wordmark } from '../../components/settings/Wordmark';
import { MaglevMark } from '../../components/brand/MaglevMark';
import { errorScreenCopy, highlightCopy } from '../../constants/copy';
import { clearCrashLog, copyCrashReport, getCrashLog } from '../../utils/crashLog';
import { REPO_URL, StarTicket } from '../../components/settings/StarTicket';
import { aboutExtrasCopy } from '../../constants/aboutCopy';
import { buildIssueUrl, deviceLabel } from '../../utils/update/check';
import { useUpdatePrefs } from '../../utils/prefs/update';

type Extra = { homepage?: string; privacyUrl?: string };

/** Phone details for the bug form (Android only; other platforms send what they have). */
function phoneDetails() {
  const c = (Platform.constants ?? {}) as { Release?: string; Model?: string; Manufacturer?: string };
  const device = deviceLabel(c.Manufacturer, c.Model);
  return { android: String(c.Release ?? Platform.Version ?? ''), device };
}

export default function AboutSettings() {
  const { colors } = useTheme();
  const router = useRouter();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [crashCount, setCrashCount] = useState(() => getCrashLog().length);
  const [engine, setEngine] = useState<string>('—');
  const [prefs, setPrefs] = useUpdatePrefs();
  const appVersion = Constants.expoConfig?.version ?? '—';
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

  useEffect(() => {
    let alive = true;
    maglevEngine
      .version()
      .then((v) => {
        if (!alive) return;
        setEngine(v.engine === 'unavailable' || !v.version ? 'Unavailable' : `${v.engine} ${v.version}`);
      })
      .catch(() => alive && setEngine('Unavailable'));
    return () => {
      alive = false;
    };
  }, []);

  const links = [
    extra.homepage && { title: 'Website', url: extra.homepage },
    extra.privacyUrl && { title: 'Privacy policy', url: extra.privacyUrl },
  ].filter(Boolean) as { title: string; url: string }[];

  const reportBug = () => {
    const { android, device } = phoneDetails();
    void Linking.openURL(buildIssueUrl({ version: appVersion, android, device }));
  };

  const { showNotice } = useMaglevEngine();
  const [logWarning, setLogWarning] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareLog = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const made = await maglevEngine.exportDebugLog();
      if (!made.ok) throw new Error(made.code);
      const shared = await maglevEngine.shareDebugLog(made.uri);
      if (!shared.ok) throw new Error(shared.code);
    } catch {
      showNotice({ message: aboutExtrasCopy.debugLog.failed });
    } finally {
      setSharing(false);
      setLogWarning(false);
    }
  };

  return (
    <SettingsPage title="Maglev+ 정보">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.brand}>
        <MaglevMark height={64} cruising tappable />
        <View style={s.wordmarkRow}>
          <Wordmark width={184} />
          <Text style={s.wordmarkPlus} accessibilityLabel="Plus">+</Text>
        </View>
      </View>
      <StarTicket />
      <Card>
        <ListRow title="오류 신고" subtitle="앱 버전과 휴대전화 정보가 입력된 GitHub 신고 화면을 엽니다." icon="external" onPress={reportBug} />
        <ListRow
          title={aboutExtrasCopy.debugLog.title}
          subtitle={aboutExtrasCopy.debugLog.subtitle}
          icon="copy"
          onPress={() => setLogWarning(true)}
        />
        <ListRow
          title="Maglev+ 통합 다운로드 앱"
          subtitle="Maglev+ 기반 · 공개 추출기와 다운로드 엔진을 통합한 커뮤니티 빌드"
          icon="github"
          onPress={() => void Linking.openURL(REPO_URL)}
          accessibilityHint="Maglev+ 소스 저장소를 GitHub에서 엽니다"
        />
        <ListRow
          title={aboutExtrasCopy.licence.title}
          value={aboutExtrasCopy.licence.value}
          icon="file"
          onPress={() => router.push('/settings/licenses' as Href)}
          accessibilityHint={aboutExtrasCopy.licence.hint}
        />
        <ListRow
          title={aboutExtrasCopy.releaseNotes}
          value={appVersion}
          icon="clock"
          onPress={() => router.push('/settings/whats-new' as Href)}
        />
        <ListRow
          title={highlightCopy.settingTitle}
          subtitle={highlightCopy.settingSubtitle}
          accessory={<Toggle value={prefs.showHighlights} onValueChange={(showHighlights) => setPrefs({ showHighlights })} accessibilityLabel={highlightCopy.settingTitle} />}
        />
        {links.map((l) => (
          <ListRow key={l.url} title={l.title} onPress={() => void Linking.openURL(l.url)} />
        ))}
      </Card>
      <SectionHeader title="통합 구성 · 참고 원천" />
      <Card>
        <ListRow title="MAGLEV 원본 기반" subtitle="토렌트·직접 링크·브라우저·HLS/DASH·RSS·자막·공통 전송 목록을 기반으로 유지합니다." icon="github" onPress={() => void Linking.openURL('https://github.com/Kaos599/Maglev')} />
        <ListRow title="YTDLnis · yt-dlp" subtitle="형식·추가 화질 조회와 다운로드 경로를 일부 적용했습니다. 선택 컨테이너 변환 코드는 있으나 Galaxy 저장·재생 검증에서 실패 보고가 있어 미완료입니다." icon="github" onPress={() => void Linking.openURL('https://github.com/deniscerri/ytdlnis')} />
        <ListRow title="NewPipe Extractor" subtitle="빠른 YouTube 메타데이터와 원본 오디오/영상 형식 조회에 사용합니다. adaptive A/V 병합과 선택 형식 저장은 실기기 검증 대상입니다." icon="github" onPress={() => void Linking.openURL('https://github.com/TeamNewPipe/NewPipeExtractor')} />
        <ListRow title="LJ Downloader 참고" subtitle="WebView 요청·DOM 미디어 감지를 일부 반영했습니다. 사이트별 플러그인, 세션 헤더 복원과 사이트별 추출은 미완성입니다." />
        <ListRow title="MPMux Video Downloader · Chrome 확장" subtitle="MP4/WEBM·HLS 감지와 Range 요청을 참고합니다. Android 앱 자체 MSE/SourceBuffer 캡처·라이브 녹화는 아직 구현되지 않았습니다." icon="external" onPress={() => void Linking.openURL('https://chromewebstore.google.com/detail/video-downloader-mpmux/mbflpfaamifmmmkdjkcmpofpccfmlmap?hl=ko')} />
        <ListRow title="MPMux 정적 다운로더" subtitle="Range/병렬 세그먼트 방식을 참고합니다. 기존 Range 경로는 있으나 이어받기·서버 206 검증·병렬 Part 병합은 실기기 수용 테스트가 필요합니다." icon="external" onPress={() => void Linking.openURL('https://mpmux.com/ko/staticdownloader')} />
        <ListRow title="MPMux 버퍼 멀티플렉서" subtitle="MSE/SourceBuffer appendBuffer 캡처와 라이브 mux 참고. 실제 바이트 캡처·init/media segment 조립·파일 저장은 미구현입니다." icon="external" onPress={() => void Linking.openURL('https://mpmux.com/buffermuxer')} />
        <ListRow title="Morphe WireGuard 패치" subtitle="userspace WireGuard·인증 로컬 프록시·.conf 암호화 저장 코드가 있습니다. 터널/다운로드 실패 보고가 있어 원격 handshake와 HTTP/HTTPS 실제 프록시 경로는 미검증입니다." icon="github" onPress={() => void Linking.openURL('https://github.com/seo-rii/morphe-wireguard-patches')} />
        <ListRow title="FFmpeg · 오디오 후처리" subtitle="FFmpegKit 변환기와 완료 후처리 큐 코드가 있습니다. MP3·M4A·Opus 및 영상 컨테이너 변환은 저장 실패 보고가 있어 완료로 인정하지 않습니다." />
        <FocusAnchor anchorKey={rowKey("Barrel 1.1.2 APK 분석·이식 범위")}>
          <ListRow title="Barrel 1.1.2 APK 분석·이식 범위" subtitle="정적 분석 원문과 기능별 clean-room 이식 계획입니다. APK 자체는 포함하지 않으며 기능 이식은 별도 검증합니다." icon="file" onPress={() => void Linking.openURL('https://github.com/dragonslayers-k/Maglev_forked/blob/feature/p1-video-detection-observer/docs/reference/Barrel_1.1.2_APK_%EC%8B%AC%EC%B8%B5_%EB%B6%84%EC%84%9D_%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C_%EA%B8%B0%EB%8A%A5_%EC%9D%B4%EC%8B%9D_%EC%84%A4%EA%B3%84%EC%84%9C.md')} />
        </FocusAnchor>
        <FocusAnchor anchorKey={rowKey("통합 기능 감사·이식 계획")}>
          <ListRow title="통합 기능 감사·이식 계획" subtitle="현재 코드 위치, 미구현 범위, 우선순위와 수용 테스트를 확인합니다." icon="file" onPress={() => void Linking.openURL('https://github.com/dragonslayers-k/Maglev_forked/blob/feature/p1-video-detection-observer/docs/INTEGRATED_FEATURE_AUDIT_AND_PORTING_PLAN_KO.md')} />
        </FocusAnchor>
      </Card>
      <SectionHeader title="기본 기능" />
      <Card>
        <ListRow title="광고 차단" subtitle="MAGLEV 차단 목록과 브라우저 필터를 유지합니다. 차단 목록 업데이트는 APK 업데이트와 별도로 관리됩니다." icon="filter" />
      </Card>
      {crashCount > 0 ? (
        <Card>
          <ListRow
            title={errorScreenCopy.copy}
            subtitle={errorScreenCopy.about.subtitle}
            icon="copy"
            onPress={() => void copyCrashReport()}
          />
          <ListRow
            title={errorScreenCopy.about.clear}
            icon="trash"
            onPress={() => {
              clearCrashLog();
              setCrashCount(0);
            }}
          />
        </Card>
      ) : null}
      <View style={s.footer}>
        <Text style={s.footerText}>{`Version ${appVersion} · ${engine}`}</Text>
      </View>
      <Dialog
        visible={logWarning}
        onClose={() => setLogWarning(false)}
        title={aboutExtrasCopy.debugLog.dialogTitle}
        actions={
          <>
            <Button label={aboutExtrasCopy.debugLog.share} fullWidth loading={sharing} onPress={() => void shareLog()} />
            <Button
              label={aboutExtrasCopy.debugLog.cancel}
              variant="secondary"
              fullWidth
              onPress={() => setLogWarning(false)}
            />
          </>
        }
      >
        <Text style={s.dialogBody}>{aboutExtrasCopy.debugLog.dialogBody}</Text>
      </Dialog>
    </SettingsPage>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    brand: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxl },
    wordmarkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
    wordmarkPlus: { ...type.heading, fontSize: type.size.display, color: c.accent },
    footer: { minHeight: touch.min, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
    dialogBody: { ...type.body, color: c.textMuted },
    footerText: { ...type.mono, fontSize: type.size.md, color: c.textMuted, textAlign: 'center' },
  });
