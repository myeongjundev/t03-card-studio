import test from 'node:test';
import assert from 'node:assert/strict';
import { ERA_DEFINITIONS, ERA_KEYS, getEraDefinition } from '../src/state/eras.js';

test('시대 정의 한 곳이 UI와 상태의 허용값을 모두 제공한다', () => {
  assert.deepEqual(ERA_KEYS, ['2004', '2012', '2026']);
  assert.equal(new Set(ERA_KEYS).size, ERA_DEFINITIONS.length);

  for (const era of ERA_DEFINITIONS) {
    assert.ok(era.label && era.caption && era.renderKind && era.imageTreatment);
    assert.equal(getEraDefinition(era.id), era);
  }
});

test('알 수 없는 시대는 안전한 최신 시대 정의로 돌아간다', () => {
  assert.equal(getEraDefinition('unknown').id, '2026');
});
