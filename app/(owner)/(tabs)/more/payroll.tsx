import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { Avatar } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { usePayroll, type PayrollEstimate } from '@/hooks/useOperations';
import { localDateKey } from '@/lib/ids';

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatMoney(amount: number): string {
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PayrollScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getPayrollEstimates, getRatesForWorker, overtimeRule, setHourlyRate } = usePayroll();

  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);

  const referenceDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return localDateKey(d);
  }, [weekOffset]);

  const estimates = useMemo(
    () => getPayrollEstimates(referenceDate),
    [getPayrollEstimates, referenceDate],
  );

  const weekRange = useMemo(() => {
    if (estimates.length > 0) return { start: estimates[0].weekStart, end: estimates[0].weekEnd };
    return { start: referenceDate, end: referenceDate };
  }, [estimates, referenceDate]);

  const totalPay = useMemo(
    () => estimates.reduce((sum, e) => sum + e.totalPay, 0),
    [estimates],
  );

  const totalHours = useMemo(
    () => estimates.reduce((sum, e) => sum + e.regularHours + e.overtimeHours, 0),
    [estimates],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.borderLight }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1, textAlign: 'center' }]}>
          Payroll Estimate
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.weekNav, { borderBottomColor: colors.borderLight }]}>
        <Pressable onPress={() => setWeekOffset((w) => w - 1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Previous week">
          <Icon name="chevron-left" size={24} color={colors.primary} />
        </Pressable>
        <View style={styles.weekLabelWrap}>
          <Text style={[typeScale.labelLarge, { color: colors.textPrimary }]}>
            {formatDate(weekRange.start)} – {formatDate(weekRange.end)}
          </Text>
          {weekOffset === 0 && (
            <Text style={[typeScale.caption, { color: colors.primary }]}>This Week</Text>
          )}
        </View>
        <Pressable onPress={() => setWeekOffset((w) => w + 1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Next week">
          <Icon name="chevron-right" size={24} color={weekOffset >= 0 ? colors.textTertiary : colors.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryRow, { gap: spacing.md }]}>
          <View style={[styles.summaryCard, { backgroundColor: colors.primarySurface }, shadow.sm]}>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>ESTIMATED TOTAL</Text>
            <Text style={[typeScale.displaySmall, { color: colors.primary }]}>
              {formatMoney(totalPay)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface }, shadow.sm]}>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>TOTAL HOURS</Text>
            <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>
              {formatHours(totalHours)}
            </Text>
          </View>
        </View>

        {overtimeRule.isActive && (
          <View style={[styles.otBanner, { backgroundColor: colors.infoLight }]}>
            <Icon name="info" size={14} color={colors.info} />
            <Text style={[typeScale.caption, { color: colors.info, flex: 1 }]}>
              Overtime: {overtimeRule.overtimeMultiplier}x after {overtimeRule.weeklyThresholdHours ?? 40}h/week
            </Text>
          </View>
        )}

        <View style={[styles.disclaimer, { backgroundColor: colors.warningLight }]}>
          <Icon name="alert-triangle" size={14} color={colors.warning} />
          <Text style={[typeScale.caption, { color: colors.textSecondary, flex: 1 }]}>
            These are estimates based on tracked hours and current rates. Not a substitute for professional payroll processing.
          </Text>
        </View>

        {estimates.map((est) => (
          <PayrollCard
            key={est.personId}
            estimate={est}
            rateHistory={getRatesForWorker(est.personId)}
            onSetRate={(rate) => setHourlyRate(est.personId, rate)}
            expanded={expandedWorker === est.personId}
            onToggle={() =>
              setExpandedWorker((prev) => (prev === est.personId ? null : est.personId))
            }
            colors={colors}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function PayrollCard({
  estimate,
  rateHistory,
  onSetRate,
  expanded,
  onToggle,
  colors,
}: {
  estimate: PayrollEstimate;
  rateHistory: any[];
  onSetRate: (rate: number) => void;
  expanded: boolean;
  onToggle: () => void;
  colors: any;
}) {
  const [rateDraft, setRateDraft] = useState('');

  function handleSaveRate() {
    const rate = Number(rateDraft.replace(/[^0-9.]/g, ''));
    if (!rateDraft.trim() || !Number.isFinite(rate) || rate <= 0) {
      const msg = 'Enter an hourly rate, like 22 or 22.50.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Check the rate', msg);
      return;
    }
    onSetRate(Math.round(rate * 100) / 100);
    setRateDraft('');
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }, shadow.sm]}>
      <Pressable style={styles.cardHeader} onPress={onToggle}>
        <Avatar
          firstName={estimate.worker.firstName}
          lastName={estimate.worker.lastName}
          size={40}
          uri={estimate.worker.avatarUrl}
        />
        <View style={styles.cardInfo}>
          <Text style={[typeScale.labelLarge, { color: colors.textPrimary }]}>
            {estimate.worker.firstName} {estimate.worker.lastName}
          </Text>
          <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
            {formatHours(estimate.regularHours + estimate.overtimeHours)} · ${estimate.regularRate}/hr
          </Text>
        </View>
        <Text style={[typeScale.headingLarge, { color: colors.primary }]}>
          {formatMoney(estimate.totalPay)}
        </Text>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textTertiary}
          style={{ marginLeft: spacing.sm }}
        />
      </Pressable>

      {expanded && (
        <View style={[styles.cardBody, { borderTopColor: colors.borderLight }]}>
          <View style={styles.payBreakdown}>
            <View style={styles.payRow}>
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>Regular hours</Text>
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                {formatHours(estimate.regularHours)}
              </Text>
            </View>
            <View style={styles.payRow}>
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>Rate</Text>
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                ${estimate.regularRate.toFixed(2)}/hr
              </Text>
            </View>
            <View style={styles.payRow}>
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>Regular pay</Text>
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                {formatMoney(estimate.regularPay)}
              </Text>
            </View>

            {estimate.overtimeHours > 0 && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
                <View style={styles.payRow}>
                  <Text style={[typeScale.bodySmall, { color: colors.warning }]}>Overtime hours</Text>
                  <Text style={[typeScale.bodySmall, { color: colors.warning }]}>
                    {formatHours(estimate.overtimeHours)}
                  </Text>
                </View>
                <View style={styles.payRow}>
                  <Text style={[typeScale.bodySmall, { color: colors.warning }]}>OT rate</Text>
                  <Text style={[typeScale.bodySmall, { color: colors.warning }]}>
                    ${estimate.overtimeRate.toFixed(2)}/hr
                  </Text>
                </View>
                <View style={styles.payRow}>
                  <Text style={[typeScale.bodySmall, { color: colors.warning }]}>Overtime pay</Text>
                  <Text style={[typeScale.bodySmall, { color: colors.warning }]}>
                    {formatMoney(estimate.overtimePay)}
                  </Text>
                </View>
              </>
            )}

            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.payRow}>
              <Text style={[typeScale.labelLarge, { color: colors.textPrimary }]}>Total estimate</Text>
              <Text style={[typeScale.labelLarge, { color: colors.primary }]}>
                {formatMoney(estimate.totalPay)}
              </Text>
            </View>
          </View>

          <View style={[styles.rateHistory, { borderTopColor: colors.borderLight }]}>
            <Text style={[typeScale.overline, { color: colors.textTertiary, marginBottom: spacing.sm }]}>
              {rateHistory.length === 0 ? 'SET PAY RATE' : 'CHANGE PAY RATE (FROM TODAY)'}
            </Text>
            <View style={styles.rateInputRow}>
              <Text style={[typeScale.bodyLarge, { color: colors.textSecondary }]}>$</Text>
              <TextInput
                value={rateDraft}
                onChangeText={setRateDraft}
                placeholder={estimate.regularRate ? estimate.regularRate.toFixed(2) : '0.00'}
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                style={[styles.rateInput, { color: colors.textPrimary, borderColor: colors.border }]}
                accessibilityLabel="Hourly rate"
              />
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>/hr</Text>
              <Pressable onPress={handleSaveRate} style={[styles.rateSave, { backgroundColor: colors.primary }]} accessibilityRole="button">
                <Text style={[typeScale.labelSmall, { color: '#FFFFFF', fontWeight: '600' }]}>Save</Text>
              </Pressable>
            </View>
          </View>

          {rateHistory.length > 1 && (
            <View style={[styles.rateHistory, { borderTopColor: colors.borderLight }]}>
              <Text style={[typeScale.overline, { color: colors.textTertiary, marginBottom: spacing.sm }]}>
                RATE HISTORY
              </Text>
              {rateHistory.map((r) => (
                <View key={r.id} style={styles.rateRow}>
                  <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                    {new Date(r.effectiveDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {r.endDate && ` – ${new Date(r.endDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    {!r.endDate && ' – Present'}
                  </Text>
                  <Text style={[typeScale.labelSmall, { color: colors.textPrimary }]}>
                    ${r.hourlyRate.toFixed(2)}/hr
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  weekLabelWrap: { alignItems: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing['5xl'], gap: spacing.md },
  summaryRow: { flexDirection: 'row' },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  otBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  card: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardInfo: { flex: 1 },
  cardBody: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1 },
  payBreakdown: { gap: spacing.xs },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing['2xs'] },
  divider: { height: 1, marginVertical: spacing.sm },
  rateHistory: { borderTopWidth: 1, marginTop: spacing.md, paddingTop: spacing.md },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  rateInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rateInput: { flex: 1, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16 },
  rateSave: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm },
});
