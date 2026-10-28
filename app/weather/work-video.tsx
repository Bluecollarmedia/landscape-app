import React, { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useT } from '@/i18n';
import { WX } from '@/components/weather/WeatherUI';
import { ScrubBar } from '@/components/work/ScrubBar';
import { useClipMusic } from '@/components/work/useClipMusic';
import { getLoadedPost } from '@/data/portfolio';
import { formatDuration, requestNoteFor } from '@/lib/portfolio';
import { BRIGHTON_PHONE_LINK } from '@/lib/serviceRequest';

/**
 * One video, full screen. It plays on a loop with the sound off (tap the speaker for sound); tap the picture to pause. The seek bar is thin until
 * a finger touches it, then it grows (and the rest dims) so it is easy to scrub. If the post has the owner's music and the video's own sound is
 * not kept, the music plays in place of the video's sound.
 */
export default function WeatherWorkVideo() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{ post?: string; media?: string }>();
  const post = getLoadedPost(params.post);
  const item = post?.media.find((m) => m.id === params.media && m.kind === 'video');
  const focused = useIsFocused();
  const [sound, setSound] = useState(false);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(0);
  const [length, setLength] = useState(item?.duration_s ?? 0);
  const [scrubbing, setScrubbing] = useState(false);

  const player = useVideoPlayer(item?.url ?? null, (p) => { p.loop = true; p.muted = true; p.timeUpdateEventInterval = 0.25; });
  const musicReplaces = !!post?.music_url && !post.keep_video_sound;

  useEffect(() => {
    const sub = player.addListener('timeUpdate', ({ currentTime }) => { if (!scrubbing) setNow(currentTime); });
    return () => sub.remove();
  }, [player, scrubbing]);
  useEffect(() => { if (player.duration > 0) setLength((l) => l || player.duration); });
  useEffect(() => { player.muted = !sound || musicReplaces; }, [player, sound, musicReplaces]);
  useEffect(() => { if (focused && !paused) player.play(); else player.pause(); }, [player, focused, paused]);

  const clip = post?.music_url && post.music_start_s != null && post.music_end_s != null ? { startS: post.music_start_s, endS: post.music_end_s } : null;
  useClipMusic(post?.music_url ?? null, clip, { active: focused && musicReplaces && !paused, muted: !sound, fade: post?.music_fade ?? true });

  const seek = useCallback((s: number) => { player.currentTime = s; setNow(s); }, [player]);
  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace('/weather/work' as any); };

  if (!post || !item) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.emptyTitle}>{t('This video is not available.')}</Text>
        <Pressable onPress={goBack} accessibilityRole="button" style={styles.emptyBtn}><Text style={styles.emptyBtnText}>{t('Back')}</Text></Pressable>
      </View>
    );
  }

  const ask = requestNoteFor(post);
  const openRequest = () => router.push({ pathname: '/weather/request', params: { services: ask.services.join('|'), note: ask.note } } as any);
  const share = () => { void Share.share({ message: `${post.caption || 'Brighton Lawn & Landscape'}  brightonlawn.com` }); };

  return (
    <View style={styles.screen}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setPaused((p) => !p)} accessibilityRole="button" accessibilityLabel={paused ? t('Play') : t('Pause')}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      </Pressable>
      <LinearGradient colors={['transparent', 'rgba(8,16,12,0.85)']} style={[styles.shade, { height: height * 0.5 }]} pointerEvents="none" />
      {paused ? <View style={styles.pauseWrap} pointerEvents="none"><View style={styles.pauseDot}><MaterialCommunityIcons name="play" size={40} color="#FFFFFF" /></View></View> : null}

      <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t('Close')} style={styles.roundBtn}><MaterialCommunityIcons name="close" size={24} color="#FFFFFF" /></Pressable>
        <View style={styles.pill}><Text style={styles.pillText}>{formatDuration(now)} / {formatDuration(length)}</Text></View>
        <View style={{ width: 44 }} />
      </View>

      <View style={[styles.side, { bottom: insets.bottom + 250 }]}>
        <Pressable onPress={() => setSound((s) => !s)} accessibilityRole="button" accessibilityLabel={sound ? t('Sound on, tap to turn off') : t('Sound off, tap to turn on')} style={styles.sideBtn}>
          <MaterialCommunityIcons name={sound ? 'volume-high' : 'volume-off'} size={24} color="#FFFFFF" />
        </Pressable>
        <Pressable onPress={() => { void Linking.openURL(BRIGHTON_PHONE_LINK); }} accessibilityRole="button" accessibilityLabel={t('Call us')} style={styles.sideBtn}><MaterialCommunityIcons name="phone-outline" size={23} color="#FFFFFF" /></Pressable>
        <Pressable onPress={share} accessibilityRole="button" accessibilityLabel={t('Share')} style={styles.sideBtn}><MaterialCommunityIcons name="send-outline" size={23} color="#FFFFFF" /></Pressable>
      </View>

      {scrubbing ? <View style={styles.dim} pointerEvents="none" /> : null}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <View style={styles.captionBox} pointerEvents="none">
          <View style={styles.authorRow}>
            <View style={styles.avatar}><Image source={require('../../assets/images/logo-leaf.png')} style={{ width: 18, height: 18, tintColor: '#2E5E34' }} /></View>
            <Text style={styles.handle}>brightonlawn</Text>
            {post.town ? <Text style={styles.town}>{post.town}</Text> : null}
          </View>
          {post.caption ? <Text style={styles.caption} numberOfLines={3}>{post.caption}</Text> : null}
          {post.tags.length ? <View style={styles.tags}>{post.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{t(tag)}</Text></View>)}</View> : null}
        </View>
        <ScrubBar currentS={now} durationS={length || item.duration_s || 0} onSeek={seek} onScrubChange={setScrubbing} />
        <Pressable onPress={openRequest} accessibilityRole="button" style={({ pressed }) => [styles.request, pressed && { opacity: 0.85 }]}>
          <Text style={styles.requestText}>{t('Want something like this? Request a quote')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E1A12' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 30, backgroundColor: WX.page },
  emptyTitle: { color: WX.deep, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyBtn: { minHeight: 44, paddingHorizontal: 24, borderRadius: 99, backgroundColor: WX.leafTint, alignItems: 'center', justifyContent: 'center' },
  emptyBtnText: { color: '#17301F', fontSize: 15, fontWeight: '700' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(8,16,12,0.45)', alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: 'rgba(8,16,12,0.45)' },
  pillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  pauseWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pauseDot: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(8,16,12,0.5)', alignItems: 'center', justifyContent: 'center' },
  side: { position: 'absolute', right: 12, gap: 10 },
  sideBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(8,16,12,0.5)', alignItems: 'center', justifyContent: 'center' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,16,12,0.55)' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  captionBox: { paddingHorizontal: 16, paddingRight: 76, marginBottom: 6 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E6F0DE', alignItems: 'center', justifyContent: 'center' },
  handle: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
  town: { color: '#FFFFFF', fontSize: 12.5, opacity: 0.85 },
  caption: { color: '#FFFFFF', fontSize: 14.5, lineHeight: 21, marginTop: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.2)' },
  tagText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '600' },
  request: { marginHorizontal: 16, marginTop: 6, minHeight: 50, borderRadius: 14, backgroundColor: '#8CCB63', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  requestText: { color: '#0F2A17', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
