import { Pressable, StyleSheet, View } from 'react-native';
import { gunBounds, GunVisual } from './GunVisual';

export function PlayingGun({ width, height, armed, onPress }: {
  width: number; height: number; armed: boolean; onPress: () => void;
}) {
  const scale = Math.min(width / (gunBounds.bottom - gunBounds.top), height / (gunBounds.right - gunBounds.left)) * 0.96;
  const visibleWidth = (gunBounds.right - gunBounds.left) * scale;
  const visibleHeight = (gunBounds.bottom - gunBounds.top) * scale;
  return <Pressable accessibilityRole="button" accessibilityLabel={armed ? 'Fire' : 'Arm'} onPress={onPress} style={{ width, height, overflow: 'hidden' }}>
    <View pointerEvents="none" style={[styles.center, {
      width: visibleWidth,
      height: visibleHeight,
      left: (width - visibleWidth) / 2,
      top: (height - visibleHeight) / 2,
    }]}>
      <GunVisual armed={armed} scale={scale} anchorX={gunBounds.left} anchorY={gunBounds.top} />
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  // Rotate around the center of the visible gun, not the transparent PNG canvas.
  center: { position: 'absolute', transform: [{ rotate: '90deg' }] },
});
