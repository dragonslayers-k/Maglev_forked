import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { maglevEngine } from 'maglev-engine';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, spacing, touch, type } from '../../constants/theme';
import { koUiText } from '../../constants/korean';
import { APP_ICONS, APP_ICON_BADGE_CIRCLE, APP_ICON_BADGE_PLUS, DEFAULT_APP_ICON } from '../../constants/appIcons';
import { appIconCopy } from '../../constants/copy';
import { APP_ICON_PREVIEWS, APP_ICON_PREVIEW_VIEWBOX } from '../../assets/app-icons/previews';
import { PressableScale } from '../ui';
import { Caption } from './SettingsParts';

const PREVIEW = 56;
const RING = 2;
const GAP = 3;
const OUTER = PREVIEW + 2 * (RING + GAP);

/** One icon, drawn the way a round launcher crops it. Its colours are the icon's own. */
function IconPreview({ id }: { id: string }) {
  const layers = APP_ICON_PREVIEWS[id] ?? [];
  return (
    <Svg width={PREVIEW} height={PREVIEW} viewBox={APP_ICON_PREVIEW_VIEWBOX}>
      {layers.map(([fill, d, evenOdd, transform], i) => (
        <Path key={i} d={d} fill={fill} fillRule={evenOdd ? 'evenodd' : undefined} transform={transform} />
      ))}
      <Circle cx={84} cy={22} r={11} fill={APP_ICON_BADGE_CIRCLE} />
      <Path d="M82 16 H86 V20 H90 V24 H86 V28 H82 V24 H78 V20 H82 Z" fill={APP_ICON_BADGE_PLUS} />
    </Svg>
  );
}

/**
 * Settings > Appearance > App icon. A grid of the launcher icons; the chosen one has an accent ring.
 * Android only: it renders nothing elsewhere. The change reaches the launcher when the user leaves the app
 * (NATIVE_CONTRACT section 26), which the caption says.
 */
export function AppIconSection() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [current, setCurrent] = useState(DEFAULT_APP_ICON);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let alive = true;
    maglevEngine.getAppIcon().then((id) => alive && setCurrent(id), () => {});
    return () => {
      alive = false;
    };
  }, []);

  const pick = useCallback(
    (id: string) => {
      if (id === current) return;
      const before = current;
      setCurrent(id);
      maglevEngine.setAppIcon(id).then(
        (res) => {
          if (res && res.ok === false) setCurrent(before);
        },
        () => setCurrent(before),
      );
    },
    [current],
  );

  if (Platform.OS !== 'android') return null;

  return (
    <View style={s.root}>
      <Text style={s.label}>{appIconCopy.label}</Text>
      <View style={s.grid} accessibilityRole="radiogroup" accessibilityLabel={appIconCopy.label}>
        {APP_ICONS.map(({ id, name }) => {
          const selected = id === current;
          return (
            <PressableScale
              key={id}
              onPress={() => pick(id)}
              accessibilityRole="radio"
              accessibilityLabel={appIconCopy.a11y(koUiText(name), selected)}
              accessibilityState={{ selected, checked: selected }}
              containerStyle={s.cell}
              style={s.item}
            >
              <View style={[s.ring, selected && { borderColor: colors.accent }]}>
                <View style={s.circle}>
                  <IconPreview id={id} />
                </View>
              </View>
              <Text style={[s.name, selected && { color: colors.text }]} numberOfLines={2}>
                {koUiText(name)}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <Caption>{appIconCopy.hint}</Caption>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: { padding: spacing.lg, gap: spacing.sm },
    label: { ...type.bodyStrong, fontSize: type.size.base, color: c.text },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
    cell: { width: '25%', minHeight: touch.min },
    item: { alignItems: 'center', gap: spacing.xs },
    ring: {
      width: OUTER,
      height: OUTER,
      borderRadius: OUTER / 2,
      borderWidth: RING,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Image outline (10% white on dark, 10% black on light) so dark previews (Mono, All dark) don't melt into the card.
    circle: {
      width: PREVIEW,
      height: PREVIEW,
      borderRadius: PREVIEW / 2,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.outline,
    },
    name: { ...type.body, fontSize: type.size.xs, color: c.textMuted, textAlign: 'center' },
  });
