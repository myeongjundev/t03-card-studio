/**
 * 모습(Persona)과 시대(Era) 프리셋.
 *
 * 슬라이더를 하나하나 맞춰서 예쁘게 뽑는 사람은 많지 않다.
 * 한 번 눌러 "만든 것 같은" 결과가 나오게 하는 것이 목적이다.
 *
 * 두 가지를 지킨다.
 *
 * 1. **문구와 이미지는 건드리지 않는다.** 프리셋은 '보이는 방식'만 바꾼다.
 *    눌렀더니 쓰던 문구가 사라지면 도구를 다시 안 쓴다.
 * 2. **템플릿 CRUD 를 대신하지 않는다.** 프리셋은 편집 화면의 시작점일 뿐이고,
 *    저장·수정·삭제는 사용자가 만든 템플릿이 그대로 담당한다. (원칙 5.2)
 *
 * 3. **화면 비율은 바꾸지 않는다.** 프리셋을 눌렀는데 캔버스 모양까지 변하면
 *    무엇이 바뀐 것인지 알기 어렵다. 어울리는 비율은 `getRecommendedRatio` 로
 *    화면에 보여 주기만 하고, 적용 여부는 사용자가 정한다.
 */

export const PRESETS = [
  {
    id: 'normal',
    name: '기본',
    koreanName: '담백하게 기록하는 나',
    era: '정돈 · 기록',
    hint: '과한 장식 없이 사진과 문장을 또렷하게 남깁니다.',
    recommendedRatios: ['1:1', '4:5'],
    layout: 'lower-left',
    style: {
      color: '#f7f7f2',
      strokeColor: '#111827',
      strokeWidth: 0.035,
      bgColor: '#162033',
      fontSize: 100,
      lineHeight: 1.35,
      align: 'left',
      textX: 0.12,
      textY: 0.78,
    },
  },
  {
    id: 'social',
    name: '소셜',
    koreanName: '보여지는 나',
    era: '공유 · 주목',
    hint: '피드에서 눈에 걸리는 따뜻한 색과 자신감 있는 중앙 문구.',
    recommendedRatios: ['4:5'],
    layout: 'lower-center',
    style: {
      color: '#fff4dc',
      strokeColor: '#22170f',
      strokeWidth: 0.055,
      bgColor: '#9f3d55',
      fontSize: 132,
      lineHeight: 1.15,
      align: 'center',
      textX: 0.5,
      textY: 0.72,
    },
  },
  {
    id: 'close-friends',
    name: '친한 친구',
    koreanName: '가까운 사람 앞의 나',
    era: '비공개 · 일기',
    hint: '미니홈피 다이어리처럼 사적이고 편안한 기록.',
    recommendedRatios: ['1:1'],
    layout: 'bottom-left',
    style: {
      color: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 0.08,
      bgColor: '#52647d',
      fontSize: 96,
      lineHeight: 1.4,
      align: 'left',
      textX: 0.1,
      textY: 0.84,
    },
  },
];

export const ERA_KEYS = ['2004', '2012', '2026'];

export const ERAS = [
  { id: '2004', label: '2004', caption: '개인 홈 · 메신저' },
  { id: '2012', label: '2012', caption: '프로필 · 피드' },
  { id: '2026', label: '2026', caption: '숏폼 · 썸네일' },
];

/**
 * 시연의 핵심 조합. 지정하지 않은 조합은 Persona 기본 스타일을 쓴다.
 *
 * `recommendedRatio` 는 **적용하지 않고 화면에 보여 주기만 한다.** 비율은
 * 사용자가 고른 값이고, 모습이나 시대를 눌렀다고 해서 캔버스 모양이 말없이
 * 바뀌면 방금 무엇이 바뀐 것인지 알기 어렵다.
 */
export const COMBINATION_STYLES = {
  // 2004 셋은 모두 같은 자리를 쓴다. 싸이월드 페이지에서 다이어리 글이
  // 들어가던 칸이다 — 기분 바 아래, BGM 줄 위. 이 범위를 벗어나면 글이
  // 장식과 겹친다. 색만 Persona 마다 다르게 둔다.
  //
  // 흰 페이지 위에 얹히므로 외곽선은 쓰지 않는다. 흰 글자에 검은 테두리를
  // 두르면 속이 빈 글자처럼 보인다.
  'normal:2004': {
    recommendedRatio: '1:1', fit: 'cover', bgColor: '#e6edf2', color: '#3a4a5a',
    strokeColor: '#ffffff', strokeWidth: 0, fontSize: 68,
    lineHeight: 1.5, align: 'left', textX: 0.14, textY: 0.8,
  },
  'social:2004': {
    recommendedRatio: '1:1', fit: 'cover', bgColor: '#f2e6ee', color: '#c2185b',
    strokeColor: '#ffffff', strokeWidth: 0, fontSize: 68,
    lineHeight: 1.5, align: 'left', textX: 0.14, textY: 0.8,
  },
  'close-friends:2004': {
    recommendedRatio: '1:1', fit: 'cover', bgColor: '#dfe8ed', color: '#2c6ea8',
    strokeColor: '#ffffff', strokeWidth: 0, fontSize: 68,
    lineHeight: 1.5, align: 'left', textX: 0.14, textY: 0.8,
  },
  'normal:2012': {
    recommendedRatio: '1:1', fit: 'cover', bgColor: '#eef1f4', color: '#172033',
    strokeColor: '#ffffff', strokeWidth: 0, fontSize: 92,
    lineHeight: 1.35, align: 'left', textX: 0.1, textY: 0.76,
  },
  'normal:2026': {
    recommendedRatio: '1:1', fit: 'cover', bgColor: '#26334a', color: '#ffffff',
    strokeColor: '#111111', strokeWidth: 0.065, fontSize: 140,
    lineHeight: 1.25, align: 'center', textX: 0.5, textY: 0.5,
  },
  'social:2026': {
    recommendedRatio: '9:16', fit: 'cover', bgColor: '#9f3d55', color: '#ffffff',
    strokeColor: '#171319', strokeWidth: 0.075, fontSize: 148,
    lineHeight: 1.08, align: 'center', textX: 0.5, textY: 0.7,
  },
  'close-friends:2026': {
    recommendedRatio: '9:16', fit: 'cover', bgColor: '#42574b', color: '#ffffff',
    strokeColor: '#151a17', strokeWidth: 0.06, fontSize: 108,
    lineHeight: 1.25, align: 'left', textX: 0.1, textY: 0.76,
  },
};

export function applyIdentity(state, personaId, eraId) {
  const preset = PRESETS.find((item) => item.id === personaId);
  if (!preset || !ERA_KEYS.includes(eraId)) return state;
  // 비율 관련 키는 꺼내서 버린다. 이 함수는 비율을 절대 쓰지 않는다.
  // recommendedRatio 뿐 아니라 ratio 까지 떼어 내는 이유는, 나중에 조합을
  // 추가하는 사람이 습관적으로 ratio 를 적더라도 조용히 새어 나가지 않게
  // 하기 위해서다.
  const { recommendedRatio, ratio, ...combination } =
    COMBINATION_STYLES[`${personaId}:${eraId}`] ?? preset.style;
  return { ...state, ...combination, persona: personaId, era: eraId };
}

/**
 * 지금 조합에 어울리는 비율. 적용은 하지 않고 추천만 한다.
 * 조합에 지정이 없으면 Persona 의 첫 번째 추천 비율을 쓴다.
 */
export function getRecommendedRatio(personaId, eraId) {
  const combination = COMBINATION_STYLES[`${personaId}:${eraId}`];
  if (combination?.recommendedRatio) return combination.recommendedRatio;
  const preset = PRESETS.find((item) => item.id === personaId);
  return preset?.recommendedRatios[0] ?? null;
}

/** Persona를 현재 Era와 조합해 한 번의 상태 변경으로 적용한다. */
export function applyPreset(state, presetId) {
  return applyIdentity(state, presetId, state.era ?? '2026');
}

export function applyEra(state, eraId) {
  return applyIdentity(state, state.persona ?? 'normal', eraId);
}
