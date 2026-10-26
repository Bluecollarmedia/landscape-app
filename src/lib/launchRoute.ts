/**
 * Where a SIGNED-OUT visitor belongs at launch. Pure: no React, no network.
 *
 * With the public Weather experience OFF this is exactly the app's original behavior: everything except the sign-in area goes to the
 * welcome screen. Only when Weather is ON do signed-out visitors go to /weather instead. Signed-in people never use this.
 */

/**
 * The Weather experience does not exist yet. While this is false the app behaves as if Weather were OFF, whatever the server says. It is
 * flipped to true only in a later phase that has been approved on its own.
 */
export const WEATHER_EXPERIENCE_BUILT = false;

export type SignedOutDestination = '/(auth)/welcome' | '/weather';

/** The place a signed-out visitor should be moved to, or null to leave them where they are. */
export function signedOutRedirect(input: { firstSegment: string | undefined; weatherOn: boolean }): SignedOutDestination | null {
  const inAuth = input.firstSegment === '(auth)';
  if (input.weatherOn) return inAuth || input.firstSegment === 'weather' ? null : '/weather';
  return inAuth ? null : '/(auth)/welcome';
}

/** What the app treats as "Weather is on": the answer AND the experience actually being built. */
export const effectiveWeatherOn = (built: boolean, decided: boolean): boolean => built && decided;
