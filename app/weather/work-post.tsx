import React, { useCallback, useState } from 'react';
import { FlatList, Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useT } from '@/i18n';
import { OptimizedImage } from '@/components/ui';
import { WX } from '@/components/weather/WeatherUI';
import { useClipMusic } from '@/components/work/useClipMusic';
import { getLoadedPost } from '@/data/portfolio';
import { requestNoteFor, sortedMedia, type PortfolioMedia } from '@/lib/portfolio';
import { BRIGHTON_PHONE_LINK } from '@/lib/serviceRequest';

const INK = '#17301F';

/**
 * Inside a project: its photos and videos side by side (swipe), with the owner's music playing under them while the post is open. Leaving the
 * post stops the music. The tap on the music chip mutes it. "Want something like this?" opens the Request form already filled in.
 */
export default function WeatherWorkPost() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const post = getLoadedPost(id);
  const focused = useIsFocused();
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);

  const media = post ? sortedMedia(post) : [];
  const onVideo = media[index]?.kind === 'video';
  const clip = post?.music_url && post.music_start_s != null && post.music_end_s != null ? { startS: post.music_start_s, endS: post.music_end_s } : null;
  // While a video with its own sound is on screen the music waits; the video's sound is off whenever the music replaces it.
  const musicActive = focused && !!post?.music_url && !(post?.keep_video_sound && onVideo);
  useClipMusic(post?.music_url ?? null, clip, { active: musicActive, muted, fade: post?.music_fade ?? true });

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width)), [width]);

  if (!post) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.title}>{t('This project is not available.')}</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.back}><Text style={styles.backText}>{t('Back')}</Text></Pressable>
      </View>
    );
  }

  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace('/weather/work' as any); };
  const ask = requestNoteFor(post);
  const openRequest = () => router.push({ pathname: '/weather/request', params: { services: ask.services.join('|'), note: ask.note } } as any);
  const share = () => { void Share.share({ message: `${post.caption || 'Brighton Lawn & Landscape'}${post.town ? ` (${post.town})` : ''}  brightonlawn.com` }); };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 130 }}>
      <View style={styles.top}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t('Back')} style={styles.iconBtn}><MaterialCommunityIcons name="chevron-left" size={28} color={INK} /></Pressable>
        <Text style={styles.topTitle}>{t('Projects')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.author}>
        <View style={styles.avatar}><Image source={require('../../assets/images/logo-leaf.png')} style={{ width: 20, height: 20, tintColor: '#2E5E34' }} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.handle}>brightonlawn</Text>
          {post.town ? <Text style={styles.town}>{post.town}</Text> : null}
        </View>
      </View>

      <View style={{ width, height: width, backgroundColor: WX.leafTint }}>
        <FlatList
          data={media}
          keyExtractor={(m) => m.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item, index: i }) => <Slide media={item} size={width} playing={focused && i === index} sound={!muted && (!post.music_url || post.keep_video_sound)} />}
        />
        {media.length > 1 ? <View style={styles.counter}><Text style={styles.counterText}>{index + 1}/{media.length}</Text></View> : null}
        {post.music_url ? (
          <Pressable onPress={() => setMuted((m) => !m)} accessibilityRole="button" accessibilityLabel={muted ? t('Music is off. Tap to turn it on') : t('Music is playing. Tap to mute')} style={styles.music}>
            <MaterialCommunityIcons name={muted ? 'music-off' : 'music-note'} size={18} color="#FFFFFF" />
            <Text style={styles.musicText} numberOfLines={1}>{post.music_title || t('Music')}</Text>
          </Pressable>
        ) : null}
        {media.length > 1 ? (
          <View style={styles.dots} pointerEvents="none">
            {media.map((m, i) => <View key={m.id} style={[styles.dot, i === index && styles.dotOn]} />)}
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable onPress={() => { void Linking.openURL(BRIGHTON_PHONE_LINK); }} accessibilityRole="button" accessibilityLabel={t('Call us')} style={styles.iconBtn}><MaterialCommunityIcons name="phone-outline" size={25} color={INK} /></Pressable>
        <Pressable onPress={share} accessibilityRole="button" accessibilityLabel={t('Share')} style={styles.iconBtn}><MaterialCommunityIcons name="send-outline" size={25} color={INK} /></Pressable>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        {post.caption ? <Text style={styles.caption}><Text style={{ fontWeight: '700' }}>brightonlawn </Text>{post.caption}</Text> : null}
        {post.tags.length ? (
          <View style={styles.tags}>{post.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{t(tag)}</Text></View>)}</View>
        ) : null}
        {post.taken_on ? <Text style={styles.date}>{post.taken_on.toUpperCase()}</Text> : null}
        <Pressable onPress={openRequest} accessibilityRole="button" style={({ pressed }) => [styles.request, pressed && { opacity: 0.85 }]}>
          <Text style={styles.requestText}>{t('Want something like this? Request a quote')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/** One picture or video in the swipe row. A video plays (muted unless it is allowed sound) only while it is the one on screen. */
function Slide({ media, size, playing, sound }: { media: PortfolioMedia; size: number; playing: boolean; sound: boolean }) {
  if (media.kind === 'photo') return <OptimizedImage source={media.url} style={{ width: size, height: size }} contentFit="cover" />;
  return <SlideVideo media={media} size={size} playing={playing} sound={sound} />;
}

function SlideVideo({ media, size, playing, sound }: { media: PortfolioMedia; size: number; playing: boolean; sound: boolean }) {
  const player = useVideoPlayer(media.url, (p) => { p.loop = true; p.muted = true; });
  React.useEffect(() => { player.muted = !sound; }, [player, sound]);
  React.useEffect(() => { if (playing) player.play(); else player.pause(); }, [player, playing]);
  return <VideoView player={player} style={{ width: size, height: size }} contentFit="cover" nativeControls={false} />;
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 14 },
  title: { color: WX.deep, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  back: { minHeight: 44, paddingHorizontal: 24, borderRadius: 99, backgroundColor: WX.leafTint, alignItems: 'center', justifyContent: 'center' },
  backText: { color: INK, fontSize: 15, fontWeight: '700' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  topTitle: { color: INK, fontSize: 17, fontWeight: '700' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: WX.leafTint, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#53A246' },
  handle: { color: INK, fontSize: 14.5, fontWeight: '700' },
  town: { color: WX.soft, fontSize: 12.5 },
  counter: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: 'rgba(23,48,31,0.72)' },
  counterText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '600' },
  music: { position: 'absolute', top: 8, left: 10, maxWidth: '62%', minHeight: 44, paddingLeft: 10, paddingRight: 14, borderRadius: 99, backgroundColor: 'rgba(23,48,31,0.72)', flexDirection: 'row', alignItems: 'center', gap: 7 },
  musicText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 14, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { backgroundColor: '#FFFFFF' },
  actions: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 4 },
  caption: { color: INK, fontSize: 14.5, lineHeight: 21 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99, backgroundColor: WX.leafTint },
  tagText: { color: '#2E5E34', fontSize: 12.5, fontWeight: '600' },
  date: { color: WX.soft, fontSize: 12, letterSpacing: 0.4, marginTop: 8 },
  request: { marginTop: 16, minHeight: 50, borderRadius: 14, backgroundColor: '#2E5E34', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  requestText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
