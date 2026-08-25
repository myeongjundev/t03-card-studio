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

test('미니홈피만 사진첩 칸을 만들고 나머지는 화면 전체를 쓴다', () => {
  // 2004 는 사진첩 칸 안에 사진이 들어가는 레이아웃이다.
  for (const persona of ['normal', 'social', 'close-friends']) {
    const { imageBox } = getComposition({ persona, era: '2004' }, 1080, 1080);
    assert.ok(imageBox.width < 1080, `${persona}+2004: 사진첩 칸이 아니다`);
    assert.ok(imageBox.height < 1080, `${persona}+2004: 사진첩 칸이 아니다`);
  }

  // 2012 는 프레임 장식이 아니라 사진의 화질을 흉내 내므로 화면 전체를 쓴다.
  // 인화된 사진은 프레임 안의 작은 그림이 아니라 그 자체가 화면이다.
  for (const era of ['2012', '2026']) {
    for (const persona of ['normal', 'social', 'close-friends']) {
      const { imageBox } = getComposition({ persona, era }, 1080, 1350);
      assert.deepEqual(
        imageBox,
        { x: 0, y: 0, width: 1080, height: 1350 },
        `${persona}+${era}: 화면 전체를 쓰지 않는다`
      );
    }
  }
});
