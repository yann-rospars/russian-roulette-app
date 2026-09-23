import type { ChamberCount, GameAction, GameState } from '../types/game';

export function createCylinder(count: ChamberCount): boolean[] {
  return Array.from({ length: count }, () => false);
}
export function toggleBullet(chambers: boolean[], index: number): boolean[] {
  return chambers.map((loaded, i) => i === index ? !loaded : loaded);
}
export function hasBullet(chambers: boolean[], index: number): boolean {
  return chambers[index] === true;
}
export function nextChamber(index: number, count: number): number {
  return (index + 1) % count;
}
export function resetGame(phase: 'home' | 'configure' = 'home'): GameState {
  return { phase, chambers: createCylinder(6), currentChamberIndex: 0, armed: false, angle: 0, hasSpun: false, shots: 0 };
}
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'reset': return resetGame(action.phase);
    case 'resize': return state.phase === 'configure' ? { ...state, chambers: createCylinder(action.count) } : state;
    case 'toggle': return state.phase === 'configure' ? { ...state, chambers: toggleBullet(state.chambers, action.index) } : state;
    case 'confirm': return state.phase === 'configure' && state.chambers.some(Boolean) ? { ...state, phase: 'table' } : state;
    case 'spun': return state.phase === 'table' ? { ...state, angle: action.angle, hasSpun: true } : state;
    case 'start':
      if (state.phase !== 'table' || !state.hasSpun || !Number.isInteger(action.chamberIndex)
        || action.chamberIndex < 0 || action.chamberIndex >= state.chambers.length) return state;
      // Spin the cylinder once: preserve the load order and advance normally after each shot.
      return { ...state, phase: 'playing', currentChamberIndex: action.chamberIndex };
    case 'arm': return state.phase === 'playing' && !state.armed ? { ...state, armed: true } : state;
    case 'fire':
      if (state.phase !== 'playing' || !state.armed) return state;
      return { ...state, armed: false, shots: state.shots + 1,
        phase: hasBullet(state.chambers, state.currentChamberIndex) ? 'result' : 'playing',
        currentChamberIndex: nextChamber(state.currentChamberIndex, state.chambers.length) };
  }
}
