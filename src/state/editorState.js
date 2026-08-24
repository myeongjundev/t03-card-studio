/**
 * 편집 상태의 단일 진실 원천.
 *
 * 좌표 규칙 (docs/ARCHITECTURE.md 2장)
 * - 캔버스 폭은 어떤 비율에서도 항상 1080px 이다. 높이만 달라진다.
 * - 문구 위치는 정규화 좌표 0~1 로 저장하고, 그릴 때 x*W / y*H 로 환산한다.
 * - 글자 크기는 1080 기준 절대 px 이다. 폭이 고정이라 환산이 필요 없다.
 */

export const CANVAS_WIDTH = 1080;

export const RATIOS = {
  '1:1': { label: '1:1', width: 1080, height: 1080 },
  '4:5': { label: '4:5', width: 1080, height: 1350 },
  '9:16': { label: '9:16', width: 1080, height: 1920 },
};

export const RATIO_KEYS = Object.keys(RATIOS);

export const FITS = ['cover', 'contain'];
export const ALIGNS = ['left', 'center', 'right'];

/** 값 범위. JSON 가져오기 검증(src/templates/schema.js)에서도 같은 상수를 쓴다. */
export const LIMITS = {
  fontSize: { min: 8, max: 400, step: 1 },
  lineHeight: { min: 0.8, max: 3, step: 0.05 },
  textX: { min: 0, max: 1, step: 0.001 },
  textY: { min: 0, max: 1, step: 0.001 },
  textMaxLength: 2000,
  nameMaxLength: 60,
};

/** #rgb / #rrggbb 만 허용한다. 검증과 UI가 같은 기준을 쓰도록 여기에 둔다. */
export const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** color input 과 Canvas가 항상 같은 값을 보도록 #rgb를 #rrggbb로 정규화한다. */
export function normalizeHexColor(value, fallback) {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) return fallback;
  if (value.length === 4) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return value.toLowerCase();
}

/**
 * 첫 방문자가 빈 화면을 보지 않도록 예제 값으로 시작한다.
 * 어디까지나 초기 표시 상태이며, 템플릿 CRUD 를 대신하지 않는다.
 */
export function createInitialState() {
  return {
    ratio: '1:1',
    image: null, // HTMLImageElement. 런타임 전용이라 템플릿에 저장하지 않는다.
    imageName: '',
    fit: 'cover',
    bgColor: '#1b2a4a',
    transparentBg: false,
    text: '오늘도\n무사히',
    textX: 0.5,
    textY: 0.5,
    fontSize: 140,
    color: '#ffffff',
    lineHeight: 1.25,
    align: 'center',
  };
}

const clampNumber = (value, { min, max }, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const pickFrom = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback;

/**
 * 상태를 항상 유효한 범위 안으로 되돌린다.
 * 슬라이더·직접 입력·템플릿 불러오기가 모두 이 함수를 거치게 해서
 * 잘못된 값이 렌더러까지 흘러가지 않도록 막는다.
 */
export function clampState(state) {
  const base = createInitialState();
  return {
    ...state,
    ratio: pickFrom(state.ratio, RATIO_KEYS, base.ratio),
    fit: pickFrom(state.fit, FITS, base.fit),
    align: pickFrom(state.align, ALIGNS, base.align),
    bgColor: normalizeHexColor(state.bgColor, base.bgColor),
    color: normalizeHexColor(state.color, base.color),
    transparentBg: Boolean(state.transparentBg),
    text: String(state.text ?? '').slice(0, LIMITS.textMaxLength),
    textX: clampNumber(state.textX, LIMITS.textX, base.textX),
    textY: clampNumber(state.textY, LIMITS.textY, base.textY),
    fontSize: clampNumber(state.fontSize, LIMITS.fontSize, base.fontSize),
    lineHeight: clampNumber(state.lineHeight, LIMITS.lineHeight, base.lineHeight),
  };
}

/** 현재 비율의 출력 크기. 미리보기 캔버스와 다운로드가 이 값을 함께 쓴다. */
export function getCanvasSize(ratio) {
  return RATIOS[ratio] ?? RATIOS['1:1'];
}
