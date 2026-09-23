import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { GameAudio, type Sound } from '@/utils/gameAudio';

const sources: Record<Sound, number> = {
  shot: require('../../assets/sounds/gunshot.mp3'),
  click: require('../../assets/sounds/gunshot_fail.mp3'),
  bullet: require('../../assets/sounds/put_bullet.mp3'),
  reload: require('../../assets/sounds/reload.mp3'),
  music: require('../../assets/sounds/music.mp3'),
};

export function useGameAudio() {
  const engine = useRef<GameAudio | null>(null);
  const enabled = useRef(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const controller = new GameAudio({
      // Persistent native handles preload each asset once. Keeping the session active
      // avoids deactivating iOS audio between pausing music and starting the shot.
      create: sound => createAudioPlayer(sources[sound], { keepAudioSessionActive: true, updateInterval: 50 }),
      configure: () => setAudioModeAsync({
        playsInSilentMode: true, allowsRecording: false,
        shouldPlayInBackground: false, interruptionMode: 'mixWithOthers',
      }),
      onError: (sound, error) => {
        console.warn(`[GameAudio:${sound}]`, error);
        if (mounted) setAudioError(true);
      },
      onRecovered: () => { if (mounted) setAudioError(false); },
    });
    engine.current = controller;
    controller.setMusicEnabled(enabled.current);
    controller.setActive(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
    const subscription = AppState.addEventListener('change', state => controller.setActive(state === 'active'));
    return () => {
      mounted = false;
      engine.current = null;
      subscription.remove();
      controller.dispose();
    };
  }, []);

  const stopAll = useCallback(() => engine.current?.stopAll(), []);
  const putBullet = useCallback(() => engine.current?.putBullet(), []);
  const arm = useCallback(() => engine.current?.arm(), []);
  const fire = useCallback((loaded: boolean) => engine.current?.fire(loaded), []);
  const toggleMusic = useCallback(() => {
    enabled.current = !enabled.current;
    setMusicEnabled(enabled.current);
    engine.current?.setMusicEnabled(enabled.current);
  }, []);
  return { musicEnabled, audioError, stopAll, putBullet, arm, fire, toggleMusic };
}
