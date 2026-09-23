import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import type { GameAction } from '@/types/game';
import { gameReducer, hasBullet, resetGame } from '@/utils/gameLogic';
import { useGameAudio } from './useGameAudio';

export function useGame() {
  const [state, setState] = useState(resetGame);
  const current = useRef(state);
  const audio = useGameAudio();
  // Synchronous state prevents rapid taps from reusing the same chamber.
  const dispatch = useCallback((action: GameAction) => {
    current.current = gameReducer(current.current, action);
    setState(current.current);
  }, []);
  const cooldown = useRef(0);
  return { state, audio, dispatch,
    reset: (phase: 'home' | 'configure') => { audio.stopAll(); cooldown.current = 0; dispatch({ type: 'reset', phase }); },
    toggle: (index: number) => {
      if (current.current.phase !== 'configure') return;
      if (!hasBullet(current.current.chambers, index)) audio.putBullet();
      dispatch({ type: 'toggle', index });
    },
    trigger: () => {
      const game = current.current;
      if (game.phase !== 'playing' || Date.now() < cooldown.current) return;
      cooldown.current = Date.now() + 400;
      if (!game.armed) { dispatch({ type: 'arm' }); audio.arm(); return; }
      const loaded = hasBullet(game.chambers, game.currentChamberIndex);
      audio.fire(loaded);
      dispatch({ type: 'fire' });
      void Haptics.impactAsync(loaded ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
  };
}
