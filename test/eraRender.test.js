import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildEraGoldens, traceFor, goldenKeys, GOLDEN_PATH } from './helpers/eraGolden.js';

const stored = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));

test('시대별 렌더가 저장된 스냅샷과 같다', () => {
  assert.deepEqual(
    Object.keys(stored).sort(),
    goldenKeys().sort(),
    '조합 목록이 달라졌다. 의도한 변경이면 node scripts/update-era-goldens.mjs'
  );

  for (const [key, expected] of Object.entries(stored)) {
    const actual = traceFor(key);
    if (actual.length === expected.length && actual.every((line, i) => line === expected[i])) {
      continue;
    }
    // "달라졌다" 만 알리면 고칠 수가 없다. 몇 번째 호출이 어떻게 달라졌는지 짚는다.
    const at = actual.findIndex((line, i) => line !== expected[i]);
    const index = at === -1 ? Math.min(actual.length, expected.length) : at;
    assert.fail(
      [
        `${key} 의 렌더가 달라졌다.`,
        `  그리기 호출 수: ${expected.length} → ${actual.length}`,
        `  처음 어긋난 호출: #${index}`,
        `    저장: ${expected[index] ?? '(없음)'}`,
        `    현재: ${actual[index] ?? '(없음)'}`,
        '  의도한 변경이면 node scripts/update-era-goldens.mjs 로 갱신하고 git diff 로 확인할 것',
      ].join('\n')
    );
  }
});

test('스냅샷은 27개 조합을 모두 덮는다', () => {
  // 3 모습 × 3 시대 × 3 비율. 하나라도 빠지면 그 조합은 회귀를 못 잡는다.
  assert.equal(Object.keys(stored).length, 27);
  for (const [key, trace] of Object.entries(stored)) {
    assert.ok(trace.length > 0, `${key}: 그리기 호출이 하나도 없다`);
  }
});

test('같은 상태를 두 번 그리면 같은 기록이 나온다', () => {
  // 스냅샷이 의미가 있으려면 렌더가 결정적이어야 한다.
  // 시각(Date)이나 난수가 섞이면 여기서 걸린다.
  assert.deepEqual(buildEraGoldens(), buildEraGoldens(), '같은 입력인데 렌더 결과가 달라졌다');
});
