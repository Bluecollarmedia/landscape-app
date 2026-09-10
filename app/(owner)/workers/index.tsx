import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorkers, WorkerTodayStatus } from '@/hooks/useWorkers';
import { SearchBar, FilterChips, EmptyState, Avatar, StatusBadge } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

type FilterKey = WorkerTodayStatus | 'all';

const STATUS_BADGE: Record<WorkerTodayStatus, { label: string; status: 'success' | 'warning' | 'neutral' | 'error' }> = {
  confirmed: { label: 'Confirmed', status: 'success' },
  scheduled: { label: 'Scheduled', status: 'warning' },
  not_scheduled: { label: 'Off Today', status: 'neutral' },
  inactive: { label: 'Inactive', status: 'error' },
};

export default function WorkersListScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');

  const { workers, counts } = useWorkers({
    search,
    statusFilter: statusFilter === 'all' ? undefined : statusFilter,
    includeInactive: true,
  });

  const filterOptions: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'confirmed', label: 'Confirmed', count: counts.confirmed },
    { key: 'scheduled', label: 'Scheduled', count: counts.scheduled },
    { key: 'not_scheduled', label: 'Off Today', count: counts.not_scheduled },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.titleRow}>
          <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Workers</Text>
          <Pressable
            onPress={() => router.push('/(owner)/workers/new')}
            style={[styles.addButton, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={22} color={colors.textOnPrimary} />
          </Pressable>
        </View>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search workers..."
          style={styles.searchBar}
        />
        <FilterChips
          options={filterOptions}
          selected={statusFilter}
          onSelect={setStatusFilter}
        />
      </View>

      {workers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="users"
            title={search ? 'No matching workers' : 'No workers yet'}
            description={search ? 'Try a different search.' : 'Tap + to add your first worker.'}
          />
        </View>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(item) => item.person.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const badge = STATUS_BADGE[item.todayStatus];
            return (
              <Pressable
                style={[styles.workerCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                onPress={() => router.push(`/(owner)/workers/${item.person.id}` as any)}
              >
                <Avatar firstName={item.person.firstName} lastName={item.person.lastName} size={44} uri={item.person.avatarUrl} />
                <View style={styles.workerInfo}>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '500' }]}>
                    {item.person.firstName} {item.person.lastName}
                  </Text>
                  <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                    {item.todayProject
                      ? `${item.todayProject}${item.todayTruck ? ` · ${item.todayTruck}` : ''}`
                      : item.person.phone ?? item.person.email}
                  </Text>
                </View>
                <StatusBadge label={badge.label} status={badge.status} />
                <Feather name="chevron-right" size={18} color={colors.textTertiary} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: { marginBottom: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  workerInfo: { flex: 1 },
});
