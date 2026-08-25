import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createInitialState } from '../src/state/editorState.js';
import { VERTICAL_SAFE_BOTTOM_RATIO } from '../src/state/readyCheck.js';
import { templateFromState, validateImportPayload } from '../src/templates/schema.js';
import { traceFor } from './helpers/eraGolden.js';

/**
 * 9:16 안전 영역 가이드가 PNG 에 들어가지 않는다는 약속을 지킨다.
 *
 * 이 약속은 "안 그리게 조심한다" 가 아니라 **구조로** 지켜진다.
 * 가이드 표시 여부(showSafeArea)는 PreviewPanel 의 지역 상태이고
 * EditorState 에 없다. renderCard 는 EditorState 만 받으므로
 * 가이드가 켜졌는지 알 방법 자체가 없다.
 *
 * 아래 테스트는 그 구조가 무너지지 않았는지 확인한다. 실제 PNG 바이트
 * 비교는 브라우저에서 한다 (`scripts/browser-checks.js` 의 safeArea).
 */

const renderSource = fs.readFileSync(new URL('../src/render/renderCard.js', import.meta.url), 'utf8');

test('안전 영역은 EditorState 에 없다', () => {
  // 여기에 필드가 생기는 순간 renderCard 가 그것을 볼 수 있게 된다.
  const keys = Object.keys(createInitialState());
  const suspicious = keys.filter((key) => /safe/i.test(key));
  assert.deepEqual(suspicious, [], `EditorState 에 안전 영역 필드가 생겼다: ${suspicious}`);
});

test('renderCard 는 안전 영역을 참조하지 않는다', () => {
  assert.ok(
    !/safe/i.test(renderSource),
    'renderCard.js 가 안전 영역을 언급한다. 가이드가 PNG 에 들어갈 수 있다.'
  );
  assert.ok(
    !renderSource.includes('readyCheck'),
    'renderCard.js 가 readyCheck 를 가져온다. 렌더러는 게시 전 확인을 몰라야 한다.'
  );
});

test('안전 영역 비율은 게시 전 확인에서만 쓰인다', () => {
  // 값 자체는 있어야 한다. 없어졌다면 게시 전 확인이 조용히 죽은 것이다.
  assert.ok(VERTICAL_SAFE_BOTTOM_RATIO > 0 && VERTICAL_SAFE_BOTTOM_RATIO < 1);
});

test('안전 영역은 템플릿과 공유 링크에도 실리지 않는다', () => {
  // 저장 대상에 섞이면 다른 기기에서 열었을 때 PNG 에 들어갈 여지가 생긴다.
  const template = templateFromState(createInitialState(), '검사용');
  assert.deepEqual(Object.keys(template).filter((key) => /safe/i.test(key)), []);

  const result = validateImportPayload({ schemaVersion: 1, templates: [template] });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.templates[0]).filter((key) => /safe/i.test(key)), []);
});

test('9:16 렌더 기록에 안전 영역 띠가 없다', () => {
  // 캔버스 하단 18% 를 통째로 덮는 사각형이 있으면 가이드가 새어 든 것이다.
  const height = 1920;
  const band = height * (1 - VERTICAL_SAFE_BOTTOM_RATIO);
  for (const persona of ['normal', 'social', 'close-friends']) {
    const trace = traceFor(`${persona}|2026|9:16`);
    const suspects = trace.filter((line) => {
      const match = line.match(/^fillRect\(([-0-9.]+),([-0-9.]+),([-0-9.]+),([-0-9.]+)\)/);
      if (!match) return false;
      const [, , y, w, h] = match.map(Number);
      // 폭이 캔버스 전체이고, 높이가 안전 영역 띠와 비슷하며, 하단에서 시작하는 것.
      return w >= 1080 && Math.abs(h - band) < 2 && Math.abs(y - height * VERTICAL_SAFE_BOTTOM_RATIO) < 2;
    });
    assert.deepEqual(suspects, [], `${persona}: 안전 영역 띠로 보이는 사각형이 있다`);
  }
});
