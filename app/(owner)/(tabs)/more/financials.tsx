/**
 * Owner → More → Quotes & Invoices: every quote, change order and invoice
 * across all projects, for finding and managing documents. Each project's
 * full history lives in its own Financials section; this is the overview.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { Button, SearchBar, FilterChips, ListSection, EmptyState, LoadingSpinner } from '@/components/ui';
import { DocumentRow } from '@/components/financials/DocumentRow';
import { useTheme } from '@/providers/ThemeProvider';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useFinancialDocs } from '@/hooks/useFinancials';
import { db } from '@/data/store';
import { displayStatus } from '@/data/financials';
import { formatMoney, sumMoney } from '@/lib/money';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import type { FinancialDoc } from '@/types/financial';

type Filter = 'all' | 'awaiting' | 'approved' | 'drafts' | 'invoices';

function matches(doc: FinancialDoc, f: Filter): boolean {
  const s = displayStatus(doc);
  switch (f) {
    case 'awaiting': return doc.kind !== 'invoice' && s === 'sent';
    case 'approved': return doc.kind !== 'invoice' && s === 'approved';
    case 'drafts': return s === 'draft';
    case 'invoices': return doc.kind === 'invoice';
    default: return true;
  }
}

export default function FinancialsOverviewScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clearance = useTabBarClearance();
  const docs = useFinancialDocs();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const awaiting = docs.filter((d) => matches(d, 'awaiting'));
  const issued = docs.filter((d) => d.kind === 'invoice' && d.status === 'issued');
  const drafts = docs.filter((d) => d.status === 'draft');

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (!matches(d, filter)) return false;
      if (!q) return true;
      const customer = d.customer ? `${d.customer.firstName} ${d.customer.lastName}` : '';
      return [d.number, d.projectName, customer, d.title].some((x) => x?.toLowerCase().includes(q));
    });
  }, [docs, search, filter]);

  const options: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'awaiting', label: 'Awaiting Approval', count: awaiting.length },
    { key: 'approved', label: 'Approved' },
    { key: 'drafts', label: 'Drafts', count: drafts.length },
    { key: 'invoices', label: 'Invoices' },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.groupedBackground }]}>
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to More">
          <Icon name="chevron-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Quotes & Invoices</Text>
      </View>

      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: clearance + spacing['3xl'] + 56 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tiles}>
          <Pressable onPress={() => setFilter('awaiting')} style={[styles.tile, { backgroundColor: colors.surface }, shadow.sm]} accessibilityRole="button">
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Awaiting approval</Text>
            <Text style={[typeScale.headingLarge, styles.num, { color: colors.textPrimary }]}>{awaiting.length}</Text>
            <Text style={[typeScale.bodySmall, styles.num, { color: colors.textSecondary }]}>{formatMoney(sumMoney(awaiting.map((d) => d.total)))}</Text>
          </Pressable>
          <Pressable onPress={() => setFilter('invoices')} style={[styles.tile, { backgroundColor: colors.surface }, shadow.sm]} accessibilityRole="button">
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Issued invoices</Text>
            <Text style={[typeScale.headingLarge, styles.num, { color: colors.textPrimary }]}>{issued.length}</Text>
            <Text style={[typeScale.bodySmall, styles.num, { color: colors.textSecondary }]}>{formatMoney(sumMoney(issued.map((d) => d.total)))}</Text>
          </Pressable>
        </View>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by customer, project or number" />
        <FilterChips options={options} selected={filter} onSelect={setFilter} style={{ paddingVertical: spacing.sm }} />

        {!db.ready ? (
          <LoadingSpinner />
        ) : list.length === 0 ? (
          <EmptyState
            icon="file-text"
            title={docs.length === 0 ? 'No quotes or invoices yet' : 'Nothing matches'}
            description={docs.length === 0 ? 'Create a quote from any project to get started.' : 'Try a different search or filter.'}
          />
        ) : (
          <ListSection style={{ marginTop: spacing.sm }}>
            {list.map((d) => (
              <DocumentRow
                key={d.id}
                doc={d}
                showProject
                onPress={() => router.push({ pathname: '/(owner)/document', params: { kind: d.kind, id: d.id } } as any)}
                onProjectPress={() => router.push(`/(owner)/projects/${d.projectId}` as any)}
              />
            ))}
          </ListSection>
        )}
      </KeyboardAwareScrollView>

      <View style={[styles.fab, { bottom: clearance + spacing.sm }]} pointerEvents="box-none">
        <Button
          title="Create Quote or Invoice"
          icon="plus"
          onPress={() => router.push('/(owner)/document-new' as any)}
          style={shadow.md}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 32, height: 32, justifyContent: 'center', marginLeft: -spacing.xs, marginBottom: spacing.xs },
  tiles: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  tile: { flex: 1, borderRadius: radius.xl, padding: spacing.md, gap: 2 },
  num: { fontVariant: ['tabular-nums'] },
  fab: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
