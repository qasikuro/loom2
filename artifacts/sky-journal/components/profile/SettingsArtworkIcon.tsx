import React from 'react';
import { Image } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

/* eslint-disable @typescript-eslint/no-require-imports -- Bundled artwork from the supplied icon pack. */
const ARTWORK = {
  messages: require('../../assets/icons/settings/messages.png'),
  floating_chat: require('../../assets/icons/settings/floating_chat.png'),
  privacy: require('../../assets/icons/settings/privacy.png'),
  post_privacy: require('../../assets/icons/settings/post_privacy.png'),
  online_status: require('../../assets/icons/settings/online_status.png'),
  blocked_users: require('../../assets/icons/settings/blocked_users.png'),
  purchase_history: require('../../assets/icons/settings/purchase_history.png'),
  light_mode: require('../../assets/icons/settings/light_mode.png'),
  auto_mode: require('../../assets/icons/settings/auto_mode.png'),
  dark_mode: require('../../assets/icons/settings/dark_mode.png'),
  animation_sounds: require('../../assets/icons/settings/animation_sounds.png'),
  email: require('../../assets/icons/settings/email.png'),
  change_email: require('../../assets/icons/settings/change_email.png'),
  change_password: require('../../assets/icons/settings/change_password.png'),
  delete_account: require('../../assets/icons/settings/delete_account.png'),
  sign_out: require('../../assets/icons/settings/sign_out.png'),
  help_center: require('../../assets/icons/settings/help_center.png'),
  send_feedback: require('../../assets/icons/settings/send_feedback.png'),
  about: require('../../assets/icons/settings/about.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

export type SettingsArtworkName = keyof typeof ARTWORK;

export function SettingsArtworkIcon({ name, fallback, color, size = 20 }: {
  name: SettingsArtworkName;
  fallback: IconName;
  color: string;
  size?: number;
}) {
  const { isDark } = useTheme();
  if (!isDark) return <Icon name={fallback} size={size} color={color} />;
  return <Image source={ARTWORK[name]} resizeMode="contain" accessible={false} style={{ width: size, height: size }} />;
}
