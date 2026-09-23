/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/utils/gameAudio.ts'), 'utf8');
const moduleExports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: moduleExports, setTimeout, clearTimeout, Date,
});
const { GameAudio } = moduleExports;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate) {
  const end = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > end) throw new Error('Test condition timed out');
    await delay(2);
  }
}
function setup(t, options = {}) {
  const events = [];
  const errors = [];
  const players = {};
  const creations = {};
  let configurations = 0;
  const engine = new GameAudio({
    timeoutMs: 100, pollMs: 2,
    configure: async () => {
      configurations++;
      if (options.failSession && configurations === 1) throw new Error('Session unavailable');
    },
    onError: (sound, error) => errors.push({ sound, error }), onRecovered: () => {},
    create: sound => {
      const attempt = creations[sound] = (creations[sound] || 0) + 1;
      const listeners = new Set();
      let timer;
      const player = {
        isLoaded: !options.unloaded?.includes(sound), playing: false,
        currentTime: (options.failSeek === sound || options.hangSeek === sound) && attempt === 1 ? 0.5 : 0,
        duration: 0.03, loop: false, volume: 1,
        play() {
          events.push(`request:${sound}`);
          if (options.silent === sound || (options.failStart === sound && attempt === 1)) return;
          this.playing = true;
          events.push(`play:${sound}`);
          for (const listener of listeners) listener({ playing: true, didJustFinish: false });
          if (!this.loop) timer = setTimeout(() => {
            this.playing = false; this.currentTime = this.duration;
            events.push(`end:${sound}`);
            for (const listener of listeners) listener({ playing: false, didJustFinish: true });
          }, 30);
        },
        pause() { clearTimeout(timer); this.playing = false; events.push(`stop:${sound}`); },
        async seekTo() {
          events.push(`seek:${sound}`);
          if (options.hangSeek === sound && attempt === 1) await new Promise(() => {});
          if (options.failSeek === sound && attempt === 1) throw new Error('Seek failed');
          this.currentTime = 0;
        },
        remove() { this.pause(); listeners.clear(); events.push(`remove:${sound}`); },
        addListener(_, listener) { listeners.add(listener); return { remove: () => listeners.delete(listener) }; },
      };
      players[sound] = player;
      return player;
    },
  });
  t.after(() => engine.dispose());
  return { engine, events, errors, players, creations };
}

test('first shot plays directly with no native seek; music stops before it', async t => {
  const { engine, events } = setup(t);
  engine.arm(); await waitFor(() => events.includes('play:music'));
  events.length = 0;
  engine.fire(true); await waitFor(() => events.includes('play:shot'));
  assert.ok(events.indexOf('stop:music') < events.indexOf('play:shot'));
  assert.ok(!events.includes('seek:shot'));
});
test('reload completes before suspense; music toggle leaves effects untouched', async t => {
  const { engine, events } = setup(t);
  engine.setMusicEnabled(false); engine.arm();
  await waitFor(() => events.includes('end:reload'));
  await delay(10);
  assert.ok(!events.includes('play:music'));
  engine.setMusicEnabled(true); await waitFor(() => events.includes('play:music'));
  assert.ok(events.indexOf('end:reload') < events.indexOf('play:music'));
  engine.setMusicEnabled(false); engine.fire(false);
  await waitFor(() => events.includes('play:click'));
});
test('rapid bullet taps queue every sound without overlap or reloading assets', async t => {
  const { engine, events, creations } = setup(t);
  for (let i = 0; i < 8; i++) engine.putBullet();
  await waitFor(() => events.filter(x => x === 'end:bullet').length === 8);
  assert.equal(creations.bullet, 1);
  const playback = events.filter(x => x === 'play:bullet' || x === 'end:bullet');
  assert.deepEqual(playback, Array.from({ length: 8 }, () => ['play:bullet', 'end:bullet']).flat());
});
test('shot bypasses unloaded reload and prevents late suspense', async t => {
  const { engine, events, players } = setup(t, { unloaded: ['reload'] });
  engine.arm(); await delay(5); engine.fire(true);
  await waitFor(() => events.includes('play:shot'));
  players.reload.isLoaded = true; await delay(40);
  assert.ok(!events.includes('play:reload'));
  assert.ok(!events.includes('play:music'));
});
test('a pending shot waits for loading instead of disappearing', async t => {
  const { engine, players, events } = setup(t, { unloaded: ['shot'] });
  engine.fire(true); await delay(15);
  assert.ok(!events.includes('play:shot'));
  players.shot.isLoaded = true;
  await waitFor(() => events.includes('play:shot'));
});
for (const failure of ['failStart', 'failSeek', 'hangSeek', 'failSession']) {
  test(`recovers from ${failure} with a single audible shot`, async t => {
    const { engine, events, errors } = setup(t, { [failure]: failure === 'failSession' ? true : 'shot' });
    engine.fire(true); await waitFor(() => events.includes('end:shot'));
    assert.equal(events.filter(x => x === 'play:shot').length, 1);
    assert.equal(errors.length, 0);
  });
}
test('failed playback retries once then reports an error, without infinite retries', async t => {
  const { engine, errors, creations } = setup(t, { silent: 'shot' });
  engine.fire(true); await waitFor(() => errors.length > 0);
  assert.equal(creations.shot, 2);
  assert.equal(errors[0].sound, 'shot');
});
test('next reload cannot cut off a click already playing', async t => {
  const { engine, events } = setup(t);
  engine.fire(false); await waitFor(() => events.includes('play:click'));
  engine.arm(); await waitFor(() => events.includes('play:reload'));
  assert.ok(events.indexOf('end:click') < events.indexOf('play:reload'));
});
test('leaving cancels queued playback; repeated sessions remain usable', async t => {
  const { engine, events, players } = setup(t, { unloaded: ['shot'] });
  engine.fire(true); await delay(5); engine.stopAll();
  players.shot.isLoaded = true; await delay(15);
  assert.ok(!events.includes('play:shot'));
  for (let i = 0; i < 3; i++) {
    engine.fire(false);
    await waitFor(() => events.filter(x => x === 'end:click').length === i + 1);
    engine.stopAll();
  }
});
test('background cancels pending shots; foreground restores only wanted suspense', async t => {
  const { engine, events, players } = setup(t, { unloaded: ['shot'] });
  engine.fire(true); engine.setActive(false); players.shot.isLoaded = true;
  engine.setActive(true); await delay(15);
  assert.ok(!events.includes('play:shot'));
  engine.arm(); await waitFor(() => events.includes('play:music'));
  engine.setActive(false); engine.setActive(true);
  await waitFor(() => events.filter(x => x === 'play:music').length === 2);
  engine.stopAll(); engine.setActive(false); engine.setActive(true); await delay(15);
  assert.equal(events.filter(x => x === 'play:music').length, 2);
});
test('dispose releases every reader and cancels pending work', async t => {
  const { engine, events } = setup(t);
  engine.arm(); engine.dispose(); await delay(15);
  assert.equal(events.filter(x => x.startsWith('remove:')).length, 5);
  assert.ok(!events.some(x => x.startsWith('play:')));
});
test('cancelled seek cannot affect the reader used in a new game', async t => {
  const { engine, events, creations } = setup(t, { hangSeek: 'shot' });
  engine.fire(true); await waitFor(() => events.includes('seek:shot'));
  engine.stopAll(); engine.fire(true);
  await waitFor(() => events.includes('end:shot'));
  assert.equal(creations.shot, 2);
  assert.equal(events.filter(x => x === 'play:shot').length, 1);
});
