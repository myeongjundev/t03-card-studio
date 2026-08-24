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

test('외곽선 항목이 없는 예전 템플릿도 기본값으로 복원된다', () => {
  const old = validTemplate();
  delete old.strokeWidth;
  delete old.strokeColor;

  const result = validateImportPayload(payload(old));
  assert.equal(result.ok, true);
  const base = createInitialState();
  assert.equal(result.templates[0].strokeWidth, base.strokeWidth);
  assert.equal(result.templates[0].strokeColor, base.strokeColor);
});

test('외곽선 값이 있으면 타입과 범위를 검사한다', () => {
  const tooThick = validateImportPayload(payload(validTemplate({ strokeWidth: 5 })));
  assert.equal(tooThick.ok, false);
  assert.match(tooThick.message, /strokeWidth/);

  const notNumber = validateImportPayload(payload(validTemplate({ strokeWidth: '굵게' })));
  assert.equal(notNumber.ok, false);

  const badColor = validateImportPayload(payload(validTemplate({ strokeColor: '검정' })));
  assert.equal(badColor.ok, false);
  assert.match(badColor.message, /strokeColor/);
});
