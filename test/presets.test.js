import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, applyPreset } from '../src/state/presets.js';
import { createInitialState, clampState, LIMITS, HEX_COLOR } from '../src/state/editorState.js';

const userState = () => ({
  ...createInitialState(),
  text: '내가 쓴 문구',
  ratio: '9:16',
  image: { fake: true },
  imageName: 'my-photo.png',
});

test('프리셋은 문구·이미지·비율을 건드리지 않는다', () => {
  const before = userState();
  for (const preset of PRESETS) {
    const after = applyPreset(before, preset.id);
    assert.equal(after.text, before.text, `${preset.name}: 문구가 바뀌었다`);
    assert.equal(after.ratio, before.ratio, `${preset.name}: 비율이 바뀌었다`);
    assert.equal(after.image, before.image, `${preset.name}: 이미지가 바뀌었다`);
    assert.equal(after.imageName, before.imageName, `${preset.name}: 이미지 이름이 바뀌었다`);
  }
});

test('프리셋은 실제로 보이는 방식을 바꾼다', () => {
  const before = userState();
  for (const preset of PRESETS) {
    const after = applyPreset(before, preset.id);
    const changed = ['color', 'strokeWidth', 'fontSize', 'textY'].some(
      (key) => after[key] !== before[key]
    );
    assert.ok(changed, `${preset.name}: 아무것도 바뀌지 않았다`);
  }
});

test('모든 프리셋 값이 허용 범위 안에 있다', () => {
  for (const preset of PRESETS) {
    const applied = applyPreset(createInitialState(), preset.id);
    const clamped = clampState(applied);
    for (const key of ['color', 'strokeColor', 'bgColor']) {
      assert.ok(HEX_COLOR.test(applied[key]), `${preset.name}: ${key} 색상 형식 오류`);
    }
    for (const key of ['fontSize', 'lineHeight', 'textX', 'textY', 'strokeWidth']) {
      assert.equal(
        clamped[key],
        applied[key],
        `${preset.name}: ${key} 값 ${applied[key]} 이(가) 범위(${LIMITS[key].min}~${LIMITS[key].max})를 벗어나 잘렸다`
      );
    }
  }
});

test('없는 프리셋을 넣으면 상태를 그대로 돌려준다', () => {
  const before = userState();
  assert.equal(applyPreset(before, '없는프리셋'), before);
});

test('프리셋 id 는 겹치지 않는다', () => {
  const ids = PRESETS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});
