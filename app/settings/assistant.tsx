import React from 'react';
import { Stack } from 'expo-router';
import { ListRow, Toggle } from '../../components/ui';
import { View } from 'react-native';
import { Card, Caption, SettingsPage } from '../../components/settings/SettingsParts';
import { spacing } from '../../constants/theme';
import { ExperimentalTag } from '../../components/assistant/provider/ExperimentalTag';
import { assistantPrefs, useAssistantPrefs } from '../../utils/prefs/assistantApp';
import { ProviderSection } from '../../components/assistant/provider/ProviderSection';
import { SectionHeader } from '../../components/ui';

const fmt = (n: number) => n.toLocaleString();

export default function AssistantSettings() {
  const p = useAssistantPrefs();
  const used = p.tokensUsed.input + p.tokensUsed.output;
  return (
    <SettingsPage title="도우미 설정">
      <Stack.Screen options={{ headerShown: false }} />
      <Card>
        <ListRow
          title="도우미"
          subtitle="도우미 탭을 추가합니다. 끄면 탭이 사라지고 외부로 전송되는 내용이 없습니다."
          accessory={
            <Toggle
              value={p.enabled}
              onValueChange={(v) => assistantPrefs.update({ enabled: v })}
              accessibilityLabel="Assistant"
            />
          }
        />
        {used > 0 ? (
          <ListRow
            title="사용 토큰"
            value={fmt(used)}
            subtitle={`${fmt(p.tokensUsed.input)} 전송 · ${fmt(p.tokensUsed.output)} 수신`}
          />
        ) : null}
        {p.warningAcceptedAt ? (
          <ListRow
            title="사용 안내 다시 보기"
            subtitle="다음에 도우미 탭을 열 때 안내가 표시됩니다."
            onPress={() => assistantPrefs.update({ warningAcceptedAt: null })}
          />
        ) : null}
      </Card>
      <View style={{ gap: spacing.sm }}>
        <ExperimentalTag />
        <Caption>실험 기능입니다. 답변이 틀릴 수 있고 기능이 변경될 수 있습니다.</Caption>
      </View>
      <SectionHeader title="AI 제공자" />
      <ProviderSection />
    </SettingsPage>
  );
}
