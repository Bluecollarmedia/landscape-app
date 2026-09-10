import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { Card, ProgressBar, LoadingSpinner } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { useStorageInfo } from '@/hooks/useStorage';
import { formatBytes } from '@/types/storage';

export default function StorageScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { info, loading, error, refresh } = useStorageInfo();

  if (loading && !info) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Header colors={colors} insets={insets} onBack={() => router.back()} />
        <LoadingSpinner />
      </View>
    );
  }

  const usage = info?.usage;
  const settings = info?.settings;

  const usagePercent = usage?.percentUsed ?? 0;
  const usageColor = usagePercent > 90
    ? semantic.error
    : usagePercent > 75
      ? semantic.warning
      : colors.primary;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Header colors={colors} insets={insets} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: semantic.errorLight }]}>
            <Feather name="alert-circle" size={16} color={semantic.error} />
            <Text style={[typeScale.caption, { color: semantic.error, flex: 1, marginLeft: spacing.sm }]}>
              {error}
            </Text>
            <Pressable onPress={refresh}>
              <Text style={[typeScale.labelSmall, { color: semantic.error }]}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Usage Overview */}
        <Card title="Storage Usage" style={styles.card}>
          <View style={styles.usageHeader}>
            <View style={[styles.usageIcon, { backgroundColor: usageColor + '15' }]}>
              <Feather name="hard-drive" size={24} color={usageColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.headingLarge, { color: colors.textPrimary }]}>
                {formatBytes(usage?.totalBytes ?? 0)}
              </Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                of {formatBytes(settings?.maxStorageBytes ?? 0)} used
              </Text>
            </View>
            <View style={[styles.percentBadge, { backgroundColor: usageColor + '15' }]}>
              <Text style={[typeScale.labelSmall, { color: usageColor, fontWeight: '700' }]}>
                {usagePercent}%
              </Text>
            </View>
          </View>

          <ProgressBar
            progress={usagePercent}
            color={usageColor}
            style={{ marginTop: spacing.md }}
          />

          {usagePercent > 90 && (
            <View style={[styles.warningBanner, { backgroundColor: semantic.errorLight }]}>
              <Feather name="alert-triangle" size={14} color={semantic.error} />
              <Text style={[typeScale.caption, { color: semantic.error, flex: 1, marginLeft: spacing.xs }]}>
                Storage is almost full. Delete unused files or increase your quota.
              </Text>
            </View>
          )}
        </Card>

        {/* File Breakdown */}
        <Card title="File Breakdown" style={styles.card}>
          <StatRow
            icon="image"
            label="Project Photos"
            value={String(usage?.photoCount ?? 0)}
            colors={colors}
          />
          <StatRow
            icon="user"
            label="Profile Photos"
            value={String(usage?.avatarCount ?? 0)}
            colors={colors}
          />
          <StatRow
            icon="file"
            label="Documents"
            value={String(usage?.documentCount ?? 0)}
            colors={colors}
          />
          <View style={[styles.divider, { borderTopColor: colors.borderLight }]} />
          <StatRow
            icon="database"
            label="Total Files"
            value={String(usage?.fileCount ?? 0)}
            colors={colors}
            bold
          />
        </Card>

        {/* Storage Limits */}
        <Card title="Storage Limits" style={styles.card}>
          <LimitRow
            label="Storage Quota"
            value={formatBytes(settings?.maxStorageBytes ?? 0)}
            colors={colors}
          />
          <LimitRow
            label="Max File Size"
            value={formatBytes(settings?.maxFileSizeBytes ?? 0)}
            colors={colors}
          />
          <LimitRow
            label="Upload Rate"
            value={`${settings?.rateLimitPerMinute ?? 0}/min, ${settings?.rateLimitPerHour ?? 0}/hr`}
            colors={colors}
          />
        </Card>

        {/* Allowed File Types */}
        <Card title="Allowed File Types" style={styles.card}>
          <View style={styles.typeGrid}>
            {['JPEG', 'PNG', 'WebP', 'HEIC'].map(type => (
              <View key={type} style={[styles.typeChip, { backgroundColor: colors.primarySurface }]}>
                <Feather name="check" size={12} color={colors.primary} />
                <Text style={[typeScale.caption, { color: colors.primary, marginLeft: 4 }]}>
                  {type}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Info */}
        <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Feather name="shield" size={16} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '500' }]}>
              Secure Storage
            </Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              All uploads are validated server-side. Files are stored in Cloudflare R2 with
              signed URLs. Storage credentials never leave the server.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Header({ colors, insets, onBack }: { colors: any; insets: any; onBack: () => void }) {
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Feather name="arrow-left" size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>
        Storage
      </Text>
    </View>
  );
}

function StatRow({ icon, label, value, colors, bold }: {
  icon: string; label: string; value: string; colors: any; bold?: boolean;
}) {
  return (
    <View style={styles.statRow}>
      <Feather name={icon as any} size={16} color={colors.textTertiary} />
      <Text style={[
        bold ? typeScale.bodyLarge : typeScale.bodySmall,
        { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm },
        bold && { fontWeight: '600' },
      ]}>
        {label}
      </Text>
      <Text style={[
        bold ? typeScale.bodyLarge : typeScale.bodySmall,
        { color: colors.textPrimary },
        bold && { fontWeight: '600' },
      ]}>
        {value}
      </Text>
    </View>
  );
}

function LimitRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.limitRow}>
      <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '500' }]}>
        {value}
      </Text>
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  card: { marginBottom: spacing.lg },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xs,
    marginBottom: spacing.md,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  usageIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.xs,
    marginTop: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: 1,
    marginVertical: spacing.xs,
  },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
});
