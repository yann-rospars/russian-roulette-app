export type MobileAdsSdk = typeof import('react-native-google-mobile-ads');

// Web never imports the native SDK, including during Expo's static rendering.
export function getMobileAdsSdk(): MobileAdsSdk | null {
  return null;
}
