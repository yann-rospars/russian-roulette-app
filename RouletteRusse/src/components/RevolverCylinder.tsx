import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

function Chamber({ loaded, index, size, x, y, onPress }: { loaded: boolean; index: number; size: number; x: number; y: number; onPress: () => void }) {
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!loaded) return;
    const animation = Animated.sequence([Animated.timing(scale, { toValue: 1.14, duration: 90, useNativeDriver: true }), Animated.spring(scale, { toValue: 1, useNativeDriver: true })]);
    animation.start();
    return () => animation.stop();
  }, [loaded, scale]);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${loaded ? 'Retirer' : 'Ajouter'} une balle, chambre ${index + 1}`} accessibilityState={{ selected: loaded }}
    onPress={onPress} style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size }}>
    <Animated.View style={[styles.chamber, { transform: [{ scale }] }, loaded && styles.loaded]}>
      <Text style={[styles.number, loaded && styles.loadedNumber]}>{index + 1}</Text>
    </Animated.View>
  </Pressable>;
}
export function RevolverCylinder({ chambers, size, onToggle }: { chambers: boolean[]; size: number; onToggle: (index: number) => void }) {
  const radius = size * 0.37;
  const chamberSize = Math.min(size * 0.19, 2 * radius * Math.sin(Math.PI / chambers.length) * 0.86);
  return <View style={[styles.cylinder, { width: size, height: size, borderRadius: size / 2 }]}>
    <View style={styles.hub}><Text style={styles.hubText}>↻</Text></View>
    {chambers.map((loaded, i) => {
      const angle = i * Math.PI * 2 / chambers.length - Math.PI / 2;
      return <Chamber key={`${chambers.length}-${i}`} index={i} loaded={loaded} size={chamberSize} x={size / 2 + radius * Math.cos(angle)} y={size / 2 + radius * Math.sin(angle)} onPress={() => onToggle(i)} />;
    })}
  </View>;
}
const styles = StyleSheet.create({
  cylinder: { backgroundColor: '#16466A', borderWidth: 5, borderColor: '#76A5C4', alignItems: 'center', justifyContent: 'center' },
  hub: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: '#76A5C4', alignItems: 'center', justifyContent: 'center' },
  hubText: { fontSize: 30, color: '#AAC8DC' },
  chamber: { flex: 1, borderRadius: 100, backgroundColor: '#082A44', borderWidth: 2, borderColor: '#6086A0', justifyContent: 'center', alignItems: 'center' },
  loaded: { backgroundColor: '#E4B765', borderColor: '#FFE0A2', borderWidth: 4 },
  number: { color: '#9EB8CB', fontSize: 12, fontWeight: '700' }, loadedNumber: { color: '#67491D' },
});
