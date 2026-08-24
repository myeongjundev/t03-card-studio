/**
 * 문구가 실제로 읽히는지 검사한다.
 *
 * 짤 도구에서 가장 흔한 실패는 밝은 사진 위의 흰 글씨다. 만드는 사람은
 * 자기 화면에서 알아보기 때문에 문제를 눈치채기 어렵다.
 *
 * 그래서 추측하지 않고 캔버스에 실제로 그려진 픽셀을 읽는다.
 * 문구가 놓인 영역의 배경 밝기를 재고, 글자색과의 명도 대비를 계산한다.
 * 기준은 WCAG 2.1 의 명도 대비비다.
 */

/** 큰 글자(24px 이상 굵은 글씨)의 최소 기준. 그 아래는 4.5:1 이 필요하다. */
export const CONTRAST_AA_LARGE = 3;
export const CONTRAST_AA_NORMAL = 4.5;

/** sRGB 값을 상대 휘도로 바꾼다. (WCAG 정의) */
function channelLuminance(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(r, g, b) {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

export function hexToRgb(hex) {
  const value = String(hex ?? '').replace('#', '');
  const full =
    value.length === 3
      ? value.split('').map((char) => char + char).join('')
      : value;
  if (full.length !== 6) return null;
  const num = Number.parseInt(full, 16);
  if (!Number.isFinite(num)) return null;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** 두 휘도 사이의 대비비. 1(같음) ~ 21(검정과 흰색). */
export function contrastRatio(luminanceA, luminanceB) {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 문구 영역의 배경 밝기를 잰다.
 *
 * 글자 자체가 이미 그려진 뒤라 글자 픽셀이 섞여 들어간다. 그래서 글자색과
 * 가까운 픽셀은 빼고 나머지(=배경)만 평균 낸다. 완벽하지는 않지만
 * 이 판단에 필요한 정확도로는 충분하다.
 *
 * @param {ImageData} imageData 문구 영역만 잘라낸 픽셀
 * @param {[number, number, number]} textRgb 글자색
 */
export function backgroundLuminanceOf(imageData, textRgb) {
  const data = imageData.data;
  const [tr, tg, tb] = textRgb;

  // 픽셀이 많으면 다 볼 필요가 없다. 최대 4000 개 정도만 고르게 뽑는다.
  const total = data.length / 4;
  const step = Math.max(1, Math.floor(total / 4000));

  const scan = (excludeTextPixels) => {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < total; i += step) {
      const p = i * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];

      if (data[p + 3] < 8) continue; // 투명한 곳은 배경으로 치지 않는다
      if (
        excludeTextPixels &&
        Math.abs(r - tr) < 30 &&
        Math.abs(g - tg) < 30 &&
        Math.abs(b - tb) < 30
      ) {
        continue;
      }
      sum += relativeLuminance(r, g, b);
      count += 1;
    }
    return count === 0 ? null : sum / count;
  };

  const excluded = scan(true);
  if (excluded !== null) return excluded;

  // 글자색과 비슷한 픽셀을 뺐더니 아무것도 남지 않았다.
  // 배경이 글자색과 사실상 같다는 뜻이고, 이것이야말로 가장 안 읽히는 경우다.
  // 여기서 null 을 돌려주면 최악의 상황에서 경고가 사라지므로,
  // 제외 없이 다시 재서 실제 대비(약 1:1)를 그대로 보고한다.
  return scan(false);
}

/** 배경 밝기에 맞춰 읽히는 색을 고른다. 흰색과 검정 중 대비가 큰 쪽. */
export function suggestTextColor(backgroundLuminance) {
  const white = contrastRatio(1, backgroundLuminance);
  const black = contrastRatio(0, backgroundLuminance);
  return white >= black ? '#ffffff' : '#1a1a1a';
}

/**
 * 카드가 그려진 캔버스를 읽어 문구 가독성을 판정한다.
 *
 * @param {CanvasRenderingContext2D} ctx 카드가 이미 그려진 컨텍스트
 * @param {object} area 문구가 차지한 사각형 {x, y, width, height}
 * @param {string} textColor 글자색
 * @param {number} fontSize 실제로 그려진 글자 크기
 * @returns {{ratio: number, required: number, passes: boolean, suggestion: string}|null}
 */
export function checkTextContrast(ctx, area, textColor, fontSize, stroke = null) {
  const textRgb = hexToRgb(textColor);
  if (!textRgb || !area || area.width < 1 || area.height < 1) return null;

  const required = fontSize >= 24 ? CONTRAST_AA_LARGE : CONTRAST_AA_NORMAL;
  const textLuminanceOf = relativeLuminance(...textRgb);

  // 외곽선이 있으면 글자를 감싸는 것은 배경이 아니라 테두리다.
  // 이때 배경을 기준으로 재면, 테두리 덕분에 잘 읽히는 글자를 두고
  // "읽기 어려움" 이라고 잘못 경고하게 된다.
  if (stroke && stroke.width >= 2) {
    const strokeRgb = hexToRgb(stroke.color);
    if (strokeRgb) {
      const ratio = contrastRatio(textLuminanceOf, relativeLuminance(...strokeRgb));
      return {
        ratio,
        required,
        passes: ratio >= required,
        basis: 'stroke',
        suggestion: suggestTextColor(relativeLuminance(...strokeRgb)),
      };
    }
  }

  let imageData;
  try {
    imageData = ctx.getImageData(area.x, area.y, area.width, area.height);
  } catch {
    return null; // 캔버스가 오염된 경우 등
  }

  const backgroundLuminance = backgroundLuminanceOf(imageData, textRgb);
  if (backgroundLuminance === null) return null;

  const ratio = contrastRatio(textLuminanceOf, backgroundLuminance);

  return {
    ratio,
    required,
    passes: ratio >= required,
    basis: 'background',
    suggestion: suggestTextColor(backgroundLuminance),
  };
}
