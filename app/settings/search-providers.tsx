import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, spacing, type } from '../../constants/theme';
import { Chip, ListRow, SectionHeader, Toggle } from '../../components/ui';
import { Caption, Card, ChipGroup, SettingsPage } from '../../components/settings/SettingsParts';
import { ProviderRow } from '../../components/search-providers/ProviderRow';
import { ProviderSheet, TestOutcome } from '../../components/search-providers/ProviderSheet';
import { TorznabDraft, TorznabSheet } from '../../components/search-providers/TorznabSheet';
import { CATEGORY_LABEL, ProviderInfo, TORZNAB_PREFIX, allProviderInfo, coverage, formatSeconds } from '../../components/search/meta';
import { loadExtraProviders } from '../../components/search/extra';
import { clearCookies } from 'maglev-engine';
import { SearchPrefs, clearSiteChecks, deleteTorznabApiKey, setTorznabApiKey, useSearchPrefs } from '../../utils/prefs/search';
import { listsCopy } from '../../constants/copy';
import { useListsVersion } from '../../utils/lists/hooks';
import { CloudflareSolverSheet } from '../../components/search/CloudflareSolverSheet';
import { testProvider } from '../../utils/search/aggregate';
import { CATEGORY_ORDER, type Category } from '../../utils/search/types';
import { providerCovers } from '../../utils/search/providerFilter';

const WAITS = [
  { value: 5, label: '5 s' },
  { value: 8, label: '8 s' },
  { value: 15, label: '15 s' },
] as const;
const LIMITS = [
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
] as const;
const RESULT_NAME_LINES = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 0, label: '전체 이름' },
] as const;

/** Torznab entries default to every category except adult; the user narrows it per source. */
const TORZNAB_DEFAULT_CATEGORIES: Category[] = ['movies', 'tv', 'anime', 'music', 'apps', 'games', 'books', 'other'];

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    return (ch === 'x' ? r : (r & 3) | 8).toString(16);
  });
}

export default function SearchProvidersSettings() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [prefs, update] = useSearchPrefs();
  const [openId, setOpenId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('all');
  const [torznabOpen, setTorznabOpen] = useState(false);
  const [tests, setTests] = useState<Record<string, TestOutcome>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [solving, setSolving] = useState<string | null>(null);

  // A new source list changes mirrors, warnings and which sources are turned off.
  const listsVersion = useListsVersion();
  const all = useMemo(() => allProviderInfo(prefs), [prefs, listsVersion]);
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  // Sources that last sat behind a Cloudflare check get their own section on top and are not listed twice.
  const checkList = useMemo(
    () => prefs.needsCheck.filter((id) => prefs.enabled.includes(id) && !byId.get(id)?.turnedOff).map((id) => byId.get(id)).filter((p): p is ProviderInfo => !!p?.cloudflare),
    [prefs.needsCheck, prefs.enabled, byId],
  );
  const checkIds = useMemo(() => new Set(checkList.map((p) => p.id)), [checkList]);
  const onList = useMemo(() => prefs.enabled.filter((id) => !checkIds.has(id)).map((id) => byId.get(id)).filter((p): p is ProviderInfo => !!p && !p.turnedOff), [prefs.enabled, byId, checkIds]);
  const offList = useMemo(
    () => all.filter((p) => (!prefs.enabled.includes(p.id) || !!p.turnedOff) && (prefs.adult || !p.nsfw)),
    [all, prefs.enabled, prefs.adult],
  );
  // The category filter narrows On and Off; sources needing a check always show.
  const shownOn = useMemo(() => onList.filter((p) => providerCovers(p, category)), [onList, category]);
  const shownOff = useMemo(() => offList.filter((p) => providerCovers(p, category)), [offList, category]);

  const setEnabled = useCallback(
    (id: string, on: boolean) =>
      update((p) => ({ enabled: on ? (p.enabled.includes(id) ? p.enabled : [...p.enabled, id]) : p.enabled.filter((x) => x !== id) })),
    [update],
  );

  const move = useCallback(
    (id: string, delta: -1 | 1) =>
      update((p) => {
        const i = p.enabled.indexOf(id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= p.enabled.length) return {};
        const next = [...p.enabled];
        [next[i], next[j]] = [next[j], next[i]];
        return { enabled: next };
      }),
    [update],
  );

  const runTest = useCallback(
    async (id: string) => {
      setTesting(id);
      try {
        const extraProviders = await loadExtraProviders(prefs.torznab);
        const r = await testProvider(id, { extraProviders, mirrorOverride: prefs.mirrorOverride, waitSeconds: prefs.waitSeconds });
        setTests((t) => ({ ...t, [id]: { ok: r.ok, ms: r.ms, message: r.message } }));
      } catch {
        setTests((t) => ({ ...t, [id]: { ok: false, ms: 0, message: "Didn't answer" } }));
      } finally {
        setTesting(null);
      }
    },
    [prefs],
  );

  const addTorznab = useCallback(
    async (draft: TorznabDraft) => {
      const id = uuid();
      await setTorznabApiKey(id, draft.apiKey);
      update((p) => ({
        torznab: [...p.torznab, { id, name: draft.name, url: draft.url, categories: TORZNAB_DEFAULT_CATEGORIES }],
        enabled: [...p.enabled, `${TORZNAB_PREFIX}${id}`],
      }));
      setTorznabOpen(false);
    },
    [update],
  );

  const removeTorznab = useCallback(
    (providerId: string) => {
      const bare = providerId.slice(TORZNAB_PREFIX.length);
      void deleteTorznabApiKey(bare);
      update((p) => {
        const useFor = { ...p.useFor };
        delete useFor[providerId];
        return {
          torznab: p.torznab.filter((t) => t.id !== bare),
          enabled: p.enabled.filter((x) => x !== providerId),
          useFor,
        };
      });
      setOpenId(null);
    },
    [update],
  );

  const setAddress = useCallback(
    (p: ProviderInfo, value: string) => {
      if (p.custom) {
        if (!value) return;
        const bare = p.id.slice(TORZNAB_PREFIX.length);
        update((s) => ({ torznab: s.torznab.map((t) => (t.id === bare ? { ...t, url: value } : t)) }));
        return;
      }
      update((s) => {
        const mirrorOverride = { ...s.mirrorOverride };
        if (value) mirrorOverride[p.id] = value;
        else delete mirrorOverride[p.id];
        return { mirrorOverride };
      });
    },
    [update],
  );

  const setUseFor = useCallback(
    (id: string, cats: Category[] | null) =>
      update((s: SearchPrefs) => {
        const useFor = { ...s.useFor };
        if (cats) useFor[id] = cats;
        else delete useFor[id];
        return { useFor };
      }),
    [update],
  );

  const note = (p: ProviderInfo): { text: string; tone: 'normal' | 'warning' | 'danger' } => {
    if (p.turnedOff) return { text: p.turnedOff.note ? listsCopy.providers.turnedOffWithNote(p.turnedOff.note) : listsCopy.providers.turnedOff, tone: 'warning' };
    const t = tests[p.id];
    if (t && !t.ok) return { text: `${coverage(p)} · not responding`, tone: 'danger' };
    if (p.unsafeReason) return { text: p.unsafeReason, tone: 'warning' };
    return { text: t?.ok ? `${coverage(p)} · ${formatSeconds(t.ms)}` : coverage(p), tone: 'normal' };
  };

  const solvingProvider = solving ? byId.get(solving) : undefined;
  const open = openId ? byId.get(openId) ?? null : null;
  const openPos = open ? prefs.enabled.indexOf(open.id) : -1;

  return (
    <SettingsPage title="검색 사이트">
      <Stack.Screen options={{ headerShown: false }} />
      <Caption>토렌트 검색에 사용할 사이트 목록입니다. 켜진 사이트에 동시에 검색하며, 같은 결과가 중복되면 사이트별 우선순위를 적용합니다. 분류 필터로 사이트를 좁히고, 사이트별 설정에서 주소·사용 범위·응답 여부를 확인할 수 있습니다.</Caption>

      {checkList.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="확인이 필요한 사이트" />
          <Card>
            {checkList.map((p, i) => (
              <ProviderRow
                key={p.id}
                provider={p}
                enabled
                note="?를 눌러 사이트를 한 번 열어 확인하세요."
                noteTone="accent"
                first={i === 0}
                onOpen={() => setOpenId(p.id)}
                onToggle={(on) => setEnabled(p.id, on)}
                onCheck={() => setSolving(p.id)}
              />
            ))}
          </Card>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="표시할 검색 사이트" />
        <Card>
          <ListRow
            title="성인 검색 사이트 표시"
            subtitle={prefs.adult ? '성인 사이트는 사용 안 함 목록에 표시됩니다.' : '직접 켤 때까지 숨깁니다.'}
            accessory={<Toggle value={prefs.adult} onValueChange={(adult) => update({ adult })} accessibilityLabel="성인 검색 사이트 표시" />}
          />
          <ListRow
            title="위험한 검색 사이트 경고"
            subtitle="가짜 파일이나 유해한 업로드가 알려진 사이트의 결과에 표시합니다."
            accessory={<Toggle value={prefs.warnUnsafe} onValueChange={(warnUnsafe) => update({ warnUnsafe })} accessibilityLabel="위험한 검색 사이트 경고" />}
          />
          {prefs.clearances.length > 0 ? (
            <ListRow
              icon="trash"
              title="사이트 확인 기록 지우기"
              subtitle={`지운 사이트 확인 기록 ${prefs.clearances.length}개를 다시 확인해야 합니다.`}
              onPress={() => {
                const hosts = clearSiteChecks();
                void clearCookies(hosts.map((h) => `https://${h.host}/`));
              }}
            />
          ) : null}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="검색 동작" />
        <Card>
          <ChipGroup
            label="느린 사이트 대기 시간"
            options={WAITS}
            value={prefs.waitSeconds}
            onChange={(waitSeconds) => update({ waitSeconds })}
          />
          <ChipGroup label="사이트별 결과 수" options={LIMITS} value={prefs.limit} onChange={(limit) => update({ limit })} />
          <ListRow
            title="시더 없는 토렌트 숨기기"
            subtitle="공유 중인 사용자가 없는 결과를 숨깁니다."
            accessory={<Toggle value={prefs.hideDead} onValueChange={(hideDead) => update({ hideDead })} accessibilityLabel="시더 없는 토렌트 숨기기" />}
          />
          <ListRow
            title="신뢰된 업로더만 표시"
            subtitle="Pirate Bay의 일반 회원 업로드를 숨깁니다."
            accessory={<Toggle value={prefs.trustedUploadersOnly} onValueChange={(trustedUploadersOnly) => update({ trustedUploadersOnly })} accessibilityLabel="신뢰된 업로더만 표시" />}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="결과" />
        <Card>
          <ChipGroup
            label="결과 이름 줄 수"
            options={RESULT_NAME_LINES}
            value={prefs.resultNameLines}
            onChange={(resultNameLines) => update({ resultNameLines })}
          />
        </Card>
        <Caption>검색 결과의 긴 제목을 몇 줄까지 표시할지 설정합니다.</Caption>
      </View>

      <View style={styles.section}>
        <SectionHeader title="검색 사이트 범위" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} accessibilityRole="radiogroup" accessibilityLabel="검색 범주">
          {CATEGORY_ORDER.filter((c) => c !== 'adult' || prefs.adult).map((c) => (
            <Chip key={c} label={CATEGORY_LABEL[c]} role="radio" selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <SectionHeader title={`사용 중 · ${onList.length + checkList.length}`} />
        <Card>
          {onList.length === 0 ? <Text style={styles.empty}>활성화된 검색 사이트가 없습니다. 아래에서 사이트를 켜세요.</Text> : shownOn.length === 0 ? <Text style={styles.empty}>현재 분류를 지원하는 활성 검색 사이트가 없습니다.</Text> : null}
          {shownOn.map((p, i) => {
            const n = note(p);
            return (
              <ProviderRow
                key={p.id}
                provider={p}
                enabled
                position={prefs.enabled.indexOf(p.id) + 1}
                note={n.text}
                noteTone={n.tone}
                first={i === 0}
                onOpen={() => setOpenId(p.id)}
                onToggle={(on) => setEnabled(p.id, on)}
              />
            );
          })}
        </Card>
      </View>

      {shownOff.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="사용 안 함" />
          <Card>
            {shownOff.map((p, i) => {
              const n = note(p);
              return (
                <ProviderRow
                  key={p.id}
                  provider={p}
                  enabled={false}
                  note={n.text}
                  noteTone={n.tone}
                  first={i === 0}
                  locked={!!p.turnedOff}
                  onOpen={() => setOpenId(p.id)}
                  onToggle={(on) => setEnabled(p.id, on)}
                />
              );
            })}
          </Card>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="사용자 지정 검색 서버" />
        <Card>
          <ListRow
            icon="plus"
            title="Jackett 또는 Prowlarr 연결"
            subtitle="서버에서 지원하는 공개·비공개 트래커를 검색합니다."
            onPress={() => setTorznabOpen(true)}
          />
        </Card>
      </View>

      <Caption>MAGLEV는 파일을 호스팅하거나 검색 색인을 직접 운영하지 않습니다. 검색 사이트는 제3자이며 다운로드한 콘텐츠의 책임은 사용자에게 있습니다.</Caption>

      <ProviderSheet
        provider={open}
        prefs={prefs}
        enabled={!!open && prefs.enabled.includes(open.id) && !open.turnedOff}
        position={openPos}
        onCount={prefs.enabled.length}
        test={open ? tests[open.id] : undefined}
        testing={!!open && testing === open.id}
        onClose={() => setOpenId(null)}
        onTest={() => open && runTest(open.id)}
        onToggle={(on) => open && setEnabled(open.id, on)}
        onMove={(d) => open && move(open.id, d)}
        onUseFor={(cats) => open && setUseFor(open.id, cats)}
        onAddress={(v) => open && setAddress(open, v)}
        onRemove={open?.custom ? () => removeTorznab(open.id) : undefined}
      />
      {solvingProvider?.cloudflare ? (
        <CloudflareSolverSheet
          visible
          providerName={solvingProvider.name}
          solverUrl={solvingProvider.cloudflare.solverUrl}
          onClose={() => setSolving(null)}
          onSolved={() => {
            const id = solving;
            setSolving(null);
            if (id) update((p) => ({ needsCheck: p.needsCheck.filter((x) => x !== id) }));
          }}
        />
      ) : null}
      <TorznabSheet visible={torznabOpen} onClose={() => setTorznabOpen(false)} onAdd={addTorznab} />
    </SettingsPage>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    filterRow: { gap: spacing.sm, paddingVertical: spacing.xs },
    section: { gap: spacing.sm },
    empty: { ...type.body, fontSize: type.size.md, color: c.textMuted, padding: spacing.lg },
  });
