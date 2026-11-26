import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { getBlocklistInfo, type BlocklistInfo } from 'maglev-engine';
import { Button, ListRow, SectionHeader, Toggle } from '../../components/ui';
import { Caption, Card, SettingsPage } from '../../components/settings/SettingsParts';
import { listsCopy } from '../../constants/copy';
import { useListPrefs } from '../../utils/prefs/lists';
import { checkListsNow, useListsState } from '../../utils/lists';
import { adBusy, sourcesBusy } from '../../utils/lists/machine';
import { relativeTime } from '../../utils/feeds';

export default function ListUpdatesSettings() {
  const [prefs, setPrefs] = useListPrefs();
  const lists = useListsState();
  const [adInfo, setAdInfo] = useState<BlocklistInfo | null>(null);
  const checking = adBusy(lists) || sourcesBusy(lists);

  useEffect(() => {
    let alive = true;
    void getBlocklistInfo().then((result) => {
      if (alive && result.ok) setAdInfo(result);
    });
    return () => { alive = false; };
  }, [lists.ad]);

  const adLine = adInfo
    ? adInfo.updatedAt != null
      ? listsCopy.adList.info(adInfo.domains.toLocaleString(), relativeTime(adInfo.updatedAt))
      : listsCopy.adList.builtIn(adInfo.domains.toLocaleString())
    : null;
  const sourcesStamp = prefs.sourcesFile
    ? Date.parse(prefs.sourcesFile.generatedAt) || prefs.lastListCheckAt
    : null;
  const sourcesLine = prefs.appliedSerial > 0 && sourcesStamp
    ? listsCopy.sources.updated(relativeTime(sourcesStamp))
    : listsCopy.sources.builtIn;

  const adStatus = (() => {
    switch (lists.ad.kind) {
      case 'downloading': return listsCopy.checking;
      case 'notModified': return listsCopy.values.upToDate;
      case 'updated': return listsCopy.values.updated;
      case 'failed': return lists.ad.why === 'blocked' ? listsCopy.hints.blocked : lists.ad.why === 'invalid' ? listsCopy.hints.rejected : listsCopy.values.failed;
      default: return null;
    }
  })();
  const sourceStatus = (() => {
    switch (lists.sources.kind) {
      case 'checking':
      case 'verifying': return listsCopy.checking;
      case 'unchanged': return listsCopy.values.upToDate;
      case 'applied': return lists.sources.changed > 0 ? listsCopy.values.updatedSources(lists.sources.changed) : listsCopy.values.updated;
      case 'rejected': return listsCopy.hints.rejected;
      case 'failed': return lists.sources.why === 'blocked' ? listsCopy.hints.blocked : listsCopy.values.failed;
      default: return null;
    }
  })();
  const line = (...parts: (string | null)[]) => parts.filter(Boolean).join('\n');

  return (
    <SettingsPage title="목록 데이터 업데이트">
      <Stack.Screen options={{ headerShown: false }} />
      <SectionHeader title="목록 데이터" />
      <Caption>광고 차단 목록과 검색 사이트·트래커 목록은 앱 APK 업데이트와 별도로 갱신됩니다.</Caption>
      <Card>
        <ListRow
          title={listsCopy.autoUpdate}
          subtitle={listsCopy.hints.autoUpdateSubtitle}
          accessory={<Toggle value={prefs.listsAutoCheck} onValueChange={(listsAutoCheck) => setPrefs({ listsAutoCheck })} accessibilityLabel={listsCopy.autoUpdate} />}
        />
        <ListRow
          title={listsCopy.adList.title}
          subtitle={line(adLine, adStatus)}
          accessory={<Button label={listsCopy.checkNow} variant="secondary" loading={checking} onPress={() => void checkListsNow()} accessibilityLabel={listsCopy.checkNow + ': ' + listsCopy.adList.title} />}
        />
        <ListRow
          title={listsCopy.sources.title}
          subtitle={line(sourcesLine, sourceStatus)}
          accessory={<Button label={listsCopy.checkNow} variant="secondary" loading={checking} onPress={() => void checkListsNow()} accessibilityLabel={listsCopy.checkNow + ': ' + listsCopy.sources.title} />}
        />
      </Card>
    </SettingsPage>
  );
}
