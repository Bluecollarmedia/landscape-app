import { useEffect } from 'react';
import { useVideoPlayer } from 'expo-video';
import { clipVolume, nextLoopPosition, type Clip } from '@/lib/portfolio';

/**
 * Plays the part of the owner's track that was chosen for a post, on a loop, while `active` (the post is open) and not `muted`.
 * It starts at the chosen start, jumps back to it when the part ends, and fades out over the last 2 seconds when the owner kept the fade on.
 * Leaving the post (active false) pauses it. The track is played with the same player the app uses for video (an audio file plays with no picture).
 */
export function useClipMusic(url: string | null, clip: Clip | null, opts: { active: boolean; muted: boolean; fade: boolean }): void {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
  });
  const { active, muted, fade } = opts;
  const startS = clip?.startS ?? 0;
  const endS = clip?.endS ?? 0;

  useEffect(() => {
    if (!url || !clip) return;
    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      const c = { startS, endS };
      const jump = nextLoopPosition(currentTime, c);
      if (jump !== null) { player.currentTime = jump; player.play(); return; }
      player.volume = clipVolume(currentTime, c, fade);
    });
    return () => sub.remove();
  }, [player, url, startS, endS, fade, clip]);

  useEffect(() => {
    if (!url || !clip) return;
    if (active && !muted) {
      player.currentTime = startS;
      player.volume = 1;
      player.play();
    } else {
      player.pause();
    }
  }, [player, url, clip, active, muted, startS]);
}
