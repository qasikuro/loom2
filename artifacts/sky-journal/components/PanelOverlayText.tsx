import React from 'react';
import { Platform, Text, type TextProps, type TextStyle } from 'react-native';
import type { PanelOverlay } from '@/context/mappers';

export const PANEL_FONT_OPTIONS = [
  { key: 'Satoshi-Light', label: 'fontLight' },
  { key: 'Satoshi-Regular', label: 'fontRegular' },
  { key: 'Satoshi-Medium', label: 'fontMedium' },
  { key: 'Satoshi-Bold', label: 'fontBold' },
  { key: 'Satoshi-Black', label: 'fontBlack' },
  { key: 'serif', label: 'fontSerif' },
  { key: 'monospace', label: 'fontMono' },
] as const;

export const PANEL_FONT_STYLES = [
  { key: 'normal', label: 'textStyleNormal', sample: 'Aa' },
  { key: 'italic', label: 'textStyleItalic', sample: 'Aa' },
] as const;

export const PANEL_TEXT_CASES = [
  { key: 'none', label: 'textCaseNormal', sample: 'Hello world' },
  { key: 'uppercase', label: 'textCaseUppercase', sample: 'Hello world' },
  { key: 'capitalize', label: 'textCaseTitle', sample: 'Hello world' },
] as const;

export const PANEL_TEXT_COLORS = [
  '#ffffff', '#1A1530', '#F87171', '#FB923C', '#FBBF24',
  '#A3E635', '#34D399', '#22D3EE', '#60A5FA', '#A78BFA', '#F472B6',
] as const;

export function defaultPanelOverlayColor(type: PanelOverlay['type']) {
  return type === 'bubble' ? '#1A1530' : '#ffffff';
}

export function resolvePanelFontFamily(family = 'Satoshi-Medium'): string {
  if (family === 'serif') return Platform.OS === 'ios' ? 'Georgia' : 'serif';
  if (family === 'monospace') return Platform.OS === 'ios' ? 'Courier' : 'monospace';
  return family;
}

export function panelOverlayColor(overlay: PanelOverlay): string {
  // Older bubbles stored a white color even though all readers rendered them
  // dark. Only the new explicit textColor should change their appearance.
  return overlay.textColor ?? (overlay.type === 'bubble'
    ? defaultPanelOverlayColor('bubble')
    : overlay.color ?? defaultPanelOverlayColor(overlay.type));
}

export function panelOverlayTextStyle(overlay: PanelOverlay, fontSize?: number): TextStyle {
  return {
    fontFamily: resolvePanelFontFamily(overlay.fontFamily),
    fontSize: fontSize ?? overlay.fontSize ?? 13,
    fontStyle: overlay.fontStyle ?? 'normal',
    textTransform: overlay.textTransform ?? 'none',
    color: panelOverlayColor(overlay),
  };
}

interface Props extends Omit<TextProps, 'children'> {
  overlay: PanelOverlay;
  fontSize?: number;
  fallbackText?: string;
}

export function PanelOverlayText({ overlay, fontSize, fallbackText, style, ...props }: Props) {
  return (
    <Text {...props} style={[style, panelOverlayTextStyle(overlay, fontSize)]}>
      {overlay.content || fallbackText}
    </Text>
  );
}