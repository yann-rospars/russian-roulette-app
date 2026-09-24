import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RevolverCylinder } from '@/components/RevolverCylinder';
import { GunSpinner } from '@/components/GunSpinner';
import { PlayingGun } from '@/components/PlayingGun';
import { MusicToggle } from '@/components/MusicToggle';
import { EndGameModal } from '@/components/EndGameModal';
import { useGame } from '@/hooks/useGame';
import { useGameAds } from '@/hooks/useGameAds';
import { AdBanner } from '@/components/AdBanner';
import { SettingsPanel } from '@/components/SettingsPanel';

export default function GameScreen() {
  const { state, audio, dispatch, reset, toggle, trigger } = useGame();
  const ads = useGameAds(state.phase);
  const showBanner = state.phase === 'home' || state.phase === 'configure' || state.phase === 'table';
  const [spinning, setSpinning] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const playingHeight = Math.max(240, height - insets.top - insets.bottom - 340);
  const size = Math.max(240, Math.min(width - 40, height * 0.48, 460));
  const isGun = state.phase === 'table' || state.phase === 'playing';
  const stopAll = audio.stopAll;
  useFocusEffect(useCallback(() => () => stopAll(), [stopAll]));
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state.phase === 'home') return false;
      stopAll(); setSpinning(false); dispatch({ type: 'reset', phase: 'home' }); return true;
    });
    return () => subscription.remove();
  }, [state.phase, dispatch, stopAll]);
  const goHome = () => { setSpinning(false); reset('home'); };
  return <View style={[styles.screen, state.phase === 'result' && styles.red]}>
    <StatusBar style="light" hidden={state.phase === 'result'} />
    <SafeAreaView style={styles.safe}>
      {state.phase !== 'result' && state.phase !== 'home' && <View style={styles.toolbar}>
        <PrimaryButton small symbol="⌂" label="Accueil" onPress={goHome} />
        {state.phase === 'playing' && <MusicToggle enabled={audio.musicEnabled} onPress={audio.toggleMusic} />}
      </View>}
      {state.phase === 'home' && ads.ready && ads.sdk && ads.units && <AdBanner
        key={`home-top-${ads.revision}`} sdk={ads.sdk} unitId={ads.units.banner} placement="top" />}
      <ScrollView contentContainerStyle={[styles.content, state.phase === 'home' && styles.homeContent]} bounces={false}>
        {state.phase === 'home' && <View style={styles.home}>
          <View style={styles.playHalo}><PrimaryButton symbol="▶" caption="JOUER" label="Jouer" onPress={() => reset('configure')} /></View>
        </View>}
        {state.phase === 'configure' && <>
          <View style={styles.row}>{([6, 8, 12] as const).map(count => <PrimaryButton key={count} small symbol={String(count)} caption={state.chambers.length === count ? '•' : undefined} label={`Choisir ${count} chambres${state.chambers.length === count ? ', sélectionné' : ''}`} onPress={() => dispatch({ type: 'resize', count })} />)}</View>
          <RevolverCylinder chambers={state.chambers} size={size} onToggle={toggle} />
          <Text style={styles.hint}>{state.chambers.filter(Boolean).length} / {state.chambers.length} ●</Text>
          <PrimaryButton symbol="✓" label="Continue" disabled={!state.chambers.some(Boolean)} onPress={() => { audio.stopAll(); dispatch({ type: 'confirm' }); }} />
        </>}
        {isGun && <>
          <Text style={styles.eyebrow}>{state.phase === 'table' ? 'WHO’S FIRST?' : state.armed ? 'READY' : state.shots ? 'NEXT PLAYER' : 'YOUR TURN'}</Text>
          {state.phase === 'playing' ? <PlayingGun width={width - 40} height={playingHeight} armed={state.armed} onPress={trigger} /> : <GunSpinner size={size} angle={state.angle} armed={state.armed} spinning={spinning} disabled={spinning}
            label={state.phase === 'table' ? 'Spin' : state.armed ? 'Fire' : 'Arm'}
            onPress={state.phase === 'table' ? () => setSpinning(true) : trigger}
            onSpun={angle => { dispatch({ type: 'spun', angle }); setSpinning(false); }} />}
          {state.phase === 'table' ? <>
            <View style={styles.row}>
              {state.hasSpun && <PrimaryButton small symbol="↻" label="Spin" disabled={spinning} onPress={() => setSpinning(true)} />}
              <PrimaryButton symbol="▶" label="Start" disabled={spinning || !state.hasSpun} onPress={() => dispatch({ type: 'start', chamberIndex: Math.floor(Math.random() * state.chambers.length) })} />
            </View>
          </> : <>
            <Text style={styles.hint}>{!state.armed && state.shots > 0 ? 'CLICK' : ' '}</Text>
            <PrimaryButton symbol={state.armed ? '◎' : '↟'} caption={state.armed ? 'FIRE' : 'ARM'} label={state.armed ? 'Fire' : 'Arm'} onPress={trigger} />
          </>}
        </>}
        {audio.audioError && state.phase !== 'result' && <Text accessibilityRole="alert" style={styles.hint}>Sound unavailable</Text>}
      </ScrollView>
      {state.phase === 'home' && <SettingsPanel />}
      {state.phase === 'home' && ads.privacyRequired && <Pressable
        accessibilityRole="button" accessibilityLabel="Choix de confidentialité publicitaire"
        disabled={ads.privacyBusy} onPress={ads.showPrivacyOptions} style={styles.privacy}>
        <Text style={styles.hint}>Privacy options</Text>
      </Pressable>}
      {state.phase === 'home' && ads.privacyError && <Text accessibilityRole="alert" style={styles.hint}>
        Confidentialité indisponible. Réessayez plus tard.
      </Text>}
      {showBanner && ads.ready && ads.sdk && ads.units && <AdBanner
        key={`${state.phase}-${ads.revision}`} sdk={ads.sdk} unitId={ads.units.banner} />}
      {state.phase === 'result' && <EndGameModal onRestart={() => ads.restart(() => reset('configure'))} onHome={goHome} />}
    </SafeAreaView>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1261A0' }, red: { backgroundColor: '#E32636' }, safe: { flex: 1 },
  toolbar: { height: 68, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 24, paddingBottom: 32 },
  homeContent: { paddingBottom: 20 },
  home: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playHalo: { width: 240, height: 240, borderRadius: 120, borderColor: '#FFFFFF25', borderWidth: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF08' },
  row: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  eyebrow: { color: '#D6E8F5', fontSize: 13, letterSpacing: 4, fontWeight: '700' },
  hint: { color: '#CFDFED', fontSize: 14, letterSpacing: 1, textAlign: 'center' },
  privacy: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
});
