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

// 2004년 카메라폰·캠코더로 찍은 사진의 인상.
//
// 해상도를 낮추되 **각진 화소로 보이게 하지 않는다.** 그 시절 사진은
// 네모 화소가 도드라지기보다 전체가 부드럽게 뭉개져 있었다. 그래서 버퍼를
// 아주 작게 잡지 않고, 되돌릴 때 보간도 켠 채로 둔다.
const PHONE_BUFFER_WIDTH = 300;

/**
 * 피처폰·캠코더 사진의 화질을 만든다.
 *
 * 실제로 그 시절 사진을 보면 눈에 남는 것은 화소가 아니라 이 네 가지다.
 *
 * 1. 대비가 낮다 — 검정이 들뜨고 전체가 뿌옇다
 * 2. 하이라이트가 날아간다 — 하늘이 통째로 하얗게 번진다
 * 3. 보라로 기운다 — 싸구려 센서의 화이트밸런스
 * 4. 화면이 부드럽게 뭉개진다
 *
 * 무거운 픽셀 연산은 작게 줄인 버퍼에서만 한다. 1080×1080 원본에 직접
 * 하면 100만 번이 넘지만 300px 버퍼는 6만 번 남짓이다.
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

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = r * 0.299 + g * 0.587 + b * 0.114;

    // 밝은 곳일수록 더 날아간다. 하늘이 통째로 하얘지는 것이 이것이다.
    // 문턱을 낮게 잡아야 하늘 전체가 뭉개지고, 어두운 부분은 남는다.
    const bloom = luma > 152 ? Math.min(1, (luma - 152) / 88) : 0;
    const noise = (random() - 0.5) * 12;

    // 대비를 낮추고(0.58) 검정을 살짝만 들어 올린다(+12).
    // 많이 올리면 전체가 하얘져서 "빛바랜 사진" 이 아니라 "밝은 사진" 이 된다.
    // 보라 기울기는 빨강·파랑을 올리고 초록을 내려서 만든다.
    const grade = (value, tint, bloomGain) =>
      (128 + (value - 128) * 0.70 + 10) * tint + bloom * bloomGain + noise;

    data[i] = clamp255(grade(r, 1.05, 62));
    data[i + 1] = clamp255(grade(g, 0.975, 50));
    data[i + 2] = clamp255(grade(b, 1.13, 68));
  }

  ctx.putImageData(frame, 0, 0);
  return canvas;
}

const clamp255 = (value) => (value < 0 ? 0 : value > 255 ? 255 : value);

/**
 * 사진 위에 얹는 보라 안개와 가장자리 어두움.
 *
 * 픽셀 단위 보정만으로는 그 시절 사진의 인상이 덜 난다. 검정이 완전히
 * 검지 않고 보랏빛으로 들뜨는 것이 눈에 남는 부분인데, `screen` 으로
 * 보라를 얹으면 어두운 곳일수록 크게 들려서 그 느낌이 난다.
 */
function drawPhoneHaze(ctx, box) {
  ctx.save();

  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(96, 68, 132, 0.15)';
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.globalCompositeOperation = 'source-over';

  // 싸구려 렌즈는 가장자리가 어두웠다.
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const radius = Math.max(box.width, box.height) * 0.7;
  const vignette = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(24,14,36,0.4)');
  ctx.fillStyle = vignette;
  ctx.fillRect(box.x, box.y, box.width, box.height);

  ctx.restore();
}

/**
 * 둥근 모서리 검은 테두리.
 *
 * 그 시절 카메라·캠코더 화면의 가장 알아보기 쉬운 표시다. 사진 위에
 * 검은 테를 두르되 안쪽 모서리를 둥글게 판다. even-odd 규칙으로 바깥
 * 사각형에서 안쪽 둥근 사각형을 빼면 테두리만 남는다.
 */
function drawViewfinderMask(ctx, box) {
  const inset = Math.min(box.width, box.height) * 0.035;
  const radius = Math.min(box.width, box.height) * 0.09;

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  // roundedRect 가 아니라 roundedRectPath 를 쓴다. 전자는 beginPath 로
  // 바깥 사각형을 지워 버려서, 테두리가 아니라 안쪽이 까맣게 칠해진다.
  roundedRectPath(
    ctx,
    box.x + inset,
    box.y + inset,
    box.width - inset * 2,
    box.height - inset * 2,
    radius
  );
  ctx.fillStyle = '#000000';
  ctx.fill('evenodd');
  ctx.restore();
}

function drawImage(ctx, state, width, height, imageBox, era) {
  if (!state.image) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(imageBox.x, imageBox.y, imageBox.width, imageBox.height);
  ctx.clip();

  const phone = era === '2004' ? featurePhoneFrame(state.image, imageBox, state.fit) : null;
  if (phone) {
    // 보간은 켠 채로 둔다. 끄면 네모 화소가 도드라져 레트로 게임처럼
    // 보이는데, 그 시절 사진의 인상은 그게 아니라 부드러운 뭉개짐이다.
    ctx.drawImage(phone, imageBox.x, imageBox.y, imageBox.width, imageBox.height);
    drawPhoneHaze(ctx, imageBox);
    drawViewfinderMask(ctx, imageBox);
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

/** 이미 시작된 경로에 둥근 사각형을 **덧그린다.** beginPath 를 부르지 않는다. */
function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
/**
 * 싸이월드 미니홈피의 링 바인더.
 *
 * 미니홈피를 한 장의 그림으로 떠올릴 때 가장 먼저 나오는 것이 이 고리다.
 * 페이지 왼쪽에 금속 고리 세 개가 물려 있었다.
 */
function drawBinderRings(ctx, x, top, bottom, size) {
  const count = 3;
  const gap = (bottom - top) / (count + 1);

  for (let i = 1; i <= count; i += 1) {
    const y = top + gap * i;

    // 종이에 뚫린 구멍. 안쪽이 살짝 어두워야 파인 것처럼 보인다.
    ctx.fillStyle = '#dde5eb';
    roundedRect(ctx, x - size * 0.34, y - size * 0.30, size * 0.68, size * 0.60, size * 0.30);
    ctx.fill();

    // 구멍을 통과하는 금속 고리. 구멍보다 크게 그려 걸쳐 있게 만든다.
    ctx.strokeStyle = '#8d9aa4';
    ctx.lineWidth = Math.max(2, size * 0.16);
    roundedRect(ctx, x - size * 0.72, y - size * 0.46, size * 1.44, size * 0.92, size * 0.46);
    ctx.stroke();

    // 위쪽에 흰 선을 얹으면 금속처럼 빛나 보인다.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.beginPath();
    ctx.moveTo(x - size * 0.5, y - size * 0.42);
    ctx.lineTo(x + size * 0.5, y - size * 0.42);
    ctx.stroke();
  }
}

/**
 * 2004 — 싸이월드 미니홈피.
 *
 * 실제 미니홈피에서 눈에 남는 것만 골랐다. 화면을 통째로 옮기면 카드가
 * 아니라 스크린샷이 된다.
 *
 * - `TODAY 23 | TOTAL 12,458` — TODAY 숫자는 빨강, TOTAL 숫자는 남색.
 *   이 색 대비가 미니홈피 상단의 인상이었다.
 * - 왼쪽 링 바인더
 * - 사진첩 칸
 * - `TODAY IS...` 기분 바 — 그 아래가 다이어리 글자리다
 * - 하단 BGM
 */
/**
 * 미니홈피는 누구에게 보여 주느냐에 따라 꾸미는 방식이 달랐다.
 *
 * 여기가 Persona 가 실제로 하는 일이다. 전에는 세 모습이 글자색만 달라서
 * 골라도 바뀐 것이 없어 보였다 — 픽셀로 재 보니 0.5~6.9% 차이였다.
 */
const MINIHOMPY_BY_PERSONA = {
  normal: {
    accent: '#2f8f6f',
    title: 'Director. My Life',
    mood: '그냥',
    moodColor: '#e2624f',
    barTint: '#f4f9fc',
    page: '#ffffff',
    edge: '#b9cddb',
    badge: null,
  },
  social: {
    accent: '#d1467f',
    title: '★ 오늘의 나 ★',
    mood: '신남',
    moodColor: '#d1467f',
    barTint: '#fdf1f6',
    page: '#fff5fa',
    edge: '#e8aac6',
    badge: { text: '일촌평 12', color: '#d1467f' },
  },
  'close-friends': {
    accent: '#2c6ea8',
    title: '나만 보는 일기',
    mood: '피곤',
    moodColor: '#2c6ea8',
    barTint: '#f2f7fb',
    page: '#f2f7fd',
    edge: '#9ec0e0',
    badge: { text: '비공개', color: '#2c6ea8' },
  },
};

/**
 * 사진을 아직 안 고른 사진첩 칸.
 *
 * 비워 두면 흰 사각형에 얇은 테두리만 남아 서식처럼 보인다. 첫 화면이
 * 그러면 무엇을 하는 도구인지 알기 어렵다. 무엇이 들어갈 자리인지
 * 그림으로 알려 준다.
 */
function drawPhotoPlaceholder(ctx, box, accent) {
  ctx.fillStyle = '#eef3f7';
  ctx.fillRect(box.x, box.y, box.width, box.height);

  const unit = Math.min(box.width, box.height);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2 - unit * 0.06;
  const w = unit * 0.36;
  const h = w * 0.72;

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(2, unit * 0.014);
  ctx.lineJoin = 'round';

  // 사진 테두리
  roundedRect(ctx, cx - w / 2, cy - h / 2, w, h, unit * 0.03);
  ctx.stroke();

  // 해와 산 — 사진을 뜻하는 가장 익숙한 그림이다.
  ctx.beginPath();
  ctx.arc(cx - w * 0.22, cy - h * 0.16, unit * 0.035, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - w * 0.4, cy + h * 0.28);
  ctx.lineTo(cx - w * 0.06, cy - h * 0.06);
  ctx.lineTo(cx + w * 0.14, cy + h * 0.14);
  ctx.lineTo(cx + w * 0.28, cy);
  ctx.lineTo(cx + w * 0.4, cy + h * 0.28);
  ctx.stroke();
  ctx.restore();

  metaText(
    ctx, '사진을 올려 보세요',
    cx, cy + h * 0.62, unit * 0.075, '#8aa9bf', 'center'
  );
}

function drawMinihompy(ctx, width, height, imageBox, layer, persona, hasImage) {
  if (layer !== 'under') return;

  const skin = MINIHOMPY_BY_PERSONA[persona] ?? MINIHOMPY_BY_PERSONA.normal;
  const pad = width * 0.05;
  const cardX = pad;
  const cardY = height * 0.05;
  const cardW = width - pad * 2;
  const cardH = height * 0.9;
  const inner = width * 0.012;

  // 종이 한 장. 미니홈피는 늘 흰 페이지였다.
  ctx.fillStyle = skin.page;
  roundedRect(ctx, cardX, cardY, cardW, cardH, width * 0.022);
  ctx.fill();
  ctx.strokeStyle = skin.edge;
  ctx.lineWidth = Math.max(2, width * 0.003);
  roundedRect(ctx, cardX, cardY, cardW, cardH, width * 0.022);
  ctx.stroke();

  // 페이지 안쪽 연한 테두리
  ctx.strokeStyle = '#e4eef5';
  ctx.lineWidth = Math.max(1, width * 0.0018);
  roundedRect(
    ctx, cardX + inner, cardY + inner,
    cardW - inner * 2, cardH - inner * 2, width * 0.018
  );
  ctx.stroke();

  // TODAY / TOTAL 카운터. 숫자만 색이 달랐다.
  const counterY = cardY + height * 0.028;
  const counterSize = width * 0.026;
  const left = cardX + width * 0.085;
  let cursor = left;
  const run = (text, color) => {
    metaText(ctx, text, cursor, counterY, counterSize, color);
    ctx.font = `700 ${counterSize}px ${FONT_STACK}`;
    cursor += ctx.measureText(text).width;
  };
  run('TODAY ', '#5b6b76');
  run('23', '#e2352b');
  run('  |  ', '#c3d2dc');
  run('TOTAL ', '#5b6b76');
  run('12,458', '#2c4f7c');

  // 미니홈피 타이틀. 이 자리가 비어 있으면 카드가 서식처럼 보인다.
  const titleY = cardY + height * 0.085;
  metaText(ctx, skin.title, cardX + width * 0.085, titleY, width * 0.042, skin.accent);

  // EDIT 칩. 타이틀 옆에 늘 붙어 있던 작은 파란 버튼이다.
  ctx.font = `700 ${width * 0.019}px ${FONT_STACK}`;
  const titleWidth = (() => {
    ctx.font = `700 ${width * 0.042}px ${FONT_STACK}`;
    return ctx.measureText(skin.title).width;
  })();
  const chipX = cardX + width * 0.085 + titleWidth + width * 0.018;
  const chipW = width * 0.058;
  const chipH = height * 0.028;
  ctx.fillStyle = skin.accent;
  roundedRect(ctx, chipX, titleY + height * 0.012, chipW, chipH, chipH * 0.25);
  ctx.fill();
  metaText(ctx, 'EDIT', chipX + chipW / 2, titleY + height * 0.017, width * 0.019, '#ffffff', 'center');

  // 타이틀 아래 구분선
  ctx.strokeStyle = '#cfe0d9';
  ctx.lineWidth = Math.max(1, width * 0.002);
  ctx.beginPath();
  ctx.moveTo(cardX + width * 0.085, titleY + height * 0.058);
  ctx.lineTo(cardX + cardW - width * 0.04, titleY + height * 0.058);
  ctx.stroke();

  // 왼쪽 링 바인더
  drawBinderRings(
    ctx, cardX + width * 0.03,
    cardY + height * 0.09, cardY + cardH - height * 0.06,
    width * 0.038
  );

  // 사진첩 칸
  const m = width * 0.013;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(imageBox.x - m, imageBox.y - m, imageBox.width + m * 2, imageBox.height + m * 2);
  if (!hasImage) drawPhotoPlaceholder(ctx, imageBox, skin.accent);
  ctx.strokeStyle = '#9fc0d6';
  ctx.lineWidth = Math.max(1, width * 0.002);
  ctx.strokeRect(imageBox.x - m, imageBox.y - m, imageBox.width + m * 2, imageBox.height + m * 2);

  // TODAY IS... 기분 바. 사진 아래, 다이어리 글 위에 놓인다.
  const barX = imageBox.x - m;
  const barW = imageBox.width + m * 2;
  const barY = imageBox.y + imageBox.height + height * 0.028;
  const barH = height * 0.045;

  ctx.fillStyle = skin.barTint;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeStyle = '#9fc0d6';
  ctx.lineWidth = Math.max(1, width * 0.002);
  ctx.strokeRect(barX, barY, barW, barH);

  const barTextY = barY + barH * 0.28;
  metaText(ctx, 'TODAY IS...', barX + width * 0.022, barTextY, width * 0.022, skin.accent);
  metaText(
    ctx, `♥  ${skin.mood}`,
    barX + barW - width * 0.022, barTextY, width * 0.022, skin.moodColor, 'right'
  );

  // 누구에게 열어 둔 홈피인지 사진 위에 표시한다. 모습을 바꿨을 때
  // 가장 먼저 눈에 들어오는 자리다.
  if (skin.badge) {
    const label = skin.badge.text;
    const size = width * 0.021;
    ctx.font = `700 ${size}px ${FONT_STACK}`;
    const padX = width * 0.016;
    const badgeW = ctx.measureText(label).width + padX * 2;
    const badgeH = height * 0.036;
    const badgeX = imageBox.x + imageBox.width - badgeW - width * 0.018;
    const badgeY = imageBox.y + height * 0.018;

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH * 0.32);
    ctx.fill();
    ctx.strokeStyle = skin.badge.color;
    ctx.lineWidth = Math.max(1, width * 0.002);
    roundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH * 0.32);
    ctx.stroke();
    metaText(
      ctx, label, badgeX + badgeW / 2, badgeY + badgeH * 0.26,
      size, skin.badge.color, 'center'
    );
  }

  // 하단 BGM
  metaText(
    ctx, '♪  BGM  —  그 시절 그 노래',
    cardX + width * 0.085, cardY + cardH - height * 0.05, width * 0.021, skin.accent
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
    drawMinihompy(ctx, width, height, composition.imageBox, layer, state.persona, Boolean(state.image));
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

/**
 * 모습(Persona)이 문구를 어떻게 받쳐 주는가.
 *
 * 모습은 그동안 주로 배경색을 바꿨는데, **사진을 올리면 배경색이 보이지
 * 않는다.** 사진 위에 문구를 얹는 것이 이 도구의 기본 사용법이라, 정작
 * 그때 모습을 골라도 바뀌는 것이 거의 없었다 — 픽셀로 재니 2~9% 였다.
 *
 * 그래서 사진 위에도 남는 층을 모습마다 다르게 깐다. 시대 장식과 겹치지
 * 않는다. 시대는 "언제" 를, 모습은 "누구에게" 를 맡는다.
 */
function drawPersonaEmphasis(ctx, state, width, height, block) {
  // 투명 배경은 장식을 그리지 않는다는 약속을 여기서도 지킨다.
  if (state.transparentBg) return;

  // 2004 는 건너뛴다. 밝은 싸이월드 페이지 위에 어두운 받침을 깔면 어두운
  // 다이어리 글이 묻힌다(실제로 대비가 1.5:1 까지 떨어졌다). 이 시대는
  // 페이지 스킨·제목·기분·배지가 이미 모습을 말해 준다.
  if (state.era === '2004') return;

  if (state.persona === 'social') {
    // 보여지는 나: 피드에서 눈에 걸리도록 아래를 크게 눌러 준다.
    const gradient = ctx.createLinearGradient(0, height * 0.38, 0, height);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height * 0.38, width, height * 0.62);
    return;
  }

  if (state.persona === 'close-friends') {
    // 가까운 사람 앞의 나: 문구만 감싸는 쪽지. 화면 전체가 아니라
    // 글자 블록에만 붙어서 사적인 느낌이 난다.
    const padX = width * 0.045;
    const padY = height * 0.035;
    const x = Math.max(0, block.left - padX);
    const y = Math.max(0, block.top - padY);
    const w = Math.min(width - x, block.width + padX * 2);
    const h = Math.min(height - y, block.height + padY * 2);

    ctx.save();
    ctx.fillStyle = 'rgba(18, 22, 30, 0.52)';
    roundedRect(ctx, x, y, w, h, Math.min(w, h) * 0.14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = Math.max(1, width * 0.002);
    roundedRect(ctx, x, y, w, h, Math.min(w, h) * 0.14);
    ctx.stroke();
    ctx.restore();
  }
  // 기본은 아무것도 깔지 않는다. 담백하게 두는 것이 그 모습이다.
}

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

  // 문구를 그리기 직전에 모습별 받침을 깐다. 글자 블록의 실제 크기를
  // 알아야 쪽지 배경을 정확히 맞출 수 있어서 이 자리에 둔다.
  drawPersonaEmphasis(ctx, state, width, height, {
    left,
    top,
    width: blockWidth,
    height: blockHeight,
  });

  // 받침을 그리면서 바뀐 채우기 색을 문구 색으로 되돌린다.
  ctx.fillStyle = state.color;

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
