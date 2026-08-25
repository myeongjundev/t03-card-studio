import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCard } from '../src/render/renderCard.js';
import { createInitialState, ERA_KEYS, PERSONA_KEYS } from '../src/state/editorState.js';
import { tracingContext } from './helpers/traceContext.js';

function paintTrace(overrides) {
  const ctx = tracingContext();
  const state = { ...createInitialState(), ...overrides };
  renderCard(ctx, state, 1080, 1080);
  return ctx.trace;
}

test('투명 배경을 켜면 시대 장식이 픽셀을 하나도 칠하지 않는다', () => {
  // 어제의 P1: 투명 PNG를 기대한 사용자가 2004 장식으로 76%가 덮인 파일을 받았다.
  // 투명 배경에서는 세 시대의 그리기 기록이 완전히 같아야 한다.
  const [a, b, c] = ERA_KEYS.map((era) => paintTrace({ era, transparentBg: true }));

  assert.deepEqual(a, b, '2004와 2012의 그리기 기록이 다르다 — 장식이 남아 있다');
  assert.deepEqual(b, c, '2012와 2026의 그리기 기록이 다르다 — 장식이 남아 있다');

  // 남아야 하는 것은 캔버스 비우기와 사용자 문구뿐이다.
  const unexpected = a.filter(
    (call) => !/^(clearRect|fillText|strokeText)\(/.test(call)
  );
  assert.deepEqual(unexpected, [], `투명 배경에서 배경/장식을 그렸다: ${unexpected.join(' ')}`);
});

test('투명 배경을 끄면 세 시대가 실제로 다르게 그려진다', () => {
  // 어제의 P2: 9개 조합 중 5개가 시대 차이가 없었다.
  for (const persona of PERSONA_KEYS) {
    const traces = ERA_KEYS.map((era) => paintTrace({ persona, era, transparentBg: false }));
    const unique = new Set(traces.map((trace) => trace.join('|')));
    assert.equal(unique.size, ERA_KEYS.length, `${persona}: 세 시대가 모두 다르지는 않다`);
  }
});
