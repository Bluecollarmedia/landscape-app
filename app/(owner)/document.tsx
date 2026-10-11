/**
 * One quote / change order / invoice: the finished document as the customer
 * will see it, plus what can be done with it next (edit a draft, send,
 * record the customer's answer, share the PDF, invoice it…).
 *
 * Sits above the tab navigator (see (owner)/_layout.tsx) so it opens from the
 * company-wide overview, a project's Financials, or a notification without
 * switching tabs.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { Button, StatusBadge, EmptyState, LoadingSpinner } from '@/components/ui';
import { DocumentPreview } from '@/components/financials/DocumentPreview';
import { ActionSheet, confirmAction, showMessage, type SheetAction } from '@/components/financials/ActionSheet';
import { useTheme } from '@/providers/ThemeProvider';
import { useFinancialDoc } from '@/hooks/useFinancials';
import { usePdfShare } from '@/hooks/usePdfShare';
import { renderDocumentHtml, formatDocDateTime } from '@/lib/documentHtml';
import { formatMoney } from '@/lib/money';
import {
  DOC_LABEL, STATUS_LABEL, STATUS_TONE, displayStatus, snapshotFor, templateOptionsFor,
  getDoc, markSent, issueInvoice, recordResponse, markExpired, voidInvoice, deleteDraft, duplicateAsDraft, readinessProblems,
} from '@/data/financials';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import type { FinancialDocType, FinancialEvent } from '@/types/financial';

const EVENT_LABEL: Record<FinancialEvent['eventType'], string> = {
  created: 'Created',
  sent: 'Marked as sent',
  approved: 'Approved',
  declined: 'Declined',
  expired: 'Marked expired',
  issued: 'Issued',
  voided: 'Voided',
};

export default function DocumentScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: FinancialDocType; id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { doc, events, project, ready } = useFinancialDoc(kind, id);
  const { share, busy } = usePdfShare();
  const [menu, setMenu] = useState<'more' | 'respond' | 'history' | null>(null);

  const html = useMemo(
    () => (doc ? renderDocumentHtml(doc, snapshotFor(doc), { mode: 'preview', ...templateOptionsFor(doc) }) : ''),
    [doc, events],
  );

  if (!doc) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.groupedBackground, paddingTop: insets.top }]}>
        <TopBar title="" onBack={() => router.back()} />
        {ready ? (
          <EmptyState icon="file-text" title="Document not found" description="It may have been deleted." />
        ) : (
          <LoadingSpinner />
        )}
      </View>
    );
  }

  const status = displayStatus(doc);
  const label = DOC_LABEL[doc.kind];
  const isDraft = doc.status === 'draft';
  const customerName = doc.customer ? `${doc.customer.firstName} ${doc.customer.lastName}`.trim() : 'No customer';

  const edit = () => router.push({ pathname: '/(owner)/document-edit', params: { kind: doc.kind, id: doc.id, from: 'document' } } as any);

  const checkReady = () => {
    const problems = readinessProblems(doc);
    if (problems.length) {
      showMessage(`Finish this ${label.toLowerCase()} first`, problems.join('\n'));
      return false;
    }
    return true;
  };

  const send = (thenShare: boolean) => {
    if (!checkReady()) return;
    const doIt = () => {
      if (doc.kind === 'invoice') issueInvoice(doc.id);
      else markSent(doc.kind, doc.id);
      if (thenShare) {
        // Share the locked version (status + frozen customer details).
        setTimeout(() => {
          const fresh = getDoc(doc.kind, doc.id);
          if (fresh) share(fresh);
        }, 50);
      }
    };
    confirmAction(
      doc.kind === 'invoice' ? `Issue ${doc.number}?` : `Mark ${doc.number} as sent?`,
      `Its line items and ${formatMoney(doc.total)} total will be locked. To change it later, you'll duplicate it as a new draft.`,
      doc.kind === 'invoice' ? 'Issue' : 'Mark Sent',
      doIt,
    );
  };

  const shareTapped = () => {
    if (!isDraft) return share(doc);
    confirmAction(
      'Share this draft?',
      `Drafts are marked “DRAFT” on the PDF. To send the final ${label.toLowerCase()}, use ${doc.kind === 'invoice' ? 'Issue & Share' : 'Send & Share'}.`,
      'Share Draft',
      () => share(doc),
    );
  };

  const duplicate = () => {
    const copy = duplicateAsDraft(doc.kind, doc.id);
    if (copy) router.replace({ pathname: '/(owner)/document-edit', params: { kind: copy.kind, id: copy.id } } as any);
  };

  const moreActions: SheetAction[] = [
    { key: 'pdf', label: isDraft ? 'Share Draft PDF' : 'Share PDF', icon: 'share-2', onPress: shareTapped },
    ...(doc.kind === 'quote' && doc.status === 'approved'
      ? [
          { key: 'co', label: 'New Change Order', icon: 'layers' as const, onPress: () => router.push({ pathname: '/(owner)/document-new', params: { kind: 'change_order', projectId: doc.projectId, quoteId: doc.id } } as any) },
          { key: 'inv', label: 'Create Invoice', icon: 'dollar-sign' as const, onPress: () => router.push({ pathname: '/(owner)/document-new', params: { kind: 'invoice', projectId: doc.projectId, quoteId: doc.id } } as any) },
        ]
      : []),
    ...(doc.kind === 'quote' && doc.status === 'sent'
      ? [{ key: 'expire', label: 'Mark Expired', icon: 'clock' as const, onPress: () => confirmAction('Mark as expired?', 'The customer will no longer be able to approve it.', 'Mark Expired', () => markExpired(doc.id)) }]
      : []),
    { key: 'history', label: 'History', icon: 'clock', onPress: () => setMenu('history') },
    { key: 'project', label: 'View Project Financials', icon: 'briefcase', onPress: () => router.push(`/(owner)/projects/${doc.projectId}?section=financials` as any) },
    ...(!isDraft ? [{ key: 'dup', label: 'Duplicate as New Draft', icon: 'copy' as const, onPress: duplicate }] : []),
    ...(doc.kind === 'invoice' && doc.status === 'issued'
      ? [{ key: 'void', label: 'Void Invoice', icon: 'slash' as const, destructive: true, onPress: () => confirmAction(`Void ${doc.number}?`, 'It stays on record marked VOID. This can’t be undone.', 'Void', () => voidInvoice(doc.id), true) }]
      : []),
    ...(isDraft
      ? [{ key: 'delete', label: 'Delete Draft', icon: 'trash-2' as const, destructive: true, onPress: () => confirmAction(`Delete ${doc.number}?`, 'This draft will be removed.', 'Delete', () => { deleteDraft(doc.kind, doc.id); router.back(); }, true) }]
      : []),
  ];

  // Primary actions for the bottom bar.
  let primary: React.ReactNode = null;
  if (isDraft) {
    primary = (
      <>
        <Button title="Edit" variant="secondary" icon="edit-2" onPress={edit} style={styles.flex} />
        <Button title={doc.kind === 'invoice' ? 'Issue & Share' : 'Send & Share'} icon="send" onPress={() => send(true)} loading={busy} style={styles.flex2} />
      </>
    );
  } else if ((doc.kind === 'quote' || doc.kind === 'change_order') && doc.status === 'sent' && status !== 'expired') {
    primary = (
      <>
        <Button title="Share" variant="secondary" icon="share-2" onPress={shareTapped} loading={busy} style={styles.flex} />
        <Button title="Record Answer" icon="check-circle" onPress={() => setMenu('respond')} style={styles.flex2} />
      </>
    );
  } else if (doc.kind === 'quote' && doc.status === 'approved') {
    primary = (
      <>
        <Button title="Share" variant="secondary" icon="share-2" onPress={shareTapped} loading={busy} style={styles.flex} />
        <Button
          title="Create Invoice"
          icon="dollar-sign"
          onPress={() => router.push({ pathname: '/(owner)/document-new', params: { kind: 'invoice', projectId: doc.projectId, quoteId: doc.id } } as any)}
          style={styles.flex2}
        />
      </>
    );
  } else {
    primary = <Button title="Share PDF" icon="share-2" onPress={shareTapped} loading={busy} fullWidth />;
  }

  const lastAnswer = [...events].reverse().find((e) => e.eventType === 'approved' || e.eventType === 'declined');

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground, paddingTop: insets.top }]}>
      <TopBar
        title={`${label} ${doc.number}`}
        onBack={() => router.back()}
        right={
          <Pressable onPress={() => setMenu('more')} hitSlop={12} accessibilityRole="button" accessibilityLabel="More actions" style={styles.iconBtn}>
            <Icon name="more-horizontal" size={22} color={colors.textPrimary} />
          </Pressable>
        }
      />

      <Pressable
        onPress={() => router.push(`/(owner)/projects/${doc.projectId}` as any)}
        style={[styles.summary, { backgroundColor: colors.surface, borderBottomColor: colors.separator }]}
        accessibilityRole="button"
        accessibilityLabel={`Open project ${project?.name ?? ''}`}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typeScale.labelLarge, { color: colors.textPrimary }]} numberOfLines={1}>{project?.name ?? doc.projectName ?? 'Project'}</Text>
          <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            {customerName}
            {lastAnswer ? `  ·  ${EVENT_LABEL[lastAnswer.eventType]} ${formatDocDateTime(lastAnswer.createdAt)}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <StatusBadge label={STATUS_LABEL[status]} status={STATUS_TONE[status]} />
          <Text style={[typeScale.labelLarge, { color: colors.textPrimary, fontVariant: ['tabular-nums'] }]}>{formatMoney(doc.total)}</Text>
        </View>
      </Pressable>

      <View style={styles.flex}>
        <DocumentPreview html={html} />
      </View>

      <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.separator, paddingBottom: insets.bottom + spacing.sm }]}>
        {primary}
      </View>

      <ActionSheet visible={menu === 'more'} title={`${label} ${doc.number}`} actions={moreActions} onClose={() => setMenu(null)} />

      <ActionSheet
        visible={menu === 'respond'}
        title="Record the customer's answer"
        message="Use this when the customer answers by phone, email or in person. Customers can also approve in their Brighton app."
        onClose={() => setMenu(null)}
        actions={doc.kind === 'invoice' ? [] : [
          { key: 'yes', label: 'Customer Approved', icon: 'check-circle', onPress: () => confirmAction(`Record ${doc.number} as approved?`, `${formatMoney(doc.total)} will count toward the project's approved amount.`, 'Approved', () => recordResponse(doc.kind as 'quote' | 'change_order', doc.id, true)) },
          { key: 'no', label: 'Customer Declined', icon: 'x-circle', destructive: true, onPress: () => confirmAction(`Record ${doc.number} as declined?`, 'It stays on record as declined.', 'Declined', () => recordResponse(doc.kind as 'quote' | 'change_order', doc.id, false), true) },
        ]}
      />

      <ActionSheet visible={menu === 'history'} title="History" actions={[]} onClose={() => setMenu(null)}>
        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          {events.length === 0 && <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>No history yet.</Text>}
          {events.map((e) => (
            <View key={e.id} style={styles.event}>
              <View style={[styles.dot, { backgroundColor: e.eventType === 'declined' || e.eventType === 'voided' ? colors.error : colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>
                  {EVENT_LABEL[e.eventType]}{e.actor ? ` by ${e.actor.firstName} ${e.actor.lastName}`.trimEnd() : ''}
                </Text>
                <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{formatDocDateTime(e.createdAt)}</Text>
                {!!e.note && <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>{e.note}</Text>}
              </View>
            </View>
          ))}
        </ScrollView>
      </ActionSheet>
    </View>
  );
}

function TopBar({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.topBar, { backgroundColor: colors.surface }]}>
      <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back" style={styles.iconBtn}>
        <Icon name="chevron-left" size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={[typeScale.headingSmall, { color: colors.textPrimary, flex: 1, textAlign: 'center' }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.iconBtn}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  flex2: { flex: 1.6 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, height: 48 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  event: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  dot: { width: 8, height: 8, borderRadius: radius.full, marginTop: 7 },
});
