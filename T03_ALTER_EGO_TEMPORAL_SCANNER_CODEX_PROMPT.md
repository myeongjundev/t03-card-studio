# T03 ALTER / EGO — Temporal Scanner Hero 구현 프롬프트

## 역할

너는 현재 React 기반으로 제작 중인 `T03 짤·카드 스튜디오`를 개선하는 **Senior Frontend Engineer + Interaction Designer + Creative Developer**다.

이번 목표는 단순히 랜딩 페이지를 더 화려하게 만드는 것이 아니다.

현재 프로젝트의 핵심 기능과 상태 구조를 유지하면서, 사용자가 첫 화면에서 바로 프로젝트의 설계 의도를 이해할 수 있도록 **대표 인터랙션이 있는 Hero Experience**를 구현한다.

프로젝트의 핵심 메시지는 다음과 같다.

> **같은 사진. 다른 시대. 다른 나.**  
> ONE PHOTO · THREE ERAS · THREE IDENTITIES

프로젝트 이름:

> **ALTER / EGO**

Hero Experience 이름:

> **TEMPORAL SCANNER**

---

# 0. 작업 시작 전 필수 원칙

코드를 수정하기 전에 반드시 현재 프로젝트를 먼저 분석한다.

다음 사항을 먼저 확인한 뒤 구현 계획을 세운다.

- 현재 React 컴포넌트 구조
- Hero 영역의 기존 컴포넌트
- Canvas / Preview 렌더링 구조
- 이미지 업로드 상태 관리 방식
- `ratio`, `fit`, `bgColor`, `text`, `fontSize`, `color`, `persona`, `era` 등 카드 상태 구조
- localStorage 저장 구조
- Undo / Redo 구조
- URL Hash 공유 구조
- `#card=...` 공유 링크 복원 방식
- GitHub Pages 배포 경로
- 기존 반응형 CSS
- 다운로드 PNG 렌더링 로직

분석 없이 Hero 전체를 새로 덮어쓰지 않는다.

현재 프로젝트에서 정상 작동하는 기능은 절대 깨뜨리지 않는다.

특히 아래 기능은 반드시 유지한다.

- 이미지 업로드
- 문구 편집
- 텍스트 위치
- 텍스트 크기
- 텍스트 색상
- stroke
- line-height
- align
- 비율 변경
- 1:1
- 4:5
- 9:16
- 템플릿 기능
- localStorage
- Undo / Redo
- PNG 다운로드
- JSON import / export
- 공유 링크
- `#card=` deep link 복원
- GitHub Pages 배포

---

# 1. 기존 Hero의 문제

현재 Hero는 다음과 같은 구성이다.

- 왼쪽: 큰 Editorial Typography
- 오른쪽: 2004 / 2012 / 2026 카드 3장
- 카드가 기울어진 collage 형태
- 검정 배경
- off-white typography
- acid green accent
- grid 기반 layout

현재 디자인 자체는 유지할 가치가 있다.

하지만 Hero가 전달하는 경험은 아직 다음 수준에 머문다.

> "2004, 2012, 2026 디자인 카드가 예쁘게 배치되어 있다."

이번 개선에서는 이것을 다음 경험으로 바꾼다.

> "사용자가 직접 시간의 경계를 움직이며 같은 사진이 시대에 따라 변하는 것을 체험한다."

즉,

**Decoration → Interaction**

으로 전환한다.

---

# 2. 최종 방향

Hero의 대표 인터랙션을

# TEMPORAL SCANNER

로 구현한다.

사진 3장을 각각 보여주지 않는다.

**한 장의 사진을 중심으로 시대의 경계를 사용자가 직접 움직인다.**

기본 구조:

```text
A/E                                      TIME INDEX 001 / 2026


같은 사진.
다른 시대.
다른 나.

ONE PHOTO
THREE ERAS
THREE IDENTITIES


                         ┌─────────────────────┐
                         │                     │
              2004       │       PHOTO         │
                         │           │         │
                         │           │         │
                         │       TIME CUT      │
                         │           │         │
                         │                     │
                         └─────────────────────┘

                 2004 ━━━━━●━━━━ 2012 ━━━━━ 2026
                            DRAG THROUGH TIME


                    [ ENTER THIS ERA ↗ ]


────────────────────────────────────────────────────────
2004                                               2026
22 YEARS OF YOU
```

---

# 3. 핵심 인터랙션

Hero의 사진 위에 세로 Scanner를 만든다.

사용자는 Scanner를 좌우로 Drag할 수 있다.

Desktop:

- mouse drag
- pointer drag
- track 클릭 이동

Mobile:

- touch drag
- horizontal swipe

Keyboard:

- Left Arrow
- Right Arrow

를 지원한다.

Scanner 위치는 `0 ~ 1` normalized progress 값으로 관리한다.

예:

```text
0.00 = 2004
0.50 = 2012
1.00 = 2026
```

대표 Snap Point:

```text
2004 = 0
2012 = 0.5
2026 = 1
```

사용자가 손을 놓으면 가장 가까운 시대에 자연스럽게 snap한다.

Snap transition은 약:

```text
300 ~ 500ms
```

정도로 자연스럽게 처리한다.

---

# 4. 단순 Slider처럼 보이면 안 된다

이 인터랙션은 일반적인 range slider처럼 보이면 안 된다.

사용자는

> "설정을 바꾸고 있다."

가 아니라

> "시간의 경계를 직접 움직이고 있다."

고 느껴야 한다.

따라서 Scanner는 다음처럼 표현한다.

```text
2004 STYLE      │      2026 STYLE
                │
                │
            TIME CUT
                │
                │
```

Scanner line 주변에는 아주 약한 glow 또는 contrast 차이를 줄 수 있다.

단, 과도한 cyberpunk 표현은 금지한다.

현재 사이트의 editorial / brutalist / archive aesthetic을 유지한다.

---

# 5. 시대별 Visual System

시대가 바뀔 때 **사진 필터만 바뀌면 안 된다.**

다음 요소가 함께 변해야 한다.

- image treatment
- typography
- ratio
- border
- caption
- metadata
- background texture
- microcopy
- motion language
- accent treatment

---

# 6. 2004 Era

Concept:

> 개인 홈페이지 / 미니홈피 / 초기 개인화 웹

Visual:

- sky blue
- pale gray
- white
- pixel-like details
- CRT / scanline texture는 매우 약하게
- 오래된 LCD / monitor 감성
- sticker 또는 tiny icon
- 낮은 정보 밀도의 작은 UI label

Copy 예시:

```text
2004

오늘도 나답게
행복하기 ✦

mini room / online
```

Metadata 예시:

```text
TIME INDEX 001
2004.08.25

VISITOR 0217
ONLINE
```

Typography:

- 본문은 현재 프로젝트 typography 체계를 깨지 않는 범위
- 일부 UI label만 pixel / mono 계열
- 가독성을 해치는 실제 bitmap font 남용 금지

Motion:

- 느림
- 약간 끊기는 듯한 digital 느낌
- 150 ~ 250ms 단위의 subtle UI update

---

# 7. 2012 Era

Concept:

> 사진 중심 SNS / 초기 Instagram / feed identity

Visual:

- faded photography
- square 또는 4:5
- pink / beige
- soft gray
- subtle grain
- thin borders
- photo-first composition

Copy:

```text
2012

#daily #mood
just the way i am

12:04 PM · SEOUL
```

Metadata:

```text
POST 002
FILTER / SOFT
LOCATION / SEOUL
```

Typography:

- thin sans serif
- 작은 hashtag
- restrained spacing

Motion:

- 부드럽고 비교적 안정적인 easing

---

# 8. 2026 Era

Concept:

> Short-form / Reels / Shorts / multiple identities

Visual:

- near-black
- acid green
- strong contrast
- 9:16
- bold oversized typography
- overlay UI
- vertical content framing
- 현재 ALTER / EGO identity와 가장 직접적으로 연결

Copy:

```text
2026

UNFILTERED
VERSION OF ME

ALTER / EGO 03
```

Metadata:

```text
ERA / 2026
IDENTITY / LIVE
FORMAT / VERTICAL
```

Motion:

- 빠르고 정확함
- responsive
- snap감이 더 명확함

---

# 9. 가장 중요한 포인트 — Ratio Morph

현재 Studio의 실제 기능인 비율 선택을 Hero의 이야기와 연결한다.

각 시대의 대표 비율:

```text
2004 → 1:1
2012 → 4:5
2026 → 9:16
```

Scanner를 이동할 때 Preview frame 자체가 자연스럽게 morph한다.

단순히 snap 이후 갑자기 크기가 바뀌지 않는다.

가능하면 CSS interpolation 또는 layout animation을 사용한다.

예:

```text
2004            2012                2026

┌──────┐        ┌────────┐           ┌─────┐
│      │        │        │           │     │
│ 1:1  │   →    │  4:5   │     →     │     │
│      │        │        │           │9:16 │
└──────┘        └────────┘           │     │
                                     └─────┘
```

이 기능의 디자인 의도:

> 시대가 변하면서 온라인에서 사진을 소비하는 프레임 자체도 변했다.

따라서 심사자에게 다음 설명이 가능해야 한다.

> "비율 선택 기능을 단순 설정 UI로 숨기지 않고, 시대별 콘텐츠 소비 방식의 변화를 Canvas ratio 변화로 시각화했습니다."

---

# 10. Continuous Time 표현

실제 스타일 preset은 3개만 있어도 된다.

하지만 Scanner를 움직이는 동안 숫자는 연속적으로 변한다.

예:

```text
2004.00
2004.38
2005.72
2007.41
2010.93
2012.00
2017.84
2023.51
2026.00
```

이 숫자는 visual feedback 용이다.

실제 디자인 preset은 아래 세 개 사이를 interpolation한다.

```text
2004
2012
2026
```

이렇게 해서 사용자가 "버튼을 클릭한다"가 아니라

**시간을 실제로 움직이고 있다는 느낌**을 준다.

---

# 11. Cursor Interaction

Desktop에서는 사진 위 cursor를 기본 화살표로 두지 않는다.

Preview 위:

```text
◀ DRAG TIME ▶
```

Scanner 가까이:

```text
TIME CUT
```

Timeline 위:

```text
2004
2012
2026
```

형태의 작은 floating cursor label을 사용할 수 있다.

과도한 custom cursor animation은 금지한다.

성능을 해치지 않는 범위에서 구현한다.

---

# 12. Time Lock Interaction

Scanner를 놓아 특정 시대에 snap되면 약 0.3 ~ 0.5초 정도의 상태 변화를 준다.

예:

```text
TIME LOCKED

2012

YOU ARE HERE.
```

이 문구가 작은 metadata 형태로 등장한다.

큰 modal은 사용하지 않는다.

사용 흐름을 끊지 않는다.

---

# 13. Hero → Studio 연결

Hero는 단순 Showcase가 아니다.

사용자가 Hero에서 선택한 시대가 실제 Studio 상태와 연결되어야 한다.

예:

Scanner를 2012에 두고

```text
ENTER THIS ERA ↗
```

를 클릭하면 Studio로 이동한다.

그리고 Studio에 다음 상태를 전달한다.

```text
era = 2012
ratio = 4:5
```

가능하다면 persona도 시대에 맞는 기본값을 설정한다.

예:

```text
2004
persona = close-friends

2012
persona = normal

2026
persona = professional 또는 alter-ego
```

단, 기존 프로젝트의 상태 구조를 먼저 분석한 후 실제 enum 값에 맞춰 구현한다.

없는 값을 임의로 만들어 기존 로직을 깨뜨리지 않는다.

---

# 14. 중요한 UX 연결

Hero에서 선택한 값이 Studio로 이동했는데 아무것도 반영되지 않는 상태는 금지한다.

사용자는 다음 경험을 해야 한다.

```text
Hero에서 2012 선택
        ↓
ENTER THIS ERA
        ↓
Studio 이동
        ↓
2012 preset이 바로 적용
        ↓
사용자가 자신의 이미지와 문구를 편집
        ↓
다운로드
```

즉,

# EXPERIENCE → CREATION

흐름을 만든다.

---

# 15. 전체 페이지 정보 구조

페이지 전체를 다음 흐름으로 정리한다.

```text
01 / EXPERIENCE
TEMPORAL SCANNER

↓

02 / WHY THESE ERAS
2004 / 2012 / 2026 Editorial Story

↓

03 / THREE IDENTITIES
기존 카드 3장 디자인

↓

04 / ALTER / EGO
Persona 설명

↓

05 / STUDIO
실제 카드 제작 도구

↓

06 / EXPORT
Download / Share
```

---

# 16. 기존 카드 3장은 삭제하지 않는다

현재 Hero 오른쪽에 존재하는

- 2004 blue card
- 2012 pink card
- 2026 black + green card

디자인은 완전히 제거하지 않는다.

Hero에서는 Temporal Scanner를 사용한다.

기존 카드 3장은 아래

```text
03 / THREE IDENTITIES
```

영역으로 이동한다.

예:

```text
ONE MOMENT
THREE DIGITAL IDENTITIES


[2004]
오늘도 나답게 행복하기

[2012]
#daily #mood

[2026]
UNFILTERED VERSION OF ME
```

이 영역은 Editorial Layout으로 구성한다.

---

# 17. Editorial Section

Hero가 Interaction이라면 아래는 Explanation이다.

구조:

```text
01

2004
THE WEB WAS PERSONAL.

인터넷에서 처음으로
'나'를 꾸미기 시작했다.
```

큰 이미지 또는 card.

그 다음:

```text
02

2012
THE WEB BECAME VISUAL.

텍스트보다 사진이
나를 설명하기 시작했다.
```

그리고:

```text
03

2026
THE SELF BECAME CONTENT.

하나의 정체성이 아니라
상황마다 다른 버전의 내가 존재한다.
```

---

# 18. ALTER / EGO Section

이 영역은 프로젝트 이름을 철학적으로 설명한다.

큰 Typography:

```text
WHO WERE YOU?

WHO ARE YOU?

WHO WILL YOU BECOME?
```

작은 설명:

```text
하나의 사진은 하나의 정체성만 가지지 않는다.

같은 순간도
어떤 시대의 화면에 놓이는지,
어떤 문구를 붙이는지,
어떤 비율로 잘라내는지에 따라

전혀 다른 '나'가 된다.
```

CTA:

```text
MAKE YOUR ALTER / EGO ↗
```

---

# 19. Hero Main Copy

기존:

```text
당신은 어느
시간에 살고
있나요?
```

도 좋은 문장이나,

Hero에서는 프로젝트 기능을 더 빠르게 설명할 수 있도록 다음 문장을 우선 검토한다.

Primary:

```text
같은 사진.
다른 시대.
다른 나.
```

Secondary:

```text
ONE PHOTO
THREE ERAS
THREE IDENTITIES
```

Description:

```text
한 장의 사진을
2004, 2012, 2026의 방식으로
다시 기록하는 타임 트래블 프로필 스튜디오.
```

기존 카피는 Editorial Section 또는 secondary copy로 재사용해도 된다.

---

# 20. Visual Direction

현재 프로젝트가 가진 다음 디자인 언어는 유지한다.

- dark background
- near black
- off-white
- acid green
- thin borders
- grid
- editorial typography
- technical metadata
- restrained brutalism
- archive / design magazine 느낌

새로운 Hero를 만든다고 해서

- neon cyberpunk
- glassmorphism
- generic SaaS gradient
- purple gradient
- excessive glow
- floating 3D blobs
- random particle animation

스타일로 변경하지 않는다.

ALTER / EGO의 정체성을 유지한다.

---

# 21. Motion Direction

Animation은 많이 넣는 것이 목표가 아니다.

**의미가 있는 animation만 사용한다.**

필요:

- scanner drag
- ratio morph
- text crossfade
- metadata interpolation
- snap
- subtle image treatment
- Hero → Studio scroll / transition

불필요:

- 모든 텍스트 등장 애니메이션
- 과도한 parallax
- 무의미한 rotate
- background particle
- cursor trail
- constant floating animation

---

# 22. 기술 구현 원칙

가능하면 기존 dependency를 우선 사용한다.

새 라이브러리를 설치하기 전에 반드시 현재 package.json을 확인한다.

추천 우선순위:

```text
1. React
2. CSS
3. Pointer Events
4. requestAnimationFrame
5. 기존 animation library
```

Framer Motion 또는 GSAP가 이미 있다면 활용 가능하다.

없다면 이 Hero 하나 때문에 무거운 dependency를 추가하지 않는 방향을 우선 검토한다.

WebGL / Three.js는 사용하지 않는다.

이번 프로젝트는 3D 기술 과시가 목적이 아니다.

---

# 23. Performance

Hero 때문에 Studio 성능이 떨어지면 실패다.

반드시 고려:

- pointer move마다 React state 과다 업데이트 금지
- requestAnimationFrame 활용 검토
- CSS transform 우선
- layout thrashing 방지
- unnecessary rerender 방지
- image preload
- listener cleanup
- ResizeObserver cleanup
- mobile 저성능 환경 고려

---

# 24. Accessibility

인터랙션은 마우스에만 의존하지 않는다.

반드시 지원:

- pointer
- touch
- keyboard

`prefers-reduced-motion` 대응.

Reduced Motion에서는:

- scanner drag는 유지
- ratio 즉시 변경 또는 짧은 transition
- decorative animation 최소화

또한:

- text contrast
- focus state
- button aria-label
- semantic button
- range interaction의 접근성

을 고려한다.

가능하면 Scanner를 접근성 관점에서는 Slider semantics로 구현한다.

예:

```text
role="slider"
aria-valuemin
aria-valuemax
aria-valuenow
aria-valuetext
```

단, 실제 구현 구조에 맞춰 판단한다.

---

# 25. Responsive

## Desktop

Hero:

```text
Left 40%
Right 60%
```

또는

```text
Text block + large scanner
```

구조.

Preview가 가장 큰 시각적 요소가 되어야 한다.

## Tablet

2-column 유지 가능하면 유지.

너무 좁으면 vertical stacking.

## Mobile

```text
Copy
↓
Temporal Scanner
↓
Timeline
↓
CTA
```

형태.

Mobile에서 카드 크기가 지나치게 작아지지 않게 한다.

모바일에서는 custom cursor는 비활성화.

---

# 26. GitHub Pages 주의

현재 사이트는 GitHub Pages에서 배포된다.

따라서 다음 사항을 깨뜨리지 않는다.

- relative assets path
- Vite base path
- SPA behavior
- hash state
- `#card=...`
- refresh
- direct entry
- build output

Hero 내 navigation 때문에 기존 `#card=` URL 구조를 변경하지 않는다.

현재 공유 링크 예:

```text
.../#card=...
```

이 구조가 계속 정상 작동해야 한다.

---

# 27. 공유 링크 상태 보존

기존 `#card=` 값이 존재하는 주소로 접속한 경우:

Hero 때문에 해당 데이터 복원이 지연되거나 덮어써지면 안 된다.

우선순위:

```text
URL 공유 데이터
>
기존 저장 상태
>
Hero default preset
```

Hero의 default era가 기존 card state를 강제로 overwrite하지 않도록 주의한다.

---

# 28. Studio와 Hero 상태 분리

Hero preview state와 실제 Studio state를 무조건 동일 object로 묶지 않는다.

Hero에서 Drag할 때마다 실제 사용자의 편집 데이터가 계속 변경되는 구조는 피한다.

추천:

```text
heroEra
heroProgress

editorState
```

를 구분.

사용자가 `ENTER THIS ERA`를 눌렀을 때만 editor state에 preset을 적용한다.

기존 상태 관리 구조에 더 적합한 방식이 있다면 그 방식을 사용한다.

---

# 29. Design Token 정리

가능하면 Hero 구현 과정에서 흩어진 값들을 정리한다.

예:

```css
--ae-bg
--ae-foreground
--ae-muted
--ae-accent

--era-2004-bg
--era-2004-accent

--era-2012-bg
--era-2012-accent

--era-2026-bg
--era-2026-accent
```

단, 기존 CSS architecture를 깨면서 대규모 refactoring은 하지 않는다.

---

# 30. 구현 우선순위

다음 순서대로 구현한다.

## Phase 1

기존 프로젝트 분석.

## Phase 2

Temporal Scanner static layout.

## Phase 3

Pointer drag + snapping.

## Phase 4

2004 / 2012 / 2026 visual preset.

## Phase 5

ratio morph.

## Phase 6

metadata / copy transition.

## Phase 7

Hero → Studio state 연결.

## Phase 8

responsive.

## Phase 9

accessibility.

## Phase 10

performance cleanup.

## Phase 11

build test.

## Phase 12

GitHub Pages compatibility 검증.

---

# 31. 완료 기준

다음 조건을 만족해야 완료로 판단한다.

### Visual

- [ ] Hero에서 카드 3장 collage가 주인공이 아니다.
- [ ] Temporal Scanner가 가장 먼저 눈에 들어온다.
- [ ] 기존 ALTER / EGO aesthetic을 유지한다.
- [ ] 2004 / 2012 / 2026가 명확히 서로 다른 시대처럼 보인다.
- [ ] generic AI landing page처럼 보이지 않는다.

### Interaction

- [ ] Scanner를 Drag할 수 있다.
- [ ] 2004 / 2012 / 2026로 snap된다.
- [ ] 연속적인 year feedback이 보인다.
- [ ] ratio가 시대에 따라 변화한다.
- [ ] metadata와 copy도 바뀐다.
- [ ] touch에서 작동한다.
- [ ] keyboard에서도 조작 가능하다.

### Product

- [ ] Hero에서 선택한 era가 Studio로 전달된다.
- [ ] Studio에서 실제 편집을 이어갈 수 있다.
- [ ] 기존 editor 기능이 모두 유지된다.
- [ ] 기존 다운로드 결과가 깨지지 않는다.

### State

- [ ] localStorage 정상
- [ ] Undo / Redo 정상
- [ ] URL 공유 정상
- [ ] `#card=` 복원 정상
- [ ] JSON import / export 정상

### Deployment

- [ ] `npm run build` 성공
- [ ] console error 없음
- [ ] GitHub Pages 정상
- [ ] refresh 정상
- [ ] mobile 정상

---

# 32. 하지 말 것

다음 방향은 피한다.

- 기존 프로젝트 전체 재작성
- Studio 기능 축소
- UI framework 전체 교체
- 모든 CSS 제거 후 재구축
- unnecessary dependency 추가
- WebGL
- Three.js
- 과도한 3D
- 무의미한 particle
- cyberpunk makeover
- generic SaaS landing page
- Hero 때문에 편집 상태 덮어쓰기
- 단순 carousel로 대체
- 단순 range input 그대로 노출
- 카드 3장 이미지만 다시 배치
- 기존 기능을 mock UI로 교체

---

# 33. 평가자가 기억해야 하는 장면

이번 개선에서 가장 중요한 목표다.

평가자가 사이트 이름을 정확히 기억하지 못해도 다음 장면은 기억해야 한다.

> "사진 위의 선을 좌우로 움직이면 2004에서 2026으로 변하던 사이트."

이 장면이 이번 프로젝트의 Signature Interaction이다.

---

# 34. 설계 설명이 가능한 프로젝트

최종 결과물은 다음과 같이 설명할 수 있어야 한다.

> 이 프로젝트는 단순한 카드 제작기가 아닙니다.
>
> 한 장의 사진도 시대에 따라 전혀 다른 방식으로 소비된다는 점에서 출발했습니다.
>
> 2004년의 개인 홈페이지,
> 2012년의 사진 중심 SNS,
> 2026년의 숏폼 미디어를 하나의 Temporal Scanner 안에 연결했습니다.
>
> 사용자는 시간을 직접 드래그하며 시대별 시각 언어와 화면 비율의 변화를 경험하고,
> 선택한 시대를 그대로 Studio로 가져가 자신만의 ALTER / EGO 카드를 제작할 수 있습니다.

---

# 35. 최종 UX Flow

```text
LAND

↓

같은 사진.
다른 시대.
다른 나.

↓

TEMPORAL SCANNER

↓

DRAG THROUGH TIME

2004
↓
2012
↓
2026

↓

TIME LOCKED

↓

ENTER THIS ERA

↓

EDITOR

↓

UPLOAD PHOTO

↓

CUSTOMIZE ALTER / EGO

↓

DOWNLOAD / SHARE
```

---

# 36. 최종 디자인 공식

이 프로젝트 전체를 다음 공식으로 이해하고 구현한다.

```text
INTERACTION
+
STORY
+
REAL EDITOR FUNCTION
=
ALTER / EGO
```

Hero는 장식이 아니다.

Hero는 이 프로젝트의 기능을 가장 압축적으로 보여주는 **Playable Concept**이어야 한다.

---

# 37. 작업 방식

바로 수정부터 하지 않는다.

먼저 현재 코드를 분석하고 다음을 짧게 보고한다.

```text
1. 현재 Hero 구조
2. 현재 editor state 구조
3. Temporal Scanner를 추가할 위치
4. 재사용할 기존 컴포넌트
5. 새로 만들 컴포넌트
6. 상태 충돌 가능성
7. 구현 순서
```

그다음 구현한다.

구현이 끝난 뒤에는 다음을 보고한다.

```text
변경 파일
구현 내용
유지한 기존 기능
새 인터랙션
접근성 처리
반응형 처리
빌드 결과
주의할 점
```

---

# 최종 목표

단순히

> "디자인이 예쁜 T03 과제"

가 아니라

> **"디자인 의도, 인터랙션, React 구현, Canvas 기능, 상태 관리가 하나의 컨셉으로 연결된 작품"**

을 만든다.

특히 이번 작업의 최우선 목표는

# 같은 사진. 다른 시대. 다른 나.

라는 메시지를 사용자가 **읽기 전에 먼저 체험하게 만드는 것**이다.
