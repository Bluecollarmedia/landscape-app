import React from 'react';
import { useRouter } from 'expo-router';
import { ListSection, ListRow } from '@/components/ui';

/** Privacy Policy / Terms of Use / Help & Support rows for any settings screen. */
export function LegalSection() {
  const router = useRouter();
  return (
    <ListSection title="Legal & Support">
      <ListRow icon="shield" title="Privacy Policy" showChevron onPress={() => router.push('/legal/privacy' as any)} />
      <ListRow icon="file-text" title="Terms of Use" showChevron onPress={() => router.push('/legal/terms' as any)} />
      <ListRow icon="help-circle" title="Help & Support" showChevron onPress={() => router.push('/legal/support' as any)} />
    </ListSection>
  );
}
