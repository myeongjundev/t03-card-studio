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

function drawText(ctx, state, width, height) {
  const text = String(state.text ?? '');
  if (text.trim() === '') return; // 빈 문구여도 앱이 깨지지 않는다

  // measureText 가 올바른 값을 주려면 폰트를 먼저 설정해야 한다.
  ctx.font = `700 ${state.fontSize}px ${FONT_STACK}`;
  ctx.textAlign = state.align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = state.color;

  const lines = wrapText(ctx, text, width * TEXT_MAX_WIDTH_RATIO);
  const lineStep = state.fontSize * state.lineHeight;

  // 문구 블록 전체의 세로 가운데가 textY 에 오도록 배치한다.
  const x = state.textX * width;
  const firstY = state.textY * height - ((lines.length - 1) * lineStep) / 2;

  lines.forEach((line, index) => {
    ctx.fillText(line, x, firstY + index * lineStep);
  });
}

export function renderCard(ctx, state, width, height) {
  drawBackground(ctx, state, width, height);
  drawImage(ctx, state, width, height);
  drawText(ctx, state, width, height);
}
