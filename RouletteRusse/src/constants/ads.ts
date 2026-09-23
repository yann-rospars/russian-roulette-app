// Number of completed games between interstitial opportunities (3, 6, 9...).
export const INTERSTITIAL_EVERY_N_GAMES = 3;

export const PRODUCTION_AD_UNITS = {
  android: {
    banner: 'ca-app-pub-1421478422603716/4273404965',
    interstitial: 'ca-app-pub-1421478422603716/3343466678',
  },
  ios: {
    banner: 'ca-app-pub-1421478422603716/1295636842',
    interstitial: 'ca-app-pub-1421478422603716/9947232614',
  },
} as const;

export function selectAdUnits(
  platform: 'ios' | 'android',
  development: boolean,
  productionEnabled: boolean,
  testIds: { ADAPTIVE_BANNER: string; INTERSTITIAL: string },
) {
  return !development && productionEnabled
    ? PRODUCTION_AD_UNITS[platform]
    : { banner: testIds.ADAPTIVE_BANNER, interstitial: testIds.INTERSTITIAL };
}
