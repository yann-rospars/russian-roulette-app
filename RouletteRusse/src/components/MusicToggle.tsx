import { PrimaryButton } from './PrimaryButton';
export function MusicToggle({ enabled, onPress }: { enabled: boolean; onPress: () => void }) {
  return <PrimaryButton small symbol={enabled ? '♫' : '♪̸'} label={enabled ? 'Mute music' : 'Play music'} onPress={onPress} />;
}
