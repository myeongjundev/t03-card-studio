/**
 * 줄바꿈 계산.
 *
 * 한국어는 단어 경계가 거의 없어서 공백 단위 줄바꿈만으로는 긴 문장이 그대로 넘친다.
 * 반대로 영문은 단어 중간에서 끊으면 읽기 어렵다. 그래서 단계를 나눈다.
 *
 *   1. 사용자가 직접 넣은 \n 을 먼저 분리한다 (수동 줄바꿈 유지)
 *   2. 공백 단위로 먼저 배치를 시도한다 (영문·혼합 문장)
 *   3. 한 덩어리가 최대 폭보다 넓으면 그래핀 단위로 강제 분해한다 (긴 한글·긴 영단어)
 *
 * 강제 분해에 그래핀 단위를 쓰는 이유는 이모지와 결합 문자를 반쪽으로
 * 자르지 않기 위해서다. 코드 유닛 단위로 자르면 이모지가 깨진다.
 */

const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('ko', { granularity: 'grapheme' })
    : null;

/** 문자열을 사람이 인식하는 한 글자 단위로 쪼갠다. */
export function toGraphemes(value) {
  const text = String(value ?? '');
  if (segmenter) {
    return Array.from(segmenter.segment(text), (part) => part.segment);
  }
  // Intl.Segmenter 미지원 환경 대비. 코드 포인트 단위라 서로게이트 쌍은 지켜진다.
  return Array.from(text);
}

function wrapParagraph(ctx, paragraph, maxWidth) {
  if (maxWidth <= 0) return [paragraph];

  // 공백을 버리지 않고 토큰으로 남겨 단어 사이 간격을 유지한다.
  const tokens = paragraph.split(/(\s+)/).filter((token) => token !== '');
  const lines = [];
  let line = '';

  const flush = () => {
    lines.push(line);
    line = '';
  };

  for (const token of tokens) {
    const isSpace = /^\s+$/.test(token);

    // 줄 맨 앞의 공백은 버린다. 줄바꿈 위치가 들쭉날쭉해 보이는 것을 막는다.
    if (isSpace && line === '') continue;

    if (ctx.measureText(line + token).width <= maxWidth) {
      line += token;
      continue;
    }

    // 공백에서 넘쳤다면 그 공백을 줄바꿈으로 대신한다.
    if (isSpace) {
      flush();
      continue;
    }

    // 토큰 자체가 한 줄보다 넓다 → 그래핀 단위로 잘라 넣는다.
    if (ctx.measureText(token).width > maxWidth) {
      if (line !== '') flush();
      for (const grapheme of toGraphemes(token)) {
        if (line !== '' && ctx.measureText(line + grapheme).width > maxWidth) {
          flush();
        }
        line += grapheme;
      }
      continue;
    }

    // 토큰은 한 줄에 들어가지만 현재 줄에는 자리가 없다 → 다음 줄로 넘긴다.
    flush();
    line = token;
  }

  if (line !== '') lines.push(line);
  return lines.length > 0 ? lines : [''];
}

/**
 * @param {CanvasRenderingContext2D} ctx 폰트가 이미 설정된 컨텍스트
 * @returns {string[]} 그려질 줄 목록
 */
export function wrapText(ctx, text, maxWidth) {
  const source = String(text ?? '');
  const lines = [];

  for (const paragraph of source.split('\n')) {
    if (paragraph === '') {
      lines.push(''); // 빈 줄도 한 줄로 센다
      continue;
    }
    lines.push(...wrapParagraph(ctx, paragraph, maxWidth));
  }

  return lines;
}
