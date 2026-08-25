/**
 * 시대별 화면 구성.
 *
 * 시대는 색만 바꾸는 것이 아니라 이미지가 놓이는 자리 자체를 바꾼다.
 * 미니홈피는 사진첩 칸 안에, 필름과 숏폼은 화면 전체에 이미지가 들어간다.
 * 필름이 전체 화면인 이유는, 필름 시대가 프레임 장식이 아니라 **사진의
 * 화질**을 흉내 내기 때문이다. 인화된 사진은 프레임 안의 작은 그림이
 * 아니라 그 자체가 화면 전체다.
 *
 * 구성을 Persona가 아니라 Era 기준으로 정하는 이유는, Persona×Era 9개 조합
 * 가운데 일부만 장식을 갖던 이전 구조에서는 시대를 바꿔도 아무 변화가 없는
 * 조합이 생겼기 때문이다. 시대가 구성을 주도하고 Persona는 문구의 자리와
 * 색을 맡는다.
 */

const full = (width, height) => ({ x: 0, y: 0, width, height });

/** 각 시대가 이미지에게 내주는 영역. 모든 값은 캔버스 비율에 대한 상대값이다. */
const IMAGE_BOX_BY_ERA = {
  // 미니홈피: 사진첩 칸. 위에 헤더, 아래에 다이어리 글이 들어갈 자리를 남긴다.
  2004: { x: 0.13, y: 0.25, width: 0.74, height: 0.36 },
};

/**
 * 시대 장식 안에서 사용자 문구가 들어갈 수 있는 영역.
 *
 * 2004 미니홈피는 사진 아래의 다이어리 칸만 사용자 문구 자리다. Canvas 전체를
 * 쓰게 두면 긴 문구가 기분 표시와 BGM을 덮는다. 다른 시대는 별도 제한 없이
 * 기존 Canvas 안전 여백을 그대로 쓴다.
 */
const TEXT_BOX_BY_ERA = {
  2004: { x: 0.13, y: 0.7, width: 0.74, height: 0.16 },
};

const scaleBox = (ratios, width, height) => ({
  x: width * ratios.x,
  y: height * ratios.y,
  width: width * ratios.width,
  height: height * ratios.height,
});

export function getComposition(state, width, height) {
  const era = state.era;
  const key = `${state.persona}:${era}`;
  const ratios = IMAGE_BOX_BY_ERA[era];
  const textRatios = TEXT_BOX_BY_ERA[era];
  const textBox = textRatios ? scaleBox(textRatios, width, height) : null;

  if (!ratios) return { key, era, imageBox: full(width, height), textBox };

  return {
    key,
    era,
    imageBox: scaleBox(ratios, width, height),
    textBox,
  };
}

export function isBoxInsideCanvas(box, width, height) {
  return box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0 &&
    box.x + box.width <= width && box.y + box.height <= height;
}
