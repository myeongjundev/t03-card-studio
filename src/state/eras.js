/**
 * 시대 축의 단일 정의.
 *
 * 새 시대를 추가할 때 UI 목록, 허용값, 이미지/문구 영역, 렌더 분기를 따로
 * 찾아다니지 않게 한다. 실제 그리기 함수는 renderCard에 남겨 레이어 순서를
 * 한 진입점에서 통제하고, 여기에는 순수 데이터와 렌더 종류만 둔다.
 */
export const ERA_DEFINITIONS = [
  {
    id: '2004',
    label: '2004',
    caption: '개인 홈 · 메신저',
    renderKind: 'minihompy',
    imageTreatment: 'feature-phone',
    imageBox: { x: 0.13, y: 0.25, width: 0.74, height: 0.36 },
    textBox: { x: 0.13, y: 0.7, width: 0.74, height: 0.16 },
  },
  {
    id: '2012',
    label: '2012',
    caption: '프로필 · 피드',
    renderKind: 'film',
    imageTreatment: 'original',
    imageBox: null,
    textBox: null,
  },
  {
    id: '2026',
    label: '2026',
    caption: '숏폼 · 썸네일',
    renderKind: 'short-form',
    imageTreatment: 'original',
    imageBox: null,
    textBox: null,
  },
];

export const ERA_KEYS = ERA_DEFINITIONS.map((era) => era.id);

const ERA_BY_ID = new Map(ERA_DEFINITIONS.map((era) => [era.id, era]));

export function getEraDefinition(id) {
  return ERA_BY_ID.get(id) ?? ERA_BY_ID.get('2026');
}
