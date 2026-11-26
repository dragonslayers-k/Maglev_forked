import React, { forwardRef } from 'react';
import * as ReactNative from 'react-native';
import type { TextProps } from 'react-native';
import { koUiText } from '../../constants/korean';

function translateString(value: string): string {
  const leading = value.match(/^\s*/)?.[0] ?? '';
  const trailing = value.match(/\s*$/)?.[0] ?? '';
  const body = value.trim();
  if (!body) return value;
  return leading + koUiText(body) + trailing;
}

function translateChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') return translateString(children);
  if (Array.isArray(children)) return children.map(translateChildren);
  return children;
}

/**
 * App-wide Korean presentation wrapper. All React Native Text imports in app/components
 * are redirected here by babel-plugin-korean-text, so literal UI labels use one dictionary.
 * User-provided names/URLs remain unchanged unless they exactly match a known UI label.
 */
export const KoreanText = forwardRef<React.ElementRef<typeof ReactNative.Text>, TextProps>(
  function KoreanText({ children, accessibilityLabel, accessibilityHint, ...props }, ref) {
    return React.createElement(ReactNative.Text, {
      ...props,
      ref,
      accessibilityLabel: accessibilityLabel ? translateString(accessibilityLabel) : accessibilityLabel,
      accessibilityHint: accessibilityHint ? translateString(accessibilityHint) : accessibilityHint,
    }, translateChildren(children));
  },
);
KoreanText.displayName = 'KoreanText';
