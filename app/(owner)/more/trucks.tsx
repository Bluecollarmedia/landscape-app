import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useTrucks } from '@/hooks/useTrucks';
import { Card, StatusBadge, Button, Input } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
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
  const { trucks, counts, addTruck } = useTrucks();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMake, setNewMake] = useState('');
  const [newModel, setNewModel] = useState('');

  function handleAdd() {
    if (!newName.trim()) {
      if (Platform.OS === 'web') alert('Please enter a truck name.');
      else Alert.alert('Required', 'Please enter a truck name.');
      return;
    }
    addTruck({
      companyId: 'company1',
      name: newName,
      make: newMake || undefined,
      model: newModel || undefined,
      status: 'available',
    });
    setNewName('');
    setNewMake('');
    setNewModel('');
    setShowAdd(false);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>Trucks</Text>
        <Pressable
          onPress={() => setShowAdd(!showAdd)}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={20} color={colors.textOnPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={[styles.statChip, { backgroundColor: colors.primarySurface }]}>
            <Text style={[typeScale.headingSmall, { color: colors.primary }]}>{counts.all}</Text>
            <Text style={[typeScale.caption, { color: colors.primary }]}>Total</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: colors.primarySurface }]}>
            <Text style={[typeScale.headingSmall, { color: colors.primary }]}>{counts.available + counts.assigned}</Text>
            <Text style={[typeScale.caption, { color: colors.primary }]}>Ready</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: colors.primarySurface }]}>
            <Text style={[typeScale.headingSmall, { color: colors.primary }]}>{counts.maintenance}</Text>
            <Text style={[typeScale.caption, { color: colors.primary }]}>Maintenance</Text>
          </View>
        </View>

        {showAdd && (
          <Card title="Add Truck" style={styles.addCard}>
            <Input label="Name" placeholder="Truck #5" value={newName} onChangeText={setNewName} containerStyle={styles.fieldGap} />
            <View style={styles.row}>
              <Input label="Make" placeholder="Ford" value={newMake} onChangeText={setNewMake} containerStyle={{ ...styles.fieldGap, flex: 1 }} />
              <Input label="Model" placeholder="F-250" value={newModel} onChangeText={setNewModel} containerStyle={{ ...styles.fieldGap, flex: 1 }} />
            </View>
            <View style={styles.addActions}>
              <Button title="Add Truck" onPress={handleAdd} icon="plus" size="sm" />
              <Button title="Cancel" onPress={() => setShowAdd(false)} variant="ghost" size="sm" />
            </View>
          </Card>
        )}

        {trucks.map((truck) => {
          const badge = STATUS_MAP[truck.status];
          return (
            <Card key={truck.id} style={styles.truckCard}>
              <View style={styles.truckHeader}>
                <View style={[styles.truckIcon, { backgroundColor: colors.primarySurface }]}>
                  <Feather name="truck" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>
                    {truck.name}
                  </Text>
                  {(truck.make || truck.model) && (
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                      {[truck.year, truck.make, truck.model].filter(Boolean).join(' ')}
                    </Text>
                  )}
                </View>
                <StatusBadge label={badge.label} status={badge.status} />
              </View>
              {truck.licensePlate && (
                <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
                  Plate: {truck.licensePlate}
                </Text>
              )}
              {truck.assigneeName && (
                <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                  Assigned to {truck.assigneeName}
                </Text>
              )}
              {truck.notes && (
                <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.xs, fontStyle: 'italic' }]}>
                  {truck.notes}
                </Text>
              )}
            </Card>
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
  statChip: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  addCard: { marginBottom: spacing.lg },
  fieldGap: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  addActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  truckCard: { marginBottom: spacing.sm },
  truckHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  truckIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
