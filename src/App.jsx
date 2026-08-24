import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createInitialState,
  clampState,
  getCanvasSize,
} from './state/editorState.js';
import { renderCard } from './render/renderCard.js';
import { buildFileName, downloadCanvas } from './io/exportImage.js';
import EditorPanel from './components/EditorPanel.jsx';
import PreviewPanel from './components/PreviewPanel.jsx';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg'];

export default function App() {
  const [state, setState] = useState(createInitialState);
  const [notice, setNotice] = useState(null);
  const [fontsReady, setFontsReady] = useState(false);

  const canvasRef = useRef(null);
  const imageUrlRef = useRef(null);

  // 폰트 로딩 전에 그리면 폴백 폰트로 측정되어 줄바꿈 위치가 달라진다.
  // 첫 렌더를 폰트 준비 이후로 미룬다.
  useEffect(() => {
    let alive = true;
    const markReady = () => alive && setFontsReady(true);
    if (document.fonts?.ready) {
      document.fonts.ready.then(markReady, markReady);
    } else {
      markReady();
    }
    return () => {
      alive = false;
    };
  }, []);

  // 상태가 바뀌면 곧바로 다시 그린다.
  //
  // 처음에는 requestAnimationFrame 으로 렌더를 모아서 처리했는데, rAF 는 탭이
  // 화면에 보이지 않으면 호출되지 않는다. 그 상태에서 다운로드를 누르면 아직
  // 한 번도 그려지지 않은 빈 캔버스가 그대로 파일이 된다.
  // React 가 상태 변경을 이미 묶어서 커밋하므로 이 effect 는 커밋당 한 번만
  // 돌고, 동기 렌더로 두면 "캔버스는 항상 최신 상태"가 보장된다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fontsReady) return;

    const { width, height } = getCanvasSize(state.ratio);
    // 캔버스 크기 대입은 내용을 초기화하므로 실제로 달라졌을 때만 한다.
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    renderCard(canvas.getContext('2d'), state, width, height);
  }, [state, fontsReady]);

  // 페이지를 벗어날 때 남아 있는 objectURL 을 정리한다.
  useEffect(
    () => () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    },
    []
  );

  const update = useCallback((patch) => {
    setState((prev) => clampState({ ...prev, ...patch }));
  }, []);

  const pickImage = useCallback((file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setNotice({
        type: 'error',
        text: `지원하지 않는 파일 형식입니다(${file.type || '형식을 알 수 없음'}). PNG 또는 JPEG 파일을 선택해 주세요. 지금까지의 편집 내용은 그대로 있습니다.`,
      });
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      // 새 이미지가 확실히 로드된 뒤에 이전 URL 을 해제한다.
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = url;
      setState((prev) => ({ ...prev, image, imageName: file.name }));
      setNotice({
        type: 'success',
        text: `이미지를 불러왔습니다. (${image.naturalWidth} × ${image.naturalHeight}px)`,
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      setNotice({
        type: 'error',
        text: '이미지를 읽지 못했습니다. 파일이 손상되었을 수 있습니다. 지금까지의 편집 내용은 그대로 있습니다.',
      });
    };

    image.src = url;
  }, []);

  const clearImage = useCallback(() => {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }
    setState((prev) => ({ ...prev, image: null, imageName: '' }));
    setNotice({ type: 'success', text: '배경 이미지를 제거했습니다.' });
  }, []);

  const handleDownload = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const size = await downloadCanvas(canvas, buildFileName(state.ratio));
      setNotice({
        type: 'success',
        text: `이미지를 내려받았습니다. (${Math.round(size / 1024)}KB)`,
      });
    } catch {
      setNotice({
        type: 'error',
        text: '이미지를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
  }, [state.ratio]);

  return (
    <div className="app">
      <header className="masthead">
        <h1>짤·카드 스튜디오</h1>
        <p>이미지에 문구를 얹어 카드를 만듭니다.</p>
      </header>

      <p className="privacy-note">
        고른 이미지는 브라우저 안에서만 처리하며 어디에도 전송하지 않습니다.
        템플릿은 이 브라우저의 저장소에만 남습니다. 다른 사람에게 보일 수 있는
        카드에는 이름·전화번호·주소 같은 개인정보를 넣지 마세요.
      </p>

      <div aria-live="polite">
        {notice && (
          <div className={`notice ${notice.type}`} role="status">
            <span className="notice-tag">
              {notice.type === 'error' ? '오류' : '완료'}
            </span>
            {notice.text}
          </div>
        )}
      </div>

      <div className="layout">
        <EditorPanel
          state={state}
          onChange={update}
          onPickImage={pickImage}
          onClearImage={clearImage}
        />
        <PreviewPanel
          ref={canvasRef}
          state={state}
          onChange={update}
          onDownload={handleDownload}
          canDownload={fontsReady}
        />
      </div>
    </div>
  );
}
