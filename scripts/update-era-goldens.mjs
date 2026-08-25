/**
 * 시대별 렌더 회귀 스냅샷을 다시 만든다.
 *
 *   node scripts/update-era-goldens.mjs
 *
 * 장식을 의도적으로 바꿨을 때만 실행한다. 실행한 뒤에는 `git diff` 로
 * **바뀐 줄이 의도한 변경인지 눈으로 확인**해야 한다. 무심코 갱신하면
 * 스냅샷 테스트는 아무것도 지켜 주지 않는다.
 */

import fs from 'node:fs';
import { buildEraGoldens, GOLDEN_PATH } from '../test/helpers/eraGolden.js';

const goldens = buildEraGoldens();
fs.writeFileSync(GOLDEN_PATH, `${JSON.stringify(goldens, null, 2)}\n`, 'utf8');

const combos = Object.keys(goldens).length;
const calls = Object.values(goldens).reduce((sum, trace) => sum + trace.length, 0);
console.log(`${GOLDEN_PATH} 갱신: ${combos}개 조합, 그리기 호출 ${calls}개`);
