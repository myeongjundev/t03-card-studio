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

/**
 * 묶음 상태. App 이 ref 로 들고 다닌다.
 *
 * lastChangeAt 은 지금 묶음이 마지막으로 갱신된 시각,
 * isolated 는 "이번 변경은 Persona/Era 처럼 그 자체로 하나의 행동" 이라는 표시다.
 */
export function createBurst() {
  return { lastChangeAt: 0, isolated: false };
}

/** Persona/Era 처럼 그 자체로 한 단계인 변경을 예고한다. */
export function isolateBurst(burst) {
  return { ...burst, isolated: true };
}

/**
 * recordChange 를 묶음 상태와 함께 한 칸 진행시킨다.
 *
 * 독립 행동은 앞의 편집과도, 뒤따르는 편집과도 묶이지 않는다. 앞만 끊으면
 * Persona 를 고른 뒤 0.6초 안에 문구를 옮겼을 때 그 이동이 Persona 단계에
 * 흡수되어, 되돌리기 한 번에 둘이 함께 사라진다.
 */
export function advanceBurst(history, previousState, now, burst) {
  const anchor = burst.isolated ? 0 : burst.lastChangeAt;
  const result = recordChange(history, previousState, now, anchor);
  return {
    ...result,
    burst: { lastChangeAt: burst.isolated ? 0 : now, isolated: false },
  };
}
