/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/utils/gameLogic.ts'), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject });
const { createCylinder, toggleBullet, nextChamber, resetGame, gameReducer } = exportsObject;

for (const [count, bulletIndex] of [[6, 2], [8, 0], [12, 11]]) {
  test(`${count} chambers: ordered shots, orientation independent, reset`, () => {
    let state = resetGame('configure');
    state = gameReducer(state, { type: 'resize', count });
    assert.equal(state.chambers.length, count);
    assert.equal(gameReducer(state, { type: 'confirm' }).phase, 'configure');
    state = gameReducer(state, { type: 'toggle', index: bulletIndex });
    const original = [...state.chambers];
    state = gameReducer(state, { type: 'confirm' });
    assert.equal(gameReducer(state, { type: 'start', chamberIndex: 0 }).phase, 'table');
    state = gameReducer(state, { type: 'spun', angle: 359 });
    state = gameReducer(state, { type: 'spun', angle: 42 });
    state = gameReducer(state, { type: 'start', chamberIndex: 0 });
    assert.equal(state.currentChamberIndex, 0);
    assert.equal(state.angle, 42);
    const outcomes = [];
    for (let i = 0; i <= bulletIndex; i++) {
      assert.equal(gameReducer(state, { type: 'fire' }), state);
      state = gameReducer(state, { type: 'arm' });
      state = gameReducer(state, { type: 'fire' });
      outcomes.push(state.phase === 'result' ? 'BOOM' : 'CLICK');
      assert.equal(state.armed, false);
      assert.equal(state.currentChamberIndex, (i + 1) % count);
    }
    assert.deepEqual(outcomes, [...Array(bulletIndex).fill('CLICK'), 'BOOM']);
    assert.deepEqual([...state.chambers], original);
    assert.equal(gameReducer(state, { type: 'arm' }), state);
    for (const phase of ['home', 'configure']) {
      const reset = gameReducer(state, { type: 'reset', phase });
      assert.equal(reset.phase, phase);
      assert.equal(reset.currentChamberIndex, 0);
      assert.equal(reset.chambers.some(Boolean), false);
      assert.equal(reset.angle, 0);
      assert.equal(reset.armed, false);
      assert.equal(reset.shots, 0);
    }
  });
}
test('toggle is immutable and reversible; chamber wraps', () => {
  const initial = createCylinder(6);
  const loaded = toggleBullet(initial, 2);
  assert.equal(initial[2], false);
  assert.equal(loaded[2], true);
  assert.equal(toggleBullet(loaded, 2)[2], false);
  for (const count of [6, 8, 12]) assert.equal(nextChamber(count - 1, count), 0);
});

for (const count of [6, 8, 12]) {
  test(`${count} chambers: every starting position preserves bullets and cyclic firing order`, () => {
    for (let start = 0; start < count; start++) {
      let state = resetGame('configure');
      state = gameReducer(state, { type: 'resize', count });
      for (const index of [0, 2]) state = gameReducer(state, { type: 'toggle', index });
      const original = [...state.chambers];
      state = gameReducer(state, { type: 'confirm' });
      state = gameReducer(state, { type: 'spun', angle: 42 });
      for (const chamberIndex of [-1, count, 1.5, NaN]) {
        assert.equal(gameReducer(state, { type: 'start', chamberIndex }), state);
      }
      state = gameReducer(state, { type: 'start', chamberIndex: start });
      assert.equal(state.currentChamberIndex, start);
      assert.equal(gameReducer(state, { type: 'start', chamberIndex: (start + 1) % count }), state);
      for (let shot = 0; shot < count; shot++) {
        const index = (start + shot) % count;
        assert.equal(state.currentChamberIndex, index);
        state = gameReducer(state, { type: 'arm' });
        state = gameReducer(state, { type: 'fire' });
        assert.deepEqual([...state.chambers], original);
        assert.equal(state.chambers.filter(Boolean).length, 2);
        assert.equal(state.currentChamberIndex, (index + 1) % count);
        assert.equal(state.phase, original[index] ? 'result' : 'playing');
        if (state.phase === 'result') break;
      }
      assert.equal(state.phase, 'result');
    }
  });
}
