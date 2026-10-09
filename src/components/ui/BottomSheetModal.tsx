/**
 * BottomSheetModal — a drop-in for <Modal transparent animationType="slide"> bottom sheets.
 *
 * With the plain slide animation the dimmed backdrop slides up together with
 * the sheet, showing as a dark block moving up the screen. Here the backdrop
 * fades in over the whole screen while only the sheet content slides up.
 *
 * The direct child (usually a full-screen Pressable that closes the sheet) has
 * its own background made transparent; the dimming comes from this component.
 */

import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface BottomSheetModalProps {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactElement<{ style?: any }>;
}

const IN_MS = 300;
const OUT_MS = 220;

export function BottomSheetModal({ visible, onRequestClose, children }: BottomSheetModalProps) {
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: IN_MS, easing: Easing.out(Easing.cubic) });
    } else if (mounted) {
      progress.value = withTiming(0, { duration: OUT_MS, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * height }] }));

  const child = React.cloneElement(children, {
    style: [children.props.style, { backgroundColor: 'transparent' }],
  });

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onRequestClose}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <Animated.View style={[styles.fill, sheetStyle]}>{child}</Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.32)' },
  fill: { flex: 1 },
});
