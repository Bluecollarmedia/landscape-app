/**
 * On a truck's page, for the company owner only: the truck's documents (insurance, registration, any PDF or photo, with expiry
 * warnings) and the owner's private dated notes. Nobody else sees this section, and the database refuses to give the data to
 * anyone else either (supabase/updates/056).
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Alert, Platform, TextInput, Keyboard } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Button, Card } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { TruckDocumentSheet } from './TruckDocumentSheet';
import {
  addTruckDocument, addTruckNote, deleteTruckNote, removeTruckDocument, updateTruckNote, useTruckDocuments, useTruckNotes,
} from '@/data/truckFiles';
import { DOC_KINDS, NOTE_MAX, expiryStatus, formatSize, isPdf, kindLabel } from '@/lib/truckDocs';
import { semantic } from '@/theme/colors';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import type { TruckDocument } from '@/types/truck';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function confirm(title: string, message: string, action: string, run: () => void) {
  if (Platform.OS === 'web') { if ((globalThis as { confirm?: (m: string) => boolean }).confirm?.(`${title}\n\n${message}`)) run(); return; }
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: 'destructive', onPress: run }]);
}

export function TruckPrivateSection({ truckId }: { truckId: string }) {
  const { colors } = useTheme();
  const docs = useTruckDocuments(truckId);
  const notes = useTruckNotes(truckId);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  function open(d: TruckDocument) {
    Linking.openURL(d.fileUrl).catch(() => Alert.alert("Couldn't open the file", 'Try again in a moment.'));
  }

  function saveNote() {
    const r = addTruckNote(truckId, draft);
    if (!r.ok) { setNoteError(r.error); return; }
    setDraft('');
    setNoteError(null);
    Keyboard.dismiss();
  }

  return (
    <>
      <Card title="Documents & Insurance" style={styles.card}>
        <Text style={[typeScale.caption, { color: colors.textTertiary, marginBottom: spacing.sm }]}>
          Insurance, registration, inspection, any PDF or photo. Only you can see these.
        </Text>
        {docs.length === 0 ? (
          <Text style={[typeScale.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>No documents yet.</Text>
        ) : (
          docs.map((d, i) => {
            const exp = expiryStatus(d.expiresOn);
            const tone = exp.state === 'expired' ? semantic.error : exp.state === 'soon' ? semantic.warning : colors.textTertiary;
            const icon = DOC_KINDS.find((k) => k.key === d.kind)?.icon ?? 'paperclip';
            return (
              <View key={d.id} style={[styles.docRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <Pressable onPress={() => open(d)} style={styles.docMain} accessibilityRole="button" accessibilityLabel={`Open ${d.title}`}>
                  <View style={[styles.docIcon, { backgroundColor: colors.primarySurface }]}>
                    <Icon name={isPdf(d.contentType, d.title) ? 'file-text' : icon === 'paperclip' ? 'image' : icon} size={18} color={colors.primaryDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>{d.title}</Text>
                    <Text style={[typeScale.caption, { color: colors.textTertiary }]} numberOfLines={1}>
                      {[kindLabel(d.kind), isPdf(d.contentType) ? 'PDF' : 'Photo', formatSize(d.sizeBytes), `Added ${when(d.createdAt)}`].filter(Boolean).join(' · ')}
                    </Text>
                    {exp.label ? <Text style={[typeScale.caption, { color: tone, fontWeight: exp.state === 'ok' || exp.state === 'none' ? '400' : '700' }]}>{exp.label}</Text> : null}
                  </View>
                </Pressable>
                <Pressable onPress={() => confirm('Delete this document?', `${d.title} will be removed from this truck.`, 'Delete', () => removeTruckDocument(d))} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Delete ${d.title}`}>
                  <Icon name="trash-2" size={18} color={colors.textTertiary} />
                </Pressable>
              </View>
            );
          })
        )}
        <Button title="Add Document" icon="plus" variant="secondary" onPress={() => setSheet(true)} fullWidth />
      </Card>

      <Card title="Private Notes" style={styles.card}>
        <View style={styles.privateTag}>
          <Icon name="lock" size={12} color={colors.textTertiary} />
          <Text style={[typeScale.caption, { color: colors.textTertiary }]}>Only you can see these notes. Workers and admins can't.</Text>
        </View>
        <TextInput
          value={draft}
          onChangeText={(t) => { setDraft(t.slice(0, NOTE_MAX)); setNoteError(null); }}
          placeholder="Where things stand: new battery in March, insurance renews in June…"
          placeholderTextColor={colors.textTertiary}
          multiline
          style={[typeScale.bodyLarge, styles.noteInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
          accessibilityLabel="Add a private note"
        />
        {noteError ? <Text style={[typeScale.caption, { color: colors.error }]}>{noteError}</Text> : null}
        <Button title="Add Note" icon="plus" variant="secondary" onPress={saveNote} disabled={!draft.trim()} fullWidth />

        {notes.map((n, i) => (
          <View key={n.id} style={[styles.noteRow, { borderTopColor: colors.border }, i === 0 && { marginTop: spacing.md }]}>
            {editing === n.id ? (
              <View style={{ flex: 1, gap: spacing.sm }}>
                <TextInput value={editText} onChangeText={(t) => setEditText(t.slice(0, NOTE_MAX))} multiline autoFocus style={[typeScale.bodyLarge, styles.noteInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]} />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} style={{ flex: 1 }} />
                  <Button title="Save" onPress={() => { const r = updateTruckNote(n.id, editText); if (r.ok) { Keyboard.dismiss(); setEditing(null); } else setNoteError(r.error); }} style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <>
                <View style={{ flex: 1 }}>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary }]}>{n.body}</Text>
                  <Text style={[typeScale.caption, { color: colors.textTertiary, marginTop: 2 }]}>{when(n.createdAt)}{n.updatedAt !== n.createdAt && when(n.updatedAt) !== when(n.createdAt) ? ` · edited ${when(n.updatedAt)}` : ''}</Text>
                </View>
                <Pressable onPress={() => { setEditing(n.id); setEditText(n.body); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Edit this note"><Icon name="edit-2" size={16} color={colors.textTertiary} /></Pressable>
                <Pressable onPress={() => confirm('Delete this note?', 'It will be removed for good.', 'Delete', () => deleteTruckNote(n.id))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Delete this note"><Icon name="trash-2" size={16} color={colors.textTertiary} /></Pressable>
              </>
            )}
          </View>
        ))}
      </Card>

      <TruckDocumentSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        onSubmit={async (input) => { const r = await addTruckDocument(truckId, input); return r.ok ? null : r.error; }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.lg },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  docMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  docIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  privateTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  noteInput: { minHeight: 72, borderWidth: 1.5, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, textAlignVertical: 'top', marginBottom: spacing.sm },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});
