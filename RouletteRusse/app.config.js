module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    // Fail closed: local exports, development and preview builds use test ads.
    // __DEV__ adds a second, unconditional guard in the application itself.
    productionAds: process.env.EAS_BUILD_PROFILE === 'production'
      && process.env.ADMOB_PRODUCTION_ADS === 'true',
  },
});
