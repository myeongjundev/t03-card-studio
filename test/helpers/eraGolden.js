/**
 * 시대별 렌더 회귀 스냅샷을 만드는 곳. 테스트와 갱신 스크립트가 함께 쓴다.
 *
 * 두 곳에서 각자 만들면 언젠가 어긋난다. 만드는 방법은 한 군데만 둔다.
 *
 * 해시 대신 그리기 기록을 통째로 저장한다. 조합당 30개 남짓이라 파일이
 * 감당할 만하고, 무엇보다 `git diff` 에 무엇이 달라졌는지 그대로 보인다.
 * 해시만 저장하면 "달라졌다" 는 알아도 무엇이 달라졌는지는 알 수 없다.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCard } from '../../src/render/renderCard.js';
import {
  createInitialState,
  PERSONA_KEYS,
  ERA_KEYS,
  RATIO_KEYS,
  getCanvasSize,
} from '../../src/state/editorState.js';
import { tracingContext } from './traceContext.js';

export const GOLDEN_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'era-render.json'
);

/** 스냅샷은 사용자가 바꾼 값이 아니라 "시대가 만드는 것" 만 봐야 한다. */
const FIXED_STATE = {
  text: '고정 문구\n두 번째 줄',
  fontSize: 120,
  lineHeight: 1.25,
  align: 'center',
  textX: 0.5,
  textY: 0.5,
  image: null,
  transparentBg: false,
};

export function goldenKeys() {
  const keys = [];
  for (const persona of PERSONA_KEYS) {
    for (const era of ERA_KEYS) {
      for (const ratio of RATIO_KEYS) keys.push(`${persona}|${era}|${ratio}`);
    }
  }
  return keys;
}

/** 한 조합의 그리기 기록. */
export function traceFor(key) {
  const [persona, era, ratio] = key.split('|');
  const state = { ...createInitialState(), ...FIXED_STATE, persona, era, ratio };
  const { width, height } = getCanvasSize(ratio);
  const ctx = tracingContext({ withState: true });
  renderCard(ctx, state, width, height);
  return ctx.trace;
}

export function buildEraGoldens() {
  return Object.fromEntries(goldenKeys().map((key) => [key, traceFor(key)]));
}
