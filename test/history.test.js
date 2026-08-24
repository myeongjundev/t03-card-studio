import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHistory,
  recordChange,
  undo,
  redo,
  canUndo,
  canRedo,
  HISTORY_LIMIT,
  BURST_WINDOW_MS,
} from '../src/state/history.js';

test('처음에는 되돌리기도 다시하기도 할 수 없다', () => {
  const history = createHistory();
  assert.equal(canUndo(history), false);
  assert.equal(canRedo(history), false);
  assert.equal(undo(history, 'A'), null);
  assert.equal(redo(history, 'A'), null);
});

test('묶음 시간 밖의 변경은 새 단계를 만든다', () => {
  let history = createHistory();
  const r = recordChange(history, 'A', 1000, 0);
  assert.equal(r.changed, true);
  assert.deepEqual(r.history.past, ['A']);
  assert.equal(canUndo(r.history), true);
});

test('묶음 시간 안의 변경은 새 단계를 만들지 않는다', () => {
  const history = createHistory();
  // 첫 변경 (t=0 -> lastChangeAt=0 은 "아직 없음" 을 뜻하므로 반드시 새 단계)
  const first = recordChange(history, 'A', 1000, 0);
  // 300ms 뒤, BURST_WINDOW_MS(600ms) 안이므로 같은 묶음
  const second = recordChange(first.history, 'B', 1300, 1000);
  assert.equal(second.changed, false);
  assert.deepEqual(second.history.past, ['A']);
});

test('묶음 시간을 벗어나면 다음 변경이 새 단계가 된다', () => {
  const history = createHistory();
  const first = recordChange(history, 'A', 0, 0);
  const second = recordChange(first.history, 'B', BURST_WINDOW_MS + 1, 0);
  assert.equal(second.changed, true);
  assert.deepEqual(second.history.past, ['A', 'B']);
});

test('되돌리기는 마지막 단계를 present 로 옮기고 future 에 지금 상태를 쌓는다', () => {
  const history = { past: ['A', 'B'], future: [] };
  const result = undo(history, 'C');
  assert.equal(result.state, 'B');
  assert.deepEqual(result.history.past, ['A']);
  assert.deepEqual(result.history.future, ['C']);
});

test('되돌린 뒤 다시하기는 되돌리기 전 상태로 복원한다', () => {
  const history = { past: ['A', 'B'], future: [] };
  const undone = undo(history, 'C');
  const redone = redo(undone.history, undone.state);
  assert.equal(redone.state, 'C');
  assert.deepEqual(redone.history.past, ['A', 'B']);
  assert.deepEqual(redone.history.future, []);
});

test('새 편집이 들어오면 다시하기 가지가 사라진다', () => {
  const history = { past: ['A', 'B'], future: [] };
  const undone = undo(history, 'C'); // past:[A] future:[C], present: B
  const edited = recordChange(undone.history, undone.state, 10000, 0); // 새 편집 D 로 이어짐
  assert.deepEqual(edited.history.future, []);
});

test('과거가 HISTORY_LIMIT 를 넘으면 오래된 것부터 버린다', () => {
  let history = createHistory();
  let now = 0;
  for (let i = 0; i < HISTORY_LIMIT + 10; i += 1) {
    const r = recordChange(history, `state-${i}`, now, 0);
    history = r.history;
    now += BURST_WINDOW_MS + 1; // 매번 새 묶음이 되도록 충분히 띄운다
  }
  assert.equal(history.past.length, HISTORY_LIMIT);
  assert.equal(history.past[0], `state-10`); // 앞의 10개는 밀려났다
});

test('되돌리기를 반복해도 과거 목록 밖으로 나가지 않는다', () => {
  const history = { past: [], future: [] };
  assert.equal(undo(history, 'A'), null);
});

test('다시하기를 반복해도 미래 목록 밖으로 나가지 않는다', () => {
  const history = { past: [], future: [] };
  assert.equal(redo(history, 'A'), null);
});
