import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutText } from '../src/render/renderCard.js';
import { wrapText, toGraphemes } from '../src/render/wrapText.js';
import { fitImage } from '../src/render/fitImage.js';

function contextMock() {
  let fontSize = 16;
  return {
    set font(value) {
      fontSize = Number.parseFloat(value.match(/([0-9.]+)px/)?.[1] ?? '16');
    },
    get font() {
      return `${fontSize}px sans-serif`;
    },
    measureText(value) {
      return { width: toGraphemes(value).length * fontSize * 0.6 };
    },
  };
}

test('허용된 최악의 수동 개행도 90% 높이 안에 맞춘다', () => {
  const ctx = contextMock();
  const state = {
    text: `${'\n'.repeat(1999)}가`,
    fontSize: 400,
    lineHeight: 3,
  };
  const result = layoutText(ctx, state, 1080, 1080);
  const blockHeight =
    (result.lines.length - 1) * result.fontSize * state.lineHeight + result.fontSize;

  assert.equal(result.lines.length, 2000);
  assert.ok(result.fontSize < 8);
  assert.ok(blockHeight <= 1080 * 0.9);
});

test('시대별 문구 영역이 있으면 그 높이에 맞춰 더 작게 줄인다', () => {
  const ctx = contextMock();
  const state = {
    text: '첫 줄\n둘째 줄\n셋째 줄',
    fontSize: 120,
    lineHeight: 1.4,
  };
  const textBox = { x: 140.4, y: 756, width: 799.2, height: 172.8 };
  const result = layoutText(ctx, state, 1080, 1080, textBox);
  const blockHeight =
    (result.lines.length - 1) * result.fontSize * state.lineHeight + result.fontSize;

  assert.ok(result.fontSize < state.fontSize);
  assert.ok(blockHeight <= textBox.height);
});

test('wrapText는 수동 빈 줄과 이모지 그래핀을 보존한다', () => {
  const ctx = contextMock();
  const family = '👨‍👩‍👧‍👦';
  assert.equal(toGraphemes(family).length, 1);
  assert.deepEqual(wrapText(ctx, `첫 줄\n\n${family}`, 1000), ['첫 줄', '', family]);
});

test('fitImage는 cover와 contain을 가운데 정렬한다', () => {
  const image = { naturalWidth: 1600, naturalHeight: 600 };
  assert.deepEqual(fitImage(image, 1080, 1080, 'contain'), {
    dx: 0,
    dy: 337.5,
    dw: 1080,
    dh: 405,
  });
  assert.deepEqual(fitImage(image, 1080, 1080, 'cover'), {
    dx: -900,
    dy: 0,
    dw: 2880,
    dh: 1080,
  });
});
