/**
 * Snow Team access for someone already on the landscaping team.
 *
 * Same account, separate Snow code and separate approval: entering the code
 * only files a request, and landscaping access is never changed by it.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ScreenHeader, Input, Button, InlineNotice, LoadingSpinner } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useMySnowStatus, lookupSnowCode, requestSnowAccess, withdrawMySnowRequest, snowServiceLabel } from '@/hooks/useSnowOnboarding';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export default function WorkerSnowAccessScreen() {
  const { colors } = useTheme();
  const { refreshContext } = useAuth();
  const { status, loading, reload } = useMySnowStatus();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const member = status?.member?.status === 'active' ? status.member : null;
  const request = status?.request ?? null;

  async function handleSubmit() {
    setError('');
    setBusy(true);
    try {
      const check = await lookupSnowCode(code);
      if (!check.valid) {
        setError('That Snow code doesn’t work. Ask the owner for the current one.');
        return;
      }
      const res = await requestSnowAccess(code);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCode('');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw() {
    setBusy(true);
    try {
      await withdrawMySnowRequest();
      await reload();
    } finally {
      setBusy(false);
    }
  }

  let body: React.ReactNode;
  if (loading) {
    body = <LoadingSpinner />;
  } else if (member) {
    body = (
      <>
        <InlineNotice icon="check-circle" tone="success" text="You're on the snow team." />
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
          Snow work: {member.services.map(snowServiceLabel).join(', ')}
        </Text>
        <Button title="Refresh My Access" variant="secondary" icon="refresh-cw" onPress={() => refreshContext()} />
      </>
    );
  } else if (request?.status === 'pending') {
    body = (
      <>
        <InlineNotice icon="clock" tone="warning" text="Your snow request is waiting for the owner to approve it." />
        <Button title="Withdraw Request" variant="ghost" icon="x" loading={busy} onPress={handleWithdraw} />
      </>
    );
  } else {
    body = (
      <>
        {request?.status === 'declined' && (
          <InlineNotice
            icon="x-circle"
            tone="error"
            text={`Your last snow request wasn't approved${request.declineReason ? `: ${request.declineReason}` : '.'}`}
          />
        )}
        {status?.member?.status === 'revoked' && (
          <InlineNotice icon="info" tone="neutral" text="Your snow access was removed. You can ask again with a Snow code." />
        )}
        <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
          Working snow this winter? Enter the Snow code from the owner. It sends a request with this same account; your
          landscaping access doesn't change.
        </Text>
        <Input
          label="Snow Code"
          placeholder="e.g. SNOW-7KQ4HM"
          value={code}
          onChangeText={(v) => { setCode(v.toUpperCase()); setError(''); }}
          autoCapitalize="characters"
          icon="hash"
        />
        {error ? <InlineNotice icon="alert-circle" tone="error" text={error} /> : null}
        <Button title="Send Snow Request" icon="send" loading={busy} disabled={!code.trim()} onPress={handleSubmit} />
      </>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <ScreenHeader title="Snow Team" subtitle="Winter snow crew access" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
});
