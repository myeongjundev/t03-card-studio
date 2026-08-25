import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReadyChecks, isInPotentialUiArea } from '../src/state/readyCheck.js';
import { createInitialState } from '../src/state/editorState.js';

test('9:16 하단 18%에 닿는 문구만 잠재 UI 충돌로 본다', () => {
  assert.equal(isInPotentialUiArea('9:16', { y: 1450, height: 100 }, 1920), false);
  assert.equal(isInPotentialUiArea('9:16', { y: 1500, height: 120 }, 1920), true);
  assert.equal(isInPotentialUiArea('4:5', { y: 1200, height: 150 }, 1350), false);
});

test('READY CHECK는 기존 렌더 결과를 경고로 조합한다', () => {
  const state = { ...createInitialState(), ratio: '9:16' };
  const checks = buildReadyChecks({
    state,
    layout: { shrunk: true, fontSize: 12, area: { y: 1700, height: 100 } },
    contrast: { passes: false, ratio: 1.2 },
    canExport: true,
    canvasHeight: 1920,
  });
  assert.deepEqual(
    checks.filter((item) => item.status === 'warn').map((item) => item.id),
    ['contrast', 'size', 'fit', 'vertical-safe-area']
  );
});
