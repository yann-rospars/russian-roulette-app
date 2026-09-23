/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTs(relativePath, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => dependencies[name], ...globals });
  return exports;
}
const constants = loadTs('../src/constants/ads.ts');

function fixture() {
  let now = 1_000;
  let timerId = 0;
  const timers = new Map();
  const { InterstitialController } = loadTs('../src/ads/InterstitialController.ts', {
    '../constants/ads': constants,
  }, {
    Date: { now: () => now },
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, at: now + delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
  });
  const ads = [];
  const controller = new InterstitialController(() => {
    const listeners = new Map();
    const ad = {
      loads: 0, shows: 0, destroyed: false, rejectShow: false, throwShow: false,
      load() { this.loads++; },
      show() {
        this.shows++;
        if (this.throwShow) throw new Error('native presentation unavailable');
        return this.rejectShow ? Promise.reject(new Error('no activity')) : Promise.resolve();
      },
      destroy() { this.destroyed = true; },
      listen(event, callback) { listeners.set(event, callback); return () => listeners.delete(event); },
      emit(event) { listeners.get(event)?.(); },
    };
    ads.push(ad);
    return ad;
  });
  const complete = () => { controller.observePhase('playing'); controller.observePhase('result'); };
  const completeThree = () => { complete(); complete(); complete(); };
  const advance = ms => {
    const until = now + ms;
    for (;;) {
      const next = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    now = until;
  };
  return { controller, ads, complete, completeThree, advance, timers };
}

for (const platform of ['ios', 'android']) {
  test(`${platform}: development always uses Google test IDs; production needs both guards`, () => {
    const tests = { ADAPTIVE_BANNER: 'official-test-banner', INTERSTITIAL: 'official-test-interstitial' };
    for (const [dev, production] of [[true, true], [true, false], [false, false]]) {
      const units = constants.selectAdUnits(platform, dev, production, tests);
      assert.equal(units.banner, tests.ADAPTIVE_BANNER);
      assert.equal(units.interstitial, tests.INTERSTITIAL);
    }
    assert.equal(constants.selectAdUnits(platform, false, true, tests), constants.PRODUCTION_AD_UNITS[platform]);
  });
}

test('ads remain unloaded before UMP authorization', () => {
  const { controller, ads } = fixture();
  controller.preload();
  assert.equal(ads.length, 0);
  controller.setEnabled(true);
  assert.equal(ads[0].loads, 1);
});

test('only games 3 and 6 show on restart, then wait for close and preload the next ad', () => {
  const { controller, ads, complete } = fixture();
  controller.setEnabled(true);
  let resumed = 0;
  for (let game = 1; game <= 6; game++) {
    const ad = ads.at(-1);
    ad.emit('loaded');
    complete();
    controller.observePhase('result'); // A rerender is not another completed game.
    assert.equal(ad.shows, 0);
    controller.restart(() => resumed++, true);
    if (game % 3 === 0) {
      assert.equal(ad.shows, 1);
      assert.equal(resumed, game - 1);
      controller.restart(() => resumed++, true); // Double tap while opening.
      assert.equal(ad.shows, 1);
      ad.emit('opened');
      ad.emit('closed');
      assert.equal(ad.destroyed, true);
      assert.equal(ads.at(-1).loads, 1);
    }
    assert.equal(resumed, game);
    controller.observePhase('configure');
  }
});

test('abandoning a game does not count; Home after BOOM counts but never shows an ad', () => {
  const { controller, ads, complete } = fixture();
  controller.setEnabled(true);
  ads[0].emit('loaded');
  for (let i = 0; i < 5; i++) {
    controller.observePhase('playing');
    controller.observePhase('home');
  }
  complete(); controller.observePhase('home');
  complete(); controller.observePhase('home');
  assert.equal(ads[0].shows, 0);
  complete();
  controller.restart(() => {}, true);
  assert.equal(ads[0].shows, 1);
  controller.dispose();
});

test('not loaded at game 3: return immediately and never show a late load on game 4', () => {
  const { controller, ads, completeThree, complete } = fixture();
  controller.setEnabled(true);
  completeThree();
  let resumed = 0;
  controller.restart(() => resumed++, true);
  assert.equal(resumed, 1);
  ads[0].emit('loaded');
  assert.equal(ads[0].shows, 0);
  complete();
  controller.restart(() => resumed++, true);
  assert.equal(resumed, 2);
  assert.equal(ads[0].shows, 0);
});

for (const failure of ['event', 'rejection', 'throw', 'timeout']) {
  test(`presentation ${failure}: resume exactly once and retry loading later`, async () => {
    const { controller, ads, completeThree, advance } = fixture();
    controller.setEnabled(true);
    const ad = ads[0];
    ad.emit('loaded');
    completeThree();
    ad.rejectShow = failure === 'rejection';
    ad.throwShow = failure === 'throw';
    let resumed = 0;
    controller.restart(() => resumed++, true);
    if (failure === 'event') ad.emit('error');
    if (failure === 'timeout') advance(5_000);
    await Promise.resolve();
    assert.equal(resumed, 1);
    assert.equal(ad.destroyed, true);
    ad.emit('closed');
    assert.equal(resumed, 1);
    advance(30_000);
    assert.equal(ads.length, 2);
    controller.dispose();
  });
}

test('an opened ad is not interrupted by the presentation watchdog', () => {
  const { controller, ads, completeThree, advance } = fixture();
  controller.setEnabled(true);
  ads[0].emit('loaded');
  completeThree();
  let resumed = false;
  controller.restart(() => { resumed = true; }, true);
  ads[0].emit('opened');
  advance(90_000);
  assert.equal(resumed, false);
  ads[0].emit('closed');
  assert.equal(resumed, true);
});

test('offline loads time out and retry with backoff without holding navigation', () => {
  const { controller, ads, completeThree, advance } = fixture();
  controller.setEnabled(true);
  advance(20_000);
  assert.equal(ads[0].destroyed, true);
  completeThree();
  let resumed = false;
  controller.restart(() => { resumed = true; }, true);
  assert.equal(resumed, true);
  assert.equal(ads[0].shows, 0);
  controller.dispose();
  advance(200_000);
  assert.equal(ads.length, 2);
});

test('backgrounded or expired ads are skipped', () => {
  for (const scenario of ['background', 'expired']) {
    const { controller, ads, completeThree, advance } = fixture();
    controller.setEnabled(true);
    ads[0].emit('loaded');
    if (scenario === 'expired') advance(56 * 60_000);
    completeThree();
    let resumed = false;
    controller.restart(() => { resumed = true; }, scenario !== 'background');
    assert.equal(resumed, true);
    assert.equal(ads[0].shows, 0);
    controller.dispose();
  }
});

test('changing consent destroys cached ads; disposal cancels all listeners and retries', () => {
  const { controller, ads, timers, advance } = fixture();
  controller.setEnabled(true);
  ads[0].emit('loaded');
  controller.setEnabled(false);
  assert.equal(ads[0].destroyed, true);
  controller.preload();
  assert.equal(ads.length, 1);
  controller.setEnabled(true);
  assert.equal(ads.length, 2);
  controller.dispose();
  assert.equal(timers.size, 0);
  ads[1].emit('error');
  advance(120_000);
  assert.equal(ads.length, 2);
});

test('Expo config enables live ads only with the explicit production profile and flag', () => {
  const configSource = fs.readFileSync(path.join(__dirname, '../app.config.js'), 'utf8');
  for (const profile of [undefined, 'development', 'preview', 'production']) {
    for (const flag of [undefined, 'false', 'true']) {
      const module = { exports: {} };
      vm.runInNewContext(configSource, { module, process: { env: { EAS_BUILD_PROFILE: profile, ADMOB_PRODUCTION_ADS: flag } } });
      const result = module.exports({ config: { extra: { eas: { projectId: 'existing-project' } } } });
      assert.equal(result.extra.productionAds, profile === 'production' && flag === 'true');
      assert.equal(result.extra.eas.projectId, 'existing-project');
    }
  }
});
