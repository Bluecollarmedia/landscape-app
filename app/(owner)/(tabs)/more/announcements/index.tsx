import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { StatusBadge } from '@/components/ui';
import { typeScale } from '@/theme/typography';
import { spacing, radius, shadow } from '@/theme/spacing';
import type { Announcement } from '@/types/announcement';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';

export default function AnnouncementsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { announcements } = useAnnouncements();
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<Announcement | null>(null);

  const sortedAnnouncements = [...announcements].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [currentAnnouncement, ...previousAnnouncements] = sortedAnnouncements;

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
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[typeScale.headingLarge, { color: colors.textPrimary, flex: 1 }]}>
          Announcements
        </Text>
        <Pressable
          onPress={() => router.push('/(owner)/more/announcements/new' as any)}
          style={[styles.composeBtn, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="New announcement"
        >
          <Icon name="edit" size={18} color={colors.textOnPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {currentAnnouncement && (
          <>
            <View style={[styles.sectionLabelPill, { backgroundColor: colors.primarySurface }]}>
              <Text style={[typeScale.labelSmall, { color: colors.primary, fontWeight: '700' }]}>
                CURRENT ANNOUNCEMENT
              </Text>
            </View>

            <View style={[styles.currentCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }, shadow.sm]}>
              <View style={styles.annHeader}>
                <Text style={[typeScale.headingSmall, { color: colors.textPrimary, fontWeight: '700', flex: 1, marginRight: spacing.sm }]}>
                  {currentAnnouncement.title}
                </Text>
                {currentAnnouncement.priority === 'urgent' && (
                  <StatusBadge label="Urgent" status="error" />
                )}
              </View>
              <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                {currentAnnouncement.author?.firstName} {currentAnnouncement.author?.lastName} · {formatDate(currentAnnouncement.createdAt)}
              </Text>
              <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, marginTop: spacing.md, lineHeight: 22 }]}>
                {currentAnnouncement.body}
              </Text>
              <View style={[styles.annFooter, { borderTopColor: colors.borderLight }]}>
                <Icon name="eye" size={14} color={colors.textTertiary} />
                <Text style={[typeScale.caption, { color: colors.textTertiary, marginLeft: spacing.xs }]}>
                  {currentAnnouncement.readCount}/{currentAnnouncement.totalRecipients} read
                </Text>
              </View>
            </View>
          </>
        )}

        {previousAnnouncements.length > 0 && (
          <>
            <Text style={[typeScale.overline, { color: colors.textTertiary, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
              PREVIOUS ANNOUNCEMENTS
            </Text>

            {previousAnnouncements.map((ann) => (
              <Pressable
                key={ann.id}
                style={[styles.previousCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }, shadow.sm]}
                onPress={() => setExpandedAnnouncement(ann)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700' }]} numberOfLines={1}>
                    {ann.title}
                  </Text>
                  <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                    {ann.author?.firstName} {ann.author?.lastName} · {formatDate(ann.createdAt)}
                  </Text>
                  <View style={styles.previousReadRow}>
                    <Icon name="eye" size={12} color={colors.textTertiary} />
                    <Text style={[typeScale.caption, { color: colors.textTertiary, marginLeft: 4 }]}>
                      {ann.readCount}/{ann.totalRecipients} read
                    </Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={18} color={colors.textTertiary} />
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      {/* Expanded previous announcement */}
      <BottomSheetModal visible={!!expandedAnnouncement} onRequestClose={() => setExpandedAnnouncement(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setExpandedAnnouncement(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.borderLight }]} />
            {expandedAnnouncement && (
              <>
                <View style={styles.annHeader}>
                  <Text style={[typeScale.headingSmall, { color: colors.textPrimary, fontWeight: '700', flex: 1, marginRight: spacing.sm }]}>
                    {expandedAnnouncement.title}
                  </Text>
                  {expandedAnnouncement.priority === 'urgent' && (
                    <StatusBadge label="Urgent" status="error" />
                  )}
                </View>
                <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                  {expandedAnnouncement.author?.firstName} {expandedAnnouncement.author?.lastName} · {formatDate(expandedAnnouncement.createdAt)}
                </Text>
                <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, marginTop: spacing.md, lineHeight: 22 }]}>
                  {expandedAnnouncement.body}
                </Text>
                <View style={[styles.annFooter, { borderTopColor: colors.borderLight }]}>
                  <Icon name="eye" size={14} color={colors.textTertiary} />
                  <Text style={[typeScale.caption, { color: colors.textTertiary, marginLeft: spacing.xs }]}>
                    {expandedAnnouncement.readCount}/{expandedAnnouncement.totalRecipients} read
                  </Text>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </BottomSheetModal>
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
  annHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  annFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionLabelPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  currentCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
  },
  previousCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  previousReadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
});
