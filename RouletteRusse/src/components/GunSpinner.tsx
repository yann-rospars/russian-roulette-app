import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { gunBounds, GunVisual } from './GunVisual';

export function GunSpinner({ size, armed, angle, spinning, onSpun, onPress, label, disabled }: {
  size: number; armed: boolean; angle: number; spinning: boolean; onSpun: (angle: number) => void;
  onPress: () => void; label: string; disabled: boolean;
}) {
  const [rotation] = useState(() => new Animated.Value(angle));
  const visibleWidth = gunBounds.right - gunBounds.left;
  const visibleHeight = gunBounds.bottom - gunBounds.top;
  // Pivot relative to the visible image: 10% right and 5% up from center.
  const pivotX = visibleWidth * 0.60;
  const pivotY = visibleHeight * 0.30;
  const radius = Math.hypot(
    Math.max(pivotX, visibleWidth - pivotX),
    Math.max(pivotY, visibleHeight - pivotY),
  );
  // Slightly reduce the gun so its off-center rotation still fits in the ring.
  const scale = size * 0.47 / radius;
  const complete = useRef(onSpun);
  useEffect(() => { complete.current = onSpun; }, [onSpun]);
  useEffect(() => {
    if (!spinning) { rotation.setValue(angle); return; }
    const target = Math.floor(Math.random() * 360);
    const animation = Animated.timing(rotation, { toValue: angle - 360 * 5 - ((angle - target + 360) % 360), duration: 3200, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start(({ finished }) => { if (finished) complete.current(target); });
    return () => animation.stop();
  }, [spinning, angle, rotation]);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={{ width: size, height: size }}>
    <View style={styles.ring} />
    <Animated.View pointerEvents="none" style={[styles.frame, { transform: [{ rotate: rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }] }]}>
      <View style={{
        position: 'absolute',
        left: size / 2 - pivotX * scale,
        top: size / 2 - pivotY * scale,
        width: visibleWidth * scale,
        height: visibleHeight * scale,
      }}>
        <GunVisual armed={armed} scale={scale} anchorX={gunBounds.left} anchorY={gunBounds.top} />
      </View>
    </Animated.View>
  </Pressable>;
}
const styles = StyleSheet.create({
  ring: { ...StyleSheet.absoluteFill, borderRadius: 1000, borderWidth: 1, borderColor: '#FFFFFF20', backgroundColor: '#FFFFFF08' },
  // A full-size frame rotates around the center of the ring.
  frame: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
});
