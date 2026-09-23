import Constants, { ExecutionEnvironment } from 'expo-constants';

export type MobileAdsSdk = typeof import('react-native-google-mobile-ads');

export function getMobileAdsSdk(): MobileAdsSdk | null {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    // A native import at module scope would crash Expo Go before this guard runs.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-google-mobile-ads') as MobileAdsSdk;
  } catch (error) {
    if (__DEV__) console.warn('AdMob indisponible : reconstruire le Development Build.', error);
    return null;
  }
}
