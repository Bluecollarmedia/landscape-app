import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Platform, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSchedule } from '@/hooks/useSchedule';
import { Card, StatusBadge, Input, Button, Avatar } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { semantic } from '@/theme/colors';
import { mockMembers, mockProjects, mockTrucks } from '@/data/mock';

const today = new Date().toISOString().split('T')[0];

function offsetDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const t = new Date(today + 'T12:00:00');
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function ScheduleCreateScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    workerId?: string;
    projectId?: string;
    date?: string;
    moveFrom?: string;
  }>();

  const schedule = useSchedule();

  const activeWorkers = useMemo(() =>
    mockMembers.filter(m => m.role === 'worker' && m.status === 'active'),
  []);
  const activeProjects = useMemo(() =>
    mockProjects.filter(p => p.status === 'active'),
  []);
  const availableTrucks = useMemo(() =>
    mockTrucks.filter(t => t.status !== 'out_of_service'),
  []);

  const [workerId, setWorkerId] = useState(params.workerId ?? '');
  const [projectId, setProjectId] = useState(params.projectId ?? '');
  const [date, setDate] = useState(params.date ?? today);
  const [isFullDay, setIsFullDay] = useState(false);
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:00');
  const [truckId, setTruckId] = useState('');
  const [notes, setNotes] = useState('');
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showTruckPicker, setShowTruckPicker] = useState(false);

  const selectedWorker = activeWorkers.find(w => w.personId === workerId);
  const selectedProject = activeProjects.find(p => p.id === projectId);
  const selectedTruck = availableTrucks.find(t => t.id === truckId);

  const conflicts = useMemo(() => {
    if (!workerId || !date) return [];
    return schedule.detectConflicts({
      personId: workerId,
      scheduledDate: date,
      startTime: isFullDay ? undefined : startTime,
      endTime: isFullDay ? undefined : endTime,
      isFullDay,
      truckId: truckId || undefined,
    });
  }, [workerId, date, isFullDay, startTime, endTime, truckId, schedule]);

  const timeConflicts = conflicts.filter(c => c.type === 'time_overlap');
  const truckConflicts = conflicts.filter(c => c.type === 'truck_overlap');

  function handleCreate() {
    if (!workerId || !projectId) {
      const msg = 'Please select a worker and a project.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Required', msg);
      return;
    }

    if (params.moveFrom) {
      schedule.moveWorker(params.moveFrom, projectId, notes || undefined);
    } else {
      schedule.createAssignment({
        personId: workerId,
        projectId,
        scheduledDate: date,
        startTime: isFullDay ? undefined : startTime,
        endTime: isFullDay ? undefined : endTime,
        isFullDay,
        truckId: truckId || undefined,
        notes: notes || undefined,
      });
    }

    router.back();
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="x" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>
          {params.moveFrom ? 'Move Worker' : 'Create Assignment'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Worker */}
        <Text style={[typeScale.labelLarge, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
          Worker *
        </Text>
        <Pressable
          style={[styles.selector, { borderColor: colors.borderLight, backgroundColor: colors.surface }]}
          onPress={() => { setShowWorkerPicker(!showWorkerPicker); setShowProjectPicker(false); setShowTruckPicker(false); }}
        >
          {selectedWorker?.person ? (
            <View style={styles.selectedRow}>
              <Avatar firstName={selectedWorker.person.firstName} lastName={selectedWorker.person.lastName} size={28} uri={selectedWorker.person.avatarUrl} />
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                {selectedWorker.person.firstName} {selectedWorker.person.lastName}
              </Text>
            </View>
          ) : (
            <Text style={[typeScale.bodySmall, { color: colors.textTertiary }]}>Select worker...</Text>
          )}
          <Feather name={showWorkerPicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
        </Pressable>
        {showWorkerPicker && (
          <View style={[styles.pickerList, { borderColor: colors.borderLight, backgroundColor: colors.surface }]}>
            {activeWorkers.map(w => (
              <Pressable
                key={w.personId}
                style={[styles.pickerItem, w.personId === workerId && { backgroundColor: colors.primarySurface }]}
                onPress={() => { setWorkerId(w.personId); setShowWorkerPicker(false); }}
              >
                <Avatar firstName={w.person!.firstName} lastName={w.person!.lastName} size={24} uri={w.person!.avatarUrl} />
                <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
                  {w.person!.firstName} {w.person!.lastName}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Project */}
        <Text style={[typeScale.labelLarge, { color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
          {params.moveFrom ? 'New Project *' : 'Project *'}
        </Text>
        <Pressable
          style={[styles.selector, { borderColor: colors.borderLight, backgroundColor: colors.surface }]}
          onPress={() => { setShowProjectPicker(!showProjectPicker); setShowWorkerPicker(false); setShowTruckPicker(false); }}
        >
          {selectedProject ? (
            <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>{selectedProject.name}</Text>
          ) : (
            <Text style={[typeScale.bodySmall, { color: colors.textTertiary }]}>Select project...</Text>
          )}
          <Feather name={showProjectPicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
        </Pressable>
        {showProjectPicker && (
          <View style={[styles.pickerList, { borderColor: colors.borderLight, backgroundColor: colors.surface }]}>
            {activeProjects.map(p => (
              <Pressable
                key={p.id}
                style={[styles.pickerItem, p.id === projectId && { backgroundColor: colors.primarySurface }]}
                onPress={() => { setProjectId(p.id); setShowProjectPicker(false); }}
              >
                <View>
                  <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>{p.name}</Text>
                  <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{p.address}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {!params.moveFrom && (
          <>
            {/* Date */}
            <Text style={[typeScale.labelLarge, { color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
              Date
            </Text>
            <View style={styles.dateRow}>
              <Pressable onPress={() => setDate(offsetDateStr(date, -1))}>
                <Feather name="chevron-left" size={22} color={colors.textPrimary} />
              </Pressable>
              <Pressable onPress={() => setDate(today)} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[typeScale.bodySmall, { color: colors.textPrimary, fontWeight: '600' }]}>
                  {formatDateLabel(date)}
                </Text>
                <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{date}</Text>
              </Pressable>
              <Pressable onPress={() => setDate(offsetDateStr(date, 1))}>
                <Feather name="chevron-right" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            {/* Time */}
            <Text style={[typeScale.labelLarge, { color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
              Time
            </Text>
            <View style={styles.fullDayRow}>
              <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>Full Day</Text>
              <Switch value={isFullDay} onValueChange={setIsFullDay} />
            </View>
            {!isFullDay && (
              <View style={styles.timeRow}>
                <Input
                  label="Start"
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="07:00"
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="End"
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="15:00"
                  containerStyle={{ flex: 1 }}
                />
              </View>
            )}

            {/* Truck */}
            <Text style={[typeScale.labelLarge, { color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
              Truck (optional)
            </Text>
            <Pressable
              style={[styles.selector, { borderColor: colors.borderLight, backgroundColor: colors.surface }]}
              onPress={() => { setShowTruckPicker(!showTruckPicker); setShowWorkerPicker(false); setShowProjectPicker(false); }}
            >
              {selectedTruck ? (
                <View style={styles.selectedRow}>
                  <Feather name="truck" size={16} color={colors.textSecondary} />
                  <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>{selectedTruck.name}</Text>
                </View>
              ) : (
                <Text style={[typeScale.bodySmall, { color: colors.textTertiary }]}>No truck assigned</Text>
              )}
              <Feather name={showTruckPicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
            </Pressable>
            {showTruckPicker && (
              <View style={[styles.pickerList, { borderColor: colors.borderLight, backgroundColor: colors.surface }]}>
                <Pressable
                  style={[styles.pickerItem, !truckId && { backgroundColor: colors.primarySurface }]}
                  onPress={() => { setTruckId(''); setShowTruckPicker(false); }}
                >
                  <Text style={[typeScale.bodySmall, { color: colors.textTertiary }]}>None</Text>
                </Pressable>
                {availableTrucks.map(t => (
                  <Pressable
                    key={t.id}
                    style={[styles.pickerItem, t.id === truckId && { backgroundColor: colors.primarySurface }]}
                    onPress={() => { setTruckId(t.id); setShowTruckPicker(false); }}
                  >
                    <View style={styles.selectedRow}>
                      <Feather name="truck" size={14} color={colors.textSecondary} />
                      <View>
                        <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>{t.name}</Text>
                        <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
                          {t.make} {t.model} · {t.status}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}

        {/* Instructions */}
        <Input
          label="Instructions (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes for the worker..."
          multiline
          numberOfLines={3}
          containerStyle={{ marginTop: spacing.lg }}
        />

        {/* Conflict Warnings */}
        {timeConflicts.length > 0 && (
          <View style={[styles.conflictBox, { backgroundColor: semantic.warningLight, borderColor: semantic.warning }]}>
            <View style={styles.conflictHeader}>
              <Feather name="alert-triangle" size={16} color={semantic.warning} />
              <Text style={[typeScale.labelLarge, { color: colors.textPrimary }]}>Time Conflict</Text>
            </View>
            {timeConflicts.map(c => (
              <Text key={c.assignment.id} style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                {c.message}
              </Text>
            ))}
            <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: spacing.sm }]}>
              You can still create this assignment — both will exist on the schedule.
            </Text>
          </View>
        )}

        {truckConflicts.length > 0 && (
          <View style={[styles.conflictBox, { backgroundColor: semantic.warningLight, borderColor: semantic.warning }]}>
            <View style={styles.conflictHeader}>
              <Feather name="truck" size={16} color={semantic.warning} />
              <Text style={[typeScale.labelLarge, { color: colors.textPrimary }]}>Truck Conflict</Text>
            </View>
            {truckConflicts.map(c => (
              <Text key={c.assignment.id} style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                {c.message}
              </Text>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title={params.moveFrom ? 'Move Worker' : 'Create Assignment'}
            onPress={handleCreate}
            icon={params.moveFrom ? 'arrow-right-circle' : 'plus'}
            fullWidth
          />
          <Button
            title="Cancel"
            onPress={() => router.back()}
            variant="ghost"
            fullWidth
          />
        </View>
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
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['5xl'] },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pickerList: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    maxHeight: 240,
  },
  pickerItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fullDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  conflictBox: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    marginTop: spacing.lg,
  },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
});
