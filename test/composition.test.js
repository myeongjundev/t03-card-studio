import test from 'node:test';
import assert from 'node:assert/strict';
import { getComposition, isBoxInsideCanvas } from '../src/render/composition.js';

test('핵심 조합의 이미지 영역은 모든 비율에서 Canvas 안에 있다', () => {
  const states = [
    { persona: 'close-friends', era: '2004' },
    { persona: 'normal', era: '2012' },
    { persona: 'social', era: '2026' },
  ];
  for (const height of [1080, 1350, 1920]) {
    for (const state of states) {
      const { imageBox } = getComposition(state, 1080, height);
      assert.equal(isBoxInsideCanvas(imageBox, 1080, height), true);
    }
  }
});

test('2004 미니홈피와 2012 프로필은 이미지에 프레임 여백을 만든다', () => {
  for (const state of [
    { persona: 'close-friends', era: '2004' },
    { persona: 'normal', era: '2012' },
  ]) {
    const { imageBox } = getComposition(state, 1080, 1080);
    assert.ok(imageBox.width < 1080);
    assert.ok(imageBox.height < 1080);
  }
});
