import React, { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

/**
 * The touch layer for every Weather chart. Touching it, or sliding a finger sideways across it, picks the nearest of `count` points in real time
 * (onPick runs on every move). A mostly vertical swipe is let go, so the page behind it still scrolls. Slide to scrub; a plain touch also picks.
 * It needs a GestureHandlerRootView above it (the app root has one; the details sheet adds its own inside its Modal).
 */
export function ScrubArea({ width, count, onPick, onEnd, style, children }: {
  width: number; count: number; onPick: (index: number) => void; onEnd?: () => void; style?: StyleProp<ViewStyle>; children?: React.ReactNode;
}) {
  const gesture = useMemo(() => {
    const pick = (x: number) => {
      if (count < 1 || width <= 0) return;
      onPick(Math.max(0, Math.min(count - 1, Math.round((x / width) * (count - 1)))));
    };
    return Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onBegin((e) => pick(e.x))
      .onUpdate((e) => pick(e.x))
      .onFinalize(() => onEnd?.());
  }, [width, count, onPick, onEnd]);
  return (
    <GestureDetector gesture={gesture}>
      <View style={style} collapsable={false}>{children}</View>
    </GestureDetector>
  );
}
