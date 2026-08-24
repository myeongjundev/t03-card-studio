import { RATIO_KEYS, getCanvasSize } from '../state/editorState.js';
import { renderCard } from '../render/renderCard.js';
import { buildFileName, downloadCanvas } from './exportImage.js';

/**
 * 세 비율을 한 번에 내려받는다.
 *
 * 지금 화면에 보이지 않는 비율은 미리보기 캔버스를 쓸 수 없으므로 별도 캔버스에
 * 그린다. 여기서 두 가지를 반드시 맞춰야 미리보기와 결과가 어긋나지 않는다.
 *
 * 1. **같은 renderCard 를 쓴다.** 비율별 렌더링 코드를 따로 두면 반드시 갈라진다.
 * 2. **컨텍스트 설정도 같게 만든다.** 미리보기 캔버스는 가독성 검사 때문에
 *    willReadFrequently 로 만들어져 CPU 래스터화를 쓴다. 이 값이 다르면
 *    브라우저가 GPU 로 그려서 글자 가장자리가 미세하게 달라진다.
 *    (docs/TEST-EDGE-CASES.md 4장에서 실제로 겪은 문제다.)
 *
 * 브라우저가 연속 저장을 막지 않도록 파일 사이에 잠깐 간격을 둔다.
 */

const GAP_BETWEEN_FILES = 350;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 주어진 비율로 카드를 그린 캔버스를 만든다. 미리보기와 같은 조건으로 만든다. */
export function renderRatioToCanvas(state, ratio) {
  const { width, height } = getCanvasSize(ratio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  renderCard(ctx, { ...state, ratio }, width, height);
  return canvas;
}

/**
 * @returns {Promise<{ok: true, files: string[]} | {ok: false, message: string, files: string[]}>}
 */
export async function downloadAllRatios(state) {
  const files = [];

  for (const ratio of RATIO_KEYS) {
    try {
      const canvas = renderRatioToCanvas(state, ratio);
      const name = buildFileName(ratio);
      await downloadCanvas(canvas, name);
      files.push(name);
    } catch {
      return {
        ok: false,
        message:
          files.length === 0
            ? '이미지를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.'
            : `${ratio} 파일을 만들지 못해 중단했습니다. ${files.length}개는 내려받았습니다.`,
        files,
      };
    }
    await wait(GAP_BETWEEN_FILES);
  }

  return { ok: true, files };
}
