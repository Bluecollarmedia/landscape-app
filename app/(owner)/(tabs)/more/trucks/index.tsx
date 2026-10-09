import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useTrucks } from '@/hooks/useTrucks';
import { StatusBadge, OptimizedImage } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import type { TruckStatus } from '@/types/truck';

const STATUS_MAP: Record<TruckStatus, { label: string; status: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  available: { label: 'Available', status: 'success' },
  assigned: { label: 'Assigned', status: 'info' },
  maintenance: { label: 'Maintenance', status: 'warning' },
  out_of_service: { label: 'Out of Service', status: 'error' },
};

export default function TrucksScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { trucks, counts } = useTrucks();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]}>Trucks</Text>
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>Manage your vehicles and equipment</Text>
        </View>
        <Pressable
          onPress={() => router.push('/(owner)/more/trucks/new' as any)}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Add truck"
        >
          <Icon name="plus" size={20} color={colors.textOnPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }, shadow.sm]}>
            <View style={[styles.statIcon, { backgroundColor: colors.primarySurface }]}>
              <Icon name="truck" size={18} color={colors.primary} />
            </View>
            <Text style={[typeScale.headingLarge, { color: colors.textPrimary, fontWeight: '700' }]}>{counts.all}</Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }, shadow.sm]}>
            <View style={[styles.statIcon, { backgroundColor: colors.primarySurface }]}>
              <Icon name="check" size={18} color={colors.primary} />
            </View>
            <Text style={[typeScale.headingLarge, { color: colors.textPrimary, fontWeight: '700' }]}>{counts.available + counts.assigned}</Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Ready</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }, shadow.sm]}>
            <View style={[styles.statIcon, { backgroundColor: semantic.warningLight }]}>
              <Icon name="tool" size={18} color={semantic.warning} />
            </View>
            <Text style={[typeScale.headingLarge, { color: colors.textPrimary, fontWeight: '700' }]}>{counts.maintenance}</Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Maintenance</Text>
          </View>
        </View>

        {trucks.map((truck) => {
          const badge = STATUS_MAP[truck.status];
          return (
            <Pressable
              key={truck.id}
              style={({ pressed }) => [styles.truckCard, { backgroundColor: colors.surface }, shadow.sm, pressed && { opacity: 0.92 }]}
              onPress={() => router.push(`/(owner)/more/trucks/${truck.id}` as any)}
            >
              {truck.photoUrl ? (
                <OptimizedImage source={truck.photoUrl} style={styles.truckPhoto} />
              ) : (
                <View style={[styles.truckPhoto, styles.truckPhotoPlaceholder, { backgroundColor: colors.backgroundTertiary }]}>
                  <Icon name="truck" size={22} color={colors.textTertiary} />
                </View>
              )}

              <View style={styles.truckInfo}>
                <View style={styles.truckTopRow}>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700', flexShrink: 1, marginRight: spacing.sm }]} numberOfLines={1}>
                    {truck.name}
                  </Text>
                  <StatusBadge label={badge.label} status={badge.status} />
                </View>
                {(truck.year || truck.make || truck.model) && (
                  <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
                    {[truck.year, truck.make, truck.model].filter(Boolean).join(' ')}
                  </Text>
                )}
                {truck.licensePlate && (
                  <View style={[styles.plateChip, { backgroundColor: colors.backgroundTertiary }]}>
                    <Icon name="hash" size={10} color={colors.textTertiary} />
                    <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: 3 }]}>{truck.licensePlate}</Text>
                  </View>
                )}
                {truck.assigneeName && (
                  <View style={styles.detailRow}>
                    <Icon name="user" size={11} color={colors.textTertiary} />
                    <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: 4 }]} numberOfLines={1}>
                      Assigned to {truck.assigneeName}
                    </Text>
                  </View>
                )}
                {truck.notes && (
                  <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: 2, fontStyle: 'italic' }]} numberOfLines={1}>
                    {truck.notes}
                  </Text>
                )}
              </View>

              <Icon name="chevron-right" size={18} color={colors.textTertiary} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  backButton: { padding: spacing.xs },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['5xl'] },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  truckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  truckPhoto: {
    width: 76,
    height: 76,
    borderRadius: radius.sm,
  },
  truckPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  truckInfo: { flex: 1, gap: 2 },
  truckTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
});
