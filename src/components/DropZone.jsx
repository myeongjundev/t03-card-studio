import { useId, useRef, useState } from 'react';

/**
 * 파일을 고르는 자리.
 *
 * 기본 `<input type="file">` 은 브라우저가 그리는 작은 버튼이라 눈에 잘
 * 띄지 않고, 무엇을 넣어야 하는지도 알려 주지 않는다. 넓은 영역으로 만들고
 * 끌어다 놓기도 받는다.
 *
 * input 을 `display: none` 으로 숨기지 않는다. 그러면 키보드 초점이
 * 사라져서 탭으로 도달할 수 없다. 화면에서만 감추고 초점은 살려 둔 뒤,
 * 초점이 들어오면 테두리로 알린다(`:focus-within`).
 */
/*
  아이콘은 이모지 대신 선으로 그린다. 이모지는 글꼴이 없는 환경에서 네모로
  깨진다. currentColor 를 쓰므로 색은 CSS 가 정한다.
*/
const ICONS = {
  image: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.6" cy="9.4" r="1.7" />
      <path d="M3.5 17.2l4.7-4.4a2 2 0 0 1 2.7 0l3 2.8m0 0l2-1.8a2 2 0 0 1 2.7 0l1.9 1.7" strokeLinecap="round" />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14 3v4.5a1 1 0 0 0 1 1h4.5" strokeLinejoin="round" />
      <path d="M19.5 8.5V19a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2H14z" strokeLinejoin="round" />
      <path d="M8.5 13.5h7M8.5 17h4.5" strokeLinecap="round" />
    </svg>
  ),
};

export default function DropZone({
  accept,
  onFile,
  title,
  hint,
  icon = 'file',
  compact = false,
  disabled = false,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  // 자식 요소를 지날 때마다 dragleave 가 튀어서 깜빡인다. 들어온 횟수를
  // 세어 0 이 될 때만 해제한다.
  const depthRef = useRef(0);

  const take = (file) => {
    if (!file || disabled) return;
    onFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    depthRef.current = 0;
    setDragging(false);
    take(event.dataTransfer.files?.[0]);
  };

  return (
    <label
      htmlFor={inputId}
      className={`dropzone${compact ? ' dropzone-compact' : ''}${dragging ? ' is-dragging' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault();
        depthRef.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        depthRef.current -= 1;
        if (depthRef.current <= 0) {
          depthRef.current = 0;
          setDragging(false);
        }
      }}
      onDrop={handleDrop}
    >
      <span className="dropzone-icon">{ICONS[icon] ?? ICONS.file}</span>
      <span className="dropzone-body">
        <span className="dropzone-title">{title}</span>
        <span className="dropzone-hint">{hint}</span>
      </span>
      <input
        id={inputId}
        ref={inputRef}
        className="dropzone-input"
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // 같은 파일을 다시 골라도 change 가 발생하도록 값을 비워 둔다.
          event.target.value = '';
          take(file);
        }}
      />
    </label>
  );
}
