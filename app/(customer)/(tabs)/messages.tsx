import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { EmptyState } from '@/components/ui';
import { MessageThread } from '@/components/messages/MessageThread';
import { KEYBOARD_GAP } from '@/components/layout/ScreenContainer';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { db, useDb } from '@/data/store';

export default function CustomerMessagesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const v = useDb();
  const scrollRef = useRef<any>(null);

  const projects = db.projects.filter((p) => p.customerId === user?.id || p.customerClaimedBy === user?.id);
  const [selectedId, setSelectedId] = useState<string | undefined>(projects[0]?.id);
  const projectId = projects.some((p) => p.id === selectedId) ? selectedId : projects[0]?.id;
  const count = projectId ? db.messages[projectId]?.length ?? 0 : 0;

  // Keep the newest message in view.
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [count, projectId, v]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollView
        ref={scrollRef}
        bottomOffset={KEYBOARD_GAP}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: tabBarClearance, flexGrow: 1 }}
      >
        <View style={{ paddingTop: insets.top + spacing.md, marginBottom: spacing.lg }}>
          <Text style={[typeScale.displaySmall, { color: colors.textPrimary }]}>Messages</Text>
          {db.company?.name ? (
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
              Chat with {db.company.name}
            </Text>
          ) : null}
        </View>

        {projects.length > 1 && (
          <View style={styles.chips}>
            {projects.map((p) => {
              const active = p.id === projectId;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedId(p.id)}
                  style={[styles.chip, { backgroundColor: active ? colors.primary : colors.backgroundTertiary }]}
                >
                  <Text style={[typeScale.labelSmall, { color: active ? '#FFFFFF' : colors.textSecondary, fontWeight: '600' }]}>{p.name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {projectId ? (
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <MessageThread
              projectId={projectId}
              emptyText="Questions about your project? Send a message and your landscaper will reply here."
            />
          </View>
        ) : (
          <EmptyState
            icon="message-circle"
            title="No messages"
            description="Once you're added to a project, you can message your landscaper here."
          />
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
});
