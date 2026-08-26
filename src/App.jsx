import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createInitialState,
  clampState,
  getCanvasSize,
  LIMITS,
} from './state/editorState.js';
import { renderCard } from './render/renderCard.js';
import { checkTextContrast } from './render/contrast.js';
import { buildFileName, downloadCanvas, copyCanvasImage } from './io/exportImage.js';
import { PRESETS, ERAS, applyPreset, applyEra, applyIdentity } from './state/presets.js';
import {
  createHistory,
  createBurst,
  isolateBurst,
  advanceBurst,
  undo as undoHistory,
  redo as redoHistory,
  canUndo as historyCanUndo,
  canRedo as historyCanRedo,
} from './state/history.js';
import { startScrollReveal } from './scrollReveal.js';
import { buildShareUrl, readShareUrl, copyToClipboard } from './io/shareLink.js';
import { downloadTemplatesJson, readTemplatesFile } from './io/templateFile.js';
import { loadTemplates, saveTemplates } from './templates/storage.js';
import { templateFromState, stateFromTemplate } from './templates/schema.js';
import EditorPanel from './components/EditorPanel.jsx';
import PreviewPanel from './components/PreviewPanel.jsx';
import TemplatePanel from './components/TemplatePanel.jsx';
import TemporalScanner from './components/TemporalScanner.jsx';
import DropZone from './components/DropZone.jsx';
import identityBanner from '../배너이미지/짤스튜디오02.avif';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg'];

export default function App() {
  const [state, setState] = useState(createInitialState);
  const [notice, setNotice] = useState(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [layout, setLayout] = useState(null);
  const [contrast, setContrast] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showTop, setShowTop] = useState(false);

  const canvasRef = useRef(null);
  const imageUrlRef = useRef(null);
  const imageRequestRef = useRef(0);

  // 되돌리기 / 다시하기.
  //
  // history 자체는 리렌더가 필요 없는 순수 데이터라 ref 에 둔다. 버튼을
  // 켜고 끄려면 리렌더가 한 번은 필요하므로 historyTick 을 올려 그때만
  // 다시 그리게 한다. lastStateRef 는 "지금 묶음이 시작되기 직전 상태",
  // burstRef 는 그 묶음의 시각과 독립 여부다.
  const historyRef = useRef(createHistory());
  const lastStateRef = useRef(state);
  const burstRef = useRef(createBurst());
  // 되돌리기/다시하기 자신이 만든 state 변경은 다시 history 에 기록하면 안
  // 된다. 그 순간에만 이 플래그를 세워 다음 effect 실행 한 번을 건너뛴다.
  const suppressRecordRef = useRef(false);
  const [, setHistoryTick] = useState(0);

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

    // 가독성 검사가 매 렌더마다 getImageData 로 픽셀을 읽는다.
    // willReadFrequently 를 켜지 않으면 브라우저가 읽기 부담을 감지한 뒤
    // GPU 에서 CPU 래스터화로 몰래 갈아타고, 그 순간 글자 가장자리
    // 안티에일리어싱이 미세하게 달라진다. 같은 설정인데 결과가 달라지는 셈이라
    // 처음부터 CPU 쪽으로 고정해 렌더 결과를 일정하게 유지한다.
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    // 자동 축소가 일어났는지 화면에 알리기 위해 렌더 결과를 받아 둔다.
    const result = renderCard(ctx, state, width, height);
    setLayout(result);

    // 다 그린 뒤에 실제 픽셀을 읽어 문구가 읽히는지 판정한다.
    // 추측이 아니라 화면에 나온 그대로를 재는 것이라, 이미지 위에서도 정확하다.
    setContrast(
      result.area
        ? checkTextContrast(ctx, result.area, state.color, result.fontSize, {
            color: state.strokeColor,
            width: state.strokeWidth * result.fontSize,
          })
        : null
    );
  }, [state, fontsReady]);

  /**
   * 상태가 바뀔 때마다 되돌리기 묶음을 갱신한다.
   *
   * 되돌리기/다시하기 자신이 만든 변경(suppressRecordRef)은 건너뛴다.
   * 그러지 않으면 되돌리기를 누른 것 자체가 새 되돌리기 단계로 기록되어
   * 되돌리기를 반복할수록 다시하기 가지가 끝없이 쌓이는 문제가 생긴다.
   */
  useEffect(() => {
    if (suppressRecordRef.current) {
      suppressRecordRef.current = false;
      lastStateRef.current = state;
      return;
    }
    if (lastStateRef.current === state) return; // 첫 렌더 등 실제 변경이 아님

    const now = Date.now();
    const { history, changed, burst } = advanceBurst(
      historyRef.current,
      lastStateRef.current,
      now,
      burstRef.current
    );
    historyRef.current = history;
    burstRef.current = burst;
    lastStateRef.current = state;
    if (changed) setHistoryTick((tick) => tick + 1);
  }, [state]);

  // 주소에 공유 링크가 있으면 열어 준다. 첫 렌더 때 한 번만 확인한다.
  useEffect(() => {
    const result = readShareUrl(createInitialState());
    if (!result) return;

    if (!result.ok) {
      setNotice({ type: 'error', text: result.message });
      return;
    }
    setState(clampState(result.state));
    setNotice({
      type: 'success',
      text: '공유 링크로 카드를 열었습니다. 배경 이미지는 링크에 담기지 않으니 필요하면 다시 골라 주세요.',
    });
  }, []);

  // 페이지를 벗어날 때 남아 있는 objectURL 을 정리한다.
  useEffect(
    () => () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    },
    []
  );

  // 저장된 템플릿을 처음 한 번만 읽어 온다.
  useEffect(() => {
    const { templates: stored, warning } = loadTemplates();
    setTemplates(stored);
    if (warning) setNotice({ type: 'error', text: warning });
  }, []);

  // 서사 요소를 스크롤에 따라 드러낸다. 첫 화면과 편집 패널은 대상이 아니다.
  useEffect(() => startScrollReveal(), []);

  const update = useCallback((patch) => {
    setState((prev) => clampState({ ...prev, ...patch }));
  }, []);

  /**
   * 되돌리기/다시하기 순간에는 새 state 를 그대로 대입한다. history 에서
   * 꺼낸 값은 예전에 이미 clampState 를 거친 상태이므로 다시 검증할 필요가
   * 없다. suppressRecordRef 와 burstRef 리셋은 이 변경이 history 에
   * 다시 기록되지 않게 하고, 되돌린 직후 바로 편집을 시작하면 그 편집이
   * 새 묶음으로 취급되게 한다.
   */
  const handleUndo = useCallback(() => {
    const result = undoHistory(historyRef.current, state);
    if (!result) return;
    historyRef.current = result.history;
    suppressRecordRef.current = true;
    burstRef.current = createBurst();
    setState(result.state);
    setHistoryTick((tick) => tick + 1);
  }, [state]);

  const handleRedo = useCallback(() => {
    const result = redoHistory(historyRef.current, state);
    if (!result) return;
    historyRef.current = result.history;
    suppressRecordRef.current = true;
    burstRef.current = createBurst();
    setState(result.state);
    setHistoryTick((tick) => tick + 1);
  }, [state]);

  const canUndoNow = historyCanUndo(historyRef.current);
  const canRedoNow = historyCanRedo(historyRef.current);

  /**
   * Ctrl+Z / Ctrl+Shift+Z (또는 Ctrl+Y) 로 되돌리기/다시하기를 한다.
   *
   * 텍스트를 입력 중일 때는 끄지 않는다 — 브라우저가 텍스트 필드 자체에
   * 이미 되돌리기 기능을 갖고 있고, 그걸 밀어내고 카드 전체를 되돌리면
   * "글자 하나만 고치려 했는데 위치·색까지 되돌아갔다" 는 혼란을 준다.
   * 슬라이더나 색상 선택처럼 텍스트가 아닌 입력에 초점이 있을 때는
   * 카드 전체 되돌리기가 자연스러우므로 막지 않는다.
   */
  useEffect(() => {
    const isTextEditable = (el) => {
      if (!el) return false;
      if (el.isContentEditable) return true;
      if (el.tagName === 'TEXTAREA') return true;
      if (el.tagName === 'INPUT') {
        const type = (el.getAttribute('type') || 'text').toLowerCase();
        return ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(type);
      }
      return false;
    };

    const handleKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (isTextEditable(document.activeElement)) return;

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  /**
   * 목록 변경은 반드시 이 함수를 거친다.
   * 저장에 실패하면 화면 목록도 되돌려서, 화면에는 있는데 실제로는 저장되지
   * 않은 상태가 생기지 않게 한다.
   */
  const commitTemplates = useCallback((next, successText) => {
    const result = saveTemplates(next);
    if (!result.ok) {
      setNotice({ type: 'error', text: result.message });
      return false;
    }
    setTemplates(next);
    setNotice({ type: 'success', text: successText });
    return true;
  }, []);

  const createTemplate = useCallback(() => {
    const name = templateName.trim();
    if (!name) return;
    const template = templateFromState(state, name);
    if (commitTemplates([...templates, template], `'${name}' 템플릿을 저장했습니다.`)) {
      setEditingId(null);
    }
  }, [commitTemplates, state, templateName, templates]);

  const updateTemplate = useCallback(() => {
    const name = templateName.trim();
    if (!name || !editingId) return;

    const next = templates.map((template) =>
      template.id === editingId
        ? {
            // id 와 생성 시각은 유지한다. 수정이 새 템플릿 추가가 되면 안 된다.
            ...templateFromState(state, name),
            id: template.id,
            createdAt: template.createdAt,
          }
        : template
    );
    commitTemplates(next, `'${name}' 템플릿의 변경 내용을 저장했습니다.`);
  }, [commitTemplates, editingId, state, templateName, templates]);

  const applyTemplate = useCallback(
    (id, enterEditMode) => {
      const template = templates.find((item) => item.id === id);
      if (!template) return;

      setState((prev) => clampState(stateFromTemplate(template, prev)));
      setTemplateName(template.name);
      setEditingId(enterEditMode ? template.id : null);
      setNotice({
        type: 'success',
        text: enterEditMode
          ? `'${template.name}' 템플릿을 편집기로 불러왔습니다. 값을 바꾼 뒤 '변경 내용 저장'을 누르세요.`
          : `'${template.name}' 템플릿을 불러왔습니다.`,
      });
    },
    [templates]
  );

  const deleteTemplate = useCallback(
    (id) => {
      const template = templates.find((item) => item.id === id);
      if (!template) return;
      if (!window.confirm(`'${template.name}' 템플릿을 삭제할까요? 되돌릴 수 없습니다.`)) {
        return;
      }

      const next = templates.filter((item) => item.id !== id);
      if (commitTemplates(next, `'${template.name}' 템플릿을 삭제했습니다.`)) {
        if (editingId === id) {
          setEditingId(null);
          setTemplateName('');
        }
      }
    },
    [commitTemplates, editingId, templates]
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setTemplateName('');
  }, []);

  const exportJson = useCallback(() => {
    if (templates.length === 0) return;
    const bytes = downloadTemplatesJson(templates);
    setNotice({
      type: 'success',
      text: `템플릿 ${templates.length}개를 JSON 파일로 내보냈습니다. (${Math.max(1, Math.round(bytes / 1024))}KB)`,
    });
  }, [templates]);

  /**
   * 가져오기.
   *
   * 검증이 끝나기 전에는 어떤 저장도 하지 않는다. readTemplatesFile 은 검증
   * 결과만 돌려주고, 여기서 성공을 확인한 뒤에야 저장을 시도한다.
   * 실패하면 기존 템플릿도, 현재 편집 내용도 건드리지 않는다.
   */
  const importJson = useCallback(
    async (file) => {
      const result = await readTemplatesFile(file);

      if (!result.ok) {
        setNotice({ type: 'error', text: result.message });
        return;
      }

      const confirmed = window.confirm(
        `가져온 템플릿 ${result.templates.length}개로 교체할까요?\n` +
          `지금 저장된 템플릿 ${templates.length}개는 사라집니다.\n` +
          '취소하면 아무것도 바뀌지 않습니다.'
      );
      if (!confirmed) {
        setNotice({
          type: 'success',
          text: '가져오기를 취소했습니다. 기존 템플릿은 그대로 있습니다.',
        });
        return;
      }

      if (commitTemplates(result.templates, `템플릿 ${result.templates.length}개를 가져왔습니다.`)) {
        setEditingId(null);
        setTemplateName('');
      }
    },
    [commitTemplates, templates.length]
  );

  const pickImage = useCallback((file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setNotice({
        type: 'error',
        text: `지원하지 않는 파일 형식입니다(${file.type || '형식을 알 수 없음'}). PNG 또는 JPEG 파일을 선택해 주세요. 지금까지의 편집 내용은 그대로 있습니다.`,
      });
      return;
    }

    const requestId = imageRequestRef.current + 1;
    imageRequestRef.current = requestId;
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      if (requestId !== imageRequestRef.current) {
        URL.revokeObjectURL(url);
        return;
      }
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
      if (requestId !== imageRequestRef.current) return;
      setNotice({
        type: 'error',
        text: '이미지를 읽지 못했습니다. 파일이 손상되었을 수 있습니다. 지금까지의 편집 내용은 그대로 있습니다.',
      });
    };

    image.src = url;
  }, []);

  const clearImage = useCallback(() => {
    imageRequestRef.current += 1;
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }
    setState((prev) => ({ ...prev, image: null, imageName: '' }));
    setNotice({ type: 'success', text: '배경 이미지를 제거했습니다.' });
  }, []);

  /**
   * 공유 링크를 만들어 클립보드에 넣는다.
   *
   * 주소창도 함께 바꿔 두어, 클립보드가 막힌 환경에서는 주소를 직접
   * 복사할 수 있게 한다. history.replaceState 라 뒤로가기 기록은 쌓이지 않는다.
   */
  const shareLink = useCallback(async () => {
    const result = buildShareUrl(state);
    if (!result.ok) {
      setNotice({ type: 'error', text: result.message });
      return;
    }

    window.history.replaceState(null, '', result.url);
    const copied = await copyToClipboard(result.url);
    setNotice({
      type: copied ? 'success' : 'error',
      text: copied
        ? 'TIMELINE COPIED — 카드 링크를 복사했습니다. 링크를 연 사람은 그대로 보고 수정할 수 있습니다. (배경 이미지는 담기지 않습니다)'
        : '클립보드에 넣지 못했습니다. 주소창의 주소를 직접 복사해 주세요.',
    });
  }, [state]);

  /**
   * 캔버스에서 문구를 끌어 옮긴다.
   * 값의 범위 제한은 clampState 가 맡으므로 여기서는 그대로 넘긴다.
   */
  const moveText = useCallback(
    (textX, textY) => update({ textX, textY }),
    [update]
  );

  /** Persona는 보이는 방식만 바꾸며, 한 번의 독립된 되돌리기 단계가 된다. */
  const usePreset = useCallback((presetId) => {
    burstRef.current = isolateBurst(burstRef.current);
    setState((prev) => clampState(applyPreset(prev, presetId)));
    const preset = PRESETS.find((item) => item.id === presetId);
    setNotice({
      type: 'success',
      text: `IDENTITY SHIFTED — '${preset?.name}' 모습을 적용했습니다. 문구와 이미지는 그대로입니다.`,
    });
  }, []);

  /** Era 변경도 Persona와 마찬가지로 하나의 독립된 편집 행동이다. */
  const useEra = useCallback((eraId) => {
    burstRef.current = isolateBurst(burstRef.current);
    setState((prev) => clampState(applyEra(prev, eraId)));
    const era = ERAS.find((item) => item.id === eraId);
    setNotice({
      type: 'success',
      text: `TIME LOCKED / ${era?.label} — 이미지와 문구는 그대로 유지했습니다.`,
    });
  }, []);

  /** Hero의 탐색 상태는 편집기와 분리하고, 입장할 때 한 번만 실제 상태에 적용한다. */
  const enterHeroEra = useCallback((eraId) => {
    const choices = {
      '2004': { persona: 'close-friends', ratio: '1:1' },
      '2012': { persona: 'social', ratio: '4:5' },
      '2026': { persona: 'social', ratio: '9:16' },
    };
    const choice = choices[eraId] ?? choices['2026'];
    burstRef.current = isolateBurst(burstRef.current);
    setState((prev) => clampState({
      ...applyIdentity(prev, choice.persona, eraId),
      ratio: choice.ratio,
    }));
    setNotice({
      type: 'success',
      text: `ENTERING ERA / ${eraId} — 선택한 시간선을 Studio에 연결했습니다. 사진과 문구는 그대로 유지했습니다.`,
    });
    requestAnimationFrame(() => {
      const target = window.matchMedia('(max-width: 1100px)').matches
        ? document.querySelector('.panel-preview')
        : document.getElementById('studio');
      target?.scrollIntoView({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'start',
      });
    });
  }, []);

  /**
   * 스크롤 이동은 전부 이 두 함수를 거친다.
   *
   * `<a href="#studio">` 같은 앵커를 쓰지 않는 이유는, 앵커가 주소의 해시를
   * 덮어써서 방금 만든 `#card=` 공유 상태를 지워 버리기 때문이다. 클립보드가
   * 막힌 환경에서는 "주소창의 주소를 직접 복사해 주세요" 가 유일한 대안인데,
   * 그 주소를 앱이 스스로 날리면 안 된다.
   *
   * behavior 를 조건부로 넘기는 이유는 CSS 의 scroll-behavior 규칙이
   * JS 인자에 밀리기 때문이다. 동작 줄이기를 켠 사용자에게는 6,000px 이 넘는
   * 문서를 부드럽게 훑고 내려가는 것이 그대로 남는다.
   */
  const scrollBehavior = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }, []);

  const scrollToStudio = useCallback(() => {
    document
      .getElementById('studio')
      ?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  }, []);

  /**
   * 맨 위로 버튼.
   *
   * 문서가 4,000~6,500px 라 아래쪽에서 첫 화면으로 돌아가려면 한참 올려야
   * 한다. 첫 화면에서는 올라갈 곳이 없으므로 한 화면쯤 내려간 뒤에만 낸다.
   *
   * 스크롤 이벤트는 아주 자주 오므로 매번 setState 하지 않는다. 보일지 말지
   * 두 상태뿐이라, 값이 실제로 바뀔 때만 갱신하면 리렌더가 문서당 몇 번으로
   * 줄어든다. rAF 로 한 프레임에 한 번만 읽어 강제 리플로도 피한다.
   */
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const next = window.scrollY > window.innerHeight * 0.9;
      setShowTop((current) => (current === next ? current : next));
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /** 이미지를 클립보드에 넣는다. 대화창에 바로 붙여넣기 위한 것이다. */
  const copyImage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const result = await copyCanvasImage(canvas);
    setNotice(
      result.ok
        ? { type: 'success', text: 'IDENTITY COPIED — 이미지를 복사했습니다. 대화창에 붙여넣기 하세요.' }
        : { type: 'error', text: result.message }
    );
  }, []);

  /** 대비 검사가 제안한 색을 그대로 적용한다. */
  const applySuggestedColor = useCallback(() => {
    if (!contrast?.suggestion) return;
    update({ color: contrast.suggestion });
  }, [contrast, update]);

  const handleDownload = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const size = await downloadCanvas(canvas, buildFileName(state.ratio));
      setNotice({
        type: 'success',
        text: `IDENTITY CAPTURED — PNG를 내려받았습니다. (${Math.round(size / 1024)}KB)`,
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
        <nav className="top-nav" aria-label="주요 메뉴">
          <button
            type="button"
            className="wordmark"
            onClick={scrollToTop}
            aria-label="Alter Ego 처음으로"
          >
            A/E
          </button>
          <span>TIME-TRAVEL ID STUDIO</span>
          <button type="button" className="nav-studio-button" onClick={scrollToStudio}>
            제작 도구로 ↘
          </button>
        </nav>

        <div className="hero" id="top">
          <div className="hero-copy">
            <p className="brand-kicker">ONE PHOTO · THREE ERAS · THREE IDENTITIES</p>
            <h1>같은 사진.<br />다른 시대.<br /><em>다른 나.</em></h1>
            <p className="hero-lead">
              한 장의 사진을 2004, 2012, 2026의 방식으로 다시 기록합니다.
              선을 움직여 시간 속의 다른 나를 먼저 만나보세요.
            </p>
            {/*
              첫 화면에서 바로 편집을 시작한다.

              여기 있던 '시대 없이 바로 시작' 버튼이 하던 일은 아래로
              스크롤하는 것뿐이었는데, 그 경로는 상단 내비의 '제작 도구로 ↘'
              가 이미 갖고 있었다. 약속만 하는 버튼을 지우고 그 자리에 진짜
              입력을 놓는다.

              바로가기가 아니라 **아래 Studio 와 같은 state 를 쓰는 같은
              도구**다. 여기서 사진을 고르거나 문구를 치면 아래 미리보기가
              곧바로 그것을 그린다.

              첫 화면의 주 행동은 여전히 Scanner 의 'ENTER ERA' 하나다.
              이 컨트롤은 버튼이 아니라 입력이라 그 위계를 흐리지 않는다.
            */}
            <div className="hero-actions">
              <div className="hero-quick" role="group" aria-label="바로 시작">
                <DropZone
                  accept="image/png,image/jpeg"
                  onFile={pickImage}
                  icon="image"
                  compact
                  title={state.image ? '다른 사진으로 바꾸기' : '내 사진 올리기'}
                  hint={state.image ? state.imageName : 'PNG · JPEG · 끌어다 놓아도 됩니다'}
                />
                <label className="hero-quick-text">
                  <span>문구</span>
                  <textarea
                    value={state.text}
                    rows={2}
                    maxLength={LIMITS.textMaxLength}
                    placeholder="넣고 싶은 문구를 적어보세요"
                    onChange={(event) => update({ text: event.target.value })}
                  />
                </label>
              </div>
              <span>여기서 바꾼 것은 아래 미리보기에 그대로 반영됩니다.</span>
            </div>
          </div>

          <TemporalScanner onEnterEra={enterHeroEra} />
        </div>
      </header>

      <p className="privacy-note" data-reveal>
        <strong>내 이미지는 내 브라우저에만.</strong>
        {' '}업로드한 이미지는 외부로 전송되지 않고, 템플릿도 이 기기에만 저장됩니다.
        공개할 카드에는 개인정보를 넣지 마세요.
      </p>

      <section className="project-story" aria-labelledby="story-heading">
        <div className="story-index" data-reveal aria-hidden="true">02 / WHY<br />THESE<br />ERAS</div>
        <div className="story-main" data-reveal style={{ '--reveal-order': 1 }}>
          <p className="story-kicker">DIGITAL IDENTITY THROUGH TIME</p>
          <h2 id="story-heading">
            우리는 같은 사람이어도,<br />시대에 따라 다른 모습으로 기억됩니다.
          </h2>
          <p className="story-lead">
            <strong>ALTER EGO</strong>는 한 장의 사진과 한 줄의 문장이 인터넷 문화의
            변화에 따라 어떻게 다른 정체성이 되는지 탐구하는 인터랙티브 카드 스튜디오입니다.
            과거를 흉내 내는 필터가 아니라, 각 시대가 자신을 표현하던 방식 자체를
            오늘의 화면 위에 다시 설계했습니다.
          </p>
        </div>
        <div className="story-note">
          <div className="story-era" data-reveal style={{ '--reveal-order': 1 }}>
            <span>01 — MEMORY</span>
            <p>개인 공간을 꾸미고 감정을 기록하던 2004년.</p>
          </div>
          <div className="story-era" data-reveal style={{ '--reveal-order': 2 }}>
            <span>02 — FEED</span>
            <p>사진 한 장으로 일상을 공유하기 시작한 2012년.</p>
          </div>
          <div className="story-era" data-reveal style={{ '--reveal-order': 3 }}>
            <span>03 — SIGNAL</span>
            <p>짧고 선명한 장면으로 나를 증명하는 2026년.</p>
          </div>
        </div>
      </section>

      <section className="identity-archive" aria-labelledby="identity-heading">
        <div className="archive-heading" data-reveal>
          <p>03 / THREE IDENTITIES</p>
          <h2 id="identity-heading">한 순간이 지나온<br />세 개의 디지털 자아.</h2>
        </div>
        <figure className="archive-banner" data-reveal style={{ '--reveal-order': 1 }}>
          <img
            src={identityBanner}
            alt="교복을 입은 두 사람이 바다를 마주하고 서 있는 여름날 사진. 이 앱이 세 시대로 다시 기록하는 원본 사진이다."
          />
          <figcaption>ONE PHOTO · THREE ERAS · THREE IDENTITIES</figcaption>
        </figure>
      </section>

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

      <div className="studio-intro" id="studio" data-reveal>
        <p>04 / THE STUDIO</p>
        <h2>시간선을 선택하고,<br />지금의 나를 다시 디자인하세요.</h2>
        <span>사진은 서버로 전송되지 않습니다.</span>
      </div>

      <div className="layout">
        <EditorPanel
          state={state}
          onChange={update}
          layout={layout}
          contrast={contrast}
          onApplySuggestedColor={applySuggestedColor}
          onUsePreset={usePreset}
          onUseEra={useEra}
          onPickImage={pickImage}
          onClearImage={clearImage}
        />
        <PreviewPanel
          ref={canvasRef}
          state={state}
          textArea={layout?.area ?? null}
          layout={layout}
          contrast={contrast}
          onChange={update}
          onMoveText={moveText}
          onDownload={handleDownload}
          onCopyImage={copyImage}
          onShare={shareLink}
          canDownload={fontsReady}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndoNow}
          canRedo={canRedoNow}
        />
        <TemplatePanel
          templates={templates}
          name={templateName}
          editingId={editingId}
          onNameChange={setTemplateName}
          onCreate={createTemplate}
          onUpdate={updateTemplate}
          onLoad={(id) => applyTemplate(id, false)}
          onEdit={(id) => applyTemplate(id, true)}
          onDelete={deleteTemplate}
          onCancelEdit={cancelEdit}
          onExportJson={exportJson}
          onImportJson={importJson}
        />
      </div>

      {/*
        보일 때만 DOM 에 넣는다. 숨긴 채로 두면 Tab 이 화면에 없는 버튼에
        멈춘다. 자리는 관습대로 오른쪽 아래이고, 좁은 화면에서 떠 있는
        미리보기가 그 자리를 쓸 때만 CSS 가 왼쪽으로 비켜 준다.
      */}
      {showTop && (
        <button type="button" className="to-top" onClick={scrollToTop}>
          <span aria-hidden="true">↑</span>
          맨 위로
        </button>
      )}
    </div>
  );
}
