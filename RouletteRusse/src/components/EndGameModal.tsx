import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from './PrimaryButton';
export function EndGameModal({ onRestart, onHome }: { onRestart: () => void; onHome: () => void }) {
  const [visible, setVisible] = useState(false);
  const restarting = useRef(false);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const restartCallback = useRef(onRestart);
  useEffect(() => { restartCallback.current = onRestart; }, [onRestart]);
  useEffect(() => () => clearTimeout(restartTimer.current), []);
  useEffect(() => { const timer = setTimeout(() => setVisible(true), 850); return () => clearTimeout(timer); }, []);
  const continueAfterDismiss = () => {
    if (!restarting.current) return;
    restarting.current = false;
    clearTimeout(restartTimer.current);
    restartCallback.current();
  };
  const restart = () => {
    if (restarting.current) return;
    restarting.current = true;
    setVisible(false);
    // iOS must release the presenting UIViewController before an ad is shown.
    // Android does not expose Modal.onDismiss; let its fade finish first.
    if (Platform.OS !== 'ios') restartTimer.current = setTimeout(continueAfterDismiss, 350);
  };
  return <Modal visible={visible} transparent animationType="fade"
    onDismiss={continueAfterDismiss} onRequestClose={() => { if (!restarting.current) onHome(); }} statusBarTranslucent navigationBarTranslucent>
    <View style={styles.overlay}><View style={styles.card} accessibilityViewIsModal>
      <Text style={styles.burst}>✹</Text>
      <PrimaryButton symbol="↻" label="Recommencer" onPress={restart} />
      <PrimaryButton small symbol="⌂" label="Accueil" onPress={onHome} />
    </View></View>
  </Modal>;
}
const styles = StyleSheet.create({ overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#620D1933', padding: 24 }, card: { width: '100%', maxWidth: 320, padding: 32, gap: 24, alignItems: 'center', borderRadius: 36, backgroundColor: '#A62032' }, burst: { fontSize: 72, color: '#FFF4DF' } });
