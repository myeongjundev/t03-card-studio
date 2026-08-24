/**
 * 스타일 프리셋.
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
 * 화면 비율도 바꾸지 않는다. 프리셋을 눌렀는데 캔버스 모양까지 변하면
 * 무엇이 바뀐 것인지 알기 어렵다.
 */

export const PRESETS = [
  {
    id: 'subtitle',
    name: '예능 자막',
    hint: '굵은 흰 글씨에 검은 테두리. 사진 위에서 가장 잘 읽힙니다.',
    style: {
      color: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 0.11,
      bgColor: '#101418',
      fontSize: 150,
      lineHeight: 1.2,
      align: 'center',
      textX: 0.5,
      textY: 0.84,
    },
  },
  {
    id: 'soft',
    name: '감성',
    hint: '테두리 없이 얇고 넓게. 여백이 많은 사진에 어울립니다.',
    style: {
      color: '#fdf6ec',
      strokeColor: '#000000',
      strokeWidth: 0,
      bgColor: '#6b5b52',
      fontSize: 92,
      lineHeight: 1.8,
      align: 'center',
      textX: 0.5,
      textY: 0.5,
    },
  },
  {
    id: 'y2k',
    name: 'Y2K',
    hint: '형광색과 굵은 테두리로 튀게.',
    style: {
      color: '#7bf1a8',
      strokeColor: '#2b0a3d',
      strokeWidth: 0.14,
      bgColor: '#2b0a3d',
      fontSize: 165,
      lineHeight: 1.1,
      align: 'center',
      textX: 0.5,
      textY: 0.45,
    },
  },
  {
    id: 'minimal',
    name: '미니멀',
    hint: '흰 바탕에 검은 글씨. 공지나 안내에 어울립니다.',
    style: {
      color: '#1a1a1a',
      strokeColor: '#ffffff',
      strokeWidth: 0,
      bgColor: '#f5f3ef',
      fontSize: 96,
      lineHeight: 1.45,
      align: 'left',
      textX: 0.12,
      textY: 0.24,
    },
  },
];

/** 프리셋을 현재 상태에 얹는다. 문구·이미지·비율은 그대로 둔다. */
export function applyPreset(state, presetId) {
  const preset = PRESETS.find((item) => item.id === presetId);
  if (!preset) return state;
  return { ...state, ...preset.style };
}
