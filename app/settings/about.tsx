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
        <Wordmark />
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
          subtitle="Maglev 기반 · 공개 추출기와 다운로드 엔진을 통합한 커뮤니티 빌드"
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
      <SectionHeader title="통합 구성" />
      <Card>
        <ListRow
          title="MAGLEV 기반 기능"
          subtitle="토렌트·링크 다운로드, 브라우저, 검색, RSS, 자막 및 전송 관리를 유지합니다."
        />
        <ListRow
          title="YouTube 추출 엔진"
          subtitle="NewPipe Extractor를 우선 사용하고 yt-dlp로 추가 형식 분석을 제공합니다."
          icon="github"
          onPress={() => void Linking.openURL('https://github.com/yt-dlp/yt-dlp')}
        />
        <ListRow
          title="광고 차단"
          subtitle="MAGLEV의 내장 차단 목록과 브라우저 광고 차단 기능을 유지합니다."
        />
        <ListRow
          title="업데이트 방식"
          subtitle="APK 릴리스와 광고 차단·검색 목록 업데이트는 별도로 관리됩니다."
        />
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
    footer: { minHeight: touch.min, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
    dialogBody: { ...type.body, color: c.textMuted },
    footerText: { ...type.mono, fontSize: type.size.md, color: c.textMuted, textAlign: 'center' },
  });
