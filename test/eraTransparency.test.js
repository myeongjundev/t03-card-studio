import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCard } from '../src/render/renderCard.js';
import { toGraphemes } from '../src/render/wrapText.js';
import { createInitialState, ERA_KEYS, PERSONA_KEYS } from '../src/state/editorState.js';

// 픽셀을 세는 대신 "무엇을 그렸는가"를 기록한다.
// node에는 진짜 Canvas가 없고, 기록 방식이 더 결정적이다 —
// 래스터화 차이나 안티에일리어싱에 흔들리지 않는다.
const PAINTING_CALLS = new Set([
  'fillRect',
  'strokeRect',
  'fill',
  'stroke',
  'fillText',
  'strokeText',
  'drawImage',
  'clearRect',
]);

function tracingContext() {
  const trace = [];
  let fontSize = 16;
  const gradient = { addColorStop() {} };

  const target = {
    trace,
    font: '16px sans-serif',
    measureText(value) {
      return { width: toGraphemes(value).length * fontSize * 0.6 };
    },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };

  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      // 그 외 모든 메서드는 호출만 기록한다.
      return (...args) => {
        if (PAINTING_CALLS.has(prop)) {
          trace.push(`${String(prop)}(${args.map(describe).join(',')})`);
        }
      };
    },
    set(obj, prop, value) {
      if (prop === 'font') {
        fontSize = Number.parseFloat(String(value).match(/([0-9.]+)px/)?.[1] ?? '16');
      }
      obj[prop] = value;
      return true;
    },
  });
}

// 좌표는 반올림해 비교한다. 값 자체가 아니라 "달라졌는가"를 보기 때문이다.
const describe = (value) =>
  typeof value === 'number' ? value.toFixed(2) : typeof value === 'object' ? '[obj]' : String(value);

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
