# ALTER EGO · T03 구현 프롬프트

현재 React 기반의 SKT ALEPH T03 과제 **‘짤·카드 스튜디오’​**를 개발 중이다.

이번 프로젝트는 단순한 이미지 편집기가 아니라 다음 콘셉트로 발전시킨다.

# ALTER EGO

**One moment. Different you.**  
**하나의 순간, 여러 개의 나.**

ALTER EGO는 하나의 이미지와 메시지를 상황과 관계에 따라 서로 다른 온라인 자아로 표현할 수 있는 **local-first 카드 스튜디오**다.

핵심 아이디어는 다음과 같다.

> 사람은 온라인에서 항상 같은 모습으로 자신을 표현하지 않는다.  
> 같은 사진과 같은 메시지라도 포트폴리오, SNS, 가까운 친구, 밈 공간에서는 서로 다른 방식으로 표현된다.  
> ALTER EGO는 이 차이를 단순한 색상 테마가 아니라 **레이아웃과 표현 방식의 변화**로 보여준다.

---

# 0. 현재 코드 기준선 — 반드시 먼저 확인

이 문서는 아이디어가 정리된 시점보다 현재 코드가 더 진행된 상태에서 실행된다.

현재 저장소에는 이미 스타일 프리셋 4종, 글자 테두리, Canvas 문구 드래그,
실제 Canvas 픽셀 기반 대비 검사, 클립보드 이미지 복사, 공유 링크,
세 비율 일괄 저장, Undo / Redo와 History 단위 테스트가 구현되어 있다.

같은 역할의 시스템을 병렬로 새로 만들지 말고 반드시 다음 기존 구현을 재사용한다.

```text
Persona       → src/state/presets.js
READY CHECK   → src/render/contrast.js 및 기존 layout 결과
Undo / Redo   → src/state/history.js 및 App.jsx의 historyRef
Canvas render → src/render/renderCard.js
Template      → src/templates/schema.js / storage.js
```

## 0-1. 구현 전에 먼저 제거할 불변식 위반

현재 `src/io/exportAllRatios.js`의 세 비율 일괄 저장은 화면에 보이지 않는 별도
Canvas를 새로 만들고 다시 그린다. 같은 `renderCard()`를 사용하더라도 다음 핵심
불변식을 위반한다.

> 다운로드는 현재 미리보기 Canvas를 그대로 `toBlob()` 해야 하며 다시 그리지 않는다.

ALTER EGO 구현 전에 다음을 수행한다.

- `세 비율 모두 저장` UI를 제거한다.
- `exportAllRatios.js`와 연결 코드를 제거한다.
- 현재 선택된 비율의 미리보기 Canvas를 그대로 내려받는 기능은 유지한다.
- 단일 Canvas Preview = Export를 테스트와 실제 브라우저에서 다시 확인한다.
- 일괄 저장을 다른 별도 Canvas 방식으로 다시 구현하지 않는다.

## 0-2. 작업 시작 게이트

코드를 수정하기 전에 실제 파일을 읽고 다음 내용을 먼저 짧게 보고한다.

1. 현재 구현된 기능
2. 재사용할 기존 모듈
3. 제거할 중복 또는 불변식 위반 코드
4. 변경할 파일
5. 회귀 위험

그 후 이 문서의 범위 안에서 최소 변경으로 구현한다.

---

# 1. 현재 기본 기능

현재 프로젝트에는 다음 기능이 있거나 구현 대상이다.

- PNG/JPEG 이미지 불러오기
- 이미지 위에 한글 문구 배치
- 문구 위치 변경
- 문구 크기 변경
- 문구 색상 변경
- 줄 간격 변경
- 정렬 변경
- 1:1 / 4:5 / 9:16 화면비 지원
- 실시간 Canvas 미리보기
- 현재 미리보기 Canvas를 그대로 PNG로 다운로드
- 템플릿 생성
- 템플릿 불러오기
- 템플릿 수정
- 템플릿 삭제
- localStorage 기반 템플릿 유지
- 템플릿 JSON 가져오기
- 템플릿 JSON 내보내기
- 잘못된 JSON 입력 보호
- 잘못된 이미지 입력 보호
- 긴 문장 대응
- 이모지 대응
- 투명 PNG 대응
- 이미지가 외부 서버로 전송되지 않는 local-first 구조
- Undo / Redo 구현 완료
- Canvas 문구 드래그
- 스타일 프리셋 4종
- 글자 테두리
- Canvas 픽셀 기반 대비 검사
- 클립보드 이미지 복사
- 이미지 없는 편집 상태 공유 링크

기존 기능을 삭제하거나 약화시키지 않는다.

---

# 2. 절대 깨뜨리면 안 되는 불변식

다음 원칙은 기능 추가보다 우선한다.

## 2-1. Preview = Export

미리보기 Canvas와 다운로드되는 PNG는 반드시 동일한 렌더링 결과여야 한다.

별도의 export renderer를 만들지 않는다.

반드시 다음 구조를 유지한다.

```text
Editor State
    ↓
Canvas Renderer
    ↓
Preview Canvas
    ↓
현재 Preview Canvas의 canvas.toBlob()
    ↓
PNG
```

즉 다운로드 이미지를 별도로 다시 그려서는 안 된다.

새로운 `toDataURL()` 기반 다운로드 경로도 추가하지 않는다.

---

## 2-2. JSON은 전체 검증 후에만 Commit

JSON Import는 다음 순서를 따른다.

```text
Parse
↓
Validate
↓
Normalize
↓
Commit
```

중간 단계에서 현재 상태나 기존 템플릿을 변경하면 안 된다.

JSON이 잘못된 경우:

- 현재 편집 상태 유지
- 기존 템플릿 유지
- localStorage 유지
- 오류 메시지만 표시

해야 한다.

---

## 2-3. 오류가 사용자의 작업을 파괴하면 안 된다

잘못된 이미지, 잘못된 JSON, 예상하지 못한 입력이 들어와도:

- 현재 작업을 초기화하지 않는다.
- 기존 템플릿을 삭제하지 않는다.
- History를 불필요하게 날리지 않는다.
- 가능한 경우 이전 정상 상태를 유지한다.

---

## 2-4. 대규모 리팩터링 금지

이번 작업은 기존 T03를 ALTER EGO로 발전시키는 작업이다.

따라서 다음을 금지한다.

- 전체 상태 구조를 이유 없이 교체
- Canvas renderer 전면 재작성
- UI 프레임워크 신규 도입
- Redux/Zustand 등 새로운 전역 상태 라이브러리 추가
- Fabric.js/Konva.js 등 Canvas 라이브러리 신규 도입
- 기존 기능 삭제 후 재구현
- 디렉터리 구조의 대규모 변경
- 불필요한 런타임 dependency 추가

현재 구조를 먼저 읽고, **최소 변경으로 확장**한다.

---

# 3. ALTER EGO의 핵심 기능

이번 차별화의 핵심은 **Persona Mode**다.

최소 다음 네 가지 Persona를 제공한다.

## PROFESSIONAL

키워드:

- 정돈
- 절제
- 신뢰
- 여백
- 명확한 정보 전달

기본 표현:

- 균형 잡힌 레이아웃
- 과도하게 큰 글씨 금지
- 좌측 정렬 또는 안정적인 중앙 정렬
- 충분한 여백
- 1:1 또는 4:5와 잘 어울림

---

## SOCIAL

키워드:

- 감각적
- 공유
- SNS
- 시선 집중

기본 표현:

- 강조되는 메인 문구
- 중앙 또는 하단 배치
- 4:5 중심
- 사진과 텍스트의 시각적 균형

---

## CLOSE FRIENDS

키워드:

- 솔직함
- 친근함
- 사적인 느낌
- 대화체

기본 표현:

- 하단 자막형 또는 자유로운 배치
- 여백이 조금 덜 엄격함
- 사진 자체가 더 많이 보이게 구성
- 자연스럽고 부담 없는 텍스트 크기

---

## CHAOTIC

키워드:

- 밈
- 과장
- 에너지
- 인터넷 문화
- 의도적인 불균형

기본 표현:

- 큰 텍스트
- 비대칭 배치
- 과감한 위치
- 9:16과 잘 어울림

단, CHAOTIC이라고 해서 렌더러를 불안정하게 만들거나 텍스트가 의도치 않게 Canvas 밖으로 완전히 사라져서는 안 된다.

---

# 4. 매우 중요한 Persona 동작 원칙

Persona는 단순 CSS Theme가 아니다.

다음 항목을 실제 편집 상태에 반영해야 한다.

- text position
- font size
- text alignment
- line height
- 필요하다면 기본 text color
- 필요하다면 text stroke
- 레이아웃 관련 값

Persona는 현재 Canvas 비율을 강제로 바꾸지 않는다. 대신 각 Persona UI에
추천 비율을 표시한다.

```text
PROFESSIONAL — 추천 1:1 / 4:5
SOCIAL — 추천 4:5
CLOSE FRIENDS — 추천 1:1
CHAOTIC — 추천 9:16
```

사용자가 작업 중인 Canvas 모양을 Persona 선택이 갑자기 바꾸지 않게 한다.

단, 사용자가 입력한 **실제 문구 내용은 자동으로 변경하지 않는다.**

예:

사용자가

```text
드디어 프로젝트 끝냈다
```

라고 입력했다면,

PROFESSIONAL / SOCIAL / CLOSE FRIENDS / CHAOTIC을 변경해도 문구 문자열 자체는 유지한다.

ALTER EGO의 핵심은 AI가 말을 대신 작성하는 것이 아니라:

> **같은 메시지를 어떻게 다르게 보여줄 것인가**

이다.

---

# 5. Persona 적용 방식

Persona는 가능하면 preset 형태로 구현한다.

새 preset 시스템을 만들지 않는다. 현재 `src/state/presets.js`의
`PRESETS`와 `applyPreset()`을 ALTER EGO Persona의 기반으로 개편한다.

기존 프리셋과 Persona가 UI에 동시에 존재하거나, 같은 역할의 상수와 적용 함수를
두 벌 만들면 실패로 본다.

예시 개념:

```js
const PERSONA_PRESETS = {
  professional: {
    textAlign: "left",
    fontScale: 0.07,
    x: 0.1,
    y: 0.78,
    lineHeight: 1.25,
  },

  social: {
    textAlign: "center",
    fontScale: 0.09,
    x: 0.5,
    y: 0.72,
    lineHeight: 1.15,
  },

  closeFriends: {
    textAlign: "left",
    fontScale: 0.065,
    x: 0.08,
    y: 0.84,
    lineHeight: 1.2,
  },

  chaotic: {
    textAlign: "center",
    fontScale: 0.13,
    x: 0.5,
    y: 0.55,
    lineHeight: 0.95,
  },
};
```

위 숫자는 예시일 뿐 현재 상태 모델과 Canvas 기준에 맞게 조정한다.

가능하면 위치는 Canvas 절대 px보다 normalized coordinate 또는 기존 구조와 호환되는 상대 좌표 방식을 우선 검토한다.

예:

```text
x = 0.5
y = 0.8
```

단, 기존 코드가 절대 좌표 기반이고 이를 변경하는 것이 위험하다면 무리하게 구조를 바꾸지 않는다.

---

# 6. Persona 변경과 Undo / Redo

Persona 변경은 하나의 편집 행동으로 취급한다.

예:

```text
State A
↓
PROFESSIONAL
↓
State B
↓
CHAOTIC
↓
State C
```

Undo:

```text
State C → State B
```

Redo:

```text
State B → State C
```

Persona 변경 과정에서 history stack을 초기화하지 않는다.

연속된 내부 setState 호출 때문에 Undo가 지나치게 여러 단계로 쪼개지지 않도록 주의한다.

가능하다면 Persona 적용을 **하나의 atomic state update**로 처리한다.

현재 History는 600ms 이내의 변경을 같은 burst로 묶는다. 따라서 atomic
`setState`만으로는 직전 수동 편집과 Persona 전환이 하나의 Undo 단계로 합쳐질 수 있다.

Persona를 적용할 때는 기존 History 구조를 재사용하면서 반드시 독립적인 history
boundary를 만든다.

```text
Persona 클릭
→ 현재 burst 종료
→ Persona 적용 전 상태를 독립 단계로 기록
→ 하나의 state patch로 Persona 적용
```

새 History 시스템을 만들지 않는다.

---

# 7. Persona를 선택한 뒤에도 수동 편집 가능

Persona는 사용자를 가두는 모드가 아니라 **출발점**이다.

예:

```text
SOCIAL 선택
↓
SOCIAL preset 적용
↓
사용자가 직접 위치 변경
↓
색상 변경
↓
폰트 크기 변경
```

모두 가능해야 한다.

Persona가 활성화되어 있다고 해서 사용자의 수동 조정을 계속 덮어쓰면 안 된다.

즉 Persona는:

> 자동 스타일 강제 시스템

이 아니라:

> 편집 시작점을 빠르게 만드는 preset

으로 취급한다.

---

# 8. ALTER EGO 화면 경험

첫 인상에서 기존 이미지 편집기와 달라 보여야 한다.

가능하면 편집 화면 상단이나 주요 영역에 다음 질문을 보여준다.

```text
WHO ARE YOU ONLINE?
```

또는 한국어 보조 문구:

```text
오늘은 어떤 모습으로 보이고 싶나요?
```

Persona 선택 UI:

```text
PROFESSIONAL
SOCIAL
CLOSE FRIENDS
CHAOTIC
```

각 Persona는 색만 다른 버튼으로 표현하지 않는다.

가능하다면 작은 preview thumbnail 또는 레이아웃 실루엣을 보여준다.

단, UI 장식 때문에 핵심 기능을 망가뜨리지 않는다.

---

# 9. 브랜드 방향

제품명:

# ALTER EGO

영문 tagline:

```text
One moment. Different you.
```

한국어 tagline:

```text
하나의 순간, 여러 개의 나.
```

제품 설명:

```text
ALTER EGO는 하나의 이미지와 메시지를
상황과 관계에 따라 서로 다른 온라인 자아로 표현하는
local-first 카드 스튜디오입니다.
```

디자인은 지나치게 기업형 SaaS처럼 만들지 않는다.

원하는 느낌:

- 젊음
- 실험적
- 약간의 디지털 문화
- 포스터 / 매거진 / 인터넷 문화
- 20대의 자기표현
- 단, 사용성은 유지

피해야 할 것:

- 과도한 글래스모피즘
- 의미 없는 gradient 남발
- 지나친 neon
- 모든 영역 rounded card 처리
- 흔한 AI dashboard 느낌
- 텍스트보다 장식이 더 눈에 띄는 UI

---

# 10. Local-first를 제품 특징으로 드러내기

현재 이미지는 외부 서버로 보내지지 않는 구조다.

이것을 단순 기술 설명이 아니라 ALTER EGO의 가치로 보여준다.

화면에 작은 상태 표시를 둘 수 있다.

예:

```text
LOCAL ONLY
```

또는:

```text
Private by default
Your image stays in this browser.
```

단, 실제 동작과 다른 보안 주장을 하지 않는다.

외부 서버 전송이 실제로 없다면 그 사실만 정확히 표현한다.

---

# 11. READY CHECK

기존에 검토하던 Card Lint 아이디어는 버리지 않는다.

다만 이것을 ALTER EGO의 메인 기능으로 만들지 않는다.

작은 **READY CHECK** 또는 **POST CHECK** 기능으로 통합한다.

초기 구현 우선순위는 다음 정도만 한다.

### 필수 후보

- 텍스트가 Canvas 안전 영역을 크게 벗어나는지
- 글자가 지나치게 작은지
- 9:16에서 하단 UI 영역과 충돌 가능성이 있는지
- 텍스트 자동 축소가 발생했는지
- 현재 상태가 정상적으로 JSON export 가능한지

### 선택 후보

- 텍스트와 배경 대비
- 개인정보 게시 전 확인

검사항목을 지나치게 많이 만들지 않는다.

Persona가 주인공이고 READY CHECK는 조연이다.

READY CHECK를 위한 새 대비 검사 엔진을 만들지 않는다.

현재 `src/render/contrast.js`와 EditorPanel에 이미 구현된 실제 Canvas 픽셀 기반
대비 검사 결과를 재사용한다. READY CHECK는 기존 결과를 한곳에 조합해 보여주는
표현 계층이다.

초기 READY CHECK는 다음 기존 값만 조합한다.

- 기존 대비 검사 결과
- `layout.shrunk`
- 실제 렌더 글자 크기
- 9:16 visual safe zone 여부
- 현재 상태가 export 가능한지

---

# 12. 9:16 Safe Area

9:16에서는 Shorts/Reels/TikTok과 같은 세로 콘텐츠 UI가 화면 일부를 가릴 수 있다.

정확한 특정 플랫폼 픽셀값을 하드코딩해서 공식 규격인 것처럼 표현하지 않는다.

대신 일반적인 visual safe zone으로 표현한다.

예:

```text
Potential UI overlap area
```

Canvas preview 위에 toggle 가능한 guide overlay를 제공해도 좋다.

중요:

Guide는 편집 보조 UI이며 PNG에 포함되지 않는 것이 기본이다.

Export 시 guide가 실수로 포함되지 않도록 한다.

---

# 13. 템플릿과 Persona의 관계

기존 Template 기능을 유지한다.

Persona와 Template은 같은 개념으로 합치지 않는다.

추천 개념:

```text
Persona = 표현 방향
Template = 사용자가 저장한 구체적인 편집 상태
```

예:

```text
Persona: SOCIAL

Template:
"부산 야경 인스타 스타일"
```

사용자가 Persona를 기반으로 수정한 뒤 Template으로 저장할 수 있다.

1차 구현에서는 Persona 이름을 Template 또는 JSON에 저장하지 않는다.

Persona는 편집의 출발점이고, 적용 후 사용자가 수동 편집하면 더 이상 원래
Persona와 정확히 일치하지 않기 때문이다.

Template에는 Persona가 적용해 만든 구체적인 위치·크기·색상·정렬·테두리 값이
이미 저장된다. 이 값만으로 동일한 결과를 복원할 수 있다.

Persona 이름 저장은 실제 사용자 가치가 확인된 뒤 별도 schema migration으로
검토한다.

---

# 14. JSON Schema Version

JSON에는 이미 `schemaVersion: 1`이 있고 Import에서 엄격하게 검증한다.

ALTER EGO 1차 구현에서는 schemaVersion을 올리거나 새로운 최상위 JSON 구조로
바꾸지 않는다. 현재 flat template 구조와 전체 검증 후 commit 순서를 유지한다.

잘못된 JSON을 부분적으로 적용해서는 안 된다.

---

# 15. 극단 입력 테스트

ALTER EGO 적용 후 다음 입력을 반드시 확인한다.

- 한글 긴 문장
- 영어 긴 문장
- 줄바꿈이 많은 문장
- Emoji
- 특수문자
- 공백만 있는 문장
- 매우 긴 한 단어
- 투명 PNG
- 매우 큰 이미지
- 작은 이미지
- 잘못된 이미지 파일
- extension과 실제 MIME이 이상한 파일
- 잘못된 JSON
- 필드가 누락된 JSON
- 타입이 잘못된 JSON
- 예상보다 큰 숫자가 들어간 JSON

오류가 발생해도 기존 편집 상태가 유지되어야 한다.

---

# 16. 성능

Persona 변경이나 텍스트 변경 시 Canvas가 즉시 갱신되어야 한다.

불필요하게 매번 이미지 파일을 다시 decode하지 않는다.

가능하면 기존 Image object/cache 구조를 활용한다.

Undo/Redo history에 거대한 image binary나 Data URL이 계속 중복 저장되지 않도록 현재 구조를 확인한다.

기존 구조가 안정적으로 동작한다면 무리한 최적화는 하지 않는다.

---

# 17. 구현 우선순위

다음 순서로 진행한다.

## Phase 0 — 불변식 복구

- 세 비율 일괄 저장과 별도 Canvas export 경로 제거
- 현재 Preview Canvas의 `toBlob()` 다운로드 확인
- 관련 테스트 및 production build

---

## Phase 1 — 기존 구조 분석

먼저 코드를 읽는다.

다음을 파악한다.

- editor state 위치
- Canvas renderer 위치
- ratio 처리
- text render 처리
- template 구조
- localStorage 구조
- JSON import/export 구조
- Undo/Redo 구조
- download 구조

분석 없이 바로 대규모 수정하지 않는다.

---

## Phase 2 — 기존 Preset을 Persona로 개편

`src/state/presets.js`를 재사용해 기존 프리셋을 네 Persona로 개편한다.
별도 Persona 상태와 별도 preset registry는 만들지 않는다.

---

## Phase 3 — Persona UI

4개 Persona를 선택할 수 있도록 한다.

Persona 선택 시 현재 이미지와 문구를 유지하면서 레이아웃 속성만 atomic하게 변경한다.

---

## Phase 4 — Canvas 검증

각 Persona에서:

- Preview 정상
- Ratio 정상
- Text wrapping 정상
- Download PNG 동일

인지 확인한다.

---

## Phase 5 — Undo / Redo 연결

Persona 전환을 독립된 한 단계로 Undo/Redo 가능하게 만든다.

기존 history architecture를 재사용한다.

---

## Phase 6 — Template / JSON 회귀 확인

Persona가 적용한 구체적인 편집값이 기존 Template과 JSON으로 동일하게 왕복되는지
확인한다. Persona ID는 저장하지 않고 schemaVersion 1을 유지한다.

---

## Phase 7 — READY CHECK

기존 대비 검사와 layout 결과를 조합한 최소 검사 UI만 추가한다.

---

## Phase 8 — UI polish

마지막에 ALTER EGO의 브랜드 경험을 다듬는다.

기능 구현 전에 대규모 디자인 작업부터 하지 않는다.

Phase 0~6을 구현하고 테스트한 뒤 먼저 중간 결과를 보고한다. 기능 회귀가 없다는
확인 없이 Phase 7~8의 Safe Area, READY CHECK, 전체 브랜드 polish를 한 번에
진행하지 않는다.

---

# 18. 반드시 지켜야 할 작업 방식

코드를 수정하기 전에 먼저 현재 프로젝트 구조와 관련 파일을 읽어라.

그 후:

1. 현재 구조 요약
2. 변경이 필요한 파일
3. 최소 변경 계획
4. 위험 요소
5. 구현

순으로 진행한다.

작업 과정에서 기존 기능이 이미 충분히 잘 구현되어 있다면 재작성하지 말고 재사용한다.

---

# 19. 완료 조건

ALTER EGO 구현 완료는 다음 조건을 만족해야 한다.

- [ ] 기존 이미지 업로드가 정상 동작한다.
- [ ] 기존 텍스트 편집 기능이 정상 동작한다.
- [ ] 1:1 / 4:5 / 9:16이 정상 동작한다.
- [ ] PROFESSIONAL Persona가 동작한다.
- [ ] SOCIAL Persona가 동작한다.
- [ ] CLOSE FRIENDS Persona가 동작한다.
- [ ] CHAOTIC Persona가 동작한다.
- [ ] Persona 변경 후 수동 편집이 가능하다.
- [ ] Persona 변경을 Undo 할 수 있다.
- [ ] Persona 변경을 Redo 할 수 있다.
- [ ] Template 저장/불러오기에 Persona가 문제를 만들지 않는다.
- [ ] localStorage 데이터가 유지된다.
- [ ] JSON export가 정상 동작한다.
- [ ] JSON import가 정상 동작한다.
- [ ] 잘못된 JSON이 현재 데이터를 파괴하지 않는다.
- [ ] 잘못된 이미지가 현재 데이터를 파괴하지 않는다.
- [ ] 긴 문장이 Canvas를 깨뜨리지 않는다.
- [ ] Emoji가 Canvas를 깨뜨리지 않는다.
- [ ] 투명 PNG가 정상 동작한다.
- [ ] Preview와 PNG 다운로드 결과가 동일하다.
- [ ] 이미지는 외부 서버로 전송되지 않는다.
- [ ] 새로운 불필요한 런타임 라이브러리를 추가하지 않았다.
- [ ] 기존 필수 요구사항이 회귀하지 않았다.

---

# 20. 최종 제품 설명

최종적으로 이 프로젝트는 평가자에게 다음과 같이 설명할 수 있어야 한다.

> 기존 카드 편집기가 하나의 이미지를 꾸미는 데 집중한다면, ALTER EGO는 같은 이미지와 메시지가 온라인에서 누구에게 보여지는지에 따라 달라지는 표현 방식을 다룹니다.
>
> 사용자는 PROFESSIONAL, SOCIAL, CLOSE FRIENDS, CHAOTIC이라는 온라인 자아를 선택하고, 같은 콘텐츠를 서로 다른 레이아웃으로 표현할 수 있습니다.
>
> 모든 편집은 브라우저 내부에서 이루어지며 이미지는 서버로 전송되지 않습니다. 또한 Canvas 미리보기 자체를 PNG로 내보내 Preview와 Export의 결과가 달라지지 않도록 설계했습니다.
>
> Persona는 자동 생성 기능이 아니라 편집의 시작점을 제공하는 레이아웃 프리셋이며, 사용자는 이후 자유롭게 직접 수정할 수 있습니다.

---

# 가장 중요한 판단 기준

새 기능을 추가하기 전에 항상 다음 질문을 한다.

> **“이 기능이 ALTER EGO라는 제품 서사를 강화하는가?”**

아니라면 추가하지 않는다.

기능 수를 늘리는 것이 목표가 아니다.

이번 T03의 목표는:

> **같은 요구사항으로 만든 120개의 카드 편집기 중, ALTER EGO라는 하나의 제품으로 기억되는 것**

이다.
