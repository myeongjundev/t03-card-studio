import { SCHEMA_VERSION, validateTemplate } from './schema.js';

export const STORAGE_KEY = 't03-card-studio/templates';

/**
 * localStorage 읽기/쓰기.
 *
 * 저장소가 손상되어 있어도 앱을 죽이지 않고, 그렇다고 사용자 데이터를
 * 조용히 지우지도 않는다. 읽을 수 없는 값은 별도 키로 옮겨 보존한 뒤
 * 빈 목록으로 시작한다. (원칙 5.3)
 */

function isAvailable() {
  try {
    const probe = '__t03_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    // 사생활 보호 모드나 저장소 차단 환경
    return false;
  }
}

function quarantine(rawValue) {
  try {
    const backupKey = `${STORAGE_KEY}.corrupt-${Date.now()}`;
    window.localStorage.setItem(backupKey, rawValue);
    window.localStorage.removeItem(STORAGE_KEY);
    return backupKey;
  } catch {
    return null;
  }
}

/**
 * @returns {{templates: object[], warning: string|null}}
 */
export function loadTemplates() {
  if (!isAvailable()) {
    return {
      templates: [],
      warning:
        '이 브라우저에서는 저장소를 쓸 수 없어 템플릿이 유지되지 않습니다. 사생활 보호 모드인지 확인해 주세요.',
    };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { templates: [], warning: null };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const backupKey = quarantine(raw);
    return {
      templates: [],
      warning: backupKey
        ? `저장된 템플릿을 읽지 못해 빈 목록으로 시작합니다. 원본은 지우지 않고 '${backupKey}' 에 보관했습니다.`
        : '저장된 템플릿을 읽지 못해 빈 목록으로 시작합니다.',
    };
  }

  const list = Array.isArray(parsed?.templates) ? parsed.templates : null;
  if (!list) {
    const backupKey = quarantine(raw);
    return {
      templates: [],
      warning: backupKey
        ? `저장된 템플릿의 형식이 올바르지 않아 빈 목록으로 시작합니다. 원본은 '${backupKey}' 에 보관했습니다.`
        : '저장된 템플릿의 형식이 올바르지 않아 빈 목록으로 시작합니다.',
    };
  }

  // 개별 항목이 깨졌다면 그 항목만 건너뛴다. 나머지 정상 템플릿은 살린다.
  const templates = [];
  let skipped = 0;
  list.forEach((item, index) => {
    const result = validateTemplate(item, index);
    if (result.ok) templates.push(result.value);
    else skipped += 1;
  });

  return {
    templates,
    warning:
      skipped > 0
        ? `저장된 템플릿 ${skipped}개는 형식이 맞지 않아 목록에서 제외했습니다.`
        : null,
  };
}

/**
 * @returns {{ok: true} | {ok: false, message: string}}
 */
export function saveTemplates(templates) {
  if (!isAvailable()) {
    return {
      ok: false,
      message: '이 브라우저에서는 저장소를 쓸 수 없어 템플릿을 저장하지 못했습니다.',
    };
  }
  try {
    const payload = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      templates,
    });
    window.localStorage.setItem(STORAGE_KEY, payload);
    return { ok: true };
  } catch (error) {
    const full = error?.name === 'QuotaExceededError';
    return {
      ok: false,
      message: full
        ? '브라우저 저장 공간이 가득 차 템플릿을 저장하지 못했습니다. 오래된 템플릿을 지운 뒤 다시 시도해 주세요.'
        : '템플릿을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }
}
