import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useCustomers } from '@/hooks/useCustomers';
import { SearchBar, EmptyState, Avatar, StatusBadge } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export default function CustomersListScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const { customers } = useCustomers({ search });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.titleRow}>
          <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Customers</Text>
          <Pressable
            onPress={() => router.push('/(owner)/customers/new')}
            style={[styles.addButton, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={22} color={colors.textOnPrimary} />
          </Pressable>
        </View>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search customers..."
          style={styles.searchBar}
        />
      </View>

      {customers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="user"
            title={search ? 'No matching customers' : 'No customers yet'}
            description={search ? 'Try a different search.' : 'Tap + to add your first customer.'}
          />
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.person.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.customerCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
              onPress={() => router.push(`/(owner)/customers/${item.person.id}` as any)}
            >
              <Avatar firstName={item.person.firstName} lastName={item.person.lastName} size={44} uri={item.person.avatarUrl} />
              <View style={styles.customerInfo}>
                <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '500' }]}>
                  {item.person.firstName} {item.person.lastName}
                </Text>
                <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                  {item.activeProjectCount > 0
                    ? `${item.activeProjectCount} active project${item.activeProjectCount > 1 ? 's' : ''}`
                    : `${item.totalProjectCount} total project${item.totalProjectCount !== 1 ? 's' : ''}`}
                  {' · '}{item.person.phone ?? item.person.email}
                </Text>
              </View>
              <StatusBadge
                label={item.member.status === 'active' ? 'Active' : item.member.status === 'invited' ? 'Invited' : 'Inactive'}
                status={item.member.status === 'active' ? 'success' : item.member.status === 'invited' ? 'info' : 'neutral'}
              />
              <Feather name="chevron-right" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
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
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  customerInfo: { flex: 1 },
});
