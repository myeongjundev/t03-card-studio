/**
 * 이미 계산된 렌더 결과를 게시 전 확인 문구로 바꾼다.
 * Canvas를 다시 읽거나 그리지 않는 순수 표현 계층이다.
 */
export const VERTICAL_SAFE_BOTTOM_RATIO = 0.82;

export function isInPotentialUiArea(ratio, area, canvasHeight) {
  if (ratio !== '9:16' || !area || !canvasHeight) return false;
  return area.y + area.height > canvasHeight * VERTICAL_SAFE_BOTTOM_RATIO;
}

export function buildReadyChecks({ state, layout, contrast, canExport, canvasHeight }) {
  const overlap = isInPotentialUiArea(state.ratio, layout?.area, canvasHeight);
  const renderedFontSize = layout?.fontSize ?? state.fontSize;

  return [
    {
      id: 'export',
      status: canExport ? 'pass' : 'wait',
      label: canExport ? 'PNG로 내보낼 준비가 됐어요' : '폰트를 준비하고 있어요',
    },
    {
      id: 'contrast',
      status: !contrast ? 'wait' : contrast.passes ? 'pass' : 'warn',
      label: !contrast
        ? '대비를 확인하고 있어요'
        : contrast.passes
          ? `문구 대비 ${contrast.ratio.toFixed(1)}:1`
          : `문구 대비가 낮아요 (${contrast.ratio.toFixed(1)}:1)`,
    },
    {
      id: 'size',
      status: renderedFontSize >= 24 ? 'pass' : 'warn',
      label: renderedFontSize >= 24 ? '문구 크기가 충분해요' : '실제 문구가 매우 작아요',
    },
    {
      id: 'fit',
      status: !layout ? 'wait' : layout.shrunk ? 'warn' : 'pass',
      label: !layout
        ? '문구 배치를 확인하고 있어요'
        : layout.shrunk
          ? '긴 문구가 자동으로 축소됐어요'
          : '문구가 안전 영역 안에 있어요',
    },
    ...(state.ratio === '9:16'
      ? [{
          id: 'vertical-safe-area',
          status: overlap ? 'warn' : 'pass',
          label: overlap
            ? '문구가 하단 UI와 겹칠 수 있어요'
            : '문구가 일반적인 세로형 안전 영역 안에 있어요',
        }]
      : []),
  ];
}
