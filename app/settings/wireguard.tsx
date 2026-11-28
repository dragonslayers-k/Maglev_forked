import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { maglevEngine } from 'maglev-engine';
import { ListRow, Toggle } from '../../components/ui';
import { Caption, Card, SettingsPage } from '../../components/settings/SettingsParts';

export default function AppWireGuardSettings() {
  const [enabled, setEnabled] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const refresh = useCallback(async () => {
    const result = await maglevEngine.getAppWireGuardStatus();
    if (result.ok) {
      setEnabled(result.enabled);
      setHasProfile(result.hasProfile);
      setRunning(result.running);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const importProfile = useCallback(async () => {
    setBusy(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]?.uri) return;
      const result = await maglevEngine.importAppWireGuardProfile(picked.assets[0].uri);
      if (!result.ok) {
        Alert.alert('프로필 가져오기 실패', result.message || 'WireGuard .conf 파일을 확인하세요.');
        return;
      }
      await refresh();
      Alert.alert('프로필 저장', '프로필을 Android Keystore 기반 AES-GCM 암호화 저장소에 보관했습니다.');
    } catch (error) {
      Alert.alert('프로필 가져오기 실패', error instanceof Error ? error.message : '파일을 읽지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const testConnection = useCallback(async () => {
    if (testing || busy) return;
    setTesting(true);
    try {
      const result = await maglevEngine.testAppWireGuardConnection();
      if (result.ok) {
        Alert.alert('WireGuard 연결 확인',
          '실제 HTTPS 요청이 WireGuard 터널을 통과했습니다.\n\n출구 국가: ' + (result.country || '확인 불가') + ' (' + (result.country_code || '?') + ')\n출구 IP: ' + (result.ip || '확인 불가') + '\n\n이 검사는 다운로드 프록시 연결 확인이며, 브라우저 전체 트래픽이 터널링된다는 뜻은 아닙니다.');
      } else {
        Alert.alert('WireGuard 연결 확인 실패', result.message || '원격 연결 또는 터널 인터넷 접속을 확인하지 못했습니다.');
      }
    } catch (error) {
      Alert.alert('WireGuard 연결 확인 실패', error instanceof Error ? error.message : '터널 연결을 확인하지 못했습니다.');
    } finally {
      setTesting(false);
    }
  }, [busy, testing]);

  const changeEnabled = useCallback(async (value: boolean) => {
    setBusy(true);
    try {
      const result = await maglevEngine.setAppWireGuardEnabled(value);
      if (!result.ok) {
        Alert.alert('WireGuard 설정 실패', result.message || '설정을 적용하지 못했습니다.');
        return;
      }
      await refresh();
    } catch (error) {
      Alert.alert('WireGuard 설정 실패', error instanceof Error ? error.message : '설정을 적용하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return (
    <SettingsPage title="앱 내부 WireGuard">
      <Stack.Screen options={{ headerShown: false }} />
      <Card>
        <ListRow
          title="WireGuard .conf 프로필"
          subtitle={hasProfile ? '암호화 저장됨' : '프로필을 가져오지 않았습니다.'}
          onPress={() => { if (!busy) void importProfile(); }}
        />
        <ListRow
          title={testing ? '실제 터널 연결 확인 중…' : '실제 터널 연결 테스트'}
          subtitle="외부 HTTPS 요청으로 출구 국가·IP와 원격 연결을 확인합니다."
          onPress={() => { void testConnection(); }}
        />
        <ListRow
          title="HTTP/HTTPS 다운로드에 사용"
          subtitle={enabled ? (running ? '로컬 프록시 실행 중 · 원격 peer handshake 미확인' : '앱 내부 터널을 시작하는 중') : '꺼짐'}
          accessory={<Toggle value={enabled} onValueChange={(v) => void changeEnabled(v)} accessibilityLabel="앱 내부 WireGuard" />}
        />
      </Card>
      <Caption tone="warning">
        이 기능은 Android VpnService를 등록하지 않고 APN이나 휴대폰 전체 경로를 변경하지 않습니다.
        스위치를 켜면 앱 내부 userspace WireGuard 터널과 인증된 로컬 프록시가 즉시 실행됩니다. Maglev의 HTTP/HTTPS 다운로드 엔진만 앱 내부 로컬 프록시를 사용합니다.
        토렌트·DHT와 브라우저/WebView 요청은 이 터널에 포함되지 않으며, WireGuard가 켜져 있으면 토렌트 추가·재개를 차단합니다.
        터널 시작 또는 프록시 적용에 실패하면 직접 연결로 우회하지 않습니다.
      </Caption>
      <Card>
        <ListRow
          title="로컬 프록시 상태"
          subtitle={running ? '로컬 프록시 프로세스만 확인됨 · 원격 handshake는 아직 검증되지 않음' : '아직 시작되지 않음'}
        />
      </Card>
    </SettingsPage>
  );
}

export { ErrorBoundary } from '../../components/ErrorScreen';
