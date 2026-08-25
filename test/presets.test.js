import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS,
  ERA_KEYS,
  COMBINATION_STYLES,
  applyPreset,
  applyEra,
  applyIdentity,
  getRecommendedRatio,
} from '../src/state/presets.js';
import { createInitialState, clampState, LIMITS, HEX_COLOR } from '../src/state/editorState.js';

const userState = () => ({
  ...createInitialState(),
  text: '내가 쓴 문구',
  ratio: '9:16',
  image: { fake: true },
  imageName: 'my-photo.png',
});

test('Persona 조합은 문구·이미지를 건드리지 않는다', () => {
  const before = userState();
  for (const preset of PRESETS) {
    const after = applyPreset(before, preset.id);
    assert.equal(after.text, before.text, `${preset.name}: 문구가 바뀌었다`);
    assert.equal(after.image, before.image, `${preset.name}: 이미지가 바뀌었다`);
    assert.equal(after.imageName, before.imageName, `${preset.name}: 이미지 이름이 바뀌었다`);
  }
});

test('Persona는 실제로 보이는 방식을 바꾼다', () => {
  const before = userState();
  for (const preset of PRESETS.filter((item) => item.id !== before.persona)) {
    const after = applyPreset(before, preset.id);
    const changed = ['persona', 'color', 'strokeWidth', 'fontSize', 'textY'].some(
      (key) => after[key] !== before[key]
    );
    assert.ok(changed, `${preset.name}: 아무것도 바뀌지 않았다`);
  }
});

test('모든 Persona 값이 허용 범위 안에 있다', () => {
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

test('없는 Persona를 넣으면 상태를 그대로 돌려준다', () => {
  const before = userState();
  assert.equal(applyPreset(before, '없는프리셋'), before);
});

test('세 가지 모습의 id와 표시 메타데이터가 완전하다', () => {
  const ids = PRESETS.map((p) => p.id);
  assert.deepEqual(ids, ['normal', 'social', 'close-friends']);
  assert.equal(new Set(ids).size, ids.length);
  for (const persona of PRESETS) {
    assert.ok(persona.name);
    assert.ok(persona.koreanName);
    assert.ok(persona.era);
    assert.ok(persona.hint);
    assert.ok(persona.layout);
    assert.ok(persona.recommendedRatios.length >= 1);
    assert.ok(persona.recommendedRatios.every((ratio) => ['1:1', '4:5', '9:16'].includes(ratio)));
  }
});

test('모습·시대는 사용자가 고른 비율을 건드리지 않는다', () => {
  // 1:1 로 작업하다 '친한 친구' 를 눌렀더니 9:16 이 되던 문제.
  // 비율은 사용자의 선택이고, 조합은 추천만 한다.
  for (const ratio of ['1:1', '4:5', '9:16']) {
    const before = { ...userState(), ratio };
    for (const preset of PRESETS) {
      assert.equal(
        applyPreset(before, preset.id).ratio,
        ratio,
        `${preset.name}: 비율을 덮어썼다`
      );
      for (const era of ERA_KEYS) {
        assert.equal(
          applyIdentity(before, preset.id, era).ratio,
          ratio,
          `${preset.name}+${era}: 비율을 덮어썼다`
        );
      }
    }
    for (const era of ERA_KEYS) {
      assert.equal(applyEra(before, era).ratio, ratio, `${era}: 비율을 덮어썼다`);
    }
  }
});

test('조합 스타일에 비율을 되살려도 적용되지 않는다', () => {
  // 나중에 조합을 추가하는 사람이 실수로 ratio 를 넣더라도
  // applyIdentity 가 구조 분해로 떼어 내므로 새어 나가지 않는다.
  const key = 'social:2026';
  const original = COMBINATION_STYLES[key];
  COMBINATION_STYLES[key] = { ...original, ratio: '9:16', recommendedRatio: '9:16' };
  try {
    assert.equal(applyIdentity({ ...userState(), ratio: '1:1' }, 'social', '2026').ratio, '1:1');
  } finally {
    COMBINATION_STYLES[key] = original;
  }
});

test('모든 조합이 실제로 고를 수 있는 비율을 추천한다', () => {
  for (const preset of PRESETS) {
    for (const era of ERA_KEYS) {
      const recommended = getRecommendedRatio(preset.id, era);
      assert.ok(
        ['1:1', '4:5', '9:16'].includes(recommended),
        `${preset.id}+${era}: 추천 비율이 '${recommended}' 이다`
      );
    }
  }
  assert.equal(getRecommendedRatio('없는모습', '2026'), null);
});
