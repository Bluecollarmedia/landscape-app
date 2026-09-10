import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useCustomers } from '@/hooks/useCustomers';
import { Card, StatusBadge, Avatar, Divider } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { mockProjects } from '@/data/mock';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getCustomer } = useCustomers();

  const customer = getCustomer(id);

  if (!customer) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary }]}>Customer not found</Text>
        </View>
      </View>
    );
  }

  const c = customer;
  const p = c.person;

  const customerProjects = mockProjects.filter((proj) => proj.customerId === p.id);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>
          Customer Profile
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <Avatar firstName={p.firstName} lastName={p.lastName} size={72} uri={p.avatarUrl} />
          <Text style={[typeScale.displaySmall, { color: colors.textPrimary, marginTop: spacing.md }]}>
            {p.firstName} {p.lastName}
          </Text>
          <View style={{ marginTop: spacing.xs }}>
            <StatusBadge
              label={c.member.status === 'active' ? 'Active' : c.member.status === 'invited' ? 'Invited' : 'Inactive'}
              status={c.member.status === 'active' ? 'success' : c.member.status === 'invited' ? 'info' : 'neutral'}
            />
          </View>
        </View>

        <View style={styles.content}>
          <Card title="Contact" style={styles.card}>
            <DetailRow icon="mail" label="Email" value={p.email} colors={colors} />
            <DetailRow icon="phone" label="Phone" value={p.phone ?? '—'} colors={colors} />
          </Card>

          <Card title={`Projects (${customerProjects.length})`} style={styles.card}>
            {customerProjects.length > 0 ? (
              customerProjects.map((proj) => (
                <Pressable
                  key={proj.id}
                  style={[styles.projectItem, { borderBottomColor: colors.borderLight }]}
                  onPress={() => router.push(`/(owner)/projects/${proj.id}` as any)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '500' }]}>
                      {proj.name}
                    </Text>
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                      {proj.address} · {proj.progress}%
                    </Text>
                  </View>
                  <StatusBadge
                    label={proj.status.replace('_', ' ')}
                    status={proj.status === 'active' ? 'success' : proj.status === 'completed' ? 'info' : 'warning'}
                  />
                </Pressable>
              ))
            ) : (
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                No projects yet
              </Text>
            )}
          </Card>

          <Card title="Account" style={styles.card}>
            <DetailRow icon="calendar" label="Since" value={new Date(c.member.createdAt).toLocaleDateString()} colors={colors} />
            <DetailRow
              icon="eye"
              label="Access"
              value={c.member.status === 'active' ? 'Can view projects' : c.member.status === 'invited' ? 'Pending invite' : 'No access'}
              colors={colors}
            />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: any }) {
  return (
    <View style={styles.detailRow}>
      <Feather name={icon as any} size={16} color={colors.textTertiary} />
      <Text style={[typeScale.caption, { color: colors.textTertiary, width: 60 }]}>{label}</Text>
      <Text style={[typeScale.bodySmall, { color: colors.textPrimary, flex: 1 }]}>{value}</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: spacing['5xl'] },
  profileHeader: { alignItems: 'center', paddingVertical: spacing.xl },
  content: { paddingHorizontal: spacing.lg },
  card: { marginBottom: spacing.lg },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
});
