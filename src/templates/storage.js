import { SCHEMA_VERSION, validateTemplate } from './schema.js';

export const STORAGE_KEY = 't03-card-studio/templates';

/**
 * localStorage 읽기/쓰기.
 *
 * 저장소가 손상되어 있어도 앱을 죽이지 않고, 그렇다고 사용자 데이터를
 * 조용히 지우지도 않는다. 읽을 수 없는 값은 별도 키로 옮겨 보존한 뒤
 * 빈 목록으로 시작한다. (원칙 5.3)
 */

// 손상 원본의 격리가 저장 공간 부족 등으로 실패하면, 후속 저장이 원본을
// 덮어쓰지 못하게 막는다. 격리에 성공한 뒤에만 다시 저장할 수 있다.
let pendingCorruptValue = null;

function quarantine(rawValue) {
  try {
    const backupKey = `${STORAGE_KEY}.corrupt-${Date.now()}`;
    window.localStorage.setItem(backupKey, rawValue);
    window.localStorage.removeItem(STORAGE_KEY);
    pendingCorruptValue = null;
    return backupKey;
  } catch {
    pendingCorruptValue = rawValue;
    return null;
  }
}

function corruptResult(raw, reason, recovered = []) {
  const backupKey = quarantine(raw);
  return {
    templates: recovered,
    warning: backupKey
      ? `${reason} 원본은 '${backupKey}' 에 보관했습니다.`
      : `${reason} 원본을 보존하기 위해 격리 전까지 템플릿 저장을 중단합니다.`,
  };
}

/**
 * @returns {{templates: object[], warning: string|null}}
 */
export function loadTemplates() {
  let raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      templates: [],
      warning:
        '이 브라우저에서는 저장소를 쓸 수 없어 템플릿이 유지되지 않습니다. 사생활 보호 모드인지 확인해 주세요.',
    };
  }
  if (!raw) return { templates: [], warning: null };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return corruptResult(raw, '저장된 템플릿을 읽지 못해 빈 목록으로 시작합니다.');
  }

  const list = Array.isArray(parsed?.templates) ? parsed.templates : null;
  if (!list) {
    return corruptResult(
      raw,
      '저장된 템플릿의 형식이 올바르지 않아 빈 목록으로 시작합니다.'
    );
  }

  // 개별 항목 손상이나 중복 ID도 원본 전체를 먼저 격리한다.
  const templates = [];
  let skipped = 0;
  let duplicateIds = 0;
  const seenIds = new Set();
  list.forEach((item, index) => {
    const result = validateTemplate(item, index);
    if (!result.ok) {
      skipped += 1;
      return;
    }
    if (seenIds.has(result.value.id)) {
      duplicateIds += 1;
      return;
    }
    seenIds.add(result.value.id);
    templates.push(result.value);
  });

  if (skipped > 0 || duplicateIds > 0) {
    const details = [
      skipped > 0 ? `형식이 맞지 않는 항목 ${skipped}개` : null,
      duplicateIds > 0 ? `중복 ID 항목 ${duplicateIds}개` : null,
    ].filter(Boolean).join(', ');
    return corruptResult(
      raw,
      `저장된 템플릿에서 ${details}를 제외하고 정상 항목 ${templates.length}개를 복구했습니다.`,
      templates
    );
  }

  return { templates, warning: null };
}

/**
 * @returns {{ok: true} | {ok: false, message: string}}
 */
export function saveTemplates(templates) {
  if (pendingCorruptValue !== null && !quarantine(pendingCorruptValue)) {
    return {
      ok: false,
      message: '손상된 기존 데이터를 아직 안전하게 격리하지 못해 저장을 중단했습니다. 저장 공간을 확보한 뒤 다시 시도해 주세요.',
    };
  }

  const seenIds = new Set();
  for (let index = 0; index < templates.length; index += 1) {
    const result = validateTemplate(templates[index], index);
    if (!result.ok || seenIds.has(result.value?.id)) {
      return {
        ok: false,
        message: result.ok
          ? '중복된 템플릿 ID가 있어 저장을 중단했습니다.'
          : `${result.message} 저장을 중단했습니다.`,
      };
    }
    seenIds.add(result.value.id);
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
