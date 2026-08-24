import { forwardRef } from 'react';
import { RATIO_KEYS, getCanvasSize } from '../state/editorState.js';

/**
 * 미리보기.
 *
 * 캔버스의 내부 해상도는 실제 출력 해상도(1080×H)와 같고, 화면에는 CSS 로만
 * 축소해서 보여준다. 다운로드는 이 캔버스를 그대로 파일로 만들기 때문에
 * 미리보기와 결과물이 같은 픽셀이 된다.
 */
const PreviewPanel = forwardRef(function PreviewPanel(
  { state, onChange, onDownload, onShare, canDownload },
  canvasRef
) {
  const size = getCanvasSize(state.ratio);

  return (
    <section className="panel panel-preview" aria-labelledby="preview-heading">
      <h2 id="preview-heading">미리보기</h2>

      <div className="preview-head">
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

        <div className="button-row">
          <button type="button" onClick={onShare}>
            링크 복사
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
        <div
          className="canvas-frame"
          style={{ width: `min(100%, ${(size.width / size.height) * 62}vh)` }}
        >
          <canvas
            ref={canvasRef}
            width={size.width}
            height={size.height}
            role="img"
            aria-label={
              state.text.trim()
                ? `미리보기: ${state.text.replace(/\n/g, ' ')}`
                : '미리보기: 문구 없음'
            }
          />
        </div>
      </div>

      <p className="preview-meta">
        출력 크기 {size.width} × {size.height}px · 화면에 보이는 그림과 내려받는
        파일은 같은 캔버스입니다.
      </p>
    </section>
  );
});

export default PreviewPanel;
