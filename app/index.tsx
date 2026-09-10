/**
 * App Index — Entry Redirect
 *
 * expo-router needs an index route. The root _layout handles
 * auth-based routing, so this just redirects to the auth group
 * (the layout will bounce authenticated users to their role group).
 */

import { Redirect } from 'expo-router';

export default function AppIndex() {
  return <Redirect href="/(auth)/login" />;
}
