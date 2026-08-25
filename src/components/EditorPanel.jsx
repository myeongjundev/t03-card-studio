import { LIMITS, FITS, ALIGNS } from '../state/editorState.js';
import { PRESETS, ERAS } from '../state/presets.js';
import DropZone from './DropZone.jsx';

const FIT_LABEL = { cover: '가득 채우기', contain: '전체 보이기' };
const ALIGN_LABEL = { left: '왼쪽', center: '가운데', right: '오른쪽' };

/**
 * 접이식 묶음.
 *
 * 편집 패널이 2,000px 가까이 길어져서 기본 조작을 하려면 한참 스크롤해야
 * 했다. 자주 쓰지 않는 항목을 접어 둔다.
 *
 * `<details>` 를 쓰는 이유는 키보드 조작과 스크린리더 안내가 브라우저에
 * 이미 들어 있기 때문이다. 직접 만들면 그것을 전부 다시 구현해야 한다.
 */
function Group({ title, summary, defaultOpen = false, children }) {
  return (
    <details className="group" open={defaultOpen}>
      <summary className="group-head">
        <span className="group-title">{title}</span>
        {summary ? <span className="group-summary">{summary}</span> : null}
        <span className="group-chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 9.5l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className="group-body">{children}</div>
    </details>
  );
}

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
  onUsePreset,
  onUseEra,
  onPickImage,
  onClearImage,
}) {
  return (
    <section className="panel panel-editor" aria-labelledby="editor-heading">
      <h2 id="editor-heading"><span>01</span> 스타일 만들기</h2>

      <div className="quick-start-guide" aria-label="30초 빠른 시작">
        <div>
          <p className="quick-start-kicker">30초 빠른 시작</p>
          <p className="quick-start-title">세 가지만 바꾸면 카드가 완성됩니다.</p>
        </div>
        <ol>
          <li><span>1</span> 모습</li>
          <li><span>2</span> 시대</li>
          <li><span>3</span> 내 사진</li>
        </ol>
      </div>

      <div className="field persona-picker">
        <p className="persona-eyebrow"><span className="step-number">1</span> 온라인에서 어떤 나인가요?</p>
        <p className="persona-intro">지금 보여주고 싶은 모습을 골라보세요.</p>
        <div className="preset-grid" role="group" aria-label="온라인에서 보여줄 모습">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset-button persona-${preset.id}`}
              title={preset.hint}
              aria-pressed={state.persona === preset.id}
              aria-label={`${preset.name}, ${preset.koreanName}, ${preset.era}: ${preset.hint}`}
              onClick={() => onUsePreset(preset.id)}
            >
              {/* 사람 실루엣 대신 카드 레이아웃 미리보기. 무엇이 달라지는지 바로 보인다. */}
              <span className={`persona-thumb ${preset.layout}`} aria-hidden="true">
                <span className="persona-thumb-line" />
                <span className="persona-thumb-line is-short" />
              </span>
              <span className="persona-name">{preset.name}</span>
              <span className="persona-korean">{preset.koreanName}</span>
              <span className="persona-era">{preset.era}</span>
              <span className="persona-hint">{preset.hint}</span>
              <span className="persona-ratios">
                추천 {preset.recommendedRatios.join(' · ')}
              </span>
            </button>
          ))}
        </div>
        <p className="hint">
          선택한 모습은 레이아웃만 바꿉니다. 화면 비율과 쓰던 문구·이미지는 그대로
          두고, 어울리는 비율은 미리보기 위에 추천으로만 표시합니다.
        </p>
      </div>

      <div className="field era-picker">
        <p className="persona-eyebrow"><span className="step-number">2</span> 어느 시대로 접속할까요?</p>
        <p className="persona-intro">기억하고 싶은 인터넷 시대를 골라보세요.</p>
        <div className="era-timeline" role="group" aria-label="인터넷 시대">
          {ERAS.map((era) => (
            <button
              key={era.id}
              type="button"
              aria-pressed={state.era === era.id}
              onClick={() => onUseEra(era.id)}
            >
              <span>{era.label}</span>
              <small>{era.caption}</small>
            </button>
          ))}
        </div>
        <p className="hint">시대를 바꿔도 입력한 이미지와 문구는 그대로입니다.</p>
      </div>

      <div className="field">
        <span className="field-label"><span className="step-number">3</span> 내 사진으로 바꾸기</span>
        <DropZone
          accept="image/png,image/jpeg"
          onFile={onPickImage}
          icon="image"
          title={state.image ? '다른 이미지로 바꾸기' : '이미지 끌어다 놓기'}
          hint={state.image ? '클릭해서 고를 수도 있습니다' : '또는 클릭해서 고르기 · PNG · JPEG'}
        />
        {state.image ? (
          <p className="file-current" title={state.imageName}>
            <span className="file-dot" aria-hidden="true" />
            {state.imageName}
          </p>
        ) : (
          <p className="hint">이미지를 고르지 않으면 배경색만 사용합니다.</p>
        )}
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

      <Group
        title="문구 배치"
        summary={`${Math.round(state.textX * 100)}% · ${Math.round(state.textY * 100)}% · ${state.fontSize}px`}
      >
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
      </Group>

      <Group title="색과 테두리" summary={state.color}>

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

        <div className="stroke-row">
          <label htmlFor="stroke-color" className="stroke-color-label">
            테두리 색
          </label>
          <input
            id="stroke-color"
            type="color"
            value={state.strokeColor}
            disabled={state.strokeWidth === 0}
            onChange={(event) => onChange({ strokeColor: event.target.value })}
          />
        </div>

        <Slider
          id="stroke-width"
          label="테두리 굵기"
          value={state.strokeWidth}
          display={
            state.strokeWidth === 0
              ? '없음'
              : `${Math.round(state.strokeWidth * state.fontSize)}px`
          }
          limit={LIMITS.strokeWidth}
          onChange={(strokeWidth) => onChange({ strokeWidth })}
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
              {contrast.basis === 'stroke' ? '테두리' : '배경'}와의 대비{' '}
              {contrast.ratio.toFixed(1)}:1
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
      </Group>
    </section>
  );
}
