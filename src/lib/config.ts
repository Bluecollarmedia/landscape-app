/**
 * Environment configuration.
 * All client-visible env vars are accessed here — no secrets.
 * Server-side secrets live exclusively in Edge Function environment.
 */

export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  r2PublicUrl: process.env.EXPO_PUBLIC_R2_PUBLIC_URL ?? '',
  /** Where the web app is hosted (e.g. https://app.brightonlawn.com). Approval
   * links point here; without it the app only shares PDFs. */
  webUrl: (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/+$/, ''),

  get isDev() {
    return __DEV__ ?? process.env.NODE_ENV !== 'production';
  },

  get isSupabaseConfigured() {
    return (
      this.supabaseUrl.length > 0 &&
      !this.supabaseUrl.includes('your-project') &&
      this.supabaseAnonKey.length > 0 &&
      !this.supabaseAnonKey.includes('your-anon-key')
    );
  },
} as const;
