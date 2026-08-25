import { forwardRef, useRef, useState } from 'react';
import { RATIO_KEYS, getCanvasSize } from '../state/editorState.js';
import { buildReadyChecks } from '../state/readyCheck.js';
import { getRecommendedRatio } from '../state/presets.js';

/**
 * 미리보기.
 *
 * 캔버스의 내부 해상도는 실제 출력 해상도(1080×H)와 같고, 화면에는 CSS 로만
 * 축소해서 보여준다. 다운로드는 이 캔버스를 그대로 파일로 만들기 때문에
 * 미리보기와 결과물이 같은 픽셀이 된다.
 */

/** 문구를 집을 수 있는 여유. 얇은 글자도 잡기 쉽도록 사각형을 조금 넓힌다. */
const GRAB_PADDING = 24;

const PreviewPanel = forwardRef(function PreviewPanel(
  {
    state,
    textArea,
    layout,
    contrast,
    onChange,
    onMoveText,
    onDownload,
    onCopyImage,
    onShare,
    canDownload,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
  },
  canvasRef
) {
  const size = getCanvasSize(state.ratio);
  const recommendedRatio = getRecommendedRatio(state.persona, state.era);
  const dragRef = useRef(null);
  const [grabbable, setGrabbable] = useState(false);
  // 커서 모양을 바꾸려면 리렌더가 필요하므로 ref 와 별개로 상태를 둔다.
  const [dragging, setDragging] = useState(false);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [mobileDocked, setMobileDocked] = useState(false);
  const [showcaseMode, setShowcaseMode] = useState(false);
  const readyChecks = buildReadyChecks({
    state,
    layout,
    contrast,
    canExport: canDownload,
    canvasHeight: size.height,
  });
  const warningCount = readyChecks.filter((item) => item.status === 'warn').length;
  const personaLabel = {
    normal: '기본',
    social: '소셜',
    'close-friends': '친한 친구',
  }[state.persona] ?? state.persona;
  const previewLabel = [
    `카드 미리보기, ${state.ratio}`,
    `${personaLabel} 모습`,
    `${state.era} 시대`,
    state.image ? '배경 이미지 있음' : '배경 이미지 없음',
    state.text.trim() ? `문구: ${state.text.replace(/\n/g, ' ')}` : '문구 없음',
    layout?.shrunk
      ? `문구가 ${layout.fontSize < 10 ? layout.fontSize.toFixed(1) : Math.round(layout.fontSize)}픽셀로 자동 축소됨`
      : null,
  ].filter(Boolean).join('. ');

  /**
   * 화면 좌표를 0~1 정규화 좌표로 바꾼다. CSS 크기와 내부 해상도가 다르므로 비율로 계산한다.
   * 캔버스가 아직 배치되지 않아 크기가 0 이면 0 으로 나누게 되므로 null 을 돌려준다.
   */
  const toNormalized = (canvas, event) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      nx: (event.clientX - rect.left) / rect.width,
      ny: (event.clientY - rect.top) / rect.height,
    };
  };

  /** 문구 사각형 안에서 시작했는지 본다. 빈 곳을 눌렀을 때 문구가 튀지 않게 한다. */
  const isOverText = (canvas, event) => {
    if (!textArea) return false;
    const point = toNormalized(canvas, event);
    if (!point) return false;
    const { nx, ny } = point;
    const px = nx * canvas.width;
    const py = ny * canvas.height;
    return (
      px >= textArea.x - GRAB_PADDING &&
      px <= textArea.x + textArea.width + GRAB_PADDING &&
      py >= textArea.y - GRAB_PADDING &&
      py <= textArea.y + textArea.height + GRAB_PADDING
    );
  };

  const handlePointerDown = (event) => {
    const canvas = event.currentTarget;
    if (!isOverText(canvas, event)) return;

    const point = toNormalized(canvas, event);
    if (!point) return;
    const { nx, ny } = point;
    // 잡은 지점과 문구 기준점의 거리를 유지한다. 그래야 문구가 커서로 순간이동하지 않는다.
    dragRef.current = {
      pointerId: event.pointerId,
      startX: nx,
      startY: ny,
      originX: state.textX,
      originY: state.textY,
    };
    canvas.setPointerCapture(event.pointerId);
    setDragging(true);
    event.preventDefault();
  };

  const handlePointerMove = (event) => {
    const canvas = event.currentTarget;
    const drag = dragRef.current;

    if (!drag) {
      // 끌 수 있는 자리인지 커서로 알려 준다.
      setGrabbable(isOverText(canvas, event));
      return;
    }
    if (drag.pointerId !== event.pointerId) return;

    const point = toNormalized(canvas, event);
    if (!point) return;
    onMoveText(
      drag.originX + (point.nx - drag.startX),
      drag.originY + (point.ny - drag.startY)
    );
  };

  const handlePointerEnd = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setDragging(false);
    const canvas = event.currentTarget;
    if (canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section
      className={`panel panel-preview${mobileDocked ? ' is-mobile-docked' : ''}${showcaseMode ? ' is-showcase' : ''}`}
      aria-labelledby="preview-heading"
    >
      <h2 id="preview-heading"><span>02</span> 결과 확인</h2>

      {showcaseMode && (
        <div className="showcase-caption" aria-live="polite">
          <p>ALTER EGO · {state.era}</p>
          <strong>지금의 나를<br />한 시대의 장면으로.</strong>
        </div>
      )}

      <div className="history-controls">
        <button
          type="button"
          className="small"
          onClick={onUndo}
          disabled={!canUndo}
          title="되돌리기 (Ctrl+Z)"
        >
          ↩ 실행 취소
        </button>
        <button
          type="button"
          className="small"
          onClick={onRedo}
          disabled={!canRedo}
          title="다시 실행 (Ctrl+Shift+Z)"
        >
          ↪ 다시 실행
        </button>
        <button
          type="button"
          className="small mobile-dock-toggle"
          aria-pressed={mobileDocked}
          onClick={() => setMobileDocked((docked) => !docked)}
        >
          {mobileDocked ? '큰 미리보기' : '편집하며 보기'}
        </button>
        <button
          type="button"
          className="small showcase-toggle"
          aria-pressed={showcaseMode}
          onClick={() => setShowcaseMode((visible) => !visible)}
        >
          {showcaseMode ? '편집으로 돌아가기' : '작품으로 보기 ↗'}
        </button>
      </div>

      <div className="preview-head">
        <div className="ratio-block">
          <div className="ratio-group segmented" role="group" aria-label="화면 비율">
            {RATIO_KEYS.map((ratio) => (
              <button
                key={ratio}
                type="button"
                aria-pressed={state.ratio === ratio}
                onClick={() => onChange({ ratio })}
              >
                {ratio}
              </button>
            ))}
          </div>
          {/*
            지금 조합에 어울리는 비율을 권할 뿐, 말없이 바꾸지는 않는다.
            비율은 사용자가 고른 값이다.
          */}
          {recommendedRatio && recommendedRatio !== state.ratio && (
            <button
              type="button"
              className="ratio-suggestion"
              onClick={() => onChange({ ratio: recommendedRatio })}
              title={`${recommendedRatio} 로 바꿉니다. 문구와 이미지는 그대로 둡니다.`}
            >
              이 조합엔 {recommendedRatio} 추천 · 적용
            </button>
          )}
        </div>

        <div className="button-row">
          <button type="button" onClick={onShare}>
            링크 복사
          </button>
          <button type="button" onClick={onCopyImage} disabled={!canDownload}>
            이미지 복사
          </button>
          <button
            type="button"
            className="primary"
            onClick={onDownload}
            disabled={!canDownload}
          >
            이미지 다운로드
          </button>
        </div>
      </div>

      <div className="canvas-stage">
        {mobileDocked && (
          <button
            type="button"
            className="dock-restore"
            onClick={() => setMobileDocked(false)}
            aria-label="큰 미리보기로 돌아가기"
          >
            크게
          </button>
        )}
        <div
          className="canvas-frame"
          style={{ width: `min(100%, ${(size.width / size.height) * 62}vh)` }}
        >
          <canvas
            ref={canvasRef}
            className={
              dragging ? 'dragging' : grabbable ? 'grabbable' : undefined
            }
            width={size.width}
            height={size.height}
            role="img"
            aria-label={previewLabel}
            aria-describedby="preview-description ready-check-list"
            data-image-cache={layout?.imageCache ?? undefined}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onPointerLeave={() => setGrabbable(false)}
          />
          {state.ratio === '9:16' && showSafeArea && (
            <div className="safe-area-guide" aria-hidden="true">
              <span>화면 버튼과 겹칠 수 있는 영역</span>
            </div>
          )}
        </div>
      </div>

      <p className="preview-meta" id="preview-description">
        출력 크기 {size.width} × {size.height}px · 화면에 보이는 그림과 내려받는
        파일은 같은 캔버스입니다.
        <br />
        문구를 끌어서 옮길 수 있습니다. 왼쪽 슬라이더로도 조절됩니다.
      </p>

      <aside className="ready-check" aria-labelledby="ready-check-heading">
        <div className="ready-check-head">
          <div>
            <p className="ready-check-kicker">올리기 전에</p>
            <h3 id="ready-check-heading">게시 전 확인</h3>
          </div>
          <span className={warningCount ? 'ready-summary warn' : 'ready-summary pass'}>
            {warningCount ? `${warningCount}개 확인` : '준비 완료'}
          </span>
        </div>
        <ul id="ready-check-list">
          {readyChecks.map((check) => (
            <li key={check.id} className={check.status}>
              <span aria-hidden="true">{check.status === 'pass' ? '✓' : check.status === 'warn' ? '!' : '·'}</span>
              {check.label}
            </li>
          ))}
        </ul>
        {state.ratio === '9:16' && (
          <button
            type="button"
            className="small safe-area-toggle"
            aria-pressed={showSafeArea}
            onClick={() => setShowSafeArea((visible) => !visible)}
          >
            {showSafeArea ? '안전 영역 가이드 숨기기' : '안전 영역 가이드 보기'}
          </button>
        )}
      </aside>
    </section>
  );
});

export default PreviewPanel;
