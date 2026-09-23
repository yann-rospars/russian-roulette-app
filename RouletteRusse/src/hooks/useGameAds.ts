import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { getMobileAdsSdk, type MobileAdsSdk } from '@/ads/mobileAds';
import { InterstitialController } from '@/ads/InterstitialController';
import { selectAdUnits } from '@/constants/ads';
import type { Phase } from '@/types/game';

export function useGameAds(phase: Phase) {
  const [sdk, setSdk] = useState<MobileAdsSdk | null>(null);
  const [ready, setReady] = useState(false);
  const [privacyRequired, setPrivacyRequired] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [privacyError, setPrivacyError] = useState(false);
  const currentPhase = useRef(phase);
  const controller = useRef<InterstitialController | null>(null);
  const resumeConsent = useRef<(() => Promise<void>) | null>(null);
  const privacyAction = useRef<(() => Promise<void>) | null>(null);
  const units = sdk && (Platform.OS === 'ios' || Platform.OS === 'android')
    ? selectAdUnits(Platform.OS, __DEV__, Constants.expoConfig?.extra?.productionAds === true, sdk.TestIds)
    : null;

  useEffect(() => {
    const nativeSdk = getMobileAdsSdk();
    if (!nativeSdk || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
    const adUnits = selectAdUnits(Platform.OS, __DEV__, Constants.expoConfig?.extra?.productionAds === true, nativeSdk.TestIds);
    const ads = new InterstitialController(() => {
      const ad = nativeSdk.InterstitialAd.createForAdRequest(adUnits.interstitial);
      const events = {
        loaded: nativeSdk.AdEventType.LOADED,
        opened: nativeSdk.AdEventType.OPENED,
        closed: nativeSdk.AdEventType.CLOSED,
        error: nativeSdk.AdEventType.ERROR,
      };
      return {
        load: () => ad.load(), show: () => ad.show(), destroy: () => ad.destroy(),
        listen: (event, callback) => ad.addAdEventListener(events[event], callback),
      };
    });
    controller.current = ads;
    let disposed = false;
    let busy = false;
    let infoRequested = false;
    let initialization: Promise<unknown> | undefined;

    const syncConsent = async () => {
      const info = await nativeSdk.AdsConsent.getConsentInfo();
      if (disposed) return;
      setPrivacyRequired(info.privacyOptionsRequirementStatus === nativeSdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
      if (!info.canRequestAds) {
        setReady(false);
        ads.setEnabled(false);
        return;
      }
      initialization ??= nativeSdk.default().initialize().catch(error => {
        initialization = undefined;
        throw error;
      });
      await initialization;
      if (disposed) return;
      setSdk(nativeSdk);
      setReady(true);
      ads.setEnabled(true);
    };

    const consent = async () => {
      if (busy || disposed) return;
      busy = true;
      try {
        if (!infoRequested) {
          await nativeSdk.AdsConsent.requestInfoUpdate();
          infoRequested = true;
        }
        if (disposed) return;
        const info = await nativeSdk.AdsConsent.getConsentInfo();
        if (disposed) return;
        // A delayed network response must not start a consent flow mid-game.
        // If the player has left Home, wait until they return to it.
        if (currentPhase.current === 'home' && AppState.currentState === 'active') {
          await nativeSdk.AdsConsent.loadAndShowConsentFormIfRequired();
        } else if (info.status === nativeSdk.AdsConsentStatus.REQUIRED) {
          return;
        }
        await syncConsent();
      } catch (error) {
        if (__DEV__) console.warn('Consentement/AdMob indisponible, le jeu reste accessible.', error);
        // UMP may allow ads with a valid choice from an earlier launch.
        try { await syncConsent(); } catch { /* Continue without advertising. */ }
      } finally {
        busy = false;
      }
    };
    resumeConsent.current = consent;
    privacyAction.current = async () => {
      if (busy || disposed || currentPhase.current !== 'home') return;
      busy = true;
      setPrivacyBusy(true);
      setPrivacyError(false);
      setReady(false);
      ads.setEnabled(false); // Invalidate all ads loaded with previous choices.
      try {
        await nativeSdk.AdsConsent.showPrivacyOptionsForm();
      } catch {
        if (!disposed) setPrivacyError(true);
      } finally {
        try { await syncConsent(); } catch { /* Continue without advertising. */ }
        if (!disposed) {
          setRevision(value => value + 1);
          setPrivacyBusy(false);
        }
        busy = false;
      }
    };
    void consent();
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') return;
      ads.preload();
      if (currentPhase.current === 'home') void consent();
    });
    return () => {
      disposed = true;
      subscription.remove();
      resumeConsent.current = null;
      privacyAction.current = null;
      controller.current = null;
      ads.dispose();
    };
  }, []);

  useEffect(() => {
    currentPhase.current = phase;
    controller.current?.observePhase(phase);
    if (phase === 'home') void resumeConsent.current?.();
  }, [phase]);

  return {
    sdk, units, ready, revision, privacyRequired, privacyBusy, privacyError,
    showPrivacyOptions: () => { void privacyAction.current?.(); },
    restart: (onContinue: () => void) => {
      if (currentPhase.current !== 'result') return;
      if (!controller.current) onContinue();
      else controller.current.restart(() => {
        if (currentPhase.current === 'result') onContinue();
      }, AppState.currentState === 'active');
    },
  };
}
