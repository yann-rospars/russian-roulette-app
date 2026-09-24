import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

const PRIVACY_POLICY_URL = 'https://yann-rospars.github.io/russian-roulette-app/Privacy/Privacy.html';

export function SettingsPanel() {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);
  const openPrivacyPolicy = async () => {
    setError(false);
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch {
      setError(true);
    }
  };

  return <View style={styles.panel}>
    <Pressable accessibilityRole="button" accessibilityLabel="Settings"
      accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.button}>
      <Text style={styles.text}>Settings</Text>
    </Pressable>
    {expanded && <>
      <Pressable accessibilityRole="link" onPress={() => { void openPrivacyPolicy(); }} style={styles.button}>
        <Text style={[styles.text, styles.link]}>Privacy Policy</Text>
      </Pressable>
      {error && <Text accessibilityRole="alert" style={styles.text}>
        Unable to open the browser. Please try again.
      </Text>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { alignItems: 'center', paddingHorizontal: 20 },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20 },
  text: { color: '#CFDFED', fontSize: 14, textAlign: 'center' },
  link: { textDecorationLine: 'underline' },
});
