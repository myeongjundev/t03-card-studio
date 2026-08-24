/**
 * 되돌리기 / 다시하기.
 *
 * 글자 하나 칠 때마다 되돌리기 단계가 생기면 사실상 쓸모가 없어진다.
 * 그래서 "언제 변경됐는가"로 묶음을 나눈다 — 이전 변경과 BURST_WINDOW_MS
 * (0.6초) 안에 있으면 같은 묶음으로 보고 새 단계를 만들지 않는다. 타이핑이나
 * 슬라이더를 끄는 동안의 연속된 변경은 한 번에 되돌려지고, 잠깐이라도 손을
 * 뗐다가 다시 편집하면 그 시점부터 새 묶음이 된다.
 *
 * 이 파일은 순수 함수만 둔다. 시각(now)과 마지막 변경 시각을 인자로 받을 뿐
 * setTimeout 이나 DOM 에 의존하지 않아서, 실제 타이밍 없이도 그대로 테스트할
 * 수 있다. 타이머를 갖고 있는 쪽은 이 함수를 부르는 App.jsx 다.
 */

export const HISTORY_LIMIT = 60;
export const BURST_WINDOW_MS = 600;

export function createHistory() {
  return { past: [], future: [] };
}

/**
 * 상태가 바뀔 때마다 부른다.
 *
 * @param {{past: any[], future: any[]}} history
 * @param {*} previousState 바뀌기 직전 상태 (아직 history 에 들어있지 않다)
 * @param {number} now
 * @param {number} lastChangeAt 마지막으로 실제 변경이 있었던 시각. 아직 없으면 0.
 * @returns {{history: {past, future}, changed: boolean}}
 *   changed 가 false 면 같은 묶음으로 보고 history 를 그대로 돌려준다.
 */
export function recordChange(history, previousState, now, lastChangeAt) {
  const withinBurst = lastChangeAt !== 0 && now - lastChangeAt < BURST_WINDOW_MS;
  if (withinBurst) {
    return { history, changed: false };
  }
  const past = [...history.past, previousState].slice(-HISTORY_LIMIT);
  // 새 묶음이 시작됐다는 것은 사용자가 다른 방향으로 편집을 이어간다는 뜻이다.
  // 되돌리기로 갔다가 다시 편집하면 "다시하기" 가지는 더 이상 유효하지 않다.
  return { history: { past, future: [] }, changed: true };
}

/**
 * @returns {{history, state}|null} 되돌릴 것이 없으면 null.
 */
export function undo(history, currentState) {
  if (history.past.length === 0) return null;
  const previous = history.past[history.past.length - 1];
  const past = history.past.slice(0, -1);
  const future = [currentState, ...history.future].slice(0, HISTORY_LIMIT);
  return { history: { past, future }, state: previous };
}

/**
 * @returns {{history, state}|null} 다시 할 것이 없으면 null.
 */
export function redo(history, currentState) {
  if (history.future.length === 0) return null;
  const next = history.future[0];
  const future = history.future.slice(1);
  const past = [...history.past, currentState].slice(-HISTORY_LIMIT);
  return { history: { past, future }, state: next };
}

export const canUndo = (history) => history.past.length > 0;
export const canRedo = (history) => history.future.length > 0;
