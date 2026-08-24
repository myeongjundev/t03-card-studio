import {
  RATIO_KEYS,
  FITS,
  ALIGNS,
  LIMITS,
  HEX_COLOR,
  createInitialState,
} from '../state/editorState.js';

/**
 * 템플릿 검증.
 *
 * 이 파일에는 localStorage 도, React 상태도 등장하지 않는다.
 * 순수 함수만 두어서 검증 도중에는 기존 데이터에 접근조차 할 수 없게 만든다.
 * 카드 5 의 요구사항 — "전체 검증이 끝나기 전에 기존 데이터를 덮어쓰지 않는다" —
 * 를 규율이 아니라 구조로 보장하기 위해서다.
 */

export const SCHEMA_VERSION = 1;

/** 없으면 복원이 불가능한 값들. 하나라도 빠지면 가져오기를 중단한다. */
const REQUIRED_FIELDS = [
  'name',
  'ratio',
  'text',
  'textX',
  'textY',
  'fontSize',
  'color',
];

const ordinal = (index) => `${index + 1}번째 템플릿`;
const fail = (message) => ({ ok: false, message });

function checkNumber(value, key, limit, where) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return `${where}의 '${key}' 은(는) 숫자여야 합니다.`;
  }
  if (value < limit.min || value > limit.max) {
    return `${where}의 '${key}' 값 ${value} 이(가) 허용 범위(${limit.min} ~ ${limit.max})를 벗어났습니다.`;
  }
  return null;
}

/** 값이 없거나 잘못되었을 때 기본값으로 대신할 수 있는 선택 항목. */
function optionalChoice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function newTemplateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tpl-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * 템플릿 하나를 검증하고 정규화한다.
 * @returns {{ok: true, value: object} | {ok: false, message: string}}
 */
export function validateTemplate(raw, index = 0) {
  const where = ordinal(index);
  const base = createInitialState();

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail(`${where}이(가) 객체 형태가 아닙니다.`);
  }

  // 1) 필수 항목 존재 여부
  for (const field of REQUIRED_FIELDS) {
    if (raw[field] === undefined || raw[field] === null) {
      return fail(`${where}에 '${field}' 항목이 없습니다.`);
    }
  }

  // 2) 타입 검사
  if (typeof raw.name !== 'string') {
    return fail(`${where}의 'name' 은(는) 문자열이어야 합니다.`);
  }
  if (typeof raw.text !== 'string') {
    return fail(`${where}의 'text' 은(는) 문자열이어야 합니다.`);
  }

  const name = raw.name.trim();
  if (name === '') return fail(`${where}의 이름이 비어 있습니다.`);
  if (name.length > LIMITS.nameMaxLength) {
    return fail(
      `${where}의 이름이 너무 깁니다. (최대 ${LIMITS.nameMaxLength}자)`
    );
  }
  if (raw.text.length > LIMITS.textMaxLength) {
    return fail(
      `${where}의 문구가 너무 깁니다. (최대 ${LIMITS.textMaxLength}자)`
    );
  }

  // 3) 값 범위 검사
  if (!RATIO_KEYS.includes(raw.ratio)) {
    return fail(
      `${where}의 'ratio' 값 '${raw.ratio}' 은(는) 지원하지 않습니다. ${RATIO_KEYS.join(' / ')} 중 하나여야 합니다.`
    );
  }

  const numberError =
    checkNumber(raw.textX, 'textX', LIMITS.textX, where) ??
    checkNumber(raw.textY, 'textY', LIMITS.textY, where) ??
    checkNumber(raw.fontSize, 'fontSize', LIMITS.fontSize, where);
  if (numberError) return fail(numberError);

  // lineHeight 는 없으면 기본값으로 채우되, 있으면 범위를 검사한다.
  let lineHeight = base.lineHeight;
  if (raw.lineHeight !== undefined && raw.lineHeight !== null) {
    const error = checkNumber(raw.lineHeight, 'lineHeight', LIMITS.lineHeight, where);
    if (error) return fail(error);
    lineHeight = raw.lineHeight;
  }

  if (!HEX_COLOR.test(raw.color)) {
    return fail(
      `${where}의 'color' 값 '${raw.color}' 이(가) 색상 형식이 아닙니다. (#ffffff 형태)`
    );
  }
  if (
    raw.bgColor !== undefined &&
    raw.bgColor !== null &&
    !HEX_COLOR.test(raw.bgColor)
  ) {
    return fail(
      `${where}의 'bgColor' 값 '${raw.bgColor}' 이(가) 색상 형식이 아닙니다. (#ffffff 형태)`
    );
  }

  const now = new Date().toISOString();

  return {
    ok: true,
    value: {
      id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : newTemplateId(),
      name,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
      ratio: raw.ratio,
      text: raw.text,
      textX: raw.textX,
      textY: raw.textY,
      fontSize: raw.fontSize,
      color: raw.color,
      lineHeight,
      bgColor: HEX_COLOR.test(raw.bgColor) ? raw.bgColor : base.bgColor,
      transparentBg: Boolean(raw.transparentBg),
      fit: optionalChoice(raw.fit, FITS, base.fit),
      align: optionalChoice(raw.align, ALIGNS, base.align),
    },
  };
}

/**
 * 가져오기 파일 전체를 검증한다. 부분 성공은 없다. 전부 통과하거나 전부 거부한다.
 * @returns {{ok: true, templates: object[]} | {ok: false, message: string}}
 */
export function validateImportPayload(parsed) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fail('파일의 최상위 구조가 객체가 아닙니다.');
  }
  if (!Array.isArray(parsed.templates)) {
    return fail("'templates' 항목이 없거나 배열이 아닙니다.");
  }
  if (parsed.templates.length === 0) {
    return fail('파일에 가져올 템플릿이 없습니다.');
  }

  const seenIds = new Set();
  const templates = [];

  for (let index = 0; index < parsed.templates.length; index += 1) {
    const result = validateTemplate(parsed.templates[index], index);
    if (!result.ok) return result;

    // 파일 안에서 id 가 겹치면 새로 발급한다. 중복 id 는 수정·삭제를 망가뜨린다.
    const template = result.value;
    if (seenIds.has(template.id)) template.id = newTemplateId();
    seenIds.add(template.id);
    templates.push(template);
  }

  return { ok: true, templates };
}

/** 현재 편집 상태에서 템플릿을 만든다. 이미지는 담지 않는다. */
export function templateFromState(state, name) {
  const now = new Date().toISOString();
  return {
    id: newTemplateId(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    ratio: state.ratio,
    fit: state.fit,
    bgColor: state.bgColor,
    transparentBg: state.transparentBg,
    text: state.text,
    textX: state.textX,
    textY: state.textY,
    fontSize: state.fontSize,
    color: state.color,
    lineHeight: state.lineHeight,
    align: state.align,
  };
}

/** 템플릿을 편집 상태로 되돌린다. 이미지는 템플릿에 없으므로 현재 것을 유지한다. */
export function stateFromTemplate(template, currentState) {
  return {
    ...currentState,
    ratio: template.ratio,
    fit: template.fit,
    bgColor: template.bgColor,
    transparentBg: template.transparentBg,
    text: template.text,
    textX: template.textX,
    textY: template.textY,
    fontSize: template.fontSize,
    color: template.color,
    lineHeight: template.lineHeight,
    align: template.align,
  };
}
