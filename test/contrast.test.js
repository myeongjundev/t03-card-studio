import test from 'node:test';
import assert from 'node:assert/strict';
import {
  relativeLuminance,
  contrastRatio,
  hexToRgb,
  backgroundLuminanceOf,
  suggestTextColor,
} from '../src/render/contrast.js';

/** width*height 픽셀을 한 가지 색으로 채운 가짜 ImageData */
const solid = (rgb, count = 100) => ({
  data: Uint8ClampedArray.from(
    Array.from({ length: count }, () => [...rgb, 255]).flat()
  ),
});

test('hexToRgb 는 3자리와 6자리를 모두 읽는다', () => {
  assert.deepEqual(hexToRgb('#fff'), [255, 255, 255]);
  assert.deepEqual(hexToRgb('#ffffff'), [255, 255, 255]);
  assert.deepEqual(hexToRgb('#1a1a1a'), [26, 26, 26]);
  assert.equal(hexToRgb('빨강'), null);
});

test('흰색과 검정의 대비는 21:1 이다', () => {
  const white = relativeLuminance(255, 255, 255);
  const black = relativeLuminance(0, 0, 0);
  assert.equal(Math.round(contrastRatio(white, black)), 21);
});

test('배경이 글자색과 같아도 판정을 포기하지 않는다', () => {
  // 흰 배경에 흰 글자. 글자색과 비슷한 픽셀을 빼면 아무것도 남지 않는다.
  // 여기서 null 을 돌려주면 가장 안 읽히는 경우에 경고가 사라진다.
  const luminance = backgroundLuminanceOf(solid([255, 255, 255]), [255, 255, 255]);
  assert.notEqual(luminance, null);

  const ratio = contrastRatio(relativeLuminance(255, 255, 255), luminance);
  assert.ok(ratio < 1.1, `대비가 1:1 에 가까워야 하는데 ${ratio}`);
});

test('글자 픽셀은 배경 밝기 계산에서 빠진다', () => {
  // 절반은 검은 배경, 절반은 흰 글자
  const mixed = {
    data: Uint8ClampedArray.from(
      [
        ...Array.from({ length: 50 }, () => [0, 0, 0, 255]).flat(),
        ...Array.from({ length: 50 }, () => [255, 255, 255, 255]).flat(),
      ]
    ),
  };
  const luminance = backgroundLuminanceOf(mixed, [255, 255, 255]);
  // 흰 글자를 제외했으므로 검은 배경만 남아야 한다
  assert.ok(luminance < 0.01, `배경만 남아야 하는데 ${luminance}`);
});

test('투명한 픽셀은 배경으로 세지 않는다', () => {
  const withAlpha = {
    data: Uint8ClampedArray.from(
      [
        ...Array.from({ length: 50 }, () => [255, 255, 255, 0]).flat(),
        ...Array.from({ length: 50 }, () => [0, 0, 0, 255]).flat(),
      ]
    ),
  };
  const luminance = backgroundLuminanceOf(withAlpha, [128, 128, 128]);
  assert.ok(luminance < 0.01, `불투명한 검정만 남아야 하는데 ${luminance}`);
});

test('밝은 배경에는 어두운 글자를, 어두운 배경에는 흰 글자를 제안한다', () => {
  assert.equal(suggestTextColor(relativeLuminance(255, 255, 255)), '#1a1a1a');
  assert.equal(suggestTextColor(relativeLuminance(0, 0, 0)), '#ffffff');
});
