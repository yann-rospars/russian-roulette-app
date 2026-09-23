import { Pressable, StyleSheet, Text } from 'react-native';

interface Props { label: string; onPress: () => void; symbol: string; caption?: string; disabled?: boolean; small?: boolean }
export function PrimaryButton({ label, onPress, symbol, caption, disabled, small }: Props) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, small && styles.small, disabled && styles.disabled, pressed && styles.pressed]}>
    <Text style={[styles.symbol, small && styles.smallSymbol]}>{symbol}</Text>
    {caption && <Text style={styles.caption}>{caption}</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minWidth: 100, minHeight: 76, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 28, backgroundColor: '#F3F5EF', alignItems: 'center', justifyContent: 'center', gap: 4 },
  small: { minWidth: 52, minHeight: 52, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  symbol: { color: '#103F64', fontSize: 36, fontWeight: '700' }, smallSymbol: { fontSize: 24 },
  caption: { color: '#103F64', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  disabled: { opacity: 0.3 }, pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
});
