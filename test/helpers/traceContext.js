/**
 * Canvas 2D 컨텍스트를 흉내 내면서 "무엇을 어떤 순서로 그렸는지" 기록한다.
 *
 * node 에는 진짜 Canvas 가 없다. 그렇다고 네이티브 canvas 의존성을 더하면
 * 설치가 무거워지고 CI 도 느려진다. 대신 그리기 호출을 기록해서 비교하면
 * 래스터화 차이나 안티에일리어싱에 흔들리지 않는 결정적인 비교가 된다.
 *
 * 다만 이것은 픽셀 비교가 아니다. 같은 픽셀을 만드는 다른 호출 조합은
 * 구분하지 못한다. 실제 픽셀 비교는 브라우저에서 한다
 * (`scripts/browser-checks.js`).
 */

import { toGraphemes } from '../../src/render/wrapText.js';

/** 픽셀을 칠하는 호출만 센다. 경로 설정(moveTo 등)은 그 자체로는 안 보인다. */
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

/** 칠할 때 결과를 좌우하는 상태. 호출과 함께 기록해야 색 변경도 잡힌다. */
const PAINT_STATE = [
  'fillStyle',
  'strokeStyle',
  'lineWidth',
  'globalAlpha',
  // 합성 모드가 바뀌면 같은 fillRect 라도 결과가 완전히 달라진다.
  'globalCompositeOperation',
  'font',
  'textAlign',
];

const describe = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value.toFixed(2) : String(value);
  if (value && typeof value === 'object') return '[obj]';
  return String(value);
};

/**
 * @param {{ withState?: boolean }} options
 *   withState 를 켜면 색·굵기까지 함께 기록한다. 회귀 스냅샷용.
 */
export function tracingContext({ withState = false } = {}) {
  const trace = [];
  let fontSize = 16;
  const gradient = { addColorStop() {} };

  const target = {
    trace,
    font: '16px sans-serif',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'start',
    globalCompositeOperation: 'source-over',
    measureText(value) {
      return { width: toGraphemes(value).length * fontSize * 0.6 };
    },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };

  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      return (...args) => {
        if (!PAINTING_CALLS.has(prop)) return;
        const call = `${String(prop)}(${args.map(describe).join(',')})`;
        if (!withState) {
          trace.push(call);
          return;
        }
        const state = PAINT_STATE.map((key) => `${key}=${describe(obj[key])}`).join(' ');
        trace.push(`${call} | ${state}`);
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
