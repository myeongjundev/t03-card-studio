import { SCHEMA_VERSION, validateImportPayload } from '../templates/schema.js';

/**
 * 템플릿 JSON 내보내기 / 가져오기.
 *
 * 가져오기의 핵심은 기능이 아니라 순서다.
 *   파일 읽기 -> JSON 파싱 -> 구조 검증 -> 필수 항목 -> 타입 -> 값 범위
 *   -> 전부 통과한 뒤에야 저장
 *
 * 이 파일은 검증 결과를 돌려줄 뿐 저장은 하지 않는다.
 * 저장 여부는 호출한 쪽이 성공을 확인한 뒤에 결정한다.
 */

export const EXPORT_FILE_NAME = 'card-studio-templates.json';

export function buildExportPayload(templates) {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    templates,
  };
}

export function downloadTemplatesJson(templates) {
  const json = JSON.stringify(buildExportPayload(templates), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = EXPORT_FILE_NAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return blob.size;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsText(file);
  });
}

/**
 * 파일을 읽어 검증까지만 수행한다. 저장은 하지 않는다.
 * @returns {Promise<{ok: true, templates: object[]} | {ok: false, message: string}>}
 */
export async function readTemplatesFile(file) {
  // 1) 파일 읽기
  let raw;
  try {
    raw = await readFileAsText(file);
  } catch {
    return {
      ok: false,
      message:
        '파일을 읽지 못해 가져오기를 중단했습니다. 기존 템플릿은 그대로 있습니다.',
    };
  }

  // 2) JSON 문법
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      message: `JSON 문법이 올바르지 않아 가져오기를 중단했습니다. (${error.message}) 기존 템플릿은 그대로 있습니다.`,
    };
  }

  // 3~6) 구조 · 필수 항목 · 타입 · 값 범위
  const result = validateImportPayload(parsed);
  if (!result.ok) {
    return {
      ok: false,
      message: `${result.message} 가져오기를 중단했으며, 기존 템플릿은 그대로 있습니다.`,
    };
  }

  return result;
}
