/**
 * 화면에 보이는 그 캔버스를 그대로 파일로 만든다.
 * 다시 그리지 않기 때문에 미리보기와 결과물이 어긋날 여지가 없다.
 */
export function buildFileName(ratio) {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);
  return `card-${ratio.replace(':', 'x')}-${stamp}.png`;
}

export function downloadCanvas(canvas, fileName) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.size === 0) {
        reject(new Error('빈 이미지가 만들어졌습니다.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // 클릭 직후 해제하면 저장이 취소되는 브라우저가 있어 잠시 뒤에 정리한다.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve(blob.size);
    }, 'image/png');
  });
}
