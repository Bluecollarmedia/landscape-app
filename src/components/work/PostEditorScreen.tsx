/**
 * Owner and admin: make or change one Our Work post. A POST is photos and videos together (up to 10; every one is shown as a square, centred
 * automatically). A REEL is one video of up to 60 seconds, shown tall and uncropped, and it also appears in the photo grid unless you switch that
 * off. You can add from your phone or from one of your projects, put the pictures in order, remove any, change the words and tags, hide or delete it.
 * Photos upload high quality, with a small copy for the grid; videos upload exactly as they are.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, GlassIconButton, Icon, InlineNotice, Input, LoadingSpinner, OptimizedImage } from '@/components/ui';
import { confirmAction } from '@/components/financials/ActionSheet';
import { createPost, deletePost, loadOwnerPortfolio, saveMedia, setPostVisible, updatePost, type MediaInput, type OwnerPost } from '@/data/portfolioOwner';
import { uploadPortfolioPhoto, uploadPortfolioVideo } from '@/data/portfolioUpload';
import { db, rowsOf } from '@/data/store';
import { keepPicked } from '@/lib/keepPickedFile';
import { MAX_POST_MEDIA, MAX_VIDEO_S, TAG_CHOICES, formatDuration, moveItem, postProblem, sortedMedia, type MediaKind } from '@/lib/portfolio';
import { useTheme } from '@/providers/ThemeProvider';
import { typeScale } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

interface Item {
  key: string;
  /** Set for a picture that is already saved in the post. */
  id?: string;
  kind: MediaKind;
  uri: string;
  /** True when the file is still on the phone and must be uploaded when saving. */
  local: boolean;
  durationS: number | null;
  thumbUrl: string | null;
  storageKey: string | null;
}

let counter = 0;
const nextKey = () => `i${Date.now().toString(36)}${counter++}`;

export function PostEditorScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ id?: string; mode?: string }>();
  const editingId = params.id;
  const [loading, setLoading] = useState(!!editingId);
  const [post, setPost] = useState<OwnerPost | null>(null);
  const [reel, setReel] = useState(params.mode === 'reel');
  const [items, setItems] = useState<Item[]>([]);
  const [caption, setCaption] = useState('');
  const [town, setTown] = useState('');
  const [takenOn, setTakenOn] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [showInGrid, setShowInGrid] = useState(true);
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [projectPicker, setProjectPicker] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    let alive = true;
    void loadOwnerPortfolio().then((r) => {
      if (!alive) return;
      setLoading(false);
      if (!r.ok) { setProblem(r.error); return; }
      const p = r.data.posts.find((x) => x.id === editingId);
      if (!p) { setProblem('That post is not there any more.'); return; }
      setPost(p);
      setReel(p.kind === 'video');
      setCaption(p.caption); setTown(p.town); setTakenOn(p.taken_on); setTags(p.tags); setShowInGrid(p.show_in_grid); setVisible(p.visible);
      setItems(sortedMedia(p).map((m) => ({ key: m.id, id: m.id, kind: m.kind, uri: m.thumb_url ?? m.url, local: false, durationS: m.duration_s, thumbUrl: m.thumb_url, storageKey: (m as { storage_key?: string | null }).storage_key ?? null })));
    });
    return () => { alive = false; };
  }, [editingId]);

  const tile = (width - spacing.lg * 2 - spacing.lg * 2 - 6 * 3) / 4;
  const title = editingId ? (reel ? 'Edit reel' : 'Edit post') : reel ? 'New reel' : 'New post';
  const room = reel ? 1 - items.length : MAX_POST_MEDIA - items.length;

  async function addFromPhone() {
    setProblem(null);
    if (room <= 0) { setProblem(reel ? 'A reel is one video. Remove it first to choose another.' : `A post holds up to ${MAX_POST_MEDIA} photos and videos.`); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setProblem('Turn on photo access for Brighton Lawn in the Settings app.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: reel ? ['videos'] : ['images', 'videos'], allowsMultipleSelection: !reel, selectionLimit: Math.max(1, room), quality: 1 });
    if (result.canceled) return;
    const added: Item[] = [];
    for (const a of result.assets.slice(0, room)) {
      const isVideo = a.type === 'video';
      const seconds = isVideo ? (a.duration ?? 0) / 1000 : null;
      if (isVideo && (seconds ?? 0) > MAX_VIDEO_S) { setProblem(`A video can be up to ${MAX_VIDEO_S} seconds. Trim it first.`); continue; }
      // The picked file is copied somewhere safe at once (the phone may remove its temporary copy before the upload ends).
      const kept = await keepPicked(a.uri, isVideo ? 'video' : 'image');
      added.push({ key: nextKey(), kind: isVideo ? 'video' : 'photo', uri: kept, local: true, durationS: seconds, thumbUrl: null, storageKey: null });
    }
    setItems((cur) => [...cur, ...added]);
  }

  function addFromProject(urls: string[]) {
    const free = Math.max(0, MAX_POST_MEDIA - items.length);
    setItems((cur) => [...cur, ...urls.slice(0, free).map((u): Item => ({ key: nextKey(), kind: 'photo', uri: u, local: false, durationS: null, thumbUrl: null, storageKey: null }))]);
    setProjectPicker(false);
  }

  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].slice(0, 8)));
  const move = (from: number, to: number) => setItems((cur) => moveItem(cur, from, to));
  const remove = (key: string) => setItems((cur) => cur.filter((i) => i.key !== key));

  async function save() {
    setProblem(null);
    const bad = postProblem({ kind: reel ? 'video' : 'post', caption, town, tags, media: items.map((i) => ({ kind: i.kind, duration_s: i.durationS })) });
    if (bad) { setProblem(bad); return; }
    const companyId = db.companyId;
    if (!companyId) { setProblem('Sign in again.'); return; }
    try {
      // 1. send every file that is still on the phone
      const inputs: MediaInput[] = [];
      let n = 0;
      const toSend = items.filter((i) => i.local).length;
      for (const i of items) {
        if (!i.local) { inputs.push({ id: i.id, kind: i.kind, url: i.uri, key: i.storageKey, thumbUrl: i.thumbUrl, durationS: i.durationS }); continue; }
        n += 1;
        setBusy(`Uploading ${n} of ${toSend}…`);
        if (i.kind === 'photo') {
          const up = await uploadPortfolioPhoto(i.uri, companyId);
          inputs.push({ kind: 'photo', url: up.url, key: up.key, thumbUrl: up.thumbUrl });
        } else {
          const up = await uploadPortfolioVideo(i.uri, companyId);
          inputs.push({ kind: 'video', url: up.url, key: up.key, thumbUrl: up.thumbUrl, durationS: i.durationS });
        }
      }
      // 2. save the post
      setBusy('Saving…');
      if (!editingId) {
        const r = await createPost({ kind: reel ? 'video' : 'post', caption, town, takenOn, tags, showInGrid, visible, media: inputs });
        if (!r.ok) { setProblem(r.error); return; }
      } else if (post) {
        const ex = await mediaUrlsOf(post);
        const r1 = await updatePost(post.id, { caption: caption.trim(), town: town.trim(), taken_on: takenOn.trim().slice(0, 30), tags, show_in_grid: reel ? showInGrid : true, visible });
        if (!r1.ok) { setProblem(r1.error); return; }
        // existing pictures keep their saved address; only the order and what was removed change
        const arranged: MediaInput[] = inputs.map((m) => (m.id ? { ...m, url: ex.urls[m.id] ?? m.url, thumbUrl: ex.thumbs[m.id] ?? m.thumbUrl } : m));
        const r2 = await saveMedia(post.id, arranged, post.media, ex.keys);
        if (!r2.ok) { setProblem(r2.error); return; }
        if (!post.cover_url) await updatePost(post.id, { cover_thumb_url: arranged[0]?.thumbUrl ?? null });
      }
      router.back();
    } catch (e) {
      setProblem(e instanceof Error && e.message ? e.message : "Couldn't save. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  function takeDownOrShow() {
    if (!post) return;
    const next = !visible;
    void setPostVisible(post.id, next).then((r) => { if (r.ok) setVisible(next); else setProblem(r.error); });
  }

  function confirmDelete() {
    if (!post) return;
    confirmAction('Delete this post?', 'It is removed from Our Work for good, with its photos and videos. This cannot be undone. (To only hide it, use Take down.)', 'Delete', async () => {
      const r = await deletePost(post.id, post.media.map((m) => (m as { storage_key?: string | null }).storage_key));
      if (!r.ok) { setProblem(r.error); return; }
      router.back();
    }, true);
  }

  const first = items[0];
  const modeLabel = useMemo(() => (reel ? 'One video, up to 60 seconds. It plays tall, full screen, and swipes up like a reel.' : `Up to ${MAX_POST_MEDIA} photos and videos. Each one is shown as a square, centred automatically.`), [reel]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing['4xl'] }} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <GlassIconButton icon="chevron-left" onPress={() => router.back()} accessibilityLabel="Back" />
          <Button title="Save" size="sm" onPress={save} loading={!!busy} disabled={loading} />
        </View>
        <Text style={[typeScale.displaySmall, { color: colors.textPrimary, marginTop: spacing.lg }]}>{title}</Text>
        <Text style={[typeScale.bodyMedium, { color: colors.textSecondary, marginTop: 2, marginBottom: spacing.lg }]}>{modeLabel}</Text>
        {problem ? <InlineNotice icon="alert-circle" tone="error" text={problem} style={{ marginBottom: spacing.md }} /> : null}
        {busy ? <InlineNotice icon="upload-cloud" tone="info" text={busy} style={{ marginBottom: spacing.md }} /> : null}

        {loading ? <LoadingSpinner /> : (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[typeScale.labelLarge, { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.sm }]}>{reel ? 'Video' : 'Photos and videos'}{items.length > 1 ? ' · first one is the cover' : ''}</Text>
              <View style={styles.grid}>
                {items.map((it, i) => (
                  <View key={it.key} style={{ width: tile }}>
                    <View style={[styles.tile, { width: tile, height: tile, backgroundColor: colors.backgroundTertiary }, i === 0 && !reel ? { borderWidth: 2.5, borderColor: '#2E5E34' } : null]}>
                      {it.kind === 'photo' || it.thumbUrl ? <OptimizedImage source={it.thumbUrl ?? it.uri} style={{ width: '100%', height: '100%' }} /> : <Icon name="video" size={22} color={colors.textSecondary} />}
                      {it.kind === 'video' ? <View style={styles.vid}><Icon name="play" size={12} color="#FFFFFF" /><Text style={styles.vidText}>{formatDuration(it.durationS)}</Text></View> : null}
                      {i === 0 && !reel && items.length > 1 ? <View style={styles.cover}><Text style={styles.coverText}>Cover</Text></View> : null}
                      <Pressable onPress={() => remove(it.key)} accessibilityRole="button" accessibilityLabel="Remove" hitSlop={6} style={styles.x}><Icon name="x" size={13} color="#FFFFFF" /></Pressable>
                    </View>
                    {!reel && items.length > 1 ? (
                      <View style={styles.moves}>
                        <Pressable onPress={() => move(i, i - 1)} disabled={i === 0} accessibilityRole="button" accessibilityLabel="Move earlier" style={[styles.move, i === 0 && { opacity: 0.25 }]}><Icon name="chevron-left" size={16} color={colors.textPrimary} /></Pressable>
                        <Pressable onPress={() => move(i, i + 1)} disabled={i === items.length - 1} accessibilityRole="button" accessibilityLabel="Move later" style={[styles.move, i === items.length - 1 && { opacity: 0.25 }]}><Icon name="chevron-right" size={16} color={colors.textPrimary} /></Pressable>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <Button title={reel ? 'Choose a video' : 'Add from phone'} size="sm" variant="secondary" onPress={addFromPhone} style={{ flex: 1 }} />
                {!reel ? <Button title="Add from a project" size="sm" variant="secondary" onPress={() => setProjectPicker(true)} style={{ flex: 1 }} /> : null}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.md, gap: spacing.md }]}>
              <Input label="Caption" value={caption} onChangeText={setCaption} multiline maxLength={2200} placeholder="What was this job? Anything you want visitors to know." />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Input label="Town" value={town} onChangeText={setTown} maxLength={80} placeholder="Howell, NJ" containerStyle={{ flex: 1.3 }} />
                <Input label="When" value={takenOn} onChangeText={setTakenOn} maxLength={30} placeholder="Aug 2019" containerStyle={{ flex: 1 }} />
              </View>
              <View>
                <Text style={[typeScale.labelLarge, { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.sm }]}>Tags</Text>
                <View style={styles.tags}>
                  {TAG_CHOICES.map((t) => {
                    const on = tags.includes(t);
                    return (
                      <Pressable key={t} onPress={() => toggleTag(t)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.tag, { backgroundColor: on ? '#2E5E34' : colors.surface, borderColor: on ? '#2E5E34' : colors.border }]}>
                        <Text style={[typeScale.labelLarge, { color: on ? '#FFFFFF' : colors.textPrimary, fontWeight: '600' }]}>{t}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Only the town shows. No street address and no customer name. Please skip photos with people's faces.</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.md, gap: spacing.md, flexDirection: 'column', alignItems: 'stretch' }]}>
              {reel ? (
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700' }]}>Also show in the photo grid</Text>
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]}>Off: it only appears in Videos.</Text>
                  </View>
                  <Switch value={showInGrid} onValueChange={setShowInGrid} trackColor={{ true: '#2E5E34' }} accessibilityLabel="Also show in the photo grid" />
                </View>
              ) : null}
              <View style={styles.switchRow}>
                <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '700', flex: 1 }]}>Show on Our Work</Text>
                <Switch value={visible} onValueChange={setVisible} trackColor={{ true: '#2E5E34' }} accessibilityLabel="Show on Our Work" />
              </View>
            </View>

            <Button title={busy ?? 'Save'} onPress={save} loading={!!busy} style={{ marginTop: spacing.lg }} />

            {editingId && post ? (
              <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
                <Button title={visible ? 'Take down from Our Work' : 'Show on Our Work again'} variant="secondary" onPress={takeDownOrShow} />
                <Button title="Delete this post" variant="danger" onPress={confirmDelete} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <ProjectPhotoPicker visible={projectPicker} onClose={() => setProjectPicker(false)} onPick={addFromProject} limit={MAX_POST_MEDIA - items.length} />
    </View>
  );
}

/** The addresses and storage keys of a post's saved pictures (the screen only keeps a thumbnail address to draw). */
async function mediaUrlsOf(post: OwnerPost): Promise<{ urls: Record<string, string>; thumbs: Record<string, string | null>; keys: Record<string, string | null | undefined> }> {
  const urls: Record<string, string> = {};
  const thumbs: Record<string, string | null> = {};
  const keys: Record<string, string | null | undefined> = {};
  for (const m of post.media) { urls[m.id] = m.url; thumbs[m.id] = m.thumb_url; keys[m.id] = (m as { storage_key?: string | null }).storage_key; }
  return { urls, thumbs, keys };
}

/** Pick a project, then pick some of its photos. The photos are used where they are (nothing is copied or re-uploaded). */
function ProjectPhotoPicker({ visible, onClose, onPick, limit }: { visible: boolean; onClose: () => void; onPick: (urls: string[]) => void; limit: number }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const projects = db.projects;
  const photos = useMemo(() => (projectId ? rowsOf('project_photos').filter((r) => r.projectId === projectId && typeof r.fileUrl === 'string').slice(0, 80) : []), [projectId]);
  const size = (width - spacing.lg * 2 - 6 * 2) / 3;
  const close = () => { setProjectId(null); setChosen([]); onClose(); };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: spacing.lg }}>
        <View style={styles.sheetHead}>
          <Text style={[typeScale.headingSmall, { color: colors.textPrimary }]}>{projectId ? 'Pick photos' : 'Pick a project'}</Text>
          <Pressable onPress={projectId ? () => setProjectId(null) : close} accessibilityRole="button" hitSlop={10}><Text style={[typeScale.labelLarge, { color: colors.primary, fontWeight: '700' }]}>{projectId ? 'Back' : 'Close'}</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100 }}>
          {!projectId ? (
            <View style={{ gap: spacing.sm }}>
              {projects.map((p) => (
                <Pressable key={p.id} onPress={() => setProjectId(p.id)} accessibilityRole="button" style={[styles.projRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[typeScale.bodyLarge, { color: colors.textPrimary, fontWeight: '600', flex: 1 }]} numberOfLines={1}>{p.name}</Text>
                  <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                </Pressable>
              ))}
            </View>
          ) : photos.length === 0 ? (
            <Text style={[typeScale.bodyMedium, { color: colors.textSecondary }]}>This project has no photos yet.</Text>
          ) : (
            <View style={styles.grid}>
              {photos.map((r) => {
                const url = r.fileUrl as string;
                const on = chosen.includes(url);
                return (
                  <Pressable key={String(r.id)} onPress={() => setChosen((c) => (c.includes(url) ? c.filter((x) => x !== url) : c.length < limit ? [...c, url] : c))} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ width: size, height: size }}>
                    <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: 8 }} />
                    {on ? <View style={styles.picked}><Icon name="check" size={16} color="#FFFFFF" /></View> : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
        {projectId ? (
          <View style={[styles.sheetFoot, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <Button title={chosen.length ? `Add ${chosen.length}` : 'Choose photos'} onPress={() => { onPick(chosen); setProjectId(null); setChosen([]); }} disabled={chosen.length === 0} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: { borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  vid: { position: 'absolute', left: 4, bottom: 4, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 99, backgroundColor: 'rgba(8,16,12,0.65)' },
  vidText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  cover: { position: 'absolute', left: 4, top: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: '#2E5E34' },
  coverText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  x: { position: 'absolute', right: 4, top: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#B3261E', alignItems: 'center', justifyContent: 'center' },
  moves: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  move: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { minHeight: 40, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  sheetFoot: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  projRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  picked: { position: 'absolute', right: 6, top: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: '#2E5E34', alignItems: 'center', justifyContent: 'center' },
});
