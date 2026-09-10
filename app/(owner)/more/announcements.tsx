import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { Card, StatusBadge, Button, Input } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import type { WeatherActionType, ScheduleActionType } from '@/types/operations';

const WEATHER_OPTIONS: { key: WeatherActionType | 'none'; label: string; icon: string }[] = [
  { key: 'none', label: 'None', icon: 'message-square' },
  { key: 'weather_warning', label: 'Weather Warning', icon: 'cloud' },
  { key: 'delayed_start', label: 'Delayed Start', icon: 'clock' },
  { key: 'no_work', label: 'No Work Today', icon: 'x-circle' },
  { key: 'early_finish', label: 'Early Finish', icon: 'sunset' },
];

const SCHEDULE_OPTIONS: { key: ScheduleActionType; label: string; icon: string }[] = [
  { key: 'none', label: 'No Change', icon: 'minus' },
  { key: 'cancel_today', label: "Cancel Today's Jobs", icon: 'x' },
  { key: 'delay_today', label: 'Delay Start', icon: 'clock' },
];

export default function AnnouncementsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { announcements, addAnnouncement } = useAnnouncements();
  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [weatherAction, setWeatherAction] = useState<WeatherActionType | 'none'>('none');
  const [scheduleAction, setScheduleAction] = useState<ScheduleActionType>('none');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');

  function handleSend() {
    if (!title.trim() || !body.trim()) {
      if (Platform.OS === 'web') alert('Please enter a title and message.');
      else Alert.alert('Required', 'Please enter a title and message.');
      return;
    }
    addAnnouncement({ title, body, audience: 'all_workers', priority });
    setTitle('');
    setBody('');
    setWeatherAction('none');
    setScheduleAction('none');
    setPriority('normal');
    setShowCompose(false);
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = Math.floor(diffMs / 3600000);
    if (diffHrs < 1) return 'Just now';
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>
          Announcements
        </Text>
        <Pressable
          onPress={() => setShowCompose(!showCompose)}
          style={[styles.composeBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="edit" size={18} color={colors.textOnPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {showCompose && (
          <Card title="New Announcement" style={styles.composeCard}>
            <Input label="Title" placeholder="Announcement title" value={title} onChangeText={setTitle} containerStyle={styles.fieldGap} />
            <Input
              label="Message"
              placeholder="Write your message..."
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={4}
              containerStyle={styles.fieldGap}
            />

            <View style={styles.fieldGap}>
              <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                Priority
              </Text>
              <View style={styles.chipRow}>
                <Pressable
                  style={[styles.optionChip, priority === 'normal' && { backgroundColor: colors.primarySurface, borderColor: colors.primary }, { borderColor: colors.border }]}
                  onPress={() => setPriority('normal')}
                >
                  <Text style={[typeScale.caption, { color: priority === 'normal' ? colors.primary : colors.textSecondary }]}>Normal</Text>
                </Pressable>
                <Pressable
                  style={[styles.optionChip, priority === 'urgent' && { backgroundColor: '#FFEBEE', borderColor: '#D32F2F' }, { borderColor: colors.border }]}
                  onPress={() => setPriority('urgent')}
                >
                  <Text style={[typeScale.caption, { color: priority === 'urgent' ? '#D32F2F' : colors.textSecondary }]}>Urgent</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGap}>
              <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                Weather Action
              </Text>
              <View style={styles.chipRow}>
                {WEATHER_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.key}
                    style={[
                      styles.optionChip,
                      { borderColor: colors.border },
                      weatherAction === opt.key && { backgroundColor: colors.primarySurface, borderColor: colors.primary },
                    ]}
                    onPress={() => setWeatherAction(opt.key)}
                  >
                    <Feather name={opt.icon as any} size={12} color={weatherAction === opt.key ? colors.primary : colors.textTertiary} />
                    <Text style={[typeScale.caption, { color: weatherAction === opt.key ? colors.primary : colors.textSecondary, marginLeft: 4 }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {weatherAction !== 'none' && (
              <View style={styles.fieldGap}>
                <Text style={[typeScale.labelSmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                  Schedule Action
                </Text>
                <View style={styles.chipRow}>
                  {SCHEDULE_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.key}
                      style={[
                        styles.optionChip,
                        { borderColor: colors.border },
                        scheduleAction === opt.key && { backgroundColor: colors.primarySurface, borderColor: colors.primary },
                      ]}
                      onPress={() => setScheduleAction(opt.key)}
                    >
                      <Feather name={opt.icon as any} size={12} color={scheduleAction === opt.key ? colors.primary : colors.textTertiary} />
                      <Text style={[typeScale.caption, { color: scheduleAction === opt.key ? colors.primary : colors.textSecondary, marginLeft: 4 }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {scheduleAction !== 'none' && (
                  <View style={[styles.actionWarning, { backgroundColor: '#FFF8E1', borderColor: '#F9A825' }]}>
                    <Feather name="alert-triangle" size={14} color="#F9A825" />
                    <Text style={[typeScale.caption, { color: colors.textSecondary, marginLeft: spacing.xs, flex: 1 }]}>
                      {scheduleAction === 'cancel_today'
                        ? "This will cancel all of today's assignments and notify affected workers."
                        : 'This will delay the start of all assignments today.'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.composeActions}>
              <Button
                title={weatherAction !== 'none' ? 'Send Weather Alert' : 'Send to All Workers'}
                onPress={handleSend}
                icon="send"
                size="sm"
              />
              <Button title="Cancel" onPress={() => { setShowCompose(false); setWeatherAction('none'); setScheduleAction('none'); }} variant="ghost" size="sm" />
            </View>
          </Card>
        )}

        {announcements.map((ann) => (
          <Card key={ann.id} style={styles.annCard}>
            <View style={styles.annHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]}>
                  {ann.title}
                </Text>
                <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                  {ann.author?.firstName} {ann.author?.lastName} · {formatDate(ann.createdAt)}
                </Text>
              </View>
              {ann.priority === 'urgent' && (
                <StatusBadge label="Urgent" status="error" />
              )}
            </View>
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
              {ann.body}
            </Text>
            <View style={styles.annFooter}>
              <Feather name="eye" size={14} color={colors.textTertiary} />
              <Text style={[typeScale.caption, { color: colors.textTertiary }]}>
                {ann.readCount}/{ann.totalRecipients} read
              </Text>
            </View>
          </Card>
        ))}
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
  composeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['5xl'] },
  composeCard: { marginBottom: spacing.lg },
  fieldGap: { marginBottom: spacing.md },
  composeActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  annCard: { marginBottom: spacing.sm },
  annHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  annFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  actionWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: radius.xs,
    borderLeftWidth: 3,
    marginTop: spacing.sm,
  },
});
