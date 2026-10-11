/**
 * Worker invites by text message (no email service needed).
 *
 * Opens the phone's Messages app with the team code filled in. The worker
 * downloads the app, taps "Join a Team", enters the code, and the owner
 * approves them under Pending Requests.
 */

import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export function inviteMessage(code: string, companyName?: string, workerName?: string): string {
  const hi = workerName?.trim() ? `Hi ${workerName.trim().split(' ')[0]}! ` : '';
  const company = companyName?.trim() || 'our company';
  return (
    `${hi}You're invited to join ${company} on the Brighton Lawn + Landscape app. ` +
    `Open the app, tap "Join a Team" and enter this code: ${code}`
  );
}

/** Opens Messages with the invite filled in (to `phone` if given). Falls back to the share sheet. */
export async function textInvite(message: string, phone?: string): Promise<void> {
  const to = (phone ?? '').replace(/[^\d+]/g, '');
  if (Platform.OS === 'web') {
    await copyText(message);
    return;
  }
  // iOS uses "&body=", Android uses "?body=".
  const url = `sms:${to}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
  } catch {
    await Share.share({ message });
  }
}

export async function copyText(text: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      await (globalThis as { navigator?: { clipboard?: { writeText: (t: string) => Promise<void> } } }).navigator?.clipboard?.writeText(text);
    } catch {}
    return;
  }
  await Clipboard.setStringAsync(text);
}
