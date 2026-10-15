/**
 * Owner view of a maintenance route's day starts: who started at the yard,
 * when, whether their phone placed them there, and who hasn't started. The
 * owner can set a start time for someone who forgot to tap (or tapped late);
 * the worker's own time is kept on the record and shown next to the fix.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { Avatar, ListSection } from '@/components/ui';
import { NoteField } from '@/components/financials/FormBits';
import { showMessage } from '@/components/financials/ActionSheet';
import { FormSheet, SheetLabel } from '@/components/materials/FormSheet';
import { useTheme } from '@/providers/ThemeProvider';
import { useRouteAttendance, type RouteAttendanceRow } from '@/hooks/useMaintenance';
import { correctAttendance } from '@/data/maintenance';
import { yardLocationLabel } from '@/lib/maintenanceCheckIn';
import { typeScale } from '@/theme/typography';
import { spacing, radius, sizing } from '@/theme/spacing';

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const pad = (n: number) => String(n).padStart(2, '0');

type Tone = 'ok' | 'warn' | 'missing';

function describe(row: RouteAttendanceRow): { title: string; detail?: string; tone: Tone } {
  const a = row.attendance;
  if (!a) return { title: 'Not started', detail: 'No Start Day check-in', tone: 'missing' };
  if (a.source === 'owner_correction' || a.correctedAt) {
    const was = a.originalStartedAt ? `Worker’s time ${clock(a.originalStartedAt)}` : 'Worker didn’t start the day';
    return { title: `Started ${clock(a.startedAt)}`, detail: `Set by office · ${was}${a.correctionNote ? ` · “${a.correctionNote}”` : ''}`, tone: 'warn' };
  }
  const verified = a.locationStatus === 'verified';
  return { title: `Started ${clock(a.startedAt)}`, detail: yardLocationLabel(a.locationStatus), tone: verified ? 'ok' : 'warn' };
}

export function CrewAttendanceList({ routeId, serviceDate, canCorrect = true }: { routeId: string; serviceDate: string; canCorrect?: boolean }) {
  const { colors } = useTheme();
  const rows = useRouteAttendance(routeId);
  const [fixing, setFixing] = useState<RouteAttendanceRow | null>(null);

  if (rows.length === 0) {
    return (
      <ListSection title="DAY START">
        <Text style={[typeScale.bodySmall, styles.empty, { color: colors.textSecondary }]}>No crew assigned to this route yet.</Text>
      </ListSection>
    );
  }

  const started = rows.filter((r) => r.attendance).length;

  return (
    <>
      <ListSection title={`DAY START · ${started} OF ${rows.length}`}>
        {rows.map((row, i) => {
          const d = describe(row);
          const name = row.person ? `${row.person.firstName} ${row.person.lastName}` : 'Unknown worker';
          const toneColor = d.tone === 'ok' ? colors.primaryDark : d.tone === 'warn' ? colors.warning : colors.textTertiary;
          const icon = d.tone === 'ok' ? 'check-circle' : d.tone === 'warn' ? 'alert-circle' : 'circle';
          return (
            <View
              key={row.personId}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
              accessibilityLabel={`${name}${row.isLead ? ', Maintenance Lead' : ''}. ${d.title}. ${d.detail ?? ''}`}
            >
              <Avatar firstName={row.person?.firstName ?? '?'} lastName={row.person?.lastName ?? ''} uri={row.person?.avatarUrl} size={36} />
              <View style={styles.text}>
                <View style={styles.nameLine}>
                  <Text style={[typeScale.labelLarge, { color: colors.textPrimary, flexShrink: 1 }]} numberOfLines={1}>{name}</Text>
                  {row.isLead && (
                    <View style={[styles.lead, { backgroundColor: colors.primarySurface }]}>
                      <Text style={[typeScale.labelSmall, { color: colors.primaryDark }]}>Lead</Text>
                    </View>
                  )}
                </View>
                <View style={styles.statusLine}>
                  <Feather name={icon} size={13} color={toneColor} />
                  <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>{d.title}</Text>
                </View>
                {d.detail && <Text style={[typeScale.caption, { color: colors.textSecondary }]} numberOfLines={2}>{d.detail}</Text>}
              </View>
              {canCorrect && (
                <Pressable
                  onPress={() => setFixing(row)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.fix, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Fix start time for ${name}`}
                >
                  <Text style={[typeScale.labelLarge, { color: colors.primaryDark }]}>{row.attendance ? 'Fix' : 'Add'}</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ListSection>
      <AttendanceFixSheet row={fixing} serviceDate={serviceDate} onClose={() => setFixing(null)} />
    </>
  );
}

function AttendanceFixSheet({ row, serviceDate, onClose }: { row: RouteAttendanceRow | null; serviceDate: string; onClose: () => void }) {
  const { colors } = useTheme();
  const [at, setAt] = useState(new Date());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    const [y, m, d] = serviceDate.split('-').map(Number);
    const base = row.attendance ? new Date(row.attendance.startedAt) : new Date(y, m - 1, d, 7, 0);
    setAt(new Date(y, m - 1, d, base.getHours(), base.getMinutes()));
    setNote('');
  }, [row, serviceDate]);

  const setTime = (h: number, min: number) => {
    const [y, m, d] = serviceDate.split('-').map(Number);
    setAt(new Date(y, m - 1, d, h, min));
  };

  const save = async () => {
    if (!row || saving) return;
    if (!note.trim()) { showMessage('Add a note', 'Say why you’re changing the start time, e.g. “Forgot to tap at the yard, was there at 7.”'); return; }
    if (at.getTime() > Date.now()) { showMessage('Pick an earlier time', 'The start time can’t be in the future.'); return; }
    setSaving(true);
    const res = await correctAttendance(row.personId, serviceDate, at, note);
    setSaving(false);
    if (!res.ok) { showMessage('Couldn’t save', res.error); return; }
    onClose();
  };

  const name = row?.person ? `${row.person.firstName} ${row.person.lastName}` : 'this worker';
  let control: React.ReactNode;
  if (Platform.OS === 'web') {
    control = React.createElement('input', {
      type: 'time',
      value: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
      onChange: (e: { target: { value: string } }) => { const [h, mi] = e.target.value.split(':').map(Number); if (!isNaN(h) && !isNaN(mi)) setTime(h, mi); },
      style: { font: 'inherit', fontSize: 16, border: 0, background: 'transparent', color: colors.textPrimary, textAlign: 'right' },
      'aria-label': 'Start time',
    });
  } else {
    control = (
      <DateTimePicker value={at} mode="time" display={Platform.OS === 'ios' ? 'compact' : 'default'} accentColor={colors.primary}
        onChange={(_e, d) => d && setTime(d.getHours(), d.getMinutes())} />
    );
  }

  return (
    <FormSheet visible={!!row} title="Day Start" saveLabel={saving ? 'Saving…' : 'Save'} onSave={save} onClose={onClose}>
      <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md, marginHorizontal: spacing.xs }]}>
        {row?.attendance
          ? `${name} tapped Start Day at ${clock(row.attendance.originalStartedAt ?? row.attendance.startedAt)}. That time stays on record next to yours.`
          : `${name} didn’t tap Start Day. Your time is saved as set by the office, not GPS verified.`}
      </Text>
      <SheetLabel>START TIME</SheetLabel>
      <ListSection>
        <View style={styles.pickRow}>
          <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, flex: 1 }]}>Started at</Text>
          {control}
        </View>
      </ListSection>
      <ListSection title="REASON (REQUIRED)">
        <NoteField label="Reason" placeholder="e.g. Forgot to tap at the yard" value={note} onChangeText={setNote} />
      </ListSection>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: sizing.touchTarget },
  text: { flex: 1, minWidth: 0, gap: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  lead: { paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.full },
  fix: { paddingHorizontal: spacing.sm, minHeight: sizing.touchTarget, justifyContent: 'center' },
  empty: { padding: spacing.md },
  pickRow: { flexDirection: 'row', alignItems: 'center', minHeight: sizing.touchTarget, paddingHorizontal: spacing.md },
});
