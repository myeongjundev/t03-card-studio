import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImportPayload } from '../src/templates/schema.js';
import { clampState, createInitialState } from '../src/state/editorState.js';

const validTemplate = (patch = {}) => ({
  id: 'template-1',
  name: '검사용',
  ratio: '1:1',
  text: '문구',
  textX: 0.5,
  textY: 0.5,
  fontSize: 100,
  color: '#ffffff',
  ...patch,
});

const payload = (template, schemaVersion = 1) => ({
  schemaVersion,
  templates: [template],
});

test('가져오기는 지원하지 않는 schemaVersion을 거부한다', () => {
  const result = validateImportPayload(payload(validTemplate(), 999));
  assert.equal(result.ok, false);
  assert.match(result.message, /schemaVersion/);
});

test('존재하는 선택 필드는 잘못된 타입이나 값을 거부한다', () => {
  for (const patch of [
    { transparentBg: 'false' },
    { fit: 'invalid' },
    { align: 42 },
  ]) {
    assert.equal(validateImportPayload(payload(validTemplate(patch))).ok, false);
  }
});

test('3자리 색상은 color input과 호환되는 6자리로 정규화한다', () => {
  const result = validateImportPayload(
    payload(validTemplate({ color: '#fF0', bgColor: '#123' }))
  );
  assert.equal(result.ok, true);
  assert.equal(result.templates[0].color, '#ffff00');
  assert.equal(result.templates[0].bgColor, '#112233');

  const state = clampState({ ...createInitialState(), color: '#AbC' });
  assert.equal(state.color, '#aabbcc');
});
