import React, { useState } from 'react';
import { Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useSettings } from '../../context/SettingsContext';
import { Banner, Button, ListRow, SectionHeader, Toggle } from '../../components/ui';
import { Caption, Card, InputSheet, SettingsPage, parseIntIn } from '../../components/settings/SettingsParts';
import { NetworkRestartBanner, useNetworkStatus } from '../../components/settings/NetworkRestartBanner';
import { notices } from '../../constants/copy';
import { blocklistSubtitle } from '../../utils/networkStatus';

type Field = 'port' | 'proxyHost' | 'proxyPort' | 'proxyUser' | 'proxyPass';

/** Torrent internals: port, peer finding, proxy and the IP block list. The everyday network rules stay on Network. */
export default function NetworkAdvancedSettings() {
  const { settings, updateSettings } = useSettings();
  const { restartPending, blocklist, busy, restart } = useNetworkStatus();
  const n = settings.network;
  const [field, setField] = useState<Field | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const set = (patch: Partial<typeof n>) => updateSettings((prev) => ({ network: { ...prev.network, ...patch } }));
  const setProxy = (patch: Partial<typeof n.proxy>) =>
    updateSettings((prev) => ({ network: { ...prev.network, proxy: { ...prev.network.proxy, ...patch } } }));
  const sw = (label: string, value: boolean, onValueChange: (v: boolean) => void) => (
    <Toggle value={value} onValueChange={onValueChange} accessibilityLabel={label} />
  );

  const pickBlocklist = async () => {
    setFileError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.[0]) return;
      const path = res.assets[0].uri.replace(/^file:\/\//, '');
      set({ ipFilterPath: path, ipFilterEnabled: true });
    } catch {
      setFileError(notices.inline.readFileFailed);
    }
  };

  const proxyHostValue = n.proxy.host || '—';
  const blocklistName = n.ipFilterPath ? decodeURIComponent(n.ipFilterPath.split('/').pop() ?? '') : '';
  const blocklistLine = blocklistSubtitle(blocklistName, n.ipFilterEnabled && n.ipFilterPath ? blocklist : null);

  return (
    <SettingsPage title="고급 네트워크">
      <Stack.Screen options={{ headerShown: false }} />
      <NetworkRestartBanner restartPending={restartPending} busy={busy} onRestart={() => void restart()} />

      <SectionHeader title="연결" />
      <Card>
        <ListRow title="수신 포트" value={String(n.listeningPort)} onPress={() => setField('port')} />
        <ListRow title="UPnP" subtitle="공유기에서 수신 포트를 엽니다." accessory={sw('UPnP', n.upnpEnabled, (v) => set({ upnpEnabled: v }))} />
        <ListRow title="DHT" subtitle="트래커 없이 피어를 찾습니다." accessory={sw('DHT', n.dhtEnabled, (v) => set({ dhtEnabled: v }))} />
        <ListRow title="로컬 피어 검색" subtitle="같은 Wi-Fi에서 피어를 찾습니다." accessory={sw('로컬 피어 검색', n.lsdEnabled, (v) => set({ lsdEnabled: v }))} />
      </Card>

      <SectionHeader title="프록시" />
      <Card>
        <ListRow title="SOCKS5 프록시" accessory={sw('SOCKS5 프록시', n.proxy.enabled, (v) => setProxy({ enabled: v, type: 'SOCKS5' }))} />
        {n.proxy.enabled ? (
          <>
            <ListRow title="호스트" value={proxyHostValue} onPress={() => setField('proxyHost')} />
            <ListRow title="포트" value={String(n.proxy.port)} onPress={() => setField('proxyPort')} />
            <ListRow title="사용자 이름" value={n.proxy.username || '없음'} onPress={() => setField('proxyUser')} />
            <ListRow title="비밀번호" value={n.proxy.password ? '••••••' : '없음'} onPress={() => setField('proxyPass')} />
          </>
        ) : null}
      </Card>
      <Caption>토렌트 피어 및 웹 요청에만 적용됩니다.</Caption>

      <SectionHeader title="IP 차단 목록" />
      <Card>
        <ListRow
          title="목록의 IP 차단"
          subtitle={blocklistLine.text}
          subtitleTone={blocklistLine.danger ? 'danger' : undefined}
          accessory={sw('목록의 IP 차단', n.ipFilterEnabled && !!n.ipFilterPath, (v) => set({ ipFilterEnabled: v && !!n.ipFilterPath }))}
        />
      </Card>
      {fileError ? <Banner tone="danger" title={fileError} actionLabel="다시 시도" onAction={pickBlocklist} /> : null}
      <Button label={n.ipFilterPath ? '다른 파일 선택' : '차단 목록 파일 선택'} variant="secondary" onPress={pickBlocklist} />

      <InputSheet
        visible={field === 'port'}
        title="Incoming port"
        subtitle="1024~65535 사이의 포트를 입력하세요."
        initial={String(n.listeningPort)}
        numeric
        validate={(r) => (parseIntIn(r, 1024, 65535) === null ? '1024~65535 사이의 정수를 입력하세요.' : null)}
        onClose={() => setField(null)}
        onSubmit={(r) => {
          const v = parseIntIn(r, 1024, 65535);
          if (v !== null) set({ listeningPort: v });
          setField(null);
        }}
      />
      <InputSheet
        visible={field === 'proxyHost'}
        title="프록시 호스트"
        initial={n.proxy.host}
        placeholder="127.0.0.1"
        validate={(r) => (/^[A-Za-z0-9.\-]+$/.test(r) ? null : '호스트 이름 또는 IP 주소를 입력하세요.')}
        onClose={() => setField(null)}
        onSubmit={(r) => {
          setProxy({ host: r });
          setField(null);
        }}
      />
      <InputSheet
        visible={field === 'proxyPort'}
        title="프록시 포트"
        subtitle="1~65535 사이의 포트를 입력하세요."
        initial={String(n.proxy.port)}
        numeric
        validate={(r) => (parseIntIn(r, 1, 65535) === null ? '1~65535 사이의 정수를 입력하세요.' : null)}
        onClose={() => setField(null)}
        onSubmit={(r) => {
          const v = parseIntIn(r, 1, 65535);
          if (v !== null) setProxy({ port: v });
          setField(null);
        }}
      />
      <InputSheet
        visible={field === 'proxyUser'}
        title="프록시 사용자 이름"
        subtitle="사용하지 않으려면 비워 두세요."
        initial={n.proxy.username ?? ''}
        validate={() => null}
        onClose={() => setField(null)}
        onSubmit={(r) => {
          setProxy({ username: r || undefined });
          setField(null);
        }}
      />
      <InputSheet
        visible={field === 'proxyPass'}
        title="프록시 비밀번호"
        subtitle="Leave empty for none."
        initial={n.proxy.password ?? ''}
        secure
        validate={() => null}
        onClose={() => setField(null)}
        onSubmit={(r) => {
          setProxy({ password: r || undefined });
          setField(null);
        }}
      />
    </SettingsPage>
  );
}
