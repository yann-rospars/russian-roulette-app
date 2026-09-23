export type ChamberCount = 6 | 8 | 12;
export type Phase = 'home' | 'configure' | 'table' | 'playing' | 'result';
export interface GameState {
  phase: Phase;
  chambers: boolean[];
  currentChamberIndex: number;
  armed: boolean;
  angle: number;
  hasSpun: boolean;
  shots: number;
}
export type GameAction =
  | { type: 'reset'; phase: 'home' | 'configure' }
  | { type: 'resize'; count: ChamberCount }
  | { type: 'toggle'; index: number }
  | { type: 'confirm' }
  | { type: 'spun'; angle: number }
  | { type: 'start'; chamberIndex: number }
  | { type: 'arm' }
  | { type: 'fire' };
