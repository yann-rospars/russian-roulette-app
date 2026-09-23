import { Image, StyleSheet, View } from 'react-native';

// Bounds of the non-transparent pixels, shared by both gun images.
export const gunBounds = { left: 41, top: 431, right: 832, bottom: 845 };
export const gunDimensions = { width: 853, height: 1280 };

export function GunVisual({ armed, scale, anchorX, anchorY }: {
  armed: boolean;
  scale: number;
  anchorX: number;
  anchorY: number;
}) {
  const frame = {
    width: gunDimensions.width * scale,
    height: gunDimensions.height * scale,

    left: -anchorX * scale,
    top: -anchorY * scale,
  };

  return (
    <View pointerEvents="none">
      <Image
        source={require('../../assets/images/gun.png')}
        resizeMode="contain"
        style={[styles.image, frame, { opacity: armed ? 0 : 1 }]}
      />

      <Image
        source={require('../../assets/images/gun_ready.png')}
        resizeMode="contain"
        style={[styles.image, frame, { opacity: armed ? 1 : 0 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    position: 'absolute',
  },
});
