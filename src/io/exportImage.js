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

/**
 * 캔버스를 이미지로 클립보드에 넣는다.
 *
 * 실제 사용 흐름은 "내려받기 → 파일 찾기 → 첨부" 보다
 * "복사 → 대화창에 붙여넣기" 가 훨씬 짧다.
 *
 * toBlob 의 결과를 기다린 뒤 write 를 부르면 사용자 동작과의 연결이 끊겨
 * 일부 브라우저가 거부한다. 그래서 Blob 대신 Blob 을 만드는 Promise 를
 * ClipboardItem 에 그대로 넘긴다.
 *
 * @returns {Promise<{ok: true} | {ok: false, message: string}>}
 */
export async function copyCanvasImage(canvas) {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return {
      ok: false,
      message:
        '이 브라우저는 이미지 복사를 지원하지 않습니다. 이미지 다운로드를 사용해 주세요.',
    };
  }

  try {
    const item = new ClipboardItem({
      'image/png': new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob && blob.size > 0) resolve(blob);
          else reject(new Error('빈 이미지'));
        }, 'image/png');
      }),
    });
    await navigator.clipboard.write([item]);
    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        '이미지를 복사하지 못했습니다. 브라우저가 클립보드 사용을 막았을 수 있습니다. 이미지 다운로드를 사용해 주세요.',
    };
  }
}
