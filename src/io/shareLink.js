import { validateTemplate, templateFromState, stateFromTemplate } from '../templates/schema.js';

/**
 * 카드 설정을 링크 하나에 담는다.
 *
 * 서버가 없으므로 상태를 주소 자체에 넣는다. 해시(#) 뒤에 두는 이유는
 * 해시가 서버로 전송되지 않기 때문이다. 쿼리스트링에 넣으면 문구가
 * 접속 기록이나 중계 서버 로그에 남을 수 있다.
 *
 * 담는 값은 템플릿과 똑같다. 그래서 검증도 템플릿 검증(validateTemplate)을
 * 그대로 재사용한다. 링크용 검증을 따로 만들면 두 벌이 어긋난다.
 *
 * 배경 이미지는 담지 않는다. 템플릿과 같은 이유이며, 이미지를 넣으면
 * 주소 길이 한계를 바로 넘긴다.
 */

export const SHARE_PREFIX = '#card=';

/** 브라우저가 안정적으로 다루는 주소 길이. 이보다 길어지면 만들지 않는다. */
const MAX_URL_LENGTH = 2000;

/** 담을 필드. 템플릿에서 이름과 시각 정보를 뺀 것이다. */
const SHARED_FIELDS = [
  'ratio',
  'fit',
  'bgColor',
  'transparentBg',
  'text',
  'textX',
  'textY',
  'fontSize',
  'color',
  'strokeWidth',
  'strokeColor',
  'lineHeight',
  'align',
  'persona',
  'era',
];

/** 유니코드를 그대로 base64 로 바꾼다. btoa 는 라틴1 만 받으므로 UTF-8 로 먼저 바꾼다. */
function encodeBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  // 주소에 그대로 쓸 수 있도록 + / = 를 바꾼다.
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(encoded) {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * @returns {{ok: true, url: string} | {ok: false, message: string}}
 */
export function buildShareUrl(state, baseUrl = window.location.href) {
  const template = templateFromState(state, '공유된 카드');
  const payload = {};
  for (const field of SHARED_FIELDS) payload[field] = template[field];

  let encoded;
  try {
    encoded = encodeBase64Url(JSON.stringify(payload));
  } catch {
    return { ok: false, message: '링크를 만들지 못했습니다.' };
  }

  const base = baseUrl.split('#')[0];
  const url = `${base}${SHARE_PREFIX}${encoded}`;

  if (url.length > MAX_URL_LENGTH) {
    return {
      ok: false,
      message: `문구가 길어 링크가 너무 깁니다(${url.length}자, 최대 ${MAX_URL_LENGTH}자). 문구를 줄이거나 템플릿으로 저장해 주세요.`,
    };
  }
  return { ok: true, url };
}

/**
 * 주소에서 카드 설정을 읽는다.
 *
 * 실패하면 조용히 무시하지 않고 이유를 돌려준다. 읽기에 실패했다고
 * 현재 편집 내용을 건드리지는 않는다 — 호출한 쪽이 성공을 확인한 뒤에만 적용한다.
 *
 * @returns {{ok: true, state: object} | {ok: false, message: string} | null}
 *   공유 링크가 아니면 null.
 */
export function readShareUrl(currentState, hash = window.location.hash) {
  if (!hash || !hash.startsWith(SHARE_PREFIX)) return null;

  const encoded = hash.slice(SHARE_PREFIX.length);
  if (!encoded) return { ok: false, message: '공유 링크에 카드 정보가 없습니다.' };

  let parsed;
  try {
    parsed = JSON.parse(decodeBase64Url(encoded));
  } catch {
    return {
      ok: false,
      message: '공유 링크가 손상되어 카드를 열지 못했습니다. 주소가 잘리지 않았는지 확인해 주세요.',
    };
  }

  // 템플릿과 같은 검증을 그대로 통과시킨다. 이름은 검증에 필요하므로 채워 준다.
  const result = validateTemplate({ ...parsed, name: '공유된 카드' }, 0);
  if (!result.ok) {
    // 검증 메시지는 템플릿 목록을 기준으로 쓰여 있다. 링크를 여는 사람에게
    // "1번째 템플릿"은 뜬금없는 말이라 그 부분만 걷어낸다.
    const reason = result.message.replace(/^1번째 템플릿[의에]\s*/, '');
    return {
      ok: false,
      message: `공유 링크의 내용이 올바르지 않아 열지 못했습니다. (${reason}) 지금 편집 중인 내용은 그대로 있습니다.`,
    };
  }

  return { ok: true, state: stateFromTemplate(result.value, currentState) };
}

/**
 * 클립보드에 복사한다. 권한이 없거나 실패하면 알려준다.
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
