import React from 'react';
import { SettingsRow, tileColors } from '@/components/settings/SettingsList';
import { confirmAction } from '@/components/financials/ActionSheet';
import { useCompanyMode } from '@/hooks/useModeAccess';

/**
 * The owner's switch between Landscaping Mode and Snow Mode, as a settings
 * row. Shown in Landscaping Settings and in the Snow Mode More tab. Nothing
 * is deleted or merged when switching; each mode keeps its own records.
 */
/** The switch's wording and confirmation, for screens that draw the row themselves (the Snow More screen). */
export function useModeSwitch() {
  const { mode, canSwitch, setMode } = useCompanyMode();
  const toSnow = mode === 'landscaping';
  const title = toSnow ? 'Switch to Snow Mode' : 'Switch to Landscaping Mode';
  const subtitle = toSnow
    ? 'Opens the snow dashboard for you and your snow crew'
    : 'Goes back to projects, maintenance and the landscaping crew';

  function confirm() {
    confirmAction(
      title,
      toSnow
        ? 'You and your workers switch to Snow Mode. Every worker gets snow access automatically (no sign-up) and sees a small Snow / Landscaping switch at the top right of their phone. You can still remove snow access from any worker in the Snow team; they then see a "Snow Mode is on" screen. Landscaping records stay as they are.'
        : 'You and your workers will switch back to the landscaping app. Snow-only workers stay in Snow Mode. Snow records stay as they are.',
      'Switch',
      () => setMode(toSnow ? 'snow' : 'landscaping'),
    );
  }

  return { canSwitch, toSnow, title, subtitle, icon: (toSnow ? 'cloud-snow' : 'sun') as 'cloud-snow' | 'sun', confirm };
}

export function ModeSwitchRow() {
  const m = useModeSwitch();
  if (!m.canSwitch) return null;
  return (
    <SettingsRow
      icon={m.icon}
      tint={m.toSnow ? tileColors.blue : tileColors.green}
      title={m.title}
      subtitle={m.subtitle}
      onPress={m.confirm}
    />
  );
}
