import { fitImage } from './fitImage.js';
import { wrapText } from './wrapText.js';

/**
 * 카드 한 장을 그리는 유일한 함수.
 *
 * 미리보기와 다운로드가 이 함수 하나만 쓴다. 더 정확히는, 다운로드는 이 함수를
 * 다시 호출하지도 않고 미리보기가 이미 그려 놓은 캔버스를 그대로 파일로 만든다.
 * 두 결과가 "맞춰져" 있는 것이 아니라 애초에 같은 픽셀이다.
 * (docs/ARCHITECTURE.md 1장)
 */

/** 한글과 이모지 fallback 을 함께 지정한다. 이모지 폰트를 빠뜨리면 두부(□)가 나온다. */
export const FONT_STACK =
  "'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif, " +
  "'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji'";

/** 문구가 캔버스 가장자리에 붙지 않도록 남기는 여백. */
export const TEXT_MAX_WIDTH_RATIO = 0.9;
export const TEXT_MAX_HEIGHT_RATIO = 0.9;

/** 자동 축소가 내려갈 수 있는 하한. 여기까지 줄여도 넘치면 더 줄이지 않는다. */
const MIN_AUTO_FONT_SIZE = 8;

function drawBackground(ctx, state, width, height) {
  ctx.clearRect(0, 0, width, height);
  // 투명 배경일 때는 채우지 않는다. 투명 PNG 의 alpha 를 그대로 내보내기 위함이다.
  if (state.transparentBg) return;
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, width, height);
}

function drawImage(ctx, state, width, height) {
  if (!state.image) return;
  const box = fitImage(state.image, width, height, state.fit);
  if (!box) return;
  ctx.drawImage(state.image, box.dx, box.dy, box.dw, box.dh);
}

const blockHeightOf = (lineCount, fontSize, lineHeight) =>
  lineCount === 0 ? 0 : (lineCount - 1) * fontSize * lineHeight + fontSize;

/**
 * 글자 크기를 정하고 줄을 나눈다.
 *
 * 줄바꿈만으로는 가로 넘침만 막힌다. 문구가 길거나 글자가 크면 줄 수가 늘어나
 * 블록 전체가 캔버스보다 높아지고, 위아래가 소리 없이 잘려나간다.
 * 그래서 요청한 크기를 '최대 크기'로 보고, 세로로 들어올 때까지 줄인다.
 *
 * 줄이는 비율을 넘침 정도에서 계산하므로 보통 두세 번이면 수렴한다.
 */
function layoutText(ctx, state, width, height) {
  const maxWidth = width * TEXT_MAX_WIDTH_RATIO;
  const maxHeight = height * TEXT_MAX_HEIGHT_RATIO;

  let fontSize = state.fontSize;
  let lines = [];

  for (let attempt = 0; attempt < 24; attempt += 1) {
    ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
    lines = wrapText(ctx, state.text, maxWidth);

    const blockHeight = blockHeightOf(lines.length, fontSize, state.lineHeight);
    if (blockHeight <= maxHeight || fontSize <= MIN_AUTO_FONT_SIZE) break;

    // 한 번에 목표치까지 줄이되, 최소 10% 는 줄여 무한 반복을 막는다.
    const shrink = Math.min(0.9, maxHeight / blockHeight);
    fontSize = Math.max(MIN_AUTO_FONT_SIZE, Math.floor(fontSize * shrink));
  }

  // 마지막으로 정해진 크기에 맞춰 줄을 다시 나눈다.
  ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
  lines = wrapText(ctx, state.text, maxWidth);
  return { lines, fontSize };
}

/** 값을 [min, max] 안으로 넣되, 범위가 뒤집혀 있으면 min 을 택한다. */
const clamp = (value, min, max) => (max < min ? min : Math.min(Math.max(value, min), max));

function drawText(ctx, state, width, height) {
  const empty = { lineCount: 0, fontSize: state.fontSize, shrunk: false };
  if (String(state.text ?? '').trim() === '') return empty; // 빈 문구여도 앱이 깨지지 않는다

  ctx.textBaseline = 'middle';
  ctx.fillStyle = state.color;

  const { lines, fontSize } = layoutText(ctx, state, width, height);
  ctx.textAlign = state.align;

  const lineStep = fontSize * state.lineHeight;
  const blockHeight = blockHeightOf(lines.length, fontSize, state.lineHeight);
  const blockWidth = Math.max(0, ...lines.map((line) => ctx.measureText(line).width));

  const marginX = (width * (1 - TEXT_MAX_WIDTH_RATIO)) / 2;
  const marginY = (height * (1 - TEXT_MAX_HEIGHT_RATIO)) / 2;

  // 위치를 끝까지 밀어도 문구가 화면 밖으로 나가지 않도록 블록째로 가둔다.
  // 정렬 기준에 따라 기준점과 블록 왼쪽 끝의 거리가 다르다.
  const anchorOffset =
    state.align === 'center' ? blockWidth / 2 : state.align === 'right' ? blockWidth : 0;
  const left = clamp(
    state.textX * width - anchorOffset,
    marginX,
    width - marginX - blockWidth
  );
  const top = clamp(
    state.textY * height - blockHeight / 2,
    marginY,
    height - marginY - blockHeight
  );

  const x = left + anchorOffset;
  const firstY = top + fontSize / 2;

  lines.forEach((line, index) => {
    ctx.fillText(line, x, firstY + index * lineStep);
  });

  return {
    lineCount: lines.length,
    fontSize,
    shrunk: fontSize < state.fontSize,
  };
}

/**
 * @returns {{lineCount: number, fontSize: number, shrunk: boolean}}
 *   실제로 그린 결과. fontSize 는 자동 축소가 적용된 뒤의 값이다.
 */
export function renderCard(ctx, state, width, height) {
  drawBackground(ctx, state, width, height);
  drawImage(ctx, state, width, height);
  return drawText(ctx, state, width, height);
}
