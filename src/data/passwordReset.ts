/**
 * Forgot password. Sends a reset link to the person's email; the link opens the web page (/reset-password),
 * where they choose a new password. Needs Supabase's email sending to be set up (a custom sender such as Resend);
 * until then the request fails with a polite message that points to support.
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { config } from '@/lib/config';
import { looksLikeEmail, newPasswordError, newPasswordProblem, resetRedirectUrl, resetRequestError } from '@/lib/passwordReset';

export type Result = { ok: true } | { ok: false; error: string };

/** Emails the reset link. Says "sent" for any address that looks right, so nobody can probe which emails have accounts. */
export async function requestPasswordReset(email: string): Promise<Result> {
  if (!looksLikeEmail(email)) return { ok: false, error: 'Enter the email address you signed up with.' };
  if (!isSupabaseConfigured) return { ok: false, error: 'Password reset needs the live database, which is not connected in this version of the app.' };
  try {
    const options = config.webUrl ? { redirectTo: resetRedirectUrl(config.webUrl) } : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), options);
    if (error) return { ok: false, error: resetRequestError(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: resetRequestError(err) };
  }
}

/** Saves the new password for the person who opened the reset link (they are signed in by the link). */
export async function setNewPassword(password: string, confirm: string): Promise<Result> {
  const problem = newPasswordProblem(password, confirm);
  if (problem) return { ok: false, error: problem };
  if (!isSupabaseConfigured) return { ok: false, error: 'Password reset needs the live database.' };
  try {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) return { ok: false, error: newPasswordError('session missing') };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, error: newPasswordError(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: newPasswordError(err) };
  }
}
