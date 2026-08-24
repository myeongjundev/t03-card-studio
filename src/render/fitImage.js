/**
 * cover / contain 배치 계산.
 *
 * cover   — 캔버스를 가득 채우고 넘치는 부분은 잘린다.
 * contain — 이미지 전체가 들어오고 남는 부분은 여백이 된다.
 *
 * 두 경우 모두 가운데 정렬한다. 세로/가로 이미지 테스트가 이 계산에서 갈린다.
 */
export function fitImage(image, width, height, fit) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return null;

  const scale =
    fit === 'contain'
      ? Math.min(width / iw, height / ih)
      : Math.max(width / iw, height / ih);

  const dw = iw * scale;
  const dh = ih * scale;
  return { dx: (width - dw) / 2, dy: (height - dh) / 2, dw, dh };
}
