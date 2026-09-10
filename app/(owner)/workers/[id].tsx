import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorkers } from '@/hooks/useWorkers';
import { useSchedule } from '@/hooks/useSchedule';
import { Card, StatusBadge, Avatar, Divider, Button } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { mockProjects, mockTeam } from '@/data/mock';

const today = new Date().toISOString().split('T')[0];

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const confirmLabel = (state: string) => {
  if (state === 'confirmed') return { label: 'Confirmed', status: 'success' as const };
  if (state === 'awaiting') return { label: 'Awaiting', status: 'warning' as const };
  if (state === 'updated_since') return { label: 'Updated', status: 'info' as const };
  return { label: 'Not Sent', status: 'neutral' as const };
};

export default function WorkerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getWorker, updateWorker } = useWorkers({ includeInactive: true });
  const schedule = useSchedule();

  const worker = getWorker(id);

  if (!worker) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={[typeScale.bodyLarge, { color: colors.textSecondary }]}>Worker not found</Text>
        </View>
      </View>
    );
  }

  const w = worker;
  const p = w.person;

  const assignedProjects = mockProjects.filter((proj) =>
    Object.values(mockTeam).some(
      (team) => team.some((tm) => tm.personId === p.id && tm.projectId === proj.id),
    ),
  );

  const todayAssignments = schedule.getByWorker(p.id, today);
  const tomorrowAssignments = schedule.getByWorker(p.id, offsetDate(1));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>
          Worker Profile
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
              label={w.member.status === 'active' ? 'Active' : 'Inactive'}
              status={w.member.status === 'active' ? 'success' : 'error'}
            />
          </View>
        </View>

        <View style={styles.content}>
          <Card title="Contact" style={styles.card}>
            <DetailRow icon="mail" label="Email" value={p.email} colors={colors} />
            <DetailRow icon="phone" label="Phone" value={p.phone ?? '—'} colors={colors} />
          </Card>

          <Card title="Today's Schedule" style={styles.card}>
            {todayAssignments.length > 0 ? (
              todayAssignments.map((a) => {
                const timeStr = a.isFullDay ? 'Full Day' : `${a.startTime}–${a.endTime}`;
                const badge = confirmLabel(a.confirmationState);
                return (
                  <Pressable
                    key={a.id}
                    style={[styles.scheduleItem, { borderBottomColor: colors.borderLight }]}
                    onPress={() => router.push(`/(owner)/projects/${a.projectId}` as any)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '500' }]}>
                        {a.project?.name}
                      </Text>
                      <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                        {timeStr}{a.truck ? ` · ${a.truck.name}` : ''}
                      </Text>
                    </View>
                    <StatusBadge label={badge.label} status={badge.status} />
                  </Pressable>
                );
              })
            ) : (
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                Not scheduled today
              </Text>
            )}
            <View style={{ marginTop: spacing.sm }}>
              <Button
                title="Schedule Work"
                onPress={() => router.push(`/(owner)/more/schedule-create?workerId=${p.id}&date=${today}` as any)}
                variant="secondary"
                size="sm"
                icon="plus"
              />
            </View>
          </Card>

          {tomorrowAssignments.length > 0 && (
            <Card title="Tomorrow" style={styles.card}>
              {tomorrowAssignments.map((a) => {
                const timeStr = a.isFullDay ? 'Full Day' : `${a.startTime}–${a.endTime}`;
                return (
                  <View key={a.id} style={styles.scheduleItemSimple}>
                    <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                      {a.project?.name}
                    </Text>
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                      {timeStr}{a.truck ? ` · ${a.truck.name}` : ''}
                    </Text>
                  </View>
                );
              })}
            </Card>
          )}

          <Card title="Project Team" style={styles.card}>
            {assignedProjects.length > 0 ? (
              assignedProjects.map((proj) => (
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
                    label={proj.status === 'active' ? 'Active' : proj.status}
                    status={proj.status === 'active' ? 'success' : 'neutral'}
                  />
                </Pressable>
              ))
            ) : (
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>
                No projects assigned
              </Text>
            )}
          </Card>

          <Card title="Details" style={styles.card}>
            <DetailRow icon="calendar" label="Hired" value={new Date(w.member.createdAt).toLocaleDateString()} colors={colors} />
            <DetailRow icon="briefcase" label="Role" value="Worker" colors={colors} />
          </Card>

          {w.member.status === 'active' ? (
            <Button
              title="Deactivate Worker"
              variant="secondary"
              fullWidth
              icon="user-x"
              onPress={() => {
                const doDeactivate = () => {
                  updateWorker(p.id, { status: 'inactive' });
                  router.back();
                };
                if (Platform.OS === 'web') {
                  if (confirm(`Deactivate ${p.firstName} ${p.lastName}? They will lose access but historical records will be preserved.`)) {
                    doDeactivate();
                  }
                } else {
                  Alert.alert(
                    'Deactivate Worker',
                    `${p.firstName} ${p.lastName} will lose access. Historical records (hours, payroll, attendance) will be preserved.`,
                    [{ text: 'Cancel', style: 'cancel' }, { text: 'Deactivate', style: 'destructive', onPress: doDeactivate }],
                  );
                }
              }}
              style={{ marginBottom: spacing.lg }}
            />
          ) : (
            <View style={[styles.deactivatedBanner, { backgroundColor: semantic.errorLight }]}>
              <Feather name="alert-circle" size={16} color={semantic.error} />
              <Text style={[typeScale.bodySmall, { color: semantic.error, flex: 1, marginLeft: spacing.sm }]}>
                This worker has been deactivated. Historical records are preserved.
              </Text>
            </View>
          )}
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
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  scheduleItemSimple: { paddingVertical: spacing.xs },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  deactivatedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
  },
});
