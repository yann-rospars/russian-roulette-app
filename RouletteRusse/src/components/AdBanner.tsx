import { Component, useEffect, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import type { MobileAdsSdk } from '@/ads/mobileAds';

class AdErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function Banner({ sdk, unitId }: { sdk: MobileAdsSdk; unitId: string }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!failed) return;
    const retry = setTimeout(() => { setFailed(false); setAttempt(value => value + 1); }, 60_000);
    return () => clearTimeout(retry);
  }, [failed]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') { setFailed(false); setAttempt(value => value + 1); }
    });
    return () => subscription.remove();
  }, []);
  if (failed) return null;
  return <sdk.BannerAd key={attempt} unitId={unitId}
    size={sdk.BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
    onAdFailedToLoad={() => setFailed(true)} />;
}

export function AdBanner({ sdk, unitId }: { sdk: MobileAdsSdk; unitId: string }) {
  return <View style={styles.slot}>
    <AdErrorBoundary><Banner sdk={sdk} unitId={unitId} /></AdErrorBoundary>
  </View>;
}

const styles = StyleSheet.create({
  // A normal flex sibling of the ScrollView: never covers a game control.
  slot: { flexShrink: 0, alignItems: 'center', minHeight: 50, paddingTop: 8 },
});
