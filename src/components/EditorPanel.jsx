import { useRef } from 'react';
import { LIMITS, FITS, ALIGNS } from '../state/editorState.js';

const FIT_LABEL = { cover: '가득 채우기', contain: '전체 보이기' };
const ALIGN_LABEL = { left: '왼쪽', center: '가운데', right: '오른쪽' };

/** 슬라이더와 숫자 표시를 한 줄로 묶는다. 현재 값을 항상 눈으로 확인할 수 있게 한다. */
function Slider({ id, label, value, display, limit, onChange }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        <span className="field-value">{display}</span>
      </label>
      <input
        id={id}
        type="range"
        min={limit.min}
        max={limit.max}
        step={limit.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export default function EditorPanel({
  state,
  layout,
  contrast,
  onChange,
  onApplySuggestedColor,
  onPickImage,
  onClearImage,
}) {
  const fileRef = useRef(null);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    // 같은 파일을 다시 골라도 change 가 발생하도록 값을 비워 둔다.
    event.target.value = '';
    if (file) onPickImage(file);
  };

  return (
    <section className="panel panel-editor" aria-labelledby="editor-heading">
      <h2 id="editor-heading">편집</h2>

      <div className="field">
        <label htmlFor="image-input">배경 이미지 (PNG · JPEG)</label>
        <input
          id="image-input"
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFile}
        />
        <p className="hint">
          {state.imageName
            ? `현재 이미지: ${state.imageName}`
            : '이미지를 고르지 않으면 배경색만 사용합니다.'}
        </p>
        {state.image && (
          <div className="button-row" style={{ marginTop: 8 }}>
            <button type="button" className="small" onClick={onClearImage}>
              이미지 제거
            </button>
          </div>
        )}
      </div>

      <div className="field">
        <span className="field-label">이미지 맞춤</span>
        <div className="segmented" role="group" aria-label="이미지 맞춤 방식">
          {FITS.map((fit) => (
            <button
              key={fit}
              type="button"
              aria-pressed={state.fit === fit}
              onClick={() => onChange({ fit })}
            >
              {FIT_LABEL[fit]}
            </button>
          ))}
        </div>
        <p className="hint">
          가득 채우기는 넘치는 부분이 잘리고, 전체 보이기는 여백이 생깁니다.
        </p>
      </div>

      <div className="field">
        <label htmlFor="text-input">문구</label>
        <textarea
          id="text-input"
          value={state.text}
          maxLength={LIMITS.textMaxLength}
          placeholder="문구를 입력하세요. 줄바꿈도 그대로 반영됩니다."
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </div>

      <Slider
        id="text-x"
        label="가로 위치"
        value={state.textX}
        display={`${Math.round(state.textX * 100)}%`}
        limit={LIMITS.textX}
        onChange={(textX) => onChange({ textX })}
      />
      <Slider
        id="text-y"
        label="세로 위치"
        value={state.textY}
        display={`${Math.round(state.textY * 100)}%`}
        limit={LIMITS.textY}
        onChange={(textY) => onChange({ textY })}
      />
      <Slider
        id="font-size"
        label="글자 크기"
        value={state.fontSize}
        display={`${state.fontSize}px`}
        limit={LIMITS.fontSize}
        onChange={(fontSize) => onChange({ fontSize })}
      />
      {layout?.shrunk && (
        <p className="hint shrink-hint">
          문구가 길어 화면에 다 들어오지 않아 {state.fontSize}px 대신{' '}
          <strong>{layout.fontSize < 10 ? layout.fontSize.toFixed(2) : Math.round(layout.fontSize)}px</strong> 로 그렸습니다. 내려받는 파일도
          같습니다.
        </p>
      )}

      <Slider
        id="line-height"
        label="줄 간격"
        value={state.lineHeight}
        display={state.lineHeight.toFixed(2)}
        limit={LIMITS.lineHeight}
        onChange={(lineHeight) => onChange({ lineHeight })}
      />

      <div className="field">
        <span className="field-label">문구 정렬</span>
        <div className="segmented" role="group" aria-label="문구 정렬">
          {ALIGNS.map((align) => (
            <button
              key={align}
              type="button"
              aria-pressed={state.align === align}
              onClick={() => onChange({ align })}
            >
              {ALIGN_LABEL[align]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="text-color">
          글자 색상
          <span className="field-value">{state.color}</span>
        </label>
        <input
          id="text-color"
          type="color"
          value={state.color}
          onChange={(event) => onChange({ color: event.target.value })}
        />

        {contrast && (
          <div
            className={contrast.passes ? 'contrast-note ok' : 'contrast-note warn'}
            role="status"
          >
            <span className="contrast-tag">
              {contrast.passes ? '읽기 좋음' : '읽기 어려움'}
            </span>
            <span>
              배경과의 대비 {contrast.ratio.toFixed(1)}:1
              {contrast.passes ? '' : ` — 기준 ${contrast.required}:1 에 못 미칩니다`}
            </span>
            {!contrast.passes && contrast.suggestion !== state.color && (
              <button
                type="button"
                className="small"
                onClick={onApplySuggestedColor}
              >
                {contrast.suggestion} 으로 바꾸기
              </button>
            )}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="bg-color">
          배경 색상
          <span className="field-value">
            {state.transparentBg ? '투명' : state.bgColor}
          </span>
        </label>
        <input
          id="bg-color"
          type="color"
          value={state.bgColor}
          disabled={state.transparentBg}
          onChange={(event) => onChange({ bgColor: event.target.value })}
        />
        <p className="hint">
          <label htmlFor="transparent-bg">
            <input
              id="transparent-bg"
              type="checkbox"
              checked={state.transparentBg}
              onChange={(event) => onChange({ transparentBg: event.target.checked })}
            />{' '}
            배경을 투명하게 (투명 PNG 로 저장)
          </label>
        </p>
      </div>
    </section>
  );
}
