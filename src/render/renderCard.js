import { fitImage } from './fitImage.js';
import { wrapText } from './wrapText.js';
import { getComposition } from './composition.js';

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

/**
 * 편집 UI의 최소값은 8px이지만, 수동 개행이 아주 많은 유효 입력도 잘리지 않도록
 * 렌더링 전용 크기는 더 낮출 수 있다. 지정값은 바꾸지 않고 축소 사실을 알린다.
 */
const MIN_AUTO_FONT_SIZE = 0.1;
const MAX_LAYOUT_ATTEMPTS = 96;

function drawBackground(ctx, state, width, height) {
  ctx.clearRect(0, 0, width, height);
  // 투명 배경일 때는 채우지 않는다. 투명 PNG 의 alpha 를 그대로 내보내기 위함이다.
  if (state.transparentBg) return;
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, width, height);
}

/**
 * 씨앗을 고정한 난수(xorshift).
 *
 * Math.random 을 쓰면 같은 설정인데도 매번 다른 그림이 나온다. 그러면
 * 저장한 템플릿을 다시 불러왔을 때 다른 카드가 되고, "미리보기와 저장본이
 * 같다" 는 약속도 검사할 수 없다.
 */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

// 2004년 카메라폰은 30만~130만 화소였다. 실제 값을 그대로 쓰면 1080 캔버스
// 에서는 그냥 조금 흐린 사진으로 보인다. 그 시절 화면에서 받던 인상이
// 남도록 과장한다.
const PHONE_BUFFER_WIDTH = 180;
// 색 단계. 10단계쯤이면 하늘이나 살색에 띠가 보이면서도 피사체는 남는다.
const PHONE_COLOR_LEVELS = 10;

/**
 * 피처폰으로 찍은 사진의 화질을 만든다.
 *
 * 무거운 픽셀 연산을 **작게 줄인 버퍼에서만** 한다. 1080×1080 원본에
 * 직접 하면 100만 번이 넘어 편집할 때마다 버벅이지만, 180px 버퍼는
 * 2만 번이 안 된다. 어차피 결과는 저화질이라 원본 해상도로 계산할
 * 이유도 없다.
 *
 * @returns {OffscreenCanvas|null} 만들 수 없으면 null. 그때는 원본을 그린다.
 */
function featurePhoneFrame(image, imageBox, fit) {
  if (typeof OffscreenCanvas === 'undefined') return null;

  const bufferWidth = PHONE_BUFFER_WIDTH;
  const bufferHeight = Math.max(
    1,
    Math.round(bufferWidth * (imageBox.height / imageBox.width))
  );
  const placed = fitImage(image, bufferWidth, bufferHeight, fit);
  if (!placed) return null;

  const canvas = new OffscreenCanvas(bufferWidth, bufferHeight);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, placed.dx, placed.dy, placed.dw, placed.dh);

  const frame = ctx.getImageData(0, 0, bufferWidth, bufferHeight);
  const data = frame.data;
  const random = seededRandom(0x5ca1ab1e);
  const step = 255 / (PHONE_COLOR_LEVELS - 1);

  for (let i = 0; i < data.length; i += 4) {
    // 어두운 곳일수록 노이즈가 크다. 저조도에서 지글거리던 그 화면이다.
    const luma = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    const noise = (random() - 0.5) * 26 * (1 - luma * 0.6);

    for (let channel = 0; channel < 3; channel += 1) {
      // 색 단계를 줄인다. 65,536색 화면에서 보이던 띠.
      const value = Math.round((data[i + channel] + noise) / step) * step;
      data[i + channel] = value < 0 ? 0 : value > 255 ? 255 : value;
    }

    // 화이트밸런스가 늘 초록으로 기울어 있었다.
    data[i + 1] = Math.min(255, data[i + 1] * 1.07);
    data[i + 2] = Math.min(255, data[i + 2] * 0.95);
  }

  ctx.putImageData(frame, 0, 0);
  return canvas;
}

function drawImage(ctx, state, width, height, imageBox, era) {
  if (!state.image) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(imageBox.x, imageBox.y, imageBox.width, imageBox.height);
  ctx.clip();

  const phone = era === '2004' ? featurePhoneFrame(state.image, imageBox, state.fit) : null;
  if (phone) {
    // 보간을 꺼야 화소가 네모로 보인다. 켜 두면 부드럽게 뭉개져서
    // "저화질" 이 아니라 그냥 "흐린 사진" 이 된다.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(phone, imageBox.x, imageBox.y, imageBox.width, imageBox.height);
  } else {
    const box = fitImage(state.image, imageBox.width, imageBox.height, state.fit);
    if (box) {
      ctx.drawImage(state.image, imageBox.x + box.dx, imageBox.y + box.dy, box.dw, box.dh);
    }
  }

  ctx.restore();
}

function metaText(ctx, text, x, y, size, color, align = 'left') {
  ctx.font = `700 ${size}px ${FONT_STACK}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 미니홈피 시대. 파스텔 배경 위의 흰 카드, 이중 테두리,
 * 투데이/토탈 카운터, BGM 표시로 2000년대 개인 홈 문법을 만든다.
 */
function drawMinihompy(ctx, width, height, imageBox, layer) {
  if (layer !== 'under') return;
  const pad = width * 0.05;
  const cardX = pad;
  const cardY = height * 0.05;
  const cardW = width - pad * 2;
  const cardH = height * 0.9;

  // 흰 카드와 바깥 이중 테두리
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, cardX, cardY, cardW, cardH, width * 0.02);
  ctx.fill();
  ctx.strokeStyle = '#7fb3d5';
  ctx.lineWidth = Math.max(2, width * 0.004);
  roundedRect(ctx, cardX, cardY, cardW, cardH, width * 0.02);
  ctx.stroke();
  ctx.strokeStyle = '#cfe3f0';
  ctx.lineWidth = Math.max(1, width * 0.002);
  roundedRect(ctx, cardX + 10, cardY + 10, cardW - 20, cardH - 20, width * 0.018);
  ctx.stroke();

  // 상단 타이틀 바
  ctx.fillStyle = '#dcecf7';
  ctx.fillRect(cardX + 10, cardY + 10, cardW - 20, height * 0.075);
  metaText(ctx, 'MY HOME', cardX + width * 0.05, cardY + height * 0.03, width * 0.032, '#31658c');
  metaText(
    ctx, 'TODAY 23   TOTAL 12,458',
    cardX + cardW - width * 0.05, cardY + height * 0.034, width * 0.021, '#e2624f', 'right'
  );

  // 사진 칸 흰 여백과 테두리
  const m = width * 0.014;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(imageBox.x - m, imageBox.y - m, imageBox.width + m * 2, imageBox.height + m * 2);
  ctx.strokeStyle = '#a8c8dd';
  ctx.lineWidth = Math.max(1, width * 0.002);
  ctx.strokeRect(imageBox.x - m, imageBox.y - m, imageBox.width + m * 2, imageBox.height + m * 2);

  // 다이어리 구분 점선
  const lineY = imageBox.y + imageBox.height + height * 0.05;
  ctx.save();
  ctx.strokeStyle = '#c4dcea';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(cardX + width * 0.05, lineY);
  ctx.lineTo(cardX + cardW - width * 0.05, lineY);
  ctx.stroke();
  ctx.restore();

  // 하단 BGM 표시
  metaText(
    ctx, '♪  BGM  —  그 시절 그 노래',
    cardX + width * 0.05, cardY + cardH - height * 0.055, width * 0.022, '#7fa8c4'
  );
}

/**
 * 필름 입자 타일.
 *
 * 픽셀마다 난수를 뿌리면 1080×1920 에서 200만 번 연산이라 편집할 때마다
 * 버벅인다. 작은 타일을 한 번만 만들어 패턴으로 반복한다.
 *
 * 난수는 seededRandom 을 쓴다. 이유는 그 함수 설명에 적었다.
 */
let grainTile = null;

function makeGrainTile() {
  if (grainTile !== null) return grainTile;

  // OffscreenCanvas 가 없는 환경(테스트 등)에서는 입자를 건너뛴다.
  if (typeof OffscreenCanvas === 'undefined') {
    grainTile = false;
    return grainTile;
  }

  const size = 128;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);

  const next = seededRandom(0x9e3779b9);

  for (let i = 0; i < image.data.length; i += 4) {
    const value = 128 + (next() - 0.5) * 255;
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  grainTile = canvas;
  return grainTile;
}

/**
 * 필름 시대 — 인화된 필름 사진의 **화질**을 흉내 낸다.
 *
 * 처음에는 필름 스트립(스프로킷 홀, COLOR 400 표기, 검은 베이스)을 그렸는데
 * 그건 필름 '통' 의 모습이지 필름으로 찍은 '사진' 의 모습이 아니다. 원한
 * 것은 후자였다. 그래서 프레임 장식을 걷어내고 사진 자체를 손본다.
 *
 * 실제 필름 인화물에서 오는 네 가지를 겹친다.
 *
 * 1. 색바램 — 검정이 완전히 검지 않고 살짝 들뜬다
 * 2. 따뜻한 색조 — 세월이 지난 인화지의 누런 기
 * 3. 비네팅 — 렌즈 가장자리가 어두워진다
 * 4. 입자 — 필름 그레인
 *
 * 전부 사진 위에 얹히므로 'over' 에서만 그린다. 깔개가 없다.
 */
function drawFilm(ctx, width, height, imageBox, layer, era) {
  if (layer !== 'over') return;

  // 1. 색바램. 검정을 살짝 들어 올린다.
  ctx.fillStyle = 'rgba(232, 214, 186, 0.10)';
  ctx.fillRect(0, 0, width, height);

  // 2. 따뜻한 색조. soft-light 라 밝기는 유지한 채 색만 물든다.
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = 'rgba(255, 148, 54, 0.34)';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 3. 비네팅.
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.max(width, height) * 0.72;
  const vignette = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(28,16,6,0.5)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // 4. 입자.
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.13;
  const tile = makeGrainTile();
  const pattern = tile ? ctx.createPattern(tile, 'repeat') : null;
  // 패턴을 못 만드는 환경에서도 같은 자리에 같은 크기로 한 번 칠한다.
  // 그래야 렌더 기록 비교(회귀 스냅샷)가 환경에 상관없이 맞는다.
  ctx.fillStyle = pattern ?? 'rgba(128,128,128,1)';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 날짜 각인. 필름 사진의 가장 알아보기 쉬운 표시라 이것만 남긴다.
  // 연도는 시대에서 가져온다. 예전에는 "'04" 가 박혀 있어서 2012 시대
  // 카드에 2004 년이 찍혔다.
  ctx.save();
  ctx.shadowColor = 'rgba(255,140,40,0.9)';
  ctx.shadowBlur = width * 0.014;
  metaText(
    ctx, `'${String(era).slice(2)} 8 24`,
    width - width * 0.06,
    height - height * 0.055,
    width * 0.031, '#ff9436', 'right'
  );
  ctx.restore();
}

/** 숏폼 시대. 하단 그라데이션으로 자막이 읽히게 만든다. */
function drawShortForm(ctx, width, height, persona, layer) {
  // 그라데이션과 자막 표기는 사진을 덮어야 읽힌다.
  if (layer !== 'over') return;
  const gradient = ctx.createLinearGradient(0, height * 0.42, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height * 0.42, width, height * 0.58);

  const topLabel = persona === 'close-friends' ? '친한 친구에게만' : '지금 · 실시간';
  metaText(ctx, topLabel, width * 0.07, height * 0.06, width * 0.024, '#ffffff');
  metaText(ctx, '#오늘의기록', width * 0.07, height * 0.9, width * 0.024, 'rgba(255,255,255,0.85)');
}

/**
 * 시대 문법을 만드는 프레임과 메타데이터. 모두 미리보기 Canvas에 직접 그린다.
 *
 * 투명 배경을 켠 상태에서는 아무것도 그리지 않는다. 장식이 불투명 픽셀을
 * 만들어 버리면 투명 PNG를 기대한 사용자가 배경이 박힌 파일을 받게 된다.
 */
function drawComposition(ctx, state, width, height, composition, layer) {
  if (state.transparentBg) return;

  ctx.save();
  if (composition.era === '2004') {
    drawMinihompy(ctx, width, height, composition.imageBox, layer);
  } else if (composition.era === '2012') {
    drawFilm(ctx, width, height, composition.imageBox, layer, composition.era);
  } else {
    drawShortForm(ctx, width, height, state.persona, layer);
  }
  ctx.restore();
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
export function layoutText(ctx, state, width, height) {
  const maxWidth = width * TEXT_MAX_WIDTH_RATIO;
  const maxHeight = height * TEXT_MAX_HEIGHT_RATIO;

  let fontSize = state.fontSize;
  let lines = [];

  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt += 1) {
    ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
    lines = wrapText(ctx, state.text, maxWidth);

    const blockHeight = blockHeightOf(lines.length, fontSize, state.lineHeight);
    if (blockHeight <= maxHeight || fontSize <= MIN_AUTO_FONT_SIZE) break;

    // 한 번에 목표치까지 줄이되, 최소 10% 는 줄여 무한 반복을 막는다.
    const shrink = Math.min(0.9, maxHeight / blockHeight);
    fontSize = Math.max(MIN_AUTO_FONT_SIZE, fontSize * shrink);
  }

  // 마지막으로 정해진 크기에 맞춰 줄을 다시 나눈다.
  ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
  lines = wrapText(ctx, state.text, maxWidth);
  return { lines, fontSize };
}

/** 값을 [min, max] 안으로 넣되, 범위가 뒤집혀 있으면 min 을 택한다. */
const clamp = (value, min, max) => (max < min ? min : Math.min(Math.max(value, min), max));

function drawText(ctx, state, width, height) {
  const empty = { lineCount: 0, fontSize: state.fontSize, shrunk: false, area: null };
  if (String(state.text ?? '').trim() === '') return empty; // 빈 문구여도 앱이 깨지지 않는다

  ctx.textBaseline = 'middle';
  ctx.fillStyle = state.color;

  const { lines, fontSize } = layoutText(ctx, state, width, height);
  ctx.textAlign = state.align;

  // 외곽선은 글자 바깥으로 절반만큼 번진다. 자리 계산에 그만큼을 더해야
  // 가장자리에서 테두리가 잘리지 않는다.
  const strokeWidth = (state.strokeWidth ?? 0) * fontSize;
  const strokeBleed = strokeWidth / 2;

  const lineStep = fontSize * state.lineHeight;
  const blockHeight =
    blockHeightOf(lines.length, fontSize, state.lineHeight) + strokeWidth;
  const blockWidth =
    lines.reduce((widest, line) => Math.max(widest, ctx.measureText(line).width), 0) +
    strokeWidth;

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
  const firstY = top + strokeBleed + fontSize / 2;

  if (strokeWidth > 0) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = state.strokeColor;
    // 뾰족한 모서리에서 테두리가 창처럼 뻗어 나가는 것을 막는다.
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
  }

  lines.forEach((line, index) => {
    const y = firstY + index * lineStep;
    // 테두리를 먼저 그리고 그 위에 글자를 얹는다. 순서를 바꾸면 테두리가
    // 글자 안쪽까지 덮어 획이 얇아 보인다.
    if (strokeWidth > 0) ctx.strokeText(line, x, y);
    ctx.fillText(line, x, y);
  });

  // 가독성 검사가 읽을 수 있도록 문구가 차지한 사각형을 함께 돌려준다.
  // 캔버스 밖으로 나가지 않게 잘라 두어야 getImageData 가 실패하지 않는다.
  const areaX = Math.max(0, Math.floor(left));
  const areaY = Math.max(0, Math.floor(top));
  const area = {
    x: areaX,
    y: areaY,
    width: Math.max(1, Math.min(Math.ceil(blockWidth), width - areaX)),
    height: Math.max(1, Math.min(Math.ceil(blockHeight), height - areaY)),
  };

  return {
    lineCount: lines.length,
    fontSize,
    shrunk: fontSize < state.fontSize,
    area,
  };
}

/**
 * @returns {{lineCount: number, fontSize: number, shrunk: boolean}}
 *   실제로 그린 결과. fontSize 는 자동 축소가 적용된 뒤의 값이다.
 */
export function renderCard(ctx, state, width, height) {
  const composition = getComposition(state, width, height);

  drawBackground(ctx, state, width, height);
  // 프레임 배경(미니홈피 카드, 필름 베이스)은 사진보다 먼저 깔아야 한다.
  drawComposition(ctx, state, width, height, composition, 'under');
  drawImage(ctx, state, width, height, composition.imageBox, composition.era);
  // 비네팅·날짜 각인·카운터처럼 사진 위에 얹히는 것은 나중에 그린다.
  drawComposition(ctx, state, width, height, composition, 'over');

  return drawText(ctx, state, width, height);
}
